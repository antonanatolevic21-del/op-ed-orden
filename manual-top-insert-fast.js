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
  let cache = new Map();
  let modal = null;

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
      return (catalog || []).filter(entry => entry?.type === type && scores.has(String(entry.id))).map(entry => ({ ...entry, score: scores.get(String(entry.id)) }))
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

  function closeModal() { modal?.remove(); modal = null; }

  function dispatchPlacement(type, id, place) {
    const fake = document.createElement('button');
    fake.type = 'button'; fake.dataset.action = 'all-set-rank'; fake.dataset.type = type; fake.dataset.id = String(id); fake.style.display = 'none';
    document.body.append(fake);
    const originalPrompt = window.prompt;
    window.prompt = () => String(place);
    try { fake.click(); }
    finally { window.prompt = originalPrompt; fake.remove(); }
  }

  function renderRows(rows, type, query, list, selectedId, onSelect) {
    const q = clean(query).toLocaleLowerCase('ru');
    const filtered = rows.filter(row => !q || [row.title, ...(Array.isArray(row.alternativeTitles) ? row.alternativeTitles : [])]
      .some(value => clean(value).toLocaleLowerCase('ru').includes(q))).slice(0, 30);
    if (!filtered.length) { list.innerHTML = '<div class="oc-empty">Подходящих оценённых треков не найдено.</div>'; return; }
    list.innerHTML = filtered.map(row => {
      const rank = currentRank(type, row.id), image = clean(row.fallbackImage || row.image);
      return `<button type="button" class="oc-manual-insert-result${String(selectedId) === String(row.id) ? ' selected' : ''}" data-id="${esc(row.id)}">${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : '<span></span>'}<span class="oc-manual-insert-result-main"><span class="oc-manual-insert-result-title">${esc(row.title || row.id)}</span><span class="oc-manual-insert-result-meta">${rank ? `сейчас №${rank}` : 'сейчас вне топ-100'}</span></span><span class="oc-manual-insert-result-score">${esc(row.score)}</span></button>`;
    }).join('');
    list.querySelectorAll('.oc-manual-insert-result').forEach(button => button.addEventListener('click', () => onSelect(button.dataset.id)));
  }

  async function openAddDialog() {
    if (!editing()) { toast('Сначала включи редактирование топа.', 'error'); return; }
    closeModal();
    const type = activeType(), user = viewedUser();
    modal = document.createElement('div'); modal.className = 'oc-top100-modal';
    modal.innerHTML = `<div class="oc-top100-dialog"><button type="button" class="oc-top100-modal-close" aria-label="Закрыть">×</button><div class="oc-top100-modal-body"><div class="oc-top100-modal-head"><div><h2>Добавить в топ-100 · ${type}</h2><p>Выбери оценённый трек и точное место. Остальные автоматически сдвинутся вниз.</p></div></div><div style="display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px;margin:14px 0;"><input id="oc-top100-add-place" type="number" min="1" max="100" value="1" style="min-height:42px;border:1px solid #352d40;border-radius:10px;background:#0d0b12;color:#f5f3fa;padding:9px 11px;"><input id="oc-top100-add-search" type="search" placeholder="Название трека…" autocomplete="off" style="min-height:42px;border:1px solid #352d40;border-radius:10px;background:#0d0b12;color:#f5f3fa;padding:9px 11px;"></div><div id="oc-top100-add-list" class="oc-manual-insert-results"><div class="oc-manual-insert-loading">Загружаю оценённые треки…</div></div><div style="display:flex;justify-content:flex-end;margin-top:12px;"><button type="button" id="oc-top100-add-confirm" class="oc-soft-btn" disabled>Добавить на выбранное место</button></div></div></div>`;
    document.body.append(modal);
    modal.addEventListener('click', event => { if (event.target === modal || event.target.closest('.oc-top100-modal-close')) closeModal(); });
    const search = modal.querySelector('#oc-top100-add-search'), place = modal.querySelector('#oc-top100-add-place'), list = modal.querySelector('#oc-top100-add-list'), confirm = modal.querySelector('#oc-top100-add-confirm');
    let rows = [], selectedId = '';
    const render = () => renderRows(rows, type, search.value, list, selectedId, id => { selectedId = id; confirm.disabled = false; render(); });
    search.addEventListener('input', render);
    confirm.addEventListener('click', () => {
      if (!selectedId) return;
      const target = Math.max(1, Math.min(100, Math.round(Number(place.value) || 1))), row = rows.find(item => String(item.id) === String(selectedId));
      dispatchPlacement(type, selectedId, target); closeModal(); toast(`${row?.title || selectedId}: поставлен на ${target}-е место.`, 'success');
    });
    try { rows = await candidates(user, type); if (!modal?.isConnected) return; render(); search.focus(); }
    catch (error) { if (list) list.innerHTML = `<div class="oc-top100-error">${esc(error?.message || 'Не удалось загрузить оценки.')}</div>`; }
  }

  function mountButton() {
    const extra = document.querySelector('.oc-top100-toolbar .oc-top100-extra');
    if (!extra || extra.querySelector('[data-top100-add]')) return;
    const button = document.createElement('button'); button.type = 'button'; button.dataset.top100Add = '1'; button.textContent = '+ Добавить';
    button.addEventListener('click', () => void openAddDialog()); extra.append(button);
  }

  new MutationObserver(mountButton).observe(document.documentElement, { childList: true, subtree: true });
  document.querySelector('#oc-profile-user')?.addEventListener('change', () => cache.clear());
  document.querySelector('.oc-profile-top-type-switch')?.addEventListener('click', closeModal);
  [0, 100, 400, 1000].forEach(delay => setTimeout(mountButton, delay));
})();