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
    catalog: new Map(), meta: new Map(), scores: new Map(), scoresLoaded: false, rerenderTimer: 0, drag: null,
    candidateQuery: '', candidateFilter: 'available', candidateLimit: 40, selected: null, candidateRequest: 0,
    candidateLoadedKey: '', candidateLoading: false, candidateError: '', searchTimer: 0, catalogSearch: null, suppressClickUntil: 0
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

  function mergeLiveCatalog(rows = window.OC_APP_BRIDGE?.snapshot?.()?.entries) {
    if (!Array.isArray(rows)) return;
    rows.forEach(row => {
      if (row?.id !== undefined && row?.id !== null) state.catalog.set(String(row.id), row);
    });
  }

  async function loadCatalog(ids = []) {
    mergeLiveCatalog();
    const missing = ids.filter(id => !state.catalog.has(String(id)));
    if (!missing.length) return;
    const rows = await window.OC_CATALOG_CACHE.byIds(missing);
    mergeLiveCatalog(rows);
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
    const score = value === null || value === undefined || value === '' ? NaN : Number(value);
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
    card.dataset.type = type;
    if (editable) { card.tabIndex = 0; card.classList.toggle('oc-workspace-selected', state.selected?.id === String(id) && state.selected?.type === type); }
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
    const play = `<button type="button" class="oc-top100-play" data-top100-video="${esc(id)}" aria-label="Смотреть ${esc(meta.title)}">▶ Смотреть</button>`;
    card.innerHTML = `${rank}${image}<div><div class="oc-profile-name"><span>${esc(meta.title)}</span> ${play}</div>${meta.meta ? `<div class="oc-profile-meta">${esc(meta.meta)}</div>` : ''}</div><div class="oc-profile-score">${esc(meta.score)}</div>${controls}`;
    return card;
  }

  function renderType(type) {
    const container = containerFor(type);
    if (!container || !state.loaded) return;
    const order = state.editing ? state.draft[type] : state.baseline[type];
    const visible = order;
    const fragment = document.createDocumentFragment();
    visible.forEach((id, index) => {
      if (state.editing) fragment.append(makeDropGap(type, index));
      fragment.append(makeCard(type, id, index, state.editing));
    });
    if (state.editing) fragment.append(makeDropGap(type, visible.length));
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
    try { captureMetaFromDom();
      const scroll = ['OP', 'ED'].map(type => containerFor(type)?.scrollTop || 0);
      renderType('OP'); renderType('ED'); updateToolbar(); syncWorkspace();
      ['OP', 'ED'].forEach((type, index) => { if (containerFor(type)) containerFor(type).scrollTop = scroll[index]; });
    }
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

  async function clearTop(button) {
    if (!state.loaded || !state.editing || !isOwnProfile() || state.saving) return;
    const type = activeType();
    if (!window.confirm(`Обнулить весь топ ${type}? Порядок и закрепления будут удалены сразу. Пометки кандидатов и оценки сохранятся; другой топ останется на месте.`)) return;
    const previous = cloneOrder(state.draft);
    const next = cloneOrder(previous); next[type] = [];
    setDraft(next); state.selected = null;
    const saved = await saveCurrent(button, { clearType: type });
    if (!saved) { state.draft = previous; persistDraft(); renderAll(); }
    else { state.candidateQuery = ''; state.candidateFilter = 'available'; void refreshCandidates(); }
  }

  async function loadSaved(user, force = false) {
    const key = normalize(user);
    if (!key || state.loading || (!force && state.loaded && state.key === key)) return;
    state.loading = true;
    try {
      captureMetaFromDom();
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
      await loadCatalog([...state.baseline.OP, ...state.baseline.ED, ...state.draft.OP, ...state.draft.ED]);
      state.editing = isEditing() && isOwnProfile(); renderAll();
      if (local && dirty() && state.editing) toast('Несохранённый черновик топа восстановлен.', 'success');
    } catch (error) {
      console.error('Top-100 editor load failed', error); toast('Не удалось загрузить сохранённый топ-100.', 'error');
    } finally { state.loading = false; }
  }

  async function saveCurrent(button, options = {}) {
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
      if (options.clearType) {
        payload.manualCreated = Boolean(payload.OP.length || payload.ED.length);
        payload[`pins${options.clearType}`] = [];
        for (const type of ['OP', 'ED']) {
          if (Array.isArray(previousRow[`candidates${type}`])) payload[`candidates${type}`] = previousRow[`candidates${type}`].slice();
        }
      }
      await db.saveManualRanks(state.user, payload);
      await tools.setDoc(manualRef, { history }, { merge: true });
      const snap = await tools.getDoc(manualRef);
      const row = snap.exists() ? snap.data() || {} : {};
      const verified = { OP: uniqueIds(row.OP || row.manualOP), ED: uniqueIds(row.ED || row.manualED) };
      if (fingerprint(verified) !== fingerprint(payload)) throw new Error('Firebase сохранил другой порядок.');
      state.baseline = cloneOrder(verified); state.draft = cloneOrder(verified); state.undo = []; state.redo = []; clearLocalDraft(); renderAll();
      document.dispatchEvent(new CustomEvent('oc:top100-saved', { detail: { user: state.user, OP: verified.OP.slice(), ED: verified.ED.slice(), editorV2: true } }));
      toast(options.clearType ? 'Топ обнулён. Помеченные кандидаты остались в корзинах.' : 'Топ-100 сохранён и сразу применён ✓', 'success');
      return true;
    } catch (error) {
      console.error('Top-100 editor save failed', error); toast(error?.message || 'Не удалось сохранить топ-100.', 'error');
      return false;
    } finally {
      state.saving = false;
      if (button) { button.disabled = false; button.textContent = oldText; }
      updateToolbar();
    }
  }

  function makeDropGap(type, index) {
    const gap = document.createElement('button');
    gap.type = 'button'; gap.className = 'oc-workspace-drop-gap'; gap.dataset.workspaceGap = String(index); gap.dataset.type = type;
    gap.setAttribute('aria-label', `Вставить песню перед местом ${index + 1}`);
    gap.textContent = 'Вставить сюда'; return gap;
  }

  function insertDraftGap(type, id, gap) {
    if (!state.editing || !isOwnProfile() || !['OP','ED'].includes(type)) return;
    const entry = state.catalog.get(String(id));
    if (entry && entry.type !== type) return;
    const order = state.draft[type];
    const from = order.indexOf(String(id));
    if (from < 0 && order.length >= 100) { toast('В топе уже 100 песен. Удали одну, чтобы добавить новую.', 'error'); return; }
    const cleanGap = Math.max(0, Math.min(order.length, Math.round(Number(gap) || 0)));
    const target = cleanGap - (from >= 0 && from < cleanGap ? 1 : 0);
    if (from === target) return;
    place(type, id, target + 1);
  }

  function ensureWorkspace() {
    let workspace = document.querySelector('.oc-top100-workspace');
    if (workspace) {
      const duel = profilePanel()?.querySelector('#oc-profile-top-duel');
      if (duel && workspace.contains(duel)) workspace.before(duel);
      return workspace;
    }
    const columns = profilePanel()?.querySelector('.oc-profile-columns');
    if (!columns) return null;
    workspace = document.createElement('div'); workspace.className = 'oc-top100-workspace';
    const panel = document.createElement('aside'); panel.className = 'oc-workspace-candidates';
    panel.innerHTML = `<header><div><h2>Кандидаты</h2><p>Перетаскивай песни на нужное место</p></div><span data-workspace-count></span></header><input class="oc-workspace-search" type="search" placeholder="Песня, аниме, исполнитель…" aria-label="Поиск кандидатов" autocomplete="off"><div class="oc-workspace-candidate-list"></div><footer>Нажатие — выбрать · двойное — добавить в конец.<br>На телефоне перетаскивай за ⋮⋮ или выбери песню и нажми место вставки.</footer>`;
    columns.before(workspace); workspace.append(panel, columns);
    panel.querySelector('.oc-workspace-search').addEventListener('input', event => {
      state.candidateQuery = event.target.value; state.candidateLimit = 40;
      state.candidateRequest += 1; clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => void refreshCandidates(), 250);
    });
    panel.addEventListener('click', event => {
      const filter = event.target.closest('[data-workspace-filter]');
      if (filter) { state.candidateFilter = filter.dataset.workspaceFilter; state.candidateLimit = 40; void refreshCandidates(); return; }
      const more = event.target.closest('[data-workspace-more]');
      if (more) { state.candidateLimit += 40; renderCandidates(); return; }
      const retry = event.target.closest('[data-workspace-retry]');
      if (retry) { state.candidateLoadedKey = ''; void refreshCandidates(); return; }
      const card = event.target.closest('[data-workspace-candidate]');
      if (!card || !state.editing) return;
      selectWorkspaceSong(activeType(), card.dataset.workspaceCandidate);
      if (event.target.closest('[data-workspace-add]')) insertDraftGap(activeType(), card.dataset.workspaceCandidate, state.draft[activeType()].length);
    });
    panel.addEventListener('dblclick', event => {
      const card = event.target.closest('[data-workspace-candidate]');
      if (card && !event.target.closest('button')) insertDraftGap(activeType(), card.dataset.workspaceCandidate, state.draft[activeType()].length);
    });
    return workspace;
  }

  function selectWorkspaceSong(type, id) {
    state.selected = { type, id:String(id) };
    document.querySelectorAll('[data-workspace-candidate],.oc-top100-editor-card').forEach(card => {
      const selected = clean(card.dataset.workspaceCandidate || card.dataset.top100Id) === String(id) && (card.dataset.type || activeType()) === type;
      card.classList.toggle('oc-workspace-selected', selected);
      if (card.hasAttribute('data-workspace-candidate')) card.setAttribute('aria-pressed', String(selected));
    });
  }

  function candidateTerms(entry) {
    return [entry.title, entry.anime, ...(entry.alternativeTitles || []), ...(entry.performers || [])].join(' ').toLocaleLowerCase('ru').replace(/ё/g,'е');
  }

  function candidateRows(type) {
    const prioritized = new Set((window.OC_APP_BRIDGE?.top100Meta?.(type)?.candidates || []).map(String));
    const added = new Set(state.draft[type]);
    const q = clean(state.candidateQuery).toLocaleLowerCase('ru').replace(/ё/g,'е');
    return [...state.catalog.values()].filter(entry => entry.type === type && !added.has(String(entry.id)))
      .filter(entry => prioritized.has(String(entry.id)))
      .filter(entry => !q || candidateTerms(entry).includes(q))
      .sort((a,b) => Number(prioritized.has(String(b.id))) - Number(prioritized.has(String(a.id))) || (state.scores.get(String(b.id)) ?? -1) - (state.scores.get(String(a.id)) ?? -1) || clean(a.title).localeCompare(clean(b.title),'ru',{numeric:true}));
  }

  function renderCandidates() {
    const panel = document.querySelector('.oc-workspace-candidates'); if (!panel) return;
    const list = panel.querySelector('.oc-workspace-candidate-list'), scroll = list.scrollTop;
    panel.querySelectorAll('[data-workspace-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.workspaceFilter === state.candidateFilter)));
    const type = activeType(), rows = candidateRows(type);
    panel.querySelector('[data-workspace-count]').textContent = `${rows.length} доступно`;
    if (state.candidateLoading) { list.innerHTML = '<div class="oc-empty">Загружаю кандидатов…</div>'; return; }
    if (state.candidateError) { list.innerHTML = '<div class="oc-empty">Не удалось загрузить кандидатов.<br><button type="button" data-workspace-retry>Повторить</button></div>'; return; }
    list.innerHTML = rows.slice(0,state.candidateLimit).map(entry => {
      const id = String(entry.id), meta = metaFor(type,id), selected = state.selected?.type === type && state.selected?.id === id;
      return `<article class="oc-workspace-candidate${selected?' oc-workspace-selected':''}" data-workspace-candidate="${esc(id)}" data-type="${type}" role="button" tabindex="0" aria-pressed="${selected}">${meta.image?`<img src="${esc(meta.image)}" alt="" loading="lazy" decoding="async">`:`<span class="oc-workspace-noimage">${type}</span>`}<div><strong>${esc(meta.title)}</strong><small>${esc([entry.anime,meta.meta,...(entry.performers || [])].filter(Boolean).join(' · '))}</small><span>${esc(meta.score)} ✦</span><button type="button" class="oc-top100-play" data-top100-video="${esc(id)}" aria-label="Смотреть ${esc(meta.title)}">▶</button></div><button type="button" data-workspace-add aria-label="Добавить ${esc(meta.title)}">+</button><button type="button" class="oc-top100-drag-handle" aria-label="Перетащить ${esc(meta.title)}">⋮⋮</button></article>`;
    }).join('') || `<div class="oc-empty">${clean(state.candidateQuery) ? 'Среди кандидатов ничего не найдено.' : 'Доступных кандидатов пока нет. Пометь песни кандидатами в их карточках.'}</div>`;
    if (rows.length > state.candidateLimit) list.insertAdjacentHTML('beforeend','<button type="button" data-workspace-more>Показать ещё 40</button>');
    list.scrollTop = scroll;
  }

  async function refreshCandidates() {
    if (!state.editing || !isOwnProfile()) return;
    const request = ++state.candidateRequest, key = state.key, type = activeType();
    state.candidateLoading = true; state.candidateError = ''; renderCandidates();
    try {
      mergeLiveCatalog();
      const ids = window.OC_APP_BRIDGE?.top100Meta?.(type)?.candidates || [];
      await loadCatalog(ids);
      if (request !== state.candidateRequest || key !== state.key || !state.editing) return;
      state.candidateLoadedKey = `${key}|${type}`;
    } catch(error) {
      if (request !== state.candidateRequest || key !== state.key) return;
      state.candidateError = error?.message || 'Ошибка загрузки';
    } finally {
      if (request === state.candidateRequest && key === state.key) { state.candidateLoading = false; renderCandidates(); }
    }
  }

  function syncWorkspace() {
    const workspace = ensureWorkspace(); if (!workspace) return;
    const enabled = state.editing && state.loaded && isOwnProfile() && isTopView();
    workspace.classList.toggle('editing', enabled);
    profilePanel()?.classList.toggle('oc-top100-workspace-editing', enabled);
    if (!enabled) { state.candidateRequest += 1; state.candidateLoading = false; return; }
    renderCandidates();
    if (state.candidateLoadedKey !== `${state.key}|${activeType()}` && !state.candidateLoading && !state.candidateError) void refreshCandidates();
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('.oc-profile-top-type-btn')) { state.selected = null; state.candidateLimit = 40; setTimeout(() => syncWorkspace(),0); return; }
    if (!state.editing || !isOwnProfile()) return;
    const gap = event.target.closest?.('[data-workspace-gap]');
    if (gap) {
      event.preventDefault();
      if (state.selected?.type === gap.dataset.type) insertDraftGap(gap.dataset.type,state.selected.id,Number(gap.dataset.workspaceGap));
      else toast('Сначала выбери песню слева или в топе.');
      return;
    }
    const card = event.target.closest?.('.oc-top100-editor-card');
    if (card && !event.target.closest('button')) selectWorkspaceSong(card.dataset.type,card.dataset.top100Id);
  });
  document.addEventListener('keydown', event => {
    const card = event.target.closest?.('[data-workspace-candidate],.oc-top100-editor-card');
    if (state.editing && card && event.target === card && ['Enter',' '].includes(event.key)) { event.preventDefault(); selectWorkspaceSong(card.dataset.type,card.dataset.workspaceCandidate || card.dataset.top100Id); }
  });

  function ensureToolbar() {
    if (document.querySelector('.oc-top100-toolbar')) return;
    const columns = document.querySelector('#oc-profile-panel .oc-profile-columns');
    if (!columns) return;
    const toolbar = document.createElement('div'); toolbar.className = 'oc-top100-toolbar';
    toolbar.innerHTML = `<div class="oc-top100-toolbar-type"></div><div class="oc-top100-search-wrap"><input id="oc-top100-search" type="search" placeholder="Найти в топе…" autocomplete="off"><div id="oc-top100-search-results" class="oc-top100-search-results" hidden></div></div><div class="oc-top100-jump"><input id="oc-top100-jump" type="number" min="1" max="100" placeholder="№"><button type="button" data-top100-jump>Перейти</button></div><div class="oc-top100-history-actions"><button type="button" data-top100-undo title="Отменить">↶</button><button type="button" data-top100-redo title="Вернуть">↷</button><button type="button" data-top100-reset>Сбросить</button><button type="button" data-top100-clear>Обнулить</button></div><span class="oc-top100-dirty" data-top100-dirty>Сохранено</span><div class="oc-top100-extra"><button type="button" data-top100-history>История</button><button type="button" data-top100-compare>Сравнить</button></div><div class="oc-top100-toolbar-save"></div>`;
    columns.before(toolbar);
    const switcher = document.querySelector('.oc-profile-top-type-switch'); if (switcher) toolbar.querySelector('.oc-top100-toolbar-type').append(switcher);
    const edit = editButton(), save = saveButton();
    if (edit) toolbar.querySelector('.oc-top100-toolbar-save').append(edit);
    if (save) toolbar.querySelector('.oc-top100-toolbar-save').append(save);
    toolbar.querySelector('[data-top100-undo]').addEventListener('click', undo);
    toolbar.querySelector('[data-top100-redo]').addEventListener('click', redo);
    toolbar.querySelector('[data-top100-reset]').addEventListener('click', resetDraft);
    toolbar.querySelector('[data-top100-clear]').addEventListener('click', event => void clearTop(event.currentTarget));
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
    const clearButton = toolbar.querySelector('[data-top100-clear]');
    if (clearButton) clearButton.disabled = !state.editing || state.saving || !state.loaded;
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

  function safeExternalUrl(value) {
    try { const parsed = new URL(clean(value)); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : ''; } catch (_) { return ''; }
  }
    function getDirectVideoType(url) {
      const href = safeExternalUrl(url);
      if (!href) return '';
      try {
        const parsed = new URL(href);
        const text = `${parsed.pathname} ${parsed.search}`.toLowerCase();
        if (/\.webm(?:$|[?#&\s])/.test(text) || text.includes('.webm')) return 'video/webm';
        if (/\.mp4(?:$|[?#&\s])/.test(text) || text.includes('.mp4')) return 'video/mp4';
        if (/\.ogg(?:$|[?#&\s])/.test(text) || text.includes('.ogv')) return 'video/ogg';
      } catch (e) {}
      return '';
    }

    function getVkVideoEmbedUrl(parsed, autoplay = false) {
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      const domains = ['vk.com', 'vkvideo.ru', 'vk.ru'];
      if (!domains.some(domain => host === domain || host.endsWith(`.${domain}`))) return '';

      const buildEmbedUrl = (ownerId, videoId, hash = '', hd = '2') => {
        if (!/^-?\d+$/.test(ownerId) || !/^\d+$/.test(videoId)) return '';
        const embed = new URL('https://vk.com/video_ext.php');
        embed.searchParams.set('oid', ownerId);
        embed.searchParams.set('id', videoId);
        if (hash && /^[a-z0-9_-]{1,200}$/i.test(hash)) embed.searchParams.set('hash', hash);
        embed.searchParams.set('hd', /^\d+$/.test(hd) ? hd : '2');
        if (autoplay) embed.searchParams.set('autoplay', '1');
        return embed.href;
      };

      if (parsed.pathname.toLowerCase() === '/video_ext.php') {
        return buildEmbedUrl(
          parsed.searchParams.get('oid') || '',
          parsed.searchParams.get('id') || '',
          parsed.searchParams.get('hash') || '',
          parsed.searchParams.get('hd') || '2'
        );
      }

      const candidates = [parsed.pathname, parsed.searchParams.get('z') || '', parsed.hash || ''];
      for (const candidate of candidates) {
        let decoded = candidate;
        try { decoded = decodeURIComponent(candidate); } catch (e) {}
        const match = decoded.match(/(?:video|clip)(-?\d+)_(\d+)/i);
        if (match) return buildEmbedUrl(match[1], match[2]);
      }
      return '';
    }

    function getVideoEmbedUrl(url) {
      const href = safeExternalUrl(url);
      if (!href || getDirectVideoType(href)) return '';
      try {
        const parsed = new URL(href);
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        const vkEmbed = getVkVideoEmbedUrl(parsed, true);
        if (vkEmbed) return vkEmbed;
        if (host === 'youtu.be') {
          const id = parsed.pathname.split('/').filter(Boolean)[0];
          return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : '';
        }
        if ((host === 'youtube.com' || host.endsWith('.youtube.com'))) {
          if (parsed.pathname.startsWith('/embed/')) return `${parsed.origin}${parsed.pathname}?autoplay=1&rel=0`;
          if (parsed.pathname.startsWith('/shorts/')) {
            const id = parsed.pathname.split('/').filter(Boolean)[1];
            return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : '';
          }
          const id = parsed.searchParams.get('v');
          return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : '';
        }
        if ((host === 'vimeo.com' || host.endsWith('.vimeo.com'))) {
          const id = parsed.pathname.split('/').filter(Boolean).find(part => /^\d+$/.test(part));
          return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=1` : '';
        }
        if ((host === 'rutube.ru' || host.endsWith('.rutube.ru'))) {
          const parts = parsed.pathname.split('/').filter(Boolean);
          const idx = parts.findIndex(part => part === 'video');
          const id = idx >= 0 ? parts[idx + 1] : '';
          return id ? `https://rutube.ru/play/embed/${encodeURIComponent(id)}` : '';
        }
      } catch (e) {}
      return '';
    }

  async function showTopVideo(id) {
    const modal = modalRoot('video'), body = modal.querySelector('.oc-top100-modal-body');
    body.innerHTML = '<p>Загружаю видео…</p>';
    try {
      await loadCatalog([String(id)]);
      if (!modal.isConnected) return;
      const entry = state.catalog.get(String(id));
      const href = safeExternalUrl(entry?.link);
      const direct = getDirectVideoType(href), embed = getVideoEmbedUrl(href);
      body.innerHTML = `<h2>${esc(entry?.title || id)}</h2>${direct ? `<video class="oc-top100-video-player" controls autoplay playsinline preload="metadata" src="${esc(href)}"></video>` : embed ? `<iframe class="oc-top100-video-player" src="${esc(embed)}" title="Видео" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>` : '<p>Встроенный просмотр недоступен для этой ссылки.</p>'}${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">Открыть видео в новой вкладке ↗</a>` : '<p>Ссылка на видео пока не добавлена.</p>'}`;
      modal.querySelector('.oc-top100-modal-close')?.focus();
    } catch (error) {
      if (modal.isConnected) body.innerHTML = `<p>${esc(error?.message || 'Не удалось загрузить видео.')}</p>`;
    }
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.querySelector('.oc-top100-modal[data-kind="video"]')?.remove();
  });

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
    if (Date.now() < state.suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const play = event.target.closest?.('[data-top100-video]');
    if (play && isTopView()) {
      event.preventDefault(); event.stopImmediatePropagation(); void showTopVideo(play.dataset.top100Video); return;
    }
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

  let dragScrollFrame = 0;
  function clearDropIndicator() {
    document.querySelectorAll('.oc-workspace-drop-active').forEach(node => node.classList.remove('oc-workspace-drop-active'));
  }
  function dragTarget(x, y, type) {
    const container = containerFor(type);
    const hit = document.elementFromPoint(x, y);
    if (!container || !hit || !container.contains(hit)) return null;
    const gap = hit.closest('[data-workspace-gap]');
    if (gap) return Number(gap.dataset.workspaceGap);
    const card = hit.closest('.oc-top100-editor-card');
    if (card) {
      const index = state.draft[type].indexOf(clean(card.dataset.top100Id));
      return index + (y > card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2 ? 1 : 0);
    }
    return state.draft[type].length;
  }
  function updateDragTarget(drag) {
    drag.gap = dragTarget(drag.x, drag.y, drag.type);
    clearDropIndicator();
    if (drag.gap !== null) containerFor(drag.type)?.querySelector(`[data-workspace-gap="${drag.gap}"]`)?.classList.add('oc-workspace-drop-active');
  }
  function scrollWhileDragging() {
    const drag = state.drag;
    if (!drag?.moved) { dragScrollFrame = 0; return; }
    const container = containerFor(drag.type), rect = container?.getBoundingClientRect();
    if (rect && drag.x >= rect.left && drag.x <= rect.right && drag.y >= rect.top && drag.y <= rect.bottom) {
      const margin = 55;
      const speed = drag.y < rect.top + margin ? -10 : drag.y > rect.bottom - margin ? 10 : 0;
      if (speed) { container.scrollTop += speed; updateDragTarget(drag); }
    }
    dragScrollFrame = requestAnimationFrame(scrollWhileDragging);
  }
  document.addEventListener('pointerdown', event => {
    if (!state.editing || !isTopView() || !isOwnProfile() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const candidate = event.target.closest?.('[data-workspace-candidate]');
    const card = candidate || event.target.closest?.('.oc-top100-editor-card');
    if (!card) return;
    const handle = event.target.closest('.oc-top100-drag-handle');
    if (!handle && (event.pointerType !== 'mouse' || event.target.closest('button,input,a'))) return;
    const type = candidate ? activeType() : card.dataset.type;
    const id = clean(candidate?.dataset.workspaceCandidate || card.dataset.top100Id);
    const capture = handle || card;
    state.drag = { pointerId:event.pointerId, capture, card, type, id, startX:event.clientX, startY:event.clientY, x:event.clientX, y:event.clientY, moved:false, gap:null };
    if (handle) event.preventDefault();
    event.stopImmediatePropagation();
    try { capture.setPointerCapture(event.pointerId); } catch (_) {}
  }, true);
  document.addEventListener('pointermove', event => {
    const drag = state.drag; if (!drag || drag.pointerId !== event.pointerId) return;
    drag.x = event.clientX; drag.y = event.clientY;
    if (!drag.moved && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 6) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!drag.moved) {
      drag.moved = true;
      drag.card.classList.add('oc-top100-card-dragging');
      document.documentElement.classList.add('oc-top100-drag-active');
      const ghost = document.createElement('div'); ghost.className = 'oc-workspace-drag-ghost';
      ghost.textContent = metaFor(drag.type, drag.id).title; document.body.append(ghost); drag.ghost = ghost;
      dragScrollFrame = requestAnimationFrame(scrollWhileDragging);
    }
    drag.ghost.style.transform = `translate(${drag.x + 16}px,${drag.y + 12}px)`;
    updateDragTarget(drag);
  }, { capture:true, passive:false });
  function finishDrag(event, cancel = false) {
    const drag = state.drag; if (!drag || (event && drag.pointerId !== event.pointerId)) return;
    if (event && !cancel && drag.moved) { drag.x = event.clientX; drag.y = event.clientY; updateDragTarget(drag); }
    try { drag.capture.releasePointerCapture(drag.pointerId); } catch (_) {}
    cancelAnimationFrame(dragScrollFrame); dragScrollFrame = 0;
    drag.ghost?.remove(); drag.card.classList.remove('oc-top100-card-dragging');
    document.documentElement.classList.remove('oc-top100-drag-active'); clearDropIndicator(); state.drag = null;
    if (!cancel && drag.moved && drag.gap !== null && state.editing && isOwnProfile()) {
      event?.preventDefault(); state.suppressClickUntil = Date.now() + 300;
      state.selected = { type:drag.type, id:drag.id };
      insertDraftGap(drag.type, drag.id, drag.gap);
    }
  }
  document.addEventListener('pointerup', event => finishDrag(event), true);
  document.addEventListener('pointercancel', event => finishDrag(event, true), true);
  window.addEventListener('blur', () => finishDrag(null, true));
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
    if (panel) new MutationObserver(() => {
      syncTop100ViewState();
      if (isTopView()) void loadSaved(viewedUser(), state.key !== normalize(viewedUser()));
    }).observe(panel, { attributes:true, attributeFilter:['data-profile-view','class'] });
    document.querySelector('#oc-profile-user')?.addEventListener('change', () => {
      state.loaded = false; state.selected = null; state.candidateRequest += 1; state.candidateLoadedKey = ''; state.candidateError = ''; state.expanded = { OP:false, ED:false }; setTimeout(() => void loadSaved(viewedUser(), true), 0);
    });
  }

  async function init() {
    ensureToolbar(); monitorDom(); syncTop100ViewState();
    if (isTopView()) await loadSaved(viewedUser(), true);
    document.documentElement.classList.remove('oc-top100-loading');
  }

  window.OC_TOP100_DRAFT = {
    async applyOrder(type, order) {
      const safeType = type === 'ED' ? 'ED' : 'OP';
      if (!isOwnProfile()) return false;
      if (!state.loaded) await loadSaved(viewedUser(), true);
      state.editing = true;
      editButton()?.classList.add('active');
      const next = cloneOrder(state.draft);
      next[safeType] = uniqueIds(order);
      setDraft(next);
      toast('Результат дуэлей перенесён в общий черновик топ‑100. Проверь порядок и сохрани его.', 'success');
      return true;
    },
    snapshot() {
      return { baseline: cloneOrder(state.baseline), draft: cloneOrder(state.draft), dirty: dirty() };
    }
  };

  window.addEventListener('oped-db-ready', () => { if (isTopView()) void loadSaved(viewedUser(), !state.loaded); });
  window.addEventListener('oped-account-restored', () => { if (isTopView()) void loadSaved(viewedUser(), true); });
  let previousTopView = null;
  function syncTop100ViewState() {
    const current = isTopView();
    if (previousTopView === current) return;
    previousTopView = current;
    if (!current) { finishDrag(null, true); syncWorkspace(); }
    void window.OC_APP_BRIDGE?.refreshRouteSubscriptions?.();
    if (current) void loadSaved(viewedUser(), true);
  }

  window.addEventListener('oped:app-data-updated', event => {
    const reason = clean(event.detail?.reason);
    if (reason === 'catalog-updated') mergeLiveCatalog(event.detail?.snapshot?.entries);
    if (!isTopView() || (state.editing && dirty())) return;
    if (reason === 'manual-ranks-saved' || reason === 'top100-candidates-added' || reason === 'top100-pins-saved') {
      void loadSaved(viewedUser(), true);
    }
  });
  window.addEventListener('beforeunload', event => { if (!dirty()) return; event.preventDefault(); event.returnValue = ''; });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void init(), { once:true });
  else void init();
})();
