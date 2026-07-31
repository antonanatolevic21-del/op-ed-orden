(() => {
  if (window.__OC_IMAGE_UPLOAD_SECRET_MEMORY_READY__) return;
  window.__OC_IMAGE_UPLOAD_SECRET_MEMORY_READY__ = true;

  const SESSION_KEY = 'op-ed-image-upload-secret';
  const DEVICE_KEY = 'op-ed-image-upload-secret-device-v1';
  const WORKER_ORIGIN = 'https://oped-image-upload.keeperkeeper2003-01e.workers.dev';
  const originalPrompt = window.prompt.bind(window);
  const originalFetch = window.fetch.bind(window);

  function rememberedSecret() {
    try { return String(localStorage.getItem(DEVICE_KEY) || '').trim(); }
    catch (_) { return ''; }
  }

  function rememberSecret(secret) {
    const value = String(secret || '').trim();
    if (!value) return;
    try { localStorage.setItem(DEVICE_KEY, value); } catch (_) {}
    try { sessionStorage.setItem(SESSION_KEY, value); } catch (_) {}
  }

  function forgetSecret() {
    try { localStorage.removeItem(DEVICE_KEY); } catch (_) {}
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  function restoreSessionSecret() {
    const secret = rememberedSecret();
    if (!secret) return;
    try { sessionStorage.setItem(SESSION_KEY, secret); } catch (_) {}
  }

  restoreSessionSecret();

  window.prompt = function(message, defaultValue) {
    const text = String(message || '');
    if (!/UPLOAD_SECRET/i.test(text)) return originalPrompt(message, defaultValue);

    const remembered = rememberedSecret();
    if (remembered) {
      try { sessionStorage.setItem(SESSION_KEY, remembered); } catch (_) {}
      return remembered;
    }

    const entered = String(originalPrompt(
      'Введите UPLOAD_SECRET из Cloudflare. После успешного ввода он сохранится на этом устройстве и больше запрашиваться не будет.',
      defaultValue
    ) || '').trim();
    if (entered) rememberSecret(entered);
    return entered;
  };

  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : String(input?.url || '');
      if (response.status === 401 && url.startsWith(WORKER_ORIGIN)) forgetSecret();
    } catch (_) {}
    return response;
  };

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#oc-image-migration-forget-secret')) forgetSecret();
  }, true);

  window.addEventListener('storage', event => {
    if (event.key === DEVICE_KEY && event.newValue) restoreSessionSecret();
    if (event.key === DEVICE_KEY && !event.newValue) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    }
  });
})();
