(() => {
  if (window.__OC_MANUAL_TOP_INSERT_FAST_READY__) return;

  const SEASON_LABELS = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  const PROFILE_FILTER_IDS = [
    'oc-p-search', 'oc-p-type', 'oc-p-score-cmp', 'oc-p-score-value',
    'oc-p-from-year', 'oc-p-from-season', 'oc-p-to-year', 'oc-p-to-season',
    'oc-p-studio', 'oc-p-director', 'oc-p-performer', 'oc-p-franchise',
    'oc-ar-type', 'oc-ar-metric', 'oc-ar-score', 'oc-content-filter-select'
  ];

  const candidateCache = new Map();
  let activeZone = null;
  let mountTimer = 0;
  let wasEditing = false;

  const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const clean = value => String(value || '').trim();
  const normalize = value => clean(value).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  function showMessage(message, type = '') {
    if (window.OC_TOAST?.show) window.OC_TOAST.show(message, { type });
    const status = document.querySelector('#oc-status');
    if (status) status.textContent = message;
  }

  function editingActive() {
    const button = document.querySelector('#oc-manual-edit-btn');
    return Boolean(button?.classList.contains('active') && !button.disabled);
  }

  function viewedUser() {
    return clean(document.querySelector('#oc-profile-user')?.value || document.querySelector('#oc-myname')?.value);
  }

  function normalizedUserKey(user) {
    try {
      return window.OPED_DB?.normalizeNickname?.(user) || normalize(user).replace(/[^a-zа-яе0-9_-]+/gi, '_').slice(0, 60);
    } catch (_) {
      return normalize(user).replace(/[^a-zа-яе0-9_-]+/gi, '_').slice(0, 60);
    }
  }

  async function waitForFirebase() {
    if (window.OPED_DB) return;
    await new Promise(resolve => {
      const timeout = window.setTimeout(resolve, 5000);
      window.addEventListener('oped-db-ready', () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  }

  function loadCandidates(user, type) {
    const userKey = normalizedUserKey(user);
    const cacheKey = `${userKey}|${type}`;
    if (candidateCache.has(cacheKey)) return candidateCache.get(cacheKey);

    const promise = (async () => {
      await waitForFirebase();
      const catalog = await window.OC_CATALOG_CACHE.load();
      const [{ getApp, getApps }, { getFirestore, collection, getDocs, query, where }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
      ]);
      if (!getApps().length) throw new Error('Firebase ещё не инициализирован.');

      const db = getFirestore(getApp());
      const ratingRows = new Map();
      const snapshots = [];
      try {
        snapshots.push(await getDocs(query(collection(db, 'ratings'), where('nicknameKey', '==', userKey))));
      } catch (error) {
        console.warn('Manual top rating lookup by nicknameKey failed', error);
      }
      if (!snapshots.some(snapshot => snapshot.size)) {
        try {
          snapshots.push(await getDocs(query(collection(db, 'ratings'), where('nickname', '==', user))));
        } catch (error) {
          console.warn('Manual top rating lookup by nickname failed', error);
        }
      }

      snapshots.forEach(snapshot => snapshot.docs.forEach(documentSnapshot => {
        const data = documentSnapshot.data() || {};
        const openingId = clean(data.openingId);
        const score = data.score !== undefined && data.score !== null && data.score !== '' ? Number(data.score)
          : data.personalScore !== undefined && data.personalScore !== null && data.personalScore !== '' ? Number(data.personalScore)
          : null;
        if (openingId && Number.isFinite(score)) ratingRows.set(openingId, score);
      }));

      return catalog
        .filter(entry => entry?.type === type && ratingRows.has(String(entry.id)))
        .map(entry => ({ ...entry, manualInsertScore: ratingRows.get(String(entry.id)) }))
        .sort((a, b) => b.manualInsertScore - a.manualInsertScore || clean(a.title).localeCompare(clean(b.title), 'ru'));
    })();

    candidateCache.set(cacheKey, promise);
    promise.catch(() => candidateCache.delete(cacheKey));
    return promise;
  }

  function itemRank(item) {
    const match = clean(item?.querySelector('[data-action="set-rank"]')?.textContent).match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function visibleRankMap(type) {
    const container = document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op');
    const map = new Map();
    container?.querySelectorAll('.oc-profile-item.manual [data-action="set-rank"][data-id]').forEach(button => {
      const match = clean(button.textContent).match(/\d+/);
      if (match) map.set(clean(button.dataset.id), Number(match[0]));
    });
    return map;
  }

  function imageHtml(entry) {
    const src = clean(entry.image || entry.fallbackImage);
    if (!src) return `<div class="oc-manual-insert-noimage">${escapeHtml(entry.type || '')}</div>`;
    return `<img src="${escapeHtml(src)}" data-fallback="${escapeHtml(clean(entry.fallbackImage))}" alt="" loading="lazy" decoding="async">`;
  }

  function closePanel() {
    if (!activeZone) return;
    activeZone.classList.remove('active');
    activeZone.querySelector('.oc-manual-insert-panel')?.remove();
    activeZone = null;
  }

  function candidateMatches(entry, queryText) {
    const queryTextNormalized = normalize(queryText);
    if (!queryTextNormalized) return true;
    return [entry.title, ...(Array.isArray(entry.alternativeTitles) ? entry.alternativeTitles : [])]
      .map(normalize)
      .some(value => value.includes(queryTextNormalized));
  }

  function candidateMeta(entry, rank) {
    const season = entry.season ? SEASON_LABELS[entry.season] || entry.season : '';
    const date = [season, entry.year].filter(Boolean).join(' ');
    return [date, rank ? `сейчас №${rank}` : 'сейчас вне топ-100'].filter(Boolean).join(' · ');
  }

  function captureControls() {
    const snapshot = {};
    PROFILE_FILTER_IDS.forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      snapshot[id] = element.multiple ? [...element.options].filter(option => option.selected).map(option => option.value) : element.value;
    });
    return snapshot;
  }

  async function restoreControls(snapshot) {
    PROFILE_FILTER_IDS.forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      if (element.multiple) {
        const selected = new Set(Array.isArray(snapshot[id]) ? snapshot[id].map(String) : []);
        [...element.options].forEach(option => { option.selected = selected.has(String(option.value)); });
      } else element.value = snapshot[id] ?? '';
    });
    PROFILE_FILTER_IDS.forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      element.dispatchEvent(new Event(element.matches('input') ? 'input' : 'change', { bubbles: true }));
    });
    await sleep(80);
  }

  function actionButton(action, id) {
    return [...document.querySelectorAll(`[data-action="${action}"][data-id]`)].find(button => clean(button.dataset.id) === clean(id)) || null;
  }

  function rankFromButton(button) {
    const match = clean(button?.textContent).match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  async function prepareCandidate(candidate, type) {
    document.querySelector('#oc-p-reset-filters')?.click();
    await sleep(60);
    const content = document.querySelector('#oc-content-filter-select');
    if (content) { content.value = 'all'; content.dispatchEvent(new Event('change', { bubbles: true })); }
    const arType = document.querySelector('#oc-ar-type');
    if (arType) { arType.value = type; arType.dispatchEvent(new Event('change', { bubbles: true })); }
    const arScore = document.querySelector('#oc-ar-score');
    if (arScore) { arScore.value = ''; arScore.dispatchEvent(new Event('change', { bubbles: true })); }
    const search = document.querySelector('#oc-p-search');
    if (search) { search.value = clean(candidate.title); search.dispatchEvent(new Event('input', { bubbles: true })); }
    await sleep(100);

    let rankButton = actionButton('all-set-rank', candidate.id);
    if (rankButton) return rankButton;
    const hiddenToggle = document.querySelector('#oc-manual-hidden-toggle-btn');
    if (hiddenToggle && !hiddenToggle.disabled && /^Показать скрытые/i.test(clean(hiddenToggle.textContent))) {
      hiddenToggle.click();
      await sleep(100);
      actionButton('all-unhide-manual', candidate.id)?.click();
      await sleep(100);
      rankButton = actionButton('all-set-rank', candidate.id);
    }
    return rankButton;
  }

  async function moveCandidate(candidate, type, targetPlace) {
    const savedControls = captureControls();
    try {
      let rankButton = await prepareCandidate(candidate, type);
      let currentPlace = rankFromButton(rankButton);
      if (currentPlace && currentPlace <= targetPlace) throw new Error(`Этот трек уже находится на ${currentPlace}-м месте.`);

      if (!currentPlace) {
        const toTop = actionButton('all-to-top100', candidate.id);
        if (!toTop) throw new Error('Не удалось подготовить трек для добавления в топ.');
        toTop.click();
        await sleep(120);
        rankButton = actionButton('all-set-rank', candidate.id);
        currentPlace = rankFromButton(rankButton);
        if (!rankButton || !currentPlace) throw new Error('Не удалось определить новое место трека.');
        if (currentPlace === targetPlace) return;
      }

      const originalPrompt = window.prompt;
      window.prompt = () => String(targetPlace);
      try { rankButton.click(); }
      finally { window.prompt = originalPrompt; }
      await sleep(120);
    } finally {
      await restoreControls(savedControls);
    }
  }

  function openPanel(zone, type, targetPlace) {
    if (activeZone === zone) { closePanel(); return; }
    closePanel();
    activeZone = zone;
    zone.classList.add('active');

    const user = viewedUser();
    const promise = loadCandidates(user, type);
    const panel = document.createElement('div');
    panel.className = 'oc-manual-insert-panel';
    panel.innerHTML = `<div class="oc-manual-insert-head"><div><strong>Добавить ${type} на ${targetPlace}-е место</strong><small>Доступны только оценённые треки. Трек ниже выбранного места будет перенесён сюда.</small></div><button type="button" class="oc-manual-insert-close" aria-label="Закрыть">×</button></div><div class="oc-manual-insert-search-wrap"><input class="oc-manual-insert-search" type="search" autocomplete="off" placeholder="Начните вводить название ${type}…"></div><div class="oc-manual-insert-results"><div class="oc-manual-insert-loading">Загружаю оценённые треки…</div></div><div class="oc-manual-insert-note">Изменение останется локальным до нажатия «Сохранить топ-100».</div>`;
    zone.append(panel);

    const search = panel.querySelector('.oc-manual-insert-search');
    const results = panel.querySelector('.oc-manual-insert-results');
    let candidates = [];
    let selected = null;

    function renderPreview() {
      panel.querySelector('.oc-manual-insert-preview')?.remove();
      if (!selected) return;
      const rank = visibleRankMap(type).get(String(selected.id));
      const preview = document.createElement('div');
      preview.className = 'oc-manual-insert-preview';
      preview.innerHTML = `${imageHtml(selected)}<div><div class="oc-manual-insert-preview-title">${escapeHtml(selected.title)}</div><div class="oc-manual-insert-preview-meta">${escapeHtml(candidateMeta(selected, rank))} · оценка ${escapeHtml(selected.manualInsertScore)}</div></div><button type="button" class="oc-manual-insert-confirm">${rank ? `Переместить на ${targetPlace}-е место` : `Добавить на ${targetPlace}-е место`}</button>`;
      panel.insertBefore(preview, panel.querySelector('.oc-manual-insert-note'));
      preview.querySelector('.oc-manual-insert-confirm').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = 'Переставляю…';
        try {
          await moveCandidate(selected, type, targetPlace);
          closePanel();
          showMessage(`${selected.title}: теперь ${targetPlace}-е место. Нажми «Сохранить топ-100».`, 'success');
        } catch (error) {
          button.disabled = false;
          button.textContent = rank ? `Переместить на ${targetPlace}-е место` : `Добавить на ${targetPlace}-е место`;
          showMessage(error?.message || 'Не удалось изменить топ.', 'error');
        }
      });
    }

    function renderResults() {
      const ranks = visibleRankMap(type);
      const queryText = search.value;
      const matches = candidates
        .filter(entry => candidateMatches(entry, queryText))
        .filter(entry => !ranks.get(String(entry.id)) || ranks.get(String(entry.id)) > targetPlace)
        .slice(0, 10);
      if (!matches.length) {
        results.innerHTML = `<div class="oc-manual-insert-empty">${queryText ? 'Подходящих оценённых треков не найдено.' : 'Нет доступных треков ниже выбранного места.'}</div>`;
        return;
      }
      results.innerHTML = matches.map(entry => {
        const rank = ranks.get(String(entry.id));
        return `<button type="button" class="oc-manual-insert-result${selected && String(selected.id) === String(entry.id) ? ' selected' : ''}" data-id="${escapeHtml(entry.id)}">${imageHtml(entry)}<span class="oc-manual-insert-result-main"><span class="oc-manual-insert-result-title">${escapeHtml(entry.title)}</span><span class="oc-manual-insert-result-meta">${escapeHtml(candidateMeta(entry, rank))}</span></span><span class="oc-manual-insert-result-score">${escapeHtml(entry.manualInsertScore)}</span></button>`;
      }).join('');
      results.querySelectorAll('.oc-manual-insert-result').forEach(button => button.addEventListener('click', () => {
        selected = candidates.find(entry => String(entry.id) === String(button.dataset.id)) || null;
        renderResults();
        renderPreview();
      }));
    }

    panel.querySelector('.oc-manual-insert-close').addEventListener('click', closePanel);
    search.addEventListener('input', renderResults);
    promise.then(rows => {
      if (!panel.isConnected) return;
      candidates = rows;
      renderResults();
      search.focus();
    }).catch(error => {
      if (panel.isConnected) results.innerHTML = `<div class="oc-manual-insert-error">${escapeHtml(error?.message || 'Не удалось загрузить оценки.')}</div>`;
    });
  }

  function makeZone(type, targetPlace) {
    const zone = document.createElement('div');
    zone.className = 'oc-manual-insert-zone';
    zone.dataset.type = type;
    zone.dataset.targetPlace = String(targetPlace);
    zone.innerHTML = `<button type="button" aria-label="Добавить ${type} на ${targetPlace}-е место"><b>＋</b><span>Добавить на ${targetPlace}-е место</span></button>`;
    const button = zone.querySelector('button');
    const warm = () => { void loadCandidates(viewedUser(), type); };
    button.addEventListener('pointerenter', warm, { once: true });
    button.addEventListener('focus', warm, { once: true });
    button.addEventListener('pointerdown', warm, { once: true });
    button.addEventListener('click', () => openPanel(zone, type, targetPlace));
    return zone;
  }

  function mountList(container, type) {
    if (!container) return;
    const items = [...container.children].filter(element => element.classList?.contains('oc-profile-item') && element.classList.contains('manual'));
    const signature = items.map(item => `${item.querySelector('[data-action="set-rank"]')?.dataset.id || ''}:${itemRank(item) || ''}`).join('|');
    if (container.dataset.manualInsertFastSignature === signature && container.querySelector(':scope > .oc-manual-insert-zone')) return;
    if (activeZone && container.contains(activeZone)) closePanel();
    container.querySelectorAll(':scope > .oc-manual-insert-zone').forEach(zone => zone.remove());
    container.dataset.manualInsertFastSignature = signature;
    if (!items.length) return;

    const usedTargets = new Set();
    items.forEach(item => {
      const rank = itemRank(item);
      if (!rank || rank < 1 || rank > 100 || usedTargets.has(rank)) return;
      item.before(makeZone(type, rank));
      usedTargets.add(rank);
    });
    const lastRank = itemRank(items[items.length - 1]);
    if (lastRank && lastRank < 100 && !usedTargets.has(lastRank + 1)) items[items.length - 1].after(makeZone(type, lastRank + 1));
  }

  function mount() {
    const editing = editingActive();
    if (editing !== wasEditing) {
      wasEditing = editing;
      candidateCache.clear();
      if (!editing) closePanel();
    }
    if (!editing) {
      document.querySelectorAll('.oc-manual-insert-zone').forEach(zone => zone.remove());
      document.querySelectorAll('#oc-profile-op,#oc-profile-ed').forEach(container => { container.dataset.manualInsertFastSignature = ''; });
      return;
    }
    mountList(document.querySelector('#oc-profile-op'), 'OP');
    mountList(document.querySelector('#oc-profile-ed'), 'ED');
  }

  function scheduleMount() {
    window.clearTimeout(mountTimer);
    mountTimer = window.setTimeout(mount, 0);
  }

  function init() {
    const panel = document.querySelector('#oc-profile-panel');
    if (!panel) return;
    new MutationObserver(records => {
      if (records.some(record => !record.target.closest?.('.oc-manual-insert-panel'))) scheduleMount();
    }).observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && activeZone) {
        closePanel();
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    scheduleMount();
  }

  window.__OC_MANUAL_TOP_INSERT_FAST_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
