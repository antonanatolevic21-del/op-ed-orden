import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const VISIT_KEY = 'oc-season-entry-visit-v1';
const CURRENT_EVENT_YEAR = 2026; // Same season programme as events-bootstrap.js.
const LABELS = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
const clean = value => String(value ?? '').trim();
const normalize = value => clean(value).toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
let visit = { checked: [] };
let activeUid = '';
let generation = 0;
let dialog = null;

// sessionStorage follows internal full-page navigation as well as SPA routes.
// Direct/external entry starts a fresh visit; reload/back within the visit does not.
function beginsVisit(previous, navigationType, referrer, pageUrl) {
  if (!previous || !Array.isArray(previous.checked)) return true;
  if (navigationType !== 'navigate') return false;
  try {
    const base = new URL('.', pageUrl);
    const from = new URL(referrer);
    return from.origin !== base.origin || !from.pathname.startsWith(base.pathname);
  } catch (_) { return true; }
}

function readVisit() {
  let previous = null;
  try { previous = JSON.parse(sessionStorage.getItem(VISIT_KEY) || 'null'); } catch (_) {}
  const type = performance.getEntriesByType('navigation')[0]?.type || 'navigate';
  visit = beginsVisit(previous, type, document.referrer, location.href) ? { checked: [] } : previous;
  saveVisit();
}
function saveVisit() {
  try { sessionStorage.setItem(VISIT_KEY, JSON.stringify(visit)); } catch (_) {}
}

function pendingAssignments(seasons, ratings, profile, uid) {
  const key = normalize(profile.nicknameKey || profile.nickname || profile.id);
  if (!key) return [];
  return seasons.flatMap(season => {
    if (season.closed || season.eventKind === 'ending-year' ||
        Number(season.year || CURRENT_EVENT_YEAR) !== CURRENT_EVENT_YEAR || !LABELS[season.season]) return [];
    const slots = Array.isArray(season.allowedNicknames) ? season.allowedNicknames.slice(0, 15) : [];
    if (!slots.some(name => normalize(name) === key)) return [];
    const bindings = Array.isArray(season.participantBindings) ? season.participantBindings : [];
    const binding = bindings.find(row => normalize(row.nicknameKey || row.nickname) === key);
    if (binding?.authUid && String(binding.authUid) !== String(uid)) return [];
    const ids = new Set((Array.isArray(season.selectedOpeningIds) ? season.selectedOpeningIds : []).map(String).filter(Boolean));
    const seasonKey = String(season.key || season.id || CURRENT_EVENT_YEAR + '_' + season.season);
    const done = new Set(ratings.filter(row =>
      String(row.seasonKey || '') === seasonKey && String(row.stage || 'first') === 'first' &&
      normalize(row.nicknameKey || row.nickname) === key && ids.has(String(row.openingId || '')) &&
      clean(row.score) !== '' && typeof row.score !== 'boolean' && Number.isFinite(Number(row.score))
    ).map(row => String(row.openingId)));
    if (done.size >= ids.size) return [];
    return [{ season: season.season, year: season.year || CURRENT_EVENT_YEAR, done: done.size, total: ids.size }];
  }).sort((a, b) => Object.keys(LABELS).indexOf(a.season) - Object.keys(LABELS).indexOf(b.season));
}

function closeNotice() {
  if (!dialog) return;
  const current = dialog;
  dialog = null;
  current.close();
  current.remove();
}

