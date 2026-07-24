import { openingById, subscribeProductState } from './state.js';

const TAB_MAP = new Set(['chart', 'profile', 'top100', 'season', 'tier', 'stats', 'entity-studios', 'entity-performers', 'entity-directors', 'entity-franchises']);
let applying = false;
let lastTrackId = '';

function currentUrl() {
  return new URL(window.location.href);
}

function updateUrl(patch = {}, replace = false) {
  if (applying) return;
  const url = currentUrl();
  Object.entries(patch).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  });
  const method = replace ? 'replaceState' : 'pushState';
  history[method]({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function originalTabButton(tab) {
  return [...document.querySelectorAll('.oc-tab-btn[data-tab]')].find(button => button.dataset.tab === tab && !button.closest('.oc-shell-header')) || null;
}

export function navigateTab(tab, options = {}) {
  const safeTab = TAB_MAP.has(tab) ? tab : 'chart';
  const button = originalTabButton(safeTab);
  if (button) button.click();
  if (options.push !== false) updateUrl({ view: safeTab === 'chart' ? null : safeTab, track: null, album: safeTab.startsWith('entity-') ? undefined : null });
  window.dispatchEvent(new CustomEvent('oped-route-changed', { detail: { tab: safeTab } }));
}

function dispatchField(element) {
  if (!element) return;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function waitFor(selector, timeout = 3500) {
  return new Promise(resolve => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (!found) return;
      observer.disconnect();
      resolve(found);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}

export async function openTrack(id, options = {}) {
  const key = String(id || '').trim();
  const opening = openingById(key);
  if (!key || !opening) return false;
  navigateTab('chart', { push: false });
  const search = document.querySelector('#oc-f-search');
  if (search) {
    search.value = String(opening.title || '');
    dispatchField(search);
  }
  await new Promise(resolve => setTimeout(resolve, 80));
  let card = document.querySelector(`.oc-unified-card[data-id="${CSS.escape(key)}"]`);
  if (!card) card = await waitFor(`.oc-unified-card[data-id="${CSS.escape(key)}"]`, 1600);
  const openButton = card?.querySelector('[data-action="open-card"]');
  if (!openButton) return false;
  lastTrackId = key;
  openButton.click();
  if (options.push !== false) updateUrl({ view: null, track: key });
  window.dispatchEvent(new CustomEvent('oped-track-opened', { detail: { id: key } }));
  return true;
}

function seasonCode(label) {
  const value = String(label || '').toLowerCase();
  if (value.startsWith('зим')) return 'winter';
  if (value.startsWith('вес')) return 'spring';
  if (value.startsWith('лет')) return 'summer';
  if (value.startsWith('осен')) return 'fall';
  return value;
}

async function applySeason(url) {
  const year = url.searchParams.get('year');
  const season = seasonCode(url.searchParams.get('season'));
  const type = String(url.searchParams.get('type') || '').toUpperCase();
  if (type === 'OP' || type === 'ED') {
    document.querySelector(`[data-season-type="${type}"]`)?.click();
  }
  if (!year || !season) return;
  await new Promise(resolve => setTimeout(resolve, 40));
  document.querySelector(`[data-season-year="${CSS.escape(year)}"]`)?.click();
  await new Promise(resolve => setTimeout(resolve, 40));
  document.querySelector(`[data-season-select][data-year="${CSS.escape(year)}"][data-season="${CSS.escape(season)}"]`)?.click();
}

async function applyEntity(url, view) {
  const type = view.replace('entity-', '');
  document.querySelector(`[data-entity-home="${CSS.escape(type)}"]`)?.click();
  const album = url.searchParams.get('album');
  if (!album) return;
  await new Promise(resolve => setTimeout(resolve, 100));
  const card = document.querySelector(`[data-entity-open="${CSS.escape(album)}"]`) || await waitFor(`[data-entity-open="${CSS.escape(album)}"]`, 2000);
  card?.click();
}

async function applyUrl() {
  applying = true;
  try {
    const url = currentUrl();
    const view = TAB_MAP.has(url.searchParams.get('view')) ? url.searchParams.get('view') : 'chart';
    const button = originalTabButton(view);
    button?.click();
    if (view === 'profile') {
      const profile = url.searchParams.get('profile');
      if (profile) window.dispatchEvent(new CustomEvent('oped-profile-route', { detail: { profile } }));
    }
    if (view === 'season') await applySeason(url);
    if (view.startsWith('entity-')) await applyEntity(url, view);
    const track = url.searchParams.get('track');
    if (track) {
      await new Promise(resolve => setTimeout(resolve, 80));
      await openTrack(track, { push: false });
    }
  } finally {
    applying = false;
  }
}

function bindUrlUpdates() {
  document.addEventListener('click', event => {
    const tab = event.target.closest('.oc-tab-btn[data-tab]');
    if (tab && !applying) {
      const name = tab.dataset.tab;
      updateUrl({ view: name === 'chart' ? null : name, track: null, album: name?.startsWith('entity-') ? undefined : null });
    }

    const homeEntity = event.target.closest('[data-entity-home]');
    if (homeEntity && !applying) updateUrl({ view: `entity-${homeEntity.dataset.entityHome}`, album: null, track: null });

    const album = event.target.closest('[data-entity-open]');
    if (album && !applying) updateUrl({ album: album.dataset.entityOpen, track: null });

    const openCard = event.target.closest('[data-action="open-card"]');
    if (openCard && !applying) {
      lastTrackId = String(openCard.dataset.id || openCard.closest('[data-id]')?.dataset.id || '');
      if (lastTrackId) {
        updateUrl({ track: lastTrackId });
        window.dispatchEvent(new CustomEvent('oped-track-opened', { detail: { id: lastTrackId } }));
      }
    }

    if (event.target.closest('[data-modal-close]') && !applying) updateUrl({ track: null }, true);

    const seasonYear = event.target.closest('[data-season-year]');
    if (seasonYear && !applying) updateUrl({ view: 'season', year: seasonYear.dataset.seasonYear });
    const season = event.target.closest('[data-season-select]');
    if (season && !applying) updateUrl({ view: 'season', year: season.dataset.year, season: season.dataset.season });
    const seasonType = event.target.closest('[data-season-type]');
    if (seasonType && !applying) updateUrl({ view: 'season', type: seasonType.dataset.seasonType });
  }, true);

  window.addEventListener('popstate', () => applyUrl());
}

export function setProfileRoute(profile, replace = false) {
  updateUrl({ view: 'profile', profile }, replace);
}

export function initRouter() {
  bindUrlUpdates();
  subscribeProductState(({ reason }) => {
    if (reason === 'openings') applyUrl();
  });
  window.setTimeout(applyUrl, 180);
}
