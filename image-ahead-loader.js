(() => {
  if (window.__OC_IMAGE_AHEAD_LOADER_READY__) return;
  window.__OC_IMAGE_AHEAD_LOADER_READY__ = true;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const constrained = Boolean(connection?.saveData) || /(^|-)2g$/i.test(String(connection?.effectiveType || ''));
  const preloadDistance = constrained ? 900 : 2400;
  const imageSelector = [
    '#opedchart-root img[loading="lazy"]',
    '.ev-root img[loading="lazy"]',
    '.ev-modal img[loading="lazy"]'
  ].join(',');

  function markLoaded(image) {
    image.parentElement?.classList.add('is-loaded');
    image.parentElement?.classList.remove('is-error');
  }

  function startLoading(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.aheadLoading === '1') return;
    image.dataset.aheadLoading = '1';
    image.loading = 'eager';

    const rect = image.getBoundingClientRect();
    const inViewport = rect.bottom >= 0 && rect.top <= window.innerHeight;
    if ('fetchPriority' in image) image.fetchPriority = inViewport ? 'high' : 'auto';

    if (image.complete && image.naturalWidth) {
      markLoaded(image);
      return;
    }
    image.addEventListener('load', () => {
      markLoaded(image);
      if ('decode' in image) image.decode().catch(() => {});
    }, { once: true });
  }

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          startLoading(entry.target);
        });
      }, { rootMargin: `${preloadDistance}px 0px`, threshold: 0 })
    : null;

  function registerImage(image) {
    if (!(image instanceof HTMLImageElement) || !image.matches(imageSelector)) return;
    if (image.dataset.aheadLoading === '1') return;
    if (image.complete && image.naturalWidth) {
      markLoaded(image);
      return;
    }
    if (!observer) {
      startLoading(image);
      return;
    }
    observer.observe(image);
  }

  function scan(root = document) {
    if (root instanceof HTMLImageElement) registerImage(root);
    root.querySelectorAll?.(imageSelector).forEach(registerImage);
  }

  const scheduledRoots = new Set();
  function scheduleScan(root) {
    scheduledRoots.add(root || document);
    if (scheduleScan.pending) return;
    scheduleScan.pending = true;
    requestAnimationFrame(() => {
      scheduleScan.pending = false;
      const roots = [...scheduledRoots];
      scheduledRoots.clear();
      roots.forEach(scan);
    });
  }

  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) scheduleScan(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('oped:route-ready', () => scheduleScan(document));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(), { once: true });
  else scan();
})();
