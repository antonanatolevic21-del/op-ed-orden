(() => {
  if (window.OC_CATALOG_STORE) return;

  const DATABASE_NAME = 'op-ed-runtime-cache';
  const DATABASE_VERSION = 1;
  const STORE_NAME = 'snapshots';
  const CATALOG_KEY = 'openings-v1';
  const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
  let memoryRows = null;
  let readPromise = null;
  let databasePromise = null;

  function openDatabase() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (databasePromise) return databasePromise;
    databasePromise = new Promise(resolve => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return databasePromise;
  }

  async function read({ refresh = false } = {}) {
    if (readPromise) return readPromise;
    if (memoryRows && !refresh) return { rows: memoryRows, stale: false };
    readPromise = readSnapshot();
    try { return await readPromise; }
    finally { readPromise = null; }
  }

  async function mergeSharedAverages(rows) {
    try {
      const response = await fetch('./rating-aggregates.snapshot.json', { cache: 'no-cache' });
      if (!response.ok) return rows;
      const snapshot = await response.json();
      if (snapshot.version !== 1 || !Number.isFinite(snapshot.generatedAt) || !Array.isArray(snapshot.rows)) return rows;
      if (!snapshot.rows.every(row => Array.isArray(row) && row.length === 13 && typeof row[0] === 'string'
        && row.slice(1).every(value => Number.isFinite(value) && value >= 0))) return rows;
      const byId = new Map(snapshot.rows.map(row => [row[0], row.slice(1)]));
      return rows.map(row => {
        if (Number(row.ratingAggregateUpdatedAt || 0) > snapshot.generatedAt) return row;
        const values = byId.get(String(row.id)) || Array(12).fill(0);
        const next = { ...row, ratingAggregateVersion: 1, ratingAggregateUpdatedAt: snapshot.generatedAt };
        ['', 'song', 'visual'].forEach((prefix, index) => {
          const key = suffix => prefix ? prefix + suffix : suffix[0].toLowerCase() + suffix.slice(1);
          const [count, sum, adminCount, adminSum] = values.slice(index * 4, index * 4 + 4);
          next[key('RatingCount')] = count;
          next[key('RatingSum')] = sum;
          next[key('RatingAverage')] = count ? sum / count : null;
          next[key('AdminRatingCount')] = adminCount;
          next[key('AdminRatingSum')] = adminSum;
          next[key('AdminRatingAverage')] = adminCount ? adminSum / adminCount : null;
        });
        return next;
      });
    } catch (_) { return rows; }
  }

  async function mergeCatalogUpdates(rows, since) {
    const database = window.OPED_DB;
    if (window.OC_CATALOG_ADMIN_WORKSPACE || !database?.listCatalogUpdates || !(since > 0)) return rows;
    let timeout;
    try {
      const changes = await Promise.race([
        database.listCatalogUpdates(since),
        new Promise(resolve => { timeout = window.setTimeout(() => resolve([]), 12000); })
      ]);
      if (!changes.length) return rows;
      const byId = new Map(rows.map(row => [String(row.id), row]));
      for (const change of changes) {
        const id = String(change.id);
        byId.set(id, { ...byId.get(id), ...change });
      }
      return [...byId.values()];
    } catch (error) {
      console.warn('Catalog updates unavailable; using published snapshot', error);
      return rows;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function readSnapshot() {
    // Revalidate the published file once per page. IndexedDB is an offline
    // fallback, never a reason to retain a two-week-old published catalog.
    try {
      const response = await fetch('./catalog.snapshot.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Catalog snapshot HTTP ' + response.status);
      const snapshot = await response.json();
      const rows = Array.isArray(snapshot) ? snapshot : snapshot.rows;
      if (!Array.isArray(rows) || !rows.length) throw new Error('Empty catalog snapshot');
      const updated = await mergeCatalogUpdates(rows, Number(snapshot.catalogReadStartedAt || snapshot.generatedAt || 0));
      memoryRows = await mergeSharedAverages(updated);
      void write(memoryRows);
      return { rows: memoryRows, stale: false, static: true, savedAt: Number(snapshot.generatedAt || 0) };
    } catch (_) { /* Keep the last complete catalog available offline. */ }
    if (memoryRows) return { rows: memoryRows, stale: true };
    const database = await openDatabase();
    const stored = database ? await new Promise(resolve => {
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(CATALOG_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      }) : null;
    if (stored && Array.isArray(stored.rows) && stored.rows.length) {
      memoryRows = stored.rows;
      return {
        rows: memoryRows,
        stale: Date.now() - Number(stored.savedAt || 0) > MAX_AGE_MS,
        savedAt: Number(stored.savedAt || 0)
      };
    }
    return null;
  }

  async function write(rows) {
    if (!Array.isArray(rows) || !rows.length) return false;
    memoryRows = rows;
    const database = await openDatabase();
    if (!database) return false;
    return new Promise(resolve => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ rows, savedAt: Date.now() }, CATALOG_KEY);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    });
  }

  function peek() {
    return memoryRows;
  }

  async function clear() {
    memoryRows = null;
    const database = await openDatabase();
    if (!database) return false;
    return new Promise(resolve => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(CATALOG_KEY);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    });
  }

  window.OC_CATALOG_STORE = { read, write, peek, clear };
})();

