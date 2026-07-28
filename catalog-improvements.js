(() => {
  const $ = selector => document.querySelector(selector);
  const detailed = $('#oc-view-detailed');
  const compact = $('#oc-view-compact');
  const listHost = $('#oc-list-container');
  if (!detailed || !compact || !listHost) return;

  function setView(view) {
    localStorage.setItem('op-ed-catalog-view-v1', view);
    window.dispatchEvent(new CustomEvent('oped-catalog-view-change', { detail: view }));
    detailed.classList.toggle('active', view === 'detailed');
    compact.classList.toggle('active', view === 'compact');
    detailed.setAttribute('aria-pressed', view === 'detailed' ? 'true' : 'false');
    compact.setAttribute('aria-pressed', view === 'compact' ? 'true' : 'false');
    listHost.querySelector('.oc-list')?.classList.toggle('oc-list-compact', view === 'compact');
  }
  setView(localStorage.getItem('op-ed-catalog-view-v1') === 'compact' ? 'compact' : 'detailed');
  detailed.addEventListener('click', () => setView('detailed'));
  compact.addEventListener('click', () => setView('compact'));

  document.addEventListener('load', event => {
    const image = event.target;
    if (!image?.matches?.('img.oc-track-image')) return;
    image.parentElement?.classList.add('is-loaded');
    image.parentElement?.classList.remove('is-error');
  }, true);
  document.addEventListener('error', event => {
    const image = event.target;
    if (!image?.matches?.('img.oc-track-image')) return;
    image.parentElement?.classList.add('is-error');
  }, true);
  new MutationObserver(() => {
    listHost.querySelectorAll('.oc-season-thumb:has(img.oc-track-image)').forEach(box => box.classList.add('oc-image-loading'));
  }).observe(listHost, { childList: true, subtree: true });

  $('#oc-welcome-ack')?.addEventListener('change', async event => {
    if (!event.target.checked) return;
    const name = localStorage.getItem('op-ed-primary-account-name') || 'account';
    const key = name.trim().toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
    localStorage.setItem(`op-ed-welcome-ack-v1:${key}`, '1');
    $('#oc-account-welcome')?.classList.add('hidden');
    try { await window.OPED_DB?.acknowledgeWelcome?.(name); }
    catch (error) { console.warn('Could not sync welcome acknowledgement', error); }
  });
  document.querySelectorAll('[data-welcome-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.welcomeAction;
    if (action === 'search') { $('#oc-f-search')?.focus(); $('#oc-f-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (action === 'season') document.querySelector('.oc-tab-btn[data-tab="season"]')?.click();
    if (action === 'profile') document.querySelector('.oc-tab-btn[data-tab="profile"]')?.click();
  }));
  $('#oc-random-unrated')?.addEventListener('click', () => {
    const unrated = [...listHost.querySelectorAll('.main-card:not(.oc-card-rated)')];
    const card = unrated[Math.floor(Math.random() * unrated.length)];
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.animate([{ boxShadow: '0 0 0 0 rgba(255,200,87,0)' }, { boxShadow: '0 0 0 3px rgba(255,200,87,.65)' }, { boxShadow: '0 0 0 0 rgba(255,200,87,0)' }], { duration: 1100 });
  });
})();
