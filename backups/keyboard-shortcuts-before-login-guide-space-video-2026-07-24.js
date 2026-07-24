(() => {
  if (window.__OC_KEYBOARD_SHORTCUTS_READY__) return;

  let help = null;

  function isEditable(target) {
    return Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"]'));
  }

  function visible(selector) {
    return [...document.querySelectorAll(selector)].find(element => !element.classList.contains('hidden') && element.getClientRects().length) || null;
  }

  function ensureHelp() {
    if (help?.isConnected) return help;
    help = document.createElement('div');
    help.className = 'oc-hotkeys-help hidden';
    help.innerHTML = `
      <div class="oc-hotkeys-card" role="dialog" aria-modal="true" aria-label="Горячие клавиши">
        <div class="oc-hotkeys-head"><div><span>управление</span><h2>Горячие клавиши</h2></div><button type="button" data-hotkeys-close aria-label="Закрыть">×</button></div>
        <div class="oc-hotkeys-grid">
          <div><kbd>/</kbd><span>Фокус на поиске</span></div>
          <div><kbd>1–0</kbd><span>Поставить оценку; 0 = максимум</span></div>
          <div><kbd>Enter</kbd><span>Сохранить / сохранить и дальше</span></div>
          <div><kbd>←</kbd><span>Предыдущая страница</span></div>
          <div><kbd>→</kbd><span>Следующая страница</span></div>
          <div><kbd>Esc</kbd><span>Закрыть верхнее окно или меню</span></div>
          <div><kbd>?</kbd><span>Показать эту подсказку</span></div>
        </div>
      </div>`;
    document.body.append(help);
    help.addEventListener('click', event => {
      if (event.target === help || event.target.closest('[data-hotkeys-close]')) hideHelp();
    });
    return help;
  }

  function showHelp() {
    ensureHelp().classList.remove('hidden');
    help.querySelector('[data-hotkeys-close]')?.focus();
  }

  function hideHelp() {
    help?.classList.add('hidden');
  }

  function closeTopModal() {
    if (help && !help.classList.contains('hidden')) {
      hideHelp();
      return true;
    }

    const modal = visible('.oc-quality-modal,#oc-opening-modal,#oc-season-evaluator,#oc-auth-modal,#oc-register-modal,#oc-name-modal,#oc-confirm-modal,#oc-franchise-repair-modal,#oc-image-migration-modal');
    if (!modal) return false;

    const close = modal.querySelector('[data-quality-close],[data-modal-close],[data-eval-action="close"],#oc-auth-close,#oc-register-close,#oc-modal-name-close,[data-image-migration-close],[data-action="close"],[data-action="close-modal"],.oc-modal-close,.oc-edit-cancel,button[aria-label="Закрыть"]');
    if (close) close.click();
    else modal.classList.add('hidden');
    return true;
  }

  function closeMenus() {
    let changed = false;
    document.querySelectorAll('.oc-topbar-account[open],.oc-topbar-ratings[open]').forEach(details => {
      details.open = false;
      changed = true;
    });
    document.querySelectorAll('.oc-topbar-mobile-ratings-menu').forEach(menu => {
      if (!menu.hidden) {
        menu.hidden = true;
        changed = true;
      }
    });
    return changed;
  }

  function activeScoreFields() {
    const opening = visible('#oc-opening-modal');
    if (opening) {
      const number = opening.querySelector('#oc-card-score,input[type="number"][data-score],.oc-card-score input[type="number"]');
      const range = opening.querySelector('#oc-card-range,input[type="range"]');
      const save = opening.querySelector('[data-card-action="save-rating"],[data-action="save-rating"],[data-action="save"]');
      if (number || range) return { number, range, save };
    }

    const evaluator = visible('#oc-season-evaluator');
    if (evaluator) {
      const number = evaluator.querySelector('#oc-eval-score,input[type="number"]');
      const range = evaluator.querySelector('#oc-eval-range,input[type="range"]');
      const save = evaluator.querySelector('[data-eval-action="save-next"]');
      if (number || range) return { number, range, save };
    }

    return null;
  }

  function numericField(fields) {
    return fields?.number || fields?.range || null;
  }

  function setScore(value) {
    const fields = activeScoreFields();
    const primary = numericField(fields);
    if (!primary) return false;
    const min = Number(primary.min || 1);
    const max = Number(primary.max || 10);
    const next = Math.max(min, Math.min(max, value));

    if (fields.number) {
      fields.number.value = String(next);
      fields.number.dispatchEvent(new Event('input', { bubbles: true }));
      fields.number.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (fields.range) {
      fields.range.value = String(next);
      fields.range.dispatchEvent(new Event('input', { bubbles: true }));
      fields.range.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  function focusSearch() {
    const profileVisible = !document.querySelector('#oc-profile-panel')?.classList.contains('hidden');
    const mainVisible = !document.querySelector('#oc-main-panel')?.classList.contains('hidden');
    const search = document.querySelector(profileVisible ? '#oc-p-search' : mainVisible ? '#oc-f-search' : '#oc-f-search');
    if (!search) return false;
    if (!mainVisible && !profileVisible) document.querySelector('.oc-tab-btn[data-tab="chart"]')?.click();
    window.setTimeout(() => {
      search.focus();
      search.select?.();
    }, 0);
    return true;
  }

  function page(direction) {
    const activePanel = [...document.querySelectorAll('.oc-tab-panel')].find(panel => !panel.classList.contains('hidden') && panel.getClientRects().length);
    if (!activePanel) return false;
    const selectors = direction === 'prev'
      ? ['.oc-pagination [data-page-dir="prev"]:not(:disabled)', '.oc-pagination button:first-child:not(:disabled)']
      : ['.oc-pagination [data-page-dir="next"]:not(:disabled)', '.oc-pagination button:last-child:not(:disabled)'];
    const button = selectors.map(selector => activePanel.querySelector(selector)).find(Boolean);
    if (!button) return false;
    button.click();
    button.scrollIntoView({ block: 'nearest' });
    return true;
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (closeTopModal() || closeMenus()) event.preventDefault();
      return;
    }

    const scoreFields = activeScoreFields();
    const editing = isEditable(event.target);

    if (event.key === 'Enter' && scoreFields?.save) {
      const primary = numericField(scoreFields);
      if (!editing || event.target === primary || event.target === scoreFields.number || event.target === scoreFields.range) {
        scoreFields.save.click();
        event.preventDefault();
        return;
      }
    }

    if (editing) return;

    if (event.key === '/') {
      if (focusSearch()) event.preventDefault();
      return;
    }

    if (event.key === '?') {
      showHelp();
      event.preventDefault();
      return;
    }

    if (/^[0-9]$/.test(event.key) && scoreFields) {
      const primary = numericField(scoreFields);
      const max = Number(primary?.max || 10);
      const value = event.key === '0' ? max : Number(event.key);
      if (setScore(value)) event.preventDefault();
      return;
    }

    if (!scoreFields && event.key === 'ArrowLeft') {
      if (page('prev')) event.preventDefault();
      return;
    }

    if (!scoreFields && event.key === 'ArrowRight') {
      if (page('next')) event.preventDefault();
    }
  });

  window.__OC_KEYBOARD_SHORTCUTS_READY__ = true;
})();
