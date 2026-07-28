(() => {
  if (window.__OC_FILTER_CHIPS_READY__) return;

  const SEASONS = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };

  function fire(element, inputToo = false) {
    if (!element) return;
    if (inputToo) element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function optionText(select, value) {
    const option = [...(select?.options || [])].find(item => item.value === value);
    return String(option?.textContent || value || '').trim();
  }

  function clearMultiValue(select, value) {
    if (!select) return;
    [...select.options].forEach(option => {
      if (option.value === value) option.selected = false;
    });
    fire(select);
  }

  function chip(label, kind, onClear) {
    return { label, kind, onClear };
  }

  function chipsForScope(scope) {
    const { root, prefix, includeMissing } = scope;
    const rows = [];

    const search = root.querySelector(`#${prefix}-search`);
    const searchValue = String(search?.value || '').trim();
    if (searchValue) rows.push(chip(`Поиск: ${searchValue}`, 'search', () => {
      search.value = '';
      fire(search, true);
    }));

    const type = root.querySelector(`#${prefix}-type`);
    if (type?.value) rows.push(chip(optionText(type, type.value), 'type', () => {
      type.value = '';
      fire(type);
    }));

    const cmp = root.querySelector(`#${prefix}-score-cmp`);
    const score = root.querySelector(`#${prefix}-score-value`);
    const scoreValue = String(score?.value || '').trim();
    if (cmp?.value && scoreValue) rows.push(chip(`Оценка ${cmp.value} ${scoreValue}`, 'score', () => {
      cmp.value = '';
      score.value = '';
      fire(cmp);
      fire(score, true);
    }));

    const fromYear = root.querySelector(`#${prefix}-from-year`);
    const fromSeason = root.querySelector(`#${prefix}-from-season`);
    const toYear = root.querySelector(`#${prefix}-to-year`);
    const toSeason = root.querySelector(`#${prefix}-to-season`);
    if (fromYear?.value || toYear?.value) {
      const from = fromYear?.value ? `${SEASONS[fromSeason?.value] || ''} ${fromYear.value}`.trim() : 'с начала';
      const to = toYear?.value ? `${SEASONS[toSeason?.value] || ''} ${toYear.value}`.trim() : 'до конца';
      rows.push(chip(`Период: ${from} — ${to}`, 'period', () => {
        if (fromYear) { fromYear.value = ''; fire(fromYear); }
        if (toYear) { toYear.value = ''; fire(toYear); }
        if (fromSeason) { fromSeason.value = 'winter'; fire(fromSeason); }
        if (toSeason) { toSeason.value = 'fall'; fire(toSeason); }
      }));
    }

    if (includeMissing) {
      const missing = root.querySelector(`#${prefix}-missing`);
      if (missing?.checked) rows.push(chip('Незаполненные поля', 'missing', () => {
        missing.checked = false;
        fire(missing);
      }));
    }

    [
      ['studio', 'Студия'],
      ['director', 'Режиссёр'],
      ['performer', 'Исполнитель'],
      ['franchise', 'Франшиза']
    ].forEach(([suffix, label]) => {
      const select = root.querySelector(`#${prefix}-${suffix}`);
      if (!select) return;
      [...select.selectedOptions].forEach(option => {
        const value = option.value;
        const shown = String(option.textContent || value).trim();
        if (!value || !shown) return;
        rows.push(chip(`${label}: ${shown}`, suffix, () => clearMultiValue(select, value)));
      });
    });

    return rows;
  }

  function ensureContainer(scope) {
    if (scope.container?.isConnected) return scope.container;
    const existing = scope.root.querySelector(':scope > .oc-filter-chips');
    if (existing) {
      scope.container = existing;
      return existing;
    }
    const container = document.createElement('div');
    container.className = 'oc-filter-chips';
    container.setAttribute('aria-label', 'Активные фильтры');
    const label = scope.root.querySelector(':scope > .oc-section-label');
    if (label) label.insertAdjacentElement('afterend', container);
    else scope.root.prepend(container);
    scope.container = container;
    return container;
  }

  function renderScope(scope) {
    const container = ensureContainer(scope);
    const rows = chipsForScope(scope);
    container.replaceChildren();
    if (!rows.length) return;

    const title = document.createElement('span');
    title.className = 'oc-filter-chips-title';
    title.textContent = 'Активно';
    container.append(title);

    rows.forEach(row => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'oc-filter-chip';
      button.dataset.chipKind = row.kind;
      button.title = `Убрать фильтр «${row.label}»`;

      const label = document.createElement('span');
      label.className = 'oc-filter-chip-label';
      label.textContent = row.label;
      const x = document.createElement('span');
      x.className = 'oc-filter-chip-x';
      x.setAttribute('aria-hidden', 'true');
      x.textContent = '×';
      button.append(label, x);

      button.addEventListener('click', () => {
        row.onClear();
        window.setTimeout(() => renderScope(scope), 0);
      });
      container.append(button);
    });
  }

  function scheduleScopeRender(scope) {
    if (scope.renderQueued) return;
    scope.renderQueued = true;
    queueMicrotask(() => {
      scope.renderQueued = false;
      renderScope(scope);
    });
  }

  function init() {
    if (window.__OC_FILTER_CHIPS_READY__) return;
    const main = document.querySelector('#oc-main-panel > .oc-filterbar');
    const profile = document.querySelector('#oc-profile-panel .oc-profile-filterbar');
    const scopes = [
      main ? { root: main, prefix: 'oc-f', includeMissing: true, container: null } : null,
      profile ? { root: profile, prefix: 'oc-p', includeMissing: false, container: null } : null
    ].filter(Boolean);
    if (!scopes.length) return;

    scopes.forEach(scope => {
      scope.root.addEventListener('input', event => {
        if (event.target.closest('.oc-filter-chip')) return;
        scheduleScopeRender(scope);
      });
      scope.root.addEventListener('change', event => {
        if (event.target.closest('.oc-filter-chip')) return;
        scheduleScopeRender(scope);
      });
      scope.root.addEventListener('click', event => {
        if (event.target.closest('.oc-reset-btn')) window.setTimeout(() => renderScope(scope), 20);
      });
    });

    scopes.forEach(renderScope);
    window.__OC_FILTER_CHIPS_READY__ = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
