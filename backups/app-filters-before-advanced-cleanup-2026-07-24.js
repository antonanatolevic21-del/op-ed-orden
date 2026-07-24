const CATEGORY_LABELS = {
  studio: 'Студия',
  director: 'Режиссёр',
  performer: 'Исполнитель',
  franchise: 'Франшиза'
};

let mainAdvancedOpen = false;
let profileAdvancedOpen = false;
let updating = false;

function dispatchControl(element) {
  if (!element) return;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function selectedValues(id) {
  const select = document.querySelector(id);
  return select ? [...select.selectedOptions].map(option => option.value).filter(Boolean) : [];
}

function hasAdvancedValues(prefix) {
  const ids = ['studio', 'director', 'performer', 'franchise'];
  return ids.some(key => selectedValues(`#oc-${prefix}-${key}`).length) || Boolean(document.querySelector(`#oc-${prefix}-missing`)?.checked);
}

function createToggle(container, profile = false) {
  if (!container || container.querySelector('.oc-advanced-toggle')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'oc-advanced-toggle';
  button.innerHTML = `<span>Расширенные фильтры</span><strong>⌄</strong>`;
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => {
    if (profile) profileAdvancedOpen = !profileAdvancedOpen;
    else mainAdvancedOpen = !mainAdvancedOpen;
    renderAdvancedState();
  });
  container.append(button);
}

function prepareProfileAdvanced() {
  const filterbar = document.querySelector('.oc-profile-filterbar');
  if (!filterbar || filterbar.querySelector('.oc-profile-advanced-toggle-row')) return;
  const grid = filterbar.querySelector('.oc-filtergrid');
  if (!grid) return;
  const selectors = ['#oc-p-missing', '#oc-p-studio', '#oc-p-director', '#oc-p-performer', '#oc-p-franchise'];
  selectors.forEach(selector => document.querySelector(selector)?.closest('.oc-field')?.classList.add('oc-profile-advanced-field'));
  const row = document.createElement('div');
  row.className = 'oc-profile-advanced-toggle-row';
  grid.insertBefore(row, grid.querySelector('.oc-profile-advanced-field'));
  createToggle(row, true);
}

function renderAdvancedState() {
  const mainAdvanced = document.querySelector('#oc-main-panel .oc-filter-advanced');
  const mainToggle = document.querySelector('#oc-main-panel .oc-advanced-toggle');
  if (mainAdvanced) mainAdvanced.classList.toggle('oc-advanced-collapsed', !mainAdvancedOpen);
  if (mainToggle) {
    mainToggle.setAttribute('aria-expanded', String(mainAdvancedOpen));
    const count = ['studio','director','performer','franchise'].reduce((sum, key) => sum + selectedValues(`#oc-f-${key}`).length, 0) + (document.querySelector('#oc-f-missing')?.checked ? 1 : 0);
    mainToggle.querySelector('span').textContent = `Расширенные фильтры${count ? ` · ${count}` : ''}`;
    mainToggle.querySelector('strong').textContent = mainAdvancedOpen ? '⌃' : '⌄';
  }

  const profileToggle = document.querySelector('.oc-profile-advanced-toggle-row .oc-advanced-toggle');
  document.querySelectorAll('.oc-profile-advanced-field').forEach(field => field.classList.toggle('oc-profile-advanced-collapsed', !profileAdvancedOpen));
  if (profileToggle) {
    profileToggle.setAttribute('aria-expanded', String(profileAdvancedOpen));
    const count = ['studio','director','performer','franchise'].reduce((sum, key) => sum + selectedValues(`#oc-p-${key}`).length, 0) + (document.querySelector('#oc-p-missing')?.checked ? 1 : 0);
    profileToggle.querySelector('span').textContent = `Расширенные фильтры${count ? ` · ${count}` : ''}`;
    profileToggle.querySelector('strong').textContent = profileAdvancedOpen ? '⌃' : '⌄';
  }
}

function ensureMainToggle() {
  const divider = document.querySelector('#oc-main-panel .oc-filter-divider');
  if (!divider) return;
  const oldLabel = divider.querySelector('span');
  if (oldLabel) oldLabel.hidden = true;
  createToggle(divider, false);
}

function chip(label, key, value = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'oc-filter-chip';
  button.dataset.clearFilter = key;
  if (value) button.dataset.filterValue = value;
  button.innerHTML = `<span>${label}</span><b aria-hidden="true">×</b>`;
  button.setAttribute('aria-label', `Убрать фильтр: ${label}`);
  return button;
}

function seasonLabel(value) {
  return ({ winter:'Зима', spring:'Весна', summer:'Лето', fall:'Осень' })[value] || value;
}

function buildChips() {
  const nodes = [];
  const search = document.querySelector('#oc-f-search')?.value.trim();
  const type = document.querySelector('#oc-f-type')?.value;
  const cmp = document.querySelector('#oc-f-score-cmp')?.value;
  const score = document.querySelector('#oc-f-score-value')?.value;
  const fromYear = document.querySelector('#oc-f-from-year')?.value;
  const fromSeason = document.querySelector('#oc-f-from-season')?.value;
  const toYear = document.querySelector('#oc-f-to-year')?.value;
  const toSeason = document.querySelector('#oc-f-to-season')?.value;
  const missing = document.querySelector('#oc-f-missing')?.checked;

  if (search) nodes.push(chip(`Поиск: ${search}`, 'search'));
  if (type) nodes.push(chip(type, 'type'));
  if (cmp && score) nodes.push(chip(`Оценка ${cmp} ${score}`, 'score'));
  if (fromYear || toYear) {
    const from = fromYear ? `${seasonLabel(fromSeason)} ${fromYear}` : 'начало';
    const to = toYear ? `${seasonLabel(toSeason)} ${toYear}` : 'сейчас';
    nodes.push(chip(`${from} — ${to}`, 'range'));
  }
  if (missing) nodes.push(chip('Незаполненные поля', 'missing'));
  ['studio','director','performer','franchise'].forEach(key => {
    selectedValues(`#oc-f-${key}`).forEach(value => nodes.push(chip(`${CATEGORY_LABELS[key]}: ${value}`, key, value)));
  });
  return nodes;
}

function ensureChipBar() {
  const filterbar = document.querySelector('#oc-main-panel > .oc-filterbar');
  if (!filterbar) return null;
  let bar = document.querySelector('#oc-active-filter-chips');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'oc-active-filter-chips';
    bar.className = 'oc-active-filter-chips';
    bar.setAttribute('aria-live', 'polite');
    filterbar.insertAdjacentElement('afterend', bar);
    bar.addEventListener('click', event => {
      const button = event.target.closest('[data-clear-filter]');
      if (!button) return;
      clearFilter(button.dataset.clearFilter, button.dataset.filterValue || '');
    });
  }
  return bar;
}

