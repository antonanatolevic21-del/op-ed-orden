(() => {
  if (window.__OC_QUALITY_CENTER_USER_ROUTE_READY__) return;
  window.__OC_QUALITY_CENTER_USER_ROUTE_READY__ = true;

  const RICKROLL_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const catalogAdminWorkspace = window.OC_CATALOG_ADMIN_WORKSPACE === true;
  let userButton = null;
  let adminLink = null;

  function isAdminUi() {
    const badge = document.querySelector('#oc-access-badge');
    return Boolean(badge && badge.classList.contains('admin') && String(badge.textContent || '').trim().toLocaleLowerCase('ru') === 'админ');
  }

  function ensureUserButton(host) {
    if (!userButton?.isConnected) {
      userButton = document.createElement('button');
      userButton.id = 'oc-quality-user-btn';
      userButton.className = 'oc-franchise-repair-btn oc-quality-trigger';
      userButton.type = 'button';
      userButton.textContent = 'Центр качества базы';
      userButton.title = 'Центр качества базы';
      userButton.addEventListener('click', event => {
        event.preventDefault();
        window.location.assign(RICKROLL_URL);
      });
      host.append(userButton);
    }
  }

  function ensureAdminLink(host) {
    if (!adminLink?.isConnected) {
      adminLink = document.createElement('a');
      adminLink.id = 'oc-admin-panel-link';
      adminLink.className = 'oc-admin-panel-link';
      adminLink.href = 'admin.html';
      adminLink.textContent = 'Открыть админ-панель';
      host.append(adminLink);
    }
  }

  function syncRouteActions() {
    if (catalogAdminWorkspace) {
      userButton?.remove();
      adminLink?.remove();
      return;
    }
    const host = document.querySelector('.oc-topbar-admin');
    if (!host) return;
    if (isAdminUi()) {
      userButton?.remove();
      ensureAdminLink(host);
    } else {
      adminLink?.remove();
      ensureUserButton(host);
    }
  }

  const root = document.querySelector('#opedchart-root') || document.documentElement;
  new MutationObserver(syncRouteActions).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  [0, 100, 400, 1200, 3000].forEach(delay => window.setTimeout(syncRouteActions, delay));
})();
