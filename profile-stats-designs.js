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
