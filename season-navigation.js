(() => {
  if (window.__OC_SEASON_NAVIGATION_READY__) return;
  window.__OC_SEASON_NAVIGATION_READY__ = true;

  function mountJump() {
    const years = document.querySelector('#oc-season-years');
    if (!years || years.querySelector('.oc-season-year-jump')) return;
    const buttons = [...years.querySelectorAll('[data-season-year]')];
    if (!buttons.length) return;
    const active = years.querySelector('[data-season-year].active')?.dataset.seasonYear || buttons[0]?.dataset.seasonYear;
    const wrap = document.createElement('label');
    wrap.className = 'oc-season-year-jump';
    wrap.innerHTML = '<span>Перейти к году</span>';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Перейти к году');
    for (const button of buttons) {
      const option = document.createElement('option');
      option.value = String(button.dataset.seasonYear || '');
      option.textContent = option.value;
      option.selected = option.value === String(active || '');
      select.append(option);
    }
    select.addEventListener('change', () => {
      years.querySelector(`[data-season-year="${CSS.escape(select.value)}"]`)?.click();
    });
    wrap.append(select);
    years.prepend(wrap);
  }

  function init() {
    const years = document.querySelector('#oc-season-years');
    if (!years) return;
    new MutationObserver(() => window.requestAnimationFrame(mountJump)).observe(years, { childList: true });
    mountJump();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
