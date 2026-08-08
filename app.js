const CLIP_LIBRARY = [
  { group: 'Media', type: 'audio', name: 'Audio', icon: '♪', desc: 'WAV / music / ambience', duration: 8 },
  { group: 'Media', type: 'video', name: 'Video', icon: '▶', desc: 'Video or projection cue', duration: 8 },
  { group: 'Lighting', type: 'lighting', name: 'Lighting Scene', icon: '✦', desc: 'Scene or lighting look', duration: 5 },
  { group: 'Lighting', type: 'dmx', name: 'DMX Cue', icon: 'DMX', desc: 'DMX universe action', duration: 3 },
  { group: 'Lighting', type: 'pixel', name: 'Pixel FX', icon: '▦', desc: 'Addressable LED effect', duration: 5 },
  { group: 'Control', type: 'relay', name: 'Relay', icon: '⏻', desc: 'Relay / prop output', duration: 2 },
  { group: 'Control', type: 'automation', name: 'Automation', icon: '⌁', desc: 'Parameter movement', duration: 6 },
  { group: 'Control', type: 'cue', name: 'Cue Marker', icon: '◆', desc: 'Operator cue / event', duration: 1 },
  { group: 'Safety', type: 'safety', name: 'Safety Action', icon: '!', desc: 'Safety / stop action', duration: 1 }
];

const DEFAULT_TRACKS = [
  { id: 'track-audio-1', name: 'Audio 1', kind: 'audio', muted: false, solo: false },
  { id: 'track-lighting-1', name: 'Lighting 1', kind: 'lighting', muted: false, solo: false },
  { id: 'track-pixels-1', name: 'Pixels 1', kind: 'pixel', muted: false, solo: false },
  { id: 'track-control-1', name: 'Control 1', kind: 'control', muted: false, solo: false },
  { id: 'track-cues-1', name: 'Cues', kind: 'cue', muted: false, solo: false }
];

const state = {
  tracks: structuredClone(DEFAULT_TRACKS),
  clips: [],
  selectedClipId: null,
  pixelsPerSecond: 36,
  zoom: 1,
  currentTime: 0,
  duration: 100,
  playing: false,
  playStartedAt: 0,
  playStartedTime: 0,
  history: [],
  future: [],
  drag: null,
  resize: null,
  nextClipId: 1,
  nextTrackId: 1
};

const els = {
  libraryContent: document.getElementById('libraryContent'),
  librarySearch: document.getElementById('librarySearch'),
  libraryPanel: document.getElementById('libraryPanel'),
  libraryToggle: document.getElementById('libraryToggle'),
  libraryClose: document.getElementById('libraryClose'),
  addTrackBtn: document.getElementById('addTrackBtn'),
  trackHeaders: document.getElementById('trackHeaders'),
  lanes: document.getElementById('lanes'),
  timelineViewport: document.getElementById('timelineViewport'),
  timelineCanvas: document.getElementById('timelineCanvas'),
  rulerViewport: document.getElementById('rulerViewport'),
  ruler: document.getElementById('ruler'),
  gridLayer: document.getElementById('gridLayer'),
  playhead: document.getElementById('playhead'),
  timecode: document.getElementById('timecode'),
  projectName: document.getElementById('projectName'),
  statusText: document.getElementById('statusText'),
  clipCount: document.getElementById('clipCount'),
  snapToggle: document.getElementById('snapToggle'),
  snapSize: document.getElementById('snapSize'),
  zoomReadout: document.getElementById('zoomReadout'),
  inspectorPanel: document.getElementById('inspectorPanel'),
  inspectorTitle: document.getElementById('inspectorTitle'),
  inspectorSubtitle: document.getElementById('inspectorSubtitle'),
  inspectorContent: document.getElementById('inspectorContent'),
  inspectorClose: document.getElementById('inspectorClose'),
  clipMenu: document.getElementById('clipMenu'),
  toast: document.getElementById('toast')
};