function setBoth(base, value, checked = null) {
  ['f','p'].forEach(prefix => {
    const element = document.querySelector(`#oc-${prefix}-${base}`);
    if (!element) return;
    if (checked !== null) element.checked = checked;
    else element.value = value;
  });
  const primary = document.querySelector(`#oc-f-${base}`) || document.querySelector(`#oc-p-${base}`);
  dispatchControl(primary);
}

function clearMulti(key, value) {
  ['f','p'].forEach(prefix => {
    const select = document.querySelector(`#oc-${prefix}-${key}`);
    if (!select) return;
    [...select.options].forEach(option => { if (option.value === value) option.selected = false; });
  });
  dispatchControl(document.querySelector(`#oc-f-${key}`) || document.querySelector(`#oc-p-${key}`));
}

function clearFilter(key, value) {
  if (key === 'search') setBoth('search', '');
  else if (key === 'type') setBoth('type', '');
  else if (key === 'score') { setBoth('score-cmp', ''); setBoth('score-value', ''); }
  else if (key === 'range') {
    setBoth('from-year', ''); setBoth('to-year', '');
    setBoth('from-season', 'winter'); setBoth('to-season', 'fall');
  } else if (key === 'missing') setBoth('missing', '', false);
  else if (CATEGORY_LABELS[key]) clearMulti(key, value);
  window.setTimeout(update, 20);
}

function renderChips() {
  const bar = ensureChipBar();
  if (!bar) return;
  const nodes = buildChips();
  bar.replaceChildren(...nodes);
  bar.classList.toggle('hidden', nodes.length === 0);
}

function update() {
  if (updating) return;
  updating = true;
  try {
    if (hasAdvancedValues('f')) mainAdvancedOpen = true;
    if (hasAdvancedValues('p')) profileAdvancedOpen = true;
    renderAdvancedState();
    renderChips();
  } finally {
    updating = false;
  }
}

export function initFiltersExperience() {
  ensureMainToggle();
  prepareProfileAdvanced();
  mainAdvancedOpen = hasAdvancedValues('f');
  profileAdvancedOpen = hasAdvancedValues('p');
  document.addEventListener('input', event => { if (event.target.closest('.oc-filterbar')) window.setTimeout(update, 0); });
  document.addEventListener('change', event => { if (event.target.closest('.oc-filterbar')) window.setTimeout(update, 0); });
  document.querySelector('#oc-reset-filters')?.addEventListener('click', () => { mainAdvancedOpen = false; window.setTimeout(update, 30); });
  document.querySelector('#oc-p-reset-filters')?.addEventListener('click', () => { profileAdvancedOpen = false; window.setTimeout(update, 30); });
  window.setInterval(update, 900);
  update();
}
