(() => {
  if (window.__OC_DISCOVERY_COLLECTION_ALBUM_READY__) return;
  window.__OC_DISCOVERY_COLLECTION_ALBUM_READY__ = true;

  const panel = document.querySelector('#oc-discovery-panel');
  if (!panel) return;

  const SEASON_LABELS = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  const SEASON_ORDER = { winter: 0, spring: 1, summer: 2, fall: 3 };
  const COLLATOR = new Intl.Collator(['ru', 'en'], { numeric: true, sensitivity: 'base' });
  const state = {
    collectionId: '',
    owner: '',
    search: '',
    type: '',
    sort: 'title_asc',
    progress: '',
    fromYear: '',
    fromSeason: '',
    toYear: '',
    toSeason: '',
    filtersExpanded: false,
    renderLimit: 30,
    rendering: false,
    ratingQueue: [],
    ratingCurrent: '',
    searchTimer: 0
  };

  const bridge = () => window.OC_APP_BRIDGE;
  const snapshot = () => bridge()?.snapshot?.() || window.OC_APP_DATA || {};
  const clean = value => String(value ?? '').trim();
  const normalize = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function profileName(profile) {
    return clean(profile?.nickname || profile?.displayName || profile?.name || profile?.id);
  }

  function currentName() {
    return clean(snapshot().currentUser?.nickname || document.querySelector('#oc-myname')?.value);
  }

  function profiles() {
    return Array.isArray(snapshot().userProfiles) ? snapshot().userProfiles : [];
  }

  function entries() {
    return Array.isArray(snapshot().entries) ? snapshot().entries : [];
  }

  function profileByOwner(owner) {
    return profiles().find(profile => normalize(profileName(profile)) === normalize(owner));
  }

  function currentCollection() {
    const profile = profileByOwner(state.owner);
    const rows = Array.isArray(profile?.collections) ? profile.collections : [];
    return rows.find(row => String(row?.id) === String(state.collectionId)) || null;
  }

  function entryMap() {
    return new Map(entries().map(entry => [String(entry.id), entry]));
  }

  function collectionEntries(collection) {
    const byId = entryMap();
    return (Array.isArray(collection?.trackIds) ? collection.trackIds : [])
      .map(id => byId.get(String(id)))
      .filter(Boolean);
  }

  function valueForUser(map, user) {
    if (!map || !user) return null;
    if (Object.prototype.hasOwnProperty.call(map, user)) {
      const value = Number(map[user]);
      return Number.isFinite(value) ? value : null;
    }
    const key = normalize(user);
    for (const [name, raw] of Object.entries(map)) {
      if (normalize(name) !== key) continue;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    }
    return null;
  }

  function ownScore(entry) {
    const scale = document.querySelector('#oc-scale-select')?.value;
    return valueForUser(scale === 'five' ? entry?.personalScores : entry?.scores, currentName());
  }

  function hasRating(entry) {
    return ownScore(entry) !== null;
  }

  function releasePoint(entry) {
    const year = Number(entry?.year);
    const season = SEASON_ORDER[entry?.season];
    return Number.isFinite(year) && season !== undefined ? year * 4 + season : null;
  }

  function compareTracks(left, right) {
    const titleDiff = COLLATOR.compare(clean(left?.title), clean(right?.title));
    if (state.sort === 'title_desc') return -titleDiff;
    if (state.sort === 'date_desc' || state.sort === 'date_asc') {
      const a = releasePoint(left);
      const b = releasePoint(right);
      if (a === null && b !== null) return 1;
      if (b === null && a !== null) return -1;
      if (a !== b) return state.sort === 'date_desc' ? b - a : a - b;
    }
    if (state.sort === 'score_desc' || state.sort === 'score_asc') {
      const a = ownScore(left);
      const b = ownScore(right);
      if (a === null && b !== null) return 1;
      if (b === null && a !== null) return -1;
      if (a !== b) return state.sort === 'score_desc' ? b - a : a - b;
    }
    if (state.sort === 'unrated') {
      const diff = Number(hasRating(left)) - Number(hasRating(right));
      if (diff) return diff;
    }
    return titleDiff;
  }

  function filteredEntries(collection) {
    const query = normalize(state.search);
    const fromPoint = state.fromYear
      ? Number(state.fromYear) * 4 + (SEASON_ORDER[state.fromSeason] ?? 0)
      : Number.NEGATIVE_INFINITY;
    const toPoint = state.toYear
      ? Number(state.toYear) * 4 + (SEASON_ORDER[state.toSeason] ?? 3)
      : Number.POSITIVE_INFINITY;
    const rangeStart = Math.min(fromPoint, toPoint);
    const rangeEnd = Math.max(fromPoint, toPoint);

    return collectionEntries(collection).filter(entry => {
      if (query) {
        const haystack = normalize([
          entry.title,
          ...(entry.alternativeTitles || []),
          ...(entry.performers || []),
          ...(entry.studios || []),
          ...(entry.directors || []),
          ...(entry.franchises || [])
        ].join(' '));
        if (!haystack.includes(query)) return false;
      }
      if (state.type && entry.type !== state.type) return false;
      if (state.fromYear || state.toYear) {
        const point = releasePoint(entry);
        if (point === null || point < rangeStart || point > rangeEnd) return false;
      }
      const rated = hasRating(entry);
      if (state.progress === 'rated' && !rated) return false;
      if (state.progress === 'unrated' && rated) return false;
      return true;
    }).sort(compareTracks);
  }

  function yearOptions(rows, selected, firstLabel) {
    const years = [...new Set(rows.map(entry => Number(entry.year)).filter(Number.isFinite))]
      .sort((a, b) => b - a);
    return `<option value="">${firstLabel}</option>` + years.map(year =>
      `<option value="${year}" ${String(year) === String(selected) ? 'selected' : ''}>${year}</option>`
    ).join('');
  }

  function imageMarkup(entry) {
    const primary = clean(entry?.image);
    const fallback = clean(entry?.fallbackImage);
    const source = primary || fallback;
    const box = source
      ? `<div class="oc-season-thumb oc-image-loading"><img class="oc-track-image" loading="lazy" decoding="async" src="${esc(source)}" data-fallback="${esc(primary ? fallback : '')}" alt="${esc(entry.title || 'трек')}"></div>`
      : `<div class="oc-season-thumb">${esc(entry?.type || 'OP')}</div>`;
    return entry?.link
      ? `<a class="oc-image-link" href="${esc(entry.link)}" target="_blank" rel="noopener noreferrer" title="Открыть видео: ${esc(entry.title)}">${box}</a>`
      : box;
  }

  function metaLine(label, values) {
    const list = (Array.isArray(values) ? values : []).filter(Boolean);
    return list.length ? `<div class="oc-meta oc-meta-line"><span class="oc-meta-key">${label}:</span> ${esc(list.join(', '))}</div>` : '';
  }

  function trackMarkup(entry, index) {
    const score = ownScore(entry);
    const scoreText = score === null ? '—' : String(score).replace('.', ',');
    const season = entry?.year ? `<span class="oc-yr-tag">${esc(entry.year)}${entry.season ? ` · ${esc(SEASON_LABELS[entry.season] || entry.season)}` : ''}</span>` : '';
    return `<div class="oc-season-op oc-unified-card oc-collection-album-track${hasRating(entry) ? ' oc-entity-track-rated' : ''}" data-id="${esc(entry.id)}">
      <div class="oc-rank">${index + 1}</div>
      ${imageMarkup(entry)}
      <div class="oc-info">
        <div class="oc-name-row">
          <span class="oc-name oc-clickable-title" data-collection-detail-open-track="${esc(entry.id)}">${esc(entry.title)}</span>
          <span class="oc-type-tag ${entry.type === 'ED' ? 'ED' : 'OP'}">${esc(entry.type || 'OP')}</span>
          ${season}
        </div>
        ${metaLine('студия', entry.studios)}
        ${metaLine('режиссёр', entry.directors)}
        ${metaLine('исполнитель', entry.performers)}
        ${metaLine('франшиза', entry.franchises)}
        ${score === null ? '' : `<div class="oc-rated-mark">твоя оценка: ${esc(scoreText)}</div>`}
      </div>
      <div class="oc-season-score">${esc(scoreText)}</div>
      <div class="oc-card-actions"><button class="oc-secondary-btn" type="button" data-collection-detail-rate="${esc(entry.id)}">${score === null ? 'Оценить' : 'Изменить оценку'}</button></div>
    </div>`;
  }

  function filterMarkup(allRows, filteredRows) {
    return `<div class="oc-collection-album-filters${state.filtersExpanded ? ' is-expanded' : ''}">
      <div class="oc-collection-album-filter-head">
        <div><div class="oc-section-label">фильтры</div><h3>Найти нужные треки</h3></div>
        <div class="oc-collection-album-filter-actions">
          <label class="oc-collection-album-field oc-collection-album-sort"><span>Сортировка</span><select id="oc-collection-detail-sort">
            <option value="title_asc" ${state.sort === 'title_asc' ? 'selected' : ''}>Название: А–Я</option>
            <option value="title_desc" ${state.sort === 'title_desc' ? 'selected' : ''}>Название: Я–А</option>
            <option value="date_desc" ${state.sort === 'date_desc' ? 'selected' : ''}>Дата: сначала новые</option>
            <option value="date_asc" ${state.sort === 'date_asc' ? 'selected' : ''}>Дата: сначала старые</option>
            <option value="score_desc" ${state.sort === 'score_desc' ? 'selected' : ''}>Моя оценка: выше</option>
            <option value="score_asc" ${state.sort === 'score_asc' ? 'selected' : ''}>Моя оценка: ниже</option>
            <option value="unrated" ${state.sort === 'unrated' ? 'selected' : ''}>Сначала неоценённые</option>
          </select></label>
          <button class="oc-discovery-button primary" id="oc-collection-detail-rate-all" type="button" ${filteredRows.some(entry => !hasRating(entry)) ? '' : 'disabled'}>Оценить подборку <i>→</i></button>
          <button class="oc-discovery-button" id="oc-collection-detail-toggle" type="button" aria-expanded="${state.filtersExpanded ? 'true' : 'false'}">${state.filtersExpanded ? 'Скрыть фильтры ⌃' : 'Показать фильтры ⌄'}</button>
        </div>
      </div>
      <div class="oc-collection-album-filter-fields">
        <label class="oc-collection-album-field oc-collection-album-search"><span>Поиск</span><input id="oc-collection-detail-search" type="search" value="${esc(state.search)}" placeholder="Название, исполнитель или франшиза…"></label>
        <label class="oc-collection-album-field"><span>Тип</span><select id="oc-collection-detail-type"><option value="">OP + ED</option><option value="OP" ${state.type === 'OP' ? 'selected' : ''}>Только OP</option><option value="ED" ${state.type === 'ED' ? 'selected' : ''}>Только ED</option></select></label>
        <label class="oc-collection-album-field"><span>От: год</span><select id="oc-collection-detail-from-year">${yearOptions(allRows, state.fromYear, 'С начала')}</select></label>
        <label class="oc-collection-album-field"><span>От: сезон</span><select id="oc-collection-detail-from-season"><option value="">С начала года</option>${Object.entries(SEASON_LABELS).map(([value, label]) => `<option value="${value}" ${state.fromSeason === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label class="oc-collection-album-field"><span>До: год</span><select id="oc-collection-detail-to-year">${yearOptions(allRows, state.toYear, 'По настоящее время')}</select></label>
        <label class="oc-collection-album-field"><span>До: сезон</span><select id="oc-collection-detail-to-season"><option value="">До конца года</option>${Object.entries(SEASON_LABELS).map(([value, label]) => `<option value="${value}" ${state.toSeason === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label class="oc-collection-album-field"><span>Статус</span><select id="oc-collection-detail-progress"><option value="">Все треки</option><option value="unrated" ${state.progress === 'unrated' ? 'selected' : ''}>Не оценены</option><option value="rated" ${state.progress === 'rated' ? 'selected' : ''}>Оценены</option></select></label>
      </div>
    </div>`;
  }

  function renderDetail() {
    if (!state.collectionId || state.rendering) return;
    const content = panel.querySelector('#oc-discovery-content');
    if (!content) return;
    const collection = currentCollection();
    if (!collection) {
      closeDetail();
      return;
    }

    state.rendering = true;
    const allRows = collectionEntries(collection);
    const rows = filteredEntries(collection);
    const rated = allRows.filter(hasRating).length;
    const visible = rows.slice(0, state.renderLimit);
    const own = normalize(state.owner) === normalize(currentName());
    content.innerHTML = `<section class="oc-discovery-view oc-collection-album-view" data-collection-album-view="${esc(collection.id)}">
      <div class="oc-collection-album-head">
        <button class="oc-discovery-button oc-collection-album-back" type="button" id="oc-collection-detail-back">← Ко всем подборкам</button>
        <div class="oc-collection-album-title">
          <div class="oc-section-label">подборка · ${esc(state.owner)}</div>
          <h2>${esc(collection.title || 'Без названия')}</h2>
          <p>${esc(collection.description || 'Без описания')}</p>
          <div class="oc-collection-album-progress"><strong>${rated} из ${allRows.length}</strong><span> оценено</span><i><b style="width:${allRows.length ? Math.round(rated / allRows.length * 100) : 0}%"></b></i></div>
        </div>
        ${own ? '<button class="oc-discovery-button" type="button" id="oc-collection-detail-edit">Изменить подборку</button>' : ''}
      </div>
      ${filterMarkup(allRows, rows)}
      <div class="oc-collection-album-result-meta">Показано: ${visible.length} из ${rows.length}${rows.length !== allRows.length ? ` · всего в подборке ${allRows.length}` : ''}</div>
      <div class="oc-entity-tracks oc-collection-album-tracks">
        ${rows.length ? `<div class="oc-entity-track-list">${visible.map(trackMarkup).join('')}${visible.length < rows.length ? '<button class="oc-discovery-button oc-collection-album-more" type="button" id="oc-collection-detail-more">Показать ещё</button>' : ''}</div>` : '<div class="oc-discovery-empty">По этим фильтрам треков нет.</div>'}
      </div>
    </section>`;
    state.rendering = false;
  }

  function resetFilters() {
    state.search = '';
    state.type = '';
    state.sort = 'title_asc';
    state.progress = '';
    state.fromYear = '';
    state.fromSeason = '';
    state.toYear = '';
    state.toSeason = '';
    state.filtersExpanded = false;
    state.renderLimit = 30;
    state.ratingQueue = [];
    state.ratingCurrent = '';
  }

  function openDetail(owner, id) {
    state.owner = clean(owner) || currentName();
    state.collectionId = String(id || '');
    resetFilters();
    renderDetail();
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeDetail() {
    const wasOpen = Boolean(state.collectionId);
    state.collectionId = '';
    resetFilters();
    if (!wasOpen) return;
    const collectionsTab = panel.querySelector('[data-discovery-tab="collections"]');
    if (collectionsTab) collectionsTab.click();
  }

  function editCurrentCollection() {
    const id = state.collectionId;
    closeDetail();
    window.setTimeout(() => panel.querySelector(`[data-collection-edit="${CSS.escape(id)}"]`)?.click(), 0);
  }

  function startRatingQueue() {
    const collection = currentCollection();
    if (!collection) return;
    const remaining = filteredEntries(collection).filter(entry => !hasRating(entry)).map(entry => String(entry.id));
    state.ratingQueue = remaining;
    state.ratingCurrent = remaining[0] || '';
    if (state.ratingCurrent) bridge()?.rateTrack?.(state.ratingCurrent);
  }

  function advanceRatingQueue() {
    if (!state.ratingCurrent || !state.ratingQueue.length) return;
    const current = entryMap().get(String(state.ratingCurrent));
    if (!current || !hasRating(current)) return;
    state.ratingQueue = state.ratingQueue.filter(id => String(id) !== String(state.ratingCurrent));
    state.ratingCurrent = state.ratingQueue[0] || '';
    if (state.ratingCurrent) window.setTimeout(() => bridge()?.rateTrack?.(state.ratingCurrent), 120);
  }

  panel.addEventListener('click', event => {
    const open = event.target.closest('[data-collection-open]');
    if (open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const owner = panel.querySelector('#oc-collection-owner')?.value || currentName();
      openDetail(owner, open.dataset.collectionOpen);
      return;
    }

    if (!state.collectionId) return;

    const tab = event.target.closest('[data-discovery-tab]');
    if (tab) {
      state.collectionId = '';
      resetFilters();
      return;
    }

    if (event.target.closest('#oc-collection-detail-back')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeDetail();
      return;
    }
    if (event.target.closest('#oc-collection-detail-edit')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      editCurrentCollection();
      return;
    }
    if (event.target.closest('#oc-collection-detail-toggle')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.filtersExpanded = !state.filtersExpanded;
      renderDetail();
      return;
    }
    if (event.target.closest('#oc-collection-detail-more')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.renderLimit += 30;
      renderDetail();
      return;
    }
    if (event.target.closest('#oc-collection-detail-rate-all')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startRatingQueue();
      return;
    }
    const openTrack = event.target.closest('[data-collection-detail-open-track]');
    if (openTrack) {
      event.preventDefault();
      event.stopImmediatePropagation();
      bridge()?.openTrack?.(openTrack.dataset.collectionDetailOpenTrack);
      return;
    }
    const rateTrack = event.target.closest('[data-collection-detail-rate]');
    if (rateTrack) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.ratingQueue = [];
      state.ratingCurrent = '';
      bridge()?.rateTrack?.(rateTrack.dataset.collectionDetailRate);
    }
  }, true);

  panel.addEventListener('input', event => {
    if (!state.collectionId || !event.target.matches('#oc-collection-detail-search')) return;
    state.search = event.target.value;
    state.renderLimit = 30;
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => {
      renderDetail();
      const input = panel.querySelector('#oc-collection-detail-search');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 120);
  }, true);

  panel.addEventListener('change', event => {
    if (!state.collectionId) return;
    const target = event.target;
    const fields = {
      'oc-collection-detail-sort': 'sort',
      'oc-collection-detail-type': 'type',
      'oc-collection-detail-progress': 'progress',
      'oc-collection-detail-from-year': 'fromYear',
      'oc-collection-detail-from-season': 'fromSeason',
      'oc-collection-detail-to-year': 'toYear',
      'oc-collection-detail-to-season': 'toSeason'
    };
    const key = fields[target.id];
    if (!key) return;
    event.stopImmediatePropagation();
    state[key] = target.value;
    state.renderLimit = 30;
    renderDetail();
  }, true);

  window.addEventListener('oped:app-data-updated', () => {
    if (!state.collectionId) return;
    advanceRatingQueue();
    window.setTimeout(renderDetail, 90);
  });
  window.addEventListener('oped:user-profiles-updated', () => {
    if (state.collectionId) window.setTimeout(renderDetail, 90);
  });
  window.addEventListener('oped:route-change', event => {
    if (event.detail?.tab !== 'discovery') {
      state.collectionId = '';
      resetFilters();
    }
  });

  new MutationObserver(() => {
    if (!state.collectionId || state.rendering) return;
    if (!panel.querySelector(`[data-collection-album-view="${CSS.escape(state.collectionId)}"]`)) {
      window.setTimeout(renderDetail, 0);
    }
  }).observe(panel, { childList: true, subtree: true });
})();
