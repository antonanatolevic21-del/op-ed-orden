import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const CURRENT_EVENT_YEAR = 2026;
const SEASON_LABEL = { winter:'Зима', spring:'Весна', summer:'Лето', fall:'Осень' };
let profilesLoadedAt = 0;
let profilesByKey = new Map();
let enhancing = false;
let enhanceTimer = 0;

function normalizeNickname(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
}

function isAdminUi() {
  return String(document.querySelector('#ev-access-badge')?.textContent || '').trim().toLowerCase() === 'админ';
}

async function waitForApp() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (getApps().length) return getApp();
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return null;
}

async function loadProfiles(force = false) {
  if (!force && profilesByKey.size && Date.now() - profilesLoadedAt < 120000) return profilesByKey;
  const app = await waitForApp();
  if (!app) return profilesByKey;
  const db = getFirestore(app);
  try {
    const snapshot = await getDocs(collection(db, 'userProfiles'));
    profilesByKey = new Map();
    snapshot.docs.forEach(docSnap => {
      const row = { id: docSnap.id, ...docSnap.data() };
      const key = normalizeNickname(row.nicknameKey || row.nickname || docSnap.id);
      if (key) profilesByKey.set(key, row);
    });
    profilesLoadedAt = Date.now();
  } catch (error) {
    console.warn('Admin participant profiles load failed', error);
  }
  return profilesByKey;
}

function activeSeasonInfo() {
  const button = document.querySelector('.ev-season-btn.active[data-season]');
  const season = String(button?.dataset.season || '');
  if (!season) return null;
  return { season, year: CURRENT_EVENT_YEAR, key: `${CURRENT_EVENT_YEAR}_${season}`, label: SEASON_LABEL[season] || season };
}

function progressText(slot) {
  const text = String(slot.querySelector('.ev-participant-progress')?.textContent || '').trim();
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  return match ? { done:Number(match[1]), total:Number(match[2]) } : null;
}

function toolsMarkup(profile, reviewable) {
  const linked = Boolean(profile?.authUid);
  return `<div class="ev-participant-account-tools">
    <span class="ev-participant-account-state ${linked ? 'linked' : ''}">${linked ? 'аккаунт ✓' : 'без аккаунта'}</span>
    <button type="button" data-participant-remind ${linked ? '' : 'disabled'}>Напомнить</button>
    <button type="button" data-participant-replace>Заменить</button>
    <button type="button" data-participant-open-ratings ${reviewable ? '' : 'disabled'}>Оценки</button>
  </div>`;
}

function enhancementSignature(grid) {
  return [...grid.querySelectorAll('.ev-participant-slot')].map(slot => {
    const input = slot.querySelector('.ev-participant-input');
    const key = normalizeNickname(input?.value);
    const profile = profilesByKey.get(key);
    const progress = String(slot.querySelector('.ev-participant-progress')?.textContent || '').trim();
    const reviewable = Boolean(slot.querySelector('[data-participant-review]'));
    return `${key}:${profile?.authUid || ''}:${progress}:${reviewable ? 1 : 0}`;
  }).join('|');
}

function scheduleEnhance(delay = 40) {
  window.clearTimeout(enhanceTimer);
  enhanceTimer = window.setTimeout(() => void enhance(), delay);
}

async function enhance() {
  if (enhancing || !isAdminUi()) return;
  const grid = document.querySelector('.ev-participant-grid');
  if (!grid) return;
  enhancing = true;
  try {
    await loadProfiles();
    const signature = enhancementSignature(grid);
    if (grid.dataset.accountEnhanceSignature === signature) return;

    let linkedCount = 0;
    [...grid.querySelectorAll('.ev-participant-slot')].forEach(slot => {
      const input = slot.querySelector('.ev-participant-input');
      if (!input) return;
      const key = normalizeNickname(input.value);
      const profile = key ? profilesByKey.get(key) : null;
      if (profile?.authUid) linkedCount += 1;
      slot.querySelector('.ev-participant-account-tools')?.remove();
      const review = slot.querySelector('[data-participant-review]');
      slot.insertAdjacentHTML('beforeend', toolsMarkup(profile, Boolean(review)));
      slot.dataset.participantKey = key;
      slot.dataset.participantUid = String(profile?.authUid || '');
    });

    const head = document.querySelector('.ev-participants-head');
    if (head) {
      let summary = head.querySelector('.ev-participant-account-summary');
      if (!summary) {
        summary = document.createElement('div');
        summary.className = 'ev-participant-account-summary';
        head.append(summary);
      }
      summary.textContent = `Аккаунты: ${linkedCount}/15`;
    }
    grid.dataset.accountEnhanceSignature = signature;
  } finally {
    enhancing = false;
  }
}

