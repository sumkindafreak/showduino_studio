const SUPPORTED_ACTIONS = new Set(['audio','lighting','pixel','dmx','relay','video','delay','automation','trigger','safety']);

export function runPreflight(production) {
  const issues = [];
  const ids = new Set();
  const claimId = (id, label) => {
    if (!id) return issues.push({ level: 'error', text: `${label} has no stable ID.` });
    if (ids.has(id)) issues.push({ level: 'error', text: `Duplicate ID ${id} found at ${label}.` });
    ids.add(id);
  };

  if (!production?.name?.trim()) issues.push({ level: 'error', text: 'Production has no name.' });
  if (!Array.isArray(production?.scenes) || !production.scenes.length) issues.push({ level: 'error', text: 'Production contains no scenes.' });
  claimId(production?.id, 'Production');

  (production?.scenes || []).forEach((scene, sceneIndex) => {
    claimId(scene.id, `Scene ${sceneIndex + 1}`);
    if (!scene.name?.trim()) issues.push({ level: 'error', text: `Scene ${sceneIndex + 1} has no name.` });
    if (!scene.cues.length) issues.push({ level: 'warn', text: `${scene.name} contains no cues.` });
    scene.cues.forEach((cue, cueIndex) => {
      claimId(cue.id, `${scene.name} cue ${cueIndex + 1}`);
      if (!cue.name?.trim()) issues.push({ level: 'error', text: `${scene.name} contains an unnamed cue.` });
      if (!cue.actions.length) issues.push({ level: 'warn', text: `${scene.name} → ${cue.name} has no actions.` });
      cue.actions.forEach((action, actionIndex) => {
        claimId(action.id, `${cue.name} action ${actionIndex + 1}`);
        if (!SUPPORTED_ACTIONS.has(action.type)) issues.push({ level: 'error', text: `${cue.name} → ${action.label || action.type} uses unsupported action type ${action.type}.` });
        if (!action.target?.trim()) issues.push({ level: 'error', text: `${cue.name} → ${action.label} has no target.` });
        if (!action.label?.trim()) issues.push({ level: 'warn', text: `${cue.name} contains an unnamed ${action.type} action.` });
        if (Number(action.delayMs) < 0 || Number(action.durationMs) < 0) issues.push({ level: 'error', text: `${cue.name} → ${action.label} has invalid negative timing.` });
        if (!Number.isFinite(Number(action.delayMs)) || !Number.isFinite(Number(action.durationMs))) issues.push({ level: 'error', text: `${cue.name} → ${action.label} has non-numeric timing.` });
      });
    });
  });

  if (!issues.length) issues.push({ level: 'ok', text: 'Production passes Studio 2.0 hardware-export preflight.' });
  return issues;
}

export function hasBlockingIssues(production) {
  return runPreflight(production).some(issue => issue.level === 'error');
}
