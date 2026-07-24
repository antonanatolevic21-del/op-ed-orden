let lastFocused = null;
let activeModal = null;

const MODAL_SELECTOR = '#oc-opening-modal,#oc-season-evaluator,#oc-auth-modal,#oc-register-modal,#oc-name-modal,#oc-confirm-modal,#oc-franchise-repair-modal,#oc-image-migration-modal,.oc-quality-modal,.ev-modal';
const FOCUSABLE = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

function isVisible(element) {
  return Boolean(element && !element.classList.contains('hidden') && element.getClientRects().length);
}

function visibleModal() {
  return [...document.querySelectorAll(MODAL_SELECTOR)].reverse().find(isVisible) || null;
}

function prepareModal(modal) {
  if (!modal) return;
  modal.setAttribute('role', modal.getAttribute('role') || 'dialog');
  modal.setAttribute('aria-modal', 'true');
  if (!modal.hasAttribute('aria-label') && !modal.hasAttribute('aria-labelledby')) {
    const heading = modal.querySelector('h1,h2,h3,.oc-eval-title,.ev-guess-game-title');
    if (heading) {
      if (!heading.id) heading.id = `oc-modal-title-${Math.random().toString(36).slice(2, 8)}`;
      modal.setAttribute('aria-labelledby', heading.id);
    }
  }
}

function activate(modal) {
  if (activeModal === modal) return;
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeModal = modal;
  prepareModal(modal);
  requestAnimationFrame(() => {
    const first = modal.querySelector(FOCUSABLE);
    first?.focus({ preventScroll: true });
  });
}

function deactivate() {
  if (!activeModal) return;
  activeModal = null;
  if (lastFocused?.isConnected) lastFocused.focus({ preventScroll: true });
  lastFocused = null;
}

function syncModal() {
  const modal = visibleModal();
  if (modal) activate(modal);
  else deactivate();
}

function trapTab(event) {
  if (event.key !== 'Tab' || !activeModal || !isVisible(activeModal)) return;
  const focusable = [...activeModal.querySelectorAll(FOCUSABLE)].filter(isVisible);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    last.focus();
    event.preventDefault();
  } else if (!event.shiftKey && document.activeElement === last) {
    first.focus();
    event.preventDefault();
  }
}

function improveButtons(root = document) {
  root.querySelectorAll('button:not([type])').forEach(button => button.setAttribute('type', 'button'));
  root.querySelectorAll('img:not([alt])').forEach(image => image.setAttribute('alt', ''));
}

export function initAccessibility() {
  improveButtons();
  document.addEventListener('keydown', trapTab, true);
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) improveButtons(node);
    }));
    syncModal();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  syncModal();
}
