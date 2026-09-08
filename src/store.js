import { normaliseProduction } from './model.js';
import { importShowduinoDocument, serialiseShdo, shdoFilename } from './package.js';

const STORAGE_KEY = 'showduino-studio-2-production';

export function saveProduction(production) {
  const copy = structuredClone(production);
  copy.createdAt ||= copy.metadata?.createdAt || copy.updatedAt || new Date().toISOString();
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
  const blob = new Blob([text], { type: 'application/vnd.showduino.production+json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportProduction(production) {
  downloadText(serialiseShdo(production), shdoFilename(production));
}

export function importProductionDocument(value) {
  return importShowduinoDocument(value);
}
