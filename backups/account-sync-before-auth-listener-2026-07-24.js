(() => {
  if (window.__OC_ACCOUNT_SYNC_READY__) return;

  const PRIMARY_NAME_KEY = 'op-ed-primary-account-name';
  const EVENT_NAME_KEY = 'my-display-name';
  const MAIN_ACCESS_KEY = 'op-ed-access-level';
  const EVENT_ACCESS_KEY = 'event-access-level';

  function clean(value) {
    return String(value || '').trim();
  }

  function mirrorName(name) {
    const value = clean(name);
    if (!value) return;
    if (localStorage.getItem(PRIMARY_NAME_KEY) !== value) localStorage.setItem(PRIMARY_NAME_KEY, value);
    if (localStorage.getItem(EVENT_NAME_KEY) !== value) localStorage.setItem(EVENT_NAME_KEY, value);
  }

  function mirrorAccess() {
    const main = clean(sessionStorage.getItem(MAIN_ACCESS_KEY));
    const event = clean(localStorage.getItem(EVENT_ACCESS_KEY));
    if (['user', 'admin'].includes(main) && !['user', 'admin'].includes(event)) localStorage.setItem(EVENT_ACCESS_KEY, main);
    if (['user', 'admin'].includes(event) && !['user', 'admin'].includes(main)) sessionStorage.setItem(MAIN_ACCESS_KEY, event);
  }

  async function syncAuthenticatedUser() {
    try {
      const [{ getApp, getApps }, { getAuth }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js')
      ]);
      if (!getApps().length) return;
      const auth = getAuth(getApp());
      if (typeof auth.authStateReady === 'function') await auth.authStateReady();
      const user = auth.currentUser;
      if (!user || user.isAnonymous) return;
      mirrorName(user.displayName || localStorage.getItem(PRIMARY_NAME_KEY) || localStorage.getItem(EVENT_NAME_KEY));
      mirrorAccess();
    } catch (error) {
      console.warn('Account sync skipped', error);
    }
  }

  function init() {
    mirrorName(localStorage.getItem(PRIMARY_NAME_KEY) || localStorage.getItem(EVENT_NAME_KEY));
    mirrorAccess();
    window.setTimeout(syncAuthenticatedUser, 0);
  }

  window.addEventListener('storage', event => {
    if (event.key === PRIMARY_NAME_KEY || event.key === EVENT_NAME_KEY) mirrorName(event.newValue);
    if (event.key === EVENT_ACCESS_KEY) mirrorAccess();
  });

  window.addEventListener('oped-db-ready', syncAuthenticatedUser);
  window.__OC_ACCOUNT_SYNC_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
