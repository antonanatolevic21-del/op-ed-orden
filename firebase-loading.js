(() => {
  const screen = document.getElementById('firebase-loading-screen');
  if (!screen) return;

  let pendingRoute = '';
  let hideTimer = 0;

  function show(route = '') {
    window.clearTimeout(hideTimer);
    pendingRoute = route;
    screen.classList.remove('is-hidden');
    screen.removeAttribute('aria-hidden');
    document.body.classList.add('firebase-loading-active');
  }

  function hide(route = '') {
    if (route && pendingRoute && pendingRoute !== 'initial' && route !== pendingRoute) return;
    pendingRoute = '';
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      screen.classList.add('is-hidden');
      screen.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('firebase-loading-active');
    }, 80);
  }

  window.OPED_FIREBASE_LOADING = { show, hide };
  window.addEventListener('oped:route-change', event => show(event.detail?.tab || ''));
  window.addEventListener('oped:route-ready', event => hide(event.detail?.tab || ''));
  window.addEventListener('oped:load-error', () => hide());
  window.addEventListener('oped:events-ready', () => hide());

  show('initial');
})();
