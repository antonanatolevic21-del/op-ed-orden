(() => {
  if (window.__OC_PROFILE_TOP_DUEL_READY__) return;
  window.__OC_PROFILE_TOP_DUEL_READY__ = true;

  const state = { type: 'OP', mode: 'new', duel: null, query: '', busy: false };
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
    const rated = entries()
      .filter(entry => entry.type === state.type && score(entry) !== null)
      .sort((a, b) => score(b) - score(a) || compareNatural(a.title, b.title))
      .map(entry => String(entry.id));
    const pins = new Set(meta().pins.map(pin => String(pin.id)));
    return Array.from(new Set([...candidateIds, ...rated])).filter(id => !pins.has(id)).slice(0, 100);
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

  function start() {
    const candidates = pool();
    if (candidates.length < 2) {
      state.duel = { error: `Нужно хотя бы два незакреплённых ${state.type}.` };
      render();
      return;
    }
    const old = existingOrder().filter(id => candidates.includes(id));
    if (state.mode === 'refine' && old.length >= 2) {
      state.duel = { mode:'refine', order:[...old, ...candidates.filter(id => !old.includes(id))], pairIndex:0, comparisons:0 };
    } else {
      state.duel = { mode:'new', candidates, order:[candidates[0]], candidateIndex:1, candidate:candidates[1], low:0, high:1, comparisons:0 };
    }
    render();
  }

  function choose(choice) {
    const duel = state.duel;
    if (!duel || duel.complete) return;
    duel.comparisons += 1;
    if (duel.mode === 'refine') {
      if (choice === 'right') [duel.order[duel.pairIndex], duel.order[duel.pairIndex + 1]] = [duel.order[duel.pairIndex + 1], duel.order[duel.pairIndex]];
      duel.pairIndex += 1;
      if (duel.pairIndex >= duel.order.length - 1) duel.complete = true;
      render();
      return;
    }
    const mid = Math.floor((duel.low + duel.high) / 2);
    if (choice === 'left') duel.high = mid;
    else if (choice === 'right') duel.low = mid + 1;
    else if (choice === 'tie') duel.low = duel.high = Math.min(duel.order.length, mid + 1);
    else duel.low = duel.high = duel.order.length;
    if (duel.low < duel.high) return render();
    duel.order.splice(duel.low, 0, duel.candidate);
    duel.candidateIndex += 1;
    if (duel.candidateIndex >= duel.candidates.length) duel.complete = true;
    else {
      duel.candidate = duel.candidates[duel.candidateIndex];
      duel.low = 0;
      duel.high = duel.order.length;
    }
    render();
  }

  function finalOrder() {
    const duel = state.duel;
    if (!duel?.order) return existingOrder();
    const unfinished = duel.mode === 'new'
      ? [...duel.order, ...(duel.candidate && !duel.order.includes(duel.candidate) ? [duel.candidate] : []), ...(duel.candidates || []).slice(duel.candidateIndex + 1)]
      : duel.order;
    return applyPins(unfinished);
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

  function bodyMarkup() {
    const duel = state.duel;
    if (!duel) return '<div class="oc-discovery-empty">Закрепи бесспорные позиции, затем запускай дуэль. Кандидаты попадут в пул первыми.</div>';
    if (duel.error) return `<div class="oc-discovery-empty">${esc(duel.error)}</div>`;
    if (duel.complete) {
      const map = byId();
      return `<div class="oc-discovery-list"><h4>Черновой порядок готов · ${finalOrder().length} позиций</h4>${finalOrder().slice(0, 20).map((id, i) => `<div class="oc-discovery-row"><button type="button" data-profile-duel-open="${esc(id)}">${i + 1}. ${esc(map.get(id)?.title || id)}</button><span>${meta().pins.some(pin => String(pin.id) === id) ? 'закреплено' : ''}</span></div>`).join('')}</div>`;
    }
    const progress = duel.mode === 'new' ? Math.round(duel.candidateIndex / duel.candidates.length * 100) : Math.round(duel.pairIndex / Math.max(1, duel.order.length - 1) * 100);
    const left = duel.mode === 'new' ? duel.candidate : duel.order[duel.pairIndex];
    const right = duel.mode === 'new' ? duel.order[Math.floor((duel.low + duel.high) / 2)] : duel.order[duel.pairIndex + 1];
    return `<div class="oc-duel-progress"><i style="width:${progress}%"></i></div><div class="oc-discovery-meta">${progress}% · сравнений ${duel.comparisons}</div>
      <div class="oc-duel-stage">${card(left, 'left')}<div class="oc-duel-vs">VS</div>${card(right, 'right')}</div>
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
    root.innerHTML = `<div class="oc-discovery-head"><div><div class="oc-section-label">мой топ‑100</div><h3>Дуэльное ранжирование</h3><p>Закреплённые треки остаются на точных местах и не участвуют в сравнениях. Кандидаты всегда получают приоритет.</p></div></div>
      <div class="oc-duel-controls">
        <div><select class="oc-discovery-control" id="oc-profile-duel-type"><option value="OP" ${state.type === 'OP' ? 'selected' : ''}>OP</option><option value="ED" ${state.type === 'ED' ? 'selected' : ''}>ED</option></select>
        <select class="oc-discovery-control" id="oc-profile-duel-mode"><option value="new" ${state.mode === 'new' ? 'selected' : ''}>Собрать заново</option><option value="refine" ${state.mode === 'refine' ? 'selected' : ''}>Уточнить текущий</option></select></div>
        <div><button class="oc-discovery-button" id="oc-profile-duel-start">Начать дуэль</button><button class="oc-discovery-button primary" id="oc-profile-duel-save" ${state.duel?.order ? '' : 'disabled'}>Сохранить порядок</button></div>
      </div>
      <div class="oc-top100-candidate-bar"><div><strong>Кандидаты: ${candidates.length}</strong><span>Сначала добавятся они, затем текущий топ; всё после №100 будет отброшено.</span></div><button class="oc-discovery-button primary" id="oc-add-top-candidates" ${candidates.length ? '' : 'disabled'}>Добавить в топ‑100</button></div>
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
    const open = event.target.closest('[data-profile-duel-open]');
    if (open) {
      bridge()?.openTrack?.(open.dataset.profileDuelOpen);
      return;
    }
    if (event.target.closest('#oc-profile-duel-save')) {
      state.busy = true;
      try { await bridge()?.saveDuelRanks?.(state.type, finalOrder()); state.duel = null; }
      finally { state.busy = false; render(); }
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
    if (event.target.id === 'oc-profile-duel-type') { state.type = event.target.value === 'ED' ? 'ED' : 'OP'; state.duel = null; state.query = ''; render(); }
    if (event.target.id === 'oc-profile-duel-mode') { state.mode = event.target.value === 'refine' ? 'refine' : 'new'; state.duel = null; render(); }
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
  window.addEventListener('oped:app-data-updated', render);
  window.addEventListener('oped:profile-top-open', render);
  document.querySelector('#oc-profile-user')?.addEventListener('change', () => { state.duel = null; render(); });
  render();
})();
