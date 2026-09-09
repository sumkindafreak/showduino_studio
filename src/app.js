import {
  ACTION_TYPES,
  DEVICE_TYPES,
  BINDING_ROUTES,
  createAction,
  createBinding,
  createCue,
  createDevice,
  createProduction,
  createScene,
  createChamberDemo,
  deviceSupportsAction,
  normaliseProduction
} from './model.js';
import { saveProduction, loadProduction, exportProduction, importProductionDocument } from './store.js';
import { runPreflight, hasBlockingIssues } from './preflight.js';
import { simulateCue, simulateScene } from './simulator.js';
import { renderTimeline } from './timeline.js';
import { compileSceneForStage, deploySceneToStage, downloadDeploymentPlan } from './deployment.js';

const state = {
  production: createChamberDemo(),
  activeSceneId: null,
  activeCueId: null,
  activeDeviceId: null,
  activeTab: 'scenes',
  compiled: null
};

const $ = selector => document.querySelector(selector);
const els = {
  productionName: $('#productionName'),
  productionMeta: $('#productionMeta'),
  sceneList: $('#sceneList'),
  deviceList: $('#deviceList'),
  sidebarEmpty: $('#sidebarEmpty'),
  sceneWorkspace: $('#sceneWorkspace'),
  deviceWorkspace: $('#deviceWorkspace'),
  sceneTitle: $('#sceneTitle'),
  sceneDescription: $('#sceneDescription'),
  cueList: $('#cueList'),
  cueCount: $('#cueCount'),
  cueTitle: $('#cueTitle'),
  cueTrigger: $('#cueTrigger'),
  actionStack: $('#actionStack'),
  composerEmpty: $('#composerEmpty'),
  preflightList: $('#preflightList'),
  issueCount: $('#issueCount'),
  readinessText: $('#readinessText'),
  readinessDetail: $('#readinessDetail'),
  simulatorLog: $('#simulatorLog'),
  saveState: $('#saveState'),
  modalRoot: $('#modalRoot'),
  toast: $('#toast'),
  fileInput: $('#productionFileInput'),
  timeline: $('#timelineWorkspace'),
  deviceCards: $('#deviceCards'),
  deviceCount: $('#deviceCount'),
  boundCount: $('#boundCount'),
  requiredCount: $('#requiredCount'),
  compilerSceneName: $('#compilerSceneName'),
  compilerState: $('#compilerState'),
  compilerReport: $('#compilerReport'),
  stageUrl: $('#stageUrl')
};

function activeScene() {
  return state.production.scenes.find(scene => scene.id === state.activeSceneId) || null;
}

function activeCue() {
  return activeScene()?.cues.find(cue => cue.id === state.activeCueId) || null;
}

function escapeHtml(value = '') {
  const node = document.createElement('div');
  node.textContent = String(value);
  return node.innerHTML;
}

