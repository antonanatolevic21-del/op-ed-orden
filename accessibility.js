(() => {
  if (window.__OC_ACCESSIBILITY_READY__) return;

  const MODAL_SELECTORS = [
    '#oc-opening-modal', '#oc-season-evaluator', '#oc-auth-modal', '#oc-register-modal', '#oc-name-modal',
    '#oc-confirm-modal', '#oc-franchise-repair-modal', '#oc-image-migration-modal', '.oc-quality-modal', '.oc-hotkeys-help'
  ].join(',');

  function visible(element) {
    return Boolean(element && !element.classList.contains('hidden') && element.getClientRects().length);
  }

  function activeModal() {
    return [...document.querySelectorAll(MODAL_SELECTORS)].reverse().find(visible) || null;
  }

  function focusables(root) {
    return [...root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length && element.getAttribute('aria-hidden') !== 'true');
  }

  function annotate() {
    const main = document.querySelector('#oc-main-panel');
    if (main && !main.id) main.id = 'oc-main-panel';
    document.querySelector('#oc-f-search')?.setAttribute('aria-label', 'Поиск по каталогу');
    document.querySelector('#oc-p-search')?.setAttribute('aria-label', 'Поиск в профиле');
    document.querySelector('.oc-topbar-nav')?.setAttribute('aria-label', 'Основная навигация');
    document.querySelector('#oc-daily-bell')?.setAttribute('aria-label', 'Ежедневная оценка');

    document.querySelectorAll(MODAL_SELECTORS).forEach(modal => {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
    });
  }

  function addSkipLink() {
    if (document.querySelector('.oc-skip-link')) return;
    const link = document.createElement('a');
    link.className = 'oc-skip-link';
    link.href = '#oc-main-panel';
    link.textContent = 'Перейти к содержимому';
    document.body.prepend(link);
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const modal = activeModal();
    if (!modal) return;
    const items = focusables(modal);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  });

  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-action="open-card"],#oc-auth-open,#oc-register-open,.oc-tab-btn');
    if (!opener) return;
    window.setTimeout(annotate, 0);
  }, true);

  window.__OC_ACCESSIBILITY_READY__ = true;
  const init = () => { addSkipLink(); annotate(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
