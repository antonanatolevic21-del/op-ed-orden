(() => {
  let activeEntityType = '';
  let refreshTimer = null;
  let unsubscribeRatings = null;

  document.addEventListener('click', event => {
    const launcher = event.target?.closest?.('[data-entity-home]');
    if (launcher) activeEntityType = String(launcher.getAttribute('data-entity-home') || '');
  }, true);

  function inferEntityType() {
    if (activeEntityType) return activeEntityType;
    const title = String(document.querySelector('#oc-entity-title')?.textContent || '').toLowerCase();
    if (title.includes('исполнител')) return 'performers';
    if (title.includes('режисс')) return 'directors';
    if (title.includes('франш')) return 'franchises';
    return 'studios';
  }

  function refreshVisibleEntityGrid() {
    const panel = document.querySelector('#oc-entity-panel');
    const grid = document.querySelector('#oc-entity-grid');
    if (!panel || panel.classList.contains('hidden') || !grid || grid.classList.contains('hidden')) return;

    const launcher = document.querySelector(`[data-entity-home="${inferEntityType()}"]`);
    if (!launcher) return;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    launcher.click();
    requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
  }

  function queueEntityRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshVisibleEntityGrid, 140);
  }

  function startRatingsWatcher() {
    if (unsubscribeRatings || typeof window.OPED_DB?.watchRatings !== 'function') return false;
    unsubscribeRatings = window.OPED_DB.watchRatings(() => queueEntityRefresh());
    return true;
  }

  if (!startRatingsWatcher()) {
    window.addEventListener('oped-db-ready', startRatingsWatcher, { once: true });
    const readyTimer = setInterval(() => {
      if (startRatingsWatcher()) clearInterval(readyTimer);
    }, 250);
    setTimeout(() => clearInterval(readyTimer), 15000);
  }

  window.addEventListener('beforeunload', () => {
    clearTimeout(refreshTimer);
    if (typeof unsubscribeRatings === 'function') unsubscribeRatings();
  }, { once: true });
})();
