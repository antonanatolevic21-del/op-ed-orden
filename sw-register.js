(() => {
  const primaryVersion = '20260725-primary-shell1';
  const deepLinksVersion = '20260725-deep-links2';
  const accountSyncVersion = '20260725-account-sync3';
  const seasonFillVersion = '20260725-season-fill2';
  const manualTopInsertVersion = '20260725-manual-top-insert4';
  const manualTopInsertFixVersion = '20260725-manual-top-insert-fix4';

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
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `./${file}?v=${version}`;
    document.head.append(stylesheet);
    return stylesheet;
  }

  function addScript(file, version = primaryVersion, ordered = false) {
    const script = document.createElement('script');
    script.src = `./${file}?v=${version}`;
    if (ordered) script.async = false;
    document.body.append(script);
    return script;
  }

  [
    'filter-ui-fixes.css',
    'entity-album-cards.css',
    'topbar.css',
    'profile-tabs.css',
    'profile-filters.css',
    'active-filter-chips.css',
    'stats-lite.css',
    'quality-center.css',
    'keyboard-shortcuts.css',
    'advanced-filters.css',
    'skeleton-loading.css',
    'toast.css',
    'accessibility.css'
  ].forEach(file => addStyle(file));
  addStyle('season-quality-fill.css', seasonFillVersion);
  addStyle('manual-top-insert.css', manualTopInsertVersion);
  addStyle('profile-top-single.css');
  addStyle('profile-top-layout-fixes.css');
  addStyle('manual-top-insert-fix.css', manualTopInsertFixVersion);

  addScript('entity-progress-refresh.js');
  addScript('topbar.js', primaryVersion, true);
  addScript('profile-tabs.js', primaryVersion, true);
  addScript('profile-filters.js', primaryVersion, true);
  addScript('active-filter-chips.js', primaryVersion, true);
  addScript('account-sync.js', accountSyncVersion, true);
  addScript('deep-links.js', deepLinksVersion, true);
  addScript('stats-lite.js', primaryVersion, true);
  addScript('quality-center.js', primaryVersion, true);
  addScript('keyboard-shortcuts.js', primaryVersion, true);

  [
    ['catalog-cache.js', primaryVersion],
    ['season-quality-fill.js', seasonFillVersion],
    ['toast.js', primaryVersion],
    ['profile-top-single.js', primaryVersion],
    ['manual-top-insert-fast.js', manualTopInsertVersion],
    ['manual-top-insert-fix.js', manualTopInsertFixVersion],
    ['skeleton-loading.js', primaryVersion],
    ['advanced-filters.js', primaryVersion],
    ['undo-actions.js', primaryVersion],
    ['accessibility.js', primaryVersion]
  ].forEach(([file, version]) => addScript(file, version, true));

  if (document.querySelector('.oc-addbar')) {
    addStyle('track-add-panel.css');
    addScript('track-add-panel.js', primaryVersion, true);
  }

  function revealCurrentShell() {
    if (!document.documentElement.classList.contains('oc-primary-booting')) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove('oc-primary-booting');
      boot.remove();
      bootStyle.remove();
    }));
  }

  let readyChecks = 0;
  function waitForCurrentShell() {
    const ready = Boolean(
      window.__OC_TOPBAR_READY__ &&
      window.__OC_PROFILE_TABS_READY__ &&
      window.__OC_PROFILE_FILTERS_READY__ &&
      window.__OC_PROFILE_TOP_SINGLE_READY__ &&
      window.__OC_ADVANCED_FILTERS_READY__
    );
    if (ready || readyChecks >= 120) {
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
      const registration = await navigator.serviceWorker.register('./sw.js?v=20260725-force38', {
        updateViaCache: 'none'
      });
      await registration.update();
    } catch (error) {
      console.warn('Image cache service worker registration failed', error);
    }
  });
}
