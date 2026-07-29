(() => {
  if (window.OC_CATALOG_STORE) return;

  const DATABASE_NAME = 'op-ed-runtime-cache';
  const DATABASE_VERSION = 1;
  const STORE_NAME = 'snapshots';
  const CATALOG_KEY = 'openings-v1';
  const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
  let memoryRows = null;
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

  async function read() {
    if (memoryRows) return { rows: memoryRows, stale: false };
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
    try {
      const response = await fetch('./catalog.snapshot.json', { cache: 'force-cache' });
      if (!response.ok) return null;
      const snapshot = await response.json();
      const snapshotRows = Array.isArray(snapshot) ? snapshot : snapshot.rows;
      if (!Array.isArray(snapshotRows) || !snapshotRows.length) return null;
      memoryRows = snapshotRows;
      void write(memoryRows);
      return { rows: memoryRows, stale: false, static: true, savedAt: Number(snapshot.generatedAt || 0) };
    } catch (_) {
      return null;
    }
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
