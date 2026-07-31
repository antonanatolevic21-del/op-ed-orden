(() => {
  if (window.__OC_EVENTS_STORAGE_QUOTA_GUARD_READY__) return;
  window.__OC_EVENTS_STORAGE_QUOTA_GUARD_READY__ = true;

  const FALLBACK_CACHE_KEY = 'oc-events-image-fallback-map-v1';
  const MAX_FALLBACK_CACHE_ROWS = 180;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  function compactFallbackCache(value) {
    try {
      const parsed = JSON.parse(String(value || '{}'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '{}';
      const rows = Object.entries(parsed).slice(-MAX_FALLBACK_CACHE_ROWS);
      return JSON.stringify(Object.fromEntries(rows));
    } catch (_) {
      return '{}';
    }
  }

  function clearFallbackCache() {
    try { originalRemoveItem.call(localStorage, FALLBACK_CACHE_KEY); } catch (_) {}
  }

  function compactStoredFallbackCache() {
    try {
      const current = localStorage.getItem(FALLBACK_CACHE_KEY);
      if (!current) return;
      const compact = compactFallbackCache(current);
      if (compact !== current) originalSetItem.call(localStorage, FALLBACK_CACHE_KEY, compact);
    } catch (_) {
      clearFallbackCache();
    }
  }

  compactStoredFallbackCache();

  Storage.prototype.setItem = function(key, value) {
    const isLocalStorage = this === localStorage;
    const nextValue = isLocalStorage && String(key) === FALLBACK_CACHE_KEY
      ? compactFallbackCache(value)
      : value;

    try {
      return originalSetItem.call(this, key, nextValue);
    } catch (error) {
      const quotaExceeded = error?.name === 'QuotaExceededError'
        || error?.code === 22
        || String(error?.message || '').toLowerCase().includes('quota');
      if (!isLocalStorage || !quotaExceeded) throw error;

      clearFallbackCache();
      if (String(key) === FALLBACK_CACHE_KEY) return;
      return originalSetItem.call(this, key, nextValue);
    }
  };
})();
