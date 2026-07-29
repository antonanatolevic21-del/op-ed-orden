(() => {
  if (window.__OC_IMAGE_AHEAD_LOADER_READY__) return;
  window.__OC_IMAGE_AHEAD_LOADER_READY__ = true;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const constrained = Boolean(connection?.saveData) || /(^|-)2g$/i.test(String(connection?.effectiveType || ''));
  const preloadDistance = constrained ? 1200 : Math.max(4200, window.innerHeight * 4);
  const maxAheadRequests = constrained ? 3 : 8;
  const queue = [];
  let activeRequests = 0;
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
    if (!image.isConnected) return;
    image.dataset.aheadLoading = '1';
    image.loading = 'eager';

    const rect = image.getBoundingClientRect();
    const inViewport = rect.bottom >= 0 && rect.top <= window.innerHeight;
    if ('fetchPriority' in image) image.fetchPriority = inViewport ? 'high' : 'auto';

    if (image.complete && image.naturalWidth) {
      markLoaded(image);
      return;
    }
    activeRequests += 1;
    const finish = () => {
      activeRequests = Math.max(0, activeRequests - 1);
      pumpQueue();
    };
    image.addEventListener('load', () => {
      markLoaded(image);
      if ('decode' in image) image.decode().catch(() => {});
      finish();
    }, { once: true });
    image.addEventListener('error', finish, { once: true });
  }

  function pumpQueue() {
    queue.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    while (activeRequests < maxAheadRequests && queue.length) {
      const image = queue.shift();
      if (!image?.isConnected || image.complete && image.naturalWidth) {
        if (image?.naturalWidth) markLoaded(image);
        continue;
      }
      startLoading(image);
    }
  }

  function enqueueImage(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.aheadQueued === '1' || image.dataset.aheadLoading === '1') return;
    image.dataset.aheadQueued = '1';
    queue.push(image);
    pumpQueue();
  }

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          enqueueImage(entry.target);
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
      enqueueImage(image);
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
