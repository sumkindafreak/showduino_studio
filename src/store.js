import { normaliseProduction } from './model.js';
import { packageFilename, parseHardwarePackage, serialiseHardwarePackage } from './package.js';

const STORAGE_KEY = 'showduino-studio-2-production';

export function saveProduction(production) {
  const copy = structuredClone(production);
  copy.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
  return copy;
}

export function loadProduction() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return normaliseProduction(JSON.parse(raw)); }
  catch (error) { console.error('Showduino Studio load failed:', error); return null; }
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportProduction(production) {
  downloadText(serialiseHardwarePackage(production), packageFilename(production));
}

export function importProductionDocument(value) {
  if (value?.manifest?.schema === 'showduino.production.package') return parseHardwarePackage(value);
  if (value && Array.isArray(value.scenes)) return normaliseProduction(value);
  throw new Error('File is neither a Showduino package nor a Studio production.');
}
