export const ACTION_TYPES = [
  { type: 'audio', label: 'Audio', icon: '♪' },
  { type: 'lighting', label: 'Lighting', icon: '✦' },
  { type: 'pixel', label: 'Pixels', icon: '▦' },
  { type: 'mosfet', label: 'MOSFET', icon: '⏻' },
  { type: 'video', label: 'Video', icon: '▶' },
  { type: 'delay', label: 'Delay', icon: '⏱' },
  { type: 'automation', label: 'Automation', icon: '⌁' },
  { type: 'trigger', label: 'Trigger', icon: '◆' },
  { type: 'safety', label: 'Safety', icon: '!' },
  // Import/migration only. New productions should use MOSFET actions instead.
  { type: 'relay', label: 'Legacy Relay', icon: '⏻', legacy: true },
  // Import/migration only. DMX remains deliberately parked for Showduino.
  { type: 'dmx', label: 'Legacy DMX', icon: 'D', legacy: true }
];

export const DEVICE_TYPES = [
  { type: 'audio-node', label: 'Audio Node', actionTypes: ['audio'] },
  { type: 'p4-pixel-line', label: 'P4 Show Pixel Line', actionTypes: ['pixel'] },
  { type: 'lantern-node', label: 'C3 Lantern Node', actionTypes: ['lighting', 'pixel'] },
  { type: 'pixel-node', label: 'C3 Pixel Node', actionTypes: ['pixel'] },
  { type: 'mosfet-node', label: 'MOSFET Node', actionTypes: ['mosfet'] },
  { type: 'input-node', label: 'Input / Sensor Node', actionTypes: ['trigger'] },
  { type: 'projection', label: 'Projection / Video', actionTypes: ['video'] },
  { type: 'custom', label: 'Custom / Future Device', actionTypes: [] }
];

export const BINDING_ROUTES = [
  { route: 'unbound', label: 'Unbound / design only' },
  { route: 'audio-node', label: 'Specialist Audio Node' },
  { route: 'p4-show-pixels', label: 'P4 GPIO23 Show Pixels' },
  { route: 'lantern-node', label: 'C3 Lantern Node (planned)' },
  { route: 'pixel-node', label: 'C3 Pixel Node (planned)' },
  { route: 'mosfet-node', label: 'MOSFET Node (planned)' },
  { route: 'projection', label: 'Projection / Video (planned)' },
  { route: 'input-node', label: 'Input / Sensor Node (planned)' }
];

