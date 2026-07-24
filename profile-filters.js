(() => {
  if (window.__OC_PROFILE_FILTERS_READY__) return;

  function fieldFor(id, root) {
    return root.querySelector(`#${id}`)?.closest('.oc-field') || null;
  }

  function initProfileFilters() {
    if (window.__OC_PROFILE_FILTERS_READY__) return;
    const bar = document.querySelector('#oc-profile-panel .oc-profile-filterbar');
    const grid = bar?.querySelector(':scope > .oc-filtergrid');
    if (!bar || !grid) return;

    const missing = grid.querySelector('#oc-p-missing');
    if (missing) {
      missing.checked = false;
      missing.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const mainIds = ['oc-p-search', 'oc-p-type', 'oc-p-score-cmp', 'oc-p-from-year', 'oc-p-to-year'];
    const advancedIds = ['oc-p-studio', 'oc-p-director', 'oc-p-performer', 'oc-p-franchise'];
    const mainFields = mainIds.map(id => fieldFor(id, grid)).filter((field, index, rows) => field && rows.indexOf(field) === index);
    const advancedFields = advancedIds.map(id => fieldFor(id, grid)).filter(Boolean);
    const reset = grid.querySelector('#oc-p-reset-filters');
    if (!mainFields.length || !advancedFields.length || !reset) return;

    const main = document.createElement('div');
    main.className = 'oc-profile-filter-main';
    mainFields.forEach(field => main.append(field));
    main.append(reset);

    const divider = document.createElement('div');
    divider.className = 'oc-profile-filter-divider';
    divider.innerHTML = '<span>Расширенные фильтры</span>';

    const advanced = document.createElement('div');
    advanced.className = 'oc-profile-filter-advanced';
    advancedFields.forEach(field => advanced.append(field));

    grid.replaceWith(main, divider, advanced);
    bar.classList.add('oc-profile-filterbar-polished');
    window.__OC_PROFILE_FILTERS_READY__ = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initProfileFilters, { once: true });
  else initProfileFilters();
})();
