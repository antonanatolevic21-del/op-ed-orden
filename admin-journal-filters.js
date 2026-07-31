(() => {
  if (window.__OC_ADMIN_JOURNAL_FILTERS_READY__) return;
  window.__OC_ADMIN_JOURNAL_FILTERS_READY__ = true;

  const STORAGE_KEY = 'oc-admin-journal-filters-v1';
  const journal = document.querySelector('#oc-admin-journal');
  const list = document.querySelector('#oc-admin-journal-list');
  const toolbar = journal?.querySelector('.oc-admin-journal-filters');
  const actionSelect = toolbar?.querySelector('#oc-admin-journal-action-filter');
  const targetSelect = toolbar?.querySelector('#oc-admin-journal-target-filter');
  const resetButton = toolbar?.querySelector('.oc-admin-journal-filter-reset');
  const count = toolbar?.querySelector('.oc-admin-journal-filter-count');
  const empty = journal?.querySelector('.oc-admin-journal-filter-empty');
  if (!journal || !list || !toolbar || !actionSelect || !targetSelect) return;

  const collator = new Intl.Collator(['ru', 'en'], { numeric: true, sensitivity: 'base' });
  const normalize = value => String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const knownFields = new Map();
  const state = readState();
  let renderTimer = 0;

  function readState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
      return {
        action: ['create', 'update', 'delete'].includes(saved?.action) ? saved.action : '',
        target: typeof saved?.target === 'string' ? saved.target : ''
      };
    } catch (_) {
      return { action: '', target: '' };
    }
  }

  function saveState() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function eventEntries() {
    return [...list.querySelectorAll(':scope > .oc-admin-journal-entry')];
  }

  function actionFor(entry) {
    const title = normalize(entry.querySelector('.oc-admin-journal-entry-head h2')?.textContent);
    if (title.startsWith('добавлена:') || title.startsWith('добавлен:')) return 'create';
    if (title.startsWith('удалена:') || title.startsWith('удален:')) return 'delete';
    return 'update';
  }

  function changeRows(entry) {
    return [...entry.querySelectorAll('.oc-admin-journal-change')];
  }

  function fieldLabel(change) {
    return String(change.querySelector('strong')?.textContent || '').trim();
  }

  function fieldKey(label) {
    return normalize(label);
  }

  function fieldsFor(entry) {
    const labels = changeRows(entry).map(fieldLabel).filter(Boolean);
    return [...new Map(labels.map(label => [fieldKey(label), label])).values()];
  }

  function buildTargetOptions() {
    eventEntries().forEach(entry => {
      fieldsFor(entry).forEach(label => knownFields.set(fieldKey(label), label));
    });

    const selected = state.target;
    const fields = [...knownFields.entries()].sort((left, right) => collator.compare(left[1], right[1]));
    targetSelect.innerHTML = `
      <option value="">Все изменения</option>
      <option value="whole">Трек целиком</option>
      <option value="fields">Любое отдельное поле</option>
      ${fields.map(([key, label]) => `<option value="field:${escapeHtml(key)}">${escapeHtml(label)}</option>`).join('')}`;

    if ([...targetSelect.options].some(option => option.value === selected)) {
      targetSelect.value = selected;
    } else {
      state.target = '';
      targetSelect.value = '';
      saveState();
    }
  }

  function matchesTarget(entry) {
    if (!state.target) return true;
    const fields = fieldsFor(entry).map(fieldKey);
    if (state.target === 'whole') return fields.length === 0;
    if (state.target === 'fields') return fields.length > 0;
    if (state.target.startsWith('field:')) return fields.includes(state.target.slice(6));
    return true;
  }

  function syncVisibleChanges(entry) {
    const selectedField = state.target.startsWith('field:') ? state.target.slice(6) : '';
    changeRows(entry).forEach(change => {
      change.hidden = Boolean(selectedField && fieldKey(fieldLabel(change)) !== selectedField);
    });
  }

  function applyFilters() {
    const entries = eventEntries();
    let visible = 0;

    entries.forEach(entry => {
      const matched = (!state.action || actionFor(entry) === state.action) && matchesTarget(entry);
      entry.hidden = !matched;
      if (matched) {
        visible += 1;
        syncVisibleChanges(entry);
      } else {
        changeRows(entry).forEach(change => { change.hidden = false; });
      }
    });

    const placeholder = list.querySelector(':scope > .oc-admin-journal-empty');
    const loaded = entries.length > 0;
    if (empty) empty.hidden = !loaded || visible > 0;
    if (count) count.textContent = loaded ? `Показано ${visible} из ${entries.length}` : '';
    if (placeholder) placeholder.hidden = loaded;
  }

  function refresh() {
    renderTimer = 0;
    buildTargetOptions();
    applyFilters();
  }

  function scheduleRefresh() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(refresh, 20);
  }

  actionSelect.value = state.action;
  actionSelect.addEventListener('change', () => {
    state.action = actionSelect.value;
    saveState();
    applyFilters();
  });
  targetSelect.addEventListener('change', () => {
    state.target = targetSelect.value;
    saveState();
    applyFilters();
  });
  resetButton?.addEventListener('click', () => {
    state.action = '';
    state.target = '';
    actionSelect.value = '';
    saveState();
    buildTargetOptions();
    applyFilters();
  });

  new MutationObserver(scheduleRefresh).observe(list, { childList: true, subtree: true });
  refresh();
})();
