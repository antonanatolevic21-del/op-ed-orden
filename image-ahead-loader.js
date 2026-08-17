(() => {
  if (window.__OC_IMAGE_AHEAD_LOADER_READY__) return;
  window.__OC_IMAGE_AHEAD_LOADER_READY__ = true;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const constrained = Boolean(connection?.saveData) || /(^|-)2g$/i.test(String(connection?.effectiveType || ''));
  const preloadDistance = constrained ? 1200 : Math.max(4200, window.innerHeight * 4);
  const maxAheadRequests = constrained ? 3 : 8;
  const requestTimeout = constrained ? 30000 : 20000;
  const queue = [];
  const activeLoads = new Map();
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
    delete image.dataset.aheadQueued;
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
    let settled = false;
    const requestedSrc = image.currentSrc || image.src;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      activeLoads.delete(image);
      activeRequests = Math.max(0, activeRequests - 1);
      pumpQueue();
    };
    const onLoad = () => {
      markLoaded(image);
      if ('decode' in image) image.decode().catch(() => {});
      finish();
    };
    const onError = () => {
      window.setTimeout(() => {
        if (image.isConnected && (image.currentSrc || image.src) !== requestedSrc) return;
        finish();
      }, 0);
    };
    const timeout = window.setTimeout(finish, requestTimeout);
    activeLoads.set(image, finish);
    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
  }

  function pumpQueue() {
    queue.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    while (activeRequests < maxAheadRequests && queue.length) {
      const image = queue.shift();
      if (image) delete image.dataset.aheadQueued;
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
    if (root !== document && !root?.isConnected) return;
    if (root instanceof HTMLImageElement) registerImage(root);
    root.querySelectorAll?.(imageSelector).forEach(registerImage);
  }

  const scheduledRoots = new Set();
  function scheduleScan(root) {
    const candidate = root?.isConnected ? root : document;
    if (candidate === document || scheduledRoots.size >= 32) {
      scheduledRoots.clear();
      scheduledRoots.add(document);
    } else if (!scheduledRoots.has(document)) {
      scheduledRoots.add(candidate);
    }
    if (scheduleScan.pending) return;
    scheduleScan.pending = true;
    queueMicrotask(() => {
      scheduleScan.pending = false;
      const roots = [...scheduledRoots];
      scheduledRoots.clear();
      roots.forEach(scan);
    });
  }

  function imagesInside(root) {
    if (!(root instanceof Element)) return [];
    const images = root instanceof HTMLImageElement ? [root] : [];
    root.querySelectorAll?.('img').forEach(image => images.push(image));
    return images;
  }

  function unregisterTree(root) {
    const removedImages = new Set(imagesInside(root));
    if (!removedImages.size) return;
    removedImages.forEach(image => {
      observer?.unobserve(image);
      activeLoads.get(image)?.();
      delete image.dataset.aheadQueued;
    });
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (removedImages.has(queue[index]) || !queue[index]?.isConnected) queue.splice(index, 1);
    }
  }

  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (node instanceof Element) {
          unregisterTree(node);
          for (const root of scheduledRoots) {
            if (root !== document && (!root.isConnected || node === root || node.contains(root))) scheduledRoots.delete(root);
          }
        }
      }
      for (const node of record.addedNodes) {
        if (node instanceof Element) scheduleScan(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('pagehide', () => {
    observer?.disconnect();
    scheduledRoots.clear();
    queue.splice(0).forEach(image => { delete image.dataset.aheadQueued; });
    [...activeLoads.entries()].forEach(([image, finish]) => {
      finish();
      delete image.dataset.aheadLoading;
      image.loading = 'lazy';
    });
  });
  window.addEventListener('pageshow', () => scheduleScan(document));
  window.addEventListener('oped:route-ready', () => scheduleScan(document));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(), { once: true });
  else scan();
})();