function markDirty() {
  els.saveState.textContent = 'Unsaved changes';
  state.compiled = null;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function chooseDefaults() {
  if (!state.production.scenes.some(scene => scene.id === state.activeSceneId)) {
    state.activeSceneId = state.production.scenes[0]?.id || null;
  }
  const scene = activeScene();
  if (!scene?.cues.some(cue => cue.id === state.activeCueId)) {
    state.activeCueId = scene?.cues[0]?.id || null;
  }
  if (!state.production.devices.some(device => device.id === state.activeDeviceId)) {
    state.activeDeviceId = state.production.devices[0]?.id || null;
  }
}

function render() {
  chooseDefaults();
  els.productionName.value = state.production.name || 'Untitled Production';
  const cueTotal = state.production.scenes.reduce((total, scene) => total + scene.cues.length, 0);
  els.productionMeta.textContent = `${state.production.scenes.length} scenes · ${cueTotal} cues · ${state.production.devices.length} devices · v${state.production.version}`;
  renderNavigator();
  renderWorkspaceMode();
  renderSceneWorkspace();
  renderDeviceWorkspace();
  renderPreflight();
}

function renderNavigator() {
  els.sceneList.innerHTML = '';
  els.deviceList.innerHTML = '';
  els.sceneList.hidden = state.activeTab !== 'scenes';
  els.deviceList.hidden = state.activeTab !== 'devices';
  els.sidebarEmpty.hidden = state.activeTab !== 'assets';

  state.production.scenes.forEach((scene, index) => {
    const button = document.createElement('button');
    button.className = `scene-card ${scene.id === state.activeSceneId ? 'active' : ''}`;
    button.innerHTML = `<span class="scene-number">SCENE ${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(scene.name)}</strong><span>${scene.cues.length} cues</span>`;
    button.onclick = () => {
      state.activeSceneId = scene.id;
      state.activeCueId = scene.cues[0]?.id || null;
      state.compiled = null;
      render();
    };
    els.sceneList.appendChild(button);
  });

  state.production.devices.forEach(device => {
    const route = device.binding?.route || 'unbound';
    const button = document.createElement('button');
    button.className = `scene-card device-nav-card ${device.id === state.activeDeviceId ? 'active' : ''}`;
    button.innerHTML = `<span class="scene-number">${escapeHtml(device.type.toUpperCase())}</span><strong>${escapeHtml(device.name)}</strong><span>${route === 'unbound' ? 'UNBOUND' : escapeHtml(route)}</span>`;
    button.onclick = () => {
      state.activeDeviceId = device.id;
      renderDeviceWorkspace();
      renderNavigator();
    };
    els.deviceList.appendChild(button);
  });
}

function renderWorkspaceMode() {
  const devices = state.activeTab === 'devices';
  els.sceneWorkspace.hidden = devices;
  els.deviceWorkspace.hidden = !devices;
}

function renderSceneWorkspace() {
  const scene = activeScene();
  const cue = activeCue();
  els.sceneTitle.textContent = scene?.name || 'No scene selected';
  els.sceneDescription.textContent = scene?.description || 'Create a scene to begin composing the production.';
  renderTimeline(els.timeline, scene, {
    onEdit: action => openActionModal(action),
    onChange: () => {
      markDirty();
      renderPreflight();
      renderCompiler();
    }
  });

  els.cueList.innerHTML = '';
  els.cueCount.textContent = scene?.cues.length || 0;
  scene?.cues.forEach((item, index) => {
    const button = document.createElement('button');
    button.className = `cue-card ${item.id === state.activeCueId ? 'active' : ''}`;
    button.innerHTML = `<span class="cue-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.trigger)}</span></span><span class="cue-actions-count">${item.actions.length} actions</span>`;
    button.onclick = () => {
      state.activeCueId = item.id;
      renderSceneWorkspace();
    };
    els.cueList.appendChild(button);
  });

  els.cueTitle.textContent = cue?.name || 'Select a cue';
  els.cueTrigger.textContent = cue ? `Trigger: ${cue.trigger}` : 'Trigger: —';
  els.actionStack.innerHTML = '';
  els.composerEmpty.hidden = Boolean(cue);
  if (!cue) return;

  cue.actions.forEach((action, index) => {
    const definition = ACTION_TYPES.find(item => item.type === action.type) || ACTION_TYPES[0];
    const device = state.production.devices.find(item => item.id === action.targetDeviceId);
    const target = device?.name || action.target || (action.type === 'delay' ? 'Timeline' : 'UNBOUND');
    const card = document.createElement('article');
    card.className = 'action-card';
    card.innerHTML = `<div class="action-icon">${escapeHtml(definition.icon)}</div><div><strong>${String(index + 1).padStart(2, '0')} · ${escapeHtml(action.label)}</strong><p>${escapeHtml(action.value || definition.label)}${action.timelineStartMs != null ? ` · @ ${(action.timelineStartMs / 1000).toFixed(2)}s` : ''}</p></div><button class="action-target">${escapeHtml(target)}</button>`;
    card.querySelector('button').onclick = () => openActionModal(action);
    els.actionStack.appendChild(card);
  });
}

function bindingSummary(device) {
  const binding = device.binding || createBinding();
  if (binding.route === 'unbound') return 'Not bound to runtime hardware';
  if (binding.route === 'p4-show-pixels') {
    return `P4 GPIO23 · pixels ${binding.pixelStart || 0}–${(binding.pixelStart || 0) + Math.max(0, (binding.pixelCount || 0) - 1)}`;
  }
  if (binding.route === 'audio-node') return `Audio Node · ${binding.nodeId || 'node not named'}`;
  const channel = Number(binding.channel || binding.output || 0);
  return `${binding.route} · ${binding.nodeId || 'node not named'}${channel ? ` · ch ${channel}` : ''}`;
}

function renderDeviceWorkspace() {
  const devices = state.production.devices || [];
  const bound = devices.filter(device => device.binding?.route && device.binding.route !== 'unbound').length;
  const required = devices.filter(device => device.required !== false).length;
  els.deviceCount.textContent = devices.length;
  els.boundCount.textContent = bound;
  els.requiredCount.textContent = required;
  els.deviceCards.innerHTML = '';

  if (!devices.length) {
    els.deviceCards.innerHTML = '<div class="device-empty">No logical devices yet. Add one before assigning show actions.</div>';
  }

  devices.forEach(device => {
    const selected = device.id === state.activeDeviceId;
    const card = document.createElement('article');
    card.className = `device-card ${selected ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="device-card-main">
        <div class="device-card-title"><strong>${escapeHtml(device.name)}</strong><span>${escapeHtml(device.id)}</span></div>
        <div class="device-badges"><span>${escapeHtml(device.type)}</span><span class="${device.binding?.route === 'unbound' ? 'warn' : 'ok'}">${device.binding?.route === 'unbound' ? 'UNBOUND' : 'BOUND'}</span>${device.required !== false ? '<span>REQUIRED</span>' : '<span>OPTIONAL</span>'}</div>
        <p>${escapeHtml(bindingSummary(device))}</p>
      </div>
      <div class="device-card-actions"><button data-edit>Edit / Bind</button><button data-delete>Delete</button></div>`;
    card.onclick = event => {
      if (event.target.closest('button')) return;
      state.activeDeviceId = device.id;
      renderDeviceWorkspace();
      renderNavigator();
    };
    card.querySelector('[data-edit]').onclick = () => openDeviceModal(device);
    card.querySelector('[data-delete]').onclick = () => deleteDevice(device);
    els.deviceCards.appendChild(card);
  });

  renderCompiler();
}

function renderCompiler() {
  const scene = activeScene();
  const result = compileSceneForStage(state.production, scene?.id);
  state.compiled = result;
  els.compilerSceneName.textContent = scene?.name || 'No scene selected';
  els.compilerState.textContent = result.ok ? 'READY TO STAGE' : 'BLOCKED';
  els.compilerState.className = `compiler-state ${result.ok ? 'ok' : 'blocked'}`;

  const rows = [];
  if (result.ok) rows.push(`<div class="compiler-item ok"><strong>${result.commands.length} Stage commands</strong><span>Compiled for P4 RAM timeline. Deployment loads only; it does not auto-start the show.</span></div>`);
  result.errors.forEach(error => rows.push(`<div class="compiler-item error">${escapeHtml(error)}</div>`));
  result.warnings.forEach(warning => rows.push(`<div class="compiler-item warn">${escapeHtml(warning)}</div>`));
  if (!rows.length) rows.push('<div class="compiler-item">Nothing to compile yet.</div>');
  els.compilerReport.innerHTML = rows.join('');
}

function renderPreflight() {
  const issues = runPreflight(state.production);
  const errors = issues.filter(issue => issue.level === 'error').length;
  const warnings = issues.filter(issue => issue.level === 'warn').length;
  els.preflightList.innerHTML = issues.map(issue => `<div class="preflight-item ${issue.level}">${escapeHtml(issue.text)}</div>`).join('');
  els.issueCount.textContent = errors + warnings;
  els.readinessText.textContent = errors ? 'BLOCKED' : warnings ? 'CHECK' : 'READY';
  els.readinessDetail.textContent = errors ? `${errors} blocking issues.` : warnings ? `${warnings} warnings before deployment.` : 'Production passes Studio preflight.';
}

function optionMarkup(option, current) {
  const value = typeof option === 'object' ? option.value : option;
  const label = typeof option === 'object' ? option.label : option;
  return `<option value="${escapeHtml(value)}" ${String(value) === String(current ?? '') ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function openModal(title, fields, onSave) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const html = fields.map(field => {
    if (field.type === 'select') {
      return `<label>${escapeHtml(field.label)}<select name="${field.name}">${(field.options || []).map(option => optionMarkup(option, field.value)).join('')}</select></label>`;
    }
    if (field.type === 'textarea') {
      return `<label>${escapeHtml(field.label)}<textarea name="${field.name}">${escapeHtml(field.value || '')}</textarea></label>`;
    }
    if (field.type === 'checkbox') {
      return `<label class="modal-checkbox"><input name="${field.name}" type="checkbox" value="1" ${field.value ? 'checked' : ''}/><span>${escapeHtml(field.label)}</span></label>`;
    }
    return `<label>${escapeHtml(field.label)}<input name="${field.name}" type="${field.type || 'text'}" value="${escapeHtml(field.value ?? '')}"/></label>`;
  }).join('');

  backdrop.innerHTML = `<form class="modal"><header>${escapeHtml(title)}</header><main>${html}</main><footer><button type="button" data-cancel>Cancel</button><button class="primary">Save</button></footer></form>`;
  const close = () => backdrop.remove();
  backdrop.querySelector('[data-cancel]').onclick = close;
  backdrop.onclick = event => { if (event.target === backdrop) close(); };
  backdrop.querySelector('form').onsubmit = event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    fields.filter(field => field.type === 'checkbox').forEach(field => {
      values[field.name] = form.elements[field.name].checked;
    });
    onSave(values);
    close();
    markDirty();
    render();
  };
  els.modalRoot.replaceChildren(backdrop);
}

function addScene() {
  openModal('Add Scene', [
    { name: 'name', label: 'Scene name', value: `Scene ${state.production.scenes.length + 1}` },
    { name: 'description', label: 'Description', type: 'textarea', value: '' }
  ], values => {
    const scene = createScene(values.name || 'New Scene');
    scene.description = values.description || '';
    state.production.scenes.push(scene);
    state.activeSceneId = scene.id;
    state.activeCueId = null;
  });
}

function renameScene() {
  const scene = activeScene();
  if (!scene) return toast('Select a scene');
  openModal('Edit Scene', [
    { name: 'name', label: 'Scene name', value: scene.name },
    { name: 'description', label: 'Description', type: 'textarea', value: scene.description }
  ], values => {
    scene.name = values.name || scene.name;
    scene.description = values.description || '';
  });
}

function addCue() {
  const scene = activeScene();
  if (!scene) return toast('Create a scene first');
  openModal('Add Cue', [
    { name: 'name', label: 'Cue name', value: `Cue ${scene.cues.length + 1}` },
    { name: 'trigger', label: 'Trigger', value: 'Operator GO' }
  ], values => {
    const cue = createCue(values.name);
    cue.trigger = values.trigger || 'Operator GO';
    scene.cues.push(cue);
    state.activeCueId = cue.id;
  });
}

function editCue() {
  const cue = activeCue();
  if (!cue) return toast('Select a cue');
  openModal('Edit Cue', [
    { name: 'name', label: 'Cue name', value: cue.name },
    { name: 'trigger', label: 'Trigger', value: cue.trigger }
  ], values => {
    cue.name = values.name || cue.name;
    cue.trigger = values.trigger || 'Operator GO';
  });
}

function deviceOptions(action) {
  const options = [{ value: '', label: action.type === 'delay' ? 'Timeline / no device' : '— Select logical device —' }];
  state.production.devices.forEach(device => {
    const compatible = deviceSupportsAction(device, action.type) || action.type === 'relay';
    options.push({ value: device.id, label: `${device.name} · ${device.type}${compatible ? '' : ' · INCOMPATIBLE'}` });
  });
  return options;
}

function actionFields(action) {
  return [
    { name: 'type', label: 'Action type', type: 'select', value: action.type, options: ACTION_TYPES.filter(item => !item.legacy).map(item => ({ value: item.type, label: item.label })) },
    { name: 'label', label: 'Clip name', value: action.label },
    { name: 'targetDeviceId', label: 'Logical device', type: 'select', value: action.targetDeviceId || '', options: deviceOptions(action) },
    { name: 'value', label: 'Command / asset / effect', value: action.value },
    { name: 'timelineStartMs', label: 'Timeline start (ms)', type: 'number', value: action.timelineStartMs ?? 0 },
    { name: 'timelineDurationMs', label: 'Clip duration (ms)', type: 'number', value: action.timelineDurationMs ?? action.durationMs ?? 2000 }
  ];
}

function applyAction(action, values) {
  action.type = values.type;
  action.label = values.label || action.label;
  action.targetDeviceId = values.targetDeviceId || '';
  const device = state.production.devices.find(item => item.id === action.targetDeviceId);
  action.target = device?.name || '';
  action.value = values.value || '';
  action.timelineStartMs = Math.max(0, Number(values.timelineStartMs || 0));
  action.timelineDurationMs = Math.max(0, Number(values.timelineDurationMs || 0));
}

function addAction() {
  const cue = activeCue();
  if (!cue) return toast('Select or create a cue');
  const action = createAction('audio');
  openModal('Add Timeline Clip', actionFields(action), values => {
    applyAction(action, values);
    cue.actions.push(action);
  });
}

function openActionModal(action) {
  openModal('Edit Timeline Clip', actionFields(action), values => applyAction(action, values));
}

function deviceFields(device) {
  const binding = device.binding || createBinding();
  return [
    { name: 'name', label: 'Logical device name', value: device.name },
    { name: 'id', label: 'Logical device ID', value: device.id },
    { name: 'type', label: 'Device type', type: 'select', value: device.type, options: DEVICE_TYPES.map(item => ({ value: item.type, label: item.label })) },
    { name: 'route', label: 'Runtime binding', type: 'select', value: binding.route || 'unbound', options: BINDING_ROUTES.map(item => ({ value: item.route, label: item.label })) },
    { name: 'nodeId', label: 'Physical / node ID', value: binding.nodeId || '' },
    { name: 'channel', label: 'Channel', type: 'number', value: binding.channel || 0 },
    { name: 'output', label: 'Output', type: 'number', value: binding.output || 0 },
    { name: 'pixelStart', label: 'Pixel region start', type: 'number', value: binding.pixelStart || 0 },
    { name: 'pixelCount', label: 'Pixel region count', type: 'number', value: binding.pixelCount || 0 },
    { name: 'enabled', label: 'Device enabled', type: 'checkbox', value: device.enabled !== false },
    { name: 'required', label: 'Required for this production', type: 'checkbox', value: device.required !== false }
  ];
}

function applyDevice(device, values) {
  const oldId = device.id;
  device.name = values.name || device.name;
  device.id = String(values.id || oldId).trim().replace(/[^A-Za-z0-9_-]+/g, '-');
  device.type = values.type || 'custom';
  device.enabled = Boolean(values.enabled);
  device.required = Boolean(values.required);
  device.binding = {
    route: values.route || 'unbound',
    nodeId: String(values.nodeId || '').trim(),
    channel: Math.max(0, Number(values.channel || 0)),
    output: Math.max(0, Number(values.output || 0)),
    pixelStart: Math.max(0, Number(values.pixelStart || 0)),
    pixelCount: Math.max(0, Number(values.pixelCount || 0))
  };

  state.production.scenes.forEach(scene => scene.cues.forEach(cue => cue.actions.forEach(action => {
    if (action.targetDeviceId === oldId) {
      action.targetDeviceId = device.id;
      action.target = device.name;
    }
  })));
  state.activeDeviceId = device.id;
}

function openDeviceModal(device = null) {
  const target = device || createDevice(`Device ${state.production.devices.length + 1}`, 'custom');
  openModal(device ? 'Edit Logical Device' : 'Add Logical Device', deviceFields(target), values => {
    if (!device) state.production.devices.push(target);
    applyDevice(target, values);
  });
}

function deleteDevice(device) {
  const references = [];
  state.production.scenes.forEach(scene => scene.cues.forEach(cue => cue.actions.forEach(action => {
    if (action.targetDeviceId === device.id) references.push(`${scene.name} → ${cue.name} → ${action.label}`);
  })));
  if (references.length) {
    toast(`Cannot delete ${device.name}: ${references.length} action${references.length === 1 ? '' : 's'} still use it`);
    return;
  }
  state.production.devices = state.production.devices.filter(item => item.id !== device.id);
  state.activeDeviceId = state.production.devices[0]?.id || null;
  markDirty();
  render();
}

function simulate() {
  const cue = activeCue();
  const scene = activeScene();
  const events = cue ? simulateCue(cue) : simulateScene(scene);
  els.simulatorLog.innerHTML = events.length ? '' : '<p>Nothing to simulate yet.</p>';
  events.forEach(event => {
    const node = document.createElement('div');
    node.className = 'sim-event';
    node.innerHTML = event.kind === 'cue'
      ? `<strong>CUE ${event.cueIndex} · ${escapeHtml(event.cueName)}</strong><br>${escapeHtml(event.trigger)}`
      : `<strong>+${event.atMs || 0} ms · ${escapeHtml(event.label)}</strong><br>${escapeHtml(event.type)} → ${escapeHtml(event.target)}`;
    els.simulatorLog.appendChild(node);
  });
  toast('Simulation complete');
}

function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state.production = importProductionDocument(JSON.parse(String(reader.result)));
      state.activeSceneId = null;
      state.activeCueId = null;
      state.activeDeviceId = null;
      state.compiled = null;
      render();
      toast(`Imported ${state.production.name}`);
      window.dispatchEvent(new CustomEvent('showduino:production-imported'));
    } catch (error) {
      toast(error.message || 'Invalid Showduino production');
    }
  };
  reader.readAsText(file);
}

function exportForShowduino() {
  state.production.name = els.productionName.value.trim() || 'Untitled Production';
  if (hasBlockingIssues(state.production)) return toast('EXPORT BLOCKED — fix Preflight');
  state.production = saveProduction(state.production);
  exportProduction(state.production);
  render();
  toast('SHDO v2 EXPORTED');
}

function compileActiveScene() {
  state.compiled = compileSceneForStage(state.production, activeScene()?.id);
  renderCompiler();
  toast(state.compiled.ok ? `${state.compiled.commands.length} Stage commands compiled` : `${state.compiled.errors.length} compiler issue${state.compiled.errors.length === 1 ? '' : 's'}`);
  return state.compiled;
}

function exportStagePlan() {
  const result = compileActiveScene();
  if (!result.ok) return;
  downloadDeploymentPlan(result);
  toast('Stage deployment plan exported');
}

async function deployActiveScene() {
  const result = compileActiveScene();
  if (!result.ok) return;
  const baseUrl = els.stageUrl.value.trim();
  if (location.protocol === 'https:' && /^http:\/\//i.test(baseUrl)) {
    return toast('Direct Stage deploy is blocked by browser mixed-content rules. Run Studio locally over HTTP.');
  }
  $('#deployStageBtn').disabled = true;
  $('#deployStageBtn').textContent = 'Deploying…';
  try {
    await deploySceneToStage(result, baseUrl);
    localStorage.setItem('showduino-stage-url', baseUrl);
    toast('Scene loaded into P4 RAM timeline — not started');
  } catch (error) {
    console.error('Stage deploy failed:', error);
    toast(`DEPLOY FAILED: ${error.message}`);
  } finally {
    $('#deployStageBtn').disabled = false;
    $('#deployStageBtn').textContent = 'Deploy to Stage';
  }
}

$('#addSceneBtn').onclick = addScene;
$('#renameSceneBtn').onclick = renameScene;
$('#addCueBtn').onclick = addCue;
$('#editCueBtn').onclick = editCue;
$('#addActionBtn').onclick = addAction;
$('#simulateBtn').onclick = simulate;
$('#preflightBtn').onclick = () => { renderPreflight(); toast('Preflight complete'); };
$('#addDeviceBtn').onclick = () => openDeviceModal();
$('#compileStageBtn').onclick = compileActiveScene;
$('#exportStagePlanBtn').onclick = exportStagePlan;
$('#deployStageBtn').onclick = deployActiveScene;

$('#saveBtn').onclick = () => {
  state.production.name = els.productionName.value.trim() || 'Untitled Production';
  state.production = saveProduction(state.production);
  render();
  els.saveState.textContent = 'Saved locally';
  toast('Production saved');
};

$('#loadBtn').onclick = () => {
  const production = loadProduction();
  if (!production) return toast('No saved production');
  state.production = normaliseProduction(production);
  state.activeSceneId = null;
  state.activeCueId = null;
  state.activeDeviceId = null;
  state.compiled = null;
  render();
  toast('Production loaded');
};

$('#newProductionBtn').onclick = () => {
  state.production = createProduction();
  state.activeSceneId = null;
  state.activeCueId = null;
  state.activeDeviceId = null;
  state.compiled = null;
  render();
};

$('#exportBtn').onclick = exportForShowduino;
$('#importBtn').onclick = () => {
  els.fileInput.value = '';
  els.fileInput.click();
};
els.fileInput.onchange = event => importFile(event.target.files?.[0]);
els.productionName.oninput = () => {
  state.production.name = els.productionName.value;
  markDirty();
};

els.stageUrl.value = localStorage.getItem('showduino-stage-url') || 'http://192.168.4.1';

document.querySelectorAll('.section-tabs button').forEach(button => {
  button.onclick = () => {
    state.activeTab = button.dataset.tab;
    document.querySelectorAll('.section-tabs button').forEach(item => item.classList.toggle('active', item === button));
    renderNavigator();
    renderWorkspaceMode();
    if (state.activeTab === 'devices') renderDeviceWorkspace();
  };
});

state.activeSceneId = state.production.scenes[1]?.id || state.production.scenes[0]?.id || null;
state.activeCueId = activeScene()?.cues[0]?.id || null;
state.activeDeviceId = state.production.devices[0]?.id || null;
render();
console.info('Showduino Studio 2.0 logical devices + Stage compiler ready');
