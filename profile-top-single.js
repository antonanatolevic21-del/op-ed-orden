(() => {
  if (window.__OC_PROFILE_TOP_SINGLE_READY__) return;

  const STORAGE_KEY = 'oc-profile-top-visible-type-v1';
  let activeType = localStorage.getItem(STORAGE_KEY) === 'ED' ? 'ED' : 'OP';

  function closeInsertPanels() {
    document.querySelectorAll('.oc-manual-insert-panel').forEach(panel => panel.remove());
    document.querySelectorAll('.oc-manual-insert-zone.active').forEach(zone => zone.classList.remove('active'));
  }

  function wrapperFor(columns, type) {
    const list = columns.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op');
    return list?.parentElement || null;
  }

  function relabelTitle(wrapper, type) {
    const title = wrapper?.querySelector('.oc-profile-col-title');
    if (!title || title.dataset.singleTopRelabeled === '1') return;
    const label = title.querySelector('.oc-topmode-label');
    title.replaceChildren(document.createTextNode(type === 'OP' ? 'Топ-100 опенингов ' : 'Топ-100 эндингов '));
    if (label) title.append(label);
    title.dataset.singleTopRelabeled = '1';
  }

  function applyType(columns, type, save = true) {
    activeType = type === 'ED' ? 'ED' : 'OP';
    const opWrapper = wrapperFor(columns, 'OP');
    const edWrapper = wrapperFor(columns, 'ED');
    if (opWrapper) opWrapper.hidden = activeType !== 'OP';
    if (edWrapper) edWrapper.hidden = activeType !== 'ED';
    columns.dataset.activeTopType = activeType;
    document.querySelectorAll('.oc-profile-top-type-btn').forEach(button => {
      const active = button.dataset.type === activeType;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (save) {
      closeInsertPanels();
      localStorage.setItem(STORAGE_KEY, activeType);
    }
  }

  function buildSwitch(columns) {
    let switcher = document.querySelector('.oc-profile-top-type-switch');
    if (switcher) return switcher;

    switcher = document.createElement('div');
    switcher.className = 'oc-profile-top-type-switch';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Выбор топа');
    switcher.innerHTML = '<button type="button" class="oc-profile-top-type-btn" data-type="OP">Опенинги</button><button type="button" class="oc-profile-top-type-btn" data-type="ED">Эндинги</button>';
    columns.before(switcher);
    switcher.querySelectorAll('.oc-profile-top-type-btn').forEach(button => {
      button.addEventListener('click', () => applyType(columns, button.dataset.type));
    });
    return switcher;
  }

  function mount(attempt = 0) {
    const columns = document.querySelector('#oc-profile-panel .oc-profile-columns');
    if (!columns) {
      if (attempt < 40) window.setTimeout(() => mount(attempt + 1), 100);
      return;
    }

    columns.classList.add('oc-profile-top-single');
    const opWrapper = wrapperFor(columns, 'OP');
    const edWrapper = wrapperFor(columns, 'ED');
    if (opWrapper) opWrapper.dataset.profileTopType = 'OP';
    if (edWrapper) edWrapper.dataset.profileTopType = 'ED';
    relabelTitle(opWrapper, 'OP');
    relabelTitle(edWrapper, 'ED');
    buildSwitch(columns);
    applyType(columns, activeType, false);
  }

  window.__OC_PROFILE_TOP_SINGLE_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount(), { once: true });
  else mount();
})();
