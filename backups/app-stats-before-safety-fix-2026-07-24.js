import { productState, subscribeProductState } from './state.js';
import { navigateTab } from './router.js';

const SEASON_LABEL = { winter:'Зима', spring:'Весна', summer:'Лето', fall:'Осень' };
let metric = 'score';
let minTracks = 3;
let scheduled = false;
let rendering = false;

function average(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
}

function ratingsByOpening() {
  const map = new Map();
  productState.ratings.forEach(rating => {
    const id = String(rating.openingId || '');
    if (!id) return;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(rating);
  });
  return map;
}

function trackMetric(opening, ratingMap) {
  const rows = ratingMap.get(String(opening.id)) || [];
  const values = rows.map(row => row?.[metric]).map(Number).filter(Number.isFinite);
  if (values.length < 3) return null;
  return average(values);
}

function groupRows(openings, getter) {
  const ratingMap = ratingsByOpening();
  const groups = new Map();
  openings.forEach(opening => {
    const value = trackMetric(opening, ratingMap);
    if (value === null) return;
    const keys = getter(opening).map(String).map(value => value.trim()).filter(Boolean);
    keys.forEach(key => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(value);
    });
  });
  return [...groups.entries()]
    .map(([key, values]) => ({ key, count: values.length, mean: average(values) }))
    .filter(row => row.count >= minTracks)
    .sort((a, b) => b.mean - a.mean || b.count - a.count || a.key.localeCompare(b.key, 'ru'))
    .slice(0, 50);
}

function renderTable(selector, rows, kind) {
  const root = document.querySelector(selector);
  if (!root) return;
  if (!rows.length) {
    root.innerHTML = `<div class="oc-empty">Нет групп с минимум ${minTracks} треками для выбранной метрики.</div>`;
    return;
  }
  root.innerHTML = rows.map((row, index) => `
    <button type="button" class="oc-stats-row oc-stats-row-link" data-stat-kind="${kind}" data-stat-value="${String(row.key).replace(/"/g, '&quot;')}">
      <span class="oc-stats-rank">${index + 1}</span>
      <span class="oc-stats-name" title="${String(row.key).replace(/"/g, '&quot;')}">${row.key}</span>
      <span class="oc-stats-score">${row.mean.toFixed(2)}</span>
      <span class="oc-stats-count">${row.count} трек.</span>
      <span class="oc-stats-open">→</span>
    </button>`).join('');
}

function currentType() { return document.querySelector('#oc-stats-type')?.value || ''; }

function render() {
  if (rendering) return;
  const panel = document.querySelector('#oc-stats-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  rendering = true;
  try {
    const type = currentType();
    const base = productState.openings.filter(opening => !type || opening.type === type);
    renderTable('#oc-stats-performers', groupRows(base, opening => opening.performers || []), 'performer');
    renderTable('#oc-stats-song-performers', groupRows(base, opening => opening.performers || []), 'performer');
    renderTable('#oc-stats-studios', groupRows(base, opening => opening.studios || []), 'studio');
    renderTable('#oc-stats-directors', groupRows(base, opening => opening.directors || []), 'director');
    renderTable('#oc-stats-seasons', groupRows(base, opening => opening.year && opening.season ? [`${SEASON_LABEL[opening.season]} ${opening.year}`] : []), 'season');
    renderTable('#oc-stats-franchises', groupRows(base, opening => opening.franchises || []), 'franchise');
    panel.dataset.statsEnhanced = '1';
  } finally { rendering = false; }
}

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; render(); });
}

function ensureControls() {
  const controls = document.querySelector('#oc-stats-panel .oc-tier-controls');
  if (!controls || controls.querySelector('[data-stats-metric]')) return;
  const metricSelect = document.createElement('select');
  metricSelect.dataset.statsMetric = '1';
  metricSelect.title = 'Какую оценку усреднять';
  metricSelect.innerHTML = '<option value="score">Общая</option><option value="songScore">Песня</option><option value="visualScore">Визуал</option>';
  const minSelect = document.createElement('select');
  minSelect.dataset.statsMin = '1';
  minSelect.title = 'Минимум треков в группе';
  minSelect.innerHTML = '<option value="3">Минимум 3 трека</option><option value="5">Минимум 5 треков</option><option value="10">Минимум 10 треков</option><option value="20">Минимум 20 треков</option>';
  controls.prepend(minSelect);
  controls.prepend(metricSelect);
  metricSelect.addEventListener('change', () => { metric = metricSelect.value; scheduleRender(); });
  minSelect.addEventListener('change', () => { minTracks = Number(minSelect.value) || 3; scheduleRender(); });
  document.querySelector('#oc-stats-type')?.addEventListener('change', scheduleRender);
}

function setMultiFilter(id, value) {
  const select = document.querySelector(id);
  if (!select) return;
  [...select.options].forEach(option => { option.selected = option.value === value; });
  select.dispatchEvent(new Event('change', { bubbles: true }));
}
function clearMainFilters() { document.querySelector('#oc-reset-filters')?.click(); }
function filterCatalog(kind, value) {
  navigateTab('chart');
  clearMainFilters();
  window.setTimeout(() => {
    const type = currentType();
    if (type) {
      const typeSelect = document.querySelector('#oc-f-type');
      if (typeSelect) { typeSelect.value = type; typeSelect.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    if (kind === 'performer') setMultiFilter('#oc-f-performer', value);
    if (kind === 'studio') setMultiFilter('#oc-f-studio', value);
    if (kind === 'director') setMultiFilter('#oc-f-director', value);
    if (kind === 'franchise') setMultiFilter('#oc-f-franchise', value);
    if (kind === 'season') {
      const match = String(value).match(/^(Зима|Весна|Лето|Осень)\s+(\d{4})$/);
      if (match) {
        const season = ({ Зима:'winter', Весна:'spring', Лето:'summer', Осень:'fall' })[match[1]];
        [['#oc-f-from-year',match[2]],['#oc-f-to-year',match[2]],['#oc-f-from-season',season],['#oc-f-to-season',season]].forEach(([selector,next]) => {
          const element = document.querySelector(selector); if (!element) return; element.value = next; element.dispatchEvent(new Event('change',{bubbles:true}));
        });
      }
    }
    document.querySelector('#oc-main-panel')?.scrollIntoView({ behavior:'smooth', block:'start' });
  },40);
}

export function initStatsEnhancements() {
  ensureControls();
  document.querySelector('#oc-stats-panel')?.addEventListener('click', event => {
    const row = event.target.closest('[data-stat-kind]');
    if (row) filterCatalog(row.dataset.statKind, row.dataset.statValue || '');
  });
  const grid = document.querySelector('#oc-stats-panel .oc-stats-grid');
  if (grid) new MutationObserver(() => { if (!rendering) scheduleRender(); }).observe(grid, { childList:true, subtree:true });
  subscribeProductState(() => scheduleRender());
  document.addEventListener('click', event => { if (event.target.closest('[data-shell-tab="stats"],.oc-tab-btn[data-tab="stats"]')) window.setTimeout(scheduleRender,30); });
}
