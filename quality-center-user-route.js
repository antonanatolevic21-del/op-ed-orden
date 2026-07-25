(() => {
  if (window.__OC_QUALITY_CENTER_USER_ROUTE_READY__) return;
  window.__OC_QUALITY_CENTER_USER_ROUTE_READY__ = true;

  const RICKROLL_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  function isAdminUi() {
    const badge = document.querySelector('#oc-access-badge');
    return Boolean(badge && badge.classList.contains('admin') && String(badge.textContent || '').trim().toLocaleLowerCase('ru') === 'админ');
  }

  function syncButton() {
    const button = document.querySelector('.oc-quality-trigger');
    if (!button) return;
    button.hidden = false;
    button.title = 'Центр качества базы';
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('.oc-quality-trigger');
    if (!button || isAdminUi()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(RICKROLL_URL);
  }, true);

  const root = document.querySelector('#opedchart-root') || document.documentElement;
  new MutationObserver(syncButton).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  [0, 100, 400, 1200, 3000].forEach(delay => window.setTimeout(syncButton, delay));
})();
