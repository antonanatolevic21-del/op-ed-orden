import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js";
import { firebaseConfig, adminUids, appCheckSiteKey } from './firebase-config.js';

const CURRENT_EVENT_YEAR = 2026;
const FULL_MARKER_KEY = 'oc-events-full-route-v1';
const FULL_MARKER_TTL = 90 * 1000;
const EVENT_ACCESS_KEY = 'event-access-level';
const EVENT_GUEST_SLOT_KEY = 'event-guest-slot';
const EVENT_ADMIN_UNLOCKED_KEY = 'event-admin-unlocked';
const EVENT_NAME_KEY = 'my-display-name';
const PRIMARY_NAME_KEY = 'op-ed-primary-account-name';
const ADMIN_UIDS = new Set((adminUids || []).map(String));
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let appCheckReady = false;

function normalizeNickname(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
}

function requestedMode() {
  const params = new URLSearchParams(location.search);
  return String(params.get('mode') || '').trim();
}

function isFullRequest() {
  return new URLSearchParams(location.search).get('full') === '1';
}

function readFullMarker(uid) {
  try {
    const row = JSON.parse(sessionStorage.getItem(FULL_MARKER_KEY) || 'null');
    return row?.uid === String(uid || '') && Date.now() - Number(row.checkedAt || 0) < FULL_MARKER_TTL;
  } catch (_) {
    return false;
  }
}

function writeFullMarker(uid) {
  try { sessionStorage.setItem(FULL_MARKER_KEY, JSON.stringify({ uid: String(uid || ''), checkedAt: Date.now() })); } catch (_) {}
}

function clearFullMarker() {
  try { sessionStorage.removeItem(FULL_MARKER_KEY); } catch (_) {}
}

function ensureAppCheck() {
  if (appCheckReady || !appCheckSiteKey) return;
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
  appCheckReady = true;
}

async function resolveProfile(user) {
  ensureAppCheck();
  try {
    const snapshot = await getDocs(query(collection(db, 'userProfiles'), where('authUid', '==', user.uid), limit(1)));
    const docSnap = snapshot.docs[0];
    if (!docSnap) return null;
    const row = docSnap.data() || {};
    const nickname = String(row.nickname || row.nicknameKey || docSnap.id || '').trim();
    if (!nickname) return null;
    return {
      id: docSnap.id,
      ...row,
      nickname,
      nicknameKey: normalizeNickname(row.nicknameKey || nickname),
      authUid: String(user.uid)
    };
  } catch (error) {
    console.warn('Events bootstrap profile lookup failed', error);
    return null;
  }
}

function bindingRows(row) {
  return Array.isArray(row?.participantBindings) ? row.participantBindings : [];
}

function participantMatch(row, profile) {
  if (!row || row.eventKind === 'ending-year' || row.closed || Number(row.year || CURRENT_EVENT_YEAR) !== CURRENT_EVENT_YEAR) return null;
  const key = normalizeNickname(profile.nicknameKey || profile.nickname);
  const slots = Array.isArray(row.allowedNicknames) ? row.allowedNicknames : [];
  const slotIndex = slots.findIndex(name => normalizeNickname(name) === key);
  if (slotIndex < 0 || slotIndex >= 15) return null;
  const binding = bindingRows(row).find(item => normalizeNickname(item?.nicknameKey || item?.nickname) === key);
  if (binding?.authUid && String(binding.authUid) !== String(profile.authUid)) return null;
  return { ...row, slot: slotIndex + 1, nickname: String(slots[slotIndex] || profile.nickname) };
}

async function matchingSeasons(profile) {
  ensureAppCheck();
  const snapshot = await getDocs(collection(db, 'eventSeasons'));
  return snapshot.docs
    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
    .map(row => participantMatch(row, profile))
    .filter(Boolean);
}

