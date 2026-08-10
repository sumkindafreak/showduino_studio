export const ACTION_TYPES = [
  { type: 'audio', label: 'Audio', icon: '♪' },
  { type: 'lighting', label: 'Lighting', icon: '✦' },
  { type: 'pixel', label: 'Pixels', icon: '▦' },
  { type: 'dmx', label: 'DMX', icon: 'D' },
  { type: 'relay', label: 'Relay', icon: '⏻' },
  { type: 'video', label: 'Video', icon: '▶' },
  { type: 'delay', label: 'Delay', icon: '⏱' },
  { type: 'automation', label: 'Automation', icon: '⌁' },
  { type: 'trigger', label: 'Trigger', icon: '◆' },
  { type: 'safety', label: 'Safety', icon: '!' }
];

export const TARGETS = [
  'Stage Controller', 'SUE', 'Director', 'Main Audio', 'Stage Left', 'Stage Right',
  'Chamber Lighting', 'Corridor Pixels', 'DMX Universe 1', 'Relay Bank A', 'Projection'
];

let sequence = 1;
export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${(sequence++).toString(36)}`;
}

export function createProduction(name = 'Untitled Production') {
  return { version: '2.0', id: uid('production'), name, description: '', scenes: [], assets: [], devices: [], updatedAt: new Date().toISOString() };
}

export function createScene(name = 'New Scene') {
  return { id: uid('scene'), name, description: '', order: 0, cues: [] };
}

export function createCue(name = 'New Cue') {
  return { id: uid('cue'), name, trigger: 'Operator GO', notes: '', actions: [] };
}

export function defaultParams(type) {
  switch (type) {
    case 'pixel': return { line: 1, startPixel: 0, endPixel: 7, effect: 'Lightning', colour: '#d9efff', brightness: 100, speed: 50 };
    case 'relay': return { bank: 'A', channel: 1, state: 'ON', pulseMs: 0 };
    case 'audio': return { asset: '', volume: 100, loop: false, fadeMs: 0 };
    case 'lighting': return { look: '', brightness: 100, fadeMs: 0 };
    case 'dmx': return { universe: 1, channel: 1, value: 0, fadeMs: 0 };
    default: return {};
  }
}

export function createAction(type = 'audio') {
  const def = ACTION_TYPES.find(item => item.type === type) || ACTION_TYPES[0];
  return { id: uid('action'), type: def.type, label: def.label, target: TARGETS[0], delayMs: 0, durationMs: 0, value: '', notes: '', params: defaultParams(def.type) };
}

export function createChamberDemo() {
  const production = createProduction('The Chamber');
  production.description = 'Reference immersive production for Showduino Studio 2.0.';

  const preShow = createScene('Pre-show');
  preShow.description = 'Audience arrival, atmosphere and system standby.';
  const preCue = createCue('House Atmosphere');
  preCue.trigger = 'Scene Start';
  preCue.actions.push(
    { ...createAction('audio'), label: 'Chamber ambience', target: 'Main Audio', value: 'chamber_ambience.wav', params: { asset: 'chamber_ambience.wav', volume: 70, loop: true, fadeMs: 1500 } },
    { ...createAction('lighting'), label: 'Low candle look', target: 'Chamber Lighting', value: 'Warm 18%', durationMs: 2500, params: { look: 'Warm Candle', brightness: 18, fadeMs: 2500 } }
  );
  preShow.cues.push(preCue);

  const awakening = createScene('Entity Awakens');
  awakening.description = 'The chamber changes state and the entity reveals itself.';
  const cue = createCue('Entity Appears');
  cue.trigger = 'Operator GO';
  cue.actions.push(
    { ...createAction('audio'), label: 'Entity scream', target: 'Stage Left', value: 'entity_scream.wav', params: { asset: 'entity_scream.wav', volume: 100, loop: false, fadeMs: 0 } },
    { ...createAction('lighting'), label: 'Chamber snap red', target: 'Chamber Lighting', value: 'Red 100%', durationMs: 300, params: { look: 'Snap Red', brightness: 100, fadeMs: 300 } },
    { ...createAction('pixel'), label: 'Lightning segment', target: 'Corridor Pixels', value: 'Pixels 0–7 · Lightning', params: { line: 1, startPixel: 0, endPixel: 7, effect: 'Lightning', colour: '#d9efff', brightness: 100, speed: 85 } },
    { ...createAction('pixel'), label: 'Blue hold segment', target: 'Corridor Pixels', value: 'Pixels 8–10 · Solid Blue', params: { line: 1, startPixel: 8, endPixel: 10, effect: 'Solid', colour: '#145cff', brightness: 80, speed: 0 } },
    { ...createAction('pixel'), label: 'Warm glow segment', target: 'Corridor Pixels', value: 'Pixels 11–60 · Warm Glow', params: { line: 1, startPixel: 11, endPixel: 60, effect: 'Glow', colour: '#ffb45b', brightness: 55, speed: 20 } },
    { ...createAction('relay'), label: 'Prop strike', target: 'Relay Bank A', value: 'Relay 03 PULSE', durationMs: 2500, params: { bank: 'A', channel: 3, state: 'PULSE', pulseMs: 2500 } },
    { ...createAction('delay'), label: 'Impact delay', target: 'Stage Controller', delayMs: 750, value: '750 ms' },
    { ...createAction('audio'), label: 'Impact hit', target: 'Main Audio', value: 'impact.wav', params: { asset: 'impact.wav', volume: 100, loop: false, fadeMs: 0 } }
  );
  awakening.cues.push(cue);

  const escape = createScene('Escape');
  escape.description = 'Final release sequence and reset path.';
  const escapeCue = createCue('Release Doors');
  escapeCue.trigger = 'Door Sensor Armed + Operator GO';
  escapeCue.actions.push(
    { ...createAction('relay'), label: 'Release magnetic lock', target: 'Relay Bank A', value: 'Relay 01 OFF', params: { bank: 'A', channel: 1, state: 'OFF', pulseMs: 0 } },
    { ...createAction('lighting'), label: 'Escape route', target: 'Chamber Lighting', value: 'Emergency White 70%', durationMs: 800, params: { look: 'Emergency White', brightness: 70, fadeMs: 800 } },
    { ...createAction('pixel'), label: 'Route guide', target: 'Corridor Pixels', value: 'Forward Sweep Green', params: { line: 1, startPixel: 0, endPixel: 60, effect: 'Forward Sweep', colour: '#39ff88', brightness: 75, speed: 65 } }
  );
  escape.cues.push(escapeCue);

  production.scenes = [preShow, awakening, escape];
  production.scenes.forEach((scene, index) => { scene.order = index; });
  return production;
}

export function normaliseProduction(production) {
  const safe = production && typeof production === 'object' ? production : createProduction();
  safe.version = safe.version || '2.0';
  safe.scenes = Array.isArray(safe.scenes) ? safe.scenes : [];
  safe.assets = Array.isArray(safe.assets) ? safe.assets : [];
  safe.devices = Array.isArray(safe.devices) ? safe.devices : [];
  safe.scenes.forEach((scene, sceneIndex) => {
    scene.id ||= uid('scene'); scene.name ||= `Scene ${sceneIndex + 1}`; scene.description ||= ''; scene.order = sceneIndex;
    scene.cues = Array.isArray(scene.cues) ? scene.cues : [];
    scene.cues.forEach((cue, cueIndex) => {
      cue.id ||= uid('cue'); cue.name ||= `Cue ${cueIndex + 1}`; cue.trigger ||= 'Operator GO'; cue.notes ||= '';
      cue.actions = Array.isArray(cue.actions) ? cue.actions : [];
      cue.actions.forEach(action => {
        action.id ||= uid('action'); action.type ||= 'audio'; action.label ||= action.type; action.target ||= TARGETS[0]; action.delayMs ||= 0; action.durationMs ||= 0; action.value ||= ''; action.notes ||= '';
        action.params = action.params && typeof action.params === 'object' ? action.params : defaultParams(action.type);
      });
    });
  });
  return safe;
}
