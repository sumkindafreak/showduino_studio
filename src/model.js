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

export function createAction(type = 'audio') {
  const def = ACTION_TYPES.find(item => item.type === type) || ACTION_TYPES[0];
  return { id: uid('action'), type: def.type, label: def.label, target: TARGETS[0], delayMs: 0, durationMs: 0, value: '', notes: '' };
}

function demoPixelLayer(name, effect, colour, overrides = {}) {
  return {
    id: uid('pixel-layer'), name, effect, colour, colour2: overrides.colour2 || colour,
    brightness: overrides.brightness ?? 100, opacity: overrides.opacity ?? 100,
    speed: overrides.speed ?? 50, density: overrides.density ?? 35,
    direction: overrides.direction || 'forward', blend: overrides.blend || 'replace'
  };
}

export function createChamberDemo() {
  const production = createProduction('The Chamber');
  production.description = 'Reference immersive production for Showduino Studio 2.0.';

  const preShow = createScene('Pre-show');
  preShow.description = 'Audience arrival, atmosphere and system standby.';
  const preCue = createCue('House Atmosphere');
  preCue.trigger = 'Scene Start';
  preCue.actions.push(
    { ...createAction('audio'), label: 'Chamber ambience', target: 'Main Audio', value: 'chamber_ambience.wav', durationMs: 0 },
    { ...createAction('lighting'), label: 'Low candle look', target: 'Chamber Lighting', value: 'Warm 18%', durationMs: 2500 }
  );
  preShow.cues.push(preCue);

  const awakening = createScene('Entity Awakens');
  awakening.description = 'The chamber changes state and the entity reveals itself.';
  const cue = createCue('Entity Appears');
  cue.trigger = 'Operator GO';

  const segmentedPixels = createAction('pixel');
  segmentedPixels.label = 'Segmented corridor electricity';
  segmentedPixels.target = 'Corridor Pixels';
  segmentedPixels.value = 'Corridor Pixel Line · 120 px · 3 segments · 4 layers';
  segmentedPixels.pixel = {
    lineId: 'pixel-line-1',
    lineName: 'Corridor Pixel Line',
    pixelCount: 120,
    masterBrightness: 100,
    segments: [
      {
        id: uid('pixel-segment'), name: 'Electric Contacts', start: 0, end: 7, enabled: true,
        layers: [demoPixelLayer('Electrical arc', 'lightning', '#e8fbff', { colour2: '#72bfff', speed: 82, density: 48 })]
      },
      {
        id: uid('pixel-segment'), name: 'Blue Marker', start: 8, end: 10, enabled: true,
        layers: [demoPixelLayer('Plain blue', 'solid', '#1769ff', { brightness: 75 })]
      },
      {
        id: uid('pixel-segment'), name: 'Warm Chamber Glow', start: 11, end: 119, enabled: true,
        layers: [
          demoPixelLayer('Warm white base', 'solid', '#ffd39a', { brightness: 42 }),
          demoPixelLayer('Subtle flame movement', 'flicker', '#fff0cf', { colour2: '#ffb15c', brightness: 28, opacity: 38, speed: 24, density: 18, blend: 'add' })
        ]
      }
    ]
  };

  cue.actions.push(
    { ...createAction('audio'), label: 'Entity scream', target: 'Stage Left', value: 'entity_scream.wav' },
    { ...createAction('lighting'), label: 'Chamber snap red', target: 'Chamber Lighting', value: 'Red 100%', durationMs: 300 },
    segmentedPixels,
    { ...createAction('relay'), label: 'Prop strike', target: 'Relay Bank A', value: 'Relay 03 ON', durationMs: 2500 },
    { ...createAction('delay'), label: 'Impact delay', target: 'Stage Controller', delayMs: 750, value: '750 ms' },
    { ...createAction('audio'), label: 'Impact hit', target: 'Main Audio', value: 'impact.wav' }
  );
  awakening.cues.push(cue);

  const escape = createScene('Escape');
  escape.description = 'Final release sequence and reset path.';
  const escapeCue = createCue('Release Doors');
  escapeCue.trigger = 'Door Sensor Armed + Operator GO';
  escapeCue.actions.push(
    { ...createAction('relay'), label: 'Release magnetic lock', target: 'Relay Bank A', value: 'Relay 01 OFF' },
    { ...createAction('lighting'), label: 'Escape route', target: 'Chamber Lighting', value: 'Emergency White 70%', durationMs: 800 },
    { ...createAction('pixel'), label: 'Route guide', target: 'Corridor Pixels', value: 'Forward Sweep Green' }
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
      cue.actions.forEach(action => { action.id ||= uid('action'); action.type ||= 'audio'; action.label ||= action.type; action.target ||= TARGETS[0]; action.delayMs ||= 0; action.durationMs ||= 0; action.value ||= ''; action.notes ||= ''; });
    });
  });
  return safe;
}