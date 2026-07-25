import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const context = window.OC_EVENT_PARTICIPANT_CONTEXT;
if (!context?.db || !context?.auth || !context?.profile) throw new Error('Participant context is missing.');

const { db, auth, profile } = context;
const CURRENT_EVENT_YEAR = Number(context.currentYear || 2026);
const SEASONS = ['winter', 'spring', 'summer', 'fall'];
const SEASON_LABEL = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
const SCORE_WORDS = { 1:'залупа', 2:'очень слабо', 3:'слабо', 4:'ниже среднего', 5:'средне', 6:'норм', 7:'хорошо', 8:'сильно', 9:'почти пик', 10:'пик' };
const ASSIGNMENT_SEEN_PREFIX = 'oc-event-assignment-seen-v1:';
const DRAFT_PREFIX = 'oc-event-rating-draft-v1:';

const appEl = document.querySelector('#ev-app');
const evaluatorEl = document.querySelector('#ev-evaluator');
const stageTabs = document.querySelector('#ev-stage-tabs');
const accessBadge = document.querySelector('#ev-access-badge');
const nameInput = document.querySelector('#ev-myname');
const roleSwitch = document.querySelector('#ev-role-switch');
const homeLink = document.querySelector('#ev-back-home');

const state = {
  seasons: new Map(),
  openings: new Map(),
  ratings: new Map(),
  reminders: [],
  activeSeason: '',
  queue: [],
  queueIndex: 0,
  destroyed: false,
  unsubscribers: []
};

const nickname = String(profile.nickname || profile.nicknameKey || '').trim();
const nicknameKey = normalizeNickname(profile.nicknameKey || nickname);
const uid = String(auth.currentUser?.uid || profile.authUid || '');