function showNotice(rows) {
  closeNotice();
  if (!rows.length) return;
  if (!document.querySelector('#oc-season-entry-style')) {
    const style = document.createElement('style');
    style.id = 'oc-season-entry-style';
    style.textContent = `
      #oc-season-entry-notice{box-sizing:border-box;width:min(540px,calc(100vw - 32px));max-height:85dvh;overflow:auto;padding:26px;border:1px solid #514063;border-radius:20px;background:#15101e;color:#f5f3fa;box-shadow:0 24px 90px #0009;font:15px/1.5 Inter,Arial,sans-serif}
      #oc-season-entry-notice::backdrop{background:rgba(5,3,10,.78)}
      #oc-season-entry-notice h2{margin:0 32px 10px 0;font-size:23px;line-height:1.25}
      #oc-season-entry-notice p{color:#bbb2c7;margin:0 0 18px}
      #oc-season-entry-notice .oc-entry-season{display:grid;gap:8px;padding:16px;margin:12px 0;border:1px solid #3b3048;border-radius:12px;background:#1d1628}
      #oc-season-entry-notice .oc-entry-season span{color:#c5bdcf}
      #oc-season-entry-notice a{display:block;padding:10px 14px;border-radius:9px;background:#08d9d6;color:#071414;text-align:center;text-decoration:none;font-weight:800}
      #oc-season-entry-notice button{cursor:pointer;font:inherit}
      #oc-season-entry-notice .oc-entry-later{width:100%;padding:10px;border:1px solid #59476c;border-radius:9px;background:transparent;color:#e3d9ee}
      #oc-season-entry-notice .oc-entry-close{position:absolute;right:14px;top:10px;border:0;background:transparent;color:#ddd;font-size:28px}
    `;
    document.head.append(style);
  }
  const modal = document.createElement('dialog');
  modal.id = 'oc-season-entry-notice';
  modal.setAttribute('aria-labelledby', 'oc-season-entry-title');
  modal.setAttribute('aria-describedby', 'oc-season-entry-description');
  modal.innerHTML = '<button type="button" class="oc-entry-close" aria-label="Закрыть уведомление">×</button><h2 id="oc-season-entry-title">Тебя пригласили в сезонные оценки</h2><p id="oc-season-entry-description">Остались неоценённые песни. Напомним при следующем заходе, пока ты не оценишь все.</p><div class="oc-entry-seasons"></div><button type="button" class="oc-entry-later">Позже</button>';
  const list = modal.querySelector('.oc-entry-seasons');
  rows.forEach(row => {
    const item = document.createElement('section');
    item.className = 'oc-entry-season';
    const title = document.createElement('strong');
    title.textContent = LABELS[row.season] + ' ' + row.year;
    const progress = document.createElement('span');
    progress.textContent = 'Оценено ' + row.done + ' из ' + row.total + ' · осталось ' + (row.total - row.done);
    const link = document.createElement('a');
    link.href = 'events.html?season=' + encodeURIComponent(row.season);
    link.textContent = row.done ? 'Продолжить оценивание' : 'Начать оценивание';
    link.addEventListener('click', closeNotice);
    item.append(title, progress, link);
    list.append(item);
  });
  modal.querySelectorAll('button').forEach(button => button.addEventListener('click', closeNotice));
  modal.addEventListener('cancel', event => { event.preventDefault(); closeNotice(); });
  document.body.append(modal);
  dialog = modal;
  modal.showModal(); // Native top layer, above page overlays and sticky UI.
}

async function checkAccount(auth, db, user) {
  const ticket = ++generation;
  activeUid = user && !user.isAnonymous ? String(user.uid) : '';
  closeNotice();
  if (!activeUid || visit.checked.includes(activeUid)) return;
  const uid = activeUid;
  try {
    const profileSnapshot = await getDocs(query(collection(db, 'userProfiles'), where('authUid', '==', uid), limit(1)));
    const profileDoc = profileSnapshot.docs[0];
    if (!profileDoc) return;
    const profile = { id: profileDoc.id, ...profileDoc.data() };
    const key = normalize(profile.nicknameKey || profile.nickname || profile.id);
    if (!key) return;
    const [seasonSnapshot, ratingSnapshot] = await Promise.all([
      getDocs(collection(db, 'eventSeasons')),
      getDocs(query(collection(db, 'eventRatings'), where('nicknameKey', '==', key)))
    ]);
    if (ticket !== generation || String(auth.currentUser?.uid || '') !== uid) return;
    const seasons = seasonSnapshot.docs.map(row => ({ id: row.id, ...row.data() }));
    const ratings = ratingSnapshot.docs.map(row => row.data());
    const pending = pendingAssignments(seasons, ratings, profile, uid);
    // Remember only this visit, never acknowledge the invitation permanently.
    visit.checked.push(uid);
    saveVisit();
    showNotice(pending);
  } catch (error) {
    console.warn('Season entry reminder check failed', error);
  }
}

async function start() {
  readVisit();
  for (let attempt = 0; attempt < 600 && !getApps().length; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (!getApps().length) return;
  const app = getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  onAuthStateChanged(auth, user => void checkAccount(auth, db, user));
  // Registration can create the profile after the authentication event.
  window.addEventListener('oped-account-restored', () => {
    if (auth.currentUser && !visit.checked.includes(String(auth.currentUser.uid))) void checkAccount(auth, db, auth.currentUser);
  });
}
void start().catch(error => console.warn('Season entry reminder unavailable', error));
