Warning: truncated output (original token count: 118915)
Total output lines: 8139

    import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
    import {
      getFirestore,
      collection,
      doc,
      setDoc,
      deleteDoc,
      onSnapshot,
      arrayUnion,
      arrayRemove,
      serverTimestamp
    } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
    import { getAuth, signInAnonymously, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
    import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js";
    import { firebaseConfig, adminUids, appCheckSiteKey } from './firebase-config.js';

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    if (appCheckSiteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true
      });
    }
    const db = getFirestore(app);
    const auth = getAuth(app);

    const CURRENT_EVENT_YEAR = 2026;
    const SEMIFINAL_META_KEY = `${CURRENT_EVENT_YEAR}_semifinal_meta`;
    const EVENT_YEAR_KEY = 'event-current-year';
    const NAME_KEY = 'my-display-name';
    const ACCESS_KEY = 'event-access-level';
    const MAIN_ACCESS_KEY = 'op-ed-access-level';
    const PRIMARY_NAME_KEY = 'op-ed-primary-account-name';
    const ACCOUNT_PROFILE_CACHE_KEY = 'op-ed-auth-profile-v1';
    const GUEST_SLOT_KEY = 'event-guest-slot';
    const ADMIN_UNLOCKED_KEY = 'event-admin-unlocked';
    const LOCAL_EVENTS_MODE = false;
    const LOCAL_EVENT_SEASONS_KEY = 'aboba-events-local-seasons-v1';
    const LOCAL_EVENT_RATINGS_KEY = 'aboba-events-local-ratings-v1';
    const EVENT_BASKET_KEY = 'aboba-events-basket-v1';
    const EVENT_UI_PREFS_KEY = 'aboba-events-ui-preferences-v1';

    function readEventUiPreferences() {
      try {
        const value = JSON.parse(localStorage.getItem(EVENT_UI_PREFS_KEY) || '{}');
        return value && typeof value === 'object' ? value : {};
      } catch (_) {
        return {};
      }
    }

    const savedEventUiPreferences = readEventUiPreferences();
    const WINNER_COUNT_BY_TARGET = { 10: 2, 15: 3, 20: 4 };
    const WILDCARD_SLOT_COUNT_BY_TARGET = { 10: 2, 15: 1, 20: 0 };
    const BASE_WILDCARD_SLOT_COUNT = 2;
    const MAX_WILDCARD_SLOT_COUNT_PER_UNKNOWN_SEASON = 2;
    const USER_PASSWORD = '6664352';
    const PERSONAL_ACCOUNT_AUTH_ENABLED = true;
    const PERSONAL_ACCOUNT_DISABLED_MESSAGE = 'Регистрация сейчас недоступна. Попробуйте позже.';
    const GUEST_PASSWORD_RE = /^235-64[-\s]?(0[1-9]|1[0-5])$/;
    const ADMIN_NICKNAMES = new Set(['пес_кошачий', 'пёс_кошачий', 'toxexex', 'egortos', 'кофа']);
    const ADMIN_UIDS = new Set(adminUids);
    const SEASONS = ['winter', 'spring', 'summer', 'fall'];
    const SEASON_LABEL = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
    const STAGE_LABEL = { basket: 'Корзина', first: 'Первый этап', semi: 'Полуфинал', final: 'Финал' };

    function normalizeSeasonRange(raw = {}) {
      let fromYear = Number.isFinite(Number(raw.fromYear)) && String(raw.fromYear).trim() ? String(Math.trunc(Number(raw.fromYear))) : '';
      let toYear = Number.isFinite(Number(raw.toYear)) && String(raw.toYear).trim() ? String(Math.trunc(Number(raw.toYear))) : '';
      let fromSeason = SEASONS.includes(raw.fromSeason) ? raw.fromSeason : 'winter';
      let toSeason = SEASONS.includes(raw.toSeason) ? raw.toSeason : 'fall';

      // Миграция старых настроек «один год + один сезон».
      if (!fromYear && !toYear && raw.year !== undefined && raw.year !== null && String(raw.year).trim()) {
        fromYear = String(Math.trunc(Number(raw.year)));
        toYear = fromYear;
        if (SEASONS.includes(raw.season)) {
          fromSeason = raw.season;
          toSeason = raw.season;
        }
      }

      if (fromYear && toYear) {
        const fromPoint = Number(fromYear) * 4 + SEASONS.indexOf(fromSeason);
        const toPoint = Number(toYear) * 4 + SEASONS.indexOf(toSeason);
        if (fromPoint > toPoint) {
          [fromYear, toYear] = [toYear, fromYear];
          [fromSeason, toSeason] = [toSeason, fromSeason];
        }
      }
      return { fromYear, fromSeason, toYear, toSeason };
    }

    function openingInSeasonRange(opening, raw = {}) {
      const range = normalizeSeasonRange(raw);
      const year = Number(opening?.year);
      const seasonIndex = SEASONS.indexOf(String(opening?.season || ''));
      if (!Number.isFinite(year) || seasonIndex < 0) return !range.fromYear && !range.toYear;
      const point = year * 4 + seasonIndex;
      if (range.fromYear) {
        const start = Number(range.fromYear) * 4 + SEASONS.indexOf(range.fromSeason);
        if (point < start) return false;
      }
      if (range.toYear) {
        const end = Number(range.toYear) * 4 + SEASONS.indexOf(range.toSeason);
        if (point > end) return false;
      }
      return true;
    }

    function seasonRangeYearOptions(values, selected, emptyLabel) {
      const unique = [...new Set(values.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
      return `<option value="">${escapeHtml(emptyLabel)}</option>${unique.map(value => `<option value="${value}" ${String(selected) === String(value) ? 'selected' : ''}>${value}</option>`).join('')}`;
    }

    function seasonRangeSeasonOptions(selected) {
      return SEASONS.map(season => `<option value="${season}" ${selected === season ? 'selected' : ''}>${escapeHtml(SEASON_LABEL[season])}</option>`).join('');
    }

    function normalizeGameExclusions(raw = {}) {
      const current = Array.isArray(raw.excludedEntities) ? raw.excludedEntities : [];
      return [...new Set(current.map(String).filter(value => value.includes('::')))];
    }

    const SCORE_WORDS = { 1:'залупа', 2:'очень слабо', 3:'слабо', 4:'ниже среднего', 5:'средне', 6:'норм', 7:'хорошо', 8:'сильно', 9:'почти пик', 10:'пик' };

    const $ = (sel) => document.querySelector(sel);

    function fitDisplayedTrackImage(image) {
      if (!(image instanceof HTMLImageElement)) return;
      const applyFit = () => requestAnimationFrame(() => {
        const box = image.parentElement?.getBoundingClientRect();
        if (!image.naturalWidth || !image.naturalHeight || !box?.width || !box?.height) return;
        const sourceRatio = image.naturalWidth / image.naturalHeight;
        const targetRatio = box.width / box.height;
        const isTooNarrow = sourceRatio < targetRatio;
        const isTooWideAndFlat = sourceRatio > targetRatio * 1.15;
        image.classList.toggle('oc-track-image-crop', isTooNarrow || isTooWideAndFlat);
      });
      if (image.complete) applyFit();
      else image.addEventListener('load', applyFit, { once: true });
    }

    document.addEventListener('load', event => {
      if (event.target?.matches?.('img.oc-track-image')) fitDisplayedTrackImage(event.target);
    }, true);
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (!(node instanceof Element)) return;
      if (node.matches('img.oc-track-image')) fitDisplayedTrackImage(node);
      node.querySelectorAll?.('img.oc-track-image').forEach(fitDisplayedTrackImage);
    }))).observe(document.documentElement, { childList: true, subtree: true });

    const appEl = $('#ev-app');
    const stageTabs = $('#ev-stage-tabs');
    const nameInput = $('#ev-myname');
    const accessBadge = $('#ev-access-badge');
    const roleSwitch = $('#ev-role-switch');
    const authModal = $('#ev-auth-modal');
    const authPass = $('#ev-auth-pass');
    const authSave = $('#ev-auth-save');
    const authError = $('#ev-auth-error');
    const nameModal = $('#ev-name-modal');
    const modalName = $('#ev-modal-name');
    const modalAccountEmail = $('#ev-modal-account-email');
    const modalAccountPass = $('#ev-modal-account-pass');
    const rememberAccountInput = $('#ev-remember-account');
    const nameSave = $('#ev-name-save');
    const nameClose = $('#ev-name-close');
    const nameError = $('#ev-name-error');
    const evaluatorEl = $('#ev-evaluator');
    const postModalEl = $('#ev-post-modal');
    const guessGameEl = $('#ev-guess-game');
    const POST_PRIORITY_NICKS = ['Egortos', 'Кофа', 'Toxexex'];
    const FIXED_PARTICIPANTS = ['Egortos', 'Кофа', 'Toxexex'];

    let accessLevel = localStorage.getItem(ACCESS_KEY) || '';
    let guestSlot = Math.max(0, Math.min(15, Number(localStorage.getItem(GUEST_SLOT_KEY) || 0) || 0));
    let adminUnlocked = false;
    let myName = localStorage.getItem(NAME_KEY) || '';
    let activeMode = String(savedEventUiPreferences.activeMode || 'rating');
    let activeStage = String(savedEventUiPreferences.activeStage || 'basket');
    let activeSeason = SEASONS.includes(savedEventUiPreferences.activeSeason) ? savedEventUiPreferences.activeSeason : 'winter';
    let activeEndingPeriod = savedEventUiPreferences.activeEndingPeriod === 'h2' ? 'h2' : 'h1';
    let openings = [];
    let openingsById = new Map();
    let mainRatings = [];
    let userProfiles = [];
    const guessFilters = {
      search: '',
      count: 50,
      answerMode: 'four',
      answerTarget: 'song',
      playMode: 'standard',
      clipSeconds: 10,
      listenCount: 3,
      source: 'all',
      type: '',
      fromYear: '',
      fromSeason: 'winter',
      toYear: '',
      toSeason: 'fall',
      excludedEntities: [],
      content: 'all',
      users: [],
      scoreLogic: 'and',
      scoreOverallCmp: 'gte',
      scoreOverallValue: '',
      scoreSongCmp: 'gte',
      scoreSongValue: '',
      scoreVisualCmp: 'gte',
      scoreVisualValue: ''
    };
    if (savedEventUiPreferences.guessFilters && typeof savedEventUiPreferences.guessFilters === 'object') {
      Object.assign(guessFilters, savedEventUiPreferences.guessFilters);
    }
    guessFilters.excludedEntities = normalizeGameExclusions(guessFilters);
    delete guessFilters.studio; delete guessFilters.director; delete guessFilters.performer; delete guessFilters.franchise;
    const blindTierFilters = {
      search: '',
      count: 10,
      source: 'all',
      type: '',
      fromYear: '',
      fromSeason: 'winter',
      toYear: '',
      toSeason: 'fall',
      excludedEntities: [],
      content: 'all',
      users: [],
      scoreLogic: 'and',
      scoreOverallCmp: 'gte',
      scoreOverallValue: '',
      scoreSongCmp: 'gte',
      scoreSongValue: '',
      scoreVisualCmp: 'gte',
      scoreVisualValue: '',
      answerTarget: 'song'
    };
    if (savedEventUiPreferences.blindTierFilters && typeof savedEventUiPreferences.blindTierFilters === 'object') {
      Object.assign(blindTierFilters, savedEventUiPreferences.blindTierFilters);
    }
    blindTierFilters.excludedEntities = normalizeGameExclusions(blindTierFilters);
    delete blindTierFilters.studio; delete blindTierFilters.director; delete blindTierFilters.performer; delete blindTierFilters.franchise;
    let guessResultIds = [];
    let guessMessage = '';
    let guessGameState = null;
    let guessSuggestionIndex = -1;
    let guessCollections = [];
    let guessCollectionStatus = '';
    let guessCollectionDraft = {
      open: false,
      editId: '',
      title: '',
      autoCount: 0,
      autoIds: [],
      manualIds: [],
      search: ''
    };
    const BW_ROOM_COLLECTION = 'bestWorstRooms';
    const BW_ROOM_ID = 'current';
    const BW_SUBMISSION_COLLECTION = 'bestWorstSubmissions';
    const EVENT_ROOM_SELECTION_KEY = 'aboba-event-room-selection-v1';
    let selectedEventRooms = (() => {
      try {
        const saved = JSON.parse(localStorage.getItem(EVENT_ROOM_SELECTION_KEY) || '{}');
        return {
          bestworst: String(saved.bestworst || ''),
          codenames: String(saved.codenames || ''),
          whoami: String(saved.whoami || '')
        };
      } catch (_) {
        return { bestworst:'', codenames:'', whoami:'' };
      }
    })();
    let bestWorstRooms = [];
    let codenamesRooms = [];
    let whoAmIRooms = [];
    const eventRoomCache = {
      bestworst:new Map(),
      codenames:new Map(),
      whoami:new Map()
    };
    const eventRoomSubscriptions = {
      bestworst:new Map(),
      codenames:new Map(),
      whoami:new Map()
    };
    let pendingEventRoomMetadata = null;
    let eventRoomInviteHandled = false;
    const spectatorPresenceRegistered = new Set();
    const unlockedEventRooms = new Set((() => {
      try {
        const rows = JSON.parse(localStorage.getItem('aboba-event-unlocked-rooms-v1') || '[]');
        return Array.isArray(rows) ? rows : [];
      } catch (_) { return []; }
    })());
    const bestWorstFilters = {
      mode: 'both',
      typeFilter: 'OP',
      perRound: 6,
      rounds: 5,
      grouping: 'none',
      fromYear: '',
      fromSeason: 'winter',
      toYear: '',
      toSeason: 'fall',
      excludedEntities: [],
      content: 'all',
      source: 'ratings',
      users: [],
      scoreLogic: 'and',
      scoreOverallCmp: 'gte',
      scoreOverallValue: '',
      scoreSongCmp: 'gte',
      scoreSongValue: '',
      scoreVisualCmp: 'gte',
      scoreVisualValue: ''
    };
    if (savedEventUiPreferences.bestWorstFilters && typeof savedEventUiPreferences.bestWorstFilters === 'object') {
      Object.assign(bestWorstFilters, savedEventUiPreferences.bestWorstFilters);
    }
    bestWorstFilters.excludedEntities = normalizeGameExclusions(bestWorstFilters);
    delete bestWorstFilters.studio; delete bestWorstFilters.director; delete bestWorstFilters.performer; delete bestWorstFilters.franchise;
    let bestWorstRoom = null;
    let bestWorstSubmissions = [];
    let bestWorstStatus = '';
    let bestWorstDraft = {};
    let bestWorstDraftKey = '';
    let bestWorstRevealPending = false;
    let bestWorstRenderedRoundKey = '';
    const PREDICTION_COLLECTION = 'eventPredictions';
    const PREDICTION_START_YEAR = 2026;
    const PREDICTION_START_SEASON = 'fall';
    let predictionDocs = new Map();
    let predictionYear = Number(savedEventUiPreferences.predictionYear || 2026);
    let predictionSeason = SEASONS.includes(savedEventUiPreferences.predictionSeason) ? savedEventUiPreferences.predictionSeason : 'fall';
    let predictionDraft = null;
    let predictionDraftKey = '';
    let predictionDraftDirty = false;
    let predictionStatus = '';
    const CODENAMES_COLLECTION = 'eventCodenames';
    const CODENAMES_ROOM_ID = 'current';
    let codenamesRoom = null;
    let codenamesStatus = '';
    const BLIND_TIER_KEY = 'aboba-events-blind-tier-v1';
    const WHO_AM_I_COLLECTION = 'eventCodenames';
    const WHO_AM_I_ROOM_ID = 'whoami-current';
    let blindTierState = null;
    let blindTierPreviewOpen = false;
    let whoAmIRoom = null;
    let whoAmIStatus = '';
    let whoAmISettingsDraft = {
      type: String(savedEventUiPreferences.whoAmISettings?.type || ''),
      fromYear: String(savedEventUiPreferences.whoAmISettings?.fromYear || ''),
      toYear: String(savedEventUiPreferences.whoAmISettings?.toYear || '')
    };
    let whoAmIQuestionDraft = '';
    let whoAmIGuessDraft = '';
    let whoAmIPickDraft = '';

    function saveEventRoomSelection() {
      try { localStorage.setItem(EVENT_ROOM_SELECTION_KEY, JSON.stringify(selectedEventRooms)); } catch (_) {}
    }

    function eventRoomId(mode) {
      return String(selectedEventRooms[mode] || '');
    }

    function setEventRoom(mode, id) {
      selectedEventRooms[mode] = String(id || '');
      saveEventRoomSelection();
      if (mode === 'bestworst') bestWorstRoom = bestWorstRooms.find(room => room.id === selectedEventRooms.bestworst) || null;
      if (mode === 'codenames') codenamesRoom = codenamesRooms.find(room => room.id === selectedEventRooms.codenames) || null;
      if (mode === 'whoami') whoAmIRoom = whoAmIRooms.find(room => room.id === selectedEventRooms.whoami) || null;
    }

    function newEventRoomId(prefix) {
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
    }

    async function eventRoomCodeHash(value, salt = '') {
      const bytes = new TextEncoder().encode(`oped-room:${String(salt || '')}:${String(value || '').trim().toLowerCase()}`);
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2,'0')).join('');
    }

    function saveUnlockedEventRooms() {
      try { localStorage.setItem('aboba-event-unlocked-rooms-v1', JSON.stringify([...unlockedEventRooms])); } catch (_) {}
    }

    function eventRoomCollection(mode) {
      return mode === 'bestworst' ? BW_ROOM_COLLECTION : CODENAMES_COLLECTION;
    }

    function eventRoomRegistryId(mode) {
      if (mode === 'bestworst') return BW_ROOM_ID;
      if (mode === 'whoami') return WHO_AM_I_ROOM_ID;
      return CODENAMES_ROOM_ID;
    }

    function eventRoomRegistryRef(mode) {
      return doc(db, eventRoomCollection(mode), eventRoomRegistryId(mode));
    }

    async function registerEventRoom(mode, id) {
      if (!id || id === eventRoomRegistryId(mode)) return;
      await setDoc(eventRoomRegistryRef(mode), { roomIds:arrayUnion(id), registryUpdatedAt:serverTimestamp() }, { merge:true });
    }

    async function unregisterEventRoom(mode, id) {
      if (!id || id === eventRoomRegistryId(mode)) return;
      await setDoc(eventRoomRegistryRef(mode), { roomIds:arrayRemove(id), registryUpdatedAt:serverTimestamp() }, { merge:true });
    }

    function refreshEventRoomList(mode) {
      const rows = [...eventRoomCache[mode].values()];
      if (mode === 'bestworst') {
        bestWorstRooms = rows;
        bestWorstRoom = rows.find(room => room.id === eventRoomId(mode)) || null;
        restoreEventRoomPresence(mode, bestWorstRoom);
        if (bestWorstRoom?.status === 'lobby' && bestWorstRoom.settings) Object.assign(bestWorstFilters, normalizeBestWorstSettings(bestWorstRoom.settings));
        if (!bestWorstRoom || bestWorstRoom.status !== 'playing') bestWorstDraftKey = '';
        void bwMaybeAutoReveal();
      } else if (mode === 'codenames') {
        codenamesRooms = rows;
        codenamesRoom = rows.find(room => room.id === eventRoomId(mode)) || null;
        restoreEventRoomPresence(mode, codenamesRoom);
      } else {
        whoAmIRooms = rows;
        whoAmIRoom = rows.find(room => room.id === eventRoomId(mode)) || null;
        restoreEventRoomPresence(mode, whoAmIRoom);
      }
      void consumeEventRoomInvite();
      if (activeMode === mode) scheduleFirebaseRender(mode === 'whoami' ? 'whoami' : 'other');
    }

    function syncEventRoomSubscriptions(mode, roomIds = []) {
      const registryId = eventRoomRegistryId(mode);
      const desired = new Set(roomIds.map(String).filter(id => id && id !== registryId));
      eventRoomSubscriptions[mode].forEach((unsubscribe, id) => {
        if (desired.has(id)) return;
        unsubscribe();
        eventRoomSubscriptions[mode].delete(id);
        eventRoomCache[mode].delete(id);
      });
      desired.forEach(id => {
        if (eventRoomSubscriptions[mode].has(id)) return;
        const unsubscribe = onSnapshot(eventRoomRef(mode, id), snapshot => {
          if (snapshot.exists()) eventRoomCache[mode].set(id, { id:snapshot.id, ...snapshot.data() });
          else eventRoomCache[mode].delete(id);
          refreshEventRoomList(mode);
        }, error => {
          console.error(`${mode} room snapshot error`, id, error);
          eventRoomCache[mode].delete(id);
          refreshEventRoomList(mode);
        });
        eventRoomSubscriptions[mode].set(id, unsubscribe);
      });
      refreshEventRoomList(mode);
    }

    function eventRoomRef(mode, id = eventRoomId(mode)) {
      if (!id) throw new Error('Сначала выбери лобби.');
      return doc(db, eventRoomCollection(mode), id);
    }

    function currentEventRoom(mode) {
      if (mode === 'bestworst') return bestWorstRoom;
      if (mode === 'codenames') return codenamesRoom;
      return whoAmIRoom;
    }

    function eventRoomPlayerKey(mode) {
      return mode === 'whoami' ? whoPlayerKey() : normalizeNickname(myName);
    }

    function eventRoomPlayers(room) {
      return Array.isArray(room?.players) ? room.players.filter(player => player?.key && player?.name) : [];
    }

    function eventRoomIsHost(mode, room = currentEventRoom(mode)) {
      if (!room) return false;
      if (room.hostUid) return room.hostUid === currentActorUid() || isAdmin();
      return normalizeNickname(room.hostKey) === eventRoomPlayerKey(mode) || (!room.hostKey && isAdmin());
    }

    function eventRoomSpectators(room) {
      const playerKeys = new Set(eventRoomPlayers(room).map(player => player.key));
      return (Array.isArray(room?.spectators) ? room.spectators : [])
        .filter(person => person?.key && person?.name && !playerKeys.has(person.key))
        .filter(person => !person.seenAtLocal || Date.now() - Date.parse(person.seenAtLocal) < 20 * 60 * 1000);
    }

    async function updateEventRoomSpectator(mode, room, present) {
      if (!room?.id) return;
      const key = eventRoomPlayerKey(mode);
      const name = String(myName || '').trim();
      if (!key || !name || eventRoomPlayers(room).some(player => player.key === key)) return;
      const spectators = eventRoomSpectators(room).filter(person => person.key !== key);
      if (present) spectators.push({ key, name, ownerUid:currentActorUid(), seenAtLocal:new Date().toISOString() });
      await setDoc(eventRoomRef(mode, room.id), { spectators, updatedAtLocal:new Date().toISOString(), updatedAt:serverTimestamp() }, { merge:true });
    }

    async function openEventRoom(mode, room) {
      if (!room) return;
      setEventRoom(mode, room.id);
      await updateEventRoomSpectator(mode, room, true).catch(error => console.warn('spectator register failed', error));
      spectatorPresenceRegistered.add(`${mode}:${room.id}`);
      render();
    }

    async function closeEventRoom(mode) {
      const room = currentEventRoom(mode);
      if (room) await updateEventRoomSpectator(mode, room, false).catch(error => console.warn('spectator unregister failed', error));
      if (room) spectatorPresenceRegistered.delete(`${mode}:${room.id}`);
      pendingEventRoomMetadata = null;
      setEventRoom(mode, '');
      render();
    }

    async function removeSelfFromSpectators(mode, room = currentEventRoom(mode)) {
      if (!room?.id) return;
      const key = eventRoomPlayerKey(mode);
      const spectators = eventRoomSpectators(room).filter(person => person.key !== key);
      await setDoc(eventRoomRef(mode, room.id), { spectators, updatedAtLocal:new Date().toISOString(), updatedAt:serverTimestamp() }, { merge:true });
      spectatorPresenceRegistered.delete(`${mode}:${room.id}`);
    }

    function restoreEventRoomPresence(mode, room) {
      if (!room?.id || eventRoomPlayers(room).some(player => player.key === eventRoomPlayerKey(mode))) return;
      const presenceKey = `${mode}:${room.id}`;
      if (spectatorPresenceRegistered.has(presenceKey)) return;
      spectatorPresenceRegistered.add(presenceKey);
      void updateEventRoomSpectator(mode, room, true).catch(error => {
        spectatorPresenceRegistered.delete(presenceKey);
        console.warn('spectator restore failed', error);
      });
    }

    async function consumeEventRoomInvite() {
      if (eventRoomInviteHandled || !location.hash.startsWith('#event-room=')) return;
      const match = location.hash.match(/^#event-room=([^:]+):([^:]+):(.+)$/);
      if (!match) return;
      const mode = decodeURIComponent(match[1]);
      if (!['bestworst','codenames','whoami'].includes(mode)) return;
      const id = decodeURIComponent(match[2]);
      const code = decodeURIComponent(match[3]);
      const rooms = mode === 'bestworst' ? bestWorstRooms : mode === 'codenames' ? codenamesRooms : whoAmIRooms;
      const room = rooms.find(row => row.id === id);
      if (!room) return;
      eventRoomInviteHandled = true;
      if (room.isPrivate && room.accessCodeHash !== await eventRoomCodeHash(code, room.accessCodeSalt || '')) {
        alert('Ссылка на закрытую комнату содержит неверный код.');
        return;
      }
      unlockedEventRooms.add(id);
      saveUnlockedEventRooms();
      activeMode = mode;
      history.replaceState(null, '', `${location.pathname}${location.search}`);
      await openEventRoom(mode, room);
    }

    function bwRoomDoc() {
      const id = eventRoomId('bestworst');
      if (!id) throw new Error('Сначала выбери лобби.');
      return doc(db, BW_ROOM_COLLECTION, id);
    }

    function bwIsHost(room = bestWorstRoom) {
      return room ? eventRoomIsHost('bestworst', room) : isAdmin();
    }

    function whoRoomDoc() {
      const id = eventRoomId('whoami');
      if (!id) throw new Error('Сначала выбери лобби.');
      return doc(db, WHO_AM_I_COLLECTION, id);
    }
    let guessPlaybackTimer = null;
    let guessYouTubePlayer = null;
    let guessYouTubeApiPromise = null;
    const guessPlayableSourceCache = new Map();
    const guessValidatedOpeningSources = new Map();
    let seasonDocs = new Map();
    let eventRatings = [];
    let eventBasket = {};
    let eventBasketError = '';
    let eventAltLinks = new Map();
    let eventNotifications = new Map();
    let noticePopupOpen = false;
    const locallyHandledNoticeIds = new Set();
    let renderTimer = null;
    let evaluatorQueue = [];
    let evaluatorIndex = 0;

    function loadLocalEventData() {
      try {
        const seasonsRaw = JSON.parse(localStorage.getItem(LOCAL_EVENT_SEASONS_KEY) || '{}');
        seasonDocs = new Map(Object.entries(seasonsRaw && typeof seasonsRaw === 'object' ? seasonsRaw : {}));
      } catch (e) {
        console.warn('local event seasons load failed', e);
        seasonDocs = new Map();
      }
      try {
        const ratingsRaw = JSON.parse(localStorage.getItem(LOCAL_EVENT_RATINGS_KEY) || '[]');
        eventRatings = Array.isArray(ratingsRaw) ? ratingsRaw : [];
      } catch (e) {
        console.warn('local event ratings load failed', e);
        eventRatings = [];
      }
      loadEventBasket();
    }

    function saveLocalSeasonDoc(key, patch) {
      const docKey = String(key);
      const current = seasonDocs.get(docKey) || {};
      const next = {
        ...current,
        ...patch,
        id: docKey,
        updatedAtLocal: new Date().toISOString()
      };
      seasonDocs.set(docKey, next);
      if (LOCAL_EVENTS_MODE) {
        localStorage.setItem(LOCAL_EVENT_SEASONS_KEY, JSON.stringify(Object.fromEntries(seasonDocs.entries())));
        scheduleRender();
      } else {
        scheduleRender();
        const payload = { ...next, updatedAt: serverTimestamp() };
        delete payload.id;
        setDoc(doc(db, 'eventSeasons', docKey), payload, { merge: true })
          .catch(e => console.error('eventSeasons save failed', e));
      }
      return next;
    }

    function saveLocalEventRating(row) {
      const id = `${row.seasonKey}__${row.nicknameKey}__${row.openingId}`;
      const currentIndex = eventRatings.findIndex(r => String(r.id || '') === id);
      const previous = currentIndex >= 0 ? eventRatings[currentIndex] : {};
      const next = {
        ...previous,
        ...row,
        id,
        updatedAtLocal: new Date().toISOString()
      };
      if (currentIndex >= 0) eventRatings[currentIndex] = next;
      else eventRatings.push(next);
      if (LOCAL_EVENTS_MODE) {
        localStorage.setItem(LOCAL_EVENT_RATINGS_KEY, JSON.stringify(eventRatings));
        scheduleRender();
      } else {
        const payload = { ...next, updatedAt: serverTimestamp() };
        delete payload.id;
        setDoc(doc(db, 'eventRatings', id), payload, { merge: true })
          .catch(e => console.error('eventRatings save failed', e));
      }
      return next;
    }


    function loadEventBasket() {
      if (!LOCAL_EVENTS_MODE) return eventBasket;
      try {
        const raw = JSON.parse(localStorage.getItem(EVENT_BASKET_KEY) || '{}');
        eventBasket = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      } catch (e) {
        console.warn('event basket load failed', e);
        eventBasket = {};
      }
      return eventBasket;
    }

    function saveEventBasket() {
      if (LOCAL_EVENTS_MODE) {
        localStorage.setItem(EVENT_BASKET_KEY, JSON.stringify(eventBasket && typeof eventBasket === 'object' ? eventBasket : {}));
        scheduleRender();
        return;
      }
      scheduleRender();
      const writes = Object.entries(eventBasket && typeof eventBasket === 'object' ? eventBasket : {}).map(([key, value]) => {
        const payload = { ...(value || {}), key, updatedAt: serverTimestamp() };
        return setDoc(doc(db, 'eventBasket', key), payload, { merge: true });
      });
      Promise.all(writes).catch(e => console.error('eventBasket save failed', e));
    }

    function basketSeasonKey(season) {
      return `${CURRENT_EVENT_YEAR}_${season}`;
    }

    function normalizeBasketBuckets(buckets) {
      const source = buckets && typeof buckets === 'object' ? buckets : {};
      const seen = new Set();
      const out = { unassigned: [], guaranteed: [], variable: [] };
      ['unassigned', 'guaranteed', 'variable'].forEach(bucket => {
        (Array.isArray(source[bucket]) ? source[bucket] : []).map(String).filter(Boolean).forEach(id => {
          if (seen.has(id)) return;
          seen.add(id);
          out[bucket].push(id);
        });
      });
      return out;
    }

    function getBasketState(season) {
      const key = basketSeasonKey(season);
      const raw = eventBasket[key] || {};
      const buckets = normalizeBasketBuckets(raw.buckets);
      return {
        key,
        year: CURRENT_EVENT_YEAR,
        season,
        target: [10, 15, 20].includes(Number(raw.target)) ? Number(raw.target) : 15,
        buckets
      };
    }

    function setBasketState(season, patch) {
      const current = getBasketState(season);
      eventBasket[current.key] = {
        ...eventBasket[current.key],
        key: current.key,
        year: CURRENT_EVENT_YEAR,
        season,
        target: patch.target !== undefined ? patch.target : current.target,
        buckets: normalizeBasketBuckets(patch.buckets || current.buckets),
        updatedAtLocal: new Date().toISOString()
      };
      saveEventBasket();
      return getBasketState(season);
    }

    function basketAllIds(state) {
      return [...state.buckets.unassigned, ...state.buckets.guaranteed, ...state.buckets.variable].map(String);
    }

    function moveBasketItem(season, openingId, toBucket) {
      if (!['unassigned', 'guaranteed', 'variable'].includes(toBucket)) return;
      const state = getBasketState(season);
      const id = String(openingId);
      const buckets = normalizeBasketBuckets(state.buckets);
      ['unassigned', 'guaranteed', 'variable'].forEach(bucket => {
        buckets[bucket] = buckets[bucket].filter(x => String(x) !== id);
      });
      buckets[toBucket].push(id);
      setBasketState(season, { buckets });
    }

    function setBasketTarget(season, target) {
      setBasketState(season, { target: Number(target) || 15 });
    }

    function removeMissingBasketIds(state) {
      // Важно: корзина может прийти из Firebase раньше, чем успеет загрузиться
      // коллекция openings. Раньше в этот момент все id считались «пропавшими»
      // и страница ивентов сразу затирала корзину пустым списком.
      // Поэтому чистим несуществующие id только после фактической загрузки OP/ED.
      if (!openingsById || openingsById.size === 0) return state;
      const buckets = normalizeBasketBuckets(state.buckets);
      let changed = false;
      ['unassigned', 'guaranteed', 'variable'].forEach(bucket => {
        const next = buckets[bucket].filter(id => openingsById.has(String(id)));
        if (next.length !== buckets[bucket].length) changed = true;
        buckets[bucket] = next;
      });
      if (changed) return setBasketState(state.season, { buckets });
      return state;
    }

    function normalizeNickname(nickname) {
      return String(nickname || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-zа-яё0-9_-]+/gi, '_')
        .slice(0, 60);
    }

    function cachedMainProfile(uid) {
      for (const storage of [sessionStorage, localStorage]) {
        try {
          const cached = JSON.parse(storage.getItem(ACCOUNT_PROFILE_CACHE_KEY) || 'null');
          if (cached?.uid === uid && cached.profile) return cached.profile;
        } catch (error) { storage.removeItem(ACCOUNT_PROFILE_CACHE_KEY); }
      }
      return null;
    }

    async function restoreMainSiteLogin() {
      if (typeof auth.authStateReady === 'function') await auth.authStateReady();
      const firebaseUser = auth.currentUser;
      const authenticated = firebaseUser && !firebaseUser.isAnonymous;
      const cachedProfile = authenticated ? cachedMainProfile(firebaseUser.uid) : null;
      const profileName = String(cachedProfile?.nickname || cachedProfile?.nicknameKey || firebaseUser?.displayName || '').trim();
      const mainAccess = String(sessionStorage.getItem(MAIN_ACCESS_KEY) || '').trim();
      const savedName = String(localStorage.getItem(PRIMARY_NAME_KEY) || localStorage.getItem(NAME_KEY) || '').trim();
      const restoredName = profileName || savedName;
      if (!restoredName || (!authenticated && !['user', 'admin'].includes(mainAccess))) return false;

      myName = restoredName;
      const verifiedPersonalAdmin = authenticated && isAdminUid(firebaseUser.uid);
      accessLevel = verifiedPersonalAdmin ? 'admin' : 'user';
      guestSlot = 0;
      adminUnlocked = accessLevel === 'admin';
      localStorage.setItem(NAME_KEY, myName);
      localStorage.setItem(ACCESS_KEY, accessLevel);
      localStorage.setItem(GUEST_SLOT_KEY, '0');
      localStorage.setItem(ADMIN_UNLOCKED_KEY, adminUnlocked ? '1' : '0');
      return true;
    }

    function protectedProfile(name) {
      const key = normalizeNickname(name);
      return userProfiles.find(row => normalizeNickname(row.nicknameKey || row.nickname || row.id) === key && row.authUid) || null;
    }

    function knownEventAccount(name) {
      const key = normalizeNickname(name);
      if (!key) return false;
      if (userProfiles.some(row => normalizeNickname(row.nicknameKey || row.nickname || row.id) === key)) return true;
      if (mainRatings.some(row => normalizeNickname(row.nicknameKey || row.nickname) === key)) return true;
      return SEASONS.some(season => cleanParticipantSlots(getSeasonState(season).allowedNicknames || []).some(nick => normalizeNickname(nick) === key));
    }

    function seasonKey(season) {
      return `${CURRENT_EVENT_YEAR}_${season}`;
    }

    function getCalendarSeason(date = new Date()) {
      const month = date.getMonth() + 1;
      if (month <= 3) return 'winter';
      if (month <= 6) return 'spring';
      if (month <= 9) return 'summer';
      return 'fall';
    }

    function getGuestNicknameForSeason(state) {
      if (!isGuest() || !guestSlot) return '';
      return String(state.allowedNicknames[guestSlot - 1] || '').trim();
    }

    function findGuestSeasonStates() {
      if (!isGuest() || !guestSlot) return [];
      const myKey = normalizeNickname(myName);
      if (!myKey) return [];
      // В админском гостевом режиме ник в шапке остаётся админским,
      // а оценка сохраняется от имени участника выбранного слота.
      return SEASONS
        .map(season => getSeasonState(season))
        .filter(state => {
          if (state.closed) return false;
          const nickname = getGuestNicknameForSeason(state);
          const guestKey = normalizeNickname(nickname);
          return !!guestKey && (isAdminGuestPreview() || guestKey === myKey);
        });
    }

    function findGuestSeasonState() {
      return findGuestSeasonStates()[0] || null;
    }

    function cleanNickList(values) {
      const used = new Set();
      const out = [];
      (values || []).forEach(value => {
        const name = String(value || '').trim();
        const key = normalizeNickname(name);
        if (!name || !key || used.has(key)) return;
        used.add(key);
        out.push(name);
      });
      return out.slice(0, 15);
    }

    function cleanParticipantSlots(values) {
      const raw = Array.isArray(values) ? values : [];
      const out = Array.from({ length: 15 }, () => '');
      const used = new Set();
      FIXED_PARTICIPANTS.forEach((name, idx) => {
        out[idx] = name;
        used.add(normalizeNickname(name));
      });

      const fixedAlreadyInSlots = FIXED_PARTICIPANTS.every((name, idx) => normalizeNickname(raw[idx]) === normalizeNickname(name));
      const looksSlotBased = raw.length >= 15 || fixedAlreadyInSlots;

      const fillNextFree = (name) => {
        const clean = String(name || '').trim();
        const key = normalizeNickname(clean);
        if (!clean || !key || used.has(key)) return;
        const pos = out.findIndex((value, idx) => idx >= 3 && !value);
        if (pos < 0) return;
        out[pos] = clean;
        used.add(key);
      };

      if (looksSlotBased) {
        for (let idx = 3; idx < 15; idx += 1) {
          const name = String(raw[idx] || '').trim();
          const key = normalizeNickname(name);
          if (!name || !key || used.has(key)) continue;
          out[idx] = name;
          used.add(key);
        }
        for (let idx = 0; idx < 3; idx += 1) {
          fillNextFree(raw[idx]);
        }
      } else {
        raw.forEach(value => fillNextFree(value));
      }

      return out;
    }

    function isAdminNickname(name = myName) {
      return ADMIN_NICKNAMES.has(normalizeNickname(name));
    }
    function isAdminUid(uid = auth.currentUser?.uid) { return ADMIN_UIDS.has(String(uid || '')); }
    function isAdmin() { return adminUnlocked && accessLevel === 'admin' && isAdminUid(); }
    function currentActorUid() { return String(auth.currentUser?.uid || ''); }
    function isUser() { return accessLevel === 'user'; }
    function isGuest() { return accessLevel === 'guest'; }
    function isAdminGuestPreview() { return adminUnlocked && accessLevel === 'guest' && isAdminNickname(getSavedAdminNickname()); }
    function hasAccess() { return isUser() || accessLevel === 'guest' || isAdmin(); }
    function canAccessMode(mode) {
      const requested = String(mode || 'rating');
      if (requested === 'rating' || requested === 'endingrating') return isGuest() || isAdmin();
      if (requested === 'predictions') return isAdmin();
      return !isGuest();
    }

    function defaultAccessibleMode() {
      return isGuest() || isAdmin() ? 'rating' : 'guess';
    }

    function getSavedAdminNickname() {
      return String(localStorage.getItem(NAME_KEY) || '').trim();
    }

    function saveAdminNicknameFromUi() {
      if (isGuest() && !isAdminGuestPreview()) return getSavedAdminNickname();
      const current = String(nameInput?.value || myName || '').trim();
      if (current) {
        localStorage.setItem(NAME_KEY, current);
        myName = current;
      }
      return current || getSavedAdminNickname();
    }

    function fillRoleSwitch() {
      if (!roleSwitch) return;
      roleSwitch.innerHTML = [
        '<option value="admin">Роль: админ</option>',
        ...Array.from({ length: 15 }, (_, i) => {
          const n = String(i + 1).padStart(2, '0');
          return `<option value="guest-${n}">Роль: гость #${n}</option>`;
        })
      ].join('');
    }

    function updateAccessUi() {
      const isAdminPreview = adminUnlocked && isGuest();
      accessBadge.textContent = isAdmin() ? 'админ' : isUser() ? 'участник' : isGuest() ? `${isAdminPreview ? 'просмотр · ' : ''}гость #${String(guestSlot).padStart(2, '0')}` : 'вход не выполнен';
      accessBadge.style.color = isAdmin() ? 'var(--pink)' : isUser() ? 'var(--green)' : isGuest() ? 'var(--cyan)' : 'var(--muted)';
      if (nameInput) {
        nameInput.value = myName;
        nameInput.disabled = isAdminPreview;
        nameInput.placeholder = isAdminPreview ? 'админский аккаунт' : (isGuest() ? 'введите свой ник' : 'ваш ник');
      }
      if (roleSwitch) {
        roleSwitch.classList.toggle('hidden', !adminUnlocked);
        roleSwitch.value = isGuest() ? `guest-${String(guestSlot).padStart(2, '0')}` : 'admin';
      }
      const homeLink = document.querySelector('#ev-back-home');
      if (homeLink) homeLink.style.display = hasAccess() && !isGuest() ? 'inline-flex' : 'none';
      const tabs = document.querySelector('.ev-tabs');
      if (tabs) tabs.classList.toggle('guest-mode', isGuest());
      const modeSwitch = document.querySelector('.ev-mode-switch');
      if (modeSwitch) modeSwitch.style.gridTemplateColumns = isGuest() ? '1fr' : '';
      document.querySelectorAll('.ev-tab').forEach(btn => { btn.style.display = isGuest() ? 'none' : ''; });
      document.querySelectorAll('.ev-mode-tab').forEach(btn => {
        const allowed = canAccessMode(btn.dataset.mode);
        btn.style.display = allowed ? '' : 'none';
        btn.disabled = !allowed;
      });
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
    }

    function getOpeningTitle(opening) {
      return String(opening?.title || opening?.anime || 'Без названия');
    }

    function getMixedOpeningTitle(opening, mixedTypes = false) {
      const title = getOpeningTitle(opening).trim();
      const type = String(opening?.type || '').toUpperCase();
      if (!mixedTypes || !['OP', 'ED'].includes(type) || /\b(?:OP|ED)(?:\s*#?\d+)?\b/iu.test(title)) return title;
      return `${title} ${type}`;
    }

    function normalizeOpeningAlternativeTitles(value) {
      const raw = Array.isArray(value)
        ? value
        : String(value || '').split(/\n|;/).flatMap(part => part.split(' / '));
      const seen = new Set();
      return raw.map(item => String(item || '').trim()).filter(item => {
        const key = item.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function getOpeningSearchTitles(opening) {
      const seen = new Set();
      return [getOpeningTitle(opening), opening?.anime, ...(opening?.alternativeTitles || [])]
        .map(value => String(value || '').trim())
        .filter(value => {
          const key = normalizeGuessAnswer(value);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }

    function normalizeOpening(row) {
      return {
        id: String(row.id || ''),
        title: String(row.title || row.anime || 'Без названия'),
        anime: String(row.anime || ''),
        type: row.type === 'ED' ? 'ED' : 'OP',
        year: row.year === null || row.year === undefined || row.year === '' ? null : Number(row.year),
        season: String(row.season || ''),
        studios: Array.isArray(row.studios) ? row.studios : [],
        directors: Array.isArray(row.directors) ? row.directors : [],
        performers: Array.isArray(row.performers) ? row.performers : [],
        franchises: Array.isArray(row.franchises) ? row.franchises : [],
        alternativeTitles: normalizeOpeningAlternativeTitles(row.alternativeTitles || row.altTitles || row.aliases || row.alternativeNames || row.altNames),
        image: String(row.image || ''),
        fallbackImage: String(row.fallbackImage || row.imageFallback || ''),
        sameSongGroupId: String(row.sameSongGroupId || row.songGroupId || '').trim(),
        sameSongTitle: String(row.sameSongTitle || row.songGroupTitle || '').trim(),
        link: String(row.link || ''),
        notes: String(row.notes || ''),
        isChinese: Boolean(row.isChinese || row.chinese || row.isChina || row.chineseOpening),
        isMovie: Boolean(row.isMovie || row.movie || row.isFilm || row.filmOpening),
        isShortened: Boolean(row.isShortened || row.shortened || row.isShort || row.short || row.shortOpening || row.shortenedOpening)
      };
    }

    function openingGameSignature(opening) {
      return JSON.stringify([
        opening.id,
        opening.title,
        opening.anime,
        opening.type,
        opening.year,
        opening.season,
        opening.studios,
        opening.directors,
        opening.performers,
        opening.franchises,
        opening.alternativeTitles,
        opening.image,
        opening.sameSongGroupId,
        opening.sameSongTitle,
        opening.link,
        opening.notes,
        opening.isChinese,
        opening.isMovie,
        opening.isShortened
      ]);
    }

    function safeUrl(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      try {
        const url = new URL(raw, window.location.href);
        if (!['http:', 'https:'].includes(url.protocol)) return '';
        return url.href;
      } catch (e) {
        return '';
      }
    }

    function getDirectVideoType(value) {
      const href = safeUrl(value);
      if (!href) return '';
      try {
        const url = new URL(href);
        const text = `${url.pathname} ${url.search}`.toLowerCase();
        if (/\.webm(?:$|[?#&\s])/.test(text) || text.includes('.webm')) return 'video/webm';
        if (/\.mp4(?:$|[?#&\s])/.test(text) || text.includes('.mp4')) return 'video/mp4';
        if (/\.ogg(?:$|[?#&\s])/.test(text) || text.includes('.ogv')) return 'video/ogg';
      } catch (e) {}
      return '';
    }

    function getVideoEmbedUrl(value) {
      const href = safeUrl(value);
      if (!href || getDirectVideoType(href)) return '';
      try {
        const url = new URL(href);
        const host = url.hostname.replace(/^www\./, '').toLowerCase();
        if (host === 'youtu.be') {
          const id = url.pathname.split('/').filter(Boolean)[0];
          return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : '';
        }
        if (host.endsWith('youtube.com')) {
          if (url.pathname.startsWith('/embed/')) return `${url.origin}${url.pathname}?autoplay=1&rel=0`;
          if (url.pathname.startsWith('/shorts/')) {
            const id = url.pathname.split('/').filter(Boolean)[1];
            return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : '';
          }
          const id = url.searchParams.get('v');
          return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : '';
        }
        if (host.endsWith('vimeo.com')) {
          const id = url.pathname.split('/').filter(Boolean).find(part => /^\d+$/.test(part));
          return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=1` : '';
        }
        if (host.endsWith('rutube.ru')) {
          const parts = url.pathname.split('/').filter(Boolean);
          const idx = parts.findIndex(part => part === 'video');
          const id = idx >= 0 ? parts[idx + 1] : '';
          return id ? `https://rutube.ru/play/embed/${encodeURIComponent(id)}` : '';
        }
      } catch (e) {
        return '';
      }
      return '';
    }

    function parseAltLinksText(value) {
      return String(value || '')
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, idx) => {
          const match = line.match(/^(.*?)(?:\s+[—-]\s+|\s*\|\s*)(https?:\/\/\S+)$/i);
          const rawUrl = match ? match[2] : line;
          const url = safeUrl(rawUrl);
          if (!url) return null;
          const label = match && match[1].trim() ? match[1].trim() : `Ссылка ${idx + 1}`;
          return { label, url };
        })
        .filter(Boolean)
        .slice(0, 12);
    }

    function formatAltLinksText(links) {
      return (Array.isArray(links) ? links : [])
        .map((link, idx) => {
          const url = safeUrl(link?.url || link);
          if (!url) return '';
          const label = String(link?.label || `Ссылка ${idx + 1}`).trim();
          return `${label} — ${url}`;
        })
        .filter(Boolean)
        .join('\n');
    }

    function getAltLinkValues(openingId) {
      const row = eventAltLinks.get(String(openingId)) || {};
      let youtubeUrl = safeUrl(row.youtubeUrl || row.youtube || '');
      let vkUrl = safeUrl(row.vkUrl || row.vk || '');
      if (Array.isArray(row.links)) {
        row.links.forEach(link => {
          const url = safeUrl(link?.url || link);
          if (!url) return;
          const label = String(link?.label || '').toLowerCase();
          let host = '';
          try { host = new URL(url).hostname.toLowerCase(); } catch (_) { host = ''; }
          if (!youtubeUrl && (label.includes('youtube') || host.includes('youtube.com') || host.includes('youtu.be'))) youtubeUrl = url;
          if (!vkUrl && (label.includes('вк') || label.includes('vk') || host.includes('vk.com') || host.includes('vkvideo.ru'))) vkUrl = url;
        });
      }
      return { youtubeUrl, vkUrl };
    }

    function getAltLinks(openingId) {
      const { youtubeUrl, vkUrl } = getAltLinkValues(openingId);
      return [
        youtubeUrl ? { label: 'YouTube', url: youtubeUrl } : null,
        vkUrl ? { label: 'ВК', url: vkUrl } : null
      ].filter(Boolean);
    }

    async function saveAltLinks(openingId, values) {
      const id = String(openingId || '');
      if (!id) return;
      const youtubeUrl = safeUrl(values?.youtubeUrl || '');
      const vkUrl = safeUrl(values?.vkUrl || '');
      const links = [
        youtubeUrl ? { label: 'YouTube', url: youtubeUrl } : null,
        vkUrl ? { label: 'ВК', url: vkUrl } : null
      ].filter(Boolean);
      const payload = {
        openingId: id,
        youtubeUrl,
        vkUrl,
        links,
        updatedBy: myName || '',
        updatedAtLocal: new Date().toISOString()
      };
      eventAltLinks.set(id, { id, ...payload });
      scheduleRender();
      if (!LOCAL_EVENTS_MODE) {
        await setDoc(doc(db, 'eventAltLinks', id), {
          ...payload,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    }

    function renderVideoBlock(opening) {
      const img = opening.image ? `<img class="oc-track-image" src="${escapeHtml(opening.image)}" alt="" referrerpolicy="no-referrer" />` : 'Нет картинки';
      const href = safeUrl(opening.link);
      const directType = getDirectVideoType(href);
      const embed = directType ? '' : getVideoEmbedUrl(href);
      if (!href) return `<div class="ev-image">${img}</div>`;
      return `
        <button type="button" class="ev-video-cover" data-video-url="${escapeHtml(href)}" data-video-type="${escapeHtml(directType)}" data-embed-url="${escapeHtml(embed)}" title="Запустить видео">
          <div class="ev-image">${img}</div>
        </button>
      `;
    }

    function renderAltLinksBlock(openingId) {
      const links = getAltLinks(openingId);
      const values = getAltLinkValues(openingId);
      const linksHtml = links.length
        ? `<div class="ev-alt-list">${links.map(link => `<a href="${escapeHtml(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">↗ ${escapeHtml(link.label)}</a>`).join('')}</div>`
        : '<div class="ev-hint">Альтернативные ссылки пока не добавлены.</div>';
      const adminEdit = isAdmin()
        ? `
          <div class="ev-alt-edit open" id="ev-alt-edit">
            <label class="ev-field">YouTube
              <input id="ev-alt-youtube" type="url" placeholder="https://youtube.com/..." value="${escapeHtml(values.youtubeUrl || '')}" />
            </label>
            <label class="ev-field" style="margin-top:8px;">ВК
              <input id="ev-alt-vk" type="url" placeholder="https://vk.com/..." value="${escapeHtml(values.vkUrl || '')}" />
            </label>
            <div class="ev-modal-actions" style="justify-content:flex-start;margin-top:10px;">
              <button type="button" class="ev-btn-secondary" id="ev-alt-save">Сохранить ссылки</button>
            </div>
            <div class="ev-error" id="ev-alt-error"></div>
          </div>
        `
        : '';
      if (!links.length && !isAdmin()) return '';
      return `
        <section class="ev-alt-links">
          <div class="ev-alt-title">Альтернативные ссылки</div>
          ${linksHtml}
          ${adminEdit}
        </section>
      `;
    }

    function seasonDefaultOpeningIds(season) {
      return openings
        .filter(o => o.type === 'OP' && Number(o.year) === CURRENT_EVENT_YEAR && o.season === season)
        .sort((a, b) => getOpeningTitle(a).localeCompare(getOpeningTitle(b), 'ru', { sensitivity: 'base' }))
        .slice(0, 15)
        .map(o => String(o.id));
    }

    function getSeasonState(season) {
      const key = seasonKey(season);
      const docData = seasonDocs.get(key) || {};
      const selectedOpeningIds = Array.isArray(docData.selectedOpeningIds)
        ? docData.selectedOpeningIds.map(String).filter(id => openingsById.has(id)).slice(0, 20)
        : [];
      return {
        key,
        year: CURRENT_EVENT_YEAR,
        season,
        stage: 'first',
        closed: !!docData.closed,
        allowedNicknames: cleanParticipantSlots(docData.allowedNicknames || []),
        selectedOpeningIds,
        basketTarget: [10, 15, 20].includes(Number(docData.basketTarget)) ? Number(docData.basketTarget) : getBasketState(season).target,
        semifinalOpeningIds: Array.isArray(docData.semifinalOpeningIds) ? docData.semifinalOpeningIds.map(String).filter(id => openingsById.has(id)) : [],
        semifinalTieWinnerIds: Array.isArray(docData.semifinalTieWinnerIds) ? docData.semifinalTieWinnerIds.map(String) : []
      };
    }

    function getSeasonRatings(key) {
      return eventRatings.filter(r => String(r.seasonKey || '') === key && String(r.stage || 'first') === 'first');
    }

    function eventRatingNickname(state) {
      if (isAdminGuestPreview()) return getGuestNicknameForSeason(state);
      return myName;
    }

    function getMyEventRating(key, openingId) {
      const state = SEASONS.map(season => getSeasonState(season)).find(row => String(row.key) === String(key))
        || (String(key).startsWith('ending_') ? endingPeriodState(String(key).endsWith('_h2') ? 'h2' : 'h1') : null);
      const myKey = normalizeNickname(eventRatingNickname(state));
      if (!myKey) return null;
      return eventRatings.find(r => String(r.seasonKey || '') === key && String(r.openingId || '') === String(openingId) && String(r.nicknameKey || '') === myKey) || null;
    }

    function isAllowedForSeason(state) {
      const guestNick = getGuestNicknameForSeason(state);
      const guestKey = normalizeNickname(guestNick);
      if (!guestKey || state.closed || !isGuest()) return false;
      if (isAdminGuestPreview()) return true;
      return guestKey === normalizeNickname(myName);
    }

    function avgForOpeningInSeason(key, openingId) {
      const rows = getSeasonRatings(key).filter(r => String(r.openingId || '') === String(openingId) && typeof Number(r.score) === 'number' && !Number.isNaN(Number(r.score)));
      if (!rows.length) return null;
      const avg = rows.reduce((sum, r) => sum + Number(r.score), 0) / rows.length;
      return { avg, count: rows.length };
    }

    function sumForOpeningInSeason(key, openingId) {
      const rows = getSeasonRatings(key).filter(r => String(r.openingId || '') === String(openingId) && Number.isFinite(Number(r.score)));
      const total = rows.reduce((sum, r) => sum + Number(r.score), 0);
      return { total, count: rows.length };
    }

    function getParticipantRatingProgress(state) {
      const selectedIds = (state?.selectedOpeningIds || []).map(String).filter(id => openingsById.has(id));
      const selectedSet = new Set(selectedIds);
      const ratings = getSeasonRatings(state?.key);
      const byUser = new Map();
      ratings.forEach(row => {
        const nicknameKey = String(row?.nicknameKey || normalizeNickname(row?.nickname || ''));
        const openingId = String(row?.openingId || '');
        if (!nicknameKey || !selectedSet.has(openingId) || !Number.isFinite(Number(row?.score))) return;
        if (!byUser.has(nicknameKey)) byUser.set(nicknameKey, new Set());
        byUser.get(nicknameKey).add(openingId);
      });
      return cleanParticipantSlots(state?.allowedNicknames || []).map((nickname, idx) => {
        const nicknameKey = normalizeNickname(nickname);
        const done = nicknameKey && byUser.has(nicknameKey) ? byUser.get(nicknameKey).size : 0;
        const total = selectedIds.length;
        return {
          idx,
          nickname,
          nicknameKey,
          ownerUid: currentActorUid(),
          done,
          total,
          complete: !!nicknameKey && total > 0 && done >= total
        };
      });
    }

    function getUserSeasonCompletion(state, nicknameKey, extraRows = []) {
      const selectedIds = (state?.selectedOpeningIds || []).map(String).filter(id => openingsById.has(id));
      const selectedSet = new Set(selectedIds);
      const key = String(nicknameKey || '');
      if (!key || !selectedIds.length) return { done: 0, total: selectedIds.length, complete: false };
      const done = new Set();
      [...getSeasonRatings(state?.key), ...extraRows].forEach(row => {
        const rowKey = String(row?.nicknameKey || normalizeNickname(row?.nickname || ''));
        const openingId = String(row?.openingId || '');
        if (rowKey === key && selectedSet.has(openingId) && Number.isFinite(Number(row?.score))) {
          done.add(openingId);
        }
      });
      return { done: done.size, total: selectedIds.length, complete: done.size >= selectedIds.length };
    }

    function isUserSeasonComplete(state, nicknameKey) {
      return getUserSeasonCompletion(state, nicknameKey).complete;
    }

    function isEgortosNoticeReceiver() {
      const key = normalizeNickname(myName);
      return key === 'egortos' || key === 'gortos';
    }

    async function maybeCreateSeasonCompletionNotice(state, nicknameKey, ratingRow, wasComplete) {
      if (LOCAL_EVENTS_MODE || isAdmin() || isAdminGuestPreview() || wasComplete) return;
      const progress = getUserSeasonCompletion(state, nicknameKey, [ratingRow]);
      if (!progress.complete) return;
      const seasonLabel = SEASON_LABEL[state.season] || state.season;
      const year = state.year || CURRENT_EVENT_YEAR;
      const nickname = String(ratingRow?.nickname || myName || nicknameKey || '').trim() || nicknameKey;
      const siteUrl = `${window.location.origin}${window.location.pathname}`;
      const noticeId = `seasonComplete__${state.key}__${nicknameKey}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
      try {
        await setDoc(doc(db, 'eventNotifications', noticeId), {
          eventType: 'season-complete',
          seasonKey: state.key,
          season: state.season,
          seasonLabel,
          year,
          nickname,
          nicknameKey,
          ratingCount: progress.done,
          totalRatings: progress.total,
          siteUrl,
          acknowledged: false,
          createdAtLocal: new Date().toISOString(),
          createdAt: serverTimestamp()
        }, { merge: false });
      } catch (e) {
        console.error('season completion notice failed', e);
      }
    }

    function maybeShowCompletionNotice() {
      if (LOCAL_EVENTS_MODE || noticePopupOpen || !isEgortosNoticeReceiver()) return;
      const notices = Array.from(eventNotifications.values())
        .filter(row => row?.eventType === 'season-complete' && !row?.acknowledged && !locallyHandledNoticeIds.has(String(row.id)))
        .sort((a, b) => String(a.createdAtLocal || '').localeCompare(String(b.createdAtLocal || '')));
      const notice = notices[0];
      if (!notice) return;
      noticePopupOpen = true;
      locallyHandledNoticeIds.add(String(notice.id));
      setTimeout(async () => {
        const seasonLabel = notice.seasonLabel || SEASON_LABEL[notice.season] || notice.season || 'сезон';
        const year = notice.year || CURRENT_EVENT_YEAR;
        const ratingCount = notice.ratingCount || notice.totalRatings || 0;
        const title = `${notice.nickname || 'Пользователь'} добавил оценки: ${ratingCount} OP · ${seasonLabel} ${year}`;
        const text = `${title}\n\nОткрой страницу ивентов, чтобы проверить оценки.`;
        alert(text);
        try {
          await setDoc(doc(db, 'eventNotifications', String(notice.id)), {
            acknowledged: true,
            acknowledgedBy: myName || 'Egortos',
            acknowledgedByKey: normalizeNickname(myName || 'Egortos'),
            acknowledgedAtLocal: new Date().toISOString(),
            acknowledgedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.error('notice acknowledge failed', e);
        } finally {
          noticePopupOpen = false;
          setTimeout(maybeShowCompletionNotice, 100);
        }
      }, 50);
    }

    function getCompletedParticipantCount(state) {
      return getParticipantRatingProgress(state).filter(row => row.complete).length;
    }

    function getChanceRequirement(rows, candidateId, slotCount, totalVoters = 15) {
      const candidate = (rows || []).find(row => String(row.id) === String(candidateId));
      if (!candidate || slotCount <= 0) return null;
      const remaining = Math.max(0, totalVoters - Number(candidate.count || 0));
      // Для предварительного списка считаем лучший сценарий для кандидата:
      // он добирает нужные баллы, а конкуренты теоретически могут получить минимум
      // за оставшиеся оценки. Если даже так не догнать границу, шанс потерян.
      const otherMinimums = (rows || [])
        .filter(row => String(row.id) !== String(candidateId))
        .map(row => Number(row.total || 0) + Math.max(0, totalVoters - Number(row.count || 0)))
        .sort((a, b) => b - a);
      const thresholdIndex = Math.max(0, Math.min(slotCount, otherMinimums.length) - 1);
      const threshold = otherMinimums.length >= slotCount ? otherMinimums[thresholdIndex] : 0;
      const unavoidableMinimum = remaining;
      const needed = Math.max(unavoidableMinimum, threshold - Number(candidate.total || 0));
      const maximum = remaining * 10;
      if (needed > maximum) return null;
      return {
        remaining,
        needed: Math.max(0, Math.ceil(needed)),
        maximum,
        threshold,
        average: remaining > 0 ? Math.max(0, needed) / remaining : 0
      };
    }

    function getSeasonPotentialWinnerRows(state) {
      const completedParticipants = getCompletedParticipantCount(state);
      if (completedParticipants < 10 || isSeasonFullyRated(state)) return { completedParticipants, rows: [] };
      const winnerCount = getWinnerCountForSeason(state);
      const rows = (state.selectedOpeningIds || [])
        .map(id => {
          const opening = openingsById.get(String(id));
          const score = sumForOpeningInSeason(state.key, id);
          return { id: String(id), title: opening?.title || String(id), total: score.total, count: score.count };
        })
        .sort((a, b) => (b.total - a.total) || a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }))
        .slice(0, winnerCount);
      return { completedParticipants, winnerCount, rows };
    }

    function getWinnerCountForSeason(state) {
      const rawTarget = Number(state?.basketTarget || getBasketState(state?.season || activeSeason).target || 15);
      return WINNER_COUNT_BY_TARGET[rawTarget] || 3;
    }

    function getWildcardSlotCountForSeason(state) {
      const rawTarget = Number(state?.basketTarget || getBasketState(state?.season || activeSeason).target || 15);
      return WILDCARD_SLOT_COUNT_BY_TARGET[rawTarget] || 0;
    }


    function isSeasonConfirmedForWildcard(state) {
      return Array.isArray(state?.selectedOpeningIds) && state.selectedOpeningIds.length > 0;
    }

    function getAllWildcardStates() {
      return SEASONS.map(season => getSeasonState(season));
    }

    function getConfirmedWildcardStates() {
      return getAllWildcardStates().filter(state => isSeasonConfirmedForWildcard(state));
    }

    function getPotentialWildcardDisplayLimit(states = null) {
      const baseStates = Array.isArray(states) ? states : getAllWildcardStates();
      const total = BASE_WILDCARD_SLOT_COUNT + baseStates.reduce((sum, state) => {
        return sum + (isSeasonConfirmedForWildcard(state)
          ? getWildcardSlotCountForSeason(state)
          : MAX_WILDCARD_SLOT_COUNT_PER_UNKNOWN_SEASON);
      }, 0);
      return Math.max(BASE_WILDCARD_SLOT_COUNT, Math.min(10, total));
    }

    function getSemifinalMeta() {
      return seasonDocs.get(SEMIFINAL_META_KEY) || {};
    }

    function saveSemifinalMeta(patch) {
      return saveLocalSeasonDoc(SEMIFINAL_META_KEY, {
        stage: 'semi',
        year: CURRENT_EVENT_YEAR,
        metaKey: SEMIFINAL_META_KEY,
        ...patch,
        updatedAtLocal: new Date().toISOString()
      });
    }

    function fullRatingProgress(state) {
      const slots = cleanParticipantSlots(state.allowedNicknames || []);
      const users = slots.map(normalizeNickname).filter(Boolean);
      const requiredUserCount = 15;
      const selectedIds = (state.selectedOpeningIds || []).map(String).filter(id => openingsById.has(id));
      const total = selectedIds.length * requiredUserCount;
      const allowedSet = new Set(users);
      const selectedSet = new Set(selectedIds);
      const doneSet = new Set(getSeasonRatings(state.key)
        .filter(r => allowedSet.has(String(r.nicknameKey || '')) && selectedSet.has(String(r.openingId || '')) && Number.isFinite(Number(r.score)))
        .map(r => `${r.nicknameKey}__${r.openingId}`));
      return {
        done: doneSet.size,
        total,
        userCount: users.length,
        openingCount: selectedIds.length,
        complete: selectedIds.length > 0 && users.length === requiredUserCount && doneSet.size >= total
      };
    }

    function isSeasonFullyRated(state) {
      return fullRatingProgress(state).complete;
    }

    function getSeasonWinnerPlan(state) {
      const winnerCount = getWinnerCountForSeason(state);
      const progress = fullRatingProgress(state);
      const ranked = (state.selectedOpeningIds || [])
        .map(id => {
          const opening = openingsById.get(String(id));
          const sum = sumForOpeningInSeason(state.key, id);
          return {
            id: String(id),
            title: opening ? opening.title : String(id),
            total: sum.total,
            count: sum.count
          };
        })
        .sort((a, b) => (b.total - a.total) || a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }));
      if (!ranked.length) return { winnerCount, ranked: [], auto: [], candidates: [], chosen: [], finalIds: [], needManual: 0, ready: false, complete: false, progress };
      if (!progress.complete) {
        const saved = Array.isArray(state.semifinalOpeningIds) ? state.semifinalOpeningIds.map(String).filter(id => openingsById.has(id)) : [];
        return { winnerCount, ranked, auto: [], candidates: [], chosen: [], finalIds: saved, needManual: 0, ready: false, complete: false, progress };
      }
      const cutoff = ranked[Math.min(winnerCount, ranked.length) - 1]?.total ?? 0;
      const auto = ranked.filter(row => row.total > cutoff);
      const tiedAtCutoff = ranked.filter(row => row.total === cutoff);
      const slotsForTie = Math.max(0, Math.min(winnerCount, ranked.length) - auto.length);
      const savedChosen = Array.isArray(state.semifinalTieWinnerIds) ? state.semifinalTieWinnerIds.map(String) : [];
      let candidates = [];
      let chosen = [];
      if (tiedAtCutoff.length <= slotsForTie) {
        chosen = tiedAtCutoff.slice(0, slotsForTie);
      } else {
        candidates = tiedAtCutoff;
        const candidateSet = new Set(candidates.map(row => row.id));
        chosen = savedChosen.filter(id => candidateSet.has(String(id))).slice(0, slotsForTie).map(id => candidates.find(row => row.id === String(id))).filter(Boolean);
      }
      const finalRows = [...auto, ...chosen].slice(0, winnerCount);
      return {
        winnerCount,
        ranked,
        auto,
        candidates,
        chosen,
        finalIds: finalRows.map(row => row.id),
        needManual: candidates.length ? slotsForTie : 0,
        ready: finalRows.length === Math.min(winnerCount, ranked.length),
        complete: true,
        progress
      };
    }

    function getDirectSemifinalIdsForState(state) {
      const saved = Array.isArray(state.semifinalOpeningIds) ? state.semifinalOpeningIds.map(String).filter(id => openingsById.has(id)) : [];
      if (saved.length) return saved;
      const plan = getSeasonWinnerPlan(state);
      return plan.ready ? plan.finalIds : [];
    }

    function getAllSemifinalRows() {
      const direct = SEASONS.flatMap(season => {
        const state = getSeasonState(season);
        const ids = getDirectSemifinalIdsForState(state);
        return ids.map((id, idx) => {
          const sum = sumForOpeningInSeason(state.key, id);
          return { source: 'direct', season, seasonKey: state.key, id, idx, total: sum.total, count: sum.count };
        });
      });
      const meta = getSemifinalMeta();
      const wildcardPlan = getSemifinalWildcardPlan();
      const computedWildcards = wildcardPlan.ready ? wildcardPlan.finalIds : [];
      const savedWildcards = Array.isArray(meta.wildcardOpeningIds) ? meta.wildcardOpeningIds.map(String).filter(id => openingsById.has(id)) : [];
      const wildcards = (computedWildcards.length ? computedWildcards : savedWildcards)
        .filter((id, idx, arr) => arr.indexOf(String(id)) === idx);
      const wildcardRows = wildcards.map((id, idx) => {
        const origin = findOpeningSeasonState(id);
        const sum = origin ? sumForOpeningInSeason(origin.key, id) : { total: 0, count: 0 };
        return { source: 'wildcard', season: origin?.season || '', seasonKey: origin?.key || '', id, idx, total: sum.total, count: sum.count };
      });
      const lockedForEgortos = getSemifinalLockedIds();
      const egortos = Array.isArray(meta.egortosSelectedIds) ? meta.egortosSelectedIds.map(String).filter(id => openingsById.has(id) && !lockedForEgortos.has(String(id))) : [];
      const egortosRows = egortos.map((id, idx) => {
        const origin = findOpeningSeasonState(id);
        const sum = origin ? sumForOpeningInSeason(origin.key, id) : { total: 0, count: 0 };
        return { source: 'egortos', season: origin?.season || '', seasonKey: origin?.key || '', id, idx, total: sum.total, count: sum.count };
      });
      return [...direct, ...wildcardRows, ...egortosRows];
    }

    function findOpeningSeasonState(openingId) {
      const id = String(openingId);
      return SEASONS.map(season => getSeasonState(season)).find(state => (state.selectedOpeningIds || []).map(String).includes(id)) || null;
    }

    function getSemifinalWildcardPlan() {
      const meta = getSemifinalMeta();
      const allStates = getAllWildcardStates();
      const confirmedStates = allStates.filter(state => isSeasonConfirmedForWildcard(state));
      const completedStates = confirmedStates.filter(state => isSeasonFullyRated(state));

      // plan.slots — это максимально возможное число дополнительных слотов по сетке:
      // базовые 2 + уже известные бонусы подтверждённых сезонов + максимум (+2) за ещё неизвестные сезоны.
      // Даже если гарантированно сейчас доступно меньше, показываем список до этого максимума,
      // чтобы не казалось, что потенциальные слоты пропали.
      const slots = getPotentialWildcardDisplayLimit(allStates);
      const earnedSlots = completedStates.length
        ? Math.min(slots, BASE_WILDCARD_SLOT_COUNT + completedStates.reduce((sum, state) => sum + getWildcardSlotCountForSeason(state), 0))
        : 0;

      const directSet = new Set();
      completedStates.forEach(state => getDirectSemifinalIdsForState(state).forEach(id => directSet.add(String(id))));

      const completedPool = completedStates.flatMap(state => (state.selectedOpeningIds || [])
        .map(String)
        .filter(id => openingsById.has(id) && !directSet.has(id))
        .map(id => {
          const opening = openingsById.get(id);
          const score = sumForOpeningInSeason(state.key, id);
          return {
            id,
            season: state.season,
            seasonKey: state.key,
            title: opening?.title || id,
            total: score.total,
            count: score.count,
            potential: false
          };
        }))
        .filter((row, idx, arr) => arr.findIndex(x => String(x.id) === String(row.id)) === idx)
        .sort((a, b) => (b.total - a.total) || a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }));

      const effectiveEarnedSlots = Math.min(earnedSlots, completedPool.length);
      const displayLimit = Math.min(slots, completedPool.length);
      let above = [];
      let tie = [];
      let below = completedPool.slice();
      let overflow = 0;
      let excluded = [];
      let guaranteedRows = [];
      let finalIds = [];
      let ready = effectiveEarnedSlots === 0;

      if (effectiveEarnedSlots > 0) {
        const cutoff = completedPool[effectiveEarnedSlots - 1]?.total ?? 0;
        above = completedPool.filter(row => row.total > cutoff);
        tie = completedPool.filter(row => row.total === cutoff);
        below = completedPool.filter(row => row.total < cutoff);
        const tieIds = new Set(tie.map(row => row.id));
        overflow = Math.max(0, above.length + tie.length - effectiveEarnedSlots);
        excluded = Array.isArray(meta.wildcardExcludedIds)
          ? meta.wildcardExcludedIds.map(String).filter(id => tieIds.has(id)).slice(0, overflow)
          : [];
        const excludedSet = new Set(excluded);
        const included = [...above, ...tie.filter(row => !excludedSet.has(row.id))];
        finalIds = included.slice(0, effectiveEarnedSlots).map(row => row.id);
        ready = overflow === 0 || excluded.length === overflow;
        guaranteedRows = overflow > 0 ? [...above, ...tie] : completedPool.slice(0, effectiveEarnedSlots);
      }

      const guaranteedDisplayIds = new Set(guaranteedRows.map(row => row.id));
      const visibleRows = completedPool.slice(0, displayLimit).map((row, idx) => ({
        ...row,
        potential: idx >= effectiveEarnedSlots && !guaranteedDisplayIds.has(row.id)
      }));
      // Если на границе гарантированного прохода ничья, гарантированные строки могут быть шире,
      // чем обычный срез. Сохраняем всю спорную группу в отображении, а затем добиваем список
      // до максимального числа потенциальных слотов.
      if (guaranteedRows.length > visibleRows.length) {
        const visibleIds = new Set(visibleRows.map(row => row.id));
        guaranteedRows.forEach(row => {
          if (!visibleIds.has(row.id)) visibleRows.push({ ...row, potential: false });
        });
      }

      return {
        slots,
        earnedSlots,
        displayLimit,
        confirmedStates,
        completedStates,
        partialStates: [],
        allConfirmedComplete: confirmedStates.length > 0 && completedStates.length === confirmedStates.length,
        directSet,
        ranked: completedPool,
        visibleRows,
        potentialRows: visibleRows.filter(row => row.potential),
        above,
        tie,
        below,
        included: ready ? completedPool.filter(row => finalIds.includes(row.id)) : above,
        excluded,
        finalIds: ready ? finalIds : [],
        overflow,
        ready,
        savedIds: Array.isArray(meta.wildcardOpeningIds) ? meta.wildcardOpeningIds.map(String).filter(id => openingsById.has(id)) : []
      };
    }

    function toggleWildcardExclusion(openingId) {
      if (!bwIsHost()) return;
      const plan = getSemifinalWildcardPlan();
      if (!plan.overflow) return;
      const id = String(openingId);
      const tieIds = new Set(plan.tie.map(row => row.id));
      if (!tieIds.has(id)) return;
      let excluded = plan.excluded.slice();
      if (excluded.includes(id)) excluded = excluded.filter(x => x !== id);
      else if (excluded.length < plan.overflow) excluded.push(id);
      saveSemifinalMeta({ wildcardExcludedIds: excluded });
    }

    function saveWildcardSemifinalBasket() {
      if (!isAdmin()) return;
      const plan = getSemifinalWildcardPlan();
      const expected = Math.min(plan.earnedSlots || 0, plan.ranked.length);
      if (!expected) {
        alert('Пока нет полностью оценённого сезона, из которого можно сохранить гарантированные дополнительные проходы.');
        return;
      }
      if (!plan.ready || plan.finalIds.length !== expected) {
        alert('Сначала нужно исключить лишние OP на границе прохода, чтобы гарантированных проходящих осталось ровно столько, сколько уже доступно слотов.');
        return;
      }
      saveSemifinalMeta({
        wildcardOpeningIds: plan.finalIds,
        wildcardExcludedIds: plan.excluded,
        wildcardSavedAtLocal: new Date().toISOString()
      });
    }


    function getSemifinalLockedIds() {
      const locked = new Set();
      SEASONS.forEach(season => {
        getDirectSemifinalIdsForState(getSeasonState(season)).forEach(id => locked.add(String(id)));
      });
      const meta = getSemifinalMeta();
      const wildcardPlan = getSemifinalWildcardPlan();
      const wildcardIds = wildcardPlan.ready && wildcardPlan.finalIds.length
        ? wildcardPlan.finalIds
        : (Array.isArray(meta.wildcardOpeningIds) ? meta.wildcardOpeningIds : []);
      wildcardIds.forEach(id => {
        if (openingsById.has(String(id))) locked.add(String(id));
      });
      return locked;
    }

    function getEgortosPickPlan() {
      const meta = getSemifinalMeta();
      const locked = getSemifinalLockedIds();
      const seen = new Set();
      const candidates = [];
      SEASONS.forEach(season => {
        const state = getSeasonState(season);
        (state.selectedOpeningIds || []).map(String).filter(id => openingsById.has(id)).forEach(id => {
          if (locked.has(id) || seen.has(id)) return;
          seen.add(id);
          const opening = openingsById.get(id);
          const score = sumForOpeningInSeason(state.key, id);
          candidates.push({
            id,
            season,
            seasonKey: state.key,
            title: opening?.title || id,
            total: score.total,
            count: score.count
          });
        });
      });
      candidates.sort((a, b) =>
        (Number(b.total) || 0) - (Number(a.total) || 0) ||
        a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }) ||
        String(a.id).localeCompare(String(b.id))
      );
      const candidateIds = new Set(candidates.map(row => row.id));
      const selectedIds = (Array.isArray(meta.egortosSelectedIds) ? meta.egortosSelectedIds : [])
        .map(String)
        .filter(id => candidateIds.has(id))
        .filter((id, idx, arr) => arr.indexOf(id) === idx)
        .slice(0, 2);
      return { candidates, selectedIds, locked, ready: selectedIds.length === 2 };
    }

    function saveEgortosPicks(ids) {
      if (!isAdmin()) return;
      const plan = getEgortosPickPlan();
      const candidateIds = new Set(plan.candidates.map(row => row.id));
      const cleanIds = (ids || [])
        .map(String)
        .filter(id => candidateIds.has(id))
        .filter((id, idx, arr) => arr.indexOf(id) === idx)
        .slice(0, 2);
      if (cleanIds.length !== 2) {
        alert('Нужно выбрать ровно 2 разных OP для слотов Egortos.');
        return;
      }
      saveSemifinalMeta({
        egortosSelectedIds: cleanIds,
        egortosSelectedAtLocal: new Date().toISOString()
      });
    }

    function saveSemifinalWinners(state, ids, extra = {}) {
      const cleanIds = (ids || []).map(String).filter(id => openingsById.has(id));
      saveLocalSeasonDoc(state.key, {
        stage: 'first',
        year: state.year,
        season: state.season,
        seasonKey: state.key,
        allowedNicknames: state.allowedNicknames,
        selectedOpeningIds: state.selectedOpeningIds,
        closed: state.closed,
        basketTarget: state.basketTarget || getBasketState(state.season).target,
        semifinalOpeningIds: cleanIds,
        ...extra
      });
    }

    function toggleTieWinner(state, openingId) {
      if (!isAdmin()) return;
      const plan = getSeasonWinnerPlan(state);
      if (!plan.complete) { alert('Сначала должны быть проставлены все 15 оценок по сезону.'); return; }
      if (!plan.candidates.length || !plan.needManual) return;
      const id = String(openingId);
      const candidateIds = new Set(plan.candidates.map(row => row.id));
      if (!candidateIds.has(id)) return;
      let chosenIds = Array.isArray(state.semifinalTieWinnerIds) ? state.semifinalTieWinnerIds.map(String).filter(x => candidateIds.has(x)) : [];
      if (chosenIds.includes(id)) chosenIds = chosenIds.filter(x => x !== id);
      else if (chosenIds.length < plan.needManual) chosenIds.push(id);
      const tempState = { ...state, semifinalTieWinnerIds: chosenIds };
      const nextPlan = getSeasonWinnerPlan(tempState);
      saveSemifinalWinners(state, nextPlan.finalIds, {
        semifinalTieWinnerIds: chosenIds,
        semifinalUpdatedAtLocal: new Date().toISOString()
      });
    }

    function recalcSemifinalWinners(state) {
      if (!isAdmin()) return;
      const plan = getSeasonWinnerPlan(state);
      if (!plan.complete) { alert('Сначала должны быть проставлены все 15 оценок по сезону.'); return; }
      if (plan.candidates.length && !plan.ready) {
        alert(`На границе прохода ничья. Сначала выбери ${plan.needManual} OP через «это победитель». Кнопка не добавляет всю спорную группу целиком.`);
        return;
      }
      const candidateSet = new Set(plan.candidates.map(row => row.id));
      const chosenIds = plan.candidates.length
        ? (state.semifinalTieWinnerIds || []).map(String).filter(id => candidateSet.has(id)).slice(0, plan.needManual)
        : [];
      saveSemifinalWinners(state, plan.finalIds, {
        semifinalTieWinnerIds: chosenIds,
        semifinalUpdatedAtLocal: new Date().toISOString()
      });
    }

    function ratingProgress(state) {
      const ratings = getSeasonRatings(state.key);
      const users = state.allowedNicknames.map(normalizeNickname).filter(Boolean);
      const total = state.selectedOpeningIds.length * users.length;
      const doneSet = new Set(ratings.filter(r => state.selectedOpeningIds.includes(String(r.openingId || ''))).map(r => `${r.nicknameKey}__${r.openingId}`));
      return { done: doneSet.size, total };
    }

    function scheduleFirebaseRender(source = 'other') {
      if (activeMode === 'whoami' && source !== 'whoami' && source !== 'openings-initial') return;
      scheduleRender();
    }

    function scheduleRender() {
      clearTimeout(renderTimer);
      renderTimer = setTimeout(() => { renderTimer = null; render(); }, 60);
    }


    function bwClamp(value, min, max, fallback) {
      const number = Number(value);
      if (!Number.isFinite(number)) return fallback;
      return Math.max(min, Math.min(max, Math.round(number)));
    }

    function normalizeBestWorstSettings(raw = {}) {
      const mode = ['best', 'worst', 'both'].includes(raw.mode) ? raw.mode : 'both';
      const typeFilter = ['OP', 'ED', 'both'].includes(raw.typeFilter) ? raw.typeFilter : 'OP';
      const grouping = ['none', 'year', 'yearSeason', 'performer', 'director', 'studio', 'franchise'].includes(raw.grouping) ? raw.grouping : 'none';
      const content = ['default', 'chinese', 'movie', 'shortened', 'chinese-movie', 'chinese-shortened', 'movie-shortened', 'all'].includes(raw.content) ? raw.content : 'all';
      const range = normalizeSeasonRange(raw);
      return {
        mode,
        typeFilter,
        perRound: bwClamp(raw.perRound, 2, 20, 6),
        rounds: bwClamp(raw.rounds, 1, 20, 5),
        grouping,
        banDraft: Boolean(raw.banDraft),
        ...range,
        excludedEntities: normalizeGameExclusions(raw),
        content,
        source: raw.source === 'all' ? 'all' : 'ratings',
        users: Array.isArray(raw.users) ? [...new Set(raw.users.map(normalizeNickname).filter(Boolean))] : [],
        scoreLogic: raw.scoreLogic === 'or' ? 'or' : 'and',
        scoreOverallCmp: ['gte','gt','eq','lte','lt'].includes(raw.scoreOverallCmp) ? raw.scoreOverallCmp : 'gte',
        scoreOverallValue: raw.scoreOverallValue === '' || raw.scoreOverallValue == null ? '' : Number(raw.scoreOverallValue),
        scoreSongCmp: ['gte','gt','eq','lte','lt'].includes(raw.scoreSongCmp) ? raw.scoreSongCmp : 'gte',
        scoreSongValue: raw.scoreSongValue === '' || raw.scoreSongValue == null ? '' : Number(raw.scoreSongValue),
        scoreVisualCmp: ['gte','gt','eq','lte','lt'].includes(raw.scoreVisualCmp) ? raw.scoreVisualCmp : 'gte',
        scoreVisualValue: raw.scoreVisualValue === '' || raw.scoreVisualValue == null ? '' : Number(raw.scoreVisualValue)
      };
    }

    function bwCurrentSettings() {
      const source = isAdmin() && (!bestWorstRoom || bestWorstRoom.status === 'lobby') ? bestWorstFilters : (bestWorstRoom?.settings || bestWorstFilters);
      return normalizeBestWorstSettings(source);
    }

    function bwCurrentUserKey() {
      return normalizeNickname(myName);
    }

    function bwPlayers(room = bestWorstRoom) {
      return Array.isArray(room?.players)
        ? room.players.map(player => ({ key: normalizeNickname(player?.key || player?.name), name: String(player?.name || player?.key || '').trim(), ready: Boolean(player?.ready) })).filter(player => player.key && player.name)
        : [];
    }

    function bwReadyPlayers(room = bestWorstRoom) {
      return bwPlayers(room).filter(player => player.ready);
    }

    function bwModeUses(settings, kind) {
      return settings.mode === 'both' || settings.mode === kind;
    }

    function bwModeLabel(mode) {
      if (mode === 'best') return 'Только лучшее';
      if (mode === 'worst') return 'Только худшее';
      return 'Лучшее и худшее';
    }

    function bwTypeLabel(typeFilter) {
      if (typeFilter === 'ED') return 'Только эндинги';
      if (typeFilter === 'both') return 'Опенинги и эндинги';
      return 'Только опенинги';
    }

    function bwGroupingLabel(grouping) {
      return ({ none: 'Без группировки', year: 'По году', yearSeason: 'По году и сезону', performer: 'По исполнителю', director: 'По режиссёру', studio: 'По студии', franchise: 'По франшизе' })[grouping] || 'Без группировки';
    }

    function bwConcreteGroupLabel(settings, round) {
      const grouping = normalizeBestWorstSettings(settings).grouping;
      const value = String(round?.groupLabel || '').trim();
      if (grouping === 'year') return { kind: 'Год', value: value || 'Не указан' };
      if (grouping === 'yearSeason') return { kind: 'Год и сезон', value: value || 'Не указаны' };
      if (grouping === 'performer') return { kind: 'Исполнитель', value: value || 'Не указан' };
      if (grouping === 'director') return { kind: 'Режиссёр', value: value || 'Не указан' };
      if (grouping === 'studio') return { kind: 'Студия', value: value || 'Не указана' };
      if (grouping === 'franchise') return { kind: 'Франшиза', value: value || 'Не указана' };
      return null;
    }

    function bwRoundRenderKey(room = bestWorstRoom) {
      if (!room || room.status !== 'playing') return '';
      const roundIndex = Number(room.currentRound || 0);
      const round = room.rounds?.[roundIndex] || {};
      const settings = normalizeBestWorstSettings(room.settings);
      const players = bwReadyPlayers(room).map(player => player.key).join(',');
      return [
        room.gameId || '', room.status || '', room.phase || '', roundIndex,
        settings.mode, settings.typeFilter, settings.grouping, settings.perRound,
        round.groupKey || '', round.groupLabel || '',
        (round.openingIds || []).join(','), players
      ].join('|');
    }

    function bwPatchRoundDraftUi() {
      const room = bestWorstRoom;
      if (!room || room.status !== 'playing' || room.phase !== 'answering') return;
      const meKey = bwCurrentUserKey();
      const own = bestWorstDraft[meKey] || {};
      document.querySelectorAll('[data-bw-opening-card]').forEach(card => {
        const openingId = String(card.dataset.openingId || '');
        card.classList.toggle('active-best', String(own.best || '') === openingId);
        card.classList.toggle('active-worst', String(own.worst || '') === openingId);
      });
      document.querySelectorAll('[data-bw-flag]').forEach(button => {
        const kind = button.dataset.bwFlag;
        const openingId = String(button.dataset.openingId || '');
        button.classList.toggle('active', String(own[kind] || '') === openingId);
      });
      document.querySelectorAll('[data-bw-answer]').forEach(select => {
        const targetKey = normalizeNickname(select.dataset.targetKey);
        const kind = select.dataset.bwAnswer;
        const row = bestWorstDraft[targetKey] || {};
        const selected = String(row[kind] || '');
        const blocked = String(row[kind === 'best' ? 'worst' : 'best'] || '');
        if (select.value !== selected) select.value = selected;
        Array.from(select.options).forEach(option => {
          option.disabled = Boolean(option.value && option.value === blocked && option.value !== selected);
        });
      });
    }

    function bwPatchRoundProgressUi() {
      const room = bestWorstRoom;
      if (!room || room.status !== 'playing') return;
      const players = bwReadyPlayers(room);
      const submittedKeys = new Set(bwRoundSubmissions(room).map(row => normalizeNickname(row.guesserKey || row.guesserName)));
      const counter = document.querySelector('#ev-bw-submitted-count strong');
      if (counter) counter.textContent = `${submittedKeys.size}/${players.length}`;
      document.querySelectorAll('[data-bw-progress-key]').forEach(item => {
        const key = normalizeNickname(item.dataset.bwProgressKey);
        const done = submittedKeys.has(key);
        item.classList.toggle('done', done);
        const name = item.dataset.bwProgressName || key;
        item.textContent = `${done ? '✓' : '…'} ${name}`;
      });
      const submit = document.querySelector('#ev-bw-submit');
      if (submit) submit.textContent = submittedKeys.has(bwCurrentUserKey()) ? 'Обновить ответ' : 'Готово';
    }

    function bwPatchRoundStatusUi() {
      const status = document.querySelector('#ev-bw-status');
      if (!status) return;
      const bad = /не удалось|нужно|сначала|не выбрано|не может|поставь/i.test(bestWorstStatus || '');
      status.classList.toggle('bad', bad);
      status.classList.toggle('ok', Boolean(bestWorstStatus) && !bad);
      status.textContent = bestWorstStatus || '';
      status.hidden = !bestWorstStatus;
    }

    function bwPatchRoundUi() {
      bwPatchRoundDraftUi();
      bwPatchRoundProgressUi();
      bwPatchRoundStatusUi();
    }

    function bwScoreConditions(settings) {
      return [
        { metric: 'score', cmp: settings.scoreOverallCmp, raw: settings.scoreOverallValue },
        { metric: 'songScore', cmp: settings.scoreSongCmp, raw: settings.scoreSongValue },
        { metric: 'visualScore', cmp: settings.scoreVisualCmp, raw: settings.scoreVisualValue }
      ].map(row => {
        if (row.raw === '' || row.raw == null) return null;
        const target = Number(row.raw);
        return Number.isFinite(target) ? { metric: row.metric, cmp: row.cmp, target } : null;
      }).filter(Boolean);
    }

    function bwRatingContext(settings) {
      const selectedUsers = new Set((settings.users || []).map(normalizeNickname).filter(Boolean));
      const allRatingUsers = new Set();
      const valuesByOpening = new Map();
      mainRatings.forEach(rating => {
        const openingId = String(rating.openingId || '');
        const userKey = normalizeNickname(rating.nicknameKey || rating.nickname || '');
        if (!openingId || !userKey) return;
        allRatingUsers.add(userKey);
        if (selectedUsers.size && !selectedUsers.has(userKey)) return;
        if (!valuesByOpening.has(openingId)) valuesByOpening.set(openingId, { score: [], songScore: [], visualScore: [], rows: [], ratingCount: 0 });
        const bucket = valuesByOpening.get(openingId);
        const row = {};
        bucket.ratingCount += 1;
        ['score', 'songScore', 'visualScore'].forEach(metric => {
          const value = Number(rating[metric]);
          if (!Number.isFinite(value)) return;
          bucket[metric].push(value);
          row[metric] = value;
        });
        bucket.rows.push(row);
      });
      const allUsersSelected = !selectedUsers.size || (allRatingUsers.size > 0 && [...allRatingUsers].every(key => selectedUsers.has(key)));
      return { selectedUsers, allUsersSelected, valuesByOpening };
    }

    function bwRatingFilterMatches(openingId, settings, context) {
      const bucket = context.valuesByOpening.get(String(openingId));
      if (!bucket || !bucket.ratingCount) return false;
      const conditions = bwScoreConditions(settings);
      if (!conditions.length) return true;
      if (context.allUsersSelected) {
        const checks = conditions.map(condition => {
          const values = bucket[condition.metric] || [];
          if (!values.length) return false;
          const average = values.reduce((sum, value) => sum + value, 0) / values.length;
          return guessCompare(average, condition.cmp, condition.target);
        });
        return settings.scoreLogic === 'or' ? checks.some(Boolean) : checks.every(Boolean);
      }
      return bucket.rows.some(row => {
        const checks = conditions.map(condition => guessCompare(Number(row[condition.metric]), condition.cmp, condition.target));
        return settings.scoreLogic === 'or' ? checks.some(Boolean) : checks.every(Boolean);
      });
    }

    function bwParticipantScoreMap(players) {
      const playerKeys = new Set((players || []).map(player => normalizeNickname(player.key || player.name)).filter(Boolean));
      const map = new Map();
      mainRatings.forEach(rating => {
        const userKey = normalizeNickname(rating.nicknameKey || rating.nickname || '');
        const openingId = String(rating.openingId || '');
        const score = Number(rating.score);
        if (!playerKeys.has(userKey) || !openingId || !Number.isFinite(score)) return;
        if (!map.has(userKey)) map.set(userKey, new Map());
        map.get(userKey).set(openingId, score);
      });
      return map;
    }

    function bwOpeningMatches(opening, settings, ratingContext) {
      if (settings.typeFilter !== 'both' && opening.type !== settings.typeFilter) return false;
      if (!getGuessPlaybackSource(opening)) return false;
      if (!openingInSeasonRange(opening, settings)) return false;
      if (openingHasExcludedEntity(opening, settings.excludedEntities)) return false;
      const content = guessContentFlags(settings.content);
      if (!content.showChinese && opening.isChinese) return false;
      if (!content.showMovie && opening.isMovie) return false;
      if (!content.showShortened && opening.isShortened) return false;
      if (settings.source === 'ratings' && !bwRatingFilterMatches(opening.id, settings, ratingContext)) return false;
      return true;
    }

    function getBestWorstCandidates(settings, players = [], requireParticipantRatings = false) {
      const normalized = normalizeBestWorstSettings(settings);
      const ratingContext = bwRatingContext(normalized);
      const scoreMap = requireParticipantRatings ? bwParticipantScoreMap(players) : null;
      return openings.filter(opening => {
        if (!bwOpeningMatches(opening, normalized, ratingContext)) return false;
        if (!requireParticipantRatings) return true;
        return players.every(player => scoreMap.get(player.key)?.has(String(opening.id)));
      });
    }

    function bwGroupBuckets(candidates, grouping) {
      const buckets = new Map();
      const add = (key, label, opening) => {
        const cleanKey = String(key || '').trim();
        if (!cleanKey) return;
        if (!buckets.has(cleanKey)) buckets.set(cleanKey, { key: cleanKey, label: String(label || cleanKey), rows: [] });
        const bucket = buckets.get(cleanKey);
        if (!bucket.rows.some(row => String(row.id) === String(opening.id))) bucket.rows.push(opening);
      };
      candidates.forEach(opening => {
        if (grouping === 'year') add(`year:${opening.year ?? 'none'}`, String(opening.year ?? 'Год не указан'), opening);
        else if (grouping === 'yearSeason') add(`ys:${opening.year ?? 'none'}:${opening.season || 'none'}`, `${opening.year ?? 'Год не указан'} · ${SEASON_LABEL[opening.season] || opening.season || 'Сезон не указан'}`, opening);
        else if (grouping === 'performer') (opening.performers || []).forEach(value => add(`performer:${normalizeGuessAnswer(value)}`, value, opening));
        else if (grouping === 'director') (opening.directors || []).forEach(value => add(`director:${normalizeGuessAnswer(value)}`, value, opening));
…68915 tokens truncated…score-${key}-cmp" ${sourceDisabled ? 'disabled' : ''}>
                      <option value="gte" ${cmp === 'gte' ? 'selected' : ''}>Больше или равно</option>
                      <option value="gt" ${cmp === 'gt' ? 'selected' : ''}>Больше</option>
                      <option value="eq" ${cmp === 'eq' ? 'selected' : ''}>Равно</option>
                      <option value="lte" ${cmp === 'lte' ? 'selected' : ''}>Меньше или равно</option>
                      <option value="lt" ${cmp === 'lt' ? 'selected' : ''}>Меньше</option>
                    </select>
                    <input id="ev-guess-score-${key}-value" type="number" min="0.5" max="10" step="0.5" value="${escapeHtml(value ?? '')}" placeholder="не учитывать" ${sourceDisabled ? 'disabled' : ''} />
                  </div>
                `).join('')}
                <span class="ev-guess-note">Пустое поле не участвует в фильтрации. Для всех пользователей используются средние оценки; при выборе отдельных аккаунтов условия проверяются по оценке каждого выбранного пользователя.</span>
              </div>
            </div>

            <div class="ev-guess-create-row">
              <div class="ev-guess-preview" id="ev-guess-preview">Под фильтры и по типу ссылки подходит: <strong>${candidates.length}</strong>. Перед запуском источники будут проверены. Планируется выбрать: <strong id="ev-guess-preview-count">${Math.min(count, candidates.length)}</strong>.</div>
              <div class="ev-actions">
                <button type="button" class="ev-btn-secondary" id="ev-guess-create-collection">Создать подборку</button>
                <button type="button" class="ev-btn-main" id="ev-guess-create" ${!candidates.length ? 'disabled' : ''}>Создать угадайку</button>
              </div>
            </div>
          </section>

          ${renderGuessCollectionBuilder(candidates, count)}

          <section class="ev-guess-results-card">
            <div class="ev-guess-card-head">
              <div>
                <h3>Выбранные песни</h3>
                <div class="ev-hint">${escapeHtml(guessMessage || 'Нажми «Создать угадайку», чтобы сформировать случайную выборку.')}</div>
              </div>
              ${resultRows.length ? `<button type="button" class="ev-btn-secondary" id="ev-guess-open-game">${canResume ? (guessGameState.completed ? 'Открыть результат' : 'Продолжить игру') : 'Начать игру'}</button>` : ''}
            </div>
            ${resultRows.length ? `<details class="ev-guess-collapse">
              <summary>Показать выбранные песни (${resultRows.length})</summary>
              <div class="ev-guess-collapse-content">
                <div class="ev-guess-result-grid">${resultRows.map(renderGuessResultCard).join('')}</div>
              </div>
            </details>` : '<div class="ev-guess-empty">Пока ничего не выбрано.</div>'}
          </section>

          ${renderSavedGuessCollections()}
        </div>
      `;
      bindGuessControls(candidates.length);
    }

    function bindGuessControls(candidateCount = 0) {
      const clearSelectionAndRender = () => {
        resetGuessGame(true);
        render();
      };
      const setAndRender = (selector, key, parser = value => value, eventName = 'change') => {
        const el = $(selector);
        if (!el) return;
        el.addEventListener(eventName, () => {
          guessFilters[key] = parser(el.value);
          if (['fromYear', 'fromSeason', 'toYear', 'toSeason'].includes(key)) Object.assign(guessFilters, normalizeSeasonRange(guessFilters));
          clearSelectionAndRender();
        });
      };

      setAndRender('#ev-guess-search', 'search', value => String(value || ''), 'change');
      setAndRender('#ev-guess-type', 'type');
      setAndRender('#ev-guess-from-year', 'fromYear', value => String(value || ''));
      setAndRender('#ev-guess-from-season', 'fromSeason');
      setAndRender('#ev-guess-to-year', 'toYear', value => String(value || ''));
      setAndRender('#ev-guess-to-season', 'toSeason');
      setAndRender('#ev-guess-content', 'content');
      bindGameExclusionSelect('#ev-guess-excluded', values => { guessFilters.excludedEntities = values; clearSelectionAndRender(); });
      setAndRender('#ev-guess-source', 'source');
      setAndRender('#ev-guess-score-overall-cmp', 'scoreOverallCmp');
      setAndRender('#ev-guess-score-song-cmp', 'scoreSongCmp');
      setAndRender('#ev-guess-score-visual-cmp', 'scoreVisualCmp');
      const optionalScore = value => {
        const raw = String(value ?? '').trim();
        if (!raw) return '';
        const number = Number(raw);
        return Number.isFinite(number) ? Math.max(.5, Math.min(10, number)) : '';
      };
      setAndRender('#ev-guess-score-overall-value', 'scoreOverallValue', optionalScore);
      setAndRender('#ev-guess-score-song-value', 'scoreSongValue', optionalScore);
      setAndRender('#ev-guess-score-visual-value', 'scoreVisualValue', optionalScore);

      const bindRangePair = (rangeSelector, numberSelector, key, min, max, fallback, updatePreview = false) => {
        const range = $(rangeSelector);
        const number = $(numberSelector);
        const update = value => {
          const next = guessClamp(value, min, max, fallback);
          guessFilters[key] = next;
          if (range) range.value = String(next);
          if (number) number.value = String(next);
          if (updatePreview) {
            const previewCount = $('#ev-guess-preview-count');
            if (previewCount) previewCount.textContent = String(Math.min(next, candidateCount));
          }
          if (key === 'count' && guessCollectionDraft.open) {
            guessCollectionDraft.autoCount = guessClamp(guessCollectionDraft.autoCount, 0, next, next);
            const totalEl = $('#ev-guess-collection-total');
            const leftEl = $('#ev-guess-collection-left');
            const autoRange = $('#ev-guess-collection-auto-range');
            const autoNumber = $('#ev-guess-collection-auto-number');
            const added = getGuessCollectionDraftIds().length;
            if (totalEl) totalEl.textContent = String(next);
            if (leftEl) leftEl.textContent = String(Math.max(0, next - added));
            if (autoRange) { autoRange.max = String(next); autoRange.value = String(guessCollectionDraft.autoCount); }
            if (autoNumber) { autoNumber.max = String(next); autoNumber.value = String(guessCollectionDraft.autoCount); }
          }
        };
        range?.addEventListener('input', () => update(range.value));
        number?.addEventListener('input', () => update(number.value));
        number?.addEventListener('change', () => update(number.value));
      };
      bindRangePair('#ev-guess-count-range', '#ev-guess-count-number', 'count', 1, 200, 50, true);
      bindRangePair('#ev-guess-seconds-range', '#ev-guess-seconds-number', 'clipSeconds', 1, 90, 10);
      bindRangePair('#ev-guess-listens-range', '#ev-guess-listens-number', 'listenCount', 1, 10, 3);

      document.querySelectorAll('[data-score-logic]').forEach(button => {
        button.addEventListener('click', () => {
          guessFilters.scoreLogic = button.dataset.scoreLogic === 'or' ? 'or' : 'and';
          clearSelectionAndRender();
        });
      });

      document.querySelectorAll('[data-answer-mode]').forEach(button => {
        button.addEventListener('click', () => {
          guessFilters.answerMode = button.dataset.answerMode === 'manual' ? 'manual' : 'four';
          document.querySelectorAll('[data-answer-mode]').forEach(item => item.classList.toggle('active', item === button));
          resetGuessGame(false);
        });
      });

      document.querySelectorAll('[data-play-mode]').forEach(button => {
        button.addEventListener('click', () => {
          guessFilters.playMode = button.dataset.playMode === 'lives' ? 'lives' : 'standard';
          document.querySelectorAll('[data-play-mode]').forEach(item => item.classList.toggle('active', item === button));
          resetGuessGame(false);
        });
      });

      document.querySelectorAll('[data-answer-target]').forEach(button => {
        button.addEventListener('click', () => {
          guessFilters.answerTarget = button.dataset.answerTarget === 'franchise' ? 'franchise' : 'song';
          clearSelectionAndRender();
        });
      });

      document.querySelectorAll('#ev-guess-users input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
          const current = new Set((guessFilters.users || []).map(normalizeNickname).filter(Boolean));
          const key = normalizeNickname(input.value);
          if (input.checked) current.add(key);
          else current.delete(key);
          guessFilters.users = [...current];
          clearSelectionAndRender();
        });
      });

      $('#ev-guess-reset')?.addEventListener('click', () => {
        Object.assign(guessFilters, {
          search: '', count: 50, answerMode: 'four', answerTarget: 'song', playMode: 'standard', clipSeconds: 10, listenCount: 3,
          source: 'all', type: '', fromYear: '', fromSeason: 'winter', toYear: '', toSeason: 'fall', studio: '', director: '', performer: '', franchise: '',
          content: 'all', users: [], scoreLogic: 'and',
          scoreOverallCmp: 'gte', scoreOverallValue: '',
          scoreSongCmp: 'gte', scoreSongValue: '',
          scoreVisualCmp: 'gte', scoreVisualValue: ''
        });
        resetGuessGame(true);
        render();
      });

      $('#ev-guess-create-collection')?.addEventListener('click', () => openGuessCollectionBuilder());
      $('#ev-guess-collection-close')?.addEventListener('click', closeGuessCollectionBuilder);

      const collectionTitleInput = $('#ev-guess-collection-title');
      collectionTitleInput?.addEventListener('input', () => {
        guessCollectionDraft.title = collectionTitleInput.value;
      });

      const collectionAutoRange = $('#ev-guess-collection-auto-range');
      const collectionAutoNumber = $('#ev-guess-collection-auto-number');
      const updateCollectionAuto = value => {
        const total = guessClamp(guessFilters.count, 1, 200, 50);
        const next = guessClamp(value, 0, total, total);
        guessCollectionDraft.autoCount = next;
        if (collectionAutoRange) collectionAutoRange.value = String(next);
        if (collectionAutoNumber) collectionAutoNumber.value = String(next);
      };
      collectionAutoRange?.addEventListener('input', () => updateCollectionAuto(collectionAutoRange.value));
      collectionAutoNumber?.addEventListener('input', () => updateCollectionAuto(collectionAutoNumber.value));
      collectionAutoNumber?.addEventListener('change', () => updateCollectionAuto(collectionAutoNumber.value));

      $('#ev-guess-collection-auto')?.addEventListener('click', fillGuessCollectionAuto);
      $('#ev-guess-collection-save')?.addEventListener('click', saveGuessCollection);
      const collectionSearch = $('#ev-guess-collection-search');
      collectionSearch?.addEventListener('input', () => {
        guessCollectionDraft.search = collectionSearch.value;
        renderGuessCollectionSuggestions(collectionSearch.value);
      });
      collectionSearch?.addEventListener('focus', () => renderGuessCollectionSuggestions(collectionSearch.value));
      document.querySelectorAll('[data-collection-remove]').forEach(button => {
        button.addEventListener('click', () => {
          const id = String(button.dataset.collectionRemove || '');
          guessCollectionDraft.autoIds = (guessCollectionDraft.autoIds || []).filter(value => String(value) !== id);
          guessCollectionDraft.manualIds = (guessCollectionDraft.manualIds || []).filter(value => String(value) !== id);
          guessCollectionStatus = 'Песня удалена из подборки.';
          render();
        });
      });

      document.querySelectorAll('[data-collection-play]').forEach(button => {
        button.addEventListener('click', () => {
          const row = guessCollections.find(item => String(item.id) === String(button.dataset.collectionPlay));
          if (row) playGuessCollection(row);
        });
      });
      document.querySelectorAll('[data-collection-edit]').forEach(button => {
        button.addEventListener('click', () => {
          const row = guessCollections.find(item => String(item.id) === String(button.dataset.collectionEdit));
          if (row && canManageGuessCollection(row)) openGuessCollectionBuilder(row);
        });
      });
      document.querySelectorAll('[data-collection-delete]').forEach(button => {
        button.addEventListener('click', async () => {
          const row = guessCollections.find(item => String(item.id) === String(button.dataset.collectionDelete));
          if (!row || !canManageGuessCollection(row)) return;
          if (!window.confirm(`Удалить подборку «${row.title || 'Без названия'}»?`)) return;
          try {
            await deleteDoc(doc(db, 'guessCollections', String(row.id)));
          } catch (error) {
            console.error('guess collection delete failed', error);
            guessCollectionStatus = 'Не удалось удалить подборку.';
            render();
          }
        });
      });

      $('#ev-guess-create')?.addEventListener('click', async () => {
        const candidates = getGuessCandidates();
        const wanted = guessClamp(guessFilters.count, 1, 200, 50);
        const button = $('#ev-guess-create');
        const preview = $('#ev-guess-preview');
        if (button) {
          button.disabled = true;
          button.textContent = 'Проверка источников…';
        }
        resetGuessGame(true);
        const { selected, checked } = await selectValidatedGuessOpenings(candidates, wanted, (done, total, valid) => {
          if (button) button.textContent = `Проверка ${done}/${total}`;
          if (preview) preview.innerHTML = `Проверено: <strong>${done}</strong> из <strong>${total}</strong>. Рабочих источников найдено: <strong>${valid}</strong>.`;
        });
        guessResultIds = selected.map(opening => String(opening.id));
        const rejected = Math.max(0, checked - selected.length);
        guessMessage = selected.length < wanted
          ? `Рабочих источников найдено ${selected.length} из запрошенных ${wanted}. Нерабочие или запрещённые для встраивания ссылки исключены.`
          : `Создана выборка из ${selected.length} песен. При проверке исключено нерабочих источников: ${rejected}.`;
        render();
        if (guessResultIds.length) beginGuessGame(guessResultIds);
      });

      $('#ev-guess-open-game')?.addEventListener('click', () => {
        const sameSelection = guessGameState && guessResultIds.join('|') === (guessGameState.ids || []).join('|');
        if (sameSelection) renderGuessGame();
        else beginGuessGame(guessResultIds);
      });
    }


    function renderBasketStage() {
      if (!isAdmin()) {
        appEl.innerHTML = '<div class="ev-empty">Корзина доступна только админу.</div>';
        return;
      }
      const state = removeMissingBasketIds(getBasketState(activeSeason));
      const basketErrorHtml = eventBasketError ? `<div class="ev-empty" style="border-color:rgba(255,46,99,.55); color:var(--pink); margin-bottom:12px;">${escapeHtml(eventBasketError)}</div>` : '';
      appEl.innerHTML = `
        <section class="ev-panel-head">
          <div>
            <div class="ev-section-label">Корзина</div>
            <h2>${CURRENT_EVENT_YEAR} · отбор OP для сезона</h2>
            <div class="ev-hint">Сюда попадают OP, добавленные с основной страницы сезонов. Разложи их по корзинам, выбери лимит 10/15/20 и подтверди набор: гарантированные OP попадут в сезон для оценки.</div>
          </div>
        </section>
        ${basketErrorHtml}
        <section class="ev-stage-layout">
          <aside class="ev-years">
            <div class="ev-year-title">${CURRENT_EVENT_YEAR}</div>
            <div class="ev-season-buttons">
              ${SEASONS.map(season => renderBasketSeasonButton(season)).join('')}
            </div>
          </aside>
          <section class="ev-content">
            ${renderBasketContent(state)}
          </section>
        </section>
      `;
      bindBasketEvents();
    }

    function renderBasketSeasonButton(season) {
      const state = getBasketState(season);
      const allCount = basketAllIds(state).length;
      const selected = getSeasonState(season).selectedOpeningIds.length;
      const cls = ['ev-season-btn'];
      if (season === activeSeason) cls.push('active');
      return `
        <button class="${cls.join(' ')}" data-basket-season="${season}">
          <span>${escapeHtml(SEASON_LABEL[season])}</span>
          <span class="ev-season-meta">${allCount} в корзине<br>${state.buckets.guaranteed.length}/${state.target} гарант · сезон ${selected}</span>
        </button>
      `;
    }

    function renderBasketContent(state) {
      const unassignedCount = state.buckets.unassigned.length;
      const guaranteedCount = state.buckets.guaranteed.length;
      const canConfirm = unassignedCount === 0 && guaranteedCount === state.target;
      const status = canConfirm
        ? '<div class="ev-status-line ok">Можно подтвердить: нераспределённых нет, гарантированных ровно нужное число.</div>'
        : `<div class="ev-status-line warn">Для подтверждения нужно: нераспределённых 0, гарантированных ${state.target}. Сейчас: нераспределённых ${unassignedCount}, гарантированных ${guaranteedCount}.</div>`;
      return `
        <div class="ev-content-head">
          <div>
            <div class="ev-content-title">${escapeHtml(SEASON_LABEL[state.season])} ${state.year}</div>
            <div class="ev-content-sub">Корзина сезона · ${basketAllIds(state).length} OP всего</div>
            ${status}
          </div>
        </div>
        <div class="ev-target-row">
          <span class="ev-hint">Количество гарантированных:</span>
          ${[10,15,20].map(n => `<button class="ev-target-btn ${state.target === n ? 'active' : ''}" data-basket-target="${n}">${n}</button>`).join('')}
        </div>
        <div class="ev-basket-grid">
          ${renderBasketColumn(state, 'unassigned', 'Нераспределённая')}
          ${renderBasketColumn(state, 'guaranteed', 'Гарантированная')}
          ${renderBasketColumn(state, 'variable', 'Вариативная')}
        </div>
        <div class="ev-basket-confirm-row">
          <div class="ev-basket-status">После подтверждения в «Первый этап» попадут только OP из гарантированной корзины.</div>
          <button class="ev-btn-main" id="ev-confirm-basket" ${canConfirm ? '' : 'disabled'}>Подтвердить сезон</button>
        </div>
      `;
    }

    function renderBasketColumn(state, bucket, title) {
      const ids = state.buckets[bucket] || [];
      return `
        <section class="ev-basket-col">
          <div class="ev-basket-col-head">
            <div class="ev-basket-col-title">${escapeHtml(title)}</div>
            <div class="ev-basket-count">${ids.length} OP</div>
          </div>
          <div class="ev-basket-list">
            ${ids.length ? ids.map(id => renderBasketCard(state, id, bucket)).join('') : '<div class="ev-empty" style="padding:20px 10px;">Пусто</div>'}
          </div>
        </section>
      `;
    }

    function renderBasketCard(state, openingId, bucket) {
      const opening = openingsById.get(String(openingId));
      if (!opening) return '';
      const meta = [opening.year, SEASON_LABEL[opening.season], opening.performers?.length ? opening.performers.join(', ') : 'исполнитель —'].filter(Boolean).join(' · ');
      const buttons = [];
      if (bucket !== 'guaranteed') buttons.push(`<button class="ev-basket-move" data-basket-move="guaranteed" data-id="${escapeHtml(opening.id)}">в гарант</button>`);
      if (bucket !== 'variable') buttons.push(`<button class="ev-basket-move" data-basket-move="variable" data-id="${escapeHtml(opening.id)}">в вариатив</button>`);
      if (bucket !== 'unassigned') buttons.push(`<button class="ev-basket-move" data-basket-move="unassigned" data-id="${escapeHtml(opening.id)}">назад</button>`);
      return `
        <article class="ev-basket-card">
          <div class="ev-basket-card-title">${escapeHtml(opening.title)}</div>
          <div class="ev-basket-card-meta">${escapeHtml(meta)}</div>
          <div class="ev-basket-actions">${buttons.join('')}</div>
        </article>
      `;
    }

    function bindBasketEvents() {
      document.querySelectorAll('[data-basket-season]').forEach(btn => {
        btn.addEventListener('click', () => {
          activeSeason = btn.dataset.basketSeason;
          render();
        });
      });
      document.querySelectorAll('[data-basket-target]').forEach(btn => {
        btn.addEventListener('click', () => setBasketTarget(activeSeason, Number(btn.dataset.basketTarget)));
      });
      document.querySelectorAll('[data-basket-move]').forEach(btn => {
        btn.addEventListener('click', () => moveBasketItem(activeSeason, btn.dataset.id, btn.dataset.basketMove));
      });
      $('#ev-confirm-basket')?.addEventListener('click', () => confirmBasketSeason(getBasketState(activeSeason)));
    }

    function confirmBasketSeason(state) {
      const fresh = getBasketState(state.season);
      if (fresh.buckets.unassigned.length !== 0 || fresh.buckets.guaranteed.length !== fresh.target) return;
      const selectedOpeningIds = fresh.buckets.guaranteed.filter(id => openingsById.has(String(id))).slice(0, fresh.target);
      saveLocalSeasonDoc(fresh.key, {
        stage: 'first',
        year: CURRENT_EVENT_YEAR,
        season: fresh.season,
        seasonKey: fresh.key,
        selectedOpeningIds,
        source: 'basket-firebase',
        basketTarget: fresh.target,
        semifinalOpeningIds: [],
        semifinalTieWinnerIds: []
      });
      activeStage = 'first';
      activeSeason = fresh.season;
      render();
    }

    function renderPlaceholder(stage) {
      appEl.innerHTML = `
        <section class="ev-panel-head">
          <div>
            <div class="ev-section-label">${escapeHtml(STAGE_LABEL[stage])}</div>
            <h2>${escapeHtml(STAGE_LABEL[stage])}</h2>
            <div class="ev-hint">Эта вкладка пока заготовлена. Дальше можно будет подтянуть сюда победителей предыдущего этапа.</div>
          </div>
        </section>
        <div class="ev-box ev-placeholder">Пока пусто.</div>
      `;
    }

    function renderSemiStage() {
      if (!isAdmin()) {
        appEl.innerHTML = '<div class="ev-empty">Полуфинальная корзина доступна только админу.</div>';
        return;
      }
      const rows = getAllSemifinalRows();
      const wildcardPlan = getSemifinalWildcardPlan();
      appEl.innerHTML = `
        <section class="ev-panel-head">
          <div>
            <div class="ev-section-label">Полуфинал</div>
            <h2>Корзина полуфинала</h2>
            <div class="ev-hint">Сезонные гарантированные проходы сохраняются отдельно. Если сезон ещё не закончен, но его полностью оценили хотя бы 10 участников, в топе сезона предварительно показываются текущие проходящие по сумме баллов. Дополнительные слоты показывают гарантированную часть и потенциальные строки до текущего максимума сетки, без расчёта будущих баллов.</div>
          </div>
        </section>
        <div class="ev-semi-grid">
          ${SEASONS.map(season => renderSemiSeason(season)).join('')}
        </div>
        ${renderWildcardSemifinalPanel(wildcardPlan)}
        ${renderEgortosPickPanel(getEgortosPickPlan())}
        <div class="ev-status-line ${rows.length ? 'ok' : 'warn'}" style="margin-top:12px;">Всего в корзине полуфинала: ${rows.length} OP.</div>
      `;
      bindSemiEvents();
    }

    function renderSemiSeason(season) {
      const state = getSeasonState(season);
      const ids = getDirectSemifinalIdsForState(state);
      const potentialPlan = getSeasonPotentialWinnerRows(state);
      let items = '';
      let hint = `${ids.length} OP в корзине полуфинала`;

      if (ids.length) {
        items = ids.map((id, idx) => {
          const opening = openingsById.get(String(id));
          if (!opening) return '';
          const sum = sumForOpeningInSeason(state.key, id);
          return `<div class="ev-semi-item"><span class="oc-profile-rank">${idx + 1}</span><span class="ev-winner-name">${escapeHtml(opening.title)}</span><span class="ev-semi-score">${sum.total} б.</span></div>`;
        }).join('');
      } else if (potentialPlan.rows.length) {
        hint = `Предварительно: ${potentialPlan.completedParticipants}/15 участников завершили оценивание · сейчас проходят ${potentialPlan.rows.length}/${potentialPlan.winnerCount}`;
        items = potentialPlan.rows.map((row, idx) => {
          const opening = openingsById.get(String(row.id));
          return `<div class="ev-semi-item potential"><span class="oc-profile-rank">${idx + 1}</span><span class="ev-winner-name">${escapeHtml(opening?.title || row.title)}</span><span class="ev-semi-score">${row.total} б.</span></div>`;
        }).join('');
      } else {
        const completed = getCompletedParticipantCount(state);
        hint = completed > 0 ? `${completed}/15 участников завершили оценивание` : 'Оценивание ещё не началось';
        items = '<div class="ev-empty" style="padding:18px 8px;">Потенциальные проходящие появятся после завершения оценок хотя бы 10 участниками.</div>';
      }

      return `
        <section class="ev-semi-season">
          <h3>${escapeHtml(SEASON_LABEL[season])} ${CURRENT_EVENT_YEAR}</h3>
          <div class="ev-winner-hint">${escapeHtml(hint)}</div>
          <div style="margin-top:8px;">${items}</div>
        </section>
      `;
    }

    function renderWildcardSemifinalPanel(plan = getSemifinalWildcardPlan()) {
      const confirmedText = plan.confirmedStates?.length
        ? plan.confirmedStates.map(state => `${SEASON_LABEL[state.season]} (+${getWildcardSlotCountForSeason(state)})`).join(', ')
        : 'нет подтверждённых сезонов';
      const completedText = plan.completedStates.length
        ? plan.completedStates.map(state => SEASON_LABEL[state.season]).join(', ')
        : 'нет';
      const expectedGuaranteed = Math.min(plan.earnedSlots || 0, plan.ranked.length);
      let status = '';
      if (!plan.completedStates.length) {
        status = `Пока нет полностью оценённых сезонов для гарантированного добора. Потенциальный максимум по сетке: ${plan.slots} слотов.`;
      } else if (!plan.ready && plan.overflow > 0) {
        status = `На границе гарантированного прохода ничья. Нужно исключить ещё ${Math.max(0, plan.overflow - plan.excluded.length)} OP.`;
      } else if (expectedGuaranteed > 0) {
        status = `Гарантированно определено ${plan.finalIds.length}/${expectedGuaranteed}. Потенциальный максимум по сетке: ${plan.slots} слотов.`;
      } else {
        status = `Полностью оценённые сезоны есть, но пока нет доступных кандидатов для добора.`;
      }

      const visibleRows = Array.isArray(plan.visibleRows) ? plan.visibleRows : plan.ranked;
      const rows = visibleRows.map((row, idx) => {
        const opening = openingsById.get(String(row.id));
        const isPotential = !!row.potential;
        const isAbove = plan.above.some(x => x.id === row.id);
        const isTie = !isPotential && plan.tie.some(x => x.id === row.id) && plan.overflow > 0;
        const isExcluded = !isPotential && plan.excluded.includes(row.id);
        const isSelected = !isPotential && plan.ready && plan.finalIds.includes(row.id);
        const cls = ['ev-winner-row'];
        if (isPotential) cls.push('potential');
        if (isSelected || isAbove) cls.push('chosen');
        if (isTie) cls.push('tie');
        if (isExcluded) cls.push('bad');

        const action = isPotential
          ? '<span class="ev-status-line warn" style="margin:0;">потенциально</span>'
          : isTie
            ? `<button class="ev-winner-btn ${isExcluded ? 'active' : ''}" data-wildcard-minus="${escapeHtml(row.id)}">${isExcluded ? 'исключён −' : '− исключить'}</button>`
            : isSelected || isAbove
              ? '<span class="ev-status-line ok" style="margin:0;">прошёл ✓</span>'
              : '';


        return `
          <div class="${cls.join(' ')}">
            <div class="ev-winner-rank">${idx + 1}</div>
            <div>
              <div class="ev-winner-name">${escapeHtml(opening?.title || row.title)}</div>
              <div class="ev-winner-meta">${escapeHtml(SEASON_LABEL[row.season] || row.season)} · ${escapeHtml(row.count)} оценок</div>
            </div>
            <div class="ev-winner-score">${escapeHtml(row.total)} б.</div>
            <div>${action}</div>
          </div>
        `;
      }).join('');

      const canSave = expectedGuaranteed > 0 && plan.ready && plan.finalIds.length === expectedGuaranteed;
      return `
        <section class="ev-winner-panel" style="margin-top:16px;">
          <div class="ev-winner-head">
            <div>
              <div class="ev-winner-title">Дополнительные слоты полуфинала</div>
              <div class="ev-winner-hint">Подтверждённые сезоны: ${escapeHtml(confirmedText)}. Полностью оценены: ${escapeHtml(completedText)}.</div>
              <div class="ev-winner-hint">Потенциальный максимум по настройкам четырёх сезонов: ${plan.slots}. Сейчас гарантированно доступно ${plan.earnedSlots || 0}. Показано ${visibleRows.length}/${plan.slots} возможных строк. Базовые 2 уже входят в расчёт.</div>
              <div class="ev-status-line ${canSave || plan.finalIds.length ? 'ok' : 'warn'}">${escapeHtml(status)}</div>
            </div>
            <div class="ev-actions">
              <button class="ev-btn-main" id="ev-save-wildcards" ${canSave ? '' : 'disabled'}>Сохранить гарантированные</button>
            </div>
          </div>
          <div class="ev-winner-list">${rows || '<div class="ev-empty">Гарантированные кандидаты появятся после полной оценки сезона.</div>'}</div>
        </section>
      `;
    }

    function renderEgortosPickPanel(plan = getEgortosPickPlan()) {
      const selected = plan.selectedIds.slice(0, 2);
      const selectedSet = new Set(selected.map(String));
      const selectedList = selected.length
        ? selected.map((id, idx) => {
            const opening = openingsById.get(String(id));
            const origin = findOpeningSeasonState(id);
            const sum = origin ? sumForOpeningInSeason(origin.key, id) : { total: 0, count: 0 };
            return `
              <div class="ev-semi-item">
                <span class="oc-profile-rank">${idx + 1}</span>
                <span class="ev-winner-name">${escapeHtml(opening?.title || id)}</span>
                <span class="ev-semi-score">${sum.total} б.</span>
              </div>
            `;
          }).join('')
        : '<div class="ev-empty" style="padding:18px 8px;">Пока ничего не выбрано</div>';

      const cards = plan.candidates.map(row => {
        const opening = openingsById.get(String(row.id));
        const active = selectedSet.has(String(row.id));
        const selectedIndex = selected.indexOf(String(row.id));
        const img = opening?.image ? `<img class="oc-track-image" src="${escapeHtml(opening.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : 'OP';
        const countText = Number(row.count) ? `${row.count} оценок` : 'оценок нет';
        return `
          <button type="button" class="ev-egortos-card ${active ? 'active' : ''}" data-egortos-card="${escapeHtml(row.id)}" title="Выбрать ${escapeHtml(row.title)}">
            <div class="ev-egortos-thumb">${img}</div>
            <div>
              <div class="ev-egortos-title">${escapeHtml(row.title)}</div>
              <div class="ev-egortos-meta">${escapeHtml(SEASON_LABEL[row.season] || row.season)} · ${escapeHtml(countText)}</div>
              <div class="ev-egortos-score">${escapeHtml(row.total)} б.</div>
            </div>
            <span class="ev-egortos-badge">${active ? selectedIndex + 1 : '✓'}</span>
          </button>
        `;
      }).join('');

      return `
        <section class="ev-winner-panel" style="margin-top:16px;">
          <div class="ev-winner-head">
            <div>
              <div class="ev-winner-title">Выбрано Egortos'ом</div>
              <div class="ev-winner-hint">Всегда 2 слота. Можно выбрать только OP, которых нет выше: в гарантированных проходах сезонов и в дополнительных слотах. Кандидаты отсортированы по сумме баллов сверху вниз.</div>
              <div class="ev-status-line ${plan.ready ? 'ok' : 'warn'}">Выбрано ${plan.selectedIds.length}/2. Доступно кандидатов: ${plan.candidates.length}.</div>
            </div>
            <div class="ev-actions">
              <button class="ev-btn-main" id="ev-save-egortos-picks" ${plan.candidates.length >= 2 ? '' : 'disabled'}>Сохранить выбор</button>
            </div>
          </div>
          <div class="ev-egortos-selected">${selectedList}</div>
          <div class="ev-egortos-grid">${cards || '<div class="ev-empty">Нет доступных кандидатов для выбора.</div>'}</div>
        </section>
      `;
    }

    function bindSemiEvents() {
      document.querySelectorAll('[data-wildcard-minus]').forEach(btn => {
        btn.addEventListener('click', () => toggleWildcardExclusion(btn.dataset.wildcardMinus));
      });
      $('#ev-save-wildcards')?.addEventListener('click', () => saveWildcardSemifinalBasket());
      $('#ev-save-egortos-picks')?.addEventListener('click', () => {
        const picks = Array.from(document.querySelectorAll('[data-egortos-card].active')).map(card => card.dataset.egortosCard).filter(Boolean);
        saveEgortosPicks(picks);
      });
      document.querySelectorAll('[data-egortos-card]').forEach(card => {
        card.addEventListener('click', () => {
          const activeCards = Array.from(document.querySelectorAll('[data-egortos-card].active'));
          if (card.classList.contains('active')) {
            card.classList.remove('active');
          } else {
            if (activeCards.length >= 2) {
              activeCards[0].classList.remove('active');
            }
            card.classList.add('active');
          }
          const selectedCards = Array.from(document.querySelectorAll('[data-egortos-card].active'));
          document.querySelectorAll('[data-egortos-card]').forEach(c => {
            const badge = c.querySelector('.ev-egortos-badge');
            if (!badge) return;
            const idx = selectedCards.indexOf(c);
            badge.textContent = idx >= 0 ? String(idx + 1) : '✓';
          });
        });
      });
    }

    function renderGuestStage() {
      const states = findGuestSeasonStates();
      updateAccessUi();
      if (!states.length) {
        appEl.innerHTML = `
          <section class="ev-panel-head">
            <div>
              <div class="ev-section-label">Гостевой вход #${escapeHtml(String(guestSlot).padStart(2, '0'))}</div>
              <h2>Нет доступных сезонов для оценки</h2>
              <div class="ev-hint">Ник должен совпадать с участником #${escapeHtml(String(guestSlot).padStart(2, '0'))}.</div>
            </div>
          </section>
        `;
        return;
      }
      appEl.innerHTML = `
        <section class="ev-panel-head">
          <div>
            <div class="ev-section-label">Сезоны для оценки</div>
            <h2>${CURRENT_EVENT_YEAR} · доступные открытые сезоны</h2>
            <div class="ev-hint">Ты вошёл как участник #${escapeHtml(String(guestSlot).padStart(2, '0'))}: <strong style="color:var(--cyan);">${escapeHtml(myName)}</strong>. Показаны все открытые сезоны, где этот ник стоит в указанной строке участника.</div>
          </div>
        </section>
        <div class="ev-guest-season-stack">
          ${states.map(state => `<section class="ev-content ev-guest-season" data-guest-season="${escapeHtml(state.season)}">${renderGuestSeasonContent(state)}</section>`).join('')}
        </div>
      `;
      bindGuestEvents(states);
    }

    function renderGuestSeasonContent(state) {
      const allowed = isAllowedForSeason(state);
      return `
        <div class="ev-content-head">
          <div>
            <div class="ev-content-title">${escapeHtml(SEASON_LABEL[state.season])} ${state.year}</div>
            <div class="ev-content-sub">${state.selectedOpeningIds.length} OP · комментарий обязателен</div>
            <div class="ev-status-line ${allowed ? 'ok' : 'warn'}">${allowed ? 'Можно оценивать OP сезона.' : 'Оценка недоступна для этого гостевого входа.'}</div>
          </div>
          <div class="ev-actions">
            <button class="ev-btn-secondary" data-guest-rate-all="${escapeHtml(state.season)}" ${!allowed || !state.selectedOpeningIds.length ? 'disabled' : ''}>Оценить все</button>
          </div>
        </div>
        <div class="ev-list">
          ${state.selectedOpeningIds.length ? state.selectedOpeningIds.map((id, idx) => renderOpeningRow(state, id, idx)).join('') : '<div class="ev-empty">В этом сезоне пока нет OP для оценки.</div>'}
        </div>
      `;
    }

    function bindGuestEvents(states) {
      const bySeason = new Map((states || []).map(state => [state.season, state]));
      document.querySelectorAll('[data-guest-rate-all]').forEach(btn => {
        btn.addEventListener('click', () => {
          const state = bySeason.get(btn.dataset.guestRateAll);
          if (state) openEvaluator(state, state.selectedOpeningIds, 0);
        });
      });
      document.querySelectorAll('[data-rate-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const season = btn.closest('[data-guest-season]')?.dataset.guestSeason;
          const state = bySeason.get(season);
          if (!state) return;
          openEvaluator(state, state.selectedOpeningIds, state.selectedOpeningIds.indexOf(String(btn.dataset.rateId)));
        });
      });
    }

    function renderFirstStage() {
      const selectedState = getSeasonState(activeSeason);
      appEl.innerHTML = `
        <section class="ev-panel-head">
          <div>
            <div class="ev-section-label">Первый этап</div>
            <h2>${CURRENT_EVENT_YEAR} · сезонный отбор</h2>
            <div class="ev-hint">Сезоны наполняются через корзину. Первые три участника закреплены: Egortos, Кофа, Toxexex. Оценка не сохраняется без комментария и не влияет на основной рейтинг сайта.</div>
          </div>
        </section>
        <section class="ev-stage-layout">
          <aside class="ev-years">
            <div class="ev-year-title">${CURRENT_EVENT_YEAR}</div>
            <div class="ev-season-buttons">
              ${SEASONS.map(season => renderSeasonButton(season)).join('')}
            </div>
          </aside>
          <section class="ev-content" id="ev-season-content">
            ${renderSeasonContent(selectedState)}
          </section>
        </section>
      `;
      bindFirstStageEvents();
    }

    function renderSeasonButton(season) {
      const state = getSeasonState(season);
      const progress = ratingProgress(state);
      const cls = ['ev-season-btn'];
      if (season === activeSeason) cls.push('active');
      if (state.closed) cls.push('closed');
      return `
        <button class="${cls.join(' ')}" data-season="${season}">
          <span>${escapeHtml(SEASON_LABEL[season])}</span>
          <span class="ev-season-meta">${state.closed ? 'закрыт' : 'открыт'}<br>${state.selectedOpeningIds.length} OP · ${progress.done}/${progress.total || '—'}</span>
        </button>
      `;
    }

    function renderSeasonContent(state) {
      const allowed = isAllowedForSeason(state);
      const status = state.closed
        ? '<div class="ev-status-line bad">Сезон закрыт: взаимодействие отключено.</div>'
        : isAdmin()
          ? '<div class="ev-status-line warn">Админ не может оценивать OP. Для оценки переключись в гостевой режим нужного участника.</div>'
          : allowed
            ? '<div class="ev-status-line ok">Твой ник есть в списке участников. Можно оценивать OP сезона.</div>'
            : '<div class="ev-status-line warn">Твоего ника нет в списке 15 участников этого сезона. Оценка недоступна.</div>';
      return `
        <div class="ev-content-head">
          <div>
            <div class="ev-content-title">${escapeHtml(SEASON_LABEL[state.season])} ${state.year}</div>
            <div class="ev-content-sub">Первый этап · ${state.closed ? 'сезон закрыт' : 'сезон открыт'} · ${state.selectedOpeningIds.length} OP</div>
            ${status}
          </div>
          <div class="ev-actions">
            ${!isAdmin() ? `<button class="ev-btn-secondary" id="ev-rate-all" ${state.closed || !allowed || !state.selectedOpeningIds.length ? 'disabled' : ''}>Оценить все</button>` : ''}
            <button class="ev-btn-ghost" id="ev-post-season" ${!isAdmin() || !state.selectedOpeningIds.length ? 'disabled' : ''}>Пост</button>
            <button class="ev-btn-ghost" id="ev-delete-admin-ratings" ${!isAdmin() ? 'disabled' : ''}>Удалить оценки админа</button>
            ${state.closed
              ? `<button class="ev-btn-secondary" id="ev-reopen-season" ${!isAdmin() ? 'disabled' : ''}>Открыть сезон</button>`
              : `<button class="ev-btn-danger" id="ev-close-season" ${!isAdmin() ? 'disabled' : ''}>Закрыть сезон</button>`}
          </div>
        </div>
        ${renderParticipants(state)}
        ${renderWinnerPanel(state)}
        <div class="ev-mini-title" style="margin: 4px 0 10px;">Опенинги сезона</div>
        <div class="ev-list">
          ${state.selectedOpeningIds.length ? state.selectedOpeningIds.map((id, idx) => renderOpeningRow(state, id, idx)).join('') : '<div class="ev-empty">В этом сезоне пока нет OP в базе. Как только в основной странице появятся OP за этот год/сезон, сюда попадут первые 15 по алфавиту.</div>'}
        </div>
      `;
    }

    function renderWinnerPanel(state) {
      if (!isAdmin()) return '';
      const plan = getSeasonWinnerPlan(state);
      if (!state.selectedOpeningIds.length) return '';
      const target = Number(state.basketTarget || getBasketState(state.season).target || 15);
      const status = !plan.complete
        ? `Сначала нужны все 15 оценок по сезону: ${plan.progress.done}/${plan.progress.total || '—'}. До этого проходы и дополнительные слоты не считаются.`
        : plan.candidates.length
          ? `Автоматически проходят ${plan.auto.length}. Нужно выбрать ещё ${plan.needManual}: нажми «это победитель» у кандидатов с одинаковой суммой.`
          : `Победители определяются автоматически: ${plan.finalIds.length}/${plan.winnerCount}.`;
      const chosenSet = new Set((state.semifinalTieWinnerIds || []).map(String));
      const finalSet = new Set((state.semifinalOpeningIds || []).map(String));
      const rows = plan.ranked.map((row, idx) => {
        const opening = openingsById.get(String(row.id));
        const isAuto = plan.auto.some(x => x.id === row.id);
        const isCandidate = plan.candidates.some(x => x.id === row.id);
        const isFinal = plan.finalIds.includes(row.id) || finalSet.has(row.id);
        const cls = ['ev-winner-row'];
        if (isAuto) cls.push('auto');
        if (isCandidate) cls.push('tie');
        if (isFinal) cls.push('chosen');
        const action = !plan.complete
          ? ''
          : isCandidate
            ? `<button class="ev-winner-btn ${chosenSet.has(row.id) ? 'active' : ''}" data-tie-winner="${escapeHtml(row.id)}">${chosenSet.has(row.id) ? 'выбран ✓' : 'это победитель'}</button>`
            : isFinal
              ? '<span class="ev-status-line ok" style="margin:0;">проходит</span>'
              : isAuto
                ? '<span class="ev-status-line ok" style="margin:0;">авто</span>'
                : '';
        const progressLabel = isFinal
          ? 'проходит'
          : isAuto
            ? 'проходит гарантированно'
            : isCandidate
              ? 'спорное место'
              : 'ниже прохода';
        return `
          <div class="${cls.join(' ')}">
            <div class="ev-winner-rank">${idx + 1}</div>
            <div>
              <div class="ev-winner-name">${escapeHtml(opening?.title || row.title)}</div>
              <div class="ev-winner-meta">${escapeHtml(row.count)} оценок · ${progressLabel}</div>
            </div>
            <div class="ev-winner-score">${escapeHtml(row.total)} б.</div>
            <div>${action}</div>
          </div>
        `;
      }).join('');
      return `
        <section class="ev-winner-panel">
          <div class="ev-winner-head">
            <div>
              <div class="ev-winner-title">Победители сезона → корзина полуфинала</div>
              <div class="ev-winner-hint">Выбрано в корзине: ${target} OP. Прямо проходит ${plan.winnerCount}. Дополнительные слоты для общего добора: ${getWildcardSlotCountForSeason(state)}. Считаем по сумме баллов.</div>
              <div class="ev-status-line ${plan.ready ? 'ok' : 'warn'}">${escapeHtml(status)} Сейчас сохранено прямых проходов: ${(state.semifinalOpeningIds || []).length}/${plan.winnerCount}.</div>
            </div>
            <div class="ev-actions">
              <button class="ev-btn-secondary" id="ev-recalc-semi" ${!plan.complete || !plan.ranked.length ? 'disabled' : ''} title="Пересчитать и сохранить прямые проходы сезона по текущим оценкам">Обновить проходящих</button>
            </div>
          </div>
          <div class="ev-winner-list">${rows || '<div class="ev-empty">Пока нет оценок.</div>'}</div>
        </section>
      `;
    }

    function renderParticipants(state) {
      const names = cleanParticipantSlots(state.allowedNicknames || []);
      const progressRows = getParticipantRatingProgress(state);
      const completeCount = progressRows.filter(row => row.complete).length;
      return `
        <section class="ev-participants">
          <div class="ev-participants-head">
            <div>
              <div class="ev-mini-title">Участники сезона</div>
              <div class="ev-hint">Первые три строки закреплены всегда: Egortos, Кофа, Toxexex. Галочка означает, что пользователь оценил все OP сезона. Завершили: ${completeCount}/15.</div>
            </div>
            <button class="ev-btn-ghost" id="ev-save-participants" ${!isAdmin() || state.closed ? 'disabled' : ''}>Сохранить участников</button>
          </div>
          <div class="ev-participant-grid">
            ${names.map((name, idx) => {
              const fixed = idx < FIXED_PARTICIPANTS.length;
              const disabled = !isAdmin() || state.closed || fixed;
              const title = fixed ? 'Фиксированный участник' : '';
              const progress = progressRows[idx] || { done: 0, total: state.selectedOpeningIds.length, complete: false };
              const progressClass = progress.complete ? 'done' : progress.done > 0 ? 'partial' : '';
              const progressText = progress.complete ? '✓' : progress.done > 0 ? `${progress.done}/${progress.total}` : '—';
              const progressTitle = !name
                ? 'Участник не указан'
                : progress.complete
                  ? 'Все оценки отправлены'
                  : progress.done > 0
                    ? `Оценено ${progress.done} из ${progress.total}`
                    : 'Оценки ещё не отправлены';
              const canReview = isAdmin() && !!name && progress.done > 0;
              const progressEl = canReview
                ? `<button type="button" class="ev-participant-progress ${progressClass}" data-participant-review="${idx}" title="${escapeHtml(progressTitle)}. Нажми, чтобы посмотреть оценки и комментарии пользователя.">${escapeHtml(progressText)}</button>`
                : `<span class="ev-participant-progress ${progressClass}" title="${escapeHtml(progressTitle)}">${escapeHtml(progressText)}</span>`;
              return `
                <div class="ev-participant-slot">
                  <input class="ev-participant-input ${fixed ? 'fixed' : ''}" data-idx="${idx}" value="${escapeHtml(name)}" placeholder="${idx + 1}. никнейм" title="${escapeHtml(title)}" ${disabled ? 'disabled' : ''} />
                  ${progressEl}
                </div>
              `;
            }).join('')}
          </div>
        </section>
      `;
    }

    function renderOpeningRow(state, openingId, idx) {
      const opening = openingsById.get(String(openingId));
      if (!opening) return '';
      const myRating = getMyEventRating(state.key, openingId);
      const canRate = isAllowedForSeason(state);
      const guestView = isGuest();
      const avg = guestView ? null : avgForOpeningInSeason(state.key, openingId);
      const rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
      const img = opening.image ? `<img class="oc-track-image" src="${escapeHtml(opening.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : escapeHtml(opening.type || 'OP');
      const thumb = opening.link
        ? `<a class="ev-thumb-link" href="${escapeHtml(opening.link)}" target="_blank" rel="noopener noreferrer" title="Открыть видео"><div class="oc-season-thumb">${img}</div></a>`
        : `<div class="oc-season-thumb">${img}</div>`;
      const meta = [opening.year, SEASON_LABEL[opening.season], opening.performers?.length ? opening.performers.join(', ') : 'исполнитель —'].filter(Boolean).join(' · ');
      const scoreText = avg ? `${avg.avg.toFixed(2)} · ${avg.count}` : '—';
      const personalLine = guestView ? '' : `<div class="oc-song-small">${myRating ? `твоя оценка: ${Number(myRating.score).toFixed(1)} · ${escapeHtml(String(myRating.comment || '').slice(0, 80))}` : 'ещё не оценено тобой'}</div>`;
      const statusCell = guestView
        ? `<div class="ev-score-pill ${myRating ? 'done' : 'guest-empty'}" title="${myRating ? 'Оценено' : ''}">${myRating ? '✓' : ''}</div>`
        : `<div class="ev-score-pill">${scoreText}</div>`;
      return `
        <article class="oc-season-op" data-opening-id="${escapeHtml(opening.id)}">
          <div class="oc-profile-rank ${rankClass}">${idx + 1}</div>
          ${thumb}
          <div>
            <div class="oc-name">${escapeHtml(opening.title)}</div>
            <div class="oc-meta">${escapeHtml(meta)}</div>
            ${personalLine}
          </div>
          ${statusCell}
          <button class="ev-rate-btn ${isAdmin() ? 'admin-edit' : ''}" data-rate-id="${escapeHtml(opening.id)}" ${isAdmin() ? '' : (state.closed || !canRate ? 'disabled' : '')}>${isAdmin() ? 'Редактировать' : (myRating ? 'Изменить' : 'Оценить')}</button>
        </article>
      `;
    }

    function formatPostScore(value) {
      const num = Number(value) || 0;
      return Number.isInteger(num) ? String(num) : String(Math.round(num * 10) / 10).replace('.', ',');
    }

    function normalizeCommentText(value) {
      return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function buildPostCommentLine(r) {
      const text = normalizeCommentText(r?.comment);
      if (!text) return '';
      const score = formatPostScore(r?.score);
      const separator = /[.!?…]$/.test(text) ? ' ' : '. ';
      return `${text}${separator}${score}/10`;
    }

    function orderPostNicknames(state, ratings) {
      const byKey = new Map();
      const add = (name) => {
        const clean = String(name || '').trim();
        const key = normalizeNickname(clean);
        if (!clean || !key || byKey.has(key)) return;
        byKey.set(key, clean);
      };
      (state.allowedNicknames || []).forEach(add);
      (ratings || []).forEach(r => add(r.nickname));
      const priorityKeys = POST_PRIORITY_NICKS.map(normalizeNickname);
      const priority = [];
      priorityKeys.forEach((key, idx) => {
        if (byKey.has(key)) {
          priority.push({ key, name: POST_PRIORITY_NICKS[idx] });
          byKey.delete(key);
        }
      });
      const rest = Array.from(byKey.entries())
        .map(([key, name]) => ({ key, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
      return [...priority, ...rest];
    }

    function getSeasonDenseRankGroups(state) {
      const selectedIds = (state.selectedOpeningIds || []).map(String).filter(id => openingsById.has(id));
      const rows = selectedIds.map(id => {
        const opening = openingsById.get(id);
        const sum = sumForOpeningInSeason(state.key, id);
        return {
          id,
          title: opening?.title || id,
          total: sum.total,
          count: sum.count
        };
      }).sort((a, b) => (b.total - a.total) || a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }));

      let place = 0;
      let prevTotal = null;
      const grouped = new Map();
      rows.forEach(row => {
        if (prevTotal === null || row.total !== prevTotal) {
          place += 1;
          prevTotal = row.total;
        }
        row.place = place;
        if (!grouped.has(place)) grouped.set(place, []);
        grouped.get(place).push(row);
      });
      return Array.from(grouped.entries())
        .map(([rank, items]) => ({ rank, items }))
        .sort((a, b) => b.rank - a.rank);
    }

    function buildSeasonPostText(state) {
      const ratings = getSeasonRatings(state.key).filter(r => (state.selectedOpeningIds || []).map(String).includes(String(r.openingId || '')));
      const orderedUsers = orderPostNicknames(state, ratings);
      const maxScore = Math.max(15, (state.allowedNicknames || []).filter(Boolean).length || 0) * 10;
      const groups = getSeasonDenseRankGroups(state);
      if (!groups.length) return 'В сезоне пока нет опенингов.';

      const lines = [];
      groups.forEach(group => {
        const items = group.items.slice().sort((a, b) => a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }));
        const ids = new Set(items.map(item => item.id));
        const titles = items.map(item => item.title).join(', ');
        const score = items[0]?.total || 0;
        lines.push(`${group.rank} место: ${titles} [${formatPostScore(score)} / ${formatPostScore(maxScore)}]`);

        items.forEach(item => {
          orderedUsers.forEach(user => {
            const userRow = ratings.find(r =>
              String(r.openingId || '') === String(item.id) &&
              String(r.nicknameKey || '') === user.key
            );
            const comment = buildPostCommentLine(userRow);
            if (comment) lines.push(`${user.name}: ${comment}`);
          });
        });
        lines.push('');
      });
      return lines.join('\n').trim();
    }

    async function copyTextToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.focus();
        area.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
        area.remove();
        return ok;
      }
    }

    function openSeasonPostModal(state) {
      if (!isAdmin()) return;
      const text = buildSeasonPostText(state);
      postModalEl.dataset.modalKind = 'season-post';
      postModalEl.innerHTML = `
        <div class="ev-dialog">
          <div class="ev-dialog-top">
            <div>
              <div class="ev-progress">${escapeHtml(SEASON_LABEL[state.season])} ${state.year} · пост по итогам сезона</div>
              <div class="ev-modal-title">Пост</div>
              <div class="ev-hint">Места идут от последнего к первому. Ники: Egortos, Кофа, Toxexex — первыми, остальные по алфавиту.</div>
            </div>
            <button class="ev-close" id="ev-post-close">Закрыть</button>
          </div>
          <textarea class="ev-post-textarea" id="ev-post-text">${escapeHtml(text)}</textarea>
          <div class="ev-error" id="ev-post-status"></div>
          <div class="ev-modal-actions">
            <button class="ev-btn-secondary" id="ev-post-copy">Скопировать</button>
          </div>
        </div>
      `;
      postModalEl.classList.remove('hidden');
      $('#ev-post-close')?.addEventListener('click', () => postModalEl.classList.add('hidden'));
      $('#ev-post-copy')?.addEventListener('click', async () => {
        const value = String($('#ev-post-text')?.value || '');
        const ok = await copyTextToClipboard(value);
        const status = $('#ev-post-status');
        if (status) {
          status.textContent = ok ? 'Скопировано ✓' : 'Не удалось скопировать автоматически. Выдели текст вручную.';
          status.style.color = ok ? 'var(--green)' : 'var(--red)';
        }
      });
    }

    function getParticipantReviewRows(state, participant) {
      const nicknameKey = String(participant?.nicknameKey || normalizeNickname(participant?.nickname || ''));
      const selectedIds = (state?.selectedOpeningIds || []).map(String).filter(id => openingsById.has(id));
      const ratings = getSeasonRatings(state?.key).filter(r => String(r.nicknameKey || normalizeNickname(r.nickname || '')) === nicknameKey);
      const byOpening = new Map(ratings.map(r => [String(r.openingId || ''), r]));
      return selectedIds.map((id, idx) => {
        const opening = openingsById.get(id);
        const rating = byOpening.get(id) || null;
        return {
          idx,
          id,
          title: opening?.title || id,
          rating
        };
      });
    }

    function buildParticipantReviewText(state, participant) {
      const rows = getParticipantReviewRows(state, participant);
      const nickname = String(participant?.nickname || '').trim() || 'Пользователь';
      const lines = [`${nickname} — ${SEASON_LABEL[state.season]} ${state.year}`];
      rows.forEach(row => {
        const rating = row.rating;
        if (!rating) {
          lines.push(`${row.idx + 1}. ${row.title}: нет оценки`);
          return;
        }
        const comment = normalizeCommentText(rating.comment);
        lines.push(`${row.idx + 1}. ${row.title}: ${formatPostScore(rating.score)}/10${comment ? ` — ${comment}` : ''}`);
      });
      return lines.join('\n');
    }

    function closeParticipantReviewModal() {
      if (postModalEl.dataset.modalKind !== 'participant-review') return;
      postModalEl.classList.add('hidden');
      delete postModalEl.dataset.modalKind;
    }

    function openParticipantReviewModal(state, participant) {
      if (!isAdmin() || !participant?.nicknameKey) return;
      const rows = getParticipantReviewRows(state, participant);
      const nickname = String(participant.nickname || '').trim() || participant.nicknameKey;
      const done = rows.filter(row => row.rating && Number.isFinite(Number(row.rating.score))).length;
      postModalEl.dataset.modalKind = 'participant-review';
      postModalEl.innerHTML = `
        <div class="ev-dialog">
          <div class="ev-dialog-top">
            <div>
              <div class="ev-progress">${escapeHtml(SEASON_LABEL[state.season])} ${state.year} · ${done}/${rows.length} оценок</div>
              <div class="ev-modal-title">Оценки пользователя ${escapeHtml(nickname)}</div>
              <div class="ev-hint">Здесь можно быстро проверить все оценки и комментарии участника по этому сезону.</div>
            </div>
            <button class="ev-close" id="ev-review-close">Закрыть</button>
          </div>
          <div class="ev-review-list">
            ${rows.length ? rows.map(row => {
              const rating = row.rating;
              const missing = !rating || !Number.isFinite(Number(rating.score));
              const comment = normalizeCommentText(rating?.comment);
              return `
                <div class="ev-review-row ${missing ? 'missing' : ''}">
                  <div class="ev-review-rank">${row.idx + 1}</div>
                  <div>
                    <div class="ev-review-title">${escapeHtml(row.title)}</div>
                    <div class="ev-review-comment">${missing ? 'Оценка ещё не отправлена.' : escapeHtml(comment || 'Комментарий пустой.')}</div>
                  </div>
                  <div class="ev-review-score">${missing ? '—' : `${escapeHtml(formatPostScore(rating.score))}/10`}</div>
                </div>
              `;
            }).join('') : '<div class="ev-empty">В сезоне пока нет OP.</div>'}
          </div>
          <div class="ev-error" id="ev-review-status"></div>
          <div class="ev-modal-actions">
            <button class="ev-btn-secondary" id="ev-review-copy">Скопировать текстом</button>
          </div>
        </div>
      `;
      postModalEl.classList.remove('hidden');
      $('#ev-review-close')?.addEventListener('click', closeParticipantReviewModal);
      $('#ev-review-copy')?.addEventListener('click', async () => {
        const ok = await copyTextToClipboard(buildParticipantReviewText(state, participant));
        const status = $('#ev-review-status');
        if (status) {
          status.textContent = ok ? 'Скопировано ✓' : 'Не удалось скопировать автоматически. Выдели текст вручную.';
          status.style.color = ok ? 'var(--green)' : 'var(--red)';
        }
      });
    }

    postModalEl.addEventListener('click', event => {
      if (event.target === postModalEl) closeParticipantReviewModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || postModalEl.classList.contains('hidden')) return;
      if (postModalEl.dataset.modalKind !== 'participant-review') return;
      event.preventDefault();
      closeParticipantReviewModal();
    });

    function bindFirstStageEvents() {
      document.querySelectorAll('.ev-season-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          activeSeason = btn.dataset.season;
          render();
        });
      });
      const state = getSeasonState(activeSeason);
      $('#ev-save-participants')?.addEventListener('click', () => saveParticipants(state));
      $('#ev-close-season')?.addEventListener('click', () => closeSeason(state));
      $('#ev-reopen-season')?.addEventListener('click', () => reopenSeason(state));
      $('#ev-post-season')?.addEventListener('click', () => openSeasonPostModal(state));
      $('#ev-delete-admin-ratings')?.addEventListener('click', () => deleteAdminRatings(state));
      $('#ev-recalc-semi')?.addEventListener('click', () => recalcSemifinalWinners(state));
      document.querySelectorAll('[data-participant-review]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.participantReview);
          const progress = getParticipantRatingProgress(state)[idx];
          if (progress) openParticipantReviewModal(state, progress);
        });
      });
      document.querySelectorAll('[data-tie-winner]').forEach(btn => {
        btn.addEventListener('click', () => toggleTieWinner(state, btn.dataset.tieWinner));
      });
      $('#ev-rate-all')?.addEventListener('click', () => openEvaluator(state, state.selectedOpeningIds, 0));
      document.querySelectorAll('[data-rate-id]').forEach(btn => {
        btn.addEventListener('click', () => openEvaluator(state, state.selectedOpeningIds, state.selectedOpeningIds.indexOf(String(btn.dataset.rateId))));
      });
    }

    function isLegacyAdminRating(row, state) {
      if (!row) return false;
      if (row.adminCreated || row.createdByRole === 'admin' || row.sourceRole === 'admin') return true;
      const rowKey = normalizeNickname(row.nickname || row.nicknameKey || '');
      const adminKey = normalizeNickname(myName || getSavedAdminNickname() || '');
      if (!rowKey || !adminKey || rowKey !== adminKey) return false;
      const participants = cleanParticipantSlots(state?.allowedNicknames || []).map(normalizeNickname).filter(Boolean);
      return !participants.includes(rowKey);
    }

    async function deleteAdminRatings(state) {
      if (!isAdmin()) return;
      const adminKey = normalizeNickname(myName || getSavedAdminNickname() || '');
      const adminNameText = myName || getSavedAdminNickname() || 'админского ника';
      const rows = eventRatings.filter(row => isLegacyAdminRating(row, state));
      if (!rows.length) {
        alert(`Не найдено оценок админа для удаления. Если старые оценки были сделаны под ником участника, их нельзя отличить от обычных оценок автоматически.`);
        return;
      }
      const ok = confirm(`Удалить ${rows.length} оценок/комментариев админа?

Будут удалены оценки, помеченные как админские, а также старые оценки текущего админского ника «${adminNameText}», если этот ник не указан участником сезона.`);
      if (!ok) return;
      try {
        if (LOCAL_EVENTS_MODE) {
          const ids = new Set(rows.map(r => String(r.id || `${r.seasonKey}__${r.nicknameKey}__${r.openingId}`)));
          eventRatings = eventRatings.filter(r => !ids.has(String(r.id || `${r.seasonKey}__${r.nicknameKey}__${r.openingId}`)));
          localStorage.setItem(LOCAL_EVENT_RATINGS_KEY, JSON.stringify(eventRatings));
          scheduleRender();
          return;
        }
        await Promise.all(rows.map(row => {
          const id = String(row.id || `${row.seasonKey}__${row.nicknameKey}__${row.openingId}`);
          return deleteDoc(doc(db, 'eventRatings', id));
        }));
        alert('Оценки админа удалены.');
      } catch (e) {
        console.error('delete admin event ratings failed', e);
        alert('Не удалось удалить оценки.');
      }
    }

    async function saveParticipants(state) {
      if (!isAdmin() || state.closed) return;
      const values = Array.from(document.querySelectorAll('.ev-participant-input')).map(input => input.value);
      const allowedNicknames = cleanParticipantSlots(values);
      if (LOCAL_EVENTS_MODE) {
        saveLocalSeasonDoc(state.key, {
          stage: 'first',
          year: state.year,
          season: state.season,
          seasonKey: state.key,
          allowedNicknames,
          selectedOpeningIds: state.selectedOpeningIds
        });
        return;
      }
      await setDoc(doc(db, 'eventSeasons', state.key), {
        stage: 'first',
        year: state.year,
        season: state.season,
        seasonKey: state.key,
        allowedNicknames,
        selectedOpeningIds: state.selectedOpeningIds,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    async function closeSeason(state) {
      if (!isAdmin() || state.closed) return;
      const ok = confirm(`Закрыть сезон «${SEASON_LABEL[state.season]} ${state.year}»? После этого участники больше не смогут его оценивать.`);
      if (!ok) return;
      const values = Array.from(document.querySelectorAll('.ev-participant-input')).map(input => input.value);
      const allowedNicknames = cleanParticipantSlots(values.length ? values : state.allowedNicknames);
      const patch = {
        stage: 'first',
        year: state.year,
        season: state.season,
        seasonKey: state.key,
        allowedNicknames,
        selectedOpeningIds: state.selectedOpeningIds,
        closed: true,
        closedBy: myName || '',
        closedAtLocal: new Date().toISOString()
      };
      if (LOCAL_EVENTS_MODE) {
        saveLocalSeasonDoc(state.key, patch);
        return;
      }
      await setDoc(doc(db, 'eventSeasons', state.key), {
        ...patch,
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    async function reopenSeason(state) {
      if (!isAdmin() || !state.closed) return;
      const ok = confirm(`Заново открыть сезон «${SEASON_LABEL[state.season]} ${state.year}»? Участники снова смогут менять оценки.`);
      if (!ok) return;
      const patch = {
        stage: 'first',
        year: state.year,
        season: state.season,
        seasonKey: state.key,
        allowedNicknames: state.allowedNicknames,
        selectedOpeningIds: state.selectedOpeningIds,
        closed: false,
        reopenedBy: myName || '',
        reopenedAtLocal: new Date().toISOString()
      };
      if (LOCAL_EVENTS_MODE) {
        saveLocalSeasonDoc(state.key, patch);
        return;
      }
      await setDoc(doc(db, 'eventSeasons', state.key), {
        ...patch,
        reopenedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    function openEvaluator(state, ids, startIndex) {
      if (!isAdmin() && (state.closed || !isAllowedForSeason(state))) return;
      evaluatorQueue = (ids || []).filter(id => openingsById.has(String(id))).map(String);
      evaluatorIndex = Math.max(0, Math.min(Number(startIndex) || 0, evaluatorQueue.length - 1));
      renderEvaluator(state);
    }

    function bindEvaluatorMediaAndAlt(opening, state) {
      const videoCover = evaluatorEl.querySelector('.ev-video-cover');
      if (videoCover) {
        videoCover.addEventListener('click', () => {
          const embedUrl = videoCover.dataset.embedUrl || '';
          const videoUrl = videoCover.dataset.videoUrl || '';
          const videoType = videoCover.dataset.videoType || '';
          if (videoType && videoUrl) {
            videoCover.outerHTML = `<div class="ev-video-frame"><video controls autoplay playsinline preload="metadata"><source src="${escapeHtml(videoUrl)}" type="${escapeHtml(videoType)}">Видео не удалось встроить. Откройте ссылку отдельно.</video></div>`;
          } else if (embedUrl) {
            videoCover.outerHTML = `<div class="ev-video-frame"><iframe src="${escapeHtml(embedUrl)}" title="Видео" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
          } else if (videoUrl) {
            window.open(videoUrl, '_blank', 'noopener,noreferrer');
          }
        });
      }
      const altSave = $('#ev-alt-save');
      if (altSave) {
        altSave.addEventListener('click', async () => {
          const err = $('#ev-alt-error');
          const links = {
            youtubeUrl: $('#ev-alt-youtube')?.value || '',
            vkUrl: $('#ev-alt-vk')?.value || ''
          };
          try {
            await saveAltLinks(opening.id, links);
            if (err) { err.textContent = 'Ссылки сохранены ✓'; err.style.color = 'var(--green)'; }
            renderEvaluator(state);
          } catch (e) {
            console.error('eventAltLinks save failed', e);
            if (err) { err.textContent = 'Не удалось сохранить ссылки.'; err.style.color = 'var(--red)'; }
          }
        });
      }
    }

    function renderEvaluator(state) {
      const openingId = evaluatorQueue[evaluatorIndex];
      const opening = openingsById.get(String(openingId));
      if (!opening) {
        evaluatorEl.classList.add('hidden');
        return;
      }
      const existing = getMyEventRating(state.key, openingId);
      const score = existing ? Number(existing.score) || 5 : 5;
      const comment = existing ? String(existing.comment || '') : '';
      const imageBlock = renderVideoBlock(opening);
      const altLinksBlock = renderAltLinksBlock(opening.id);
      const eventPeriodLabel = state.eventKind === 'ending-year'
        ? `${ENDING_PERIOD_META[state.period]?.label || state.period} ${state.year}`
        : `${SEASON_LABEL[state.season]} ${state.year}`;
      if (isAdmin()) {
        evaluatorEl.innerHTML = `
          <div class="ev-dialog">
            <div class="ev-dialog-top">
              <div>
                <div class="ev-progress">Редактирование карточки · ${escapeHtml(eventPeriodLabel)}</div>
                <div class="ev-modal-title">${escapeHtml(opening.title)}</div>
                <div class="oc-meta">Админ может редактировать только альтернативные ссылки. Оценки ставятся через гостевой вход.</div>
              </div>
              <button class="ev-close" id="ev-eval-close">Закрыть</button>
            </div>
            ${imageBlock}
            ${altLinksBlock}
            <div class="ev-modal-actions">
              <button class="ev-btn-secondary" id="ev-admin-editor-close">Готово</button>
            </div>
          </div>
        `;
        evaluatorEl.classList.remove('hidden');
        $('#ev-eval-close')?.addEventListener('click', () => evaluatorEl.classList.add('hidden'));
        $('#ev-admin-editor-close')?.addEventListener('click', () => evaluatorEl.classList.add('hidden'));
        bindEvaluatorMediaAndAlt(opening, state);
        return;
      }
      evaluatorEl.innerHTML = `
        <div class="ev-dialog">
          <div class="ev-dialog-top">
            <div>
              <div class="ev-progress">${escapeHtml(eventPeriodLabel)} · ${evaluatorIndex + 1}/${evaluatorQueue.length}</div>
              <div class="ev-modal-title">${escapeHtml(opening.title)}</div>
              <div class="oc-meta">${escapeHtml([opening.performers?.join(', '), opening.studios?.join(', ')].filter(Boolean).join(' · ') || 'метаданные не заполнены')}</div>
            </div>
            <button class="ev-close" id="ev-eval-close">Закрыть</button>
          </div>
          ${imageBlock}
          ${altLinksBlock}
          <div class="ev-eval-grid">
            <label class="ev-field">Оценка
              <input id="ev-eval-score" type="range" min="1" max="10" step="1" value="${score}" />
              <div class="ev-score-word">Сейчас: <strong id="ev-eval-score-word">${score} · ${escapeHtml(SCORE_WORDS[score] || '')}</strong></div>
            </label>
            <label class="ev-field">Число
              <input id="ev-eval-score-num" type="number" min="1" max="10" step="1" value="${score}" />
            </label>
          </div>
          <label class="ev-field" style="margin-bottom:12px;">Комментарий <span style="color:var(--gold);text-transform:none;letter-spacing:0;">обязателен</span>
            <textarea id="ev-eval-comment" placeholder="Напиши хотя бы короткий комментарий…">${escapeHtml(comment)}</textarea>
          </label>
          <div class="ev-error" id="ev-eval-error"></div>
          <div class="ev-modal-actions">
            <button class="ev-btn-ghost" id="ev-eval-prev" ${evaluatorIndex <= 0 ? 'disabled' : ''}>← Назад</button>
            <button class="ev-btn-secondary" id="ev-eval-save">Сохранить</button>
            <button class="ev-btn-main" id="ev-eval-save-next">Сохранить и дальше →</button>
          </div>
        </div>
      `;
      evaluatorEl.classList.remove('hidden');
      const scoreRange = $('#ev-eval-score');
      const scoreNum = $('#ev-eval-score-num');
      const scoreWord = $('#ev-eval-score-word');
      const sync = (value) => {
        const next = Math.max(1, Math.min(10, Math.round(Number(value) || 1)));
        scoreRange.value = String(next);
        scoreNum.value = String(next);
        scoreWord.textContent = `${next} · ${SCORE_WORDS[next] || ''}`;
      };
      scoreRange.addEventListener('input', () => sync(scoreRange.value));
      scoreNum.addEventListener('input', () => sync(scoreNum.value));
      $('#ev-eval-close').addEventListener('click', () => evaluatorEl.classList.add('hidden'));
      bindEvaluatorMediaAndAlt(opening, state);
      $('#ev-eval-prev').addEventListener('click', () => {
        if (evaluatorIndex > 0) { evaluatorIndex -= 1; renderEvaluator(state); }
      });
      $('#ev-eval-save').addEventListener('click', () => saveEventRating(state, false));
      $('#ev-eval-save-next').addEventListener('click', () => saveEventRating(state, true));
    }

    async function saveEventRating(state, goNext) {
      if (isAdmin()) {
        const errEl = $('#ev-eval-error');
        if (errEl) errEl.textContent = 'Сначала выбери в правом верхнем углу гостевой слот участника.';
        return;
      }
      const openingId = evaluatorQueue[evaluatorIndex];
      const opening = openingsById.get(String(openingId));
      const errEl = $('#ev-eval-error');
      const comment = String($('#ev-eval-comment')?.value || '').trim();
      const score = Math.max(1, Math.min(10, Math.round(Number($('#ev-eval-score-num')?.value || $('#ev-eval-score')?.value || 1))));
      const ratingNickname = String(eventRatingNickname(state) || '').trim();
      const myKey = normalizeNickname(ratingNickname);
      if (!opening || !myKey) return;
      if (!comment) {
        if (errEl) errEl.textContent = 'Комментарий обязателен. Хотя бы пару слов.';
        return;
      }
      const wasComplete = isUserSeasonComplete(state, myKey);
      const ratingRow = {
        ...(state.eventKind === 'ending-year' ? {
          eventKind: 'ending-year',
          periodKey: state.key,
          period: state.period,
          participantSlot: guestSlot
        } : {}),
        stage: 'first',
        seasonKey: state.key,
        year: state.year,
        ...(state.season ? { season: state.season } : {}),
        openingId: String(openingId),
        openingTitle: opening.title,
        nickname: ratingNickname,
        nicknameKey: myKey,
        ownerUid: currentActorUid(),
        createdByRole: isAdminGuestPreview() ? 'admin' : 'guest',
        adminCreated: isAdminGuestPreview(),
        adminNickname: isAdminGuestPreview() ? myName : '',
        score,
        comment
      };
      if (LOCAL_EVENTS_MODE) {
        saveLocalEventRating(ratingRow);
      } else {
        await setDoc(doc(db, 'eventRatings', `${state.key}__${myKey}__${openingId}`), {
          ...ratingRow,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      if (state.eventKind !== 'ending-year') await maybeCreateSeasonCompletionNotice(state, myKey, ratingRow, wasComplete);
      if (goNext && evaluatorIndex < evaluatorQueue.length - 1) {
        evaluatorIndex += 1;
        renderEvaluator(state);
      } else if (goNext) {
        evaluatorEl.classList.add('hidden');
      } else if (errEl) {
        errEl.textContent = 'Сохранено ✓';
        errEl.style.color = 'var(--green)';
      }
    }

    function bindShell() {
      document.querySelectorAll('.ev-mode-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          const requestedMode = ['endingrating', 'guess', 'bestworst', 'predictions', 'codenames', 'blindtier', 'whoami'].includes(btn.dataset.mode) ? btn.dataset.mode : 'rating';
          if (!canAccessMode(requestedMode)) {
            activeMode = defaultAccessibleMode();
            render();
            return;
          }
          activeMode = requestedMode;
          if (activeMode !== 'guess') closeGuessGame();
          render();
        });
      });
      document.querySelectorAll('.ev-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          activeStage = btn.dataset.stage;
          render();
        });
      });
      nameInput.addEventListener('input', () => {
        myName = nameInput.value.trim();
        if (myName) localStorage.setItem(NAME_KEY, myName);
        else localStorage.removeItem(NAME_KEY);
        if (isGuest()) scheduleRender();
        maybeShowCompletionNotice();
      });
      nameInput.addEventListener('change', () => {
        myName = nameInput.value.trim();
        if (myName) localStorage.setItem(NAME_KEY, myName);
        else localStorage.removeItem(NAME_KEY);
        render();
        maybeShowCompletionNotice();
      });
      if (roleSwitch) {
        fillRoleSwitch();
        roleSwitch.addEventListener('change', () => {
          if (!adminUnlocked) return;
          const value = roleSwitch.value;
          const savedAdminName = saveAdminNicknameFromUi();
          if (value === 'admin') {
            accessLevel = 'admin';
            guestSlot = 0;
            myName = savedAdminName || myName || '';
          } else {
            const match = value.match(/^guest-(0[1-9]|1[0-5])$/);
            if (!match) return;
            accessLevel = 'guest';
            guestSlot = Number(match[1]);
            myName = savedAdminName || myName || getSavedAdminNickname() || '';
          }
          localStorage.setItem(ACCESS_KEY, accessLevel);
          localStorage.setItem(GUEST_SLOT_KEY, String(guestSlot || 0));
          localStorage.setItem(ADMIN_UNLOCKED_KEY, '1');
          updateAccessUi();
          render();
          maybeShowCompletionNotice();
        });
      }
      authSave.addEventListener('click', handleAuth);
      authPass.addEventListener('keydown', e => { if (e.key === 'Enter') handleAuth(); });
      nameSave.addEventListener('click', handleNameSave);
      if (nameClose) nameClose.addEventListener('click', () => {
        nameModal.classList.add('hidden');
        modalName.value = myName || getSavedAdminNickname() || '';
        if (modalAccountEmail) modalAccountEmail.value = '';
        if (modalAccountPass) modalAccountPass.value = '';
        nameError.textContent = '';
        nameInput.value = myName || getSavedAdminNickname() || '';
      });
      modalName.addEventListener('keydown', e => { if (e.key === 'Enter') handleNameSave(); });
      if (modalAccountPass) modalAccountPass.addEventListener('keydown', e => { if (e.key === 'Enter') handleNameSave(); });
    }

    function showAuthModal(message = '') {
      authError.textContent = message;
      authModal.classList.remove('hidden');
      setTimeout(() => authPass.focus(), 50);
    }

    function handleAuth() {
      const pass = String(authPass.value || '').trim();
      const guestMatch = pass.match(GUEST_PASSWORD_RE);
      if (pass === USER_PASSWORD) {
        accessLevel = 'user';
        guestSlot = 0;
        adminUnlocked = false;
        myName = getSavedAdminNickname() || myName || '';
      } else if (guestMatch) {
        accessLevel = 'guest';
        guestSlot = Number(guestMatch[1]);
        adminUnlocked = false;
        myName = getSavedAdminNickname() || myName || '';
      } else {
        authError.textContent = 'Неверный пароль.';
        return;
      }
      localStorage.setItem(ACCESS_KEY, accessLevel);
      localStorage.setItem(GUEST_SLOT_KEY, String(guestSlot || 0));
      localStorage.setItem(ADMIN_UNLOCKED_KEY, adminUnlocked ? '1' : '0');
      authModal.classList.add('hidden');
      authPass.value = '';
      if (isGuest()) activeMode = 'rating';
      updateAccessUi();
      if ((isAdmin() || isUser() || isGuest()) && !myName) showNameModal();
      render();
      maybeShowCompletionNotice();
    }

    function showNameModal() {
      modalName.value = myName || '';
      if (modalAccountEmail) modalAccountEmail.value = '';
      if (modalAccountPass) modalAccountPass.value = '';
      nameError.textContent = '';
      nameModal.classList.remove('hidden');
      setTimeout(() => modalName.focus(), 50);
    }

    async function handleNameSave() {
      const name = String(modalName.value || '').trim();
      if (!name) {
        nameError.textContent = 'Никнейм обязателен.';
        return;
      }
      if (accessLevel === 'admin' && !isAdminNickname(name)) {
        nameError.textContent = 'Админский вход разрешён только аккаунтам: Пёс кошачий, Toxexex, Egortos и Кофа.';
        return;
      }
      const profile = protectedProfile(name);
      if (profile && auth.currentUser?.uid !== profile.authUid) {
        if (!PERSONAL_ACCOUNT_AUTH_ENABLED) {
          nameError.textContent = PERSONAL_ACCOUNT_DISABLED_MESSAGE;
          return;
        }
        const email = String(modalAccountEmail?.value || '').trim();
        const password = String(modalAccountPass?.value || '');
        if (!email || !password) {
          nameError.textContent = 'Для этого аккаунта нужны email и личный пароль.';
          return;
        }
        try {
          await setPersistence(auth, rememberAccountInput?.checked ? browserLocalPersistence : browserSessionPersistence);
          const credential = await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
          if (credential.user.uid !== profile.authUid) throw new Error('Пароль относится к другому аккаунту.');
        } catch (error) {
          nameError.textContent = error?.code === 'auth/invalid-credential' ? 'Неверный личный пароль.' : ('Не удалось войти: ' + (error?.message || error));
          return;
        }
      } else if (!profile && !knownEventAccount(name) && normalizeNickname(name) !== normalizeNickname(myName)) {
        nameError.textContent = 'Такого аккаунта нет. Сначала зарегистрируй его на странице профиля основного сайта.';
        return;
      }
      myName = name;
      localStorage.setItem(NAME_KEY, myName);
      nameModal.classList.add('hidden');
      if (modalAccountEmail) modalAccountEmail.value = '';
      if (modalAccountPass) modalAccountPass.value = '';
      updateAccessUi();
      render();
      maybeShowCompletionNotice();
    }

    async function init() {
      let initialOpeningsResolved = false;
      const markEventsReady = (error = false) => {
        if (initialOpeningsResolved) return;
        initialOpeningsResolved = true;
        window.dispatchEvent(new CustomEvent(error ? 'oped:load-error' : 'oped:events-ready', {
          detail: { source: 'events-openings' }
        }));
      };
      if (!['user', 'admin', 'guest'].includes(accessLevel)) accessLevel = '';
      if (accessLevel === 'admin') accessLevel = '';
      if (accessLevel === 'guest' && !guestSlot) accessLevel = '';
      if (accessLevel === 'guest') activeMode = 'rating';
      bindShell();
      updateAccessUi();
      try {
        const restoredFromMain = await restoreMainSiteLogin();
        if (!auth.currentUser) await signInAnonymously(auth);
        if (restoredFromMain) updateAccessUi();
      } catch (e) {
        console.error('anonymous auth failed', e);
      }
      onSnapshot(collection(db, 'openings'), snapshot => {
        const firstOpeningLoad = openings.length === 0;
        const nextOpenings = snapshot.docs.map(d => normalizeOpening({ id: d.id, ...d.data() }));
        const previousSignatures = new Map(openings.map(opening => [String(opening.id), openingGameSignature(opening)]));
        const gameDataChanged = nextOpenings.length !== openings.length || nextOpenings.some(opening =>
          previousSignatures.get(String(opening.id)) !== openingGameSignature(opening)
        );
        openings = nextOpenings;
        openingsById = new Map(openings.map(o => [String(o.id), o]));
        if (gameDataChanged) scheduleFirebaseRender(firstOpeningLoad ? 'openings-initial' : 'openings');
        markEventsReady();
      }, error => {
        console.error('openings snapshot error', error);
        appEl.innerHTML = '<div class="ev-empty">Не удалось загрузить OP/ED.</div>';
        markEventsReady(true);
      });
      onSnapshot(collection(db, 'ratings'), snapshot => {
        mainRatings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        scheduleFirebaseRender('other');
      }, error => {
        console.error('ratings snapshot error', error);
        mainRatings = [];
        scheduleFirebaseRender('other');
      });
      onSnapshot(collection(db, 'userProfiles'), snapshot => {
        userProfiles = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        scheduleFirebaseRender('other');
      }, error => {
        console.error('userProfiles snapshot error', error);
        userProfiles = [];
        scheduleFirebaseRender('other');
      });
      onSnapshot(collection(db, 'guessCollections'), snapshot => {
        guessCollections = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        scheduleFirebaseRender('other');
      }, error => {
        console.error('guessCollections snapshot error', error);
        guessCollections = [];
        guessCollectionStatus = 'Не удалось загрузить подборки.';
        scheduleFirebaseRender('other');
      });
      onSnapshot(eventRoomRegistryRef('bestworst'), snapshot => {
        const data = snapshot.exists() ? snapshot.data() : {};
        if (snapshot.exists() && data.status) eventRoomCache.bestworst.set(BW_ROOM_ID, { id:BW_ROOM_ID, ...data });
        else eventRoomCache.bestworst.delete(BW_ROOM_ID);
        syncEventRoomSubscriptions('bestworst', data.roomIds || []);
      }, error => {
        console.error('bestWorstRooms registry snapshot error', error);
        bestWorstRoom = null;
        bestWorstStatus = 'Не удалось загрузить лобби.';
        scheduleFirebaseRender('other');
      });
      onSnapshot(collection(db, BW_SUBMISSION_COLLECTION), snapshot => {
        bestWorstSubmissions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        void bwMaybeAutoReveal();
        scheduleFirebaseRender('other');
      }, error => {
        console.error('bestWorstSubmissions snapshot error', error);
        bestWorstSubmissions = [];
        bestWorstStatus = 'Не удалось прочитать ответы bestWorstSubmissions.';
        scheduleFirebaseRender('other');
      });
      onSnapshot(eventRoomRegistryRef('codenames'), snapshot => {
        const data = snapshot.exists() ? snapshot.data() : {};
        if (snapshot.exists() && data.status) eventRoomCache.codenames.set(CODENAMES_ROOM_ID, { id:CODENAMES_ROOM_ID, ...data });
        else eventRoomCache.codenames.delete(CODENAMES_ROOM_ID);
        syncEventRoomSubscriptions('codenames', data.roomIds || []);
      }, error => {
        console.error('codenames registry snapshot error', error);
        codenamesRooms = [];
        codenamesRoom = null;
        codenamesStatus = 'Не удалось загрузить игру.';
        if (activeMode === 'codenames') scheduleFirebaseRender('other');
      });
      onSnapshot(eventRoomRegistryRef('whoami'), snapshot => {
        const data = snapshot.exists() ? snapshot.data() : {};
        if (snapshot.exists() && data.status) eventRoomCache.whoami.set(WHO_AM_I_ROOM_ID, { id:WHO_AM_I_ROOM_ID, ...data });
        else eventRoomCache.whoami.delete(WHO_AM_I_ROOM_ID);
        syncEventRoomSubscriptions('whoami', data.roomIds || []);
      }, error => {
        console.error('whoami registry snapshot error', error);
        whoAmIRooms = [];
        whoAmIRoom = null;
        whoAmIStatus = 'Не удалось загрузить комнаты «Кто я?».';
        if (activeMode === 'whoami') scheduleFirebaseRender('whoami');
      });
      onSnapshot(collection(db, PREDICTION_COLLECTION), snapshot => {
        const currentKey = predictionDocKey();
        const ownDocumentChanged = snapshot.docChanges().some(change => change.doc.id === currentKey);
        predictionDocs = new Map(snapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
        if (ownDocumentChanged && !predictionDraftDirty) {
          predictionDraft = null;
          predictionDraftKey = '';
          if (activeMode === 'predictions') scheduleFirebaseRender('other');
        }
      }, error => {
        console.error('eventPredictions snapshot error', error);
        predictionDocs = new Map();
        predictionStatus = 'Не удалось загрузить предикты.';
        if (activeMode === 'predictions') scheduleFirebaseRender('other');
      });
      if (LOCAL_EVENTS_MODE) {
        loadLocalEventData();
        scheduleFirebaseRender('other');
      } else {
        onSnapshot(collection(db, 'eventSeasons'), snapshot => {
          seasonDocs = new Map(snapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
          scheduleFirebaseRender('other');
        }, error => console.error('eventSeasons snapshot error', error));
        onSnapshot(collection(db, 'eventRatings'), snapshot => {
          eventRatings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          scheduleFirebaseRender('other');
        }, error => console.error('eventRatings snapshot error', error));
        onSnapshot(collection(db, 'eventBasket'), snapshot => {
          eventBasketError = '';
          eventBasket = {};
          snapshot.docs.forEach(d => { eventBasket[d.id] = { id: d.id, ...d.data() }; });
          scheduleFirebaseRender('other');
        }, error => {
          console.error('eventBasket snapshot error', error);
          eventBasketError = 'Не удалось загрузить корзину.';
          scheduleFirebaseRender('other');
        });
        onSnapshot(collection(db, 'eventAltLinks'), snapshot => {
          eventAltLinks = new Map(snapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
          scheduleFirebaseRender('other');
        }, error => console.error('eventAltLinks snapshot error', error));
        onSnapshot(collection(db, 'eventNotifications'), snapshot => {
          eventNotifications = new Map(snapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
          maybeShowCompletionNotice();
        }, error => console.error('eventNotifications snapshot error', error));
      }
      if (LOCAL_EVENTS_MODE) {
        window.addEventListener('storage', (e) => {
          if (e.key === EVENT_BASKET_KEY) {
            loadEventBasket();
            scheduleFirebaseRender('other');
          }
        });
      }
      setInterval(() => {
        [['bestworst',bestWorstRoom],['codenames',codenamesRoom],['whoami',whoAmIRoom]].forEach(([mode,room]) => {
          if (room && eventRoomId(mode) === room.id && !eventRoomPlayers(room).some(player => player.key === eventRoomPlayerKey(mode))) {
            void updateEventRoomSpectator(mode, room, true).catch(() => {});
          }
        });
      }, 10 * 60 * 1000);
      if (!hasAccess()) showAuthModal('Введите пароль для входа.');
      else if (isAdmin() && !myName) showNameModal();
      render();
    }

    init();
