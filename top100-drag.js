(() => {
  if (window.__OC_TOP100_DRAG_READY__) return;
  window.__OC_TOP100_DRAG_READY__ = true;

  let drag = null;

  function panel() { return document.querySelector('#oc-profile-panel'); }
  function isTopView() { return panel()?.dataset.profileView === 'top100'; }
  function isEditing() { return Boolean(document.querySelector('#oc-manual-edit-btn')?.classList.contains('active')); }

  function cards() {
    return [...document.querySelectorAll('#oc-profile-op > .oc-profile-item.manual, #oc-profile-ed > .oc-profile-item.manual')];
  }

  function ensureHandles() {
    cards().forEach(card => {
      if (card.querySelector(':scope > .oc-top100-drag-handle')) return;
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'oc-top100-drag-handle';
      handle.setAttribute('aria-label', 'Перетащить трек на другое место');
      handle.title = 'Зажми и перетащи выше или ниже';
      handle.innerHTML = '<span aria-hidden="true">⋮⋮</span>';
      card.append(handle);
    });
  }

  function cleanup() {
    if (!drag) return;
    drag.card.classList.remove('oc-top100-card-dragging');
    drag.handle.classList.remove('active');
    document.documentElement.classList.remove('oc-top100-drag-active');
    drag = null;
  }

  function cardFromPoint(x, y) {
    const element = document.elementFromPoint(x, y);
    return element?.closest?.('#oc-profile-op > .oc-profile-item.manual, #oc-profile-ed > .oc-profile-item.manual') || null;
  }

  function autoScroll(y) {
    const margin = 90;
    if (y < margin) window.scrollBy({ top: -Math.max(8, (margin - y) * .34), behavior: 'auto' });
    else if (y > window.innerHeight - margin) window.scrollBy({ top: Math.max(8, (y - (window.innerHeight - margin)) * .34), behavior: 'auto' });
  }

  document.addEventListener('pointerdown', event => {
    const handle = event.target.closest?.('.oc-top100-drag-handle');
    if (!handle || !isTopView() || !isEditing()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const card = handle.closest('.oc-profile-item.manual');
    const container = card?.parentElement;
    if (!card || !container || !['oc-profile-op', 'oc-profile-ed'].includes(container.id)) return;

    event.preventDefault();
    event.stopPropagation();
    drag = { pointerId: event.pointerId, handle, card, container, moved: false };
    try { handle.setPointerCapture(event.pointerId); } catch (_) {}
    card.classList.add('oc-top100-card-dragging');
    handle.classList.add('active');
    document.documentElement.classList.add('oc-top100-drag-active');
  }, true);

  document.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    autoScroll(event.clientY);

    const target = cardFromPoint(event.clientX, event.clientY);
    if (!target || target === drag.card || target.parentElement !== drag.container) return;
    const rect = target.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    const reference = before ? target : target.nextElementSibling;
    if (reference === drag.card || drag.card.nextElementSibling === reference) return;
    drag.container.insertBefore(drag.card, reference);
    drag.moved = true;
  }, { capture: true, passive: false });

  document.addEventListener('pointerup', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    try { drag.handle.releasePointerCapture(event.pointerId); } catch (_) {}
    cleanup();
  }, true);

  document.addEventListener('pointercancel', cleanup, true);
  window.addEventListener('blur', cleanup);

  const root = panel() || document.documentElement;
  new MutationObserver(ensureHandles).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-profile-view'] });
  ensureHandles();
})();
