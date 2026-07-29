/* Generated profile route bundle. */
/* manual-top-existing-migration.js */
(() => {
  if (window.__OC_MANUAL_TOP_EXISTING_MIGRATION_READY__) return;
  window.__OC_MANUAL_TOP_EXISTING_MIGRATION_READY__ = true;
  return;

  const clean = value => String(value ?? '').trim();
  const uniqueIds = values => [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))].slice(0, 100);
  let running = false;
  let completedFor = '';

  function normalize(value) {
    try {
      return window.OPED_DB?.normalizeNickname?.(value)
        || clean(value).toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
    } catch (_) {
      return clean(value).toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
    }
  }

  function ownUser() {
    return clean(
      document.querySelector('#oc-myname')?.value
      || localStorage.getItem('op-ed-primary-account-name')
      || localStorage.getItem('my-display-name')
    );
  }

  function topFrom(row) {
    if (!row || typeof row !== 'object') return { OP: [], ED: [] };
    return {
      OP: uniqueIds(row.OP || row.manualOP || row.op || []),
      ED: uniqueIds(row.ED || row.manualED || row.ed || [])
    };
  }

  function hasTop(top) {
    return Boolean(top && (top.OP?.length || top.ED?.length));
  }

  function legacyLocalTop(user, key) {
    try {
      const raw = JSON.parse(localStorage.getItem('manual-ranks') || '{}');
      const candidates = [raw?.[user], raw?.[key]];
      for (const row of candidates) {
        const top = topFrom(row);
        if (hasTop(top)) return top;
      }
    } catch (error) {
      console.warn('Could not read legacy local manual top', error);
    }
    return null;
  }

  function visibleManualTop(user, key) {
    const viewed = clean(document.querySelector('#oc-profile-user')?.value || user);
    if (!viewed || normalize(viewed) !== key) return null;

    const manualMode = document.querySelector('#oc-topmode-manual');
    const scoreMode = document.querySelector('#oc-topmode-score');
    if (scoreMode?.classList.contains('active')) return null;
    if (manualMode && !manualMode.classList.contains('active')) return null;

    const collect = selector => {
      const container = document.querySelector(selector);
      if (!container) return [];
      const result = [];
      const seen = new Set();
      container.querySelectorAll(':scope > .oc-profile-item').forEach(card => {
        const id = clean(
          card.dataset.explicitTopId
          || card.querySelector('[data-action="set-rank"][data-id]')?.dataset.id
          || card.querySelector('[data-action="open-card"][data-id]')?.dataset.id
          || card.querySelector('[data-id]')?.dataset.id
        );
        if (!id || seen.has(id) || result.length >= 100) return;
        seen.add(id);
        result.push(id);
      });
      return result;
    };

    const top = { OP: collect('#oc-profile-op'), ED: collect('#oc-profile-ed') };
    return hasTop(top) ? top : null;
  }

  async function waitForDb() {
    if (window.OPED_DB?.saveManualRanks) return window.OPED_DB;
    await Promise.race([
      new Promise(resolve => window.addEventListener('oped-db-ready', resolve, { once: true })),
      new Promise(resolve => setTimeout(resolve, 8000))
    ]);
    return window.OPED_DB?.saveManualRanks ? window.OPED_DB : null;
  }

  async function firebaseTools() {
    const [{ getApp, getApps }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
    ]);
    for (let attempt = 0; attempt < 120 && !getApps().length; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!getApps().length) throw new Error('Firebase ещё не готов.');
    return { db: firestore.getFirestore(getApp()), ...firestore };
  }

  async function migrateExistingTop() {
    if (running) return;
    const user = ownUser();
    const key = normalize(user);
    if (!user || !key || completedFor === key) return;

    running = true;
    try {
      const dbApi = await waitForDb();
      if (!dbApi) return;

      const tools = await firebaseTools();
      const manualRef = tools.doc(tools.db, 'manualRanks', key);
      const manualSnap = await tools.getDoc(manualRef);
      const currentTop = manualSnap.exists() ? topFrom(manualSnap.data() || {}) : { OP: [], ED: [] };

      // A non-empty current manualRanks document is authoritative.
      if (hasTop(currentTop)) {
        completedFor = key;
        return;
      }

      // If current storage is empty, recover any real top that still exists in an
      // older mirror, local storage or the already-rendered manual profile view.
      let existingTop = null;
      const profileSnap = await tools.getDoc(tools.doc(tools.db, 'userProfiles', key));
      if (profileSnap.exists()) {
        const profileTop = topFrom(profileSnap.data() || {});
        if (hasTop(profileTop)) existingTop = profileTop;
      }

      if (!existingTop) existingTop = legacyLocalTop(user, key);
      if (!existingTop) existingTop = visibleManualTop(user, key);

      // Do not mark the user as completed yet. The profile/top package may still
      // be rendering; later timers and the observer will retry and can recover it.
      if (!hasTop(existingTop)) return;

      await dbApi.saveManualRanks(user, existingTop);
      completedFor = key;
      try { localStorage.removeItem(`oc-explicit-top-draft-v1:${key}`); } catch (_) {}
      document.dispatchEvent(new CustomEvent('oc:top100-saved', {
        detail: { user, OP: existingTop.OP.slice(), ED: existingTop.ED.slice(), migrated: true }
      }));
      window.OC_TOAST?.show?.('Существующий топ-100 сохранён как актуальный ✓', { type: 'success' });
    } catch (error) {
      console.warn('Existing manual top migration skipped', error);
    } finally {
      running = false;
    }
  }

  function retrySoon() {
    window.setTimeout(migrateExistingTop, 0);
  }

  window.addEventListener('oped-account-restored', retrySoon);
  window.addEventListener('oped-db-ready', retrySoon);
  window.addEventListener('pageshow', () => window.setTimeout(migrateExistingTop, 50));
  document.querySelector('#oc-profile-user')?.addEventListener('change', retrySoon);

  const profile = document.querySelector('#oc-profile-panel');
  if (profile) {
    new MutationObserver(() => retrySoon()).observe(profile, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-profile-view'] });
  }

  [0, 300, 1000, 2500, 5000, 8000, 12000].forEach(delay => window.setTimeout(migrateExistingTop, delay));
})();

