(() => {
  const version = '20260724-album-dim-frame1';
  const topbarVersion = '20260724-topbar4';
  const profileTabsVersion = '20260724-profile-tabs3';
  const profileFiltersVersion = '20260724-profile-filters2';
  const filterChipsVersion = '20260724-filter-chips2';
  const deepLinksVersion = '20260725-deep-links2';
  const statsLiteVersion = '20260724-stats-lite3';
  const qualityVersion = '20260724-quality2';
  const hotkeysVersion = '20260725-hotkeys4';
  const accountSyncVersion = '20260725-account-sync3';
  const uxVersion = '20260724-uxpack5';
  const seasonFillVersion = '20260725-season-fill2';
  const manualTopInsertVersion = '20260725-manual-top-insert3';

  const filterUiStylesheet = document.createElement('link');
  filterUiStylesheet.rel = 'stylesheet';
  filterUiStylesheet.href = `./filter-ui-fixes.css?v=${version}`;
  document.head.append(filterUiStylesheet);

  const albumStylesheet = document.createElement('link');
  albumStylesheet.rel = 'stylesheet';
  albumStylesheet.href = `./entity-album-cards.css?v=${version}`;
  document.head.append(albumStylesheet);

  const topbarStylesheet = document.createElement('link');
  topbarStylesheet.rel = 'stylesheet';
  topbarStylesheet.href = `./topbar.css?v=${topbarVersion}`;
  document.head.append(topbarStylesheet);

  const profileTabsStylesheet = document.createElement('link');
  profileTabsStylesheet.rel = 'stylesheet';
  profileTabsStylesheet.href = `./profile-tabs.css?v=${profileTabsVersion}`;
  document.head.append(profileTabsStylesheet);

  const profileFiltersStylesheet = document.createElement('link');
  profileFiltersStylesheet.rel = 'stylesheet';
  profileFiltersStylesheet.href = `./profile-filters.css?v=${profileFiltersVersion}`;
  document.head.append(profileFiltersStylesheet);

  const filterChipsStylesheet = document.createElement('link');
  filterChipsStylesheet.rel = 'stylesheet';
  filterChipsStylesheet.href = `./active-filter-chips.css?v=${filterChipsVersion}`;
  document.head.append(filterChipsStylesheet);

  const statsLiteStylesheet = document.createElement('link');
  statsLiteStylesheet.rel = 'stylesheet';
  statsLiteStylesheet.href = `./stats-lite.css?v=${statsLiteVersion}`;
  document.head.append(statsLiteStylesheet);

  const qualityStylesheet = document.createElement('link');
  qualityStylesheet.rel = 'stylesheet';
  qualityStylesheet.href = `./quality-center.css?v=${qualityVersion}`;
  document.head.append(qualityStylesheet);

  const hotkeysStylesheet = document.createElement('link');
  hotkeysStylesheet.rel = 'stylesheet';
  hotkeysStylesheet.href = `./keyboard-shortcuts.css?v=${hotkeysVersion}`;
  document.head.append(hotkeysStylesheet);

  ['advanced-filters.css', 'skeleton-loading.css', 'toast.css', 'accessibility.css'].forEach(file => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `./${file}?v=${uxVersion}`;
    document.head.append(stylesheet);
  });

  const seasonFillStylesheet = document.createElement('link');
  seasonFillStylesheet.rel = 'stylesheet';
  seasonFillStylesheet.href = `./season-quality-fill.css?v=${seasonFillVersion}`;
  document.head.append(seasonFillStylesheet);

  const manualTopInsertStylesheet = document.createElement('link');
  manualTopInsertStylesheet.rel = 'stylesheet';
  manualTopInsertStylesheet.href = `./manual-top-insert.css?v=${manualTopInsertVersion}`;
  document.head.append(manualTopInsertStylesheet);

  const entityProgressScript = document.createElement('script');
  entityProgressScript.src = `./entity-progress-refresh.js?v=${version}`;
  document.body.append(entityProgressScript);

  const topbarScript = document.createElement('script');
  topbarScript.src = `./topbar.js?v=${topbarVersion}`;
  topbarScript.defer = true;
  document.body.append(topbarScript);

  const profileTabsScript = document.createElement('script');
  profileTabsScript.src = `./profile-tabs.js?v=${profileTabsVersion}`;
  profileTabsScript.defer = true;
  document.body.append(profileTabsScript);

  const profileFiltersScript = document.createElement('script');
  profileFiltersScript.src = `./profile-filters.js?v=${profileFiltersVersion}`;
  profileFiltersScript.defer = true;
  document.body.append(profileFiltersScript);

  const filterChipsScript = document.createElement('script');
  filterChipsScript.src = `./active-filter-chips.js?v=${filterChipsVersion}`;
  filterChipsScript.defer = true;
  document.body.append(filterChipsScript);

  const accountSyncScript = document.createElement('script');
  accountSyncScript.src = `./account-sync.js?v=${accountSyncVersion}`;
  accountSyncScript.async = false;
  document.body.append(accountSyncScript);

  const deepLinksScript = document.createElement('script');
  deepLinksScript.src = `./deep-links.js?v=${deepLinksVersion}`;
  deepLinksScript.async = false;
  document.body.append(deepLinksScript);

  const statsLiteScript = document.createElement('script');
  statsLiteScript.src = `./stats-lite.js?v=${statsLiteVersion}`;
  statsLiteScript.defer = true;
  document.body.append(statsLiteScript);

  const qualityScript = document.createElement('script');
  qualityScript.src = `./quality-center.js?v=${qualityVersion}`;
  qualityScript.defer = true;
  document.body.append(qualityScript);

  const hotkeysScript = document.createElement('script');
  hotkeysScript.src = `./keyboard-shortcuts.js?v=${hotkeysVersion}`;
  hotkeysScript.async = false;
  document.body.append(hotkeysScript);

  ['catalog-cache.js', 'season-quality-fill.js', 'toast.js', 'manual-top-insert.js', 'skeleton-loading.js', 'advanced-filters.js', 'undo-actions.js', 'accessibility.js'].forEach(file => {
    const script = document.createElement('script');
    if (file === 'season-quality-fill.js') script.src = `./${file}?v=${seasonFillVersion}`;
    else if (file === 'manual-top-insert.js') script.src = `./${file}?v=${manualTopInsertVersion}`;
    else script.src = `./${file}?v=${uxVersion}`;
    script.async = false;
    document.body.append(script);
  });

  if (document.querySelector('.oc-addbar')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `./track-add-panel.css?v=${version}`;
    document.head.append(stylesheet);

    const script = document.createElement('script');
    script.src = `./track-add-panel.js?v=${version}`;
    document.body.append(script);
  }
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js?v=20260725-force27', {
        updateViaCache: 'none'
      });
      await registration.update();
    } catch (error) {
      console.warn('Image cache service worker registration failed', error);
    }
  });
}
