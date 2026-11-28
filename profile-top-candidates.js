(() => {
  if (window.__OC_PROFILE_TOP_CANDIDATES_READY__) return;
  window.__OC_PROFILE_TOP_CANDIDATES_READY__ = true;

  const state = {
    type: 'OP',
    query: '',
    expanded: false,
    addingTens: false,
    renderTimer: 0,
    bridgePatched: false,
    dbPatched: false
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
      
      .oc-top-candidates-body{padding:0 14px 14px;border-top:1px solid #292230}
      .oc-top-candidates-add-tens{margin:0 0 12px;min-height:40px;padding:9px 12px;border:1px solid rgba(8,217,214,.45);border-radius:9px;background:rgba(8,217,214,.08);color:#08d9d6;cursor:pointer;font:800 11px 'Space Mono',monospace}
      .oc-top-candidates-add-tens:disabled{opacity:.5;cursor:wait}
      .oc-top-candidates-toolbar{display:grid;grid-template-columns:auto minmax(180px,1fr) auto;gap:9px;align-items:center;padding:13px 0}
      .oc-top-candidates-tabs{display:flex;gap:5px}.oc-top-candidates-tabs button,.oc-top-candidates-remove{border:1px solid #352d40;border-radius:9px;background:#17131e;color:#d9d4e2;cursor:pointer;font:800 10px 'Space Mono',monospace}
      .oc-top-candidates-tabs button{min-width:66px;min-height:38px;padding:7px 11px}.oc-top-candidates-tabs button.active{border-color:rgba(8,217,214,.58);background:rgba(8,217,214,.08);color:#08d9d6}
      .oc-top-candidates-search{width:100%;min-height:40px;border:1px solid #352d40;border-radius:10px;background:#0d0b12;color:#f5f3fa;padding:9px 11px;outline:none}
      .oc-top-candidates-search:focus{border-color:#71617f;box-shadow:0 0 0 3px rgba(113,97,127,.12)}
      .oc-top-candidates-limit{color:#8f879b;font:800 10px 'Space Mono',monospace;white-space:nowrap}
      .oc-top-candidates-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:560px;overflow:auto;padding-right:3px}
      .oc-top-candidate-row{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:76px;padding:8px;border:1px solid #2d2635;border-radius:11px;background:#0d0b12}
      .oc-top-candidate-row img,.oc-top-candidate-image-empty{display:block;width:58px;height:58px;border-radius:8px;object-fit:cover;background:#17131e}
      .oc-top-candidate-image-empty{display:grid;place-items:center;color:#655b70;font:800 11px 'Space Mono',monospace}
      .oc-top-candidate-copy{display:grid;gap:4px;min-width:0}.oc-top-candidate-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f5f3fa;font-size:12px}.oc-top-candidate-copy span{color:#8f879b;font:10px 'Space Mono',monospace}
      .oc-top-candidate-copy em{color:#b7afc1;font:700 10px 'Space Mono',monospace;font-style:normal}
      .oc-top-candidates-remove{min-height:36px;padding:7px 10px}.oc-top-candidates-remove:hover{border-color:rgba(255,95,134,.55);color:#ff7b9d;background:rgba(255,95,134,.06)}.oc-top-candidates-remove:disabled{opacity:.45;cursor:wait}
      .oc-top-candidates-empty{grid-column:1/-1;padding:20px;border:1px dashed #352d40;border-radius:11px;color:#8f879b;text-align:center;font-size:12px}
      @media(max-width:760px){.oc-top-candidates-details>summary{align-items:flex-start;flex-wrap:wrap}.oc-top-candidates-summary-counts{margin-left:0}.oc-top-candidates-toolbar{grid-template-columns:1fr}.oc-top-candidates-tabs{width:100%}.oc-top-candidates-tabs button{flex:1}.oc-top-candidates-list{grid-template-columns:1fr}.oc-top-candidate-row{grid-template-columns:52px minmax(0,1fr) auto}.oc-top-candidate-row img,.oc-top-candidate-image-empty{width:52px;height:52px}}
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
    root.innerHTML = `<details class="oc-top-candidates-details" ${state.expanded ? 'open' : ''}>
      <summary><span class="oc-top-candidates-summary-copy"><strong>Все кандидаты в топ-100</strong><span>Без ограничения количества · отдельно для OP и ED</span></span><span class="oc-top-candidates-summary-counts"><b>OP ${opCount}</b><b>ED ${edCount}</b></span></summary>
      <div class="oc-top-candidates-body"><div class="oc-top-candidates-toolbar"><div class="oc-top-candidates-tabs"><button type="button" data-candidate-type="OP" class="${state.type === 'OP' ? 'active' : ''}">OP</button><button type="button" data-candidate-type="ED" class="${state.type === 'ED' ? 'active' : ''}">ED</button></div><input class="oc-top-candidates-search" type="search" value="${esc(state.query)}" placeholder="Найти кандидата…" autocomplete="off"><span class="oc-top-candidates-limit">${currentCount}</span></div><div class="oc-top-candidates-list">${candidateListMarkup(state.type)}</div></div>
    </details>`;
    root.querySelector('.oc-top-candidates-toolbar').insertAdjacentHTML('afterend', `<button type="button" class="oc-top-candidates-add-tens" data-add-ten-candidates ${state.addingTens ? 'disabled' : ''}>${state.addingTens ? 'Добавляю десятки…' : `Добавить все ${state.type} с оценкой 10 в кандидаты`}</button>`);
    const details = root.querySelector('details');
    details?.addEventListener('toggle', () => { state.expanded = details.open; });
  }

  function queueRender(delay = 0) {
    window.clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(render, delay);
  }

  function patchBridge() {
    state.bridgePatched = Boolean(bridge()?.toggleTopCandidate);
    return state.bridgePatched;
  }

  function patchDb() {
    const db = window.OPED_DB;
    if (!db?.saveManualRanks) return false;
    if (db.__ocTopCandidatesDedupPatched) {
      state.dbPatched = true;
      return true;
    }
    const originalSave = db.saveManualRanks.bind(db);
    db.__ocTopCandidatesDedupPatched = true;
    db.saveManualRanks = (nickname, ranks) => {
      const next = { ...(ranks || {}) };
      for (const field of ['candidatesOP', 'candidatesED']) {
        if (!Array.isArray(next[field])) continue;
        next[field] = Array.from(new Set(next[field].map(String).filter(Boolean)));
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
    if (event.target.closest('[data-add-ten-candidates]')) {
      if (state.addingTens || !ownProfile()) return;
      const type = state.type;
      state.addingTens = true;
      render();
      try {
        if (!bridge()?.addTenRatedCandidates) throw new Error('Обнови страницу для добавления десяток.');
        const result = await bridge().addTenRatedCandidates(type);
        toast(result.added ? `В кандидаты добавлено ${type} с оценкой 10: ${result.added}.` : result.total ? `Все твои ${type} с оценкой 10 уже в кандидатах.` : `У тебя пока нет ${type} с оценкой 10.`, 'success');
      } catch (error) {
        toast(error?.message || 'Не удалось добавить десятки в кандидаты.', 'error');
      } finally {
        state.addingTens = false;
        queueRender(0);
      }
      return;
    }
    const typeButton = event.target.closest('[data-candidate-type]');
    if (typeButton) {
      state.type = cleanType(typeButton.dataset.candidateType);
      state.query = '';
      render();
      return;
    }
    const remove = event.target.closest('[data-remove-top-candidate]');
    if (remove && !state.addingTens) {
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
