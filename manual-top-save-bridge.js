(() => {
  if (window.__OC_MANUAL_TOP_SAVE_BRIDGE_READY__) return;
  window.__OC_MANUAL_TOP_SAVE_BRIDGE_READY__ = true;

  const clean = value => String(value ?? '').trim();
  const normalize = value => {
    try {
      return window.OPED_DB?.normalizeNickname?.(value)
        || clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60);
    } catch (_) {
      return clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60);
    }
  };

  function viewedUser() {
    return clean(document.querySelector('#oc-profile-user')?.value || document.querySelector('#oc-myname')?.value);
  }

  function ownUser() {
    return clean(document.querySelector('#oc-myname')?.value || localStorage.getItem('op-ed-primary-account-name') || localStorage.getItem('my-display-name'));
  }

  function editingOwnTop() {
    if (!document.querySelector('#oc-manual-edit-btn')?.classList.contains('active')) return false;
    const viewed = viewedUser();
    const own = ownUser();
    return Boolean(viewed && own && normalize(viewed) === normalize(own));
  }

  function collectOrder(type) {
    const container = document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op');
    if (!container) return [];
    const seen = new Set();
    const result = [];
    container.querySelectorAll(':scope > .oc-profile-item.manual').forEach(card => {
      const id = clean(
        card.dataset.explicitTopId
        || card.querySelector('[data-action="set-rank"][data-id]')?.dataset.id
      );
      if (!id || seen.has(id) || result.length >= 100) return;
      seen.add(id);
      result.push(id);
    });
    return result;
  }

  async function getDb() {
    if (window.OPED_DB?.saveManualRanks) return window.OPED_DB;
    await Promise.race([
      new Promise(resolve => window.addEventListener('oped-db-ready', resolve, { once: true })),
      new Promise(resolve => window.setTimeout(resolve, 8000))
    ]);
    if (!window.OPED_DB?.saveManualRanks) throw new Error('Firebase ещё не готов. Попробуй ещё раз.');
    return window.OPED_DB;
  }

  function showMessage(message, type = '') {
    window.OC_TOAST?.show?.(message, { type });
    const status = document.querySelector('#oc-status');
    if (status) status.textContent = message;
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest?.('#oc-manual-save-btn');
    if (!button || !editingOwnTop()) return;

    // manual-top-explicit owns the visible draft. Stop the legacy/core save
    // handlers and persist exactly the order currently rendered on screen.
    event.preventDefault();
    event.stopImmediatePropagation();

    const user = viewedUser();
    const payload = {
      OP: collectOrder('OP'),
      ED: collectOrder('ED')
    };

    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Сохраняю…';

    try {
      const db = await getDb();
      await db.saveManualRanks(user, payload);
      try {
        localStorage.removeItem(`oc-explicit-top-draft-v1:${normalize(user)}`);
      } catch (_) {}
      document.dispatchEvent(new CustomEvent('oc:top100-saved', {
        detail: { user, OP: payload.OP.slice(), ED: payload.ED.slice() }
      }));
      button.classList.remove('active');
      showMessage('Твой топ-100 сохранён и будет виден всем ✓', 'success');
    } catch (error) {
      console.error('Manual top save bridge failed', error);
      showMessage(error?.message || 'Не удалось сохранить ручной топ-100.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }, true);
})();
