let toastRoot = null;
let lastStatusText = '';

function ensureRoot() {
  if (toastRoot?.isConnected) return toastRoot;
  toastRoot = document.createElement('div');
  toastRoot.className = 'oc-toast-stack';
  toastRoot.setAttribute('aria-live', 'polite');
  toastRoot.setAttribute('aria-relevant', 'additions');
  document.body.append(toastRoot);
  return toastRoot;
}

export function showToast(message, options = {}) {
  const text = String(message || '').trim();
  if (!text) return null;
  const root = ensureRoot();
  const toast = document.createElement('div');
  const type = ['success', 'error', 'warning'].includes(options.type) ? options.type : 'info';
  toast.className = `oc-toast oc-toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const body = document.createElement('div');
  body.className = 'oc-toast-message';
  body.textContent = text;
  toast.append(body);

  if (options.actionLabel && typeof options.action === 'function') {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'oc-toast-action';
    action.textContent = String(options.actionLabel);
    action.addEventListener('click', async () => {
      action.disabled = true;
      try {
        await options.action();
        toast.remove();
      } catch (error) {
        console.error('Toast action failed', error);
        action.disabled = false;
        showToast('Не удалось выполнить действие.', { type: 'error' });
      }
    });
    toast.append(action);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'oc-toast-close';
  close.setAttribute('aria-label', 'Закрыть уведомление');
  close.textContent = '×';
  close.addEventListener('click', () => toast.remove());
  toast.append(close);

  root.append(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  const timeout = Number(options.timeout ?? 4600);
  if (timeout > 0) window.setTimeout(() => toast.remove(), timeout);
  return toast;
}

function inferType(text, node) {
  const value = text.toLowerCase();
  if (node?.classList?.contains('error') || /не удалось|ошиб|нельзя|недоступ/i.test(value)) return 'error';
  if (/✓|сохран|добавлен|создан|заверш/i.test(value)) return 'success';
  if (/вниман|пока|меньше|пропущ/i.test(value)) return 'warning';
  return 'info';
}

function connectLegacyStatus() {
  const status = document.querySelector('#oc-status');
  if (!status) return;
  const sync = () => {
    const text = String(status.textContent || '').trim();
    if (!text || text === lastStatusText) return;
    lastStatusText = text;
    showToast(text, { type: inferType(text, status) });
  };
  new MutationObserver(sync).observe(status, { childList: true, characterData: true, subtree: true, attributes: true });
  sync();
}

export function initToasts() {
  ensureRoot();
  connectLegacyStatus();
  window.OPED_TOAST = showToast;
}
