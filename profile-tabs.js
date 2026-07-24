(() => {
  if (window.__OC_PROFILE_TABS_READY__) return;

  const VIEWS = new Set(['overview', 'top100', 'ratings', 'daily']);
  const STORAGE_KEY = 'oc-profile-subtab';
  let currentView = 'overview';

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
      <button type="button" role="tab" data-profile-view="daily">Дейлики</button>`;
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
    setVisible('.oc-profile-filterbar', currentView === 'top100' || currentView === 'ratings');
    syncDailyPlaceholder();

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