function cloneProjectState() {
  return {
    tracks: structuredClone(state.tracks),
    clips: structuredClone(state.clips),
    nextClipId: state.nextClipId,
    nextTrackId: state.nextTrackId
  };
}

function restoreProjectState(snapshot) {
  state.tracks = structuredClone(snapshot.tracks);
  state.clips = structuredClone(snapshot.clips);
  state.nextClipId = snapshot.nextClipId;
  state.nextTrackId = snapshot.nextTrackId;
  state.selectedClipId = null;
  closeInspector();
  renderAll();
}

function pushHistory() {
  state.history.push(cloneProjectState());
  if (state.history.length > 80) state.history.shift();
  state.future.length = 0;
}

function undo() {
  if (!state.history.length) return toast('Nothing to undo');
  state.future.push(cloneProjectState());
  restoreProjectState(state.history.pop());
  toast('Undo');
}

function redo() {
  if (!state.future.length) return toast('Nothing to redo');
  state.history.push(cloneProjectState());
  restoreProjectState(state.future.pop());
  toast('Redo');
}

function renderLibrary(filter = '') {
  const q = filter.trim().toLowerCase();
  els.libraryContent.innerHTML = '';
  const groups = [...new Set(CLIP_LIBRARY.map(item => item.group))];

  groups.forEach(group => {
    const items = CLIP_LIBRARY.filter(item => item.group === group && `${item.name} ${item.desc} ${item.type}`.toLowerCase().includes(q));
    if (!items.length) return;

    const section = document.createElement('section');
    section.className = 'library-group';
    section.innerHTML = `<div class="library-group-title">${group}</div>`;

    items.forEach(item => {
      const node = document.createElement('div');
      node.className = 'library-item';
      node.draggable = true;
      node.dataset.type = item.type;
      node.innerHTML = `<div class="library-icon">${item.icon}</div><div><strong>${item.name}</strong><span>${item.desc}</span></div>`;
      node.addEventListener('dragstart', event => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/showduino-clip', item.type);
      });
      node.addEventListener('dblclick', () => addClipFromLibrary(item.type));
      section.appendChild(node);
    });

    els.libraryContent.appendChild(section);
  });
}

function getClipDefinition(type) {
  return CLIP_LIBRARY.find(item => item.type === type) || CLIP_LIBRARY[0];
}

function trackAccepts(track, type) {
  if (track.kind === 'control') return ['relay', 'automation', 'dmx', 'safety'].includes(type);
  if (track.kind === 'cue') return ['cue', 'safety'].includes(type);
  if (track.kind === 'lighting') return ['lighting', 'dmx'].includes(type);
  if (track.kind === 'pixel') return ['pixel', 'lighting'].includes(type);
  return track.kind === type || track.kind === 'any';
}

function findCompatibleTrack(type) {
  return state.tracks.find(track => trackAccepts(track, type)) || state.tracks[0];
}

function addClipFromLibrary(type, trackId = null, start = state.currentTime) {
  const def = getClipDefinition(type);
  const track = state.tracks.find(t => t.id === trackId) || findCompatibleTrack(type);
  if (!track) return;
  pushHistory();
  const clip = {
    id: `clip-${state.nextClipId++}`,
    type,
    name: def.name,
    trackId: track.id,
    start: snapTime(Math.max(0, start)),
    duration: def.duration,
    volume: 100,
    fadeIn: 0,
    fadeOut: 0,
    notes: ''
  };
  state.clips.push(clip);
  state.selectedClipId = clip.id;
  renderAll();
  scrollClipIntoView(clip);
  toast(`${def.name} added`);
}

function addTrack(kind = 'any', name = null) {
  pushHistory();
  const n = state.nextTrackId++;
  state.tracks.push({ id: `track-custom-${n}`, name: name || `Track ${state.tracks.length + 1}`, kind, muted: false, solo: false });
  renderAll();
  els.timelineViewport.scrollTop = els.timelineViewport.scrollHeight;
}

