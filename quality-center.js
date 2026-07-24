(() => {
  if (window.__OC_QUALITY_CENTER_READY__) return;

  const SEASON_LABEL = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  let modal = null;
  let cachedOpenings = null;
  let loadingPromise = null;
  let triggerButton = null;

  const normalize = value => String(value || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  const cleanList = value => Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : String(value || '').split(',').map(item => item.trim()).filter(Boolean);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function isAdminUi() {
    const badge = document.querySelector('#oc-access-badge');
    return normalize(badge?.textContent).includes('админ');
  }

  async function waitForFirebase() {
    if (window.OPED_DB) return;
    await new Promise(resolve => {
      const timer = window.setTimeout(resolve, 5000);
      window.addEventListener('oped-db-ready', () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }

  async function loadOpenings(force = false) {
    if (!force && cachedOpenings) return cachedOpenings;
    if (!force && loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      await waitForFirebase();
      const [{ getApp, getApps }, { getFirestore, collection, getDocs }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
      ]);
      if (!getApps().length) throw new Error('Firebase ещё не инициализирован.');
      const snapshot = await getDocs(collection(getFirestore(getApp()), 'openings'));
      cachedOpenings = snapshot.docs.map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
      return cachedOpenings;
    })();

    try {
      return await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  function buildIssues(openings) {
    const duplicateMap = new Map();
    openings.forEach(opening => {
      const title = normalize(opening.title || opening.anime);
      if (!title) return;
      const key = [title, String(opening.type || ''), String(opening.year || ''), String(opening.season || '')].join('|');
      if (!duplicateMap.has(key)) duplicateMap.set(key, []);
      duplicateMap.get(key).push(opening);
    });
    const duplicateIds = new Set([...duplicateMap.values()].filter(group => group.length > 1).flat().map(opening => String(opening.id)));

    const rules = [
      ['title', 'Без названия', opening => !String(opening.title || opening.anime || '').trim()],
      ['image', 'Без основной картинки', opening => !String(opening.image || '').trim()],
      ['fallback', 'Без запасной картинки', opening => !String(opening.fallbackImage || opening.imageFallback || '').trim()],
      ['performer', 'Без исполнителя', opening => cleanList(opening.performers).length === 0],
      ['studio', 'Без студии', opening => cleanList(opening.studios).length === 0],
      ['director', 'Без режиссёра', opening => cleanList(opening.directors).length === 0],
      ['franchise', 'Без франшизы', opening => cleanList(opening.franchises).length === 0],
      ['link', 'Без ссылки на видео', opening => !String(opening.link || '').trim()],
      ['same-song', 'Одинаковая песня без группы', opening => Boolean(String(opening.sameSongTitle || opening.songGroupTitle || '').trim()) && !String(opening.sameSongGroupId || opening.songGroupId || '').trim()],
      ['duplicate', 'Возможные дубликаты', opening => duplicateIds.has(String(opening.id))]
    ];

    return rules.map(([id, label, test]) => ({ id, label, rows: openings.filter(test) }));
  }

  function completeness(openings, issues) {
    if (!openings.length) return 100;
    const keyIds = new Set(['image', 'performer', 'studio', 'director', 'franchise', 'link']);
    const missing = issues.filter(issue => keyIds.has(issue.id)).reduce((sum, issue) => sum + issue.rows.length, 0);
    return Math.max(0, Math.round((1 - missing / (openings.length * keyIds.size)) * 100));
  }

  function ensureModal() {
    if (modal?.isConnected) return modal;
    modal = document.createElement('div');
    modal.className = 'oc-quality-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Центр качества базы');
    document.body.append(modal);

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-quality-close]')) {
        closeQualityCenter();
        return;
      }

      const refresh = event.target.closest('[data-quality-refresh]');
      if (refresh) {
        void openQualityCenter(true);
        return;
      }

      const track = event.target.closest('[data-quality-track]');
      if (track) openTrack(String(track.dataset.qualityTrack || ''), String(track.dataset.qualityTitle || ''));
    });

    return modal;
  }

  function renderLoading() {
    const root = ensureModal();
    root.innerHTML = `
      <div class="oc-quality-dialog">
        <div class="oc-quality-head">
          <div>
            <div class="oc-quality-kicker">админ · качество базы</div>
            <h2>Центр качества</h2>
            <p>Проверяю только коллекцию треков. Оценки и другие большие коллекции не загружаются.</p>
          </div>
          <button class="oc-quality-close" type="button" data-quality-close aria-label="Закрыть">×</button>
        </div>
        <div class="oc-quality-loading">Проверяю каталог…</div>
      </div>`;
  }

  function renderError(error) {
    const root = ensureModal();
    root.innerHTML = `
      <div class="oc-quality-dialog">
        <div class="oc-quality-head">
          <div><div class="oc-quality-kicker">админ · качество базы</div><h2>Центр качества</h2><p>Не удалось получить каталог.</p></div>
          <button class="oc-quality-close" type="button" data-quality-close aria-label="Закрыть">×</button>
        </div>
        <div class="oc-quality-error">${escapeHtml(error?.message || 'Неизвестная ошибка')}</div>
        <button class="oc-quality-refresh" type="button" data-quality-refresh>Попробовать ещё раз</button>
      </div>`;
  }

  function render(openings) {
    const root = ensureModal();
    const issues = buildIssues(openings);
    const score = completeness(openings, issues);
    const uniqueProblemIds = new Set(issues.flatMap(issue => issue.rows.map(opening => String(opening.id))));
    const totalHits = issues.reduce((sum, issue) => sum + issue.rows.length, 0);

    const issueHtml = issues.map(issue => {
      const visibleRows = issue.rows.slice(0, 80);
      return `
        <details class="oc-quality-issue" ${issue.rows.length > 0 && issue.rows.length <= 8 ? 'open' : ''}>
          <summary><span>${escapeHtml(issue.label)}</span><strong>${issue.rows.length}</strong></summary>
          <div class="oc-quality-track-list">
            ${visibleRows.length ? visibleRows.map(opening => {
              const season = opening.season ? `${SEASON_LABEL[opening.season] || opening.season} ${opening.year || ''}`.trim() : String(opening.year || '—');
              const title = String(opening.title || opening.anime || 'Без названия');
              return `<button type="button" class="oc-quality-track" data-quality-track="${escapeHtml(opening.id)}" data-quality-title="${escapeHtml(title)}"><span>${escapeHtml(title)}</span><small>${escapeHtml(opening.type || '—')} · ${escapeHtml(season)}</small></button>`;
            }).join('') : '<div class="oc-quality-ok">Проблем не найдено ✓</div>'}
            ${issue.rows.length > visibleRows.length ? `<div class="oc-quality-more">И ещё ${issue.rows.length - visibleRows.length}…</div>` : ''}
          </div>
        </details>`;
    }).join('');

    root.innerHTML = `
      <div class="oc-quality-dialog">
        <div class="oc-quality-head">
          <div>
            <div class="oc-quality-kicker">админ · качество базы</div>
            <h2>Центр качества</h2>
            <p>Пустые поля, одинаковая песня без группы и возможные дубликаты. Доступность картинок и видео по сети здесь не проверяется.</p>
          </div>
          <div class="oc-quality-head-actions">
            <button class="oc-quality-refresh" type="button" data-quality-refresh>Обновить</button>
            <button class="oc-quality-close" type="button" data-quality-close aria-label="Закрыть">×</button>
          </div>
        </div>
        <div class="oc-quality-summary">
          <div><strong>${openings.length}</strong><span>треков</span></div>
          <div><strong>${score}%</strong><span>ключевые поля</span></div>
          <div><strong>${uniqueProblemIds.size}</strong><span>треков с проблемами</span></div>
          <div><strong>${totalHits}</strong><span>срабатываний</span></div>
        </div>
        <div class="oc-quality-issues">${issueHtml}</div>
      </div>`;
  }

  function fallbackOpenTrack(title) {
    document.querySelector('.oc-tab-btn[data-tab="chart"]')?.click();
    const reset = document.querySelector('#oc-reset-filters');
    reset?.click();
    window.setTimeout(() => {
      const search = document.querySelector('#oc-f-search');
      if (!search) return;
      search.value = title;
      search.dispatchEvent(new Event('input', { bubbles: true }));
      search.dispatchEvent(new Event('change', { bubbles: true }));
      search.focus();
    }, 0);
  }

  function openTrack(id, title) {
    closeQualityCenter();
    if (window.__OC_DEEP_LINKS_READY__ && id) {
      const url = new URL(window.location.href);
      url.searchParams.delete('view');
      url.searchParams.delete('profile');
      url.searchParams.delete('section');
      url.searchParams.delete('album');
      url.searchParams.set('track', id);
      history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    fallbackOpenTrack(title);
  }

  async function openQualityCenter(force = false) {
    if (!isAdminUi()) return;
    const root = ensureModal();
    root.classList.remove('hidden');
    document.body.classList.add('oc-quality-open');
    renderLoading();
    try {
      const openings = await loadOpenings(force);
      if (!root.classList.contains('hidden')) render(openings);
    } catch (error) {
      console.error('Quality center load failed', error);
      if (!root.classList.contains('hidden')) renderError(error);
    }
  }

  function closeQualityCenter() {
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('oc-quality-open');
  }

  function syncTriggerVisibility() {
    if (triggerButton) triggerButton.hidden = !isAdminUi();
  }

  function mountTrigger(attempt = 0) {
    if (triggerButton?.isConnected) return;
    const host = document.querySelector('.oc-topbar-admin');
    if (!host) {
      if (attempt < 40) window.setTimeout(() => mountTrigger(attempt + 1), 100);
      return;
    }

    triggerButton = document.createElement('button');
    triggerButton.id = 'oc-quality-center-btn';
    triggerButton.className = 'oc-franchise-repair-btn oc-quality-trigger';
    triggerButton.type = 'button';
    triggerButton.textContent = 'Центр качества базы';
    triggerButton.addEventListener('click', () => { void openQualityCenter(false); });
    host.append(triggerButton);
    syncTriggerVisibility();

    const badge = document.querySelector('#oc-access-badge');
    if (badge) new MutationObserver(syncTriggerVisibility).observe(badge, { childList: true, characterData: true, subtree: true });
  }

  window.addEventListener('oped-open-quality', () => { void openQualityCenter(false); });
  window.__OC_QUALITY_CENTER_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountTrigger(), { once: true });
  else mountTrigger();
})();
