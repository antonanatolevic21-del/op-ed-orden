import { subscribeProductState } from './state.js';

function skeletonCards(count = 6) {
  return `<div class="oc-skeleton-list">${Array.from({ length: count }, () => `<div class="oc-skeleton-card"><span class="oc-skeleton-thumb"></span><span class="oc-skeleton-lines"><i></i><i></i><i></i></span><span class="oc-skeleton-score"></span></div>`).join('')}</div>`;
}

function replaceLoadingText(root = document) {
  root.querySelectorAll('.oc-empty').forEach(element => {
    const text = String(element.textContent || '').trim();
    if (!/загрузка/i.test(text) || element.dataset.skeletonized) return;
    element.dataset.skeletonized = '1';
    element.classList.add('oc-skeleton-host');
    element.innerHTML = skeletonCards(element.closest('#oc-globaltop-list') ? 8 : 6);
  });
}

export function initSkeletons() {
  replaceLoadingText();
  const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node instanceof Element) replaceLoadingText(node);
  })));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  subscribeProductState(({ reason }) => {
    if (reason !== 'openings') return;
    document.querySelectorAll('.oc-skeleton-host').forEach(host => {
      if (/загрузка/i.test(host.textContent || '')) host.innerHTML = '';
    });
  });
}