function removeTrack(trackId) {
  if (state.tracks.length <= 1) return toast('At least one track is required');
  pushHistory();
  state.clips = state.clips.filter(c => c.trackId !== trackId);
  state.tracks = state.tracks.filter(t => t.id !== trackId);
  renderAll();
}

function renderTracks() {
  els.trackHeaders.innerHTML = '';
  els.lanes.innerHTML = '';

  state.tracks.forEach(track => {
    const header = document.createElement('div');
    header.className = 'track-header-row';
    header.dataset.trackId = track.id;
    header.innerHTML = `
      <div class="track-title">${escapeHtml(track.name)}</div>
      <div class="track-meta">${escapeHtml(track.kind)}</div>
      <div class="track-actions">
        <button class="track-mini ${track.muted ? 'active' : ''}" data-action="mute" title="Mute">M</button>
        <button class="track-mini ${track.solo ? 'active' : ''}" data-action="solo" title="Solo">S</button>
        <button class="track-mini" data-action="remove" title="Remove track">×</button>
      </div>`;

    header.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'remove') return removeTrack(track.id);
      pushHistory();
      track[action === 'mute' ? 'muted' : 'solo'] = !track[action === 'mute' ? 'muted' : 'solo'];
      renderTracks();
    }));

    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.dataset.trackId = track.id;
    lane.addEventListener('dragover', event => {
      if (!event.dataTransfer.types.includes('text/showduino-clip')) return;
      event.preventDefault();
      lane.classList.add('drag-over');
      event.dataTransfer.dropEffect = 'copy';
    });
    lane.addEventListener('dragleave', () => lane.classList.remove('drag-over'));
    lane.addEventListener('drop', event => {
      event.preventDefault();
      lane.classList.remove('drag-over');
      const type = event.dataTransfer.getData('text/showduino-clip');
      const rect = els.timelineCanvas.getBoundingClientRect();
      const start = (event.clientX - rect.left) / state.pixelsPerSecond;
      addClipFromLibrary(type, track.id, start);
    });

    els.trackHeaders.appendChild(header);
    els.lanes.appendChild(lane);
  });

  renderClips();
}

function renderClips() {
  document.querySelectorAll('.clip').forEach(n => n.remove());
  state.clips.forEach(clip => {
    const lane = els.lanes.querySelector(`[data-track-id="${CSS.escape(clip.trackId)}"]`);
    if (!lane) return;
    const node = document.createElement('div');
    node.className = `clip ${clip.type}${clip.id === state.selectedClipId ? ' selected' : ''}`;
    node.dataset.clipId = clip.id;
    node.style.left = `${clip.start * state.pixelsPerSecond}px`;
    node.style.width = `${Math.max(22, clip.duration * state.pixelsPerSecond)}px`;
    node.innerHTML = `
      <div class="resize-handle left" data-resize="left"></div>
      <div class="clip-inner"><div class="clip-name">${escapeHtml(clip.name)}</div><div class="clip-meta">${formatShortTime(clip.start)} · ${formatDuration(clip.duration)}</div></div>
      <button class="clip-menu-btn" title="Clip actions" aria-label="Clip actions">⋮</button>
      <div class="resize-handle right" data-resize="right"></div>`;

    node.addEventListener('pointerdown', event => beginClipPointer(event, clip));
    node.querySelector('.clip-menu-btn').addEventListener('pointerdown', event => event.stopPropagation());
    node.querySelector('.clip-menu-btn').addEventListener('click', event => {
      event.stopPropagation();
      selectClip(clip.id, false);
      openClipMenu(clip, event.currentTarget);
    });
    lane.appendChild(node);
  });
  els.clipCount.textContent = `${state.clips.length} clip${state.clips.length === 1 ? '' : 's'}`;
}

function selectClip(id, openInspectorNow = false) {
  state.selectedClipId = id;
  renderClips();
  if (openInspectorNow) openInspector(id);
}

