import { deviceSupportsAction } from './model.js';

const SUPPORTED_ACTIONS = new Set([
  'audio', 'lighting', 'pixel', 'mosfet', 'video', 'delay', 'automation', 'trigger', 'safety',
  // Migration-only formats remain readable, but are not current authoring targets.
  'relay', 'dmx'
]);

const ACTIONS_WITHOUT_DEVICE = new Set(['delay', 'automation', 'safety']);

export function runPreflight(production) {
  const issues = [];
  const ids = new Set();
  const claimId = (id, label) => {
    if (!id) return issues.push({ level: 'error', text: `${label} has no stable ID.` });
    if (ids.has(id)) issues.push({ level: 'error', text: `Duplicate ID ${id} found at ${label}.` });
    ids.add(id);
  };

  if (!production?.name?.trim()) issues.push({ level: 'error', text: 'Production has no name.' });
  if (!Array.isArray(production?.scenes) || !production.scenes.length) {
    issues.push({ level: 'error', text: 'Production contains no scenes.' });
  }
  claimId(production?.id, 'Production');

  const devices = Array.isArray(production?.devices) ? production.devices : [];
  const deviceById = new Map();
  devices.forEach((device, index) => {
    claimId(device?.id, `Device ${index + 1}`);
    if (!device?.name?.trim()) issues.push({ level: 'error', text: `Device ${index + 1} has no name.` });
    if (!device?.type?.trim()) issues.push({ level: 'error', text: `${device?.name || `Device ${index + 1}`} has no type.` });
    if (device?.id) deviceById.set(device.id, device);

    const route = device?.binding?.route || 'unbound';
    if (device?.required !== false && route === 'unbound') {
      issues.push({ level: 'warn', text: `${device.name} is required but has no physical/runtime binding yet.` });
    }
    if (route === 'p4-show-pixels') {
      const count = Number(device?.binding?.pixelCount || 0);
      if (!Number.isFinite(count) || count <= 0) {
        issues.push({ level: 'warn', text: `${device.name} is bound to P4 Show Pixels but has no declared pixel count.` });
      }
    }
  });

  (production?.scenes || []).forEach((scene, sceneIndex) => {
    claimId(scene.id, `Scene ${sceneIndex + 1}`);
    if (!scene.name?.trim()) issues.push({ level: 'error', text: `Scene ${sceneIndex + 1} has no name.` });
    if (!scene.cues.length) issues.push({ level: 'warn', text: `${scene.name} contains no cues.` });

    scene.cues.forEach((cue, cueIndex) => {
      claimId(cue.id, `${scene.name} cue ${cueIndex + 1}`);
      if (!cue.name?.trim()) issues.push({ level: 'error', text: `${scene.name} contains an unnamed cue.` });
      if (!cue.actions.length) issues.push({ level: 'warn', text: `${scene.name} → ${cue.name} has no actions.` });

      cue.actions.forEach((action, actionIndex) => {
        const label = action.label || action.type || `action ${actionIndex + 1}`;
        claimId(action.id, `${cue.name} action ${actionIndex + 1}`);
        if (!SUPPORTED_ACTIONS.has(action.type)) {
          issues.push({ level: 'error', text: `${cue.name} → ${label} uses unsupported action type ${action.type}.` });
        }
        if (action.type === 'dmx') {
          issues.push({ level: 'error', text: `${cue.name} → ${label} uses DMX, which is deliberately parked/out of scope.` });
        }
        if (action.type === 'relay') {
          issues.push({ level: 'warn', text: `${cue.name} → ${label} uses legacy Relay addressing; migrate it to a MOSFET device/action.` });
        }
        if (!action.label?.trim()) issues.push({ level: 'warn', text: `${cue.name} contains an unnamed ${action.type} action.` });
        if (Number(action.delayMs) < 0 || Number(action.durationMs) < 0) {
          issues.push({ level: 'error', text: `${cue.name} → ${label} has invalid negative timing.` });
        }
        if (!Number.isFinite(Number(action.delayMs)) || !Number.isFinite(Number(action.durationMs))) {
          issues.push({ level: 'error', text: `${cue.name} → ${label} has non-numeric timing.` });
        }

        if (!ACTIONS_WITHOUT_DEVICE.has(action.type)) {
          if (!action.targetDeviceId) {
            issues.push({ level: 'error', text: `${cue.name} → ${label} has no logical device target.` });
          } else {
            const device = deviceById.get(action.targetDeviceId);
            if (!device) {
              issues.push({ level: 'error', text: `${cue.name} → ${label} targets missing device ${action.targetDeviceId}.` });
            } else {
              if (device.enabled === false) {
                issues.push({ level: 'error', text: `${cue.name} → ${label} targets disabled device ${device.name}.` });
              }
              if (!deviceSupportsAction(device, action.type) && action.type !== 'relay') {
                issues.push({ level: 'error', text: `${cue.name} → ${label} (${action.type}) is incompatible with ${device.name} (${device.type}).` });
              }
            }
          }
        }
      });
    });
  });

  if (!issues.length) issues.push({ level: 'ok', text: 'Production passes Studio 2.0 authoring preflight.' });
  return issues;
}

export function hasBlockingIssues(production) {
  return runPreflight(production).some(issue => issue.level === 'error');
}
