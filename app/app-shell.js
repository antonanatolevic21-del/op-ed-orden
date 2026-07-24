import { startProductState } from './state.js';
import { initToasts } from './toast.js';
import { initHeader } from './header.js';
import { initRouter } from './router.js';
import { initProfileTabs } from './profile-tabs.js';
import { initFiltersExperience } from './filters.js';
import { initStatsEnhancements } from './stats.js';
import { initQualityCenter } from './quality-center.js';
import { initRelatedTracks } from './related-tracks.js';
import { initKeyboardShortcuts } from './keyboard.js';
import { initAccessibility } from './accessibility.js';
import { initSkeletons } from './skeletons.js';
import { initUndo } from './undo.js';

async function init() {
  initToasts();
  initHeader();
  initRouter();
  initProfileTabs();
  initFiltersExperience();
  initQualityCenter();
  initRelatedTracks();
  initKeyboardShortcuts();
  initAccessibility();
  initSkeletons();
  initStatsEnhancements();
  await startProductState();
  await initUndo();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init().catch(console.error), { once: true });
else init().catch(console.error);
