(() => {
  if (window.__OC_SEASON_QUALITY_FILL_READY__) return;

  const SEASON_LABEL = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  const FIELD_DEFS = [
    { key: 'link', label: 'Ссылка на видео', kind: 'url', placeholder: 'https://…', priority: 0 },
    { key: 'image', label: 'Картинка / постер', kind: 'url', placeholder: 'https://…/image.webp', priority: 1 },
    { key: 'performers', label: 'Исполнитель', kind: 'list', placeholder: 'Исполнители через запятую', priority: 2 },
    { key: 'studios', label: 'Студия', kind: 'list', placeholder: 'Студии через запятую', priority: 3 },
    { key: 'directors', label: 'Режиссёр', kind: 'list', placeholder: 'Режиссёры через запятую', priority: 4 },
    { key: 'franchises', label: 'Франшиза', kind: 'lines', placeholder: 'Одна франшиза на строку', priority: 5 },
    { key: 'title', label: 'Название', kind: 'text', placeholder: 'Название трека', priority: 6 }
  ];

  let trigger = null;
  let modal = null;
  let queue = [];
  let index = 0;
  let savedCount = 0;
  let skippedCount = 0;
  let busy = false;
  let didSave = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function isAdmin() {
    const badge = document.querySelector('#oc-access-badge');
    return Boolean(badge && (badge.classList.contains('admin') || String(badge.textContent || '').trim().toLowerCase() === 'админ'));
  }

  function cleanArray(value) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  }

  function cleanLines(value) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    return String(value || '').replace(/\r\n/g, '\n').split('\n').map(item => item.trim()).filter(Boolean);
  }

  function isMissing(row, def) {
    if (def.kind === 'list' || def.kind === 'lines') return cleanArray(row?.[def.key]).length === 0;
    return !String(row?.[def.key] || '').trim();
  }

  function missingDefs(row) {
    return FIELD_DEFS.filter(def => isMissing(row, def));
  }

  function selectedSeasonState() {
    const seasonButton = document.querySelector('#oc-season-years [data-season-select].active');
    const typeButton = document.querySelector('#oc-season-panel [data-season-type].active');
    if (!seasonButton || !typeButton) return null;
    const year = Number(seasonButton.getAttribute('data-year'));
    const season = String(seasonButton.getAttribute('data-season') || '');
    const type = String(typeButton.getAttribute('data-season-type') || 'OP') === 'ED' ? 'ED' : 'OP';
    if (!Number.isFinite(year) || !season) return null;
    return { year, season, type };
  }

  function visibleSeasonIds() {
    return new Set([...document.querySelectorAll('#oc-season-list [data-id]')]
      .map(element => String(element.getAttribute('data-id') || '').trim())
      .filter(Boolean));
  }

  function queuePriority(row) {
    if (!String(row?.link || '').trim()) return 0;
    if (!String(row?.image || '').trim()) return 1;
    return 2;
  }

  function ensureModal() {
    if (modal?.isConnected) return modal;
    modal = document.createElement('div');
    modal.id = 'oc-season-quality-fill';
    modal.className = 'oc-season-fill-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Заполнение пропусков сезона');
    document.body.append(modal);

    modal.addEventListener('click', event => {
      if (busy) return;
      if (event.target === modal || event.target.closest('[data-season-fill-close]')) {
        closeModal();
        return;
      }
      if (event.target.closest('[data-season-fill-skip]')) {
        skippedCount += 1;
        index += 1;
        renderCurrent();
        return;
      }
      if (event.target.closest('[data-season-fill-save]')) void saveAndNext();
      if (event.target.closest('[data-season-fill-restart]')) void startWorkflow(true);
    });

    modal.addEventListener('input', event => {
      if (event.target?.matches?.('[data-season-fill-field="image"]')) updatePreview(event.target.value);
    });
    return modal;
  }

  function setOpen(open) {
    const root = ensureModal();
    root.classList.toggle('hidden', !open);
    document.body.classList.toggle('oc-season-fill-open', open);
  }

  function closeModal() {
    setOpen(false);
    if (didSave) window.OC_CATALOG_CACHE?.invalidate?.();
  }

  function renderLoading(state) {
    const root = ensureModal();
    root.innerHTML = `
      <div class="oc-season-fill-dialog">
        <div class="oc-season-fill-head">
          <div><div class="oc-section-label">админ · заполнение базы</div><h2>Заполнить пропуски · ${escapeHtml(state.type)} · ${escapeHtml(SEASON_LABEL[state.season] || state.season)} ${state.year}</h2><p>Сначала идут треки без ссылки на видео, затем без картинки, затем остальные незаполненные поля.</p></div>
          <button type="button" class="oc-season-fill-close" data-season-fill-close aria-label="Закрыть">×</button>
        </div>
        <div class="oc-season-fill-loading">Собираю незаполненные карточки сезона…</div>
      </div>`;
  }

  function renderError(message) {
    const root = ensureModal();
    root.innerHTML = `
      <div class="oc-season-fill-dialog">
        <div class="oc-season-fill-head"><div><div class="oc-section-label">админ · заполнение базы</div><h2>Не удалось открыть список</h2></div><button type="button" class="oc-season-fill-close" data-season-fill-close aria-label="Закрыть">×</button></div>
        <div class="oc-season-fill-error">${escapeHtml(message || 'Неизвестная ошибка')}</div>
      </div>`;
  }

  function renderDone() {
    const root = ensureModal();
    root.innerHTML = `
      <div class="oc-season-fill-dialog oc-season-fill-finish">
        <div class="oc-section-label">админ · заполнение базы</div>
        <h2>Текущий проход закончен ✓</h2>
        <p>Сохранено карточек: <strong>${savedCount}</strong>. Пропущено: <strong>${skippedCount}</strong>.</p>
        <div class="oc-season-fill-actions">
          <button type="button" class="oc-secondary-btn" data-season-fill-close>Закрыть</button>
          <button type="button" class="oc-addbtn" data-season-fill-restart>Проверить сезон ещё раз</button>
        </div>
      </div>`;
  }

  function fieldHtml(def) {
    const common = `data-season-fill-field="${escapeHtml(def.key)}" autocomplete="off" placeholder="${escapeHtml(def.placeholder)}"`;
    if (def.kind === 'lines') {
      return `<label class="oc-season-fill-field wide"><span>${escapeHtml(def.label)}</span><textarea ${common}></textarea><small>Одна франшиза = одна строка.</small></label>`;
    }
    return `<label class="oc-season-fill-field ${def.key === 'link' || def.key === 'image' ? 'wide' : ''}"><span>${escapeHtml(def.label)}</span><input type="${def.kind === 'url' ? 'url' : 'text'}" ${common}></label>`;
  }

  function currentRow() {
    return queue[index] || null;
  }

  function renderCurrent() {
    if (index >= queue.length) {
      renderDone();
      return;
    }

    const row = currentRow();
    const missing = missingDefs(row);
    if (!missing.length) {
      index += 1;
      renderCurrent();
      return;
    }

    const root = ensureModal();
    const season = SEASON_LABEL[row.season] || row.season || '—';
    const image = String(row.image || '').trim();
    const imageHtml = image
      ? `<img id="oc-season-fill-preview" src="${escapeHtml(image)}" alt="${escapeHtml(row.title || 'Трек')}" referrerpolicy="no-referrer">`
      : `<div id="oc-season-fill-preview-empty" class="oc-season-fill-noimage">${escapeHtml(row.type || 'OP')}</div><img id="oc-season-fill-preview" class="hidden" alt="${escapeHtml(row.title || 'Трек')}" referrerpolicy="no-referrer">`;

    root.innerHTML = `
      <div class="oc-season-fill-dialog">
        <div class="oc-season-fill-head">
          <div>
            <div class="oc-section-label">админ · заполнение базы</div>
            <h2>Заполнить пропуски</h2>
            <p>${index + 1} из ${queue.length} · сохранено ${savedCount} · пропущено ${skippedCount}</p>
          </div>
          <button type="button" class="oc-season-fill-close" data-season-fill-close aria-label="Закрыть">×</button>
        </div>
        <div class="oc-season-fill-progress"><span style="width:${Math.round((index / Math.max(1, queue.length)) * 100)}%"></span></div>
        <div class="oc-season-fill-body">
          <div class="oc-season-fill-visual">${imageHtml}</div>
          <div class="oc-season-fill-content">
            <div class="oc-season-fill-meta"><span class="oc-type-tag ${escapeHtml(row.type || 'OP')}">${escapeHtml(row.type || 'OP')}</span><span>${escapeHtml(season)} ${escapeHtml(row.year ?? '—')}</span></div>
            <h3>${escapeHtml(row.title || 'Без названия')}</h3>
            <div class="oc-season-fill-missing">Не заполнено: ${missing.map(def => `<span>${escapeHtml(def.label)}</span>`).join('')}</div>
            <div class="oc-season-fill-fields">${missing.map(fieldHtml).join('')}</div>
            <div class="oc-season-fill-inline-status" aria-live="polite"></div>
            <div class="oc-season-fill-actions">
              <button type="button" class="oc-secondary-btn" data-season-fill-skip>Пропустить</button>
              <button type="button" class="oc-addbtn" data-season-fill-save>Сохранить и дальше →</button>
            </div>
          </div>
        </div>
      </div>`;

    root.querySelector('[data-season-fill-field="link"]')?.focus();
    if (!root.querySelector('[data-season-fill-field="link"]')) root.querySelector('[data-season-fill-field]')?.focus();
  }

  function updatePreview(value) {
    if (!modal) return;
    const img = modal.querySelector('#oc-season-fill-preview');
    const empty = modal.querySelector('#oc-season-fill-preview-empty');
    if (!img) return;
    const url = String(value || '').trim();
    if (!url) {
      img.classList.add('hidden');
      empty?.classList.remove('hidden');
      return;
    }
    img.src = url;
    img.classList.remove('hidden');
    empty?.classList.add('hidden');
    img.onerror = () => {
      img.classList.add('hidden');
      empty?.classList.remove('hidden');
    };
  }

  function readInput(def) {
    const input = modal?.querySelector(`[data-season-fill-field="${def.key}"]`);
    if (!input) return undefined;
    const value = String(input.value || '').trim();
    if (!value) return undefined;
    if (def.kind === 'list') return cleanArray(value);
    if (def.kind === 'lines') return cleanLines(value);
    return value;
  }

  async function saveAndNext() {
    if (busy || !isAdmin()) return;
    const row = currentRow();
    if (!row) return;
    const defs = missingDefs(row);
    const changes = {};
    defs.forEach(def => {
      const value = readInput(def);
      if (value !== undefined && (!(Array.isArray(value)) || value.length)) changes[def.key] = value;
    });

    const status = modal?.querySelector('.oc-season-fill-inline-status');
    if (!Object.keys(changes).length) {
      if (status) status.textContent = 'Заполни хотя бы одно поле или нажми «Пропустить».';
      return;
    }
    if (!window.OPED_DB || typeof window.OPED_DB.updateOpening !== 'function') {
      if (status) status.textContent = 'Сервис сохранения ещё загружается. Попробуй через пару секунд.';
      return;
    }

    busy = true;
    const saveButton = modal?.querySelector('[data-season-fill-save]');
    const skipButton = modal?.querySelector('[data-season-fill-skip]');
    if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Сохраняю…'; }
    if (skipButton) skipButton.disabled = true;

    try {
      const updated = { ...row, ...changes };
      await window.OPED_DB.updateOpening(row.id, updated);
      Object.assign(row, updated);
      savedCount += 1;
      didSave = true;
      index += 1;
      renderCurrent();
    } catch (error) {
      console.error('Season missing-fields save failed', error);
      const currentStatus = modal?.querySelector('.oc-season-fill-inline-status');
      if (currentStatus) currentStatus.textContent = `Не удалось сохранить: ${error?.message || error}`;
      if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Сохранить и дальше →'; }
      if (skipButton) skipButton.disabled = false;
    } finally {
      busy = false;
    }
  }

  async function loadRowsForSelectedSeason(state) {
    const visibleIds = visibleSeasonIds();
    if (!visibleIds.size) return [];
    if (!window.OC_CATALOG_CACHE?.load) throw new Error('Каталог ещё не готов. Обнови страницу и попробуй снова.');
    const rows = await window.OC_CATALOG_CACHE.load(false);
    return rows
      .filter(row => visibleIds.has(String(row.id)) && String(row.type || 'OP') === state.type && Number(row.year) === state.year && String(row.season || '') === state.season)
      .filter(row => missingDefs(row).length > 0)
      .sort((a, b) => queuePriority(a) - queuePriority(b)
        || missingDefs(b).length - missingDefs(a).length
        || String(a.title || '').localeCompare(String(b.title || ''), 'ru'));
  }

  async function startWorkflow(forceReload = false) {
    if (!isAdmin()) return;
    const state = selectedSeasonState();
    if (!state) return;
    setOpen(true);
    renderLoading(state);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
      if (forceReload) window.OC_CATALOG_CACHE?.invalidate?.();
      queue = await loadRowsForSelectedSeason(state);
      index = 0;
      savedCount = 0;
      skippedCount = 0;
      busy = false;
      didSave = false;
      if (!queue.length) {
        const root = ensureModal();
        root.innerHTML = `
          <div class="oc-season-fill-dialog oc-season-fill-finish">
            <div class="oc-section-label">админ · заполнение базы</div>
            <h2>В этом сезоне всё заполнено ✓</h2>
            <p>Среди видимых ${escapeHtml(state.type)} карточек нет пропусков в основных полях.</p>
            <div class="oc-season-fill-actions"><button type="button" class="oc-addbtn" data-season-fill-close>Закрыть</button></div>
          </div>`;
        return;
      }
      renderCurrent();
    } catch (error) {
      console.error('Season missing-fields load failed', error);
      renderError(error?.message || error);
    }
  }

  function syncTrigger() {
    if (!trigger) return;
    const state = selectedSeasonState();
    trigger.hidden = !isAdmin();
    trigger.disabled = !state;
    trigger.title = state ? 'По очереди заполнить отсутствующие поля карточек этого сезона' : 'Сначала выберите сезон';
  }

  function mount(attempt = 0) {
    if (trigger?.isConnected) return;
    const actions = document.querySelector('#oc-season-panel .oc-season-head-actions');
    if (!actions) {
      if (attempt < 40) setTimeout(() => mount(attempt + 1), 100);
      return;
    }
    trigger = document.createElement('button');
    trigger.id = 'oc-season-fill-missing-btn';
    trigger.type = 'button';
    trigger.className = 'oc-secondary-btn oc-admin-only oc-season-fill-trigger';
    trigger.textContent = 'Заполнить пропуски';
    trigger.addEventListener('click', () => void startWorkflow(false));
    actions.append(trigger);
    syncTrigger();

    const badge = document.querySelector('#oc-access-badge');
    if (badge) new MutationObserver(syncTrigger).observe(badge, { attributes: true, childList: true, characterData: true, subtree: true });
    const seasonYears = document.querySelector('#oc-season-years');
    if (seasonYears) new MutationObserver(syncTrigger).observe(seasonYears, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !modal || modal.classList.contains('hidden')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!busy) closeModal();
  }, true);

  window.__OC_SEASON_QUALITY_FILL_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount(), { once: true });
  else mount();
})();
