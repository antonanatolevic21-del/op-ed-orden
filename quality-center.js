(() => {
  if (window.__OC_QUALITY_CENTER_READY__) return;

  const SEASON_LABEL = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  const ISSUE_LIMIT = 40;
  let modal = null;
  let cachedOpenings = null;
  let loadingPromise = null;
  let triggerButton = null;
  let currentIssues = new Map();
  const unreachableImages = new Set();

  const normalize = value => String(value || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  const cleanList = value => Array.isArray(value) ? value.filter(item => String(item || '').trim()).length : String(value || '').split(',').filter(item => item.trim()).length;
  const listValues = value => (Array.isArray(value) ? value : String(value || '').split(',')).map(item => String(item || '').trim()).filter(Boolean);

  function validHttpUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
    } catch (_) {
      return false;
    }
  }

  function plausibleTrackLink(value) {
    if (!validHttpUrl(value)) return false;
    const url = new URL(String(value).trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return url.pathname.length > 2;
    if (host.endsWith('youtube.com')) return Boolean(url.searchParams.get('v') || /\/(shorts|embed)\//.test(url.pathname));
    if (host.endsWith('rutube.ru')) return /\/video\/[\w-]+/i.test(url.pathname);
    if (host.endsWith('vk.com') || host.endsWith('vkvideo.ru')) return /video|clip/i.test(url.href);
    return true;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function isAdminUi() {
    return normalize(document.querySelector('#oc-access-badge')?.textContent).includes('админ');
  }

  function yieldToUi() {
    return new Promise(resolve => requestAnimationFrame(() => window.setTimeout(resolve, 0)));
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
      if (window.OC_CATALOG_CACHE?.load) {
        cachedOpenings = await window.OC_CATALOG_CACHE.load(force);
        return cachedOpenings;
      }
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
    const issues = [
      { id: 'title', label: 'Без названия', rows: [] },
      { id: 'image', label: 'Без основной картинки', rows: [] },
      { id: 'fallback', label: 'Без запасной картинки', rows: [] },
      { id: 'performer', label: 'Без исполнителя', rows: [] },
      { id: 'studio', label: 'Без студии', rows: [] },
      { id: 'director', label: 'Без режиссёра', rows: [] },
      { id: 'franchise', label: 'Без франшизы', rows: [] },
      { id: 'franchise-suspicious', label: 'Подозрительные франшизы', rows: [] },
      { id: 'link', label: 'Без ссылки на видео', rows: [] },
      { id: 'link-invalid', label: 'Некорректные ссылки на видео', rows: [] },
      { id: 'image-invalid', label: 'Некорректные ссылки на картинки', rows: [] },
      { id: 'image-unreachable', label: 'Недоступные картинки', rows: [] },
      { id: 'same-song', label: 'Одинаковая песня без группы', rows: [] },
      { id: 'duplicate', label: 'Возможные дубликаты', rows: [] }
    ];
    const byId = new Map(issues.map(issue => [issue.id, issue]));
    const duplicateMap = new Map();
    const franchiseVariants = new Map();

    for (const opening of openings) {
      for (const franchise of listValues(opening.franchises)) {
        const canonical = normalize(franchise).replace(/[^\p{L}\p{N}]+/gu, '');
        if (!canonical) continue;
        if (!franchiseVariants.has(canonical)) franchiseVariants.set(canonical, new Set());
        franchiseVariants.get(canonical).add(normalize(franchise));
      }
    }

    for (const opening of openings) {
      const rawTitle = String(opening.title || opening.anime || '').trim();
      if (!rawTitle) byId.get('title').rows.push(opening);
      const hasPrimaryImage = Boolean(String(opening.image || '').trim());
      if (!hasPrimaryImage) byId.get('image').rows.push(opening);
      if (hasPrimaryImage && !String(opening.fallbackImage || opening.imageFallback || '').trim()) byId.get('fallback').rows.push(opening);
      if (!cleanList(opening.performers)) byId.get('performer').rows.push(opening);
      if (!cleanList(opening.studios)) byId.get('studio').rows.push(opening);
      if (!cleanList(opening.directors)) byId.get('director').rows.push(opening);
      const franchises = listValues(opening.franchises);
      if (!franchises.length) byId.get('franchise').rows.push(opening);
      if (franchises.some(value => /https?:\/\/|www\.|^[,;|]|[,;|]$/i.test(value) || value.length > 120)) {
        byId.get('franchise-suspicious').rows.push(opening);
      } else if (franchises.some(value => {
        const canonical = normalize(value).replace(/[^\p{L}\p{N}]+/gu, '');
        return (franchiseVariants.get(canonical)?.size || 0) > 1;
      })) {
        byId.get('franchise-suspicious').rows.push(opening);
      }
      const trackLink = String(opening.link || '').trim();
      if (!trackLink) byId.get('link').rows.push(opening);
      else if (!plausibleTrackLink(trackLink)) byId.get('link-invalid').rows.push(opening);
      const imageUrls = [opening.image, opening.fallbackImage || opening.imageFallback].map(value => String(value || '').trim()).filter(Boolean);
      if (imageUrls.some(value => !validHttpUrl(value))) byId.get('image-invalid').rows.push(opening);
      if (imageUrls.some(value => unreachableImages.has(value))) byId.get('image-unreachable').rows.push(opening);
      if (String(opening.sameSongTitle || opening.songGroupTitle || '').trim() && !String(opening.sameSongGroupId || opening.songGroupId || '').trim()) byId.get('same-song').rows.push(opening);

      const title = normalize(rawTitle);
      if (title) {
        const key = `${title}|${String(opening.type || '')}|${String(opening.year || '')}|${String(opening.season || '')}`;
        const group = duplicateMap.get(key);
        if (group) group.push(opening);
        else duplicateMap.set(key, [opening]);
      }
    }

    for (const group of duplicateMap.values()) {
      if (group.length > 1) byId.get('duplicate').rows.push(...group);
    }
    return issues;
  }

  function completeness(openings, issues) {
    if (!openings.length) return 100;
    const keyIds = new Set(['image', 'performer', 'studio', 'director', 'franchise', 'link']);
    let missing = 0;
    for (const issue of issues) if (keyIds.has(issue.id)) missing += issue.rows.length;
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

      const checkLinks = event.target.closest('[data-quality-check-links]');
      if (checkLinks) {
        void checkImageLinks(checkLinks);
        return;
      }

      const summary = event.target.closest('.oc-quality-issue > summary');
      if (summary) {
        const details = summary.parentElement;
        window.setTimeout(() => {
          if (details?.open) renderIssueRows(details);
        }, 0);
        return;
      }

      const track = event.target.closest('[data-quality-track]');
      if (track) openTrack(String(track.dataset.qualityTrack || ''), String(track.dataset.qualityTitle || ''));
    });

    return modal;
  }

  function renderIssueRows(details) {
    if (!details || details.dataset.qualityRendered === '1') return;
    const issue = currentIssues.get(details.dataset.qualityIssue || '');
    const list = details.querySelector('.oc-quality-track-list');
    if (!issue || !list) return;

    details.dataset.qualityRendered = '1';
    if (!issue.rows.length) {
      list.innerHTML = '<div class="oc-quality-ok">Проблем не найдено ✓</div>';
      return;
    }

    const visibleRows = issue.rows.slice(0, ISSUE_LIMIT);
    list.innerHTML = visibleRows.map(opening => {
      const season = opening.season ? `${SEASON_LABEL[opening.season] || opening.season} ${opening.year || ''}`.trim() : String(opening.year || '—');
      const title = String(opening.title || opening.anime || 'Без названия');
      return `<button type="button" class="oc-quality-track" data-quality-track="${escapeHtml(opening.id)}" data-quality-title="${escapeHtml(title)}"><span>${escapeHtml(title)}</span><small>${escapeHtml(opening.type || '—')} · ${escapeHtml(season)}</small></button>`;
    }).join('') + (issue.rows.length > visibleRows.length ? `<div class="oc-quality-more">Показаны первые ${visibleRows.length} из ${issue.rows.length}</div>` : '');
  }

  function renderLoading() {
    const root = ensureModal();
    currentIssues = new Map();
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
    currentIssues = new Map();
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
    currentIssues = new Map(issues.map(issue => [issue.id, issue]));
    const score = completeness(openings, issues);
    const uniqueProblemIds = new Set();
    let totalHits = 0;
    for (const issue of issues) {
      totalHits += issue.rows.length;
      for (const opening of issue.rows) uniqueProblemIds.add(String(opening.id));
    }

    const issueHtml = issues.map(issue => `
      <details class="oc-quality-issue" data-quality-issue="${issue.id}">
        <summary><span>${escapeHtml(issue.label)}</span><strong>${issue.rows.length}</strong></summary>
        <div class="oc-quality-track-list"><div class="oc-quality-more">Список загрузится при открытии раздела</div></div>
      </details>`).join('');

    root.innerHTML = `
      <div class="oc-quality-dialog">
        <div class="oc-quality-head">
          <div>
            <div class="oc-quality-kicker">админ · качество базы</div>
            <h2>Центр качества</h2>
            <p>Пустые поля, одинаковая песня без группы и возможные дубликаты. Списки треков создаются только когда ты раскрываешь нужный раздел.</p>
          </div>
          <div class="oc-quality-head-actions">
            <button class="oc-quality-refresh" type="button" data-quality-check-links>Проверить картинки</button>
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

  function probeImage(url) {
    return new Promise(resolve => {
      const image = new Image();
      const timer = window.setTimeout(() => {
        image.src = '';
        resolve(false);
      }, 8000);
      image.onload = () => {
        window.clearTimeout(timer);
        resolve(Boolean(image.naturalWidth && image.naturalHeight));
      };
      image.onerror = () => {
        window.clearTimeout(timer);
        resolve(false);
      };
      image.referrerPolicy = 'no-referrer';
      image.src = url;
    });
  }

  async function checkImageLinks(button) {
    if (!cachedOpenings?.length || button.disabled) return;
    const urls = [...new Set(cachedOpenings.flatMap(opening => [
      String(opening.image || '').trim(),
      String(opening.fallbackImage || opening.imageFallback || '').trim()
    ]).filter(validHttpUrl))];
    unreachableImages.clear();
    button.disabled = true;
    let completed = 0;
    const queue = urls.slice();
    const workers = Array.from({ length: Math.min(8, queue.length) }, async () => {
      while (queue.length) {
        const url = queue.shift();
        if (!await probeImage(url)) unreachableImages.add(url);
        completed += 1;
        button.textContent = `Проверено ${completed}/${urls.length}`;
      }
    });
    await Promise.all(workers);
    render(cachedOpenings);
  }

  function fallbackOpenTrack(title) {
    document.querySelector('.oc-tab-btn[data-tab="chart"]')?.click();
    document.querySelector('#oc-reset-filters')?.click();
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
      ['view', 'profile', 'section', 'album'].forEach(key => url.searchParams.delete(key));
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
      await yieldToUi();
      const openings = await loadOpenings(force);
      if (root.classList.contains('hidden')) return;
      await yieldToUi();
      render(openings);
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
