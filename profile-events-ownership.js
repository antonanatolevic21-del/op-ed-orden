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
