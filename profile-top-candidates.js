(() => {
  if (window.__OC_PROFILE_TOP_CANDIDATES_READY__) return;
  window.__OC_PROFILE_TOP_CANDIDATES_READY__ = true;

  const LIMIT = 150;
  const state = {
    type: 'OP',
    query: '',
    expanded: false,
    busy: false,
    renderTimer: 0,
    bridgePatched: false,
    dbPatched: false,
    replacementResolve: null
  };

  const clean = value => String(value ?? '').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const norm = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const natural = new Intl.Collator(['ru', 'en'], { numeric: true, sensitivity: 'base' });
  const bridge = () => window.OC_APP_BRIDGE;
  const snapshot = () => bridge()?.snapshot?.() || window.OC_APP_DATA || {};
  const entries = () => Array.isArray(snapshot().entries) ? snapshot().entries : [];
  const currentUser = () => clean(snapshot().currentUser?.nickname || document.querySelector('#oc-myname')?.value);
  const viewedUser = () => clean(document.querySelector('#oc-profile-user')?.value || currentUser());
  const ownProfile = () => Boolean(currentUser() && norm(currentUser()) === norm(viewedUser()));
  const cleanType = type => type === 'ED' ? 'ED' : 'OP';
  const candidateIds = type => Array.from(new Set((bridge()?.top100Meta?.(cleanType(type))?.candidates || []).map(String).filter(Boolean)));

  function ensureStyles() {
    if (document.querySelector('#oc-profile-top-candidates-style')) return;
    const style = document.createElement('style');
    style.id = 'oc-profile-top-candidates-style';
    style.textContent = `
      #oc-profile-top-candidates.oc-profile-section-hidden{display:none!important}
      .oc-top-candidates-details{margin:0 0 14px;border:1px solid #30283a;border-radius:16px;background:#100d16;overflow:hidden}
      .oc-top-candidates-details>summary{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:62px;padding:13px 16px;cursor:pointer;list-style:none;user-select:none}
      .oc-top-candidates-details>summary::-webkit-details-marker{display:none}
      .oc-top-candidates-details>summary::after{content:'▾';color:#8f879b;font-size:18px;transition:transform .18s ease}
      .oc-top-candidates-details[open]>summary::after{transform:rotate(180deg)}
      .oc-top-candidates-summary-copy{display:grid;gap:3px;min-width:0}
      .oc-top-candidates-summary-copy strong{font-size:15px;color:#f5f3fa}
      .oc-top-candidates-summary-copy span{color:#8f879b;font:10px 'Space Mono',monospace}
      .oc-top-candidates-summary-counts{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
      .oc-top-candidates-summary-counts b{display:inline-flex;align-items:center;min-height:28px;padding:5px 9px;border:1px solid #352d40;border-radius:999px;background:#0d0b12;color:#c9c2d2;font:800 10px 'Space Mono',monospace}
      .oc-top-candidates-summary-counts b.full{border-color:rgba(255,184,77,.45);color:#ffbf69}
      .oc-top-candidates-body{padding:0 14px 14px;border-top:1px solid #292230}
      .oc-top-candidates-toolbar{display:grid;grid-template-columns:auto minmax(180px,1fr) auto;gap:9px;align-items:center;padding:13px 0}
      .oc-top-candidates-tabs{display:flex;gap:5px}.oc-top-candidates-tabs button,.oc-top-candidates-remove,.oc-top-candidate-replace-row button{border:1px solid #352d40;border-radius:9px;background:#17131e;color:#d9d4e2;cursor:pointer;font:800 10px 'Space Mono',monospace}
      .oc-top-candidates-tabs button{min-width:66px;min-height:38px;padding:7px 11px}.oc-top-candidates-tabs button.active{border-color:rgba(8,217,214,.58);background:rgba(8,217,214,.08);color:#08d9d6}
      .oc-top-candidates-search{width:100%;min-height:40px;border:1px solid #352d40;border-radius:10px;background:#0d0b12;color:#f5f3fa;padding:9px 11px;outline:none}
      .oc-top-candidates-search:focus{border-color:#71617f;box-shadow:0 0 0 3px rgba(113,97,127,.12)}
      .oc-top-candidates-limit{color:#8f879b;font:800 10px 'Space Mono',monospace;white-space:nowrap}.oc-top-candidates-limit.full{color:#ffbf69}.oc-top-candidates-limit.over{color:#ff5f86}
      .oc-top-candidates-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:560px;overflow:auto;padding-right:3px}
      .oc-top-candidate-row{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:76px;padding:8px;border:1px solid #2d2635;border-radius:11px;background:#0d0b12}
      .oc-top-candidate-row img,.oc-top-candidate-image-empty{display:block;width:58px;height:58px;border-radius:8px;object-fit:cover;background:#17131e}
      .oc-top-candidate-image-empty{display:grid;place-items:center;color:#655b70;font:800 11px 'Space Mono',monospace}
      .oc-top-candidate-copy{display:grid;gap:4px;min-width:0}.oc-top-candidate-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f5f3fa;font-size:12px}.oc-top-candidate-copy span{color:#8f879b;font:10px 'Space Mono',monospace}
      .oc-top-candidate-copy em{color:#b7afc1;font:700 10px 'Space Mono',monospace;font-style:normal}
      .oc-top-candidates-remove{min-height:36px;padding:7px 10px}.oc-top-candidates-remove:hover{border-color:rgba(255,95,134,.55);color:#ff7b9d;background:rgba(255,95,134,.06)}.oc-top-candidates-remove:disabled{opacity:.45;cursor:wait}
      .oc-top-candidates-empty{grid-column:1/-1;padding:20px;border:1px dashed #352d40;border-radius:11px;color:#8f879b;text-align:center;font-size:12px}
      .oc-top-candidate-replace-modal{position:fixed;inset:0;z-index:620;display:flex;align-items:flex-start;justify-content:center;padding:88px 16px 24px;background:rgba(5,4,8,.86);backdrop-filter:blur(8px);overflow:auto}
      .oc-top-candidate-replace-dialog{position:relative;width:min(900px,100%);padding:20px;border:1px solid #342c3d;border-radius:18px;background:#100d16;color:#f5f3fa;box-shadow:0 30px 90px rgba(0,0,0,.55)}
      .oc-top-candidate-replace-close{position:absolute;right:12px;top:9px;width:38px;height:38px;border:0;background:transparent;color:#8f879b;font-size:28px;cursor:pointer}
      .oc-top-candidate-replace-dialog h2{margin:0 44px 5px 0;font-size:23px}.oc-top-candidate-replace-dialog>p{margin:0 44px 15px 0;color:#8f879b;font-size:12px}
      .oc-top-candidate-replace-new{display:grid;grid-template-columns:54px minmax(0,1fr);gap:10px;align-items:center;margin-bottom:12px;padding:9px;border:1px solid rgba(8,217,214,.28);border-radius:11px;background:rgba(8,217,214,.045)}
      .oc-top-candidate-replace-new img,.oc-top-candidate-replace-new span:first-child{width:54px;height:54px;border-radius:8px;object-fit:cover;background:#17131e}.oc-top-candidate-replace-new span:first-child{display:grid;place-items:center;color:#08d9d6}
      .oc-top-candidate-replace-new strong{display:block;margin-bottom:3px}.oc-top-candidate-replace-new small{color:#8f879b}
      .oc-top-candidate-replace-search{width:100%;min-height:42px;margin-bottom:10px;border:1px solid #352d40;border-radius:10px;background:#0d0b12;color:#f5f3fa;padding:9px 11px;outline:none}
      .oc-top-candidate-replace-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:520px;overflow:auto}
      .oc-top-candidate-replace-row{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:9px;align-items:center;padding:7px;border:1px solid #2d2635;border-radius:10px;background:#0d0b12}
      .oc-top-candidate-replace-row img,.oc-top-candidate-replace-row .empty{width:48px;height:48px;border-radius:7px;object-fit:cover;background:#17131e}.oc-top-candidate-replace-row .empty{display:grid;place-items:center;color:#655b70}
      .oc-top-candidate-replace-row>span{display:grid;gap:3px;min-width:0}.oc-top-candidate-replace-row strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.oc-top-candidate-replace-row small{color:#8f879b;font:9px 'Space Mono',monospace}
      .oc-top-candidate-replace-row button{min-height:34px;padding:6px 9px}.oc-top-candidate-replace-row button:hover{border-color:rgba(8,217,214,.55);color:#08d9d6}
      @media(max-width:760px){.oc-top-candidates-details>summary{align-items:flex-start;flex-wrap:wrap}.oc-top-candidates-summary-counts{margin-left:0}.oc-top-candidates-toolbar{grid-template-columns:1fr}.oc-top-candidates-tabs{width:100%}.oc-top-candidates-tabs button{flex:1}.oc-top-candidates-list,.oc-top-candidate-replace-list{grid-template-columns:1fr}.oc-top-candidate-replace-modal{padding:72px 8px 10px}.oc-top-candidate-replace-dialog{padding:17px 10px}.oc-top-candidate-row{grid-template-columns:52px minmax(0,1fr) auto}.oc-top-candidate-row img,.oc-top-candidate-image-empty{width:52px;height:52px}}
    `;
    document.head.append(style);
  }

  function toast(message, type = '') {
    window.OC_TOAST?.show?.(message, { type });
    const status = document.querySelector('#oc-status');
    if (status) status.textContent = message;
  }

  function rowForCurrentUser() {
    const rows = snapshot().manualRanks || {};
    const user = currentUser();
    const key = norm(user);
    return rows[user] || rows[key] || Object.values(rows).find(row => norm(row?.nickname || row?.nicknameKey || row?.displayName) === key) || {};
  }

  function scoreFor(entry) {
    const scores = entry?.scores || {};
    const user = currentUser();
    const direct = Number(scores[user]);
    if (Number.isFinite(direct)) return direct;
    const key = Object.keys(scores).find(name => norm(name) === norm(user));
    const value = Number(key ? scores[key] : NaN);
    return Number.isFinite(value) ? value : null;
  }

  function currentTop(type) {
    const row = rowForCurrentUser();
    const field = cleanType(type);
    const values = row[field] || row[`manual${field}`] || [];
    return Array.from(new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))).slice(0, 100);
  }

  function candidateRows(type) {
    const map = new Map(entries().map(entry => [String(entry.id), entry]));
    const positions = new Map(currentTop(type).map((id, index) => [String(id), index + 1]));
    return candidateIds(type).map(id => {
      const entry = map.get(String(id)) || { id, title: id, type: cleanType(type) };
      return { id:String(id), entry, score:scoreFor(entry), position:positions.get(String(id)) || null };
    }).sort((left, right) => {
      if (Boolean(left.position) !== Boolean(right.position)) return Number(Boolean(left.position)) - Number(Boolean(right.position));
      const leftScore = left.score === null ? Number.POSITIVE_INFINITY : left.score;
      const rightScore = right.score === null ? Number.POSITIVE_INFINITY : right.score;
      if (leftScore !== rightScore) return leftScore - rightScore;
      return natural.compare(clean(left.entry.title), clean(right.entry.title));
    });
  }

  function imageMarkup(entry, className = '') {
    const image = clean(entry?.fallbackImage || entry?.image);
    return image
      ? `<img class="${className}" src="${esc(image)}" alt="" loading="lazy" decoding="async">`
      : `<span class="${className || 'empty'}">${esc(entry?.type || '—')}</span>`;
  }

  function ensureRoot() {
    const profile = document.querySelector('#oc-profile-panel');
    if (!profile) return null;
    let root = profile.querySelector('#oc-profile-top-candidates');
    if (!root) {
      root = document.createElement('section');
      root.id = 'oc-profile-top-candidates';
    }
    const duel = profile.querySelector('#oc-profile-top-duel');
    const columns = profile.querySelector('.oc-profile-columns');
    if (duel && root.nextElementSibling !== duel) duel.before(root);
    else if (!duel && columns && root.nextElementSibling !== columns) columns.before(root);
    else if (!root.isConnected) profile.append(root);
    return root;
  }

  function candidateListMarkup(type) {
    const query = norm(state.query);
    const rows = candidateRows(type).filter(row => !query || norm([
      row.entry.title,
      ...(Array.isArray(row.entry.alternativeTitles) ? row.entry.alternativeTitles : []),
      row.entry.anime
    ].join(' ')).includes(query));
    if (!rows.length) return `<div class="oc-top-candidates-empty">${candidateIds(type).length ? 'Поиск ничего не нашёл.' : `Кандидатов ${type} пока нет.`}</div>`;
    return rows.map(row => `<article class="oc-top-candidate-row" data-candidate-id="${esc(row.id)}">
      ${imageMarkup(row.entry, row.entry?.fallbackImage || row.entry?.image ? '' : 'oc-top-candidate-image-empty')}
      <div class="oc-top-candidate-copy"><strong title="${esc(row.entry.title || row.id)}">${esc(row.entry.title || row.id)}</strong><span>${row.position ? `сейчас №${row.position} в топе` : 'сейчас вне топ-100'}</span><em>${row.score === null ? 'оценка —' : `оценка ${row.score}`}</em></div>
      <button type="button" class="oc-top-candidates-remove" data-remove-top-candidate="${esc(row.id)}" data-type="${type}">Удалить</button>
    </article>`).join('');
  }

  function render() {
    ensureStyles();
    const root = ensureRoot();
    if (!root) return;
    const topView = document.querySelector('#oc-profile-panel')?.dataset.profileView === 'top100';
    root.classList.toggle('oc-profile-section-hidden', !topView || !ownProfile());
    if (!topView || !ownProfile()) return;

    const opCount = candidateIds('OP').length;
    const edCount = candidateIds('ED').length;
    const currentCount = state.type === 'ED' ? edCount : opCount;
    const countClass = currentCount > LIMIT ? 'over' : currentCount === LIMIT ? 'full' : '';
    root.innerHTML = `<details class="oc-top-candidates-details" ${state.expanded ? 'open' : ''}>
      <summary><span class="oc-top-candidates-summary-copy"><strong>Все кандидаты в топ-100</strong><span>Список свёрнут изначально · максимум ${LIMIT} отдельно для OP и ED</span></span><span class="oc-top-candidates-summary-counts"><b class="${opCount >= LIMIT ? 'full' : ''}">OP ${opCount}/${LIMIT}</b><b class="${edCount >= LIMIT ? 'full' : ''}">ED ${edCount}/${LIMIT}</b></span></summary>
      <div class="oc-top-candidates-body"><div class="oc-top-candidates-toolbar"><div class="oc-top-candidates-tabs"><button type="button" data-candidate-type="OP" class="${state.type === 'OP' ? 'active' : ''}">OP</button><button type="button" data-candidate-type="ED" class="${state.type === 'ED' ? 'active' : ''}">ED</button></div><input class="oc-top-candidates-search" type="search" value="${esc(state.query)}" placeholder="Найти кандидата…" autocomplete="off"><span class="oc-top-candidates-limit ${countClass}">${currentCount}/${LIMIT}</span></div><div class="oc-top-candidates-list">${candidateListMarkup(state.type)}</div></div>
    </details>`;
    const details = root.querySelector('details');
    details?.addEventListener('toggle', () => { state.expanded = details.open; });
  }

  function queueRender(delay = 0) {
    window.clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(render, delay);
  }

  function openCandidates(type) {
    state.type = cleanType(type);
    state.expanded = true;
    state.query = '';
    render();
    document.querySelector('#oc-profile-top-candidates')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function closeReplacement(value = null) {
    document.querySelector('.oc-top-candidate-replace-modal')?.remove();
    const resolve = state.replacementResolve;
    state.replacementResolve = null;
    if (resolve) resolve(value);
  }

  function replacementRowsMarkup(type, query = '') {
    const normalized = norm(query);
    const rows = candidateRows(type).filter(row => !normalized || norm([
      row.entry.title,
      ...(Array.isArray(row.entry.alternativeTitles) ? row.entry.alternativeTitles : []),
      row.entry.anime
    ].join(' ')).includes(normalized));
    if (!rows.length) return '<div class="oc-top-candidates-empty">Ничего не найдено.</div>';
    return rows.map(row => `<div class="oc-top-candidate-replace-row">
      ${imageMarkup(row.entry, row.entry?.fallbackImage || row.entry?.image ? '' : 'empty')}
      <span><strong title="${esc(row.entry.title || row.id)}">${esc(row.entry.title || row.id)}</strong><small>${row.position ? `№${row.position} в топе` : 'вне топа'} · ${row.score === null ? 'оценка —' : `оценка ${row.score}`}</small></span>
      <button type="button" data-replace-top-candidate="${esc(row.id)}">Заменить</button>
    </div>`).join('');
  }

  function chooseReplacement(newId, type) {
    closeReplacement(null);
    const map = new Map(entries().map(entry => [String(entry.id), entry]));
    const entry = map.get(String(newId)) || { id:newId, title:newId, type:cleanType(type) };
    const modal = document.createElement('div');
    modal.className = 'oc-top-candidate-replace-modal';
    modal.innerHTML = `<div class="oc-top-candidate-replace-dialog"><button type="button" class="oc-top-candidate-replace-close" aria-label="Закрыть">×</button><h2>Лимит кандидатов достигнут</h2><p>Для ${cleanType(type)} уже выбрано ${LIMIT} кандидатов. Выбери один вариант, который нужно заменить новым.</p><div class="oc-top-candidate-replace-new">${imageMarkup(entry)}<div><strong>${esc(entry.title || newId)}</strong><small>Новый кандидат</small></div></div><input class="oc-top-candidate-replace-search" type="search" placeholder="Найти кандидата для замены…" autocomplete="off"><div class="oc-top-candidate-replace-list">${replacementRowsMarkup(type)}</div></div>`;
    document.body.append(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.oc-top-candidate-replace-close')) closeReplacement(null);
      const replace = event.target.closest('[data-replace-top-candidate]');
      if (replace) closeReplacement(String(replace.dataset.replaceTopCandidate));
    });
    const search = modal.querySelector('.oc-top-candidate-replace-search');
    search?.addEventListener('input', () => {
      modal.querySelector('.oc-top-candidate-replace-list').innerHTML = replacementRowsMarkup(type, search.value);
    });
    window.setTimeout(() => search?.focus(), 0);
    return new Promise(resolve => { state.replacementResolve = resolve; });
  }

  function patchBridge() {
    const appBridge = bridge();
    if (!appBridge?.toggleTopCandidate) return false;
    if (appBridge.__ocTopCandidateLimitPatched) {
      state.bridgePatched = true;
      return true;
    }
    const originalToggle = appBridge.toggleTopCandidate.bind(appBridge);
    appBridge.__ocTopCandidateLimitPatched = true;
    appBridge.__ocOriginalToggleTopCandidate = originalToggle;
    appBridge.topCandidateLimit = LIMIT;
    appBridge.toggleTopCandidate = async (id, type) => {
      const candidateId = String(id || '');
      const candidateType = cleanType(type);
      const before = candidateIds(candidateType);
      if (before.includes(candidateId)) return originalToggle(candidateId, candidateType);
      if (before.length > LIMIT) {
        openCandidates(candidateType);
        throw new Error(`Сейчас выбрано ${before.length} кандидатов ${candidateType}. Сначала удали лишние варианты до лимита ${LIMIT}.`);
      }
      if (before.length < LIMIT) return originalToggle(candidateId, candidateType);
      const replacementId = await chooseReplacement(candidateId, candidateType);
      if (!replacementId) return false;
      if (state.busy) throw new Error('Замена кандидата уже выполняется.');
      state.busy = true;
      try {
        const latest = candidateIds(candidateType);
        if (latest.includes(candidateId)) return true;
        if (latest.length < LIMIT) return originalToggle(candidateId, candidateType);
        if (!latest.includes(replacementId)) throw new Error('Выбранный кандидат уже удалён. Попробуй ещё раз.');
        await originalToggle(replacementId, candidateType);
        try {
          const active = await originalToggle(candidateId, candidateType);
          toast(`Кандидат заменён: ${clean(entries().find(entry => String(entry.id) === replacementId)?.title || replacementId)} → ${clean(entries().find(entry => String(entry.id) === candidateId)?.title || candidateId)}`, 'success');
          return active;
        } catch (error) {
          try { await originalToggle(replacementId, candidateType); } catch (_) {}
          throw error;
        }
      } finally {
        state.busy = false;
        queueRender(0);
      }
    };
    state.bridgePatched = true;
    return true;
  }

  function patchDb() {
    const db = window.OPED_DB;
    if (!db?.saveManualRanks) return false;
    if (db.__ocTopCandidateLimitPatched) {
      state.dbPatched = true;
      return true;
    }
    const originalSave = db.saveManualRanks.bind(db);
    db.__ocTopCandidateLimitPatched = true;
    db.saveManualRanks = (nickname, ranks) => {
      const next = { ...(ranks || {}) };
      for (const field of ['candidatesOP', 'candidatesED']) {
        if (!Array.isArray(next[field])) continue;
        next[field] = Array.from(new Set(next[field].map(String).filter(Boolean)));
        if (next[field].length > LIMIT) throw new Error(`Максимум ${LIMIT} кандидатов отдельно для OP и ED.`);
      }
      return originalSave(nickname, next);
    };
    state.dbPatched = true;
    return true;
  }

  function syncActiveType() {
    const active = document.querySelector('.oc-profile-top-type-btn.active')?.dataset.type;
    if (active === 'OP' || active === 'ED') state.type = active;
  }

  document.addEventListener('click', async event => {
    const typeButton = event.target.closest('[data-candidate-type]');
    if (typeButton) {
      state.type = cleanType(typeButton.dataset.candidateType);
      state.query = '';
      render();
      return;
    }
    const remove = event.target.closest('[data-remove-top-candidate]');
    if (remove && !state.busy) {
      const id = String(remove.dataset.removeTopCandidate || '');
      const type = cleanType(remove.dataset.type);
      remove.disabled = true;
      try {
        await bridge()?.toggleTopCandidate?.(id, type);
        toast('Кандидат удалён. Оценка и место в сохранённом топе не изменены.', 'success');
      } catch (error) {
        toast(error?.message || 'Не удалось удалить кандидата.', 'error');
      } finally {
        remove.disabled = false;
        queueRender(0);
      }
      return;
    }
    if (event.target.closest('.oc-profile-top-type-btn')) window.setTimeout(() => { syncActiveType(); queueRender(0); }, 0);
  });

  document.addEventListener('input', event => {
    if (!event.target.matches('.oc-top-candidates-search')) return;
    state.query = event.target.value;
    const selection = [event.target.selectionStart, event.target.selectionEnd];
    render();
    const input = document.querySelector('.oc-top-candidates-search');
    input?.focus({ preventScroll:true });
    input?.setSelectionRange?.(...selection);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('.oc-top-candidate-replace-modal')) closeReplacement(null);
  });

  window.addEventListener('oped-db-ready', () => { patchDb(); patchBridge(); queueRender(0); });
  window.addEventListener('oped:app-data-updated', () => { patchBridge(); queueRender(20); });
  window.addEventListener('oped:profile-top-open', () => { syncActiveType(); queueRender(0); });
  window.addEventListener('oped-account-restored', () => queueRender(0));
  document.querySelector('#oc-profile-user')?.addEventListener('change', () => { state.expanded = false; state.query = ''; queueRender(0); });

  const profile = document.querySelector('#oc-profile-panel');
  if (profile) {
    new MutationObserver(() => {
      patchBridge();
      if (profile.dataset.profileView === 'top100') queueRender(20);
    }).observe(profile, { childList:true, subtree:false, attributes:true, attributeFilter:['data-profile-view','class'] });
  }

  let attempts = 0;
  const boot = () => {
    attempts += 1;
    patchDb();
    patchBridge();
    queueRender(0);
    if ((!state.dbPatched || !state.bridgePatched) && attempts < 120) window.setTimeout(boot, 100);
  };
  ensureStyles();
  boot();
})();