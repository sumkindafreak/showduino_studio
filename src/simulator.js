export function simulateCue(cue) {
  if (!cue) return [];
  let cursor = 0;
  return cue.actions.map((action, index) => {
    cursor += Number(action.delayMs || 0);
    const event = {
      index: index + 1,
      atMs: cursor,
      type: action.type,
      label: action.label,
      target: action.target,
      value: action.value || '',
      durationMs: Number(action.durationMs || 0)
    };
    return event;
  });
}

export function simulateScene(scene) {
  if (!scene) return [];
  const events = [];
  scene.cues.forEach((cue, cueIndex) => {
    events.push({ kind: 'cue', cueIndex: cueIndex + 1, cueName: cue.name, trigger: cue.trigger });
    simulateCue(cue).forEach(event => events.push({ kind: 'action', cueName: cue.name, ...event }));
  });
  return events;
}
