export function runPreflight(production) {
  const issues = [];
  if (!production.name?.trim()) issues.push({ level: 'error', text: 'Production has no name.' });
  if (!production.scenes.length) issues.push({ level: 'error', text: 'Production contains no scenes.' });

  production.scenes.forEach((scene, sceneIndex) => {
    if (!scene.name?.trim()) issues.push({ level: 'error', text: `Scene ${sceneIndex + 1} has no name.` });
    if (!scene.cues.length) issues.push({ level: 'warn', text: `${scene.name} contains no cues.` });
    scene.cues.forEach(cue => {
      if (!cue.actions.length) issues.push({ level: 'warn', text: `${scene.name} → ${cue.name} has no actions.` });
      cue.actions.forEach(action => {
        if (!action.target?.trim()) issues.push({ level: 'error', text: `${cue.name} → ${action.label} has no target.` });
        if (!action.label?.trim()) issues.push({ level: 'warn', text: `${cue.name} contains an unnamed ${action.type} action.` });
      });
    });
  });

  if (!issues.length) issues.push({ level: 'ok', text: 'Production structure is valid for Studio 2.0 simulation.' });
  return issues;
}