function addParticipantStyle() {
  if (document.querySelector('link[data-event-participant-suite]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.eventParticipantSuite = '1';
  link.href = './events-participant-suite.css?v=20260725-participant-suite2';
  document.head.append(link);
}

function fullUrl(mode = '') {
  const url = new URL(location.href);
  url.searchParams.set('full', '1');
  if (mode) url.searchParams.set('mode', mode);
  else url.searchParams.delete('mode');
  return url.href;
}

function participantUrl() {
  const url = new URL(location.href);
  url.searchParams.delete('full');
  url.searchParams.delete('mode');
  return url.href;
}

function prepareRegisteredFullAccess(user = auth.currentUser, profile = null) {
  if (!user || user.isAnonymous || ADMIN_UIDS.has(String(user.uid || ''))) return;
  localStorage.setItem(EVENT_ACCESS_KEY, 'user');
  localStorage.setItem(EVENT_GUEST_SLOT_KEY, '0');
  localStorage.setItem(EVENT_ADMIN_UNLOCKED_KEY, '0');
  const nickname = String(
    profile?.nickname || profile?.nicknameKey || user.displayName ||
    localStorage.getItem(PRIMARY_NAME_KEY) || localStorage.getItem(EVENT_NAME_KEY) || ''
  ).trim();
  if (nickname) localStorage.setItem(EVENT_NAME_KEY, nickname);
}

async function clickRequestedMode(mode) {
  if (!mode || mode === 'rating') return;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const button = document.querySelector(`.ev-mode-tab[data-mode="${CSS.escape(mode)}"]`);
    if (button) {
      button.click();
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function loadFull(mode = '', profile = null) {
  window.__OC_EVENTS_LIGHT_PARTICIPANT__ = false;
  prepareRegisteredFullAccess(auth.currentUser, profile);
  await import('./events-app.js?v=20260730-natural-sort1');
  if (mode) void clickRequestedMode(mode);

  document.addEventListener('click', event => {
    const button = event.target.closest?.('.ev-mode-tab[data-mode="rating"]');
    const current = auth.currentUser;
    if (!button || !current || current.isAnonymous || ADMIN_UIDS.has(String(current.uid || ''))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearFullMarker();
    location.assign(participantUrl());
  }, true);
}

async function start() {
  if (typeof auth.authStateReady === 'function') await auth.authStateReady();
  const user = auth.currentUser;
  const mode = requestedMode();

  if (isFullRequest() || (mode && mode !== 'rating')) {
    prepareRegisteredFullAccess(user);
    await loadFull(mode);
    return;
  }

  if (!user || user.isAnonymous || ADMIN_UIDS.has(String(user.uid || ''))) {
    await loadFull(mode);
    return;
  }

  if (readFullMarker(user.uid)) {
    prepareRegisteredFullAccess(user);
    await loadFull(mode);
    return;
  }

  const profile = await resolveProfile(user);
  if (!profile) {
    prepareRegisteredFullAccess(user);
    writeFullMarker(user.uid);
    location.replace(fullUrl(mode));
    return;
  }

  let seasons = [];
  try {
    seasons = await matchingSeasons(profile);
  } catch (error) {
    console.warn('Events participant season lookup failed', error);
  }

  if (!seasons.length) {
    prepareRegisteredFullAccess(user, profile);
    writeFullMarker(user.uid);
    location.replace(fullUrl(mode));
    return;
  }

  clearFullMarker();
  addParticipantStyle();
  window.__OC_EVENTS_LIGHT_PARTICIPANT__ = true;
  window.OC_EVENT_PARTICIPANT_CONTEXT = { app, auth, db, profile, seasons, currentYear: CURRENT_EVENT_YEAR };
  window.OC_EVENTS_OPEN_FULL_MODE = modeName => {
    prepareRegisteredFullAccess(user, profile);
    location.assign(fullUrl(modeName));
  };
  await import('./events-participant-suite.js?v=20260729-ending-basket2');
}

start().catch(error => {
  console.error('Events bootstrap failed', error);
  prepareRegisteredFullAccess(auth.currentUser);
  writeFullMarker(auth.currentUser?.uid || '');
  location.replace(fullUrl(requestedMode()));
});
