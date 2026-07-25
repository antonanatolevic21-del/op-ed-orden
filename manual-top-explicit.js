(() => {
  if (window.__OC_MANUAL_TOP_EXPLICIT_READY__) return;
  window.__OC_MANUAL_TOP_EXPLICIT_READY__ = true;

  const DRAFT_PREFIX = 'oc-explicit-top-draft-v1:';
  const state = {
    userKey: '',
    user: '',
    baseline: { OP: [], ED: [] },
    draft: { OP: [], ED: [] },
    cards: new Map(),
    catalog: new Map(),
    loading: false,
    loaded: false,
    applying: false,
    scheduled: false
  };

  const clean = value => String(value ?? '').trim();
  const normalize = value => {
    try { return window.OPED_DB?.normalizeNickname?.(value) || clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60); }
    catch (_) { return clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60); }
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const uniqueIds = values => [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))].slice(0, 100);
  const viewedUser = () => clean(document.querySelector('#oc-profile-user')?.value || document.querySelector('#oc-myname')?.value);
  const editing = () => Boolean(document.querySelector('#oc-manual-edit-btn')?.classList.contains('active'));
  const profileVisible = () => !document.querySelector('#oc-profile-panel')?.classList.contains('hidden');
  const containerFor = type => document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op');
  const cardId = card => clean(card?.querySelector('[data-action="set-rank"][data-id]')?.dataset.id || card?.dataset.explicitTopId);
  const fingerprint = value => JSON.stringify({ OP: uniqueIds(value?.OP), ED: uniqueIds(value?.ED) });
  const dirty = () => fingerprint(state.draft) !== fingerprint(state.baseline);
  const draftKey = key => DRAFT_PREFIX + key;

  function toast(message, type = '') {
    window.OC_TOAST?.show?.(message, { type });
    const status = document.querySelector('#oc-status');
    if (status) status.textContent = message;
  }

  function readLocalDraft(key) {
    try {
      const row = JSON.parse(localStorage.getItem(draftKey(key)) || 'null');
      if (!row || typeof row !== 'object') return null;
      return { OP: uniqueIds(row.OP), ED: uniqueIds(row.ED) };
    } catch (_) { return null; }
  }

  function writeLocalDraft() {
    if (!state.userKey) return;
    try {
      if (dirty()) localStorage.setItem(draftKey(state.userKey), JSON.stringify(state.draft));
      else localStorage.removeItem(draftKey(state.userKey));
    } catch (_) {}
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

  async function loadCatalog() {
    if (state.catalog.size) return;
    try {
      const rows = window.OC_CATALOG_CACHE?.load ? await window.OC_CATALOG_CACHE.load() : [];
      state.catalog = new Map((rows || []).map(row => [String(row.id), row]));
    } catch (error) { console.warn('Explicit top catalog load failed', error); }
  }

  async function loadUser(user) {
    const key = normalize(user);
    if (!key || state.loading || (state.loaded && state.userKey === key)) return;
    state.loading = true;
    state.loaded = false;
    state.user = user;
    state.userKey = key;
    state.cards.clear();
    try {
      await loadCatalog();
      const tools = await firebaseTools();
      const snap = await tools.getDoc(tools.doc(tools.db, 'manualRanks', key));
      const row = snap.exists() ? snap.data() || {} : {};
      const baseline = {
        OP: uniqueIds(row.OP || row.manualOP || []),
        ED: uniqueIds(row.ED || row.manualED || [])
      };
      state.baseline = baseline;
      state.draft = readLocalDraft(key) || { OP: baseline.OP.slice(), ED: baseline.ED.slice() };
      state.loaded = true;
    } catch (error) {
      console.warn('Explicit top load failed', error);
      state.baseline = { OP: [], ED: [] };
      state.draft = readLocalDraft(key) || { OP: [], ED: [] };
      state.loaded = true;
    } finally {
      state.loading = false;
      scheduleSync();
    }
  }

  function collectRenderedCards() {
    ['OP', 'ED'].forEach(type => {
      containerFor(type)?.querySelectorAll('.oc-profile-item.manual').forEach(card => {
        const id = cardId(card);
        if (!id) return;
        state.cards.set(`${type}:${id}`, card);
      });
    });
  }

  function scoreFromRatingsCard(id) {
    const button = document.querySelector(`#oc-allratings-columns [data-id="${CSS.escape(String(id))}"]`);
    const card = button?.closest('.oc-card, .oc-profile-item, article, [data-opening-id]');
    return clean(card?.querySelector('.oc-profile-score, .oc-score, .oc-unified-score')?.textContent) || '—';
  }

  function makeCard(type, id) {
    const key = `${type}:${id}`;
    const cached = state.cards.get(key);
    if (cached) return cached;
    const entry = state.catalog.get(String(id)) || {};
    const title = clean(entry.title || entry.anime || id);
    const seasonLabels = { winter:'Зима', spring:'Весна', summer:'Лето', fall:'Осень' };
    const meta = [entry.year, seasonLabels[entry.season] || entry.season].filter(Boolean).join(' · ');
    const image = clean(entry.fallbackImage || entry.image);
    const card = document.createElement('div');
    card.className = 'oc-profile-item manual oc-explicit-top-card';
    card.dataset.explicitTopId = String(id);
    card.innerHTML = `<button type="button" class="oc-rank-jump-btn" data-action="set-rank" data-type="${type}" data-id="${esc(id)}">—</button>${image ? `<span class="oc-image-link"><div class="oc-profile-thumb"><img class="oc-track-image" src="${esc(image)}" data-fallback="${esc(clean(entry.fallbackImage))}" alt="" loading="lazy" decoding="async"></div></span>` : `<span class="oc-image-link"><div class="oc-profile-thumb">${type}</div></span>`}<div><div class="oc-profile-name"><span>${esc(title)}</span></div>${meta ? `<div class="oc-profile-meta">${esc(meta)}</div>` : ''}</div><div class="oc-profile-score">${esc(scoreFromRatingsCard(id))}</div><div class="oc-move-btns"><button class="oc-move-btn" data-action="move-up" data-type="${type}" data-id="${esc(id)}" title="Выше">▲</button><button class="oc-move-btn" data-action="move-down" data-type="${type}" data-id="${esc(id)}" title="Ниже">▼</button></div><div class="oc-manual-row-actions"><button type="button" class="oc-ar-top-btn" data-action="remove-from-top" data-type="${type}" data-id="${esc(id)}">Удалить из топа</button></div>`;
    return card;
  }

  function renderType(type) {
    const container = containerFor(type);
    if (!container || !state.loaded) return;
    const ids = uniqueIds(state.draft[type]);
    const fp = `${type}|${ids.join('¦')}|${editing() ? 'edit' : 'view'}`;
    const currentIds = [...container.querySelectorAll(':scope > .oc-profile-item.manual')].map(cardId).filter(Boolean);
    if (container.dataset.explicitTopFingerprint === fp && currentIds.join('¦') === ids.join('¦')) return;
    const fragment = document.createDocumentFragment();
    ids.forEach((id, index) => {
      const card = makeCard(type, id);
      card.dataset.explicitTopId = id;
      const rank = card.querySelector('[data-action="set-rank"]');
      if (rank) {
        rank.textContent = String(index + 1);
        rank.dataset.type = type;
        rank.dataset.id = id;
      }
      const up = card.querySelector('[data-action="move-up"]');
      const down = card.querySelector('[data-action="move-down"]');
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === ids.length - 1;
      fragment.append(card);
    });
    if (ids.length < 100) {
      const empty = document.createElement('div');
      empty.className = 'oc-manual-local-empty-slot oc-explicit-top-empty';
      empty.dataset.place = String(ids.length + 1);
      empty.innerHTML = `<span class="oc-manual-local-empty-rank">${ids.length + 1}</span><span class="oc-manual-local-empty-text">${ids.length ? 'Следующее место пустое' : 'Топ пока пуст — добавьте первый трек ниже'}</span>`;
      fragment.append(empty);
    }
    container.replaceChildren(fragment);
    container.dataset.explicitTopFingerprint = fp;
  }

  function syncAllRatingsControls() {
    if (!state.loaded || !editing()) return;
    document.querySelectorAll('#oc-allratings-columns [data-action="all-set-rank"][data-id]').forEach(rankButton => {
      const id = clean(rankButton.dataset.id);
      const type = rankButton.dataset.type === 'ED' ? 'ED' : 'OP';
      const index = state.draft[type].indexOf(id);
      rankButton.textContent = index >= 0 ? `№ ${index + 1}` : '№ —';
      const parent = rankButton.parentElement;
      if (!parent) return;
      let add = [...parent.querySelectorAll('[data-action="all-to-top100"][data-id]')].find(button => clean(button.dataset.id) === id);
      if (index < 0 && !add) {
        add = document.createElement('button');
        add.type = 'button';
        add.className = 'oc-ar-top-btn';
        add.dataset.action = 'all-to-top100';
        add.dataset.type = type;
        add.dataset.id = id;
        add.textContent = 'В топ-100';
        add.title = 'Добавить вручную в свой топ-100';
        rankButton.after(add);
      } else if (index >= 0) add?.remove();
    });
  }

  function syncButtons() {
    const save = document.querySelector('#oc-manual-save-btn');
    if (save && editing()) {
      const hasAnything = state.draft.OP.length + state.draft.ED.length > 0;
      const hadSavedTop = state.baseline.OP.length + state.baseline.ED.length > 0;
      const canSave = state.loaded && dirty() && (hasAnything || hadSavedTop);
      save.disabled = !canSave;
      save.classList.toggle('active', canSave);
      save.title = !hasAnything && !hadSavedTop ? 'Сначала вручную добавьте хотя бы один трек' : '';
    }
    const hint = document.querySelector('#oc-topmode-hint');
    if (hint && editing() && !state.draft.OP.length && !state.draft.ED.length) {
      hint.style.display = 'block';
      hint.textContent = 'Топ-100 пуст. Он не заполняется по оценкам автоматически — добавьте нужные треки вручную в блоке «Все оценки».';
    }
  }

  function sync() {
    state.scheduled = false;
    if (state.applying || !profileVisible()) return;
    const user = viewedUser();
    const key = normalize(user);
    if (!key) return;
    if (!state.loaded || state.userKey !== key) {
      void loadUser(user);
      return;
    }
    if (!editing()) return;
    state.applying = true;
    try {
      collectRenderedCards();
      renderType('OP');
      renderType('ED');
      syncAllRatingsControls();
      syncButtons();
    } finally {
      state.applying = false;
    }
  }

  function scheduleSync() {
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(sync);
  }

  function commitDraft() {
    state.draft = { OP: uniqueIds(state.draft.OP), ED: uniqueIds(state.draft.ED) };
    writeLocalDraft();
    scheduleSync();
  }

  function addToTop(type, id, target = null) {
    const order = state.draft[type].filter(value => value !== id);
    const index = target === null ? order.length : Math.max(0, Math.min(order.length, Math.round(Number(target) || 1) - 1));
    order.splice(index, 0, id);
    state.draft[type] = uniqueIds(order);
    commitDraft();
  }

  function move(type, id, offset) {
    const order = state.draft[type].slice();
    const from = order.indexOf(id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= order.length) return;
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item);
    state.draft[type] = order;
    commitDraft();
  }

  function setRank(type, id) {
    const order = state.draft[type].slice();
    const current = order.indexOf(id);
    const max = Math.min(100, order.length + (current < 0 ? 1 : 0));
    const raw = window.prompt(`Введите место от 1 до ${Math.max(1, max)}.`, String(current >= 0 ? current + 1 : max));
    if (raw === null) return;
    const place = Math.max(1, Math.min(max, Math.round(Number(String(raw).replace(',', '.')) || 1)));
    addToTop(type, id, place);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-action][data-id]');
    if (!button || !editing() || !profileVisible() || !state.loaded) return;
    const action = button.dataset.action;
    if (!['all-to-top100', 'all-set-rank', 'set-rank', 'move-up', 'move-down', 'remove-from-top'].includes(action)) return;
    const id = clean(button.dataset.id);
    const type = button.dataset.type === 'ED' ? 'ED' : 'OP';
    if (!id) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (action === 'all-to-top100') addToTop(type, id);
    else if (action === 'all-set-rank' || action === 'set-rank') setRank(type, id);
    else if (action === 'move-up') move(type, id, -1);
    else if (action === 'move-down') move(type, id, 1);
    else if (action === 'remove-from-top') {
      state.draft[type] = state.draft[type].filter(value => value !== id);
      commitDraft();
    }
  }, true);

  document.addEventListener('click', event => {
    const editButton = event.target.closest?.('#oc-manual-edit-btn');
    if (!editButton) return;
    const user = viewedUser();
    const key = normalize(user);
    if (!state.loaded || state.userKey !== key) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void loadUser(user).then(() => window.setTimeout(() => editButton.click(), 0));
      return;
    }
    window.setTimeout(scheduleSync, 0);
  }, true);

  document.addEventListener('click', event => {
    const save = event.target.closest?.('#oc-manual-save-btn');
    if (!save || !editing() || !state.loaded) return;
    const hasAnything = state.draft.OP.length + state.draft.ED.length > 0;
    const hadSavedTop = state.baseline.OP.length + state.baseline.ED.length > 0;
    if (dirty() && (hasAnything || hadSavedTop)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!hasAnything && !hadSavedTop) toast('Сначала вручную добавьте хотя бы один трек в топ-100.', 'error');
  }, true);

  document.addEventListener('oc:top100-saved', event => {
    const user = clean(event.detail?.user || viewedUser());
    if (normalize(user) !== state.userKey) return;
    state.baseline = { OP: uniqueIds(state.draft.OP), ED: uniqueIds(state.draft.ED) };
    try { localStorage.removeItem(draftKey(state.userKey)); } catch (_) {}
    scheduleSync();
  });

  const observer = new MutationObserver(() => {
    if (!state.applying) scheduleSync();
  });
  ['#oc-profile-panel', '#oc-profile-op', '#oc-profile-ed', '#oc-allratings-columns'].forEach(selector => {
    const node = document.querySelector(selector);
    if (node) observer.observe(node, { childList: true, subtree: true });
  });
  document.querySelector('#oc-profile-user')?.addEventListener('change', () => {
    state.loaded = false;
    state.userKey = '';
    scheduleSync();
  });

  [0, 100, 400, 1000].forEach(delay => window.setTimeout(scheduleSync, delay));
})();
