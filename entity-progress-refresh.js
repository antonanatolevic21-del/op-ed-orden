(() => {
  const ENTITY_FIELDS = {
    studios: 'studios',
    performers: 'performers',
    directors: 'directors',
    franchises: 'franchises'
  };
  const ENTITY_MIN_TRACKS = 3;

  let openings = [];
  let ratings = [];
  let entityCards = [];
  let refreshTimer = null;
  let identitySignature = '';
  let unsubscribeOpenings = null;
  let unsubscribeRatings = null;
  let unsubscribeEntityCards = null;

  function normalizeValue(value) {
    return String(value || '').trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ');
  }

  function normalizeNickname(value) {
    return String(value || '')
      .trim()
      .toLocaleLowerCase('ru')
      .replace(/[^a-zа-яё0-9_-]+/gi, '_')
      .slice(0, 60);
  }

  function cleanList(value) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    return String(value || '').split(/[,\n]/).map(item => item.trim()).filter(Boolean);
  }

  function hasNumericValue(value) {
    if (value === null || value === undefined || String(value).trim() === '') return false;
    return Number.isFinite(Number(value));
  }

  function currentIdentity() {
    const name = String(document.querySelector('#oc-myname')?.value || localStorage.getItem('my-display-name') || '').trim();
    const scale = String(document.querySelector('#oc-scale-select')?.value || localStorage.getItem('rating-scale') || 'int');
    return { name, safeName: normalizeNickname(name), personal: scale === 'five', scale };
  }

  function mapHasUserScore(map, safeName) {
    if (!map || typeof map !== 'object' || !safeName) return false;
    return Object.entries(map).some(([nickname, value]) => normalizeNickname(nickname) === safeName && hasNumericValue(value));
  }

  function ratingBelongsToUser(row, safeName) {
    if (!safeName || !row) return false;
    const idNickname = String(row.id || '').split('__')[0];
    return [row.nicknameKey, row.nickname, row.displayName, idNickname]
      .some(value => normalizeNickname(value) === safeName);
  }

  function buildProgressState() {
    const identity = currentIdentity();
    const ratedIds = new Set();
    const index = new Map();

    openings.forEach(opening => {
      const openingId = String(opening?.id || '');
      if (!openingId) return;

      const embeddedScores = identity.personal ? opening.personalScores : opening.scores;
      if (mapHasUserScore(embeddedScores, identity.safeName)) ratedIds.add(openingId);

      Object.entries(ENTITY_FIELDS).forEach(([type, field]) => {
        cleanList(opening[field]).forEach(rawValue => {
          const key = `${type}::${normalizeValue(rawValue)}`;
          if (!index.has(key)) index.set(key, []);
          index.get(key).push(opening);
        });
      });
    });

    ratings.forEach(row => {
      if (!ratingBelongsToUser(row, identity.safeName)) return;
      const value = identity.personal ? row.personalScore : row.score;
      if (!hasNumericValue(value)) return;
      const openingId = String(row.openingId || '').trim();
      if (openingId) ratedIds.add(openingId);
    });

    return { identity, ratedIds, index };
  }

  function activeEntityType() {
    const activeTab = document.querySelector('.oc-tab-btn.active[data-tab^="entity-"]');
    if (activeTab) return String(activeTab.dataset.tab || '').replace(/^entity-/, '');

    const title = normalizeValue(document.querySelector('#oc-entity-title')?.textContent);
    if (title.includes('исполнител')) return 'performers';
    if (title.includes('режисс')) return 'directors';
    if (title.includes('франш')) return 'franchises';
    return 'studios';
  }

  function entityCardInfo(element) {
    const cardId = String(element.getAttribute('data-entity-open') || '');
    const stored = entityCards.find(card => String(card.id || '') === cardId);
    return {
      type: String(stored?.type || activeEntityType()),
      value: String(stored?.value || element.querySelector('h3')?.textContent || '').trim()
    };
  }

  function progressFor(type, value, state) {
    const related = state.index.get(`${type}::${normalizeValue(value)}`) || [];
    const rated = related.reduce((count, opening) => count + (state.ratedIds.has(String(opening.id || '')) ? 1 : 0), 0);
    return {
      related,
      rated,
      complete: related.length >= ENTITY_MIN_TRACKS && rated === related.length
    };
  }

  function updateCard(element, progress) {
    const body = element.querySelector('.oc-entity-card-body');
    if (!body) return;

    const progressText = `${progress.rated} из ${progress.related.length} оценено`;
    const text = body.querySelector(':scope > p');
    if (text && text.textContent !== progressText) text.textContent = progressText;

    const percent = progress.related.length ? Math.round(progress.rated / progress.related.length * 100) : 0;
    const bar = body.querySelector('.oc-entity-progressbar i');
    if (bar && bar.style.width !== `${percent}%`) bar.style.width = `${percent}%`;

    element.classList.toggle('complete', progress.complete);
    element.dataset.rated = String(progress.rated);
    element.dataset.total = String(progress.related.length);
    element.title = progress.complete ? `${progressText}. Альбом полностью закрыт.` : progressText;

    let done = body.querySelector('.oc-entity-done');
    if (progress.complete && !done) {
      done = document.createElement('span');
      done.className = 'oc-entity-done';
      done.textContent = 'Всё просмотрено ✓';
      const deleteButton = body.querySelector('.oc-entity-delete');
      if (deleteButton) body.insertBefore(done, deleteButton);
      else body.append(done);
    } else if (!progress.complete && done) {
      done.remove();
    } else if (done && done.textContent !== 'Всё просмотрено ✓') {
      done.textContent = 'Всё просмотрено ✓';
    }
  }

  function refreshVisibleProgress() {
    const panel = document.querySelector('#oc-entity-panel');
    if (!panel) return;

    const state = buildProgressState();
    panel.querySelectorAll('.oc-entity-card[data-entity-open]').forEach(element => {
      const info = entityCardInfo(element);
      updateCard(element, progressFor(info.type, info.value, state));
    });

    const grid = document.querySelector('#oc-entity-grid');
    if (grid?.classList.contains('hidden')) {
      const title = String(document.querySelector('#oc-entity-title')?.textContent || '').trim();
      const subtitle = document.querySelector('#oc-entity-subtitle');
      if (title && subtitle) {
        const progress = progressFor(activeEntityType(), title, state);
        const text = `${progress.rated} из ${progress.related.length} оценено`;
        if (subtitle.textContent !== text) subtitle.textContent = text;
      }
    }
  }

  function queueProgressRefresh(delay = 40) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refreshVisibleProgress();
    }, delay);
  }

  function startWatchers() {
    const db = window.OPED_DB;
    if (!db) return false;

    if (!unsubscribeOpenings && typeof db.watchOpenings === 'function') {
      unsubscribeOpenings = db.watchOpenings(rows => {
        openings = Array.isArray(rows) ? rows : [];
        queueProgressRefresh(70);
      });
    }
    if (!unsubscribeRatings && typeof db.watchRatings === 'function') {
      unsubscribeRatings = db.watchRatings(rows => {
        ratings = Array.isArray(rows) ? rows : [];
        queueProgressRefresh(70);
      });
    }
    if (!unsubscribeEntityCards && typeof db.watchEntityCards === 'function') {
      unsubscribeEntityCards = db.watchEntityCards(rows => {
        entityCards = Array.isArray(rows) ? rows : [];
        queueProgressRefresh(70);
      });
    }

    return Boolean(unsubscribeOpenings && unsubscribeRatings);
  }

  function observeAlbumMarkup() {
    const panel = document.querySelector('#oc-entity-panel');
    if (!panel) return;
    new MutationObserver(records => {
      if (records.some(record => Array.from(record.addedNodes).some(node =>
        node instanceof Element && (node.matches?.('.oc-entity-card') || node.querySelector?.('.oc-entity-card'))
      ))) queueProgressRefresh(0);
    }).observe(panel, { childList: true, subtree: true });
  }

  document.addEventListener('change', event => {
    if (event.target?.matches?.('#oc-myname, #oc-scale-select')) queueProgressRefresh(0);
  });
  document.addEventListener('input', event => {
    if (event.target?.matches?.('#oc-myname')) queueProgressRefresh(80);
  });
  window.addEventListener('storage', queueProgressRefresh);

  const identityTimer = setInterval(() => {
    const identity = currentIdentity();
    const next = `${identity.safeName}|${identity.scale}`;
    if (next === identitySignature) return;
    identitySignature = next;
    queueProgressRefresh(0);
  }, 350);

  if (!startWatchers()) {
    window.addEventListener('oped-db-ready', () => {
      startWatchers();
      queueProgressRefresh(100);
    }, { once: true });
    const readyTimer = setInterval(() => {
      if (startWatchers()) clearInterval(readyTimer);
    }, 250);
    setTimeout(() => clearInterval(readyTimer), 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observeAlbumMarkup();
      queueProgressRefresh(100);
    }, { once: true });
  } else {
    observeAlbumMarkup();
    queueProgressRefresh(100);
  }

  window.addEventListener('beforeunload', () => {
    clearTimeout(refreshTimer);
    clearInterval(identityTimer);
    [unsubscribeOpenings, unsubscribeRatings, unsubscribeEntityCards].forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
  }, { once: true });
})();
