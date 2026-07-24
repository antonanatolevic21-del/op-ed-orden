(() => {
  if (window.__OC_STATS_LITE_READY__) return;

  const TABLES = [
    { id: 'oc-stats-performers', kind: 'performer' },
    { id: 'oc-stats-song-performers', kind: 'performer' },
    { id: 'oc-stats-studios', kind: 'studio' },
    { id: 'oc-stats-directors', kind: 'director' },
    { id: 'oc-stats-seasons', kind: 'season' },
    { id: 'oc-stats-franchises', kind: 'franchise' }
  ];

  const SEASONS = {
    'зима': 'winter',
    'весна': 'spring',
    'лето': 'summer',
    'осень': 'fall'
  };

  function panel() {
    return document.querySelector('#oc-stats-panel');
  }

  function minTracks() {
    return Math.max(3, Number(document.querySelector('#oc-stats-lite-min')?.value || 3));
  }

  function rowLimit() {
    return Math.max(5, Number(document.querySelector('#oc-stats-lite-limit')?.value || 20));
  }

  function rowCount(row) {
    const raw = String(row.querySelector('.oc-stats-count')?.textContent || '');
    const match = raw.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function applyPresentation() {
    const root = panel();
    if (!root || root.classList.contains('hidden')) return;

    const minimum = minTracks();
    const limit = rowLimit();
    let visibleTotal = 0;

    TABLES.forEach(table => {
      const container = document.getElementById(table.id);
      if (!container) return;
      const rows = [...container.querySelectorAll('.oc-stats-row')];
      let shown = 0;

      rows.forEach(row => {
        const show = rowCount(row) >= minimum && shown < limit;
        row.classList.toggle('oc-stats-lite-hidden', !show);
        if (show) {
          shown += 1;
          visibleTotal += 1;
        }
      });

      const box = container.closest('.oc-stats-box');
      box?.classList.toggle('oc-stats-lite-empty', rows.length > 0 && shown === 0);
    });

    const status = document.querySelector('#oc-stats-lite-status');
    if (status) status.textContent = `Облегчённый режим · без дополнительных запросов к базе · показано ${visibleTotal} строк`;

    const hint = root.querySelector('.oc-stats-head .oc-tier-hint');
    if (hint) hint.textContent = `Треки уже рассчитаны основным сайтом. Здесь только отбор готовых строк: минимум ${minimum} треков в группе, без повторной загрузки ratings.`;
  }

  function fireChange(element) {
    if (!element) return;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setSingleSelect(selector, value) {
    const select = document.querySelector(selector);
    if (!select) return;
    select.value = value;
    fireChange(select);
  }

  function setMultiSelect(selector, value) {
    const select = document.querySelector(selector);
    if (!select) return;
    const wanted = String(value || '').trim().toLowerCase().replace(/ё/g, 'е');
    let found = false;
    [...select.options].forEach(option => {
      const optionValue = String(option.value || '').trim().toLowerCase().replace(/ё/g, 'е');
      const optionText = String(option.textContent || '').trim().toLowerCase().replace(/ё/g, 'е');
      option.selected = !found && (optionValue === wanted || optionText === wanted);
      if (option.selected) found = true;
    });
    fireChange(select);
  }

  function openCatalog(kind, value) {
    const type = document.querySelector('#oc-stats-type')?.value || '';
    document.querySelector('.oc-tab-btn[data-tab="chart"]')?.click();
    document.querySelector('#oc-reset-filters')?.click();

    window.setTimeout(() => {
      if (type) setSingleSelect('#oc-f-type', type);

      if (kind === 'performer') setMultiSelect('#oc-f-performer', value);
      if (kind === 'studio') setMultiSelect('#oc-f-studio', value);
      if (kind === 'director') setMultiSelect('#oc-f-director', value);
      if (kind === 'franchise') setMultiSelect('#oc-f-franchise', value);

      if (kind === 'season') {
        const match = String(value || '').trim().match(/^(Зима|Весна|Лето|Осень)\s+(\d{4})$/i);
        if (match) {
          const season = SEASONS[match[1].toLowerCase()] || '';
          const year = match[2];
          setSingleSelect('#oc-f-from-year', year);
          setSingleSelect('#oc-f-to-year', year);
          if (season) {
            setSingleSelect('#oc-f-from-season', season);
            setSingleSelect('#oc-f-to-season', season);
          }
        }
      }
    }, 0);
  }

  function ensureControls() {
    const root = panel();
    const controls = root?.querySelector('.oc-stats-head .oc-tier-controls');
    if (!root || !controls) return false;

    if (!document.querySelector('#oc-stats-lite-min')) {
      const minimum = document.createElement('select');
      minimum.id = 'oc-stats-lite-min';
      minimum.className = 'oc-stats-lite-select';
      minimum.setAttribute('aria-label', 'Минимум треков в группе');
      minimum.innerHTML = '<option value="3">Минимум: 3 трека</option><option value="5">Минимум: 5 треков</option><option value="10">Минимум: 10 треков</option><option value="20">Минимум: 20 треков</option>';
      controls.append(minimum);
      minimum.addEventListener('change', applyPresentation);
    }

    if (!document.querySelector('#oc-stats-lite-limit')) {
      const limit = document.createElement('select');
      limit.id = 'oc-stats-lite-limit';
      limit.className = 'oc-stats-lite-select';
      limit.setAttribute('aria-label', 'Количество строк в каждой таблице');
      limit.innerHTML = '<option value="10">Показывать: 10</option><option value="20" selected>Показывать: 20</option><option value="50">Показывать: 50</option>';
      controls.append(limit);
      limit.addEventListener('change', applyPresentation);
    }

    if (!document.querySelector('#oc-stats-lite-status')) {
      const status = document.createElement('div');
      status.id = 'oc-stats-lite-status';
      status.className = 'oc-stats-lite-status';
      root.querySelector('.oc-stats-head > div:first-child')?.append(status);
    }

    root.classList.add('oc-stats-lite-ready');
    return true;
  }

  function bindRows() {
    const root = panel();
    if (!root) return;
    root.addEventListener('click', event => {
      const row = event.target.closest('.oc-stats-row');
      if (!row || row.classList.contains('oc-stats-lite-hidden')) return;
      const container = row.parentElement;
      const config = TABLES.find(table => table.id === container?.id);
      if (!config) return;
      const name = String(row.querySelector('.oc-stats-name')?.textContent || '').trim();
      if (name) openCatalog(config.kind, name);
    });
  }

  function queueApply() {
    window.setTimeout(applyPresentation, 0);
  }

  function init() {
    if (window.__OC_STATS_LITE_READY__) return;
    if (!ensureControls()) return;
    bindRows();

    document.querySelector('#oc-stats-type')?.addEventListener('change', queueApply);
    document.querySelector('#oc-scale-select')?.addEventListener('change', queueApply);
    document.addEventListener('click', event => {
      if (event.target.closest('.oc-tab-btn[data-tab="stats"]')) queueApply();
    });

    window.__OC_STATS_LITE_READY__ = true;
    queueApply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
