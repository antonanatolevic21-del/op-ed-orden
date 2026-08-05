(() => {
  if (window.__OC_SHARED_SEASON_RATING_READY__) return;
  window.__OC_SHARED_SEASON_RATING_READY__ = true;

  const FIREBASE_VERSION = '12.15.0';
  // Reuse the already deployed event-room storage and access rules. Rooms are not
  // added to the Best/Worst registry, so the two interfaces never list each other.
  const ROOM_COLLECTION = 'bestWorstRooms';
  const SUBMISSION_COLLECTION = 'bestWorstSubmissions';
  const SEASON_LABELS = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  const state = {
    firebase: null,
    roomId: '',
    room: null,
    submissions: [],
    roomUnsub: null,
    submissionsUnsub: null,
    preloader: null,
    preconnects: new Set(),
    autoJoinTried: false
  };

  const clean = value => String(value || '').trim();
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const normalizeName = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, '');

  function bridgeSnapshot() {
    return window.OC_APP_BRIDGE?.snapshot?.() || window.OC_APP_DATA || { entries: [], currentUser: {} };
  }

  function currentUser() {
    const user = bridgeSnapshot().currentUser || {};
    return {
      uid: clean(user.uid),
      name: clean(user.nickname),
      avatar: clean(user.avatar)
    };
  }

  function requireUser() {
    const user = currentUser();
    if (!user.uid || !user.name) {
      alert('Для совместной оценки сначала войди в личный аккаунт.');
      return null;
    }
    return user;
  }

  function selectedSeasonTracks() {
    const active = document.querySelector('[data-season-select].active');
    const type = document.querySelector('[data-season-type].active')?.dataset.seasonType || 'OP';
    const ids = [...document.querySelectorAll('#oc-season-list [data-op-rate]')]
      .map(button => clean(button.getAttribute('data-op-rate')))
      .filter(Boolean);
    const entriesById = new Map((bridgeSnapshot().entries || []).map(entry => [String(entry.id), entry]));
    return {
      year: Number(active?.dataset.year || 0),
      season: clean(active?.dataset.season),
      type,
      tracks: ids.map(id => entriesById.get(id)).filter(Boolean)
    };
  }

  async function firebase() {
    if (state.firebase) return state.firebase;
    const [appApi, authApi, firestore] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]);
    for (let attempt = 0; attempt < 120 && !appApi.getApps().length; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!appApi.getApps().length) throw new Error('Firebase ещё не готов.');
    const app = appApi.getApp();
    const auth = authApi.getAuth(app);
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    if (!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('Нужен зарегистрированный аккаунт.');
    state.firebase = { db: firestore.getFirestore(app), auth, ...firestore };
    return state.firebase;
  }

  function roomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return [...bytes].map(value => alphabet[value % alphabet.length]).join('');
  }

  function roomDocId(code) {
    return `season-${clean(code).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`;
  }

  function trackById(id) {
    return (bridgeSnapshot().entries || []).find(entry => String(entry.id) === String(id)) || null;
  }

  function directVideoType(url) {
    try {
      const parsed = new URL(clean(url));
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      const value = `${parsed.pathname}${parsed.search}`.toLowerCase();
      if (value.includes('.webm')) return 'video/webm';
      if (value.includes('.mp4')) return 'video/mp4';
      if (value.includes('.ogg') || value.includes('.ogv')) return 'video/ogg';
    } catch (_) {}
    return '';
  }

  function embedUrl(url) {
    try {
      const parsed = new URL(clean(url));
      if (!['http:', 'https:'].includes(parsed.protocol) || directVideoType(url)) return '';
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') {
        const id = parsed.pathname.split('/').filter(Boolean)[0];
        return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0` : '';
      }
      if (host.endsWith('youtube.com')) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const id = parsed.searchParams.get('v') || (['embed', 'shorts'].includes(parts[0]) ? parts[1] : '');
        return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0` : '';
      }
      if (host.endsWith('vimeo.com')) {
        const id = parsed.pathname.split('/').filter(Boolean).find(part => /^\d+$/.test(part));
        return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : '';
      }
      if (host.endsWith('rutube.ru')) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const index = parts.indexOf('video');
        return index >= 0 && parts[index + 1] ? `https://rutube.ru/play/embed/${encodeURIComponent(parts[index + 1])}` : '';
      }
    } catch (_) {}
    return '';
  }

  function preconnect(url) {
    try {
      const origin = new URL(clean(url)).origin;
      if (state.preconnects.has(origin)) return;
      state.preconnects.add(origin);
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.append(link);
    } catch (_) {}
  }

  function preloadUpcoming() {
    state.preloader?.remove();
    state.preloader = null;
    const room = state.room;
    if (!room || room.status === 'finished') return;
    const ids = Array.isArray(room.trackIds) ? room.trackIds : [];
    const next = trackById(ids[Number(room.currentIndex || 0) + 1]);
    if (!next?.link) return;
    preconnect(next.link);
    const type = directVideoType(next.link);
    if (!type) return;
    const video = document.createElement('video');
    video.className = 'oc-shared-video-preloader';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = next.link;
    video.setAttribute('aria-hidden', 'true');
    document.body.append(video);
    video.load();
    state.preloader = video;
  }

  function setupDialog() {
    const context = selectedSeasonTracks();
    const user = requireUser();
    if (!user) return;
    if (!context.year || !context.season || !context.tracks.length) {
      const code = prompt('Сезон не выбран. Введи код комнаты или сначала выбери сезон, чтобы создать свою:');
      if (code) void joinRoom(code).catch(error => alert(error?.message || 'Не удалось войти в комнату.'));
      return;
    }
    document.querySelector('.oc-shared-setup')?.remove();
    const firstUnrated = context.tracks.findIndex(track => window.OC_APP_BRIDGE?.userScore?.(track.id) == null);
    const defaultStart = firstUnrated >= 0 ? firstUnrated : 0;
    const options = context.tracks.map((track, index) => `<option value="${index}">${index + 1}. ${escapeHtml(track.title)}</option>`).join('');
    const modal = document.createElement('div');
    modal.className = 'oc-shared-setup';
    modal.innerHTML = `<div class="oc-shared-setup-card" role="dialog" aria-modal="true" aria-labelledby="oc-shared-setup-title">
      <button type="button" class="oc-shared-x" data-shared-close aria-label="Закрыть">×</button>
      <div class="oc-section-label">совместная оценка сезона</div>
      <h2 id="oc-shared-setup-title">${escapeHtml(context.type)} · ${escapeHtml(SEASON_LABELS[context.season])} ${context.year}</h2>
      <p>Выбери отрезок. По умолчанию начинаем с первого трека без твоей оценки; завершить комнату можно и раньше.</p>
      <div class="oc-shared-range">
        <label>Начать с<select data-shared-start>${options}</select></label>
        <label>Закончить на<select data-shared-end>${options}</select></label>
      </div>
      <div class="oc-shared-setup-actions">
        <button type="button" class="oc-secondary-btn" data-shared-join>Войти по коду</button>
        <button type="button" class="oc-addbtn" data-shared-create>Создать комнату</button>
      </div>
      <div class="oc-shared-error" aria-live="polite"></div>
    </div>`;
    document.body.append(modal);
    const start = modal.querySelector('[data-shared-start]');
    const end = modal.querySelector('[data-shared-end]');
    start.value = String(defaultStart);
    end.value = String(context.tracks.length - 1);
    start.addEventListener('change', () => {
      if (Number(end.value) < Number(start.value)) end.value = start.value;
    });
    end.addEventListener('change', () => {
      if (Number(start.value) > Number(end.value)) start.value = end.value;
    });
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-shared-close]')) modal.remove();
    });
    modal.querySelector('[data-shared-join]').addEventListener('click', () => {
      const code = prompt('Код комнаты:');
      if (code) void joinRoom(code).then(() => modal.remove()).catch(error => showSetupError(modal, error));
    });
    modal.querySelector('[data-shared-create]').addEventListener('click', () => {
      void createRoom(context, Number(start.value), Number(end.value))
        .then(() => modal.remove())
        .catch(error => showSetupError(modal, error));
    });
  }

  function showSetupError(modal, error) {
    console.error(error);
    const box = modal.querySelector('.oc-shared-error');
    if (box) box.textContent = error?.message || 'Не удалось открыть комнату.';
  }

  async function createRoom(context, fromIndex, toIndex) {
    const user = requireUser();
    if (!user) return;
    const api = await firebase();
    const code = roomCode();
    const id = roomDocId(code);
    const tracks = context.tracks.slice(fromIndex, toIndex + 1);
    if (!tracks.length) throw new Error('В выбранном отрезке нет треков.');
    await api.setDoc(api.doc(api.db, ROOM_COLLECTION, id), {
      roomType: 'season-rating',
      code,
      hostUid: user.uid,
      hostName: user.name,
      memberUids: [user.uid],
      players: [{ uid: user.uid, name: user.name, avatar: user.avatar }],
      year: context.year,
      season: context.season,
      type: context.type,
      trackIds: tracks.map(track => String(track.id)),
      sourceStart: fromIndex + 1,
      sourceEnd: toIndex + 1,
      currentIndex: 0,
      round: 0,
      status: 'rating',
      createdAt: api.serverTimestamp(),
      updatedAt: api.serverTimestamp(),
      updatedAtLocal: new Date().toISOString()
    });
    await watchRoom(id);
  }

  async function joinRoom(code) {
    const user = requireUser();
    if (!user) return;
    const api = await firebase();
    const id = roomDocId(code);
    const reference = api.doc(api.db, ROOM_COLLECTION, id);
    const snapshot = await api.getDoc(reference);
    if (!snapshot.exists()) throw new Error('Комната с таким кодом не найдена.');
    await api.updateDoc(reference, {
      memberUids: api.arrayUnion(user.uid),
      players: api.arrayUnion({ uid: user.uid, name: user.name, avatar: user.avatar }),
      updatedAt: api.serverTimestamp(),
      updatedAtLocal: new Date().toISOString()
    });
    await watchRoom(id);
  }

  async function watchRoom(id) {
    const api = await firebase();
    state.roomUnsub?.();
    state.submissionsUnsub?.();
    state.roomId = id;
    const reference = api.doc(api.db, ROOM_COLLECTION, id);
    state.roomUnsub = api.onSnapshot(reference, snapshot => {
      if (!snapshot.exists()) {
        closeRoom();
        alert('Комната была закрыта.');
        return;
      }
      state.room = { id: snapshot.id, ...snapshot.data() };
      updateRoomUrl(state.room.code);
      renderRoom();
      preloadUpcoming();
    }, error => { console.error(error); alert('Связь с комнатой прервана.'); });
    const submissionsQuery = api.query(api.collection(api.db, SUBMISSION_COLLECTION), api.where('gameId', '==', id));
    state.submissionsUnsub = api.onSnapshot(submissionsQuery, snapshot => {
      state.submissions = snapshot.docs.map(row => ({ id: row.id, ...row.data() }));
      renderRoom();
    });
  }

  function updateRoomUrl(code) {
    const url = new URL(location.href);
    url.searchParams.set('view', 'season');
    url.searchParams.set('seasonRoom', code);
    history.replaceState(history.state, '', url);
  }

  function closeRoom() {
    state.roomUnsub?.();
    state.submissionsUnsub?.();
    state.preloader?.remove();
    Object.assign(state, { roomId: '', room: null, submissions: [], roomUnsub: null, submissionsUnsub: null, preloader: null });
    document.querySelector('.oc-shared-room')?.remove();
    const url = new URL(location.href);
    url.searchParams.delete('seasonRoom');
    history.replaceState(history.state, '', url);
  }

  function currentSubmission() {
    const user = currentUser();
    const room = state.room;
    const openingId = room?.trackIds?.[Number(room.currentIndex || 0)];
    return state.submissions.find(row => row.ownerUid === user.uid && Number(row.round) === Number(room?.round) && String(row.openingId) === String(openingId));
  }

  function roundSubmissions() {
    const room = state.room;
    const openingId = room?.trackIds?.[Number(room.currentIndex || 0)];
    return state.submissions.filter(row => Number(row.round) === Number(room?.round) && String(row.openingId) === String(openingId));
  }

  function playerMarkup(entry) {
    const link = clean(entry?.link);
    if (!link) return `<div class="oc-shared-no-video">У трека нет ссылки на видео.</div>`;
    preconnect(link);
    const type = directVideoType(link);
    if (type) return `<video class="oc-shared-video" controls playsinline preload="auto"><source src="${escapeHtml(link)}" type="${type}"></video>`;
    const embed = embedUrl(link);
    if (embed) return `<iframe class="oc-shared-video" src="${escapeHtml(embed)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Видео ${escapeHtml(entry.title)}"></iframe>`;
    return `<a class="oc-addbtn oc-shared-external" href="${escapeHtml(link)}" target="_blank" rel="noopener">Открыть видео ↗</a>`;
  }

  function renderResults(room) {
    const rows = roundSubmissions();
    if (room.status !== 'revealed') return `<div class="oc-shared-waiting">Готовы: ${rows.length} из ${(room.players || []).length}</div>`;
    if (!rows.length) return '<div class="oc-shared-waiting">Пока никто не отправил оценку.</div>';
    return `<div class="oc-shared-results">${rows
      .slice()
      .sort((a, b) => Number(b.score) - Number(a.score))
      .map(row => `<div><span>${escapeHtml(row.playerName)}</span><strong>${escapeHtml(row.score)}</strong></div>`)
      .join('')}</div>`;
  }

  function renderRoom() {
    const room = state.room;
    if (!room) return;
    let root = document.querySelector('.oc-shared-room');
    if (!root) {
      root = document.createElement('div');
      root.className = 'oc-shared-room';
      document.body.append(root);
    }
    const user = currentUser();
    const isHost = user.uid === room.hostUid;
    const index = Math.max(0, Number(room.currentIndex || 0));
    const ids = Array.isArray(room.trackIds) ? room.trackIds : [];
    const entry = trackById(ids[index]);
    if (room.status === 'finished' || !entry) {
      root.innerHTML = `<div class="oc-shared-room-card oc-shared-finished">
        <button type="button" class="oc-shared-x" data-room-close aria-label="Закрыть">×</button>
        <div class="oc-section-label">совместная оценка завершена</div>
        <h2>${escapeHtml(room.type)} · ${escapeHtml(SEASON_LABELS[room.season])} ${escapeHtml(room.year)}</h2>
        <p>Пройдено ${Math.min(index + (entry ? 0 : 1), ids.length)} из ${ids.length} выбранных треков.</p>
        <button type="button" class="oc-addbtn" data-room-close>Вернуться к сезону</button>
      </div>`;
      bindRoomActions(root);
      return;
    }
    const submission = currentSubmission();
    const score = window.OC_APP_BRIDGE?.userScore?.(entry.id);
    const canSubmit = score !== null && score !== undefined;
    const ratingOpen = room.status === 'rating';
    const players = room.players || [];
    root.innerHTML = `<div class="oc-shared-room-card">
      <div class="oc-shared-room-head">
        <div><div class="oc-section-label">комната ${escapeHtml(room.code)} · хост ${escapeHtml(room.hostName)}</div>
          <h2>${escapeHtml(room.type)} · ${escapeHtml(SEASON_LABELS[room.season])} ${escapeHtml(room.year)}</h2></div>
        <div class="oc-shared-head-actions"><button type="button" class="oc-secondary-btn" data-room-copy>Скопировать ссылку</button><button type="button" class="oc-shared-x" data-room-close aria-label="Свернуть">×</button></div>
      </div>
      <div class="oc-shared-progress"><span>${index + 1} из ${ids.length}</span><span>Исходный диапазон: ${room.sourceStart}–${room.sourceEnd}</span><span>Участников: ${players.length}</span></div>
      <div class="oc-shared-main">
        <div class="oc-shared-media">${playerMarkup(entry)}</div>
        <div class="oc-shared-rating">
          <div class="oc-shared-track-type">${escapeHtml(entry.type || room.type)}</div>
          <h3>${escapeHtml(entry.title)}</h3>
          <p>${escapeHtml((entry.performers || []).join(', '))}</p>
          ${submission
            ? `<button type="button" class="oc-secondary-btn active" disabled>Отправлено: ${escapeHtml(submission.score)} ✓</button>`
            : !ratingOpen
              ? '<button type="button" class="oc-secondary-btn" disabled>Приём оценок завершён</button>'
              : canSubmit
                ? `<button type="button" class="oc-addbtn" data-room-submit>Отправить оценку · ${escapeHtml(score)}</button>
                  <button type="button" class="oc-secondary-btn" data-room-rate>Изменить оценку</button>`
                : '<button type="button" class="oc-addbtn" data-room-rate>Поставить оценку</button>'}
          <div class="oc-shared-note">Следующее видео уже загружается в фоне. Комментарии в комнате не показываются.</div>
          ${renderResults(room)}
        </div>
      </div>
      ${isHost ? `<div class="oc-shared-host-actions">
        <button type="button" class="oc-secondary-btn" data-room-finish>Завершить сейчас</button>
        ${room.status === 'revealed'
          ? `<button type="button" class="oc-addbtn" data-room-next>${index + 1 >= ids.length ? 'Завершить' : 'Следующий трек →'}</button>`
          : '<button type="button" class="oc-addbtn" data-room-reveal>Показать оценки</button>'}
      </div>` : '<div class="oc-shared-guest-note">Следующий трек переключает хост.</div>'}
    </div>`;
    bindRoomActions(root);
  }

  function bindRoomActions(root) {
    root.querySelectorAll('[data-room-close]').forEach(button => button.addEventListener('click', closeRoom));
    root.querySelector('[data-room-copy]')?.addEventListener('click', async event => {
      await navigator.clipboard.writeText(location.href);
      event.currentTarget.textContent = 'Ссылка скопирована ✓';
    });
    root.querySelectorAll('[data-room-rate]').forEach(button => button.addEventListener('click', () => {
      const room = state.room;
      const id = room?.trackIds?.[Number(room.currentIndex || 0)];
      if (!id) return;
      root.classList.add('oc-shared-room-paused');
      window.OC_APP_BRIDGE?.rateTrack?.(id);
      window.setTimeout(() => {
        const evaluator = document.querySelector('#oc-season-evaluator');
        if (evaluator?.classList.contains('hidden')) root.classList.remove('oc-shared-room-paused');
      }, 100);
    }));
    root.querySelector('[data-room-submit]')?.addEventListener('click', () => void submitScore());
    root.querySelector('[data-room-reveal]')?.addEventListener('click', () => void hostPatch({ status: 'revealed' }));
    root.querySelector('[data-room-next]')?.addEventListener('click', () => void nextTrack());
    root.querySelector('[data-room-finish]')?.addEventListener('click', () => {
      if (confirm('Завершить совместную оценку на этом месте?')) void hostPatch({ status: 'finished' });
    });
  }

  async function submitScore() {
    const room = state.room;
    const user = requireUser();
    if (!room || !user || currentSubmission()) return;
    const openingId = room.trackIds[Number(room.currentIndex || 0)];
    const score = window.OC_APP_BRIDGE?.userScore?.(openingId);
    if (score === null || score === undefined) return;
    const api = await firebase();
    const id = `${room.id}_${room.round}_${user.uid}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 220);
    await api.setDoc(api.doc(api.db, SUBMISSION_COLLECTION, id), {
      gameId: room.id,
      roundIndex: Number(room.round || 0),
      guesserKey: normalizeName(user.name).slice(0, 60) || user.uid.slice(0, 60),
      guesserName: user.name.slice(0, 80),
      answers: { openingId: String(openingId), score: Number(score) },
      roomId: room.id,
      openingId: String(openingId),
      round: Number(room.round || 0),
      ownerUid: user.uid,
      playerName: user.name,
      score: Number(score),
      submittedAt: api.serverTimestamp(),
      submittedAtLocal: new Date().toISOString()
    });
  }

  async function hostPatch(patch) {
    const room = state.room;
    if (!room || currentUser().uid !== room.hostUid) return;
    const api = await firebase();
    await api.updateDoc(api.doc(api.db, ROOM_COLLECTION, room.id), {
      ...patch,
      updatedAt: api.serverTimestamp(),
      updatedAtLocal: new Date().toISOString()
    });
  }

  async function nextTrack() {
    const room = state.room;
    if (!room) return;
    const nextIndex = Number(room.currentIndex || 0) + 1;
    if (nextIndex >= room.trackIds.length) {
      await hostPatch({ status: 'finished', currentIndex: room.trackIds.length });
      return;
    }
    await hostPatch({ status: 'rating', currentIndex: nextIndex, round: Number(room.round || 0) + 1 });
  }

  function mountButton() {
    const actions = document.querySelector('.oc-season-head-actions');
    if (!actions || actions.querySelector('[data-shared-season-open]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'oc-secondary-btn oc-shared-season-button';
    button.dataset.sharedSeasonOpen = '1';
    button.textContent = 'Совместная оценка';
    button.addEventListener('click', setupDialog);
    actions.append(button);
  }

  function maybeAutoJoin() {
    if (state.autoJoinTried) return;
    const code = new URL(location.href).searchParams.get('seasonRoom');
    if (!code) return;
    state.autoJoinTried = true;
    void joinRoom(code).catch(error => {
      console.error(error);
      alert(error?.message || 'Не удалось войти в комнату.');
      closeRoom();
    });
  }

  function init() {
    mountButton();
    new MutationObserver(mountButton).observe(document.body, { childList: true, subtree: true });
    const evaluator = document.querySelector('#oc-season-evaluator');
    if (evaluator) {
      new MutationObserver(() => {
        if (!state.room || !evaluator.classList.contains('hidden')) return;
        document.querySelector('.oc-shared-room')?.classList.remove('oc-shared-room-paused');
        renderRoom();
      }).observe(evaluator, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
    }
    window.addEventListener('oped:app-data-updated', () => {
      if (state.room) renderRoom();
      maybeAutoJoin();
    });
    window.addEventListener('oped:route-ready', maybeAutoJoin);
    window.setTimeout(maybeAutoJoin, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
