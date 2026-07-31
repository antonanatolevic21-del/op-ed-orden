(() => {
  if (window.__OC_EVENTS_IMAGE_FALLBACK_READY__) return;
  window.__OC_EVENTS_IMAGE_FALLBACK_READY__ = true;

  const CACHE_KEY = 'oc-events-image-fallback-map-v1';
  const FALLBACK_DELAY = 1800;
  const IMAGE_SELECTOR = '.ev-root img.oc-track-image, .ev-modal img.oc-track-image';
  const fallbackBySource = readCache();
  const lookupPromises = new Map();
  let firebaseToolsPromise = null;

  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return value && typeof value === 'object' ? new Map(Object.entries(value)) : new Map();
    } catch (_) {
      return new Map();
    }
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(fallbackBySource)));
    } catch (_) {}
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function absoluteUrl(value) {
    const source = clean(value);
    if (!source) return '';
    try { return new URL(source, window.location.href).href; }
    catch (_) { return source; }
  }

  function sourceKeys(value) {
    const source = clean(value);
    const absolute = absoluteUrl(source);
    return [...new Set([source, absolute].filter(Boolean))];
  }

  function isRemoteSource(value) {
    try {
      const url = new URL(value, window.location.href);
      return /^https?:$/.test(url.protocol) && url.origin !== window.location.origin;
    } catch (_) {
      return false;
    }
  }

  function rememberFallback(source, fallback) {
    const target = clean(fallback);
    if (!target) return;
    sourceKeys(source).forEach(key => fallbackBySource.set(key, target));
    saveCache();
  }

  function cachedFallback(source) {
    for (const key of sourceKeys(source)) {
      const fallback = clean(fallbackBySource.get(key));
      if (fallback) return fallback;
    }
    return '';
  }

  async function firebaseTools() {
    if (firebaseToolsPromise) return firebaseToolsPromise;
    firebaseToolsPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js'),
      import('./firebase-config.js')
    ]).then(([appModule, firestore, config]) => {
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(config.firebaseConfig);
      return { db: firestore.getFirestore(app), ...firestore };
    });
    return firebaseToolsPromise;
  }

  async function lookupFallback(source) {
    const rawSource = clean(source);
    if (!rawSource || !isRemoteSource(rawSource)) return '';

    const cached = cachedFallback(rawSource);
    if (cached) return cached;

    const key = absoluteUrl(rawSource) || rawSource;
    if (lookupPromises.has(key)) return lookupPromises.get(key);

    const promise = (async () => {
      try {
        const tools = await firebaseTools();
        const candidates = sourceKeys(rawSource);
        for (const candidate of candidates) {
          const snapshot = await tools.getDocs(tools.query(
            tools.collection(tools.db, 'openings'),
            tools.where('image', '==', candidate),
            tools.limit(1)
          ));
          const fallback = clean(snapshot.docs[0]?.data()?.fallbackImage || snapshot.docs[0]?.data()?.imageFallback);
          if (!fallback) continue;
          rememberFallback(rawSource, fallback);
          rememberFallback(candidate, fallback);
          return fallback;
        }
      } catch (error) {
        console.warn('Events fallback image lookup failed', rawSource, error);
      }
      return '';
    })().finally(() => lookupPromises.delete(key));

    lookupPromises.set(key, promise);
    return promise;
  }

  function currentSource(image) {
    return clean(image.dataset.originalSource || image.getAttribute('src') || image.currentSrc || image.src);
  }

  function markLoaded(image) {
    image.dataset.eventImageLoaded = '1';
    image.style.removeProperty('display');
    image.hidden = false;
    image.parentElement?.classList.remove('is-error');
    image.parentElement?.classList.add('is-loaded');
  }

  function applyFallback(image, fallback) {
    const target = clean(fallback);
    if (!(image instanceof HTMLImageElement) || !target) return false;
    const current = absoluteUrl(image.getAttribute('src') || image.src);
    if (current && current === absoluteUrl(target)) return false;

    image.dataset.fallbackTried = '1';
    image.dataset.eventFallbackApplied = '1';
    image.style.removeProperty('display');
    image.hidden = false;
    image.setAttribute('src', target);
    image.loading = 'eager';
    return true;
  }

  async function recoverImage(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.eventFallbackApplied === '1') return;
    if (image.complete && image.naturalWidth) {
      markLoaded(image);
      return;
    }

    const source = currentSource(image);
    const declared = clean(image.dataset.fallback);
    if (declared) {
      rememberFallback(source, declared);
      applyFallback(image, declared);
      return;
    }

    const fallback = cachedFallback(source) || await lookupFallback(source);
    if (!image.isConnected || image.dataset.eventImageLoaded === '1') return;
    if (fallback) {
      image.dataset.fallback = fallback;
      applyFallback(image, fallback);
    }
  }

  function registerImage(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.eventFallbackBound === '1') return;
    image.dataset.eventFallbackBound = '1';
    image.dataset.originalSource = clean(image.getAttribute('src') || image.src);

    const declared = clean(image.dataset.fallback);
    if (declared) rememberFallback(image.dataset.originalSource, declared);
    else {
      const cached = cachedFallback(image.dataset.originalSource);
      if (cached) image.dataset.fallback = cached;
    }

    image.addEventListener('load', () => markLoaded(image));
    image.addEventListener('error', () => void recoverImage(image));

    if (image.complete) {
      if (image.naturalWidth) markLoaded(image);
      else void recoverImage(image);
      return;
    }

    window.setTimeout(() => {
      if (!image.isConnected || image.dataset.eventImageLoaded === '1' || image.dataset.eventFallbackApplied === '1') return;
      void recoverImage(image);
    }, FALLBACK_DELAY);
  }

  function scan(root = document) {
    if (root instanceof HTMLImageElement && root.matches(IMAGE_SELECTOR)) registerImage(root);
    root.querySelectorAll?.(IMAGE_SELECTOR).forEach(registerImage);
  }

  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) scan(node);
    }));
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('error', event => {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.matches(IMAGE_SELECTOR)) void recoverImage(image);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(), { once: true });
  else scan();
})();
