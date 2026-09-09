const TIMELINE_COMMAND_MAX = 63;
const P4_PIXEL_SEGMENT_SLOTS = 16;

function clamp(value, min, max) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
}

function cleanCommandToken(value = '') {
  return String(value).trim().replace(/[\r\n]/g, ' ');
}

function normalizeEffect(value = 'SOLID') {
  return cleanCommandToken(value).toUpperCase().replace(/[\s-]+/g, '_');
}

function hexToRgb(value = '#ffffff') {
  const raw = String(value).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return raw.split('').map(ch => parseInt(ch + ch, 16));
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) {
    return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
  }
  return [255, 255, 255];
}

function isSceneStartTrigger(trigger) {
  const value = String(trigger || '').trim().toLowerCase();
  return value === 'scene start' || value === 'timeline' || value === 'automatic' || value === 'auto';
}

function findDevice(production, action) {
  if (!action?.targetDeviceId) return null;
  return (production.devices || []).find(device => device.id === action.targetDeviceId) || null;
}

function actionStartMs(action, accumulatedDelay) {
  const explicit = Number(action.timelineStartMs);
  if (Number.isFinite(explicit)) return Math.round(Math.max(0, explicit));
  return Math.round(Math.max(0, Number(action.delayMs || 0)) + accumulatedDelay);
}

function actionDurationMs(action) {
  const timeline = Number(action.timelineDurationMs);
  if (Number.isFinite(timeline)) return Math.max(0, Math.round(timeline));
  return Math.max(0, Math.round(Number(action.durationMs || 0)));
}

