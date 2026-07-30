(() => {
  const primaryVersion = '20260730-natural-sort1';
  const discoveryVersion = '20260730-staged-duel1';
  const catalogAdminWorkspace = window.OC_CATALOG_ADMIN_WORKSPACE === true;
  const seasonFillVersion = '20260730-natural-sort1';
  const manualTopInsertVersion = '20260726-manual-top-insert13';
  const manualTopInsertFixVersion = '20260725-manual-top-insert-fix4';
  const top100SuiteVersion = '20260725-top100-suite2';
  const top100EditorVersion = '20260730-natural-sort1';
  const top100DragVersion = '20260726-top100-drag2';
  const loadedStyles = new Map();
  const loadedScripts = new Map();
  const seasonOrder = ['winter', 'spring', 'summer', 'fall'];
  let top100Promise = null;
  let seasonPromise = null;
  let statsPromise = null;
  let profilePromise = null;
  let entityPromise = null;
  let discoveryPromise = null;
  let adminPromise = null;
  let preserveNextTierRoute = false;
  let tierDefaultTimer = 0;

  document.documentElement.classList.remove('oc-primary-booting');
  document.documentElement.classList.add('oc-primary-ready', 'oc-primary-progressive');
  document.querySelector('#oc-primary-boot')?.remove();

  function addStyle(file, version = primaryVersion) {
    const key = `${file}?v=${version}`;
    if (loadedStyles.has(key)) return loadedStyles.get(key);
    const promise = new Promise(resolve => {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = `./${key}`;
      stylesheet.onload = () => resolve(stylesheet);
      stylesheet.onerror = () => { console.warn(`Не удалось загрузить ${file}`); resolve(stylesheet); };
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

  void addScript('primary-enhancements.js', primaryVersion, true)
    .catch(error => console.error('Primary UI bundle load failed', error))
    .finally(() => document.documentElement.classList.remove('oc-enhancements-loading'));

  ['oc-f-score-cmp', 'oc-p-score-cmp'].forEach(id => {
    const option = document.querySelector(`#${id} option[value="="]`);
    if (option) option.textContent = '>=';
  });

  if (catalogAdminWorkspace && document.querySelector('.oc-addbar')) {
    addStyle('track-add-panel.css');
    void addScript('track-add-panel.js', '20260729-last-title1', true);
  }

  function loadTop100Package() {
    if (top100Promise) return top100Promise;
    document.documentElement.classList.add('oc-top100-loading');
    addStyle('manual-top-insert.css', manualTopInsertVersion);
    addStyle('manual-top-insert-wide.css', manualTopInsertVersion);
    addStyle('profile-top-single.css', top100SuiteVersion);
    addStyle('profile-top-layout-fixes.css', top100SuiteVersion);
    addStyle('manual-top-insert-fix.css', manualTopInsertFixVersion);
    addStyle('top100-suite.css', top100SuiteVersion);
    addStyle('top100-drag.css', top100DragVersion);
    addStyle('top100-rank-readability.css', primaryVersion);
    top100Promise = addScriptsOrdered([
      ['catalog-cache.js', primaryVersion],
      ['top100-rank-readability.js', primaryVersion],
      ['profile-top-single.js', top100SuiteVersion],
      ['top100-editor-v2.js', top100EditorVersion],
      ['manual-top-insert-fast.js', manualTopInsertVersion]
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
    addStyle('season-navigation.css', primaryVersion);
    seasonPromise = addScriptsOrdered([
      ['catalog-cache.js', primaryVersion],
      ['season-quality-fill.js', seasonFillVersion],
      ['season-navigation.js', primaryVersion]
    ]).catch(error => { console.error('Season package load failed', error); throw error; });
    return seasonPromise;
  }

  function loadStatsPackage() {
    if (statsPromise) return statsPromise;
    addStyle('stats-lite.css', primaryVersion);
    statsPromise = addScript('stats-lite.js', primaryVersion, true).catch(error => { console.error('Stats-lite package load failed', error); throw error; });
    return statsPromise;
  }

  function loadProfilePackage() {
    if (profilePromise) return profilePromise;
    addStyle('profile-enhancements.css', primaryVersion);
    addStyle('discovery-suite.css', discoveryVersion);
    profilePromise = addScriptsOrdered([
      ['profile-enhancements.js', primaryVersion],
      ['profile-taste-comparison.js', discoveryVersion],
      ['profile-top-duel.js', discoveryVersion]
    ])
      .catch(error => {
        console.error('Profile package load failed', error);
        throw error;
      });
    return profilePromise;
  }

  function loadEntityPackage() {
    if (entityPromise) return entityPromise;
    addStyle('entity-enhancements.css', primaryVersion);
    entityPromise = addScript('entity-enhancements.js', primaryVersion, true)
      .catch(error => {
        console.error('Entity package load failed', error);
        throw error;
      });
    return entityPromise;
  }

  function loadDiscoveryPackage() {
    if (discoveryPromise) return discoveryPromise;
    addStyle('discovery-suite.css', discoveryVersion);
    addStyle('discovery-collections-album.css', discoveryVersion);
    discoveryPromise = addScriptsOrdered([
      ['discovery-suite.js', discoveryVersion],
      ['discovery-collections-album.js', discoveryVersion],
      ['discovery-collection-links.js', discoveryVersion]
    ]).catch(error => {
      console.error('Discovery package load failed', error);
      throw error;
    });
    return discoveryPromise;
  }

  function loadAdminPackage() {
    if (adminPromise) return adminPromise;
    addStyle('admin-enhancements.css', primaryVersion);
    adminPromise = addScript('admin-enhancements.js', primaryVersion, true)
      .catch(error => {
        console.error('Admin package load failed', error);
        throw error;
      });
    return adminPromise;
  }

  function maybeLoadAdminPackage() {
    if (catalogAdminWorkspace && document.querySelector('#oc-access-badge')?.classList.contains('admin')) void loadAdminPackage();
  }

  function loadRoutePackage(view) {
    const route = String(view || '');
    if (route === 'profile') void loadProfilePackage();
    if (route.startsWith('entity-')) void loadEntityPackage();
    if (route === 'top100') void loadTop100Package();
    if (route === 'season') void loadSeasonPackage();
    if (route === 'stats') void loadStatsPackage();
    if (route === 'discovery') void loadDiscoveryPackage();
  }

  function currentTierSeason() {
    const now = new Date();
    return {
      year: String(now.getFullYear()),
      season: seasonOrder[Math.max(0, Math.min(3, Math.floor(now.getMonth() / 3)))]
    };
  }

  function tierViewIsOpen() {
    const panel = document.querySelector('#oc-tier-panel');
    const activeButton = document.querySelector('.oc-tab-btn.active[data-tab="tier"]');
    const route = new URL(window.location.href).searchParams.get('view') || '';
    return Boolean(activeButton || (panel && !panel.classList.contains('hidden')) || route === 'tier');
  }

  function applyCurrentTierSeason() {
    if (!tierViewIsOpen()) return true;
    const yearSelect = document.querySelector('#oc-tier-year');
    const seasonSelect = document.querySelector('#oc-tier-season');
    if (!yearSelect || !seasonSelect) return false;

    const current = currentTierSeason();
    const hasCurrentYear = Array.from(yearSelect.options).some(option => option.value === current.year);
    if (!hasCurrentYear) return false;

    if (yearSelect.value !== current.year) {
      yearSelect.value = current.year;
      yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (seasonSelect.value !== current.season) {
      seasonSelect.value = current.season;
      seasonSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  function scheduleCurrentTierSeason(attempt = 0) {
    window.clearTimeout(tierDefaultTimer);
    tierDefaultTimer = window.setTimeout(() => {
      if (applyCurrentTierSeason() || attempt >= 20) return;
      scheduleCurrentTierSeason(attempt + 1);
    }, attempt ? 100 : 0);
  }

  function routeLazyModules(target) {
    if (target?.closest?.('[data-profile-view="top100"]')) void loadTop100Package();
    if (target?.closest?.('.oc-tab-btn[data-tab="season"]')) void loadSeasonPackage();
    if (target?.closest?.('.oc-tab-btn[data-tab="stats"]')) void loadStatsPackage();
    const routeButton = target?.closest?.('.oc-tab-btn[data-tab]');
    if (routeButton) loadRoutePackage(routeButton.dataset.tab);
    if (target?.closest?.('[data-entity-home]')) loadRoutePackage(`entity-${target.closest('[data-entity-home]').getAttribute('data-entity-home') || ''}`);
  }

  document.addEventListener('click', event => {
    routeLazyModules(event.target);
    if (event.target?.closest?.('#oc-season-tier-btn')) preserveNextTierRoute = true;
    if (event.target?.closest?.('.oc-tab-btn[data-tab="tier"]')) preserveNextTierRoute = false;
  }, true);
  const profile = document.querySelector('#oc-profile-panel');
  if (profile) {
    new MutationObserver(() => { if (profile.dataset.profileView === 'top100') void loadTop100Package(); })
      .observe(profile, { attributes: true, attributeFilter: ['data-profile-view'] });
  }

  function detectCurrentLazyView() {
    if (profile?.dataset.profileView === 'top100' && !profile.classList.contains('hidden')) void loadTop100Package();
    if (document.querySelector('.oc-tab-btn[data-tab="season"]')?.classList.contains('active')) void loadSeasonPackage();
    if (document.querySelector('.oc-tab-btn[data-tab="stats"]')?.classList.contains('active')) void loadStatsPackage();
    const view = new URL(window.location.href).searchParams.get('view') || 'chart';
    loadRoutePackage(view);
    if (view === 'tier') scheduleCurrentTierSeason();
    maybeLoadAdminPackage();
  }
  window.setTimeout(detectCurrentLazyView, 100);
  window.addEventListener('oped:route-change', event => {
    const tab = String(event?.detail?.tab || '');
    loadRoutePackage(tab);
    if (tab !== 'tier') return;
    if (preserveNextTierRoute) {
      preserveNextTierRoute = false;
      return;
    }
    scheduleCurrentTierSeason();
  });
  window.addEventListener('oped-account-restored', () => window.setTimeout(maybeLoadAdminPackage, 0));
  const accessBadge = document.querySelector('#oc-access-badge');
  if (accessBadge) new MutationObserver(maybeLoadAdminPackage).observe(accessBadge, { attributes: true, attributeFilter: ['class'] });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js?v=20260730-top100-candidates1', { updateViaCache: 'none' });
        await registration.update();
      } catch (error) { console.warn('Image cache service worker registration failed', error); }
    });
  }
})();