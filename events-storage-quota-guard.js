(() => {
  if (!window.__OC_OP_PRIORITY_SORT_READY__) {
    window.__OC_OP_PRIORITY_SORT_READY__ = true;

    const nativeSort = Array.prototype.sort;
    const nativeToSorted = Array.prototype.toSorted;
    const TRACK_WRAPPERS = ['entry', 'e', 'opening', 'track', 'row', 'item', 'card', 'candidate'];

    function trackInfo(value) {
      if (!value || typeof value !== 'object') return null;
      const candidates = [value];
      TRACK_WRAPPERS.forEach(key => {
        if (value[key] && typeof value[key] === 'object') candidates.push(value[key]);
      });
      for (const candidate of candidates) {
        const type = String(candidate?.type || candidate?.openingType || '').trim().toUpperCase();
        if (type === 'OP' || type === 'ED') return { type };
      }
      return null;
    }

    function typePriority(left, right) {
      if (!left || !right || left.type === right.type) return 0;
      return left.type === 'OP' ? -1 : 1;
    }

    function prioritizedComparator(compareFn) {
      return (left, right) => {
        const compared = Number(compareFn(left, right));
        if (Number.isFinite(compared) && compared !== 0) return compared;
        return typePriority(trackInfo(left), trackInfo(right));
      };
    }

    function hasTracks(values) {
      for (let index = 0; index < values.length; index += 1) {
        if (trackInfo(values[index])) return true;
      }
      return false;
    }

    Array.prototype.sort = function(compareFn) {
      if (typeof compareFn !== 'function' || !hasTracks(this)) {
        return typeof compareFn === 'function'
          ? nativeSort.call(this, compareFn)
          : nativeSort.call(this);
      }
      return nativeSort.call(this, prioritizedComparator(compareFn));
    };

    if (typeof nativeToSorted === 'function') {
      Array.prototype.toSorted = function(compareFn) {
        if (typeof compareFn !== 'function' || !hasTracks(this)) {
          return typeof compareFn === 'function'
            ? nativeToSorted.call(this, compareFn)
            : nativeToSorted.call(this);
        }
        return nativeToSorted.call(this, prioritizedComparator(compareFn));
      };
    }
  }

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
