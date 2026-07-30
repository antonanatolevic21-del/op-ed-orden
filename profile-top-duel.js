(() => {
  if (window.__OC_PROFILE_TOP_DUEL_READY__) return;
  window.__OC_PROFILE_TOP_DUEL_READY__ = true;

  const POOL_LIMIT = 150;
  const STAGE_ONE_ROUNDS = 4;
  const STAGE_TWO_LIMIT = 100;
  const DRAFT_VERSION = 2;
  const state = { type: 'OP', mode: 'new', duel: null, query: '', busy: false, notice: '' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const norm = value => String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const NATURAL_COLLATOR = new Intl.Collator(['ru', 'en'], { numeric: true, sensitivity: 'base' });
  const compareNatural = (left, right) => NATURAL_COLLATOR.compare(String(left ?? ''), String(right ?? ''));
  const bridge = () => window.OC_APP_BRIDGE;
  const snap = () => bridge()?.snapshot?.() || window.OC_APP_DATA || {};
  const entries = () => Array.isArray(snap().entries) ? snap().entries : [];
  const currentUser = () => String(snap().currentUser?.nickname || '').trim();
  const viewedUser = () => String(document.querySelector('#oc-profile-user')?.value || currentUser()).trim();
  const ownProfile = () => currentUser() && norm(currentUser()) === norm(viewedUser());
  const byId = () => new Map(entries().map(entry => [String(entry.id), entry]));
  const meta = () => bridge()?.top100Meta?.(state.type) || { candidates: [], pins: [] };

  function rowForUser() {
    const rows = snap().manualRanks || {};
    return rows[currentUser()] || rows[norm(currentUser())] ||
      Object.values(rows).find(row => norm(row?.nickname || row?.nicknameKey) === norm(currentUser())) || {};
  }

  function score(entry) {
    const map = entry?.scores || {};
    const exact = Number(map[currentUser()]);
    if (Number.isFinite(exact)) return exact;
    const key = Object.keys(map).find(name => norm(name) === norm(currentUser()));
    const value = Number(key ? map[key] : NaN);
    return Number.isFinite(value) ? value : null;
  }

  function pool() {
    const candidateIds = meta().candidates.map(String);
    const map = byId();
    const rated = entries()
      .filter(entry => entry.type === state.type && score(entry) !== null)
      .sort((a, b) => score(b) - score(a) || compareNatural(a.title, b.title))
      .map(entry => String(entry.id));
    const pins = new Set(meta().pins.map(pin => String(pin.id)));
    const selected = Array.from(new Set([...candidateIds, ...rated])).filter(id => !pins.has(id)).slice(0, POOL_LIMIT);
    return selected.sort((leftId, rightId) => {
      const left = map.get(leftId);
      const right = map.get(rightId);
      const leftScore = score(left);
      const rightScore = score(right);
      if (leftScore === null && rightScore !== null) return 1;
      if (rightScore === null && leftScore !== null) return -1;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return compareNatural(left?.title, right?.title);
    });
  }

  function existingOrder() {
    const row = rowForUser();
    return Array.isArray(row[state.type]) ? row[state.type].map(String) : [];
  }

  function applyPins(order) {
    const pins = meta().pins;
    const pinned = new Set(pins.map(pin => String(pin.id)));
    const remaining = Array.from(new Set(order.map(String))).filter(id => !pinned.has(id));
    const result = Array(100).fill(null);
    pins.forEach(pin => {
      const rank = Math.round(Number(pin.rank));
      if (rank >= 1 && rank <= 100) result[rank - 1] = String(pin.id);
    });
    let cursor = 0;
    for (let i = 0; i < result.length && cursor < remaining.length; i += 1) {
      if (!result[i]) result[i] = remaining[cursor++];
    }
    return result.filter(Boolean).slice(0, 100);
  }

  function draftKey(type = state.type) {
    const user = norm(currentUser()).replace(/[^a-zа-я0-9_-]+/gi, '_');
    return `op-ed-profile-duel-draft-v${DRAFT_VERSION}:${user}:${type}`;
  }

  function cleanDuel(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== DRAFT_VERSION || raw.type !== state.type) return null;
    const valid = new Set(entries().filter(entry => entry.type === state.type).map(entry => String(entry.id)));
    const order = Array.from(new Set((raw.order || []).map(String).filter(id => valid.has(id))));
    if (order.length < 2) return null;
    const duel = { ...raw, order };
    duel.stage = Number(duel.stage) === 2 ? 2 : 1;
    duel.comparisons = Math.max(0, Number(duel.comparisons) || 0);
    duel.stageComparisons = Math.max(0, Number(duel.stageComparisons) || 0);
    duel.updatedAt = String(duel.updatedAt || new Date().toISOString());
    if (duel.stage === 1) {
      duel.round = Math.max(1, Math.min(STAGE_ONE_ROUNDS, Number(duel.round) || 1));
      duel.points = duel.points && typeof duel.points === 'object' ? duel.points : Object.fromEntries(order.map(id => [id, 0]));
      duel.playedPairs = Array.isArray(duel.playedPairs) ? duel.playedPairs.map(String) : [];
      duel.pairs = Array.isArray(duel.pairs) ? duel.pairs.filter(pair => Array.isArray(pair) && valid.has(String(pair[0])) && valid.has(String(pair[1]))).map(pair => pair.map(String)) : [];
      duel.pairIndex = Math.max(0, Math.min(duel.pairs.length, Number(duel.pairIndex) || 0));
    } else {
      duel.pairs = Array.isArray(duel.pairs) ? duel.pairs.filter(pair => Array.isArray(pair) && valid.has(String(pair[0])) && valid.has(String(pair[1]))).map(pair => pair.map(String)) : buildStageTwoPairs(order);
      duel.pairIndex = Math.max(0, Math.min(duel.pairs.length, Number(duel.pairIndex) || 0));
    }
    return duel;
  }

  function storedDraft() {
    try {
      return cleanDuel(JSON.parse(localStorage.getItem(draftKey()) || 'null'));
    } catch (_) {
      return null;
    }
  }

  function persistDraft(duel = state.duel) {
    if (!duel?.order || !currentUser()) return;
    duel.version = DRAFT_VERSION;
    duel.type = state.type;
    duel.updatedAt = new Date().toISOString();
    try { localStorage.setItem(draftKey(), JSON.stringify(duel)); }
    catch (error) { console.warn('Не удалось сохранить черновик дуэли', error); }
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey()); }
    catch (_) {}
  }

  function pairKey(left, right) {
    return [String(left), String(right)].sort().join('|');
  }

  function sortedStageOneOrder(duel) {
    const initial = new Map((duel.initialOrder || duel.order).map((id, index) => [String(id), index]));
    return duel.order.slice().sort((left, right) => {
      const pointsDiff = Number(duel.points[right] || 0) - Number(duel.points[left] || 0);
      if (pointsDiff) return pointsDiff;
      const leftEntry = byId().get(String(left));
      const rightEntry = byId().get(String(right));
      const scoreDiff = Number(score(rightEntry) ?? -1) - Number(score(leftEntry) ?? -1);
      if (scoreDiff) return scoreDiff;
      return (initial.get(String(left)) ?? 9999) - (initial.get(String(right)) ?? 9999);
    });
  }

  function buildSwissPairs(duel) {
    const ordered = sortedStageOneOrder(duel);
    const played = new Set(duel.playedPairs || []);
    const available = ordered.slice();
    const pairs = [];
    while (available.length > 1) {
      const left = available.shift();
      let opponentIndex = available.findIndex(id => !played.has(pairKey(left, id)));
      if (opponentIndex < 0) opponentIndex = 0;
      const right = available.splice(opponentIndex, 1)[0];
      pairs.push([left, right]);
    }
    return pairs;
  }

  function buildStageTwoPairs(order) {
    const focus = order.slice(0, Math.min(125, order.length));
    const pairs = [];
    const seen = new Set();
    const add = (left, right) => {
      if (!left || !right || left === right || pairs.length >= STAGE_TWO_LIMIT) return;
      const key = pairKey(left, right);
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push([String(left), String(right)]);
    };
    const priority = [];
    for (let i = 80; i < Math.min(120, focus.length); i += 1) priority.push(i);
    for (let i = 0; i < Math.min(80, focus.length); i += 1) priority.push(i);
    for (const offset of [1, 2, 4, 7]) {
      for (const index of priority) {
        if (pairs.length >= STAGE_TWO_LIMIT) break;
        add(focus[index], focus[index + offset]);
      }
      if (pairs.length >= STAGE_TWO_LIMIT) break;
    }
    for (let i = 0; pairs.length < STAGE_TWO_LIMIT && i + 1 < focus.length; i += 1) add(focus[i], focus[i + 1]);
    return pairs;
  }

  function createStageOne(candidates) {
    const duel = {
      version: DRAFT_VERSION,
      type: state.type,
      mode: 'staged',
      stage: 1,
      round: 1,
      order: candidates.slice(),
      initialOrder: candidates.slice(),
      points: Object.fromEntries(candidates.map(id => [id, 0])),
      playedPairs: [],
      pairs: [],
      pairIndex: 0,
      comparisons: 0,
      stageComparisons: 0,
      complete: false,
      stageOneComplete: false
    };
    duel.pairs = buildSwissPairs(duel);
    return duel;
  }

  function createStageTwo(order, comparisons = 0) {
    return {
      version: DRAFT_VERSION,
      type: state.type,
      mode: 'staged',
      stage: 2,
      order: order.slice(),
      pairs: buildStageTwoPairs(order),
      pairIndex: 0,
      comparisons,
      stageComparisons: 0,
      complete: false,
      stageOneComplete: true
    };
  }

  function start() {
    const candidates = pool();
    if (candidates.length < 2) {
      state.duel = { error: `Нужно хотя бы два незакреплённых ${state.type}.` };
      render();
      return;
    }
    clearDraft();
    state.notice = '';
    const old = existingOrder().filter(id => candidates.includes(id));
    if (state.mode === 'refine' && old.length >= 2) {
      const order = [...old, ...candidates.filter(id => !old.includes(id))].slice(0, POOL_LIMIT);
      state.duel = createStageTwo(order);
    } else {
      state.duel = createStageOne(candidates);
    }
    persistDraft();
    render();
  }

  function ensureBefore(order, winner, loser) {
    const winnerIndex = order.indexOf(String(winner));
    const loserIndex = order.indexOf(String(loser));
    if (winnerIndex < 0 || loserIndex < 0 || winnerIndex < loserIndex) return;
    const [moved] = order.splice(winnerIndex, 1);
    const nextLoserIndex = order.indexOf(String(loser));
    order.splice(nextLoserIndex, 0, moved);
  }

  function finishStageOneRound(duel) {
    duel.order = sortedStageOneOrder(duel);
    if (duel.round >= STAGE_ONE_ROUNDS) {
      duel.stageOneComplete = true;
      duel.pairs = [];
      duel.pairIndex = 0;
      persistDraft(duel);
      return;
    }
    duel.round += 1;
    duel.pairs = buildSwissPairs(duel);
    duel.pairIndex = 0;
  }

  function choose(choice) {
    const duel = state.duel;
    if (!duel || duel.complete || duel.stageOneComplete && duel.stage === 1) return;
    const pair = duel.pairs?.[duel.pairIndex];
    if (!pair) return;
    const [left, right] = pair.map(String);
    duel.comparisons += 1;
    duel.stageComparisons += 1;
    if (duel.stage === 1) {
      if (choice === 'left') duel.points[left] = Number(duel.points[left] || 0) + 1;
      else if (choice === 'right') duel.points[right] = Number(duel.points[right] || 0) + 1;
      else if (choice === 'tie') {
        duel.points[left] = Number(duel.points[left] || 0) + 0.5;
        duel.points[right] = Number(duel.points[right] || 0) + 0.5;
      }
      duel.playedPairs.push(pairKey(left, right));
      duel.pairIndex += 1;
      if (duel.pairIndex >= duel.pairs.length) finishStageOneRound(duel);
    } else {
      if (choice === 'left') ensureBefore(duel.order, left, right);
      else if (choice === 'right') ensureBefore(duel.order, right, left);
      duel.pairIndex += 1;
      if (duel.pairIndex >= duel.pairs.length) duel.complete = true;
    }
    persistDraft(duel);
    render();
  }

  function beginStageTwo() {
    if (!state.duel?.stageOneComplete) return;
    const comparisons = state.duel.comparisons;
    state.duel = createStageTwo(state.duel.order, comparisons);
    persistDraft();
    render();
  }

  function saveAndExit() {
    if (!state.duel?.order) return;
    persistDraft();
    state.duel = null;
    state.notice = 'Черновик сохранён. К нему можно вернуться позже на этом устройстве.';
    render();
  }

  function resumeDraft() {
    const draft = storedDraft();
    if (!draft) return;
    state.duel = draft;
    state.notice = '';
    render();
  }

  function discardDraft() {
    clearDraft();
    state.duel = null;
    state.notice = 'Черновик удалён.';
    render();
  }

  function finalOrder() {
    const duel = state.duel;
    if (!duel?.order) return existingOrder();
    return applyPins(duel.order);
  }

  function card(id, side) {
    const entry = byId().get(String(id));
    if (!entry) return '';
    const image = String(entry.fallbackImage || entry.image || '');
    return `<div class="oc-duel-card-wrap">
      <button class="oc-duel-card" type="button" data-profile-duel-choice="${side}">
        ${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : '<span></span>'}
        <span class="oc-duel-card-copy"><h4>${esc(entry.title)}</h4><p>${esc(entry.type)} · твоя оценка ${score(entry) ?? '—'}</p></span>
      </button>
      <button class="oc-duel-watch" type="button" data-profile-duel-open="${esc(entry.id)}" aria-label="Посмотреть ${esc(entry.title)}">▶ Посмотреть</button>
    </div>`;
  }

  function pinSearch() {
    const query = norm(state.query);
    if (query.length < 2) return [];
    const candidateSet = new Set(meta().candidates.map(String));
    return entries().filter(entry => entry.type === state.type && norm([entry.title, ...(entry.alternativeTitles || [])].join(' ')).includes(query))
      .sort((a, b) => Number(candidateSet.has(String(b.id))) - Number(candidateSet.has(String(a.id))) || compareNatural(a.title, b.title))
      .slice(0, 10);
  }

  function orderPreview(title, order = finalOrder()) {
    const map = byId();
    return `<div class="oc-discovery-list"><h4>${esc(title)} · ${order.length} позиций</h4>${order.slice(0, 100).map((id, i) => `<div class="oc-discovery-row"><button type="button" data-profile-duel-open="${esc(id)}">${i + 1}. ${esc(map.get(id)?.title || id)}</button><span>${meta().pins.some(pin => String(pin.id) === id) ? 'закреплено' : ''}</span></div>`).join('')}</div>`;
  }

  function draftMarkup() {
    const draft = storedDraft();
    if (!draft || state.duel) return '';
    const stageLabel = draft.stage === 1 ? `этап 1${draft.stageOneComplete ? ' завершён' : ` · раунд ${draft.round} из ${STAGE_ONE_ROUNDS}`}` : `этап 2${draft.complete ? ' завершён' : ''}`;
    const date = new Date(draft.updatedAt);
    const updated = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    return `<div class="oc-top100-candidate-bar"><div><strong>Сохранённый черновик · ${esc(stageLabel)}</strong><span>${draft.comparisons} сравнений${updated ? ` · сохранён ${esc(updated)}` : ''}. Прогресс хранится на этом устройстве.</span></div><div><button class="oc-discovery-button primary" id="oc-profile-duel-resume">Продолжить</button><button class="oc-discovery-button" id="oc-profile-duel-discard">Удалить</button></div></div>`;
  }

  function bodyMarkup() {
    const duel = state.duel;
    if (!duel) return `${state.notice ? `<div class="oc-discovery-meta">${esc(state.notice)}</div>` : ''}${draftMarkup()}<div class="oc-discovery-empty">Закрепи бесспорные позиции, затем запускай дуэль. Для нового топа первый этап грубо распределит до 150 элементов, а второй уточнит близкие позиции.</div>`;
    if (duel.error) return `<div class="oc-discovery-empty">${esc(duel.error)}</div>`;
    if (duel.stage === 1 && duel.stageOneComplete) {
      return `<div class="oc-top100-candidate-bar"><div><strong>Первый этап завершён</strong><span>${duel.comparisons} сравнений. Черновой топ сохранён автоматически — второй этап можно начать сейчас или позже.</span></div><div><button class="oc-discovery-button primary" id="oc-profile-duel-stage-two">Перейти ко второму этапу</button><button class="oc-discovery-button" id="oc-profile-duel-save-exit">Сохранить и выйти</button></div></div>${orderPreview('Промежуточный топ‑100')}`;
    }
    if (duel.complete) {
      return `<div class="oc-top100-candidate-bar"><div><strong>Оба этапа завершены</strong><span>${duel.comparisons} сравнений. Результат готов к сохранению в ручной топ‑100.</span></div></div>${orderPreview('Готовый порядок')}`;
    }
    const total = Math.max(1, duel.pairs.length);
    const progress = Math.round(duel.pairIndex / total * 100);
    const pair = duel.pairs[duel.pairIndex] || [];
    const stageTitle = duel.stage === 1 ? `Этап 1 · грубое распределение · раунд ${duel.round} из ${STAGE_ONE_ROUNDS}` : 'Этап 2 · уточнение близких позиций';
    const stageTarget = duel.stage === 1 ? Math.floor(duel.order.length / 2) * STAGE_ONE_ROUNDS : duel.pairs.length;
    return `<div class="oc-top100-candidate-bar"><div><strong>${esc(stageTitle)}</strong><span>Всего на этапе: около ${stageTarget} сравнений. Прогресс сохраняется автоматически после каждого выбора.</span></div><button class="oc-discovery-button" id="oc-profile-duel-save-exit">Сохранить и выйти</button></div>
      <div class="oc-duel-progress"><i style="width:${progress}%"></i></div><div class="oc-discovery-meta">${progress}% текущего ${duel.stage === 1 ? 'раунда' : 'этапа'} · сравнений всего ${duel.comparisons}</div>
      <div class="oc-duel-stage">${card(pair[0], 'left')}<div class="oc-duel-vs">VS</div>${card(pair[1], 'right')}</div>
      <div class="oc-duel-secondary"><button class="oc-discovery-button" data-profile-duel-choice="tie">Примерно равны</button><button class="oc-discovery-button" data-profile-duel-choice="skip">Пропустить</button></div>`;
  }

  function ensureRoot() {
    const profile = document.querySelector('#oc-profile-panel');
    if (!profile) return null;
    let root = profile.querySelector('#oc-profile-top-duel');
    if (!root) {
      root = document.createElement('section');
      root.id = 'oc-profile-top-duel';
      root.className = 'oc-profile-top-duel oc-profile-section-hidden';
    }
    const columns = profile.querySelector('.oc-profile-columns');
    if (columns) columns.before(root);
    else profile.append(root);
    return root;
  }

  function render() {
    const root = ensureRoot();
    if (!root) return;
    root.classList.toggle('oc-profile-section-hidden', document.querySelector('#oc-profile-panel')?.dataset.profileView !== 'top100');
    if (!ownProfile()) {
      root.innerHTML = '<div class="oc-discovery-empty">Дуэль, кандидаты и закрепления доступны только в собственном профиле.</div>';
      return;
    }
    const map = byId();
    const pins = meta().pins;
    const candidates = meta().candidates;
    const canPublish = Boolean(state.duel?.stage === 2 && state.duel?.complete && state.duel?.order);
    root.innerHTML = `<div class="oc-discovery-head"><div><div class="oc-section-label">мой топ‑100</div><h3>Дуэльное ранжирование</h3><p>До 150 элементов проходят два этапа: около 300 сравнений для грубого распределения и ещё 100 для уточнения. Черновик можно сохранить и продолжить позже.</p></div></div>
      <div class="oc-duel-controls">
        <div><select class="oc-discovery-control" id="oc-profile-duel-type"><option value="OP" ${state.type === 'OP' ? 'selected' : ''}>OP</option><option value="ED" ${state.type === 'ED' ? 'selected' : ''}>ED</option></select>
        <select class="oc-discovery-control" id="oc-profile-duel-mode"><option value="new" ${state.mode === 'new' ? 'selected' : ''}>Собрать заново · два этапа</option><option value="refine" ${state.mode === 'refine' ? 'selected' : ''}>Только уточнить текущий</option></select></div>
        <div><button class="oc-discovery-button" id="oc-profile-duel-start">${state.duel ? 'Начать заново' : 'Начать дуэль'}</button><button class="oc-discovery-button primary" id="oc-profile-duel-save" ${canPublish ? '' : 'disabled'}>Сохранить в топ‑100</button></div>
      </div>
      <div class="oc-top100-candidate-bar"><div><strong>Кандидаты: ${candidates.length}</strong><span>Они попадут в пул первыми. В дуэль берётся до ${POOL_LIMIT} незакреплённых элементов; итоговые первые 100 сохраняются в топ.</span></div><button class="oc-discovery-button primary" id="oc-add-top-candidates" ${candidates.length ? '' : 'disabled'}>Добавить в топ‑100</button></div>
      <div class="oc-top100-pin-box"><div class="oc-collection-editor-head"><div><div class="oc-section-label">точные позиции</div><h3>Закрепления</h3></div></div>
        <div class="oc-top100-pin-search"><input id="oc-top-pin-search" value="${esc(state.query)}" placeholder="Найти OP/ED для закрепления…" autocomplete="off"><input id="oc-top-pin-rank" type="number" min="1" max="100" value="1"><span>место</span></div>
        <div class="oc-top100-pin-results">${pinSearch().map(entry => `<button type="button" data-pin-track="${esc(entry.id)}">${meta().candidates.includes(String(entry.id)) ? '<b>кандидат</b>' : ''}<span>${esc(entry.title)}</span></button>`).join('')}</div>
        <div class="oc-top100-pins">${pins.map(pin => `<div><span><b>№${pin.rank}</b> ${esc(map.get(String(pin.id))?.title || pin.id)}</span><button type="button" data-unpin-track="${esc(pin.id)}">Открепить</button></div>`).join('') || '<div class="oc-discovery-meta">Закреплений пока нет.</div>'}</div>
      </div>${bodyMarkup()}`;
  }

  async function savePins(nextPins) {
    state.busy = true;
    try { await bridge()?.saveTopPins?.(state.type, nextPins); }
    finally { state.busy = false; render(); }
  }

  document.addEventListener('click', async event => {
    const root = event.target.closest('#oc-profile-top-duel');
    if (!root || state.busy) return;
    if (event.target.closest('#oc-profile-duel-start')) return start();
    if (event.target.closest('#oc-profile-duel-resume')) return resumeDraft();
    if (event.target.closest('#oc-profile-duel-discard')) return discardDraft();
    if (event.target.closest('#oc-profile-duel-save-exit')) return saveAndExit();
    if (event.target.closest('#oc-profile-duel-stage-two')) return beginStageTwo();
    const open = event.target.closest('[data-profile-duel-open]');
    if (open) {
      bridge()?.openTrack?.(open.dataset.profileDuelOpen);
      return;
    }
    if (event.target.closest('#oc-profile-duel-save')) {
      if (!state.duel?.complete || state.duel.stage !== 2) return;
      state.busy = true;
      try {
        await bridge()?.saveDuelRanks?.(state.type, finalOrder());
        clearDraft();
        state.duel = null;
        state.notice = 'Топ‑100 сохранён.';
      } finally { state.busy = false; render(); }
      return;
    }
    if (event.target.closest('#oc-add-top-candidates')) {
      state.busy = true;
      try { await bridge()?.addTopCandidates?.(state.type); }
      finally { state.busy = false; render(); }
      return;
    }
    const choice = event.target.closest('[data-profile-duel-choice]');
    if (choice) return choose(choice.dataset.profileDuelChoice);
    const pin = event.target.closest('[data-pin-track]');
    if (pin) {
      const rank = Math.max(1, Math.min(100, Math.round(Number(root.querySelector('#oc-top-pin-rank')?.value) || 1)));
      const next = meta().pins.filter(item => item.rank !== rank && String(item.id) !== String(pin.dataset.pinTrack));
      next.push({ id:String(pin.dataset.pinTrack), rank });
      return void savePins(next);
    }
    const unpin = event.target.closest('[data-unpin-track]');
    if (unpin) return void savePins(meta().pins.filter(item => String(item.id) !== String(unpin.dataset.unpinTrack)));
  });

  document.addEventListener('change', event => {
    if (event.target.id === 'oc-profile-duel-type') { state.type = event.target.value === 'ED' ? 'ED' : 'OP'; state.duel = null; state.query = ''; state.notice = ''; render(); }
    if (event.target.id === 'oc-profile-duel-mode') { state.mode = event.target.value === 'refine' ? 'refine' : 'new'; state.duel = null; state.notice = ''; render(); }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'oc-top-pin-search') {
      state.query = event.target.value;
      const selection = [event.target.selectionStart, event.target.selectionEnd];
      render();
      const input = document.querySelector('#oc-top-pin-search');
      input?.focus({ preventScroll:true });
      input?.setSelectionRange?.(...selection);
    }
  });
  window.addEventListener('beforeunload', () => persistDraft());
  window.addEventListener('oped:app-data-updated', render);
  window.addEventListener('oped:profile-top-open', render);
  document.querySelector('#oc-profile-user')?.addEventListener('change', () => { state.duel = null; state.notice = ''; render(); });
  render();
})();