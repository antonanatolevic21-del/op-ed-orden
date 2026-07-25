(() => {
  if (window.__OC_SITE_POLICY_READY__) return;
  window.__OC_SITE_POLICY_READY__ = true;

  const CONTENT_KEY = 'content-filter-mode';
  const MIGRATION_KEY = 'oc-content-default-all-v1';
  let applyContentOnThisLoad = false;

  try {
    if (localStorage.getItem(MIGRATION_KEY) !== '1') {
      localStorage.setItem(CONTENT_KEY, 'all');
      localStorage.setItem(MIGRATION_KEY, '1');
      applyContentOnThisLoad = true;
    }
  } catch (_) {}

  function hideLegacyProfileManagement() {
    const selector = document.querySelector('#oc-profile-panel .oc-profile-select-wrap');
    const deleteButton = document.querySelector('#oc-profile-delete-btn');
    if (selector) {
      selector.hidden = true;
      selector.setAttribute('aria-hidden', 'true');
    }
    if (deleteButton) {
      deleteButton.hidden = true;
      deleteButton.setAttribute('aria-hidden', 'true');
      deleteButton.disabled = true;
    }
  }

  function applyAllContentMode() {
    if (!applyContentOnThisLoad) return;
    const select = document.querySelector('#oc-content-filter-select');
    if (!select) return;
    select.value = 'all';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    applyContentOnThisLoad = false;
  }

  function applyPolicy() {
    hideLegacyProfileManagement();
    applyAllContentMode();
  }

  new MutationObserver(applyPolicy).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyPolicy, { once: true });
  else applyPolicy();
  [0, 150, 500, 1200].forEach(delay => window.setTimeout(applyPolicy, delay));
})();