/* profile-tabs.js */
(() => {
  if (window.__OC_PROFILE_TABS_READY__) return;

  const VIEWS = new Set(['overview', 'top100', 'ratings', 'daily', 'events']);
  const STORAGE_KEY = 'oc-profile-subtab';
  let currentView = 'overview';
  let statsEnhanceScheduled = false;

  function panel() {
    return document.querySelector('#oc-profile-panel');
  }

  function setVisible(selector, visible) {
    panel()?.querySelectorAll(selector).forEach(element => {
      element.classList.toggle('oc-profile-section-hidden', !visible);
    });
  }

  function ensureTabs() {
    const root = panel();
    if (!root || root.querySelector('.oc-profile-subtabs')) return;
    const anchor = root.querySelector('.oc-profile-select-wrap');
    if (!anchor) return;

    const tabs = document.createElement('div');
    tabs.className = 'oc-profile-subtabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Разделы профиля');
    tabs.innerHTML = `
      <button type="button" role="tab" data-profile-view="overview">Обзор</button>
      <button type="button" role="tab" data-profile-view="top100">Мой топ-100</button>
      <button type="button" role="tab" data-profile-view="ratings">Все оценки</button>
      <button type="button" role="tab" data-profile-view="daily">Дейлики</button>
      <button type="button" role="tab" data-profile-view="events">Мои ивенты</button>`;
    anchor.insertAdjacentElement('afterend', tabs);

    tabs.addEventListener('click', event => {
      const button = event.target.closest('[data-profile-view]');
      if (button) setView(button.dataset.profileView, true);
    });

    tabs.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const buttons = [...tabs.querySelectorAll('[data-profile-view]')];
      const activeIndex = buttons.findIndex(button => button.dataset.profileView === currentView);
      if (activeIndex < 0) return;
      event.preventDefault();
      const offset = event.key === 'ArrowRight' ? 1 : -1;
      const next = buttons[(activeIndex + offset + buttons.length) % buttons.length];
      setView(next.dataset.profileView, true);
      next.focus();
    });
  }

  function statLabel(card) {
    return String(card.querySelector('.oc-stat-label')?.textContent || '').trim().toLowerCase();
  }

  function isLeaderStat(card) {
    return /^топ\s*-?\s*\d+/i.test(statLabel(card));
  }

  function statTone(card) {
    const label = statLabel(card);
    if (/(^|[\s·])op($|[\s·])/i.test(label)) return 'op';
    if (/(^|[\s·])ed($|[\s·])/i.test(label)) return 'ed';
    if (label.includes('песня')) return 'song';
    if (label.includes('визуал')) return 'visual';
    return 'neutral';
  }

  function overviewHeading(kind, title, subtitle) {
    const heading = document.createElement('div');
    heading.className = `oc-profile-overview-heading oc-profile-overview-heading-${kind}`;
    const copy = document.createElement('div');
    const kicker = document.createElement('span');
    kicker.textContent = kind === 'summary' ? 'профиль в цифрах' : 'лучшие категории';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    const p = document.createElement('p');
    p.textContent = subtitle;
    copy.append(kicker, h3, p);
    heading.append(copy);
    return heading;
  }

  function enhanceOverviewStats() {
    statsEnhanceScheduled = false;
    const root = panel();
    const stats = root?.querySelector('#oc-profile-stats');
    if (!stats) return;

    const cards = [...stats.children].filter(element => element.classList.contains('oc-stat-card'));
    if (!cards.length) return;

    cards.forEach(card => {
      const leader = isLeaderStat(card);
      card.classList.toggle('oc-profile-metric-card', !leader);
      card.classList.toggle('oc-profile-leader-card', leader);
      card.dataset.profileStatTone = statTone(card);
    });

    const firstMetric = cards.find(card => !isLeaderStat(card));
    const firstLeader = cards.find(isLeaderStat);

    let summary = stats.querySelector('.oc-profile-overview-heading-summary');
    if (!summary) summary = overviewHeading('summary', 'Ключевые показатели', 'Средние оценки и прогресс по каталогу без лишней россыпи карточек.');
    if (firstMetric) stats.insertBefore(summary, firstMetric);

    let leaders = stats.querySelector('.oc-profile-overview-heading-leaders');
    if (firstLeader) {
      if (!leaders) leaders = overviewHeading('leaders', 'Лидеры', 'Студии, исполнители, режиссёры, франшизы и сезоны — крупными, читаемыми блоками.');
      stats.insertBefore(leaders, firstLeader);
    } else if (leaders) {
      leaders.remove();
    }
  }

  function scheduleOverviewStats() {
    if (statsEnhanceScheduled) return;
    statsEnhanceScheduled = true;
    requestAnimationFrame(enhanceOverviewStats);
  }

  function syncManualOwnershipControls() {
    const root = panel();
    if (!root) return;
    const editButton = root.querySelector('#oc-manual-edit-btn');
    const saveButton = root.querySelector('#oc-manual-save-btn');
    if (!editButton && !saveButton) return;

    const ownProfile = Boolean(editButton && !editButton.disabled);
    if (editButton) editButton.style.display = ownProfile ? '' : 'none';
    if (saveButton) saveButton.style.display = ownProfile ? '' : 'none';
  }

  function scheduleManualOwnershipSync() {
    requestAnimationFrame(syncManualOwnershipControls);
  }

  function ensureDailyPlaceholder() {
    const root = panel();
    const daily = root?.querySelector('#oc-daily-panel');
    if (!root || !daily) return null;
    let placeholder = root.querySelector('.oc-profile-daily-placeholder');
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'oc-profile-daily-placeholder oc-empty';
      placeholder.textContent = 'Настройки ежедневной оценки появятся здесь для выбранного профиля.';
      daily.insertAdjacentElement('afterend', placeholder);
    }
    return placeholder;
  }

  function syncDailyPlaceholder() {
    const root = panel();
    const daily = root?.querySelector('#oc-daily-panel');
    const placeholder = ensureDailyPlaceholder();
    if (!daily || !placeholder) return;
    placeholder.hidden = currentView !== 'daily' || !daily.classList.contains('hidden');
  }

  function setView(view, persist = false) {
    currentView = VIEWS.has(view) ? view : 'overview';
    const root = panel();
    if (!root) return;
    ensureTabs();

    root.dataset.profileView = currentView;
    root.querySelectorAll('.oc-profile-subtabs [data-profile-view]').forEach(button => {
      const active = button.dataset.profileView === currentView;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });

    setVisible('#oc-profile-stats', currentView === 'overview');
    setVisible('.oc-topmode-toggle,.oc-topmode-hint,.oc-manual-actions,.oc-profile-columns', currentView === 'top100');
    setVisible('.oc-allratings', currentView === 'ratings');
    setVisible('#oc-daily-panel', currentView === 'daily');
    setVisible('#oc-my-events-panel', currentView === 'events');
    setVisible('.oc-profile-filterbar', currentView === 'top100' || currentView === 'ratings');
    syncDailyPlaceholder();
    scheduleManualOwnershipSync();
    if (currentView === 'overview') scheduleOverviewStats();

    if (persist) {
      try { sessionStorage.setItem(STORAGE_KEY, currentView); } catch (_) {}
    }
  }

  function initProfileTabs() {
    if (window.__OC_PROFILE_TABS_READY__) return;
    const root = panel();
    if (!root) return;

    ensureTabs();
    let saved = 'overview';
    try { saved = sessionStorage.getItem(STORAGE_KEY) || 'overview'; } catch (_) {}
    setView(saved, false);

    const stats = root.querySelector('#oc-profile-stats');
    if (stats) {
      new MutationObserver(scheduleOverviewStats).observe(stats, { childList: true });
      scheduleOverviewStats();
    }

    const editButton = root.querySelector('#oc-manual-edit-btn');
    if (editButton) {
      new MutationObserver(scheduleManualOwnershipSync).observe(editButton, {
        attributes: true,
        attributeFilter: ['disabled']
      });
    }
    root.querySelector('#oc-profile-user')?.addEventListener('change', () => window.setTimeout(syncManualOwnershipControls, 0));
    document.querySelector('#oc-myname')?.addEventListener('change', () => window.setTimeout(syncManualOwnershipControls, 0));
    document.querySelector('#oc-myname')?.addEventListener('input', () => window.setTimeout(syncManualOwnershipControls, 0));
    scheduleManualOwnershipSync();

    const daily = root.querySelector('#oc-daily-panel');
    if (daily) {
      new MutationObserver(() => syncDailyPlaceholder()).observe(daily, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true
      });
    }

    document.querySelector('#oc-daily-bell')?.addEventListener('click', () => {
      window.setTimeout(() => {
        if (!root.classList.contains('hidden')) setView('daily', true);
      }, 0);
    });

    window.__OC_PROFILE_TABS_READY__ = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initProfileTabs, { once: true });
  else initProfileTabs();
})();

