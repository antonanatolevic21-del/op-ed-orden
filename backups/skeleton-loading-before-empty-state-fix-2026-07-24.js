(() => {
  if (window.__OC_SKELETON_LOADING_READY__) return;

  const skeletonHtml = count => `<div class="oc-skeleton-list" aria-hidden="true">${Array.from({ length: count }, () => `
    <div class="oc-skeleton-card">
      <div class="oc-skeleton-thumb"></div>
      <div class="oc-skeleton-body">
        <div class="oc-skeleton-line w70"></div>
        <div class="oc-skeleton-line w45"></div>
        <div class="oc-skeleton-pills"><div class="oc-skeleton-pill"></div><div class="oc-skeleton-pill"></div><div class="oc-skeleton-pill"></div></div>
      </div>
    </div>`).join('')}</div>`;

  function showInitialCatalogSkeleton() {
    const container = document.querySelector('#oc-list-container');
    if (!container) return;
    const text = String(container.textContent || '').trim().toLowerCase();
    if (text.includes('загрузка') || !container.children.length) container.innerHTML = skeletonHtml(6);
  }

  function showPanelSkeleton(panel) {
    if (!panel || panel.classList.contains('hidden')) return;
    const target = panel.querySelector('#oc-profile-op,#oc-top100-list,#oc-tier-list,.oc-profile-list,.oc-allratings-list');
    if (!target) return;
    const text = String(target.textContent || '').trim();
    if (!target.children.length || /загруз|пусто/i.test(text)) target.innerHTML = skeletonHtml(3);
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('.oc-tab-btn[data-tab]');
    if (!tab) return;
    window.requestAnimationFrame(() => {
      const panel = document.querySelector(`#oc-${tab.dataset.tab}-panel`);
      showPanelSkeleton(panel);
    });
  }, true);

  window.__OC_SKELETON_LOADING_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showInitialCatalogSkeleton, { once: true });
  else showInitialCatalogSkeleton();
})();
