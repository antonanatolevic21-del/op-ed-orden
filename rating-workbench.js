(() => {
  if (window.__OC_RATING_WORKBENCH_READY__) return;
  window.__OC_RATING_WORKBENCH_READY__ = true;

  const SEASONS = ['winter', 'spring', 'summer', 'fall'];
  const SEASON_LABELS = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  const CRITERIA_DRAFT_PREFIX = 'oc-detailed-rating-draft-v1:';
  let renderTimer = 0;
  let renderPendingAfterEdit = false;
  let queueMap = new Map();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const bridge = () => window.OC_APP_BRIDGE;
  const snapshot = () => bridge()?.snapshot?.() || window.OC_APP_DATA || {};
  const currentName = () => {
    const fromSnapshot = snapshot().currentUser?.nickname;
    const fromInput = document.querySelector('#oc-myname')?.value;
    let fromStorage = '';
    try { fromStorage = localStorage.getItem('op-ed-primary-account-name') || localStorage.getItem('my-display-name') || ''; } catch (_) {}
    return String(fromSnapshot || fromInput || fromStorage || '').trim();
  };
  const viewedName = () => String(document.querySelector('#oc-profile-user')?.value || currentName()).trim();
  const sameUser = (left, right) => String(left || '').trim().toLowerCase().replace(/ё/g, 'е') === String(right || '').trim().toLowerCase().replace(/ё/g, 'е');

  function criteriaDraftKey(name = currentName()) {
    const normalized = String(name || '').trim().toLowerCase().replace(/ё/g, 'е');
    return normalized ? `${CRITERIA_DRAFT_PREFIX}${encodeURIComponent(normalized)}` : '';
  }

  function readCriteriaDraft(name = currentName()) {
    const key = criteriaDraftKey(name);
    if (!key) return null;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (!parsed || typeof parsed !== 'object' || !parsed.settings || typeof parsed.settings !== 'object') return null;
      return parsed;
    } catch (_) { return null; }
  }

  function clearCriteriaDraft(name = currentName()) {
    const key = criteriaDraftKey(name);
    if (!key) return;
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function normalizeRatingFields(value) {
    const source = Array.isArray(value) ? value : [];
    const used = new Set();
    return source.slice(0, 8).map((row, index) => {
      const item = row && typeof row === 'object' ? row : {};
      const label = String(item.label || item.name || '').trim().slice(0, 48);
      let id = String(item.id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
      if (!id) id = `field-${index + 1}`;
      while (used.has(id)) id = `${id}-${index + 1}`;
      used.add(id);
      const weight = Math.max(0, Math.min(100, Number(item.weight ?? 50) || 0));
      return { id, label, weight };
    }).filter(row => row.label);
  }

  function normalizeTypeSettings(profile, type) {
    const stored = profile?.detailedRatingByType?.[type];
    const source = stored && typeof stored === 'object' ? stored : null;
    const oldType = profile?.ratingCriteria?.[type];
    return {
      enabled: source ? Boolean(source.enabled) : Boolean(profile?.detailedRatingEnabled),
      songLabel: String(source?.songLabel || profile?.songScoreLabel || 'Песня').trim().slice(0, 48) || 'Песня',
      visualLabel: String(source?.visualLabel || profile?.visualScoreLabel || 'Визуал').trim().slice(0, 48) || 'Визуал',
      songWeight: Math.max(0, Math.min(100, Number(source?.songWeight ?? oldType?.songWeight ?? profile?.songScoreWeight ?? 50) || 0)),
      visualWeight: Math.max(0, Math.min(100, Number(source?.visualWeight ?? oldType?.visualWeight ?? profile?.visualScoreWeight ?? 50) || 0)),
      fields: normalizeRatingFields(source?.fields ?? profile?.ratingFields)
    };
  }

  function profileFor(name) {
    return bridge()?.profileData?.(name) || null;
  }

  function ensureRoot() {
    const stats = document.querySelector('#oc-profile-stats');
    if (!stats) return null;
    let root = document.querySelector('#oc-rating-workbench');
    if (!root) {
      root = document.createElement('section');
      root.id = 'oc-rating-workbench';
      root.className = 'oc-rating-workbench';
      stats.insertAdjacentElement('afterend', root);
    }
    return root;
  }

  function ratingFieldRow(type, field = {}) {
    const id = String(field.id || `${type.toLowerCase()}-field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    const weight = Math.max(0, Math.min(100, Number(field.weight ?? 50) || 0));
    return `<div class="oc-custom-field-row" data-rating-field-row data-field-id="${esc(id)}">
      <input type="text" maxlength="48" value="${esc(field.label || '')}" data-rating-field-label placeholder="Например: Личное впечатление">
      <label class="oc-rating-weight-field"><span>Вес</span><input type="number" min="0" max="100" step="5" value="${weight}" data-rating-field-weight></label>
      <button type="button" data-rating-field-remove aria-label="Удалить поле">×</button>
    </div>`;
  }

  function criteriaMarkup(profile, own) {
    if (!own) return '';
    const draft = readCriteriaDraft();
    const sourceProfile = draft ? { ...profile, detailedRatingByType: draft.settings } : profile;
    const panel = type => {
      const settings = normalizeTypeSettings(sourceProfile, type);
      const rows = settings.fields.map(field => ratingFieldRow(type, field)).join('');
      const title = type === 'OP' ? 'Опенинги' : 'Эндинги';
      return `<fieldset class="oc-criteria-card ${type.toLowerCase()}" data-rating-type-panel="${type}">
        <legend>${title}</legend>
        <label class="oc-detailed-rating-switch"><input type="checkbox" data-type-detailed-enabled ${settings.enabled ? 'checked' : ''}><span><b>Включить детальную оценку ${type}</b><small>Настройка действует только для ${type}</small></span></label>
        <div class="oc-base-rating-fields">
          <div class="oc-base-rating-field"><label>Первый базовый критерий<input type="text" maxlength="48" value="${esc(settings.songLabel)}" data-type-song-label></label><label class="oc-rating-weight-field"><span>Вес</span><input type="number" min="0" max="100" step="5" value="${settings.songWeight}" data-type-song-weight></label></div>
          <div class="oc-base-rating-field"><label>Второй базовый критерий<input type="text" maxlength="48" value="${esc(settings.visualLabel)}" data-type-visual-label></label><label class="oc-rating-weight-field"><span>Вес</span><input type="number" min="0" max="100" step="5" value="${settings.visualWeight}" data-type-visual-weight></label></div>
        </div>
        <div class="oc-custom-fields-head"><b>Собственные критерии</b><span>до восьми</span></div>
        <div class="oc-custom-fields-list" data-rating-fields-list>${rows || '<div class="oc-workbench-empty" data-rating-fields-empty>Дополнительных полей пока нет.</div>'}</div>
        <button type="button" class="oc-secondary-btn oc-custom-field-add" data-rating-field-add="${type}">+ Добавить поле для ${type}</button>
      </fieldset>`;
    };
    return `<section class="oc-workbench-block oc-criteria-settings" id="oc-rating-fields-settings">
      <div class="oc-workbench-head"><div><span>личные настройки</span><h3>Детальное оценивание OP и ED</h3><p>Каждый тип включается и настраивается отдельно. Несохранённые изменения остаются в локальном черновике и не пропадают при обновлении профиля.</p></div><div class="oc-criteria-actions"><span class="oc-criteria-draft-state" data-criteria-draft-state ${draft ? '' : 'hidden'}>Черновик сохранён локально</span><button type="button" class="oc-secondary-btn" data-criteria-discard ${draft ? '' : 'hidden'}>Вернуть сохранённое</button><button type="button" class="oc-addbtn" data-criteria-save>Сохранить настройки</button></div></div>
      <div class="oc-rating-weight-hint">Вес относительный: значения не обязаны складываться в 100. Нулевой вес исключает критерий из подсказки итогового балла.</div>
      <div class="oc-criteria-grid">${panel('OP')}${panel('ED')}</div>
    </section>`;
  }

  function coverageMarkup(entries, user, own) {
    if (!own) return '';
    const rows = new Map();
    queueMap = new Map();
    entries.forEach(entry => {
      const year = Number(entry.year);
      const season = String(entry.season || '');
      const type = entry.type === 'ED' ? 'ED' : 'OP';
      if (!Number.isFinite(year) || !SEASONS.includes(season)) return;
      const key = `${year}|${season}|${type}`;
      if (!rows.has(key)) rows.set(key, { total: 0, rated: 0, ids: [] });
      const row = rows.get(key);
      row.total += 1;
      if (bridge()?.userScore?.(entry.id, user) !== null) row.rated += 1;
      else row.ids.push(String(entry.id));
    });
    const years = [...new Set([...rows.keys()].map(key => Number(key.split('|')[0])))].sort((a, b) => b - a);
    if (!years.length) return '';
    const cell = (year, season) => {
      const parts = ['OP', 'ED'].map(type => {
        const key = `${year}|${season}|${type}`;
        const row = rows.get(key) || { total: 0, rated: 0, ids: [] };
        if (own && row.ids.length) queueMap.set(key, row.ids);
        const done = row.total > 0 && row.rated === row.total;
        return `<button type="button" class="oc-coverage-type ${type.toLowerCase()}${done ? ' done' : ''}" data-coverage-key="${key}" ${own && row.ids.length ? '' : 'disabled'}><b>${type}</b><span>${row.rated}/${row.total}</span></button>`;
      }).join('');
      return `<div class="oc-coverage-cell"><small>${SEASON_LABELS[season]}</small>${parts}</div>`;
    };
    return `<section class="oc-workbench-block oc-coverage-block">
      <div class="oc-workbench-head"><div><span>прогресс каталога</span><h3>Карта покрытия</h3><p>${own ? 'Нажми на незавершённый OP или ED, чтобы продолжить оценку именно этого сезона.' : 'Для чужого профиля карта отображается без запуска оценки.'}</p></div></div>
      <div class="oc-coverage-table">${years.map(year => `<div class="oc-coverage-row"><strong>${year}</strong>${SEASONS.map(season => cell(year, season)).join('')}</div>`).join('')}</div>
    </section>`;
  }

  function rateLaterMarkup(entries, profile, own) {
    if (!own) return '';
    const ids = Array.from(new Set((profile?.rateLaterIds || []).map(String)));
    const map = new Map(entries.map(entry => [String(entry.id), entry]));
    const rows = ids.map(id => map.get(id)).filter(Boolean).filter(entry => bridge()?.userScore?.(entry.id, currentName()) === null);
    const list = rows.length ? rows.slice(0, 40).map(entry => `<div class="oc-later-row"><button type="button" data-later-open="${esc(entry.id)}"><b>${esc(entry.type)}</b><span>${esc(entry.title)}</span><small>${esc(entry.year || '—')} · ${esc(SEASON_LABELS[entry.season] || entry.season || '—')}</small></button><button type="button" class="oc-later-remove" data-rate-later-toggle="${esc(entry.id)}" aria-label="Убрать из очереди">×</button></div>`).join('') : '<div class="oc-workbench-empty">Очередь пока пуста. Добавить трек можно с любой карточки каталога.</div>';
    return `<section class="oc-workbench-block oc-later-block">
      <div class="oc-workbench-head"><div><span>личная очередь</span><h3>Оценить позже · ${rows.length}</h3><p>Сюда попадают только ещё не оценённые тобой треки.</p></div>${rows.length ? '<button type="button" class="oc-addbtn" data-later-start>Начать оценку</button>' : ''}</div>
      <div class="oc-later-list">${list}</div>
    </section>`;
  }

  function render(options = {}) {
    if (!options.force && document.activeElement?.closest?.('#oc-rating-fields-settings')) {
      renderPendingAfterEdit = true;
      return;
    }
    const root = ensureRoot();
    if (!root) return;
    const data = snapshot();
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const user = viewedName();
    const own = Boolean(user && currentName() && sameUser(user, currentName()));
    const profile = profileFor(user) || {};
    root.innerHTML = `${rateLaterMarkup(entries, profile, own)}${criteriaMarkup(profile, own)}${coverageMarkup(entries, user, own)}`;
    root.hidden = !user;
    scanRateLaterButtons();
  }

  function collectCriteriaSettings(root = ensureRoot()) {
    const detailedRatingByType = {};
    root?.querySelectorAll('[data-rating-type-panel]').forEach(panel => {
      const type = panel.dataset.ratingTypePanel === 'ED' ? 'ED' : 'OP';
      const fields = [];
      panel.querySelectorAll('[data-rating-field-row]').forEach(row => {
        const label = String(row.querySelector('[data-rating-field-label]')?.value || '').trim().slice(0, 48);
        const id = String(row.dataset.fieldId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
        const weight = Math.max(0, Math.min(100, Number(row.querySelector('[data-rating-field-weight]')?.value ?? 50) || 0));
        if (label && id) fields.push({ id, label, weight });
      });
      detailedRatingByType[type] = {
        enabled: Boolean(panel.querySelector('[data-type-detailed-enabled]')?.checked),
        songLabel: String(panel.querySelector('[data-type-song-label]')?.value || '').trim().slice(0, 48) || 'Песня',
        visualLabel: String(panel.querySelector('[data-type-visual-label]')?.value || '').trim().slice(0, 48) || 'Визуал',
        songWeight: Math.max(0, Math.min(100, Number(panel.querySelector('[data-type-song-weight]')?.value ?? 50) || 0)),
        visualWeight: Math.max(0, Math.min(100, Number(panel.querySelector('[data-type-visual-weight]')?.value ?? 50) || 0)),
        fields: fields.slice(0, 8)
      };
    });
    return detailedRatingByType;
  }

  function persistCriteriaDraft() {
    const settings = collectCriteriaSettings();
    if (!settings.OP || !settings.ED) return;
    const key = criteriaDraftKey();
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify({ settings, updatedAt: Date.now() })); } catch (_) {}
    document.querySelector('[data-criteria-draft-state]')?.removeAttribute('hidden');
    document.querySelector('[data-criteria-discard]')?.removeAttribute('hidden');
  }

  async function saveCriteria(button) {
    const root = ensureRoot();
    if (!root) return;
    const detailedRatingByType = collectCriteriaSettings(root);
    persistCriteriaDraft();
    button.disabled = true;
    button.textContent = 'Сохраняю…';
    try {
      await bridge()?.saveProfilePatch?.({ detailedRatingByType });
      clearCriteriaDraft();
      renderPendingAfterEdit = false;
      button.textContent = 'Сохранено ✓';
      window.setTimeout(() => render({ force: true }), 500);
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Не удалось сохранить';
      console.error(error);
    }
  }

  function scanRateLaterButtons() {
    if (!currentName()) return;
    document.querySelectorAll('.oc-unified-card[data-id], .oc-eval-modal[data-entry-id]').forEach(card => {
      const id = String(card.dataset.id || card.dataset.entryId || '');
      if (!id || bridge()?.userScore?.(id, currentName()) !== null) return;
      let actions = card.querySelector('.oc-card-actions, .oc-eval-actions, .oc-opening-rate-actions');
      if (!actions && card.classList.contains('oc-unified-card')) {
        actions = document.createElement('div');
        actions.className = 'oc-card-actions';
        card.append(actions);
      }
      if (!actions || actions.querySelector(`[data-rate-later-toggle="${CSS.escape(id)}"]`)) return;
      const active = Boolean(bridge()?.isRateLater?.(id));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `oc-secondary-btn oc-rate-later-btn${active ? ' active' : ''}`;
      button.dataset.rateLaterToggle = id;
      button.textContent = active ? '⏱ Оценить позже ✓' : '⏱ Оценить позже';
      actions.prepend(button);
    });
  }

  document.addEventListener('click', async event => {
    const openSettings = event.target.closest('[data-open-rating-fields-settings]');
    if (openSettings) {
      event.preventDefault();
      event.stopPropagation();
      document.querySelector('[data-eval-action="close"]')?.click();
      document.querySelector('[data-modal-close]')?.click();
      document.querySelector('.oc-tab-btn[data-tab="profile"]')?.click();
      window.setTimeout(() => {
        document.querySelector('[data-profile-view="overview"]')?.click();
        window.setTimeout(() => {
          const settings = document.querySelector('#oc-rating-fields-settings');
          settings?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          settings?.classList.add('is-highlighted');
          window.setTimeout(() => settings?.classList.remove('is-highlighted'), 1600);
          const type = openSettings.dataset.ratingSettingsType === 'ED' ? 'ED' : 'OP';
          settings?.querySelector(`[data-rating-type-panel="${type}"] [data-type-detailed-enabled]`)?.focus();
        }, 80);
      }, 80);
      return;
    }
    const addField = event.target.closest('[data-rating-field-add]');
    if (addField) {
      const type = addField.dataset.ratingFieldAdd === 'ED' ? 'ED' : 'OP';
      const list = addField.closest('[data-rating-type-panel]')?.querySelector('[data-rating-fields-list]');
      if (!list || list.querySelectorAll('[data-rating-field-row]').length >= 8) return;
      list.querySelector('[data-rating-fields-empty]')?.remove();
      list.insertAdjacentHTML('beforeend', ratingFieldRow(type));
      persistCriteriaDraft();
      list.lastElementChild?.querySelector('input')?.focus();
      return;
    }
    const removeField = event.target.closest('[data-rating-field-remove]');
    if (removeField) {
      const list = removeField.closest('[data-rating-fields-list]');
      removeField.closest('[data-rating-field-row]')?.remove();
      if (list && !list.querySelector('[data-rating-field-row]')) list.innerHTML = '<div class="oc-workbench-empty" data-rating-fields-empty>Дополнительных полей пока нет.</div>';
      persistCriteriaDraft();
      return;
    }
    const discard = event.target.closest('[data-criteria-discard]');
    if (discard) {
      if (!window.confirm('Отменить несохранённые изменения детального оценивания?')) return;
      clearCriteriaDraft();
      renderPendingAfterEdit = false;
      render({ force: true });
      return;
    }
    const save = event.target.closest('[data-criteria-save]');
    if (save) { await saveCriteria(save); return; }
    const coverage = event.target.closest('[data-coverage-key]');
    if (coverage) {
      const ids = queueMap.get(coverage.dataset.coverageKey) || [];
      const [year, season, type] = coverage.dataset.coverageKey.split('|');
      bridge()?.startRatingQueue?.(ids, { mode: 'coverage', label: `${type} · ${SEASON_LABELS[season]} ${year}`, context: { year, season, type } });
      return;
    }
    const start = event.target.closest('[data-later-start]');
    if (start) {
      const ids = (profileFor(currentName())?.rateLaterIds || []).map(String).filter(id => bridge()?.userScore?.(id, currentName()) === null);
      bridge()?.startRatingQueue?.(ids, { mode: 'rate-later', label: 'Оценить позже', context: { owner: currentName() } });
      return;
    }
    const open = event.target.closest('[data-later-open]');
    if (open) { bridge()?.openTrack?.(open.dataset.laterOpen); return; }
    const toggle = event.target.closest('[data-rate-later-toggle]');
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      toggle.disabled = true;
      try {
        const active = await bridge()?.toggleRateLater?.(toggle.dataset.rateLaterToggle);
        document.querySelectorAll(`[data-rate-later-toggle="${CSS.escape(toggle.dataset.rateLaterToggle)}"]`).forEach(button => {
          button.classList.toggle('active', Boolean(active));
          if (button.classList.contains('oc-rate-later-btn')) button.textContent = active ? '⏱ Оценить позже ✓' : '⏱ Оценить позже';
        });
        window.setTimeout(render, 80);
      } catch (error) { console.error(error); }
      finally { toggle.disabled = false; }
    }
  }, true);

  function queueRender() {
    if (document.activeElement?.closest?.('#oc-rating-fields-settings')) {
      renderPendingAfterEdit = true;
      return;
    }
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, 80);
  }

  document.addEventListener('input', event => {
    if (event.target?.closest?.('#oc-rating-fields-settings [data-rating-type-panel]')) persistCriteriaDraft();
  });
  document.addEventListener('change', event => {
    if (event.target?.closest?.('#oc-rating-fields-settings [data-rating-type-panel]')) persistCriteriaDraft();
  });
  document.addEventListener('focusout', event => {
    if (!event.target?.closest?.('#oc-rating-fields-settings')) return;
    window.setTimeout(() => {
      if (!renderPendingAfterEdit || document.activeElement?.closest?.('#oc-rating-fields-settings')) return;
      renderPendingAfterEdit = false;
      queueRender();
    }, 0);
  });

  window.addEventListener('oped:app-data-updated', queueRender);
  window.addEventListener('oped-account-restored', queueRender);
  window.addEventListener('oped-db-ready', queueRender);
  window.addEventListener('oped:route-change', queueRender);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-profile-view], #oc-profile-user')) window.setTimeout(queueRender, 0);
  });
  document.addEventListener('change', event => {
    if (event.target?.matches?.('#oc-profile-user, #oc-myname')) window.setTimeout(queueRender, 0);
  });
  new MutationObserver(() => {
    scanRateLaterButtons();
    if (!document.querySelector('#oc-rating-workbench')) queueRender();
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueRender, { once: true });
  else queueRender();
})();
