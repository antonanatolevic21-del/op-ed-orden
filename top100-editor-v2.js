(() => {
  if (window.__OC_TOP100_EDITOR_V2_READY__) return;
  window.__OC_TOP100_EDITOR_V2_READY__ = true;

  const VERSION = 2;
  const MAX_HISTORY = 30;
  const CONFIRMED_LEGACY_MANUAL_TOP_KEYS = new Set(['пёс_кошачий', 'пес_кошачий', 'egortos', 'кофа', 'holdes']);
  const DRAFT_PREFIX = 'oc-top100-editor-v2-draft:';
  const state = {
    user: '', key: '', loaded: false, loading: false, editing: false, applying: false, saving: false,
    baseline: { OP: [], ED: [] }, draft: { OP: [], ED: [] }, undo: [], redo: [], expanded: { OP: false, ED: false },
    catalog: new Map(), meta: new Map(), scores: new Map(), scoresLoaded: false, rerenderTimer: 0, drag: null
  };

  const clean = value => String(value ?? '').trim();
  const uniqueIds = values => [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))].slice(0, 100);
  const cloneOrder = value => ({ OP: uniqueIds(value?.OP), ED: uniqueIds(value?.ED) });
  const fingerprint = value => JSON.stringify(cloneOrder(value));
  const normalize = value => {
    try { return window.OPED_DB?.normalizeNickname?.(value) || clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60); }
    catch (_) { return clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60); }
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const containerFor = type => document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op');
  const profilePanel = () => document.querySelector('#oc-profile-panel');
  const editButton = () => document.querySelector('#oc-manual-edit-btn');
  const saveButton = () => document.querySelector('#oc-manual-save-btn');
  const viewedUser = () => clean(document.querySelector('#oc-profile-user')?.value || document.querySelector('#oc-myname')?.value);
  const ownUser = () => clean(document.querySelector('#oc-myname')?.value || localStorage.getItem('op-ed-primary-account-name') || localStorage.getItem('my-display-name'));
  const isOwnProfile = () => Boolean(viewedUser() && ownUser() && normalize(viewedUser()) === normalize(ownUser()));
  const isTopView = () => profilePanel()?.dataset.profileView === 'top100';
  const isEditing = () => Boolean(editButton()?.classList.contains('active'));
  const dirty = () => fingerprint(state.draft) !== fingerprint(state.baseline);
  const draftKey = key => DRAFT_PREFIX + key;
  const isVisibleManualTop = row => {
    const key = normalize(row?.nicknameKey || row?.nickname || row?.displayName || row?.name || row?.id);
    return row?.manualCreated === true || CONFIRMED_LEGACY_MANUAL_TOP_KEYS.has(key);
  };

  function toast(message, type = '') {
    window.OC_TOAST?.show?.(message, { type });
    const status = document.querySelector('#oc-status');
    if (status) status.textContent = message;
  }

  async function firebaseTools() {
    const [{ getApp, getApps }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
    ]);
    for (let attempt = 0; attempt < 120 && !getApps().length; attempt += 1) await new Promise(resolve => setTimeout(resolve, 50));
    if (!getApps().length) throw new Error('Firebase ещё не готов.');
    return { db: firestore.getFirestore(getApp()), ...firestore };
  }

  async function loadCatalog() {
    if (state.catalog.size) return;
    try {
      const rows = window.OC_CATALOG_CACHE?.load ? await window.OC_CATALOG_CACHE.load() : [];
      state.catalog = new Map((rows || []).map(row => [String(row.id), row]));
    } catch (error) { console.warn('Top-100 editor catalog load failed', error); }
  }

  async function loadUserScores(user, tools) {
    state.scores = new Map();
    state.scoresLoaded = false;
    const snapshots = [];
    try {
      snapshots.push(await tools.getDocs(tools.query(
        tools.collection(tools.db, 'ratings'),
        tools.where('nicknameKey', '==', normalize(user))
      )));
    } catch (_) {}
    if (!snapshots.some(snapshot => snapshot.size)) {
      try {
        snapshots.push(await tools.getDocs(tools.query(
          tools.collection(tools.db, 'ratings'),
          tools.where('nickname', '==', user)
        )));
      } catch (_) {}
    }
    snapshots.forEach(snapshot => snapshot.docs.forEach(doc => {
      const row = doc.data() || {};
      const id = clean(row.openingId);
      const score = Number(row.score);
      if (id && Number.isFinite(score)) state.scores.set(id, score);
    }));
    state.scoresLoaded = true;
  }

  function displayScore(value) {
    const score = Number(value);
    return Number.isFinite(score) ? score.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) : '—';
  }

  function captureMetaFromDom() {
    ['OP', 'ED'].forEach(type => {
      containerFor(type)?.querySelectorAll('.oc-profile-item').forEach(card => {
        const id = clean(card.dataset.top100Id || card.dataset.explicitTopId || card.querySelector('[data-id]')?.dataset.id);
        if (!id) return;
        const img = card.querySelector('img');
        state.meta.set(`${type}:${id}`, {
          title: clean(card.querySelector('.oc-profile-name')?.textContent),
          meta: clean(card.querySelector('.oc-profile-meta')?.textContent),
          score: clean(card.querySelector('.oc-profile-score')?.textContent),
          image: clean(img?.getAttribute('src')), fallback: clean(img?.dataset.fallback)
        });
      });
    });
  }

  function captureInsertMeta(panel, type, id) {
    const selected = panel?.querySelector('.oc-manual-insert-result.selected');
    const img = selected?.querySelector('img') || panel?.querySelector('.oc-manual-insert-preview img');
    state.meta.set(`${type}:${id}`, {
      title: clean(panel?.querySelector('.oc-manual-insert-preview-title')?.textContent || selected?.querySelector('.oc-manual-insert-result-title')?.textContent || id),
      meta: clean(selected?.querySelector('.oc-manual-insert-result-meta')?.textContent),
      score: clean(selected?.querySelector('.oc-manual-insert-result-score')?.textContent),
      image: clean(img?.getAttribute('src')), fallback: clean(img?.dataset.fallback)
    });
  }

  function readLocalDraft(key) {
    try {
      const row = JSON.parse(localStorage.getItem(draftKey(key)) || 'null');
      if (!row || row.version !== VERSION || !row.draft) return null;
      return cloneOrder(row.draft);
    } catch (_) { return null; }
  }

  function persistDraft() {
    if (!state.key) return;
    try {
      if (dirty()) localStorage.setItem(draftKey(state.key), JSON.stringify({ version: VERSION, draft: cloneOrder(state.draft), savedAt: Date.now() }));
      else localStorage.removeItem(draftKey(state.key));
    } catch (_) {}
  }

  function clearLocalDraft() {
    try { if (state.key) localStorage.removeItem(draftKey(state.key)); } catch (_) {}
  }

  function historyEntry(order, savedAtLocal = Date.now()) {
    const cleanOrder = cloneOrder(order);
    return { savedAtLocal, OP: cleanOrder.OP, ED: cleanOrder.ED };
  }

  function dedupeHistory(entries) {
    const seen = new Set(), result = [];
    for (const entry of entries || []) {
      const cleanEntry = historyEntry(entry, Number(entry?.savedAtLocal) || Date.now());
      const key = fingerprint(cleanEntry);
      if (seen.has(key)) continue;
      seen.add(key); result.push(cleanEntry);
      if (result.length >= MAX_HISTORY) break;
    }
    return result;
  }

  function scoreFromAllRatings(id) {
    const node = [...document.querySelectorAll('#oc-allratings-columns [data-id]')].find(el => clean(el.dataset.id) === String(id));
    const card = node?.closest('.oc-card, .oc-profile-item, article, [data-opening-id]');
    return clean(card?.querySelector('.oc-profile-score, .oc-score, .oc-unified-score')?.textContent);
  }

  function metaFor(type, id) {
    const cached = state.meta.get(`${type}:${id}`) || {};
    const entry = state.catalog.get(String(id)) || {};
    const seasons = { winter:'Зима', spring:'Весна', summer:'Лето', fall:'Осень' };
    return {
      title: cached.title || clean(entry.title || entry.anime || id),
      meta: cached.meta || [entry.year, seasons[entry.season] || entry.season].filter(Boolean).join(' · '),
      score: state.scoresLoaded
        ? (state.scores.has(String(id)) ? displayScore(state.scores.get(String(id))) : '—')
        : (cached.score || scoreFromAllRatings(id) || '—'),
      image: cached.image || clean(entry.fallbackImage || entry.image), fallback: cached.fallback || clean(entry.fallbackImage)
    };
  }

  function makeCard(type, id, index, editable) {
    const meta = metaFor(type, id);
    const card = document.createElement('div');
    card.className = `oc-profile-item${editable ? ' manual oc-top100-editor-card' : ' oc-top100-editor-view-card'}`;
    card.dataset.top100Id = String(id);
    const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
    const rank = editable
      ? `<button type="button" class="oc-rank-jump-btn" data-top100-action="set-rank" data-type="${type}" data-id="${esc(id)}" title="Изменить место">${index + 1}</button>`
      : `<div class="oc-profile-rank ${rankClass}">${index + 1}</div>`;
    const image = meta.image
      ? `<span class="oc-image-link"><div class="oc-profile-thumb"><img class="oc-track-image" src="${esc(meta.image)}" data-fallback="${esc(meta.fallback)}" alt="" loading="lazy" decoding="async"></div></span>`
      : `<span class="oc-image-link"><div class="oc-profile-thumb">${type}</div></span>`;
    const controls = editable
      ? `<div class="oc-move-btns"><button type="button" class="oc-move-btn" data-top100-action="up" data-type="${type}" data-id="${esc(id)}" ${index === 0 ? 'disabled' : ''}>▲</button><button type="button" class="oc-move-btn" data-top100-action="down" data-type="${type}" data-id="${esc(id)}">▼</button></div><div class="oc-manual-row-actions"><button type="button" class="oc-ar-top-btn" data-top100-action="remove" data-type="${type}" data-id="${esc(id)}">Удалить из топа</button></div><button type="button" class="oc-top100-drag-handle" data-type="${type}" data-id="${esc(id)}" aria-label="Перетащить">⋮⋮</button>`
      : '';
    card.innerHTML = `${rank}${image}<div><div class="oc-profile-name"><span>${esc(meta.title)}</span></div>${meta.meta ? `<div class="oc-profile-meta">${esc(meta.meta)}</div>` : ''}</div><div class="oc-profile-score">${esc(meta.score)}</div>${controls}`;
    return card;
  }

  function renderType(type) {
    const container = containerFor(type);
    if (!container || !state.loaded) return;
    const order = state.editing ? state.draft[type] : state.baseline[type];
    const visible = order;
    const fragment = document.createDocumentFragment();
    visible.forEach((id, index) => fragment.append(makeCard(type, id, index, state.editing)));
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'oc-empty';
      empty.textContent = 'Топ пока пуст.';
      fragment.append(empty);
    }
    container.replaceChildren(fragment);
  }

  function renderAll() {
    if (!state.loaded || !isTopView()) return;
    state.applying = true;
    try { captureMetaFromDom(); renderType('OP'); renderType('ED'); updateToolbar(); }
    finally { requestAnimationFrame(() => { state.applying = false; }); }
  }

  function scheduleRender() {
    clearTimeout(state.rerenderTimer);
    state.rerenderTimer = setTimeout(() => { if (!state.applying && !state.drag) renderAll(); }, 0);
  }

  function pushUndo() {
    state.undo.push(cloneOrder(state.draft));
    if (state.undo.length > 40) state.undo.shift();
    state.redo = [];
  }

  function setDraft(next, record = true) {
    if (record) pushUndo();
    state.draft = cloneOrder(next);
    persistDraft(); renderAll();
  }

  function place(type, id, target) {
    const next = cloneOrder(state.draft);
    const order = next[type].filter(value => value !== String(id));
    const index = Math.max(0, Math.min(order.length, Math.round(Number(target) || 1) - 1));
    order.splice(index, 0, String(id));
    next[type] = uniqueIds(order);
    setDraft(next);
  }

  function move(type, id, offset) {
    const next = cloneOrder(state.draft), order = next[type].slice();
    const from = order.indexOf(String(id)), to = from + offset;
    if (from < 0 || to < 0 || to >= order.length) return;
    const [item] = order.splice(from, 1); order.splice(to, 0, item); next[type] = order; setDraft(next);
  }

  function remove(type, id) {
    const next = cloneOrder(state.draft); next[type] = next[type].filter(value => value !== String(id)); setDraft(next);
  }

  function undo() {
    if (!state.editing || !state.undo.length) return;
    state.redo.push(cloneOrder(state.draft)); state.draft = state.undo.pop(); persistDraft(); renderAll();
  }
  function redo() {
    if (!state.editing || !state.redo.length) return;
    state.undo.push(cloneOrder(state.draft)); state.draft = state.redo.pop(); persistDraft(); renderAll();
  }
  function resetDraft() {
    if (!state.editing || !dirty() || !window.confirm('Отменить все несохранённые изменения?')) return;
    state.undo.push(cloneOrder(state.draft)); state.redo = []; state.draft = cloneOrder(state.baseline); clearLocalDraft(); renderAll();
  }

  async function loadSaved(user, force = false) {
    const key = normalize(user);
    if (!key || state.loading || (!force && state.loaded && state.key === key)) return;
    state.loading = true;
    try {
      await loadCatalog(); captureMetaFromDom();
      const tools = await firebaseTools();
      const [snap] = await Promise.all([
        tools.getDoc(tools.doc(tools.db, 'manualRanks', key)),
        loadUserScores(user, tools)
      ]);
      const row = snap.exists() ? snap.data() || {} : {};
      const saved = isVisibleManualTop(row)
        ? { OP: uniqueIds(row.OP || row.manualOP), ED: uniqueIds(row.ED || row.manualED) }
        : { OP: [], ED: [] };
      state.user = user; state.key = key; state.baseline = cloneOrder(saved);
      const local = isOwnProfile() ? readLocalDraft(key) : null;
      state.draft = local || cloneOrder(saved); state.undo = []; state.redo = []; state.loaded = true;
      state.editing = isEditing() && isOwnProfile(); renderAll();
      if (local && dirty() && state.editing) toast('Несохранённый черновик топа восстановлен.', 'success');
    } catch (error) {
      console.error('Top-100 editor load failed', error); toast('Не удалось загрузить сохранённый топ-100.', 'error');
    } finally { state.loading = false; }
  }

  async function saveCurrent(button) {
    if (state.saving || !state.loaded || !isOwnProfile()) return;
    state.saving = true;
    const oldText = button?.textContent || 'Сохранить топ-100';
    if (button) { button.disabled = true; button.textContent = 'Сохраняю…'; }
    try {
      const db = window.OPED_DB;
      if (!db?.saveManualRanks) throw new Error('Firebase ещё не готов.');
      const payload = cloneOrder(state.draft);
      const tools = await firebaseTools();
      const manualRef = tools.doc(tools.db, 'manualRanks', state.key);
      const previousSnap = await tools.getDoc(manualRef);
      const previousRow = previousSnap.exists() ? previousSnap.data() || {} : {};
      const previousOrder = { OP: uniqueIds(previousRow.OP || previousRow.manualOP), ED: uniqueIds(previousRow.ED || previousRow.manualED) };
      const previousTime = previousRow.updatedAt?.toMillis?.() || Date.now();
      const hasPreviousOrder = previousOrder.OP.length || previousOrder.ED.length;
      const history = dedupeHistory([
        ...(hasPreviousOrder && fingerprint(previousOrder) !== fingerprint(payload) ? [historyEntry(previousOrder, previousTime)] : []),
        ...(Array.isArray(previousRow.history) ? previousRow.history : [])
      ]);
      await db.saveManualRanks(state.user, payload);
      await tools.setDoc(manualRef, { history }, { merge: true });
      const snap = await tools.getDoc(manualRef);
      const row = snap.exists() ? snap.data() || {} : {};
      const verified = { OP: uniqueIds(row.OP || row.manualOP), ED: uniqueIds(row.ED || row.manualED) };
      if (fingerprint(verified) !== fingerprint(payload)) throw new Error('Firebase сохранил другой порядок.');
      state.baseline = cloneOrder(verified); state.draft = cloneOrder(verified); state.undo = []; state.redo = []; clearLocalDraft(); renderAll();
      document.dispatchEvent(new CustomEvent('oc:top100-saved', { detail: { user: state.user, OP: verified.OP.slice(), ED: verified.ED.slice(), editorV2: true } }));
      toast('Топ-100 сохранён и сразу применён ✓', 'success');
    } catch (error) {
      console.error('Top-100 editor save failed', error); toast(error?.message || 'Не удалось сохранить топ-100.', 'error');
    } finally {
      state.saving = false;
      if (button) { button.disabled = false; button.textContent = oldText; }
      updateToolbar();
    }
  }

  function ensureToolbar() {
    if (document.querySelector('.oc-top100-toolbar')) return;
    const columns = document.querySelector('#oc-profile-panel .oc-profile-columns');
    if (!columns) return;
    const toolbar = document.createElement('div'); toolbar.className = 'oc-top100-toolbar';
    toolbar.innerHTML = `<div class="oc-top100-toolbar-type"></div><div class="oc-top100-search-wrap"><input id="oc-top100-search" type="search" placeholder="Найти в топе…" autocomplete="off"><div id="oc-top100-search-results" class="oc-top100-search-results" hidden></div></div><div class="oc-top100-jump"><input id="oc-top100-jump" type="number" min="1" max="100" placeholder="№"><button type="button" data-top100-jump>Перейти</button></div><div class="oc-top100-history-actions"><button type="button" data-top100-undo title="Отменить">↶</button><button type="button" data-top100-redo title="Вернуть">↷</button><button type="button" data-top100-reset>Сбросить</button></div><span class="oc-top100-dirty" data-top100-dirty>Сохранено</span><div class="oc-top100-extra"><button type="button" data-top100-history>История</button><button type="button" data-top100-compare>Сравнить</button></div><div class="oc-top100-toolbar-save"></div>`;
    columns.before(toolbar);
    const switcher = document.querySelector('.oc-profile-top-type-switch'); if (switcher) toolbar.querySelector('.oc-top100-toolbar-type').append(switcher);
    const edit = editButton(), save = saveButton();
    if (edit) toolbar.querySelector('.oc-top100-toolbar-save').append(edit);
    if (save) toolbar.querySelector('.oc-top100-toolbar-save').append(save);
    toolbar.querySelector('[data-top100-undo]').addEventListener('click', undo);
    toolbar.querySelector('[data-top100-redo]').addEventListener('click', redo);
    toolbar.querySelector('[data-top100-reset]').addEventListener('click', resetDraft);
    toolbar.querySelector('[data-top100-history]').addEventListener('click', () => void openHistory());
    toolbar.querySelector('[data-top100-compare]').addEventListener('click', () => void openCompare());
    toolbar.querySelector('[data-top100-jump]').addEventListener('click', () => jumpTo(toolbar.querySelector('#oc-top100-jump').value));
    toolbar.querySelector('#oc-top100-jump').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); jumpTo(event.target.value); } });
    toolbar.querySelector('#oc-top100-search').addEventListener('input', renderSearch);
    toolbar.querySelector('#oc-top100-search-results').addEventListener('click', event => {
      const button = event.target.closest('[data-top100-search-place]'); if (!button) return;
      jumpTo(button.dataset.top100SearchPlace); toolbar.querySelector('#oc-top100-search-results').hidden = true;
    });
  }

  function activeType() { return document.querySelector('.oc-profile-top-type-btn.active')?.dataset.type === 'ED' ? 'ED' : 'OP'; }
  function currentOrder(type = activeType()) { return state.editing ? state.draft[type] : state.baseline[type]; }

  function jumpTo(place) {
    const index = Math.max(1, Math.min(100, Math.round(Number(place) || 1))) - 1;
    const card = containerFor(activeType())?.querySelectorAll(':scope > .oc-profile-item')?.[index];
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' }); card?.classList.add('oc-top100-flash');
    setTimeout(() => card?.classList.remove('oc-top100-flash'), 1500);
  }

  function renderSearch() {
    const input = document.querySelector('#oc-top100-search'), results = document.querySelector('#oc-top100-search-results');
    if (!input || !results || !state.loaded) return;
    const q = clean(input.value).toLocaleLowerCase('ru');
    if (!q) { results.hidden = true; results.innerHTML = ''; return; }
    const type = activeType();
    const rows = currentOrder(type).map((id, index) => ({ place:index + 1, title:metaFor(type, id).title })).filter(row => row.title.toLocaleLowerCase('ru').includes(q)).slice(0, 8);
    results.innerHTML = rows.map(row => `<button type="button" data-top100-search-place="${row.place}"><strong>№${row.place}</strong><span>${esc(row.title)}</span></button>`).join('');
    results.hidden = !rows.length;
  }

  function updateToolbar() {
    ensureToolbar();
    const toolbar = document.querySelector('.oc-top100-toolbar'); if (!toolbar) return;
    state.editing = isEditing() && isOwnProfile();
    toolbar.classList.toggle('editing', state.editing); toolbar.classList.toggle('dirty', dirty());
    const marker = toolbar.querySelector('[data-top100-dirty]'); if (marker) marker.textContent = dirty() ? 'Черновик сохранён · не опубликовано' : 'Все изменения сохранены';
    const undoButton = toolbar.querySelector('[data-top100-undo]'), redoButton = toolbar.querySelector('[data-top100-redo]'), resetButton = toolbar.querySelector('[data-top100-reset]');
    if (undoButton) undoButton.disabled = !state.editing || !state.undo.length;
    if (redoButton) redoButton.disabled = !state.editing || !state.redo.length;
    if (resetButton) resetButton.disabled = !state.editing || !dirty();
    const save = saveButton(); if (save) { save.classList.toggle('active', state.editing && dirty()); save.disabled = !isOwnProfile() || state.saving; }
  }

  function handleEditState() {
    const now = isEditing() && isOwnProfile();
    if (now === state.editing && state.loaded) { renderAll(); return; }
    state.editing = now;
    if (now) {
      state.draft = readLocalDraft(state.key) || cloneOrder(state.baseline); state.undo = []; state.redo = []; renderAll();
    } else {
      state.draft = cloneOrder(state.baseline); state.undo = []; state.redo = []; clearLocalDraft(); renderAll();
    }
  }

  function modalRoot(kind) {
    document.querySelector('.oc-top100-modal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'oc-top100-modal';
    modal.dataset.kind = kind;
    modal.innerHTML = `<div class="oc-top100-dialog"><button type="button" class="oc-top100-modal-close" aria-label="Закрыть">×</button><div class="oc-top100-modal-body"></div></div>`;
    document.body.append(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.oc-top100-modal-close')) modal.remove();
    });
    return modal;
  }

  const rowUser = row => clean(row.nickname || row.displayName || row.name || row.id);
  const rowOrder = (row, type) => uniqueIds(row?.[type] || row?.[`manual${type}`]);

  async function loadManualRows() {
    const tools = await firebaseTools();
    const snap = await tools.getDocs(tools.collection(tools.db, 'manualRanks'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(isVisibleManualTop);
  }

  async function openHistory() {
    const modal = modalRoot('history'), body = modal.querySelector('.oc-top100-modal-body');
    body.innerHTML = '<h2>История топ-100</h2><p class="oc-top100-muted">Загружаю сохранённые версии…</p>';
    try {
      const tools = await firebaseTools();
      const snap = await tools.getDoc(tools.doc(tools.db, 'manualRanks', state.key));
      const row = snap.exists() ? snap.data() || {} : {};
      const history = isVisibleManualTop(row) && Array.isArray(row.history) ? row.history : [];
      body.innerHTML = `<div class="oc-top100-modal-head"><div><h2>История топ-100</h2><p>${esc(viewedUser())} · до ${MAX_HISTORY} предыдущих сохранений</p></div></div><div class="oc-top100-history-list">${history.length ? history.map((entry, index) => `<div class="oc-top100-history-row"><div><strong>${new Date(Number(entry.savedAtLocal) || Date.now()).toLocaleString('ru-RU')}</strong><span>OP: ${uniqueIds(entry.OP).length} · ED: ${uniqueIds(entry.ED).length}</span></div><button type="button" data-history-index="${index}" ${state.editing && isOwnProfile() ? '' : 'disabled'}>Восстановить</button></div>`).join('') : '<div class="oc-empty">Предыдущих версий пока нет. Они начнут сохраняться при следующем изменении топа.</div>'}</div>`;
      body.addEventListener('click', event => {
        const button = event.target.closest('[data-history-index]');
        if (!button || !state.editing || !isOwnProfile()) return;
        const entry = history[Number(button.dataset.historyIndex)];
        if (!entry || !window.confirm('Восстановить эту версию в черновик? Текущий сохранённый топ изменится только после нажатия «Сохранить».')) return;
        setDraft({ OP: uniqueIds(entry.OP), ED: uniqueIds(entry.ED) });
        modal.remove();
        toast('Версия восстановлена в черновик. Проверь её и нажми «Сохранить».', 'success');
      });
    } catch (error) {
      body.innerHTML = `<h2>История топ-100</h2><div class="oc-top100-error">${esc(error?.message || 'Не удалось загрузить историю.')}</div>`;
    }
  }

  async function openCompare() {
    const modal = modalRoot('compare'), body = modal.querySelector('.oc-top100-modal-body');
    body.innerHTML = '<h2>Сравнение топов</h2><p class="oc-top100-muted">Загружаю профили…</p>';
    try {
      const rows = await loadManualRows();
      const users = [...new Set(rows.map(rowUser).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' }));
      if (users.length < 2) throw new Error('Для сравнения нужно хотя бы два сохранённых топа.');
      const byUser = user => rows.find(row => normalize(row.nicknameKey || rowUser(row)) === normalize(user));
      const current = users.find(user => normalize(user) === normalize(viewedUser())) || users[0];
      const other = users.find(user => normalize(user) !== normalize(current)) || users[1];
      body.innerHTML = `<div class="oc-top100-modal-head"><div><h2>Сравнение топов</h2><p>Совпадения, расхождения по местам и уникальные позиции.</p></div></div><div class="oc-top100-compare-controls"><select id="oc-top100-compare-a">${users.map(user => `<option ${user === current ? 'selected' : ''}>${esc(user)}</option>`).join('')}</select><span>vs</span><select id="oc-top100-compare-b">${users.map(user => `<option ${user === other ? 'selected' : ''}>${esc(user)}</option>`).join('')}</select><select id="oc-top100-compare-type"><option value="OP">Опенинги</option><option value="ED">Эндинги</option></select></div><div id="oc-top100-compare-result"></div>`;
      const render = () => {
        const a = body.querySelector('#oc-top100-compare-a').value, b = body.querySelector('#oc-top100-compare-b').value;
        const type = body.querySelector('#oc-top100-compare-type').value === 'ED' ? 'ED' : 'OP';
        const orderFor = user => normalize(user) === normalize(viewedUser()) && state.editing ? state.draft[type] : rowOrder(byUser(user), type);
        const ao = orderFor(a), bo = orderFor(b);
        const posA = new Map(ao.map((id, index) => [String(id), index + 1])), posB = new Map(bo.map((id, index) => [String(id), index + 1]));
        const title = id => metaFor(type, id).title || id;
        const common = ao.filter(id => posB.has(String(id))).map(id => ({ id:String(id), a:posA.get(String(id)), b:posB.get(String(id)) }));
        const overlap = Math.round(common.length / Math.max(1, ao.length, bo.length) * 100);
        const gaps = common.map(row => ({ ...row, gap:Math.abs(row.a - row.b) })).sort((a, b) => b.gap - a.gap).slice(0, 20);
        const onlyA = ao.filter(id => !posB.has(String(id))), onlyB = bo.filter(id => !posA.has(String(id)));
        body.querySelector('#oc-top100-compare-result').innerHTML = `<div class="oc-top100-compare-summary"><div><strong>${overlap}%</strong><span>совпадение</span></div><div><strong>${common.length}</strong><span>общих</span></div><div><strong>${onlyA.length}</strong><span>только у ${esc(a)}</span></div><div><strong>${onlyB.length}</strong><span>только у ${esc(b)}</span></div></div><h3>Самые большие расхождения</h3><div class="oc-top100-compare-table">${gaps.length ? gaps.map(row => `<div><span>${esc(title(row.id))}</span><b>№${row.a} → №${row.b}</b><em>Δ ${row.gap}</em></div>`).join('') : '<div class="oc-empty">Общих треков нет.</div>'}</div><div class="oc-top100-compare-unique"><section><h3>Только у ${esc(a)}</h3>${onlyA.slice(0, 20).map(id => `<p>№${posA.get(String(id))} · ${esc(title(id))}</p>`).join('') || '<p>—</p>'}</section><section><h3>Только у ${esc(b)}</h3>${onlyB.slice(0, 20).map(id => `<p>№${posB.get(String(id))} · ${esc(title(id))}</p>`).join('') || '<p>—</p>'}</section></div>`;
      };
      body.querySelectorAll('#oc-top100-compare-a,#oc-top100-compare-b,#oc-top100-compare-type').forEach(input => input.addEventListener('change', render));
      render();
    } catch (error) {
      body.innerHTML = `<h2>Сравнение топов</h2><div class="oc-top100-error">${esc(error?.message || 'Не удалось сравнить топы.')}</div>`;
    }
  }

  function closeInsertPanel(panel) { panel?.closest('.oc-manual-insert-zone')?.classList.remove('active'); panel?.remove(); }

  document.addEventListener('oc:top100-place', event => {
    if (!state.editing || !isOwnProfile()) return;
    const detail = event.detail || {}, type = detail.type === 'ED' ? 'ED' : 'OP', id = clean(detail.id);
    const target = Math.max(1, Math.min(100, Math.round(Number(detail.place) || 1)));
    if (!id) return;
    const row = detail.row || {};
    state.meta.set(`${type}:${id}`, {
      title: clean(row.title || id),
      meta: clean([row.year, row.season].filter(Boolean).join(' · ')),
      score: clean(row.score),
      image: clean(row.fallbackImage || row.image),
      fallback: clean(row.fallbackImage)
    });
    place(type, id, target);
  });

  document.addEventListener('click', event => {
    const save = event.target.closest?.('#oc-manual-save-btn');
    if (save && isTopView() && isOwnProfile()) {
      event.preventDefault(); event.stopImmediatePropagation(); void saveCurrent(save); return;
    }
    const edit = event.target.closest?.('#oc-manual-edit-btn');
    if (edit && isTopView() && isOwnProfile()) {
      if (isEditing() && dirty() && !window.confirm('Есть несохранённые изменения. Завершить редактирование и отменить их?')) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      setTimeout(handleEditState, 0); return;
    }
    if (!state.editing || !isOwnProfile()) return;

    const confirm = event.target.closest?.('.oc-manual-insert-confirm');
    if (confirm) {
      const panel = confirm.closest('.oc-manual-insert-panel'), zone = panel?.closest('.oc-manual-insert-zone'), selected = panel?.querySelector('.oc-manual-insert-result.selected');
      const id = clean(selected?.dataset.id), type = zone?.dataset.type === 'ED' ? 'ED' : 'OP';
      const target = Math.max(1, Math.min(100, Math.round(Number(zone?.dataset.targetPlace) || 1)));
      if (!id) return;
      event.preventDefault(); event.stopImmediatePropagation(); captureInsertMeta(panel, type, id); place(type, id, target); closeInsertPanel(panel);
      toast(`${metaFor(type, id).title}: теперь ${target}-е место.`, 'success'); return;
    }

    const action = event.target.closest?.('[data-top100-action]');
    if (action) {
      event.preventDefault(); event.stopImmediatePropagation();
      const type = action.dataset.type === 'ED' ? 'ED' : 'OP', id = clean(action.dataset.id);
      if (action.dataset.top100Action === 'up') move(type, id, -1);
      else if (action.dataset.top100Action === 'down') move(type, id, 1);
      else if (action.dataset.top100Action === 'remove') { if (window.confirm('Убрать из топ-100? Оценка останется.')) remove(type, id); }
      else if (action.dataset.top100Action === 'set-rank') {
        const current = state.draft[type].indexOf(id) + 1;
        const raw = window.prompt(`Введите место от 1 до ${Math.max(1, state.draft[type].length)}.`, String(current || 1)); if (raw !== null) place(type, id, raw);
      }
      return;
    }

    const legacy = event.target.closest?.('[data-action="all-to-top100"], [data-action="all-set-rank"]');
    if (legacy) {
      const id = clean(legacy.dataset.id), type = legacy.dataset.type === 'ED' ? 'ED' : 'OP'; if (!id) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (legacy.dataset.action === 'all-to-top100') place(type, id, Math.min(100, state.draft[type].length + 1));
      else {
        const current = state.draft[type].indexOf(id) + 1;
        const raw = window.prompt(`Введите место от 1 до ${Math.min(100, state.draft[type].length + (current ? 0 : 1))}.`, String(current || Math.min(100, state.draft[type].length + 1))); if (raw !== null) place(type, id, raw);
      }
    }
  }, true);

  document.addEventListener('pointerdown', event => {
    const handle = event.target.closest?.('.oc-top100-drag-handle');
    if (!handle || !state.editing || !isTopView()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const card = handle.closest('.oc-profile-item.manual'), container = card?.parentElement; if (!card || !container) return;
    event.preventDefault(); state.drag = { pointerId:event.pointerId, handle, card, container, moved:false };
    try { handle.setPointerCapture(event.pointerId); } catch (_) {}
    card.classList.add('oc-top100-card-dragging'); handle.classList.add('active'); document.documentElement.classList.add('oc-top100-drag-active');
  }, true);

  document.addEventListener('pointermove', event => {
    const drag = state.drag; if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.oc-profile-item.manual');
    if (!target || target === drag.card || target.parentElement !== drag.container) return;
    const rect = target.getBoundingClientRect(), before = event.clientY < rect.top + rect.height / 2;
    drag.container.insertBefore(drag.card, before ? target : target.nextElementSibling); drag.moved = true;
  }, { capture:true, passive:false });

  function finishDrag(event) {
    const drag = state.drag; if (!drag || (event && drag.pointerId !== event.pointerId)) return;
    try { drag.handle.releasePointerCapture(drag.pointerId); } catch (_) {}
    if (drag.moved) {
      const type = drag.container.id === 'oc-profile-ed' ? 'ED' : 'OP';
      const ids = [...drag.container.querySelectorAll(':scope > .oc-profile-item.manual')].map(card => clean(card.dataset.top100Id)).filter(Boolean);
      const next = cloneOrder(state.draft); next[type] = ids; setDraft(next);
    }
    drag.card.classList.remove('oc-top100-card-dragging'); drag.handle.classList.remove('active'); document.documentElement.classList.remove('oc-top100-drag-active'); state.drag = null;
  }

  document.addEventListener('pointerup', finishDrag, true);
  document.addEventListener('pointercancel', finishDrag, true);
  document.addEventListener('keydown', event => {
    if (!state.editing || !isTopView() || /input|textarea|select/i.test(event.target?.tagName || '')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
  });

  function monitorDom() {
    ['OP', 'ED'].forEach(type => {
      const container = containerFor(type); if (!container) return;
      new MutationObserver(records => {
        if (state.applying || state.drag || !state.loaded || !isTopView()) return;
        const editorPanelOnly = records.every(record =>
          record.target?.closest?.('.oc-top100-inline-search-panel') ||
          [...record.addedNodes, ...record.removedNodes].every(node => node.nodeType !== 1 || node.matches?.('.oc-top100-inline-search-panel'))
        );
        if (!editorPanelOnly) scheduleRender();
      }).observe(container, { childList:true, subtree:true });
    });
    const edit = editButton(); if (edit) new MutationObserver(() => setTimeout(handleEditState, 0)).observe(edit, { attributes:true, attributeFilter:['class'] });
    const panel = profilePanel();
    if (panel) new MutationObserver(() => { if (isTopView()) void loadSaved(viewedUser(), state.key !== normalize(viewedUser())); }).observe(panel, { attributes:true, attributeFilter:['data-profile-view','class'] });
    document.querySelector('#oc-profile-user')?.addEventListener('change', () => {
      state.loaded = false; state.expanded = { OP:false, ED:false }; setTimeout(() => void loadSaved(viewedUser(), true), 0);
    });
  }

  async function init() {
    ensureToolbar(); monitorDom(); if (isTopView()) await loadSaved(viewedUser(), true); document.documentElement.classList.remove('oc-top100-loading');
  }

  window.addEventListener('oped-db-ready', () => { if (isTopView()) void loadSaved(viewedUser(), !state.loaded); });
  window.addEventListener('oped-account-restored', () => { if (isTopView()) void loadSaved(viewedUser(), true); });
  window.addEventListener('oped:app-data-updated', event => {
    const reason = clean(event.detail?.reason);
    if (!isTopView() || (state.editing && dirty())) return;
    if (reason === 'manual-ranks-saved' || reason === 'top100-candidates-added' || reason === 'top100-pins-saved') {
      void loadSaved(viewedUser(), true);
    }
  });
  window.addEventListener('beforeunload', event => { if (!dirty()) return; event.preventDefault(); event.returnValue = ''; });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void init(), { once:true });
  else void init();
})();
