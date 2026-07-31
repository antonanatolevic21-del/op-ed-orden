(() => {
  if (window.__OC_CODENAMES_IMAGE_PRESERVE_READY__) return;
  window.__OC_CODENAMES_IMAGE_PRESERVE_READY__ = true;

  const CARD_SELECTOR = '.ev-cn-card[data-cn-card]';
  const keptImages = new Map();
  let cleanupTimer = 0;

  function sourceOf(image) {
    return String(image?.dataset?.originalSource || image?.getAttribute?.('src') || image?.currentSrc || image?.src || '').trim();
  }

  function rememberCard(card) {
    if (!(card instanceof Element)) return;
    const index = String(card.getAttribute('data-cn-card') || '').trim();
    const image = card.querySelector('img.oc-track-image');
    if (!index || !(image instanceof HTMLImageElement) || !image.complete || !image.naturalWidth) return;
    keptImages.set(index, { image, source: sourceOf(image), savedAt: Date.now() });
  }

  function rememberTree(node) {
    if (!(node instanceof Element)) return;
    if (node.matches(CARD_SELECTOR)) rememberCard(node);
    node.querySelectorAll?.(CARD_SELECTOR).forEach(rememberCard);
  }

  function restoreCard(card) {
    if (!(card instanceof Element)) return;
    const index = String(card.getAttribute('data-cn-card') || '').trim();
    const current = card.querySelector('img.oc-track-image');
    const saved = keptImages.get(index);
    if (!index || !(current instanceof HTMLImageElement) || !saved?.image) return;

    const currentSource = sourceOf(current);
    if (saved.source && currentSource && saved.source !== currentSource) return;
    if (saved.image === current || !saved.image.complete || !saved.image.naturalWidth) return;

    current.replaceWith(saved.image);
    saved.image.style.removeProperty('display');
    saved.image.hidden = false;
    saved.image.parentElement?.classList.add('is-loaded');
    saved.image.parentElement?.classList.remove('is-error');
  }

  function restoreTree(node) {
    if (!(node instanceof Element)) return;
    if (node.matches(CARD_SELECTOR)) restoreCard(node);
    node.querySelectorAll?.(CARD_SELECTOR).forEach(restoreCard);
  }

  function scheduleCleanup() {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(() => {
      const now = Date.now();
      keptImages.forEach((row, key) => {
        if (now - Number(row.savedAt || 0) > 15000) keptImages.delete(key);
      });
    }, 16000);
  }

  new MutationObserver(records => {
    records.forEach(record => record.removedNodes.forEach(rememberTree));
    records.forEach(record => record.addedNodes.forEach(restoreTree));
    scheduleCleanup();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
