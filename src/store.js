import { normaliseProduction } from './model.js';

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

export function exportProduction(production) {
  const blob = new Blob([JSON.stringify(production, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(production.name || 'showduino-production').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.showduino.json`;
  link.click();
  URL.revokeObjectURL(url);
}
