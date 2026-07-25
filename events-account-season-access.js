import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { adminUids } from './firebase-config.js';

(() => {
  if (window.__OC_EVENT_ACCOUNT_SEASON_ACCESS_READY__) return;
  window.__OC_EVENT_ACCOUNT_SEASON_ACCESS_READY__ = true;

  const CURRENT_EVENT_YEAR = 2026;
  const NAME_KEY = 'my-display-name';
  const ACCOUNT_PROFILE_CACHE_KEY = 'op-ed-auth-profile-v1';
  const ADMIN_UIDS = new Set((adminUids || []).map(String));
  const SEASON_ORDER = ['winter', 'spring', 'summer', 'fall'];
  let lastAppliedKey = '';
  let running = false;

  const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const normalizeNickname = nickname => String(nickname || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9_-]+/gi, '_')
    .slice(0, 60);

  async function waitForFirebaseApp() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (getApps().length) return getApp();
      await sleep(50);
    }
    return null;
  }

  function cachedProfileName(uid) {
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const cached = JSON.parse(storage.getItem(ACCOUNT_PROFILE_CACHE_KEY) || 'null');
        if (cached?.uid !== uid || !cached.profile) continue;
        const name = String(cached.profile.nickname || cached.profile.nicknameKey || cached.profile.id || '').trim();
        if (name) return name;
      } catch (_) {}
    }
    return '';
  }

  async function registeredNickname(user, db) {
    const cached = cachedProfileName(user.uid);
    if (cached) return cached;
    const displayName = String(user.displayName || '').trim();
    if (displayName) return displayName;

    try {
      const snapshot = await getDocs(query(collection(db, 'userProfiles'), where('authUid', '==', user.uid), limit(1)));
      const profile = snapshot.docs[0];
      if (!profile) return '';
      const row = profile.data() || {};
      return String(row.nickname || row.nicknameKey || profile.id || '').trim();
    } catch (error) {
      console.warn('Could not resolve registered event participant nickname', error);
      return '';
    }
  }

  async function matchingGuestSlot(db, nickname) {
    const key = normalizeNickname(nickname);
    if (!key) return 0;
    try {
      const snapshot = await getDocs(collection(db, 'eventSeasons'));
      const rows = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .filter(row => Number(row.year || CURRENT_EVENT_YEAR) === CURRENT_EVENT_YEAR && !row.closed)
        .sort((a, b) => SEASON_ORDER.indexOf(String(a.season || '')) - SEASON_ORDER.indexOf(String(b.season || '')));

      for (const row of rows) {
        const slots = Array.isArray(row.allowedNicknames) ? row.allowedNicknames : [];
        const index = slots.findIndex(name => normalizeNickname(name) === key);
        if (index >= 0 && index < 15) return index + 1;
      }
    } catch (error) {
      console.warn('Could not check season participant access', error);
    }
    return 0;
  }

  async function waitForEventShell(nickname) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const save = document.querySelector('#ev-auth-save');
      const pass = document.querySelector('#ev-auth-pass');
      const name = document.querySelector('#ev-myname');
      const badge = document.querySelector('#ev-access-badge');
      if (save && pass && name && badge) {
        const badgeText = String(badge.textContent || '').trim().toLowerCase();
        const inputName = String(name.value || '').trim();
        if (badgeText.includes('участник') || normalizeNickname(inputName) === normalizeNickname(nickname)) {
          return { save, pass, name, badge };
        }
      }
      await sleep(50);
    }
    return null;
  }

  async function grantSeasonGuestAccess(user) {
    if (running || !user || user.isAnonymous || ADMIN_UIDS.has(String(user.uid || ''))) return;
    running = true;
    try {
      const app = getApps().length ? getApp() : await waitForFirebaseApp();
      if (!app) return;
      const db = getFirestore(app);
      const nickname = await registeredNickname(user, db);
      if (!nickname) return;
      const slot = await matchingGuestSlot(db, nickname);
      if (!slot) return;

      const grantKey = `${user.uid}:${normalizeNickname(nickname)}:${slot}`;
      if (lastAppliedKey === grantKey) return;

      const shell = await waitForEventShell(nickname);
      if (!shell) return;
      const currentBadge = String(shell.badge.textContent || '').trim().toLowerCase();
      if (currentBadge.includes(`гость #${String(slot).padStart(2, '0')}`)) {
        lastAppliedKey = grantKey;
        return;
      }

      localStorage.setItem(NAME_KEY, nickname);
      if (String(shell.name.value || '').trim() !== nickname) {
        shell.name.value = nickname;
        shell.name.dispatchEvent(new Event('input', { bubbles: true }));
      }

      shell.pass.value = `235-64-${String(slot).padStart(2, '0')}`;
      shell.save.click();
      lastAppliedKey = grantKey;
    } finally {
      running = false;
    }
  }

  async function start() {
    const app = await waitForFirebaseApp();
    if (!app) return;
    const auth = getAuth(app);
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    if (auth.currentUser) void grantSeasonGuestAccess(auth.currentUser);
    onAuthStateChanged(auth, user => {
      if (user && !user.isAnonymous) window.setTimeout(() => void grantSeasonGuestAccess(user), 120);
    });
  }

  void start();
})();
