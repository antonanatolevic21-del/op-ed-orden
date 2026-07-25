(() => {
  if (window.__OC_PROFILE_STATS_DESIGNS_READY__) return;
  window.__OC_PROFILE_STATS_DESIGNS_READY__ = true;

  const STORAGE_KEY = 'oc-profile-stats-design-v1';
  const DESIGNS = new Set(['dashboard', 'analytic', 'showcase']);
  let statsObserver = null;
  let observedStats = null;
  let mountQueued = false;

  function currentDesign() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (DESIGNS.has(saved)) return saved;
    } catch (_) {}
    return 'dashboard';
  }

  function annotateCards(stats) {
    [...stats.querySelectorAll(':scope > .oc-profile-metric-card')].forEach((card, index) => {
      card.dataset.statsMetricIndex = String(index);
    });
    [...stats.querySelectorAll(':scope > .oc-profile-leader-card')].forEach((card, index) => {
      card.dataset.statsLeaderIndex = String(index);
    });
  }

  function switchMarkup() {
    return `
      <div class="oc-stats-design-switch" role="group" aria-label="Дизайн обзора статистики">
        <div class="oc-stats-design-switch-copy">
          <span>Три разных подхода</span>
          <strong>Переключай прямо здесь</strong>
        </div>
        <div class="oc-stats-design-options">
          <button type="button" data-stats-design-choice="dashboard"><b>1</b><span><strong>Пульт</strong><small>асимметричный командный центр</small></span></button>
          <button type="button" data-stats-design-choice="analytic"><b>2</b><span><strong>Терминал</strong><small>никаких карточек, только данные</small></span></button>
          <button type="button" data-stats-design-choice="showcase"><b>3</b><span><strong>Постер</strong><small>гигантская типографика и цвет</small></span></button>
        </div>
      </div>`;
  }

  function applyDesign(stats, design, persist = false) {
    const next = DESIGNS.has(design) ? design : 'dashboard';
    stats.dataset.statsDesign = next;
    stats.querySelectorAll('[data-stats-design-choice]').forEach(button => {
      const active = button.dataset.statsDesignChoice === next;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    }
  }

  function ensureSwitch(stats) {
    let shell = stats.querySelector(':scope > .oc-stats-design-switch');
    if (!shell) {
      stats.insertAdjacentHTML('afterbegin', switchMarkup());
      shell = stats.querySelector(':scope > .oc-stats-design-switch');
      shell?.addEventListener('click', event => {
        const button = event.target.closest('[data-stats-design-choice]');
        if (!button) return;
        applyDesign(stats, button.dataset.statsDesignChoice, true);
      });
    }
    return shell;
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
    ensureSwitch(stats);
    annotateCards(stats);
    applyDesign(stats, stats.dataset.statsDesign || currentDesign(), false);
    observeStats(stats);
  }

  function queueMount() {
    if (mountQueued) return;
    mountQueued = true;
    requestAnimationFrame(mount);
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