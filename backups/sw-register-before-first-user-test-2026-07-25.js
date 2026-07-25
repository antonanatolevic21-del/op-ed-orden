(() => {
  const primaryVersion = '20260725-primary-shell7';
  const deepLinksVersion = '20260725-deep-links2';
  const accountSyncVersion = '20260725-account-sync3';
  const seasonFillVersion = '20260725-season-fill2';
  const manualTopInsertVersion = '20260725-manual-top-insert4';
  const manualTopInsertFixVersion = '20260725-manual-top-insert-fix4';
  const top100SuiteVersion = '20260725-top100-suite2';
  const myEventsVersion = '20260725-my-events3';
  const statsDesignVersion = '20260725-profile-stats-designs4';
  const adminMissingVersion = '20260725-admin-missing2';
  const loadedStyles = new Map();
  const loadedScripts = new Map();
  let top100Promise = null;
  let seasonPromise = null;
  let statsPromise = null;
  let initialStylesReady = false;

  document.documentElement.classList.remove('oc-primary-ready');

  const bootStyle = document.createElement('style');
  bootStyle.id = 'oc-primary-boot-style';
  bootStyle.textContent = `
    html.oc-primary-booting,html.oc-primary-booting body{background:#0b0a10!important}
    html.oc-primary-booting body{overflow:hidden!important}
    html.oc-primary-booting #opedchart-root{visibility:hidden!important;opacity:0!important;pointer-events:none!important}
    #oc-primary-boot{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b0a10;color:#f5f3fa;font-family:Inter,Arial,sans-serif}
    #oc-primary-boot .oc-primary-boot-card{display:flex;align-items:center;gap:13px;padding:15px 19px;border:1px solid #2d2635;border-radius:15px;background:#100d16;box-shadow:0 18px 60px rgba(0,0,0,.35)}
    #oc-primary-boot .oc-primary-boot-dot{width:11px;height:11px;border:2px solid #08d9d6;border-right-color:transparent;border-radius:50%;animation:ocPrimaryBootSpin .7s linear infinite}
    #oc-primary-boot strong{font-size:14px;letter-spacing:.2px}
    #oc-primary-boot span{display:block;margin-top:2px;color:#8f879b;font:10px/1.35 'Space Mono',monospace}
    html.oc-top100-loading #oc-profile-panel .oc-topmode-toggle,html.oc-top100-loading #oc-profile-panel .oc-topmode-hint,html.oc-top100-loading #oc-profile-panel .oc-manual-actions,html.oc-top100-loading #oc-profile-panel .oc-profile-columns{visibility:hidden!important}
    @keyframes ocPrimaryBootSpin{to{transform:rotate(360deg)}}
  `;
  document.head.append(bootStyle);
  document.documentElement.classList.add('oc-primary-booting');

  const boot = document.createElement('div');
  boot.id = 'oc-primary-boot';
  boot.setAttribute('role', 'status');
  boot.setAttribute('aria-live', 'polite');
  boot.innerHTML = '<div class="oc-primary-boot-card"><i class="oc-primary-boot-dot"></i><div><strong>АБОБА</strong><span>загружаю актуальную версию…</span></div></div>';
  document.body.prepend(boot);

  function addStyle(file, version = primaryVersion) {
    const key = `${file}?v=${version}`;
    if (loadedStyles.has(key)) return loadedStyles.get(key);

    const promise = new Promise(resolve => {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = `./${key}`;
      stylesheet.onload = () => resolve(stylesheet);
      stylesheet.onerror = () => {
        console.warn(`Не удалось загрузить ${file}`);
        resolve(stylesheet);
      };
      document.head.append(stylesheet);
    });

    loadedStyles.set(key, promise);
    return promise;
  }

  function addScript(file, version = primaryVersion, ordered = false) {
    const key = `${file}?v=${version}`;
    if (loadedScripts.has(key)) return loadedScripts.get(key);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `./${key}`;
      if (ordered) script.async = false;
      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error(`Не удалось загрузить ${file}`));
      document.body.append(script);
    });
    loadedScripts.set(key, promise);
    return promise;
  }

  async function addScriptsOrdered(rows) {
    for (const [file, version] of rows) await addScript(file, version, true);
  }

  const initialStylePromises = [
    'filter-ui-fixes.css', 'entity-album-cards.css', 'topbar.css', 'profile-tabs.css',
    'profile-filters.css', 'active-filter-chips.css', 'quality-center.css',
    'keyboard-shortcuts.css', 'advanced-filters.css', 'skeleton-loading.css',
    'toast.css', 'accessibility.css'
  ].map(file => addStyle(file));
  initialStylePromises.push(addStyle('my-events-profile.css', myEventsVersion));
  initialStylePromises.push(addStyle('profile-stats-designs.css', statsDesignVersion));
  initialStylePromises.push(addStyle('admin-missing-inline.css', adminMissingVersion));
  void Promise.all(initialStylePromises).finally(() => { initialStylesReady = true; });

  void addScriptsOrdered([
    ['entity-progress-refresh.js', primaryVersion],
    ['topbar.js', primaryVersion],
    ['profile-tabs.js', primaryVersion],
    ['profile-stats-designs.js', statsDesignVersion],
    ['profile-filters.js', primaryVersion],
    ['active-filter-chips.js', primaryVersion],
    ['account-sync.js', accountSyncVersion],
    ['admin-missing-inline.js', adminMissingVersion],
    ['my-events-profile.js', myEventsVersion],
    ['deep-links.js', deepLinksVersion],
    ['quality-center.js', primaryVersion],
    ['keyboard-shortcuts.js', primaryVersion],
    ['toast.js', primaryVersion],
    ['skeleton-loading.js', primaryVersion],
    ['advanced-filters.js', primaryVersion],
    ['undo-actions.js', primaryVersion],
    ['accessibility.js', primaryVersion]
  ]).catch(error => console.error('Primary UI module load failed', error));

  ['oc-f-score-cmp', 'oc-p-score-cmp'].forEach(id => {
    const option = document.querySelector(`#${id} option[value="="]`);
    if (option) option.textContent = '>=';
  });

  if (document.querySelector('.oc-addbar')) {
    addStyle('track-add-panel.css');
    void addScript('track-add-panel.js', primaryVersion, true);
  }

  function loadTop100Package() {
    if (top100Promise) return top100Promise;
    document.documentElement.classList.add('oc-top100-loading');
    addStyle('manual-top-insert.css', manualTopInsertVersion);
    addStyle('profile-top-single.css', top100SuiteVersion);
    addStyle('profile-top-layout-fixes.css', top100SuiteVersion);
    addStyle('manual-top-insert-fix.css', manualTopInsertFixVersion);
    addStyle('top100-suite.css', top100SuiteVersion);
    top100Promise = addScriptsOrdered([
      ['catalog-cache.js', primaryVersion],
      ['profile-top-single.js', top100SuiteVersion],
      ['manual-top-insert-fast.js', manualTopInsertVersion],
      ['top100-suite.js', top100SuiteVersion],
      ['top100-suite-view-fix.js', top100SuiteVersion],
      ['manual-top-insert-fix.js', manualTopInsertFixVersion]
    ]).catch(error => {
      document.documentElement.classList.remove('oc-top100-loading');
      console.error('Top-100 package load failed', error);
      throw error;
    });
    return top100Promise;
  }

  function loadSeasonPackage() {
    if (seasonPromise) return seasonPromise;
    addStyle('season-quality-fill.css', seasonFillVersion);
    seasonPromise = addScriptsOrdered([
      ['catalog-cache.js', primaryVersion],
      ['season-quality-fill.js', seasonFillVersion]
    ]).catch(error => { console.error('Season package load failed', error); throw error; });
    return seasonPromise;
  }

  function loadStatsPackage() {
    if (statsPromise) return statsPromise;
    addStyle('stats-lite.css', primaryVersion);
    statsPromise = addScript('stats-lite.js', primaryVersion, true).catch(error => { console.error('Stats package load failed', error); throw error; });
    return statsPromise;
  }

  function routeLazyModules(target) {
    if (target?.closest?.('[data-profile-view="top100"]')) void loadTop100Package();
    if (target?.closest?.('.oc-tab-btn[data-tab="season"]')) void loadSeasonPackage();
    if (target?.closest?.('.oc-tab-btn[data-tab="stats"]')) void loadStatsPackage();
  }

  document.addEventListener('click', event => routeLazyModules(event.target), true);

  const profile = document.querySelector('#oc-profile-panel');
  if (profile) {
    new MutationObserver(() => {
      if (profile.dataset.profileView === 'top100') void loadTop100Package();
    }).observe(profile, { attributes: true, attributeFilter: ['data-profile-view'] });
  }

  function detectCurrentLazyView() {
    if (profile?.dataset.profileView === 'top100' && !profile.classList.contains('hidden')) void loadTop100Package();
    if (document.querySelector('.oc-tab-btn[data-tab="season"]')?.classList.contains('active')) void loadSeasonPackage();
    if (document.querySelector('.oc-tab-btn[data-tab="stats"]')?.classList.contains('active')) void loadStatsPackage();
  }
  window.setTimeout(detectCurrentLazyView, 100);

  function revealCurrentShell() {
    if (!document.documentElement.classList.contains('oc-primary-booting')) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.add('oc-primary-ready');
      document.documentElement.classList.remove('oc-primary-booting');
      boot.remove();
    }));
  }

  let readyChecks = 0;
  function waitForCurrentShell() {
    const ready = Boolean(
      initialStylesReady &&
      window.__OC_TOPBAR_READY__ &&
      window.__OC_PROFILE_TABS_READY__ &&
      window.__OC_PROFILE_FILTERS_READY__ &&
      window.__OC_ADVANCED_FILTERS_READY__
    );
    if (ready || readyChecks >= 250) {
      revealCurrentShell();
      return;
    }
    readyChecks += 1;
    window.setTimeout(waitForCurrentShell, 20);
  }
  waitForCurrentShell();
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js?v=20260725-force52', {
        updateViaCache: 'none'
      });
      await registration.update();
    } catch (error) {
      console.warn('Image cache service worker registration failed', error);
    }
  });
}