/* profile-stats-designs.js */
(() => {
  if (window.__OC_PROFILE_STATS_DESIGNS_READY__) return;
  window.__OC_PROFILE_STATS_DESIGNS_READY__ = true;

  let statsObserver = null;
  let observedStats = null;
  let mountQueued = false;

  function statLabel(card) {
    return String(card.querySelector('.oc-stat-label')?.textContent || '').trim().toLowerCase();
  }

  function isLeader(card) {
    return /^топ\s*-?\s*\d+/i.test(statLabel(card));
  }

  function clearTailMeta(card) {
    delete card.dataset.statsTailSize;
    delete card.dataset.statsTailPos;
  }

  function markTail(cards, columns) {
    cards.forEach(clearTailMeta);
    if (!cards.length || cards.length <= columns) return;
    const tailSize = cards.length % columns;
    if (!tailSize) return;
    const start = cards.length - tailSize;
    for (let index = start; index < cards.length; index += 1) {
      cards[index].dataset.statsTailSize = String(tailSize);
      cards[index].dataset.statsTailPos = String(index - start + 1);
    }
  }

  function annotateCards(stats) {
    const allCards = [...stats.querySelectorAll(':scope > .oc-stat-card')];
    allCards.forEach(card => {
      const leader = isLeader(card);
      card.classList.toggle('oc-profile-metric-card', !leader);
      card.classList.toggle('oc-profile-leader-card', leader);
    });

    const metrics = allCards.filter(card => !isLeader(card));
    const leaders = allCards.filter(isLeader);

    metrics.forEach((card, index) => { card.dataset.statsMetricIndex = String(index); });
    leaders.forEach((card, index) => { card.dataset.statsLeaderIndex = String(index); });

    stats.dataset.statsMetricCount = String(metrics.length);
    stats.dataset.statsLeaderCount = String(leaders.length);
    markTail(metrics, 4);
    markTail(leaders, 3);
  }

  function observeStats(stats) {
    if (observedStats === stats) return;
    statsObserver?.disconnect();
    observedStats = stats;
    statsObserver = new MutationObserver(() => queueMount());
    statsObserver.observe(stats, { childList: true });
  }

  function mount() {
    mountQueued = false;
    const stats = document.querySelector('#oc-profile-stats');
    if (!stats) return;

    stats.querySelector(':scope > .oc-stats-design-switch')?.remove();
    stats.dataset.statsDesign = 'showcase';
    annotateCards(stats);
    observeStats(stats);
  }

  function queueMount() {
    if (mountQueued) return;
    mountQueued = true;
    requestAnimationFrame(() => requestAnimationFrame(mount));
  }

  const profile = document.querySelector('#oc-profile-panel');
  if (profile) {
    new MutationObserver(queueMount).observe(profile, {
      attributes: true,
      attributeFilter: ['data-profile-view'],
      childList: true,
      subtree: false
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueMount, { once: true });
  else queueMount();
})();

/* profile-filters.js */
(() => {
  if (window.__OC_PROFILE_FILTERS_READY__) return;

  function fieldFor(id, root) {
    return root.querySelector(`#${id}`)?.closest('.oc-field') || null;
  }

  function initProfileFilters() {
    if (window.__OC_PROFILE_FILTERS_READY__) return;
    const bar = document.querySelector('#oc-profile-panel .oc-profile-filterbar');
    const grid = bar?.querySelector(':scope > .oc-filtergrid');
    if (!bar || !grid) return;

    const missing = grid.querySelector('#oc-p-missing');
    if (missing) {
      missing.checked = false;
      missing.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const mainIds = ['oc-p-search', 'oc-p-type', 'oc-p-score-cmp', 'oc-p-from-year', 'oc-p-to-year'];
    const advancedIds = ['oc-p-studio', 'oc-p-director', 'oc-p-performer', 'oc-p-franchise'];
    const mainFields = mainIds.map(id => fieldFor(id, grid)).filter((field, index, rows) => field && rows.indexOf(field) === index);
    const advancedFields = advancedIds.map(id => fieldFor(id, grid)).filter(Boolean);
    const reset = grid.querySelector('#oc-p-reset-filters');
    if (!mainFields.length || !advancedFields.length || !reset) return;

    const main = document.createElement('div');
    main.className = 'oc-profile-filter-main';
    mainFields.forEach(field => main.append(field));
    main.append(reset);

    const divider = document.createElement('div');
    divider.className = 'oc-profile-filter-divider';
    divider.innerHTML = '<span>Расширенные фильтры</span>';

    const advanced = document.createElement('div');
    advanced.className = 'oc-profile-filter-advanced';
    advancedFields.forEach(field => advanced.append(field));

    grid.replaceWith(main, divider, advanced);
    bar.classList.add('oc-profile-filterbar-polished');
    window.__OC_PROFILE_FILTERS_READY__ = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initProfileFilters, { once: true });
  else initProfileFilters();
})();

/* profile-events-ownership.js */
(() => {
  if (window.__OC_PROFILE_EVENTS_OWNERSHIP_READY__) return;
  window.__OC_PROFILE_EVENTS_OWNERSHIP_READY__ = true;

  const clean = value => String(value || '').trim();
  const norm = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60);

  function profilePanel() {
    return document.querySelector('#oc-profile-panel');
  }

  function profileSelect() {
    return document.querySelector('#oc-profile-user');
  }

  function eventsTab() {
    return profilePanel()?.querySelector('.oc-profile-subtabs [data-profile-view="events"]');
  }

  function currentAccountName() {
    return clean(
      document.querySelector('#oc-myname')?.value ||
      localStorage.getItem('op-ed-primary-account-name') ||
      localStorage.getItem('my-display-name') || ''
    );
  }

  function selectedProfileName() {
    return clean(profileSelect()?.value);
  }

  function ownProfileSelected() {
    const account = currentAccountName();
    const selected = selectedProfileName();
    return Boolean(account && (!selected || norm(account) === norm(selected)));
  }

  function leaveForeignEventsView() {
    const panel = profilePanel();
    if (!panel || panel.dataset.profileView !== 'events') return;
    panel.querySelector('.oc-profile-subtabs [data-profile-view="overview"]')?.click();
  }

  function syncEventsTabVisibility() {
    const tab = eventsTab();
    if (!tab) return;
    const own = ownProfileSelected();
    tab.hidden = !own;
    tab.style.display = own ? '' : 'none';
    tab.setAttribute('aria-hidden', own ? 'false' : 'true');
    tab.tabIndex = own ? (tab.classList.contains('active') ? 0 : -1) : -1;
    if (!own) leaveForeignEventsView();
  }

  function selectOwnProfile() {
    const select = profileSelect();
    const account = currentAccountName();
    if (!select || !account) return false;
    const option = [...select.options].find(item => norm(item.value || item.textContent) === norm(account));
    if (!option) return false;
    if (select.value !== option.value) {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  function openOwnEvents() {
    const profileButton = document.querySelector('.oc-tab-btn[data-tab="profile"]');
    if (profileButton && !profileButton.classList.contains('active')) profileButton.click();

    const open = () => {
      selectOwnProfile();
      syncEventsTabVisibility();
      const tab = eventsTab();
      if (!tab || tab.hidden) return;
      tab.click();
      tab.focus?.();
    };

    requestAnimationFrame(() => {
      open();
      window.setTimeout(open, 60);
    });
  }

  function eventNoticeActive() {
    const bell = document.querySelector('#oc-daily-bell');
    if (!bell) return false;
    return bell.classList.contains('oc-event-notice') || Number(bell.dataset.eventNoticeCount || 0) > 0;
  }

  function bind() {
    const select = profileSelect();
    select?.addEventListener('change', () => window.setTimeout(syncEventsTabVisibility, 0));
    document.querySelector('#oc-myname')?.addEventListener('input', syncEventsTabVisibility);
    document.querySelector('#oc-myname')?.addEventListener('change', syncEventsTabVisibility);

    document.addEventListener('click', event => {
      const bell = event.target.closest?.('#oc-daily-bell');
      if (!bell || !eventNoticeActive()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openOwnEvents();
    }, true);

    const panel = profilePanel();
    if (panel) {
      new MutationObserver(syncEventsTabVisibility).observe(panel, { childList: true, subtree: true });
    }
    if (select) {
      new MutationObserver(syncEventsTabVisibility).observe(select, { childList: true, subtree: true });
    }

    window.addEventListener('oped-account-restored', () => window.setTimeout(syncEventsTabVisibility, 0));
    window.addEventListener('oped:user-profiles-updated', syncEventsTabVisibility);
    window.addEventListener('oped:route-ready', event => {
      if (event?.detail?.tab === 'profile') syncEventsTabVisibility();
    });
    window.addEventListener('storage', event => {
      if (['op-ed-primary-account-name', 'my-display-name'].includes(event.key)) syncEventsTabVisibility();
    });

    syncEventsTabVisibility();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();

/* registered-users-only.js */
(() => {
  if (window.__OC_REGISTERED_USERS_ONLY_READY__) return;
  window.__OC_REGISTERED_USERS_ONLY_READY__ = true;

  const PROFILE_LIST_ID = 'oc-profile-user';
  const EVENT_DATALIST_ID = 'ev-known-participants';
  const ADMIN_ORDER = ['пес_кошачий', 'пёс_кошачий', 'toxexex', 'egortos', 'кофа'];
  let knownByKey = new Map();
  let profilesLoaded = false;
  let syncQueued = false;

  const clean = value => String(value || '').trim();
  const normalize = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60);

  function profileName(row) {
    return clean(row?.nickname || row?.displayName || row?.name || row?.nicknameKey || row?.id);
  }

  function adminRank(rowOrName) {
    const name = typeof rowOrName === 'string' ? rowOrName : profileName(rowOrName);
    const key = normalize(name);
    const ranks = ['пес_кошачий', 'toxexex', 'egortos', 'кофа'];
    return ranks.indexOf(key);
  }

  function isAdminProfile(rowOrName) {
    return adminRank(rowOrName) >= 0;
  }

  function compareProfiles(a, b) {
    const rankA = adminRank(a);
    const rankB = adminRank(b);
    if (rankA >= 0 || rankB >= 0) {
      if (rankA < 0) return 1;
      if (rankB < 0) return -1;
      return rankA - rankB;
    }
    return profileName(a).localeCompare(profileName(b), 'ru', { sensitivity: 'base' });
  }

  function knownRows(rows) {
    const next = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const name = profileName(row);
      const key = normalize(row?.nicknameKey || name || row?.id);
      if (!name || !key) return;
      const existing = next.get(key);
      if (!existing || (!clean(existing.avatar) && clean(row?.avatar))) next.set(key, { ...row, nickname: name, nicknameKey: key });
    });
    return [...next.values()].sort(compareProfiles);
  }

  function setProfiles(rows) {
    const profiles = knownRows(rows);
    knownByKey = new Map(profiles.map(row => [normalize(row.nicknameKey || profileName(row)), row]));
    profilesLoaded = true;
    scheduleSync();
  }

  function currentAccountName() {
    return clean(
      document.querySelector('#oc-myname')?.value ||
      document.querySelector('#ev-myname')?.value ||
      localStorage.getItem('op-ed-primary-account-name') ||
      localStorage.getItem('my-display-name')
    );
  }

  function optionSignature(select) {
    return [...select.options].map(option => `${option.value}\u0000${option.textContent}`).join('\u0001');
  }

  function syncMainProfileSelect() {
    const select = document.getElementById(PROFILE_LIST_ID);
    if (!select || !profilesLoaded || !knownByKey.size) return;

    const profiles = [...knownByKey.values()].sort(compareProfiles);
    const previous = clean(select.value);
    const previousKey = normalize(previous);
    const accountKey = normalize(currentAccountName());
    const selectedRow = knownByKey.get(previousKey) || knownByKey.get(accountKey) || profiles[0];
    const selectedName = profileName(selectedRow);

    const expected = profiles.map(row => {
      const name = profileName(row);
      const avatar = clean(row.avatar) || '🙂';
      const admin = isAdminProfile(row);
      return { value: name, label: `${admin ? '🔧 ' : ''}${avatar} ${name}`, admin };
    });
    const expectedSignature = expected.map(row => `${row.value}\u0000${row.label}`).join('\u0001');
    const selectionChanged = normalize(previous) !== normalize(selectedName);

    if (optionSignature(select) !== expectedSignature) {
      select.replaceChildren(...expected.map(row => {
        const option = document.createElement('option');
        option.value = row.value;
        option.textContent = row.label;
        if (row.admin) option.dataset.admin = '1';
        return option;
      }));
    }
    select.value = selectedName;
    if (selectionChanged) select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function ensureEventDatalist() {
    if (!profilesLoaded || !knownByKey.size) return null;
    let datalist = document.getElementById(EVENT_DATALIST_ID);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = EVENT_DATALIST_ID;
      document.body.append(datalist);
    }
    const profiles = [...knownByKey.values()].sort(compareProfiles);
    const expected = profiles.map(row => ({ name: profileName(row), admin: isAdminProfile(row) }));
    const current = [...datalist.options].map(option => `${option.value}\u0000${option.label || ''}`);
    const signature = expected.map(row => `${row.name}\u0000${row.admin ? '🔧 админ' : ''}`);
    if (current.join('\u0001') !== signature.join('\u0001')) {
      datalist.replaceChildren(...expected.map(row => {
        const option = document.createElement('option');
        option.value = row.name;
        if (row.admin) option.label = '🔧 админ';
        return option;
      }));
    }
    return datalist;
  }

  function syncEventParticipantInputs() {
    ensureEventDatalist();
    document.querySelectorAll('.ev-participant-input').forEach(input => {
      const name = clean(input.value);
      const profile = knownByKey.get(normalize(name));
      if (profile && name !== profileName(profile)) input.value = profileName(profile);
      if (!input.disabled && knownByKey.size) input.setAttribute('list', EVENT_DATALIST_ID);
      input.removeAttribute('data-registered-only');
      if (!input.disabled) input.title = 'Можно выбрать пользователя из списка или ввести гостевой ник вручную';
    });
  }

  function syncAll() {
    syncQueued = false;
    syncMainProfileSelect();
    syncEventParticipantInputs();
  }

  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(syncAll);
  }

  document.addEventListener('change', event => {
    const input = event.target?.closest?.('.ev-participant-input');
    if (!input || !profilesLoaded) return;
    const profile = knownByKey.get(normalize(input.value));
    if (profile) input.value = profileName(profile);
  }, true);

  new MutationObserver(scheduleSync).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('oped:user-profiles-updated', event => setProfiles(event?.detail?.rows));
  window.addEventListener('oped:route-ready', event => {
    if (event?.detail?.tab === 'profile') scheduleSync();
  });
  const initialRows = window.OC_APP_DATA?.userProfiles;
  if (Array.isArray(initialRows)) setProfiles(initialRows);
  else scheduleSync();
})();

/* admin-profile-picker.js */
(() => {
	if (window.__OC_ADMIN_PROFILE_PICKER_READY__) return;
	window.__OC_ADMIN_PROFILE_PICKER_READY__ = true;

	const select = document.getElementById('oc-profile-user');
	if (!select) return;

	const cleanLabel = value => String(value || '').replace(/^🔧\s*/u, '').trim();
	let lastSignature = '';

	const picker = document.createElement('div');
	picker.className = 'oc-profile-picker';

	const toggle = document.createElement('button');
	toggle.type = 'button';
	toggle.className = 'oc-profile-picker-toggle';
	toggle.setAttribute('aria-haspopup', 'listbox');
	toggle.setAttribute('aria-expanded', 'false');

	const menu = document.createElement('div');
	menu.className = 'oc-profile-picker-menu hidden';
	menu.setAttribute('role', 'listbox');

	select.parentNode.insertBefore(picker, select);
	picker.append(select, toggle, menu);
	select.classList.add('oc-profile-user-native');

	function closeMenu() {
		picker.classList.remove('open');
		menu.classList.add('hidden');
		toggle.setAttribute('aria-expanded', 'false');
	}

	function openMenu() {
		picker.classList.add('open');
		menu.classList.remove('hidden');
		toggle.setAttribute('aria-expanded', 'true');
		menu.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
	}

	function syncSelection() {
		const selected = select.selectedOptions?.[0] || [...select.options].find(option => option.value === select.value) || select.options[0];
		if (!selected) {
			toggle.textContent = 'Выберите профиль';
			toggle.classList.remove('is-admin');
			return;
		}
		toggle.textContent = cleanLabel(selected.textContent);
		toggle.classList.toggle('is-admin', selected.dataset.admin === '1');
		menu.querySelectorAll('.oc-profile-picker-option').forEach(button => {
			button.classList.toggle('selected', button.dataset.value === select.value);
			button.setAttribute('aria-selected', button.dataset.value === select.value ? 'true' : 'false');
		});
	}

	function renderOptions() {
		const rows = [...select.options].map(option => ({
			value: option.value,
			label: cleanLabel(option.textContent),
			admin: option.dataset.admin === '1'
		}));
		const signature = rows.map(row => `${row.value}\u0000${row.label}\u0000${row.admin ? 1 : 0}`).join('\u0001');
		if (signature !== lastSignature) {
			lastSignature = signature;
			menu.replaceChildren(...rows.map(row => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = `oc-profile-picker-option${row.admin ? ' is-admin' : ''}`;
				button.dataset.value = row.value;
				button.setAttribute('role', 'option');

				const label = document.createElement('span');
				label.className = 'oc-profile-picker-option-label';
				label.textContent = row.label;
				button.append(label);

				if (row.admin) {
					const crown = document.createElement('span');
					crown.className = 'oc-profile-admin-crown';
					crown.textContent = '♛';
					crown.title = 'Администратор';
					crown.setAttribute('aria-label', 'Администратор');
					button.append(crown);
				}
				return button;
			}));
		}
		syncSelection();
	}

	toggle.addEventListener('click', () => {
		if (menu.classList.contains('hidden')) openMenu();
		else closeMenu();
	});

	menu.addEventListener('click', event => {
		const button = event.target.closest('.oc-profile-picker-option');
		if (!button) return;
		if (select.value !== button.dataset.value) {
			select.value = button.dataset.value;
			select.dispatchEvent(new Event('change', { bubbles: true }));
		}
		syncSelection();
		closeMenu();
		toggle.focus();
	});

	select.addEventListener('change', syncSelection);
	document.addEventListener('pointerdown', event => {
		if (!picker.contains(event.target)) closeMenu();
	});
	document.addEventListener('keydown', event => {
		if (event.key === 'Escape' && !menu.classList.contains('hidden')) {
			closeMenu();
			toggle.focus();
		}
	});

	new MutationObserver(renderOptions).observe(select, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
		attributeFilter: ['data-admin', 'value', 'selected']
	});

	renderOptions();
	window.addEventListener('oped:data-ready', event => {
		if (event?.detail?.source === 'userProfiles' || event?.detail?.source === 'ratings') renderOptions();
	});
	window.addEventListener('oped:route-ready', event => {
		if (event?.detail?.tab === 'profile') renderOptions();
	});
})();

/* my-events-profile.js */
(() => {
  if (window.__OC_MY_EVENTS_PROFILE_READY__) return;
  window.__OC_MY_EVENTS_PROFILE_READY__ = true;

  const CURRENT_EVENT_YEAR = 2026;
  const SEASONS = ['winter', 'spring', 'summer', 'fall'];
  const SEASON_LABEL = { winter:'Зима', spring:'Весна', summer:'Лето', fall:'Осень' };
  const ASSIGNMENT_SEEN_PREFIX = 'oc-event-assignment-seen-v1:';
  let loadedForUid = '';
  let loading = false;
  let lastData = null;

  const clean = value => String(value || '').trim();
  const norm = value => clean(value).toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0,60);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

  function root() { return document.querySelector('#oc-profile-panel'); }
  function tab() { return root()?.querySelector('.oc-profile-subtabs [data-profile-view="events"]'); }
  function bell() { return document.querySelector('#oc-daily-bell'); }

  function ensurePanel() {
    const profile = root();
    if (!profile) return null;
    let panel = profile.querySelector('#oc-my-events-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'oc-my-events-panel';
      panel.className = 'oc-my-events-panel';
      const anchor = profile.querySelector('#oc-daily-panel') || profile.querySelector('.oc-allratings') || profile.lastElementChild;
      anchor?.insertAdjacentElement('afterend', panel);
    }
    panel.classList.toggle('oc-profile-section-hidden', profile.dataset.profileView !== 'events');
    return panel;
  }

  function seenAssignments(uid) {
    try {
      const raw = JSON.parse(localStorage.getItem(`${ASSIGNMENT_SEEN_PREFIX}${uid}`) || '[]');
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch (_) { return new Set(); }
  }

  function markSeen(uid, key) {
    const seen = seenAssignments(uid);
    seen.add(String(key));
    try { localStorage.setItem(`${ASSIGNMENT_SEEN_PREFIX}${uid}`, JSON.stringify([...seen])); } catch (_) {}
    updateNoticeBadge(lastData);
  }

  function bindingRows(row) { return Array.isArray(row?.participantBindings) ? row.participantBindings : []; }

  function accessibleSeason(row, nickname, uid) {
    if (!row || row.closed || Number(row.year || CURRENT_EVENT_YEAR) !== CURRENT_EVENT_YEAR) return null;
    const key = norm(nickname);
    const slots = Array.isArray(row.allowedNicknames) ? row.allowedNicknames : [];
    const slotIndex = slots.findIndex(name => norm(name) === key);
    if (slotIndex < 0 || slotIndex >= 15) return null;
    const binding = bindingRows(row).find(item => norm(item?.nicknameKey || item?.nickname) === key);
    if (binding?.authUid && String(binding.authUid) !== String(uid)) return null;
    return { ...row, key:String(row.key || row.id || `${CURRENT_EVENT_YEAR}_${row.season || ''}`), slot:slotIndex+1, selectedOpeningIds:Array.isArray(row.selectedOpeningIds) ? row.selectedOpeningIds.map(String) : [], accountLinked:Boolean(binding?.authUid ? String(binding.authUid) === String(uid) : true) };
  }

  async function firebaseTools() {
    const [{ getApp, getApps }, firestore, authModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js')
    ]);
    for (let attempt=0; attempt<100 && !getApps().length; attempt+=1) await new Promise(resolve => setTimeout(resolve,50));
    if (!getApps().length) throw new Error('Firebase ещё не готов.');
    const app = getApp();
    return { app, auth:authModule.getAuth(app), db:firestore.getFirestore(app), ...firestore };
  }

  async function accountProfile(tools, user) {
    const snapshot = await tools.getDocs(tools.query(tools.collection(tools.db,'userProfiles'), tools.where('authUid','==',String(user.uid)), tools.limit(1)));
    const docSnap = snapshot.docs[0];
    if (!docSnap) return null;
    const row = { id:docSnap.id, ...docSnap.data() };
    const nickname = clean(row.nickname || row.nicknameKey || docSnap.id);
    return nickname ? { ...row, nickname, nicknameKey:norm(row.nicknameKey || nickname) } : null;
  }

  async function loadData(force = false) {
    if (loading) return lastData;
    const tools = await firebaseTools();
    if (typeof tools.auth.authStateReady === 'function') await tools.auth.authStateReady();
    const user = tools.auth.currentUser;
    if (!user || user.isAnonymous) return null;
    if (!force && loadedForUid === user.uid && lastData) return lastData;
    loading = true;
    try {
      const profile = await accountProfile(tools, user);
      if (!profile?.nicknameKey) return null;
      const nickname = profile.nickname;
      const nicknameKey = profile.nicknameKey;
      const seasonPromise = tools.getDocs(tools.collection(tools.db,'eventSeasons'));
      const ratingPromise = tools.getDocs(tools.query(tools.collection(tools.db,'eventRatings'), tools.where('nicknameKey','==',nicknameKey)));
      const reminderPromise = tools.getDocs(tools.query(tools.collection(tools.db,'eventNotifications'), tools.where('recipientUid','==',String(user.uid)))).catch(error => {
        console.warn('My Events reminders load skipped', error);
        return null;
      });
      const [seasonSnapshot, ratingSnapshot, reminderSnapshot] = await Promise.all([seasonPromise, ratingPromise, reminderPromise]);
      const seasons = seasonSnapshot.docs.map(docSnap => accessibleSeason({ id:docSnap.id, ...docSnap.data() }, nickname, user.uid)).filter(Boolean).sort((a,b)=>SEASONS.indexOf(a.season)-SEASONS.indexOf(b.season));
      const ratings = ratingSnapshot.docs.map(docSnap => ({ id:docSnap.id, ...docSnap.data() }));
      const reminders = reminderSnapshot ? reminderSnapshot.docs.map(docSnap => ({ id:docSnap.id, ...docSnap.data() })).filter(row => row.eventType === 'season-reminder' && !row.acknowledged) : [];
      lastData = { uid:String(user.uid), nickname, nicknameKey, seasons, ratings, reminders };
      loadedForUid = user.uid;
      updateNoticeBadge(lastData);
      return lastData;
    } finally {
      loading = false;
    }
  }

  function progress(data, season) {
    const ids = new Set((season.selectedOpeningIds || []).map(String));
    const done = new Set(data.ratings.filter(row => String(row.seasonKey || '') === String(season.key) && ids.has(String(row.openingId || '')) && Number.isFinite(Number(row.score))).map(row => String(row.openingId)));
    return { done:done.size, total:ids.size, complete:ids.size>0 && done.size>=ids.size };
  }

  function pendingSeasons(data) {
    if (!data) return [];
    return data.seasons.filter(season => {
      const state = progress(data, season);
      return state.total > state.done;
    });
  }

  function activeReminders(data) {
    if (!data) return [];
    const pending = pendingSeasons(data);
    const pendingKeys = new Set(pending.map(season => String(season.key)));
    const pendingNames = new Set(pending.map(season => String(season.season || '')));
    return data.reminders.filter(row => {
      const seasonKey = String(row.seasonKey || '');
      if (seasonKey) return pendingKeys.has(seasonKey);
      const season = String(row.season || '');
      return Boolean(season && pendingNames.has(season));
    });
  }

  function noticeCount(data) {
    if (!data) return 0;
    const seen = seenAssignments(data.uid);
    const assignments = pendingSeasons(data).filter(row => !seen.has(String(row.key))).length;
    return assignments + activeReminders(data).length;
  }

  function updateNoticeBadge(data) {
    const count = noticeCount(data);
    const button = tab();
    if (button) {
      button.classList.toggle('oc-my-events-has-notice', count > 0);
      button.dataset.noticeCount = count ? String(count) : '';
    }
    const notificationBell = bell();
    if (notificationBell) {
      notificationBell.classList.toggle('oc-event-notice', count > 0);
      notificationBell.dataset.eventNoticeCount = count ? String(count) : '';
      if (count > 0) notificationBell.title = `Есть уведомления по ивентам: ${count}`;
      else if (notificationBell.title?.startsWith('Есть уведомления по ивентам')) notificationBell.removeAttribute('title');
    }
  }

  function ownProfileSelected(data) {
    const selected = clean(document.querySelector('#oc-profile-user')?.value);
    return !selected || norm(selected) === norm(data?.nickname);
  }

  function openMyEvents() {
    const profileButton = document.querySelector('.oc-tab-btn[data-tab="profile"]');
    if (profileButton && !profileButton.classList.contains('active')) profileButton.click();
    window.setTimeout(() => {
      const eventsTab = tab();
      if (eventsTab) {
        eventsTab.click();
        eventsTab.focus?.();
      }
    }, 0);
  }

  function render(data) {
    const panel = ensurePanel();
    if (!panel) return;
    if (!data) {
      panel.innerHTML = '<div class="oc-empty">Войди в зарегистрированный аккаунт, чтобы увидеть свои ивенты.</div>';
      return;
    }
    if (!ownProfileSelected(data)) {
      panel.innerHTML = '<div class="oc-empty">«Мои ивенты» показываются только для твоего собственного аккаунта.</div>';
      return;
    }

    const seasonCards = data.seasons.length ? data.seasons.map(season => {
      const p = progress(data, season);
      const unseen = !seenAssignments(data.uid).has(String(season.key));
      return `<article class="oc-my-events-season ${p.complete?'complete':''} ${unseen?'unseen':''}"><div class="oc-my-events-season-top"><div><span>${esc(SEASON_LABEL[season.season] || season.season)} ${season.year}</span><strong>${p.done}/${p.total} оценено${p.complete?' ✓':''}</strong></div><span class="oc-my-events-linked">аккаунт ✓</span></div><div class="oc-my-events-progress"><span style="width:${p.total?Math.round(p.done/p.total*100):0}%"></span></div><p>${p.complete?'Сезон полностью оценён.':`Осталось ${Math.max(0,p.total-p.done)} OP · строка участника ${season.slot}.`}</p><a href="events.html?season=${encodeURIComponent(season.season)}" data-my-events-open-season="${esc(season.key)}">${p.done ? 'Продолжить оценивание' : 'Начать оценку'}</a></article>`;
    }).join('') : '<div class="oc-empty">Сейчас твой ник не указан ни в одном открытом сезоне.</div>';

    const reminders = activeReminders(data);
    const reminderHtml = reminders.length ? `<section class="oc-my-events-reminders"><h3>Напоминания</h3>${reminders.map(row => `<div><strong>${esc(row.seasonLabel || SEASON_LABEL[row.season] || 'Сезон')}</strong><span>${esc(row.message || 'Есть незавершённые оценки.')}</span><a href="events.html?season=${encodeURIComponent(row.season || '')}">Открыть</a></div>`).join('')}</section>` : '';

    panel.innerHTML = `<div class="oc-my-events-head"><div><span>личный центр</span><h2>Мои ивенты</h2><p>${esc(data.nickname)} · сезоны и быстрый переход к игровым режимам.</p></div><a href="events.html">Открыть Events</a></div>${reminderHtml}<section class="oc-my-events-seasons"><h3>Сезонные оценки</h3><div class="oc-my-events-grid">${seasonCards}</div></section><section class="oc-my-events-games"><h3>Игровые режимы</h3><div><a href="events.html?full=1&mode=guess">Угадайка</a><a href="events.html?full=1&mode=bestworst">Лучшее / Худшее</a><a href="events.html?full=1&mode=codenames">Codenames</a><a href="events.html?full=1&mode=blindtier">Слепой тир-лист</a><a href="events.html?full=1&mode=whoami">Кто я?</a><a href="events.html?full=1&mode=predictions">Предикты</a></div></section>`;
    panel.querySelectorAll('[data-my-events-open-season]').forEach(link => link.addEventListener('click', () => markSeen(data.uid, link.dataset.myEventsOpenSeason)));
  }

  async function refresh(force = false) {
    try {
      const data = await loadData(force);
      updateNoticeBadge(data);
      if (root()?.dataset.profileView === 'events') render(data);
    } catch (error) {
      console.warn('My Events profile load failed', error);
      if (root()?.dataset.profileView === 'events') ensurePanel().innerHTML = '<div class="oc-empty">Не удалось загрузить ивенты.</div>';
    }
  }

  function watchProfileView() {
    const profile = root();
    if (!profile) return;
    ensurePanel();
    new MutationObserver(() => {
      const panel = ensurePanel();
      panel?.classList.toggle('oc-profile-section-hidden', profile.dataset.profileView !== 'events');
      if (profile.dataset.profileView === 'events') void refresh(false);
    }).observe(profile, { attributes:true, attributeFilter:['data-profile-view'] });
    profile.querySelector('#oc-profile-user')?.addEventListener('change', () => { if (profile.dataset.profileView === 'events') render(lastData); });
  }

  function bindBell() {
    document.addEventListener('click', event => {
      const notificationBell = event.target.closest?.('#oc-daily-bell');
      if (!notificationBell || noticeCount(lastData) <= 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openMyEvents();
    }, true);
  }

  function init() {
    watchProfileView();
    bindBell();
    window.setTimeout(() => void refresh(false), 800);
    window.addEventListener('oped-account-restored', () => { loadedForUid=''; lastData=null; void refresh(true); });
    window.addEventListener('storage', event => { if (event.key?.startsWith(ASSIGNMENT_SEEN_PREFIX)) updateNoticeBadge(lastData); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
