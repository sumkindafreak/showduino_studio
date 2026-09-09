export {
  compileSceneForStage,
  deploymentPlanText,
  downloadDeploymentPlan
} from './deployment-core.js';

const STAGE_TIMELINE_ENDPOINT = '/api/studio-timeline';
const STAGE_UPLOAD_CAPABILITY = 'studio-ram-timeline-upload';

function stageBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/$/, '');
}

async function readJson(response) {
  try { return await response.json(); }
  catch (_) { return null; }
}

export async function probeStageTimelineUpload(baseUrl = '') {
  const base = stageBaseUrl(baseUrl);
  const response = await fetch(`${base}${STAGE_TIMELINE_ENDPOINT}`, {
    headers: { Accept: 'application/json' }
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(`Stage timeline capability probe → ${payload?.error || `HTTP ${response.status}`}`);
  }

  return {
    ready: payload?.capability === STAGE_UPLOAD_CAPABILITY && payload?.state === 'ready',
    state: payload?.state || 'missing',
    capability: payload?.capability || STAGE_UPLOAD_CAPABILITY,
    payload
  };
}

async function postStageTimelineCommand(baseUrl, cmd) {
  const base = stageBaseUrl(baseUrl);
  const response = await fetch(`${base}${STAGE_TIMELINE_ENDPOINT}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd })
  });
  const payload = await readJson(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(`${cmd} → ${payload?.error || payload?.replies || `HTTP ${response.status}`}`);
  }
  return payload;
}

export async function deploySceneToStage(result, baseUrl = '') {
  if (!result?.ok) throw new Error('Scene compiler has blocking errors.');

  const capability = await probeStageTimelineUpload(baseUrl);
  if (!capability.ready) {
    throw new Error(`Target does not advertise ${STAGE_UPLOAD_CAPABILITY}=ready (reported ${capability.state}). Update the Communications S3 and P4 Stage firmware before direct deployment.`);
  }

  const replies = [];
  for (const command of result.uploadCommands) {
    replies.push({
      command,
      reply: await postStageTimelineCommand(baseUrl, command)
    });
  }
  return replies;
}
