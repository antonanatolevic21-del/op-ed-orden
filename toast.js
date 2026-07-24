(() => {
  if (window.OC_TOAST) return;

  let stack = null;
  let lastMessage = '';
  let lastShownAt = 0;

  function ensureStack() {
    if (stack?.isConnected) return stack;
    stack = document.createElement('div');
    stack.className = 'oc-toast-stack';
    stack.setAttribute('aria-live', 'polite');
    stack.setAttribute('aria-atomic', 'false');
    document.body.append(stack);
    return stack;
  }

  function removeToast(node) {
    if (!node?.isConnected) return;
    node.classList.add('out');
    window.setTimeout(() => node.remove(), 180);
  }

  function show(message, options = {}) {
    const text = String(message || '').trim();
    if (!text) return null;
    const now = Date.now();
    if (!options.force && text === lastMessage && now - lastShownAt < 700) return null;
    lastMessage = text;
    lastShownAt = now;

    const node = document.createElement('div');
    node.className = `oc-toast ${options.type || ''}`.trim();
    node.setAttribute('role', options.type === 'error' ? 'alert' : 'status');

    const messageEl = document.createElement('div');
    messageEl.className = 'oc-toast-message';
    messageEl.textContent = text;
    node.append(messageEl);

    const actions = document.createElement('div');
    actions.className = 'oc-toast-actions';
    if (options.actionLabel && typeof options.onAction === 'function') {
      const action = document.createElement('button');
      action.type = 'button';
      action.textContent = options.actionLabel;
      action.addEventListener('click', async () => {
        action.disabled = true;
        try { await options.onAction(); }
        finally { removeToast(node); }
      }, { once: true });
      actions.append(action);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть уведомление');
    close.textContent = '×';
    close.addEventListener('click', () => removeToast(node), { once: true });
    actions.append(close);
    node.append(actions);

    ensureStack().append(node);
    const lifetime = Number(options.duration || (options.actionLabel ? 8000 : 3600));
    if (lifetime > 0) window.setTimeout(() => removeToast(node), lifetime);
    return node;
  }

  function bindLegacyStatus(attempt = 0) {
    const status = document.querySelector('#oc-status');
    if (!status) {
      if (attempt < 30) window.setTimeout(() => bindLegacyStatus(attempt + 1), 100);
      return;
    }
    status.setAttribute('aria-live', 'polite');
    let previous = String(status.textContent || '').trim();
    new MutationObserver(() => {
      const text = String(status.textContent || '').trim();
      if (!text || text === previous) return;
      previous = text;
      const style = String(status.style?.color || '').toLowerCase();
      const error = style.includes('255') || /не удалось|ошиб|нельзя|нужен/i.test(text);
      show(text, { type: error ? 'error' : (/✓|сохран|готов|выполн/i.test(text) ? 'success' : '') });
    }).observe(status, { childList: true, characterData: true, subtree: true });
  }

  window.OC_TOAST = { show };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bindLegacyStatus(), { once: true });
  else bindLegacyStatus();
})();
