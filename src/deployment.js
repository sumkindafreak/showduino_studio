import {
  compileSceneForStage as compileSceneCore,
  deploymentPlanText,
  downloadDeploymentPlan
} from './deployment-core.js';

export { deploymentPlanText, downloadDeploymentPlan };

const STAGE_TIMELINE_ENDPOINT = '/api/studio-timeline';
const STAGE_UPLOAD_CAPABILITY = 'studio-ram-timeline-upload';
const P4_TIMELINE_MAX_CUES = 2048;

export function compileSceneForStage(production, sceneId) {
  const result = compileSceneCore(production, sceneId);
  if (result.commands.length > P4_TIMELINE_MAX_CUES) {
    result.errors.push(`Compiled scene contains ${result.commands.length} commands; P4 RAM timeline limit is ${P4_TIMELINE_MAX_CUES}.`);
    result.ok = false;
  }
  return result;
}

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
