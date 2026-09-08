import { normaliseProduction } from './model.js';

export const SHDO_SCHEMA = 'showduino-production-v2';
export const SHDO_VERSION = 2;
export const LEGACY_PACKAGE_SCHEMA = 'showduino.production.package';
export const LEGACY_PACKAGE_VERSION = 1;

export const SHDO_ARCHITECTURE = Object.freeze({
  version: 1,
  creator: 'showduino-studio',
  runtimeAuthority: 'esp32-p4-show-engine',
  operator: 'esp32-s3-director',
  transport: 'esp32-s3-comms-controller',
  nodeAddressing: 'logical-device-id'
});

export const SHDO_SAFETY_POLICY = Object.freeze({
  runtimeAuthority: 'esp32-p4-show-engine',
  policy: 'firmware-authoritative',
  emergency: Object.freeze({
    stopTimeline: true,
    pixelOverride: 'all-white',
    requiresManualClear: true,
    autoResume: false,
    productionCannotDisable: true
  })
});

function slug(value = 'production') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'production';
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      if (value[key] !== undefined) out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asNonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.round(asNumber(value, fallback)));
}

function productionDurationMs(production) {
  if (Number.isFinite(Number(production.durationMs)) && Number(production.durationMs) > 0) {
    return Math.round(Number(production.durationMs));
  }

  // Scene timelines are currently scene-local and may be operator/event triggered, so their
  // clip extents cannot be safely added or treated as the total production duration. Keep the
  // established five-minute authoring canvas until Studio has an explicit production duration.
  return 300000;
}

function normaliseDevice(device, index) {
  const input = device && typeof device === 'object' ? clone(device) : {};
  return {
    ...input,
    id: String(input.id || `device-${index + 1}`),
    name: String(input.name || input.label || `Device ${index + 1}`),
    type: String(input.type || input.kind || 'custom'),
    enabled: input.enabled !== false,
    ...(input.binding && typeof input.binding === 'object' ? { binding: clone(input.binding) } : {}),
    ...(input.capabilities && typeof input.capabilities === 'object' ? { capabilities: clone(input.capabilities) } : {}),
    ...(input.metadata && typeof input.metadata === 'object' ? { metadata: clone(input.metadata) } : {})
  };
}

function normaliseAsset(asset, index) {
  if (typeof asset === 'string') {
    return {
      id: `asset-${index + 1}`,
      name: asset.split('/').pop() || asset,
      type: 'data',
      path: asset
    };
  }

  const input = asset && typeof asset === 'object' ? clone(asset) : {};
  return {
    ...input,
    id: String(input.id || `asset-${index + 1}`),
    name: String(input.name || input.label || input.path || `Asset ${index + 1}`),
    type: String(input.type || 'data'),
    path: String(input.path || input.file || input.url || ''),
    ...(input.checksum ? { checksum: String(input.checksum) } : {}),
    ...(input.metadata && typeof input.metadata === 'object' ? { metadata: clone(input.metadata) } : {})
  };
}

function findTargetDeviceId(devices, action) {
  if (action.targetDeviceId) return String(action.targetDeviceId);
  const target = String(action.target || '').trim().toLowerCase();
  if (!target) return null;
  const match = devices.find(device => [device.id, device.name].some(value => String(value).trim().toLowerCase() === target));
  return match?.id || null;
}

function trackKey(action, targetDeviceId) {
  return `${String(action.type || 'custom')}|${targetDeviceId || String(action.target || 'unassigned')}`;
}

