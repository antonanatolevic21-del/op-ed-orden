(() => {
  if (window.__OC_EXTENDED_STATS_READY__) return;

  const MIN_TRACK_VOTES = 3;
  const SEASON_LABEL = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  const METRICS = {
    score: { label: 'общая оценка', short: 'Общая' },
    songScore: { label: 'оценка песни', short: 'Песня' },
    visualScore: { label: 'оценка визуала', short: 'Визуал' }
  };

  const state = {
    openings: [],
    metricByOpening: new Map(),
    ratingsCount: 0,
    loaded: false,
    loadingPromise: null,
    rendering: false
  };

  function panel() {
    return document.querySelector('#oc-stats-panel');
  }

  function visible() {
    const root = panel();
    return Boolean(root && !root.classList.contains('hidden'));
  }

  function waitForDb() {
    if (window.OPED_DB) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('OPED_DB did not become ready')), 12000);
      window.addEventListener('oped-db-ready', () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }

  function metricBucket() {
    return {
      score: { sum: 0, count: 0 },
      songScore: { sum: 0, count: 0 },
      visualScore: { sum: 0, count: 0 }
    };
  }

  function cleanArray(value) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  }

  function usableScore(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0.5 || number > 10) return null;
    return number;
  }

  async function buildMetricIndex(ratings) {
    const map = new Map();
    for (let index = 0; index < ratings.length; index += 1) {
      const rating = ratings[index];
      const openingId = String(rating.openingId || '').trim();
      if (!openingId) continue;
      let bucket = map.get(openingId);
      if (!bucket) {
        bucket = metricBucket();
        map.set(openingId, bucket);
      }
      Object.keys(METRICS).forEach(field => {
        const value = usableScore(rating[field]);
        if (value === null) return;
        bucket[field].sum += value;
        bucket[field].count += 1;
      });
      if (index > 0 && index % 3000 === 0) await new Promise(resolve => window.setTimeout(resolve, 0));
    }
    return map;
  }

  async function loadDataOnce() {
    if (state.loaded) return state;
    if (state.loadingPromise) return state.loadingPromise;

    state.loadingPromise = (async () => {
      await waitForDb();
      const [{ getApp }, { getFirestore, collection, getDocs }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
      ]);
      const db = getFirestore(getApp());
      const [openingSnapshot, ratingSnapshot] = await Promise.all([
        getDocs(collection(db, 'openings')),
        getDocs(collection(db, 'ratings'))
      ]);
      const openings = openingSnapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      const ratings = ratingSnapshot.docs.map(document => document.data());
      state.metricByOpening = await buildMetricIndex(ratings);
      state.openings = openings;
      state.ratingsCount = ratings.length;
      state.loaded = true;
      return state;
    })().finally(() => {
      state.loadingPromise = null;
    });

    return state.loadingPromise;
  }

  function currentMetric() {
    return document.querySelector('#oc-stats-metric')?.value || 'score';
  }

  function currentMinTracks() {
    return Math.max(3, Number(document.querySelector('#oc-stats-min-tracks')?.value || 3));
  }

  function currentType() {
    return document.querySelector('#oc-stats-type')?.value || '';
  }

  function groupPush(map, key, trackMean) {
    const clean = String(key || '').trim();
    if (!clean) return;
    let row = map.get(clean);
    if (!row) {
      row = { key: clean, sum: 0, count: 0 };
      map.set(clean, row);
    }
    row.sum += trackMean;
    row.count += 1;
  }

  function groupKeys(opening) {
    return {
      performer: cleanArray(opening.performers),
      studio: cleanArray(opening.studios),
      director: cleanArray(opening.directors),
      franchise: cleanArray(opening.franchises),
      season: opening.year && opening.season ? [`${SEASON_LABEL[opening.season] || opening.season} ${opening.year}`] : []
    };
  }

  function calculateGroups() {
    const metric = currentMetric();
    const type = currentType();
    const minTracks = currentMinTracks();
    const maps = {
      performer: new Map(),
      studio: new Map(),
      director: new Map(),
      season: new Map(),
      franchise: new Map()
    };

    state.openings.forEach(opening => {
      if (type && opening.type !== type) return;
      const metricRow = state.metricByOpening.get(String(opening.id))?.[metric];
      if (!metricRow || metricRow.count < MIN_TRACK_VOTES) return;
      const trackMean = metricRow.sum / metricRow.count;
      const keys = groupKeys(opening);
      Object.entries(keys).forEach(([kind, values]) => {
        [...new Set(values)].forEach(value => groupPush(maps[kind], value, trackMean));
      });
    });

    const finish = map => [...map.values()]
      .map(row => ({ key: row.key, count: row.count, mean: row.sum / row.count }))
      .filter(row => row.count >= minTracks)
      .sort((a, b) => b.mean - a.mean || b.count - a.count || a.key.localeCompare(b.key, 'ru'))
      .slice(0, 100);

    return Object.fromEntries(Object.entries(maps).map(([kind, map]) => [kind, finish(map)]));
  }

  function renderTable(selector, rows, kind) {
    const root = document.querySelector(selector);
    if (!root) return;
    root.replaceChildren();

    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'oc-extended-stats-empty';
      empty.textContent = `Нет групп с минимум ${currentMinTracks()} подходящими треками.`;
      root.append(empty);
      return;
    }

    rows.forEach((row, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'oc-stats-row oc-extended-stat-row';
      button.dataset.extendedStat = '1';
      button.dataset.statKind = kind;
      button.dataset.statValue = row.key;
      button.title = 'Открыть каталог с этим фильтром';

      const rank = document.createElement('span');
      rank.className = 'oc-stats-rank';
      rank.textContent = String(index + 1);
      const name = document.createElement('span');
      name.className = 'oc-stats-name';
      name.textContent = row.key;
      name.title = row.key;
      const score = document.createElement('span');
      score.className = 'oc-stats-score';
      score.textContent = row.mean.toFixed(2);
      const count = document.createElement('span');
      count.className = 'oc-stats-count';
      count.textContent = `${row.count} трек.`;
      const open = document.createElement('span');
      open.className = 'oc-extended-stat-open';
      open.setAttribute('aria-hidden', 'true');
      open.textContent = '→';
      button.append(rank, name, score, count, open);
      root.append(button);
    });
  }

  function status(text, mode = '') {
    const element = document.querySelector('#oc-extended-stats-status');
    if (!element) return;
    element.textContent = text;
    element.className = `oc-extended-stats-status${mode ? ` ${mode}` : ''}`;
  }

  function updateHint() {
    const root = panel();
    const hint = root?.querySelector('.oc-stats-head .oc-tier-hint');
    if (!hint) return;
    const metric = METRICS[currentMetric()] || METRICS.score;
    hint.textContent = `Метрика: ${metric.label}. У каждого трека должно быть минимум ${MIN_TRACK_VOTES} оценки по этой метрике. В таблице показываются группы с минимум ${currentMinTracks()} такими треками.`;
  }

  function render() {
    if (!state.loaded || state.rendering || !visible()) return;
    state.rendering = true;
    try {
      const groups = calculateGroups();
      renderTable('#oc-stats-performers', groups.performer, 'performer');
      renderTable('#oc-stats-studios', groups.studio, 'studio');
      renderTable('#oc-stats-directors', groups.director, 'director');
      renderTable('#oc-stats-seasons', groups.season, 'season');
      renderTable('#oc-stats-franchises', groups.franchise, 'franchise');
      panel()?.classList.add('oc-extended-stats-ready');
      updateHint();
      status(`Загружено один раз: ${state.openings.length} треков · ${state.ratingsCount} документов оценок. При старте сайта статистика базу не читает.`);
    } finally {
      state.rendering = false;
    }
  }

  function ensureControls() {
    const root = panel();
    const controls = root?.querySelector('.oc-stats-head .oc-tier-controls');
    const type = document.querySelector('#oc-stats-type');
    if (!root || !controls || !type) return;

    if (!document.querySelector('#oc-stats-metric')) {
      const metric = document.createElement('select');
      metric.id = 'oc-stats-metric';
      metric.className = 'oc-extended-stats-select';
      metric.setAttribute('aria-label', 'Метрика статистики');
      metric.innerHTML = '<option value="score">Метрика: общая</option><option value="songScore">Метрика: песня</option><option value="visualScore">Метрика: визуал</option>';
      controls.insertBefore(metric, type);
      metric.addEventListener('change', render);
    }

    if (!document.querySelector('#oc-stats-min-tracks')) {
      const minTracks = document.createElement('select');
      minTracks.id = 'oc-stats-min-tracks';
      minTracks.className = 'oc-extended-stats-select';
      minTracks.setAttribute('aria-label', 'Минимум треков в группе');
      minTracks.innerHTML = '<option value="3">Минимум: 3 трека</option><option value="5">Минимум: 5 треков</option><option value="10">Минимум: 10 треков</option><option value="20">Минимум: 20 треков</option>';
      controls.insertBefore(minTracks, type);
      minTracks.addEventListener('change', render);
    }

    if (!document.querySelector('#oc-extended-stats-status')) {
      const statusElement = document.createElement('div');
      statusElement.id = 'oc-extended-stats-status';
      statusElement.className = 'oc-extended-stats-status';
      root.querySelector('.oc-stats-head > div:first-child')?.append(statusElement);
    }

    const legacySong = document.querySelector('#oc-stats-song-performers')?.closest('.oc-stats-box');
    legacySong?.classList.add('oc-extended-stats-legacy-song');
    type.addEventListener('change', () => window.setTimeout(render, 0));
  }

  function findOption(select, wanted) {
    const normalized = String(wanted || '').trim().toLowerCase().replace(/ё/g, 'е');
    return [...(select?.options || [])].find(option => {
      const value = String(option.value || '').trim().toLowerCase().replace(/ё/g, 'е');
      const text = String(option.textContent || '').trim().toLowerCase().replace(/ё/g, 'е');
      return value === normalized || text === normalized;
    }) || null;
  }

  function setMulti(selector, value) {
    const select = document.querySelector(selector);
    if (!select) return;
    [...select.options].forEach(option => { option.selected = false; });
    const option = findOption(select, value);
    if (option) option.selected = true;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setSelect(selector, value) {
    const select = document.querySelector(selector);
    if (!select) return;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function openCatalog(kind, value) {
    const statsType = currentType();
    document.querySelector('.oc-tab-btn[data-tab="chart"]')?.click();
    document.querySelector('#oc-reset-filters')?.click();

    window.setTimeout(() => {
      if (statsType) setSelect('#oc-f-type', statsType);
      if (kind === 'performer') setMulti('#oc-f-performer', value);
      if (kind === 'studio') setMulti('#oc-f-studio', value);
      if (kind === 'director') setMulti('#oc-f-director', value);
      if (kind === 'franchise') setMulti('#oc-f-franchise', value);
      if (kind === 'season') {
        const match = String(value).match(/^(Зима|Весна|Лето|Осень)\s+(\d{4})$/);
        if (match) {
          const season = { Зима: 'winter', Весна: 'spring', Лето: 'summer', Осень: 'fall' }[match[1]];
          setSelect('#oc-f-from-year', match[2]);
          setSelect('#oc-f-to-year', match[2]);
          setSelect('#oc-f-from-season', season);
          setSelect('#oc-f-to-season', season);
        }
      }
      document.querySelector('#oc-main-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  }

  async function activate() {
    ensureControls();
    if (state.loaded) {
      render();
      return;
    }
    status('Загружаю расширенную статистику только сейчас…', 'loading');
    try {
      await loadDataOnce();
      render();
    } catch (error) {
      console.error('Extended statistics loading failed', error);
      status('Не удалось загрузить расширенную статистику. Базовая статистика сайта остаётся доступна.', 'error');
    }
  }

  function legacyRowsPresent() {
    return ['#oc-stats-performers', '#oc-stats-studios', '#oc-stats-directors', '#oc-stats-seasons', '#oc-stats-franchises']
      .some(selector => document.querySelector(`${selector} .oc-stats-row:not([data-extended-stat])`));
  }

  function init() {
    if (window.__OC_EXTENDED_STATS_READY__) return;
    const root = panel();
    if (!root) return;
    ensureControls();

    document.addEventListener('click', event => {
      if (event.target.closest('.oc-tab-btn[data-tab="stats"]')) window.setTimeout(() => { void activate(); }, 0);
      const row = event.target.closest('[data-extended-stat][data-stat-kind]');
      if (row) openCatalog(row.dataset.statKind, row.dataset.statValue || '');
    });

    new MutationObserver(() => {
      if (visible()) void activate();
    }).observe(root, { attributes: true, attributeFilter: ['class'] });

    const grid = root.querySelector('.oc-stats-grid');
    if (grid) {
      new MutationObserver(() => {
        if (!state.loaded || state.rendering || !visible() || !legacyRowsPresent()) return;
        requestAnimationFrame(render);
      }).observe(grid, { childList: true, subtree: true });
    }

    if (visible()) void activate();
    window.__OC_EXTENDED_STATS_READY__ = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
