(() => {
  if (window.__OC_UX_AUDIT_READY__) return;
  window.__OC_UX_AUDIT_READY__ = true;

  const FILTER_STATE_KEY = 'oped:ux-filter-state:v1';
  const SCROLL_STATE_KEY = 'oped:ux-scroll-state:v1';
  const filterSelectors = [
    '#oc-f-search', '#oc-f-type', '#oc-f-score-cmp', '#oc-f-score-value',
    '#oc-f-from-year', '#oc-f-from-season', '#oc-f-to-year', '#oc-f-to-season',
    '#oc-f-studio', '#oc-f-director', '#oc-f-performer', '#oc-f-franchise', '#oc-f-missing',
    '#oc-p-search', '#oc-p-type', '#oc-p-score-cmp', '#oc-p-score-value',
    '#oc-p-from-year', '#oc-p-from-season', '#oc-p-to-year',
    '#oc-p-to-season', '#oc-p-missing', '#oc-entity-album-search', '#oc-entity-album-sort',
    '#oc-entity-search', '#oc-entity-track-type', '#oc-entity-from-year',
    '#oc-entity-from-season', '#oc-entity-to-year', '#oc-entity-to-season',
    '#oc-entity-progress'
  ];
  let saveDepth = 0;
  let saveTimer = 0;
  let lastRoute = '';

  function currentRoute() {
    const active = document.querySelector('.oc-tab-btn.active')?.dataset.tab;
    return `${location.pathname}${location.search}|${active || 'chart'}`;
  }

  function readJson(storage, key, fallback = {}) {
    try { return JSON.parse(storage.getItem(key) || '') || fallback; } catch (_) { return fallback; }
  }

  function saveFilterState() {
    const state = {};
    for (const selector of filterSelectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      if (element instanceof HTMLSelectElement && element.multiple) {
        state[selector] = [...element.selectedOptions].map(option => option.value);
      } else {
        state[selector] = element.type === 'checkbox' ? Boolean(element.checked) : element.value;
      }
    }
    sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
  }

  function restoreFilterState() {
    const state = readJson(sessionStorage, FILTER_STATE_KEY);
    const changedElements = [];
    for (const [selector, value] of Object.entries(state)) {
      const element = document.querySelector(selector);
      if (!element) continue;
      if (element instanceof HTMLSelectElement && element.multiple && Array.isArray(value)) {
        [...element.options].forEach(option => { option.selected = value.includes(option.value); });
      } else if (element.type === 'checkbox') {
        element.checked = Boolean(value);
      } else if ([...element.options || []].length && ![...element.options].some(option => option.value === String(value))) {
        continue;
      } else {
        element.value = String(value ?? '');
      }
      changedElements.push(element);
    }
    for (const element of changedElements) {
      element.dispatchEvent(new Event(element.tagName === 'INPUT' && element.type !== 'checkbox' ? 'input' : 'change', { bubbles: true }));
    }
  }

  function saveScroll(route = lastRoute || currentRoute()) {
    const states = readJson(sessionStorage, SCROLL_STATE_KEY);
    states[route] = { y: Math.max(0, Math.round(window.scrollY)), at: Date.now() };
    const rows = Object.entries(states).sort((a, b) => b[1].at - a[1].at).slice(0, 20);
    sessionStorage.setItem(SCROLL_STATE_KEY, JSON.stringify(Object.fromEntries(rows)));
  }

  function restoreScroll() {
    const state = readJson(sessionStorage, SCROLL_STATE_KEY)[currentRoute()];
    if (!state || !Number.isFinite(state.y) || state.y < 80) return;
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: state.y, behavior: 'auto' })));
  }

  function ensureBackToTop() {
    if (document.querySelector('#oc-back-to-top')) return;
    const button = document.createElement('button');
    button.id = 'oc-back-to-top';
    button.className = 'oc-back-to-top';
    button.type = 'button';
    button.textContent = '↑';
    button.title = 'Наверх';
    button.setAttribute('aria-label', 'Наверх');
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.append(button);
    const sync = () => button.classList.toggle('visible', window.scrollY > 700);
    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  function ensureSaveIndicator() {
    let indicator = document.querySelector('#oc-save-progress');
    if (indicator) return indicator;
    indicator = document.createElement('div');
    indicator.id = 'oc-save-progress';
    indicator.className = 'oc-save-progress';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-live', 'polite');
    document.body.append(indicator);
    return indicator;
  }

  function setSaveState(state, message) {
    const indicator = ensureSaveIndicator();
    window.clearTimeout(saveTimer);
    indicator.className = `oc-save-progress ${state}`;
    indicator.textContent = message;
    if (state !== 'saving') {
      saveTimer = window.setTimeout(() => { indicator.className = 'oc-save-progress'; }, state === 'error' ? 5000 : 2200);
    }
  }

  function wrapDatabase() {
    const database = window.OPED_DB;
    if (!database || database.__uxWrapped) return;
    Object.defineProperty(database, '__uxWrapped', { value: true });
    for (const name of Object.keys(database)) {
      if (!/^(save|add|update|delete|acknowledge)/i.test(name) || typeof database[name] !== 'function') continue;
      const original = database[name].bind(database);
      database[name] = async (...args) => {
        saveDepth += 1;
        setSaveState('saving', 'Сохраняем…');
        try {
          const result = await original(...args);
          saveDepth = Math.max(0, saveDepth - 1);
          if (!saveDepth) setSaveState('saved', 'Сохранено ✓');
          return result;
        } catch (error) {
          saveDepth = Math.max(0, saveDepth - 1);
          setSaveState('error', 'Не удалось сохранить');
          throw error;
        }
      };
    }
  }

  function improveLoadingAccessibility(root = document) {
    root.querySelectorAll('.oc-empty').forEach(element => {
      if (/загруз|подожд|получа/i.test(element.textContent || '')) {
        element.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function init() {
    lastRoute = currentRoute();
    ensureBackToTop();
    ensureSaveIndicator();
    improveLoadingAccessibility();
    wrapDatabase();
    window.setTimeout(restoreFilterState, 350);

    document.addEventListener('input', event => {
      if (filterSelectors.includes(`#${event.target?.id}`)) saveFilterState();
    });
    document.addEventListener('change', event => {
      if (filterSelectors.includes(`#${event.target?.id}`)) saveFilterState();
    });
    window.addEventListener('beforeunload', () => {
      saveFilterState();
      saveScroll();
    });
    window.addEventListener('oped:route-change', () => {
      saveScroll(lastRoute);
      lastRoute = currentRoute();
    });
    window.addEventListener('oped:route-ready', () => {
      lastRoute = currentRoute();
      improveLoadingAccessibility();
      window.setTimeout(restoreScroll, 80);
    });
    window.addEventListener('oped-db-ready', wrapDatabase);
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) improveLoadingAccessibility(node);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
