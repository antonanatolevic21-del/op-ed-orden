(() => {
  const frame = document.querySelector('#oc-admin-workspace');
  const status = document.querySelector('#oc-admin-shell-status');
  const loading = document.querySelector('#oc-admin-shell-loading');
  const authGate = document.querySelector('#oc-admin-auth-gate');
  const shell = document.querySelector('.oc-admin-shell');
  const buttons = [...document.querySelectorAll('[data-admin-view]')];
  const qualityButton = buttons.find(button => button.dataset.adminView === 'quality');
  const journalButton = buttons.find(button => button.dataset.adminView === 'journal');
  const journalPanel = document.querySelector('#oc-admin-journal');
  const journalList = document.querySelector('#oc-admin-journal-list');
  let activeView = 'workspace';
  let qualityRequest = 0;
  let accessObserver = null;
  let accessTimer = 0;
  let journalUnsubscribe = null;

  const JOURNAL_FIELDS = {
    title: 'Название',
    type: 'Тип',
    year: 'Год',
    season: 'Сезон',
    studios: 'Студии',
    directors: 'Режиссёры',
    performers: 'Исполнители',
    franchises: 'Франшизы',
    alternativeTitles: 'Альтернативные названия',
    sameSongGroupId: 'Группа одной песни',
    sameSongTitle: 'Общее название песни',
    image: 'Основная картинка',
    fallbackImage: 'Запасная картинка',
    link: 'Видео',
    notes: 'Заметки',
    isChinese: 'Китайский OP/ED',
    isMovie: 'Фильм',
    isShortened: 'Укороченная версия'
  };

  function frameParts() {
    try {
      return { win: frame.contentWindow, doc: frame.contentDocument };
    } catch (_) {
      return { win: null, doc: null };
    }
  }

  function isAdmin() {
    const { doc } = frameParts();
    const badge = doc?.querySelector('#oc-access-badge');
    return Boolean(
      badge &&
      badge.classList.contains('admin') &&
      String(badge.textContent || '').trim().toLocaleLowerCase('ru') === 'админ'
    );
  }

  function setStatus(message, state = '') {
    status.textContent = message;
    status.classList.toggle('is-admin', state === 'admin');
    status.classList.toggle('is-error', state === 'error');
  }

  function syncAuthGate(admin) {
    document.body.classList.toggle('oc-admin-auth-pending', !admin);
    document.body.classList.toggle('oc-admin-authorized', admin);
    if (authGate) authGate.hidden = admin;
    if (shell) shell.setAttribute('aria-hidden', String(!admin));
  }

  function syncAccess() {
    const admin = isAdmin();
    syncAuthGate(admin);
    qualityButton.disabled = !admin;
    qualityButton.title = admin ? '' : 'Сначала войдите под админским аккаунтом в рабочей области';
    if (journalButton) {
      journalButton.disabled = !admin;
      journalButton.title = admin ? '' : 'Сначала войдите под админским аккаунтом в рабочей области';
    }
    setStatus(
      admin ? 'Админский доступ подтверждён' : 'Войдите под админским аккаунтом в рабочей области',
      admin ? 'admin' : ''
    );
    if (!admin && (activeView === 'quality' || activeView === 'journal')) void showWorkspace();
  }

  function setActiveButton(view) {
    buttons.forEach(button => {
      const active = button.dataset.adminView === view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function ensureCatalogWorkspace(doc) {
    if (!doc) return;
    doc.documentElement.classList.add('oc-admin-catalog-route');
    if (doc.querySelector('#oc-admin-catalog-route-style')) return;
    const style = doc.createElement('style');
    style.id = 'oc-admin-catalog-route-style';
    style.textContent = `
      html.oc-admin-catalog-route .oc-tabs,
      html.oc-admin-catalog-route .oc-header,
      html.oc-admin-catalog-route .oc-topbar,
      html.oc-admin-catalog-route .oc-topbar-mobile-ratings-menu,
      html.oc-admin-catalog-route #oc-profile-panel,
      html.oc-admin-catalog-route #oc-top100-panel,
      html.oc-admin-catalog-route #oc-season-panel,
      html.oc-admin-catalog-route #oc-tier-panel,
      html.oc-admin-catalog-route #oc-stats-panel,
      html.oc-admin-catalog-route [data-welcome-action="profile"],
      html.oc-admin-catalog-route [data-welcome-action="season"],
      html.oc-admin-catalog-route #oc-quality-center-btn,
      html.oc-admin-catalog-route .oc-admin-panel-link {
        display: none !important;
      }
    `;
    doc.head.append(style);
  }

  function showCatalogPage() {
    const { doc } = frameParts();
    ensureCatalogWorkspace(doc);
    const mainPanel = doc?.querySelector('#oc-main-panel');
    if (mainPanel?.classList.contains('hidden')) {
      doc.querySelector('.oc-tab-btn[data-tab="chart"]')?.click();
    }
  }

  function ensureQualityRouteStyle(doc) {
    if (!doc || doc.querySelector('#oc-admin-quality-route-style')) return;
    const style = doc.createElement('style');
    style.id = 'oc-admin-quality-route-style';
    style.textContent = `
      html.oc-admin-quality-route .oc-quality-modal {
        padding: 18px !important;
        background: #0b0a10 !important;
        backdrop-filter: none !important;
      }
      html.oc-admin-quality-route .oc-quality-dialog {
        width: min(1240px, 100%) !important;
        max-height: calc(100vh - 28px) !important;
      }
      html.oc-admin-quality-route .oc-quality-close[data-quality-close] {
        display: none !important;
      }
    `;
    doc.head.append(style);
  }

  function forceCloseQuality() {
    const { win, doc } = frameParts();
    doc?.documentElement.classList.remove('oc-admin-quality-route');
    if (win) win.dispatchEvent(new win.CustomEvent('oped-close-quality'));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function journalValue(value) {
    if (Array.isArray(value)) return value.join(', ') || '—';
    if (value === true) return 'да';
    if (value === false) return 'нет';
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  function journalDate(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('ru-RU') : 'время не указано';
  }

  function renderJournal(rows) {
    if (!journalList) return;
    const list = Array.isArray(rows) ? rows : [];
    journalList.innerHTML = list.length ? list.map(row => {
      const action = row.action === 'create' ? 'Добавлена' : row.action === 'delete' ? 'Удалена' : 'Изменена';
      const changes = (row.changes || []).map(change =>
        `<div class="oc-admin-journal-change"><strong>${escapeHtml(JOURNAL_FIELDS[change.field] || change.field)}</strong>: ${escapeHtml(journalValue(change.before))} → ${escapeHtml(journalValue(change.after))}</div>`
      ).join('') || '<div class="oc-admin-journal-change">Карточка целиком.</div>';
      return `<article class="oc-admin-journal-entry">
        <div class="oc-admin-journal-entry-head">
          <div><h2>${action}: ${escapeHtml(row.title || 'Без названия')}</h2><small>${escapeHtml(row.actorName || 'админ')} · ${escapeHtml(row.type || '')}</small></div>
          <time>${escapeHtml(journalDate(row.at))}</time>
        </div>
        ${changes}
      </article>`;
    }).join('') : '<div class="oc-admin-journal-empty">Журнал пока пуст. Новые изменения карточек появятся здесь автоматически.</div>';
  }

  async function waitForJournalStorage() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 10000) {
      const { win } = frameParts();
      if (typeof win?.OPED_DB?.watchCatalogJournal === 'function') return win.OPED_DB;
      await new Promise(resolve => window.setTimeout(resolve, 120));
    }
    return null;
  }

  async function connectJournal(force = false) {
    if (force && journalUnsubscribe) {
      journalUnsubscribe();
      journalUnsubscribe = null;
    }
    if (journalUnsubscribe) return;
    if (journalList) journalList.innerHTML = '<div class="oc-admin-journal-empty">Загружаю журнал…</div>';
    const storage = await waitForJournalStorage();
    if (!storage) {
      if (journalList) journalList.innerHTML = '<div class="oc-admin-journal-empty">Не удалось подключить журнал. Обновите страницу.</div>';
      return;
    }
    journalUnsubscribe = storage.watchCatalogJournal(renderJournal);
  }

  async function waitForQualityModule(requestId) {
    const startedAt = Date.now();
    while (requestId === qualityRequest && Date.now() - startedAt < 10000) {
      const { win } = frameParts();
      if (win?.__OC_QUALITY_CENTER_READY__) return win;
      if (win) win.dispatchEvent(new win.CustomEvent('oped-account-restored'));
      await new Promise(resolve => window.setTimeout(resolve, 120));
    }
    return null;
  }

  async function showWorkspace() {
    qualityRequest += 1;
    activeView = 'workspace';
    setActiveButton(activeView);
    loading.classList.add('hidden');
    frame.hidden = false;
    journalPanel?.classList.add('hidden');
    forceCloseQuality();
    showCatalogPage();
  }

  async function showQuality() {
    if (!isAdmin()) {
      syncAccess();
      return;
    }
    const requestId = ++qualityRequest;
    activeView = 'quality';
    setActiveButton(activeView);
    frame.hidden = false;
    journalPanel?.classList.add('hidden');
    loading.classList.remove('hidden');
    const { doc } = frameParts();
    ensureQualityRouteStyle(doc);
    doc?.documentElement.classList.add('oc-admin-quality-route');

    const win = await waitForQualityModule(requestId);
    if (!win || requestId !== qualityRequest) return;
    loading.classList.add('hidden');
    win.dispatchEvent(new win.CustomEvent('oped-open-quality'));
  }

  async function showJournal() {
    if (!isAdmin()) {
      syncAccess();
      return;
    }
    qualityRequest += 1;
    activeView = 'journal';
    setActiveButton(activeView);
    loading.classList.add('hidden');
    forceCloseQuality();
    frame.hidden = true;
    journalPanel?.classList.remove('hidden');
    await connectJournal(false);
  }

  function observeAccess() {
    accessObserver?.disconnect();
    window.clearInterval(accessTimer);
    const { doc } = frameParts();
    const badge = doc?.querySelector('#oc-access-badge');
    if (badge) {
      accessObserver = new MutationObserver(syncAccess);
      accessObserver.observe(badge, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
        attributeFilter: ['class']
      });
    }
    accessTimer = window.setInterval(syncAccess, 1000);
    syncAccess();
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    if (button.dataset.adminView === 'quality') void showQuality();
    else if (button.dataset.adminView === 'journal') void showJournal();
    else void showWorkspace();
  }));

  document.querySelector('[data-admin-journal-refresh]')?.addEventListener('click', () => {
    if (isAdmin()) void connectJournal(true);
  });

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'oped-admin-open-track') void showWorkspace();
  });

  function handleFrameLoad() {
    forceCloseQuality();
    showCatalogPage();
    observeAccess();
    if (activeView === 'quality') void showQuality();
    if (activeView === 'journal') void showJournal();
  }

  frame.addEventListener('load', handleFrameLoad);
  if (frame.contentDocument?.readyState === 'complete') handleFrameLoad();

  setActiveButton(activeView);
})();
