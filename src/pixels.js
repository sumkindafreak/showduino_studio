import { uid } from './model.js';

export const PIXEL_EFFECTS = [
  { id: 'solid', label: 'Solid Colour' },
  { id: 'lightning', label: 'Lightning / Electricity' },
  { id: 'flicker', label: 'Flicker' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'chase', label: 'Chase' },
  { id: 'sparkle', label: 'Sparkle' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'blackout', label: 'Blackout' }
];

export const PIXEL_BLEND_MODES = ['replace', 'add', 'max', 'multiply'];

export function createPixelLayer(effect = 'solid', overrides = {}) {
  return {
    id: uid('pixel-layer'),
    name: PIXEL_EFFECTS.find(item => item.id === effect)?.label || effect,
    effect,
    colour: '#ffffff',
    colour2: '#6dc8ff',
    brightness: 100,
    opacity: 100,
    speed: 50,
    density: 35,
    direction: 'forward',
    blend: 'replace',
    ...overrides
  };
}

export function createPixelSegment(name = 'New Segment', start = 0, end = 9, overrides = {}) {
  return {
    id: uid('pixel-segment'),
    name,
    start,
    end,
    enabled: true,
    layers: [createPixelLayer('solid')],
    ...overrides
  };
}

export function createPixelComposition(overrides = {}) {
  return {
    lineId: 'pixel-line-1',
    lineName: 'Pixel Line 1',
    pixelCount: 120,
    masterBrightness: 100,
    segments: [],
    ...overrides
  };
}

export function createSegmentedDemoComposition() {
  return createPixelComposition({
    lineId: 'pixel-line-1',
    lineName: 'Corridor Pixel Line',
    pixelCount: 120,
    segments: [
      createPixelSegment('Electric Contacts', 0, 7, {
        layers: [createPixelLayer('lightning', {
          name: 'Electrical arc', colour: '#e8fbff', colour2: '#72bfff', brightness: 100, speed: 82, density: 48, blend: 'replace'
        })]
      }),
      createPixelSegment('Blue Marker', 8, 10, {
        layers: [createPixelLayer('solid', {
          name: 'Plain blue', colour: '#1769ff', colour2: '#1769ff', brightness: 75, blend: 'replace'
        })]
      }),
      createPixelSegment('Warm Chamber Glow', 11, 119, {
        layers: [
          createPixelLayer('solid', {
            name: 'Warm white base', colour: '#ffd39a', colour2: '#ffd39a', brightness: 42, blend: 'replace'
          }),
          createPixelLayer('flicker', {
            name: 'Subtle flame movement', colour: '#fff0cf', colour2: '#ffb15c', brightness: 28, opacity: 38, speed: 24, density: 18, blend: 'add'
          })
        ]
      })
    ]
  });
}

export function ensurePixelComposition(action) {
  if (!action.pixel || typeof action.pixel !== 'object') action.pixel = createPixelComposition();
  action.pixel.lineId ||= 'pixel-line-1';
  action.pixel.lineName ||= 'Pixel Line 1';
  action.pixel.pixelCount = Math.max(1, Number(action.pixel.pixelCount || 120));
  action.pixel.masterBrightness = clamp(Number(action.pixel.masterBrightness ?? 100), 0, 100);
  action.pixel.segments = Array.isArray(action.pixel.segments) ? action.pixel.segments : [];
  action.pixel.segments.forEach((segment, index) => {
    segment.id ||= uid('pixel-segment');
    segment.name ||= `Segment ${index + 1}`;
    segment.start = Math.max(0, Math.floor(Number(segment.start || 0)));
    segment.end = Math.max(segment.start, Math.floor(Number(segment.end ?? segment.start)));
    segment.enabled = segment.enabled !== false;
    segment.layers = Array.isArray(segment.layers) ? segment.layers : [];
    segment.layers.forEach(layer => normalisePixelLayer(layer));
  });
  return action.pixel;
}

export function normalisePixelLayer(layer) {
  layer.id ||= uid('pixel-layer');
  layer.effect ||= 'solid';
  layer.name ||= PIXEL_EFFECTS.find(item => item.id === layer.effect)?.label || layer.effect;
  layer.colour ||= '#ffffff';
  layer.colour2 ||= layer.colour;
  layer.brightness = clamp(Number(layer.brightness ?? 100), 0, 100);
  layer.opacity = clamp(Number(layer.opacity ?? 100), 0, 100);
  layer.speed = clamp(Number(layer.speed ?? 50), 0, 100);
  layer.density = clamp(Number(layer.density ?? 35), 0, 100);
  layer.direction ||= 'forward';
  layer.blend = PIXEL_BLEND_MODES.includes(layer.blend) ? layer.blend : 'replace';
  return layer;
}

export function pixelActionSummary(action) {
  const pixel = ensurePixelComposition(action);
  const enabled = pixel.segments.filter(segment => segment.enabled !== false);
  const layers = enabled.reduce((sum, segment) => sum + segment.layers.length, 0);
  return `${pixel.lineName} · ${pixel.pixelCount} px · ${enabled.length} segment${enabled.length === 1 ? '' : 's'} · ${layers} layer${layers === 1 ? '' : 's'}`;
}

export function validatePixelComposition(action) {
  const pixel = ensurePixelComposition(action);
  const issues = [];
  if (!pixel.segments.length) issues.push({ level: 'warn', text: `${action.label}: pixel composition has no segments.` });
  pixel.segments.forEach(segment => {
    if (segment.start < 0 || segment.end < segment.start || segment.end >= pixel.pixelCount) {
      issues.push({ level: 'error', text: `${action.label}: segment “${segment.name}” range ${segment.start}–${segment.end} is outside ${pixel.lineName} (${pixel.pixelCount} pixels).` });
    }
    if (!segment.layers.length) issues.push({ level: 'warn', text: `${action.label}: segment “${segment.name}” has no effect layers.` });
  });
  return issues;
}

export function describeSegment(segment) {
  return `${segment.start}–${segment.end} · ${segment.layers.map(layer => layer.name || layer.effect).join(' + ') || 'No FX'}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
