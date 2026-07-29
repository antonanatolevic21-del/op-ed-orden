(() => {
  if (window.__OC_ACCESS_ROLE_BADGE_READY__) return;
  window.__OC_ACCESS_ROLE_BADGE_READY__ = true;

  const badge = document.querySelector('#oc-access-badge');
  if (!badge) return;

  let syncing = false;

  function syncRoleBadge() {
    if (syncing) return;
    syncing = true;
    try {
      const raw = String(badge.textContent || '').trim().toLocaleLowerCase('ru');
      const isAdmin = badge.classList.contains('admin') || raw === 'админ';
      const isUser = !isAdmin && (raw === 'вход' || raw === 'юзер');

      badge.classList.toggle('oc-access-user', isUser);
      badge.classList.toggle('oc-access-guest', !isAdmin && !isUser);

      if (isUser && raw !== 'юзер') badge.textContent = 'юзер';
    } finally {
      syncing = false;
    }
  }

  new MutationObserver(syncRoleBadge).observe(badge, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    characterData: true,
    subtree: true
  });

  window.addEventListener('oped-account-restored', () => window.setTimeout(syncRoleBadge, 0));
  window.addEventListener('oped:route-change', syncRoleBadge);
  syncRoleBadge();
})();
