import { normaliseProduction } from './model.js';

export const PACKAGE_SCHEMA = 'showduino.production.package';
export const PACKAGE_VERSION = 1;

function slug(value = 'production') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'production';
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
  return value;
}

function runtimeFingerprint(production) {
  return JSON.stringify(stable({
    id: production.id,
    name: production.name,
    version: production.version,
    description: production.description || '',
    scenes: production.scenes.map(scene => ({
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
          delayMs: Number(action.delayMs || 0),
          durationMs: Number(action.durationMs || 0),
          value: action.value || '',
          notes: action.notes || ''
        }))
      }))
    }))
  }));
}

export function buildHardwarePackage(input) {
  const production = normaliseProduction(structuredClone(input));
  const actions = production.scenes.flatMap(scene => scene.cues.flatMap(cue => cue.actions));
  const targets = [...new Set(actions.map(action => action.target).filter(Boolean))].sort();
  const actionTypes = [...new Set(actions.map(action => action.type).filter(Boolean))].sort();
  const manifest = {
    schema: PACKAGE_SCHEMA,
    schemaVersion: PACKAGE_VERSION,
    id: production.id,
    slug: slug(production.name),
    name: production.name,
    version: production.version,
    description: production.description || '',
    entryScene: production.scenes[0]?.id || null,
    counts: {
      scenes: production.scenes.length,
      cues: production.scenes.reduce((n, scene) => n + scene.cues.length, 0),
      actions: actions.length
    },
    requirements: { targets, actionTypes }
  };
  return stable({ manifest, production });
}

export function parseHardwarePackage(raw) {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!value || value.manifest?.schema !== PACKAGE_SCHEMA) throw new Error('Not a Showduino production package.');
  if (Number(value.manifest.schemaVersion) !== PACKAGE_VERSION) throw new Error(`Unsupported Showduino package version ${value.manifest.schemaVersion}.`);
  if (!value.production || !Array.isArray(value.production.scenes)) throw new Error('Package contains no valid production.');
  return normaliseProduction(value.production);
}

export function verifyPackageRoundTrip(production) {
  const original = normaliseProduction(structuredClone(production));
  const serialised = JSON.stringify(buildHardwarePackage(original));
  const restored = parseHardwarePackage(serialised);
  if (runtimeFingerprint(original) !== runtimeFingerprint(restored)) {
    throw new Error('Showduino package round-trip changed runtime production data.');
  }
  return true;
}

export function packageFilename(production) {
  return `${slug(production.name)}.showduino-package.json`;
}

export function serialiseHardwarePackage(production) {
  verifyPackageRoundTrip(production);
  return JSON.stringify(buildHardwarePackage(production), null, 2);
}
