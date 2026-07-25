(() => {
  if (window.__OC_TOP100_SUITE_VIEW_FIX_READY__) return;
  const clean = value => String(value ?? '').trim();

  function activeType() {
    return document.querySelector('.oc-profile-top-type-btn.active')?.dataset.type === 'ED' ? 'ED' : 'OP';
  }

  function cards(type = activeType()) {
    const container = document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op');
    return [...(container?.children || [])].filter(node => node.classList?.contains('oc-profile-item'));
  }

  function jump(place) {
    const index = Math.max(1, Math.min(100, Math.round(Number(place) || 0))) - 1;
    const card = cards()[index];
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('oc-top100-flash');
    void card.offsetWidth;
    card.classList.add('oc-top100-flash');
    setTimeout(() => card.classList.remove('oc-top100-flash'), 1500);
  }

  function renderSearch() {
    const input = document.querySelector('#oc-top100-search');
    const results = document.querySelector('#oc-top100-search-results');
    if (!input || !results) return;
    const query = clean(input.value).toLowerCase();
    if (!query) { results.hidden = true; results.innerHTML = ''; return; }
    const rows = cards().map((card, index) => ({ place: index + 1, title: clean(card.querySelector('.oc-profile-name')?.textContent) }))
      .filter(row => row.title.toLowerCase().includes(query)).slice(0, 8);
    results.innerHTML = rows.map(row => `<button type="button" data-top100-view-result="${row.place}"><strong>№${row.place}</strong><span></span></button>`).join('');
    [...results.querySelectorAll('[data-top100-view-result]')].forEach((button, index) => { button.querySelector('span').textContent = rows[index].title; });
    results.hidden = !rows.length;
  }

  document.addEventListener('input', event => {
    if (event.target?.id === 'oc-top100-search') setTimeout(renderSearch, 0);
  });

  document.addEventListener('click', event => {
    const result = event.target.closest?.('[data-top100-view-result]');
    if (result) {
      event.preventDefault();
      event.stopImmediatePropagation();
      jump(result.dataset.top100ViewResult);
      document.querySelector('#oc-top100-search-results')?.setAttribute('hidden', '');
      return;
    }
    const jumpButton = event.target.closest?.('[data-top100-jump]');
    if (jumpButton && !document.querySelector('#oc-manual-edit-btn')?.classList.contains('active')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      jump(document.querySelector('#oc-top100-jump')?.value);
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.target?.id !== 'oc-top100-jump' || event.key !== 'Enter' || document.querySelector('#oc-manual-edit-btn')?.classList.contains('active')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    jump(event.target.value);
  }, true);

  document.querySelector('.oc-profile-top-type-switch')?.addEventListener('click', () => setTimeout(renderSearch, 0));
  window.__OC_TOP100_SUITE_VIEW_FIX_READY__ = true;
})();
