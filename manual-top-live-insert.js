(() => {
  if (window.__OC_MANUAL_TOP_LIVE_INSERT_READY__) return;
  window.__OC_MANUAL_TOP_LIVE_INSERT_READY__ = true;

  const clean = value => String(value ?? '').trim();

  function showMessage(message, type = '') {
    window.OC_TOAST?.show?.(message, { type });
    const status = document.querySelector('#oc-status');
    if (status) status.textContent = message;
  }

  function closePanel(panel) {
    panel?.closest('.oc-manual-insert-zone')?.classList.remove('active');
    panel?.remove();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('.oc-manual-insert-confirm');
    if (!button) return;

    const panel = button.closest('.oc-manual-insert-panel');
    const zone = panel?.closest('.oc-manual-insert-zone');
    const selected = panel?.querySelector('.oc-manual-insert-result.selected');
    const type = zone?.dataset.type === 'ED' ? 'ED' : 'OP';
    const target = Math.max(1, Math.min(100, Math.round(Number(zone?.dataset.targetPlace) || 1)));
    const id = clean(selected?.dataset.id);
    const title = clean(panel?.querySelector('.oc-manual-insert-preview-title')?.textContent || selected?.querySelector('.oc-manual-insert-result-title')?.textContent || id);

    if (!panel || !id || !window.OC_MANUAL_TOP_DRAFT?.place) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      const before = window.OC_MANUAL_TOP_DRAFT.get?.(type) || [];
      const current = before.indexOf(id);
      if (current === target - 1) {
        showMessage(`${title}: уже находится на ${target}-м месте.`, 'error');
        return;
      }

      window.OC_MANUAL_TOP_DRAFT.place(type, id, target);
      closePanel(panel);
      showMessage(`${title}: теперь ${target}-е место. Нажми «Сохранить топ-100».`, 'success');
    } catch (error) {
      console.error('Manual top live insert failed', error);
      showMessage(error?.message || 'Не удалось изменить топ.', 'error');
    }
  }, true);
})();