async function syncBindings() {
  if (!isAdminUi()) return;
  const info = activeSeasonInfo();
  const grid = document.querySelector('.ev-participant-grid');
  if (!info || !grid) return;
  await loadProfiles(true);
  const bindings = [...grid.querySelectorAll('.ev-participant-input')].map((input, index) => {
    const nickname = String(input.value || '').trim();
    const nicknameKey = normalizeNickname(nickname);
    const profile = profilesByKey.get(nicknameKey);
    if (!nickname || !nicknameKey || !profile?.authUid) return null;
    return { slot:index + 1, nickname, nicknameKey, authUid:String(profile.authUid) };
  }).filter(Boolean);

  const app = await waitForApp();
  if (!app) return;
  const db = getFirestore(app);
  try {
    await setDoc(doc(db, 'eventSeasons', info.key), {
      participantBindings: bindings,
      participantBindingsUpdatedAtLocal: new Date().toISOString(),
      participantBindingsUpdatedAt: serverTimestamp()
    }, { merge:true });
    delete grid.dataset.accountEnhanceSignature;
    scheduleEnhance(80);
  } catch (error) {
    console.error('Participant binding save failed', error);
  }
}

async function sendReminder(slot) {
  if (!isAdminUi()) return;
  const input = slot.querySelector('.ev-participant-input');
  const nickname = String(input?.value || '').trim();
  const key = normalizeNickname(nickname);
  const profile = profilesByKey.get(key);
  if (!profile?.authUid) {
    alert('У этого участника нет привязанного зарегистрированного аккаунта.');
    return;
  }
  const info = activeSeasonInfo();
  if (!info) return;
  const progress = progressText(slot);
  const remaining = progress ? Math.max(0, progress.total - progress.done) : null;
  const message = `${info.label} ${info.year}: ${remaining === null ? 'есть незавершённые оценки' : `осталось оценить ${remaining} OP`}.`;
  const app = await waitForApp();
  if (!app) return;
  const db = getFirestore(app);
  const id = `seasonReminder__${info.key}__${key}__${Date.now()}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
  try {
    await setDoc(doc(db, 'eventNotifications', id), {
      eventType:'season-reminder', seasonKey:info.key, season:info.season, seasonLabel:info.label,
      year:info.year, recipientNickname:nickname, recipientKey:key, recipientUid:String(profile.authUid),
      message, acknowledged:false, createdBy:String(getAuth(app).currentUser?.uid || ''),
      createdAtLocal:new Date().toISOString(), createdAt:serverTimestamp()
    });
    const button = slot.querySelector('[data-participant-remind]');
    if (button) { button.textContent = 'Отправлено ✓'; window.setTimeout(() => { if (button.isConnected) button.textContent = 'Напомнить'; }, 1800); }
  } catch (error) {
    console.error('Season reminder failed', error);
    alert('Не удалось отправить напоминание.');
  }
}

document.addEventListener('click', event => {
  const remind = event.target.closest?.('[data-participant-remind]');
  if (remind) {
    event.preventDefault();
    void sendReminder(remind.closest('.ev-participant-slot'));
    return;
  }
  const replace = event.target.closest?.('[data-participant-replace]');
  if (replace) {
    event.preventDefault();
    const input = replace.closest('.ev-participant-slot')?.querySelector('.ev-participant-input');
    input?.focus(); input?.select();
    return;
  }
  const open = event.target.closest?.('[data-participant-open-ratings]');
  if (open) {
    event.preventDefault();
    open.closest('.ev-participant-slot')?.querySelector('[data-participant-review]')?.click();
    return;
  }
  if (event.target.closest?.('#ev-save-participants')) window.setTimeout(() => void syncBindings(), 250);
}, true);

document.addEventListener('input', event => {
  if (!event.target?.matches?.('.ev-participant-input')) return;
  const grid = event.target.closest('.ev-participant-grid');
  if (grid) delete grid.dataset.accountEnhanceSignature;
  scheduleEnhance(80);
}, true);

const observer = new MutationObserver(() => scheduleEnhance());
observer.observe(document.body, { childList:true, subtree:true, characterData:true });
window.setInterval(() => { if (isAdminUi()) scheduleEnhance(0); }, 2500);