function buildTimelineProjection(production, devices) {
  const tracks = [];
  const clips = [];
  const trackByKey = new Map();
  const clipIdsByCue = new Map();

  for (const scene of production.scenes || []) {
    for (const cue of scene.cues || []) {
      const cueClipIds = [];

      for (const action of cue.actions || []) {
        const targetDeviceId = findTargetDeviceId(devices, action);
        const key = trackKey(action, targetDeviceId);
        let track = trackByKey.get(key);

        if (!track) {
          track = {
            id: `track-${tracks.length + 1}-${slug(action.type || 'custom')}-${slug(targetDeviceId || action.target || 'unassigned')}`,
            name: `${action.target || targetDeviceId || 'Unassigned'} · ${action.type || 'custom'}`,
            type: String(action.type || 'custom'),
            enabled: true,
            locked: false,
            order: tracks.length,
            ...(targetDeviceId ? { targetDeviceId } : {}),
            ...(action.target ? { target: String(action.target) } : {})
          };
          tracks.push(track);
          trackByKey.set(key, track);
        }

        const startMs = asNonNegativeInteger(action.timelineStartMs ?? action.delayMs ?? 0);
        const durationMs = asNonNegativeInteger(action.timelineDurationMs ?? action.durationMs ?? 0);
        const clip = {
          id: String(action.id),
          trackId: track.id,
          sceneId: String(scene.id),
          cueId: String(cue.id),
          name: String(action.label || action.type || 'Action'),
          type: String(action.type || 'custom'),
          startMs,
          durationMs,
          enabled: action.enabled !== false,
          ...(targetDeviceId ? { targetDeviceId } : {}),
          ...(action.target ? { target: String(action.target) } : {}),
          action: {
            type: String(action.type || 'custom'),
            label: String(action.label || action.type || 'Action'),
            ...(action.target ? { target: String(action.target) } : {}),
            ...(targetDeviceId ? { targetDeviceId } : {}),
            delayMs: asNonNegativeInteger(action.delayMs || 0),
            durationMs: asNonNegativeInteger(action.durationMs || 0),
            value: action.value ?? '',
            notes: action.notes ?? '',
            params: action.params && typeof action.params === 'object' ? clone(action.params) : {}
          }
        };

        clips.push(clip);
        cueClipIds.push(clip.id);
      }

      clipIdsByCue.set(String(cue.id), cueClipIds);
    }
  }

  return { tracks, clips, clipIdsByCue };
}

function buildScenes(production, clipIdsByCue) {
  return (production.scenes || []).map((scene, sceneIndex) => ({
    id: String(scene.id),
    name: String(scene.name || `Scene ${sceneIndex + 1}`),
    description: String(scene.description || ''),
    order: Number.isFinite(Number(scene.order)) ? Number(scene.order) : sceneIndex,
    cues: (scene.cues || []).map((cue, cueIndex) => ({
      id: String(cue.id),
      name: String(cue.name || `Cue ${cueIndex + 1}`),
      trigger: String(cue.trigger || 'Operator GO'),
      notes: String(cue.notes || ''),
      clipIds: clipIdsByCue.get(String(cue.id)) || []
    }))
  }));
}

function runtimeFingerprint(production) {
  const safe = normaliseProduction(clone(production));
  return JSON.stringify(stable({
    id: safe.id,
    name: safe.name,
    description: safe.description || '',
    version: safe.version,
    scenes: safe.scenes.map(scene => ({
      id: scene.id,
      name: scene.name,
      description: scene.description || '',
      order: scene.order,
      cues: scene.cues.map(cue => ({
        id: cue.id,
        name: cue.name,
        trigger: cue.trigger,
        notes: cue.notes || '',
        actions: cue.actions.map(action => ({
          id: action.id,
          type: action.type,
          label: action.label,
          target: action.target,
          delayMs: asNonNegativeInteger(action.delayMs || 0),
          durationMs: asNonNegativeInteger(action.durationMs || 0),
          timelineStartMs: asNonNegativeInteger(action.timelineStartMs ?? action.delayMs ?? 0),
          timelineDurationMs: asNonNegativeInteger(action.timelineDurationMs ?? action.durationMs ?? 0),
          value: action.value ?? '',
          notes: action.notes ?? '',
          params: action.params && typeof action.params === 'object' ? action.params : {}
        }))
      }))
    }))
  }));
}

