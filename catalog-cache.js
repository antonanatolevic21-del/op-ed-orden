(() => {
  if (window.OC_CATALOG_CACHE) return;

  let rows = null;
  let loading = null;

  async function waitForFirebase() {
    if (window.OPED_DB) return;
    await new Promise(resolve => {
      const timeout = window.setTimeout(resolve, 5000);
      window.addEventListener('oped-db-ready', () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  }

  async function load(force = false) {
    if (!force && rows) return rows;
    if (!force && loading) return loading;

    loading = (async () => {
      if (!force) {
        const cached = await window.OC_CATALOG_STORE?.read?.();
        if (cached?.rows?.length) {
          rows = cached.rows;
          return rows;
        }
      }
      await waitForFirebase();
      const [{ getApp, getApps }, { getFirestore, collection, getDocs }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
      ]);
      if (!getApps().length) throw new Error('Firebase ещё не инициализирован.');
      const snapshot = await getDocs(collection(getFirestore(getApp()), 'openings'));
      rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      void window.OC_CATALOG_STORE?.write?.(rows);
      return rows;
    })();

    try {
      return await loading;
    } finally {
      loading = null;
    }
  }

  async function byIds(ids) {
    const unique = [...new Set((ids || []).map(String).filter(Boolean))];
    const known = new Map((rows || window.OC_CATALOG_STORE?.peek?.() || []).map(row => [String(row.id), row]));
    const missing = unique.filter(id => !known.has(id));
    if (missing.length) {
      await waitForFirebase();
      const [{ getApp }, { getFirestore, collection, getDocs, query, where, documentId }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
      ]);
      const db = getFirestore(getApp());
      for (let offset = 0; offset < missing.length; offset += 30) {
        const snapshot = await getDocs(query(collection(db, 'openings'), where(documentId(), 'in', missing.slice(offset, offset + 30))));
        snapshot.docs.forEach(doc => known.set(doc.id, { id: doc.id, ...doc.data() }));
      }
    }
    // Partial results must never overwrite the full catalog cache.
    return unique.map(id => known.get(id)).filter(Boolean);
  }

  function peek() {
    return rows;
  }

  function invalidate() {
    rows = null;
  }

  window.OC_CATALOG_CACHE = { load, byIds, peek, invalidate };
  window.addEventListener('oped:catalog-ready', () => {
    const cachedRows = window.OC_CATALOG_STORE?.peek?.();
    if (cachedRows?.length) rows = cachedRows;
  });
})();