let sequence = 1;
export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${(sequence++).toString(36)}`;
}

export function createBinding(route = 'unbound') {
  return {
    route,
    nodeId: '',
    channel: 0,
    output: 0,
    pixelStart: 0,
    pixelCount: 0
  };
}

export function createDevice(name = 'New Device', type = 'custom') {
  return {
    id: uid('device'),
    name,
    type,
    enabled: true,
    required: true,
    binding: createBinding(),
    capabilities: {},
    metadata: {}
  };
}

export function deviceTypeDefinition(type) {
  return DEVICE_TYPES.find(item => item.type === type) || DEVICE_TYPES[DEVICE_TYPES.length - 1];
}

export function bindingRouteDefinition(route) {
  return BINDING_ROUTES.find(item => item.route === route) || BINDING_ROUTES[0];
}

export function deviceSupportsAction(device, actionType) {
  if (!device) return false;
  if (actionType === 'delay' || actionType === 'automation' || actionType === 'safety') return true;
  const definition = deviceTypeDefinition(device.type);
  return definition.actionTypes.includes(actionType);
}

export function createProduction(name = 'Untitled Production') {
  const now = new Date().toISOString();
  return {
    version: '2.0',
    id: uid('production'),
    name,
    description: '',
    scenes: [],
    assets: [],
    devices: [],
    createdAt: now,
    updatedAt: now
  };
}

export function createScene(name = 'New Scene') {
  return { id: uid('scene'), name, description: '', order: 0, cues: [] };
}

export function createCue(name = 'New Cue') {
  return { id: uid('cue'), name, trigger: 'Operator GO', notes: '', actions: [] };
}

export function defaultParams(type) {
  switch (type) {
    case 'pixel':
      return {
        line: 1,
        startPixel: 0,
        endPixel: 7,
        effect: 'LIGHTNING',
        colour: '#d9efff',
        colour2: '#ffffff',
        brightness: 100,
        speed: 50,
        intensity: 100,
        randomness: 0,
        reverse: false
      };
    case 'mosfet':
      return { channel: 1, state: 'ON', level: 255, pulseMs: 0, fadeMs: 0 };
    case 'relay':
      return { bank: 'A', channel: 1, state: 'ON', pulseMs: 0 };
    case 'audio':
      return { asset: '', volume: 100, loop: false, fadeMs: 0 };
    case 'lighting':
      return { look: '', brightness: 100, fadeMs: 0 };
    case 'dmx':
      return { universe: 1, channel: 1, value: 0, fadeMs: 0 };
    case 'delay':
      return { milliseconds: 500 };
    default:
      return {};
  }
}

export function createAction(type = 'audio') {
  const def = ACTION_TYPES.find(item => item.type === type && !item.legacy) || ACTION_TYPES[0];
  return {
    id: uid('action'),
    type: def.type,
    label: def.label,
    target: '',
    targetDeviceId: '',
    delayMs: 0,
    durationMs: 0,
    value: '',
    notes: '',
    params: defaultParams(def.type)
  };
}

function assignTarget(action, device) {
  action.targetDeviceId = device?.id || '';
  action.target = device?.name || '';
  return action;
}

export function createChamberDemo() {
  const production = createProduction('The Chamber');
  production.description = 'Reference immersive production for Showduino Studio 2.0.';

  const mainAudio = createDevice('Main Audio', 'audio-node');
  mainAudio.id = 'audio-main';
  mainAudio.binding = { ...createBinding('audio-node'), nodeId: 'audio-1' };

  const stageLeftAudio = createDevice('Stage Left Audio', 'audio-node');
  stageLeftAudio.id = 'audio-stage-left';
  stageLeftAudio.binding = { ...createBinding('audio-node'), nodeId: 'audio-1' };

  const chamberLighting = createDevice('Chamber Lighting', 'lantern-node');
  chamberLighting.id = 'lighting-chamber';
  chamberLighting.binding = { ...createBinding('unbound'), nodeId: 'lantern-1' };

  const corridorPixels = createDevice('Corridor Pixels', 'p4-pixel-line');
  corridorPixels.id = 'pixels-corridor';
  corridorPixels.binding = {
    ...createBinding('p4-show-pixels'),
    nodeId: 'p4-local',
    pixelStart: 0,
    pixelCount: 100
  };

  const propPower = createDevice('Prop Power', 'mosfet-node');
  propPower.id = 'mosfet-props';
  propPower.binding = { ...createBinding('unbound'), nodeId: 'mosfet-1' };

  production.devices = [mainAudio, stageLeftAudio, chamberLighting, corridorPixels, propPower];

  const preShow = createScene('Pre-show');
  preShow.description = 'Audience arrival, atmosphere and system standby.';
  const preCue = createCue('House Atmosphere');
  preCue.trigger = 'Scene Start';
  preCue.actions.push(
    assignTarget({ ...createAction('audio'), label: 'Chamber ambience', value: 'chamber_ambience.wav', params: { asset: 'chamber_ambience.wav', volume: 70, loop: true, fadeMs: 1500 } }, mainAudio),
    assignTarget({ ...createAction('lighting'), label: 'Low candle look', value: 'Warm 18%', durationMs: 2500, params: { look: 'Warm Candle', brightness: 18, fadeMs: 2500 } }, chamberLighting)
  );
  preShow.cues.push(preCue);

  const awakening = createScene('Entity Awakens');
  awakening.description = 'The chamber changes state and the entity reveals itself.';
  const cue = createCue('Entity Appears');
  cue.trigger = 'Operator GO';
  cue.actions.push(
    assignTarget({ ...createAction('audio'), label: 'Entity scream', value: 'entity_scream.wav', params: { asset: 'entity_scream.wav', volume: 100, loop: false, fadeMs: 0 } }, stageLeftAudio),
    assignTarget({ ...createAction('lighting'), label: 'Chamber snap red', value: 'Red 100%', durationMs: 300, params: { look: 'Snap Red', brightness: 100, fadeMs: 300 } }, chamberLighting),
    assignTarget({ ...createAction('pixel'), label: 'Lightning segment', value: 'Pixels 0–7 · Lightning', params: { ...defaultParams('pixel'), startPixel: 0, endPixel: 7, effect: 'LIGHTNING', colour: '#d9efff', brightness: 100, speed: 85 } }, corridorPixels),
    assignTarget({ ...createAction('pixel'), label: 'Blue hold segment', value: 'Pixels 8–10 · Solid Blue', params: { ...defaultParams('pixel'), startPixel: 8, endPixel: 10, effect: 'SOLID', colour: '#145cff', brightness: 80, speed: 1 } }, corridorPixels),
    assignTarget({ ...createAction('pixel'), label: 'Warm glow segment', value: 'Pixels 11–60 · Warm Glow', params: { ...defaultParams('pixel'), startPixel: 11, endPixel: 60, effect: 'BREATHE', colour: '#ffb45b', brightness: 55, speed: 20 } }, corridorPixels),
    assignTarget({ ...createAction('mosfet'), label: 'Prop strike', value: 'MOSFET 03 PULSE', durationMs: 2500, params: { channel: 3, state: 'PULSE', level: 255, pulseMs: 2500, fadeMs: 0 } }, propPower),
    { ...createAction('delay'), label: 'Impact delay', delayMs: 750, value: '750 ms', params: { milliseconds: 750 } },
    assignTarget({ ...createAction('audio'), label: 'Impact hit', value: 'impact.wav', params: { asset: 'impact.wav', volume: 100, loop: false, fadeMs: 0 } }, mainAudio)
  );
  awakening.cues.push(cue);

  const escape = createScene('Escape');
  escape.description = 'Final release sequence and reset path.';
  const escapeCue = createCue('Release Doors');
  escapeCue.trigger = 'Door Sensor Armed + Operator GO';
  escapeCue.actions.push(
    assignTarget({ ...createAction('mosfet'), label: 'Release magnetic lock', value: 'MOSFET 01 OFF', params: { channel: 1, state: 'OFF', level: 0, pulseMs: 0, fadeMs: 0 } }, propPower),
    assignTarget({ ...createAction('lighting'), label: 'Escape route', value: 'Emergency White 70%', durationMs: 800, params: { look: 'Emergency White', brightness: 70, fadeMs: 800 } }, chamberLighting),
    assignTarget({ ...createAction('pixel'), label: 'Route guide', value: 'Forward Sweep Green', params: { ...defaultParams('pixel'), startPixel: 0, endPixel: 60, effect: 'WIPE', colour: '#39ff88', brightness: 75, speed: 65 } }, corridorPixels)
  );
  escape.cues.push(escapeCue);

  production.scenes = [preShow, awakening, escape];
  production.scenes.forEach((scene, index) => { scene.order = index; });
  return production;
}

function normaliseDevice(device, index) {
  const safe = device && typeof device === 'object' ? device : createDevice(`Device ${index + 1}`);
  safe.id ||= uid('device');
  safe.name ||= `Device ${index + 1}`;
  safe.type ||= 'custom';
  safe.enabled = safe.enabled !== false;
  safe.required = safe.required !== false;
  safe.binding = safe.binding && typeof safe.binding === 'object' ? safe.binding : createBinding();
  safe.binding.route ||= 'unbound';
  safe.binding.nodeId ||= '';
  safe.binding.channel = Number.isFinite(Number(safe.binding.channel)) ? Math.max(0, Number(safe.binding.channel)) : 0;
  safe.binding.output = Number.isFinite(Number(safe.binding.output)) ? Math.max(0, Number(safe.binding.output)) : 0;
  safe.binding.pixelStart = Number.isFinite(Number(safe.binding.pixelStart)) ? Math.max(0, Number(safe.binding.pixelStart)) : 0;
  safe.binding.pixelCount = Number.isFinite(Number(safe.binding.pixelCount)) ? Math.max(0, Number(safe.binding.pixelCount)) : 0;
  safe.capabilities = safe.capabilities && typeof safe.capabilities === 'object' ? safe.capabilities : {};
  safe.metadata = safe.metadata && typeof safe.metadata === 'object' ? safe.metadata : {};
  return safe;
}

export function normaliseProduction(production) {
  const safe = production && typeof production === 'object' ? production : createProduction();
  safe.version = safe.version || '2.0';
  safe.createdAt ||= safe.updatedAt || new Date().toISOString();
  safe.updatedAt ||= new Date().toISOString();
  safe.scenes = Array.isArray(safe.scenes) ? safe.scenes : [];
  safe.assets = Array.isArray(safe.assets) ? safe.assets : [];
  safe.devices = Array.isArray(safe.devices) ? safe.devices.map(normaliseDevice) : [];

  safe.scenes.forEach((scene, sceneIndex) => {
    scene.id ||= uid('scene');
    scene.name ||= `Scene ${sceneIndex + 1}`;
    scene.description ||= '';
    scene.order = sceneIndex;
    scene.cues = Array.isArray(scene.cues) ? scene.cues : [];
    scene.cues.forEach((cue, cueIndex) => {
      cue.id ||= uid('cue');
      cue.name ||= `Cue ${cueIndex + 1}`;
      cue.trigger ||= 'Operator GO';
      cue.notes ||= '';
      cue.actions = Array.isArray(cue.actions) ? cue.actions : [];
      cue.actions.forEach(action => {
        action.id ||= uid('action');
        action.type ||= 'audio';
        action.label ||= action.type;
        action.target ||= '';
        action.targetDeviceId ||= '';
        action.delayMs = Number.isFinite(Number(action.delayMs)) ? Math.max(0, Number(action.delayMs)) : 0;
        action.durationMs = Number.isFinite(Number(action.durationMs)) ? Math.max(0, Number(action.durationMs)) : 0;
        action.value ||= '';
        action.notes ||= '';
        action.params = action.params && typeof action.params === 'object' ? action.params : defaultParams(action.type);

        // Migration: resolve old human-readable target names to a logical device ID when possible.
        if (!action.targetDeviceId && action.target) {
          const match = safe.devices.find(device => device.name.toLowerCase() === String(action.target).toLowerCase());
          if (match) action.targetDeviceId = match.id;
        }
        if (action.targetDeviceId) {
          const device = safe.devices.find(item => item.id === action.targetDeviceId);
          if (device) action.target = device.name;
        }
      });
    });
  });
  return safe;
}
