(() => {
  if (window.__OC_MANUAL_TOP_INSERT_FAST_READY__) return;
  window.__OC_MANUAL_TOP_INSERT_FAST_READY__ = true;

  const clean = value => String(value ?? '').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const normalize = value => {
    try { return window.OPED_DB?.normalizeNickname?.(value) || clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60); }
    catch (_) { return clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60); }
  };
  const viewedUser = () => clean(document.querySelector('#oc-profile-user')?.value || document.querySelector('#oc-myname')?.value);
  const activeType = () => document.querySelector('.oc-profile-top-type-btn.active')?.dataset.type === 'ED' ? 'ED' : 'OP';
  const editing = () => Boolean(document.querySelector('#oc-manual-edit-btn')?.classList.contains('active'));
  const topVisible = () => document.querySelector('#oc-profile-panel')?.dataset.profileView === 'top100';
  const containerFor = type => document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op');

  let cache = new Map();
  let panel = null;
  let panelAnchor = null;
  let mountTimer = 0;
  let hoverCard = null;
  let hoverMode = '';

  function ensureStyles() {
    if (document.querySelector('#oc-top100-inline-insert-style')) return;
    const style = document.createElement('style');
    style.id = 'oc-top100-inline-insert-style';
    style.textContent = `
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual{position:relative;margin-top:28px!important}
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual[data-top100-insert-after],
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual[data-top100-insert-after]{margin-bottom:28px!important}
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-insert-hover-before,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-insert-hover-before{margin-top:28px!important}
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-insert-hover-after,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-insert-hover-after{margin-bottom:28px!important}
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-before,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-before{margin-top:var(--oc-top100-inline-panel-gap,360px)!important}
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-after,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-after{margin-bottom:var(--oc-top100-inline-panel-gap,360px)!important}
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual::before,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual::before,
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual[data-top100-insert-after]::after,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual[data-top100-insert-after]::after{position:absolute;left:0;right:0;z-index:30;display:flex;align-items:center;justify-content:center;box-sizing:border-box;height:18px;padding:1px 8px;border:1px dashed rgba(169,155,184,.34);border-radius:9px;background:rgba(139,92,246,.035);color:#82768f;font:700 10px/1 'Space Mono',monospace;white-space:nowrap;overflow:hidden;cursor:pointer;pointer-events:auto;transition:height .16s ease,top .16s ease,bottom .16s ease,padding .16s ease,border-color .16s ease,background .16s ease,color .16s ease}
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual::before,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual::before{content:'↳  ' attr(data-top100-insert-label);top:-18px}
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual[data-top100-insert-after]::after,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual[data-top100-insert-after]::after{content:'↳  ' attr(data-top100-insert-after-label);bottom:-18px}
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-insert-hover-before::before,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-insert-hover-before::before{top:-42px;height:42px;padding:9px 12px;border-color:#08d9d6;background:rgba(8,217,214,.07);color:#08d9d6}
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-insert-hover-after::after,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-insert-hover-after::after{bottom:-42px;height:42px;padding:9px 12px;border-color:#08d9d6;background:rgba(8,217,214,.07);color:#08d9d6}
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-before::before,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-before::before,
      #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-after::after,
      #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-after::after{opacity:0;pointer-events:none}
      .oc-top100-inline-search-panel{position:relative!important;z-index:40!important;grid-column:1/-1;width:100%!important;max-width:none!important;margin:10px 0 14px!important;box-sizing:border-box}
      .oc-top100-inline-search-panel .oc-manual-insert-search{margin-top:10px}
      .oc-top100-inline-search-panel .oc-manual-insert-results{grid-template-columns:repeat(2,minmax(0,1fr));max-height:420px}
      .oc-top100-inline-search-panel-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
      .oc-top100-inline-search-panel-actions .oc-soft-btn{min-height:40px}
      @media(max-width:760px),(hover:none) and (pointer:coarse){
        #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual,
        #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual{margin-top:40px!important}
        #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual[data-top100-insert-after],
        #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual[data-top100-insert-after]{margin-bottom:40px!important}
        #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-before,
        #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-before{margin-top:var(--oc-top100-inline-panel-gap,360px)!important}
        #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-after,
        #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual.oc-top100-inline-panel-after{margin-bottom:40px!important}
        #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual::before,
        #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual::before{top:-40px;height:40px;padding:8px 10px;border-color:#4b3f58;background:rgba(139,92,246,.065);color:#a99bb8}
        #oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual[data-top100-insert-after]::after,
        #oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual[data-top100-insert-after]::after{bottom:-40px;height:40px;padding:8px 10px;border-color:#4b3f58;background:rgba(139,92,246,.065);color:#a99bb8}
        .oc-top100-inline-search-panel .oc-manual-insert-results{grid-template-columns:1fr}
      }
    `;
    document.head.append(style);
  }

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

  async function candidates(user, type) {
    const key = `${normalize(user)}|${type}`;
    if (cache.has(key)) return cache.get(key);
    const promise = (async () => {
      const tools = await firebaseTools();
      const snapshots = [];
      try { snapshots.push(await tools.getDocs(tools.query(tools.collection(tools.db, 'ratings'), tools.where('nicknameKey', '==', normalize(user))))); } catch (_) {}
      if (!snapshots.some(snap => snap.size)) {
        try { snapshots.push(await tools.getDocs(tools.query(tools.collection(tools.db, 'ratings'), tools.where('nickname', '==', user)))); } catch (_) {}
      }
      const scores = new Map();
      snapshots.forEach(snapshot => snapshot.docs.forEach(doc => {
        const row = doc.data() || {};
        const id = clean(row.openingId);
        const score = [row.score, row.personalScore, row.songScore, row.visualScore].find(value => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)));
        if (id && score !== undefined) scores.set(id, Number(score));
      }));
      const catalog = window.OC_CATALOG_CACHE?.load ? await window.OC_CATALOG_CACHE.load() : [];
      return (catalog || [])
        .filter(entry => entry?.type === type && scores.has(String(entry.id)))
        .map(entry => ({ ...entry, score: scores.get(String(entry.id)) }))
        .sort((a, b) => b.score - a.score || clean(a.title).localeCompare(clean(b.title), 'ru'));
    })();
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
    return promise;
  }

  function currentRank(type, id) {
    const cards = [...document.querySelectorAll(`${type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op'} > .oc-profile-item`)];
    const index = cards.findIndex(card => clean(card.dataset.top100Id || card.querySelector('[data-id]')?.dataset.id) === String(id));
    return index >= 0 ? index + 1 : null;
  }

  function renderRows(rows, type, query, list, selectedId, onSelect) {
    const q = clean(query).toLocaleLowerCase('ru');
    const filtered = rows.filter(row => !q || [row.title, ...(Array.isArray(row.alternativeTitles) ? row.alternativeTitles : [])]
      .some(value => clean(value).toLocaleLowerCase('ru').includes(q))).slice(0, 30);
    if (!filtered.length) {
      list.innerHTML = '<div class="oc-empty">Подходящих оценённых треков не найдено.</div>';
      return;
    }
    list.innerHTML = filtered.map(row => {
      const rank = currentRank(type, row.id);
      const image = clean(row.fallbackImage || row.image);
      return `<button type="button" class="oc-manual-insert-result${String(selectedId) === String(row.id) ? ' selected' : ''}" data-id="${esc(row.id)}">${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : '<span class="oc-manual-insert-noimage">—</span>'}<span class="oc-manual-insert-result-main"><span class="oc-manual-insert-result-title">${esc(row.title || row.id)}</span><span class="oc-manual-insert-result-meta">${rank ? `сейчас №${rank}` : 'сейчас вне топ-100'}</span></span><span class="oc-manual-insert-result-score">${esc(row.score)}</span></button>`;
    }).join('');
    list.querySelectorAll('.oc-manual-insert-result').forEach(button => button.addEventListener('click', () => onSelect(button.dataset.id)));
  }

  function dispatchPlacement(type, id, place, row) {
    document.dispatchEvent(new CustomEvent('oc:top100-place', {
      detail: { type, id: String(id), place, row }
    }));
  }

  function clearHover() {
    if (!hoverCard) return;
    hoverCard.classList.remove('oc-top100-insert-hover-before', 'oc-top100-insert-hover-after');
    hoverCard = null;
    hoverMode = '';
  }

  function setHover(card, mode) {
    if (panelAnchor) return;
    if (hoverCard === card && hoverMode === mode) return;
    clearHover();
    if (!card || !mode) return;
    hoverCard = card;
    hoverMode = mode;
    card.classList.add(mode === 'after' ? 'oc-top100-insert-hover-after' : 'oc-top100-insert-hover-before');
  }

  function closePanel() {
    panel?.remove();
    panel = null;
    panelAnchor = null;
    clearHover();
  }

  async function openInlinePanel(card, mode, type, place) {
    if (!editing()) {
      toast('Сначала включи редактирование топа.', 'error');
      return;
    }
    closePanel();
    clearHover();

    const user = viewedUser();
    const targetPlace = Math.max(1, Math.min(100, Math.round(Number(place) || 1)));
    panelAnchor = { card, mode, type: type === 'ED' ? 'ED' : 'OP', place: targetPlace };

    panel = document.createElement('div');
    panel.className = 'oc-manual-insert-panel oc-top100-inline-search-panel';
    panel.dataset.top100InlinePanel = '1';
    panel.innerHTML = `
      <div class="oc-manual-insert-head">
        <div><strong>Вставить на ${targetPlace}-е место · ${panelAnchor.type}</strong><small>Поиск среди оценённых треков</small></div>
        <button type="button" class="oc-manual-insert-close" aria-label="Закрыть">×</button>
      </div>
      <input class="oc-manual-insert-search" type="search" placeholder="Название трека…" autocomplete="off">
      <div class="oc-manual-insert-results"><div class="oc-manual-insert-loading">Загружаю оценённые треки…</div></div>
      <div class="oc-top100-inline-search-panel-actions">
        <button type="button" class="oc-soft-btn oc-top100-inline-confirm" disabled>Вставить сюда</button>
      </div>`;
    card.parentElement.insertBefore(panel, mode === 'before' ? card : card.nextSibling);

    const search = panel.querySelector('.oc-manual-insert-search');
    const list = panel.querySelector('.oc-manual-insert-results');
    const confirm = panel.querySelector('.oc-top100-inline-confirm');
    let rows = [];
    let selectedId = '';

    const render = () => renderRows(rows, panelAnchor.type, search.value, list, selectedId, id => {
      selectedId = id;
      confirm.disabled = false;
      render();
    });

    panel.querySelector('.oc-manual-insert-close').addEventListener('click', closePanel);
    search.addEventListener('input', render);
    confirm.addEventListener('click', () => {
      if (!selectedId || !panelAnchor) return;
      const row = rows.find(item => String(item.id) === String(selectedId));
      const { type: currentType, place: currentPlace } = panelAnchor;
      dispatchPlacement(currentType, selectedId, currentPlace, row);
      closePanel();
      toast(`${row?.title || selectedId}: поставлен на ${currentPlace}-е место.`, 'success');
    });

    try {
      rows = await candidates(user, panelAnchor.type);
      if (!panel?.isConnected || !panelAnchor) return;
      render();
      search.focus({ preventScroll: true });
    } catch (error) {
      if (list) list.innerHTML = `<div class="oc-manual-insert-error">${esc(error?.message || 'Не удалось загрузить оценки.')}</div>`;
    }
  }

  function clearDecorations(container) {
    if (!container) return;
    container.classList.remove('oc-top100-inline-insert-enabled');
    [...container.children].forEach(card => {
      if (!card.classList?.contains('oc-profile-item')) return;
      card.removeAttribute('data-top100-insert-place');
      card.removeAttribute('data-top100-insert-label');
      card.removeAttribute('data-top100-insert-after');
      card.removeAttribute('data-top100-insert-after-label');
      card.classList.remove(
        'oc-top100-insert-hover-before',
        'oc-top100-insert-hover-after',
        'oc-top100-inline-panel-before',
        'oc-top100-inline-panel-after'
      );
      card.style.removeProperty('--oc-top100-inline-panel-gap');
    });
  }

  function decorateType(type) {
    const container = containerFor(type);
    if (!container) return;
    if (!editing() || !topVisible()) {
      clearDecorations(container);
      if (panelAnchor?.type === type) closePanel();
      return;
    }
    const cards = [...container.children].filter(node => node.classList?.contains('oc-profile-item'));
    if (!cards.length) {
      clearDecorations(container);
      return;
    }
    cards.forEach((card, index) => {
      const place = index + 1;
      card.dataset.top100InsertPlace = String(place);
      card.dataset.top100InsertLabel = `Вставить на ${place}-е место`;
      card.removeAttribute('data-top100-insert-after');
      card.removeAttribute('data-top100-insert-after-label');
    });
    if (cards.length < 100) {
      const last = cards[cards.length - 1];
      last.dataset.top100InsertAfter = String(cards.length + 1);
      last.dataset.top100InsertAfterLabel = `Вставить на ${cards.length + 1}-е место`;
    }
    container.classList.add('oc-top100-inline-insert-enabled');
  }

  function firstCard(type) {
    return containerFor(type)?.querySelector(':scope > .oc-profile-item.manual') || null;
  }

  function mountButton() {
    const extra = document.querySelector('.oc-top100-toolbar .oc-top100-extra');
    if (!extra || extra.querySelector('[data-top100-add]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.top100Add = '1';
    button.textContent = '+ Добавить';
    button.addEventListener('click', () => {
      const type = activeType();
      const card = firstCard(type);
      if (!card) {
        toast('Для пустого топа сначала добавь трек из раздела «Все оценки».', 'error');
        return;
      }
      void openInlinePanel(card, 'before', type, 1);
    });
    extra.append(button);
  }

  function mountAll() {
    mountTimer = 0;
    ensureStyles();
    mountButton();
    decorateType('OP');
    decorateType('ED');
  }

  function scheduleMount() {
    window.clearTimeout(mountTimer);
    mountTimer = window.setTimeout(mountAll, 0);
  }

  document.addEventListener('pointermove', event => {
    if (panel?.contains(event.target)) return;
    if (!editing() || !topVisible()) {
      clearHover();
      return;
    }
    const card = event.target.closest?.('#oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual,#oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual');
    if (!card) {
      clearHover();
      return;
    }
    const rect = card.getBoundingClientRect();
    if (event.clientY < rect.top && event.clientY >= rect.top - 42) setHover(card, 'before');
    else if (card.dataset.top100InsertAfter && event.clientY > rect.bottom && event.clientY <= rect.bottom + 42) setHover(card, 'after');
    else clearHover();
  }, true);

  document.addEventListener('click', event => {
    if (panel?.contains(event.target)) return;
    const card = event.target.closest?.('#oc-profile-op.oc-top100-inline-insert-enabled>.oc-profile-item.manual,#oc-profile-ed.oc-top100-inline-insert-enabled>.oc-profile-item.manual');
    if (card && editing() && topVisible()) {
      const rect = card.getBoundingClientRect();
      const type = card.parentElement?.id === 'oc-profile-ed' ? 'ED' : 'OP';
      if (event.clientY < rect.top && card.dataset.top100InsertPlace) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void openInlinePanel(card, 'before', type, card.dataset.top100InsertPlace);
        return;
      }
      if (event.clientY > rect.bottom && card.dataset.top100InsertAfter) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void openInlinePanel(card, 'after', type, card.dataset.top100InsertAfter);
        return;
      }
    }
    if (event.target.closest?.('.oc-profile-top-type-btn')) closePanel();
    if (event.target.closest?.('#oc-manual-edit-btn,[data-profile-view="top100"]')) window.setTimeout(scheduleMount, 0);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel) closePanel();
  });

  new MutationObserver(records => {
    const relevant = records.some(record => {
      if (record.target?.closest?.('.oc-top100-inline-search-panel')) return false;
      return record.type === 'childList';
    });
    if (relevant) scheduleMount();
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.querySelector('#oc-profile-user')?.addEventListener('change', () => {
    cache.clear();
    closePanel();
    scheduleMount();
  });
  document.addEventListener('oc:top100-saved', () => {
    closePanel();
    scheduleMount();
  });
  window.addEventListener('resize', clearHover, { passive: true });

  [0, 100, 400, 1000].forEach(delay => setTimeout(mountAll, delay));
})();