function normalizeNickname(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function bindingRows(row) {
  return Array.isArray(row?.participantBindings) ? row.participantBindings : [];
}

function participantMatch(row) {
  if (!row || row.closed || Number(row.year || CURRENT_EVENT_YEAR) !== CURRENT_EVENT_YEAR) return null;
  const slots = Array.isArray(row.allowedNicknames) ? row.allowedNicknames : [];
  const slotIndex = slots.findIndex(name => normalizeNickname(name) === nicknameKey);
  if (slotIndex < 0 || slotIndex >= 15) return null;
  const binding = bindingRows(row).find(item => normalizeNickname(item?.nicknameKey || item?.nickname) === nicknameKey);
  if (binding?.authUid && String(binding.authUid) !== uid) return null;
  return {
    ...row,
    key: String(row.key || row.id || `${CURRENT_EVENT_YEAR}_${row.season || ''}`),
    season: String(row.season || ''),
    year: Number(row.year || CURRENT_EVENT_YEAR),
    selectedOpeningIds: Array.isArray(row.selectedOpeningIds) ? row.selectedOpeningIds.map(String) : [],
    slot: slotIndex + 1,
    participantName: String(slots[slotIndex] || nickname),
    accountLinked: Boolean(binding?.authUid ? String(binding.authUid) === uid : uid)
  };
}

function assignmentSeenKey() {
  return `${ASSIGNMENT_SEEN_PREFIX}${uid}`;
}

function readSeenAssignments() {
  try {
    const raw = JSON.parse(localStorage.getItem(assignmentSeenKey()) || '[]');
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch (_) {
    return new Set();
  }
}

function markAssignmentSeen(seasonKey) {
  const seen = readSeenAssignments();
  seen.add(String(seasonKey || ''));
  try { localStorage.setItem(assignmentSeenKey(), JSON.stringify([...seen])); } catch (_) {}
  syncRatingTabNotice();
}

function unseenAssignments() {
  const seen = readSeenAssignments();
  return accessibleSeasons().filter(row => !seen.has(String(row.key)));
}

function draftKey(seasonKey, openingId) {
  return `${DRAFT_PREFIX}${uid}:${seasonKey}:${openingId}`;
}

function readDraft(seasonKey, openingId) {
  try { return JSON.parse(localStorage.getItem(draftKey(seasonKey, openingId)) || 'null'); } catch (_) { return null; }
}

function saveDraft(seasonKey, openingId, score, comment) {
  try {
    localStorage.setItem(draftKey(seasonKey, openingId), JSON.stringify({ score, comment, updatedAt: Date.now() }));
  } catch (_) {}
  renderDraftMarker(seasonKey, openingId);
}

function clearDraft(seasonKey, openingId) {
  try { localStorage.removeItem(draftKey(seasonKey, openingId)); } catch (_) {}
  renderDraftMarker(seasonKey, openingId);
}

function accessibleSeasons() {
  return [...state.seasons.values()].sort((a, b) => SEASONS.indexOf(a.season) - SEASONS.indexOf(b.season));
}

function ratingKey(seasonKey, openingId) {
  return `${seasonKey}__${openingId}`;
}

function ratingFor(seasonKey, openingId) {
  return state.ratings.get(ratingKey(seasonKey, openingId)) || null;
}

function progressFor(season) {
  const ids = season.selectedOpeningIds.filter(id => state.openings.has(String(id)));
  const done = ids.filter(id => Number.isFinite(Number(ratingFor(season.key, id)?.score))).length;
  const firstMissing = ids.findIndex(id => !Number.isFinite(Number(ratingFor(season.key, id)?.score)));
  return { done, total: ids.length, complete: ids.length > 0 && done >= ids.length, firstMissing };
}

function activeSeason() {
  return state.seasons.get(state.activeSeason) || accessibleSeasons()[0] || null;
}

async function ensureOpening(id) {
  const key = String(id || '');
  if (!key || state.openings.has(key)) return state.openings.get(key) || null;
  try {
    const snapshot = await getDoc(doc(db, 'openings', key));
    if (!snapshot.exists()) return null;
    const row = { id: snapshot.id, ...snapshot.data() };
    state.openings.set(key, row);
    return row;
  } catch (error) {
    console.warn('Participant opening load failed', key, error);
    return null;
  }
}

async function ensureSeasonOpenings(seasons = accessibleSeasons()) {
  const ids = [...new Set(seasons.flatMap(row => row.selectedOpeningIds || []))];
  await Promise.all(ids.map(ensureOpening));
}

function syncHeader() {
  if (stageTabs) stageTabs.style.display = 'none';
  if (accessBadge) {
    accessBadge.textContent = 'участник · аккаунт';
    accessBadge.style.color = 'var(--green)';
  }
  if (nameInput) {
    nameInput.value = nickname;
    nameInput.disabled = true;
    nameInput.title = 'Ник подтверждён зарегистрированным аккаунтом';
  }
  roleSwitch?.classList.add('hidden');
  if (homeLink) homeLink.style.display = 'inline-flex';
  document.querySelectorAll('.ev-mode-tab').forEach(button => button.classList.toggle('active', button.dataset.mode === 'rating'));
  syncRatingTabNotice();
}

function syncRatingTabNotice() {
  const button = document.querySelector('.ev-mode-tab[data-mode="rating"]');
  if (!button) return;
  button.classList.toggle('ev-participant-has-notice', unseenAssignments().length > 0 || state.reminders.length > 0);
}

function renderNotices() {
  const assignments = unseenAssignments();
  const rows = [];
  assignments.forEach(season => {
    rows.push(`<div class="ev-participant-notice new"><div><strong>Тебя добавили в сезон</strong><span>${esc(SEASON_LABEL[season.season] || season.season)} ${season.year} · ${season.selectedOpeningIds.length} OP · аккаунт привязан ✓</span></div><button type="button" data-participant-start-season="${esc(season.key)}">Начать оценку</button></div>`);
  });
  state.reminders.forEach(reminder => {
    const label = reminder.seasonLabel || SEASON_LABEL[reminder.season] || reminder.season || 'сезон';
    rows.push(`<div class="ev-participant-notice reminder"><div><strong>Напоминание от администратора</strong><span>${esc(reminder.message || `${label} ${reminder.year || CURRENT_EVENT_YEAR}: остались неоценённые OP.`)}</span></div><button type="button" data-participant-ack-reminder="${esc(reminder.id)}">Понятно</button></div>`);
  });
  return rows.length ? `<div class="ev-participant-notices">${rows.join('')}</div>` : '';
}

function renderSeasonButton(season) {
  const progress = progressFor(season);
  const active = state.activeSeason === season.key;
  return `<button type="button" class="ev-participant-season-btn ${active ? 'active' : ''}" data-participant-season="${esc(season.key)}"><span>${esc(SEASON_LABEL[season.season] || season.season)} ${season.year}</span><small>${progress.done}/${progress.total || '—'}${progress.complete ? ' ✓' : ''} · строка ${season.slot}</small></button>`;
}

function openingTitle(opening) {
  return String(opening?.title || opening?.anime || 'Без названия');
}

function openingImage(opening) {
  const src = String(opening?.fallbackImage || opening?.image || '').trim();
  return src ? `<img class="oc-track-image" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span>OP</span>';
}

function renderOpeningRow(season, openingId, index) {
  const opening = state.openings.get(String(openingId));
  if (!opening) return '';
  const rating = ratingFor(season.key, openingId);
  const draft = readDraft(season.key, openingId);
  const meta = [opening.year, SEASON_LABEL[opening.season], ...(Array.isArray(opening.performers) ? opening.performers.slice(0, 2) : [])].filter(Boolean).join(' · ');
  return `<article class="ev-participant-opening" data-participant-opening="${esc(openingId)}">
    <div class="ev-participant-opening-rank">${index + 1}</div>
    <div class="ev-participant-opening-thumb">${openingImage(opening)}</div>
    <div class="ev-participant-opening-copy"><strong>${esc(openingTitle(opening))}</strong><span>${esc(meta || 'метаданные не заполнены')}</span><small data-participant-draft-marker="${esc(season.key)}:${esc(openingId)}">${draft?.comment ? 'черновик сохранён' : ''}</small></div>
    <div class="ev-participant-opening-state ${rating ? 'done' : ''}">${rating ? '✓' : ''}</div>
    <button type="button" class="ev-btn-secondary" data-participant-rate="${esc(openingId)}">${rating ? 'Изменить' : 'Оценить'}</button>
  </article>`;
}

function renderDraftMarker(seasonKey, openingId) {
  const marker = document.querySelector(`[data-participant-draft-marker="${CSS.escape(`${seasonKey}:${openingId}`)}"]`);
  if (marker) marker.textContent = readDraft(seasonKey, openingId)?.comment ? 'черновик сохранён' : '';
}

function render() {
  if (state.destroyed || !appEl) return;
  syncHeader();
  const seasons = accessibleSeasons();
  if (!seasons.length) {
    appEl.innerHTML = '<div class="ev-empty">Сейчас нет открытых сезонов, где твой зарегистрированный ник указан участником.</div>';
    return;
  }
  if (!state.activeSeason || !state.seasons.has(state.activeSeason)) state.activeSeason = seasons[0].key;
  const season = activeSeason();
  const progress = progressFor(season);
  const firstMissingPlace = progress.firstMissing >= 0 ? progress.firstMissing + 1 : 1;
  const actionText = progress.complete ? 'Изменить оценки' : progress.done ? `Продолжить с №${firstMissingPlace}` : 'Начать оценку';
  appEl.innerHTML = `
    ${renderNotices()}
    <section class="ev-participant-head">
      <div><div class="ev-section-label">зарегистрированный участник</div><h2>${esc(nickname)}</h2><p>Доступ определяется по нику аккаунта, а не по номеру гостевого слота. Один аккаунт может оценивать все открытые сезоны, где он указан участником.</p></div>
      <span class="ev-participant-linked">аккаунт привязан ✓</span>
    </section>
    <div class="ev-participant-season-tabs">${seasons.map(renderSeasonButton).join('')}</div>
    <section class="ev-participant-season-panel">
      <div class="ev-participant-season-head">
        <div><div class="ev-section-label">${esc(SEASON_LABEL[season.season] || season.season)} ${season.year}</div><h2>${progress.done}/${progress.total || 0} оценено</h2><p>${progress.complete ? 'Сезон полностью оценён ✓' : `Осталось ${Math.max(0, progress.total - progress.done)} OP.`}</p></div>
        <div class="ev-participant-season-actions"><button type="button" class="ev-btn-main" data-participant-continue>${esc(actionText)}</button><button type="button" class="ev-btn-secondary" data-participant-show-all>Посмотреть все</button></div>
      </div>
      <div class="ev-participant-progress"><span style="width:${progress.total ? Math.round(progress.done / progress.total * 100) : 0}%"></span></div>
      <div class="ev-participant-opening-list">${season.selectedOpeningIds.map((id, index) => renderOpeningRow(season, id, index)).join('') || '<div class="ev-empty">В сезоне пока нет OP.</div>'}</div>
    </section>`;
  bindRenderedUi();
}

function queueForSeason(season, missingOnly = true, startingId = '') {
  let ids = season.selectedOpeningIds.filter(id => state.openings.has(String(id)));
  if (missingOnly) ids = ids.filter(id => !ratingFor(season.key, id));
  if (!ids.length) ids = season.selectedOpeningIds.filter(id => state.openings.has(String(id)));
  let index = startingId ? ids.indexOf(String(startingId)) : 0;
  if (index < 0) index = 0;
  state.queue = ids;
  state.queueIndex = index;
  markAssignmentSeen(season.key);
  renderEvaluator(season);
}

function renderEvaluator(season) {
  const openingId = state.queue[state.queueIndex];
  const opening = state.openings.get(String(openingId));
  if (!opening || !evaluatorEl) {
    evaluatorEl?.classList.add('hidden');
    return;
  }
  const saved = ratingFor(season.key, openingId);
  const draft = readDraft(season.key, openingId);
  const score = Math.max(1, Math.min(10, Math.round(Number(draft?.score ?? saved?.score ?? 5) || 5)));
  const comment = String(draft?.comment ?? saved?.comment ?? '');
  const restored = Boolean(draft && (String(draft.comment || '').trim() || Number(draft.score) !== Number(saved?.score || 5)));
  evaluatorEl.innerHTML = `<div class="ev-dialog ev-participant-evaluator">
    <div class="ev-dialog-top"><div><div class="ev-progress">${esc(SEASON_LABEL[season.season])} ${season.year} · ${state.queueIndex + 1}/${state.queue.length}</div><div class="ev-modal-title">${esc(openingTitle(opening))}</div><div class="oc-meta">${restored ? 'Черновик восстановлен с этого устройства.' : 'Комментарий обязателен.'}</div></div><button type="button" class="ev-close" data-participant-eval-close>Закрыть</button></div>
    <div class="ev-participant-eval-media">${openingImage(opening)}</div>
    <div class="ev-eval-grid"><label class="ev-field">Оценка<input data-participant-score-range type="range" min="1" max="10" step="1" value="${score}"><div class="ev-score-word">Сейчас: <strong data-participant-score-word>${score} · ${esc(SCORE_WORDS[score] || '')}</strong></div></label><label class="ev-field">Число<input data-participant-score-number type="number" min="1" max="10" step="1" value="${score}"></label></div>
    <label class="ev-field" style="margin-bottom:12px;">Комментарий <span style="color:var(--gold);text-transform:none;letter-spacing:0;">обязателен</span><textarea data-participant-comment placeholder="Напиши хотя бы короткий комментарий…">${esc(comment)}</textarea></label>
    <div class="ev-error" data-participant-eval-error></div>
    <div class="ev-modal-actions"><button type="button" class="ev-btn-ghost" data-participant-prev ${state.queueIndex <= 0 ? 'disabled' : ''}>← Назад</button><button type="button" class="ev-btn-secondary" data-participant-save>Сохранить</button><button type="button" class="ev-btn-main" data-participant-save-next>Сохранить и дальше →</button></div>
  </div>`;
  evaluatorEl.classList.remove('hidden');

  const range = evaluatorEl.querySelector('[data-participant-score-range]');
  const number = evaluatorEl.querySelector('[data-participant-score-number]');
  const word = evaluatorEl.querySelector('[data-participant-score-word]');
  const commentInput = evaluatorEl.querySelector('[data-participant-comment]');
  const sync = value => {
    const next = Math.max(1, Math.min(10, Math.round(Number(value) || 1)));
    range.value = String(next); number.value = String(next); word.textContent = `${next} · ${SCORE_WORDS[next] || ''}`;
    saveDraft(season.key, openingId, next, commentInput.value);
  };
  range.addEventListener('input', () => sync(range.value));
  number.addEventListener('input', () => sync(number.value));
  commentInput.addEventListener('input', () => saveDraft(season.key, openingId, Number(number.value), commentInput.value));
  evaluatorEl.querySelector('[data-participant-eval-close]').addEventListener('click', () => { evaluatorEl.classList.add('hidden'); render(); });
  evaluatorEl.querySelector('[data-participant-prev]')?.addEventListener('click', () => { if (state.queueIndex > 0) { state.queueIndex -= 1; renderEvaluator(season); } });
  evaluatorEl.querySelector('[data-participant-save]').addEventListener('click', () => void saveRating(season, false));
  evaluatorEl.querySelector('[data-participant-save-next]').addEventListener('click', () => void saveRating(season, true));
}

async function maybeNotifyCompletion(season, wasComplete) {
  if (wasComplete || !progressFor(season).complete) return;
  const id = `seasonComplete__${season.key}__${nicknameKey}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
  try {
    await setDoc(doc(db, 'eventNotifications', id), {
      eventType: 'season-complete', seasonKey: season.key, season: season.season,
      seasonLabel: SEASON_LABEL[season.season] || season.season, year: season.year,
      nickname, nicknameKey, ownerUid: uid, ratingCount: progressFor(season).done,
      totalRatings: progressFor(season).total, acknowledged: false,
      createdAtLocal: new Date().toISOString(), createdAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('Participant completion notice failed', error);
  }
}

async function saveRating(season, goNext) {
  const openingId = state.queue[state.queueIndex];
  const opening = state.openings.get(String(openingId));
  const errorEl = evaluatorEl.querySelector('[data-participant-eval-error]');
  const number = evaluatorEl.querySelector('[data-participant-score-number]');
  const commentInput = evaluatorEl.querySelector('[data-participant-comment]');
  const comment = String(commentInput?.value || '').trim();
  const score = Math.max(1, Math.min(10, Math.round(Number(number?.value || 1))));
  if (!opening || !comment) {
    if (errorEl) errorEl.textContent = 'Комментарий обязателен. Хотя бы пару слов.';
    return;
  }
  const wasComplete = progressFor(season).complete;
  const row = {
    stage: 'first', seasonKey: season.key, year: season.year, season: season.season,
    openingId: String(openingId), openingTitle: openingTitle(opening), nickname, nicknameKey,
    ownerUid: uid, createdByRole: 'account', adminCreated: false, score, comment,
    updatedAtLocal: new Date().toISOString()
  };
  const saveButton = evaluatorEl.querySelector('[data-participant-save-next]');
  if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Сохраняю…'; }
  try {
    await setDoc(doc(db, 'eventRatings', `${season.key}__${nicknameKey}__${openingId}`), { ...row, updatedAt: serverTimestamp() }, { merge: true });
    state.ratings.set(ratingKey(season.key, openingId), row);
    clearDraft(season.key, openingId);
    await maybeNotifyCompletion(season, wasComplete);
    if (goNext && state.queueIndex < state.queue.length - 1) {
      state.queueIndex += 1;
      renderEvaluator(season);
    } else if (goNext) {
      evaluatorEl.classList.add('hidden');
      render();
    } else if (errorEl) {
      errorEl.textContent = 'Сохранено ✓';
      errorEl.style.color = 'var(--green)';
      render();
    }
  } catch (error) {
    console.error('Participant rating save failed', error);
    if (errorEl) errorEl.textContent = 'Не удалось сохранить оценку.';
  } finally {
    if (saveButton?.isConnected) { saveButton.disabled = false; saveButton.textContent = 'Сохранить и дальше →'; }
  }
}

async function acknowledgeReminder(id) {
  const reminder = state.reminders.find(row => row.id === id);
  state.reminders = state.reminders.filter(row => row.id !== id);
  render();
  try {
    await setDoc(doc(db, 'eventNotifications', id), {
      acknowledged: true, acknowledgedBy: nickname, acknowledgedByKey: nicknameKey,
      acknowledgedByUid: uid, acknowledgedAtLocal: new Date().toISOString(), acknowledgedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('Reminder acknowledge failed', error);
    try { localStorage.setItem(`oc-event-reminder-seen:${uid}:${id}`, '1'); } catch (_) {}
  }
}

function bindRenderedUi() {
  appEl.querySelectorAll('[data-participant-season]').forEach(button => button.addEventListener('click', () => {
    state.activeSeason = button.dataset.participantSeason;
    render();
  }));
  appEl.querySelectorAll('[data-participant-start-season]').forEach(button => button.addEventListener('click', () => {
    state.activeSeason = button.dataset.participantStartSeason;
    const season = activeSeason();
    if (season) queueForSeason(season, true);
  }));
  appEl.querySelectorAll('[data-participant-ack-reminder]').forEach(button => button.addEventListener('click', () => void acknowledgeReminder(button.dataset.participantAckReminder)));
  appEl.querySelector('[data-participant-continue]')?.addEventListener('click', () => { const season = activeSeason(); if (season) queueForSeason(season, !progressFor(season).complete); });
  appEl.querySelector('[data-participant-show-all]')?.addEventListener('click', () => appEl.querySelector('.ev-participant-opening-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  appEl.querySelectorAll('[data-participant-rate]').forEach(button => button.addEventListener('click', () => { const season = activeSeason(); if (season) queueForSeason(season, false, button.dataset.participantRate); }));
}

function bindModeSwitch() {
  document.querySelectorAll('.ev-mode-tab').forEach(button => {
    if (button.dataset.mode === 'rating') {
      button.addEventListener('click', event => { event.preventDefault(); render(); });
      return;
    }
    button.addEventListener('click', event => {
      event.preventDefault();
      window.OC_EVENTS_OPEN_FULL_MODE?.(button.dataset.mode);
    });
  });
}

function seasonRequestedFromUrl() {
  const value = new URLSearchParams(location.search).get('season');
  return SEASONS.includes(value) ? value : '';
}

async function applySeasonSnapshot(snapshot) {
  const matches = snapshot.docs.map(docSnap => participantMatch({ id: docSnap.id, ...docSnap.data() })).filter(Boolean);
  state.seasons = new Map(matches.map(row => [row.key, row]));
  const requested = seasonRequestedFromUrl();
  if (requested) {
    const row = matches.find(item => item.season === requested);
    if (row) state.activeSeason = row.key;
  }
  if (!state.activeSeason || !state.seasons.has(state.activeSeason)) state.activeSeason = matches[0]?.key || '';
  await ensureSeasonOpenings(matches);
  render();
}

function subscribe() {
  state.unsubscribers.push(onSnapshot(collection(db, 'eventSeasons'), snapshot => { void applySeasonSnapshot(snapshot); }, error => {
    console.error('Participant season subscription failed', error);
    appEl.innerHTML = '<div class="ev-empty">Не удалось загрузить сезоны.</div>';
  }));

  state.unsubscribers.push(onSnapshot(query(collection(db, 'eventRatings'), where('nicknameKey', '==', nicknameKey)), snapshot => {
    state.ratings.clear();
    snapshot.docs.forEach(docSnap => {
      const row = { id: docSnap.id, ...docSnap.data() };
      state.ratings.set(ratingKey(String(row.seasonKey || ''), String(row.openingId || '')), row);
    });
    render();
  }, error => console.warn('Participant rating subscription failed', error)));

  state.unsubscribers.push(onSnapshot(query(collection(db, 'eventNotifications'), where('recipientUid', '==', uid)), snapshot => {
    state.reminders = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .filter(row => row.eventType === 'season-reminder' && !row.acknowledged && localStorage.getItem(`oc-event-reminder-seen:${uid}:${row.id}`) !== '1');
    render();
  }, error => console.warn('Participant reminder subscription failed', error)));
}

function destroy() {
  state.destroyed = true;
  state.unsubscribers.splice(0).forEach(unsubscribe => { try { unsubscribe(); } catch (_) {} });
  if (stageTabs) stageTabs.style.display = '';
  evaluatorEl?.classList.add('hidden');
}

window.OC_EVENT_PARTICIPANT_SUITE = { destroy, render };
syncHeader();
bindModeSwitch();
subscribe();
