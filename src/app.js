import { ACTION_TYPES, TARGETS, createAction, createCue, createProduction, createScene, createChamberDemo, normaliseProduction } from './model.js';
import { saveProduction, loadProduction } from './store.js';
import { runPreflight } from './preflight.js';
import { simulateCue, simulateScene } from './simulator.js';
import { openPixelComposer } from './pixel-composer.js';
import { ensurePixelComposition, pixelActionSummary } from './pixels.js';

const state = {
  production: createChamberDemo(),
  activeSceneId: null,
  activeCueId: null,
  activeTab: 'scenes'
};

const $ = selector => document.querySelector(selector);
const els = {
  productionName: $('#productionName'), productionMeta: $('#productionMeta'), sceneList: $('#sceneList'), sidebarEmpty: $('#sidebarEmpty'),
  sceneTitle: $('#sceneTitle'), sceneDescription: $('#sceneDescription'), cueList: $('#cueList'), cueCount: $('#cueCount'), cueTitle: $('#cueTitle'),
  cueTrigger: $('#cueTrigger'), actionStack: $('#actionStack'), composerEmpty: $('#composerEmpty'), preflightList: $('#preflightList'), issueCount: $('#issueCount'),
  readinessText: $('#readinessText'), readinessDetail: $('#readinessDetail'), simulatorLog: $('#simulatorLog'), saveState: $('#saveState'),
  modalRoot: $('#modalRoot'), toast: $('#toast')
};

function activeScene() { return state.production.scenes.find(scene => scene.id === state.activeSceneId) || null; }
function activeCue() { return activeScene()?.cues.find(cue => cue.id === state.activeCueId) || null; }
function escapeHtml(value = '') { const div = document.createElement('div'); div.textContent = String(value); return div.innerHTML; }
function markDirty() { els.saveState.textContent = 'Unsaved changes'; }

function toast(message) {
  els.toast.textContent = message; els.toast.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => els.toast.classList.remove('show'), 1700);
}

function chooseDefaults() {
  if (!state.production.scenes.some(s => s.id === state.activeSceneId)) state.activeSceneId = state.production.scenes[0]?.id || null;
  const scene = activeScene();
  if (!scene?.cues.some(c => c.id === state.activeCueId)) state.activeCueId = scene?.cues[0]?.id || null;
}

function render() {
  chooseDefaults();
  els.productionName.value = state.production.name || 'Untitled Production';
  const cueTotal = state.production.scenes.reduce((sum, scene) => sum + scene.cues.length, 0);
  els.productionMeta.textContent = `${state.production.scenes.length} scene${state.production.scenes.length === 1 ? '' : 's'} · ${cueTotal} cue${cueTotal === 1 ? '' : 's'} · v${state.production.version}`;
  renderScenes(); renderSceneWorkspace(); renderPreflight();
}

function renderScenes() {
  els.sceneList.innerHTML = '';
  els.sceneList.hidden = state.activeTab !== 'scenes';
  els.sidebarEmpty.hidden = state.activeTab === 'scenes';
  state.production.scenes.forEach((scene, index) => {
    const button = document.createElement('button');
    button.className = `scene-card ${scene.id === state.activeSceneId ? 'active' : ''}`;
    button.innerHTML = `<span class="scene-number">SCENE ${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(scene.name)}</strong><span>${scene.cues.length} cue${scene.cues.length === 1 ? '' : 's'}</span>`;
    button.onclick = () => { state.activeSceneId = scene.id; state.activeCueId = scene.cues[0]?.id || null; render(); };
    els.sceneList.appendChild(button);
  });
}

function renderSceneWorkspace() {
  const scene = activeScene();
  const cue = activeCue();
  els.sceneTitle.textContent = scene?.name || 'No scene selected';
  els.sceneDescription.textContent = scene?.description || 'Create a scene to begin composing the production.';
  els.cueList.innerHTML = '';
  els.cueCount.textContent = scene?.cues.length || 0;

  scene?.cues.forEach((item, index) => {
    const button = document.createElement('button');
    button.className = `cue-card ${item.id === state.activeCueId ? 'active' : ''}`;
    button.innerHTML = `<span class="cue-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.trigger)}</span></span><span class="cue-actions-count">${item.actions.length} action${item.actions.length === 1 ? '' : 's'}</span>`;
    button.onclick = () => { state.activeCueId = item.id; renderSceneWorkspace(); };
    els.cueList.appendChild(button);
  });

  els.cueTitle.textContent = cue?.name || 'Select a cue';
  els.cueTrigger.textContent = cue ? `Trigger: ${cue.trigger}` : 'Trigger: —';
  els.actionStack.innerHTML = '';
  els.composerEmpty.hidden = Boolean(cue);
  if (!cue) return;

  cue.actions.forEach((action, index) => {
    const def = ACTION_TYPES.find(item => item.type === action.type) || ACTION_TYPES[0];
    const isPixel = action.type === 'pixel';
    const summary = isPixel ? pixelActionSummary(action) : `${action.value || def.label}${action.delayMs ? ` · delay ${action.delayMs} ms` : ''}${action.durationMs ? ` · ${action.durationMs} ms` : ''}`;
    const card = document.createElement('article');
    card.className = `action-card ${isPixel ? 'pixel-action-card' : ''}`;
    card.innerHTML = `<div class="action-icon">${escapeHtml(def.icon)}</div><div><strong>${String(index + 1).padStart(2, '0')} · ${escapeHtml(action.label)}</strong><p>${escapeHtml(summary)}</p></div><div class="action-card-buttons"><button class="action-target" data-action="edit" title="Edit action">${escapeHtml(action.target)}</button>${isPixel ? '<button class="pixel-compose-btn" data-action="pixels" title="Open Segmented Pixel Composer">▦ Compose Pixels</button>' : ''}</div>`;
    card.querySelector('[data-action="edit"]').onclick = () => openActionModal(action);
    card.querySelector('[data-action="pixels"]')?.addEventListener('click', () => openPixelAction(action));
    els.actionStack.appendChild(card);
  });
}