export function buildShdoDocument(input) {
  const production = normaliseProduction(clone(input));
  const now = new Date().toISOString();
  const devices = (production.devices || []).map(normaliseDevice);
  const assets = (production.assets || []).map(normaliseAsset);
  const { tracks, clips, clipIdsByCue } = buildTimelineProjection(production, devices);
  const createdAt = production.createdAt || production.metadata?.createdAt || production.updatedAt || now;
  const updatedAt = production.updatedAt || now;

  return stable({
    schema: SHDO_SCHEMA,
    project: {
      id: String(production.id),
      name: String(production.name || 'Untitled Production'),
      description: String(production.description || ''),
      version: String(production.version || '2.0.0'),
      createdAt,
      updatedAt,
      bpm: asNumber(production.bpm, 120) > 0 ? asNumber(production.bpm, 120) : 120,
      duration: productionDurationMs(production)
    },
    architecture: SHDO_ARCHITECTURE,
    compatibility: {
      shdoMajor: SHDO_VERSION,
      minimumStudioVersion: '2.0.0',
      minimumRuntimeProtocol: 1
    },
    devices,
    tracks,
    clips,
    markers: Array.isArray(production.markers) ? clone(production.markers) : [],
    scenes: buildScenes(production, clipIdsByCue),
    assets,
    safety: SHDO_SAFETY_POLICY,
    globalSettings: production.globalSettings && typeof production.globalSettings === 'object' ? clone(production.globalSettings) : {},
    config: {
      snapEnabled: production.config?.snapEnabled !== false,
      snapMs: asNonNegativeInteger(production.config?.snapMs, 1000) || 1000,
      gridEnabled: production.config?.gridEnabled !== false,
      zoom: asNumber(production.config?.zoom, 0.1) > 0 ? asNumber(production.config?.zoom, 0.1) : 0.1
    },
    package: {
      format: 'showduino-production',
      version: SHDO_VERSION,
      architecture: 'director-comms-p4-nodes',
      runtimeAuthority: 'esp32-p4-show-engine'
    },
    metadata: {
      ...(production.metadata && typeof production.metadata === 'object' ? clone(production.metadata) : {}),
      studioModel: 'production-scene-cue-action-target',
      timelineProjection: 'derived-from-scene-cues',
      authoringSource: 'showduino-studio'
    }
  });
}