function beginClipPointer(event, clip) {
  if (event.button !== undefined && event.button !== 0) return;
  if (event.target.closest('.clip-menu-btn')) return;
  const resizeSide = event.target.dataset.resize;
  selectClip(clip.id, false);

  if (resizeSide) {
    pushHistory();
    state.resize = { pointerId: event.pointerId, clipId: clip.id, side: resizeSide, x: event.clientX, start: clip.start, duration: clip.duration };
  } else {
    pushHistory();
    state.drag = { pointerId: event.pointerId, clipId: clip.id, x: event.clientX, y: event.clientY, start: clip.start, trackId: clip.trackId };
  }
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

window.addEventListener('pointermove', event => {
  if (state.resize && state.resize.pointerId === event.pointerId) resizeClipPointer(event);
  if (state.drag && state.drag.pointerId === event.pointerId) dragClipPointer(event);
});

window.addEventListener('pointerup', event => {
  if (state.resize?.pointerId === event.pointerId) state.resize = null;
  if (state.drag?.pointerId === event.pointerId) state.drag = null;
});

function resizeClipPointer(event) {
  const data = state.resize;
  const clip = state.clips.find(c => c.id === data.clipId);
  if (!clip) return;
  const delta = (event.clientX - data.x) / state.pixelsPerSecond;
  const minDuration = 0.25;

  if (data.side === 'right') {
    clip.duration = Math.max(minDuration, snapTime(data.duration + delta));
  } else {
    const originalEnd = data.start + data.duration;
    const nextStart = Math.max(0, snapTime(data.start + delta));
    clip.start = Math.min(nextStart, originalEnd - minDuration);
    clip.duration = Math.max(minDuration, snapTime(originalEnd - clip.start));
  }
  renderClips();
}

function dragClipPointer(event) {
  const data = state.drag;
  const clip = state.clips.find(c => c.id === data.clipId);
  if (!clip) return;
  const deltaX = (event.clientX - data.x) / state.pixelsPerSecond;
  clip.start = Math.max(0, snapTime(data.start + deltaX));

  const element = document.elementFromPoint(event.clientX, event.clientY);
  const lane = element?.closest('.lane');
  if (lane) clip.trackId = lane.dataset.trackId;
  renderClips();
}

function openClipMenu(clip, anchor) {
  els.clipMenu.innerHTML = `
    <button data-action="inspect">Inspector…</button>
    <button data-action="duplicate">Duplicate</button>
    <button data-action="split">Split at playhead</button>
    <button data-action="front">Move to playhead</button>
    <button data-action="delete" class="danger">Delete</button>`;
  els.clipMenu.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const menuWidth = 165;
  const left = Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth);
  els.clipMenu.style.left = `${Math.max(8, left)}px`;
  els.clipMenu.style.top = `${Math.min(window.innerHeight - 190, rect.bottom + 5)}px`;
  els.clipMenu.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
    handleClipMenuAction(btn.dataset.action, clip);
    closeClipMenu();
  }));
}

function handleClipMenuAction(action, clip) {
  if (action === 'inspect') return openInspector(clip.id);
  if (action === 'duplicate') return duplicateClip(clip.id);
  if (action === 'delete') return deleteClip(clip.id);
  if (action === 'front') {
    pushHistory();
    clip.start = snapTime(state.currentTime);
    renderAll();
    return;
  }
  if (action === 'split') splitClipAtPlayhead(clip.id);
}

function closeClipMenu() { els.clipMenu.hidden = true; }

document.addEventListener('pointerdown', event => {
  if (!els.clipMenu.hidden && !els.clipMenu.contains(event.target) && !event.target.closest('.clip-menu-btn')) closeClipMenu();
});

function duplicateClip(id) {
  const source = state.clips.find(c => c.id === id);
  if (!source) return;
  pushHistory();
  const copy = { ...structuredClone(source), id: `clip-${state.nextClipId++}`, name: `${source.name} Copy`, start: snapTime(source.start + Math.min(1, source.duration)) };
  state.clips.push(copy);
  state.selectedClipId = copy.id;
  renderAll();
  toast('Clip duplicated');
}

