(() => {
  if (window.__OC_MANUAL_TOP_EXISTING_MIGRATION_READY__) return;
  window.__OC_MANUAL_TOP_EXISTING_MIGRATION_READY__ = true;
  return;

  const clean = value => String(value ?? '').trim();
  const uniqueIds = values => [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))].slice(0, 100);
  let running = false;
  let completedFor = '';

  function normalize(value) {
    try {
      return window.OPED_DB?.normalizeNickname?.(value)
        || clean(value).toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
    } catch (_) {
      return clean(value).toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
    }
  }

  function ownUser() {
    return clean(
      document.querySelector('#oc-myname')?.value
      || localStorage.getItem('op-ed-primary-account-name')
      || localStorage.getItem('my-display-name')
    );
  }

  function topFrom(row) {
    if (!row || typeof row !== 'object') return { OP: [], ED: [] };
    return {
      OP: uniqueIds(row.OP || row.manualOP || row.op || []),
      ED: uniqueIds(row.ED || row.manualED || row.ed || [])
    };
  }

  function hasTop(top) {
    return Boolean(top && (top.OP?.length || top.ED?.length));
  }

  function legacyLocalTop(user, key) {
    try {
      const raw = JSON.parse(localStorage.getItem('manual-ranks') || '{}');
      const candidates = [raw?.[user], raw?.[key]];
      for (const row of candidates) {
        const top = topFrom(row);
        if (hasTop(top)) return top;
      }
    } catch (error) {
      console.warn('Could not read legacy local manual top', error);
    }
    return null;
  }

  function visibleManualTop(user, key) {
    const viewed = clean(document.querySelector('#oc-profile-user')?.value || user);
    if (!viewed || normalize(viewed) !== key) return null;

    const manualMode = document.querySelector('#oc-topmode-manual');
    const scoreMode = document.querySelector('#oc-topmode-score');
    if (scoreMode?.classList.contains('active')) return null;
    if (manualMode && !manualMode.classList.contains('active')) return null;

    const collect = selector => {
      const container = document.querySelector(selector);
      if (!container) return [];
      const result = [];
      const seen = new Set();
      container.querySelectorAll(':scope > .oc-profile-item').forEach(card => {
        const id = clean(
          card.dataset.explicitTopId
          || card.querySelector('[data-action="set-rank"][data-id]')?.dataset.id
          || card.querySelector('[data-action="open-card"][data-id]')?.dataset.id
          || card.querySelector('[data-id]')?.dataset.id
        );
        if (!id || seen.has(id) || result.length >= 100) return;
        seen.add(id);
        result.push(id);
      });
      return result;
    };

    const top = { OP: collect('#oc-profile-op'), ED: collect('#oc-profile-ed') };
    return hasTop(top) ? top : null;
  }

  async function waitForDb() {
    if (window.OPED_DB?.saveManualRanks) return window.OPED_DB;
    await Promise.race([
      new Promise(resolve => window.addEventListener('oped-db-ready', resolve, { once: true })),
      new Promise(resolve => setTimeout(resolve, 8000))
    ]);
    return window.OPED_DB?.saveManualRanks ? window.OPED_DB : null;
  }

  async function firebaseTools() {
    const [{ getApp, getApps }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
    ]);
    for (let attempt = 0; attempt < 120 && !getApps().length; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!getApps().length) throw new Error('Firebase ещё не готов.');
    return { db: firestore.getFirestore(getApp()), ...firestore };
  }

  async function migrateExistingTop() {
    if (running) return;
    const user = ownUser();
    const key = normalize(user);
    if (!user || !key || completedFor === key) return;

    running = true;
    try {
      const dbApi = await waitForDb();
      if (!dbApi) return;

      const tools = await firebaseTools();
      const manualRef = tools.doc(tools.db, 'manualRanks', key);
      const manualSnap = await tools.getDoc(manualRef);
      const currentTop = manualSnap.exists() ? topFrom(manualSnap.data() || {}) : { OP: [], ED: [] };

      // A non-empty current manualRanks document is authoritative.
      if (hasTop(currentTop)) {
        completedFor = key;
        return;
      }

      // If current storage is empty, recover any real top that still exists in an
      // older mirror, local storage or the already-rendered manual profile view.
      let existingTop = null;
      const profileSnap = await tools.getDoc(tools.doc(tools.db, 'userProfiles', key));
      if (profileSnap.exists()) {
        const profileTop = topFrom(profileSnap.data() || {});
        if (hasTop(profileTop)) existingTop = profileTop;
      }

      if (!existingTop) existingTop = legacyLocalTop(user, key);
      if (!existingTop) existingTop = visibleManualTop(user, key);

      // Do not mark the user as completed yet. The profile/top package may still
      // be rendering; later timers and the observer will retry and can recover it.
      if (!hasTop(existingTop)) return;

      await dbApi.saveManualRanks(user, existingTop);
      completedFor = key;
      try { localStorage.removeItem(`oc-explicit-top-draft-v1:${key}`); } catch (_) {}
      document.dispatchEvent(new CustomEvent('oc:top100-saved', {
        detail: { user, OP: existingTop.OP.slice(), ED: existingTop.ED.slice(), migrated: true }
      }));
      window.OC_TOAST?.show?.('Существующий топ-100 сохранён как актуальный ✓', { type: 'success' });
    } catch (error) {
      console.warn('Existing manual top migration skipped', error);
    } finally {
      running = false;
    }
  }

  function retrySoon() {
    window.setTimeout(migrateExistingTop, 0);
  }

  window.addEventListener('oped-account-restored', retrySoon);
  window.addEventListener('oped-db-ready', retrySoon);
  window.addEventListener('pageshow', () => window.setTimeout(migrateExistingTop, 50));
  document.querySelector('#oc-profile-user')?.addEventListener('change', retrySoon);

  const profile = document.querySelector('#oc-profile-panel');
  if (profile) {
    new MutationObserver(() => retrySoon()).observe(profile, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-profile-view'] });
  }

  [0, 300, 1000, 2500, 5000, 8000, 12000].forEach(delay => window.setTimeout(migrateExistingTop, delay));
})();
