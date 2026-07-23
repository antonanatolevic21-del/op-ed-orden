  import { adminUids } from './firebase-config.js';

  (function() {
    if (!window.storage) {
      window.storage = {
        async get(key, shared) {
          const value = localStorage.getItem(key);
          return value === null ? null : { value };
        },
        async set(key, value, shared) {
          localStorage.setItem(key, value);
          return true;
        }
      };
    }

    const KEY = 'op-ed-entries';
    const NAME_KEY = 'my-display-name';
    const AVATAR_KEY = 'my-avatar';
    const AVATARS_MAP_KEY = 'avatars-map';
    const DEMO_KEY = 'op-ed-demo-loaded';
    const MANUAL_RANKS_KEY = 'manual-ranks';
    const SCALE_KEY = 'rating-scale';
    const CONTENT_FILTER_KEY = 'content-filter-mode';
    const TIER_ORDERS_KEY = 'tier-orders';
    const TIER_LABELS_KEY = 'tier-labels';
    const TIER_PLACEMENTS_KEY = 'tier-placements';
    const ACCESS_KEY = 'op-ed-access-level';
    const PRIMARY_NAME_KEY = 'op-ed-primary-account-name';
    const PERSONAL_ACCOUNT_AUTH_ENABLED = true;
    const PERSONAL_ACCOUNT_DISABLED_MESSAGE = 'Регистрация сейчас недоступна. Попробуйте позже.';
    const ADMIN_NICKNAMES = new Set(['пес_кошачий', 'пёс_кошачий', 'toxexex', 'egortos', 'кофа']);
    const ADMIN_UIDS = new Set(adminUids);
    const EVENT_BASKET_KEY = 'aboba-events-basket-v1';
    const IMAGE_UPLOAD_WORKER = 'https://oped-image-upload.keeperkeeper2003-01e.workers.dev';
    const IMAGE_UPLOAD_SECRET_KEY = 'op-ed-image-upload-secret';
    const DAILY_DISMISSED_KEY = 'op-ed-daily-dismissed-v1';
    const DAILY_MSK_OFFSET_HOURS = 3;
    const DAILY_RELEASE_HOUR = 18;

    const EVENT_BASKET_ALLOWED = new Set(['пескошачий', 'egortos']);
    const MIN_PUBLIC_VOTES = 3;
    const FIVE_SCORE_LABELS = { 1: 'залупа', 2: 'не очень', 3: '50/50', 4: 'норм', 5: 'заебись' };
    const AVATAR_OPTIONS = ['🙂','😎','🦊','🐱','🐧','🐉','👹','🌸','🎧','🎤','🎵','🔥','💿','📼','🌙','⭐','📺','🎬','🍥','⚔️','👾','🦄','🐺','🍜'];
    let entries = [];
    let myName = '';
    let myAvatar = '🙂';
    let authenticatedUid = '';
    let avatarsMap = {};
    let ratingScale = 'int'; // 'int', 'half' or personal 'five'
    let accessLevel = sessionStorage.getItem(ACCESS_KEY) || '';
    const filters = { search: '', type: '', year: '', season: '', scoreCmp: '', scoreValue: '', missingOnly: false, hideChinese: true, hideMovie: true, hideShortened: true, studios: [], directors: [], performers: [], franchises: [] };
    let sortMode = 'added_desc';
    let editingId = null;
    let manualRanks = {};
    let topMode = 'manual'; // manual top is the main profile mode
    let arTypeFilter = '';
    let arScoreFilter = '';
    let arScoreMetric = 'total';
    let arSortDir = 'desc';
    let profileUser = '';
    let globalTopType = 'OP';
    let globalTopMode = 'manual';
    let globalTopScope = 'all';
    const PAGE_SIZE = 50;
    let chartPage = 1;
    let profileTopPage = { OP: 1, ED: 1 };
    let allRatingsPage = { OP: 1, ED: 1 };
    let manualEditMode = false;
    let manualDirty = false;
    let manualShowHidden = false;
    let manualHiddenForEdit = {};

    const SEASON_LABEL = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
    const $ = (sel) => document.querySelector(sel);
    const listContainer = $('#oc-list-container');
    const statusEl = $('#oc-status');
    const resultCountEl = $('#oc-resultcount');
    const nameInput = $('#oc-myname');
    const avatarBtn = $('#oc-avatar-btn');
    const avatarPicker = $('#oc-avatar-picker');
    const dailyBell = $('#oc-daily-bell');
    const dailyBellDot = $('#oc-daily-bell-dot');
    const dailyPanel = $('#oc-daily-panel');
    const dailyToast = $('#oc-daily-toast');
    const scaleSelect = $('#oc-scale-select');
    const contentFilterSelect = $('#oc-content-filter-select');
    const filterStatEl = $('#oc-filterstat');
    const mainPanel = $('#oc-main-panel');
    const profilePanel = $('#oc-profile-panel');
    const top100Panel = $('#oc-top100-panel');
    const seasonPanel = $('#oc-season-panel');
    const tierPanel = $('#oc-tier-panel');
    const statsPanel = $('#oc-stats-panel');
    const openingModal = $('#oc-opening-modal');
    const confirmModal = $('#oc-confirm-modal');
    const franchiseRepairModal = $('#oc-franchise-repair-modal');
    const imageMigrationBtn = $('#oc-image-migration-btn');
    const imageMigrationModal = $('#oc-image-migration-modal');
    let imageMigrationRunning = false;
    let imageMigrationStopRequested = false;


    const authModal = $('#oc-auth-modal');
    const authIdentifierInput = $('#oc-auth-identifier');
    const authPassInput = $('#oc-auth-pass');
    const authRememberInput = $('#oc-auth-remember');
    const authSaveBtn = $('#oc-auth-save');
    const authForgotBtn = $('#oc-auth-forgot');
    const authLogoutBtn = $('#oc-auth-logout');
    const authRegisterOpenBtn = $('#oc-auth-register-open');
    const registerModal = $('#oc-register-modal');
    const registerCloseBtn = $('#oc-register-close');
    const authError = $('#oc-auth-error');
    const authCloseBtn = $('#oc-auth-close');
    const accessBadge = $('#oc-access-badge');
    const franchiseRepairBtn = $('#oc-franchise-repair-btn');
    const profileUserSelect = $('#oc-profile-user');
    const manualHiddenToggleBtn = $('#oc-manual-hidden-toggle-btn');
    const profileDeleteBtn = $('#oc-profile-delete-btn');
    const seasonYearsEl = $('#oc-season-years');
    const seasonTitleEl = $('#oc-season-title');
    const seasonSubtitleEl = $('#oc-season-subtitle');
    const seasonListEl = $('#oc-season-list');
    const seasonRateBtn = $('#oc-season-rate-btn');
    const seasonRateAllBtn = $('#oc-season-rate-all-btn');
    const seasonPrevBtn = $('#oc-season-prev-btn');
    const seasonTierBtn = $('#oc-season-tier-btn');
    const evaluatorEl = $('#oc-season-evaluator');
    const nameModal = $('#oc-name-modal');
    const modalNameInput = $('#oc-modal-name');
    const modalNameSave = $('#oc-modal-name-save');
    const modalNameClose = $('#oc-modal-name-close');
    const modalAccountEmail = $('#oc-modal-account-email');
    const modalAccountPass = $('#oc-modal-account-pass');
    const forgotPasswordBtn = $('#oc-forgot-password');
    const rememberAccountInput = $('#oc-remember-account');
    const modalNameError = $('#oc-modal-name-error');
    const registerNameInput = $('#oc-register-name');
    const registerEmailInput = $('#oc-register-email');
    const registerPassInput = $('#oc-register-pass');
    const registerPassConfirmInput = $('#oc-register-pass-confirm');
    const registerRememberInput = $('#oc-register-remember');
    const registerSaveBtn = $('#oc-register-save');
    const registerError = $('#oc-register-error');

    const SEASON_ORDER = ['winter', 'spring', 'summer', 'fall'];
    const SEASON_START_MONTH = { winter: 0, spring: 3, summer: 6, fall: 9 };
    let activeTab = 'chart';
    let homeTestMode = 0;
    let expandedYear = new Date().getFullYear();
    let selectedSeason = null;
    let seasonType = 'OP';
    let seasonHideChinese = true;
    let seasonHideMovie = true;
    let seasonHideShortened = true;
    let seasonQueue = [];
    let seasonQueueIndex = 0;
    let evaluatorMode = 'season';
    let dailyActiveKey = '';
    let dailyCalendarMonth = null;
    let dailyRefreshTimer = null;
    let firebaseOpenings = [];
    let firebaseRatings = [];
    let firebaseManualRanks = [];
    let firebaseUserProfiles = [];
    let firebaseUnsubOpenings = null;
    let firebaseUnsubRatings = null;
    let firebaseUnsubManualRanks = null;
    let firebaseUnsubUserProfiles = null;
    let firebaseUnsubTierOrders = null;
    let firebaseUnsubEventBasket = null;
    let firebaseEventBasket = {};
    let firebaseEventBasketLoaded = false;
    let tierOrders = {};
    let tierLabels = {};
    let tierPlacements = {};
    let statsTypeFilter = '';
    let tierSelection = { type: 'OP', year: new Date().getFullYear(), season: 'winter' };
    let extendedDbCache = null;

    // ---------- performance layer for large catalogs ----------
    // UI shows only paginated cards, but with thousands of tracks the expensive part is
    // repeated filtering/statistics over the whole in-memory catalog. These counters and
    // caches keep repeated renders cheap and coalesce several Firestore snapshots into one UI refresh.
    let dataVersion = 0;
    let catalogVersion = 0;
    let manualRanksVersion = 0;
    let avatarsVersion = 0;
    let entriesById = new Map();
    let filterOptionsVersion = -1;
    let categoryCacheVersion = -1;
    let categoryCache = { studios: [], directors: [], performers: [], franchises: [], years: [] };
    let profileUsersCache = { key: '', names: [] };
    let filteredCache = { key: '', value: null };
    let sortedCache = { key: '', input: null, value: null };
    let uiRefreshTimer = null;
    let lastOpeningsSnapshotKey = '';

    function waitForFirebaseDb() {
      if (window.OPED_DB) return Promise.resolve(window.OPED_DB);

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Не удалось подключиться. Проверьте интернет и попробуйте ещё раз.'));
        }, 10000);

        window.addEventListener('oped-db-ready', () => {
          clearTimeout(timer);
          resolve(window.OPED_DB);
        }, { once: true });
      });
    }

    async function getExtendedDb() {
      if (extendedDbCache) return extendedDbCache;
      const appMod = await import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js');
      const fsMod = await import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js');
      const authMod = await import('https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js');
      const firebaseConfig = {
        apiKey: "AIzaSyB-twjseziMOfViTBjXErqlXkSIorlAUXE",
        authDomain: "op-ed-orden-eed04.firebaseapp.com",
        projectId: "op-ed-orden-eed04",
        storageBucket: "op-ed-orden-eed04.firebasestorage.app",
        messagingSenderId: "821108008660",
        appId: "1:821108008660:web:bab171d225e5c8cde2fd41"
      };
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
      try {
        const auth = authMod.getAuth(app);
        if (typeof auth.authStateReady === 'function') await auth.authStateReady();
        if (!auth.currentUser) await authMod.signInAnonymously(auth);
      } catch (e) {
        console.warn('anonymous auth for event basket failed', e);
      }
      extendedDbCache = { db: fsMod.getFirestore(app), ...fsMod };
      return extendedDbCache;
    }


    function makeDebounced(fn, delay = 250) {
      let timer = null;
      return function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    }

    function clearDerivedCaches() {
      filteredCache = { key: '', value: null };
      sortedCache = { key: '', input: null, value: null };
    }

    function touchEntryCache(entry) {
      if (!entry) return entry;
      ['scores', 'songScores', 'visualScores', 'personalScores'].forEach(key => {
        if (entry[key] && typeof entry[key] === 'object') {
          try { delete entry[key].__oc_stats; } catch (e) {}
        }
      });
      delete entry.__ocSearchText;
      return entry;
    }

    function rebuildFastIndexes({ catalogChanged = true } = {}) {
      entriesById = new Map(entries.map(e => [String(e.id), e]));
      dataVersion += 1;
      if (catalogChanged) {
        catalogVersion += 1;
        filterOptionsVersion = -1;
        categoryCacheVersion = -1;
      }
      profileUsersCache.key = '';
      clearDerivedCaches();
    }

    function markRatingDataChanged() {
      dataVersion += 1;
      profileUsersCache.key = '';
      clearDerivedCaches();
    }

    function markManualRanksChanged() {
      manualRanksVersion += 1;
      profileUsersCache.key = '';
      clearDerivedCaches();
    }

    function markAvatarsChanged() {
      avatarsVersion += 1;
      profileUsersCache.key = '';
    }

    function refreshVisiblePanels({ forceFilters = false } = {}) {
      if (forceFilters) populateFilterOptions(true);
      else syncFilterControls();
      populateProfileUsers();
      if (activeTab === 'chart') render();
      else if (activeTab === 'profile') renderProfile();
      else if (activeTab === 'top100') renderGlobalTop100();
      else if (activeTab === 'season') renderSeasonViews();
      else if (activeTab === 'tier') renderTierList();
      else if (activeTab === 'stats') renderStatsPage();
    }

    function scheduleVisibleRefresh(options = {}) {
      clearTimeout(uiRefreshTimer);
      uiRefreshTimer = setTimeout(() => {
        uiRefreshTimer = null;
        refreshVisiblePanels(options);
      }, 50);
    }


    function firestoreTimeKey(value) {
      if (!value) return '';
      if (typeof value.toMillis === 'function') return String(value.toMillis());
      if (typeof value.seconds === 'number') return `${value.seconds}:${value.nanoseconds || 0}`;
      if (value instanceof Date) return String(value.getTime());
      return String(value);
    }

    function currentPersonalUid() {
      return String(window.OPED_DB?.currentUserUid?.() || authenticatedUid || '');
    }

    function requirePersonalUid() {
      const uid = currentPersonalUid();
      if (!uid) throw new Error('Для сохранения нужен личный аккаунт.');
      return uid;
    }

    function openingsSnapshotKey(rows) {
      return (rows || []).map(row => `${row.id || ''}:${firestoreTimeKey(row.updatedAt || row.createdAt || '')}`).join('|');
    }

    async function saveOpeningExtras(openingId, extras) {
      if (!openingId || !extras) return;
      const ext = await getExtendedDb();
      const payload = { updatedAt: ext.serverTimestamp() };
      if (Object.prototype.hasOwnProperty.call(extras, 'franchises')) payload.franchises = cleanFranchiseList(extras.franchises);
      if (Object.prototype.hasOwnProperty.call(extras, 'alternativeTitles')) payload.alternativeTitles = cleanAliasList(extras.alternativeTitles);
      if (Object.prototype.hasOwnProperty.call(extras, 'isChinese')) payload.isChinese = Boolean(extras.isChinese);
      if (Object.prototype.hasOwnProperty.call(extras, 'isMovie')) payload.isMovie = Boolean(extras.isMovie);
      if (Object.prototype.hasOwnProperty.call(extras, 'isShortened')) payload.isShortened = Boolean(extras.isShortened);
      if (Object.prototype.hasOwnProperty.call(extras, 'sameSongGroupId')) payload.sameSongGroupId = String(extras.sameSongGroupId || '').trim();
      if (Object.prototype.hasOwnProperty.call(extras, 'sameSongTitle')) payload.sameSongTitle = String(extras.sameSongTitle || '').trim();
      await ext.setDoc(ext.doc(ext.db, 'openings', String(openingId)), payload, { merge: true });
    }

    async function saveRatingExtras(openingId, nickname, extras) {
      if (!window.OPED_DB || typeof window.OPED_DB.normalizeNickname !== 'function') return;
      const safeName = window.OPED_DB.normalizeNickname(nickname);
      const safeOpeningId = String(openingId || '').trim();
      if (!safeName || !safeOpeningId || !extras) return;
      const ext = await getExtendedDb();
      const payload = {
        openingId: safeOpeningId,
        nickname: String(nickname || '').trim(),
        nicknameKey: safeName,
        ownerUid: requirePersonalUid(),
        avatar: myAvatar,
        updatedAt: ext.serverTimestamp()
      };
      ['score', 'songScore', 'visualScore', 'personalScore'].forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(extras, key)) return;
        const val = extras[key];
        payload[key] = (val === null || val === undefined || val === '') ? ext.deleteField() : Number(val);
      });
      await ext.setDoc(ext.doc(ext.db, 'ratings', `${safeName}__${safeOpeningId}`), payload, { merge: true });
    }

    async function deleteCurrentRating(openingId, nickname, forceMode) {
      const entry = entriesById.get(String(openingId));
      const name = String(nickname || '').trim();
      if (!entry || !name) return;
      const mode = forceMode || (isPersonalScale() ? 'personal' : 'public');
      try {
        if (mode === 'personal') {
          if (entry.personalScores) delete entry.personalScores[name];
          await saveRatingExtras(entry.id, name, { personalScore: null });
        } else {
          if (entry.scores) delete entry.scores[name];
          if (entry.songScores) delete entry.songScores[name];
          if (entry.visualScores) delete entry.visualScores[name];
          if (window.OPED_DB && typeof window.OPED_DB.deleteRating === 'function') {
            await window.OPED_DB.deleteRating(entry.id, name, ['score', 'songScore', 'visualScore']);
          } else {
            await saveRatingExtras(entry.id, name, { score: null, songScore: null, visualScore: null });
          }
        }
        touchEntryCache(entry);
        markRatingDataChanged();
        render();
        renderSeasonViews();
        if (activeTab === 'profile') renderProfile();
        if (activeTab === 'tier') renderTierList();
        if (activeTab === 'stats') renderStatsPage();
      if (activeTab === 'top100') renderGlobalTop100();
        setStatus(mode === 'personal' ? 'Отметка удалена ✓' : 'Оценка удалена ✓');
      } catch (err) {
        console.error(err);
        setStatus('Не удалось удалить оценку.', true);
      }
    }

    function profileNameMatchesTarget(name, target, targetSafe, targetKeys) {
      const raw = String(name || '').trim();
      if (!raw) return false;
      const lower = raw.toLowerCase();
      if (targetKeys && (targetKeys.has(raw) || targetKeys.has(lower))) return true;
      if (lower === String(target || '').trim().toLowerCase()) return true;
      return manualUserSafeKey(raw) === targetSafe;
    }

    function deleteMatchingKeysFromMap(map, target, targetSafe, targetKeys) {
      if (!map) return;
      Object.keys(map).forEach(key => {
        if (profileNameMatchesTarget(key, target, targetSafe, targetKeys)) delete map[key];
      });
    }

    async function deleteProfileFully(targetUser) {
      if (!ensureAdmin()) return;
      const target = String(targetUser || '').trim();
      if (!target) { setStatus('Выбери профиль для удаления.', true); return; }
      if (!window.confirm(`Удалить профиль «${target}» полностью? Удалятся оценки, ручной топ-100, тир-листы и аватар. Это действие нельзя отменить.`)) return;
      const targetSafe = manualUserSafeKey(target);
      const targetKeys = new Set(manualCandidateKeys(target).flatMap(v => [String(v), String(v).toLowerCase()]));
      targetKeys.add(target);
      targetKeys.add(target.toLowerCase());
      targetKeys.add(targetSafe);

      entries.forEach(entry => {
        deleteMatchingKeysFromMap(entry.scores, target, targetSafe, targetKeys);
        deleteMatchingKeysFromMap(entry.songScores, target, targetSafe, targetKeys);
        deleteMatchingKeysFromMap(entry.visualScores, target, targetSafe, targetKeys);
        deleteMatchingKeysFromMap(entry.personalScores, target, targetSafe, targetKeys);
        touchEntryCache(entry);
      });
      deleteMatchingKeysFromMap(avatarsMap, target, targetSafe, targetKeys);
      Object.keys(manualRanks || {}).forEach(key => {
        const row = manualRanks[key] || {};
        if (profileNameMatchesTarget(key, target, targetSafe, targetKeys) ||
            profileNameMatchesTarget(row.nickname, target, targetSafe, targetKeys) ||
            profileNameMatchesTarget(row.nicknameKey, target, targetSafe, targetKeys)) {
          delete manualRanks[key];
        }
      });
      [tierOrders, tierLabels, tierPlacements].forEach(map => {
        Object.keys(map || {}).forEach(key => {
          const owner = String(key).split('|')[0] || '';
          if (profileNameMatchesTarget(owner, target, targetSafe, targetKeys)) delete map[key];
        });
      });

      persistManualRanksCache();
      try { window.storage && window.storage.set(AVATARS_MAP_KEY, JSON.stringify(avatarsMap), true); } catch (e) {}
      markRatingDataChanged();
      markManualRanksChanged();
      markAvatarsChanged();
      profileUsersCache = { key: '', names: [] };

      const errors = [];
      try {
        const ext = await getExtendedDb();
        const collectionsToScan = ['ratings', 'manualRanks', 'userProfiles', 'tierOrders', 'tierLabels', 'tierPlacements'];
        const deletes = [];
        for (const collectionName of collectionsToScan) {
          const snapshot = await ext.getDocs(ext.collection(ext.db, collectionName));
          snapshot.docs.forEach(d => {
            const row = { id: d.id, ...d.data() };
            const shouldDelete =
              profileNameMatchesTarget(row.nickname, target, targetSafe, targetKeys) ||
              profileNameMatchesTarget(row.displayName, target, targetSafe, targetKeys) ||
              profileNameMatchesTarget(row.name, target, targetSafe, targetKeys) ||
              profileNameMatchesTarget(row.nicknameKey, target, targetSafe, targetKeys) ||
              profileNameMatchesTarget(row.id, target, targetSafe, targetKeys) ||
              String(row.id || '').startsWith(`${targetSafe}__`);
            if (shouldDelete) deletes.push(ext.deleteDoc(ext.doc(ext.db, collectionName, d.id)));
          });
        }
        await Promise.allSettled(deletes).then(results => {
          results.filter(r => r.status === 'rejected').forEach(r => { console.error('Profile delete failed', r.reason); errors.push(r.reason); });
        });
      } catch (e) {
        console.error('Could not delete profile from Firebase', e);
        errors.push(e);
      }

      populateProfileUsers(true);
      if (profileUserSelect && profileUserSelect.value === target) profileUserSelect.value = '';
      render();
      renderSeasonViews();
      renderProfile();
      if (activeTab === 'tier') renderTierList();
      if (activeTab === 'top100') renderGlobalTop100();
      if (errors.length) setStatus('Не все данные профиля удалось удалить.', true);
      else setStatus(`Профиль «${target}» удалён полностью ✓`);
    }

    function safeDocPart(value) {
      return String(value || '').trim().toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 80);
    }

    function tierModeKey() {
      return isPersonalScale() ? 'five' : 'public';
    }

    function tierModeValue(mode) {
      return mode || tierModeKey();
    }

    function tierOrderDocId(user, type, year, season, score, mode) {
      const scoreKey = String(score).replace('.', '_');
      return `${tierContextDocId(user, type, year, season, mode)}__${scoreKey}`;
    }

    function tierContextDocId(user, type, year, season, mode) {
      const safeName = window.OPED_DB && typeof window.OPED_DB.normalizeNickname === 'function'
        ? window.OPED_DB.normalizeNickname(user)
        : safeDocPart(user);
      return `${safeName}__${tierModeValue(mode)}__${type}__${year}__${season}`;
    }

    function tierLabelDocId(user, type, year, season, score, mode) {
      const scoreKey = String(score).replace('.', '_');
      return `${tierContextDocId(user, type, year, season, mode)}__${scoreKey}`;
    }

    function tierOrderKey(user, type, year, season, score, mode) {
      return `${user || ''}|${tierModeValue(mode)}|${type}|${year}|${season}|${score}`;
    }

    async function startTierOrderWatcher() {
      try {
        const ext = await getExtendedDb();
        if (firebaseUnsubTierOrders) firebaseUnsubTierOrders();
        const unsubs = [];

        unsubs.push(ext.onSnapshot(ext.collection(ext.db, 'tierOrders'), snapshot => {
          const next = {};
          snapshot.docs.forEach(d => {
            const row = { id: d.id, ...d.data() };
            next[tierOrderKey(row.nickname, row.type, row.year, row.season, row.score, row.mode || 'public')] = Array.isArray(row.order) ? row.order.map(String) : [];
          });
          tierOrders = next;
          if (activeTab === 'tier') renderTierList();
        }, err => console.error('tierOrders watch error', err)));

        unsubs.push(ext.onSnapshot(ext.collection(ext.db, 'tierLabels'), snapshot => {
          const next = {};
          snapshot.docs.forEach(d => {
            const row = { id: d.id, ...d.data() };
            const val = String(row.label || '').trim();
            if (!val) return;
            next[tierLabelKey(row.nickname, row.type, row.year, row.season, row.score, row.mode || 'public')] = val;
          });
          tierLabels = next;
          if (activeTab === 'tier') renderTierList();
        }, err => console.error('tierLabels watch error', err)));

        unsubs.push(ext.onSnapshot(ext.collection(ext.db, 'tierPlacements'), snapshot => {
          const next = {};
          snapshot.docs.forEach(d => {
            const row = { id: d.id, ...d.data() };
            const placements = row.placements && typeof row.placements === 'object' ? row.placements : {};
            next[tierContextKey(row.nickname, row.type, row.year, row.season, row.mode || 'public')] = placements;
          });
          tierPlacements = next;
          if (activeTab === 'tier') renderTierList();
        }, err => console.error('tierPlacements watch error', err)));

        firebaseUnsubTierOrders = () => unsubs.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
      } catch (e) {
        console.error('Could not watch tier data', e);
      }
    }

    async function saveTierOrder(user, type, year, season, score, order) {
      const ext = await getExtendedDb();
      const mode = tierModeKey();
      const id = tierOrderDocId(user, type, year, season, score, mode);
      tierOrders[tierOrderKey(user, type, year, season, score, mode)] = order.slice().map(String);
      await ext.setDoc(ext.doc(ext.db, 'tierOrders', id), {
        nickname: user,
        nicknameKey: manualUserSafeKey(user),
        ownerUid: requirePersonalUid(),
        type,
        year: Number(year),
        season,
        score: Number(score),
        mode,
        order: order.map(String),
        updatedAt: ext.serverTimestamp()
      }, { merge: true });
    }

    async function loadTierOrders() {
      // Тир-лист загружается через Firestore watcher в startTierOrderWatcher().
    }


    function tierContextKey(user, type, year, season, mode) {
      return `${user || ''}|${tierModeValue(mode)}|${type}|${year}|${season}`;
    }

    function tierLabelKey(user, type, year, season, score, mode) {
      return `${tierContextKey(user, type, year, season, mode)}|${score}`;
    }

    async function loadTierLabels() {
      // Названия тиров загружаются через Firestore watcher в startTierOrderWatcher().
    }

    async function saveTierLabel(user, type, year, season, score, label) {
      const ext = await getExtendedDb();
      const mode = tierModeKey();
      const key = tierLabelKey(user, type, year, season, score, mode);
      const val = String(label || '').trim();
      if (val) tierLabels[key] = val;
      else delete tierLabels[key];
      const id = tierLabelDocId(user, type, year, season, score, mode);
      const payload = {
        nickname: user,
        nicknameKey: manualUserSafeKey(user),
        ownerUid: requirePersonalUid(),
        type,
        year: Number(year),
        season,
        score: Number(score),
        mode,
        updatedAt: ext.serverTimestamp()
      };
      if (val) payload.label = val;
      else payload.label = ext.deleteField();
      await ext.setDoc(ext.doc(ext.db, 'tierLabels', id), payload, { merge: true });
    }

    function tierDefaultLabel(score) {
      return isPersonalScale() ? formatFiveScore(score) : formatScore(score);
    }

    function tierLabelFor(user, type, year, season, score) {
      const keys = manualCandidateKeys(user);
      for (const candidate of keys) {
        const val = tierLabels[tierLabelKey(candidate, type, year, season, score)];
        if (val) return val;
      }
      return tierLabels[tierLabelKey(user, type, year, season, score)] || tierDefaultLabel(score);
    }

    async function loadTierPlacements() {
      // Переносы между допустимыми тирами загружаются через Firestore watcher в startTierOrderWatcher().
    }

    async function saveTierPlacements(user, type, year, season) {
      try {
        const ext = await getExtendedDb();
        const mode = tierModeKey();
        const ctx = tierContextKey(user, type, year, season, mode);
        const placements = tierPlacements[ctx] || {};
        await ext.setDoc(ext.doc(ext.db, 'tierPlacements', tierContextDocId(user, type, year, season, mode)), {
          nickname: user,
          nicknameKey: manualUserSafeKey(user),
          ownerUid: requirePersonalUid(),
          type,
          year: Number(year),
          season,
          mode,
          placements,
          updatedAt: ext.serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error('Could not save tier placements to Firebase', e);
        throw e;
      }
    }

    function normalizeEntryFromFirebase(row) {
      return {
        id: row.id,
        title: row.title || '',
        alternativeTitles: cleanAliasList(row.alternativeTitles || row.altTitles || row.aliases || row.alternativeNames || row.altNames || []),
        type: row.type === 'ED' ? 'ED' : 'OP',
        year: row.year === null || row.year === undefined || row.year === '' ? null : Number(row.year),
        season: row.season || '',
        studios: row.studios || (row.studio ? [row.studio] : []),
        directors: row.directors || [],
        performers: row.performers || [],
        franchises: cleanFranchiseList(row.franchises || row.franchise || []),
        image: row.image || '',
        fallbackImage: row.fallbackImage || row.imageFallback || '',
        sameSongGroupId: String(row.sameSongGroupId || row.songGroupId || '').trim(),
        sameSongTitle: String(row.sameSongTitle || row.songGroupTitle || '').trim(),
        link: row.link || '',
        notes: row.notes || '',
        isChinese: Boolean(row.isChinese || row.chinese || row.isChina || row.chineseOpening),
        isMovie: Boolean(row.isMovie || row.movie || row.isFilm || row.filmOpening),
        isShortened: Boolean(row.isShortened || row.shortened || row.isShort || row.short || row.shortOpening || row.shortenedOpening),
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null,
        scores: {},
        songScores: {},
        visualScores: {},
        personalScores: {}
      };
    }

    function rebuildEntriesFromFirebase() {
      const next = firebaseOpenings.map(normalizeEntryFromFirebase);
      const byId = new Map(next.map(e => [String(e.id), e]));
      let avatarChanged = false;

      firebaseRatings.forEach(r => {
        const openingId = String(r.openingId || '');
        const entry = byId.get(openingId);
        const nickname = String(r.nickname || '').trim();
        const score = normalizeOptionalNumber(r.score);
        const songScore = normalizeOptionalNumber(r.songScore);
        const visualScore = normalizeOptionalNumber(r.visualScore);
        const personalScore = normalizeOptionalNumber(r.personalScore);

        if (!entry || !nickname) return;
        if (r.avatar) {
          const av = String(r.avatar).trim();
          if (av && avatarsMap[nickname] !== av) { avatarsMap[nickname] = av; avatarChanged = true; }
        }
        if (Number.isFinite(personalScore)) {
          entry.personalScores = entry.personalScores || {};
          entry.personalScores[nickname] = personalScore;
        }
        if (Number.isFinite(score)) {
          entry.scores = entry.scores || {};
          entry.scores[nickname] = score;
          if (Number.isFinite(songScore)) {
            entry.songScores = entry.songScores || {};
            entry.songScores[nickname] = songScore;
          }
          if (Number.isFinite(visualScore)) {
            entry.visualScores = entry.visualScores || {};
            entry.visualScores[nickname] = visualScore;
          }
        } else {
          if (Number.isFinite(songScore)) {
            entry.songScores = entry.songScores || {};
            entry.songScores[nickname] = songScore;
          }
          if (Number.isFinite(visualScore)) {
            entry.visualScores = entry.visualScores || {};
            entry.visualScores[nickname] = visualScore;
          }
        }
      });

      const snapshotKey = openingsSnapshotKey(firebaseOpenings);
      const catalogChanged = snapshotKey !== lastOpeningsSnapshotKey;
      lastOpeningsSnapshotKey = snapshotKey;
      entries = next;
      rebuildFastIndexes({ catalogChanged });
      if (avatarChanged) markAvatarsChanged();
      scheduleVisibleRefresh({ forceFilters: catalogChanged });
    }

    function rowHasManualTopData(row) {
      return !!(row && (
        Array.isArray(row.OP) || Array.isArray(row.ED) ||
        Array.isArray(row.op) || Array.isArray(row.ed) ||
        Array.isArray(row.manualOP) || Array.isArray(row.manualED) ||
        Array.isArray(row.excludedOP) || Array.isArray(row.excludedED)
      ));
    }

    function manualRankRowIdentity(row) {
      if (!row) return { display: '', safeKey: '' };
      const nickname = String(row.nickname || row.displayName || row.name || '').trim();
      const rawId = String(row.id || '').trim();
      const nicknameKeyRaw = String(row.nicknameKey || '').trim();
      const displayName = nickname || (rawId && rawId.indexOf('__') === -1 ? rawId : '');
      const safeKey = nicknameKeyRaw || (displayName ? manualUserSafeKey(displayName) : rawId);
      return { display: displayName || safeKey, safeKey };
    }

    function isCurrentManualRankRow(row) {
      if (!myName || !row) return false;
      const identity = manualRankRowIdentity(row);
      const raw = String(myName || '').trim();
      const safe = manualUserSafeKey(raw);
      const candidates = [identity.display, identity.safeKey, row.nickname, row.displayName, row.name, row.id]
        .map(v => String(v || '').trim())
        .filter(Boolean);
      return candidates.some(v => v.toLowerCase() === raw.toLowerCase() || manualUserSafeKey(v) === safe);
    }

    function shouldKeepLocalManualDraft(row) {
      return !!(manualDirty && manualEditMode && isCurrentManualRankRow(row));
    }

    function mergeManualRankRowInto(target, row) {
      if (!row || !rowHasManualTopData(row)) return;
      if (shouldKeepLocalManualDraft(row)) return;
      const identity = manualRankRowIdentity(row);
      const display = identity.display;
      const safeKey = identity.safeKey;
      if (!display && !safeKey) return;
      const hasOP = Array.isArray(row.OP) || Array.isArray(row.manualOP) || Array.isArray(row.op);
      const hasED = Array.isArray(row.ED) || Array.isArray(row.manualED) || Array.isArray(row.ed);
      const hasExcludedOP = Array.isArray(row.excludedOP);
      const hasExcludedED = Array.isArray(row.excludedED);
      const op = Array.isArray(row.OP) ? row.OP.map(String) : (Array.isArray(row.manualOP) ? row.manualOP.map(String) : (Array.isArray(row.op) ? row.op.map(String) : []));
      const ed = Array.isArray(row.ED) ? row.ED.map(String) : (Array.isArray(row.manualED) ? row.manualED.map(String) : (Array.isArray(row.ed) ? row.ed.map(String) : []));
      const excludedOP = hasExcludedOP ? row.excludedOP.map(String) : [];
      const excludedED = hasExcludedED ? row.excludedED.map(String) : [];
      const prev = { ...(target[display] || {}), ...(safeKey ? (target[safeKey] || {}) : {}) };
      const profileRow = {
        ...prev,
        nickname: display,
        nicknameKey: safeKey || manualUserSafeKey(display)
      };
      if (hasOP) profileRow.OP = op.slice(0, 100);
      else if (!Array.isArray(profileRow.OP)) profileRow.OP = [];
      if (hasED) profileRow.ED = ed.slice(0, 100);
      else if (!Array.isArray(profileRow.ED)) profileRow.ED = [];
      if (hasExcludedOP) profileRow.excludedOP = Array.from(new Set(excludedOP));
      else if (!Array.isArray(profileRow.excludedOP)) profileRow.excludedOP = [];
      if (hasExcludedED) profileRow.excludedED = Array.from(new Set(excludedED));
      else if (!Array.isArray(profileRow.excludedED)) profileRow.excludedED = [];
      target[display] = profileRow;
      if (profileRow.nicknameKey && profileRow.nicknameKey !== display) target[profileRow.nicknameKey] = profileRow;
    }

    function persistManualRanksCache() {
      try { window.storage && window.storage.set(MANUAL_RANKS_KEY, JSON.stringify(manualRanks), true); } catch (e) {}
    }

    function refreshAfterManualRankCacheChange() {
      markManualRanksChanged();
      scheduleVisibleRefresh();
    }

    function rebuildManualRanksFromFirebase() {
      if (!Array.isArray(firebaseManualRanks)) return;
      const next = { ...manualRanks };
      firebaseManualRanks.forEach(row => mergeManualRankRowInto(next, row));
      manualRanks = next;
      persistManualRanksCache();
      refreshAfterManualRankCacheChange();
    }

    function rebuildManualRanksFromRatingDocs() {
      if (!Array.isArray(firebaseRatings)) return;
      const next = { ...manualRanks };
      firebaseRatings.forEach(row => {
        const openingId = String(row.openingId || '').trim();
        if (openingId === '__manualRanks' || rowHasManualTopData(row)) {
          mergeManualRankRowInto(next, row);
        }
      });
      manualRanks = next;
      persistManualRanksCache();
      refreshAfterManualRankCacheChange();
    }

    function rebuildUserProfilesFromFirebase() {
      const next = { ...avatarsMap };
      const nextManualRanks = { ...manualRanks };
      (firebaseUserProfiles || []).forEach(row => {
        const nickname = String(row.nickname || row.displayName || row.name || row.id || '').trim();
        const nicknameKey = String(row.nicknameKey || row.id || '').trim();
        const avatar = String(row.avatar || '').trim();
        if (nickname && avatar) next[nickname] = avatar;
        if (rowHasManualTopData(row)) mergeManualRankRowInto(nextManualRanks, row);
      });
      avatarsMap = next;
      manualRanks = nextManualRanks;
      markAvatarsChanged();
      markManualRanksChanged();
      try { window.storage && window.storage.set(AVATARS_MAP_KEY, JSON.stringify(avatarsMap), true); } catch (e) {}
      persistManualRanksCache();
      scheduleVisibleRefresh();
      refreshDailyUi();
    }

    function setStatus(msg, isError) {
      statusEl.textContent = msg;
      statusEl.style.color = isError ? '#FF2E63' : '#8B8698';
      if (msg) setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ''; }, 3000);
    }

    function normalizedAccountName(name) {
      return String(name || '').trim().toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
    }

    function isAdminNickname(name = myName) {
      return ADMIN_NICKNAMES.has(normalizedAccountName(name));
    }

    function isAdminUid(uid = authenticatedUid) {
      return ADMIN_UIDS.has(String(uid || ''));
    }

    function isAdmin() {
      return accessLevel === 'admin' && isAdminUid();
    }

    function renderHomeTestShowcase() {
      const showcase = $('#oc-home-test-showcase');
      const root = $('#opedchart-root');
      const mode = isAdmin() ? Number(homeTestMode || 0) : 0;
      root?.classList.remove('oc-home-test-1', 'oc-home-test-2', 'oc-home-test-3', 'oc-home-test-4');
      if (mode) root?.classList.add(`oc-home-test-${mode}`);
      document.querySelectorAll('[data-home-test]').forEach(button => button.classList.toggle('active', Number(button.dataset.homeTest) === mode));
      document.querySelector('.oc-tab-btn[data-tab="chart"]')?.classList.toggle('active', activeTab === 'chart' && mode === 0);
      if (showcase) {
        showcase.classList.add('hidden');
        showcase.innerHTML = '';
      }
    }

    function setHomeTestMode(mode) {
      if (!isAdmin()) return;
      homeTestMode = [1, 2, 3, 4].includes(Number(mode)) ? Number(mode) : 0;
      switchTab('chart');
      render();
    }

    function updateAccessUi() {
      if (!isAdmin()) homeTestMode = 0;
      document.querySelectorAll('.oc-admin-only').forEach(el => el.classList.toggle('oc-locked', !isAdmin()));
      if (accessBadge) {
        accessBadge.textContent = isAdmin() ? 'админ' : (accessLevel ? 'вход' : 'гость');
        accessBadge.classList.toggle('admin', isAdmin());
      }
    }

    function showAuthModal(message) {
      if (!authModal) return;
      authError.textContent = message || '';
      authModal.classList.remove('hidden');
      setTimeout(() => authIdentifierInput && authIdentifierInput.focus(), 0);
    }

    function hideAuthModal() {
      if (authModal) authModal.classList.add('hidden');
      if (authError) authError.textContent = '';
      if (authPassInput) authPassInput.value = '';
    }

    function showRegistrationModal() {
      hideAuthModal();
      if (registerError) registerError.textContent = '';
      if (registerNameInput && !registerNameInput.value) registerNameInput.value = '';
      registerModal?.classList.remove('hidden');
      setTimeout(() => registerNameInput?.focus(), 0);
    }

    function hideRegistrationModal() {
      registerModal?.classList.add('hidden');
      if (registerError) registerError.textContent = '';
    }

    function requireAccount(message = 'Войди в аккаунт, чтобы открыть этот раздел.') {
      if (accessLevel) return true;
      showAuthModal(message);
      return false;
    }

    async function applyPersonalAccountSession(result, remember = true) {
      const profile = result?.profile;
      const nickname = String(profile?.nickname || profile?.nicknameKey || profile?.id || '').trim();
      if (!nickname) throw new Error('Не удалось определить аккаунт.');
      authenticatedUid = String(result?.user?.uid || profile?.authUid || '');
      const index = firebaseUserProfiles.findIndex(row => normalizedAccountName(row.nicknameKey || row.nickname || row.id) === normalizedAccountName(nickname));
      if (index >= 0) firebaseUserProfiles[index] = { ...firebaseUserProfiles[index], ...profile };
      else firebaseUserProfiles.push(profile);
      await saveName(nickname);
      localStorage.setItem(PRIMARY_NAME_KEY, nickname);
      nameInput.value = nickname;
      accessLevel = isAdminUid() ? 'admin' : 'user';
      sessionStorage.setItem(ACCESS_KEY, accessLevel);
      hideAuthModal();
      updateAccessUi();
      render();
      if (activeTab === 'profile') renderProfile();
      setStatus(`Вход выполнен: ${nickname} ✓`);
      return true;
    }

    async function commitPersonalLogin() {
      const identifier = String(authIdentifierInput?.value || '').trim();
      const password = String(authPassInput?.value || '');
      if (!identifier || !password) { showAuthModal('Введи email и личный пароль.'); return false; }
      if (!identifier.includes('@')) { showAuthModal('Для безопасного входа теперь нужно указывать email.'); return false; }
      const originalText = authSaveBtn?.textContent || 'Войти в аккаунт';
      if (authSaveBtn) { authSaveBtn.disabled = true; authSaveBtn.textContent = 'Входим…'; }
      if (authError) authError.textContent = 'Проверяем данные…';
      try {
        const db = await waitForFirebaseDb();
        const result = await db.loginPersonalAccount(identifier, password, Boolean(authRememberInput?.checked));
        return await applyPersonalAccountSession(result, Boolean(authRememberInput?.checked));
      } catch (error) {
        console.error('Personal account login failed', error);
        const code = String(error?.code || '');
        const message = code === 'auth/invalid-credential' || code === 'auth/wrong-password' ? 'Неверный email или личный пароль.' : (error?.message || 'Не удалось войти.');
        showAuthModal(message);
        return false;
      } finally {
        if (authSaveBtn) { authSaveBtn.disabled = false; authSaveBtn.textContent = originalText; }
      }
    }

    function ensureAdmin() {
      if (isAdmin()) return true;
      setStatus('Нужен админ-пароль: добавление, редактирование и удаление доступны только админу.', true);
      return false;
    }

    function accountProfile(name) {
      const safe = normalizedAccountName(name);
      return firebaseUserProfiles.find(row => normalizedAccountName(row.nicknameKey || row.nickname || row.id) === safe) || null;
    }

    function knownLegacyAccount(name) {
      const safe = normalizedAccountName(name);
      if (!safe) return false;
      if (accountProfile(name)) return true;
      if (Object.keys(avatarsMap || {}).some(key => normalizedAccountName(key) === safe)) return true;
      return entries.some(entry => ['scores', 'songScores', 'visualScores', 'personalScores'].some(field =>
        entry[field] && Object.keys(entry[field]).some(key => normalizedAccountName(key) === safe)
      ));
    }

    function showNameModal(message, candidate = '') {
      if (!nameModal) return;
      modalNameError.textContent = message || '';
      modalNameInput.value = String(candidate || myName || nameInput.value.trim() || '').trim();
      if (modalAccountEmail) modalAccountEmail.value = '';
      if (modalAccountPass) modalAccountPass.value = '';
      nameModal.classList.remove('hidden');
      setTimeout(() => modalNameInput.focus(), 0);
    }

    function hideNameModal() {
      if (nameModal) nameModal.classList.add('hidden');
      if (modalNameError) modalNameError.textContent = '';
      if (modalAccountEmail) modalAccountEmail.value = '';
      if (modalAccountPass) modalAccountPass.value = '';
      nameInput.value = myName || localStorage.getItem(PRIMARY_NAME_KEY) || '';
    }

    async function commitNickname(value) {
      const val = (value || '').trim();
      if (!val) {
        showNameModal('Введите никнейм, чтобы продолжить.');
        return false;
      }
      if (accessLevel === 'admin' && !isAdminNickname(val)) {
        showNameModal('Админский режим закреплён только за аккаунтами: Пёс кошачий, Toxexex, Egortos и Кофа.', val);
        return false;
      }
      const profile = accountProfile(val);
      if (profile && profile.authUid) {
        if (!PERSONAL_ACCOUNT_AUTH_ENABLED) {
          showNameModal(PERSONAL_ACCOUNT_DISABLED_MESSAGE, val);
          return false;
        }
        const email = String(modalAccountEmail?.value || '').trim();
        const password = String(modalAccountPass?.value || '');
        if (!email) {
          showNameModal('Введите email, привязанный к этому аккаунту.', val);
          return false;
        }
        if (!password) {
          showNameModal('Для этого аккаунта установлен личный пароль.', val);
          return false;
        }
        try {
          if (!window.OPED_DB || typeof window.OPED_DB.loginAccount !== 'function') throw new Error('Сервис ещё загружается. Попробуй через пару секунд.');
          const user = await window.OPED_DB.loginAccount(email, password, Boolean(rememberAccountInput?.checked));
          if (profile.authUid && user.uid !== profile.authUid) throw new Error('Пароль относится к другому аккаунту.');
          authenticatedUid = String(user.uid || '');
          accessLevel = isAdminUid() ? 'admin' : 'user';
          sessionStorage.setItem(ACCESS_KEY, accessLevel);
        } catch (error) {
          showNameModal('Не удалось войти: ' + (error?.code === 'auth/invalid-credential' ? 'неверный пароль.' : (error?.message || error)), val);
          return false;
        }
      } else if (!knownLegacyAccount(val) && normalizedAccountName(val) !== normalizedAccountName(myName)) {
        showNameModal('Такого аккаунта ещё нет. Зарегистрируй его в блоке «Личный аккаунт» на странице профиля.', val);
        return false;
      }
      nameInput.value = val;
      await saveName(val);
      localStorage.setItem(PRIMARY_NAME_KEY, val);
      hideNameModal();
      populateFilterOptions();
      render();
      renderSeasonViews();
      if (activeTab === 'profile') renderProfile();
      refreshDailyUi();
      setStatus('Вход выполнен: ' + val + ' ✓');
      return true;
    }

    function ensureNickname() {
      if (!requireAccount('Войди в аккаунт, чтобы продолжить.')) return false;
      if (myName) return true;
      showNameModal('Введите никнейм, чтобы оценивать треки.');
      return false;
    }

    function uid() {
      return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function isPersonalScale() {
      return ratingScale === 'five';
    }

    function normalizePublicScore(value) {
      const num = normalizeOptionalNumber(value);
      if (num === null) return null;
      return Math.max(0.5, Math.min(10, Number(num.toFixed(1))));
    }

    function scoreStats(scores) {
      if (!scores || typeof scores !== 'object') return { keyCount: 0, count: 0, avgAny: null, sum: 0 };
      const keys = Object.keys(scores);
      const cached = scores.__oc_stats;
      if (cached && cached.keyCount === keys.length) return cached;
      let sum = 0;
      let count = 0;
      keys.forEach(key => {
        const val = normalizePublicScore(scores[key]);
        if (val !== null) { sum += val; count += 1; }
      });
      const stats = { keyCount: keys.length, count, avgAny: count ? sum / count : null, sum };
      try { Object.defineProperty(scores, '__oc_stats', { value: stats, configurable: true, enumerable: false }); }
      catch (e) { scores.__oc_stats = stats; }
      return stats;
    }

    function scoreValues(scores) {
      return Object.keys(scores || {}).map(k => normalizePublicScore(scores[k])).filter(v => v !== null);
    }

    function ratingCount(scores) {
      return scoreStats(scores).count;
    }

    function avg(scores, minVotes = MIN_PUBLIC_VOTES) {
      const stats = scoreStats(scores);
      if (stats.count < minVotes) return null;
      return stats.avgAny;
    }

    function avgAny(scores) {
      return scoreStats(scores).avgAny;
    }

    function adminScoreStats(scores) {
      const values = Object.entries(scores || {})
        .filter(([nickname]) => isAdminNickname(nickname))
        .map(([,value]) => normalizePublicScore(value))
        .filter(value => value !== null);
      return {
        count: values.length,
        avgAny: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
      };
    }

    function adminAvg(scores, minVotes = 1) {
      const stats = adminScoreStats(scores);
      return stats.count >= minVotes ? stats.avgAny : null;
    }

    function adminRatingCount(scores) {
      return adminScoreStats(scores).count;
    }

    function visibleAverageMarkup(entry, generalScore = avg(entry?.scores)) {
      const general = formatScore(generalScore);
      if (!isAdmin()) return general;
      const adminScore = adminAvg(entry?.scores);
      const adminCount = adminRatingCount(entry?.scores);
      return `${general}<span class="oc-season-score-sub">адм. ${formatScore(adminScore)} · ${adminCount}</span>`;
    }

    function normalizedPublicScoreRatio(score) {
      const n = Number(score);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(1, (n - 1) / 9));
    }

    function ringColor(score) {
      if (score === null) return '#2A2435';
      const ratio = normalizedPublicScoreRatio(score);
      if (ratio >= 0.75) return '#08D9D6';
      if (ratio >= 0.45) return '#FFC857';
      return '#FF2E63';
    }

    function formatScore(v) {
      if (v === null || v === undefined || v === '') return '—';
      const n = Number(v);
      if (!Number.isFinite(n)) return '—';
      return Number.isInteger(n) ? String(n) : n.toFixed(1);
    }

    function formatFiveScore(v) {
      const score = Math.max(1, Math.min(5, Math.round(Number(v) || 1)));
      return FIVE_SCORE_LABELS[score] || String(score);
    }

    function formatInputScore(v) {
      return isPersonalScale() ? formatFiveScore(v) : formatScore(v);
    }

    function scaleStep() {
      return ratingScale === 'half' ? 0.5 : 1;
    }

    function ratingMax() {
      return ratingScale === 'five' ? 5 : 10;
    }

    function defaultScore() {
      return ratingScale === 'five' ? 3 : 5;
    }

    function normalizedScoreRatio(score) {
      const min = ratingMin();
      const max = ratingMax();
      const n = Number(score);
      if (!Number.isFinite(n) || max <= min) return 0;
      return Math.max(0, Math.min(1, (n - min) / (max - min)));
    }

    function normalizeOptionalNumber(value) {
      if (value === null || value === undefined || String(value).trim() === '') return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    }

    function scoreToCurrentScale(value) {
      const num = normalizeOptionalNumber(value);
      if (num === null) return null;
      return Math.max(ratingMin(), Math.min(ratingMax(), Number(num.toFixed(1))));
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }

    function normalizeUrl(url) {
      if (!url) return '';
      const clean = String(url).trim();
      if (/^(?:\.{0,2}\/|images\/)/i.test(clean)) return clean;
      if (!/^https?:\/\//i.test(clean)) return 'https://' + clean;
      return clean;
    }

    window.ocUseFallbackImage = function(img) {
      if (!img) return;
      const fallback = String(img.dataset.fallback || '').trim();
      if (fallback && img.dataset.fallbackTried !== '1') {
        img.dataset.fallbackTried = '1';
        img.src = fallback;
        return;
      }
      img.replaceWith(document.createTextNode('нет изображения'));
    };

    document.addEventListener('error', event => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      if (image.dataset.removeOnError === '1') image.remove();
      else window.ocUseFallbackImage(image);
    }, true);

    function safeExternalUrl(url) {
      const normalized = normalizeUrl(String(url || '').trim());
      if (!normalized) return '';
      try {
        const parsed = new URL(normalized);
        if (!['http:', 'https:'].includes(parsed.protocol)) return '';
        return parsed.href;
      } catch (e) {
        return '';
      }
    }

    function getDirectVideoType(url) {
      const href = safeExternalUrl(url);
      if (!href) return '';
      try {
        const parsed = new URL(href);
        const text = `${parsed.pathname} ${parsed.search}`.toLowerCase();
        if (/\.webm(?:$|[?#&\s])/.test(text) || text.includes('.webm')) return 'video/webm';
        if (/\.mp4(?:$|[?#&\s])/.test(text) || text.includes('.mp4')) return 'video/mp4';
        if (/\.ogg(?:$|[?#&\s])/.test(text) || text.includes('.ogv')) return 'video/ogg';
      } catch (e) {}
      return '';
    }

    function getVideoEmbedUrl(url) {
      const href = safeExternalUrl(url);
      if (!href || getDirectVideoType(href)) return '';
      try {
        const parsed = new URL(href);
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        if (host === 'youtu.be') {
          const id = parsed.pathname.split('/').filter(Boolean)[0];
          return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : '';
        }
        if (host.endsWith('youtube.com')) {
          if (parsed.pathname.startsWith('/embed/')) return `${parsed.origin}${parsed.pathname}?autoplay=1&rel=0`;
          if (parsed.pathname.startsWith('/shorts/')) {
            const id = parsed.pathname.split('/').filter(Boolean)[1];
            return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : '';
          }
          const id = parsed.searchParams.get('v');
          return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : '';
        }
        if (host.endsWith('vimeo.com')) {
          const id = parsed.pathname.split('/').filter(Boolean).find(part => /^\d+$/.test(part));
          return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=1` : '';
        }
        if (host.endsWith('rutube.ru')) {
          const parts = parsed.pathname.split('/').filter(Boolean);
          const idx = parts.findIndex(part => part === 'video');
          const id = idx >= 0 ? parts[idx + 1] : '';
          return id ? `https://rutube.ru/play/embed/${encodeURIComponent(id)}` : '';
        }
      } catch (e) {}
      return '';
    }

    function renderOpeningVideoBlock(entry) {
      const imageInner = entry.image
        ? `<img loading="lazy" decoding="async" src="${escapeHtml(normalizeUrl(entry.image))}" data-fallback="${escapeHtml(normalizeUrl(entry.fallbackImage || ''))}" alt="${escapeHtml(entry.title)}">`
        : escapeHtml(entry.type || 'OP');
      const imageBlock = `<div class="oc-eval-image oc-opening-plain-image">${imageInner}</div>`;
      const href = safeExternalUrl(entry.link);
      if (!href) return imageBlock;
      const directType = getDirectVideoType(href);
      const embedUrl = directType ? '' : getVideoEmbedUrl(href);
      return `<button type="button" class="oc-video-cover" data-video-url="${escapeHtml(href)}" data-video-type="${escapeHtml(directType)}" data-embed-url="${escapeHtml(embedUrl)}" title="Запустить видео">${imageBlock}</button>`;
    }

    function bindVideoEmbeds(root) {
      const scope = root || document;
      scope.querySelectorAll('.oc-video-cover').forEach(videoCover => {
        if (videoCover.dataset.videoBound === '1') return;
        videoCover.dataset.videoBound = '1';
        videoCover.addEventListener('click', () => {
          const videoUrl = videoCover.dataset.videoUrl || '';
          const videoType = videoCover.dataset.videoType || '';
          const embedUrl = videoCover.dataset.embedUrl || '';
          if (videoType && videoUrl) {
            videoCover.outerHTML = `<div class="oc-video-frame"><video controls autoplay playsinline preload="metadata"><source src="${escapeHtml(videoUrl)}" type="${escapeHtml(videoType)}">Видео не удалось встроить. Откройте ссылку отдельно.</video></div>`;
          } else if (embedUrl) {
            videoCover.outerHTML = `<div class="oc-video-frame"><iframe src="${escapeHtml(embedUrl)}" title="Видео" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
          } else if (videoUrl) {
            window.open(videoUrl, '_blank', 'noopener,noreferrer');
          }
        });
      });
    }

    function bindOpeningVideoEmbed() {
      if (!openingModal) return;
      bindVideoEmbeds(openingModal);
    }

    function parseList(str) {
      return (str || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    function parseAliasList(str) {
      return String(str || '')
        .split(/\n|;/)
        .flatMap(part => part.split(' / '))
        .map(s => s.trim())
        .filter(Boolean);
    }

    function cleanList(value) {
      return Array.isArray(value) ? value.map(v => String(v).trim()).filter(Boolean) : parseList(value);
    }

    function parseFranchiseList(str) {
      return String(str || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
    }

    function cleanFranchiseList(value) {
      const raw = Array.isArray(value)
        ? value.flatMap(v => parseFranchiseList(String(v || '')))
        : parseFranchiseList(value);
      return Array.from(new Set(raw.map(v => String(v).trim()).filter(Boolean)));
    }

    function cleanAliasList(value) {
      const raw = Array.isArray(value) ? value : parseAliasList(value);
      return Array.from(new Set(raw.map(v => String(v).trim()).filter(Boolean)));
    }

    function cleanTitleForAutoAlias(title) {
      let value = String(title || '').trim();
      if (!value) return '';
      const noisyBlock = /(?:\b(?:ncop|nced|op|ed|opening|ending|open|version|ver|tv\s*size|creditless|clean|опенинг|опен|эндинг|версия|верс|вер)\b|\d)/i;
      value = value.replace(/[\(\[\{【［][^\)\]\}】］]*[\)\]\}】］]/g, part => noisyBlock.test(part) ? ' ' : part);
      value = value
        .replace(/\b(?:ncop|nced)\b/gi, ' ')
        .replace(/\b(?:op|ed)\s*\d*[a-zа-яё]?\b/gi, ' ')
        .replace(/\b(?:opening|ending|open)\s*\d*[a-zа-яё]?\b/gi, ' ')
        .replace(/\b(?:version|ver)\.?\s*\d*[a-zа-яё]?\b/gi, ' ')
        .replace(/\b(?:опенинг|опен|эндинг)\s*\d*[a-zа-яё]?\b/gi, ' ')
        .replace(/\b(?:версия|верс|вер)\.?\s*\d*[a-zа-яё]?\b/gi, ' ')
        .replace(/\b(?:tv\s*size|creditless|clean)\b/gi, ' ')
        .replace(/[№#]?\s*\b\d+(?:\.\d+)?\b/g, ' ')
        .replace(/\b(?:v|vol)\.?\s*\d+\b/gi, ' ')
        .replace(/\s*[\-–—:|/\\]+\s*$/g, ' ')
        .replace(/^[\s\-–—:|/\\]+|[\s\-–—:|/\\]+$/g, ' ')
        .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return value;
    }

    function alternativeTitlesForSave(title, value) {
      return cleanAliasList(value);
    }

    function compactFranchiseForCompare(name) {
      return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/&/g, 'and')
        .replace(/[^a-zа-яе0-9]+/gi, '')
        .trim();
    }

    function franchiseWordsForCompare(name) {
      return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .split(/[^a-zа-яе0-9]+/gi)
        .map(w => w.trim())
        .filter(w => w && !['the', 'a', 'an', 'season', 'сезон', 'tv', 'ova', 'ona', 'movie', 'фильм'].includes(w));
    }

    function knownFranchiseNames(exceptId = null) {
      const names = [];
      const seen = new Set();
      entries.forEach(entry => {
        if (exceptId && String(entry.id) === String(exceptId)) return;
        (entry.franchises || []).forEach(name => {
          const clean = String(name || '').trim();
          const key = clean.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
          if (!clean || seen.has(key)) return;
          seen.add(key);
          names.push(clean);
        });
      });
      return names;
    }

    function findSimilarFranchiseName(name, exceptId = null) {
      const source = String(name || '').trim();
      const target = compactFranchiseForCompare(source);
      if (target.length < 4) return null;

      const targetWords = franchiseWordsForCompare(source);
      let best = null;

      knownFranchiseNames(exceptId).forEach(existing => {
        const other = compactFranchiseForCompare(existing);
        if (!other || other.length < 4) return;

        if (other === target) {
          best = { name: existing, score: 999, distance: 0 };
          return;
        }

        let score = 0;
        const maxLen = Math.max(target.length, other.length);
        const minLen = Math.min(target.length, other.length);

        if (minLen >= 5 && (target.includes(other) || other.includes(target))) {
          score = 86 + (minLen / maxLen) * 10;
        } else {
          const lengthDiff = Math.abs(target.length - other.length);
          if (lengthDiff > Math.max(4, Math.floor(maxLen * 0.35))) return;
          const dist = levenshteinDistance(target, other);
          const ratio = 1 - dist / maxLen;
          const allowedDistance = maxLen <= 8 ? 2 : (maxLen <= 14 ? 3 : 4);
          if (dist <= allowedDistance || ratio >= 0.82) score = 70 + ratio * 20 - dist;
        }

        const otherWords = franchiseWordsForCompare(existing);
        if (targetWords.length && otherWords.length) {
          const otherSet = new Set(otherWords);
          const common = targetWords.filter(w => otherSet.has(w)).length;
          const coverage = common / Math.min(targetWords.length, otherWords.length);
          if (common >= 2 && coverage >= 0.55) score = Math.max(score, 78 + coverage * 14);
        }

        if (score <= 0) return;
        if (!best || score > best.score || (score === best.score && existing.length < best.name.length)) {
          best = { name: existing, score };
        }
      });

      return best && best.score >= 78 ? best.name : null;
    }

    function canonicalFranchiseName(name, exceptId = null) {
      const clean = String(name || '').trim();
      if (!clean) return '';
      return findSimilarFranchiseName(clean, exceptId) || clean;
    }

    function uniqueFranchiseList(values) {
      const result = [];
      const seen = new Set();
      values.forEach(value => {
        const clean = String(value || '').trim();
        if (!clean) return;
        const key = clean.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
        if (seen.has(key)) return;
        seen.add(key);
        result.push(clean);
      });
      return result;
    }

    function franchisesForSave(value) {
      return uniqueFranchiseList(cleanFranchiseList(value));
    }

    function normalizeFranchiseRepairText(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[«»„“”]/g, '"')
        .replace(/[’‘]/g, "'")
        .replace(/\s*,\s*/g, ',')
        .replace(/\s+/g, ' ')
        .replace(/^[\s"'\[\](){}`]+|[\s"'\[\](){}`]+$/g, '')
        .trim();
    }

    function franchiseCandidateMatchesTitle(title, candidate) {
      const normalizedCandidate = normalizeFranchiseRepairText(candidate);
      if (!normalizedCandidate || !normalizedCandidate.includes(',')) return false;

      const autoTitle = normalizeFranchiseRepairText(cleanTitleForAutoAlias(title));
      if (autoTitle === normalizedCandidate) return true;

      const rawTitle = normalizeFranchiseRepairText(title);
      if (!rawTitle.startsWith(normalizedCandidate)) return false;
      let remainder = rawTitle.slice(normalizedCandidate.length).trim();
      remainder = remainder.replace(/^[\s\-–—:|/\\·•]+/, '').trim();
      if (!remainder) return true;

      return /^(?:(?:ncop|nced|op|ed|opening|ending|open|опенинг|опен|эндинг)\b|(?:version|ver|версия|верс|вер)\.?\s*\d*\b|(?:tv\s*size|creditless|clean)\b)/i.test(remainder);
    }

    function buildFranchiseRepairPlan() {
      const repairs = [];
      const knownWholeFranchises = new Set();
      const knownFullTitles = new Set();

      entries.forEach(entry => {
        const titleKey = normalizeFranchiseRepairText(cleanTitleForAutoAlias(entry.title));
        if (titleKey) knownFullTitles.add(titleKey);
        cleanFranchiseList(entry.franchises || []).forEach(name => {
          const key = normalizeFranchiseRepairText(name);
          if (key) knownWholeFranchises.add(key);
        });
      });

      entries.forEach(entry => {
        const current = cleanFranchiseList(entry.franchises || []);
        const rawTitle = String(entry.title || '');
        if (!rawTitle.includes(',')) return;

        const fixed = current.slice();
        let changed = false;

        if (current.length >= 2) {
          for (let start = 0; start < fixed.length - 1; start++) {
            let bestEnd = -1;
            let bestCandidate = '';

            for (let end = fixed.length; end >= start + 2; end--) {
              const parts = fixed.slice(start, end);
              const candidate = parts.join(', ');
              if (!franchiseCandidateMatchesTitle(entry.title, candidate)) continue;

              const candidateKey = normalizeFranchiseRepairText(candidate);
              const alreadyKnownAsWhole = knownWholeFranchises.has(candidateKey);
              const standaloneTitleMatches = parts.reduce((count, part) =>
                count + (knownFullTitles.has(normalizeFranchiseRepairText(part)) ? 1 : 0), 0
              );

              if (!alreadyKnownAsWhole && standaloneTitleMatches >= 2) continue;
              bestEnd = end;
              bestCandidate = candidate;
              break;
            }

            if (bestEnd < 0) continue;
            fixed.splice(start, bestEnd - start, bestCandidate);
            changed = true;
          }
        }

        let after = uniqueFranchiseList(fixed);
        let kind = 'split';

        // Дополнительная проверка: в названии трека есть запятая,
        // но ни одна записанная франшиза её не содержит.
        if (!after.some(name => String(name || '').includes(','))) {
          const titleFranchise = cleanTitleForAutoAlias(entry.title);
          if (String(titleFranchise || '').includes(',')) {
            after = [String(titleFranchise).trim()];
            changed = true;
            kind = current.length ? 'missing-comma' : 'empty';
          }
        }

        if (!changed || (after.length === current.length && after.every((value, index) => value === current[index]))) return;
        repairs.push({
          id: String(entry.id),
          title: rawTitle,
          type: entry.type === 'ED' ? 'ED' : 'OP',
          kind,
          before: current,
          after
        });
      });

      return repairs;
    }

    function closeFranchiseRepairModal() {
      if (!franchiseRepairModal) return;
      franchiseRepairModal.classList.add('hidden');
      franchiseRepairModal.innerHTML = '';
    }

    function repairKindLabel(kind) {
      if (kind === 'split') return 'раздроблена по запятой';
      if (kind === 'empty') return 'франшиза отсутствует';
      return 'в названии есть запятая, во франшизе нет';
    }

    function renderFranchiseRepairModal(repairs) {
      if (!franchiseRepairModal) return;
      const rows = repairs.map((repair, index) => `
        <div class="oc-franchise-repair-row" data-repair-id="${escapeHtml(repair.id)}">
          <input class="oc-franchise-repair-check" type="checkbox" checked aria-label="Выбрать исправление ${index + 1}" />
          <div>
            <div class="oc-franchise-repair-track">${escapeHtml(repair.title)}</div>
            <span class="oc-franchise-repair-kind">${escapeHtml(repair.type)} · ${escapeHtml(repairKindLabel(repair.kind))}</span>
          </div>
          <div>
            <div class="oc-franchise-repair-label">Сейчас</div>
            <div class="oc-franchise-repair-before">${repair.before.length ? repair.before.map(escapeHtml).join('<br>') : '— пусто —'}</div>
          </div>
          <div>
            <div class="oc-franchise-repair-label">Будет после исправления · можно изменить</div>
            <textarea class="oc-franchise-repair-input" data-repair-value="${escapeHtml(repair.id)}">${escapeHtml(repair.after.join('\n'))}</textarea>
          </div>
        </div>`).join('');

      franchiseRepairModal.innerHTML = `
        <div class="oc-modal-card oc-franchise-repair-card">
          <div class="oc-modal-head">
            <div>
              <div class="oc-section-label">проверка базы</div>
              <div class="oc-modal-title">Починка франшиз</div>
            </div>
            <button class="oc-modal-close" type="button" data-franchise-repair-close>Закрыть ✕</button>
          </div>
          <div class="oc-franchise-repair-summary">
            Найдено подозрительных треков: ${repairs.length}. Проверь предлагаемые значения и сними галочки там, где менять ничего не нужно.
          </div>
          <div class="oc-franchise-repair-tools">
            <label class="oc-franchise-repair-select-all"><input type="checkbox" data-franchise-repair-select-all checked /> выбрать все</label>
            <span class="oc-hint" style="margin:0">Одна строка в поле = одна франшиза</span>
          </div>
          <div class="oc-franchise-repair-list">${rows}</div>
          <div class="oc-franchise-repair-actions">
            <button class="oc-cancel-btn" type="button" data-franchise-repair-close>Отмена</button>
            <button class="oc-save-btn" type="button" data-franchise-repair-apply>Внести выбранные изменения</button>
          </div>
        </div>`;
      franchiseRepairModal.classList.remove('hidden');
    }

    function repairBrokenFranchises() {
      if (!ensureAdmin()) return;
      const repairs = buildFranchiseRepairPlan();
      if (!repairs.length) {
        setStatus('Подозрительных франшиз по названию не найдено ✓');
        return;
      }
      renderFranchiseRepairModal(repairs);
    }

    async function applyFranchiseRepairsFromModal() {
      if (!ensureAdmin() || !franchiseRepairModal) return;
      const selectedRows = Array.from(franchiseRepairModal.querySelectorAll('.oc-franchise-repair-row'))
        .filter(row => {
          const checkbox = row.querySelector('.oc-franchise-repair-check');
          return checkbox && checkbox.checked;
        });

      if (!selectedRows.length) {
        setStatus('Не выбрано ни одного исправления.', true);
        return;
      }

      const applyBtn = franchiseRepairModal.querySelector('[data-franchise-repair-apply]');
      if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.textContent = 'Сохраняю…';
      }

      let fixedCount = 0;
      const failed = [];
      for (const row of selectedRows) {
        const id = row.getAttribute('data-repair-id');
        const input = row.querySelector('.oc-franchise-repair-input');
        const franchises = uniqueFranchiseList(cleanFranchiseList(input ? input.value : ''));
        try {
          await saveOpeningExtras(id, { franchises });
          const localEntry = entriesById.get(String(id));
          if (localEntry) {
            localEntry.franchises = franchises.slice();
            touchEntryCache(localEntry);
          }
          fixedCount += 1;
          row.remove();
        } catch (error) {
          console.error('Could not repair franchise', id, error);
          failed.push(id);
        }
      }

      if (fixedCount) {
        rebuildFastIndexes({ catalogChanged: true });
        refreshVisiblePanels({ forceFilters: true });
      }

      if (!failed.length) {
        closeFranchiseRepairModal();
        setStatus(`Франшизы исправлены: ${fixedCount} ✓`);
      } else {
        if (applyBtn) {
          applyBtn.disabled = false;
          applyBtn.textContent = 'Повторить для оставшихся';
        }
        setStatus(`Исправлено: ${fixedCount}. Не удалось сохранить: ${failed.length}.`, true);
      }
    }

    function normalizeTitleForDuplicate(title) {
      return String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function isDuplicateTitle(title, type, exceptId) {
      const normalized = normalizeTitleForDuplicate(title);
      return entries.some(e => e.id !== exceptId && e.type === type && normalizeTitleForDuplicate(e.title) === normalized);
    }

    function compactTitleForCompare(title) {
      return normalizeTitleForDuplicate(title).replace(/[^a-zа-яё0-9]+/gi, '');
    }

    function levenshteinDistance(a, b) {
      a = String(a || ''); b = String(b || '');
      const m = a.length, n = b.length;
      if (!m) return n;
      if (!n) return m;
      const prev = Array.from({ length: n + 1 }, (_, i) => i);
      const cur = new Array(n + 1);
      for (let i = 1; i <= m; i++) {
        cur[0] = i;
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        }
        for (let j = 0; j <= n; j++) prev[j] = cur[j];
      }
      return prev[n];
    }

    function findSimilarTitle(title, type, exceptId) {
      const target = compactTitleForCompare(title);
      if (target.length < 6) return null;
      let best = null;
      entries.forEach(e => {
        if (String(e.id) === String(exceptId || '') || e.type !== type) return;
        const other = compactTitleForCompare(e.title);
        if (!other || other === target) return;
        const lengthDiff = Math.abs(target.length - other.length);
        if (lengthDiff > 3) return;
        const dist = levenshteinDistance(target, other);
        const maxLen = Math.max(target.length, other.length);
        const ratio = 1 - dist / maxLen;
        const closeEnough = dist <= 2 || (dist === 3 && maxLen >= 14 && ratio >= 0.92);
        if (closeEnough) {
          if (!best || dist < best.distance || (dist === best.distance && ratio > best.ratio)) best = { entry: e, distance: dist, ratio };
        }
      });
      return best;
    }

    function titleMatchesFuzzySearch(title, query) {
      const raw = String(query || '').trim().toLowerCase();
      if (!raw) return true;
      const titleRaw = String(title || '').toLowerCase();
      if (titleRaw.includes(raw)) return true;
      const target = compactTitleForCompare(raw);
      const other = compactTitleForCompare(title);
      if (target.length < 4 || other.length < 4) return false;
      if (other.includes(target) || target.includes(other)) return true;

      const titleWords = normalizeTitleForDuplicate(title).split(/[^a-zа-яё0-9]+/gi).filter(Boolean);
      const candidates = new Set([other]);
      for (let i = 0; i < titleWords.length; i++) {
        candidates.add(compactTitleForCompare(titleWords[i]));
        if (i + 1 < titleWords.length) candidates.add(compactTitleForCompare(titleWords[i] + titleWords[i + 1]));
        if (i + 2 < titleWords.length) candidates.add(compactTitleForCompare(titleWords[i] + titleWords[i + 1] + titleWords[i + 2]));
      }
      const minLen = Math.max(4, target.length - 2);
      const maxLenWindow = Math.min(other.length, target.length + 3);
      for (let len = minLen; len <= maxLenWindow; len++) {
        for (let i = 0; i + len <= other.length; i++) candidates.add(other.slice(i, i + len));
      }

      for (const candidate of candidates) {
        if (!candidate || candidate.length < 4) continue;
        if (candidate.includes(target) || target.includes(candidate)) return true;
        const lengthDiff = Math.abs(target.length - candidate.length);
        if (lengthDiff > 3) continue;
        const dist = levenshteinDistance(target, candidate);
        const maxLen = Math.max(target.length, candidate.length);
        const ratio = 1 - dist / maxLen;
        const allowedDistance = target.length <= 5 ? 1 : (target.length <= 8 ? 2 : 3);
        if (dist <= allowedDistance || (dist <= 3 && ratio >= 0.88)) return true;
      }
      return false;
    }

    function confirmModalChoice({ title, body, okText = 'Подтвердить', cancelText = 'Отмена' }) {
      return new Promise(resolve => {
        if (!confirmModal) {
          resolve(window.confirm(`${title}\n\n${body}`));
          return;
        }
        confirmModal.innerHTML = `<div class="oc-modal-card oc-confirm-box">
          <div class="oc-modal-head">
            <div>
              <div class="oc-section-label">похоже на дубль</div>
              <div class="oc-modal-title">${escapeHtml(title)}</div>
            </div>
          </div>
          <div class="oc-warning-text">${escapeHtml(body)}</div>
          <div class="oc-confirm-actions">
            <button type="button" class="oc-secondary-btn" data-confirm="cancel">${escapeHtml(cancelText)}</button>
            <button type="button" class="oc-addbtn" data-confirm="ok">${escapeHtml(okText)}</button>
          </div>
        </div>`;
        confirmModal.classList.remove('hidden');
        const cleanup = (answer) => {
          confirmModal.classList.add('hidden');
          confirmModal.innerHTML = '';
          resolve(answer);
        };
        confirmModal.querySelector('[data-confirm="cancel"]').addEventListener('click', () => cleanup(false), { once: true });
        confirmModal.querySelector('[data-confirm="ok"]').addEventListener('click', () => cleanup(true), { once: true });
        confirmModal.addEventListener('click', function onBg(e) {
          if (e.target === confirmModal) { confirmModal.removeEventListener('click', onBg); cleanup(false); }
        });
      });
    }

    async function confirmSimilarTitleIfNeeded(title, type, exceptId) {
      const similar = findSimilarTitle(title, type, exceptId);
      if (!similar) return true;
      return confirmModalChoice({
        title: 'Есть похожее название',
        body: `Похоже на уже добавленный ${type}: «${similar.entry.title}». Разница примерно ${similar.distance} букв(ы). Можно продолжить, но проверь, что это не дубль.`,
        okText: 'Всё равно добавить',
        cancelText: 'Не добавлять'
      });
    }

    function ratingMin() {
      return ratingScale === 'half' ? 0.5 : 1;
    }

    function demoEntries() {
      return [
        { id: 'demo1', title: 'Kaguya-sama: Love is War — OP 1', type: 'OP', year: 2019, season: 'winter', studios: ['A-1 Pictures'], directors: ['Mamoru Hatakeyama'], performers: ['Masayuki Suzuki'], link: 'https://anisongdb.com/', image: '', notes: 'Демо-запись для предпросмотра.', scores: { 'Иван': 10, 'Аня': 9, 'Макс': 8 } },
        { id: 'demo2', title: 'Samurai Champloo — ED', type: 'ED', year: 2004, season: 'spring', studios: ['Manglobe'], directors: ['Shinichirō Watanabe'], performers: ['MINMI'], link: 'https://anisongdb.com/', image: '', notes: 'Можно редактировать или удалить.', scores: { 'Иван': 9, 'Аня': 8 } },
        { id: 'demo3', title: 'Bleach — OP 13', type: 'OP', year: 2010, season: 'fall', studios: ['Studio Pierrot'], directors: ['Noriyuki Abe'], performers: ['SID'], link: 'https://anisongdb.com/', image: '', notes: '', scores: { 'Иван': 8, 'Макс': 7 } }
      ];
    }

    async function maybeLoadDemo() {
      try {
        const res = await window.storage.get(DEMO_KEY, false);
        if (!entries.length && !(res && res.value)) {
          entries = demoEntries();
          await saveEntries();
          await window.storage.set(DEMO_KEY, '1', false);
        }
      } catch (e) {
        if (!entries.length) entries = demoEntries();
      }
    }

    async function loadName() {
      try {
        const res = await window.storage.get(NAME_KEY, false);
        if (res && res.value) {
          myName = res.value;
          nameInput.value = myName;
        }
      } catch (e) { }
    }

    async function saveName(val) {
      myName = val;
      try { await window.storage.set(NAME_KEY, val, false); }
      catch (e) { console.error('Could not save name', e); }
      await syncMyAvatarIntoMap();
    }

    async function loadAvatar() {
      try {
        const res = await window.storage.get(AVATAR_KEY, false);
        if (res && res.value) myAvatar = res.value;
      } catch (e) { }
      avatarBtn.textContent = myAvatar;
    }

    async function saveAvatar(emoji) {
      myAvatar = emoji;
      avatarBtn.textContent = emoji;
      try { await window.storage.set(AVATAR_KEY, emoji, false); }
      catch (e) { console.error('Could not save avatar', e); }
      await syncMyAvatarIntoMap();
    }

    async function loadAvatarsMap() {
      try {
        const res = await window.storage.get(AVATARS_MAP_KEY, true);
        avatarsMap = res && res.value ? JSON.parse(res.value) : {};
      } catch (e) { avatarsMap = {}; }
    }

    async function loadScale() {
      try {
        const res = await window.storage.get(SCALE_KEY, false);
        if (res && ['int', 'half', 'five'].includes(res.value)) ratingScale = res.value;
      } catch (e) { /* default scale stays */ }
      if (scaleSelect) scaleSelect.value = ratingScale;
    }

    async function saveScale(val) {
      ratingScale = val;
      try { await window.storage.set(SCALE_KEY, val, false); }
      catch (e) { console.error('Could not save rating scale', e); }
    }

    async function loadContentFilterMode() {
      try {
        const res = await window.storage.get(CONTENT_FILTER_KEY, false);
        if (res && res.value) setContentFilterMode(res.value, false, false);
      } catch (e) { /* default visibility stays */ }
      syncContentFilterSelect();
    }

    async function saveContentFilterMode(mode) {
      try { await window.storage.set(CONTENT_FILTER_KEY, normalizeContentFilterMode(mode), false); }
      catch (e) { console.error('Could not save content filter mode', e); }
    }

    async function loadManualRanks() {
      try {
        const res = await window.storage.get(MANUAL_RANKS_KEY, true);
        manualRanks = res && res.value ? JSON.parse(res.value) : {};
      } catch (e) { manualRanks = {}; }
    }

    async function saveManualRanks() {
      try { await window.storage.set(MANUAL_RANKS_KEY, JSON.stringify(manualRanks), true); }
      catch (e) { console.error('Could not save manual ranks locally', e); }

      if (!myName) return;
      const ranks = getManualRanksForUser(myName) || {};
      const excludedOP = Array.from(new Set((Array.isArray(ranks.excludedOP) ? ranks.excludedOP : []).map(String).filter(Boolean)));
      const excludedED = Array.from(new Set((Array.isArray(ranks.excludedED) ? ranks.excludedED : []).map(String).filter(Boolean)));
      const cleanRanks = {
        OP: Array.isArray(ranks.OP) ? ranks.OP.map(String).filter(id => !excludedOP.includes(id)).slice(0, 100) : [],
        ED: Array.isArray(ranks.ED) ? ranks.ED.map(String).filter(id => !excludedED.includes(id)).slice(0, 100) : [],
        excludedOP,
        excludedED
      };
      rememberManualRanksForUser(myName, cleanRanks);
      const errors = [];
      let savedRemote = false;

      if (window.OPED_DB && typeof window.OPED_DB.saveManualRanks === 'function') {
        try {
          await window.OPED_DB.saveManualRanks(myName, { OP: cleanRanks.OP, ED: cleanRanks.ED });
          savedRemote = true;
        } catch (e) {
          console.error('Could not save manual ranks through OPED_DB', e);
          errors.push(e);
        }
      }

      try {
        const ext = await getExtendedDb();
        const safeName = manualUserSafeKey(myName);
        const payload = {
          nickname: myName,
          nicknameKey: safeName,
          ownerUid: requirePersonalUid(),
          OP: cleanRanks.OP,
          ED: cleanRanks.ED,
          manualOP: cleanRanks.OP,
          manualED: cleanRanks.ED,
          excludedOP: cleanRanks.excludedOP,
          excludedED: cleanRanks.excludedED,
          avatar: myAvatar,
          updatedAt: ext.serverTimestamp()
        };
        await Promise.allSettled([
          ext.setDoc(ext.doc(ext.db, 'manualRanks', safeName), payload, { merge: true }),
          ext.setDoc(ext.doc(ext.db, 'userProfiles', safeName), payload, { merge: true })
        ]).then(results => {
          if (results.some(r => r.status === 'fulfilled')) savedRemote = true;
          results.filter(r => r.status === 'rejected').forEach(r => { console.error('Manual rank mirror save failed', r.reason); errors.push(r.reason); });
        });
      } catch (e) {
        console.error('Could not mirror manual ranks to Firebase', e);
        errors.push(e);
      }

      if (!savedRemote) {
        setStatus('Не удалось сохранить ручной топ.', true);
        if (errors.length) throw errors[0];
      }
    }

    async function syncMyAvatarIntoMap() {
      if (!myName) return;
      avatarsMap[myName] = myAvatar;
      try { await window.storage.set(AVATARS_MAP_KEY, JSON.stringify(avatarsMap), true); }
      catch (e) { console.error('Could not sync avatar map', e); }
      try {
        if (window.OPED_DB && typeof window.OPED_DB.saveUserProfile === 'function') await window.OPED_DB.saveUserProfile(myName, myAvatar);
        else {
          const ext = await getExtendedDb();
          const safeName = window.OPED_DB && typeof window.OPED_DB.normalizeNickname === 'function' ? window.OPED_DB.normalizeNickname(myName) : safeDocPart(myName);
          const uid = requirePersonalUid();
          await ext.setDoc(ext.doc(ext.db, 'userProfiles', safeName), { nickname: myName, nicknameKey: safeName, authUid: uid, avatar: myAvatar, updatedAt: ext.serverTimestamp() }, { merge: true });
        }
      } catch (e) { console.error('Could not sync avatar to Firebase', e); }
      render();
      if (activeTab === 'profile') renderProfile();
      if (activeTab === 'top100') renderGlobalTop100();
    }

    function avatarFor(name) {
      return avatarsMap[name] || (name === 'Иван' ? '🐺' : '🙂');
    }


    async function startEventBasketWatcher() {
      try {
        const ext = await getExtendedDb();
        if (firebaseUnsubEventBasket) firebaseUnsubEventBasket();
        firebaseUnsubEventBasket = ext.onSnapshot(ext.collection(ext.db, 'eventBasket'), snapshot => {
          firebaseEventBasket = {};
          snapshot.docs.forEach(d => { firebaseEventBasket[d.id] = { id: d.id, ...d.data() }; });
          firebaseEventBasketLoaded = true;
          if (activeTab === 'season') renderSeasonViews();
        }, err => {
          console.error('eventBasket watch error', err);
          firebaseEventBasketLoaded = true;
          setStatus('Не удалось загрузить корзину ивентов.', true);
        });
      } catch (e) {
        console.error('eventBasket watcher setup failed', e);
        firebaseEventBasketLoaded = true;
        setStatus('Не удалось загрузить корзину ивентов.', true);
      }
    }

    async function loadEntries() {
      try {
        const db = await waitForFirebaseDb();
        await db.init();
        await startTierOrderWatcher();
        await startEventBasketWatcher();

        let gotOpenings = false;
        let gotRatings = false;
        let gotManualRanks = false;
        let gotUserProfiles = false;

        await new Promise((resolve) => {
          function maybeResolve() {
            if (gotOpenings && gotRatings && gotManualRanks && gotUserProfiles) resolve();
          }

          if (firebaseUnsubOpenings) firebaseUnsubOpenings();
          if (firebaseUnsubRatings) firebaseUnsubRatings();
          if (firebaseUnsubManualRanks) firebaseUnsubManualRanks();
          if (firebaseUnsubUserProfiles) firebaseUnsubUserProfiles();

          function rebuildCatalogWhenReady() {
            if (gotOpenings && gotRatings) rebuildEntriesFromFirebase();
          }

          firebaseUnsubOpenings = db.watchOpenings((rows) => {
            firebaseOpenings = rows || [];
            gotOpenings = true;
            rebuildCatalogWhenReady();
            maybeResolve();
          });

          firebaseUnsubRatings = db.watchRatings((rows) => {
            firebaseRatings = rows || [];
            gotRatings = true;
            rebuildCatalogWhenReady();
            rebuildManualRanksFromRatingDocs();
            maybeResolve();
          });

          if (typeof db.watchManualRanks === 'function') {
            firebaseUnsubManualRanks = db.watchManualRanks((rows) => {
              firebaseManualRanks = rows || [];
              gotManualRanks = true;
              rebuildManualRanksFromFirebase();
              maybeResolve();
            });
          } else {
            getExtendedDb().then(ext => {
              firebaseUnsubManualRanks = ext.onSnapshot(ext.collection(ext.db, 'manualRanks'), snapshot => {
                firebaseManualRanks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                gotManualRanks = true;
                rebuildManualRanksFromFirebase();
                maybeResolve();
              }, err => {
                console.error('manualRanks watch error', err);
                gotManualRanks = true;
                maybeResolve();
              });
            }).catch(err => {
              console.error('manualRanks watch setup error', err);
              gotManualRanks = true;
              maybeResolve();
            });
          }

          if (typeof db.watchUserProfiles === 'function') {
            firebaseUnsubUserProfiles = db.watchUserProfiles((rows) => {
              firebaseUserProfiles = rows || [];
              gotUserProfiles = true;
              rebuildUserProfilesFromFirebase();
              maybeResolve();
            });
          } else {
            getExtendedDb().then(ext => {
              firebaseUnsubUserProfiles = ext.onSnapshot(ext.collection(ext.db, 'userProfiles'), snapshot => {
                firebaseUserProfiles = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                gotUserProfiles = true;
                rebuildUserProfilesFromFirebase();
                maybeResolve();
              }, err => {
                console.error('userProfiles watch error', err);
                gotUserProfiles = true;
                maybeResolve();
              });
            }).catch(err => {
              console.error('userProfiles watch setup error', err);
              gotUserProfiles = true;
              maybeResolve();
            });
          }
        });
      } catch (e) {
        console.error(e);
        setStatus('Не удалось подключиться. Обновите страницу.', true);
        entries = [];
        populateFilterOptions();
        render();
      }
    }

    async function saveEntries() {
      console.warn('saveEntries() больше не используется для треков. Треки и оценки сохраняются через Firebase.');
      return true;
    }

    function uniqueSorted(values) {
      return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'));
    }

    function buildCategoryCache(force = false) {
      if (!force && categoryCacheVersion === catalogVersion) return categoryCache;
      const years = uniqueSorted(entries.map(e => e.year ? String(e.year) : '')).sort((a, b) => b - a);
      categoryCache = {
        years,
        studios: uniqueSorted(entries.flatMap(e => e.studios || [])),
        directors: uniqueSorted(entries.flatMap(e => e.directors || [])),
        performers: uniqueSorted(entries.flatMap(e => e.performers || [])),
        franchises: uniqueSorted(entries.flatMap(e => e.franchises || []))
      };
      categoryCacheVersion = catalogVersion;
      return categoryCache;
    }

    function populateFilterOptions(force = false) {
      const groups = buildCategoryCache(force);
      if (!force && filterOptionsVersion === catalogVersion) {
        syncFilterControls();
        return;
      }
      fillYearSelect('#oc-f-year', groups.years);
      fillYearSelect('#oc-p-year', groups.years);
      fillTierYearSelect(groups.years);

      fillMultiSelect('#oc-f-studio', groups.studios, filters.studios);
      fillMultiSelect('#oc-f-director', groups.directors, filters.directors);
      fillMultiSelect('#oc-f-performer', groups.performers, filters.performers);
      fillMultiSelect('#oc-f-franchise', groups.franchises, filters.franchises);
      fillMultiSelect('#oc-p-studio', groups.studios, filters.studios);
      fillMultiSelect('#oc-p-director', groups.directors, filters.directors);
      fillMultiSelect('#oc-p-performer', groups.performers, filters.performers);
      fillMultiSelect('#oc-p-franchise', groups.franchises, filters.franchises);
      refreshDatalists(groups);
      filterOptionsVersion = catalogVersion;
      syncFilterControls();
    }

    function fillYearSelect(selector, years) {
      const yearSel = $(selector);
      if (!yearSel) return;
      const prevYear = yearSel.value || filters.year;
      yearSel.innerHTML = '<option value="">Все</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
      yearSel.value = years.includes(prevYear) ? prevYear : '';
    }

    function fillTierYearSelect(years) {
      const sel = $('#oc-tier-year');
      if (!sel) return;
      const allYears = years.length ? years : [String(currentYear())];
      const current = String(tierSelection.year || allYears[0]);
      sel.innerHTML = allYears.map(y => `<option value="${y}">${y}</option>`).join('');
      if (!allYears.includes(current)) tierSelection.year = Number(allYears[0]);
      sel.value = String(tierSelection.year);
    }

    function syncFilterControls() {
      const pairs = [
        ['#oc-f-search', filters.search], ['#oc-p-search', filters.search],
        ['#oc-f-type', filters.type], ['#oc-p-type', filters.type],
        ['#oc-f-year', filters.year], ['#oc-p-year', filters.year],
        ['#oc-f-season', filters.season], ['#oc-p-season', filters.season],
        ['#oc-f-score-cmp', filters.scoreCmp], ['#oc-p-score-cmp', filters.scoreCmp],
        ['#oc-f-score-value', filters.scoreValue], ['#oc-p-score-value', filters.scoreValue]
      ];
      pairs.forEach(([selector, value]) => { const el = $(selector); if (el) el.value = value; });
      ['#oc-f-missing', '#oc-p-missing'].forEach(selector => { const el = $(selector); if (el) el.checked = Boolean(filters.missingOnly); });
      const multiPairs = [
        ['#oc-f-studio', filters.studios], ['#oc-p-studio', filters.studios],
        ['#oc-f-director', filters.directors], ['#oc-p-director', filters.directors],
        ['#oc-f-performer', filters.performers], ['#oc-p-performer', filters.performers],
        ['#oc-f-franchise', filters.franchises], ['#oc-p-franchise', filters.franchises]
      ];
      syncContentFilterSelect();
      multiPairs.forEach(([selector, selected]) => {
        const el = $(selector);
        if (!el) return;
        const selectedSet = new Set(selected || []);
        Array.from(el.options).forEach(opt => { opt.selected = selectedSet.has(opt.value); });
      });
    }

    function fillMultiSelect(selector, values, currentSelection) {
      const el = $(selector);
      if (!el) return;
      el.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
      Array.from(el.options).forEach(opt => { opt.selected = currentSelection.includes(opt.value); });
    }

    function fillDatalist(selector, values) {
      const el = $(selector);
      if (!el) return;
      el.innerHTML = uniqueSorted(values).slice(0, 80).map(v => `<option value="${escapeHtml(v)}"></option>`).join('');
    }

    const DATALIST_CATEGORY = {
      'oc-dl-studios': 'studios',
      'oc-dl-directors': 'directors',
      'oc-dl-performers': 'performers',
      'oc-dl-franchises': 'franchises'
    };

    function sameSongGroupIdForTitle(value) {
      const normalized = String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
      if (!normalized) return '';
      let hash = 2166136261;
      for (let i = 0; i < normalized.length; i++) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return 'song-' + (hash >>> 0).toString(36);
    }

    function sameSongFields(value) {
      const title = String(value || '').trim();
      return { sameSongGroupId: sameSongGroupIdForTitle(title), sameSongTitle: title };
    }

    function normalizeSuggestionText(value) {
      return String(value || '').trim().toLowerCase().replace(/ё/g, 'е');
    }

    function refreshDynamicDatalist(input) {
      if (!input) return;
      const listId = input.getAttribute('list') || '';
      const category = DATALIST_CATEGORY[listId];
      const datalist = category ? document.getElementById(listId) : null;
      if (!category || !datalist) return;

      const raw = String(input.value || '');
      const commaAt = raw.lastIndexOf(',');
      const prefix = commaAt >= 0 ? raw.slice(0, commaAt + 1) : '';
      const query = normalizeSuggestionText(commaAt >= 0 ? raw.slice(commaAt + 1) : raw);
      const values = allCategoryValues(category);
      const starts = [];
      const contains = [];

      values.forEach(value => {
        const normalized = normalizeSuggestionText(value);
        if (!query || normalized.startsWith(query)) starts.push(value);
        else if (normalized.includes(query)) contains.push(value);
      });

      const matches = starts.concat(contains).slice(0, 80);
      datalist.innerHTML = matches.map(value => {
        const optionValue = prefix ? `${prefix} ${value}` : value;
        return `<option value="${escapeHtml(optionValue)}"></option>`;
      }).join('');
    }

    function refreshDatalists(groups) {
      // Подсказки обновляются динамически по введённому тексту, чтобы список не зависал
      // и варианты за пределами первых 500 значений тоже всегда находились.
      fillDatalist('#oc-dl-titles', []);
      fillDatalist('#oc-dl-search', []);
      fillDatalist('#oc-dl-studios', groups.studios || []);
      fillDatalist('#oc-dl-directors', groups.directors || []);
      fillDatalist('#oc-dl-performers', groups.performers || []);
      fillDatalist('#oc-dl-franchises', groups.franchises || []);
      fillDatalist('#oc-dl-same-songs', entries.map(entry => entry.sameSongTitle).filter(Boolean));
    }

    function allCategoryValues(key) {
      const groups = buildCategoryCache(false);
      return groups[key] || [];
    }

    function entrySearchText(entry) {
      if (!entry) return '';
      if (entry.__ocSearchText) return entry.__ocSearchText;
      const text = [
        entry.title, ...(entry.alternativeTitles || []), entry.type, entry.year, SEASON_LABEL[entry.season], entryIsChinese(entry) ? 'китайский' : '', entryIsMovie(entry) ? 'фильм movie' : '', entryIsShortened(entry) ? 'укороченный короткий short shortened 30sec' : '',
        entry.image || '', ...(entry.studios || []), ...(entry.directors || []), ...(entry.performers || []), ...(entry.franchises || [])
      ].join(' ').toLowerCase();
      try { Object.defineProperty(entry, '__ocSearchText', { value: text, configurable: true, enumerable: false }); }
      catch (e) { entry.__ocSearchText = text; }
      return text;
    }

    function filtersCacheKey() {
      return [
        dataVersion, filters.search, filters.type, filters.year, filters.season,
        filters.scoreCmp, filters.scoreValue, filters.missingOnly ? 'missing' : 'allfields', filters.hideChinese ? 'hideCN' : 'showCN', filters.hideMovie ? 'hideMovie' : 'showMovie', filters.hideShortened ? 'hideShort' : 'showShort',
        filters.studios.join('¦'), filters.directors.join('¦'), filters.performers.join('¦'), filters.franchises.join('¦')
      ].join('|');
    }

    function addFilterValueFromInput(input) {
      const key = input.getAttribute('data-filter-suggest');
      const raw = String(input.value || '').trim();
      if (!key || raw.length < 2) return;
      const values = allCategoryValues(key);
      const exact = values.find(v => v.toLowerCase() === raw.toLowerCase());
      const partial = values.find(v => v.toLowerCase().includes(raw.toLowerCase()));
      const chosen = exact || partial || raw;
      filters[key] = filters[key] || [];
      if (filters[key].includes(chosen)) {
        filters[key] = filters[key].filter(v => v !== chosen);
      } else {
        filters[key].push(chosen);
      }
      input.value = '';
      populateFilterOptions();
      applyFilterChange();
    }

    function allVoterNames() {
      const names = new Set();
      entries.forEach(e => {
        Object.keys(e.scores || {}).forEach(n => names.add(n));
        Object.keys(e.songScores || {}).forEach(n => names.add(n));
        Object.keys(e.visualScores || {}).forEach(n => names.add(n));
        Object.keys(e.personalScores || {}).forEach(n => names.add(n));
      });
      Object.keys(manualRanks || {}).forEach(n => {
        const row = manualRanks[n] || {};
        const display = String(row.nickname || row.displayName || row.name || '').trim();
        const key = String(row.nicknameKey || '').trim();
        const looksLikeTechnicalAlias = key && key === n && display;
        names.add(looksLikeTechnicalAlias ? display : (display || n));
      });
      Object.keys(avatarsMap || {}).forEach(n => names.add(n));
      if (myName) names.add(myName);
      return Array.from(names).sort((a, b) => a.localeCompare(b, 'ru'));
    }

    function populateProfileUsers(force = false) {
      if (!profileUserSelect) return;
      const key = `${dataVersion}|${manualRanksVersion}|${avatarsVersion}|${myName}`;
      const prev = profileUserSelect.value;
      let names;
      if (!force && profileUsersCache.key === key && profileUsersCache.names.length) {
        names = profileUsersCache.names;
      } else {
        names = allVoterNames();
        profileUsersCache = { key, names };
      }
      if (!names.length) {
        profileUserSelect.innerHTML = '<option value="">нет оценивших</option>';
        profileUser = '';
        return;
      }
      const currentOptionsKey = profileUserSelect.getAttribute('data-options-key') || '';
      const nextOptionsKey = key + '|' + names.join('¦');
      if (force || currentOptionsKey !== nextOptionsKey) {
        profileUserSelect.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">${avatarFor(n)} ${escapeHtml(n)}</option>`).join('');
        profileUserSelect.setAttribute('data-options-key', nextOptionsKey);
      }
      let next = prev && names.includes(prev) ? prev : (myName && names.includes(myName) ? myName : names[0]);
      profileUserSelect.value = next;
      profileUser = next;
    }

    function titleMatchesAnySearch(entry, query) {
      if (!entry) return false;
      if (titleMatchesFuzzySearch(entry.title, query)) return true;
      return (entry.alternativeTitles || []).some(title => titleMatchesFuzzySearch(title, query));
    }

    function missingRequiredFields(entry) {
      const missing = [];
      if (!String(entry.title || '').trim()) missing.push('название');
      if (!String(entry.type || '').trim()) missing.push('тип');
      if (entry.year === null || entry.year === undefined || entry.year === '' || Number.isNaN(Number(entry.year))) missing.push('год');
      if (!String(entry.season || '').trim()) missing.push('сезон');
      if (!(entry.studios || []).length) missing.push('студии');
      if (!(entry.directors || []).length) missing.push('режиссёры');
      if (!(entry.performers || []).length) missing.push('исполнители');
      if (!(entry.franchises || []).length) missing.push('франшизы');
      if (!String(entry.image || '').trim()) missing.push('картинка');
      if (!String(entry.link || '').trim()) missing.push('ссылка');
      return missing;
    }

    function entryHasMissingRequiredFields(entry) {
      return missingRequiredFields(entry).length > 0;
    }

    function applyFilters(list) {
      const q = String(filters.search || '').trim().toLowerCase();
      const cacheKey = list === entries ? filtersCacheKey() : '';
      if (cacheKey && filteredCache.key === cacheKey && Array.isArray(filteredCache.value)) return filteredCache.value;
      const result = list.filter(e => {
        if (q) {
          if (!entrySearchText(e).includes(q) && !titleMatchesAnySearch(e, q)) return false;
        }
        if (filters.type && e.type !== filters.type) return false;
        if (!entryPassesHiddenFlags(e, filters.hideChinese, filters.hideMovie, filters.hideShortened)) return false;
        if (filters.missingOnly && !entryHasMissingRequiredFields(e)) return false;
        if (filters.year && String(e.year) !== filters.year) return false;
        if (filters.season && e.season !== filters.season) return false;
        if (filters.scoreCmp && String(filters.scoreValue || '').trim() !== '') {
          const score = avgAny(e.scores);
          const target = Number(String(filters.scoreValue).replace(',', '.'));
          if (score === null || !Number.isFinite(target)) return false;
          if (filters.scoreCmp === '>=' && !(score >= target)) return false;
          if (filters.scoreCmp === '>' && !(score > target)) return false;
          if (filters.scoreCmp === '<=' && !(score <= target)) return false;
          if (filters.scoreCmp === '<' && !(score < target)) return false;
          if (filters.scoreCmp === '=' && !(Math.abs(score - target) < 0.05)) return false;
        }
        if (filters.studios.length && !filters.studios.some(s => (e.studios || []).includes(s))) return false;
        if (filters.directors.length && !filters.directors.some(s => (e.directors || []).includes(s))) return false;
        if (filters.performers.length && !filters.performers.some(s => (e.performers || []).includes(s))) return false;
        if (filters.franchises.length && !filters.franchises.some(s => (e.franchises || []).includes(s))) return false;
        return true;
      });
      if (cacheKey) filteredCache = { key: cacheKey, value: result };
      return result;
    }

    function applyFiltersIgnoringType(list) {
      const oldType = filters.type;
      filters.type = '';
      const out = applyFilters(list);
      filters.type = oldType;
      return out;
    }

    function entryTimestamp(entry, fallbackIndex = 0) {
      const raw = entry ? (entry.createdAt || entry.updatedAt || '') : '';
      if (raw && typeof raw.toMillis === 'function') return raw.toMillis();
      if (raw && typeof raw.seconds === 'number') return raw.seconds * 1000;
      if (raw instanceof Date) return raw.getTime();
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) return parsed;
      return fallbackIndex;
    }

    function applySort(list) {
      const cacheKey = `${dataVersion}|${sortMode}|${list.length}|${list === filteredCache.value ? filteredCache.key : ''}`;
      if (sortedCache.input === list && sortedCache.key === cacheKey && Array.isArray(sortedCache.value)) return sortedCache.value;
      const withScore = list.map((e, idx) => ({ e, score: avg(e.scores), ts: entryTimestamp(e, idx) }));
      withScore.sort((a, b) => {
        if (sortMode === 'added_desc') return (b.ts || 0) - (a.ts || 0) || b.e.title.localeCompare(a.e.title, 'ru');
        if (sortMode === 'year_desc') return (b.e.year || 0) - (a.e.year || 0) || (b.ts || 0) - (a.ts || 0);
        if (sortMode === 'year_asc') return (a.e.year || 0) - (b.e.year || 0) || (b.ts || 0) - (a.ts || 0);
        if (sortMode === 'title') return a.e.title.localeCompare(b.e.title, 'ru');
        if (sortMode === 'score_asc') {
          if (a.score === null && b.score === null) return (b.ts || 0) - (a.ts || 0);
          if (a.score === null) return 1;
          if (b.score === null) return -1;
          return a.score - b.score || (b.ts || 0) - (a.ts || 0);
        }
        if (a.score === null && b.score === null) return (b.ts || 0) - (a.ts || 0);
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return b.score - a.score || (b.ts || 0) - (a.ts || 0);
      });
      const result = withScore.map(x => x.e);
      sortedCache = { key: cacheKey, input: list, value: result };
      return result;
    }

    function clampPage(page, totalItems) {
      const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
      const n = Number(page);
      return Math.max(1, Math.min(totalPages, Number.isFinite(n) ? Math.round(n) : 1));
    }

    function pageSlice(list, page) {
      const safePage = clampPage(page, list.length);
      const start = (safePage - 1) * PAGE_SIZE;
      return { safePage, start, items: list.slice(start, start + PAGE_SIZE), totalPages: Math.max(1, Math.ceil(list.length / PAGE_SIZE)) };
    }

    function paginationHtml(scope, page, totalItems) {
      if (totalItems <= 0) return '';
      const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
      const safePage = clampPage(page, totalItems);
      const from = (safePage - 1) * PAGE_SIZE + 1;
      const to = Math.min(totalItems, safePage * PAGE_SIZE);
      return `<div class="oc-pagination" data-page-scope="${scope}">
        <button type="button" class="oc-page-btn" data-page-dir="prev" ${safePage <= 1 ? 'disabled' : ''}>← назад</button>
        <span>${from}–${to} из ${totalItems} · стр. ${safePage}/${totalPages}</span>
        <button type="button" class="oc-page-btn" data-page-dir="next" ${safePage >= totalPages ? 'disabled' : ''}>вперёд →</button>
      </div>`;
    }

    function bindPagination(container, scope, getPage, setPage, rerender) {
      if (!container) return;
      container.querySelectorAll(`[data-page-scope="${scope}"] [data-page-dir]`).forEach(btn => {
        btn.addEventListener('click', () => {
          const delta = btn.getAttribute('data-page-dir') === 'next' ? 1 : -1;
          setPage(getPage() + delta);
          rerender();
        });
      });
    }

    function renderFilterStat(filteredList) {
      if (!filterStatEl) return;
      const filterActive = filters.search || filters.type || filters.year || filters.season || filters.scoreCmp || filters.scoreValue || filters.missingOnly || filters.hideChinese || filters.hideMovie || filters.hideShortened || filters.studios.length || filters.directors.length || filters.performers.length || filters.franchises.length;
      if (!filterActive) {
        filterStatEl.classList.remove('show');
        filterStatEl.textContent = '';
        return;
      }
      const scored = filteredList.map(e => avg(e.scores)).filter(s => s !== null);
      if (!scored.length) {
        filterStatEl.textContent = `★ Средняя оценка по фильтру: нет оценок пока (${filteredList.length} трек(ов) без оценок)`;
      } else {
        const mean = scored.reduce((a, b) => a + b, 0) / scored.length;
        filterStatEl.textContent = `★ Средняя оценка по фильтру: ${formatScore(mean)} (оценено ${scored.length} из ${filteredList.length})`;
      }
      filterStatEl.classList.add('show');
    }


    function currentYear() {
      return new Date().getFullYear();
    }

    function seasonHasStarted(year, season) {
      const start = new Date(year, SEASON_START_MONTH[season], 1, 0, 0, 0, 0);
      return start <= new Date();
    }

    function isOp(entry) {
      return String(entry.type || '').toUpperCase() === 'OP';
    }

    function entryTypeMatches(entry, type) {
      return String(entry.type || '').toUpperCase() === String(type || seasonType || 'OP').toUpperCase();
    }

    function typeLabel(type) {
      return String(type || seasonType) === 'ED' ? 'ED' : 'OP';
    }

    function typeLabelRu(type) {
      return String(type || seasonType) === 'ED' ? 'эндингов' : 'опенингов';
    }

    function scoreFor(entry, name) {
      const val = valueForUserMap(entry && entry.scores, name);
      return val !== undefined ? normalizePublicScore(val) : null;
    }

    function personalScoreFor(entry, name) {
      const val = valueForUserMap(entry && entry.personalScores, name);
      return val !== undefined ? Math.max(1, Math.min(5, Math.round(Number(val)))) : null;
    }

    function songScoreFor(entry, name) {
      const val = valueForUserMap(entry && entry.songScores, name);
      return val !== undefined ? normalizePublicScore(val) : null;
    }

    function visualScoreFor(entry, name) {
      const val = valueForUserMap(entry && entry.visualScores, name);
      return val !== undefined ? normalizePublicScore(val) : null;
    }

    function hasRated(entry, name) {
      return scoreFor(entry, name) !== null;
    }

    function hasPersonalRated(entry, name) {
      return personalScoreFor(entry, name) !== null;
    }

    function entryIsChinese(entry) {
      return Boolean(entry && (entry.isChinese || entry.chinese || entry.isChina || entry.chineseOpening));
    }

    function entryIsMovie(entry) {
      return Boolean(entry && (entry.isMovie || entry.movie || entry.isFilm || entry.filmOpening));
    }

    function entryIsShortened(entry) {
      return Boolean(entry && (entry.isShortened || entry.shortened || entry.isShort || entry.short || entry.shortOpening || entry.shortenedOpening));
    }

    function normalizeContentFilterMode(mode) {
      return ['default', 'chinese', 'movie', 'shortened', 'chinese-movie', 'chinese-shortened', 'movie-shortened', 'all'].includes(mode) ? mode : 'default';
    }

    function contentFilterModeToFlags(mode) {
      const normalized = normalizeContentFilterMode(mode);
      const showChinese = normalized === 'chinese' || normalized === 'chinese-movie' || normalized === 'chinese-shortened' || normalized === 'all';
      const showMovie = normalized === 'movie' || normalized === 'chinese-movie' || normalized === 'movie-shortened' || normalized === 'all';
      const showShortened = normalized === 'shortened' || normalized === 'chinese-shortened' || normalized === 'movie-shortened' || normalized === 'all';
      return { hideChinese: !showChinese, hideMovie: !showMovie, hideShortened: !showShortened };
    }

    function contentFilterModeFromFlags(hideChinese, hideMovie, hideShortened) {
      const showChinese = !hideChinese;
      const showMovie = !hideMovie;
      const showShortened = !hideShortened;
      if (showChinese && showMovie && showShortened) return 'all';
      if (showChinese && showMovie) return 'chinese-movie';
      if (showChinese && showShortened) return 'chinese-shortened';
      if (showMovie && showShortened) return 'movie-shortened';
      if (showChinese) return 'chinese';
      if (showMovie) return 'movie';
      if (showShortened) return 'shortened';
      return 'default';
    }

    function currentContentFilterMode() {
      return contentFilterModeFromFlags(filters.hideChinese, filters.hideMovie, filters.hideShortened);
    }

    function syncContentFilterSelect() {
      if (contentFilterSelect) contentFilterSelect.value = currentContentFilterMode();
    }

    function setContentFilterMode(mode, shouldRender = true, shouldSave = true) {
      const normalizedMode = normalizeContentFilterMode(mode);
      const flags = contentFilterModeToFlags(normalizedMode);
      filters.hideChinese = flags.hideChinese;
      filters.hideMovie = flags.hideMovie;
      filters.hideShortened = flags.hideShortened;
      seasonHideChinese = flags.hideChinese;
      seasonHideMovie = flags.hideMovie;
      seasonHideShortened = flags.hideShortened;
      syncContentFilterSelect();
      if (shouldSave) saveContentFilterMode(normalizedMode);
      if (!shouldRender) return;
      chartPage = 1;
      profileTopPage = { OP: 1, ED: 1 };
      allRatingsPage = { OP: 1, ED: 1 };
      render();
      if (activeTab === 'profile') renderProfile();
      if (activeTab === 'season') renderSeasonViews();
    }

    function entryPassesHiddenFlags(entry, hideChinese, hideMovie, hideShortened) {
      if (hideChinese && entryIsChinese(entry)) return false;
      if (hideMovie && entryIsMovie(entry)) return false;
      if (hideShortened && entryIsShortened(entry)) return false;
      return true;
    }

    function dailyDateKeyFromDate(date) {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    }

    function dailyDateFromKey(key) {
      const parts = String(key || '').split('-').map(Number);
      return parts.length === 3 && parts.every(Number.isFinite) ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])) : null;
    }

    function dailyShiftKey(key, days) {
      const date = dailyDateFromKey(key);
      if (!date) return '';
      date.setUTCDate(date.getUTCDate() + Number(days || 0));
      return dailyDateKeyFromDate(date);
    }

    function dailyClock(now = new Date()) {
      const msk = new Date(now.getTime() + DAILY_MSK_OFFSET_HOURS * 3600000);
      const today = dailyDateKeyFromDate(msk);
      const released = msk.getUTCHours() >= DAILY_RELEASE_HOUR;
      return { msk, today, released, key: released ? today : dailyShiftKey(today, -1), nextKey: released ? dailyShiftKey(today, 1) : today };
    }

    function dailyProfileFor(name = myName) {
      const safe = manualUserSafeKey(name);
      return firebaseUserProfiles.find(row => {
        const display = String(row.nickname || row.displayName || row.name || '').trim();
        const key = String(row.nicknameKey || row.id || '').trim();
        return manualSameUser(display, name) || key === safe;
      }) || null;
    }

    function normalizeDailySettings(raw = {}) {
      return {
        enabled: Boolean(raw.enabled),
        type: ['OP', 'ED', 'both'].includes(raw.type) ? raw.type : 'both',
        fromYear: String(raw.fromYear || ''),
        fromSeason: SEASON_ORDER.includes(raw.fromSeason) ? raw.fromSeason : 'winter',
        toYear: String(raw.toYear || ''),
        toSeason: SEASON_ORDER.includes(raw.toSeason) ? raw.toSeason : 'fall',
        enabledAt: String(raw.enabledAt || ''),
        firstRequiredKey: String(raw.firstRequiredKey || ''),
        optionalKey: String(raw.optionalKey || ''),
        publicCalendar: Boolean(raw.publicCalendar)
      };
    }

    function dailySeasonPoint(entry) {
      const year = Number(entry?.year);
      const season = SEASON_ORDER.indexOf(String(entry?.season || ''));
      return Number.isFinite(year) && season >= 0 ? year * 4 + season : null;
    }

    function dailyEntryHasUserScore(entry, name) {
      return hasRated(entry, name) || hasPersonalRated(entry, name);
    }

    function dailyEligibleEntries(settings, name = myName, includeRated = false) {
      const from = settings.fromYear ? Number(settings.fromYear) * 4 + SEASON_ORDER.indexOf(settings.fromSeason) : null;
      const to = settings.toYear ? Number(settings.toYear) * 4 + SEASON_ORDER.indexOf(settings.toSeason) : null;
      return entries.filter(entry => {
        if (settings.type !== 'both' && entry.type !== settings.type) return false;
        const point = dailySeasonPoint(entry);
        if (point === null) return false;
        if (from !== null && point < from) return false;
        if (to !== null && point > to) return false;
        if (!includeRated && dailyEntryHasUserScore(entry, name)) return false;
        return true;
      });
    }

    function dailyHash(text) {
      let hash = 2166136261;
      const source = String(text || '');
      for (let i = 0; i < source.length; i += 1) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
      return hash >>> 0;
    }

    function dailyAssignmentFor(name, key, settings, savedIds = null) {
      if (Array.isArray(savedIds) && savedIds.length) return savedIds.map(String).filter(id => entriesById.has(id));
      const candidates = dailyEligibleEntries(settings, name);
      if (candidates.length < 10) return [];
      const seed = `${manualUserSafeKey(name)}|${key}|${settings.type}|${settings.fromYear}|${settings.fromSeason}|${settings.toYear}|${settings.toSeason}`;
      const shuffled = candidates.slice().sort((a, b) => dailyHash(`${seed}|${a.id}`) - dailyHash(`${seed}|${b.id}`));
      const count = Math.min(candidates.length, 10 + dailyHash(seed) % 6);
      return shuffled.slice(0, count).map(entry => String(entry.id));
    }

    async function saveDailyProfilePatch(patch) {
      if (!myName) return;
      const ext = await getExtendedDb();
      const safe = manualUserSafeKey(myName);
      await ext.setDoc(ext.doc(ext.db, 'userProfiles', safe), {
        nickname: myName,
        nicknameKey: safe,
        avatar: myAvatar,
        ...patch,
        updatedAt: ext.serverTimestamp()
      }, { merge: true });
      const existing = dailyProfileFor(myName);
      if (existing) Object.assign(existing, patch);
      else firebaseUserProfiles.push({ id: safe, nickname: myName, nicknameKey: safe, avatar: myAvatar, ...patch });
    }

    function dailyCurrentState(name = myName) {
      const profile = dailyProfileFor(name);
      const settings = normalizeDailySettings(profile?.dailySettings || {});
      const clock = dailyClock();
      const assignments = profile?.dailyAssignments && typeof profile.dailyAssignments === 'object' ? profile.dailyAssignments : {};
      const completed = profile?.dailyCompleted && typeof profile.dailyCompleted === 'object' ? profile.dailyCompleted : {};
      const ids = settings.enabled ? dailyAssignmentFor(name, clock.key, settings, assignments[clock.key]) : [];
      const required = Boolean(settings.enabled && settings.firstRequiredKey && clock.key >= settings.firstRequiredKey);
      const offered = required || settings.optionalKey === clock.key;
      return { profile, settings, clock, assignments, completed, ids, required, offered, available: offered && ids.length >= 10, done: Boolean(completed[clock.key]) };
    }

    async function saveDailySettingsFromPanel() {
      if (!ensureNickname()) return;
      const old = normalizeDailySettings(dailyProfileFor(myName)?.dailySettings || {});
      const clock = dailyClock();
      let fromYear = String($('#oc-daily-from-year')?.value || '');
      let toYear = String($('#oc-daily-to-year')?.value || '');
      let fromSeason = String($('#oc-daily-from-season')?.value || 'winter');
      let toSeason = String($('#oc-daily-to-season')?.value || 'fall');
      if (fromYear && toYear && Number(fromYear) * 4 + SEASON_ORDER.indexOf(fromSeason) > Number(toYear) * 4 + SEASON_ORDER.indexOf(toSeason)) {
        [fromYear, toYear] = [toYear, fromYear];
        [fromSeason, toSeason] = [toSeason, fromSeason];
      }
      const firstStart = !old.enabled;
      const settings = {
        enabled: true,
        type: String($('#oc-daily-type')?.value || 'both'),
        fromYear, fromSeason, toYear, toSeason,
        enabledAt: old.enabledAt || new Date().toISOString(),
        firstRequiredKey: old.firstRequiredKey || clock.nextKey,
        optionalKey: old.optionalKey || (clock.released ? clock.key : ''),
        publicCalendar: Boolean($('#oc-daily-public')?.checked)
      };
      await saveDailyProfilePatch({ dailySettings: settings });
      setStatus(firstStart ? 'Ежедневная оценка подключена ✓' : 'Настройки ежедневной оценки сохранены ✓');
      renderDailyProfilePanel();
      refreshDailyUi();
    }

    async function startDailyRating(key = dailyClock().key) {
      if (!ensureNickname()) return;
      const profile = dailyProfileFor(myName);
      const settings = normalizeDailySettings(profile?.dailySettings || {});
      if (!settings.enabled) { switchTab('profile'); setStatus('Сначала подключи ежедневную оценку в своём профиле.', true); return; }
      const assignments = { ...(profile?.dailyAssignments || {}) };
      let ids = dailyAssignmentFor(myName, key, settings, assignments[key]);
      if (ids.length < 10) { setStatus('Под выбранные критерии нашлось меньше 10 песен — дейлик сегодня не сформировался.', true); return; }
      if (!Array.isArray(assignments[key]) || !assignments[key].length) {
        assignments[key] = ids;
        await saveDailyProfilePatch({ dailyAssignments: assignments });
      }
      const progressMap = { ...(profile?.dailyProgress || {}) };
      const progressed = new Set(Array.isArray(progressMap[key]) ? progressMap[key].map(String) : []);
      ids.forEach(id => {
        const entry = entriesById.get(String(id));
        if (entry && dailyEntryHasUserScore(entry, myName)) progressed.add(String(id));
      });
      progressMap[key] = [...progressed];
      await saveDailyProfilePatch({ dailyProgress: progressMap });
      seasonQueue = ids.filter(id => !progressed.has(String(id))).map(id => entriesById.get(String(id))).filter(Boolean);
      if (!seasonQueue.length) { await finalizeDaily(key); return; }
      dailyActiveKey = key;
      evaluatorMode = 'daily';
      seasonQueueIndex = 0;
      localStorage.setItem(DAILY_DISMISSED_KEY, `${manualUserSafeKey(myName)}|${key}`);
      if (dailyToast) dailyToast.classList.add('hidden');
      renderEvaluator();
    }

    async function markDailyEntryDone(entryId) {
      if (!dailyActiveKey) return;
      const profile = dailyProfileFor(myName) || {};
      const progress = { ...(profile.dailyProgress || {}) };
      const ids = new Set(Array.isArray(progress[dailyActiveKey]) ? progress[dailyActiveKey].map(String) : []);
      ids.add(String(entryId));
      progress[dailyActiveKey] = [...ids];
      await saveDailyProfilePatch({ dailyProgress: progress });
    }

    async function finalizeDaily(key) {
      const profile = dailyProfileFor(myName) || {};
      const assigned = Array.isArray(profile.dailyAssignments?.[key]) ? profile.dailyAssignments[key].map(String) : [];
      const progressed = new Set(Array.isArray(profile.dailyProgress?.[key]) ? profile.dailyProgress[key].map(String) : []);
      if (!assigned.length || !assigned.every(id => progressed.has(id))) {
        setStatus('Дейлик пока не завершён: пропущенные песни можно оценить через колокольчик.', true);
        refreshDailyUi();
        return;
      }
      const completed = { ...(profile.dailyCompleted || {}), [key]: new Date().toISOString() };
      await saveDailyProfilePatch({ dailyCompleted: completed });
      setStatus('Ежедневная оценка завершена ✓');
      refreshDailyUi();
      if (activeTab === 'profile') renderDailyProfilePanel();
    }

    function dailyYearOptions(selected, emptyText) {
      const years = Array.from(new Set(entries.map(entry => Number(entry.year)).filter(Number.isFinite))).sort((a, b) => a - b);
      return `<option value="">${escapeHtml(emptyText)}</option>${years.map(year => `<option value="${year}" ${String(selected) === String(year) ? 'selected' : ''}>${year}</option>`).join('')}`;
    }

    function dailySeasonOptions(selected) {
      return SEASON_ORDER.map(season => `<option value="${season}" ${season === selected ? 'selected' : ''}>${escapeHtml(SEASON_LABEL[season])}</option>`).join('');
    }

    function dailyCalendarHtml(name, settings, profile) {
      const now = dailyClock();
      const currentMsk = now.msk;
      if (!dailyCalendarMonth) dailyCalendarMonth = new Date(Date.UTC(currentMsk.getUTCFullYear(), currentMsk.getUTCMonth(), 1));
      const year = dailyCalendarMonth.getUTCFullYear();
      const month = dailyCalendarMonth.getUTCMonth();
      const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
      const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const completed = profile?.dailyCompleted || {};
      const assignments = profile?.dailyAssignments || {};
      const eligible = dailyEligibleEntries(settings, name, true).length >= 10;
      const cells = Array.from({ length:firstWeekday }, () => '<div class="oc-daily-day empty"></div>');
      for (let day = 1; day <= days; day += 1) {
        const key = dailyDateKeyFromDate(new Date(Date.UTC(year, month, day)));
        let cls = '';
        let mark = '';
        if (completed[key]) { cls = 'done'; mark = '✓'; }
        else if (settings.firstRequiredKey && key >= settings.firstRequiredKey && key < now.key && (Array.isArray(assignments[key]) ? assignments[key].length >= 10 : eligible)) { cls = 'missed'; mark = '×'; }
        else if (key === now.key && settings.firstRequiredKey && key >= settings.firstRequiredKey && eligible) { cls = 'pending'; mark = '•'; }
        cells.push(`<div class="oc-daily-day ${cls}"><span>${day}</span><strong>${mark}</strong></div>`);
      }
      const monthName = new Intl.DateTimeFormat('ru-RU', { month:'long', year:'numeric', timeZone:'UTC' }).format(dailyCalendarMonth);
      return `<div class="oc-daily-calendar-wrap"><div class="oc-daily-calendar-head"><button class="oc-daily-calendar-nav" data-daily-month="-1">←</button><strong>${escapeHtml(monthName)}</strong><button class="oc-daily-calendar-nav" data-daily-month="1">→</button></div><div class="oc-daily-calendar">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => `<div class="oc-daily-calendar-weekday">${day}</div>`).join('')}${cells.join('')}</div></div>`;
    }

    function renderDailyProfilePanel() {
      if (!dailyPanel) return;
      const viewed = profileUser || myName;
      const profile = dailyProfileFor(viewed);
      const settings = normalizeDailySettings(profile?.dailySettings || {});
      const own = Boolean(myName && manualSameUser(viewed, myName));
      const maySeeCalendar = own || settings.publicCalendar;
      if (!own && (!settings.enabled || !maySeeCalendar)) { dailyPanel.classList.add('hidden'); dailyPanel.innerHTML = ''; return; }
      dailyPanel.classList.remove('hidden');
      const state = own ? dailyCurrentState(myName) : null;
      const todayButton = own && settings.enabled && state.available && !state.done
        ? `<button type="button" class="oc-addbtn" id="oc-daily-start-today">Пройти текущий дейлик (${state.ids.length})</button>` : '';
      const settingsHtml = own ? `<div class="oc-daily-settings"><label class="wide">Что оцениваем<select id="oc-daily-type"><option value="both" ${settings.type === 'both' ? 'selected' : ''}>Опенинги и эндинги</option><option value="OP" ${settings.type === 'OP' ? 'selected' : ''}>Только опенинги</option><option value="ED" ${settings.type === 'ED' ? 'selected' : ''}>Только эндинги</option></select></label><label>Начальный год<select id="oc-daily-from-year">${dailyYearOptions(settings.fromYear, 'С самого раннего')}</select></label><label>Начальный сезон<select id="oc-daily-from-season">${dailySeasonOptions(settings.fromSeason)}</select></label><label>Конечный год<select id="oc-daily-to-year">${dailyYearOptions(settings.toYear, 'По самый поздний')}</select></label><label>Конечный сезон<select id="oc-daily-to-season">${dailySeasonOptions(settings.toSeason)}</select></label><label class="wide"><span>Видимость календаря</span><span><input id="oc-daily-public" type="checkbox" ${settings.publicCalendar ? 'checked' : ''}> показывать календарь всем в моём профиле</span></label></div><div class="oc-daily-actions"><button type="button" class="oc-addbtn" id="oc-daily-save-settings">${settings.enabled ? 'Сохранить настройки' : 'Запустить ежедневную оценку'}</button>${todayButton}</div>` : '';
      dailyPanel.innerHTML = `<div class="oc-daily-head"><div><div class="oc-section-label">ежедневная оценка</div><h3>${own ? 'Твой дейлик' : `Календарь · ${escapeHtml(viewed)}`}</h3><div class="oc-hint">Новый набор появляется ежедневно в 18:00 МСК. В наборе — от 10 до 15 случайных песен.</div></div></div>${settingsHtml}${settings.enabled && maySeeCalendar ? dailyCalendarHtml(viewed, settings, profile) : ''}`;
      $('#oc-daily-save-settings')?.addEventListener('click', () => saveDailySettingsFromPanel().catch(error => { console.error(error); setStatus('Не удалось сохранить настройки дейлика.', true); }));
      $('#oc-daily-start-today')?.addEventListener('click', () => startDailyRating().catch(error => { console.error(error); setStatus('Не удалось открыть дейлик.', true); }));
      dailyPanel.querySelectorAll('[data-daily-month]').forEach(button => button.addEventListener('click', () => { dailyCalendarMonth.setUTCMonth(dailyCalendarMonth.getUTCMonth() + Number(button.dataset.dailyMonth)); renderDailyProfilePanel(); }));
    }

    function refreshDailyUi() {
      if (!dailyBellDot || !dailyToast) return;
      const state = dailyCurrentState(myName);
      const pending = Boolean(myName && state.required && state.available && !state.done);
      dailyBellDot.classList.toggle('hidden', !pending);
      const dismissal = `${manualUserSafeKey(myName)}|${state.clock.key}`;
      const dismissed = localStorage.getItem(DAILY_DISMISSED_KEY) === dismissal;
      if (pending && !dismissed) {
        dailyToast.innerHTML = `<button class="oc-daily-toast-close" type="button" aria-label="Закрыть">×</button><h3>Твой новый дейлик готов</h3><p>${state.ids.length} песен ждут ежедневной оценки. Уведомление больше не появится до следующего обновления в 18:00 МСК.</p><button class="oc-addbtn" type="button" data-daily-toast-start>Пройти дейлик</button>`;
        dailyToast.classList.remove('hidden');
        dailyToast.querySelector('.oc-daily-toast-close')?.addEventListener('click', () => { localStorage.setItem(DAILY_DISMISSED_KEY, dismissal); dailyToast.classList.add('hidden'); });
        dailyToast.querySelector('[data-daily-toast-start]')?.addEventListener('click', () => startDailyRating().catch(console.error));
      } else dailyToast.classList.add('hidden');
      if (activeTab === 'profile') renderDailyProfilePanel();
      if (dailyRefreshTimer) clearTimeout(dailyRefreshTimer);
      const nextRelease = new Date(`${state.clock.nextKey}T15:00:02.000Z`).getTime();
      dailyRefreshTimer = setTimeout(refreshDailyUi, Math.max(1000, Math.min(2147483647, nextRelease - Date.now())));
    }

    function entryPassesSeasonVisibility(entry) {
      return entryPassesHiddenFlags(entry, seasonHideChinese, seasonHideMovie, seasonHideShortened);
    }

    function openingListForSeason(year, season, type = seasonType) {
      return entries
        .filter(e => entryTypeMatches(e, type) && Number(e.year) === Number(year) && e.season === season && entryPassesSeasonVisibility(e))
        .sort((a, b) => {
          const av = avg(a.scores);
          const bv = avg(b.scores);
          if (av === null && bv !== null) return 1;
          if (av !== null && bv === null) return -1;
          if (av !== null && bv !== null && bv !== av) return bv - av;
          return a.title.localeCompare(b.title, 'ru');
        });
    }

    function openingQueueForSeason(year, season, type = seasonType) {
      return entries
        .filter(e => entryTypeMatches(e, type) && Number(e.year) === Number(year) && e.season === season && entryPassesSeasonVisibility(e) && !hasRated(e, myName))
        .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    }

    function personalOpeningQueueForSeason(year, season, type = seasonType) {
      return entries
        .filter(e => entryTypeMatches(e, type) && Number(e.year) === Number(year) && e.season === season && entryPassesSeasonVisibility(e) && !hasPersonalRated(e, myName))
        .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    }

    function previousSeasonFor(year, season) {
      const idx = SEASON_ORDER.indexOf(season);
      if (idx === -1) return null;
      const prevIdx = idx === 0 ? SEASON_ORDER.length - 1 : idx - 1;
      const prevYear = idx === 0 ? Number(year) - 1 : Number(year);
      if (prevYear < 1990) return null;
      const prevSeason = SEASON_ORDER[prevIdx];
      return seasonHasStarted(prevYear, prevSeason) ? { year: prevYear, season: prevSeason } : null;
    }

    function goToPreviousSeason() {
      if (!selectedSeason) return;
      const prev = previousSeasonFor(selectedSeason.year, selectedSeason.season);
      if (!prev) return;
      selectedSeason = prev;
      expandedYear = prev.year;
      renderSeasonViews();
    }

    function imgHtml(entry, className) {
      const fallback = entry && entry.type ? escapeHtml(entry.type) : 'OP';
      const title = escapeHtml(entry && entry.title ? entry.title : 'видео');
      const imageBlock = entry.image
        ? `<div class="${className}"><img loading="lazy" decoding="async" src="${escapeHtml(normalizeUrl(entry.image))}" data-fallback="${escapeHtml(normalizeUrl(entry.fallbackImage || ''))}" alt="${title}"></div>`
        : `<div class="${className}">${fallback}</div>`;
      if (!entry.link) return imageBlock;
      return `<a class="oc-image-link" href="${escapeHtml(normalizeUrl(entry.link))}" target="_blank" rel="noopener noreferrer" title="Открыть видео: ${title}">${imageBlock}</a>`;
    }


    function entryYearSeasonTag(entry) {
      return entry && entry.year ? `<span class="oc-yr-tag">${entry.year}${entry.season ? ' · ' + SEASON_LABEL[entry.season] : ''}</span>` : '';
    }

    function metricLabel(metric) {
      if (metric === 'song') return 'песня';
      if (metric === 'visual') return 'визуал';
      return 'общая';
    }

    function metricScoreFor(entry, user, metric) {
      if (metric === 'song') return songScoreFor(entry, user);
      if (metric === 'visual') return visualScoreFor(entry, user);
      return scoreFor(entry, user);
    }

    function ratedListForMetric(user, list, metric) {
      return list
        .map(e => ({ entry: e, score: metricScoreFor(e, user, metric || 'total') }))
        .filter(r => r.score !== null);
    }


    function eventBasketAccessKey(name) {
      return String(name || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, '');
    }

    function eventBasketCanAdd() {
      return !!myName && EVENT_BASKET_ALLOWED.has(eventBasketAccessKey(myName));
    }

    function loadEventBasket() {
      return firebaseEventBasket && typeof firebaseEventBasket === 'object' ? firebaseEventBasket : {};
    }

    function saveEventBasket(data) {
      firebaseEventBasket = data && typeof data === 'object' ? data : {};
    }

    async function saveEventBasketSeasonToFirebase(key, seasonState) {
      try {
        const ext = await getExtendedDb();
        const payload = {
          ...seasonState,
          key: String(key),
          updatedAt: ext.serverTimestamp()
        };
        await ext.setDoc(ext.doc(ext.db, 'eventBasket', String(key)), payload, { merge: true });
        firebaseEventBasket[String(key)] = { ...payload, updatedAtLocal: seasonState.updatedAtLocal || new Date().toISOString() };
        firebaseEventBasketLoaded = true;
        return true;
      } catch (e) {
        console.error('eventBasket save failed', e);
        setStatus('Не удалось сохранить корзину ивентов.', true);
        alert('Не удалось сохранить корзину ивентов.');
        return false;
      }
    }

    function basketSeasonKeyForEntry(entry) {
      return `${Number(entry.year) || ''}_${String(entry.season || '')}`;
    }

    function eventBasketHas(entry) {
      if (!entry || !entry.id) return false;
      const state = loadEventBasket()[basketSeasonKeyForEntry(entry)];
      if (!state) return false;
      const id = String(entry.id);
      const buckets = state.buckets || {};
      return ['unassigned', 'guaranteed', 'variable'].some(name => Array.isArray(buckets[name]) && buckets[name].map(String).includes(id));
    }

    async function addEntryToEventBasket(entry) {
      if (!entry || !entry.id) return;
      if (entry.type !== 'OP') { setStatus('В корзину ивентов пока добавляются только OP.', true); return; }
      if (!entry.year || !entry.season) { setStatus('У OP должен быть год и сезон.', true); return; }
      const data = loadEventBasket();
      const key = basketSeasonKeyForEntry(entry);
      const current = data[key] || {};
      const buckets = current.buckets || {};
      const id = String(entry.id);
      const nextBuckets = {
        unassigned: Array.isArray(buckets.unassigned) ? buckets.unassigned.map(String).filter(Boolean) : [],
        guaranteed: Array.isArray(buckets.guaranteed) ? buckets.guaranteed.map(String).filter(Boolean) : [],
        variable: Array.isArray(buckets.variable) ? buckets.variable.map(String).filter(Boolean) : []
      };
      if (!['unassigned','guaranteed','variable'].some(name => nextBuckets[name].includes(id))) nextBuckets.unassigned.push(id);
      data[key] = {
        ...current,
        key,
        year: Number(entry.year),
        season: String(entry.season),
        target: Number(current.target) || 15,
        buckets: nextBuckets,
        updatedAtLocal: new Date().toISOString()
      };
      const savedToFirebase = await saveEventBasketSeasonToFirebase(key, data[key]);
      if (savedToFirebase) {
        saveEventBasket(data);
        setStatus(`Добавлено в корзину ивентов: ${entry.title}`);
      }
      renderSeasonViews();
    }

    function renderUnifiedEntryCard(entry, opts = {}) {
      const rankLabel = opts.rankLabel !== undefined ? opts.rankLabel : '';
      const rankClass = opts.rankClass || '';
      const scoreText = opts.scoreText !== undefined ? opts.scoreText : visibleAverageMarkup(entry);
      const scoreSub = opts.scoreSub ? `<span class="oc-season-score-sub">${escapeHtml(opts.scoreSub)}</span>` : '';
      const controlsHtml = opts.controlsHtml ? `<div class="oc-card-actions">${opts.controlsHtml}</div>` : '';
      const className = opts.className ? ` ${opts.className}` : '';
      const metaLines = [];
      const fields = opts.fields || ['studios', 'directors', 'performers', 'franchises'];
      if (fields.includes('studios') && entry.studios && entry.studios.length) metaLines.push(`<span class="oc-meta-key">студия:</span> ${escapeHtml(entry.studios.join(', '))}`);
      if (fields.includes('directors') && entry.directors && entry.directors.length) metaLines.push(`<span class="oc-meta-key">режиссёр:</span> ${escapeHtml(entry.directors.join(', '))}`);
      if (fields.includes('performers') && entry.performers && entry.performers.length) metaLines.push(`<span class="oc-meta-key">исполнитель:</span> ${escapeHtml(entry.performers.join(', '))}`);
      if (fields.includes('franchises') && entry.franchises && entry.franchises.length) metaLines.push(`<span class="oc-meta-key">франшиза:</span> ${escapeHtml(entry.franchises.join(', '))}`);
      if (opts.showImageLink && entry.image) metaLines.push(`<span class="oc-meta-key">картинка:</span> <a href="${escapeHtml(normalizeUrl(entry.image))}" target="_blank" rel="noopener noreferrer">открыть ↗</a>`);
      if (opts.showTrackLink && entry.link) metaLines.push(`<a href="${escapeHtml(normalizeUrl(entry.link))}" target="_blank" rel="noopener noreferrer">ссылка ↗</a>`);
      const extraHtml = opts.extraHtml || '';
      const votesHtml = opts.votesHtml || '';
      const notesHtml = opts.notes && entry.notes ? `<div class="oc-notes">${escapeHtml(entry.notes)}</div>` : '';
      const missingFields = missingRequiredFields(entry);
      const missing = opts.showMissingLink === false ? '' : (missingFields.length ? `<span class="oc-missing-link" title="Не заполнено: ${escapeHtml(missingFields.join(', '))}">😡</span>` : '');
      const sameSongBadge = entry.sameSongGroupId && entry.sameSongTitle ? `<span class="oc-yr-tag" title="Связано с другими версиями этой песни">одна песня: ${escapeHtml(entry.sameSongTitle)}</span>` : '';
      const flagBadges = `${entryIsChinese(entry) ? '<span class="oc-yr-tag">Китай</span>' : ''}${entryIsMovie(entry) ? '<span class="oc-yr-tag">фильм</span>' : ''}${entryIsShortened(entry) ? '<span class="oc-yr-tag">укор.</span>' : ''}${sameSongBadge}`;
      return `<div class="oc-season-op oc-unified-card${className}" data-id="${escapeHtml(entry.id)}">
        <div class="oc-rank ${rankClass}">${rankLabel}</div>
        ${imgHtml(entry, 'oc-season-thumb')}
        <div class="oc-info">
          <div class="oc-name-row">
            <span class="oc-name oc-clickable-title" data-action="open-card" data-id="${escapeHtml(entry.id)}">${escapeHtml(entry.title)}</span>
            <span class="oc-type-tag ${entry.type}">${entry.type}</span>
            ${entryYearSeasonTag(entry)}
            ${missing}
            ${flagBadges}
          </div>
          ${metaLines.map(l => `<div class="oc-meta oc-meta-line">${l}</div>`).join('')}
          ${notesHtml}
          ${extraHtml}
          ${votesHtml}
        </div>
        <div class="oc-season-score">${scoreText}${scoreSub}</div>
        ${controlsHtml}
      </div>`;
    }

    function renderSeasonViews() {
      document.querySelectorAll('.oc-season-type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.seasonType === seasonType));
      syncContentFilterSelect();
      renderSeasonBrowser();
      renderSeasonList();
    }

    function renderSeasonBrowser() {
      if (!seasonYearsEl) return;
      const nowYear = currentYear();
      if (expandedYear > nowYear) expandedYear = nowYear;
      let html = '';
      for (let year = nowYear; year >= 1990; year--) {
        const yearCount = entries.filter(e => entryTypeMatches(e, seasonType) && Number(e.year) === year).length;
        const isOpen = Number(expandedYear) === year;
        html += `<div class="oc-year-block">
          <button class="oc-year-btn ${isOpen ? 'active' : ''}" data-season-year="${year}">
            <span>${year}</span><span class="oc-year-count">${yearCount} ${typeLabel(seasonType)}</span>
          </button>`;
        if (isOpen) {
          html += '<div class="oc-season-buttons">';
          SEASON_ORDER.forEach(season => {
            const started = seasonHasStarted(year, season);
            const count = openingListForSeason(year, season).length;
            const unrated = myName ? openingQueueForSeason(year, season).length : count;
            const personalUnrated = myName ? personalOpeningQueueForSeason(year, season).length : count;
            const rateUnrated = isPersonalScale() ? personalUnrated : unrated;
            const done = Boolean(myName && count > 0 && unrated === 0);
            const isActive = selectedSeason && Number(selectedSeason.year) === year && selectedSeason.season === season;
            const right = started ? `${count} ${typeLabel(seasonType)} · ${unrated} без оценки` : '<span class="oc-soon">Скоро будет</span>';
            const check = done ? '<span class="oc-season-check" title="Все OP сезона оценены с текущего ника">✓</span>' : '';
            const rateText = isPersonalScale() ? (rateUnrated === 0 ? 'Проставлено' : 'Оценить сезон') : (done ? 'Оценено' : 'Оценить сезон');
            const rateButton = started && count
              ? `<button type="button" class="oc-season-rate-mini" data-season-rate="1" data-year="${year}" data-season="${season}" ${myName && rateUnrated === 0 ? 'disabled' : ''}>${rateText}</button>`
              : '';
            html += `<div class="oc-season-row">
              <button type="button" class="oc-season-select ${isActive ? 'active' : ''} ${done ? 'done' : ''}" data-season-select="1" data-year="${year}" data-season="${season}" ${started ? '' : 'disabled'}>
                <span class="oc-season-label">${check}<span>${SEASON_LABEL[season]}</span></span>
                <span class="oc-season-right">${right}</span>
              </button>
              ${rateButton}
            </div>`;
          });
          html += '</div>';
        }
        html += '</div>';
      }
      seasonYearsEl.innerHTML = html;
    }

    function renderSeasonList() {
      if (!seasonListEl || !seasonTitleEl || !seasonSubtitleEl || !seasonRateBtn) return;
      if (!selectedSeason) {
        seasonTitleEl.textContent = 'Выберите год и сезон';
        seasonSubtitleEl.textContent = 'Список лет идёт от актуального года до 1990. Будущие сезоны помечаются как «Скоро будет».';
        seasonRateBtn.disabled = true;
        if (seasonRateAllBtn) seasonRateAllBtn.disabled = true;
        if (seasonPrevBtn) seasonPrevBtn.disabled = true;
        if (seasonTierBtn) seasonTierBtn.disabled = true;
        seasonRateBtn.textContent = 'Оценить сезон';
        seasonListEl.innerHTML = '<div class="oc-empty">Нажмите на год слева, затем выберите сезон.</div>';
        return;
      }
      const { year, season } = selectedSeason;
      const list = openingListForSeason(year, season);
      const queue = myName ? openingQueueForSeason(year, season) : list;
      const personalQueue = myName ? personalOpeningQueueForSeason(year, season) : list;
      const activeQueue = isPersonalScale() ? personalQueue : queue;
      seasonTitleEl.textContent = `${SEASON_LABEL[season]} ${year}`;
      seasonSubtitleEl.textContent = myName
        ? (isPersonalScale()
          ? `${typeLabel(seasonType)}: ${list.length}. Публично не оценено: ${queue.length}. Без отметки: ${personalQueue.length}.`
          : `${typeLabel(seasonType)}: ${list.length}. Не оценено с ника «${myName}»: ${queue.length}.`)
        : `${typeLabel(seasonType)}: ${list.length}. Чтобы скрывать уже оценённые, введите ник справа сверху.`;
      seasonRateBtn.disabled = !list.length || Boolean(myName && activeQueue.length === 0);
      if (seasonRateAllBtn) seasonRateAllBtn.disabled = !list.length;
      if (seasonPrevBtn) seasonPrevBtn.disabled = !previousSeasonFor(year, season);
      if (seasonTierBtn) seasonTierBtn.disabled = !list.length;
      seasonRateBtn.textContent = isPersonalScale()
        ? (myName && list.length && activeQueue.length === 0 ? 'Проставлено ✓' : 'Оценить сезон')
        : (myName && list.length && queue.length === 0 ? 'Сезон оценён ✓' : 'Оценить сезон');
      if (!list.length) {
        seasonListEl.innerHTML = `<div class="oc-empty">В этом сезоне пока нет добавленных ${typeLabel(seasonType)}.</div>`;
        return;
      }
      seasonListEl.innerHTML = `<div class="oc-season-op-list">${list.map((entry, idx) => {
        const score = avg(entry.scores);
        const myScore = isPersonalScale() ? personalScoreFor(entry, myName) : scoreFor(entry, myName);
        const myScoreText = myScore !== null ? (isPersonalScale() ? formatFiveScore(myScore) : formatScore(myScore)) : '';
        const scoreText = visibleAverageMarkup(entry, score);
        const extraHtml = myScore !== null ? `<div class="oc-rated-mark">твоя оценка: ${escapeHtml(myScoreText)}</div>` : '';
        const basketButton = eventBasketCanAdd() && entry.type === 'OP'
          ? `<button type="button" class="oc-season-re-rate oc-basket-add-btn" data-basket-add="${entry.id}">${eventBasketHas(entry) ? 'В корзине ✓' : 'Добавить в корзину'}</button>`
          : '';
        const controlsHtml = `${basketButton}<button type="button" class="oc-season-re-rate" data-op-rate="${entry.id}">${myScore !== null ? 'Переоценить' : 'Оценить'}</button>`;
        return renderUnifiedEntryCard(entry, {
          rankLabel: idx + 1,
          scoreText,
          fields: ['performers'],
          extraHtml,
          controlsHtml,
          className: 'season-card'
        });
      }).join('')}</div>`;
    }

    function switchTab(tab) {
      if (tab !== 'chart' && !requireAccount()) return;
      activeTab = tab;
      document.querySelectorAll('.oc-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
      mainPanel.classList.toggle('hidden', tab !== 'chart');
      profilePanel.classList.toggle('hidden', tab !== 'profile');
      if (top100Panel) top100Panel.classList.toggle('hidden', tab !== 'top100');
      seasonPanel.classList.toggle('hidden', tab !== 'season');
      if (tierPanel) tierPanel.classList.toggle('hidden', tab !== 'tier');
      if (statsPanel) statsPanel.classList.toggle('hidden', tab !== 'stats');
      if (tab === 'season') renderSeasonViews();
      if (tab === 'profile') renderProfile();
      if (tab === 'top100') renderGlobalTop100();
      if (tab === 'tier') { populateFilterOptions(); renderTierList(); }
      if (tab === 'stats') renderStatsPage();
      renderHomeTestShowcase();
    }

    function clampScore(value) {
      if (value === null || value === undefined || String(value).trim() === '') return null;
      const num = Number(value);
      if (!Number.isFinite(num)) return null;
      const step = scaleStep();
      const rounded = Math.round(num / step) * step;
      return Math.max(ratingMin(), Math.min(ratingMax(), Number(rounded.toFixed(1))));
    }

    function startSeasonRating(includeAll = false) {
      if (!selectedSeason) return;
      if (!ensureNickname()) return;
      evaluatorMode = includeAll ? 'season-all' : 'season';
      seasonQueue = includeAll
        ? openingListForSeason(selectedSeason.year, selectedSeason.season, seasonType).slice().sort((a, b) => a.title.localeCompare(b.title, 'ru'))
        : (isPersonalScale()
          ? personalOpeningQueueForSeason(selectedSeason.year, selectedSeason.season, seasonType)
          : openingQueueForSeason(selectedSeason.year, selectedSeason.season, seasonType));
      seasonQueueIndex = 0;
      if (!seasonQueue.length) {
        setStatus(isPersonalScale()
          ? `У всех ${typeLabel(seasonType)} этого сезона уже есть твоя оценка ✓`
          : `Все ${typeLabel(seasonType)} этого сезона уже оценены с текущего ника ✓`);
        return;
      }
      renderEvaluator();
    }

    function startOpeningRating(entryId) {
      if (!ensureNickname()) return;
      const entry = entriesById.get(String(entryId));
      if (!entry) return;
      evaluatorMode = 'single';
      seasonQueue = [entry];
      seasonQueueIndex = 0;
      renderEvaluator();
    }

    function closeEvaluator() {
      evaluatorEl.classList.add('hidden');
      evaluatorEl.innerHTML = '';
      seasonQueue = [];
      seasonQueueIndex = 0;
      dailyActiveKey = '';
    }

    function renderEvaluator() {
      if (!seasonQueue.length || seasonQueueIndex >= seasonQueue.length) {
        const completedMode = evaluatorMode;
        const completedDailyKey = dailyActiveKey;
        closeEvaluator();
        renderSeasonViews();
        if (completedMode === 'daily') {
          finalizeDaily(completedDailyKey).catch(error => { console.error(error); setStatus('Не удалось завершить дейлик.', true); });
          return;
        }
        setStatus(isPersonalScale()
          ? (completedMode === 'single' ? 'Оценка сохранена ✓' : 'Оценки сезона проставлены ✓')
          : (completedMode === 'single' ? 'Оценка сохранена ✓' : 'Сезонная оценка завершена ✓'));
        return;
      }
      const entry = seasonQueue[seasonQueueIndex];
      const existingScore = isPersonalScale() ? personalScoreFor(entry, myName) : scoreFor(entry, myName);
      const savedScore = existingScore !== null ? clampScore(existingScore) : defaultScore();
      const savedSongScore = songScoreFor(entry, myName);
      const savedVisualScore = visualScoreFor(entry, myName);
      const optionalPublicParts = !isPersonalScale();
      const inputMin = ratingMin();
      const inputMax = ratingMax();
      const inputStep = scaleStep();
      const progressText = evaluatorMode === 'single'
        ? `Переоценка · ${entry.year || 'год не указан'}${entry.season ? ' · ' + SEASON_LABEL[entry.season] : ''}`
        : evaluatorMode === 'daily'
          ? `Ежедневная оценка · ${seasonQueueIndex + 1} из ${seasonQueue.length} оставшихся`
          : `${seasonQueueIndex + 1} из ${seasonQueue.length} · ${SEASON_LABEL[selectedSeason.season]} ${selectedSeason.year}`;
      evaluatorEl.classList.remove('hidden');
      evaluatorEl.innerHTML = `<div class="oc-eval-modal">
        <div class="oc-eval-top">
          <div>
            <div class="oc-eval-progress">${escapeHtml(progressText)}</div>
            <div class="oc-eval-title">${escapeHtml(entry.title)}</div>
          </div>
          <button class="oc-eval-close" data-eval-action="close">Закрыть</button>
        </div>
        ${renderOpeningVideoBlock(entry)}
        <div class="oc-eval-grid">
          <label>Оценка
            <input id="oc-eval-range" type="range" min="${inputMin}" max="${inputMax}" step="${inputStep}" value="${savedScore}" />
            <div class="oc-score-word" id="oc-eval-word">${escapeHtml(formatInputScore(savedScore))}</div>
          </label>
          <label>${isPersonalScale() ? 'Значение' : 'Итог'}
            <input id="oc-eval-score" type="number" min="${inputMin}" max="${inputMax}" step="${inputStep}" value="${savedScore}" />
          </label>
          ${optionalPublicParts ? `<div class="oc-eval-parts">
            <label>Песня <span class="oc-muted-inline">необяз.</span>
              <input id="oc-eval-song-score" type="number" min="${inputMin}" max="${inputMax}" step="${inputStep}" value="${savedSongScore !== null ? savedSongScore : ''}" placeholder="—" />
            </label>
            <label>Визуал <span class="oc-muted-inline">необяз.</span>
              <input id="oc-eval-visual-score" type="number" min="${inputMin}" max="${inputMax}" step="${inputStep}" value="${savedVisualScore !== null ? savedVisualScore : ''}" placeholder="—" />
            </label>
          </div>` : ''}
        </div>
        <div class="oc-eval-actions">
          <button class="oc-secondary-btn" data-eval-action="skip">${evaluatorMode === 'single' ? 'Отмена' : 'Пропустить'}</button>
          ${existingScore !== null ? `<button class="oc-secondary-btn" data-eval-action="delete-current">${isPersonalScale() ? 'Удалить отметку' : 'Удалить оценку'}</button>` : ''}
          <button class="oc-addbtn" data-eval-action="save-next">${evaluatorMode === 'single' ? 'Сохранить' : 'Сохранить и дальше'}</button>
        </div>
      </div>`;
      const range = $('#oc-eval-range');
      const score = $('#oc-eval-score');
      const word = $('#oc-eval-word');
      const updateWord = (val) => { if (word) word.textContent = formatInputScore(val); };
      range.addEventListener('input', () => { score.value = range.value; updateWord(range.value); });
      score.addEventListener('input', () => {
        const val = clampScore(score.value);
        if (val !== null) { range.value = String(val); updateWord(val); }
      });
      bindVideoEmbeds(evaluatorEl);
    }

    async function saveEvaluatorScore() {
      const entry = seasonQueue[seasonQueueIndex];
      if (!entry) return;
      const score = clampScore($('#oc-eval-score').value);
      const songInput = $('#oc-eval-song-score');
      const visualInput = $('#oc-eval-visual-score');
      const rawSong = songInput ? String(songInput.value || '').trim() : '';
      const rawVisual = visualInput ? String(visualInput.value || '').trim() : '';
      const songScore = rawSong ? clampScore(rawSong) : null;
      const visualScore = rawVisual ? clampScore(rawVisual) : null;
      if (score === null) { setStatus(`Введите оценку от ${formatScore(ratingMin())} до ${formatScore(ratingMax())}.`, true); return; }
      if (rawSong && songScore === null) { setStatus(`Введите оценку песни от ${formatScore(ratingMin())} до ${formatScore(ratingMax())} или оставьте поле пустым.`, true); return; }
      if (rawVisual && visualScore === null) { setStatus(`Введите оценку визуала от ${formatScore(ratingMin())} до ${formatScore(ratingMax())} или оставьте поле пустым.`, true); return; }
      try {
        if (isPersonalScale()) {
          entry.personalScores = entry.personalScores || {};
          entry.personalScores[myName] = score;
          await saveRatingExtras(entry.id, myName, { personalScore: score });
        } else {
          entry.scores = entry.scores || {};
          entry.scores[myName] = score;
          if (songInput) {
            entry.songScores = entry.songScores || {};
            if (songScore === null) delete entry.songScores[myName];
            else entry.songScores[myName] = songScore;
          }
          if (visualInput) {
            entry.visualScores = entry.visualScores || {};
            if (visualScore === null) delete entry.visualScores[myName];
            else entry.visualScores[myName] = visualScore;
          }
          await window.OPED_DB.saveRating(entry.id, myName, score);
          await saveRatingExtras(entry.id, myName, { songScore, visualScore });
          appendManualOrderIfMissing(myName, entry.type, entry.id);
        }
        touchEntryCache(entry);
        markRatingDataChanged();
        if (evaluatorMode === 'daily') await markDailyEntryDone(entry.id);
        setStatus('Оценка сохранена ✓');
        render();
        renderSeasonViews();
        seasonQueueIndex += 1;
        renderEvaluator();
      } catch (e) {
        console.error(e);
        setStatus('Не удалось сохранить оценку.', true);
      }
    }

    function renderEditCard(entry) {
      const seasonOptions = ['', 'winter', 'spring', 'summer', 'fall'].map(s => {
        const label = s === '' ? 'Сезон —' : SEASON_LABEL[s];
        const sel = entry.season === s ? 'selected' : '';
        return `<option value="${s}" ${sel}>${label}</option>`;
      }).join('');

      return `
        <div class="oc-editcard" data-id="${entry.id}">
          <div class="oc-section-label">редактирование трека</div>
          <div class="oc-editgrid">
            <input class="oc-e-title" type="text" autocomplete="off" value="${escapeHtml(entry.title)}" placeholder="Название" />
            <select class="oc-e-type">
              <option value="OP" ${entry.type === 'OP' ? 'selected' : ''}>OP</option>
              <option value="ED" ${entry.type === 'ED' ? 'selected' : ''}>ED</option>
            </select>
            <input class="oc-e-year" type="number" min="1960" max="2100" value="${entry.year || ''}" placeholder="Год" />
            <select class="oc-e-season">${seasonOptions}</select>
          </div>
          <div class="oc-editgrid2">
            <input class="oc-e-studio" type="text" list="oc-dl-studios" autocomplete="off" value="${escapeHtml((entry.studios || []).join(', '))}" placeholder="Студии (через запятую)" />
            <input class="oc-e-director" type="text" list="oc-dl-directors" autocomplete="off" value="${escapeHtml((entry.directors || []).join(', '))}" placeholder="Режиссёры опа (через запятую)" />
            <input class="oc-e-performer" type="text" list="oc-dl-performers" autocomplete="off" value="${escapeHtml((entry.performers || []).join(', '))}" placeholder="Исполнители (через запятую)" />
            <textarea class="oc-e-franchise" autocomplete="off" placeholder="Франшизы: одна строка = одна франшиза. Пустое поле удалит франшизу">${escapeHtml((entry.franchises || []).join('\n'))}</textarea>
            <input class="oc-e-same-song" type="text" list="oc-dl-same-songs" autocomplete="off" value="${escapeHtml(entry.sameSongTitle || '')}" placeholder="Одинаковая песня — введи одинаковое общее название у связанных OP/ED" />
          </div>
          <div class="oc-editgrid3">
            <input class="oc-e-image" type="text" value="${escapeHtml(entry.image || '')}" placeholder="Основная картинка / постер (URL)" />
            <input class="oc-e-fallback-image" type="text" value="${escapeHtml(entry.fallbackImage || '')}" placeholder="Запасная картинка (URL или images/файл.webp)" />
            <input class="oc-e-link" type="text" value="${escapeHtml(entry.link || '')}" placeholder="Ссылка (anisongdb.com и т.п.)" />
            <input class="oc-e-notes" type="text" value="${escapeHtml(entry.notes || '')}" placeholder="Заметка (необязательно)" />
          </div>
          <div class="oc-editgrid3">
            <textarea class="oc-e-alt-titles" placeholder="Альтернативные названия — каждое с новой строки или через ;. Можно оставить пустым">${escapeHtml((entry.alternativeTitles || []).join('\n'))}</textarea>
          </div>
          <div class="oc-edit-flags">
            <label class="oc-flag-check"><input class="oc-e-chinese" type="checkbox" ${entryIsChinese(entry) ? 'checked' : ''} /> Китайский OP/ED</label>
            <label class="oc-flag-check"><input class="oc-e-movie" type="checkbox" ${entryIsMovie(entry) ? 'checked' : ''} /> OP/ED фильма</label>
            <label class="oc-flag-check"><input class="oc-e-shortened" type="checkbox" ${entryIsShortened(entry) ? 'checked' : ''} /> Укороченный OP/ED</label>
          </div>
          <div class="oc-edit-actions">
            <button class="oc-cancel-btn" data-action="cancel-edit" data-id="${entry.id}">Отмена</button>
            <button class="oc-save-btn" data-action="save-edit" data-id="${entry.id}">Сохранить</button>
          </div>
        </div>`;
    }

    // ---------- manual (user-curated) top-100 ----------
    function manualUserSafeKey(user) {
      const raw = String(user || '').trim();
      if (!raw) return '';
      if (window.OPED_DB && typeof window.OPED_DB.normalizeNickname === 'function') return window.OPED_DB.normalizeNickname(raw);
      return safeDocPart(raw);
    }

    function manualCandidateKeys(user) {
      const raw = String(user || '').trim();
      if (!raw) return [];
      const safe = manualUserSafeKey(raw);
      const lower = raw.toLowerCase();
      const keys = [raw, safe, lower].filter(Boolean);
      Object.keys(manualRanks || {}).forEach(k => {
        const kk = String(k || '').trim();
        if (!kk) return;
        const row = manualRanks[kk] || {};
        const rowNick = String(row.nickname || row.displayName || row.name || '').trim();
        const rowSafe = String(row.nicknameKey || '').trim();
        if (kk.toLowerCase() === lower || manualUserSafeKey(kk) === safe || rowNick.toLowerCase() === lower || rowSafe === safe) {
          keys.push(kk, rowNick, rowSafe);
        }
      });
      return Array.from(new Set(keys.filter(Boolean)));
    }

    function manualSameUser(a, b) {
      const aa = String(a || '').trim();
      const bb = String(b || '').trim();
      if (!aa || !bb) return false;
      const aKeys = manualCandidateKeys(aa).map(x => String(x).trim()).filter(Boolean);
      const bKeys = manualCandidateKeys(bb).map(x => String(x).trim()).filter(Boolean);
      const bLower = new Set(bKeys.map(x => x.toLowerCase()));
      const bSafe = new Set(bKeys.map(x => manualUserSafeKey(x)).filter(Boolean));
      return aKeys.some(x => bLower.has(x.toLowerCase()) || bSafe.has(manualUserSafeKey(x)));
    }

    function valueForUserMap(map, user) {
      if (!map || !user) return undefined;
      const raw = String(user).trim();
      if (Object.prototype.hasOwnProperty.call(map, raw)) return map[raw];
      const keys = manualCandidateKeys(raw);
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
      }
      const safe = manualUserSafeKey(raw);
      const lower = raw.toLowerCase();
      for (const key of Object.keys(map)) {
        const k = String(key || '').trim();
        if (!k) continue;
        if (k.toLowerCase() === lower || manualUserSafeKey(k) === safe) return map[key];
      }
      return undefined;
    }

    function appendManualOrderIfMissing(user, type, id) {
      const raw = String(user || '').trim();
      const openingId = String(id || '').trim();
      if (!raw || !openingId) return false;
      const current = getManualRanksForUser(raw) || {};
      const order = Array.isArray(current[type]) ? current[type].map(String) : savedManualOrderFor(raw, type);
      if (order.includes(openingId)) return false;
      order.push(openingId);
      rememberManualRanksForUser(raw, { ...current, [type]: order });
      markManualDirty();
      return true;
    }

    function manualRankRowHasTop(row, type) {
      return !!(row && Array.isArray(row[type]) && row[type].length);
    }

    function getManualRanksForUser(user) {
      const keys = manualCandidateKeys(user);
      const merged = {};
      let found = false;
      keys.forEach(key => {
        const row = manualRanks && manualRanks[key];
        if (!row) return;
        found = true;
        const op = Array.isArray(row.OP) ? row.OP.map(String)
          : (Array.isArray(row.manualOP) ? row.manualOP.map(String)
          : (Array.isArray(row.op) ? row.op.map(String) : null));
        const ed = Array.isArray(row.ED) ? row.ED.map(String)
          : (Array.isArray(row.manualED) ? row.manualED.map(String)
          : (Array.isArray(row.ed) ? row.ed.map(String) : null));
        const excludedOP = Array.isArray(row.excludedOP) ? row.excludedOP.map(String) : null;
        const excludedED = Array.isArray(row.excludedED) ? row.excludedED.map(String) : null;
        Object.keys(row).forEach(k => {
          if (['OP','ED','op','ed','manualOP','manualED','excludedOP','excludedED'].includes(k)) return;
          if (row[k] !== undefined && row[k] !== null && row[k] !== '') merged[k] = row[k];
        });
        if (op && (op.length || !Array.isArray(merged.OP))) merged.OP = op;
        if (ed && (ed.length || !Array.isArray(merged.ED))) merged.ED = ed;
        if (excludedOP && (excludedOP.length || !Array.isArray(merged.excludedOP))) merged.excludedOP = Array.from(new Set([...(merged.excludedOP || []), ...excludedOP]));
        if (excludedED && (excludedED.length || !Array.isArray(merged.excludedED))) merged.excludedED = Array.from(new Set([...(merged.excludedED || []), ...excludedED]));
      });
      return found ? merged : {};
    }

    function rememberManualRanksForUser(user, ranks) {
      const raw = String(user || '').trim();
      if (!raw || !ranks) return;
      const safe = manualUserSafeKey(raw);
      const profileRow = {
        ...(manualRanks[raw] || {}),
        ...ranks,
        nickname: ranks.nickname || raw,
        nicknameKey: ranks.nicknameKey || safe
      };
      manualRanks[raw] = profileRow;
      if (safe && safe !== raw) manualRanks[safe] = profileRow;
    }

    function manualExcludedField(type) {
      return String(type || '').toUpperCase() === 'ED' ? 'excludedED' : 'excludedOP';
    }

    function manualExcludedSet(user, type) {
      const row = getManualRanksForUser(user) || {};
      const field = manualExcludedField(type);
      return new Set((Array.isArray(row[field]) ? row[field] : []).map(String));
    }

    function setManualExcluded(user, type, ids) {
      const row = getManualRanksForUser(user) || {};
      const field = manualExcludedField(type);
      const clean = Array.from(new Set((ids || []).map(String).filter(Boolean)));
      rememberManualRanksForUser(user, { ...row, [field]: clean });
    }

    function removeManualExcluded(user, type, id) {
      const excluded = manualExcludedSet(user, type);
      const before = excluded.size;
      excluded.delete(String(id));
      if (excluded.size !== before) setManualExcluded(user, type, Array.from(excluded));
    }

    function manualHiddenKey(user, type) {
      return `${manualUserSafeKey(user)}|${String(type || '').toUpperCase()}`;
    }

    function manualHiddenSet(user, type) {
      const key = manualHiddenKey(user, type);
      if (!manualHiddenForEdit[key]) manualHiddenForEdit[key] = [];
      return new Set(manualHiddenForEdit[key].map(String));
    }

    function isManualHidden(user, type, id) {
      return manualHiddenSet(user, type).has(String(id));
    }

    function hideManualCandidate(user, type, id) {
      const key = manualHiddenKey(user, type);
      const set = manualHiddenSet(user, type);
      set.add(String(id));
      manualHiddenForEdit[key] = Array.from(set);
    }

    function unhideManualCandidate(user, type, id) {
      const key = manualHiddenKey(user, type);
      const set = manualHiddenSet(user, type);
      set.delete(String(id));
      manualHiddenForEdit[key] = Array.from(set);
    }

    function manualHiddenCount(user) {
      return ['OP','ED'].reduce((sum, type) => sum + manualHiddenSet(user, type).size, 0);
    }

    function ratedIdsForManual(user, type) {
      return entries
        .filter(e => e.type === type && scoreFor(e, user) !== null)
        .sort((a, b) => {
          const scoreDiff = (scoreFor(b, user) || 0) - (scoreFor(a, user) || 0);
          if (scoreDiff !== 0) return scoreDiff;
          return a.title.localeCompare(b.title, 'ru');
        })
        .map(e => e.id);
    }

    function savedManualOrderFor(user, type) {
      if (!user) return [];
      const row = getManualRanksForUser(user);
      const saved = row && Array.isArray(row[type]) ? row[type].map(String) : [];
      const valid = new Set(entries.filter(e => e.type === type).map(e => String(e.id)));
      const excluded = manualExcludedSet(user, type);
      const seen = new Set();
      return saved.filter(id => valid.has(String(id)) && !excluded.has(String(id)) && !seen.has(String(id)) && (seen.add(String(id)) || true));
    }

    function ensureManualOrderForEditing(user, type) {
      if (!user) return [];
      const current = getManualRanksForUser(user);
      rememberManualRanksForUser(user, current);
      const saved = savedManualOrderFor(user, type);
      const seen = new Set(saved.map(String));
      const excluded = manualExcludedSet(user, type);
      const missing = ratedIdsForManual(user, type).filter(id => !seen.has(String(id)) && !excluded.has(String(id)));
      const order = saved.concat(missing);
      rememberManualRanksForUser(user, { ...getManualRanksForUser(user), [type]: order });
      return order;
    }

    function manualOrderFor(user, type, includeMissing = false) {
      return includeMissing ? ensureManualOrderForEditing(user, type) : savedManualOrderFor(user, type);
    }

    function manualPositionFor(user, type, id, includeMissing = false) {
      const order = manualOrderFor(user, type, includeMissing);
      const idx = order.indexOf(id);
      return idx === -1 ? null : idx + 1;
    }

    function markManualDirty() {
      manualDirty = true;
      const saveBtn = $('#oc-manual-save-btn');
      if (saveBtn) saveBtn.classList.add('active');
    }

    function swapManualRank(user, type, idA, idB) {
      const order = ensureManualOrderForEditing(user, type);
      const ia = order.indexOf(idA);
      const ib = order.indexOf(idB);
      if (ia === -1 || ib === -1) return false;
      const tmp = order[ia];
      order[ia] = order[ib];
      order[ib] = tmp;
      rememberManualRanksForUser(user, { ...getManualRanksForUser(user), [type]: order });
      markManualDirty();
      return true;
    }

    function moveManualRankByOffset(user, type, id, offset) {
      const order = ensureManualOrderForEditing(user, type).slice();
      const from = order.indexOf(id);
      const to = from + offset;
      if (from === -1 || to < 0 || to >= order.length) return false;
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      rememberManualRanksForUser(user, { ...getManualRanksForUser(user), [type]: order });
      markManualDirty();
      return true;
    }

    function moveManualRankTo(user, type, id, place) {
      const order = ensureManualOrderForEditing(user, type).slice();
      const from = order.indexOf(id);
      const targetNum = Number(place);
      if (from === -1 || !Number.isFinite(targetNum)) return false;
      const to = Math.max(0, Math.min(order.length - 1, Math.round(targetNum) - 1));
      if (from === to) return false;
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      rememberManualRanksForUser(user, { ...getManualRanksForUser(user), [type]: order });
      markManualDirty();
      return true;
    }

    function promptManualRank(user, type, id) {
      const order = ensureManualOrderForEditing(user, type);
      const current = order.indexOf(id) + 1;
      if (!current) return false;
      const raw = window.prompt(
        `Введите место в ручном топе ${type} от 1 до ${order.length}.\n1–100 попадает в Топ-100, 101+ уйдёт ниже топа.`,
        String(current)
      );
      if (raw === null) return false;
      const place = Number(raw.replace(',', '.'));
      if (!Number.isFinite(place)) {
        setStatus('Нужно ввести число места.', true);
        return false;
      }
      return moveManualRankTo(user, type, id, place);
    }

    function moveManualRankToTop100(user, type, id) {
      const cleanId = String(id || '').trim();
      if (!cleanId) return false;
      removeManualExcluded(user, type, cleanId);
      let order = ensureManualOrderForEditing(user, type).slice();
      let from = order.indexOf(cleanId);
      if (from === -1) {
        order.push(cleanId);
        from = order.length - 1;
      }
      const to = Math.min(99, Math.max(0, order.length - 1));
      if (from === to) {
        rememberManualRanksForUser(user, { ...getManualRanksForUser(user), [type]: order });
        markManualDirty();
        return true;
      }
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      rememberManualRanksForUser(user, { ...getManualRanksForUser(user), [type]: order });
      markManualDirty();
      return true;
    }

    function removeManualRankFromTop100(user, type, id) {
      const cleanId = String(id || '').trim();
      if (!cleanId) return false;
      const order = ensureManualOrderForEditing(user, type).slice().filter(x => String(x) !== cleanId);
      const excluded = manualExcludedSet(user, type);
      excluded.add(cleanId);
      rememberManualRanksForUser(user, {
        ...getManualRanksForUser(user),
        [type]: order,
        [manualExcludedField(type)]: Array.from(excluded)
      });
      markManualDirty();
      return true;
    }

    function ratedListFor(user, list) {
      return list
        .map(e => ({ entry: e, score: scoreFor(e, user) }))
        .filter(r => r.score !== null);
    }

    function computeProfileStats(user, list) {
      const rated = ratedListFor(user, list);
      const opRated = rated.filter(r => r.entry.type === 'OP');
      const edRated = rated.filter(r => r.entry.type === 'ED');
      const meanOf = (arr) => arr.length ? arr.reduce((a, b) => a + b.score, 0) / arr.length : null;
      const songRated = list.map(e => ({ entry: e, score: songScoreFor(e, user) })).filter(r => r.score !== null);
      const visualRated = list.map(e => ({ entry: e, score: visualScoreFor(e, user) })).filter(r => r.score !== null);

      function groupRows(getKeys, sourceList) {
        const groups = {};
        sourceList.forEach(r => {
          getKeys(r.entry).forEach(key => {
            if (!key) return;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r.score);
          });
        });
        const rows = Object.entries(groups)
          .map(([key, scores]) => ({ key, mean: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length }))
          .filter(row => row.count >= MIN_PUBLIC_VOTES);
        rows.sort((a, b) => b.mean - a.mean || b.count - a.count || a.key.localeCompare(b.key, 'ru'));
        const worstRows = rows.slice().sort((a, b) => a.mean - b.mean || b.count - a.count || a.key.localeCompare(b.key, 'ru'));
        return { top: rows.slice(0, 5), worst: worstRows[0] ? [worstRows[0]] : [] };
      }

      return {
        avgOp: meanOf(opRated), avgEd: meanOf(edRated), avgAll: meanOf(rated),
        countOp: opRated.length, countEd: edRated.length, countAll: rated.length,
        avgSong: meanOf(songRated), countSong: songRated.length,
        avgVisual: meanOf(visualRated), countVisual: visualRated.length,
        opStudios: groupRows(e => e.studios || [], opRated),
        edStudios: groupRows(e => e.studios || [], edRated),
        topDirectors: groupRows(e => e.directors || [], rated),
        topPerformers: groupRows(e => e.performers || [], rated),
        opFranchises: groupRows(e => e.franchises || [], opRated),
        edFranchises: groupRows(e => e.franchises || [], edRated),
        topSongPerformers: groupRows(e => e.performers || [], songRated),
        topSeasonYears: groupRows(e => (e.year && e.season) ? [`${SEASON_LABEL[e.season]} ${e.year}`] : [], rated),
        topEdSeasonYears: groupRows(e => (e.year && e.season) ? [`${SEASON_LABEL[e.season]} ${e.year}`] : [], edRated)
      };
    }

    function statCard(label, value, sub, accent) {
      return `<div class="oc-stat-card"><div class="oc-stat-label">${label}</div><div class="oc-stat-value${accent ? ' accent' : ''}">${value}</div>${sub ? `<div class="oc-stat-sub">${sub}</div>` : ''}</div>`;
    }

    function statListCard(label, rows, emptyText, worstRows) {
      const body = rows && rows.length
        ? `<div class="oc-small-list">${rows.map((row, idx) => `<div class="oc-small-list-row"><span>${idx + 1}. ${escapeHtml(row.key)}</span><span>${formatScore(row.mean)} · ${row.count}</span></div>`).join('')}${worstRows && worstRows.length ? `<div class="oc-small-list-row"><span>худший: ${escapeHtml(worstRows[0].key)}</span><span>${formatScore(worstRows[0].mean)} · ${worstRows[0].count}</span></div>` : ''}</div>`
        : `<div class="oc-stat-sub">${emptyText || 'нет данных'}${worstRows && worstRows.length ? ` · худший: ${escapeHtml(worstRows[0].key)} (${formatScore(worstRows[0].mean)})` : ''}</div>`;
      return `<div class="oc-stat-card"><div class="oc-stat-label">${label}</div>${body}</div>`;
    }

    function renderProfileStats(stats) {
      const el = $('#oc-profile-stats');
      if (!el) return;
      if (!stats.countAll) {
        el.innerHTML = statCard('статистика', '—', 'нет оценок по текущим фильтрам');
        return;
      }
      const parts = [];
      parts.push(statCard('Средняя · OP', formatScore(stats.avgOp), stats.countOp + ' оценено', true));
      parts.push(statCard('Средняя · ED', formatScore(stats.avgEd), stats.countEd + ' оценено', true));
      parts.push(statCard('Средняя · всего', formatScore(stats.avgAll), stats.countAll + ' оценено'));
      if (stats.countSong) parts.push(statCard('Средняя · песня', formatScore(stats.avgSong), stats.countSong + ' оценено отдельно', true));
      if (stats.countVisual) parts.push(statCard('Средняя · визуал', formatScore(stats.avgVisual), stats.countVisual + ' оценено отдельно', true));
      parts.push(statCard('Оценено OP', stats.countOp, ''));
      parts.push(statCard('Оценено ED', stats.countEd, ''));
      parts.push(statListCard('Топ-5 студий · OP', stats.opStudios.top, 'нужно минимум 3 OP одной студии', stats.opStudios.worst));
      parts.push(statListCard('Топ-5 студий · ED', stats.edStudios.top, 'нужно минимум 3 ED одной студии', stats.edStudios.worst));
      parts.push(statListCard('Топ-5 исполнителей', stats.topPerformers.top, 'нужно минимум 3 трека исполнителя', stats.topPerformers.worst));
      if (stats.topSongPerformers && stats.topSongPerformers.top.length) parts.push(statListCard('Топ-5 исполнителей · песня', stats.topSongPerformers.top, 'нет отдельных оценок песни', stats.topSongPerformers.worst));
      parts.push(statListCard('Топ-5 режиссёров', stats.topDirectors.top, 'нужно минимум 3 трека режиссёра', stats.topDirectors.worst));
      parts.push(statListCard('Топ-5 франшиз · OP', stats.opFranchises.top, 'нужно минимум 3 OP одной франшизы', stats.opFranchises.worst));
      parts.push(statListCard('Топ-5 франшиз · ED', stats.edFranchises.top, 'нужно минимум 3 ED одной франшизы', stats.edFranchises.worst));
      parts.push(statListCard('Топ-5 сезонов', stats.topSeasonYears.top, 'нужно минимум 3 трека сезона', stats.topSeasonYears.worst));
      parts.push(statListCard('Топ-5 сезонов · ED', stats.topEdSeasonYears.top, 'нужно минимум 3 ED в сезоне', stats.topEdSeasonYears.worst));
      el.innerHTML = parts.join('');
    }

    function populateArScoreOptions(user, list) {
      const sel = $('#oc-ar-score');
      if (!sel) return;
      const rated = ratedListForMetric(user, list, arScoreMetric);
      const values = Array.from(new Set(rated.map(r => r.score))).sort((a, b) => a - b);
      const prev = sel.value;
      sel.innerHTML = `<option value="">Любая ${metricLabel(arScoreMetric)}</option>` + values.map(v => `<option value="${v}">${formatScore(v)}</option>`).join('');
      sel.value = values.map(String).includes(prev) ? prev : '';
      arScoreFilter = sel.value;
    }

    function renderAllRatings(user, list) {
      const opContainer = $('#oc-allratings-op') || $('#oc-allratings-list');
      const edContainer = $('#oc-allratings-ed');
      const opCol = $('#oc-allratings-col-op');
      const edCol = $('#oc-allratings-col-ed');
      if (!opContainer) return;
      if (!user) {
        opContainer.innerHTML = '<div class="oc-empty">Выберите пользователя</div>';
        if (edContainer) edContainer.innerHTML = '<div class="oc-empty">Выберите пользователя</div>';
        return;
      }

      function renderColumn(type, container) {
        if (!container) return;
        let rated = ratedListForMetric(user, list, arScoreMetric).filter(r => r.entry.type === type);
        if (arScoreFilter !== '') rated = rated.filter(r => String(r.score) === String(arScoreFilter));
        rated.sort((a, b) => {
          const scoreDiff = arSortDir === 'asc' ? a.score - b.score : b.score - a.score;
          if (scoreDiff !== 0) return scoreDiff;
          return a.entry.title.localeCompare(b.entry.title, 'ru');
        });

        if (!rated.length) {
          container.innerHTML = `<div class="oc-empty">Нет оценённых ${type} для выбранной оценки: ${metricLabel(arScoreMetric)}</div>`;
          return;
        }

        const editableManual = topMode === 'manual' && manualEditMode && !!myName && manualSameUser(user, myName);
        if (editableManual) {
          ensureManualOrderForEditing(user, type);
          if (!manualShowHidden) rated = rated.filter(r => !isManualHidden(user, type, r.entry.id));
        }

        allRatingsPage[type] = clampPage(allRatingsPage[type] || 1, rated.length);
        const page = pageSlice(rated, allRatingsPage[type]);
        const rowsHtml = page.items.map((r, idx) => {
          const e = r.entry;
          const pos = manualPositionFor(user, e.type, e.id, editableManual);
          const canDeleteRating = !!myName && manualSameUser(user, myName);
          const hiddenInEditor = editableManual && isManualHidden(user, e.type, e.id);
          const manualControls = editableManual ? `
              ${hiddenInEditor ? `<button type="button" class="oc-ar-top-btn" data-action="all-unhide-manual" data-type="${e.type}" data-id="${e.id}" title="Вернуть в список редактирования">Вернуть</button>` : `
                <button type="button" class="oc-ar-rank-btn" data-action="all-set-rank" data-type="${e.type}" data-id="${e.id}" title="Ввести точное место в ручном топе">№ ${pos || '—'}</button>
                ${(!pos || pos > 100) ? `<button type="button" class="oc-ar-top-btn" data-action="all-to-top100" data-type="${e.type}" data-id="${e.id}" title="Поставить на 100-е место и вытолкнуть текущий 100-й ниже">В топ-100</button>` : ''}
                <button type="button" class="oc-ar-top-btn" data-action="all-hide-manual" data-type="${e.type}" data-id="${e.id}" title="Скрыть только из списка редактирования">Скрыть</button>
              `}` : '';
          const deleteControl = canDeleteRating ? `<button type="button" class="oc-ar-top-btn" data-action="all-delete-rating" data-id="${e.id}" title="Удалить твою оценку">Удалить оценку</button>` : '';
          const controls = manualControls + deleteControl;
          const detailBits = [];
          const totalVal = scoreFor(e, user);
          const songVal = songScoreFor(e, user);
          const visualVal = visualScoreFor(e, user);
          if (arScoreMetric !== 'total' && totalVal !== null) detailBits.push('общая: ' + formatScore(totalVal));
          if (arScoreMetric !== 'song' && songVal !== null) detailBits.push('песня: ' + formatScore(songVal));
          if (arScoreMetric !== 'visual' && visualVal !== null) detailBits.push('визуал: ' + formatScore(visualVal));
          const extraHtml = detailBits.length ? `<div class="oc-profile-meta">${escapeHtml(detailBits.join(' · '))}</div>` : '';
          return renderUnifiedEntryCard(e, {
            rankLabel: page.start + idx + 1,
            scoreText: formatScore(r.score),
            scoreSub: metricLabel(arScoreMetric),
            fields: ['performers'],
            extraHtml,
            controlsHtml: controls,
            className: `compact allratings-card${editableManual ? ' editable' : ''}${controls ? ' has-controls' : ''}`
          });
        }).join('');

        const scope = 'allratings-' + type.toLowerCase();
        const pager = paginationHtml(scope, allRatingsPage[type], rated.length);
        container.innerHTML = pager + rowsHtml + pager;
        bindPagination(container, scope, () => allRatingsPage[type] || 1, v => { allRatingsPage[type] = clampPage(v, rated.length); }, () => renderAllRatings(user, list));
      }

      if (opCol) opCol.style.display = (!arTypeFilter || arTypeFilter === 'OP') ? '' : 'none';
      if (edCol) edCol.style.display = (!arTypeFilter || arTypeFilter === 'ED') ? '' : 'none';
      renderColumn('OP', opContainer);
      if (edContainer) renderColumn('ED', edContainer);

      const root = $('#oc-allratings-columns') || opContainer;
      root.querySelectorAll('[data-action="open-card"]').forEach(el => el.addEventListener('click', () => openCardModal(el.getAttribute('data-id'))));

      const editableManual = topMode === 'manual' && manualEditMode && !!myName && manualSameUser(user, myName);
      if (editableManual) {
        root.querySelectorAll('[data-action="all-set-rank"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const type = btn.getAttribute('data-type');
            if (promptManualRank(user, type, id)) {
              renderProfile();
              setStatus('Место в ручном топе обновлено. Нажми «Сохранить топ-100», чтобы отправить всем.');
            }
          });
        });
        root.querySelectorAll('[data-action="all-to-top100"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const type = btn.getAttribute('data-type');
            if (moveManualRankToTop100(user, type, id)) {
              renderProfile();
              setStatus('Трек добавлен в Топ-100 локально. Нажми «Сохранить топ-100».');
            }
          });
        });
        root.querySelectorAll('[data-action="all-hide-manual"]').forEach(btn => {
          btn.addEventListener('click', () => {
            hideManualCandidate(user, btn.getAttribute('data-type'), btn.getAttribute('data-id'));
            renderProfile();
            setStatus('Скрыто из списка редактирования. Это не удаляет оценку и не влияет на сохранённый топ.');
          });
        });
        root.querySelectorAll('[data-action="all-unhide-manual"]').forEach(btn => {
          btn.addEventListener('click', () => {
            unhideManualCandidate(user, btn.getAttribute('data-type'), btn.getAttribute('data-id'));
            renderProfile();
            setStatus('Вернул в список редактирования.');
          });
        });
      }
      root.querySelectorAll('[data-action="all-delete-rating"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!window.confirm('Удалить твою оценку?')) return;
          await deleteCurrentRating(id, myName, 'public');
        });
      });
    }

    function renderProfileList(containerId, list, user, opts) {
      opts = opts || {};
      const container = $(containerId);
      if (!container) return;
      if (!user) {
        container.innerHTML = '<div class="oc-empty">Выберите пользователя</div>';
        return;
      }
      if (!list.length) {
        const manualEmpty = opts && opts.manual;
        container.innerHTML = `<div class="oc-empty">${manualEmpty ? 'Нет сохранённого ручного топа для этого типа' : 'Нет треков'}</div>`;
        return;
      }
      const editable = !!opts.editable;
      const type = opts.type || 'OP';
      const fullOrder = editable ? manualOrderFor(user, type, true) : [];
      const visibleList = list.slice(0, 100);
      const html = visibleList.map((item, idx) => {
        const absoluteIdx = idx;
        const rankClass = absoluteIdx === 0 ? 'gold' : absoluteIdx === 1 ? 'silver' : absoluteIdx === 2 ? 'bronze' : '';
        const e = item.entry;
        const absolutePos = editable ? manualPositionFor(user, type, e.id, true) : (absoluteIdx + 1);
        const rankLabel = editable ? absolutePos : (absoluteIdx < 3 ? ['①','②','③'][absoluteIdx] : (absoluteIdx + 1));
        const yearBit = e.year ? `${e.year}${e.season ? ' · ' + SEASON_LABEL[e.season] : ''}` : '';
        const scoreClass = item.score === null ? 'none' : '';
        const orderIdx = editable ? fullOrder.indexOf(e.id) : -1;
        const moveButtons = editable ? `
            <div class="oc-move-btns">
              <button class="oc-move-btn" data-action="move-up" data-type="${type}" data-id="${e.id}" ${orderIdx <= 0 ? 'disabled' : ''} title="Выше">▲</button>
              <button class="oc-move-btn" data-action="move-down" data-type="${type}" data-id="${e.id}" ${(orderIdx === -1 || orderIdx >= fullOrder.length - 1) ? 'disabled' : ''} title="Ниже">▼</button>
            </div>` : '';
        const rowActions = editable ? `
            <div class="oc-manual-row-actions">
              <button type="button" class="oc-ar-top-btn" data-action="remove-from-top" data-type="${type}" data-id="${e.id}" title="Убрать из текущего топ-100, оценки при этом останутся">Удалить из топа</button>
            </div>` : '';
        const rankHtml = editable
          ? `<button type="button" class="oc-rank-jump-btn" data-action="set-rank" data-type="${type}" data-id="${e.id}" title="Кликните, чтобы ввести место вручную">${rankLabel}</button>`
          : `<div class="oc-profile-rank ${rankClass}">${rankLabel}</div>`;
        return `
          <div class="oc-profile-item${editable ? ' manual' : ''}">
            ${rankHtml}
            ${imgHtml(e, 'oc-profile-thumb')}
            <div>
              <div class="oc-profile-name"><span class="oc-clickable-title" data-action="open-card" data-id="${e.id}">${escapeHtml(e.title)}</span></div>
              ${yearBit ? `<div class="oc-profile-meta">${escapeHtml(yearBit)}</div>` : ''}
            </div>
            <div class="oc-profile-score ${scoreClass}">${formatScore(item.score)}</div>
            ${moveButtons}
            ${rowActions}
          </div>
        `;
      }).join('');
      container.innerHTML = html;
      container.querySelectorAll('[data-action="open-card"]').forEach(el => el.addEventListener('click', () => openCardModal(el.getAttribute('data-id'))));

      if (editable) {
        container.querySelectorAll('[data-action="set-rank"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const type = btn.getAttribute('data-type');
            if (promptManualRank(user, type, id)) {
              renderProfile();
              setStatus('Место в ручном топе обновлено. Нажми «Сохранить топ-100», чтобы отправить всем.');
            }
          });
        });
        container.querySelectorAll('[data-action="move-up"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const type = btn.getAttribute('data-type');
            if (moveManualRankByOffset(user, type, id, -1)) {
              renderProfile();
            }
          });
        });
        container.querySelectorAll('[data-action="move-down"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const type = btn.getAttribute('data-type');
            if (moveManualRankByOffset(user, type, id, 1)) {
              renderProfile();
            }
          });
        });
        container.querySelectorAll('[data-action="remove-from-top"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const type = btn.getAttribute('data-type');
            if (!window.confirm('Убрать из текущего топ-100? Оценка останется, трек можно будет вернуть кнопкой «В топ-100».')) return;
            if (removeManualRankFromTop100(user, type, id)) {
              renderProfile();
              setStatus('Удалено из топ-100 локально. Нажми «Сохранить топ-100».');
            }
          });
        });
      }
    }

    function renderProfile() {
      populateProfileUsers();
      profileUser = profileUserSelect.value;

      const filtered = applyFilters(entries);
      const topFiltered = applyFiltersIgnoringType(entries);
      const allRatingsFiltered = applyFiltersIgnoringType(entries);

      renderProfileStats(computeProfileStats(profileUser, filtered));

      function topForScore(type) {
        const manualOrder = manualOrderFor(profileUser, type);
        const manualIndex = new Map(manualOrder.map((id, idx) => [id, idx]));
        const list = topFiltered
          .filter(e => e.type === type && e.scores && profileUser && e.scores[profileUser] !== undefined)
          .map(e => ({ entry: e, score: e.scores[profileUser] }));
        list.sort((a, b) => {
          const scoreDiff = b.score - a.score;
          if (scoreDiff !== 0) return scoreDiff;
          const ai = manualIndex.has(a.entry.id) ? manualIndex.get(a.entry.id) : Number.POSITIVE_INFINITY;
          const bi = manualIndex.has(b.entry.id) ? manualIndex.get(b.entry.id) : Number.POSITIVE_INFINITY;
          if (ai !== bi) return ai - bi;
          return a.entry.title.localeCompare(b.entry.title, 'ru');
        });
        return list.slice(0, 100);
      }

      function topForManual(type) {
        const ownProfile = !!myName && manualSameUser(profileUser, myName);
        const order = manualOrderFor(profileUser, type, manualEditMode && ownProfile);
        return order
          .map(id => {
            const e = topFiltered.find(x => x.id === id && x.type === type);
            return e ? { entry: e, score: scoreFor(e, profileUser) } : null;
          })
          .filter(Boolean)
          .slice(0, 100);
      }

      const isOwnProfile = !!myName && manualSameUser(profileUser, myName);
      const canEdit = topMode === 'manual' && manualEditMode && isOwnProfile;
      const opList = topMode === 'manual' ? topForManual('OP') : topForScore('OP');
      const edList = topMode === 'manual' ? topForManual('ED') : topForScore('ED');

      renderProfileList('#oc-profile-op', opList, profileUser, { editable: canEdit, type: 'OP', manual: topMode === 'manual' });
      renderProfileList('#oc-profile-ed', edList, profileUser, { editable: canEdit, type: 'ED', manual: topMode === 'manual' });

      const labelText = '(вручную)';
      $('#oc-topmode-label-op').textContent = labelText;
      $('#oc-topmode-label-ed').textContent = labelText;
      const hintEl = $('#oc-topmode-hint');
      if (topMode === 'manual') {
        hintEl.style.display = 'block';
        hintEl.textContent = canEdit
          ? 'Режим редактирования: меняй места, затем нажми «Сохранить топ-100», чтобы порядок стал виден всем.'
          : `Показан сохранённый ручной топ пользователя — порядок статичный, не пересчитывается сам по оценке.`;
      } else {
        hintEl.style.display = 'none';
        hintEl.textContent = '';
      }

      const manualEditBtn = $('#oc-manual-edit-btn');
      const manualSaveBtn = $('#oc-manual-save-btn');
      const isOwnManual = !!myName && manualSameUser(profileUser, myName) && topMode === 'manual';
      if (manualEditBtn) {
        manualEditBtn.disabled = !isOwnManual;
        manualEditBtn.classList.toggle('active', canEdit);
        manualEditBtn.textContent = canEdit ? 'Завершить редактирование' : 'Редактировать топ-100';
      }
      if (manualSaveBtn) {
        manualSaveBtn.disabled = !isOwnManual;
        manualSaveBtn.classList.toggle('active', manualDirty);
      }
      if (manualHiddenToggleBtn) {
        const hiddenCount = manualHiddenCount(profileUser);
        manualHiddenToggleBtn.disabled = !canEdit || hiddenCount === 0;
        manualHiddenToggleBtn.style.display = canEdit ? '' : 'none';
        manualHiddenToggleBtn.classList.toggle('active', manualShowHidden);
        manualHiddenToggleBtn.textContent = manualShowHidden ? `Скрыть скрытые (${hiddenCount})` : `Показать скрытые (${hiddenCount})`;
      }
      if (profileDeleteBtn) {
        profileDeleteBtn.disabled = !isAdmin() || !profileUser;
        profileDeleteBtn.style.display = isAdmin() ? '' : 'none';
      }

      populateArScoreOptions(profileUser, allRatingsFiltered);
      renderAllRatings(profileUser, allRatingsFiltered);
      renderDailyProfilePanel();
      if (registerNameInput && (!registerNameInput.value || normalizedAccountName(registerNameInput.value) === normalizedAccountName(myName))) {
        registerNameInput.value = myName || '';
      }
    }

    function setTopMode(mode) {
      topMode = mode;
      manualEditMode = false;
      profileTopPage = { OP: 1, ED: 1 };
      allRatingsPage = { OP: 1, ED: 1 };
      $('#oc-topmode-score').classList.toggle('active', mode === 'score');
      $('#oc-topmode-manual').classList.toggle('active', mode === 'manual');
      renderProfile();
    }


    function usersWithManualTop(type, scope = 'all') {
      const users = [];
      const seenKeys = new Set();
      Object.keys(manualRanks || {}).forEach(key => {
        const row = manualRanks[key] || {};
        const display = String(row.nickname || row.displayName || row.name || key || '').trim();
        if (!display) return;
        if (scope === 'admins' && !isAdminNickname(display)) return;
        const safe = String(row.nicknameKey || manualUserSafeKey(display)).trim() || display.toLowerCase();
        if (seenKeys.has(safe)) return;
        const arr = manualOrderFor(display, type);
        const hasActualTop = Array.isArray(arr) && arr.slice(0, 100).some(id => (entriesById.get(String(id)) && entriesById.get(String(id)).type === type));
        if (!hasActualTop) return;
        seenKeys.add(safe);
        users.push(display);
      });
      return users.sort((a, b) => a.localeCompare(b, 'ru'));
    }

    function computeGlobalManualTop(type, scope = 'all') {
      const users = usersWithManualTop(type, scope);
      const rows = new Map();
      users.forEach(user => {
        const seen = new Set();
        manualOrderFor(user, type).slice(0, 100).forEach((id, idx) => {
          if (seen.has(id)) return;
          const entry = entriesById.get(String(id));
          if (!entry || entry.type !== type) return;
          seen.add(id);
          if (!rows.has(id)) rows.set(id, { entry, sumPlace: 0, count: 0, bestPlace: Number.POSITIVE_INFINITY, users: [] });
          const row = rows.get(id);
          const place = idx + 1;
          row.sumPlace += place;
          row.count += 1;
          row.bestPlace = Math.min(row.bestPlace, place);
          row.users.push(user);
        });
      });
      return Array.from(rows.values()).map(row => {
        const avgPlace = row.sumPlace / row.count;
        const coverage = users.length ? row.count / users.length : 0;
        return { ...row, avgPlace, coverage, totalUsers: users.length, mode: 'manual' };
      }).sort((a, b) =>
        b.count - a.count ||
        a.avgPlace - b.avgPlace ||
        a.bestPlace - b.bestPlace ||
        a.entry.title.localeCompare(b.entry.title, 'ru')
      ).slice(0, 100);
    }

    function computeGlobalScoreTop(type, scope = 'all') {
      const minVotes = scope === 'admins' ? 1 : MIN_PUBLIC_VOTES;
      const rows = entries
        .filter(e => e.type === type)
        .map(e => ({
          entry: e,
          avgScore: scope === 'admins' ? adminAvg(e.scores, minVotes) : avg(e.scores, minVotes),
          count: scope === 'admins' ? adminRatingCount(e.scores) : ratingCount(e.scores),
          mode: 'score'
        }))
        .filter(r => r.avgScore !== null)
        .sort((a, b) => b.avgScore - a.avgScore || b.count - a.count || a.entry.title.localeCompare(b.entry.title, 'ru'));
      if (rows.length <= 100) return rows;
      const cutoff = rows[99].avgScore;
      return rows.filter((row, idx) => idx < 100 || Math.abs(row.avgScore - cutoff) < 0.0001);
    }

    function renderGlobalTop100() {
      const listEl = $('#oc-globaltop-list');
      const summaryEl = $('#oc-globaltop-summary');
      if (!listEl) return;
      if (!isAdmin()) globalTopScope = 'all';
      document.querySelectorAll('[data-globaltop-type]').forEach(btn => btn.classList.toggle('active', btn.dataset.globaltopType === globalTopType));
      document.querySelectorAll('[data-globaltop-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.globaltopMode === globalTopMode));
      document.querySelectorAll('[data-globaltop-scope]').forEach(btn => btn.classList.toggle('active', btn.dataset.globaltopScope === globalTopScope));
      const rows = globalTopMode === 'score' ? computeGlobalScoreTop(globalTopType, globalTopScope) : computeGlobalManualTop(globalTopType, globalTopScope);
      const users = usersWithManualTop(globalTopType, globalTopScope);
      const scopeLabel = globalTopScope === 'admins' ? 'Только администраторы.' : 'Все пользователи, включая администраторов.';
      const minVotes = globalTopScope === 'admins' ? 1 : MIN_PUBLIC_VOTES;
      if (summaryEl) summaryEl.textContent = globalTopMode === 'score'
        ? `${scopeLabel} Тип: ${globalTopType}. Режим: средний балл. Минимум ${minVotes} оценки. Показано: ${rows.length}.`
        : `${scopeLabel} Тип: ${globalTopType}. Режим: ручные топ-100. Сначала учитывается количество попаданий в топ, потом среднее место. Пользователей с ручным топом: ${users.length}. Показано: ${rows.length}.`;
      if (globalTopMode === 'manual' && !users.length) {
        listEl.innerHTML = '<div class="oc-empty">Пока нет сохранённых ручных топ-100 для этого типа.</div>';
        return;
      }
      if (!rows.length) {
        listEl.innerHTML = globalTopMode === 'score'
          ? `<div class="oc-empty">${globalTopScope === 'admins' ? 'Пока нет треков с оценками администраторов.' : 'Пока нет треков с минимум 3 публичными оценками.'}</div>`
          : '<div class="oc-empty">В ручных топах пока нет актуальных треков.</div>';
        return;
      }
      listEl.innerHTML = `<div class="oc-globaltop-list">${rows.map((row, idx) => {
        const e = row.entry;
        const rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
        const yearBit = e.year ? `${e.year}${e.season ? ' · ' + SEASON_LABEL[e.season] : ''}` : '';
        const metric = globalTopMode === 'score'
          ? `<div class="oc-globaltop-metric"><span class="oc-globaltop-score">ср. ${formatScore(row.avgScore)}</span></div><div class="oc-globaltop-metric">оценок ${row.count}</div><div class="oc-globaltop-metric">мин. ${minVotes}</div>`
          : `<div class="oc-globaltop-metric"><span class="oc-globaltop-score">в топе ${row.count}/${row.totalUsers}</span></div><div class="oc-globaltop-metric">ср. место ${formatScore(row.avgPlace)}</div><div class="oc-globaltop-metric">лучшее место ${row.bestPlace}</div>`;
        return `<div class="oc-globaltop-item">
          <div class="oc-profile-rank ${rankClass}">${idx < 3 ? ['①','②','③'][idx] : idx + 1}</div>
          ${imgHtml(e, 'oc-profile-thumb')}
          <div>
            <div class="oc-profile-name"><span class="oc-clickable-title" data-action="open-card" data-id="${e.id}">${escapeHtml(e.title)}</span> <span class="oc-type-tag ${e.type}">${e.type}</span></div>
            ${yearBit ? `<div class="oc-profile-meta">${escapeHtml(yearBit)}</div>` : ''}
          </div>
          ${metric}
        </div>`;
      }).join('')}</div>`;
      listEl.querySelectorAll('[data-action="open-card"]').forEach(el => el.addEventListener('click', () => openCardModal(el.getAttribute('data-id'))));
    }

    function ratingStepsDesc() {
      const steps = [];
      for (let v = 10; v >= 1; v--) steps.push(v);
      return steps;
    }

    function tierStepsDesc() {
      if (isPersonalScale()) return [5, 4, 3, 2, 1];
      return ratingStepsDesc();
    }

    function tierScoreForEntry(entry, user) {
      return isPersonalScale() ? personalScoreFor(entry, user) : scoreFor(entry, user);
    }

    function baseTierRowForScore(score) {
      if (isPersonalScale()) {
        const num = normalizeOptionalNumber(score);
        if (num === null) return null;
        return Math.max(1, Math.min(5, Math.round(num)));
      }
      const num = normalizePublicScore(score);
      if (num === null) return null;
      return Math.max(1, Math.min(10, Math.floor(num)));
    }

    function allowedTierRowsForScore(score) {
      if (isPersonalScale()) {
        const row = baseTierRowForScore(score);
        return row === null ? [] : [row];
      }
      const num = normalizePublicScore(score);
      if (num === null) return [];
      if (Math.abs(num - Math.round(num)) < 0.0001) return [Math.max(1, Math.min(10, Math.round(num)))];
      const low = Math.max(1, Math.min(10, Math.floor(num)));
      const high = Math.max(1, Math.min(10, Math.ceil(num)));
      return Array.from(new Set([low, high]));
    }

    function tierRowForEntry(user, type, year, season, entry) {
      const score = tierScoreForEntry(entry, user);
      const allowed = allowedTierRowsForScore(score);
      if (!allowed.length) return null;
      const placements = tierPlacementsForContext(user, type, year, season);
      const custom = placements && placements[entry.id] !== undefined ? Number(placements[entry.id]) : null;
      return custom !== null && allowed.includes(custom) ? custom : allowed[0];
    }

    function normalizedTierScoreRatio(score) {
      const n = Number(score);
      if (!Number.isFinite(n)) return 0;
      if (isPersonalScale()) return Math.max(0, Math.min(1, (n - 1) / 4));
      return normalizedPublicScoreRatio(n);
    }

    function tierRowStyle(score) {
      const ratio = normalizedTierScoreRatio(score);
      const hue = Math.round(ratio * 120); // low = red, high = green
      return `--tier-label-bg: hsla(${hue}, 55%, 22%, 0.72); --tier-zone-bg: hsla(${hue}, 55%, 30%, 0.09); --tier-border: hsla(${hue}, 70%, 55%, 0.42); --tier-text: hsl(${hue}, 80%, 72%);`;
    }

    function tierOrderForContext(user, type, year, season, score) {
      const keys = manualCandidateKeys(user);
      for (const candidate of keys) {
        const val = tierOrders[tierOrderKey(candidate, type, year, season, score)];
        if (Array.isArray(val)) return val;
      }
      return tierOrders[tierOrderKey(user, type, year, season, score)] || [];
    }

    function tierPlacementsForContext(user, type, year, season) {
      const keys = manualCandidateKeys(user);
      for (const candidate of keys) {
        const val = tierPlacements[tierContextKey(candidate, type, year, season)];
        if (val && typeof val === 'object') return val;
      }
      return tierPlacements[tierContextKey(user, type, year, season)] || {};
    }

    function orderedTierItems(user, type, year, season, score) {
      const items = entries.filter(e =>
        e.type === type &&
        Number(e.year) === Number(year) &&
        e.season === season &&
        tierScoreForEntry(e, user) !== null &&
        tierRowForEntry(user, type, year, season, e) === Number(score)
      );
      const saved = tierOrderForContext(user, type, year, season, score);
      const byId = new Map(items.map(e => [e.id, e]));
      const ordered = saved.filter(id => byId.has(id)).map(id => byId.get(id));
      const used = new Set(ordered.map(e => e.id));
      const rest = items.filter(e => !used.has(e.id)).sort((a, b) => a.title.localeCompare(b.title, 'ru'));
      return ordered.concat(rest);
    }

    function renderTierList() {
      const container = $('#oc-tier-list');
      if (!container) return;
      const typeSel = $('#oc-tier-type');
      const yearSel = $('#oc-tier-year');
      const seasonSel = $('#oc-tier-season');
      if (typeSel) typeSel.value = tierSelection.type;
      if (yearSel) yearSel.value = String(tierSelection.year);
      if (seasonSel) seasonSel.value = tierSelection.season;
      if (!myName) {
        container.innerHTML = '<div class="oc-empty">Введите никнейм, чтобы строить личный тир-лист.</div>';
        return;
      }
      const seasonItems = entries.filter(e => e.type === tierSelection.type && Number(e.year) === Number(tierSelection.year) && e.season === tierSelection.season);
      const ratedCount = seasonItems.filter(e => tierScoreForEntry(e, myName) !== null).length;
      if (!seasonItems.length) {
        container.innerHTML = '<div class="oc-empty">В этом сезоне нет треков выбранного типа.</div>';
        return;
      }
      if (!ratedCount) {
        container.innerHTML = isPersonalScale()
          ? '<div class="oc-empty">У тебя пока нет отметок 1–5 в этом сезоне. Оцени сезон по пятибалльному чеклисту — и карточки сами появятся в нужных рядах.</div>'
          : '<div class="oc-empty">У тебя пока нет оценок в этом сезоне. Оцени сезон — и карточки сами появятся в нужных рядах.</div>';
        return;
      }
      const rows = tierStepsDesc().map(score => {
        const items = orderedTierItems(myName, tierSelection.type, tierSelection.year, tierSelection.season, score);
        const cards = items.map(e => {
          const title = escapeHtml(e.title);
          const bg = e.image ? `<img src="${escapeHtml(normalizeUrl(e.image))}" alt="${title}" crossorigin="anonymous" referrerpolicy="no-referrer" data-remove-on-error="1">` : `<span>${escapeHtml(e.type)}</span>`;
          return `<div class="oc-tier-card" draggable="true" data-tier-card="1" data-id="${e.id}" data-score="${score}" title="${title}">
            ${bg}<div class="oc-tier-card-controls"><button type="button" class="oc-tier-shift-btn" data-tier-shift="-1" data-id="${e.id}" data-score="${score}" title="Левее">←</button><button type="button" class="oc-tier-shift-btn" data-tier-shift="1" data-id="${e.id}" data-score="${score}" title="Правее">→</button></div><div class="oc-tier-card-title">${title}</div>
          </div>`;
        }).join('');
        const label = tierLabelFor(myName, tierSelection.type, tierSelection.year, tierSelection.season, score);
        const labelIsCustom = label !== tierDefaultLabel(score);
        return `<div class="oc-tier-row" data-tier-score="${score}" style="${tierRowStyle(score)}">
          <div class="oc-tier-label" data-tier-label="1" data-score="${score}" title="Клик — переименовать тир. Пустое название сбросит его обратно.">
            <span class="${labelIsCustom ? 'oc-tier-label-custom' : ''}">${escapeHtml(label)}</span>
            <span class="oc-tier-label-edit">✎</span>
          </div>
          <div class="oc-tier-dropzone" data-tier-drop="1" data-score="${score}">${cards}</div>
        </div>`;
      }).join('');
      container.innerHTML = `<div class="oc-tier-board">${rows}</div>`;
      bindTierDnD();
      bindTierLabels();
    }

    function canDropTierCardToScore(entryId, targetScore) {
      const entry = entriesById.get(String(entryId));
      if (!entry) return false;
      return allowedTierRowsForScore(tierScoreForEntry(entry, myName)).includes(Number(targetScore));
    }

    async function saveTierPlacement(user, type, year, season, entryId, targetScore) {
      const entry = entriesById.get(String(entryId));
      if (!entry) return;
      const allowed = allowedTierRowsForScore(tierScoreForEntry(entry, user));
      const target = Number(targetScore);
      if (!allowed.includes(target)) return;
      const ctx = tierContextKey(user, type, year, season);
      tierPlacements[ctx] = tierPlacements[ctx] || {};
      if (target === allowed[0]) delete tierPlacements[ctx][entryId];
      else tierPlacements[ctx][entryId] = target;
      if (!Object.keys(tierPlacements[ctx]).length) delete tierPlacements[ctx];
      await saveTierPlacements(user, type, year, season);
    }

    async function saveVisibleTierOrders(container, scores) {
      for (const score of Array.from(new Set(scores.map(Number)))) {
        const zone = container.querySelector(`[data-tier-drop][data-score="${score}"]`);
        if (!zone) continue;
        const order = Array.from(zone.querySelectorAll('[data-tier-card]')).map(el => el.getAttribute('data-id'));
        await saveTierOrder(myName, tierSelection.type, tierSelection.year, tierSelection.season, Number(score), order);
      }
    }

    function bindTierLabels() {
      const container = $('#oc-tier-list');
      if (!container) return;
      container.querySelectorAll('[data-tier-label]').forEach(label => {
        label.addEventListener('click', async () => {
          const score = Number(label.getAttribute('data-score'));
          const current = tierLabelFor(myName, tierSelection.type, tierSelection.year, tierSelection.season, score);
          const fallback = tierDefaultLabel(score);
          const raw = window.prompt(`Название тира ${fallback}.\nОставь пустым, чтобы вернуть стандартное название.`, current === fallback ? '' : current);
          if (raw === null) return;
          await saveTierLabel(myName, tierSelection.type, tierSelection.year, tierSelection.season, score, raw);
          renderTierList();
          setStatus(raw.trim() ? 'Название тира сохранено ✓' : 'Название тира сброшено ✓');
        });
      });
    }

    function bindTierDnD() {
      const container = $('#oc-tier-list');
      if (!container) return;
      let dragId = null;
      let dragScore = null;
      let dragChanged = false;

      container.querySelectorAll('[data-tier-shift]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const score = Number(btn.getAttribute('data-score'));
          const delta = Number(btn.getAttribute('data-tier-shift'));
          const zone = container.querySelector(`[data-tier-drop][data-score="${score}"]`);
          if (!zone || !id || !Number.isFinite(delta)) return;
          const order = Array.from(zone.querySelectorAll('[data-tier-card]')).map(el => el.getAttribute('data-id'));
          const from = order.indexOf(id);
          const to = Math.max(0, Math.min(order.length - 1, from + delta));
          if (from === -1 || from === to) return;
          const [moved] = order.splice(from, 1);
          order.splice(to, 0, moved);
          try {
            await saveTierOrder(myName, tierSelection.type, tierSelection.year, tierSelection.season, score, order);
            renderTierList();
            setStatus('Порядок в тире сохранён ✓');
          } catch (err) {
            console.error(err);
            setStatus('Не удалось сохранить порядок тир-листа.', true);
          }
        });
      });

      container.querySelectorAll('[data-tier-card]').forEach(card => {
        card.addEventListener('dragstart', (e) => {
          if (e.target && e.target.closest && e.target.closest('[data-tier-shift]')) { e.preventDefault(); return; }
          dragId = card.getAttribute('data-id');
          dragScore = card.getAttribute('data-score');
          dragChanged = false;
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', dragId);
        });
        card.addEventListener('dragend', async () => {
          const currentId = dragId;
          const originalScore = dragScore;
          const currentScore = card.getAttribute('data-score') || originalScore;
          card.classList.remove('dragging');
          dragId = null;
          dragScore = null;
          if (!currentId || !dragChanged) return;
          try {
            await saveVisibleTierOrders(container, [Number(originalScore), Number(currentScore)]);
            setStatus(Number(originalScore) === Number(currentScore) ? 'Порядок в тире сохранён ✓' : 'Карточка перенесена в допустимый тир ✓');
          } catch (err) {
            console.error(err);
            setStatus('Не удалось сохранить порядок тир-листа.', true);
          }
        });
      });
      container.querySelectorAll('[data-tier-drop]').forEach(zone => {
        zone.addEventListener('dragover', (e) => {
          const targetScore = Number(zone.getAttribute('data-score'));
          if (!dragId || !canDropTierCardToScore(dragId, targetScore)) return;
          e.preventDefault();
          zone.classList.add('drag-over');
          const after = getDragAfterElement(zone, e.clientX, e.clientY);
          const dragged = Array.from(container.querySelectorAll('[data-tier-card]')).find(el => el.getAttribute('data-id') === dragId);
          if (!dragged) return;
          const beforeParent = dragged.parentElement;
          const beforeNext = dragged.nextElementSibling;
          if (after == null) zone.appendChild(dragged);
          else zone.insertBefore(dragged, after);
          if (beforeParent !== dragged.parentElement || beforeNext !== dragged.nextElementSibling) dragChanged = true;
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', async (e) => {
          const dropScore = Number(zone.getAttribute('data-score'));
          if (!dragId || !canDropTierCardToScore(dragId, dropScore)) return;
          e.preventDefault();
          zone.classList.remove('drag-over');
          const droppedId = dragId;
          const oldScore = Number(dragScore);
          try {
            await saveTierPlacement(myName, tierSelection.type, tierSelection.year, tierSelection.season, droppedId, dropScore);
            const moved = Array.from(container.querySelectorAll('[data-tier-card]')).find(el => el.getAttribute('data-id') === droppedId);
            if (moved) moved.setAttribute('data-score', String(dropScore));
            await saveVisibleTierOrders(container, [oldScore, dropScore]);
            dragChanged = false;
            setStatus(oldScore === dropScore ? 'Порядок в тире сохранён ✓' : 'Карточка перенесена в допустимый тир ✓');
          } catch (err) {
            console.error(err);
            setStatus('Не удалось сохранить порядок тир-листа.', true);
          }
        });
      });
    }

    function getDragAfterElement(container, x, y) {
      const elements = [...container.querySelectorAll('[data-tier-card]:not(.dragging)')];
      for (const child of elements) {
        const box = child.getBoundingClientRect();
        const midY = box.top + box.height / 2;
        const midX = box.left + box.width / 2;
        if (y < midY && x < box.right) return child;
        if (y < box.bottom && x < midX) return child;
      }
      return null;
    }

    function publicEntryAvg(entry) {
      return avg(entry.scores, MIN_PUBLIC_VOTES);
    }

    function songStatsGroupRows(list, getKeys) {
      const groups = {};
      list.forEach(e => {
        const score = avgAny(e.songScores || {});
        if (score === null) return;
        getKeys(e).forEach(key => {
          if (!key) return;
          if (!groups[key]) groups[key] = [];
          groups[key].push(score);
        });
      });
      return Object.entries(groups)
        .map(([key, vals]) => ({ key, count: vals.length, mean: vals.reduce((a, b) => a + b, 0) / vals.length }))
        .filter(row => row.count >= MIN_PUBLIC_VOTES)
        .sort((a, b) => b.mean - a.mean || b.count - a.count || a.key.localeCompare(b.key, 'ru'))
        .slice(0, 50);
    }

    function statsGroupRows(list, getKeys) {
      const groups = {};
      list.forEach(e => {
        const score = publicEntryAvg(e);
        if (score === null) return;
        getKeys(e).forEach(key => {
          if (!key) return;
          if (!groups[key]) groups[key] = [];
          groups[key].push(score);
        });
      });
      return Object.entries(groups)
        .map(([key, vals]) => ({ key, count: vals.length, mean: vals.reduce((a, b) => a + b, 0) / vals.length }))
        .filter(row => row.count >= MIN_PUBLIC_VOTES)
        .sort((a, b) => b.mean - a.mean || b.count - a.count || a.key.localeCompare(b.key, 'ru'))
        .slice(0, 50);
    }

    function renderStatsTable(selector, rows) {
      const el = $(selector);
      if (!el) return;
      if (!rows.length) {
        el.innerHTML = '<div class="oc-empty">Пока нет данных: нужно минимум 3 трека с публичной средней оценкой.</div>';
        return;
      }
      el.innerHTML = rows.map((row, idx) => `<div class="oc-stats-row">
        <div class="oc-stats-rank">${idx + 1}</div>
        <div class="oc-stats-name" title="${escapeHtml(row.key)}">${escapeHtml(row.key)}</div>
        <div class="oc-stats-score">${formatScore(row.mean)}</div>
        <div class="oc-stats-count">${row.count} трек.</div>
      </div>`).join('');
    }

    function renderStatsPage() {
      const base = entries.filter(e => !statsTypeFilter || e.type === statsTypeFilter);
      renderStatsTable('#oc-stats-performers', statsGroupRows(base, e => e.performers || []));
      renderStatsTable('#oc-stats-song-performers', songStatsGroupRows(base, e => e.performers || []));
      renderStatsTable('#oc-stats-studios', statsGroupRows(base, e => e.studios || []));
      renderStatsTable('#oc-stats-directors', statsGroupRows(base, e => e.directors || []));
      renderStatsTable('#oc-stats-seasons', statsGroupRows(base, e => (e.year && e.season) ? [`${SEASON_LABEL[e.season]} ${e.year}`] : []));
      renderStatsTable('#oc-stats-franchises', statsGroupRows(base, e => e.franchises || []));
    }

    function openingModalInputBounds() {
      return {
        min: ratingScale === 'half' ? 0.5 : 1,
        max: 10,
        step: ratingScale === 'half' ? 0.5 : 1
      };
    }

    function clampOpeningModalScore(value) {
      const raw = String(value ?? '').trim();
      if (!raw) return null;
      const num = Number(raw);
      if (!Number.isFinite(num)) return null;
      const bounds = openingModalInputBounds();
      return Math.max(bounds.min, Math.min(bounds.max, Number(num.toFixed(1))));
    }

    function openCardModal(id) {
      if (!requireAccount('Войди в аккаунт, чтобы открыть карточку и выставлять оценки.')) return;
      const entry = entriesById.get(String(id));
      if (!entry || !openingModal) return;
      const score = avg(entry.scores);
      const adminScore = adminAvg(entry.scores);
      const adminCount = adminRatingCount(entry.scores);
      const avgSong = avgAny(entry.songScores || {});
      const avgVisual = avgAny(entry.visualScores || {});
      const votes = Object.entries(entry.scores || {}).sort((a,b)=> Number(b[1]) - Number(a[1]));
      const arrayValue = (arr) => escapeHtml((arr || []).filter(Boolean).join(', ') || '—');
      const scoreRows = [
        `<div class="oc-detail-box"><div class="oc-detail-label">общая средняя</div><div class="oc-detail-value">${formatScore(score)} · ${ratingCount(entry.scores)}/${MIN_PUBLIC_VOTES}+ оценок</div></div>`,
        isAdmin() ? `<div class="oc-detail-box"><div class="oc-detail-label">средняя админов</div><div class="oc-detail-value">${formatScore(adminScore)} · ${adminCount} оценок</div></div>` : '',
        avgSong !== null ? `<div class="oc-detail-box"><div class="oc-detail-label">песня</div><div class="oc-detail-value">${formatScore(avgSong)} · ${ratingCount(entry.songScores)}</div></div>` : '',
        avgVisual !== null ? `<div class="oc-detail-box"><div class="oc-detail-label">визуал</div><div class="oc-detail-value">${formatScore(avgVisual)} · ${ratingCount(entry.visualScores)}</div></div>` : ''
      ].filter(Boolean).join('');
      const detailRows = `
        <div class="oc-detail-box"><div class="oc-detail-label">тип</div><div class="oc-detail-value">${escapeHtml(entry.type || '—')}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">год</div><div class="oc-detail-value">${escapeHtml(entry.year || '—')}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">сезон</div><div class="oc-detail-value">${entry.season ? escapeHtml(SEASON_LABEL[entry.season]) : '—'}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">студии</div><div class="oc-detail-value">${arrayValue(entry.studios)}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">режиссёры</div><div class="oc-detail-value">${arrayValue(entry.directors)}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">исполнители</div><div class="oc-detail-value">${arrayValue(entry.performers)}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">франшизы</div><div class="oc-detail-value">${arrayValue(entry.franchises)}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">альт. названия</div><div class="oc-detail-value">${arrayValue(entry.alternativeTitles)}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">оценок</div><div class="oc-detail-value">${ratingCount(entry.scores)} общих${ratingCount(entry.songScores) ? ' · ' + ratingCount(entry.songScores) + ' песня' : ''}${ratingCount(entry.visualScores) ? ' · ' + ratingCount(entry.visualScores) + ' визуал' : ''}</div></div>
      `;
      const imageHtml = renderOpeningVideoBlock(entry);
      const progressText = `карточка · ${entry.type || 'OP'}${entry.year ? ' · ' + entry.year : ''}${entry.season ? ' · ' + SEASON_LABEL[entry.season] : ''}`;
      const bounds = openingModalInputBounds();
      const myPublicScore = scoreFor(entry, myName);
      const mySongScore = songScoreFor(entry, myName);
      const myVisualScore = visualScoreFor(entry, myName);
      const savedScore = myPublicScore !== null ? clampOpeningModalScore(myPublicScore) : 5;
      const hasAnyMyRating = myPublicScore !== null || mySongScore !== null || myVisualScore !== null;
      openingModal.classList.remove('hidden');
      openingModal.innerHTML = `<div class="oc-eval-modal oc-opening-detail-modal">
        <div class="oc-eval-top">
          <div class="oc-opening-title-block">
            <div class="oc-eval-progress">${escapeHtml(progressText)}</div>
            <div class="oc-opening-title-row">
              <div class="oc-eval-title">${escapeHtml(entry.title)} ${!entry.link ? '<span class="oc-missing-link" title="Ссылка не добавлена">😡</span>' : ''}</div>
              <button type="button" class="oc-opening-info-toggle" data-opening-info-toggle="1" aria-expanded="false" title="Показать описание">⌄</button>
            </div>
          </div>
          <button type="button" class="oc-eval-close" data-modal-close="1">Закрыть</button>
        </div>
        <div class="oc-opening-info-panel hidden" data-opening-info-panel="1">
          <div class="oc-section-label">описание</div>
          <div class="oc-detail-grid">${detailRows}</div>
          ${entry.notes ? `<div class="oc-notes" style="margin-top:12px;">${escapeHtml(entry.notes)}</div>` : ''}
        </div>
        ${imageHtml}
        <div class="oc-opening-rate-panel">
          <div class="oc-section-label">твоя оценка</div>
          <div class="oc-eval-grid">
            <label>Общая оценка
              <input id="oc-card-range" type="range" min="${bounds.min}" max="${bounds.max}" step="${bounds.step}" value="${savedScore}" />
              <div class="oc-score-word" id="oc-card-word">${escapeHtml(formatScore(savedScore))}</div>
            </label>
            <label>Итог
              <input id="oc-card-score" type="number" min="${bounds.min}" max="${bounds.max}" step="${bounds.step}" value="${savedScore}" />
            </label>
            <div class="oc-eval-parts">
              <label>Песня <span class="oc-muted-inline">необяз.</span>
                <input id="oc-card-song-score" type="number" min="${bounds.min}" max="${bounds.max}" step="${bounds.step}" value="${mySongScore !== null ? formatScore(mySongScore) : ''}" placeholder="—" />
              </label>
              <label>Визуал <span class="oc-muted-inline">необяз.</span>
                <input id="oc-card-visual-score" type="number" min="${bounds.min}" max="${bounds.max}" step="${bounds.step}" value="${myVisualScore !== null ? formatScore(myVisualScore) : ''}" placeholder="—" />
              </label>
            </div>
          </div>
          <div class="oc-opening-rate-actions">
            ${hasAnyMyRating ? `<button type="button" class="oc-secondary-btn" data-card-action="delete-rating">Удалить оценку</button>` : ''}
            <button type="button" class="oc-addbtn" data-card-action="save-rating">Сохранить оценку</button>
          </div>
        </div>
        <div class="oc-opening-score-strip">
          <div class="oc-detail-grid">${scoreRows || '<div class="oc-detail-box"><div class="oc-detail-label">средняя</div><div class="oc-detail-value">—</div></div>'}</div>
        </div>
        <div class="oc-opening-user-votes">
          <div class="oc-section-label" style="margin-bottom:8px;">оценки пользователей</div>
          <div class="oc-votes">${votes.length ? votes.map(([voter, val]) => `<span class="oc-chip${voter === myName ? ' mine' : ''}">${avatarFor(voter)} ${escapeHtml(voter)}: ${formatScore(val)}${songScoreFor(entry, voter) !== null ? ' · песня ' + formatScore(songScoreFor(entry, voter)) : ''}${visualScoreFor(entry, voter) !== null ? ' · визуал ' + formatScore(visualScoreFor(entry, voter)) : ''}</span>`).join('') : '<span class="oc-chip">оценок пока нет</span>'}</div>
        </div>
      </div>`;

      bindOpeningVideoEmbed();
      const range = $('#oc-card-range');
      const scoreInput = $('#oc-card-score');
      const word = $('#oc-card-word');
      const updateWord = (val) => { if (word) word.textContent = formatScore(val); };
      if (range && scoreInput) {
        range.addEventListener('input', () => { scoreInput.value = range.value; updateWord(range.value); });
        scoreInput.addEventListener('input', () => {
          const val = clampOpeningModalScore(scoreInput.value);
          if (val !== null) { range.value = String(val); updateWord(val); }
        });
      }
      const saveBtn = openingModal.querySelector('[data-card-action="save-rating"]');
      if (saveBtn) saveBtn.addEventListener('click', () => saveCardModalRating(entry.id));
      const deleteBtn = openingModal.querySelector('[data-card-action="delete-rating"]');
      if (deleteBtn) deleteBtn.addEventListener('click', async () => {
        if (!ensureNickname()) return;
        if (!window.confirm('Удалить твою общую оценку, песню и визуал?')) return;
        await deleteCurrentRating(entry.id, myName, 'public');
        openCardModal(entry.id);
      });
    }

    async function saveCardModalRating(id) {
      const entry = entriesById.get(String(id));
      if (!entry || !openingModal) return;
      if (!ensureNickname()) return;
      const scoreInput = $('#oc-card-score');
      const songInput = $('#oc-card-song-score');
      const visualInput = $('#oc-card-visual-score');
      const score = clampOpeningModalScore(scoreInput ? scoreInput.value : '');
      const rawSong = songInput ? String(songInput.value || '').trim() : '';
      const rawVisual = visualInput ? String(visualInput.value || '').trim() : '';
      const songScore = rawSong ? clampOpeningModalScore(rawSong) : null;
      const visualScore = rawVisual ? clampOpeningModalScore(rawVisual) : null;
      const bounds = openingModalInputBounds();
      if (score === null) { setStatus(`Введите общую оценку от ${formatScore(bounds.min)} до ${formatScore(bounds.max)}.`, true); return; }
      if (rawSong && songScore === null) { setStatus(`Введите оценку песни от ${formatScore(bounds.min)} до ${formatScore(bounds.max)} или оставьте поле пустым.`, true); return; }
      if (rawVisual && visualScore === null) { setStatus(`Введите оценку визуала от ${formatScore(bounds.min)} до ${formatScore(bounds.max)} или оставьте поле пустым.`, true); return; }
      try {
        entry.scores = entry.scores || {};
        entry.songScores = entry.songScores || {};
        entry.visualScores = entry.visualScores || {};
        entry.scores[myName] = score;
        if (songScore === null) delete entry.songScores[myName];
        else entry.songScores[myName] = songScore;
        if (visualScore === null) delete entry.visualScores[myName];
        else entry.visualScores[myName] = visualScore;
        if (window.OPED_DB && typeof window.OPED_DB.saveRating === 'function') {
          await window.OPED_DB.saveRating(entry.id, myName, score);
        }
        await saveRatingExtras(entry.id, myName, { score, songScore, visualScore });
        appendManualOrderIfMissing(myName, entry.type, entry.id);
        touchEntryCache(entry);
        markRatingDataChanged();
        render();
        renderSeasonViews();
        if (activeTab === 'profile') renderProfile();
        if (activeTab === 'tier') renderTierList();
        if (activeTab === 'stats') renderStatsPage();
        if (activeTab === 'top100') renderGlobalTop100();
        closeCardModal();
        setStatus('Оценка сохранена ✓');
      } catch (err) {
        console.error(err);
        setStatus('Не удалось сохранить оценку.', true);
      }
    }

    function closeCardModal() {
      if (!openingModal) return;
      openingModal.classList.add('hidden');
      openingModal.innerHTML = '';
    }

    function render() {
      populateProfileUsers();
      renderHomeTestShowcase();
      const filtered = applyFilters(entries);
      const sorted = applySort(filtered);
      chartPage = clampPage(chartPage, sorted.length);
      const page = pageSlice(sorted, chartPage);
      resultCountEl.textContent = sorted.length
        ? `Показано: ${page.start + 1}–${Math.min(sorted.length, page.start + PAGE_SIZE)} из ${sorted.length} / всего ${entries.length}`
        : `Показано: 0 из ${entries.length}`;
      renderFilterStat(filtered);

      if (!entries.length) {
        listContainer.innerHTML = '<div class="oc-empty">Пока пусто. Добавьте первый опенинг или эндинг выше ☝</div>';
        return;
      }
      if (!sorted.length) {
        listContainer.innerHTML = '<div class="oc-empty">Ничего не найдено по этим фильтрам.</div>';
        return;
      }

      const html = page.items.map((entry, idx) => {
        const absoluteIdx = page.start + idx;
        if (entry.id === editingId) return renderEditCard(entry);
        const score = avg(entry.scores);
        const scoreText = visibleAverageMarkup(entry, score);
        const showRank = sortMode === 'score';
        const rankClass = showRank && absoluteIdx === 0 ? 'gold' : showRank && absoluteIdx === 1 ? 'silver' : showRank && absoluteIdx === 2 ? 'bronze' : '';
        const rankLabel = showRank ? (absoluteIdx < 3 ? ['①','②','③'][absoluteIdx] : (absoluteIdx + 1)) : (absoluteIdx + 1);
        const chips = Object.entries(entry.scores || {}).map(([voter, val]) => {
          const mine = voter === myName ? ' mine' : '';
          return `<span class="oc-chip${mine}">${avatarFor(voter)} ${escapeHtml(voter)}: ${formatScore(val)}</span>`;
        }).join('');
        const myPublicScore = scoreFor(entry, myName);
        const myPersonalScore = personalScoreFor(entry, myName);
        const myVal = isPersonalScale() ? (myPersonalScore || defaultScore()) : (myPublicScore || defaultScore());
        const extraBits = [];
        if (ratingCount(entry.scores) > 0 && ratingCount(entry.scores) < MIN_PUBLIC_VOTES) extraBits.push(`<div class="oc-song-small">средняя появится после ${MIN_PUBLIC_VOTES} оценок · сейчас ${ratingCount(entry.scores)}/${MIN_PUBLIC_VOTES}</div>`);
        if (myPersonalScore !== null) extraBits.push(`<div class="oc-song-small">твоя оценка: ${escapeHtml(formatFiveScore(myPersonalScore))}</div>`);
        const controlsHtml = `
          <div class="oc-rate-row">
            <input type="range" min="${ratingMin()}" max="${ratingMax()}" step="${scaleStep()}" value="${myVal}" class="oc-slider" data-id="${entry.id}" />
            <span class="oc-rate-val">${escapeHtml(formatInputScore(myVal))}</span>
          </div>
          <button class="oc-rate-btn" data-action="rate" data-id="${entry.id}">Оценить</button>
          <button class="oc-open-btn" data-action="open-card" data-id="${entry.id}">Карточка</button>
          ${(isPersonalScale() ? myPersonalScore !== null : myPublicScore !== null) ? `<button class="oc-secondary-btn" data-action="delete-rating" data-id="${entry.id}">${isPersonalScale() ? 'удалить отметку' : 'удалить оценку'}</button>` : ''}
          ${isAdmin() ? `<button class="oc-edit-btn" data-action="edit" data-id="${entry.id}">✎ редактировать</button>
          <button class="oc-del" data-action="delete" data-id="${entry.id}">удалить трек</button>` : ''}`;
        return renderUnifiedEntryCard(entry, {
          rankLabel,
          rankClass,
          scoreText,
          scoreSub: 'средняя',
          fields: ['studios', 'directors', 'performers', 'franchises'],
          showImageLink: true,
          showTrackLink: true,
          notes: true,
          extraHtml: extraBits.join(''),
          votesHtml: `<div class="oc-votes">${chips}</div>`,
          controlsHtml,
          className: 'main-card'
        });
      }).join('');

      const pager = paginationHtml('chart', chartPage, sorted.length);
      listContainer.innerHTML = `${pager}<div class="oc-list">${html}</div>${pager}`;
      bindPagination(listContainer, 'chart', () => chartPage, v => { chartPage = clampPage(v, sorted.length); }, render);

      listContainer.querySelectorAll('.oc-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          e.target.parentElement.querySelector('.oc-rate-val').textContent = formatInputScore(val);
        });
      });

      listContainer.querySelectorAll('[data-action="rate"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (!ensureNickname()) return;
          const id = e.target.getAttribute('data-id');
          const slider = listContainer.querySelector(`.oc-slider[data-id="${id}"]`);
          const val = clampScore(slider.value);
          const entry = entriesById.get(String(id));
          if (!entry || val === null) return;
          try {
            if (isPersonalScale()) {
              entry.personalScores = entry.personalScores || {};
              entry.personalScores[myName] = val;
              await saveRatingExtras(entry.id, myName, { personalScore: val });
            } else {
              entry.scores = entry.scores || {};
              entry.scores[myName] = val;
              await window.OPED_DB.saveRating(entry.id, myName, val);
              await saveRatingExtras(entry.id, myName, { score: val });
              appendManualOrderIfMissing(myName, entry.type, entry.id);
            }
            touchEntryCache(entry);
            markRatingDataChanged();
            render();
            setStatus('Оценка сохранена ✓');
          } catch (err) {
            console.error(err);
            setStatus('Не удалось сохранить оценку.', true);
          }
        });
      });

      listContainer.querySelectorAll('[data-action="delete-rating"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (!ensureNickname()) return;
          const id = e.target.getAttribute('data-id');
          if (!window.confirm(isPersonalScale() ? 'Удалить твою отметку 1–5?' : 'Удалить твою оценку?')) return;
          await deleteCurrentRating(id, myName, isPersonalScale() ? 'personal' : 'public');
        });
      });

      listContainer.querySelectorAll('[data-action="open-card"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openCardModal(btn.getAttribute('data-id'));
        });
      });

      listContainer.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          if (!ensureAdmin()) return;
          editingId = e.target.getAttribute('data-id');
          render();
        });
      });

      listContainer.querySelectorAll('[data-action="cancel-edit"]').forEach(btn => {
        btn.addEventListener('click', () => {
          editingId = null;
          render();
        });
      });

      listContainer.querySelectorAll('[data-action="save-edit"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (!ensureAdmin()) return;
          const id = e.target.getAttribute('data-id');
          const card = listContainer.querySelector(`.oc-editcard[data-id="${id}"]`);
          const entry = entriesById.get(String(id));
          if (!card || !entry) return;
          const title = card.querySelector('.oc-e-title').value.trim();
          if (!title) { setStatus('Название не может быть пустым.', true); return; }
          const newType = card.querySelector('.oc-e-type').value;
          if (isDuplicateTitle(title, newType, id)) { setStatus(`Такой ${newType} уже есть. Одинаковые названия запрещены отдельно внутри OP и ED.`, true); return; }
          const previousImage = String(entry.image || '').trim();
          const previousFallbackImage = String(entry.fallbackImage || '').trim();
          const nextImage = card.querySelector('.oc-e-image').value.trim();
          const imageChanged = nextImage !== previousImage;
          let createdFallbackImage = '';
          let openingSaved = false;

          const updatedEntry = {
            ...entry,
            title,
            type: newType,
            year: (() => {
              const yearRaw = card.querySelector('.oc-e-year').value.trim();
              return yearRaw ? parseInt(yearRaw, 10) : null;
            })(),
            season: card.querySelector('.oc-e-season').value,
            studios: parseList(card.querySelector('.oc-e-studio').value),
            directors: parseList(card.querySelector('.oc-e-director').value),
            performers: parseList(card.querySelector('.oc-e-performer').value),
            franchises: uniqueFranchiseList(cleanFranchiseList(card.querySelector('.oc-e-franchise').value)),
            ...sameSongFields(card.querySelector('.oc-e-same-song')?.value),
            image: nextImage,
            fallbackImage: card.querySelector('.oc-e-fallback-image').value.trim(),
            link: card.querySelector('.oc-e-link').value.trim(),
            notes: card.querySelector('.oc-e-notes').value.trim(),
            alternativeTitles: alternativeTitlesForSave(title, card.querySelector('.oc-e-alt-titles') ? card.querySelector('.oc-e-alt-titles').value : ''),
            isChinese: Boolean(card.querySelector('.oc-e-chinese') && card.querySelector('.oc-e-chinese').checked),
            isMovie: Boolean(card.querySelector('.oc-e-movie') && card.querySelector('.oc-e-movie').checked),
            isShortened: Boolean(card.querySelector('.oc-e-shortened') && card.querySelector('.oc-e-shortened').checked)
          };

          try {
            if (imageChanged) {
              if (nextImage) {
                createdFallbackImage = await createFallbackImageCopy(nextImage, title, newType);
                updatedEntry.fallbackImage = createdFallbackImage;
              } else {
                updatedEntry.fallbackImage = '';
              }
            }

            await window.OPED_DB.updateOpening(id, updatedEntry);
            openingSaved = true;
            await saveOpeningExtras(id, { franchises: updatedEntry.franchises, alternativeTitles: updatedEntry.alternativeTitles, isChinese: updatedEntry.isChinese, isMovie: updatedEntry.isMovie, isShortened: updatedEntry.isShortened, sameSongGroupId: updatedEntry.sameSongGroupId, sameSongTitle: updatedEntry.sameSongTitle });

            Object.assign(entry, updatedEntry);
            touchEntryCache(entry);
            editingId = null;
            populateFilterOptions();
            render();

            if (imageChanged && previousFallbackImage && previousFallbackImage !== updatedEntry.fallbackImage) {
              try {
                await deleteFallbackImageCopy(previousFallbackImage);
                setStatus('Изменения сохранены, старая резервная картинка удалена ✓');
              } catch (deleteError) {
                console.error('Old fallback image deletion failed', deleteError);
                setStatus('Изменения сохранены, но старую картинку удалить не удалось: ' + (deleteError.message || deleteError), true);
              }
            } else {
              setStatus('Изменения сохранены ✓');
            }
          } catch (err) {
            console.error(err);
            if (!openingSaved && createdFallbackImage && createdFallbackImage !== previousFallbackImage) {
              try { await deleteFallbackImageCopy(createdFallbackImage); } catch (cleanupError) { console.error('New fallback cleanup failed', cleanupError); }
            }
            setStatus('Не удалось сохранить изменения: ' + (err.message || err), true);
          }
        });
      });

      listContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (!ensureAdmin()) return;
          const target = e.target;
          const id = target.getAttribute('data-id');
          if (target.getAttribute('data-confirm') !== '1') {
            target.setAttribute('data-confirm', '1');
            target.textContent = 'точно удалить?';
            target.style.color = '#FF2E63';
            if (target._resetTimer) clearTimeout(target._resetTimer);
            target._resetTimer = setTimeout(() => {
              target.setAttribute('data-confirm', '0');
              target.textContent = 'удалить трек';
              target.style.color = '';
            }, 3000);
            return;
          }
          const entryToDelete = entriesById.get(String(id));
          const fallbackToDelete = String(entryToDelete && entryToDelete.fallbackImage || '').trim();
          try {
            await window.OPED_DB.deleteOpening(id);
            entries = entries.filter(x => x.id !== id);
            populateFilterOptions();
            render();

            if (fallbackToDelete) {
              try {
                const removed = await deleteFallbackImageCopy(fallbackToDelete);
                setStatus(removed
                  ? 'Трек и резервная картинка удалены ✓'
                  : 'Трек удалён. Резервная ссылка была внешней, файл не удалялся.');
              } catch (deleteError) {
                console.error('Deleted track fallback cleanup failed', deleteError);
                setStatus('Трек удалён, но резервную картинку удалить не удалось: ' + (deleteError.message || deleteError), true);
              }
            } else {
              setStatus('Удалено ✓');
            }
          } catch (err) {
            console.error(err);
            setStatus('Не удалось удалить.', true);
          }
        });
      });
      renderSeasonViews();
      if (activeTab === 'profile') renderProfile();
      if (activeTab === 'tier') renderTierList();
      if (activeTab === 'stats') renderStatsPage();
      if (activeTab === 'top100') renderGlobalTop100();
    }


    document.querySelectorAll('.oc-tab-btn').forEach(btn => {
      btn.addEventListener('click', event => {
        const tab = btn.dataset.tab;
        if ((!tab || tab !== 'chart') && !accessLevel) {
          event.preventDefault();
          showAuthModal('Войди в аккаунт, чтобы открыть этот раздел.');
          return;
        }
        if (tab) {
          if (tab === 'chart') homeTestMode = 0;
          switchTab(tab);
        }
      });
    });

    document.querySelectorAll('[data-home-test]').forEach(button => {
      button.addEventListener('click', () => setHomeTestMode(button.dataset.homeTest));
    });

    seasonYearsEl.addEventListener('click', (e) => {
      const rateBtn = e.target.closest('[data-season-rate]');
      if (rateBtn && !rateBtn.disabled) {
        selectedSeason = {
          year: Number(rateBtn.getAttribute('data-year')),
          season: rateBtn.getAttribute('data-season')
        };
        expandedYear = selectedSeason.year;
        renderSeasonViews();
        startSeasonRating();
        return;
      }

      const yearBtn = e.target.closest('[data-season-year]');
      if (yearBtn) {
        const year = Number(yearBtn.getAttribute('data-season-year'));
        expandedYear = expandedYear === year ? null : year;
        renderSeasonViews();
        return;
      }

      const seasonBtn = e.target.closest('[data-season-select]');
      if (seasonBtn && !seasonBtn.disabled) {
        selectedSeason = {
          year: Number(seasonBtn.getAttribute('data-year')),
          season: seasonBtn.getAttribute('data-season')
        };
        expandedYear = selectedSeason.year;
        renderSeasonViews();
      }
    });

    seasonRateBtn.addEventListener('click', () => startSeasonRating(false));
    if (seasonRateAllBtn) seasonRateAllBtn.addEventListener('click', () => startSeasonRating(true));
    if (seasonPrevBtn) seasonPrevBtn.addEventListener('click', goToPreviousSeason);

    document.querySelectorAll('[data-season-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        seasonType = btn.dataset.seasonType === 'ED' ? 'ED' : 'OP';
        renderSeasonViews();
      });
    });

    if (seasonTierBtn) {
      seasonTierBtn.addEventListener('click', () => {
        if (!selectedSeason) return;
        tierSelection = { type: seasonType, year: selectedSeason.year, season: selectedSeason.season };
        switchTab('tier');
      });
    }

    seasonListEl.addEventListener('click', (e) => {
      const open = e.target.closest('[data-action="open-card"]');
      if (open) { openCardModal(open.getAttribute('data-id')); return; }
      const basketBtn = e.target.closest('[data-basket-add]');
      if (basketBtn) {
        const entry = entriesById.get(String(basketBtn.getAttribute('data-basket-add')));
        addEntryToEventBasket(entry);
        return;
      }
      const btn = e.target.closest('[data-op-rate]');
      if (!btn) return;
      startOpeningRating(btn.getAttribute('data-op-rate'));
    });

    evaluatorEl.addEventListener('click', async (e) => {
      const action = e.target.getAttribute('data-eval-action');
      if (!action) return;
      if (action === 'close') closeEvaluator();
      if (action === 'skip') {
        if (evaluatorMode === 'single') closeEvaluator();
        else { seasonQueueIndex += 1; renderEvaluator(); }
      }
      if (action === 'delete-current') {
        const entry = seasonQueue[seasonQueueIndex];
        if (entry && window.confirm(isPersonalScale() ? 'Удалить твою отметку 1–5?' : 'Удалить твою оценку?')) {
          await deleteCurrentRating(entry.id, myName, isPersonalScale() ? 'personal' : 'public');
          if (evaluatorMode === 'single') closeEvaluator();
          else { seasonQueueIndex += 1; renderEvaluator(); }
        }
      }
      if (action === 'save-next') await saveEvaluatorScore();
    });

    nameInput.addEventListener('focus', () => { if (!requireAccount('Войди в аккаунт, чтобы выбрать ник.')) { nameInput.blur(); return; } nameInput.dataset.accountBeforeEdit = myName || ''; });
    nameInput.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      if (!val || normalizedAccountName(val) === normalizedAccountName(myName)) {
        nameInput.value = myName || '';
        return;
      }
      showNameModal('Для переключения аккаунта подтверди вход.', val);
    });

    modalNameSave.addEventListener('click', () => commitNickname(modalNameInput.value));
    if (modalNameClose) modalNameClose.addEventListener('click', hideNameModal);
    modalNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitNickname(modalNameInput.value);
      }
    });
    if (modalAccountPass) modalAccountPass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitNickname(modalNameInput.value);
      }
    });
    if (forgotPasswordBtn) forgotPasswordBtn.addEventListener('click', async () => {
      if (!PERSONAL_ACCOUNT_AUTH_ENABLED) {
        modalNameError.textContent = PERSONAL_ACCOUNT_DISABLED_MESSAGE;
        return;
      }
      const email = String(modalAccountEmail?.value || '').trim();
      if (!email) { modalNameError.textContent = 'Сначала введи email аккаунта.'; return; }
      try {
        await window.OPED_DB.resetAccountPassword(email);
        modalNameError.textContent = 'Письмо для восстановления отправлено ✓';
      } catch (error) {
        modalNameError.textContent = 'Не удалось отправить письмо: ' + (error?.message || error);
      }
    });

    avatarPicker.innerHTML = AVATAR_OPTIONS.map(em => `<button type="button" data-emoji="${em}">${em}</button>`).join('')
      + `<div class="oc-avatar-custom">
          <input type="text" id="oc-avatar-custom-input" placeholder="свой эмодзи (📱 клавиатура эмодзи)" maxlength="8" />
          <button type="button" id="oc-avatar-custom-btn">OK</button>
        </div>`;

    avatarBtn.addEventListener('click', (e) => { e.stopPropagation(); if (!requireAccount('Войди в аккаунт, чтобы изменить аватар.')) return; avatarPicker.classList.toggle('hidden'); });
    if (dailyBell) dailyBell.addEventListener('click', () => {
      if (!requireAccount('Войди в аккаунт, чтобы открыть ежедневную оценку.')) return;
      const state = dailyCurrentState(myName);
      if (state.settings.enabled && state.available && !state.done) startDailyRating().catch(error => { console.error(error); setStatus('Не удалось открыть дейлик.', true); });
      else { switchTab('profile'); renderDailyProfilePanel(); }
    });

    avatarPicker.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-emoji]');
      if (!btn) return;
      avatarPicker.classList.add('hidden');
      await saveAvatar(btn.getAttribute('data-emoji'));
      setStatus('Аватарка обновлена ✓');
    });

    async function applyCustomAvatar() {
      const input = $('#oc-avatar-custom-input');
      const val = input.value.trim();
      if (!val) return;
      avatarPicker.classList.add('hidden');
      input.value = '';
      await saveAvatar(val);
      setStatus('Аватарка обновлена ✓');
    }

    avatarPicker.addEventListener('click', (e) => { if (e.target.id === 'oc-avatar-custom-btn') applyCustomAvatar(); });
    avatarPicker.addEventListener('keydown', (e) => {
      if (e.target.id === 'oc-avatar-custom-input' && e.key === 'Enter') {
        e.preventDefault();
        applyCustomAvatar();
      }
    });
    avatarPicker.addEventListener('click', (e) => { if (e.target.id === 'oc-avatar-custom-input') e.stopPropagation(); });
    document.addEventListener('click', (e) => {
      if (!avatarPicker.contains(e.target) && e.target !== avatarBtn) avatarPicker.classList.add('hidden');
    });


    try { localStorage.removeItem('op-ed-anisong-import-tabs-v1'); } catch (_) {}



    if (franchiseRepairBtn) franchiseRepairBtn.addEventListener('click', repairBrokenFranchises);
    if (franchiseRepairModal) {
      franchiseRepairModal.addEventListener('click', (e) => {
        if (e.target === franchiseRepairModal || e.target.closest('[data-franchise-repair-close]')) {
          closeFranchiseRepairModal();
          return;
        }
        const selectAll = e.target.closest('[data-franchise-repair-select-all]');
        if (selectAll) {
          franchiseRepairModal.querySelectorAll('.oc-franchise-repair-check').forEach(box => { box.checked = selectAll.checked; });
          return;
        }
        if (e.target.closest('[data-franchise-repair-apply]')) applyFranchiseRepairsFromModal();
      });
    }


    function getImageUploadSecret() {
      let secret = '';
      try {
        localStorage.removeItem(IMAGE_UPLOAD_SECRET_KEY);
        secret = sessionStorage.getItem(IMAGE_UPLOAD_SECRET_KEY) || '';
      } catch (_) {}
      if (!secret) {
        secret = String(window.prompt('Введите UPLOAD_SECRET из Cloudflare. Он сохранится только до закрытия вкладки.') || '').trim();
        if (secret) {
          try { sessionStorage.setItem(IMAGE_UPLOAD_SECRET_KEY, secret); } catch (_) {}
        }
      }
      return secret;
    }

    function forgetImageUploadSecret() {
      try { localStorage.removeItem(IMAGE_UPLOAD_SECRET_KEY); } catch (_) {}
      try { sessionStorage.removeItem(IMAGE_UPLOAD_SECRET_KEY); } catch (_) {}
      imageMigrationStatus('Сохранённый пароль удалён с этого устройства.');
    }

    function compactImageFileName(title, type, source) {
      const base = String(title || '').toLowerCase().normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '').slice(0, 64) || 'track';
      let hash = 2166136261;
      const value = [title, type, source].join('|');
      for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return 'images/' + base + '-' + type.toLowerCase() + '-' + (hash >>> 0).toString(36) + '.webp';
    }

    async function workerImageRequest(path, secret, body, responseType) {
      const response = await fetch(IMAGE_UPLOAD_WORKER + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Upload-Secret': secret },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        let message = 'HTTP ' + response.status;
        try { const data = await response.json(); message = data.error || message; } catch (_) {}
        if (response.status === 401) {
          try { localStorage.removeItem(IMAGE_UPLOAD_SECRET_KEY); } catch (_) {}
          try { sessionStorage.removeItem(IMAGE_UPLOAD_SECRET_KEY); } catch (_) {}
        }
        throw new Error(message);
      }
      return responseType === 'blob' ? response.blob() : response.json();
    }

    function canvasToWebp(canvas, quality) {
      return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (!blob || blob.type !== 'image/webp') reject(new Error('Браузер не смог сжать картинку в WebP'));
          else resolve(blob);
        }, 'image/webp', quality);
      });
    }

    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = () => reject(new Error('Не удалось прочитать сжатую картинку'));
        reader.readAsDataURL(blob);
      });
    }

    async function createFallbackImageCopy(imageUrl, title, type) {
      const secret = getImageUploadSecret();
      if (!secret) throw new Error('Не введён UPLOAD_SECRET');
      setStatus('Скачиваю основную картинку для резервной копии…');

      const sourceBlob = await workerImageRequest('/proxy-image', secret, { url: imageUrl }, 'blob');
      const bitmap = await createImageBitmap(sourceBlob);
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 50000000) {
        bitmap.close();
        throw new Error('Слишком большое разрешение исходной картинки');
      }
      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#111';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      setStatus('Сжимаю картинку в WebP…');
      const webp = await canvasToWebp(canvas, 0.78);
      const contentBase64 = await blobToBase64(webp);
      const path = compactImageFileName(title, type, imageUrl);
      setStatus('Загружаю резервную картинку в images/…');
      await workerImageRequest('/upload', secret, { path, contentBase64 }, 'json');
      return path;
    }


    function managedFallbackImagePath(value) {
      const path = String(value || '').trim().replace(/^\.\//, '');
      return /^images\/[a-z0-9][a-z0-9-]{0,99}\.webp$/i.test(path) ? path : '';
    }

    async function removeFallbackImageFromBrowserCache(path) {
      if (!('caches' in window)) return;
      const url = new URL(path, document.baseURI).href;
      const names = await caches.keys();
      await Promise.all(names
        .filter(name => name.startsWith('op-ed-images-'))
        .map(async name => {
          const cache = await caches.open(name);
          await cache.delete(url);
        }));
    }

    async function deleteFallbackImageCopy(value) {
      const path = managedFallbackImagePath(value);
      if (!path) return false;
      const secret = getImageUploadSecret();
      if (!secret) throw new Error('Не введён UPLOAD_SECRET');
      await workerImageRequest('/delete', secret, { path }, 'json');
      await removeFallbackImageFromBrowserCache(path);
      return true;
    }


    function existingImageMigrationCandidates() {
      return entries.filter(entry =>
        entry && entry.id && String(entry.image || '').trim() && !String(entry.fallbackImage || '').trim()
      );
    }

    function imageMigrationStatus(message, error) {
      const el = $('#oc-image-migration-status');
      if (el) {
        el.textContent = message || '';
        el.style.color = error ? 'var(--pink)' : '';
      }
    }

    function appendImageMigrationLog(message, error) {
      const el = $('#oc-image-migration-log');
      if (!el) return;
      const row = document.createElement('div');
      row.textContent = message;
      row.style.color = error ? 'var(--pink)' : 'var(--muted)';
      el.appendChild(row);
      el.scrollTop = el.scrollHeight;
    }

    function openImageMigrationModal() {
      if (!ensureAdmin()) return;
      const remaining = existingImageMigrationCandidates().length;
      imageMigrationStatus('Осталось без резервной копии: ' + remaining);
      imageMigrationModal.classList.remove('hidden');
    }

    function closeImageMigrationModal() {
      if (imageMigrationRunning) {
        imageMigrationStopRequested = true;
        imageMigrationStatus('Останавливаю после текущей картинки…');
        return;
      }
      imageMigrationModal.classList.add('hidden');
    }

    async function runExistingImageMigrationBatch() {
      if (imageMigrationRunning || !ensureAdmin()) return;
      const candidates = existingImageMigrationCandidates().slice(0, 50);
      if (!candidates.length) {
        imageMigrationStatus('Все существующие картинки уже обработаны ✓');
        return;
      }
      if (!getImageUploadSecret()) {
        imageMigrationStatus('Не введён UPLOAD_SECRET.', true);
        return;
      }

      imageMigrationRunning = true;
      imageMigrationStopRequested = false;
      $('#oc-image-migration-start').disabled = true;
      $('#oc-image-migration-stop').disabled = false;
      $('#oc-image-migration-log').innerHTML = '';
      let success = 0;
      let failed = 0;

      for (let index = 0; index < candidates.length; index++) {
        if (imageMigrationStopRequested) break;
        const entry = candidates[index];
        imageMigrationStatus('Обрабатываю ' + (index + 1) + ' из ' + candidates.length + ': ' + entry.title);
        try {
          const fallbackImage = await createFallbackImageCopy(entry.image, entry.title, entry.type);
          await window.OPED_DB.updateOpening(entry.id, { ...entry, fallbackImage });
          entry.fallbackImage = fallbackImage;
          success++;
          appendImageMigrationLog('✓ ' + entry.title + ' → ' + fallbackImage);
        } catch (error) {
          failed++;
          const message = error && error.message ? error.message : 'неизвестная ошибка';
          appendImageMigrationLog('✕ ' + entry.title + ': ' + message, true);
          if (/неверный пароль|unauthorized|401/i.test(message)) {
            imageMigrationStopRequested = true;
            appendImageMigrationLog('Пакет остановлен: проверьте UPLOAD_SECRET.', true);
          }
        }
      }

      imageMigrationRunning = false;
      $('#oc-image-migration-start').disabled = false;
      $('#oc-image-migration-stop').disabled = true;
      const remaining = existingImageMigrationCandidates().length;
      imageMigrationStatus(
        (imageMigrationStopRequested ? 'Остановлено. ' : 'Пачка завершена. ') +
        'Успешно: ' + success + ', ошибок: ' + failed + ', осталось: ' + remaining,
        failed > 0
      );
    }

    if (imageMigrationBtn) imageMigrationBtn.addEventListener('click', openImageMigrationModal);
    if ($('#oc-image-migration-start')) $('#oc-image-migration-start').addEventListener('click', runExistingImageMigrationBatch);
    if ($('#oc-image-migration-stop')) $('#oc-image-migration-stop').addEventListener('click', () => {
      imageMigrationStopRequested = true;
      imageMigrationStatus('Останавливаю после текущей картинки…');
    });
    if ($('#oc-image-migration-forget-secret')) $('#oc-image-migration-forget-secret').addEventListener('click', forgetImageUploadSecret);
    if (imageMigrationModal) imageMigrationModal.addEventListener('click', event => {
      if (event.target === imageMigrationModal || event.target.closest('[data-image-migration-close]')) closeImageMigrationModal();
    });

    $('#oc-add-btn').addEventListener('click', async () => {
      if (!ensureAdmin()) return;
      if (!ensureNickname()) return;

      const title = $('#oc-add-title').value.trim();
      const type = $('#oc-add-type').value;
      const yearRaw = $('#oc-add-year').value.trim();
      const year = yearRaw ? parseInt(yearRaw, 10) : null;
      const season = $('#oc-add-season').value;
      const studios = parseList($('#oc-add-studio').value);
      const directors = parseList($('#oc-add-director').value);
      const performers = parseList($('#oc-add-performer').value);
      const sameSong = sameSongFields($('#oc-add-same-song')?.value);
      const franchises = franchisesForSave($('#oc-add-franchise').value);
      const alternativeTitles = alternativeTitlesForSave(title, $('#oc-add-alt-titles') ? $('#oc-add-alt-titles').value : '');
      const image = $('#oc-add-image').value.trim();
      let fallbackImage = $('#oc-add-fallback-image').value.trim();
      const makeImageBackup = Boolean($('#oc-add-backup-image') && $('#oc-add-backup-image').checked);
      const link = $('#oc-add-link').value.trim();
      const isChinese = Boolean($('#oc-add-chinese') && $('#oc-add-chinese').checked);
      const isMovie = Boolean($('#oc-add-movie') && $('#oc-add-movie').checked);
      const isShortened = Boolean($('#oc-add-shortened') && $('#oc-add-shortened').checked);

      if (!title) { setStatus('Введите название.', true); return; }
      if (isDuplicateTitle(title, type, null)) { setStatus(`Такой ${type} уже есть. OP и ED проверяются отдельно.`, true); return; }
      if (!(await confirmSimilarTitleIfNeeded(title, type, null))) {
        setStatus('Добавление отменено: похоже на дубль.');
        return;
      }

      let backupWarning = '';
      if (image && makeImageBackup && !fallbackImage) {
        try {
          fallbackImage = await createFallbackImageCopy(image, title, type);
          $('#oc-add-fallback-image').value = fallbackImage;
        } catch (backupError) {
          console.warn('Fallback image upload failed', backupError);
          backupWarning = backupError && backupError.message ? backupError.message : 'неизвестная ошибка';
          fallbackImage = '';
        }
      }

      try {
        const createdRef = await window.OPED_DB.addOpening({
          title,
          type,
          year,
          season,
          studios,
          directors,
          performers,
          ...sameSong,
          franchises,
          alternativeTitles,
          image,
          fallbackImage,
          link,
          isChinese,
          isMovie,
          isShortened,
          notes: '',
          createdBy: myName
        });
        if (createdRef && createdRef.id) await saveOpeningExtras(createdRef.id, { franchises, alternativeTitles, isChinese, isMovie, isShortened, ...sameSong });

        $('#oc-add-title').value = '';
        // Год и сезон оставляем последними введёнными, чтобы быстрее добавлять пачку треков одного сезона.
        $('#oc-add-studio').value = '';
        $('#oc-add-director').value = '';
        $('#oc-add-performer').value = '';
        if ($('#oc-add-same-song')) $('#oc-add-same-song').value = '';
        $('#oc-add-franchise').value = '';
        if ($('#oc-add-alt-titles')) $('#oc-add-alt-titles').value = '';
        $('#oc-add-image').value = '';
        $('#oc-add-fallback-image').value = '';
        $('#oc-add-link').value = '';
        if ($('#oc-add-chinese')) $('#oc-add-chinese').checked = false;
        if ($('#oc-add-movie')) $('#oc-add-movie').checked = false;
        if ($('#oc-add-shortened')) $('#oc-add-shortened').checked = false;

        setStatus(backupWarning ? 'Трек добавлен ✓ Но запасная картинка не создана: ' + backupWarning : 'Трек добавлен ✓', Boolean(backupWarning));
      } catch (err) {
        console.error(err);
        const message = err && err.message ? err.message : 'неизвестная ошибка';
        setStatus('Не удалось добавить трек: ' + message, true);
      }
    });

    function applyFilterChange() {
      chartPage = 1;
      profileTopPage = { OP: 1, ED: 1 };
      allRatingsPage = { OP: 1, ED: 1 };
      syncFilterControls();
      render();
      if (activeTab === 'profile') renderProfile();
    }

    const debouncedFilterChange = makeDebounced(applyFilterChange, 250);

    function bindSimpleFilter(selector, key, eventName = 'change') {
      const el = $(selector);
      if (!el) return;
      el.addEventListener(eventName, (e) => {
        filters[key] = e.target.value;
        if (eventName === 'input') debouncedFilterChange();
        else applyFilterChange();
      });
    }

    bindSimpleFilter('#oc-f-search', 'search', 'input');
    bindSimpleFilter('#oc-p-search', 'search', 'input');
    bindSimpleFilter('#oc-f-type', 'type');
    bindSimpleFilter('#oc-p-type', 'type');
    bindSimpleFilter('#oc-f-year', 'year');
    bindSimpleFilter('#oc-p-year', 'year');
    bindSimpleFilter('#oc-f-season', 'season');
    bindSimpleFilter('#oc-p-season', 'season');
    bindSimpleFilter('#oc-f-score-cmp', 'scoreCmp');
    bindSimpleFilter('#oc-p-score-cmp', 'scoreCmp');
    bindSimpleFilter('#oc-f-score-value', 'scoreValue', 'input');
    bindSimpleFilter('#oc-p-score-value', 'scoreValue', 'input');
    ['#oc-f-missing', '#oc-p-missing'].forEach(selector => {
      const el = $(selector);
      if (!el) return;
      el.addEventListener('change', () => { filters.missingOnly = Boolean(el.checked); applyFilterChange(); });
    });
    if (contentFilterSelect) {
      contentFilterSelect.addEventListener('change', (e) => setContentFilterMode(e.target.value));
    }
    $('#oc-sort').addEventListener('change', (e) => { sortMode = e.target.value; chartPage = 1; render(); });

    function bindMultiFilter(selector, filterKey) {
      const el = $(selector);
      if (!el) return;
      el.addEventListener('mousedown', (e) => {
        const option = e.target && e.target.closest ? e.target.closest('option') : null;
        if (!option || !el.contains(option)) return;
        e.preventDefault();
        option.selected = !option.selected;
        filters[filterKey] = Array.from(el.selectedOptions).map(o => o.value);
        applyFilterChange();
        el.focus();
      });
      el.addEventListener('change', (e) => {
        filters[filterKey] = Array.from(e.target.selectedOptions).map(o => o.value);
        applyFilterChange();
      });
    }
    bindMultiFilter('#oc-f-studio', 'studios');
    bindMultiFilter('#oc-f-director', 'directors');
    bindMultiFilter('#oc-f-performer', 'performers');
    bindMultiFilter('#oc-f-franchise', 'franchises');
    bindMultiFilter('#oc-p-studio', 'studios');
    bindMultiFilter('#oc-p-director', 'directors');
    bindMultiFilter('#oc-p-performer', 'performers');
    bindMultiFilter('#oc-p-franchise', 'franchises');

    document.querySelectorAll('[data-filter-suggest]').forEach(input => {
      input.addEventListener('change', () => addFilterValueFromInput(input));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFilterValueFromInput(input); } });
    });

    document.addEventListener('input', (e) => {
      const input = e.target && e.target.closest ? e.target.closest('input[list]') : null;
      if (input) refreshDynamicDatalist(input);
    });
    document.addEventListener('focusin', (e) => {
      const input = e.target && e.target.closest ? e.target.closest('input[list]') : null;
      if (input) refreshDynamicDatalist(input);
    });

    function resetAllFilters() {
      filters.search = ''; filters.type = ''; filters.year = ''; filters.season = ''; filters.scoreCmp = ''; filters.scoreValue = ''; filters.missingOnly = false;
      // Режим показа китайских / фильмов / укороченных не считаем обычным фильтром.
      // Он сохраняется отдельно и не должен сбрасываться кнопкой «Сбросить фильтры».
      filters.studios = []; filters.directors = []; filters.performers = []; filters.franchises = [];
      sortMode = 'added_desc';
      chartPage = 1; profileTopPage = { OP: 1, ED: 1 }; allRatingsPage = { OP: 1, ED: 1 }; arScoreFilter = '';
      const sort = $('#oc-sort');
      if (sort) sort.value = 'added_desc';
      populateFilterOptions();
      syncContentFilterSelect();
      render();
      if (activeTab === 'profile') renderProfile();
    }

    $('#oc-reset-filters').addEventListener('click', resetAllFilters);
    $('#oc-p-reset-filters').addEventListener('click', resetAllFilters);

    scaleSelect.addEventListener('change', async (e) => {
      await saveScale(e.target.value);
      render();
      if (activeTab === 'profile') renderProfile();
      if (activeTab === 'tier') renderTierList();
      if (activeTab === 'stats') renderStatsPage();
      if (activeTab === 'top100') renderGlobalTop100();
      setStatus('Шкала оценки обновлена ✓');
    });

    $('#oc-topmode-score').addEventListener('click', () => setTopMode('score'));
    $('#oc-topmode-manual').addEventListener('click', () => setTopMode('manual'));
    const manualEditBtn = $('#oc-manual-edit-btn');
    const manualSaveBtn = $('#oc-manual-save-btn');
    if (manualEditBtn) manualEditBtn.addEventListener('click', () => {
      if (!myName || !manualSameUser(profileUser, myName)) return;
      manualEditMode = !manualEditMode;
      manualShowHidden = false;
      if (manualEditMode) { ensureManualOrderForEditing(myName, 'OP'); ensureManualOrderForEditing(myName, 'ED'); }
      renderProfile();
    });
    if (manualSaveBtn) manualSaveBtn.addEventListener('click', async () => {
      if (!myName || !manualSameUser(profileUser, myName)) return;
      try {
        ensureManualOrderForEditing(myName, 'OP');
        ensureManualOrderForEditing(myName, 'ED');
        await saveManualRanks();
        manualDirty = false;
        manualSaveBtn.classList.remove('active');
        renderProfile();
        setStatus('Твой топ-100 сохранён и будет виден всем ✓');
      } catch (e) {
        console.error(e);
        setStatus('Не удалось сохранить ручной топ-100.', true);
      }
    });
    if (manualHiddenToggleBtn) manualHiddenToggleBtn.addEventListener('click', () => {
      manualShowHidden = !manualShowHidden;
      allRatingsPage = { OP: 1, ED: 1 };
      renderProfile();
    });
    if (profileDeleteBtn) profileDeleteBtn.addEventListener('click', () => deleteProfileFully(profileUser));
    profileUserSelect.addEventListener('change', () => { manualEditMode = false; manualShowHidden = false; allRatingsPage = { OP: 1, ED: 1 }; profileTopPage = { OP: 1, ED: 1 }; renderProfile(); });

    const tierTypeEl = $('#oc-tier-type');
    const tierYearEl = $('#oc-tier-year');
    const tierSeasonEl = $('#oc-tier-season');
    if (tierTypeEl) tierTypeEl.addEventListener('change', (e) => { tierSelection.type = e.target.value; renderTierList(); });
    if (tierYearEl) tierYearEl.addEventListener('change', (e) => { tierSelection.year = Number(e.target.value); renderTierList(); });
    if (tierSeasonEl) tierSeasonEl.addEventListener('change', (e) => { tierSelection.season = e.target.value; renderTierList(); });

    const statsTypeEl = $('#oc-stats-type');
    if (statsTypeEl) statsTypeEl.addEventListener('change', (e) => { statsTypeFilter = e.target.value; renderStatsPage(); });

    $('#oc-ar-type').addEventListener('change', (e) => {
      arTypeFilter = e.target.value;
      allRatingsPage = { OP: 1, ED: 1 };
      renderAllRatings(profileUser, applyFiltersIgnoringType(entries));
    });
    const arMetricEl = $('#oc-ar-metric');
    if (arMetricEl) arMetricEl.addEventListener('change', (e) => {
      arScoreMetric = e.target.value || 'total';
      arScoreFilter = '';
      allRatingsPage = { OP: 1, ED: 1 };
      populateArScoreOptions(profileUser, applyFiltersIgnoringType(entries));
      renderAllRatings(profileUser, applyFiltersIgnoringType(entries));
    });
    $('#oc-ar-score').addEventListener('change', (e) => {
      arScoreFilter = e.target.value;
      allRatingsPage = { OP: 1, ED: 1 };
      renderAllRatings(profileUser, applyFiltersIgnoringType(entries));
    });
    if (openingModal) {
      openingModal.addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-opening-info-toggle]');
        if (toggle) {
          const panel = openingModal.querySelector('[data-opening-info-panel]');
          const willOpen = panel && panel.classList.contains('hidden');
          if (panel) panel.classList.toggle('hidden', !willOpen);
          toggle.classList.toggle('open', Boolean(willOpen));
          toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          toggle.title = willOpen ? 'Скрыть описание' : 'Показать описание';
          return;
        }
        if (e.target === openingModal || e.target.closest('[data-modal-close]')) closeCardModal();
      });
    }

    document.querySelectorAll('[data-globaltop-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        globalTopType = btn.dataset.globaltopType === 'ED' ? 'ED' : 'OP';
        renderGlobalTop100();
      });
    });
    document.querySelectorAll('[data-globaltop-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        globalTopMode = btn.dataset.globaltopMode === 'score' ? 'score' : 'manual';
        renderGlobalTop100();
      });
    });
    document.querySelectorAll('[data-globaltop-scope]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!isAdmin()) return;
        globalTopScope = btn.dataset.globaltopScope === 'admins' ? 'admins' : 'all';
        renderGlobalTop100();
      });
    });

    authRegisterOpenBtn?.addEventListener('click', showRegistrationModal);
    registerCloseBtn?.addEventListener('click', () => { hideRegistrationModal(); showAuthModal('Войди или создай аккаунт.'); });
    accessBadge?.addEventListener('click', () => showAuthModal(accessLevel ? 'Войди заново или смени аккаунт.' : 'Войди в аккаунт.'));
    accessBadge?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showAuthModal(accessLevel ? 'Войди заново или смени аккаунт.' : 'Войди в аккаунт.');
      }
    });
    if (authSaveBtn) authSaveBtn.addEventListener('click', commitPersonalLogin);
    if (authCloseBtn) authCloseBtn.addEventListener('click', hideAuthModal);
    if (authIdentifierInput) authIdentifierInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); authPassInput?.focus(); } });
    if (authPassInput) authPassInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commitPersonalLogin(); } });
    if (authForgotBtn) authForgotBtn.addEventListener('click', async () => {
      const identifier = String(authIdentifierInput?.value || '').trim();
      const email = identifier.includes('@') ? identifier : '';
      if (!email) { showAuthModal('Для восстановления введи email аккаунта.'); return; }
      try {
        const db = await waitForFirebaseDb();
        await db.resetAccountPassword(email);
        showAuthModal('Письмо для восстановления отправлено ✓');
      } catch (error) { showAuthModal('Не удалось отправить письмо: ' + (error?.message || error)); }
    });
    authLogoutBtn?.addEventListener('click', async () => {
      try {
        await window.OPED_DB?.logoutAccount?.();
        authenticatedUid = '';
        accessLevel = '';
        myName = '';
        sessionStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(PRIMARY_NAME_KEY);
        localStorage.removeItem(NAME_KEY);
        nameInput.value = '';
        hideAuthModal();
        updateAccessUi();
        render();
        setStatus('Вы вышли из аккаунта.');
      } catch (error) {
        showAuthModal('Не удалось выйти: ' + (error?.message || error));
      }
    });

    if (registerSaveBtn) registerSaveBtn.addEventListener('click', async () => {
      const nickname = String(registerNameInput?.value || myName || '').trim();
      const email = String(registerEmailInput?.value || '').trim();
      const password = String(registerPassInput?.value || '');
      const confirmation = String(registerPassConfirmInput?.value || '');
      if (registerError) registerError.textContent = '';
      if (!nickname) { if (registerError) registerError.textContent = 'Введите никнейм.'; return; }
      if (!/^\S+@\S+\.\S+$/.test(email)) { if (registerError) registerError.textContent = 'Введите корректный email.'; return; }
      if (password.length < 6) { if (registerError) registerError.textContent = 'Пароль должен содержать минимум 6 символов.'; return; }
      if (password !== confirmation) { if (registerError) registerError.textContent = 'Пароли не совпадают.'; return; }
      if (!PERSONAL_ACCOUNT_AUTH_ENABLED) {
        if (registerError) { registerError.textContent = PERSONAL_ACCOUNT_DISABLED_MESSAGE; registerError.style.color = '#FFC857'; }
        return;
      }
      const existing = accountProfile(nickname);
      if (existing?.authUid) { if (registerError) registerError.textContent = 'Для этого ника личный пароль уже установлен.'; return; }
      const registerButtonText = registerSaveBtn?.textContent || 'Зарегистрировать аккаунт';
      if (registerSaveBtn) { registerSaveBtn.disabled = true; registerSaveBtn.textContent = 'Создаём аккаунт…'; }
      if (registerError) { registerError.textContent = 'Создаём аккаунт…'; registerError.style.color = '#FFC857'; }
      try {
        if (!window.OPED_DB || typeof window.OPED_DB.registerAccount !== 'function') throw new Error('Сервис ещё загружается. Попробуй через пару секунд.');
        const user = await window.OPED_DB.registerAccount(nickname, email, password, Boolean(registerRememberInput?.checked));
        const patch = { authUid: user.uid, authProvider: 'password', passwordEnabled: true };
        const row = accountProfile(nickname);
        if (row) Object.assign(row, patch);
        else firebaseUserProfiles.push({ id: normalizedAccountName(nickname), nickname, nicknameKey: normalizedAccountName(nickname), ...patch });
        registerNameInput.value = '';
        registerEmailInput.value = '';
        registerPassInput.value = '';
        registerPassConfirmInput.value = '';
        if (registerSaveBtn) { registerSaveBtn.disabled = false; registerSaveBtn.textContent = registerButtonText; }
        hideRegistrationModal();
        if (authIdentifierInput) authIdentifierInput.value = email;
        if (authPassInput) authPassInput.value = '';
        showAuthModal('Аккаунт успешно создан ✓ Теперь введи пароль и войди.');
      } catch (error) {
        console.error('Account registration failed', error);
        const code = String(error?.code || '');
        const message = code === 'auth/operation-not-allowed'
          ? 'Регистрация сейчас недоступна.'
          : code === 'auth/invalid-credential' || code === 'auth/wrong-password'
            ? 'Этот email уже существует, но введён неверный пароль. Введи пароль от этого email или восстанови его.'
            : code === 'auth/email-linked-to-another-nickname'
              ? (error?.message || 'Этот email уже связан с другим ником.')
              : code === 'permission-denied' || code === 'firestore/permission-denied'
                ? 'Не удалось сохранить аккаунт.'
                : (error?.message || 'Не удалось зарегистрировать аккаунт.');
        if (registerSaveBtn) { registerSaveBtn.disabled = false; registerSaveBtn.textContent = registerButtonText; }
        if (registerError) { registerError.textContent = message; registerError.style.color = '#FF2E63'; }
      }
    });

    const tierDownloadBtn = $('#oc-tier-download-btn');
    if (tierDownloadBtn) tierDownloadBtn.addEventListener('click', downloadCurrentTierList);

    $('#oc-ar-sort').addEventListener('click', () => {
      arSortDir = arSortDir === 'desc' ? 'asc' : 'desc';
      allRatingsPage = { OP: 1, ED: 1 };
      $('#oc-ar-sort').textContent = arSortDir === 'desc' ? 'По убыванию ↓' : 'По возрастанию ↑';
      renderAllRatings(profileUser, applyFiltersIgnoringType(entries));
    });

    function loadHtml2Canvas() {
      if (window.html2canvas) return Promise.resolve(window.html2canvas);
      if (window._opedHtml2CanvasPromise) return window._opedHtml2CanvasPromise;
      window._opedHtml2CanvasPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        script.async = true;
        script.onload = () => window.html2canvas ? resolve(window.html2canvas) : reject(new Error('html2canvas не загрузился'));
        script.onerror = () => reject(new Error('Не удалось загрузить html2canvas'));
        document.head.appendChild(script);
      });
      return window._opedHtml2CanvasPromise;
    }

    function waitForImages(root) {
      const imgs = Array.from(root.querySelectorAll('img'));
      if (!imgs.length) return Promise.resolve();
      return Promise.all(imgs.map(img => new Promise(resolve => {
        if (img.complete) { resolve(); return; }
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 2500);
      })));
    }

    async function downloadCurrentTierList() {
      if (!myName) { setStatus('Введите никнейм для скачивания тир-листа.', true); return; }
      const board = $('#oc-tier-list .oc-tier-board');
      if (!board || !board.querySelector('[data-tier-card]')) {
        setStatus('В этом тир-листе пока нет карточек для скачивания.', true);
        return;
      }

      const type = tierSelection.type;
      const year = tierSelection.year;
      const season = tierSelection.season;
      const exportWrap = document.createElement('div');
      exportWrap.className = 'oc-tier-export-wrap';
      exportWrap.style.position = 'fixed';
      exportWrap.style.left = '-20000px';
      exportWrap.style.top = '0';
      exportWrap.style.zIndex = '-1';
      exportWrap.style.setProperty('--bg', '#0B0A10');
      exportWrap.style.setProperty('--card', '#16121F');
      exportWrap.style.setProperty('--card-hover', '#1D1829');
      exportWrap.style.setProperty('--border', '#2A2435');
      exportWrap.style.setProperty('--pink', '#FF2E63');
      exportWrap.style.setProperty('--cyan', '#08D9D6');
      exportWrap.style.setProperty('--text', '#F5F3FA');
      exportWrap.style.setProperty('--muted', '#8B8698');
      exportWrap.style.setProperty('--gold', '#FFC857');
      exportWrap.style.setProperty('--green', '#4ADE80');
      exportWrap.innerHTML = `<div class="oc-tier-export-title">АБОБА · тир-лист ${escapeHtml(type)} · ${escapeHtml(SEASON_LABEL[season])} ${escapeHtml(year)} · ${escapeHtml(myName)}</div>`;
      const clonedBoard = board.cloneNode(true);
      clonedBoard.querySelectorAll('[draggable]').forEach(el => el.removeAttribute('draggable'));
      clonedBoard.querySelectorAll('img').forEach(img => {
        img.setAttribute('crossorigin', 'anonymous');
        img.setAttribute('referrerpolicy', 'no-referrer');
      });
      exportWrap.appendChild(clonedBoard);
      document.body.appendChild(exportWrap);

      try {
        const html2canvas = await loadHtml2Canvas();
        await waitForImages(exportWrap);
        const canvas = await html2canvas(exportWrap, {
          backgroundColor: '#0B0A10',
          useCORS: true,
          allowTaint: false,
          logging: false,
          imageTimeout: 5000,
          scale: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
          windowWidth: Math.max(document.documentElement.scrollWidth, exportWrap.scrollWidth + 80),
          windowHeight: Math.max(document.documentElement.scrollHeight, exportWrap.scrollHeight + 80)
        });
        canvas.toBlob(blob => {
          exportWrap.remove();
          if (!blob) { setStatus('Не удалось создать PNG.', true); return; }
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `aboba-tier-${type}-${year}-${season}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(pngUrl);
          setStatus('Тир-лист скачан как PNG-скриншот ✓');
        }, 'image/png');
      } catch (err) {
        console.error(err);
        exportWrap.remove();
        setStatus('Не удалось создать изображение.', true);
      }
    }


    (async function init() {
      updateAccessUi();
      await loadName();
      await loadAvatar();
      await loadScale();
      await loadContentFilterMode();
      await loadAvatarsMap();
      await loadManualRanks();
      try {
        const db = await waitForFirebaseDb();
        const resumed = await db.resumePersonalAccount();
        if (resumed) await applyPersonalAccountSession(resumed, true);
        else {
          authenticatedUid = '';
          accessLevel = '';
          sessionStorage.removeItem(ACCESS_KEY);
          updateAccessUi();
        }
      } catch (error) { console.warn('Saved personal session restore failed', error); }
      if (myName && !avatarsMap[myName]) avatarsMap[myName] = myAvatar;
      await loadTierOrders();
      await loadEntries();
      refreshDailyUi();
      if (accessLevel && !myName) showNameModal('Введите никнейм, чтобы продолжить.');
    })();
  })();