export function validateShdoDocument(document) {
  const errors = [];
  const warnings = [];

  if (!document || typeof document !== 'object') {
    return { valid: false, errors: ['Document is not an object.'], warnings };
  }

  if (document.schema !== SHDO_SCHEMA) errors.push(`Unsupported SHDO schema ${document.schema || '(missing)'}.`);
  if (Number(document.package?.version) !== SHDO_VERSION) errors.push(`Unsupported SHDO package version ${document.package?.version ?? '(missing)'}.`);
  if (document.package?.format !== 'showduino-production') errors.push('Package format must be showduino-production.');
  if (document.package?.architecture !== 'director-comms-p4-nodes') errors.push('Package architecture must be director-comms-p4-nodes.');
  if (document.package?.runtimeAuthority !== 'esp32-p4-show-engine') errors.push('Package runtime authority must be esp32-p4-show-engine.');
  if (Number(document.compatibility?.shdoMajor) !== SHDO_VERSION) errors.push(`SHDO compatibility major must be ${SHDO_VERSION}.`);
  if (document.architecture?.runtimeAuthority !== 'esp32-p4-show-engine') errors.push('Runtime authority must be esp32-p4-show-engine.');
  if (document.architecture?.operator !== 'esp32-s3-director') errors.push('Operator must be esp32-s3-director.');
  if (document.architecture?.transport !== 'esp32-s3-comms-controller') errors.push('Transport must be esp32-s3-comms-controller.');
  if (document.architecture?.nodeAddressing !== 'logical-device-id') errors.push('Node addressing must be logical-device-id.');
  if (document.safety?.runtimeAuthority !== 'esp32-p4-show-engine') errors.push('Safety runtime authority must remain esp32-p4-show-engine.');
  if (document.safety?.policy !== 'firmware-authoritative') errors.push('Safety policy must remain firmware-authoritative.');
  if (document.safety?.emergency?.stopTimeline !== true) errors.push('Emergency must stop the timeline.');
  if (document.safety?.emergency?.pixelOverride !== 'all-white') errors.push('Emergency pixel override must remain all-white.');
  if (document.safety?.emergency?.requiresManualClear !== true) errors.push('Emergency must require manual clear.');
  if (document.safety?.emergency?.autoResume !== false) errors.push('Emergency clear must not auto-resume the production.');
  if (document.safety?.emergency?.productionCannotDisable !== true) errors.push('Production files may not disable emergency policy.');
  if (!document.project?.id) errors.push('Project has no stable ID.');
  if (!document.project?.name) errors.push('Project has no name.');

  for (const field of ['devices', 'tracks', 'clips', 'markers', 'scenes', 'assets']) {
    if (!Array.isArray(document[field])) errors.push(`${field} must be an array.`);
  }

  const ids = new Map();
  const claim = (id, label) => {
    if (!id) return errors.push(`${label} has no ID.`);
    if (ids.has(id)) errors.push(`Duplicate ID ${id} found at ${label}; first used by ${ids.get(id)}.`);
    else ids.set(id, label);
  };

  for (const [index, device] of (document.devices || []).entries()) claim(device.id, `device ${index + 1}`);
  for (const [index, track] of (document.tracks || []).entries()) claim(track.id, `track ${index + 1}`);
  for (const [index, clip] of (document.clips || []).entries()) claim(clip.id, `clip ${index + 1}`);
  for (const [index, scene] of (document.scenes || []).entries()) {
    claim(scene.id, `scene ${index + 1}`);
    for (const [cueIndex, cue] of (scene.cues || []).entries()) claim(cue.id, `scene ${index + 1} cue ${cueIndex + 1}`);
  }
  for (const [index, asset] of (document.assets || []).entries()) claim(asset.id, `asset ${index + 1}`);

  const trackIds = new Set((document.tracks || []).map(track => track.id));
  const clipIds = new Set((document.clips || []).map(clip => clip.id));
  const deviceIds = new Set((document.devices || []).map(device => device.id));
  const referencedClipIds = new Set();

  for (const clip of document.clips || []) {
    if (!trackIds.has(clip.trackId)) errors.push(`Clip ${clip.id} references missing track ${clip.trackId}.`);
    if (clip.targetDeviceId && !deviceIds.has(clip.targetDeviceId)) errors.push(`Clip ${clip.id} references missing device ${clip.targetDeviceId}.`);
    if (!clip.targetDeviceId && !clip.target) warnings.push(`Clip ${clip.id} has no logical device binding or legacy target.`);
    if (!Number.isFinite(Number(clip.startMs)) || Number(clip.startMs) < 0) errors.push(`Clip ${clip.id} has invalid startMs.`);
    if (!Number.isFinite(Number(clip.durationMs)) || Number(clip.durationMs) < 0) errors.push(`Clip ${clip.id} has invalid durationMs.`);
  }

  for (const scene of document.scenes || []) {
    if (!Array.isArray(scene.cues)) errors.push(`Scene ${scene.id} cues must be an array.`);
    for (const cue of scene.cues || []) {
      if (!Array.isArray(cue.clipIds)) errors.push(`Cue ${cue.id} clipIds must be an array.`);
      for (const clipId of cue.clipIds || []) {
        referencedClipIds.add(clipId);
        if (!clipIds.has(clipId)) errors.push(`Cue ${cue.id} references missing clip ${clipId}.`);
      }
    }
  }

  for (const clip of document.clips || []) {
    if (!referencedClipIds.has(clip.id)) warnings.push(`Clip ${clip.id} is not assigned to a scene cue.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

function actionFromClip(clip, track, devices) {
  const source = clip.action && typeof clip.action === 'object' ? clip.action : {};
  const targetDeviceId = source.targetDeviceId || clip.targetDeviceId || track?.targetDeviceId || null;
  const boundDevice = targetDeviceId ? devices.find(device => device.id === targetDeviceId) : null;
  const target = source.target || clip.target || track?.target || boundDevice?.name || boundDevice?.id || 'Unassigned';

  return {
    id: String(clip.id),
    type: String(source.type || clip.type || track?.type || 'custom'),
    label: String(source.label || clip.name || source.type || clip.type || 'Action'),
    target: String(target),
    ...(targetDeviceId ? { targetDeviceId: String(targetDeviceId) } : {}),
    delayMs: asNonNegativeInteger(source.delayMs || 0),
    durationMs: asNonNegativeInteger(source.durationMs || 0),
    timelineStartMs: asNonNegativeInteger(clip.startMs || 0),
    timelineDurationMs: asNonNegativeInteger(clip.durationMs || 0),
    value: source.value ?? '',
    notes: source.notes ?? '',
    params: source.params && typeof source.params === 'object' ? clone(source.params) : {}
  };
}

export function parseShdoDocument(raw) {
  const document = typeof raw === 'string' ? JSON.parse(raw) : clone(raw);
  const validation = validateShdoDocument(document);
  if (!validation.valid) throw new Error(validation.errors[0] || 'Invalid SHDO v2 production.');

  const devices = (document.devices || []).map(normaliseDevice);
  const assets = (document.assets || []).map(normaliseAsset);
  const tracks = new Map((document.tracks || []).map(track => [track.id, track]));
  const clips = new Map((document.clips || []).map(clip => [clip.id, clip]));
  const consumed = new Set();

  const scenes = (document.scenes || []).map((scene, sceneIndex) => ({
    id: String(scene.id),
    name: String(scene.name || `Scene ${sceneIndex + 1}`),
    description: String(scene.description || ''),
    order: Number.isFinite(Number(scene.order)) ? Number(scene.order) : sceneIndex,
    cues: (scene.cues || []).map((cue, cueIndex) => ({
      id: String(cue.id),
      name: String(cue.name || `Cue ${cueIndex + 1}`),
      trigger: String(cue.trigger || 'Operator GO'),
      notes: String(cue.notes || ''),
      actions: (cue.clipIds || []).map(clipId => {
        consumed.add(clipId);
        const clip = clips.get(clipId);
        return actionFromClip(clip, tracks.get(clip?.trackId), devices);
      }).filter(Boolean)
    }))
  }));

  const orphanClips = (document.clips || []).filter(clip => !consumed.has(clip.id));
  if (orphanClips.length) {
    scenes.push({
      id: `scene-imported-${Date.now().toString(36)}`,
      name: 'Imported Timeline',
      description: 'Clips preserved from the SHDO file because they were not assigned to a scene cue.',
      order: scenes.length,
      cues: [{
        id: `cue-imported-${Date.now().toString(36)}`,
        name: 'Unassigned Clips',
        trigger: 'Operator GO',
        notes: '',
        actions: orphanClips
          .slice()
          .sort((a, b) => asNumber(a.startMs) - asNumber(b.startMs))
          .map(clip => actionFromClip(clip, tracks.get(clip.trackId), devices))
      }]
    });
  }

  return normaliseProduction({
    id: String(document.project.id),
    name: String(document.project.name || 'Untitled Production'),
    description: String(document.project.description || ''),
    version: String(document.project.version || '2.0.0'),
    createdAt: document.project.createdAt,
    updatedAt: document.project.updatedAt,
    bpm: asNumber(document.project.bpm, 120),
    durationMs: asNonNegativeInteger(document.project.duration, 300000),
    scenes,
    assets,
    devices,
    markers: clone(document.markers || []),
    globalSettings: clone(document.globalSettings || {}),
    config: clone(document.config || {}),
    metadata: clone(document.metadata || {})
  });
}

function parseLegacyHardwarePackage(value) {
  if (!value || value.manifest?.schema !== LEGACY_PACKAGE_SCHEMA) throw new Error('Not a legacy Showduino production package.');
  if (Number(value.manifest.schemaVersion) !== LEGACY_PACKAGE_VERSION) {
    throw new Error(`Unsupported legacy Showduino package version ${value.manifest.schemaVersion}.`);
  }
  if (!value.production || !Array.isArray(value.production.scenes)) throw new Error('Legacy package contains no valid production.');
  return normaliseProduction(clone(value.production));
}

export function importShowduinoDocument(raw) {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (value?.schema === SHDO_SCHEMA || (value?.package?.format === 'showduino-production' && Number(value?.package?.version) === SHDO_VERSION)) {
    return parseShdoDocument(value);
  }
  if (value?.manifest?.schema === LEGACY_PACKAGE_SCHEMA) return parseLegacyHardwarePackage(value);
  if (value && Array.isArray(value.scenes)) return normaliseProduction(clone(value));
  throw new Error('File is neither an SHDO v2 production nor a supported legacy Studio production.');
}

export function verifyShdoRoundTrip(production) {
  const original = normaliseProduction(clone(production));
  const serialised = JSON.stringify(buildShdoDocument(original));
  const restored = parseShdoDocument(serialised);
  if (runtimeFingerprint(original) !== runtimeFingerprint(restored)) {
    throw new Error('SHDO v2 round-trip changed runtime production data.');
  }
  return true;
}

export function shdoFilename(production) {
  return `${slug(production.name)}.shdo`;
}

export function serialiseShdo(production) {
  verifyShdoRoundTrip(production);
  return JSON.stringify(buildShdoDocument(production), null, 2);
}
