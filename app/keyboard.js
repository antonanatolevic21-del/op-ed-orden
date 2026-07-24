import { showToast } from './toast.js';

function isEditable(target) {
  return Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"]'));
}

function visible(selector) {
  return [...document.querySelectorAll(selector)].find(element => !element.classList.contains('hidden') && element.getClientRects().length) || null;
}

function closeTopModal() {
  const modal = visible('#oc-opening-modal,#oc-season-evaluator,#oc-auth-modal,#oc-register-modal,#oc-name-modal,#oc-confirm-modal,#oc-franchise-repair-modal,#oc-image-migration-modal,.oc-quality-modal');
  if (!modal) return false;
  const close = modal.querySelector('[data-modal-close],[data-eval-action="close"],[data-quality-close],#oc-auth-close,#oc-register-close,#oc-modal-name-close,[data-image-migration-close],.oc-edit-cancel');
  if (close) close.click();
  else modal.classList.add('hidden');
  return true;
}

function activeScoreFields() {
  const opening = visible('#oc-opening-modal');
  if (opening) return { number: opening.querySelector('#oc-card-score'), range: opening.querySelector('#oc-card-range'), save: opening.querySelector('[data-card-action="save-rating"]') };
  const evaluator = visible('#oc-season-evaluator');
  if (evaluator) return { number: evaluator.querySelector('#oc-eval-score'), range: evaluator.querySelector('#oc-eval-range'), save: evaluator.querySelector('[data-eval-action="save"]') };
  return null;
}

function setScore(value) {
  const fields = activeScoreFields();
  if (!fields?.number) return false;
  const min = Number(fields.number.min || 1);
  const max = Number(fields.number.max || 10);
  const next = Math.max(min, Math.min(max, value));
  fields.number.value = String(next);
  fields.number.dispatchEvent(new Event('input', { bubbles: true }));
  if (fields.range) {
    fields.range.value = String(next);
    fields.range.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return true;
}

function focusSearch() {
  const profileVisible = !document.querySelector('#oc-profile-panel')?.classList.contains('hidden');
  const search = document.querySelector(profileVisible ? '#oc-p-search' : '#oc-f-search');
  if (!search) return false;
  search.focus();
  search.select?.();
  return true;
}

function page(direction) {
  const activePanel = [...document.querySelectorAll('.oc-tab-panel')].find(panel => !panel.classList.contains('hidden'));
  const button = activePanel?.querySelector(`.oc-pagination [data-page-dir="${direction}"]:not(:disabled)`);
  if (!button) return false;
  button.click();
  button.scrollIntoView({ block: 'nearest' });
  return true;
}

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (closeTopModal()) { event.preventDefault(); return; }
      document.querySelectorAll('.oc-shell-account-menu,.oc-shell-ratings-menu').forEach(menu => { menu.hidden = true; });
      return;
    }

    if (isEditable(event.target)) return;

    if (event.key === '/') {
      if (focusSearch()) event.preventDefault();
      return;
    }

    if (event.key === '?') {
      showToast('Клавиши: / — поиск · 1–0 — оценка · Enter — сохранить · ←/→ — страницы · Esc — закрыть', { timeout: 6500 });
      return;
    }

    if (/^[0-9]$/.test(event.key) && activeScoreFields()) {
      if (setScore(event.key === '0' ? 10 : Number(event.key))) event.preventDefault();
      return;
    }

    if (event.key === 'Enter') {
      const fields = activeScoreFields();
      if (fields?.save) { fields.save.click(); event.preventDefault(); }
      return;
    }

    if (!activeScoreFields() && event.key === 'ArrowLeft') {
      if (page('prev')) event.preventDefault();
      return;
    }
    if (!activeScoreFields() && event.key === 'ArrowRight') {
      if (page('next')) event.preventDefault();
    }
  });
}
