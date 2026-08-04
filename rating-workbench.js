(() => {
  if (window.__OC_RATING_WORKBENCH_READY__) return;
  window.__OC_RATING_WORKBENCH_READY__ = true;

  const SEASONS = ['winter', 'spring', 'summer', 'fall'];
  const SEASON_LABELS = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  let renderTimer = 0;
  let queueMap = new Map();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const bridge = () => window.OC_APP_BRIDGE;
  const snapshot = () => bridge()?.snapshot?.() || window.OC_APP_DATA || {};
  const currentName = () => String(snapshot().currentUser?.nickname || '').trim();
  const viewedName = () => String(document.querySelector('#oc-profile-user')?.value || currentName()).trim();
  const sameUser = (left, right) => String(left || '').trim().toLowerCase().replace(/ё/g, 'е') === String(right || '').trim().toLowerCase().replace(/ё/g, 'е');

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
      return { id, label };
    }).filter(row => row.label);
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

  function ratingFieldRow(field = {}) {
    const id = String(field.id || `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    return `<div class="oc-custom-field-row" data-rating-field-row data-field-id="${esc(id)}">
      <input type="text" maxlength="48" value="${esc(field.label || '')}" data-rating-field-label placeholder="Например: Личное впечатление">
      <button type="button" data-rating-field-remove aria-label="Удалить поле">×</button>
    </div>`;
  }

  function criteriaMarkup(profile, own) {
    if (!own) return '';
    const fields = normalizeRatingFields(profile?.ratingFields);
    const rows = fields.map(ratingFieldRow).join('');
    const songLabel = String(profile?.songScoreLabel || 'Песня').trim().slice(0, 48) || 'Песня';
    const visualLabel = String(profile?.visualScoreLabel || 'Визуал').trim().slice(0, 48) || 'Визуал';
    return `<section class="oc-workbench-block oc-criteria-settings" id="oc-rating-fields-settings">
      <div class="oc-workbench-head"><div><span>личные настройки</span><h3>Детальное оценивание</h3><p>По умолчанию скрыто во всех формах. Можно переименовать базовые поля и добавить до восьми собственных.</p></div><button type="button" class="oc-addbtn" data-criteria-save>Сохранить настройки</button></div>
      <label class="oc-detailed-rating-switch"><input type="checkbox" data-detailed-rating-enabled ${profile?.detailedRatingEnabled ? 'checked' : ''}><span><b>Включить детальное оценивание</b><small>Показывать дополнительные поля в карточках, дейликах и сезонной оценке</small></span></label>
      <div class="oc-base-rating-fields">
        <label>Первый базовый критерий<input type="text" maxlength="48" value="${esc(songLabel)}" data-song-score-label></label>
        <label>Второй базовый критерий<input type="text" maxlength="48" value="${esc(visualLabel)}" data-visual-score-label></label>
      </div>
      <div class="oc-custom-fields-head"><b>Собственные критерии</b><span>необязательно</span></div>
      <div class="oc-custom-fields-list" data-rating-fields-list>${rows || '<div class="oc-workbench-empty" data-rating-fields-empty>Дополнительных полей пока нет.</div>'}</div>
      <button type="button" class="oc-secondary-btn oc-custom-field-add" data-rating-field-add>+ Добавить поле</button>
    </section>`;
  }

  function coverageMarkup(entries, user, own) {
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

  function render() {
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

  async function saveCriteria(button) {
    const root = ensureRoot();
    if (!root) return;
    const fields = [];
    root.querySelectorAll('[data-rating-field-row]').forEach(row => {
      const label = String(row.querySelector('[data-rating-field-label]')?.value || '').trim().slice(0, 48);
      const id = String(row.dataset.fieldId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
      if (label && id) fields.push({ id, label });
    });
    button.disabled = true;
    button.textContent = 'Сохраняю…';
    try {
      const detailedRatingEnabled = Boolean(root.querySelector('[data-detailed-rating-enabled]')?.checked);
      const songScoreLabel = String(root.querySelector('[data-song-score-label]')?.value || '').trim().slice(0, 48) || 'Песня';
      const visualScoreLabel = String(root.querySelector('[data-visual-score-label]')?.value || '').trim().slice(0, 48) || 'Визуал';
      await bridge()?.saveProfilePatch?.({ ratingFields: fields.slice(0, 8), detailedRatingEnabled, songScoreLabel, visualScoreLabel });
      button.textContent = 'Сохранено ✓';
      window.setTimeout(render, 500);
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
          settings?.querySelector('[data-detailed-rating-enabled]')?.focus();
        }, 80);
      }, 80);
      return;
    }
    const addField = event.target.closest('[data-rating-field-add]');
    if (addField) {
      const list = ensureRoot()?.querySelector('[data-rating-fields-list]');
      if (!list || list.querySelectorAll('[data-rating-field-row]').length >= 8) return;
      list.querySelector('[data-rating-fields-empty]')?.remove();
      list.insertAdjacentHTML('beforeend', ratingFieldRow());
      list.lastElementChild?.querySelector('input')?.focus();
      return;
    }
    const removeField = event.target.closest('[data-rating-field-remove]');
    if (removeField) {
      const list = removeField.closest('[data-rating-fields-list]');
      removeField.closest('[data-rating-field-row]')?.remove();
      if (list && !list.querySelector('[data-rating-field-row]')) list.innerHTML = '<div class="oc-workbench-empty" data-rating-fields-empty>Дополнительных полей пока нет.</div>';
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
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, 80);
  }

  window.addEventListener('oped:app-data-updated', queueRender);
  window.addEventListener('oped:route-change', queueRender);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-profile-view], #oc-profile-user')) window.setTimeout(queueRender, 0);
  });
  new MutationObserver(() => {
    scanRateLaterButtons();
    if (!document.querySelector('#oc-rating-workbench')) queueRender();
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueRender, { once: true });
  else queueRender();
})();
