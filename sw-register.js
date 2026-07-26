(() => {
  const primaryVersion = '20260726-progressive-shell1';
  const deepLinksVersion = '20260725-deep-links2';
  const accountSyncVersion = '20260726-account-sync4';
  const seasonFillVersion = '20260725-season-fill2';
  const manualTopInsertVersion = '20260726-manual-top-insert9';
  const manualTopInsertFixVersion = '20260725-manual-top-insert-fix4';
  const top100SuiteVersion = '20260725-top100-suite2';
  const top100EditorVersion = '20260726-top100-editor-v2-1';
  const myEventsVersion = '20260726-my-events-complete1';
  const statsDesignVersion = '20260725-profile-stats-designs4';
  const adminMissingVersion = '20260726-admin-missing3';
  const firstUserFixVersion = '20260726-first-user-test2';
  const top100DragVersion = '20260726-top100-drag2';
  const modalReadabilityVersion = '20260726-modal-readability1';
  const registeredUsersVersion = '20260726-known-users4';
  const sitePolicyVersion = '20260726-site-policy2';
  const manualTopExistingMigrationVersion = '20260726-manual-top-existing-migration2';
  const profileEventsOwnershipVersion = '20260726-profile-events-owner1';
  const accessRoleBadgeVersion = '20260726-access-role-badge1';
  const adminProfilePickerVersion = '20260726-admin-profile-picker2';
  const entityAlbumEditorVersion = '20260726-entity-album-editor4';
  const top100RankReadabilityVersion = '20260726-top100-rank-readability1';
  const entityRealLinksVersion = '20260726-entity-real-links1';
  const navigationRealLinksVersion = '20260726-navigation-real-links5';
  const loadedStyles = new Map();
  const loadedScripts = new Map();
  let top100Promise = null;
  let seasonPromise = null;
  let statsPromise = null;

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

  const initialStylePromises = [
    'filter-ui-fixes.css', 'entity-album-cards.css', 'topbar.css', 'profile-tabs.css',
    'profile-filters.css', 'active-filter-chips.css', 'quality-center.css',
    'keyboard-shortcuts.css', 'advanced-filters.css', 'skeleton-loading.css',
    'toast.css', 'accessibility.css'
  ].map(file => addStyle(file, ['quality-center.css', 'keyboard-shortcuts.css'].includes(file) ? modalReadabilityVersion : primaryVersion));
  initialStylePromises.push(addStyle('my-events-profile.css', myEventsVersion));
  initialStylePromises.push(addStyle('profile-stats-designs.css', statsDesignVersion));
  initialStylePromises.push(addStyle('admin-missing-inline.css', adminMissingVersion));
  initialStylePromises.push(addStyle('first-user-test-fixes.css', firstUserFixVersion));
  initialStylePromises.push(addStyle('access-role-badge.css', accessRoleBadgeVersion));
  initialStylePromises.push(addStyle('admin-profile-picker.css', adminProfilePickerVersion));
  initialStylePromises.push(addStyle('entity-album-editor.css', entityAlbumEditorVersion));
  initialStylePromises.push(addStyle('top100-rank-readability.css', top100RankReadabilityVersion));
  initialStylePromises.push(addStyle('entity-real-links.css', entityRealLinksVersion));
  initialStylePromises.push(addStyle('navigation-real-links.css', navigationRealLinksVersion));
  void Promise.all(initialStylePromises).catch(error => console.warn('Background style load failed', error));

  void addScriptsOrdered([
    ['navigation-real-links.js', navigationRealLinksVersion],
    ['account-sync.js', accountSyncVersion],
    ['manual-top-existing-migration.js', manualTopExistingMigrationVersion],
    ['site-policy.js', sitePolicyVersion],
    ['entity-progress-refresh.js', primaryVersion],
    ['entity-album-editor.js', entityAlbumEditorVersion],
    ['entity-real-links.js', entityRealLinksVersion],
    ['top100-rank-readability.js', top100RankReadabilityVersion],
    ['topbar.js', primaryVersion],
    ['profile-tabs.js', primaryVersion],
    ['profile-stats-designs.js', statsDesignVersion],
    ['profile-filters.js', primaryVersion],
    ['active-filter-chips.js', primaryVersion],
    ['access-role-badge.js', accessRoleBadgeVersion],
    ['profile-events-ownership.js', profileEventsOwnershipVersion],
    ['first-user-test-fixes.js', firstUserFixVersion],
    ['registered-users-only.js', registeredUsersVersion],
    ['admin-profile-picker.js', adminProfilePickerVersion],
    ['admin-missing-inline.js', adminMissingVersion],
    ['my-events-profile.js', myEventsVersion],
    ['deep-links.js', deepLinksVersion],
    ['quality-center.js', primaryVersion],
    ['quality-center-user-route.js', firstUserFixVersion],
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
    addStyle('top100-drag.css', top100DragVersion);
    top100Promise = addScriptsOrdered([
      ['catalog-cache.js', primaryVersion],
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
    seasonPromise = addScriptsOrdered([
      ['catalog-cache.js', primaryVersion],
      ['season-quality-fill.js', seasonFillVersion]
    ]).catch(error => { console.error('Season package load failed', error); throw error; });
    return seasonPromise;
  }

  function loadStatsPackage() {
    if (statsPromise) return statsPromise;
    addStyle('stats-lite.css', primaryVersion);
    statsPromise = addScript('stats-lite.js', primaryVersion, true).catch(error => { console.error('Stats-lite package load failed', error); throw error; });
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
    new MutationObserver(() => { if (profile.dataset.profileView === 'top100') void loadTop100Package(); })
      .observe(profile, { attributes: true, attributeFilter: ['data-profile-view'] });
  }

  function detectCurrentLazyView() {
    if (profile?.dataset.profileView === 'top100' && !profile.classList.contains('hidden')) void loadTop100Package();
    if (document.querySelector('.oc-tab-btn[data-tab="season"]')?.classList.contains('active')) void loadSeasonPackage();
    if (document.querySelector('.oc-tab-btn[data-tab="stats"]')?.classList.contains('active')) void loadStatsPackage();
  }
  window.setTimeout(detectCurrentLazyView, 100);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js?v=20260726-force54', { updateViaCache: 'none' });
        await registration.update();
      } catch (error) { console.warn('Image cache service worker registration failed', error); }
    });
  }
})();