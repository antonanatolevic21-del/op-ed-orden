Warning: truncated output (original token count: 92906)
Total output lines: 7390

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
    const CONFIRMED_LEGACY_MANUAL_TOP_KEYS = new Set(['пёс_кошачий', 'пес_кошачий', 'egortos', 'кофа', 'holdes']);
    const EVENT_BASKET_KEY = 'aboba-events-basket-v1';
    const IMAGE_UPLOAD_WORKER = 'https://oped-image-upload.keeperkeeper2003-01e.workers.dev';
    const IMAGE_UPLOAD_SECRET_KEY = 'op-ed-image-upload-secret';
    const DAILY_DISMISSED_KEY = 'op-ed-daily-dismissed-v1';
    const CATALOG_VIEW_KEY = 'op-ed-catalog-view-v1';
    const WELCOME_ACK_KEY = 'op-ed-welcome-ack-v1';
    const CATALOG_ADMIN_WORKSPACE = window.OC_CATALOG_ADMIN_WORKSPACE === true;
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
    let catalogView = localStorage.getItem(CATALOG_VIEW_KEY) === 'compact' ? 'compact' : 'detailed';
    const filters = { search: '', type: '', fromYear: '', fromSeason: 'winter', toYear: '', toSeason: 'fall', scoreCmp: '', scoreValue: '', missingOnly: false, hideChinese: true, hideMovie: true, hideShortened: true, studios: [], directors: [], performers: [], franchises: [] };
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
    let globalTopRenderLimit = 30;
    const PAGE_SIZE = 50;
    let chartPage = 1;
    let profileTopPage = { OP: 1, ED: 1 };
    let allRatingsPage = { OP: 1, ED: 1 };
    let profileTopExpanded = { OP: false, ED: false };
    let manualEditMode = false;
    let manualDirty = false;
    let manualShowHidden = false;
    let manualHiddenForEdit = {};

    const SEASON_LABEL = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
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

    const listContainer = $('#oc-list-container');
    const statusEl = $('#oc-status');
    const resultCountEl = $('#oc-resultcount');
    const nameInput = $('#oc-myname');
    const avatarBtn = $('#oc-avatar-btn');
    const avatarPicker = $('#oc-avatar-picker');
    const dailyBell = $('#oc-daily-bell');
    const dailyBellDot = $('#oc-daily-bell-dot');
    const accountWelcome = $('#oc-account-welcome');
    const welcomeAck = $('#oc-welcome-ack');
    const catalogProgress = $('#oc-catalog-progress');
    const detailedViewBtn = $('#oc-view-detailed');
    const compactViewBtn = $('#oc-view-compact');
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
    const entityPanel = $('#oc-entity-panel');
    const entityTitleEl = $('#oc-entity-title');
    const entitySubtitleEl = $('#oc-entity-subtitle');
    const entityBackBtn = $('#oc-entity-back');
    const entityCreateForm = $('#oc-entity-create');
    const entityValueSelect = $('#oc-entity-value');
    const entityImageInput = $('#oc-entity-image');
    const entityFiltersEl = $('#oc-entity-filters');
    const entityFiltersToggle = $('#oc-entity-filters-toggle');
    const entityAlbumTools = $('#oc-entity-album-tools');
    const entityAlbumSearchInput = $('#oc-entity-album-search');
    const entityAlbumSortSelect = $('#oc-entity-album-sort');
    const entitySearchInput = $('#oc-entity-search');
    const entityTrackTypeSelect = $('#oc-entity-track-type');
    const entityFromYearSelect = $('#oc-entity-from-year');
    const entityFromSeasonSelect = $('#oc-entity-from-season');
    const entityToYearSelect = $('#oc-entity-to-year');
    const entityToSeasonSelect = $('#oc-entity-to-season');
    const entityProgressSelect = $('#oc-entity-progress');
    const entityRateAllBtn = $('#oc-entity-rate-all');
    const entityGridEl = $('#oc-entity-grid');
    const entityTracksEl = $('#oc-entity-tracks');
    const openingModal = $('#oc-opening-modal');
    const confirmModal = $('#oc-confirm-modal');
    const franchiseRepairModal = $('#oc-franchise-repair-modal');
    const imageMigrationBtn = $('#oc-image-migration-btn');
    const imageMigrationInlineBtn = $('#oc-image-migration-inline-btn');
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
    let firebaseRatingsScope = 'none';
    let firebaseManualRanks = [];
    let firebaseUserProfiles = [];
    let firebaseEntityCards = [];
    let firebaseUnsubEntityCards = null;
    let activeEntityType = 'studios';
    let activeEntityCardId = '';
    let entityFiltersExpanded = false;
    let activeEntityQueueLabel = '';
    let activeEntityFilteredEntries = [];
    let entityCardRenderLimit = 40;
    let entityTrackRenderLimit = 30;
    let firebaseUnsubOpenings = null;
    let firebaseUnsubRatings = null;
    let firebaseUnsubManualRanks = null;
    let firebaseUnsubUserProfiles = null;
    let firebaseUnsubTierOrders = null;
    let firebaseUnsubEventBasket = null;
    let firebaseEventBasket = {};
    let firebaseEventBasketLoaded = false;
    let firebaseDbInstance = null;
    const remoteDataState = {
      openings: { started: false, ready: false, promise: null, resolve: null },
      ratings: { started: false, ready: false, promise: null, resolve: null },
      manualRanks: { started: false, ready: false, promise: null, resolve: null },
      userProfiles: { started: false, ready: false, promise: null, resolve: null },
      entityCards: { started: false, ready: false, promise: null, resolve: null },
      tier: { started: false, ready: false, promise: null, resolve: null },
      eventBasket: { started: false, ready: false, promise: null, resolve: null }
    };
    let routeDataSyncId = 0;
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
    let globalTopCache = new Map();
    let uiRefreshTimer = null;
    let uiRefreshNeedsFilterOptions = false;
    let suppressChartRatingRefreshUntil = 0;
    let lastOpeningsSnapshotKey = '';

    function dispatchAppEvent(name, detail = {}) {
      const payload = { activeTab, ...detail };
      window.dispatchEvent(new CustomEvent(name, { detail: payload }));
      document.dispatchEvent(new CustomEvent(name, { detail: payload }));
    }

    function markRemoteDataReady(name, detail = {}) {
      const state = remoteDataState[name];
      if (!state) return;
      const firstReady = !state.ready;
      state.ready = true;
      if (state.resolve) {
        state.resolve();
        state.resolve = null;
      }
      dispatchAppEvent('oped:data-ready', { source: name, firstReady, ...detail });
      if (name === 'openings') dispatchAppEvent('oped:catalog-ready', { firstReady, ...detail });
    }

    function createRemoteDataPromise(name) {
      const state = remoteDataState[name];
      if (!state) return Promise.resolve();
      if (state.ready) return Promise.resolve();
      if (!state.promise) {
        state.promise = new Promise(resolve => {
          state.resolve = resolve;
        });
      }
      return state.promise;
    }

    function resetRemoteDataSubscription(name) {
      const state = remoteDataState[name];
      if (!state) return;
      state.started = false;
      state.promise = null;
      state.resolve = null;
    }

    function runWhenBrowserIsIdle(callback, timeout = 1200) {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => callback(), { timeout });
        return;
      }
      window.setTimeout(callback, Math.min(timeout, 250));
    }

    function progressiveMoreMarkup(scope, shown, total) {
      if (shown >= total) return '';
      return `<button type="button" class="oc-progressive-more" data-progressive-more="${scope}">Показано ${shown} из ${total} · загрузить ещё</button>`;
    }

    function installProgressiveAutoload(container, scope, callback) {
      const button = container?.querySelector?.(`[data-progressive-more="${scope}"]`);
      if (!button) return;
      button.addEventListener('click', callback, { once: true });
      if (!('IntersectionObserver' in window)) return;
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        button.click();
      }, { rootMargin: '500px 0px' });
      observer.observe(button);
    }

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
      globalTopCache.clear();
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
      globalTopCache.clear();
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
      uiRefreshNeedsFilterOptions = uiRefreshNeedsFilterOptions || Boolean(options.forceFilters);
      clearTimeout(uiRefreshTimer);
      uiRefreshTimer = setTimeout(() => {
        uiRefreshTimer = null;
        const forceFilters = uiRefreshNeedsFilterOptions;
        uiRefreshNeedsFilterOptions = false;
        refreshVisiblePanels({ forceFilters });
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
      if (activeTab.startsWith('entity-')) renderEntityAlbums();
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
      const state = remoteDataState.tier;
      if (state.started) return createRemoteDataPromise('tier');
      state.started = true;
      const readyPromise = createRemoteDataPromise('tier');
      try {
        const ext = await getExtendedDb();
        if (firebaseUnsubTierOrders) firebaseUnsubTierOrders();
        const unsubs = [];
        const readyParts = new Set();
        const markPartReady = name => {
          readyParts.add(name);
          if (readyParts.size === 3) markRemoteDataReady('tier');
        };

        unsubs.push(ext.onSnapshot(ext.collection(ext.db, 'tierOrders'), snapshot => {
          const next = {};
          snapshot.docs.forEach(d => {
            const row = { id: d.id, ...d.data() };
            next[tierOrderKey(row.nickname, row.type, row.year, row.season, row.score, row.mode || 'public')] = Array.isArray(row.order) ? row.order.map(String) : [];
          });
          tierOrders = next;
          if (activeTab === 'tier') renderTierList();
          markPartReady('orders');
        }, err => {
          console.error('tierOrders watch error', err);
          markPartReady('orders');
        }));

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
          markPartReady('labels');
        }, err => {
          console.error('tierLabels watch error', err);
          markPartReady('labels');
        }));

        unsubs.push(ext.onSnapshot(ext.collection(ext.db, 'tierPlacements'), snapshot => {
          const next = {};
          snapshot.docs.forEach(d => {
            const row = { id: d.id, ...d.data() };
            const placements = row.placements && typeof row.placements === 'object' ? row.placements : {};
            next[tierContextKey(row.nickname, row.type, row.year, row.season, row.mode || 'public')] = placements;
          });
          tierPlacements = next;
          if (activeTab === 'tier') renderTierList();
          markPartReady('placements');
        }, err => {
          console.error('tierPlacements watch error', err);
          markPartReady('placements');
        }));

        firebaseUnsubTierOrders = () => unsubs.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
      } catch (e) {
        console.error('Could not watch tier data', e);
        markRemoteDataReady('tier', { error: true });
      }
      return readyPromise;
    }

    function stopTierOrderWatcher() {
      if (firebaseUnsubTierOrders) firebaseUnsubTierOrders();
      firebaseUnsubTierOrders = null;
      resetRemoteDataSubscription('tier');
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

    function aggregateScoreMap(row, prefix = '') {
      const scores = {};
      const capitalized = prefix ? prefix[0].toUpperCase() + prefix.slice(1) : '';
      const countKey = prefix ? `${prefix}RatingCount` : 'ratingCount';
      const sumKey = prefix ? `${prefix}RatingSum` : 'ratingSum';
      const averageKey = prefix ? `${prefix}RatingAverage` : 'ratingAverage';
      const count = Number(row?.[countKey]);
      const average = Number(row?.[averageKey]);
      const rawSum = Number(row?.[sumKey]);
      const sum = Number.isFinite(rawSum) ? rawSum : (Number.isFinite(count) && Number.isFinite(average) ? count * average : 0);
      const aggregateReady = Number(row?.ratingAggregateVersion) >= 1;
      if (aggregateReady && Number.isFinite(count) && count >= 0 && Number.isFinite(sum)) {
        Object.defineProperty(scores, '__oc_aggregate_stats', {
          value: { keyCount: 0, count, avgAny: count ? sum / count : null, sum, aggregate: true, prefix: capitalized },
          configurable: true,
          enumerable: false
        });
      }
      const adminCount = Number(row?.[prefix ? `${prefix}AdminRatingCount` : 'adminRatingCount']);
      const adminAverage = Number(row?.[prefix ? `${prefix}AdminRatingAverage` : 'adminRatingAverage']);
      const adminRawSum = Number(row?.[prefix ? `${prefix}AdminRatingSum` : 'adminRatingSum']);
      const adminSum = Number.isFinite(adminRawSum)
        ? adminRawSum
        : (Number.isFinite(adminCount) && Number.isFinite(adminAverage) ? adminCount * adminAverage : 0);
      if (aggregateReady && Number.isFinite(adminCount) && adminCount >= 0 && Number.isFinite(adminSum)) {
        Object.defineProperty(scores, '__oc_admin_aggregate_stats', {
          value: { count: adminCount, avgAny: adminCount ? adminSum / adminCount : null, sum: adminSum, aggregate: true },
          configurable: true,
          enumerable: false
        });
      }
      if (aggregateReady && firebaseRatingsScope !== 'all') {
        Object.defineProperty(scores, '__oc_prefer_aggregate', { value: true, configurable: true, enumerable: false });
      }
      return scores;
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
        ratingAggregateVersion: Number(row.ratingAggregateVersion || 0),
        scores: aggregateScoreMap(row),
        songScores: aggregateScoreMap(row, 'song'),
        visualScores: aggregateScoreMap(row, 'visual'),
        personalScores: {}
      };
    }

    function rebuildEntriesFromFirebase() {
      const next = firebaseOpenings.map(normalizeEntryFromFirebase);
      const byId = new Map(next.map(e => [String(e.id), e]));
      const profileAvatarNames = new Set(
        (firebaseUserProfiles || [])
          .filter(row => String(row.avatar || '').trim())
          .flatMap(row => [
            String(row.nickname || row.displayName || row.name || row.id || '').trim(),
            String(row.nicknameKey || '').trim()
          ])
          .filter(Boolean)
          .map(normalizedAccountName)
      );
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
          const hasCanonicalAvatar = profileAvatarNames.has(normalizedAccountName(nickname));
          if (av && !hasCanonicalAvatar && !avatarsMap[nickname]) {
            avatarsMap[nickname] = av;
            avatarChanged = true;
          }
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
      if (activeTab === 'chart' && !catalogChanged && Date.now() < suppressChartRatingRefreshUntil) {
        updateAccountDashboard();
      } else {
        scheduleVisibleRefresh({ forceFilters: catalogChanged });
      }
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
      const provenanceKey = String(safeKey || manualUserSafeKey(display)).trim().toLowerCase();
      if (row.manualCreated !== true && !CONFIRMED_LEGACY_MANUAL_TOP_KEYS.has(provenanceKey)) return;
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
      const next = {};
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
      (firebaseUserProfiles || []).forEach(row => {
        const nickname = String(row.nickname || row.displayName || row.name || row.id || '').trim();
        const avatar = String(row.avatar || '').trim();
        if (nickname && avatar) next[nickname] = avatar;
      });
      avatarsMap = next;
      markAvatarsChanged();
      try { window.storage && window.storage.set(AVATARS_MAP_KEY, JSON.stringify(avatarsMap), true); } catch (e) {}
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

    function isCatalogAdmin() {
      return isAdmin() && CATALOG_ADMIN_WORKSPACE;
    }

    function updateAccessUi() {
      document.querySelectorAll('.oc-admin-only').forEach(el => el.classList.toggle('oc-locked', !isAdmin()));
      document.querySelectorAll('.oc-catalog-admin-only').forEach(el => el.classList.toggle('oc-locked', !isCatalogAdmin()));
      if (accessBadge) {
        accessBadge.textContent = isAdmin() ? 'админ' : (accessLevel ? 'вход' : 'гость');
        accessBadge.classList.toggle('admin', isAdmin());
      }
      updateAccountDashboard();
    }

    function welcomeStorageKey() {
      return `${WELCOME_ACK_KEY}:${normalizedAccountName(myName)}`;
    }

    function updateAccountDashboard() {
      const signedIn = Boolean(accessLevel && authenticatedUid && myName);
      if (accountWelcome) {
        const acknowledged = signedIn && (localStorage.getItem(welcomeStorageKey()) === '1' || accountProfile(myName)?.welcomeAcknowledged === true);
        accountWelcome.classList.toggle('hidden', !signedIn || acknowledged);
      }
      if (catalogProgress) catalogProgress.classList.toggle('hidden', !signedIn);
      if (!signedIn || !entries.length) return;
      const visibleEntries = entries.filter(entry => entryPassesHiddenFlags(entry, filters.hideChinese, filters.hideMovie, filters.hideShortened));
      const rated = visibleEntries.filter(entry => scoreFor(entry, myName) !== null);
      const ratedOp = rated.filter(entry => entry.type === 'OP').length;
      const ratedEd = rated.filter(entry => entry.type === 'ED').length;
      const percent = visibleEntries.length ? Math.round(rated.length * 100 / visibleEntries.length) : 0;
      $('#oc-catalog-progress-title').textContent = `Оценено ${rated.length} из ${visibleEntries.length} · ${percent}%`;
      $('#oc-catalog-progress-detail').textContent = `OP ${ratedOp} · ED ${ratedEd} · осталось ${Math.max(0, visibleEntries.length - rated.length)}`;
      $('#oc-catalog-progress-fill').style.width = `${percent}%`;
    }

    function showAuthModal(message) {
      if (!authModal) return;
      authError.textContent = message || '';
      if (authPassInput) authPassInput.disabled = false;
      authModal.classList.remove('hidden');
      setTimeout(() => authIdentifierInput && authIdentifierInput.focus(), 0);
    }

    function hideAuthModal() {
      if (authModal) authModal.classList.add('hidden');
      if (authError) authError.textContent = '';
      if (authPassInput) {
        authPassInput.value = '';
        authPassInput.disabled = true;
      }
    }

    function showRegistrationModal() {
      hideAuthModal();
      if (registerError) registerError.textContent = '';
      if (registerNameInput && !registerNameInput.value) registerNameInput.value = '';
      if (registerPassInput) registerPassInput.disabled = false;
      if (registerPassConfirmInput) registerPassConfirmInput.disabled = false;
      registerModal?.classList.remove('hidden');
      setTimeout(() => registerNameInput?.focus(), 0);
    }

    function hideRegistrationModal() {
      registerModal?.classList.add('hidden');
      if (registerError) registerError.textContent = '';
      if (registerPassInput) {
        registerPassInput.value = '';
        registerPassInput.disabled = true;
      }
      if (registerPassConfirmInput) {
        registerPassConfirmInput.value = '';
        registerPassConfirmInput.disabled = true;
      }
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
      const profileAvatar = String(profile?.avatar || '').trim();
      if (profileAvatar) {
        myAvatar = profileAvatar;
        avatarBtn.textContent = profileAvatar;
        try { await window.storage.set(AVATAR_KEY, profileAvatar, false); }
        catch (e) { console.error('Could not cache profile avatar', e); }
      }
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

    function ensureCatalogAdmin() {
      if (isCatalogAdmin()) return true;
      setStatus('Редактирование каталога доступно только в админ-панели.', true);
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
      if (modalAccountPass) {
        modalAccountPass.value = '';
        modalAccountPass.disabled = false;
      }
      nameModal.classList.remove('hidden');
      setTimeout(() => modalNameInput.focus(), 0);
    }

    function hideNameModal() {
      if (nameModal) nameModal.classList.add('hidden');
      if (modalNameError) modalNameError.textContent = '';
      if (modalAccountEmail) modalAccountEmail.value = '';
      if (modalAccountPass) {
        modalAccountPass.value = '';
        modalAccountPass.disabled = true;
      }
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
      const aggregate = scores.__oc_aggregate_stats;
      if (scores.__oc_prefer_aggregate && aggregate) return aggregate;
      if (!keys.length && aggregate && Number(aggregate.count) > 0) return aggregate;
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
      if (scores?.__oc_prefer_aggregate && scores.__oc_admin_aggregate_stats) return scores.__oc_admin_aggregate_stats;
      const values = Object.entries(scores || {})
        .filter(([nickname]) => isAdminNickname(nickname))
        .map(([,value]) => normalizePublicScore(value))
        .filter(value => value !== null);
      if (!values.length && scores?.__oc_admin_aggregate_stats) return scores.__oc_admin_aggregate_stats;
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
        ? `<img class="oc-track-image" loading="lazy" decoding="async" src="${escapeHtml(normalizeUrl(entry.image))}" data-fallback="${escapeHtml(normalizeUrl(entry.fallbackImage || ''))}" alt="${escapeHtml(entry.title)}">`
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
      if (!ensureCatalogAdmin()) return;
      const repairs = buildFranchiseRepairPlan();
      if (!repairs.length) {
        setStatus('Подозрительных франшиз по названию не найдено ✓');
        return;
      }
      renderFranchiseRepairModal(repairs);
    }

    async function applyFranchiseRepairsFromModal() {
      if (!ensureCatalogAdmin() || !franchiseRepairModal) return;
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

    function showMissingFieldsModal(fields) {
      const title = 'Не все поля заполнены';
      const body = `Вы не заполнили следующие поля: ${fields.join(', ')}`;
      if (!confirmModal) {
        window.alert(body);
        return;
      }
      confirmModal.innerHTML = `<div class="oc-modal-card oc-confirm-box">
        <div class="oc-modal-head">
          <div>
            <div class="oc-section-label">проверка карточки</div>
            <div class="oc-modal-title">${escapeHtml(title)}</div>
          </div>
        </div>
        <div class="oc-warning-text">${escapeHtml(body)}</div>
        <div class="oc-confirm-actions">
          <button type="button" class="oc-addbtn" data-missing-close>Вернуться к заполнению</button>
        </div>
      </div>`;
      confirmModal.classList.remove('hidden');
      const close = () => {
        confirmModal.classList.add('hidden');
        confirmModal.innerHTML = '';
      };
      confirmModal.querySelector('[data-missing-close]').addEventListener('click', close, { once: true });
      confirmModal.addEventListener('click', function onBg(event) {
        if (event.target === confirmModal) {
          confirmModal.removeEventListener('click', onBg);
          close();
        }
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
      let storedAvatar = '';
      try {
        const res = await window.storage.get(AVATAR_KEY, false);
        storedAvatar = String(res?.value || '').trim();
      } catch (e) { }
      const profileAvatar = String(accountProfile(myName)?.avatar || '').trim();
      myAvatar = profileAvatar || storedAvatar || myAvatar;
      if (profileAvatar && profileAvatar !=…42906 tokens truncated…ир. Пустое название сбросит его обратно.">
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
      const arrayValue = (arr, kind) => (arr || []).filter(Boolean).length ? entityFilterValuesMarkup(kind, arr) : '—';
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
        <div class="oc-detail-box"><div class="oc-detail-label">студии</div><div class="oc-detail-value">${arrayValue(entry.studios, 'studios')}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">режиссёры</div><div class="oc-detail-value">${arrayValue(entry.directors, 'directors')}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">исполнители</div><div class="oc-detail-value">${arrayValue(entry.performers, 'performers')}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">франшизы</div><div class="oc-detail-value">${arrayValue(entry.franchises, 'franchises')}</div></div>
        <div class="oc-detail-box"><div class="oc-detail-label">альт. названия</div><div class="oc-detail-value">${escapeHtml((entry.alternativeTitles || []).filter(Boolean).join(', ') || '—')}</div></div>
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
      const filtered = applyFilters(entries);
      const sorted = applySort(filtered);
      chartPage = clampPage(chartPage, sorted.length);
      const page = pageSlice(sorted, chartPage);
      resultCountEl.textContent = sorted.length
        ? `Показано: ${page.start + 1}–${Math.min(sorted.length, page.start + PAGE_SIZE)} из ${sorted.length} / всего ${entries.length}`
        : `Показано: 0 из ${entries.length}`;
      renderFilterStat(filtered);
      updateAccountDashboard();

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
        const hasSavedScore = isPersonalScale() ? myPersonalScore !== null : myPublicScore !== null;
        const controlsHtml = `
          <div class="oc-rate-control ${hasSavedScore ? 'is-saved' : 'is-empty'}" data-saved="${hasSavedScore ? escapeHtml(String(myVal)) : ''}">
          <div class="oc-rate-row">
            <input type="range" min="${ratingMin()}" max="${ratingMax()}" step="${scaleStep()}" value="${myVal}" class="oc-slider" data-id="${entry.id}" />
            <span class="oc-rate-val">${escapeHtml(formatInputScore(myVal))}</span>
          </div>
          </div>
          <button type="button" class="oc-rate-btn" data-action="rate" data-id="${entry.id}">${hasSavedScore ? 'Изменить оценку' : 'Оценить'}</button>
          <button type="button" class="oc-open-btn" data-action="open-card" data-id="${entry.id}">Карточка</button>
          <button type="button" class="oc-secondary-btn${hasSavedScore ? '' : ' hidden'}" data-action="delete-rating" data-id="${entry.id}">${isPersonalScale() ? 'удалить отметку' : 'удалить оценку'}</button>
          ${isCatalogAdmin() ? `<button type="button" class="oc-edit-btn" data-action="edit" data-id="${entry.id}">✎ редактировать</button>
          <button type="button" class="oc-del" data-action="delete" data-id="${entry.id}">удалить трек</button>` : ''}`;
        return renderUnifiedEntryCard(entry, {
          rankLabel,
          rankClass,
          scoreText,
          scoreSub: 'средняя',
          fields: ['studios', 'directors', 'performers', 'franchises'],
          notes: true,
          extraHtml: extraBits.join(''),
          votesHtml: `<div class="oc-votes">${chips}</div>`,
          controlsHtml,
          className: `main-card ${(myPublicScore !== null || myPersonalScore !== null) ? 'oc-card-rated' : ''}`
        });
      }).join('');

      const pager = paginationHtml('chart', chartPage, sorted.length);
      listContainer.innerHTML = `${pager}<div class="oc-list ${catalogView === 'compact' ? 'oc-list-compact' : ''}">${html}</div>${pager}`;
      bindPagination(listContainer, 'chart', () => chartPage, v => { chartPage = clampPage(v, sorted.length); }, render);

      listContainer.querySelectorAll('.oc-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          const control = e.target.closest('.oc-rate-control');
          control?.classList.add('is-dirty');
          e.target.parentElement.querySelector('.oc-rate-val').textContent = formatInputScore(val);
        });
      });

      listContainer.querySelectorAll('[data-action="rate"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (!ensureNickname()) return;
          const id = btn.getAttribute('data-id');
          const slider = listContainer.querySelector(`.oc-slider[data-id="${id}"]`);
          const val = clampScore(slider.value);
          const entry = entriesById.get(String(id));
          if (!entry || val === null) return;
          try {
            suppressChartRatingRefreshUntil = Date.now() + 3000;
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
            const card = btn.closest('.oc-unified-card');
            const control = btn.closest('.oc-card-actions')?.querySelector('.oc-rate-control');
            if (control) {
              control.classList.remove('is-empty', 'is-dirty');
              control.classList.add('is-saved');
              control.dataset.saved = String(val);
            }
            if (card) {
              card.classList.add('oc-card-rated');
              const scoreNode = card.querySelector('.oc-season-score');
              if (scoreNode) scoreNode.innerHTML = `${visibleAverageMarkup(entry, avg(entry.scores))}<span class="oc-season-score-sub">средняя</span>`;
              const votesNode = card.querySelector('.oc-votes');
              if (votesNode) {
                votesNode.innerHTML = Object.entries(entry.scores || {}).map(([voter, score]) => {
                  const mine = voter === myName ? ' mine' : '';
                  return `<span class="oc-chip${mine}">${avatarFor(voter)} ${escapeHtml(voter)}: ${formatScore(score)}</span>`;
                }).join('');
              }
            }
            btn.textContent = 'Изменить оценку';
            btn.closest('.oc-card-actions')?.querySelector('[data-action="delete-rating"]')?.classList.remove('hidden');
            updateAccountDashboard();
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
          if (!ensureCatalogAdmin()) return;
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
          if (!ensureCatalogAdmin()) return;
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

          if (imageChanged) {
            updatedEntry.fallbackImage = nextImage ? previousFallbackImage : '';
          }

          try {
            await window.OPED_DB.updateOpening(id, updatedEntry);
            await saveOpeningExtras(id, { franchises: updatedEntry.franchises, alternativeTitles: updatedEntry.alternativeTitles, isChinese: updatedEntry.isChinese, isMovie: updatedEntry.isMovie, isShortened: updatedEntry.isShortened, sameSongGroupId: updatedEntry.sameSongGroupId, sameSongTitle: updatedEntry.sameSongTitle });

            Object.assign(entry, updatedEntry);
            touchEntryCache(entry);
            editingId = null;
            populateFilterOptions();
            render();

            if (!imageChanged) {
              setStatus('Изменения сохранены ✓');
              return;
            }

            if (!nextImage) {
              setStatus('Изменения сохранены ✓');
              if (previousFallbackImage) void (async () => {
                try {
                  await deleteFallbackImageCopy(previousFallbackImage);
                } catch (deleteError) {
                  console.error('Old fallback image deletion failed', deleteError);
                  setStatus('Изменения сохранены, но старую резервную картинку удалить не удалось: ' + (deleteError.message || deleteError), true);
                }
              })();
              return;
            }

            setStatus('Изменения сохранены ✓ Новая резервная картинка создаётся в фоне…');
            void (async () => {
              try {
                const createdFallbackImage = await createFallbackImageCopy(nextImage, title, newType);
                await window.OPED_DB.updateOpeningFallbackImage(id, createdFallbackImage);
                entry.fallbackImage = createdFallbackImage;
                touchEntryCache(entry);

                if (previousFallbackImage && previousFallbackImage !== createdFallbackImage) {
                  try {
                    await deleteFallbackImageCopy(previousFallbackImage);
                  } catch (deleteError) {
                    console.error('Old fallback image deletion failed', deleteError);
                    setStatus('Изменения сохранены, но старую резервную картинку удалить не удалось: ' + (deleteError.message || deleteError), true);
                    return;
                  }
                }
                setStatus('Изменения и новая резервная картинка сохранены ✓');
              } catch (backupError) {
                console.warn('Edited track fallback image upload failed', backupError);
                setStatus('Изменения сохранены ✓ Но новую резервную картинку создать не удалось: ' + (backupError.message || backupError), true);
              }
            })();
          } catch (err) {
            console.error(err);
            setStatus('Не удалось сохранить изменения: ' + (err.message || err), true);
          }
        });
      });

      listContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (!ensureCatalogAdmin()) return;
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
          switchTab(tab);
        }
      });
    });

    document.querySelectorAll('[data-entity-home]').forEach(card => {
      card.addEventListener('click', () => {
        if (!requireAccount('Войди в аккаунт, чтобы открыть коллекции.')) return;
        switchTab('entity-' + card.getAttribute('data-entity-home'));
      });
    });

    if (entityCreateForm) entityCreateForm.addEventListener('submit', saveEntityAlbum);
    if (entityFiltersToggle) entityFiltersToggle.addEventListener('click', () => {
      entityFiltersExpanded = !entityFiltersExpanded;
      renderEntityAlbums();
    });
    entityAlbumSearchInput?.addEventListener('input', () => {
      entityCardRenderLimit = 40;
      renderEntityAlbums();
    });
    entityAlbumSortSelect?.addEventListener('change', () => {
      entityCardRenderLimit = 40;
      renderEntityAlbums();
    });
    if (entityBackBtn) entityBackBtn.addEventListener('click', () => {
      if (activeEntityCardId) {
        activeEntityCardId = '';
        resetEntityAlbumFilters();
        renderEntityAlbums();
      } else {
        switchTab('chart');
      }
    });
    [entitySearchInput, entityTrackTypeSelect, entityFromYearSelect, entityFromSeasonSelect, entityToYearSelect, entityToSeasonSelect, entityProgressSelect].forEach(el => {
      if (el) el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
        entityTrackRenderLimit = 30;
        renderEntityAlbums();
      });
    });
    if (entityRateAllBtn) entityRateAllBtn.addEventListener('click', startEntityRating);
    if (entityPanel) entityPanel.addEventListener('click', async event => {
      const open = event.target.closest('[data-entity-open]');
      if (open && !event.target.closest('[data-entity-delete]')) {
        activeEntityCardId = open.getAttribute('data-entity-open');
        entityFiltersExpanded = false;
        entityTrackRenderLimit = 30;
        renderEntityAlbums();
        return;
      }
      const rate = event.target.closest('[data-entity-rate]');
      if (rate) { startOpeningRating(rate.getAttribute('data-entity-rate')); return; }
      const remove = event.target.closest('[data-entity-delete]');
      if (remove && isCatalogAdmin() && confirm('Удалить этот альбом?')) {
        try { await window.OPED_DB.deleteEntityCard(remove.getAttribute('data-entity-delete')); setStatus('Альбом удалён.'); }
        catch (error) { console.error(error); setStatus('Не удалось удалить альбом.', true); }
      }
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
        toggleEntryInEventBasket(entry);
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
      const controller = new AbortController();
      const timeoutMs = path === '/proxy-image' ? 20000 : 30000;
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(IMAGE_UPLOAD_WORKER + path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Upload-Secret': secret },
          body: JSON.stringify(body),
          signal: controller.signal
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
        return responseType === 'blob' ? await response.blob() : await response.json();
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error(path === '/proxy-image'
            ? 'Источник картинки не ответил за 20 секунд'
            : 'Загрузка резервной картинки не завершилась за 30 секунд');
        }
        throw error;
      } finally {
        window.clearTimeout(timeout);
      }
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

    async function directImageRequest(imageUrl) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(imageUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          headers: { 'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
          signal: controller.signal
        });
        if (!response.ok) throw new Error('источник вернул HTTP ' + response.status);
        const type = String(response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
        if (!type.startsWith('image/') || type === 'image/svg+xml') {
          throw new Error('ссылка не ведёт на растровое изображение');
        }
        const announced = Number(response.headers.get('Content-Length') || 0);
        if (announced > 12 * 1024 * 1024) throw new Error('исходная картинка больше 12 МБ');
        const blob = await response.blob();
        if (blob.size > 12 * 1024 * 1024) throw new Error('исходная картинка больше 12 МБ');
        return blob;
      } catch (error) {
        if (error && error.name === 'AbortError') throw new Error('источник не ответил за 12 секунд');
        throw error;
      } finally {
        window.clearTimeout(timeout);
      }
    }

    async function downloadFallbackSource(imageUrl, secret) {
      let directError = null;
      try {
        return { blob: await directImageRequest(imageUrl), route: 'напрямую через браузер' };
      } catch (error) {
        directError = error;
      }
      try {
        return {
          blob: await workerImageRequest('/proxy-image', secret, { url: imageUrl }, 'blob'),
          route: 'через Cloudflare Worker'
        };
      } catch (workerError) {
        const directMessage = directError && directError.message ? directError.message : 'неизвестная ошибка';
        const workerMessage = workerError && workerError.message ? workerError.message : 'неизвестная ошибка';
        throw new Error('напрямую: ' + directMessage + '; через Worker: ' + workerMessage);
      }
    }

    async function createFallbackImageCopy(imageUrl, title, type, onProgress) {
      let stage = 'проверка пароля загрузчика';
      let stageStartedAt = Date.now();
      let bitmap = null;
      const report = (state, details) => {
        if (typeof onProgress !== 'function') return;
        onProgress({
          state,
          stage,
          details: details || '',
          elapsedMs: Math.max(0, Date.now() - stageStartedAt)
        });
      };
      const beginStage = nextStage => {
        stage = nextStage;
        stageStartedAt = Date.now();
        report('start');
      };
      const finishStage = details => report('done', details);
      try {
        beginStage('проверка пароля загрузчика');
        const secret = getImageUploadSecret();
        if (!secret) throw new Error('не введён UPLOAD_SECRET');
        finishStage();

        beginStage('скачивание основной картинки');
        setStatus('Скачиваю основную картинку для резервной копии…');
        const source = await downloadFallbackSource(imageUrl, secret);
        const sourceBlob = source.blob;
        finishStage(Math.max(1, Math.round(sourceBlob.size / 1024)) + ' КБ · ' + source.route);

        beginStage('декодирование картинки');
        setStatus('Проверяю и декодирую основную картинку…');
        bitmap = await createImageBitmap(sourceBlob);
        if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 50000000) {
          throw new Error('слишком большое разрешение исходной картинки');
        }
        finishStage(bitmap.width + '×' + bitmap.height);

        beginStage('уменьшение картинки');
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('браузер не смог создать Canvas');
        context.fillStyle = '#111';
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        bitmap = null;
        finishStage(width + '×' + height);

        beginStage('сжатие картинки в WebP');
        setStatus('Сжимаю картинку в WebP…');
        const webp = await canvasToWebp(canvas, 0.78);
        finishStage(Math.max(1, Math.round(webp.size / 1024)) + ' КБ');

        beginStage('подготовка картинки к загрузке');
        setStatus('Подготавливаю резервную картинку к загрузке…');
        const contentBase64 = await blobToBase64(webp);
        const path = compactImageFileName(title, type, imageUrl);
        finishStage(path);

        beginStage('загрузка резервной картинки в GitHub');
        setStatus('Загружаю резервную картинку в images/…');
        await workerImageRequest('/upload', secret, { path, contentBase64 }, 'json');
        finishStage(path);
        return path;
      } catch (error) {
        if (bitmap) bitmap.close();
        const message = error && error.message ? error.message : String(error || 'неизвестная ошибка');
        report('error', message);
        throw new Error('Проблема на этапе «' + stage + '»: ' + message);
      }
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
      if (!ensureCatalogAdmin()) return;
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
      if (imageMigrationRunning || !ensureCatalogAdmin()) return;
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
        appendImageMigrationLog('▶ ' + (index + 1) + '/' + candidates.length + ' · ' + entry.title);
        try {
          const fallbackImage = await createFallbackImageCopy(entry.image, entry.title, entry.type, progress => {
            const seconds = (progress.elapsedMs / 1000).toFixed(1) + ' с';
            if (progress.state === 'start') {
              appendImageMigrationLog('  … ' + progress.stage);
            } else if (progress.state === 'done') {
              appendImageMigrationLog('  ✓ ' + progress.stage + ' · ' + seconds + (progress.details ? ' · ' + progress.details : ''));
            } else {
              appendImageMigrationLog('  ✕ ' + progress.stage + ' · ' + seconds + ' · ' + progress.details, true);
            }
          });
          appendImageMigrationLog('  … сохранение ссылки fallbackImage в Firebase');
          const firebaseStartedAt = Date.now();
          if (typeof window.OPED_DB.updateOpeningFallbackImage === 'function') {
            await window.OPED_DB.updateOpeningFallbackImage(entry.id, fallbackImage);
          } else {
            await window.OPED_DB.updateOpening(entry.id, { ...entry, fallbackImage });
          }
          appendImageMigrationLog('  ✓ сохранение ссылки fallbackImage в Firebase · ' + ((Date.now() - firebaseStartedAt) / 1000).toFixed(1) + ' с');
          entry.fallbackImage = fallbackImage;
          success++;
          appendImageMigrationLog('✓ Готово: ' + entry.title + ' → ' + fallbackImage);
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
    if (imageMigrationInlineBtn) imageMigrationInlineBtn.addEventListener('click', openImageMigrationModal);
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
      if (!ensureCatalogAdmin()) return;
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

      const addEntry = { title, type, year, season, studios, directors, performers, franchises, image, link };
      const missingFields = missingAddFormFields(addEntry);
      if (missingFields.length) {
        showMissingFieldsModal(missingFields);
        return;
      }
      if (isDuplicateTitle(title, type, null)) { setStatus(`Такой ${type} уже есть. OP и ED проверяются отдельно.`, true); return; }
      if (!(await confirmSimilarTitleIfNeeded(title, type, null))) {
        setStatus('Добавление отменено: похоже на дубль.');
        return;
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
        try { localStorage.setItem('op-ed-last-added-title-v1', title); } catch (_) {}

        const resetAddControl = (id, value, checked) => {
          if (window.OC_ADD_FIELD_PINS?.isPinned?.(id)) return;
          const control = $('#' + id);
          if (!control) return;
          if (control.type === 'checkbox') control.checked = Boolean(checked);
          else control.value = value;
        };
        resetAddControl('oc-add-title', '');
        resetAddControl('oc-add-type', 'OP');
        resetAddControl('oc-add-year', '');
        resetAddControl('oc-add-season', '');
        resetAddControl('oc-add-studio', '');
        resetAddControl('oc-add-director', '');
        resetAddControl('oc-add-performer', '');
        resetAddControl('oc-add-same-song', '');
        resetAddControl('oc-add-franchise', '');
        resetAddControl('oc-add-alt-titles', '');
        resetAddControl('oc-add-image', '');
        resetAddControl('oc-add-fallback-image', '');
        resetAddControl('oc-add-link', '');
        resetAddControl('oc-add-chinese', '', false);
        resetAddControl('oc-add-movie', '', false);
        resetAddControl('oc-add-shortened', '', false);
        resetAddControl('oc-add-backup-image', '', true);

        const shouldCreateBackup = Boolean(image && makeImageBackup && !fallbackImage && createdRef && createdRef.id);
        if (!shouldCreateBackup) {
          setStatus('Трек добавлен ✓');
          return;
        }

        setStatus('Трек добавлен ✓ Резервная картинка создаётся в фоне…');
        void (async () => {
          try {
            const createdFallbackImage = await createFallbackImageCopy(image, title, type);
            await window.OPED_DB.updateOpeningFallbackImage(createdRef.id, createdFallbackImage);
            setStatus('Трек и резервная картинка добавлены ✓');
          } catch (backupError) {
            console.warn('Fallback image upload failed', backupError);
            const message = backupError && backupError.message ? backupError.message : 'неизвестная ошибка';
            setStatus('Трек добавлен ✓ Но запасная картинка не создана: ' + message, true);
          }
        })();
      } catch (err) {
        console.error(err);
        const message = err && err.message ? err.message : 'неизвестная ошибка';
        setStatus('Не удалось добавить трек: ' + message, true);
      }
    });

    function normalizeMainFilterRange() {
      if (!filters.fromYear || !filters.toYear) return;
      const start = Number(filters.fromYear) * 4 + SEASON_ORDER.indexOf(filters.fromSeason);
      const end = Number(filters.toYear) * 4 + SEASON_ORDER.indexOf(filters.toSeason);
      if (start <= end) return;
      [filters.fromYear, filters.toYear] = [filters.toYear, filters.fromYear];
      [filters.fromSeason, filters.toSeason] = [filters.toSeason, filters.fromSeason];
    }

    function applyFilterChange() {
      normalizeMainFilterRange();
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
    bindSimpleFilter('#oc-f-from-year', 'fromYear');
    bindSimpleFilter('#oc-p-from-year', 'fromYear');
    bindSimpleFilter('#oc-f-from-season', 'fromSeason');
    bindSimpleFilter('#oc-p-from-season', 'fromSeason');
    bindSimpleFilter('#oc-f-to-year', 'toYear');
    bindSimpleFilter('#oc-p-to-year', 'toYear');
    bindSimpleFilter('#oc-f-to-season', 'toSeason');
    bindSimpleFilter('#oc-p-to-season', 'toSeason');
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
      filters.search = ''; filters.type = ''; filters.fromYear = ''; filters.fromSeason = 'winter'; filters.toYear = ''; filters.toSeason = 'fall'; filters.scoreCmp = ''; filters.scoreValue = ''; filters.missingOnly = false;
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
    profileUserSelect.addEventListener('change', () => { manualEditMode = false; manualShowHidden = false; profileTopExpanded = { OP: false, ED: false }; allRatingsPage = { OP: 1, ED: 1 }; profileTopPage = { OP: 1, ED: 1 }; renderProfile(); });

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
        globalTopRenderLimit = 30;
        renderGlobalTop100();
      });
    });
    document.querySelectorAll('[data-globaltop-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        globalTopMode = btn.dataset.globaltopMode === 'score' ? 'score' : 'manual';
        globalTopRenderLimit = 30;
        renderGlobalTop100();
      });
    });
    document.querySelectorAll('[data-globaltop-scope]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!isAdmin()) return;
        globalTopScope = btn.dataset.globaltopScope === 'admins' ? 'admins' : 'all';
        globalTopRenderLimit = 30;
        renderGlobalTop100();
      });
    });

    authRegisterOpenBtn?.addEventListener('click', showRegistrationModal);
    document.addEventListener('click', event => {
      const target = event.target.closest('[data-entity-filter-kind][data-entity-filter-value]');
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      applyEntityCardFilter(target.dataset.entityFilterKind, target.dataset.entityFilterValue);
    });
    window.addEventListener('oped-catalog-view-change', event => {
      catalogView = event.detail === 'compact' ? 'compact' : 'detailed';
    });
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
        const result = await window.OPED_DB.registerAccount(nickname, email, password, Boolean(registerRememberInput?.checked));
        const patch = { authUid: result?.user?.uid, authProvider: 'password', passwordEnabled: true };
        const row = accountProfile(nickname);
        if (row) Object.assign(row, patch);
        else firebaseUserProfiles.push({ id: normalizedAccountName(nickname), nickname, nicknameKey: normalizedAccountName(nickname), ...patch });
        registerNameInput.value = '';
        registerEmailInput.value = '';
        registerPassInput.value = '';
        registerPassConfirmInput.value = '';
        if (registerSaveBtn) { registerSaveBtn.disabled = false; registerSaveBtn.textContent = registerButtonText; }
        hideRegistrationModal();
        await applyPersonalAccountSession(result, Boolean(registerRememberInput?.checked));
        setStatus(`Аккаунт «${nickname}» создан, вход выполнен ✓`);
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
        script.src = 'html2canvas.min.js?v=1.4.1';
        script.async = true;
        script.onload = () => window.html2canvas ? resolve(window.html2canvas) : reject(new Error('html2canvas не загрузился'));
        script.onerror = () => {
          window._opedHtml2CanvasPromise = null;
          reject(new Error('Не удалось загрузить html2canvas'));
        };
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
          setTimeout(() => URL.revokeObjectURL(pngUrl), 30000);
          setStatus('Тир-лист скачан как PNG-скриншот ✓');
        }, 'image/png');
      } catch (err) {
        console.error(err);
        exportWrap.remove();
        setStatus('Не удалось создать изображение.', true);
      }
    }


    let personalSessionRestorePromise = null;

    async function restorePersonalSession(clearWhenMissing = false) {
      if (personalSessionRestorePromise) return personalSessionRestorePromise;
      personalSessionRestorePromise = (async () => {
        try {
          const db = await waitForFirebaseDb();
          const resumed = await db.resumePersonalAccount();
          if (resumed) {
            await applyPersonalAccountSession(resumed, true);
            return true;
          }
          if (clearWhenMissing) {
            authenticatedUid = '';
            accessLevel = '';
            sessionStorage.removeItem(ACCESS_KEY);
            updateAccessUi();
          }
          return false;
        } catch (error) {
          console.warn('Saved personal session restore failed', error);
          return false;
        } finally {
          personalSessionRestorePromise = null;
        }
      })();
      return personalSessionRestorePromise;
    }

    window.addEventListener('oped-account-restored', event => {
      if (event?.detail?.authenticated && !authenticatedUid) void restorePersonalSession(false);
    });

    (async function init() {
      updateAccessUi();
      await restorePersonalSession(true);
      await loadName();
      await loadAvatar();
      await loadScale();
      await loadContentFilterMode();
      await loadAvatarsMap();
      await loadManualRanks();
      if (myName && !avatarsMap[myName]) avatarsMap[myName] = myAvatar;
      await loadTierOrders();
      await loadEntries();
      refreshDailyUi();
      if (accessLevel && !myName) showNameModal('Введите никнейм, чтобы продолжить.');
    })();
  })();
