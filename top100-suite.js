(() => {
  if (window.__OC_TOP100_SUITE_READY__) return;

  const DRAFT_PREFIX = 'oc-top100-draft-v2:';
  const MAX_HISTORY = 30;
  const state = {
    baseline: null,
    stack: [],
    index: -1,
    applying: false,
    initializedUser: '',
    dirty: false,
    pendingDraft: null,
    recordTimer: 0,
    exportUrls: []
  };

  const clean = value => String(value ?? '').trim();
  const norm = value => clean(value).toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function toast(message, type = '') {
    window.OC_TOAST?.show?.(message, { type });
    const status = document.querySelector('#oc-status');
    if (status) status.textContent = message;
  }

  function profilePanel() { return document.querySelector('#oc-profile-panel'); }
  function viewedUser() { return clean(document.querySelector('#oc-profile-user')?.value || document.querySelector('#oc-myname')?.value); }
  function isEditing() { return Boolean(document.querySelector('#oc-manual-edit-btn')?.classList.contains('active')); }
  function isTopView() { return profilePanel()?.dataset.profileView === 'top100'; }
  function activeType() { return document.querySelector('.oc-profile-top-type-btn.active')?.dataset.type === 'ED' ? 'ED' : 'OP'; }
  function containerFor(type) { return document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op'); }
  function cardsFor(type) { return [...(containerFor(type)?.children || [])].filter(node => node.classList?.contains('oc-profile-item') && node.classList.contains('manual')); }
  function cardId(card) { return clean(card?.querySelector('[data-action="set-rank"][data-id]')?.dataset.id); }

  function itemFromCard(card, type) {
    const img = card.querySelector('img');
    return {
      id: cardId(card),
      type,
      title: clean(card.querySelector('.oc-profile-name')?.textContent),
      meta: clean(card.querySelector('.oc-profile-meta')?.textContent),
      score: clean(card.querySelector('.oc-profile-score')?.textContent),
      image: clean(img?.getAttribute('src')),
      fallback: clean(img?.dataset.fallback)
    };
  }

  function snapshotFromDom() {
    return {
      user: viewedUser(),
      savedAtLocal: Date.now(),
      OP: cardsFor('OP').map(card => itemFromCard(card, 'OP')).filter(item => item.id),
      ED: cardsFor('ED').map(card => itemFromCard(card, 'ED')).filter(item => item.id)
    };
  }

  function idOrder(snapshot, type) { return (snapshot?.[type] || []).map(item => typeof item === 'string' ? String(item) : String(item.id || '')).filter(Boolean).slice(0, 100); }
  function fingerprint(snapshot) { return JSON.stringify({ OP: idOrder(snapshot, 'OP'), ED: idOrder(snapshot, 'ED') }); }
  function cloneSnapshot(snapshot) { return JSON.parse(JSON.stringify(snapshot || { user: viewedUser(), OP: [], ED: [] })); }

  function diffCount(a, b) {
    let changes = 0;
    ['OP', 'ED'].forEach(type => {
      const aa = idOrder(a, type); const bb = idOrder(b, type);
      const ids = new Set([...aa, ...bb]);
      ids.forEach(id => { if (aa.indexOf(id) !== bb.indexOf(id)) changes += 1; });
    });
    return changes;
  }

  function draftKey(user = viewedUser()) { return DRAFT_PREFIX + norm(user); }
  function readDraft(user = viewedUser()) {
    try { return JSON.parse(localStorage.getItem(draftKey(user)) || 'null'); } catch (_) { return null; }
  }
  function writeDraft(current) {
    if (!state.baseline || !current?.user) return;
    try {
      localStorage.setItem(draftKey(current.user), JSON.stringify({ baseline: state.baseline, current, updatedAt: Date.now() }));
    } catch (error) { console.warn('Could not save top-100 draft', error); }
  }
  function clearDraft(user = viewedUser()) { try { localStorage.removeItem(draftKey(user)); } catch (_) {} }

  function makeCard(item, type) {
    const card = document.createElement('div');
    card.className = 'oc-profile-item manual oc-manual-local-card';
    const image = clean(item.image);
    const imageHtml = image
      ? `<span class="oc-image-link"><div class="oc-profile-thumb"><img class="oc-track-image" src="${esc(image)}" data-fallback="${esc(item.fallback || '')}" alt="" loading="lazy" decoding="async"></div></span>`
      : `<span class="oc-image-link"><div class="oc-profile-thumb oc-manual-local-noimage">${type}</div></span>`;
    card.innerHTML = `<button type="button" class="oc-rank-jump-btn" data-action="set-rank" data-type="${type}" data-id="${esc(item.id)}">—</button>${imageHtml}<div><div class="oc-profile-name"><span>${esc(item.title || item.id)}</span></div>${item.meta ? `<div class="oc-profile-meta">${esc(item.meta)}</div>` : ''}</div><div class="oc-profile-score">${esc(item.score || '—')}</div><div class="oc-move-btns"><button class="oc-move-btn" data-action="move-up" data-type="${type}" data-id="${esc(item.id)}" title="Выше">▲</button><button class="oc-move-btn" data-action="move-down" data-type="${type}" data-id="${esc(item.id)}" title="Ниже">▼</button></div><div class="oc-manual-row-actions"><button type="button" class="oc-ar-top-btn" data-action="remove-from-top" data-type="${type}" data-id="${esc(item.id)}">Удалить из топа</button></div>`;
    return card;
  }

  function ensureEmptySlot(type) {
    const container = containerFor(type);
    if (!container) return;
    container.querySelector(':scope > .oc-manual-local-empty-slot')?.remove();
    const count = cardsFor(type).length;
    if (count >= 100) return;
    const slot = document.createElement('div');
    slot.className = 'oc-manual-local-empty-slot';
    slot.dataset.place = String(count + 1);
    slot.innerHTML = `<span class="oc-manual-local-empty-rank">${count + 1}</span><span class="oc-manual-local-empty-text">Пустое место</span>`;
    const toggle = container.querySelector('[data-action="toggle-profile-top"]');
    if (toggle) container.insertBefore(slot, toggle); else container.append(slot);
  }

  function renumber(type) {
    const cards = cardsFor(type);
    cards.forEach((card, index) => {
      const rank = card.querySelector('[data-action="set-rank"]');
      if (rank) rank.textContent = String(index + 1);
      const up = card.querySelector('[data-action="move-up"]');
      const down = card.querySelector('[data-action="move-down"]');
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === cards.length - 1;
    });
    ensureEmptySlot(type);
  }

  function applySnapshot(snapshot, { record = false } = {}) {
    if (!snapshot) return;
    state.applying = true;
    document.querySelectorAll('.oc-manual-insert-panel,.oc-manual-insert-zone').forEach(node => node.remove());
    ['OP', 'ED'].forEach(type => {
      const container = containerFor(type);
      if (!container) return;
      const existing = new Map(cardsFor(type).map(card => [cardId(card), card]));
      const toggle = container.querySelector('[data-action="toggle-profile-top"]');
      cardsFor(type).forEach(card => card.remove());
      (snapshot[type] || []).slice(0, 100).forEach(raw => {
        const item = typeof raw === 'string' ? { id: raw, type } : { ...raw, type };
        const card = existing.get(String(item.id)) || makeCard(item, type);
        if (toggle) container.insertBefore(card, toggle); else container.append(card);
      });
      renumber(type);
    });
    requestAnimationFrame(() => {
      state.applying = false;
      if (record) recordCurrent(); else updateToolbar();
    });
  }

  function pushState(snapshot) {
    const fp = fingerprint(snapshot);
    if (state.index >= 0 && fingerprint(state.stack[state.index]) === fp) return;
    state.stack = state.stack.slice(0, state.index + 1);
    state.stack.push(cloneSnapshot(snapshot));
    if (state.stack.length > 80) state.stack.shift();
    state.index = state.stack.length - 1;
    state.dirty = fingerprint(snapshot) !== fingerprint(state.baseline);
    if (state.dirty) writeDraft(snapshot); else clearDraft(snapshot.user);
    updateToolbar();
  }

  function recordCurrent() {
    if (state.applying || !isEditing()) return;
    pushState(snapshotFromDom());
  }

  function scheduleRecord() {
    if (state.applying || !isEditing()) return;
    clearTimeout(state.recordTimer);
    state.recordTimer = setTimeout(recordCurrent, 70);
  }

  function undo() {
    if (!isEditing() || state.index <= 0) return;
    state.index -= 1;
    const snapshot = cloneSnapshot(state.stack[state.index]);
    applySnapshot(snapshot);
    state.dirty = fingerprint(snapshot) !== fingerprint(state.baseline);
    if (state.dirty) writeDraft(snapshot); else clearDraft(snapshot.user);
    updateToolbar();
  }

  function redo() {
    if (!isEditing() || state.index >= state.stack.length - 1) return;
    state.index += 1;
    const snapshot = cloneSnapshot(state.stack[state.index]);
    applySnapshot(snapshot);
    state.dirty = fingerprint(snapshot) !== fingerprint(state.baseline);
    if (state.dirty) writeDraft(snapshot); else clearDraft(snapshot.user);
    updateToolbar();
  }

  function resetDraft() {
    if (!isEditing() || !state.baseline) return;
    if (!window.confirm('Отменить все несохранённые изменения и вернуться к последней сохранённой версии топа?')) return;
    state.stack = [cloneSnapshot(state.baseline)];
    state.index = 0;
    state.dirty = false;
    state.pendingDraft = null;
    clearDraft();
    applySnapshot(state.baseline);
    updateToolbar();
  }

  function jumpToCard(card) {
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('oc-top100-flash');
    void card.offsetWidth;
    card.classList.add('oc-top100-flash');
    setTimeout(() => card.classList.remove('oc-top100-flash'), 1500);
  }

  function searchMatches(query) {
    const q = clean(query).toLowerCase();
    if (!q) return [];
    return cardsFor(activeType()).map((card, index) => ({ card, place: index + 1, title: clean(card.querySelector('.oc-profile-name')?.textContent) }))
      .filter(row => row.title.toLowerCase().includes(q)).slice(0, 8);
  }

  function renderSearchResults() {
    const input = document.querySelector('#oc-top100-search');
    const results = document.querySelector('#oc-top100-search-results');
    if (!input || !results) return;
    const rows = searchMatches(input.value);
    results.innerHTML = rows.map(row => `<button type="button" data-top100-result-place="${row.place}"><strong>№${row.place}</strong><span>${esc(row.title)}</span></button>`).join('');
    results.hidden = !rows.length;
  }

  function jumpToPlace(place) {
    const index = Math.max(1, Math.min(100, Math.round(Number(place) || 0))) - 1;
    jumpToCard(cardsFor(activeType())[index]);
  }

  async function firebaseTools() {
    const [{ getApp, getApps }, firestore, { getAuth }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js')
    ]);
    if (!getApps().length) throw new Error('Firebase ещё не готов.');
    const app = getApp();
    return { app, auth: getAuth(app), db: firestore.getFirestore(app), ...firestore };
  }

  async function ratedIdsByType(user, safe, tools) {
    let snapshot = null;
    try { snapshot = await tools.getDocs(tools.query(tools.collection(tools.db, 'ratings'), tools.where('nicknameKey', '==', safe))); } catch (_) {}
    if (!snapshot?.size) {
      try { snapshot = await tools.getDocs(tools.query(tools.collection(tools.db, 'ratings'), tools.where('nickname', '==', user))); } catch (_) {}
    }
    const ids = new Set();
    snapshot?.docs.forEach(doc => {
      const row = doc.data() || {};
      const id = clean(row.openingId);
      if (id && [row.score, row.personalScore, row.songScore, row.visualScore].some(value => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)))) ids.add(id);
    });
    const catalog = window.OC_CATALOG_CACHE?.load ? await window.OC_CATALOG_CACHE.load() : [];
    const typeById = new Map((catalog || []).map(entry => [String(entry.id), entry.type === 'ED' ? 'ED' : 'OP']));
    const result = { OP: [], ED: [] };
    ids.forEach(id => { const type = typeById.get(String(id)); if (type) result[type].push(String(id)); });
    return result;
  }

  function historyEntry(snapshot, savedAtLocal = Date.now()) {
    return { savedAtLocal, OP: idOrder(snapshot, 'OP'), ED: idOrder(snapshot, 'ED') };
  }

  function dedupeHistory(entries) {
    const seen = new Set();
    const out = [];
    for (const entry of entries || []) {
      const fp = JSON.stringify({ OP: (entry.OP || []).map(String), ED: (entry.ED || []).map(String) });
      if (seen.has(fp)) continue;
      seen.add(fp);
      out.push({ savedAtLocal: Number(entry.savedAtLocal) || Date.now(), OP: (entry.OP || []).map(String).slice(0,100), ED: (entry.ED || []).map(String).slice(0,100) });
      if (out.length >= MAX_HISTORY) break;
    }
    return out;
  }

  async function saveCurrent() {
    const user = viewedUser();
    if (!user) throw new Error('Не удалось определить пользователя.');
    const snapshot = snapshotFromDom();
    const safe = norm(user);
    const tools = await firebaseTools();
    const authUser = tools.auth.currentUser;
    if (!authUser || authUser.isAnonymous) throw new Error('Для сохранения топа нужно войти в личный аккаунт.');

    const manualRef = tools.doc(tools.db, 'manualRanks', safe);
    const previousDoc = await tools.getDoc(manualRef);
    const previous = previousDoc.exists() ? previousDoc.data() || {} : {};
    const priorOrder = { user, OP: (previous.OP || previous.manualOP || []).map(id => ({ id: String(id) })), ED: (previous.ED || previous.manualED || []).map(id => ({ id: String(id) })) };
    const oldHistory = Array.isArray(previous.history) ? previous.history : [];
    const seed = idOrder(priorOrder, 'OP').length || idOrder(priorOrder, 'ED').length ? [historyEntry(priorOrder, previous.updatedAt?.toMillis?.() || Date.now() - 1)] : [];
    const history = dedupeHistory([historyEntry(snapshot), ...oldHistory, ...seed]);

    const rated = await ratedIdsByType(user, safe, tools);
    const op = idOrder(snapshot, 'OP'); const ed = idOrder(snapshot, 'ED');
    const opSet = new Set(op); const edSet = new Set(ed);
    const excludedOP = rated.OP.filter(id => !opSet.has(String(id)));
    const excludedED = rated.ED.filter(id => !edSet.has(String(id)));
    const payload = { nickname: user, nicknameKey: safe, ownerUid: String(authUser.uid), OP: op, ED: ed, manualOP: op, manualED: ed, excludedOP, excludedED, history, updatedAt: tools.serverTimestamp() };

    await tools.setDoc(manualRef, payload, { merge: true });
    const profilePayload = { ...payload }; delete profilePayload.history;
    try { await tools.setDoc(tools.doc(tools.db, 'userProfiles', safe), profilePayload, { merge: true }); } catch (error) { console.warn('Profile mirror save failed', error); }
    const verified = await tools.getDoc(manualRef);
    const saved = verified.data() || {};
    if (JSON.stringify((saved.OP || []).map(String)) !== JSON.stringify(op) || JSON.stringify((saved.ED || []).map(String)) !== JSON.stringify(ed)) throw new Error('Firebase вернул другой порядок.');

    state.baseline = cloneSnapshot(snapshot);
    state.stack = [cloneSnapshot(snapshot)];
    state.index = 0;
    state.dirty = false;
    state.pendingDraft = null;
    clearDraft(user);
    document.querySelector('#oc-manual-save-btn')?.classList.remove('active');
    updateToolbar();
    document.dispatchEvent(new CustomEvent('oc:top100-saved', { detail: { user, snapshot } }));
    return snapshot;
  }

  async function onSaveClick(event) {
    const button = event.target.closest?.('#oc-manual-save-btn');
    if (!button || !isTopView()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.disabled) return;
    button.disabled = true;
    const old = button.textContent;
    button.textContent = 'Сохраняю…';
    try {
      await saveCurrent();
      toast('Топ-100 сохранён ✓', 'success');
    } catch (error) {
      console.error('Top-100 save failed', error);
      toast(error?.message || 'Не удалось сохранить топ-100.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  async function itemsFromIds(ids, type) {
    const catalog = window.OC_CATALOG_CACHE?.load ? await window.OC_CATALOG_CACHE.load() : [];
    const map = new Map((catalog || []).map(entry => [String(entry.id), entry]));
    const live = new Map(cardsFor(type).map(card => [cardId(card), itemFromCard(card, type)]));
    return (ids || []).map(id => {
      const key = String(id); const entry = map.get(key); const local = live.get(key);
      return {
        id: key, type,
        title: local?.title || entry?.title || key,
        meta: local?.meta || [entry?.year, entry?.season].filter(Boolean).join(' · '),
        score: local?.score || '—',
        image: local?.image || entry?.image || '',
        fallback: local?.fallback || entry?.fallbackImage || ''
      };
    });
  }

  async function snapshotFromOrders(user, OP, ED) {
    return { user, savedAtLocal: Date.now(), OP: await itemsFromIds(OP, 'OP'), ED: await itemsFromIds(ED, 'ED') };
  }

  function modalRoot(kind) {
    document.querySelector('.oc-top100-modal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'oc-top100-modal';
    modal.dataset.kind = kind;
    modal.innerHTML = `<div class="oc-top100-dialog"><button type="button" class="oc-top100-modal-close" aria-label="Закрыть">×</button><div class="oc-top100-modal-body"></div></div>`;
    document.body.append(modal);
    modal.addEventListener('click', event => { if (event.target === modal || event.target.closest('.oc-top100-modal-close')) closeModal(); });
    return modal;
  }
  function closeModal() {
    document.querySelector('.oc-top100-modal')?.remove();
    state.exportUrls.forEach(url => URL.revokeObjectURL(url)); state.exportUrls = [];
  }

  async function loadManualRows() {
    const tools = await firebaseTools();
    const snap = await tools.getDocs(tools.collection(tools.db, 'manualRanks'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  function rowUser(row) { return clean(row.nickname || row.displayName || row.name || row.id); }
  function rowForUser(rows, user) { const key = norm(user); return rows.find(row => norm(row.nicknameKey || rowUser(row)) === key) || null; }
  function localOrderForUser(user, type) {
    if (norm(user) === norm(viewedUser()) && isEditing()) return idOrder(snapshotFromDom(), type);
    return null;
  }
  function rowOrder(row, type) { return (row?.[type] || row?.[`manual${type}`] || []).map(String).slice(0,100); }

  async function openHistory() {
    const modal = modalRoot('history'); const body = modal.querySelector('.oc-top100-modal-body');
    body.innerHTML = '<h2>История топ-100</h2><p class="oc-top100-muted">Загружаю сохранённые версии…</p>';
    try {
      const tools = await firebaseTools(); const user = viewedUser(); const safe = norm(user);
      const docSnap = await tools.getDoc(tools.doc(tools.db, 'manualRanks', safe));
      const row = docSnap.exists() ? docSnap.data() || {} : {};
      const history = Array.isArray(row.history) ? row.history : [];
      body.innerHTML = `<div class="oc-top100-modal-head"><div><h2>История топ-100</h2><p>${esc(user)} · последние ${MAX_HISTORY} сохранений</p></div></div><div class="oc-top100-history-list">${history.length ? history.map((entry, index) => `<div class="oc-top100-history-row"><div><strong>${new Date(Number(entry.savedAtLocal) || Date.now()).toLocaleString('ru-RU')}</strong><span>OP: ${(entry.OP || []).length} · ED: ${(entry.ED || []).length}</span></div><button type="button" data-history-index="${index}" ${isEditing() ? '' : 'disabled'}>Восстановить</button></div>`).join('') : '<div class="oc-empty">История появится после следующего сохранения топа.</div>'}</div>`;
      body.addEventListener('click', async event => {
        const button = event.target.closest('[data-history-index]'); if (!button || !isEditing()) return;
        const entry = history[Number(button.dataset.historyIndex)]; if (!entry) return;
        const snapshot = await snapshotFromOrders(user, entry.OP || [], entry.ED || []);
        pushState(snapshot); applySnapshot(snapshot); state.dirty = true; writeDraft(snapshot); updateToolbar(); closeModal(); toast('Старая версия восстановлена локально. Нажми «Сохранить топ-100», чтобы применить её.', 'success');
      });
    } catch (error) { body.innerHTML = `<h2>История топ-100</h2><div class="oc-top100-error">${esc(error?.message || 'Не удалось загрузить историю.')}</div>`; }
  }

  async function openCompare() {
    const modal = modalRoot('compare'); const body = modal.querySelector('.oc-top100-modal-body');
    body.innerHTML = '<h2>Сравнение топов</h2><p class="oc-top100-muted">Загружаю профили…</p>';
    try {
      const rows = await loadManualRows();
      const users = [...new Set(rows.map(rowUser).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ru'));
      if (users.length < 2) throw new Error('Для сравнения нужно хотя бы два сохранённых топа.');
      const current = users.find(user => norm(user) === norm(viewedUser())) || users[0];
      const other = users.find(user => norm(user) !== norm(current)) || users[1];
      body.innerHTML = `<div class="oc-top100-modal-head"><div><h2>Сравнение топов</h2><p>Общие треки, расхождения и уникальные позиции.</p></div></div><div class="oc-top100-compare-controls"><select id="oc-top100-compare-a">${users.map(u => `<option ${u===current?'selected':''}>${esc(u)}</option>`).join('')}</select><span>vs</span><select id="oc-top100-compare-b">${users.map(u => `<option ${u===other?'selected':''}>${esc(u)}</option>`).join('')}</select><select id="oc-top100-compare-type"><option value="OP">Опенинги</option><option value="ED">Эндинги</option></select></div><div id="oc-top100-compare-result"></div>`;
      const render = async () => {
        const a = body.querySelector('#oc-top100-compare-a').value; const b = body.querySelector('#oc-top100-compare-b').value; const type = body.querySelector('#oc-top100-compare-type').value;
        const ao = localOrderForUser(a, type) || rowOrder(rowForUser(rows,a), type); const bo = localOrderForUser(b, type) || rowOrder(rowForUser(rows,b), type);
        const catalog = window.OC_CATALOG_CACHE?.load ? await window.OC_CATALOG_CACHE.load() : [];
        const titles = new Map((catalog || []).map(e => [String(e.id), e.title || String(e.id)]));
        const posA = new Map(ao.map((id,i)=>[String(id),i+1])); const posB = new Map(bo.map((id,i)=>[String(id),i+1]));
        const common = ao.filter(id => posB.has(String(id))).map(id => ({ id:String(id), a:posA.get(String(id)), b:posB.get(String(id)) }));
        const overlap = Math.round(common.length / Math.max(1, Math.max(ao.length, bo.length)) * 100);
        const gaps = common.map(row => ({ ...row, gap: Math.abs(row.a-row.b) })).sort((x,y)=>y.gap-x.gap).slice(0,15);
        const onlyA = ao.filter(id => !posB.has(String(id))); const onlyB = bo.filter(id => !posA.has(String(id)));
        body.querySelector('#oc-top100-compare-result').innerHTML = `<div class="oc-top100-compare-summary"><div><strong>${overlap}%</strong><span>совпадение</span></div><div><strong>${common.length}</strong><span>общих</span></div><div><strong>${onlyA.length}</strong><span>только у ${esc(a)}</span></div><div><strong>${onlyB.length}</strong><span>только у ${esc(b)}</span></div></div><h3>Самые большие расхождения</h3><div class="oc-top100-compare-table">${gaps.length ? gaps.map(row => `<div><span>${esc(titles.get(row.id) || row.id)}</span><b>№${row.a} → №${row.b}</b><em>Δ ${row.gap}</em></div>`).join('') : '<div class="oc-empty">Общих треков нет.</div>'}</div><div class="oc-top100-compare-unique"><section><h3>Только у ${esc(a)}</h3>${onlyA.slice(0,20).map(id => `<p>№${posA.get(String(id))} · ${esc(titles.get(String(id)) || id)}</p>`).join('') || '<p>—</p>'}</section><section><h3>Только у ${esc(b)}</h3>${onlyB.slice(0,20).map(id => `<p>№${posB.get(String(id))} · ${esc(titles.get(String(id)) || id)}</p>`).join('') || '<p>—</p>'}</section></div>`;
      };
      body.querySelectorAll('#oc-top100-compare-a,#oc-top100-compare-b,#oc-top100-compare-type').forEach(el => el.addEventListener('change', () => void render()));
      await render();
    } catch (error) { body.innerHTML = `<h2>Сравнение топов</h2><div class="oc-top100-error">${esc(error?.message || 'Не удалось сравнить топы.')}</div>`; }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = clean(text).split(/\s+/); let line = ''; let lines = 0;
    for (let i=0;i<words.length;i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y + lines*lineHeight); lines += 1; line = words[i];
        if (lines >= maxLines - 1) break;
      } else line = test;
    }
    if (lines < maxLines) {
      if (lines === maxLines - 1 && words.length && ctx.measureText(line).width > maxWidth) while (line.length && ctx.measureText(line + '…').width > maxWidth) line = line.slice(0,-1);
      ctx.fillText(line + (lines === maxLines - 1 && words.join(' ').length > line.length ? '…' : ''), x, y + lines*lineHeight);
    }
  }

  function loadCanvasImage(url) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const img = new Image(); img.crossOrigin = 'anonymous'; img.referrerPolicy = 'no-referrer';
      const timer = setTimeout(() => resolve(null), 3500);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      try { img.src = new URL(url, document.baseURI).href; } catch (_) { resolve(null); }
    });
  }

  async function renderExportCanvas(items, startPlace, type) {
    const size = 1500, cell = 300; const canvas = document.createElement('canvas'); canvas.width=size; canvas.height=size; const ctx=canvas.getContext('2d');
    ctx.fillStyle='#0b0a10'; ctx.fillRect(0,0,size,size);
    for (let i=0;i<25;i++) {
      const item=items[i] || null; const col=i%5, row=Math.floor(i/5), x=col*cell, y=row*cell;
      ctx.fillStyle='#100d16'; ctx.fillRect(x+5,y+5,cell-10,cell-10); ctx.strokeStyle='#30283a'; ctx.lineWidth=2; ctx.strokeRect(x+5,y+5,cell-10,cell-10);
      const preferred = clean(item?.fallback) || clean(item?.fallbackImage) || clean(item?.image); const img = item ? await loadCanvasImage(preferred) : null;
      const ix=x+14, iy=y+14, iw=cell-28, ih=170;
      ctx.fillStyle='#17131e'; ctx.fillRect(ix,iy,iw,ih);
      if (img) { const scale=Math.max(iw/img.width,ih/img.height), sw=iw/scale, sh=ih/scale, sx=(img.width-sw)/2, sy=(img.height-sh)/2; try { ctx.drawImage(img,sx,sy,sw,sh,ix,iy,iw,ih); } catch (_) {} }
      ctx.fillStyle='rgba(8,7,12,.82)'; ctx.fillRect(ix,iy,72,44); ctx.fillStyle=type==='ED'?'#ff5f86':'#08d9d6'; ctx.font='800 24px Space Mono, monospace'; ctx.fillText(String(startPlace+i),ix+10,iy+30);
      ctx.fillStyle='#f5f3fa'; ctx.font='700 18px Inter, Arial, sans-serif'; wrapText(ctx,item?.title || 'Пустое место',x+16,y+214,cell-32,24,3);
      ctx.fillStyle='#8f879b'; ctx.font='600 13px Space Mono, monospace'; ctx.fillText(item?.meta || type,x+16,y+286);
    }
    return canvas;
  }

  async function exportItemsForUser(user, type) {
    let ids = localOrderForUser(user,type);
    if (!ids) {
      const tools=await firebaseTools(); const docSnap=await tools.getDoc(tools.doc(tools.db,'manualRanks',norm(user))); const row=docSnap.exists()?docSnap.data()||{}:{}; ids=rowOrder(row,type);
    }
    const items=await itemsFromIds(ids,type); const map=new Map(items.map(item=>[item.id,item]));
    return Array.from({length:100},(_,i)=>{const id=ids[i]; return id?map.get(String(id))||{id:String(id),title:String(id),type}:null;});
  }

  async function openExport() {
    const modal=modalRoot('export'); const body=modal.querySelector('.oc-top100-modal-body'); const user=viewedUser(); const type=activeType();
    body.innerHTML=`<div class="oc-top100-modal-head"><div><h2>Экспорт топ-100</h2><p>${esc(user)} · ${type} · четыре картинки по 25 мест, сетка 5×5.</p></div></div><div class="oc-top100-export-status">Подготавливаю карточки…</div><div class="oc-top100-export-grid"></div>`;
    try {
      const all=await exportItemsForUser(user,type); const grid=body.querySelector('.oc-top100-export-grid'); const status=body.querySelector('.oc-top100-export-status');
      for (let part=0;part<4;part++) {
        status.textContent=`Генерирую ${part+1} из 4…`;
        const canvas=await renderExportCanvas(all.slice(part*25,part*25+25),part*25+1,type);
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Не удалось собрать PNG.')),'image/png'));
        const url=URL.createObjectURL(blob); state.exportUrls.push(url); const from=part*25+1,to=part*25+25; const safeUser=norm(user)||'user';
        const card=document.createElement('div'); card.className='oc-top100-export-card'; card.innerHTML=`<img src="${url}" alt="Топ ${from}–${to}"><div><strong>Места ${from}–${to}</strong><a download="top100-${safeUser}-${type.toLowerCase()}-${from}-${to}.png" href="${url}">Скачать PNG</a></div>`; grid.append(card);
      }
      status.textContent='Готово: четыре изображения 5×5.';
    } catch (error) { body.querySelector('.oc-top100-export-status').textContent=error?.message||'Не удалось создать изображения.'; }
  }

  function ensureToolbar() {
    if (document.querySelector('.oc-top100-toolbar')) return;
    const columns=document.querySelector('#oc-profile-panel .oc-profile-columns'); if(!columns) return;
    const toolbar=document.createElement('div'); toolbar.className='oc-top100-toolbar';
    toolbar.innerHTML=`<div class="oc-top100-toolbar-type"></div><div class="oc-top100-search-wrap"><input id="oc-top100-search" type="search" placeholder="Найти в топе…" autocomplete="off"><div id="oc-top100-search-results" class="oc-top100-search-results" hidden></div></div><div class="oc-top100-jump"><input id="oc-top100-jump" type="number" min="1" max="100" placeholder="№"><button type="button" data-top100-jump>Перейти</button></div><div class="oc-top100-history-actions"><button type="button" data-top100-undo title="Отменить">↶</button><button type="button" data-top100-redo title="Вернуть">↷</button><button type="button" data-top100-reset>Сбросить</button></div><span class="oc-top100-dirty" data-top100-dirty>Сохранено</span><div class="oc-top100-extra"><button type="button" data-top100-history>История</button><button type="button" data-top100-compare>Сравнить</button><button type="button" data-top100-export>4 PNG</button></div><div class="oc-top100-toolbar-save"></div>`;
    columns.before(toolbar);
    const typeSwitch=document.querySelector('.oc-profile-top-type-switch'); if(typeSwitch) toolbar.querySelector('.oc-top100-toolbar-type').append(typeSwitch);
    const save=document.querySelector('#oc-manual-save-btn'); if(save) toolbar.querySelector('.oc-top100-toolbar-save').append(save);
    const edit=document.querySelector('#oc-manual-edit-btn'); if(edit) toolbar.querySelector('.oc-top100-toolbar-save').prepend(edit);

    toolbar.querySelector('#oc-top100-search').addEventListener('input',renderSearchResults);
    toolbar.querySelector('#oc-top100-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();const first=toolbar.querySelector('[data-top100-result-place]');if(first)jumpToPlace(first.dataset.top100ResultPlace);}});
    toolbar.querySelector('#oc-top100-search-results').addEventListener('click',event=>{const btn=event.target.closest('[data-top100-result-place]');if(btn){jumpToPlace(btn.dataset.top100ResultPlace);toolbar.querySelector('#oc-top100-search-results').hidden=true;}});
    toolbar.querySelector('[data-top100-jump]').addEventListener('click',()=>jumpToPlace(toolbar.querySelector('#oc-top100-jump').value));
    toolbar.querySelector('#oc-top100-jump').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();jumpToPlace(event.target.value);}});
    toolbar.querySelector('[data-top100-undo]').addEventListener('click',undo); toolbar.querySelector('[data-top100-redo]').addEventListener('click',redo); toolbar.querySelector('[data-top100-reset]').addEventListener('click',resetDraft);
    toolbar.querySelector('[data-top100-history]').addEventListener('click',()=>void openHistory()); toolbar.querySelector('[data-top100-compare]').addEventListener('click',()=>void openCompare()); toolbar.querySelector('[data-top100-export]').addEventListener('click',()=>void openExport());
    document.addEventListener('click',event=>{if(!event.target.closest('.oc-top100-search-wrap'))toolbar.querySelector('#oc-top100-search-results').hidden=true;});
    updateToolbar();
  }

  function updateToolbar() {
    ensureToolbar(); const toolbar=document.querySelector('.oc-top100-toolbar'); if(!toolbar)return;
    toolbar.classList.toggle('editing',isEditing()); toolbar.classList.toggle('dirty',state.dirty);
    const dirty=toolbar.querySelector('[data-top100-dirty]');
    if(dirty){const count=state.baseline?diffCount(state.baseline,snapshotFromDom()):0;dirty.textContent=state.pendingDraft?'Есть старый черновик':(state.dirty?`Несохранено: ${count}`:'Сохранено');}
    const undoBtn=toolbar.querySelector('[data-top100-undo]'); const redoBtn=toolbar.querySelector('[data-top100-redo]'); const resetBtn=toolbar.querySelector('[data-top100-reset]');
    if(undoBtn)undoBtn.disabled=!isEditing()||state.index<=0; if(redoBtn)redoBtn.disabled=!isEditing()||state.index>=state.stack.length-1; if(resetBtn)resetBtn.disabled=!isEditing()||!state.dirty;
  }

  async function ensureExpanded() {
    ['OP','ED'].forEach(type=>{const btn=containerFor(type)?.querySelector('[data-action="toggle-profile-top"]');if(btn&&/Показать весь топ/i.test(clean(btn.textContent)))btn.click();});
    await sleep(120);
  }

  async function startEditingSession() {
    const user=viewedUser(); if(!user||!isEditing())return;
    await ensureExpanded(); await sleep(80);
    const baseline=snapshotFromDom(); state.baseline=cloneSnapshot(baseline); state.stack=[cloneSnapshot(baseline)]; state.index=0; state.initializedUser=norm(user); state.dirty=false; state.pendingDraft=null;
    const draft=readDraft(user);
    if(draft?.current&&draft?.baseline){
      if(fingerprint(draft.baseline)===fingerprint(baseline)&&fingerprint(draft.current)!==fingerprint(baseline)){
        const restored=cloneSnapshot(draft.current); state.stack.push(restored); state.index=1; state.dirty=true; applySnapshot(restored); toast('Несохранённый черновик топа восстановлен.', 'success');
      }else if(fingerprint(draft.current)!==fingerprint(baseline)){state.pendingDraft=draft;}
    }
    updateToolbar();
  }

  function watchEditing() {
    const edit=document.querySelector('#oc-manual-edit-btn'); if(!edit)return;
    let previous=edit.classList.contains('active');
    new MutationObserver(()=>{const now=edit.classList.contains('active');if(now!==previous){previous=now;if(now)setTimeout(()=>void startEditingSession(),60);else{state.dirty=false;state.stack=[];state.index=-1;state.baseline=null;updateToolbar();}}}).observe(edit,{attributes:true,attributeFilter:['class']});
    if(previous)setTimeout(()=>void startEditingSession(),60);
  }

  function init() {
    ensureToolbar(); void ensureExpanded(); watchEditing();
    ['OP','ED'].forEach(type=>{const container=containerFor(type);if(container)new MutationObserver(scheduleRecord).observe(container,{childList:true,subtree:true,characterData:true});});
    document.addEventListener('click',onSaveClick,true);
    document.addEventListener('keydown',event=>{if(!isTopView()||!isEditing()||/input|textarea|select/i.test(event.target?.tagName||''))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}});
    window.addEventListener('beforeunload',event=>{if(!state.dirty)return;event.preventDefault();event.returnValue='';});
    document.querySelector('.oc-profile-top-type-switch')?.addEventListener('click',()=>setTimeout(()=>{renderSearchResults();updateToolbar();},0));
    window.__OC_TOP100_SUITE_READY__=true;
    document.documentElement.classList.remove('oc-top100-loading');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