function deleteClip(id) {
  const index = state.clips.findIndex(c => c.id === id);
  if (index < 0) return;
  pushHistory();
  state.clips.splice(index, 1);
  state.selectedClipId = null;
  closeInspector();
  renderAll();
  toast('Clip deleted');
}

function splitClipAtPlayhead(id) {
  const clip = state.clips.find(c => c.id === id);
  if (!clip) return;
  if (state.currentTime <= clip.start || state.currentTime >= clip.start + clip.duration) return toast('Playhead is outside this clip');
  pushHistory();
  const leftDuration = state.currentTime - clip.start;
  const rightDuration = clip.duration - leftDuration;
  clip.duration = leftDuration;
  state.clips.push({ ...structuredClone(clip), id: `clip-${state.nextClipId++}`, name: `${clip.name} B`, start: state.currentTime, duration: rightDuration });
  renderAll();
  toast('Clip split');
}

function openInspector(id) {
  const clip = state.clips.find(c => c.id === id);
  if (!clip) return;
  state.selectedClipId = id;
  const track = state.tracks.find(t => t.id === clip.trackId);
  els.inspectorTitle.textContent = clip.name;
  els.inspectorSubtitle.textContent = `${getClipDefinition(clip.type).name} · ${track?.name || 'Track'}`;
  els.inspectorContent.innerHTML = `
    <div class="field"><label>Name</label><input id="fieldName" value="${escapeAttribute(clip.name)}"></div>
    <div class="field"><label>Track</label><select id="fieldTrack">${state.tracks.map(t => `<option value="${t.id}" ${t.id === clip.trackId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}</select></div>
    <div class="field-row">
      <div class="field"><label>Start (sec)</label><input id="fieldStart" type="number" min="0" step="0.1" value="${round3(clip.start)}"></div>
      <div class="field"><label>Duration (sec)</label><input id="fieldDuration" type="number" min="0.25" step="0.1" value="${round3(clip.duration)}"></div>
    </div>
    ${clip.type === 'audio' ? `<div class="field"><label>Volume %</label><input id="fieldVolume" type="number" min="0" max="200" step="1" value="${clip.volume ?? 100}"></div>` : ''}
    <div class="field-row">
      <div class="field"><label>Fade in</label><input id="fieldFadeIn" type="number" min="0" step="0.1" value="${clip.fadeIn ?? 0}"></div>
      <div class="field"><label>Fade out</label><input id="fieldFadeOut" type="number" min="0" step="0.1" value="${clip.fadeOut ?? 0}"></div>
    </div>
    <div class="field"><label>Notes</label><textarea id="fieldNotes" rows="4">${escapeHtml(clip.notes || '')}</textarea></div>
    <div class="inspector-actions"><button id="applyInspector">Apply</button><button id="duplicateInspector">Duplicate</button><button id="deleteInspector" class="danger">Delete</button><button id="closeInspectorButton">Close</button></div>`;
  els.inspectorPanel.setAttribute('aria-hidden', 'false');
  renderClips();

  document.getElementById('applyInspector').onclick = () => applyInspector(clip.id);
  document.getElementById('duplicateInspector').onclick = () => duplicateClip(clip.id);
  document.getElementById('deleteInspector').onclick = () => deleteClip(clip.id);
  document.getElementById('closeInspectorButton').onclick = closeInspector;
}

function applyInspector(id) {
  const clip = state.clips.find(c => c.id === id);
  if (!clip) return;
  pushHistory();
  clip.name = document.getElementById('fieldName').value.trim() || getClipDefinition(clip.type).name;
  clip.trackId = document.getElementById('fieldTrack').value;
  clip.start = Math.max(0, Number(document.getElementById('fieldStart').value) || 0);
  clip.duration = Math.max(.25, Number(document.getElementById('fieldDuration').value) || .25);
  clip.fadeIn = Math.max(0, Number(document.getElementById('fieldFadeIn').value) || 0);
  clip.fadeOut = Math.max(0, Number(document.getElementById('fieldFadeOut').value) || 0);
  clip.notes = document.getElementById('fieldNotes').value;
  const volume = document.getElementById('fieldVolume');
  if (volume) clip.volume = Math.max(0, Math.min(200, Number(volume.value) || 0));
  renderAll();
  openInspector(id);
  toast('Clip updated');
}

function closeInspector() {
  els.inspectorPanel.setAttribute('aria-hidden', 'true');
}

function renderRuler() {
  els.ruler.innerHTML = '';
  const width = Math.max(3600, state.duration * state.pixelsPerSecond);
  els.ruler.style.width = `${width}px`;
  els.timelineCanvas.style.width = `${width}px`;
  const interval = state.pixelsPerSecond >= 70 ? 1 : state.pixelsPerSecond >= 30 ? 5 : 10;
  for (let t = 0; t <= state.duration; t += interval) {
    const x = t * state.pixelsPerSecond;
    const mark = document.createElement('div');
    mark.className = `ruler-mark ${t % (interval * 2) === 0 ? 'major' : ''}`;
    mark.style.left = `${x}px`;
    const label = document.createElement('div');
    label.className = 'ruler-label';
    label.style.left = `${x}px`;
    label.textContent = formatRulerTime(t);
    els.ruler.append(mark, label);
  }
  document.documentElement.style.setProperty('--px-per-sec', `${state.pixelsPerSecond}px`);
}

function renderPlayhead() {
  els.playhead.style.left = `${state.currentTime * state.pixelsPerSecond}px`;
  els.timecode.textContent = formatTimecode(state.currentTime);
}

function renderAll() {
  renderRuler();
  renderTracks();
  renderPlayhead();
  els.zoomReadout.textContent = `${Math.round(state.zoom * 100)}%`;
}

function setZoom(nextZoom, anchorClientX = null) {
  const oldPps = state.pixelsPerSecond;
  const zoom = Math.max(.35, Math.min(3, nextZoom));
  if (zoom === state.zoom) return;
  const viewportRect = els.timelineViewport.getBoundingClientRect();
  const anchorX = anchorClientX == null ? viewportRect.width / 2 : anchorClientX - viewportRect.left;
  const timelineTime = (els.timelineViewport.scrollLeft + anchorX) / oldPps;
  state.zoom = zoom;
  state.pixelsPerSecond = 36 * zoom;
  renderAll();
  els.timelineViewport.scrollLeft = Math.max(0, timelineTime * state.pixelsPerSecond - anchorX);
  syncHorizontalScroll();
}

function fitTimeline() {
  const usable = Math.max(300, els.timelineViewport.clientWidth - 20);
  setZoom(Math.max(.35, Math.min(3, usable / (state.duration * 36))));
  els.timelineViewport.scrollLeft = 0;
  syncHorizontalScroll();
}

function scrubToClientX(clientX) {
  const rect = els.timelineCanvas.getBoundingClientRect();
  state.currentTime = Math.max(0, Math.min(state.duration, (clientX - rect.left) / state.pixelsPerSecond));
  renderPlayhead();
}

els.timelineCanvas.addEventListener('pointerdown', event => {
  if (event.target.closest('.clip')) return;
  state.selectedClipId = null;
  renderClips();
  scrubToClientX(event.clientX);
});

function play() {
  if (state.playing) return;
  if (state.currentTime >= state.duration) state.currentTime = 0;
  state.playing = true;
  state.playStartedAt = performance.now();
  state.playStartedTime = state.currentTime;
  els.statusText.textContent = 'Playing';
  requestAnimationFrame(tickPlayback);
}

function pause() {
  if (!state.playing) return;
  state.playing = false;
  els.statusText.textContent = 'Paused';
}

function stop() {
  state.playing = false;
  state.currentTime = 0;
  els.statusText.textContent = 'Stopped';
  renderPlayhead();
}

function rewind() {
  state.currentTime = 0;
  state.playStartedTime = 0;
  state.playStartedAt = performance.now();
  renderPlayhead();
}

function tickPlayback(now) {
  if (!state.playing) return;
  state.currentTime = state.playStartedTime + (now - state.playStartedAt) / 1000;
  if (state.currentTime >= state.duration) {
    state.currentTime = state.duration;
    state.playing = false;
    els.statusText.textContent = 'Complete';
  }
  renderPlayhead();
  keepPlayheadVisible();
  if (state.playing) requestAnimationFrame(tickPlayback);
}

function keepPlayheadVisible() {
  const x = state.currentTime * state.pixelsPerSecond;
  const left = els.timelineViewport.scrollLeft;
  const right = left + els.timelineViewport.clientWidth;
  if (x > right - 80) els.timelineViewport.scrollLeft = Math.max(0, x - 120);
  syncHorizontalScroll();
}

function saveProject() {
  const payload = {
    version: 1,
    name: els.projectName.value.trim() || 'Untitled Production',
    tracks: state.tracks,
    clips: state.clips,
    duration: state.duration,
    nextClipId: state.nextClipId,
    nextTrackId: state.nextTrackId
  };
  localStorage.setItem('showduino-studio-project', JSON.stringify(payload));
  toast('Project saved in this browser');
}

function loadProject() {
  const raw = localStorage.getItem('showduino-studio-project');
  if (!raw) return toast('No saved project found');
  try {
    const data = JSON.parse(raw);
    pushHistory();
    els.projectName.value = data.name || 'Untitled Production';
    state.tracks = Array.isArray(data.tracks) && data.tracks.length ? data.tracks : structuredClone(DEFAULT_TRACKS);
    state.clips = Array.isArray(data.clips) ? data.clips : [];
    state.duration = Math.max(30, Number(data.duration) || 100);
    state.nextClipId = Number(data.nextClipId) || inferNextClipId();
    state.nextTrackId = Number(data.nextTrackId) || 1;
    state.selectedClipId = null;
    closeInspector();
    renderAll();
    toast('Project loaded');
  } catch {
    toast('Saved project could not be read');
  }
}

function newProject() {
  pushHistory();
  state.tracks = structuredClone(DEFAULT_TRACKS);
  state.clips = [];
  state.nextClipId = 1;
  state.nextTrackId = 1;
  state.currentTime = 0;
  els.projectName.value = 'Untitled Production';
  closeInspector();
  renderAll();
  toast('New project');
}

function loadDemo() {
  pushHistory();
  state.tracks = structuredClone(DEFAULT_TRACKS);
  state.clips = [
    { id: 'clip-1', type: 'audio', name: 'Pre-show Atmosphere', trackId: 'track-audio-1', start: 0, duration: 18, volume: 85, fadeIn: 2, fadeOut: 2, notes: '' },
    { id: 'clip-2', type: 'lighting', name: 'House to Black', trackId: 'track-lighting-1', start: 12, duration: 4, fadeIn: 1, fadeOut: 0, notes: '' },
    { id: 'clip-3', type: 'pixel', name: 'Portal Chase', trackId: 'track-pixels-1', start: 16, duration: 12, fadeIn: .5, fadeOut: 1, notes: '' },
    { id: 'clip-4', type: 'relay', name: 'Door Release', trackId: 'track-control-1', start: 24, duration: 2, fadeIn: 0, fadeOut: 0, notes: '' },
    { id: 'clip-5', type: 'cue', name: 'Actor GO', trackId: 'track-cues-1', start: 25, duration: 1, fadeIn: 0, fadeOut: 0, notes: 'Operator cue' },
    { id: 'clip-6', type: 'audio', name: 'Impact Hit', trackId: 'track-audio-1', start: 27, duration: 5, volume: 100, fadeIn: 0, fadeOut: 1, notes: '' },
    { id: 'clip-7', type: 'dmx', name: 'Strobe Burst', trackId: 'track-lighting-1', start: 27, duration: 3, fadeIn: 0, fadeOut: 0, notes: '' }
  ];
  state.nextClipId = 8;
  state.currentTime = 0;
  els.projectName.value = 'The Chamber — Demo';
  closeInspector();
  renderAll();
  toast('Demo production loaded');
}

function syncHorizontalScroll() {
  els.rulerViewport.scrollLeft = els.timelineViewport.scrollLeft;
}

function syncVerticalScroll() {
  els.trackHeaders.scrollTop = els.timelineViewport.scrollTop;
}

els.timelineViewport.addEventListener('scroll', () => {
  syncHorizontalScroll();
  syncVerticalScroll();
});

els.timelineViewport.addEventListener('wheel', event => {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    setZoom(state.zoom * (event.deltaY > 0 ? .9 : 1.1), event.clientX);
  }
}, { passive: false });

els.librarySearch.addEventListener('input', event => renderLibrary(event.target.value));
els.addTrackBtn.addEventListener('click', () => addTrack());
els.libraryToggle?.addEventListener('click', () => els.libraryPanel.classList.add('open'));
els.libraryClose?.addEventListener('click', () => els.libraryPanel.classList.remove('open'));
els.inspectorClose.addEventListener('click', closeInspector);

document.getElementById('playBtn').addEventListener('click', play);
document.getElementById('pauseBtn').addEventListener('click', pause);
document.getElementById('stopBtn').addEventListener('click', stop);
document.getElementById('rewindBtn').addEventListener('click', rewind);
document.getElementById('newBtn').addEventListener('click', newProject);
document.getElementById('demoBtn').addEventListener('click', loadDemo);
document.getElementById('saveBtn').addEventListener('click', saveProject);
document.getElementById('loadBtn').addEventListener('click', loadProject);
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);
document.getElementById('zoomInBtn').addEventListener('click', () => setZoom(state.zoom * 1.2));
document.getElementById('zoomOutBtn').addEventListener('click', () => setZoom(state.zoom / 1.2));
document.getElementById('fitBtn').addEventListener('click', fitTimeline);
document.getElementById('collapseAllBtn').addEventListener('click', () => {
  document.documentElement.style.setProperty('--track-h', getComputedStyle(document.documentElement).getPropertyValue('--track-h').trim() === '44px' ? '76px' : '44px');
  renderAll();
});

window.addEventListener('keydown', event => {
  const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && state.selectedClipId) {
    event.preventDefault();
    duplicateClip(state.selectedClipId);
    return;
  }
  if (editing) return;
  if (event.code === 'Space') {
    event.preventDefault();
    state.playing ? pause() : play();
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedClipId) deleteClip(state.selectedClipId);
  if (event.key === 'Escape') { closeClipMenu(); closeInspector(); }
});

window.addEventListener('resize', () => renderRuler());

function scrollClipIntoView(clip) {
  requestAnimationFrame(() => {
    const x = clip.start * state.pixelsPerSecond;
    const trackIndex = state.tracks.findIndex(t => t.id === clip.trackId);
    els.timelineViewport.scrollTo({ left: Math.max(0, x - 100), top: Math.max(0, trackIndex * 76 - 40), behavior: 'smooth' });
  });
}

function snapTime(value) {
  if (!els.snapToggle.checked) return round3(value);
  const size = Number(els.snapSize.value) || 1;
  return round3(Math.round(value / size) * size);
}

function inferNextClipId() {
  return state.clips.reduce((max, clip) => Math.max(max, Number(String(clip.id).replace(/\D/g, '')) || 0), 0) + 1;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('show'), 1700);
}

function formatTimecode(seconds) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function formatRulerTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatShortTime(seconds) { return `${round3(seconds)}s`; }
function formatDuration(seconds) { return `${round3(seconds)}s`; }
function round3(n) { return Math.round(Number(n) * 1000) / 1000; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function escapeAttribute(value) { return escapeHtml(value); }

window.ShowduinoStudio = { state, setZoom, renderAll, addClipFromLibrary, scrubToClientX };

renderLibrary();
renderAll();
