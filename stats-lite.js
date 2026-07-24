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

  function init() {
    if (window.__OC_STATS_LITE_READY__) return;
    const root = document.querySelector('#oc-stats-panel');
    if (!root) return;

    root.classList.add('oc-stats-lite-ready');
    root.addEventListener('click', event => {
      const row = event.target.closest('.oc-stats-row');
      if (!row) return;
      const container = row.parentElement;
      const config = TABLES.find(table => table.id === container?.id);
      if (!config) return;
      const name = String(row.querySelector('.oc-stats-name')?.textContent || '').trim();
      if (name) openCatalog(config.kind, name);
    });

    window.__OC_STATS_LITE_READY__ = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
