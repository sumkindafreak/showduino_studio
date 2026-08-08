import {
  PIXEL_EFFECTS,
  PIXEL_BLEND_MODES,
  clamp,
  createPixelLayer,
  createPixelSegment,
  describeSegment,
  ensurePixelComposition,
  pixelActionSummary
} from './pixels.js';

export function openPixelComposer(action, { modalRoot, onSave, toast }) {
  const draftAction = structuredClone(action);
  const pixel = ensurePixelComposition(draftAction);
  let selectedSegmentId = pixel.segments[0]?.id || null;
  let selectedLayerId = pixel.segments[0]?.layers[0]?.id || null;
  let raf = 0;
  let startedAt = performance.now();

  const backdrop = document.createElement('div');
  backdrop.className = 'pixel-composer-backdrop';
  backdrop.innerHTML = `
    <section class="pixel-composer-window" role="dialog" aria-modal="true" aria-label="Segmented Pixel Composer">
      <header class="pixel-composer-header">
        <div>
          <span class="eyebrow">SEGMENTED PIXEL COMPOSER</span>
          <h2>${escapeHtml(action.label || 'Pixel Action')}</h2>
          <p>One physical line. Any number of named ranges. Multiple effect layers per range.</p>
        </div>
        <div class="pixel-composer-header-actions">
          <button type="button" data-action="cancel">Cancel</button>
          <button type="button" class="primary" data-action="save">Save Pixel Composition</button>
        </div>
      </header>
      <div class="pixel-composer-body">
        <aside class="pixel-segment-panel">
          <div class="pixel-panel-heading"><div><strong>Segments</strong><span>Named pixel ranges</span></div><button type="button" data-action="add-segment">＋</button></div>
          <div class="pixel-segment-list" data-role="segment-list"></div>
        </aside>
        <main class="pixel-stage">
          <section class="pixel-line-settings">
            <label>Line name<input data-field="lineName" value="${escapeHtml(pixel.lineName)}"></label>
            <label>Line ID<input data-field="lineId" value="${escapeHtml(pixel.lineId)}"></label>
            <label>Pixel count<input data-field="pixelCount" type="number" min="1" max="4096" value="${pixel.pixelCount}"></label>
            <label>Master brightness<input data-field="masterBrightness" type="range" min="0" max="100" value="${pixel.masterBrightness}"><span data-role="master-value">${pixel.masterBrightness}%</span></label>
          </section>
          <section class="pixel-preview-card">
            <div class="pixel-preview-heading"><div><strong>Live Strip Preview</strong><span data-role="preview-summary"></span></div><span class="preview-live">LIVE</span></div>
            <div class="pixel-strip-scroll"><div class="pixel-strip" data-role="pixel-strip"></div></div>
            <div class="pixel-scale" data-role="pixel-scale"></div>
            <div class="pixel-segment-map" data-role="segment-map"></div>
          </section>
          <section class="pixel-layer-workspace">
            <div class="pixel-layer-heading"><div><strong data-role="segment-title">Choose a segment</strong><span data-role="segment-range">—</span></div><button type="button" data-action="add-layer">＋ Add Layer</button></div>
            <div class="pixel-layer-list" data-role="layer-list"></div>
          </section>
        </main>
        <aside class="pixel-inspector" data-role="inspector"></aside>
      </div>
    </section>`;

  modalRoot.replaceChildren(backdrop);

  const q = selector => backdrop.querySelector(selector);
  const segmentList = q('[data-role="segment-list"]');
  const strip = q('[data-role="pixel-strip"]');
  const scale = q('[data-role="pixel-scale"]');
  const map = q('[data-role="segment-map"]');
  const layerList = q('[data-role="layer-list"]');
  const inspector = q('[data-role="inspector"]');

  function selectedSegment() {
    return pixel.segments.find(segment => segment.id === selectedSegmentId) || null;
  }

  function selectedLayer() {
    return selectedSegment()?.layers.find(layer => layer.id === selectedLayerId) || null;
  }

  function ensureSelection() {
    if (!pixel.segments.some(segment => segment.id === selectedSegmentId)) selectedSegmentId = pixel.segments[0]?.id || null;
    const segment = selectedSegment();
    if (!segment?.layers.some(layer => layer.id === selectedLayerId)) selectedLayerId = segment?.layers[0]?.id || null;
  }

  function addSegment() {
    const lastEnd = pixel.segments.reduce((max, segment) => Math.max(max, Number(segment.end || 0)), -1);
    const start = Math.min(pixel.pixelCount - 1, Math.max(0, lastEnd + 1));
    const end = Math.min(pixel.pixelCount - 1, start + 9);
    const segment = createPixelSegment(`Segment ${pixel.segments.length + 1}`, start, end);
    pixel.segments.push(segment);
    selectedSegmentId = segment.id;
    selectedLayerId = segment.layers[0]?.id || null;
    renderEditor();
  }

  function addLayer() {
    const segment = selectedSegment();
    if (!segment) return toast?.('Select a segment first');
    const layer = createPixelLayer('solid');
    layer.name = `Layer ${segment.layers.length + 1}`;
    segment.layers.push(layer);
    selectedLayerId = layer.id;
    renderEditor();
  }

  function deleteSegment() {
    if (!selectedSegment()) return;
    pixel.segments = pixel.segments.filter(segment => segment.id !== selectedSegmentId);
    selectedSegmentId = pixel.segments[0]?.id || null;
    selectedLayerId = pixel.segments[0]?.layers[0]?.id || null;
    renderEditor();
  }

  function deleteLayer() {
    const segment = selectedSegment();
    if (!segment || !selectedLayer()) return;
    segment.layers = segment.layers.filter(layer => layer.id !== selectedLayerId);
    selectedLayerId = segment.layers[0]?.id || null;
    renderEditor();
  }

  function renderEditor() {
    ensureSelection();
    renderSegments();
    renderPreviewStructure();
    renderLayers();
    renderInspector();
    q('[data-role="preview-summary"]').textContent = `${pixel.lineName} · ${pixel.pixelCount} pixels · ${pixel.segments.length} segments`;
    q('[data-role="master-value"]').textContent = `${pixel.masterBrightness}%`;
  }

  function renderSegments() {
    segmentList.innerHTML = '';
    if (!pixel.segments.length) {
      segmentList.innerHTML = '<div class="pixel-empty">No ranges yet. Add a segment to start assigning FX.</div>';
      return;
    }
    pixel.segments.forEach((segment, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pixel-segment-card ${segment.id === selectedSegmentId ? 'active' : ''}`;
      button.innerHTML = `<span class="pixel-segment-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(segment.name)}</strong><small>${escapeHtml(describeSegment(segment))}</small></span>`;
      button.onclick = () => {
        selectedSegmentId = segment.id;
        selectedLayerId = segment.layers[0]?.id || null;
        renderEditor();
      };
      segmentList.appendChild(button);
    });
  }

  function renderPreviewStructure() {
    const visibleCount = Math.min(pixel.pixelCount, 320);
    strip.style.setProperty('--pixel-count', visibleCount);
    strip.innerHTML = '';
    for (let index = 0; index < visibleCount; index += 1) {
      const cell = document.createElement('i');
      cell.className = 'pixel-cell';
      cell.dataset.pixelIndex = String(index);
      cell.title = `Pixel ${index}`;
      strip.appendChild(cell);
    }
    if (pixel.pixelCount > visibleCount) {
      const note = document.createElement('span');
      note.className = 'pixel-preview-limit';
      note.textContent = `Preview shows first ${visibleCount} of ${pixel.pixelCount} pixels`;
      strip.appendChild(note);
    }

    const markers = [...new Set([0, Math.floor((pixel.pixelCount - 1) * .25), Math.floor((pixel.pixelCount - 1) * .5), Math.floor((pixel.pixelCount - 1) * .75), pixel.pixelCount - 1])];
    scale.innerHTML = markers.map(value => `<span style="left:${pixel.pixelCount <= 1 ? 0 : (value / (pixel.pixelCount - 1)) * 100}%">${value}</span>`).join('');

    map.innerHTML = '';
    pixel.segments.forEach((segment, index) => {
      const start = clamp(segment.start, 0, pixel.pixelCount - 1);
      const end = clamp(segment.end, start, pixel.pixelCount - 1);
      const left = (start / pixel.pixelCount) * 100;
      const width = Math.max(1.2, ((end - start + 1) / pixel.pixelCount) * 100);
      const band = document.createElement('button');
      band.type = 'button';
      band.className = `pixel-segment-band ${segment.id === selectedSegmentId ? 'active' : ''}`;
      band.style.left = `${left}%`;
      band.style.width = `${width}%`;
      band.style.top = `${(index % 4) * 26}px`;
      band.innerHTML = `<strong>${escapeHtml(segment.name)}</strong><span>${segment.start}–${segment.end}</span>`;
      band.onclick = () => { selectedSegmentId = segment.id; selectedLayerId = segment.layers[0]?.id || null; renderEditor(); };
      map.appendChild(band);
    });
    map.style.height = `${Math.max(42, Math.min(4, pixel.segments.length) * 26 + 8)}px`;
  }

  function renderLayers() {
    const segment = selectedSegment();
    q('[data-role="segment-title"]').textContent = segment?.name || 'Choose a segment';
    q('[data-role="segment-range"]').textContent = segment ? `Pixels ${segment.start}–${segment.end} · ${segment.end - segment.start + 1} pixels` : '—';
    layerList.innerHTML = '';
    if (!segment) return;
    if (!segment.layers.length) layerList.innerHTML = '<div class="pixel-empty">This segment has no effect layers.</div>';
    segment.layers.forEach((layer, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pixel-layer-card ${layer.id === selectedLayerId ? 'active' : ''}`;
      button.innerHTML = `<span class="layer-order">${index + 1}</span><span class="layer-swatch" style="--swatch:${escapeHtml(layer.colour)}"></span><span><strong>${escapeHtml(layer.name)}</strong><small>${escapeHtml(layer.effect)} · ${layer.brightness}% · ${escapeHtml(layer.blend)}</small></span>`;
      button.onclick = () => { selectedLayerId = layer.id; renderInspector(); renderLayers(); };
      layerList.appendChild(button);
    });
  }

  function renderInspector() {
    const segment = selectedSegment();
    const layer = selectedLayer();
    if (!segment) {
      inspector.innerHTML = '<div class="pixel-inspector-empty"><strong>Segment Inspector</strong><p>Select or add a segment.</p></div>';
      return;
    }

    if (!layer) {
      inspector.innerHTML = `
        <div class="pixel-panel-heading"><div><strong>Segment Inspector</strong><span>${escapeHtml(segment.name)}</span></div></div>
        ${segmentFields(segment)}
        <div class="pixel-inspector-actions"><button type="button" data-action="delete-segment" class="danger">Delete Segment</button></div>`;
      wireSegmentFields();
      q('[data-action="delete-segment"]').onclick = deleteSegment;
      return;
    }

    inspector.innerHTML = `
      <div class="pixel-panel-heading"><div><strong>FX Layer Inspector</strong><span>${escapeHtml(segment.name)}</span></div></div>
      ${segmentFields(segment)}
      <div class="pixel-inspector-divider"></div>
      <label>Layer name<input data-layer-field="name" value="${escapeHtml(layer.name)}"></label>
      <label>Effect<select data-layer-field="effect">${PIXEL_EFFECTS.map(effect => `<option value="${effect.id}" ${effect.id === layer.effect ? 'selected' : ''}>${escapeHtml(effect.label)}</option>`).join('')}</select></label>
      <div class="pixel-two-col"><label>Colour A<input data-layer-field="colour" type="color" value="${escapeHtml(layer.colour)}"></label><label>Colour B<input data-layer-field="colour2" type="color" value="${escapeHtml(layer.colour2)}"></label></div>
      ${rangeField('Brightness', 'brightness', layer.brightness)}
      ${rangeField('Opacity', 'opacity', layer.opacity)}
      ${rangeField('Speed', 'speed', layer.speed)}
      ${rangeField('Density', 'density', layer.density)}
      <label>Direction<select data-layer-field="direction"><option value="forward" ${layer.direction === 'forward' ? 'selected' : ''}>Forward</option><option value="reverse" ${layer.direction === 'reverse' ? 'selected' : ''}>Reverse</option><option value="random" ${layer.direction === 'random' ? 'selected' : ''}>Random</option></select></label>
      <label>Blend mode<select data-layer-field="blend">${PIXEL_BLEND_MODES.map(mode => `<option value="${mode}" ${mode === layer.blend ? 'selected' : ''}>${mode}</option>`).join('')}</select></label>
      <div class="pixel-inspector-actions"><button type="button" data-action="delete-layer" class="danger">Delete Layer</button><button type="button" data-action="delete-segment">Delete Segment</button></div>`;

    wireSegmentFields();
    inspector.querySelectorAll('[data-layer-field]').forEach(input => {
      input.oninput = () => {
        const field = input.dataset.layerField;
        layer[field] = ['brightness', 'opacity', 'speed', 'density'].includes(field) ? Number(input.value) : input.value;
        renderLayers();
      };
    });
    q('[data-action="delete-layer"]').onclick = deleteLayer;
    q('[data-action="delete-segment"]').onclick = deleteSegment;
  }

  function segmentFields(segment) {
    return `
      <label>Segment name<input data-segment-field="name" value="${escapeHtml(segment.name)}"></label>
      <div class="pixel-two-col"><label>Start pixel<input data-segment-field="start" type="number" min="0" max="${pixel.pixelCount - 1}" value="${segment.start}"></label><label>End pixel<input data-segment-field="end" type="number" min="0" max="${pixel.pixelCount - 1}" value="${segment.end}"></label></div>
      <label class="pixel-checkbox"><input data-segment-field="enabled" type="checkbox" ${segment.enabled !== false ? 'checked' : ''}> Segment enabled</label>`;
  }

  function wireSegmentFields() {
    const segment = selectedSegment();
    inspector.querySelectorAll('[data-segment-field]').forEach(input => {
      input.oninput = () => {
        const field = input.dataset.segmentField;
        if (field === 'enabled') segment.enabled = input.checked;
        else if (field === 'start') segment.start = clamp(Math.floor(Number(input.value || 0)), 0, pixel.pixelCount - 1);
        else if (field === 'end') segment.end = clamp(Math.floor(Number(input.value || 0)), 0, pixel.pixelCount - 1);
        else segment[field] = input.value;
        if (segment.end < segment.start) segment.end = segment.start;
        renderSegments(); renderPreviewStructure(); renderLayers();
      };
    });
  }

  function animate(now) {
    const time = (now - startedAt) / 1000;
    strip.querySelectorAll('.pixel-cell').forEach(cell => {
      const index = Number(cell.dataset.pixelIndex);
      const colour = composePixel(index, time);
      cell.style.background = colour;
      cell.style.boxShadow = colour === '#000000' ? 'none' : `0 0 8px ${colour}`;
    });
    raf = requestAnimationFrame(animate);
  }

  function composePixel(index, time) {
    let base = [0, 0, 0];
    pixel.segments.filter(segment => segment.enabled !== false && index >= segment.start && index <= segment.end).forEach(segment => {
      segment.layers.forEach(layer => {
        const sample = sampleLayer(layer, segment, index, time);
        base = blend(base, sample.rgb, sample.amount, layer.blend);
      });
    });
    const master = pixel.masterBrightness / 100;
    return rgbToHex(base.map(value => Math.round(clamp(value * master, 0, 255))));
  }

  function sampleLayer(layer, segment, index, time) {
    const speed = Math.max(.05, layer.speed / 20);
    const position = segment.end === segment.start ? 0 : (index - segment.start) / (segment.end - segment.start);
    let intensity = 1;
    let colour = hexToRgb(layer.colour);
    if (layer.effect === 'blackout') intensity = 0;
    if (layer.effect === 'flicker') intensity = .45 + Math.random() * .55;
    if (layer.effect === 'sparkle') intensity = Math.random() < (.01 + layer.density / 330) ? 1 : .05;
    if (layer.effect === 'pulse') intensity = .12 + .88 * ((Math.sin(time * speed * Math.PI * 2) + 1) / 2);
    if (layer.effect === 'breathe') intensity = .28 + .72 * ((Math.sin(time * speed * Math.PI) + 1) / 2);
    if (layer.effect === 'lightning') {
      const burst = Math.sin(time * speed * 13 + index * 1.7) > (.78 - layer.density / 500);
      intensity = burst ? .95 + Math.random() * .05 : .04 + Math.random() * .08;
      colour = mixRgb(hexToRgb(layer.colour2), colour, Math.random());
    }
    if (layer.effect === 'chase') {
      const phase = (time * speed * .22) % 1;
      const travel = layer.direction === 'reverse' ? 1 - phase : phase;
      const distance = Math.abs(position - travel);
      intensity = distance < (.025 + layer.density / 1800) ? 1 : .05;
    }
    if (layer.effect === 'gradient') colour = mixRgb(hexToRgb(layer.colour), hexToRgb(layer.colour2), position);
    const brightness = (layer.brightness / 100) * (layer.opacity / 100) * intensity;
    return { rgb: colour, amount: clamp(brightness, 0, 1) };
  }

  q('[data-action="add-segment"]').onclick = addSegment;
  q('[data-action="add-layer"]').onclick = addLayer;
  q('[data-action="cancel"]').onclick = close;
  q('[data-action="save"]').onclick = () => {
    action.pixel = structuredClone(pixel);
    action.value = pixelActionSummary(action);
    onSave?.(action);
    toast?.('Pixel composition saved');
    close();
  };

  backdrop.querySelectorAll('[data-field]').forEach(input => {
    input.oninput = () => {
      const field = input.dataset.field;
      if (field === 'pixelCount') {
        pixel.pixelCount = clamp(Math.floor(Number(input.value || 1)), 1, 4096);
        pixel.segments.forEach(segment => { segment.start = clamp(segment.start, 0, pixel.pixelCount - 1); segment.end = clamp(segment.end, segment.start, pixel.pixelCount - 1); });
      } else if (field === 'masterBrightness') pixel.masterBrightness = Number(input.value);
      else pixel[field] = input.value;
      renderEditor();
    };
  });

  function close() {
    cancelAnimationFrame(raf);
    backdrop.remove();
  }

  backdrop.onclick = event => { if (event.target === backdrop) close(); };
  renderEditor();
  raf = requestAnimationFrame(animate);
}

function rangeField(label, field, value) {
  return `<label>${escapeHtml(label)}<div class="pixel-range-row"><input data-layer-field="${field}" type="range" min="0" max="100" value="${value}"><output>${value}%</output></div></label>`;
}

function blend(base, next, amount, mode) {
  const scaled = next.map(value => value * amount);
  if (mode === 'add') return base.map((value, index) => clamp(value + scaled[index], 0, 255));
  if (mode === 'max') return base.map((value, index) => Math.max(value, scaled[index]));
  if (mode === 'multiply') return base.map((value, index) => value * ((255 - (255 - next[index]) * amount) / 255));
  return base.map((value, index) => value * (1 - amount) + next[index] * amount);
}

function hexToRgb(hex) {
  const clean = String(hex || '#000000').replace('#', '').padEnd(6, '0').slice(0, 6);
  return [parseInt(clean.slice(0, 2), 16) || 0, parseInt(clean.slice(2, 4), 16) || 0, parseInt(clean.slice(4, 6), 16) || 0];
}

function rgbToHex(rgb) {
  return `#${rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

function mixRgb(a, b, amount) {
  return a.map((value, index) => value + (b[index] - value) * amount);
}

function escapeHtml(value = '') {
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}
