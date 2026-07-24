(() => {
  if (window.__OC_ADVANCED_FILTERS_READY__) return;

  const STORAGE_KEY = 'oc-advanced-filters-open-v1';

  function savedState(scope) {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return Boolean(raw?.[scope]);
    } catch (_) {
      return false;
    }
  }

  function saveState(scope, open) {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (_) {}
    raw[scope] = Boolean(open);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  }

  function hasSelection(root) {
    return [...root.querySelectorAll('select[multiple]')].some(select => [...select.selectedOptions].some(option => String(option.value || '').trim()));
  }

  function mount(scope, divider, advanced) {
    if (!divider || !advanced || divider.dataset.advancedMounted === '1') return;
    divider.dataset.advancedMounted = '1';
    divider.classList.add('oc-advanced-toggle-wrap');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'oc-advanced-toggle';
    button.innerHTML = '<span>Расширенные фильтры</span><span class="oc-advanced-toggle-arrow">⌄</span>';
    divider.replaceChildren(button);

    const setOpen = open => {
      const next = Boolean(open);
      button.setAttribute('aria-expanded', next ? 'true' : 'false');
      advanced.classList.toggle('oc-advanced-collapsed', !next);
      saveState(scope, next);
    };

    setOpen(savedState(scope) || hasSelection(advanced));
    button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
    advanced.addEventListener('change', () => {
      if (hasSelection(advanced)) setOpen(true);
    });
  }

  function init(attempt = 0) {
    const mainDivider = document.querySelector('#oc-main-panel .oc-filter-divider');
    const mainAdvanced = document.querySelector('#oc-main-panel .oc-filter-advanced');
    const profileDivider = document.querySelector('#oc-profile-panel .oc-profile-filter-divider');
    const profileAdvanced = document.querySelector('#oc-profile-panel .oc-profile-filter-advanced');

    mount('main', mainDivider, mainAdvanced);
    mount('profile', profileDivider, profileAdvanced);

    if ((!mainDivider || !profileDivider) && attempt < 30) window.setTimeout(() => init(attempt + 1), 100);
  }

  window.__OC_ADVANCED_FILTERS_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(), { once: true });
  else init();
})();