function renderPreflight() {
  const issues = runPreflight(state.production);
  const errors = issues.filter(item => item.level === 'error').length;
  const warnings = issues.filter(item => item.level === 'warn').length;
  els.preflightList.innerHTML = issues.map(item => `<div class="preflight-item ${item.level}">${escapeHtml(item.text)}</div>`).join('');
  els.issueCount.textContent = errors + warnings;
  if (errors) { els.readinessText.textContent = 'BLOCKED'; els.readinessDetail.textContent = `${errors} blocking issue${errors === 1 ? '' : 's'} found.`; }
  else if (warnings) { els.readinessText.textContent = 'CHECK'; els.readinessDetail.textContent = `${warnings} warning${warnings === 1 ? '' : 's'} before production export.`; }
  else { els.readinessText.textContent = 'READY'; els.readinessDetail.textContent = 'Production structure passes Studio 2.0 preflight.'; }
}

function openModal(title, fields, onSave) {
  const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop';
  const fieldHtml = fields.map(field => {
    if (field.type === 'select') return `<label>${escapeHtml(field.label)}<select name="${field.name}">${field.options.map(option => `<option value="${escapeHtml(option)}" ${option === field.value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`;
    if (field.type === 'textarea') return `<label>${escapeHtml(field.label)}<textarea name="${field.name}">${escapeHtml(field.value || '')}</textarea></label>`;
    return `<label>${escapeHtml(field.label)}<input name="${field.name}" type="${field.type || 'text'}" value="${escapeHtml(field.value ?? '')}" /></label>`;
  }).join('');
  backdrop.innerHTML = `<form class="modal"><header>${escapeHtml(title)}</header><main>${fieldHtml}</main><footer><button type="button" data-cancel>Cancel</button><button class="primary" type="submit">Save</button></footer></form>`;
  const close = () => backdrop.remove();
  backdrop.querySelector('[data-cancel]').onclick = close;
  backdrop.onclick = event => { if (event.target === backdrop) close(); };
  backdrop.querySelector('form').onsubmit = event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    onSave(values); close(); markDirty(); render();
  };
  els.modalRoot.replaceChildren(backdrop);
}

function addScene() {
  openModal('Add Scene', [
    { name: 'name', label: 'Scene name', value: `Scene ${state.production.scenes.length + 1}` },
    { name: 'description', label: 'Purpose / description', type: 'textarea', value: '' }
  ], values => { const scene = createScene(values.name || 'New Scene'); scene.description = values.description || ''; scene.order = state.production.scenes.length; state.production.scenes.push(scene); state.activeSceneId = scene.id; state.activeCueId = null; });
}

function renameScene() {
  const scene = activeScene(); if (!scene) return toast('Select a scene first');
  openModal('Edit Scene', [
    { name: 'name', label: 'Scene name', value: scene.name },
    { name: 'description', label: 'Purpose / description', type: 'textarea', value: scene.description }
  ], values => { scene.name = values.name || scene.name; scene.description = values.description || ''; });
}

function addCue() {
  const scene = activeScene(); if (!scene) return toast('Create a scene first');
  openModal('Add Cue', [
    { name: 'name', label: 'Cue name', value: `Cue ${scene.cues.length + 1}` },
    { name: 'trigger', label: 'Trigger', value: 'Operator GO' },
    { name: 'notes', label: 'Notes', type: 'textarea', value: '' }
  ], values => { const cue = createCue(values.name || 'New Cue'); cue.trigger = values.trigger || 'Operator GO'; cue.notes = values.notes || ''; scene.cues.push(cue); state.activeCueId = cue.id; });
}

function editCue() {
  const cue = activeCue(); if (!cue) return toast('Select a cue first');
  openModal('Edit Cue', [
    { name: 'name', label: 'Cue name', value: cue.name },
    { name: 'trigger', label: 'Trigger', value: cue.trigger },
    { name: 'notes', label: 'Notes', type: 'textarea', value: cue.notes }
  ], values => { cue.name = values.name || cue.name; cue.trigger = values.trigger || 'Operator GO'; cue.notes = values.notes || ''; });
}

function addAction() {
  const cue = activeCue(); if (!cue) return toast('Select or create a cue first');
  openModal('Add Showduino Action', [
    { name: 'type', label: 'Action type', type: 'select', value: 'audio', options: ACTION_TYPES.map(item => item.type) },
    { name: 'label', label: 'Action name', value: '' },
    { name: 'target', label: 'Target', type: 'select', value: TARGETS[0], options: TARGETS },
    { name: 'value', label: 'Command / asset / value', value: '' },
    { name: 'delayMs', label: 'Delay before action (ms)', type: 'number', value: 0 },
    { name: 'durationMs', label: 'Duration / fade (ms)', type: 'number', value: 0 }
  ], values => {
    const action = createAction(values.type);
    action.label = values.label || ACTION_TYPES.find(item => item.type === values.type)?.label || values.type;
    action.target = values.target;
    action.value = values.value || '';
    action.delayMs = Number(values.delayMs || 0);
    action.durationMs = Number(values.durationMs || 0);
    if (action.type === 'pixel') ensurePixelComposition(action);
    cue.actions.push(action);
  });
}

function openActionModal(action) {
  openModal('Edit Action', [
    { name: 'type', label: 'Action type', type: 'select', value: action.type, options: ACTION_TYPES.map(item => item.type) },
    { name: 'label', label: 'Action name', value: action.label },
    { name: 'target', label: 'Target', type: 'select', value: action.target, options: TARGETS },
    { name: 'value', label: 'Command / asset / value', value: action.type === 'pixel' ? pixelActionSummary(action) : action.value },
    { name: 'delayMs', label: 'Delay before action (ms)', type: 'number', value: action.delayMs },
    { name: 'durationMs', label: 'Duration / fade (ms)', type: 'number', value: action.durationMs }
  ], values => {
    action.type = values.type;
    action.label = values.label || action.label;
    action.target = values.target;
    if (action.type !== 'pixel') action.value = values.value || '';
    action.delayMs = Number(values.delayMs || 0);
    action.durationMs = Number(values.durationMs || 0);
    if (action.type === 'pixel') {
      ensurePixelComposition(action);
      action.value = pixelActionSummary(action);
    }
  });
}

function openPixelAction(action) {
  openPixelComposer(action, {
    modalRoot: els.modalRoot,
    toast,
    onSave: () => {
      markDirty();
      render();
    }
  });
}

function simulate() {
  const cue = activeCue(); const scene = activeScene();
  const events = cue ? simulateCue(cue) : simulateScene(scene);
  els.simulatorLog.innerHTML = '';
  if (!events.length) { els.simulatorLog.innerHTML = '<p>Nothing to simulate yet.</p>'; return; }
  events.forEach(event => {
    const div = document.createElement('div'); div.className = 'sim-event';
    if (event.kind === 'cue') div.innerHTML = `<strong>CUE ${event.cueIndex} · ${escapeHtml(event.cueName)}</strong><br>${escapeHtml(event.trigger)}`;
    else div.innerHTML = `<strong>+${event.atMs || 0} ms · ${escapeHtml(event.label)}</strong><br>${escapeHtml(event.type)} → ${escapeHtml(event.target)}${event.value ? ` · ${escapeHtml(event.value)}` : ''}`;
    els.simulatorLog.appendChild(div);
  });
  toast(cue ? `Simulated ${cue.name}` : `Simulated ${scene?.name || 'scene'}`);
}

$('#addSceneBtn').onclick = addScene;
$('#renameSceneBtn').onclick = renameScene;
$('#addCueBtn').onclick = addCue;
$('#editCueBtn').onclick = editCue;
$('#addActionBtn').onclick = addAction;
$('#simulateBtn').onclick = simulate;
$('#preflightBtn').onclick = () => { renderPreflight(); toast('Preflight complete'); };
$('#saveBtn').onclick = () => { state.production.name = els.productionName.value.trim() || 'Untitled Production'; state.production = saveProduction(state.production); els.saveState.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`; render(); toast('Production saved'); };
$('#loadBtn').onclick = () => { const loaded = loadProduction(); if (!loaded) return toast('No saved Studio 2.0 production found'); state.production = normaliseProduction(loaded); state.activeSceneId = null; state.activeCueId = null; render(); toast('Production loaded'); };
$('#newProductionBtn').onclick = () => { state.production = createProduction('Untitled Production'); state.activeSceneId = null; state.activeCueId = null; markDirty(); render(); };
els.productionName.oninput = () => { state.production.name = els.productionName.value; markDirty(); els.productionMeta.textContent = `${state.production.scenes.length} scenes · ${state.production.scenes.reduce((n,s)=>n+s.cues.length,0)} cues · v${state.production.version}`; };

document.querySelectorAll('.section-tabs button').forEach(button => button.onclick = () => {
  state.activeTab = button.dataset.tab;
  document.querySelectorAll('.section-tabs button').forEach(item => item.classList.toggle('active', item === button));
  renderScenes();
});

state.activeSceneId = state.production.scenes[1]?.id || state.production.scenes[0]?.id || null;
state.activeCueId = activeScene()?.cues[0]?.id || null;
render();
console.info('Showduino Studio 2.0 Segmented Pixel Composer ready');