const STORAGE_KEY = 'showduino-studio-2-production';

const landing = document.querySelector('#studioLanding');
const shell = document.querySelector('.studio-shell');
const recent = document.querySelector('#landingRecent');
const recentName = document.querySelector('#landingRecentName');
const recentMeta = document.querySelector('#landingRecentMeta');

function savedProduction() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Showduino Studio could not read the recent production:', error);
    return null;
  }
}

function enterStudio() {
  landing?.classList.add('leaving');
  shell?.removeAttribute('aria-hidden');
  window.setTimeout(() => landing?.remove(), 360);
}

const saved = savedProduction();
if (saved && recent && recentName && recentMeta) {
  const cueCount = Array.isArray(saved.scenes)
    ? saved.scenes.reduce((total, scene) => total + (Array.isArray(scene.cues) ? scene.cues.length : 0), 0)
    : 0;
  recent.hidden = false;
  recentName.textContent = saved.name || 'Untitled Production';
  recentMeta.textContent = `${saved.scenes?.length || 0} scenes · ${cueCount} cues`;
}

document.querySelector('#landingNew')?.addEventListener('click', () => {
  document.querySelector('#newProductionBtn')?.click();
  enterStudio();
});

document.querySelector('#landingDemo')?.addEventListener('click', enterStudio);

document.querySelector('#landingRecent')?.addEventListener('click', () => {
  document.querySelector('#loadBtn')?.click();
  enterStudio();
});

console.info('Showduino Studio landing ready');
