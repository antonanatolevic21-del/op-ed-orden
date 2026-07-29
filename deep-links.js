(() => {
  if (window.__OC_DEEP_LINKS_READY__) return;

  const VIEWS = new Set(['chart', 'profile', 'top100', 'season', 'tier', 'stats', 'entity-studios', 'entity-performers', 'entity-directors', 'entity-franchises']);
  const ENTITY_VIEWS = new Set(['entity-studios', 'entity-performers', 'entity-directors', 'entity-franchises']);
  const SEASONS = new Set(['winter', 'spring', 'summer', 'fall']);
  let applying = false;

  const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const normalize = value => String(value || '').trim().toLowerCase().replace(/ё/g, 'е');

  function currentUrl() {
    return new URL(window.location.href);
  }

  function writeUrl(patch, replace = false) {
    if (applying) return;
    const url = currentUrl();
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    });
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', next);
  }

  function dispatchValue(element, inputToo = false) {
    if (!element) return;
    if (inputToo) element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function waitUntil(getter, timeout = 4500, interval = 70) {
    const started = Date.now();
    let value = getter();
    while (!value && Date.now() - started < timeout) {
      await sleep(interval);
      value = getter();
    }
    return value || null;
  }

  async function waitForAccountRestore(timeout = 8000) {
    if (window.__OC_ACCOUNT_RESTORE_DONE__) return;
    if (window.OC_ACCOUNT_READY && typeof window.OC_ACCOUNT_READY.then === 'function') {
      await Promise.race([window.OC_ACCOUNT_READY, sleep(timeout)]);
      return;
    }
    await Promise.race([
      new Promise(resolve => window.addEventListener('oped-account-restored', resolve, { once: true })),
      sleep(timeout)
    ]);
  }

  function tabButton(view) {
    return [...document.querySelectorAll('.oc-tab-btn[data-tab]')].find(button => button.dataset.tab === view) || null;
  }

  function clickTab(view) {
    const button = tabButton(view);
    if (!button) return false;
    button.click();
    return true;
  }

  function dataElement(attribute, value) {
    const wanted = normalize(value);
    return [...document.querySelectorAll(`[${attribute}]`)].find(element => normalize(element.getAttribute(attribute)) === wanted) || null;
  }

  function profileOption(select, value) {
    const wanted = normalize(value);
    return [...(select?.options || [])].find(option => normalize(option.value) === wanted || normalize(option.textContent) === wanted) || null;
  }

  async function applyProfile(url) {
    const profile = url.searchParams.get('profile');
    const section = url.searchParams.get('section');
    const select = await waitUntil(() => document.querySelector('#oc-profile-user'), 3000);
    if (profile && select) {
      const option = await waitUntil(() => profileOption(select, profile), 4000);
      if (option) {
        select.value = option.value;
        dispatchValue(select);
      }
    }
    if (section) {
      const subtab = await waitUntil(() => [...document.querySelectorAll('[data-profile-view]')].find(button => button.dataset.profileView === section), 1800);
      subtab?.click();
    }
  }

  async function applySeason(url) {
    const type = String(url.searchParams.get('type') || '').toUpperCase();
    const year = String(url.searchParams.get('year') || '').trim();
    const season = String(url.searchParams.get('season') || '').toLowerCase();

    if (type === 'OP' || type === 'ED') {
      dataElement('data-season-type', type)?.click();
    }
    if (!year) return;

    const yearButton = await waitUntil(() => dataElement('data-season-year', year), 4500);
    yearButton?.click();
    if (!SEASONS.has(season)) return;

    const seasonButton = await waitUntil(() => [...document.querySelectorAll('[data-season-select]')].find(button => String(button.dataset.year || '') === year && String(button.dataset.season || '') === season), 3500);
    seasonButton?.click();
  }

  async function applyEntity(url, view) {
    const type = view.replace('entity-', '');
    const home = await waitUntil(() => dataElement('data-entity-home', type), 3000);
    home?.click();

    const album = url.searchParams.get('album');
    if (!album) return;
    if (!window.OC_APP_DATA?.entityCards?.length) {
      await Promise.race([
        new Promise(resolve => window.addEventListener('oped:entity-cards-updated', resolve, { once: true })),
        sleep(8000)
      ]);
    }
    const card = await waitUntil(() => dataElement('data-entity-open', album), 8000);
    card?.click();
  }

  async function exactTrackTitle(id) {
    try {
      if (!window.OPED_DB) {
        await new Promise(resolve => {
          const timer = window.setTimeout(resolve, 5000);
          window.addEventListener('oped-db-ready', () => {
            window.clearTimeout(timer);
            resolve();
          }, { once: true });
        });
      }
      const [{ getApp, getApps }, { getFirestore, doc, getDoc }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
      ]);
      if (!getApps().length) return '';
      const snapshot = await getDoc(doc(getFirestore(getApp()), 'openings', String(id)));
      return snapshot.exists() ? String(snapshot.data()?.title || '').trim() : '';
    } catch (error) {
      console.warn('Deep link track lookup failed', error);
      return '';
    }
  }

  function trackCard(id) {
    return [...document.querySelectorAll('.oc-unified-card[data-id]')].find(card => String(card.dataset.id || '') === String(id)) || null;
  }

  async function applyTrack(id) {
    const trackId = String(id || '').trim();
    if (!trackId) return false;
    clickTab('chart');

    let card = trackCard(trackId);
    let previousSearch = null;
    const search = document.querySelector('#oc-f-search');

    if (!card) {
      const title = await exactTrackTitle(trackId);
      if (title && search) {
        previousSearch = search.value;
        search.value = title;
        dispatchValue(search, true);
        card = await waitUntil(() => trackCard(trackId), 3500);
      }
    }

    const openButton = card?.querySelector('[data-action="open-card"]');
    if (openButton) {
      openButton.click();
      await sleep(80);
    }

    if (previousSearch !== null && search) {
      search.value = previousSearch;
      dispatchValue(search, true);
    }
    return Boolean(openButton);
  }

  function closeTrackModal() {
    const modal = document.querySelector('#oc-opening-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    const close = modal.querySelector('[data-modal-close],[data-action="close"],[data-action="close-modal"],.oc-modal-close,button[aria-label="Закрыть"]');
    if (close) close.click();
    else modal.classList.add('hidden');
  }

  async function applyUrl() {
    if (applying) return;
    applying = true;
    try {
      await waitForAccountRestore();
      const url = currentUrl();
      const track = url.searchParams.get('track');
      let view = url.searchParams.get('view') || 'chart';
      if (!VIEWS.has(view)) view = 'chart';
      if (track) view = 'chart';

      if (ENTITY_VIEWS.has(view)) await applyEntity(url, view);
      else clickTab(view);

      if (view === 'profile') await applyProfile(url);
      if (view === 'season') await applySeason(url);
      if (track) await applyTrack(track);
      else closeTrackModal();
    } finally {
      applying = false;
    }
  }

  function currentEntityView() {
    const fromUrl = currentUrl().searchParams.get('view');
    if (ENTITY_VIEWS.has(fromUrl)) return fromUrl;
    const active = [...document.querySelectorAll('[data-entity-home]')].find(element => element.classList.contains('active'));
    return active ? `entity-${active.dataset.entityHome}` : '';
  }

  function bindUrlUpdates() {
    document.addEventListener('click', event => {
      if (applying) return;

      const tab = event.target.closest('.oc-tab-btn[data-tab]');
      if (tab) {
        const view = tab.dataset.tab;
        writeUrl({
          view: view === 'chart' ? null : view,
          profile: view === 'profile' ? document.querySelector('#oc-profile-user')?.value || null : null,
          section: view === 'profile' ? document.querySelector('[data-profile-view].active')?.dataset.profileView || null : null,
          year: view === 'season' ? currentUrl().searchParams.get('year') : null,
          season: view === 'season' ? currentUrl().searchParams.get('season') : null,
          type: view === 'season' ? currentUrl().searchParams.get('type') : null,
          album: null,
          track: null
        });
        return;
      }

      const entityHome = event.target.closest('[data-entity-home]');
      if (entityHome) {
        writeUrl({ view: `entity-${entityHome.dataset.entityHome}`, album: null, track: null, profile: null, section: null, year: null, season: null, type: null });
        return;
      }

      const album = event.target.closest('[data-entity-open]');
      if (album) {
        writeUrl({ view: currentEntityView() || null, album: album.dataset.entityOpen || null, track: null });
        return;
      }

      const openCard = event.target.closest('[data-action="open-card"]');
      if (openCard) {
        const id = String(openCard.dataset.id || openCard.closest('[data-id]')?.dataset.id || '').trim();
        if (id) writeUrl({ view: null, track: id, album: null });
        return;
      }

      const profileSection = event.target.closest('[data-profile-view]');
      if (profileSection && !document.querySelector('#oc-profile-panel')?.classList.contains('hidden')) {
        writeUrl({ view: 'profile', section: profileSection.dataset.profileView || null, profile: document.querySelector('#oc-profile-user')?.value || null });
        return;
      }

      const seasonYear = event.target.closest('[data-season-year]');
      if (seasonYear) {
        writeUrl({ view: 'season', year: seasonYear.dataset.seasonYear || null, track: null });
        return;
      }

      const season = event.target.closest('[data-season-select]');
      if (season) {
        writeUrl({ view: 'season', year: season.dataset.year || null, season: season.dataset.season || null, track: null });
        return;
      }

      const seasonType = event.target.closest('[data-season-type]');
      if (seasonType) {
        writeUrl({ view: 'season', type: seasonType.dataset.seasonType || null, track: null });
        return;
      }

      const modal = document.querySelector('#oc-opening-modal');
      const modalClose = event.target.closest('[data-modal-close],[data-action="close"],[data-action="close-modal"],.oc-modal-close,button[aria-label="Закрыть"]');
      if (modalClose && modal?.contains(modalClose)) writeUrl({ track: null }, true);
    }, true);

    document.addEventListener('change', event => {
      if (applying) return;
      if (event.target?.id === 'oc-profile-user' && !document.querySelector('#oc-profile-panel')?.classList.contains('hidden')) {
        writeUrl({ view: 'profile', profile: event.target.value || null }, true);
      }
    }, true);

    window.addEventListener('popstate', () => { void applyUrl(); });
  }

  function init() {
    if (window.__OC_DEEP_LINKS_READY__) return;
    bindUrlUpdates();
    window.__OC_DEEP_LINKS_READY__ = true;
    window.addEventListener('oped:entity-cards-updated', () => {
      const url = currentUrl();
      if (url.searchParams.get('album')) void applyUrl();
    });
    window.addEventListener('oped:user-profiles-updated', () => {
      const url = currentUrl();
      if (url.searchParams.get('view') === 'profile' && url.searchParams.get('profile')) void applyUrl();
    });
    window.setTimeout(() => { void applyUrl(); }, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
