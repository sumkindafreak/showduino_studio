import { ACTION_TYPES } from './model.js';

const TRACK_ORDER=['audio','lighting','pixel','dmx','relay','video','automation','trigger','safety','delay'];
const TRACK_LABELS={audio:'AUDIO',lighting:'LIGHTING',pixel:'PIXELS',dmx:'DMX',relay:'RELAYS',video:'VIDEO',automation:'AUTOMATION',trigger:'TRIGGERS',safety:'SAFETY',delay:'DELAYS'};
const PX_PER_SECOND=70;
const MIN_CLIP_MS=500;

function esc(value=''){const div=document.createElement('div');div.textContent=String(value);return div.innerHTML}
function actionStart(action,index){return Math.max(0,Number(action.timelineStartMs ?? action.delayMs ?? index*1000)||0)}
function actionDuration(action){return Math.max(MIN_CLIP_MS,Number(action.timelineDurationMs ?? action.durationMs ?? 2000)||2000)}
function seconds(ms){return ms/1000}

export function ensureTimeline(scene){if(!scene)return;let cursor=0;scene.cues.forEach(cue=>{cue.actions.forEach((action,index)=>{if(action.timelineStartMs==null)action.timelineStartMs=cursor+Number(action.delayMs||0)+index*650;if(action.timelineDurationMs==null)action.timelineDurationMs=Math.max(MIN_CLIP_MS,Number(action.durationMs||0)||2000)});const cueEnd=Math.max(0,...cue.actions.map((a,i)=>actionStart(a,i)+actionDuration(a)));cursor=Math.max(cursor+3000,cueEnd+700)})}

export function renderTimeline(host,scene,{onEdit,onChange}={}){
  if(!host)return;
  if(!scene){host.innerHTML='<div class="timeline-empty">Create or select a scene to open the timeline.</div>';return}
  ensureTimeline(scene);
  const actions=scene.cues.flatMap(cue=>cue.actions.map(action=>({cue,action})));
  const maxMs=Math.max(30000,...actions.map(({action},i)=>actionStart(action,i)+actionDuration(action)+3000));
  const width=Math.ceil(seconds(maxMs)*PX_PER_SECOND);
  const used=new Set(actions.map(({action})=>action.type));
  const tracks=TRACK_ORDER.filter(type=>used.has(type)||['audio','lighting','pixel','relay'].includes(type));
  const ticks=[];for(let ms=0;ms<=maxMs;ms+=5000)ticks.push(`<span style="left:${seconds(ms)*PX_PER_SECOND}px">${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}</span>`);
  host.innerHTML=`<div class="timeline-toolbar"><div><strong>MULTITRACK TIMELINE</strong><span>${esc(scene.name)} · drag clips horizontally · resize right edge</span></div><div class="timeline-zoom">${PX_PER_SECOND}px/s</div></div><div class="timeline-scroll"><div class="timeline-canvas" style="--timeline-width:${width}px"><div class="timeline-ruler"><div class="timeline-track-label">TIME</div><div class="timeline-ruler-grid" style="width:${width}px">${ticks.join('')}</div></div>${tracks.map(type=>`<div class="timeline-track" data-track="${type}"><div class="timeline-track-label">${TRACK_LABELS[type]}</div><div class="timeline-lane" style="width:${width}px">${actions.filter(x=>x.action.type===type).map(({cue,action},i)=>{const def=ACTION_TYPES.find(d=>d.type===type)||{icon:'•'};const left=seconds(actionStart(action,i))*PX_PER_SECOND;const clipWidth=Math.max(48,seconds(actionDuration(action))*PX_PER_SECOND);return `<button class="timeline-clip clip-${type}" data-action="${esc(action.id)}" style="left:${left}px;width:${clipWidth}px" title="${esc(cue.name)} · ${esc(action.label)}"><b>${esc(def.icon)} ${esc(action.label)}</b><small>${esc(action.value||action.target)}</small><i class="timeline-resize" aria-hidden="true"></i></button>`}).join('')}</div></div>`).join('')}</div></div>`;
  const findAction=id=>actions.find(x=>x.action.id===id)?.action;
  host.querySelectorAll('.timeline-clip').forEach(clip=>{
    const action=findAction(clip.dataset.action);if(!action)return;
    clip.addEventListener('click',e=>{if(!clip.dataset.moved&&onEdit)onEdit(action);clip.dataset.moved=''});
    clip.addEventListener('pointerdown',e=>{
      if(e.target.classList.contains('timeline-resize'))return;
      e.preventDefault();clip.setPointerCapture(e.pointerId);const startX=e.clientX,start=actionStart(action,0);clip.dataset.moved='';
      const move=ev=>{const delta=ev.clientX-startX;if(Math.abs(delta)>3)clip.dataset.moved='1';const next=Math.max(0,start+delta/PX_PER_SECOND*1000);action.timelineStartMs=Math.round(next/50)*50;clip.style.left=`${seconds(action.timelineStartMs)*PX_PER_SECOND}px`};
      const up=()=>{clip.removeEventListener('pointermove',move);clip.removeEventListener('pointerup',up);onChange?.(action)};clip.addEventListener('pointermove',move);clip.addEventListener('pointerup',up)
    });
    const handle=clip.querySelector('.timeline-resize');handle.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);const startX=e.clientX,start=actionDuration(action);const move=ev=>{const next=Math.max(MIN_CLIP_MS,start+(ev.clientX-startX)/PX_PER_SECOND*1000);action.timelineDurationMs=Math.round(next/50)*50;clip.style.width=`${Math.max(48,seconds(action.timelineDurationMs)*PX_PER_SECOND)}px`};const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);onChange?.(action)};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up)})
  })
}
