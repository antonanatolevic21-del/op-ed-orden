(() => {
  if (window.__OC_STARTUP_DEEP_LINK_FIX_READY__) return;
  window.__OC_STARTUP_DEEP_LINK_FIX_READY__ = true;

  const MAIN_VIEWS = new Set(['chart', 'profile', 'top100', 'season', 'tier', 'stats', 'entity-studios', 'entity-performers', 'entity-directors', 'entity-franchises']);
  const EVENT_MODES = new Set(['rating', 'guess', 'bestworst', 'predictions', 'codenames', 'blindtier', 'whoami']);
  const EVENT_STAGES = new Set(['basket', 'first', 'semi', 'final']);
  let timers = [];

  function clearTimers() {
    timers.forEach(timer => window.clearTimeout(timer));
    timers = [];
  }

  function currentParams() {
    return new URL(window.location.href).searchParams;
  }

  function applyMain() {
    if (!document.querySelector('#opedchart-root')) return;
    const params = currentParams();
    const requested = params.get('view');
    if (!requested || !MAIN_VIEWS.has(requested)) return;

    const tab = document.querySelector(`.oc-tab-btn[data-tab="${CSS.escape(requested)}"]`);
    if (tab && !tab.classList.contains('active')) tab.click();

    const album = String(params.get('album') || '').trim();
    if (!album || !requested.startsWith('entity-')) return;
    const tracks = document.querySelector('#oc-entity-tracks');
    if (tracks && !tracks.classList.contains('hidden')) return;
    const card = [...document.querySelectorAll('[data-entity-open]')].find(item => String(item.getAttribute('data-entity-open') || '') === album);
    card?.click();
  }

  function applyEvents() {
    if (!document.querySelector('.ev-root')) return;
    const params = currentParams();
    const mode = params.get('mode');
    if (mode && EVENT_MODES.has(mode)) {
      const modeTab = document.querySelector(`.ev-mode-tab[data-mode="${CSS.escape(mode)}"]`);
      if (modeTab && !modeTab.classList.contains('active')) modeTab.click();
    }

    const stage = params.get('stage');
    if ((mode || 'rating') === 'rating' && stage && EVENT_STAGES.has(stage)) {
      const stageTab = document.querySelector(`.ev-tab[data-stage="${CSS.escape(stage)}"]`);
      if (stageTab && !stageTab.classList.contains('active')) stageTab.click();
    }
  }

  function apply() {
    applyMain();
    applyEvents();
  }

  function schedule() {
    clearTimers();
    [0, 80, 180, 350, 700, 1200, 2200, 3500, 5500, 8000].forEach(delay => {
      timers.push(window.setTimeout(apply, delay));
    });
  }

  window.addEventListener('oped-account-restored', schedule);
  window.addEventListener('oped-db-ready', schedule);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('popstate', schedule);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
