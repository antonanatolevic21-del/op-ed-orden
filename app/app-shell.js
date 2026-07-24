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

function safeInit(name, initializer) {
  try {
    const result = initializer();
    if (result && typeof result.then === 'function') {
      result.catch(error => console.error(`Optional feature failed: ${name}`, error));
    }
  } catch (error) {
    console.error(`Optional feature failed: ${name}`, error);
  }
}

function init() {
  safeInit('toasts', initToasts);
  safeInit('header', initHeader);
  safeInit('router', initRouter);
  safeInit('profile tabs', initProfileTabs);
  safeInit('filters', initFiltersExperience);
  safeInit('quality center', initQualityCenter);
  safeInit('related tracks', initRelatedTracks);
  safeInit('keyboard shortcuts', initKeyboardShortcuts);
  safeInit('accessibility', initAccessibility);
  safeInit('skeletons', initSkeletons);
  safeInit('statistics', initStatsEnhancements);
  safeInit('feature state', startProductState);
  safeInit('undo', initUndo);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
