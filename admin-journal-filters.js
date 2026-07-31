(() => {
  if (window.__OC_ADMIN_JOURNAL_FILTERS_READY__) return;
  window.__OC_ADMIN_JOURNAL_FILTERS_READY__ = true;

  const STORAGE_KEY = 'oc-admin-journal-filters-v2';
  const PAGE_SIZE = 100;
  const journal = document.querySelector('#oc-admin-journal');
  const list = document.querySelector('#oc-admin-journal-list');
  const toolbar = journal?.querySelector('.oc-admin-journal-filters');
  const actionSelect = toolbar?.querySelector('#oc-admin-journal-action-filter');
  const targetSelect = toolbar?.querySelector('#oc-admin-journal-target-filter');
  const actorSelect = toolbar?.querySelector('#oc-admin-journal-actor-filter');
  const fromInput = toolbar?.querySelector('#oc-admin-journal-from-filter');
  const toInput = toolbar?.querySelector('#oc-admin-journal-to-filter');
  const resetButton = toolbar?.querySelector('.oc-admin-journal-filter-reset');
  const count = toolbar?.querySelector('.oc-admin-journal-filter-count');
  const empty = journal?.querySelector('.oc-admin-journal-filter-empty');
  const pagination = journal?.querySelector('.oc-admin-journal-pagination');
  const prevButton = pagination?.querySelector('[data-admin-journal-page="prev"]');
  const nextButton = pagination?.querySelector('[data-admin-journal-page="next"]');
  const pageLabel = pagination?.querySelector('.oc-admin-journal-page-label');
  if (!journal || !list || !toolbar || !actionSelect || !targetSelect || !actorSelect || !fromInput || !toInput) return;

  const collator = new Intl.Collator(['ru', 'en'], { numeric: true, sensitivity: 'base' });
  const normalize = value => String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const knownFields = new Map();
  const knownActors = new Map();
  const state = readState();
  let renderTimer = 0;

  function readState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
      return {
        action: ['create', 'update', 'delete'].includes(saved?.action) ? saved.action : '',
        target: typeof saved?.target === 'string' ? saved.target : '',
        actor: typeof saved?.actor === 'string' ? saved.actor : '',
        from: typeof saved?.from === 'string' ? saved.from : '',
        to: typeof saved?.to === 'string' ? saved.to : '',
        page: Math.max(1, Number(saved?.page) || 1)
      };
    } catch (_) {
      return { action: '', target: '', actor: '', from: '', to: '', page: 1 };
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

  function actorFor(entry) {
    return String(entry.querySelector('.oc-admin-journal-entry-head small')?.textContent || '')
      .split('·')[0]
      .trim() || 'админ';
  }

  function timestampFor(entry) {
    const time = entry.querySelector('.oc-admin-journal-entry-head time');
    const machineValue = String(time?.getAttribute('datetime') || '').trim();
    if (machineValue) {
      const parsed = new Date(machineValue).getTime();
      if (Number.isFinite(parsed)) return parsed;
    }

    const text = String(time?.textContent || '').trim();
    const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return null;
    const [, day, month, year, hour, minute, second = '0'] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  function inputTimestamp(value, endOfMinute = false) {
    const clean = String(value || '').trim();
    if (!clean) return null;
    const parsed = new Date(clean).getTime();
    if (!Number.isFinite(parsed)) return null;
    return parsed + (endOfMinute ? 59999 : 0);
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

  function buildDynamicOptions() {
    eventEntries().forEach(entry => {
      fieldsFor(entry).forEach(label => knownFields.set(fieldKey(label), label));
      const actor = actorFor(entry);
      knownActors.set(normalize(actor), actor);
    });

    const selectedTarget = state.target;
    const fields = [...knownFields.entries()].sort((left, right) => collator.compare(left[1], right[1]));
    targetSelect.innerHTML = `
      <option value="">Все изменения</option>
      <option value="whole">Трек целиком</option>
      <option value="fields">Любое отдельное поле</option>
      ${fields.map(([key, label]) => `<option value="field:${escapeHtml(key)}">${escapeHtml(label)}</option>`).join('')}`;
    if ([...targetSelect.options].some(option => option.value === selectedTarget)) targetSelect.value = selectedTarget;
    else state.target = '';

    const selectedActor = state.actor;
    const actors = [...knownActors.entries()].sort((left, right) => collator.compare(left[1], right[1]));
    actorSelect.innerHTML = `<option value="">Все пользователи</option>${actors.map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`).join('')}`;
    if ([...actorSelect.options].some(option => option.value === selectedActor)) actorSelect.value = selectedActor;
    else state.actor = '';

    saveState();
  }

  function matchesTarget(entry) {
    if (!state.target) return true;
    const fields = fieldsFor(entry).map(fieldKey);
    if (state.target === 'whole') return fields.length === 0;
    if (state.target === 'fields') return fields.length > 0;
    if (state.target.startsWith('field:')) return fields.includes(state.target.slice(6));
    return true;
  }

  function matchesDate(entry) {
    const from = inputTimestamp(state.from, false);
    const to = inputTimestamp(state.to, true);
    if (from === null && to === null) return true;
    const timestamp = timestampFor(entry);
    if (timestamp === null) return false;
    return (from === null || timestamp >= from) && (to === null || timestamp <= to);
  }

  function syncVisibleChanges(entry) {
    const selectedField = state.target.startsWith('field:') ? state.target.slice(6) : '';
    changeRows(entry).forEach(change => {
      change.hidden = Boolean(selectedField && fieldKey(fieldLabel(change)) !== selectedField);
    });
  }

  function applyFilters() {
    const entries = eventEntries();
    const matched = entries.filter(entry =>
      (!state.action || actionFor(entry) === state.action)
      && (!state.actor || normalize(actorFor(entry)) === state.actor)
      && matchesTarget(entry)
      && matchesDate(entry)
    );

    const totalPages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, matched.length);
    const pageEntries = new Set(matched.slice(start, end));

    entries.forEach(entry => {
      const visible = pageEntries.has(entry);
      entry.hidden = !visible;
      if (visible) syncVisibleChanges(entry);
      else changeRows(entry).forEach(change => { change.hidden = false; });
    });

    const placeholder = list.querySelector(':scope > .oc-admin-journal-empty');
    const loaded = entries.length > 0;
    if (empty) empty.hidden = !loaded || matched.length > 0;
    if (count) {
      count.textContent = loaded
        ? matched.length
          ? `Найдено ${matched.length} · показано ${start + 1}–${end}`
          : 'Найдено 0'
        : '';
    }
    if (placeholder) placeholder.hidden = loaded;

    if (pagination) pagination.hidden = !loaded || matched.length <= PAGE_SIZE;
    if (pageLabel) pageLabel.textContent = `Страница ${state.page} из ${totalPages}`;
    if (prevButton) prevButton.disabled = state.page <= 1;
    if (nextButton) nextButton.disabled = state.page >= totalPages;
    saveState();
  }

  function resetPageAndApply() {
    state.page = 1;
    saveState();
    applyFilters();
  }

  function refresh() {
    renderTimer = 0;
    buildDynamicOptions();
    applyFilters();
  }

  function scheduleRefresh() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(refresh, 20);
  }

  actionSelect.value = state.action;
  fromInput.value = state.from;
  toInput.value = state.to;

  actionSelect.addEventListener('change', () => {
    state.action = actionSelect.value;
    resetPageAndApply();
  });
  targetSelect.addEventListener('change', () => {
    state.target = targetSelect.value;
    resetPageAndApply();
  });
  actorSelect.addEventListener('change', () => {
    state.actor = actorSelect.value;
    resetPageAndApply();
  });
  fromInput.addEventListener('change', () => {
    state.from = fromInput.value;
    resetPageAndApply();
  });
  toInput.addEventListener('change', () => {
    state.to = toInput.value;
    resetPageAndApply();
  });
  resetButton?.addEventListener('click', () => {
    Object.assign(state, { action: '', target: '', actor: '', from: '', to: '', page: 1 });
    actionSelect.value = '';
    actorSelect.value = '';
    fromInput.value = '';
    toInput.value = '';
    saveState();
    buildDynamicOptions();
    applyFilters();
  });
  prevButton?.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    applyFilters();
    journal.scrollTo({ top: toolbar.offsetTop, behavior: 'smooth' });
  });
  nextButton?.addEventListener('click', () => {
    state.page += 1;
    applyFilters();
    journal.scrollTo({ top: toolbar.offsetTop, behavior: 'smooth' });
  });

  new MutationObserver(scheduleRefresh).observe(list, { childList: true, subtree: true });
  refresh();
})();
