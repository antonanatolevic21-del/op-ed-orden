(() => {
  const frame = document.querySelector('#oc-admin-workspace');
  const status = document.querySelector('#oc-admin-shell-status');
  const loading = document.querySelector('#oc-admin-shell-loading');
  const buttons = [...document.querySelectorAll('[data-admin-view]')];
  const qualityButton = buttons.find(button => button.dataset.adminView === 'quality');
  let activeView = 'workspace';
  let qualityRequest = 0;
  let accessObserver = null;
  let accessTimer = 0;

  function frameParts() {
    try {
      return { win: frame.contentWindow, doc: frame.contentDocument };
    } catch (_) {
      return { win: null, doc: null };
    }
  }

  function isAdmin() {
    const { doc } = frameParts();
    const badge = doc?.querySelector('#oc-access-badge');
    return Boolean(
      badge &&
      badge.classList.contains('admin') &&
      String(badge.textContent || '').trim().toLocaleLowerCase('ru') === 'админ'
    );
  }

  function setStatus(message, state = '') {
    status.textContent = message;
    status.classList.toggle('is-admin', state === 'admin');
    status.classList.toggle('is-error', state === 'error');
  }

  function syncAccess() {
    const admin = isAdmin();
    qualityButton.disabled = !admin;
    qualityButton.title = admin ? '' : 'Сначала войдите под админским аккаунтом в рабочей области';
    setStatus(
      admin ? 'Админский доступ подтверждён' : 'Войдите под админским аккаунтом в рабочей области',
      admin ? 'admin' : ''
    );
    if (!admin && activeView === 'quality') void showWorkspace();
  }

  function setActiveButton(view) {
    buttons.forEach(button => {
      const active = button.dataset.adminView === view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function ensureCatalogWorkspace(doc) {
    if (!doc) return;
    doc.documentElement.classList.add('oc-admin-catalog-route');
    if (doc.querySelector('#oc-admin-catalog-route-style')) return;
    const style = doc.createElement('style');
    style.id = 'oc-admin-catalog-route-style';
    style.textContent = `
      html.oc-admin-catalog-route .oc-tabs,
      html.oc-admin-catalog-route #oc-profile-panel,
      html.oc-admin-catalog-route #oc-top100-panel,
      html.oc-admin-catalog-route #oc-season-panel,
      html.oc-admin-catalog-route #oc-tier-panel,
      html.oc-admin-catalog-route #oc-stats-panel,
      html.oc-admin-catalog-route [data-welcome-action="profile"],
      html.oc-admin-catalog-route [data-welcome-action="season"],
      html.oc-admin-catalog-route #oc-quality-center-btn,
      html.oc-admin-catalog-route .oc-admin-panel-link {
        display: none !important;
      }
    `;
    doc.head.append(style);
  }

  function showCatalogPage() {
    const { doc } = frameParts();
    ensureCatalogWorkspace(doc);
    const mainPanel = doc?.querySelector('#oc-main-panel');
    if (mainPanel?.classList.contains('hidden')) {
      doc.querySelector('.oc-tab-btn[data-tab="chart"]')?.click();
    }
  }

  function ensureQualityRouteStyle(doc) {
    if (!doc || doc.querySelector('#oc-admin-quality-route-style')) return;
    const style = doc.createElement('style');
    style.id = 'oc-admin-quality-route-style';
    style.textContent = `
      html.oc-admin-quality-route .oc-quality-modal {
        padding: 18px !important;
        background: #0b0a10 !important;
        backdrop-filter: none !important;
      }
      html.oc-admin-quality-route .oc-quality-dialog {
        width: min(1240px, 100%) !important;
        max-height: calc(100vh - 28px) !important;
      }
      html.oc-admin-quality-route .oc-quality-close[data-quality-close] {
        display: none !important;
      }
    `;
    doc.head.append(style);
  }

  function forceCloseQuality() {
    const { win, doc } = frameParts();
    doc?.documentElement.classList.remove('oc-admin-quality-route');
    if (win) win.dispatchEvent(new win.CustomEvent('oped-close-quality'));
  }

  async function waitForQualityModule(requestId) {
    const startedAt = Date.now();
    while (requestId === qualityRequest && Date.now() - startedAt < 10000) {
      const { win } = frameParts();
      if (win?.__OC_QUALITY_CENTER_READY__) return win;
      if (win) win.dispatchEvent(new win.CustomEvent('oped-account-restored'));
      await new Promise(resolve => window.setTimeout(resolve, 120));
    }
    return null;
  }

  async function showWorkspace() {
    qualityRequest += 1;
    activeView = 'workspace';
    setActiveButton(activeView);
    loading.classList.add('hidden');
    forceCloseQuality();
    showCatalogPage();
  }

  async function showQuality() {
    if (!isAdmin()) {
      syncAccess();
      return;
    }
    const requestId = ++qualityRequest;
    activeView = 'quality';
    setActiveButton(activeView);
    loading.classList.remove('hidden');
    const { doc } = frameParts();
    ensureQualityRouteStyle(doc);
    doc?.documentElement.classList.add('oc-admin-quality-route');

    const win = await waitForQualityModule(requestId);
    if (!win || requestId !== qualityRequest) return;
    loading.classList.add('hidden');
    win.dispatchEvent(new win.CustomEvent('oped-open-quality'));
  }

  function observeAccess() {
    accessObserver?.disconnect();
    window.clearInterval(accessTimer);
    const { doc } = frameParts();
    const badge = doc?.querySelector('#oc-access-badge');
    if (badge) {
      accessObserver = new MutationObserver(syncAccess);
      accessObserver.observe(badge, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
        attributeFilter: ['class']
      });
    }
    accessTimer = window.setInterval(syncAccess, 1000);
    syncAccess();
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    if (button.dataset.adminView === 'quality') void showQuality();
    else void showWorkspace();
  }));

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'oped-admin-open-track') void showWorkspace();
  });

  function handleFrameLoad() {
    forceCloseQuality();
    showCatalogPage();
    observeAccess();
    if (activeView === 'quality') void showQuality();
  }

  frame.addEventListener('load', handleFrameLoad);
  if (frame.contentDocument?.readyState === 'complete') handleFrameLoad();

  setActiveButton(activeView);
})();
