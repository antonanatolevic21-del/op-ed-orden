(() => {
  if (window.__OC_PROFILE_DISCOVERY_READY__) return;
  window.__OC_PROFILE_DISCOVERY_READY__ = true;

  const normalize = value => String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');

  function syncContext() {
    const context = document.querySelector('#oc-profile-context');
    const select = document.querySelector('#oc-profile-user');
    if (!context || !select) return;
    const viewed = String(select.value || '').trim();
    const own = String(document.querySelector('#oc-myname')?.value || '').trim();
    const isOwn = Boolean(viewed && own && normalize(viewed) === normalize(own));
    context.classList.toggle('is-own', isOwn);
    let message = '';
    if (!viewed) message = 'Профиль пока не выбран.';
    else if (isOwn) message = `Это ваш профиль · ${viewed}`;
    else if (own) message = `Вы смотрите профиль «${viewed}» · ваш аккаунт: ${own}`;
    else message = `Вы смотрите профиль «${viewed}»`;
    if (context.textContent !== message) context.textContent = message;
  }

  function profileHasRatings() {
    return Boolean(document.querySelector(
      '#oc-profile-op .oc-profile-item, #oc-profile-ed .oc-profile-item'
    ));
  }

  function syncEmptyCallToAction() {
    const panel = document.querySelector('#oc-profile-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    let callout = panel.querySelector('.oc-profile-empty-cta');
    if (profileHasRatings()) {
      callout?.remove();
      return;
    }
    if (callout) return;
    callout = document.createElement('div');
    callout.className = 'oc-profile-empty-cta';
    callout.innerHTML = '<span>В этом профиле пока нет оценок.</span><button type="button" class="oc-secondary-btn" data-profile-start="chart">Открыть каталог</button><button type="button" class="oc-secondary-btn" data-profile-start="season">Выбрать сезон</button>';
    const anchor = panel.querySelector('.oc-profile-filterbar');
    anchor?.insertAdjacentElement('afterend', callout);
  }

  function sync() {
    syncContext();
    window.setTimeout(syncEmptyCallToAction, 30);
  }

  document.addEventListener('change', event => {
    if (event.target?.id === 'oc-profile-user') sync();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-profile-start]');
    if (!button) return;
    document.querySelector(`.oc-tab-btn[data-tab="${button.dataset.profileStart}"]`)?.click();
  });
  window.addEventListener('oped-account-restored', sync);
  window.addEventListener('oped:route-ready', event => {
    if (event?.detail?.tab === 'profile') sync();
  });

  const init = () => {
    const panel = document.querySelector('#oc-profile-panel');
    if (!panel) return;
    new MutationObserver(() => {
      if (!panel.classList.contains('hidden')) window.requestAnimationFrame(sync);
    }).observe(panel, { childList: true, subtree: true });
    sync();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
