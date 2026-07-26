(() => {
  if (window.__OC_ACCOUNT_SYNC_READY__) return;

  const PRIMARY_NAME_KEY = 'op-ed-primary-account-name';
  const EVENT_NAME_KEY = 'my-display-name';
  const MAIN_ACCESS_KEY = 'op-ed-access-level';
  const EVENT_ACCESS_KEY = 'event-access-level';
  const PROFILE_CACHE_KEY = 'op-ed-auth-profile-v1';
  const ACCOUNT_MODAL_SELECTOR = '#oc-auth-modal,#oc-register-modal,#oc-name-modal';

  let authBound = false;
  let initialReady = false;
  let personalUid = '';
  let userIntentUntil = 0;
  const startupGuardUntil = Date.now() + 15000;
  let resolveAccountReady;

  window.__OC_ACCOUNT_RESTORE_DONE__ = false;
  window.OC_ACCOUNT_READY = new Promise(resolve => { resolveAccountReady = resolve; });

  function clean(value) {
    return String(value || '').trim();
  }

  function mirrorName(name) {
    const value = clean(name);
    if (!value) return;
    if (localStorage.getItem(PRIMARY_NAME_KEY) !== value) localStorage.setItem(PRIMARY_NAME_KEY, value);
    if (localStorage.getItem(EVENT_NAME_KEY) !== value) localStorage.setItem(EVENT_NAME_KEY, value);
  }

  function cachedProfileName(uid) {
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const cached = JSON.parse(storage.getItem(PROFILE_CACHE_KEY) || 'null');
        if (cached?.uid !== uid || !cached.profile) continue;
        return clean(cached.profile.nickname || cached.profile.nicknameKey || cached.profile.id);
      } catch (_) {}
    }
    return '';
  }

  async function accessForUser(user) {
    try {
      const module = await import('./firebase-config.js');
      const admins = new Set((module.adminUids || []).map(String));
      return admins.has(String(user?.uid || '')) ? 'admin' : 'user';
    } catch (error) {
      console.warn('Could not verify admin role during account restore', error);
      return 'user';
    }
  }

  function finishInitial(authenticated) {
    const detail = { authenticated: Boolean(authenticated), uid: personalUid };
    if (!initialReady) {
      initialReady = true;
      window.__OC_ACCOUNT_RESTORE_DONE__ = true;
      resolveAccountReady?.(detail);
    }
    window.dispatchEvent(new CustomEvent('oped-account-restored', { detail }));
  }

  function hasRecentUserIntent() {
    return Date.now() <= userIntentUntil;
  }

  function markUserIntent() {
    userIntentUntil = Date.now() + 6000;
  }

  function hideUnexpectedAccountModals() {
    if (!personalUid || Date.now() > startupGuardUntil || hasRecentUserIntent()) return;
    document.querySelectorAll(ACCOUNT_MODAL_SELECTOR).forEach(modal => {
      if (!modal.classList.contains('hidden')) modal.classList.add('hidden');
    });
  }

  function suppressRestoreStatus() {
    if (!personalUid || Date.now() > startupGuardUntil || hasRecentUserIntent()) return;
    const status = document.querySelector('#oc-status');
    if (status && /^Вход выполнен:/i.test(clean(status.textContent))) status.textContent = '';
  }

  function bindStartupGuards() {
    document.addEventListener('pointerdown', event => {
      if (event.target?.closest?.('#oc-access-badge,#oc-auth-register-open,#oc-auth-save,#oc-modal-name-save,#oc-register-save')) markUserIntent();
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target?.closest?.('#oc-auth-modal,#oc-register-modal,#oc-name-modal')) markUserIntent();
    }, true);

    document.querySelectorAll(ACCOUNT_MODAL_SELECTOR).forEach(modal => {
      new MutationObserver(hideUnexpectedAccountModals).observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    const status = document.querySelector('#oc-status');
    if (status) new MutationObserver(suppressRestoreStatus).observe(status, { childList: true, characterData: true, subtree: true });
  }

  async function applyUser(user) {
    if (!user || user.isAnonymous) {
      personalUid = '';
      sessionStorage.removeItem(MAIN_ACCESS_KEY);
      if (localStorage.getItem(EVENT_ACCESS_KEY) !== 'guest') localStorage.removeItem(EVENT_ACCESS_KEY);
      finishInitial(false);
      return;
    }

    personalUid = clean(user.uid);
    const level = await accessForUser(user);
    const name = clean(user.displayName) || cachedProfileName(personalUid)
      || clean(localStorage.getItem(PRIMARY_NAME_KEY)) || clean(localStorage.getItem(EVENT_NAME_KEY));

    mirrorName(name);
    sessionStorage.setItem(MAIN_ACCESS_KEY, level);
    if (localStorage.getItem(EVENT_ACCESS_KEY) !== 'guest') localStorage.setItem(EVENT_ACCESS_KEY, level);
    finishInitial(true);

    hideUnexpectedAccountModals();
    suppressRestoreStatus();
    [0, 150, 500, 1200, 3000].forEach(delay => window.setTimeout(() => {
      hideUnexpectedAccountModals();
      suppressRestoreStatus();
    }, delay));
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
        else finishInitial(false);
        return;
      }

      const auth = getAuth(getApp());
      if (typeof auth.authStateReady === 'function') await auth.authStateReady();
      authBound = true;
      await applyUser(auth.currentUser);
      onAuthStateChanged(auth, user => { void applyUser(user); });
    } catch (error) {
      authBound = false;
      console.warn('Account sync skipped', error);
      if (attempt < 10) window.setTimeout(() => bindAuth(attempt + 1), 250);
      else finishInitial(false);
    }
  }

  function init() {
    bindStartupGuards();
    void bindAuth();
  }

  window.addEventListener('storage', event => {
    if ((event.key === PRIMARY_NAME_KEY || event.key === EVENT_NAME_KEY) && personalUid) mirrorName(event.newValue);
  });
  window.addEventListener('oped-db-ready', () => void bindAuth());

  window.__OC_ACCOUNT_SYNC_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