function delayDurationMs(action) {
  const params = Number(action?.params?.milliseconds);
  if (Number.isFinite(params) && params >= 0) return Math.round(params);
  const delay = Number(action?.delayMs);
  if (Number.isFinite(delay) && delay >= 0) return Math.round(delay);
  const parsed = parseInt(String(action?.value || ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function addCompiledCommand(output, errors, timeMs, command, source) {
  const clean = cleanCommandToken(command);
  if (!clean) {
    errors.push(`${source}: compiler produced an empty command.`);
    return;
  }
  if (clean.length > TIMELINE_COMMAND_MAX) {
    errors.push(`${source}: command is ${clean.length} characters; P4 timeline limit is ${TIMELINE_COMMAND_MAX}.`);
    return;
  }
  output.push({ timeMs: Math.max(0, Math.round(timeMs)), command: clean, source, sequence: output.length });
}

function compileAudio(action, device, timeMs, durationMs, output, errors) {
  if (device.binding?.route !== 'audio-node') {
    errors.push(`${action.label}: ${device.name} is not bound to the Specialist Audio Node.`);
    return;
  }
  const path = cleanCommandToken(action.params?.asset || action.value || '');
  if (!path) {
    errors.push(`${action.label}: no audio asset/path is selected.`);
    return;
  }
  const volume = Math.round(clamp(action.params?.volume ?? 100, 0, 100));
  addCompiledCommand(output, errors, timeMs, `AUDIO:NODE:VOLUME:${volume}`, action.label);
  addCompiledCommand(output, errors, timeMs, `AUDIO:NODE:${action.params?.loop ? 'LOOP' : 'PLAY'}:${path}`, action.label);
  if (durationMs > 0) {
    addCompiledCommand(output, errors, timeMs + durationMs, 'AUDIO:NODE:STOP', `${action.label} stop`);
  }
}

function compilePixel(action, device, timeMs, durationMs, segmentSlot, output, errors) {
  if (device.binding?.route !== 'p4-show-pixels') {
    errors.push(`${action.label}: ${device.name} is not bound to P4 GPIO23 Show Pixels.`);
    return;
  }
  if (segmentSlot >= P4_PIXEL_SEGMENT_SLOTS) {
    errors.push(`${action.label}: scene needs more than ${P4_PIXEL_SEGMENT_SLOTS} P4 pixel segment slots.`);
    return;
  }

  const start = Math.max(0, Math.round(Number(action.params?.startPixel || 0)));
  const end = Math.max(start, Math.round(Number(action.params?.endPixel ?? start)));
  const count = end - start + 1;
  const deviceStart = Math.max(0, Math.round(Number(device.binding?.pixelStart || 0)));
  const deviceCount = Math.max(0, Math.round(Number(device.binding?.pixelCount || 0)));
  if (deviceCount > 0 && end >= deviceCount) {
    errors.push(`${action.label}: pixel ${end} exceeds ${device.name}'s declared ${deviceCount}-pixel region.`);
    return;
  }

  const physicalStart = deviceStart + start;
  const effect = normalizeEffect(action.params?.effect || 'SOLID');
  const [r, g, b] = hexToRgb(action.params?.colour || '#ffffff');
  const [r2, g2, b2] = hexToRgb(action.params?.colour2 || '#ffffff');
  const brightness = Math.round(clamp(action.params?.brightness ?? 100, 0, 100) * 2.55);
  const speed = Math.round(clamp(action.params?.speed ?? 50, 1, 100));
  const intensity = Math.round(clamp(action.params?.intensity ?? 100, 0, 100));
  const randomness = Math.round(clamp(action.params?.randomness ?? 0, 0, 100));
  const reverse = action.params?.reverse ? 1 : 0;

  const prefix = `PIXEL:SEGMENT:${segmentSlot}`;
  addCompiledCommand(output, errors, timeMs, `${prefix}:RANGE:${physicalStart}:${count}`, action.label);
  addCompiledCommand(output, errors, timeMs, `${prefix}:FX:${effect}`, action.label);
  addCompiledCommand(output, errors, timeMs, `${prefix}:COLOR:${r}:${g}:${b}`, action.label);
  addCompiledCommand(output, errors, timeMs, `${prefix}:COLOR2:${r2}:${g2}:${b2}`, action.label);
  addCompiledCommand(output, errors, timeMs, `${prefix}:BRIGHTNESS:${brightness}`, action.label);
  addCompiledCommand(output, errors, timeMs, `${prefix}:SPEED:${speed}`, action.label);
  addCompiledCommand(output, errors, timeMs, `${prefix}:INTENSITY:${intensity}`, action.label);
  addCompiledCommand(output, errors, timeMs, `${prefix}:RANDOMNESS:${randomness}`, action.label);
  addCompiledCommand(output, errors, timeMs, `${prefix}:REVERSE:${reverse}`, action.label);
  if (durationMs > 0) addCompiledCommand(output, errors, timeMs, `${prefix}:DURATION:${durationMs}`, action.label);
  addCompiledCommand(output, errors, timeMs, `${prefix}:START`, action.label);
  if (durationMs > 0) {
    addCompiledCommand(output, errors, timeMs + durationMs, `${prefix}:STOP`, `${action.label} stop`);
  }
}

export function compileSceneForStage(production, sceneId) {
  const scene = (production?.scenes || []).find(item => item.id === sceneId);
  const errors = [];
  const warnings = [];
  const commands = [];
  let pixelSlot = 0;

  if (!scene) {
    return { ok: false, errors: ['No active scene selected.'], warnings, commands, uploadCommands: [] };
  }

  for (const cue of scene.cues || []) {
    if (!isSceneStartTrigger(cue.trigger)) {
      errors.push(`${scene.name} → ${cue.name}: trigger "${cue.trigger}" needs Stage trigger/cue runtime support; current RAM deploy only schedules Scene Start/Timeline cues.`);
      continue;
    }

    let accumulatedDelay = 0;
    for (const action of cue.actions || []) {
      if (action.type === 'delay') {
        accumulatedDelay += delayDurationMs(action);
        continue;
      }
      if (action.type === 'safety') {
        errors.push(`${cue.name} → ${action.label}: production-authored safety commands are never compiled; safety remains firmware-authoritative.`);
        continue;
      }
      if (action.type === 'dmx') {
        errors.push(`${cue.name} → ${action.label}: DMX is parked/out of scope.`);
        continue;
      }
      if (action.type === 'relay') {
        errors.push(`${cue.name} → ${action.label}: legacy Relay actions must be migrated to MOSFET before deployment.`);
        continue;
      }

      const device = findDevice(production, action);
      if (!device) {
        errors.push(`${cue.name} → ${action.label}: no valid logical device binding.`);
        continue;
      }
      if (device.enabled === false) {
        errors.push(`${cue.name} → ${action.label}: target device ${device.name} is disabled.`);
        continue;
      }
      if (!device.binding || device.binding.route === 'unbound') {
        errors.push(`${cue.name} → ${action.label}: ${device.name} is not bound to runtime hardware.`);
        continue;
      }

      const timeMs = actionStartMs(action, accumulatedDelay);
      const durationMs = actionDurationMs(action);
      if (action.type === 'audio') {
        compileAudio(action, device, timeMs, durationMs, commands, errors);
      } else if (action.type === 'pixel') {
        compilePixel(action, device, timeMs, durationMs, pixelSlot++, commands, errors);
      } else if (action.type === 'mosfet') {
        errors.push(`${cue.name} → ${action.label}: MOSFET binding is modelled, but the MOSFET Node command/runtime is not implemented yet.`);
      } else if (action.type === 'lighting') {
        errors.push(`${cue.name} → ${action.label}: Lantern/lighting runtime command support is not implemented yet.`);
      } else if (action.type === 'video') {
        errors.push(`${cue.name} → ${action.label}: projection/video runtime support is not implemented yet.`);
      } else if (action.type === 'trigger') {
        errors.push(`${cue.name} → ${action.label}: trigger actions require the future Stage trigger graph/runtime.`);
      } else if (action.type === 'automation') {
        warnings.push(`${cue.name} → ${action.label}: automation has no Stage compiler yet and was skipped.`);
      } else {
        errors.push(`${cue.name} → ${action.label}: action type ${action.type} has no Stage compiler.`);
      }
    }
  }

  commands.sort((a, b) => a.timeMs - b.timeMs || a.sequence - b.sequence);
  const uploadCommands = ['SHOW:TL:BEGIN'];
  commands.forEach(item => uploadCommands.push(`SHOW:TL:C:${item.timeMs}:${item.command}`));
  uploadCommands.push('SHOW:TL:END');

  if (!commands.length && !errors.length) errors.push(`${scene.name} contains no deployable Stage commands.`);

  return {
    ok: errors.length === 0 && commands.length > 0,
    target: 'esp32-p4-show-engine',
    transport: 'show-timeline-ram-v1',
    productionId: production.id,
    productionName: production.name,
    sceneId: scene.id,
    sceneName: scene.name,
    errors,
    warnings,
    commands,
    uploadCommands
  };
}

export function deploymentPlanText(result) {
  return JSON.stringify({
    schema: 'showduino-stage-deployment-plan-v1',
    generatedAt: new Date().toISOString(),
    target: result.target,
    transport: result.transport,
    productionId: result.productionId,
    productionName: result.productionName,
    sceneId: result.sceneId,
    sceneName: result.sceneName,
    warnings: result.warnings,
    commands: result.commands,
    uploadCommands: result.uploadCommands
  }, null, 2);
}

export function downloadDeploymentPlan(result) {
  if (!result?.ok) throw new Error('Cannot export a deployment plan with blocking compiler errors.');
  const text = deploymentPlanText(result);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const slug = String(result.sceneName || 'scene').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scene';
  link.download = `${slug}.showduino-stage.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
