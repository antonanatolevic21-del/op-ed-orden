let booted = false;
let enhancementsBooted = false;

function safeRun(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') result.catch(error => console.error(`Optional feature failed: ${name}`, error));
  } catch (error) {
    console.error(`Optional feature failed: ${name}`, error);
  }
}

function legacyCatalogReady() {
  const list = document.querySelector('#oc-list-container');
  const result = document.querySelector('#oc-resultcount');
  if (!list) return true;
  const loading = /загрузка списка/i.test(String(list.textContent || ''));
  const rendered = /показано:/i.test(String(result?.textContent || ''));
  return rendered || !loading;
}

function whenLegacyReady(callback) {
  if (legacyCatalogReady()) {
    callback();
    return;
  }
  const root = document.querySelector('#oc-list-container') || document.body;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    window.clearTimeout(fallback);
    callback();
  };
  const observer = new MutationObserver(() => {
    if (legacyCatalogReady()) finish();
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  const fallback = window.setTimeout(finish, 12000);
}

function idle(callback, timeout = 1800) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(callback, { timeout });
  else window.setTimeout(callback, 120);
}

async function bootLoadingUi() {
  try {
    const [{ initSkeletons }, { initToasts }] = await Promise.all([
      import('./skeletons.js'),
      import('./toast.js')
    ]);
    safeRun('skeletons', initSkeletons);
    safeRun('toasts', initToasts);
  } catch (error) {
    console.error('Lightweight loading UI failed', error);
  }
}

async function bootPrimaryEnhancements() {
  if (enhancementsBooted) return;
  enhancementsBooted = true;
  try {
    const [
      { initHeader },
      { initProfileTabs },
      { initFiltersExperience },
      { initKeyboardShortcuts },
      { initAccessibility }
    ] = await Promise.all([
      import('./header.js'),
      import('./profile-tabs.js'),
      import('./filters.js'),
      import('./keyboard.js'),
      import('./accessibility.js')
    ]);
    safeRun('header', initHeader);
    safeRun('profile tabs', initProfileTabs);
    safeRun('filters', initFiltersExperience);
    safeRun('keyboard shortcuts', initKeyboardShortcuts);
    safeRun('accessibility', initAccessibility);
  } catch (error) {
    console.error('Primary optional features failed', error);
  }

  idle(async () => {
    try {
      const [
        { initRouter },
        { initStatsEnhancements },
        { initQualityCenter },
        { initRelatedTracks },
        { initUndo },
        { startProductState }
      ] = await Promise.all([
        import('./router.js'),
        import('./stats.js'),
        import('./quality-center.js'),
        import('./related-tracks.js'),
        import('./undo.js'),
        import('./state.js')
      ]);
      safeRun('router', initRouter);
      safeRun('statistics', initStatsEnhancements);
      safeRun('quality center', initQualityCenter);
      safeRun('related tracks', initRelatedTracks);
      safeRun('feature state', startProductState);
      safeRun('undo', initUndo);
    } catch (error) {
      console.error('Secondary optional features failed', error);
    }
  }, 2500);
}

function init() {
  if (booted) return;
  booted = true;
  void bootLoadingUi();
  whenLegacyReady(() => idle(() => { void bootPrimaryEnhancements(); }, 700));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
