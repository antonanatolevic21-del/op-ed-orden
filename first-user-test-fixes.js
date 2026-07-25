(() => {
  if (window.__OC_FIRST_USER_TEST_FIXES_READY__) return;
  window.__OC_FIRST_USER_TEST_FIXES_READY__ = true;

  const FIVE_VALUE = 'five';
  const SKLT_KEY = 'sklt';
  let scaleSyncing = false;
  let fiveOptionTemplate = null;

  const clean = value => String(value || '').trim();
  const norm = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');

  function currentAccountName() {
    return clean(
      document.querySelector('#oc-myname')?.value ||
      localStorage.getItem('op-ed-primary-account-name') ||
      localStorage.getItem('my-display-name') || ''
    );
  }

  function protectOpeningBackdrop() {
    const modal = document.querySelector('#oc-opening-modal');
    if (!modal || modal.dataset.ocIntentionalBackdropBound === '1') return;
    modal.dataset.ocIntentionalBackdropBound = '1';

    let gesture = null;
    modal.addEventListener('pointerdown', event => {
      gesture = {
        pointerId: event.pointerId,
        startedOnBackdrop: event.target === modal,
        startX: event.clientX,
        startY: event.clientY,
        endedOnBackdrop: false,
        moved: false
      };
    }, true);

    modal.addEventListener('pointermove', event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 7) gesture.moved = true;
    }, true);

    modal.addEventListener('pointerup', event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      gesture.endedOnBackdrop = event.target === modal;
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 7) gesture.moved = true;
    }, true);

    modal.addEventListener('pointercancel', () => { gesture = null; }, true);

    modal.addEventListener('click', event => {
      if (event.target !== modal) return;
      const intentionalBackdropClick = Boolean(
        gesture && gesture.startedOnBackdrop && gesture.endedOnBackdrop && !gesture.moved
      );
      gesture = null;
      if (intentionalBackdropClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function ensureFiveOption(select) {
    if (!fiveOptionTemplate) {
      fiveOptionTemplate = select.querySelector(`option[value="${FIVE_VALUE}"]`)?.cloneNode(true) || null;
    }
    if (select.querySelector(`option[value="${FIVE_VALUE}"]`)) return;
    const option = fiveOptionTemplate || document.createElement('option');
    option.value = FIVE_VALUE;
    option.textContent = option.textContent || 'оценка 1–5';
    select.append(option.cloneNode(true));
  }

  function syncScalePolicy() {
    if (scaleSyncing) return;
    const select = document.querySelector('#oc-scale-select');
    if (!select) return;
    if (!fiveOptionTemplate) fiveOptionTemplate = select.querySelector(`option[value="${FIVE_VALUE}"]`)?.cloneNode(true) || null;

    const allowed = norm(currentAccountName()) === SKLT_KEY;
    const fiveOption = select.querySelector(`option[value="${FIVE_VALUE}"]`);

    scaleSyncing = true;
    try {
      if (allowed) {
        ensureFiveOption(select);
        if (localStorage.getItem('rating-scale') === FIVE_VALUE && select.value !== FIVE_VALUE) {
          select.value = FIVE_VALUE;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        const mustReset = select.value === FIVE_VALUE || localStorage.getItem('rating-scale') === FIVE_VALUE;
        if (mustReset) {
          localStorage.setItem('rating-scale', 'int');
          select.value = 'int';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        fiveOption?.remove();
      }
      select.dataset.fivePointOwner = allowed ? 'SKLT' : '';
    } finally {
      scaleSyncing = false;
    }
  }

  function removeLegacyUserManager() {
    document.querySelectorAll('.oc-user-manager').forEach(panel => panel.remove());
  }

  function syncAll() {
    protectOpeningBackdrop();
    syncScalePolicy();
    removeLegacyUserManager();
  }

  const nameInput = document.querySelector('#oc-myname');
  nameInput?.addEventListener('input', syncScalePolicy);
  nameInput?.addEventListener('change', syncScalePolicy);
  const badge = document.querySelector('#oc-access-badge');
  if (badge) new MutationObserver(syncAll).observe(badge, { attributes: true, childList: true, characterData: true, subtree: true });

  document.querySelector('#oc-scale-select')?.addEventListener('change', () => {
    if (norm(currentAccountName()) !== SKLT_KEY && document.querySelector('#oc-scale-select')?.value === FIVE_VALUE) {
      syncScalePolicy();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAll, { once: true });
  else syncAll();
  [250, 900, 2500, 6000].forEach(delay => window.setTimeout(syncAll, delay));
})();