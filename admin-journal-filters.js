(() => {
  if (window.__OC_ADMIN_JOURNAL_FILTERS_READY__) return;
  window.__OC_ADMIN_JOURNAL_FILTERS_READY__ = true;

  const STORAGE_KEY = 'oc-admin-journal-filters-v1';
  const journal = document.querySelector('#oc-admin-journal');
  const list = document.querySelector('#oc-admin-journal-list');
  if (!journal || !list) return;

  const collator = new Intl.Collator(['ru', 'en'], { numeric: true, sensitivity: 'base' });
  const normalize = value => String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const state = readState();
  let toolbar = null;
  let actionSelect = null;
  let targetSelect = null;
  let count = null;
  let empty = null;
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

  function eventEntries() {
    return [...list.querySelectorAll(':scope > .oc-admin-journal-entry')];
  }

  function actionFor(entry) {
    const title = normalize(entry.querySelector('.oc-admin-journal-entry-head h2')?.textContent);
    if (title.startsWith('добавлена:') || title.startsWith('добавлен:')) return 'create';
    if (title.startsWith('удалена:') || title.startsWith('удален:')) return 'delete';
    return 'update';
  }

  function fieldLabel(change) {
    return String(change.querySelector('strong')?.textContent || '').trim();
  }

  function fieldKey(label) {
    return normalize(label);
  }

  function changeRows(entry) {
    return [...entry.querySelectorAll('.oc-admin-journal-change')];
  }

  function fieldsFor(entry) {
    const labels = changeRows(entry).map(fieldLabel).filter(Boolean);
    return [...new Map(labels.map(label => [fieldKey(label), label])).values()];
  }

  function ensureUi() {
    if (toolbar?.isConnected) return;

    toolbar = document.createElement('div');
    toolbar.className = 'oc-admin-journal-filters';
    toolbar.innerHTML = `
      <label class="oc-admin-journal-filter">
        <span>Событие</span>
        <select id="oc-admin-journal-action-filter">
          <option value="">Все события</option>
          <option value="create">Добавлено</option>
          <option value="update">Изменено</option>
          <option value="delete">Удалено</option>
        </select>
      </label>
      <label class="oc-admin-journal-filter">
        <span>Что изменено</span>
        <select id="oc-admin-journal-target-filter"></select>
      </label>
      <button type="button" class="oc-admin-journal-filter-reset">Сбросить</button>
      <div class="oc-admin-journal-filter-count" aria-live="polite"></div>`;

    const head = journal.querySelector('.oc-admin-journal-head');
    head?.insertAdjacentElement('afterend', toolbar);

    empty = document.createElement('div');
    empty.className = 'oc-admin-journal-filter-empty';
    empty.hidden = true;
    empty.textContent = 'Для выбранных фильтров событий не найдено.';
    list.insertAdjacentElement('beforebegin', empty);

    actionSelect = toolbar.querySelector('#oc-admin-journal-action-filter');
    targetSelect = toolbar.querySelector('#oc-admin-journal-target-filter');
    count = toolbar.querySelector('.oc-admin-journal-filter-count');

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
    toolbar.querySelector('.oc-admin-journal-filter-reset')?.addEventListener('click', () => {
      state.action = '';
      state.target = '';
      actionSelect.value = '';
      buildTargetOptions();
      saveState();
      applyFilters();
    });
  }

  function buildTargetOptions() {
    ensureUi();
    const labels = new Map();
    eventEntries().forEach(entry => {
      fieldsFor(entry).forEach(label => labels.set(fieldKey(label), label));
    });
    const rows = [...labels.entries()].sort((left, right) => collator.compare(left[1], right[1]));
    const selected = state.target;
    targetSelect.innerHTML = `
      <option value="">Все изменения</option>
      <option value="whole">Трек целиком</option>
      <option value="fields">Любое отдельное поле</option>
      ${rows.map(([key, label]) => `<option value="field:${escapeAttribute(key)}">${escapeHtml(label)}</option>`).join('')}`;

    const exists = [...targetSelect.options].some(option => option.value === selected);
    if (exists) targetSelect.value = selected;
    else {
      state.target = '';
      targetSelect.value = '';
      saveState();
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
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
    ensureUi();
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

    const journalPlaceholder = list.querySelector(':scope > .oc-admin-journal-empty');
    const hasLoadedEvents = entries.length > 0;
    if (empty) empty.hidden = !hasLoadedEvents || visible > 0;
    if (count) count.textContent = hasLoadedEvents ? `Показано ${visible} из ${entries.length}` : '';
    if (journalPlaceholder) journalPlaceholder.hidden = hasLoadedEvents;
  }

  function refresh() {
    renderTimer = 0;
    ensureUi();
    buildTargetOptions();
    applyFilters();
  }

  function scheduleRefresh() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(refresh, 20);
  }

  new MutationObserver(scheduleRefresh).observe(list, { childList: true, subtree: true });
  refresh();
})();
