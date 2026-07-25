(() => {
  if (window.__OC_FIRST_USER_TEST_FIXES_READY__) return;
  window.__OC_FIRST_USER_TEST_FIXES_READY__ = true;

  const FIVE_VALUE = 'five';
  const SKLT_KEY = 'sklt';
  let scaleSyncing = false;
  let fiveOptionTemplate = null;
  let usersPanel = null;
  let usersSearch = '';

  const clean = value => String(value || '').trim();
  const norm = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  function isAdminUi() {
    const badge = document.querySelector('#oc-access-badge');
    return Boolean(badge && badge.classList.contains('admin') && norm(badge.textContent) === 'админ');
  }

  function currentAccountName() {
    return clean(
      document.querySelector('#oc-myname')?.value ||
      localStorage.getItem('op-ed-primary-account-name') ||
      localStorage.getItem('my-display-name') || ''
    );
  }

  function protectOpeningBackdrop() {
    const modal = document.querySelector('#oc-opening-modal');
    if (!modal || modal.dataset.ocIntentionalBackdropBound === '1') return;
    modal.dataset.ocIntentionalBackdropBound = '1';

    let gesture = null;
    modal.addEventListener('pointerdown', event => {
      gesture = {
        pointerId: event.pointerId,
        startedOnBackdrop: event.target === modal,
        startX: event.clientX,
        startY: event.clientY,
        endedOnBackdrop: false,
        moved: false
      };
    }, true);

    modal.addEventListener('pointermove', event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 7) gesture.moved = true;
    }, true);

    modal.addEventListener('pointerup', event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      gesture.endedOnBackdrop = event.target === modal;
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 7) gesture.moved = true;
    }, true);

    modal.addEventListener('pointercancel', () => { gesture = null; }, true);

    modal.addEventListener('click', event => {
      if (event.target !== modal) return;
      const intentionalBackdropClick = Boolean(
        gesture && gesture.startedOnBackdrop && gesture.endedOnBackdrop && !gesture.moved
      );
      gesture = null;
      if (intentionalBackdropClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function ensureFiveOption(select) {
    if (!fiveOptionTemplate) {
      fiveOptionTemplate = select.querySelector(`option[value="${FIVE_VALUE}"]`)?.cloneNode(true) || null;
    }
    if (select.querySelector(`option[value="${FIVE_VALUE}"]`)) return;
    const option = fiveOptionTemplate || document.createElement('option');
    option.value = FIVE_VALUE;
    option.textContent = option.textContent || 'оценка 1–5';
    select.append(option.cloneNode(true));
  }

  function syncScalePolicy() {
    if (scaleSyncing) return;
    const select = document.querySelector('#oc-scale-select');
    if (!select) return;
    if (!fiveOptionTemplate) fiveOptionTemplate = select.querySelector(`option[value="${FIVE_VALUE}"]`)?.cloneNode(true) || null;

    const allowed = norm(currentAccountName()) === SKLT_KEY;
    const fiveOption = select.querySelector(`option[value="${FIVE_VALUE}"]`);

    scaleSyncing = true;
    try {
      if (allowed) {
        ensureFiveOption(select);
        if (localStorage.getItem('rating-scale') === FIVE_VALUE && select.value !== FIVE_VALUE) {
          select.value = FIVE_VALUE;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        const mustReset = select.value === FIVE_VALUE || localStorage.getItem('rating-scale') === FIVE_VALUE;
        if (mustReset) {
          localStorage.setItem('rating-scale', 'int');
          select.value = 'int';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        fiveOption?.remove();
      }
      select.dataset.fivePointOwner = allowed ? 'SKLT' : '';
    } finally {
      scaleSyncing = false;
    }
  }

  function profileOptions() {
    const select = document.querySelector('#oc-profile-user');
    if (!select) return [];
    const seen = new Set();
    return [...select.options].map(option => ({
      value: clean(option.value),
      label: clean(option.textContent || option.value)
    })).filter(row => {
      const key = norm(row.value || row.label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
  }

  function renderUsersPanel() {
    if (!usersPanel) return;
    const admin = isAdminUi();
    usersPanel.hidden = !admin;
    if (!admin) return;

    const current = norm(currentAccountName());
    const rows = profileOptions();
    const filtered = usersSearch
      ? rows.filter(row => norm(row.label).includes(norm(usersSearch)))
      : rows;
    const list = usersPanel.querySelector('.oc-user-manager-list');
    const count = usersPanel.querySelector('[data-user-manager-count]');
    if (count) count.textContent = `${filtered.length} из ${rows.length}`;
    if (!list) return;

    list.innerHTML = filtered.length ? filtered.map(row => {
      const isCurrent = norm(row.value || row.label) === current;
      return `<div class="oc-user-manager-row" data-user-value="${esc(row.value)}">
        <div><strong>${esc(row.label)}</strong>${isCurrent ? '<span>текущий аккаунт</span>' : ''}</div>
        <div class="oc-user-manager-actions">
          <button type="button" data-user-open="${esc(row.value)}">Открыть</button>
          <button type="button" class="danger" data-user-delete="${esc(row.value)}" ${isCurrent ? 'disabled title="Нельзя удалить аккаунт, под которым выполнен вход"' : ''}>Удалить</button>
        </div>
      </div>`;
    }).join('') : '<div class="oc-user-manager-empty">Пользователи не найдены.</div>';
  }

  function chooseProfile(value) {
    const select = document.querySelector('#oc-profile-user');
    if (!select) return false;
    const option = [...select.options].find(item => item.value === value);
    if (!option) return false;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return true;
  }

  function mountUsersPanel() {
    if (usersPanel?.isConnected) return;
    const anchor = document.querySelector('#oc-profile-panel .oc-profile-select-wrap');
    if (!anchor) return;

    usersPanel = document.createElement('section');
    usersPanel.className = 'oc-user-manager';
    usersPanel.hidden = true;
    usersPanel.innerHTML = `<div class="oc-user-manager-head">
      <div><div class="oc-section-label">админ · пользователи</div><h3>Управление профилями</h3><p>Список собирается из уже загруженных профилей и оценок сайта.</p></div>
      <span data-user-manager-count>0</span>
    </div>
    <input class="oc-user-manager-search" type="search" placeholder="Найти пользователя…" autocomplete="off" />
    <div class="oc-user-manager-list"></div>`;
    anchor.insertAdjacentElement('afterend', usersPanel);

    usersPanel.querySelector('.oc-user-manager-search')?.addEventListener('input', event => {
      usersSearch = event.target.value;
      renderUsersPanel();
    });

    usersPanel.addEventListener('click', event => {
      const open = event.target.closest('[data-user-open]');
      if (open) {
        chooseProfile(open.dataset.userOpen || '');
        return;
      }
      const remove = event.target.closest('[data-user-delete]');
      if (!remove || remove.disabled || !isAdminUi()) return;
      const value = remove.dataset.userDelete || '';
      if (!chooseProfile(value)) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.querySelector('#oc-profile-delete-btn')?.click();
      }));
    });

    const select = document.querySelector('#oc-profile-user');
    if (select) new MutationObserver(renderUsersPanel).observe(select, { childList: true, subtree: true });
    renderUsersPanel();
  }

  function syncAll() {
    protectOpeningBackdrop();
    syncScalePolicy();
    mountUsersPanel();
    renderUsersPanel();
  }

  const nameInput = document.querySelector('#oc-myname');
  nameInput?.addEventListener('input', syncScalePolicy);
  nameInput?.addEventListener('change', syncScalePolicy);
  const badge = document.querySelector('#oc-access-badge');
  if (badge) new MutationObserver(syncAll).observe(badge, { attributes: true, childList: true, characterData: true, subtree: true });

  document.querySelector('#oc-scale-select')?.addEventListener('change', () => {
    if (norm(currentAccountName()) !== SKLT_KEY && document.querySelector('#oc-scale-select')?.value === FIVE_VALUE) {
      syncScalePolicy();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAll, { once: true });
  else syncAll();
  [250, 900, 2500, 6000].forEach(delay => window.setTimeout(syncAll, delay));
  window.setInterval(syncAll, 1800);
})();
