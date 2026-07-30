(() => {
  if (window.__OC_PROFILE_TABS_READY__) return;

  const VIEWS = new Set(['overview', 'top100', 'ratings', 'comparison', 'daily', 'events']);
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
      <button type="button" role="tab" data-profile-view="comparison">Сравнение вкусов</button>
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

  function ensureComparisonPanel() {
    const root = panel();
    if (!root) return null;
    let comparison = root.querySelector('#oc-profile-taste-comparison');
    if (!comparison) {
      comparison = document.createElement('section');
      comparison.id = 'oc-profile-taste-comparison';
      comparison.className = 'oc-profile-taste-comparison oc-profile-section-hidden';
      comparison.innerHTML = '<div class="oc-empty">Загружаю сравнение вкусов…</div>';
      root.append(comparison);
    }
    return comparison;
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
    setVisible('#oc-profile-taste-comparison', currentView === 'comparison');
    setVisible('#oc-daily-panel', currentView === 'daily');
    setVisible('#oc-my-events-panel', currentView === 'events');
    setVisible('.oc-profile-filterbar', currentView === 'top100' || currentView === 'ratings');
    syncDailyPlaceholder();
    scheduleManualOwnershipSync();
    if (currentView === 'overview') scheduleOverviewStats();
    if (currentView === 'comparison') {
      ensureComparisonPanel();
      window.dispatchEvent(new CustomEvent('oped:profile-comparison-open'));
    }

    if (persist) {
      try { sessionStorage.setItem(STORAGE_KEY, currentView); } catch (_) {}
    }
  }

  function initProfileTabs() {
    if (window.__OC_PROFILE_TABS_READY__) return;
    const root = panel();
    if (!root) return;

    ensureTabs();
    ensureComparisonPanel();
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
