import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getFirestore, doc, setDoc, arrayUnion, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';

(() => {
  if (window.__OC_EVENTS_USER_LOBBIES_READY__) return;
  window.__OC_EVENTS_USER_LOBBIES_READY__ = true;

  const ACCESS_KEY = 'event-access-level';
  const GUEST_SLOT_KEY = 'event-guest-slot';
  const ADMIN_UNLOCKED_KEY = 'event-admin-unlocked';
  const ROOM_SELECTION_KEY = 'aboba-event-room-selection-v1';
  const UI_PREFS_KEY = 'aboba-events-ui-preferences-v1';
  const MODE_META = {
    bestworst: { collection: 'bestWorstRooms', prefix: 'bw' },
    codenames: { collection: 'eventCodenames', prefix: 'cn' }
  };

  let creating = false;
  let enhanceQueued = false;

  const clean = value => String(value || '').trim();
  const normalize = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const normalizeLabel = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е');

  function activeMode() {
    return document.querySelector('.ev-mode-tab.active')?.dataset.mode || '';
  }

  function currentName() {
    return clean(document.querySelector('#ev-myname')?.value || localStorage.getItem('my-display-name') || localStorage.getItem('op-ed-primary-account-name'));
  }

  function firebaseState() {
    if (!getApps().length) return null;
    const app = getApp();
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !user.uid) return null;
    return { db: getFirestore(app), user };
  }

  function isAdminBadge() {
    return normalizeLabel(document.querySelector('#ev-access-badge')?.textContent).includes('админ');
  }

  function isRegisteredUser() {
    return Boolean(firebaseState() && !isAdminBadge());
  }

  function setLocalIfChanged(key, value) {
    if (localStorage.getItem(key) !== value) localStorage.setItem(key, value);
  }

  function restoreNormalUserRole(mode = activeMode()) {
    if (!mode || mode === 'rating' || !isRegisteredUser()) return;
    setLocalIfChanged(ACCESS_KEY, 'user');
    setLocalIfChanged(GUEST_SLOT_KEY, '0');
    setLocalIfChanged(ADMIN_UNLOCKED_KEY, '0');

    const badge = document.querySelector('#ev-access-badge');
    if (badge && !isAdminBadge() && normalizeLabel(badge.textContent) !== 'пользователь') {
      badge.textContent = 'пользователь';
    }
  }

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_) {
      return {};
    }
  }

  function rememberRoom(mode, roomId) {
    const selected = readJson(ROOM_SELECTION_KEY);
    selected[mode] = roomId;
    localStorage.setItem(ROOM_SELECTION_KEY, JSON.stringify(selected));
    const prefs = readJson(UI_PREFS_KEY);
    prefs.activeMode = mode;
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  }

  function roomId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function bestWorstPayload(name, key, uid, title) {
    return {
      roomType: 'bestworst',
      title,
      gameId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'lobby',
      phase: 'lobby',
      hostKey: key,
      hostName: name,
      hostUid: uid,
      memberUids: [uid],
      settings: {
        mode: 'both', typeFilter: 'OP', perRound: 6, rounds: 5, grouping: 'none', banDraft: false,
        fromYear: '', fromSeason: 'winter', toYear: '', toSeason: 'fall', excludedEntities: [],
        content: 'all', source: 'ratings', users: [], scoreLogic: 'and',
        scoreOverallCmp: 'gte', scoreOverallValue: '', scoreSongCmp: 'gte', scoreSongValue: '',
        scoreVisualCmp: 'gte', scoreVisualValue: ''
      },
      players: [{ key, name, ownerUid: uid, ready: false }],
      spectators: [],
      rounds: [],
      currentRound: 0,
      candidateCount: 0,
      joinLocked: false,
      isPrivate: false,
      createdAtLocal: new Date().toISOString(),
      updatedAtLocal: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
  }

  function codenamesPayload(name, key, uid, title) {
    return {
      gameType: 'codenames',
      title,
      hostKey: key,
      hostName: name,
      hostUid: uid,
      memberUids: [uid],
      status: 'lobby',
      players: [],
      spectators: [],
      settings: { typeFilter: 'all', fromYear: '', fromSeason: 'winter', toYear: '', toSeason: 'fall' },
      board: [],
      clue: null,
      guessesLeft: 0,
      turn: 'red',
      winner: '',
      log: [],
      gameId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      joinLocked: false,
      isPrivate: false,
      createdAtLocal: new Date().toISOString(),
      updatedAtLocal: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
  }

  async function createLobby(mode) {
    if (creating || !MODE_META[mode]) return;
    const state = firebaseState();
    const name = currentName();
    const key = normalize(name);
    if (!state || !name || !key) {
      alert('Сначала войди в зарегистрированный аккаунт и укажи никнейм.');
      return;
    }

    const defaultTitle = `Лобби ${name}`;
    const title = clean(prompt('Название нового лобби:', defaultTitle));
    if (!title) return;

    creating = true;
    const button = document.querySelector('#ev-user-room-create');
    if (button) { button.disabled = true; button.textContent = 'Создаю…'; }
    try {
      restoreNormalUserRole(mode);
      const meta = MODE_META[mode];
      const id = roomId(meta.prefix);
      const payload = mode === 'bestworst'
        ? bestWorstPayload(name, key, state.user.uid, title)
        : codenamesPayload(name, key, state.user.uid, title);

      await setDoc(doc(state.db, meta.collection, id), payload);
      await setDoc(doc(state.db, meta.collection, 'current'), {
        roomIds: arrayUnion(id),
        registryUpdatedAt: serverTimestamp()
      }, { merge: true });
      rememberRoom(mode, id);
      window.location.reload();
    } catch (error) {
      console.error('Registered user lobby creation failed', error);
      alert(`Не удалось создать лобби: ${error?.message || error}`);
      if (button) { button.disabled = false; button.textContent = 'Создать новое лобби'; }
      creating = false;
    }
  }

  function enhanceRoomBrowser() {
    const mode = activeMode();
    restoreNormalUserRole(mode);
    if (!isRegisteredUser() || !MODE_META[mode]) return;
    const browser = document.querySelector('#ev-app .ev-room-browser');
    const head = browser?.querySelector('.ev-panel-head');
    if (!browser || !head || head.querySelector('#ev-room-create, #ev-user-room-create')) return;

    const button = document.createElement('button');
    button.id = 'ev-user-room-create';
    button.type = 'button';
    button.className = 'ev-btn-main';
    button.textContent = 'Создать новое лобби';
    button.addEventListener('click', () => void createLobby(mode));
    head.append(button);
  }

  function scheduleEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    requestAnimationFrame(() => {
      enhanceQueued = false;
      enhanceRoomBrowser();
    });
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest?.('.ev-mode-tab[data-mode]');
    if (!tab) return;
    restoreNormalUserRole(tab.dataset.mode || '');
    window.setTimeout(scheduleEnhance, 80);
  }, true);

  const app = document.querySelector('#ev-app');
  if (app) new MutationObserver(scheduleEnhance).observe(app, { childList: true, subtree: true });
  const badge = document.querySelector('#ev-access-badge');
  if (badge) new MutationObserver(scheduleEnhance).observe(badge, { childList: true, characterData: true, subtree: true });

  [100, 500, 1200, 2500].forEach(delay => window.setTimeout(scheduleEnhance, delay));
})();
