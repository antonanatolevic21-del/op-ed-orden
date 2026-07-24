(() => {
  if (window.__OC_TOPBAR_READY__) return;

  function initTopbar() {
    if (window.__OC_TOPBAR_READY__) return;
    const root = document.querySelector('#opedchart-root');
    const legacyHeader = root?.querySelector('.oc-header');
    const legacyTabs = root?.querySelector('.oc-tabs');
    if (!root || !legacyHeader || !legacyTabs) return;

    const tab = name => legacyTabs.querySelector(`.oc-tab-btn[data-tab="${name}"]`);
    const chartBtn = tab('chart');
    const profileBtn = tab('profile');
    const topBtn = tab('top100');
    const seasonBtn = tab('season');
    const tierBtn = tab('tier');
    const statsBtn = tab('stats');
    const eventsLink = legacyTabs.querySelector('a[href="events.html"]');
    if (!chartBtn || !profileBtn || !seasonBtn || !eventsLink) return;

    const nameInput = document.querySelector('#oc-myname');
    const scaleSelect = document.querySelector('#oc-scale-select');
    const contentSelect = document.querySelector('#oc-content-filter-select');
    const accessBadge = document.querySelector('#oc-access-badge');
    const repairBtn = document.querySelector('#oc-franchise-repair-btn');
    const migrationBtn = document.querySelector('#oc-image-migration-btn');
    const avatarBtn = document.querySelector('#oc-avatar-btn');
    const dailyBtn = document.querySelector('#oc-daily-bell');
    const avatarPicker = document.querySelector('#oc-avatar-picker');

    const header = document.createElement('header');
    header.className = 'oc-topbar';

    const brand = document.createElement('button');
    brand.type = 'button';
    brand.className = 'oc-topbar-brand';
    brand.textContent = 'АБОБА';
    brand.title = 'Открыть каталог';
    brand.addEventListener('click', () => chartBtn.click());

    const nav = document.createElement('nav');
    nav.className = 'oc-topbar-nav';
    nav.setAttribute('aria-label', 'Основная навигация');

    chartBtn.textContent = 'Каталог';
    profileBtn.textContent = 'Профиль';
    seasonBtn.textContent = 'Сезоны';
    eventsLink.textContent = 'Ивенты';
    eventsLink.classList.add('oc-topbar-events');

    nav.append(chartBtn, profileBtn);

    const ratings = document.createElement('details');
    ratings.className = 'oc-topbar-ratings';
    const ratingsSummary = document.createElement('summary');
    ratingsSummary.textContent = 'Рейтинги';
    const ratingsMenu = document.createElement('div');
    ratingsMenu.className = 'oc-topbar-ratings-menu';
    if (topBtn) { topBtn.textContent = 'Общий топ-100'; ratingsMenu.append(topBtn); }
    if (tierBtn) { tierBtn.textContent = 'Тир-лист'; ratingsMenu.append(tierBtn); }
    if (statsBtn) { statsBtn.textContent = 'Средние'; ratingsMenu.append(statsBtn); }
    ratings.append(ratingsSummary, ratingsMenu);
    nav.append(ratings, seasonBtn, eventsLink);

    const right = document.createElement('div');
    right.className = 'oc-topbar-right';
    if (dailyBtn) right.append(dailyBtn);

    const account = document.createElement('details');
    account.className = 'oc-topbar-account';
    const accountSummary = document.createElement('summary');
    accountSummary.innerHTML = '<span class="oc-topbar-account-avatar">🙂</span><span class="oc-topbar-account-name">Аккаунт</span><span class="oc-topbar-account-chevron">▼</span>';
    const accountMenu = document.createElement('div');
    accountMenu.className = 'oc-topbar-account-menu';

    if (nameInput) {
      const field = document.createElement('label');
      field.className = 'oc-topbar-menu-field';
      field.append('Никнейм');
      const line = document.createElement('div');
      line.className = 'oc-topbar-account-line';
      line.append(nameInput);
      if (accessBadge) line.append(accessBadge);
      field.append(line);
      accountMenu.append(field);
    }

    if (scaleSelect) {
      const field = document.createElement('label');
      field.className = 'oc-topbar-menu-field';
      field.append('Шкала оценки', scaleSelect);
      accountMenu.append(field);
    }

    if (contentSelect) {
      const field = document.createElement('label');
      field.className = 'oc-topbar-menu-field';
      field.append('Контент', contentSelect);
      accountMenu.append(field);
    }

    if (avatarBtn) {
      const avatarRow = document.createElement('div');
      avatarRow.className = 'oc-topbar-avatar-row';
      const label = document.createElement('span');
      label.textContent = 'Аватар';
      avatarRow.append(label, avatarBtn);
      accountMenu.append(avatarRow);
    }
    if (avatarPicker) accountMenu.append(avatarPicker);

    if (repairBtn || migrationBtn) {
      const admin = document.createElement('div');
      admin.className = 'oc-topbar-admin';
      if (repairBtn) admin.append(repairBtn);
      if (migrationBtn) admin.append(migrationBtn);
      accountMenu.append(admin);
    }

    account.append(accountSummary, accountMenu);
    right.append(account);
    header.append(brand, nav, right);
    root.insertBefore(header, legacyHeader);

    legacyHeader.classList.add('oc-topbar-legacy-hidden');
    legacyTabs.classList.add('oc-topbar-legacy-hidden');

    const accountAvatar = accountSummary.querySelector('.oc-topbar-account-avatar');
    const accountName = accountSummary.querySelector('.oc-topbar-account-name');

    function syncAccount() {
      if (accountAvatar && avatarBtn) accountAvatar.textContent = String(avatarBtn.textContent || '🙂').trim() || '🙂';
      if (accountName) {
        const name = String(nameInput?.value || '').trim();
        accountName.textContent = name || 'Аккаунт';
        accountName.title = name || 'Аккаунт';
      }
    }

    function syncRatingsActive() {
      ratings.classList.toggle('active', [topBtn, tierBtn, statsBtn].some(button => button?.classList.contains('active')));
    }

    syncAccount();
    syncRatingsActive();
    nameInput?.addEventListener('input', syncAccount);
    nameInput?.addEventListener('change', syncAccount);
    if (avatarBtn) new MutationObserver(syncAccount).observe(avatarBtn, { childList: true, characterData: true, subtree: true });
    [chartBtn, profileBtn, topBtn, seasonBtn, tierBtn, statsBtn].filter(Boolean).forEach(button => {
      new MutationObserver(syncRatingsActive).observe(button, { attributes: true, attributeFilter: ['class'] });
      button.addEventListener('click', () => {
        ratings.open = false;
        account.open = false;
        window.setTimeout(() => { syncAccount(); syncRatingsActive(); }, 0);
      });
    });

    account.addEventListener('toggle', () => {
      if (account.open) {
        ratings.open = false;
        syncAccount();
      }
    });
    ratings.addEventListener('toggle', () => {
      if (ratings.open) account.open = false;
    });
    document.addEventListener('click', event => {
      if (account.open && !account.contains(event.target)) account.open = false;
      if (ratings.open && !ratings.contains(event.target)) ratings.open = false;
    });

    window.setInterval(syncAccount, 1200);
    window.__OC_TOPBAR_READY__ = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTopbar, { once: true });
  else initTopbar();
})();
