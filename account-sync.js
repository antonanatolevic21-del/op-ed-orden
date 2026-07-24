(() => {
  if (window.__OC_ACCOUNT_SYNC_READY__) return;

  const PRIMARY_NAME_KEY = 'op-ed-primary-account-name';
  const EVENT_NAME_KEY = 'my-display-name';
  const MAIN_ACCESS_KEY = 'op-ed-access-level';
  const EVENT_ACCESS_KEY = 'event-access-level';
  let authBound = false;

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
    if (event === 'guest') return;
    if (['user', 'admin'].includes(main) && !event) localStorage.setItem(EVENT_ACCESS_KEY, main);
    if (['user', 'admin'].includes(event) && !['user', 'admin'].includes(main)) sessionStorage.setItem(MAIN_ACCESS_KEY, event);
  }

  function applyUser(user) {
    if (!user || user.isAnonymous) return;
    mirrorName(user.displayName || localStorage.getItem(PRIMARY_NAME_KEY) || localStorage.getItem(EVENT_NAME_KEY));
    mirrorAccess();
  }

  async function bindAuth(attempt = 0) {
    if (authBound) return;
    try {
      const [{ getApp, getApps }, { getAuth, onAuthStateChanged }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js')
      ]);
      if (!getApps().length) {
        if (attempt < 50) window.setTimeout(() => bindAuth(attempt + 1), 100);
        return;
      }
      const auth = getAuth(getApp());
      authBound = true;
      if (typeof auth.authStateReady === 'function') await auth.authStateReady();
      applyUser(auth.currentUser);
      onAuthStateChanged(auth, applyUser);
    } catch (error) {
      console.warn('Account sync skipped', error);
      if (attempt < 10) window.setTimeout(() => bindAuth(attempt + 1), 250);
    }
  }

  function init() {
    mirrorName(localStorage.getItem(PRIMARY_NAME_KEY) || localStorage.getItem(EVENT_NAME_KEY));
    mirrorAccess();
    void bindAuth();
  }

  window.addEventListener('storage', event => {
    if (event.key === PRIMARY_NAME_KEY || event.key === EVENT_NAME_KEY) mirrorName(event.newValue);
    if (event.key === EVENT_ACCESS_KEY) mirrorAccess();
  });
  window.addEventListener('oped-db-ready', () => void bindAuth());

  window.__OC_ACCOUNT_SYNC_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
