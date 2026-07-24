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
        <div class="oc-hotkeys-head"><div><span>быстрое управление</span><h2>Горячие клавиши</h2></div><button type="button" data-hotkeys-close aria-label="Закрыть">×</button></div>
        <div class="oc-hotkeys-grid">
          <div><kbd>.</kbd><span>Перейти к поиску</span></div>
          <div><kbd>Пробел</kbd><span>Запустить видео в открытой карточке</span></div>
          <div><kbd>Esc</kbd><span>Закрыть верхнее окно или меню</span></div>
          <div><kbd>?</kbd><span>Снова открыть этот гайд</span></div>
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

  function focusSearch() {
    const profileVisible = !document.querySelector('#oc-profile-panel')?.classList.contains('hidden');
    const mainVisible = !document.querySelector('#oc-main-panel')?.classList.contains('hidden');
    const search = document.querySelector(profileVisible ? '#oc-p-search' : '#oc-f-search');
    if (!search) return false;

    if (!mainVisible && !profileVisible) document.querySelector('.oc-tab-btn[data-tab="chart"]')?.click();
    window.setTimeout(() => {
      search.focus();
      search.select?.();
    }, 0);
    return true;
  }

  function handleCardVideo() {
    const opening = visible('#oc-opening-modal');
    if (!opening) return false;

    const directVideo = opening.querySelector('.oc-video-frame video');
    if (directVideo) {
      if (directVideo.paused) directVideo.play().catch(() => {});
      else directVideo.pause();
      return true;
    }

    const cover = opening.querySelector('.oc-video-cover');
    if (cover) {
      cover.click();
      return true;
    }

    return false;
  }

  function currentPersonalUid() {
    try {
      return String(window.OPED_DB?.currentUserUid?.() || '');
    } catch (error) {
      return '';
    }
  }

  function watchLoginModal(modal) {
    if (!modal) return;
    let wasOpen = !modal.classList.contains('hidden');
    let uidWhenOpened = wasOpen ? currentPersonalUid() : '';

    new MutationObserver(() => {
      const isOpen = !modal.classList.contains('hidden');
      if (isOpen && !wasOpen) uidWhenOpened = currentPersonalUid();
      if (!isOpen && wasOpen) {
        window.setTimeout(() => {
          const uidAfter = currentPersonalUid();
          if (uidAfter && uidAfter !== uidWhenOpened) showHelp();
        }, 120);
      }
      wasOpen = isOpen;
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  function bindLoginGuide() {
    watchLoginModal(document.querySelector('#oc-auth-modal'));
    watchLoginModal(document.querySelector('#oc-name-modal'));
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (closeTopModal() || closeMenus()) event.preventDefault();
      return;
    }

    if (isEditable(event.target)) return;

    if (event.key === '.' || event.code === 'Period') {
      if (focusSearch()) event.preventDefault();
      return;
    }

    if (event.key === ' ' || event.code === 'Space') {
      if (handleCardVideo()) event.preventDefault();
      return;
    }

    if (event.key === '?') {
      showHelp();
      event.preventDefault();
    }
  });

  window.__OC_KEYBOARD_SHORTCUTS_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindLoginGuide, { once: true });
  else bindLoginGuide();
})();
