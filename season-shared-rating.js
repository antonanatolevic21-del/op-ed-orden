(() => {
  if (window.__OC_SHARED_SEASON_RATING_READY__) return;
  window.__OC_SHARED_SEASON_RATING_READY__ = true;

  const FIREBASE_VERSION = '12.15.0';
  const ROOM_COLLECTION = 'bestWorstRooms';
  const SUBMISSION_COLLECTION = 'bestWorstSubmissions';
  const SEASON_LABELS = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  const PRESENCE_INTERVAL = 20000;
  const HOST_STALE_AFTER = 90000;
  const PLAYBACK_REFRESH_INTERVAL = 5000;
  const VOLUME_KEY = 'op-ed-shared-volume-v1';
  const state = {
    firebase: null,
    roomId: '',
    room: null,
    submissions: [],
    roomUnsub: null,
    submissionsUnsub: null,
    preloader: null,
    preloaderId: '',
    preconnects: new Set(),
    autoJoinTried: false,
    renderKey: '',
    dynamicKey: '',
    player: null,
    playerKind: '',
    playerTimer: 0,
    playbackWriteBusy: false,
    pendingPlayback: null,
    lastPlaybackPublish: 0,
    presenceTimer: 0,
    presenceBusy: false,
    takeoverBusy: false,
    leaving: false,
    youtubePromise: null
  };

  const clean = value => String(value || '').trim();
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const normalizeName = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, '');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

  function itemTerms(type) {
    return String(type || '').toUpperCase() === 'ED'
      ? { one: 'эндинг', genitive: 'эндинга', plural: 'эндингов' }
      : { one: 'опенинг', genitive: 'опенинга', plural: 'опенингов' };
  }

  function bridgeSnapshot() {
    return window.OC_APP_BRIDGE?.snapshot?.() || window.OC_APP_DATA || { entries: [], currentUser: {} };
  }

  function currentUser() {
    const user = bridgeSnapshot().currentUser || {};
    return { uid: clean(user.uid), name: clean(user.nickname), avatar: clean(user.avatar) };
  }

  function requireUser() {
    const user = currentUser();
    if (!user.uid || !user.name) {
      alert('Для совместного просмотра сначала войди в личный аккаунт.');
      return null;
    }
    return user;
  }

  function ratingConfig() {
    const row = window.OC_APP_BRIDGE?.ratingConfig?.() || {};
    return {
      min: Number.isFinite(Number(row.min)) ? Number(row.min) : 1,
      max: Number.isFinite(Number(row.max)) ? Number(row.max) : 10,
      step: Number.isFinite(Number(row.step)) ? Number(row.step) : 1,
      defaultScore: Number.isFinite(Number(row.defaultScore)) ? Number(row.defaultScore) : 5,
      personal: Boolean(row.personal)
    };
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

  function playerUid(player) {
    return clean(player?.uid || player?.ownerUid);
  }

  function roomPlayers(room = state.room) {
    const seen = new Set();
    return (Array.isArray(room?.players) ? room.players : []).filter(player => {
      const uid = playerUid(player);
      if (!uid || seen.has(uid)) return false;
      seen.add(uid);
      return true;
    });
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

  function youtubeVideoId(url) {
    try {
      const parsed = new URL(clean(url));
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') return clean(parsed.pathname.split('/').filter(Boolean)[0]);
      if (!host.endsWith('youtube.com')) return '';
      const parts = parsed.pathname.split('/').filter(Boolean);
      return clean(parsed.searchParams.get('v') || (['embed', 'shorts'].includes(parts[0]) ? parts[1] : ''));
    } catch (_) {
      return '';
    }
  }

  function embedUrl(url) {
    try {
      const parsed = new URL(clean(url));
      if (!['http:', 'https:'].includes(parsed.protocol) || directVideoType(url)) return '';
      const youtubeId = youtubeVideoId(url);
      if (youtubeId) return `https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?rel=0`;
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
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

  function cleanVideo(video) {
    if (!video) return;
    try { video.pause(); } catch (_) {}
    video.removeAttribute('src');
    video.querySelectorAll?.('source').forEach(source => source.removeAttribute('src'));
    try { video.load(); } catch (_) {}
    video.remove();
  }

  function preloadUpcoming() {
    const room = state.room;
    if (!room || room.status === 'finished') {
      cleanVideo(state.preloader);
      state.preloader = null;
      state.preloaderId = '';
      return;
    }
    const ids = Array.isArray(room.trackIds) ? room.trackIds : [];
    const nextId = String(ids[Number(room.currentIndex || 0) + 1] || '');
    if (state.preloaderId === nextId && state.preloader?.isConnected) return;
    cleanVideo(state.preloader);
    state.preloader = null;
    state.preloaderId = nextId;
    const next = trackById(nextId);
    if (!next?.link) return;
    preconnect(next.link);
    const type = directVideoType(next.link);
    if (!type) return;
    const video = document.createElement('video');
    video.className = 'oc-shared-video-preloader';
    video.preload = 'metadata';
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
      <div class="oc-section-label">совместный просмотр и оценка</div>
      <h2 id="oc-shared-setup-title">${escapeHtml(context.type)} · ${escapeHtml(SEASON_LABELS[context.season])} ${context.year}</h2>
      <p>Ведущий управляет видео и очередью. Громкость и полный экран у каждого свои, а оценка ставится прямо в комнате.</p>
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
    start.addEventListener('change', () => { if (Number(end.value) < Number(start.value)) end.value = start.value; });
    end.addEventListener('change', () => { if (Number(start.value) > Number(end.value)) start.value = end.value; });
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

  function initialPlayback(trackId, api) {
    return {
      trackId: String(trackId || ''),
      playing: false,
      position: 0,
      revision: 0,
      changedAt: api.serverTimestamp(),
      changedAtLocal: Date.now()
    };
  }

  async function createRoom(context, fromIndex, toIndex) {
    const user = requireUser();
    if (!user) return;
    const api = await firebase();
    const code = roomCode();
    const id = roomDocId(code);
    const tracks = context.tracks.slice(fromIndex, toIndex + 1);
    if (!tracks.length) throw new Error(`В выбранном отрезке нет ${itemTerms(context.type).plural}.`);
    const now = Date.now();
    await api.setDoc(api.doc(api.db, ROOM_COLLECTION, id), {
      roomType: 'season-rating', code, hostUid: user.uid, hostName: user.name,
      memberUids: [user.uid],
      players: [{ uid: user.uid, name: user.name, avatar: user.avatar, joinedAt: now }],
      presence: { [user.uid]: now },
      year: context.year, season: context.season, type: context.type,
      trackIds: tracks.map(track => String(track.id)),
      sourceStart: fromIndex + 1, sourceEnd: toIndex + 1,
      currentIndex: 0, round: 0, status: 'rating',
      playback: initialPlayback(tracks[0]?.id, api),
      createdAt: api.serverTimestamp(), updatedAt: api.serverTimestamp(),
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
    await api.runTransaction(api.db, async transaction => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) throw new Error('Комната с таким кодом не найдена.');
      const room = snapshot.data();
      if (room.roomType !== 'season-rating') throw new Error('Этот код принадлежит другой комнате.');
      const players = roomPlayers(room);
      const existingIndex = players.findIndex(player => playerUid(player) === user.uid);
      const joinedAt = Number(players[existingIndex]?.joinedAt || Date.now());
      const nextPlayer = { uid: user.uid, name: user.name, avatar: user.avatar, joinedAt };
      if (existingIndex >= 0) players[existingIndex] = { ...players[existingIndex], ...nextPlayer };
      else players.push(nextPlayer);
      transaction.update(reference, {
        players,
        memberUids: players.map(playerUid),
        updatedAt: api.serverTimestamp(),
        updatedAtLocal: new Date().toISOString()
      });
    });
    await watchRoom(id);
  }

  async function watchRoom(id) {
    const api = await firebase();
    stopRoomSubscriptions();
    state.roomId = id;
    state.leaving = false;
    const reference = api.doc(api.db, ROOM_COLLECTION, id);
    state.roomUnsub = api.onSnapshot(reference, snapshot => {
      if (!snapshot.exists()) {
        closeRoomLocal();
        alert('Комната была закрыта.');
        return;
      }
      state.room = { id: snapshot.id, ...snapshot.data() };
      updateRoomUrl(state.room.code);
      renderRoom();
      applyRemotePlayback();
      preloadUpcoming();
      startPresence();
      void maybeClaimHost();
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

  function stopRoomSubscriptions() {
    state.roomUnsub?.();
    state.submissionsUnsub?.();
    state.roomUnsub = null;
    state.submissionsUnsub = null;
  }

  function destroyPlayer() {
    if (state.playerTimer) window.clearInterval(state.playerTimer);
    state.playerTimer = 0;
    if (state.playerKind === 'youtube') {
      try { state.player?.destroy?.(); } catch (_) {}
    } else if (state.playerKind === 'direct') {
      try { state.player?.pause?.(); } catch (_) {}
    }
    state.player = null;
    state.playerKind = '';
    state.pendingPlayback = null;
  }

  function closeRoomLocal() {
    stopRoomSubscriptions();
    destroyPlayer();
    cleanVideo(state.preloader);
    state.preloader = null;
    state.preloaderId = '';
    if (state.presenceTimer) window.clearInterval(state.presenceTimer);
    state.presenceTimer = 0;
    Object.assign(state, { roomId: '', room: null, submissions: [], renderKey: '', dynamicKey: '', leaving: false });
    document.querySelector('.oc-shared-room')?.remove();
    const url = new URL(location.href);
    url.searchParams.delete('seasonRoom');
    history.replaceState(history.state, '', url);
  }

  async function leaveRoom(options = {}) {
    const room = state.room;
    const user = currentUser();
    if (!room || !user.uid || state.leaving) return closeRoomLocal();
    state.leaving = true;
    try {
      const api = await firebase();
      const reference = api.doc(api.db, ROOM_COLLECTION, room.id);
      await api.runTransaction(api.db, async transaction => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) return;
        const fresh = snapshot.data();
        const players = roomPlayers(fresh).filter(player => playerUid(player) !== user.uid);
        const presence = { ...(fresh.presence || {}) };
        delete presence[user.uid];
        const patch = {
          players,
          memberUids: players.map(playerUid),
          presence,
          updatedAt: api.serverTimestamp(),
          updatedAtLocal: new Date().toISOString()
        };
        if (fresh.hostUid === user.uid) {
          patch.hostUid = playerUid(players[0]) || '';
          patch.hostName = clean(players[0]?.name);
          if (!players.length) patch.status = 'finished';
        }
        transaction.update(reference, patch);
      });
    } catch (error) {
      if (!options.silent) console.error('Shared room leave failed', error);
    } finally {
      closeRoomLocal();
    }
  }

  function timestampMillis(value) {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && Number.isFinite(Number(value.seconds))) return Number(value.seconds) * 1000;
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function touchPresence() {
    const room = state.room;
    const user = currentUser();
    if (!room?.id || !user.uid || state.presenceBusy || state.leaving) return;
    state.presenceBusy = true;
    try {
      const api = await firebase();
      await api.setDoc(api.doc(api.db, ROOM_COLLECTION, room.id), { presence: { [user.uid]: Date.now() } }, { merge: true });
    } catch (error) {
      console.warn('Shared room presence update failed', error);
    } finally {
      state.presenceBusy = false;
    }
  }

  function startPresence() {
    if (state.presenceTimer) return;
    void touchPresence();
    state.presenceTimer = window.setInterval(() => {
      void touchPresence();
      void maybeClaimHost();
    }, PRESENCE_INTERVAL);
  }

  async function maybeClaimHost() {
    const room = state.room;
    const user = currentUser();
    if (!room?.id || !user.uid || room.hostUid === user.uid || state.takeoverBusy || state.leaving) return;
    const lastSeen = Number(room.presence?.[room.hostUid] || timestampMillis(room.updatedAt) || Date.parse(room.updatedAtLocal || '') || 0);
    if (lastSeen && Date.now() - lastSeen < HOST_STALE_AFTER) return;
    const activePlayers = roomPlayers(room).filter(player => {
      const uid = playerUid(player);
      return uid === user.uid || Date.now() - Number(room.presence?.[uid] || 0) < HOST_STALE_AFTER;
    });
    if (playerUid(activePlayers[0]) !== user.uid) return;
    state.takeoverBusy = true;
    try {
      const api = await firebase();
      const reference = api.doc(api.db, ROOM_COLLECTION, room.id);
      await api.runTransaction(api.db, async transaction => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) return;
        const fresh = snapshot.data();
        const freshSeen = Number(fresh.presence?.[fresh.hostUid] || timestampMillis(fresh.updatedAt) || Date.parse(fresh.updatedAtLocal || '') || 0);
        if (freshSeen && Date.now() - freshSeen < HOST_STALE_AFTER) return;
        const candidates = roomPlayers(fresh).filter(player => {
          const uid = playerUid(player);
          return uid === user.uid || Date.now() - Number(fresh.presence?.[uid] || 0) < HOST_STALE_AFTER;
        });
        if (playerUid(candidates[0]) !== user.uid) return;
        transaction.update(reference, {
          hostUid: user.uid,
          hostName: user.name,
          updatedAt: api.serverTimestamp(),
          updatedAtLocal: new Date().toISOString()
        });
      });
    } catch (error) {
      console.warn('Shared room host takeover failed', error);
    } finally {
      state.takeoverBusy = false;
    }
  }

  function currentOpeningId(room = state.room) {
    return room?.trackIds?.[Number(room.currentIndex || 0)] || '';
  }

  function currentSubmission() {
    const user = currentUser();
    const room = state.room;
    const openingId = currentOpeningId(room);
    return state.submissions.find(row => row.ownerUid === user.uid && Number(row.round) === Number(room?.round) && String(row.openingId) === String(openingId));
  }

  function roundSubmissions() {
    const room = state.room;
    const openingId = currentOpeningId(room);
    return state.submissions.filter(row => Number(row.round) === Number(room?.round) && String(row.openingId) === String(openingId));
  }

  function playerControlsMarkup(isHost) {
    return `<div class="oc-shared-player-controls">
      <button type="button" class="oc-shared-control-main" data-player-toggle ${isHost ? '' : 'disabled'}>${isHost ? '▶' : '●'}</button>
      <span class="oc-shared-player-time" data-player-time>0:00 / 0:00</span>
      <input class="oc-shared-player-seek" data-player-seek type="range" min="0" max="1000" value="0" ${isHost ? '' : 'disabled'} aria-label="Позиция видео">
      <label class="oc-shared-volume" title="Громкость на этом устройстве">🔊<input data-player-volume type="range" min="0" max="1" step="0.05" value="1" aria-label="Громкость"></label>
      <button type="button" class="oc-shared-control" data-player-fullscreen title="Полный экран">⛶</button>
      ${isHost ? '' : '<button type="button" class="oc-shared-control oc-shared-enable" data-player-enable>Подключить звук</button>'}
      <span class="oc-shared-player-role">${isHost ? 'ты ведущий' : 'управляет ведущий'}</span>
    </div>`;
  }

  function playerMarkup(entry, isHost) {
    const link = clean(entry?.link);
    if (!link) return `<div class="oc-shared-no-video">У ${itemTerms(entry?.type).genitive} нет ссылки на видео.</div>`;
    preconnect(link);
    const type = directVideoType(link);
    if (type) return `<div class="oc-shared-player-stage" data-player-stage>
      <video class="oc-shared-video" data-shared-direct playsinline preload="auto" ${isHost ? '' : 'muted'} src="${escapeHtml(link)}"></video>
      ${playerControlsMarkup(isHost)}
    </div>`;
    const youtubeId = youtubeVideoId(link);
    if (youtubeId) return `<div class="oc-shared-player-stage" data-player-stage>
      <div class="oc-shared-video" data-shared-youtube="${escapeHtml(youtubeId)}"></div>
      ${playerControlsMarkup(isHost)}
    </div>`;
    const embed = embedUrl(link);
    if (embed) return `<div class="oc-shared-embed-fallback"><iframe class="oc-shared-video" src="${escapeHtml(embed)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Видео ${escapeHtml(entry.title)}"></iframe><p>Для этого источника синхронизация недоступна; ведущий переключает только очередь.</p></div>`;
    return `<a class="oc-addbtn oc-shared-external" href="${escapeHtml(link)}" target="_blank" rel="noopener">Открыть видео ↗</a>`;
  }

  function renderResults(room) {
    const rows = roundSubmissions();
    if (room.status !== 'revealed') return `<div class="oc-shared-waiting">Готовы: ${rows.length} из ${roomPlayers(room).length}</div>`;
    if (!rows.length) return '<div class="oc-shared-waiting">Пока никто не отправил оценку.</div>';
    return `<div class="oc-shared-results">${rows.slice().sort((a, b) => Number(b.score) - Number(a.score))
      .map(row => `<div><span>${escapeHtml(row.playerName)}</span><strong>${escapeHtml(row.score)}</strong></div>`).join('')}</div>`;
  }

  function participantsMarkup(room) {
    const ready = new Set(roundSubmissions().map(row => row.ownerUid));
    const now = Date.now();
    return `<div class="oc-shared-participants">${roomPlayers(room).map(player => {
      const uid = playerUid(player);
      const online = uid === currentUser().uid || now - Number(room.presence?.[uid] || 0) < HOST_STALE_AFTER;
      return `<span class="${ready.has(uid) ? 'is-ready' : ''} ${online ? '' : 'is-away'}">${escapeHtml(player.name || 'Участник')}${uid === room.hostUid ? ' · ведущий' : ''}${ready.has(uid) ? ' ✓' : ''}</span>`;
    }).join('')}</div>`;
  }

  function ratingMarkup(room, entry) {
    const submission = currentSubmission();
    const config = ratingConfig();
    const saved = window.OC_APP_BRIDGE?.userScore?.(entry.id);
    const value = saved === null || saved === undefined ? config.defaultScore : clamp(saved, config.min, config.max);
    if (submission) return `<div class="oc-shared-rating-done">Твоя оценка: <strong>${escapeHtml(submission.score)}</strong> ✓</div>`;
    if (room.status !== 'rating') return '<div class="oc-shared-rating-done">Приём оценок завершён</div>';
    return `<div class="oc-shared-inline-rating">
      <div class="oc-shared-score-row"><input data-room-score-range type="range" min="${config.min}" max="${config.max}" step="${config.step}" value="${value}"><input data-room-score-number type="number" min="${config.min}" max="${config.max}" step="${config.step}" value="${value}" aria-label="Оценка"></div>
      <button type="button" class="oc-addbtn" data-room-save-submit>Сохранить и отправить · <span>${escapeHtml(value)}</span></button>
      <small>${config.personal ? 'Сохранится личная шкала этого профиля.' : 'Дополнительные оценки и комментарий, если они были, сохранятся.'}</small>
    </div>`;
  }

  function roomRenderKey(room) {
    return [room.currentIndex, room.round, room.status, room.hostUid].join('|');
  }

  function roomDynamicKey(room) {
    const players = roomPlayers(room).map(player => {
      const uid = playerUid(player);
      const online = uid === currentUser().uid || Date.now() - Number(room.presence?.[uid] || 0) < HOST_STALE_AFTER;
      return `${uid}:${player.name || ''}:${online ? 1 : 0}`;
    }).join(',');
    const rows = roundSubmissions().map(row => `${row.ownerUid}:${row.score}`).sort().join(',');
    const ownScore = window.OC_APP_BRIDGE?.userScore?.(currentOpeningId(room));
    return [room.hostName, players, rows, ownScore].join('|');
  }

  function updateDynamicRoomUi(root, room) {
    const participants = root.querySelector('.oc-shared-participants');
    if (participants) participants.outerHTML = participantsMarkup(room);
    const playerCount = root.querySelector('[data-shared-player-count]');
    if (playerCount) playerCount.textContent = `${roomPlayers(room).length} участн.`;
    const hostName = root.querySelector('[data-shared-host-name]');
    if (hostName) hostName.textContent = room.hostName || '—';
    const entry = trackById(currentOpeningId(room));
    const action = root.querySelector('[data-shared-rating-action]');
    const draftScore = action?.querySelector('[data-room-score-number]')?.value;
    if (action && entry) {
      action.innerHTML = ratingMarkup(room, entry);
      if (draftScore && !currentSubmission()) {
        const range = action.querySelector('[data-room-score-range]');
        const number = action.querySelector('[data-room-score-number]');
        const label = action.querySelector('[data-room-save-submit] span');
        if (range) range.value = draftScore;
        if (number) number.value = draftScore;
        if (label) label.textContent = draftScore;
      }
    }
    const results = root.querySelector('[data-shared-results]');
    if (results) results.innerHTML = renderResults(room);
    bindRatingActions(root);
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
    const nextKey = roomRenderKey(room);
    const nextDynamicKey = roomDynamicKey(room);
    if (state.renderKey === nextKey && root.firstElementChild) {
      if (state.dynamicKey !== nextDynamicKey) updateDynamicRoomUi(root, room);
      state.dynamicKey = nextDynamicKey;
      updatePlayerUi();
      return;
    }
    state.renderKey = nextKey;
    state.dynamicKey = nextDynamicKey;
    destroyPlayer();
    const user = currentUser();
    const isHost = user.uid === room.hostUid;
    const index = Math.max(0, Number(room.currentIndex || 0));
    const ids = Array.isArray(room.trackIds) ? room.trackIds : [];
    const entry = trackById(ids[index]);
    if (room.status === 'finished' || !entry) {
      root.innerHTML = `<div class="oc-shared-room-card oc-shared-finished">
        <button type="button" class="oc-shared-x" data-room-leave aria-label="Покинуть">×</button>
        <div class="oc-section-label">совместный просмотр завершён</div>
        <h2>${escapeHtml(room.type)} · ${escapeHtml(SEASON_LABELS[room.season])} ${escapeHtml(room.year)}</h2>
        <p>Пройдено ${Math.min(index + (entry ? 0 : 1), ids.length)} из ${ids.length} выбранных ${itemTerms(room.type).plural}.</p>
        <button type="button" class="oc-addbtn" data-room-leave>Вернуться к сезону</button>
      </div>`;
      bindRoomActions(root);
      return;
    }
    root.innerHTML = `<div class="oc-shared-room-card">
      <div class="oc-shared-room-head">
        <div><div class="oc-section-label">комната ${escapeHtml(room.code)} · ведущий <span data-shared-host-name>${escapeHtml(room.hostName || '—')}</span></div>
          <h2>${escapeHtml(room.type)} · ${escapeHtml(SEASON_LABELS[room.season])} ${escapeHtml(room.year)}</h2></div>
        <div class="oc-shared-head-actions"><button type="button" class="oc-secondary-btn" data-room-copy>Скопировать ссылку</button><button type="button" class="oc-shared-x" data-room-leave aria-label="Покинуть комнату">×</button></div>
      </div>
      <div class="oc-shared-progress"><span>${index + 1} из ${ids.length}</span><span>Диапазон: ${room.sourceStart}–${room.sourceEnd}</span><span data-shared-player-count>${roomPlayers(room).length} участн.</span></div>
      ${participantsMarkup(room)}
      <div class="oc-shared-main">
        <div class="oc-shared-media">${playerMarkup(entry, isHost)}</div>
        <div class="oc-shared-rating">
          <div class="oc-shared-track-type">${escapeHtml(entry.type || room.type)}</div>
          <h3>${escapeHtml(entry.title)}</h3>
          <p>${escapeHtml((entry.performers || []).join(', '))}</p>
          <div data-shared-rating-action>${ratingMarkup(room, entry)}</div>
          <div data-shared-results>${renderResults(room)}</div>
        </div>
      </div>
      ${isHost ? `<div class="oc-shared-host-actions">
        <button type="button" class="oc-secondary-btn" data-room-finish>Завершить</button>
        <button type="button" class="oc-secondary-btn" data-room-prev ${index <= 0 ? 'disabled' : ''}>← Назад</button>
        ${room.status === 'revealed'
          ? `<button type="button" class="oc-addbtn" data-room-next>${index + 1 >= ids.length ? 'Завершить' : `Следующий ${itemTerms(room.type).one} →`}</button>`
          : '<button type="button" class="oc-addbtn" data-room-reveal>Показать оценки</button>'}
      </div>` : `<div class="oc-shared-guest-note">Видео и очередь переключает ведущий. Если он выйдет, управление перейдёт следующему участнику.</div>`}
    </div>`;
    bindRoomActions(root);
    setupPlayer(root, entry, isHost);
  }

  function bindRoomActions(root) {
    root.querySelectorAll('[data-room-leave]').forEach(button => button.addEventListener('click', () => void leaveRoom()));
    root.querySelector('[data-room-copy]')?.addEventListener('click', async event => {
      try {
        await navigator.clipboard.writeText(location.href);
        event.currentTarget.textContent = 'Ссылка скопирована ✓';
      } catch (_) {
        prompt('Скопируй ссылку комнаты:', location.href);
      }
    });
    bindRatingActions(root);
    root.querySelector('[data-room-reveal]')?.addEventListener('click', () => void hostPatch({ status: 'revealed' }));
    root.querySelector('[data-room-next]')?.addEventListener('click', () => void moveTrack(1));
    root.querySelector('[data-room-prev]')?.addEventListener('click', () => void moveTrack(-1));
    root.querySelector('[data-room-finish]')?.addEventListener('click', () => {
      if (confirm('Завершить совместный просмотр на этом месте?')) void finishRoom();
    });
  }

  function bindRatingActions(root) {
    const range = root.querySelector('[data-room-score-range]');
    const number = root.querySelector('[data-room-score-number]');
    const save = root.querySelector('[data-room-save-submit]');
    const syncScore = source => {
      if (!range || !number || !save) return;
      const config = ratingConfig();
      const raw = clamp(source.value, config.min, config.max);
      const rounded = Math.round(raw / config.step) * config.step;
      range.value = String(rounded);
      number.value = String(rounded);
      save.querySelector('span').textContent = String(rounded);
    };
    range?.addEventListener('input', () => syncScore(range));
    number?.addEventListener('input', () => syncScore(number));
    save?.addEventListener('click', () => void saveAndSubmitScore(root, number?.value));
  }

  async function saveAndSubmitScore(root, rawScore) {
    const room = state.room;
    const openingId = currentOpeningId(room);
    const button = root.querySelector('[data-room-save-submit]');
    if (!room || !openingId || !button || currentSubmission()) return;
    button.disabled = true;
    button.textContent = 'Сохраняю…';
    try {
      if (typeof window.OC_APP_BRIDGE?.saveTrackScore !== 'function') throw new Error('Форма оценки ещё не готова.');
      const score = await window.OC_APP_BRIDGE.saveTrackScore(openingId, rawScore);
      await submitScore(score);
      button.textContent = `Отправлено · ${score} ✓`;
    } catch (error) {
      console.error(error);
      button.disabled = false;
      button.textContent = error?.message || 'Не удалось сохранить';
    }
  }

  async function submitScore(scoreOverride) {
    const room = state.room;
    const user = requireUser();
    if (!room || !user || currentSubmission() || room.status !== 'rating') return;
    const openingId = currentOpeningId(room);
    const score = scoreOverride ?? window.OC_APP_BRIDGE?.userScore?.(openingId);
    if (!Number.isFinite(Number(score))) throw new Error('Сначала поставь оценку.');
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

  async function moveTrack(delta) {
    const room = state.room;
    if (!room || currentUser().uid !== room.hostUid) return;
    const ids = Array.isArray(room.trackIds) ? room.trackIds : [];
    const nextIndex = Number(room.currentIndex || 0) + delta;
    if (nextIndex >= ids.length) return finishRoom();
    if (nextIndex < 0) return;
    const api = await firebase();
    await hostPatch({
      status: 'rating',
      currentIndex: nextIndex,
      round: Number(room.round || 0) + 1,
      playback: initialPlayback(ids[nextIndex], api)
    });
  }

  async function finishRoom() {
    const api = await firebase();
    await hostPatch({
      status: 'finished',
      playback: { ...initialPlayback(currentOpeningId(), api), revision: Number(state.room?.playback?.revision || 0) + 1 }
    });
  }

  function playbackTarget(room = state.room) {
    const playback = room?.playback || {};
    let position = Math.max(0, Number(playback.position || 0));
    const changedAt = timestampMillis(playback.changedAt) || Number(playback.changedAtLocal || 0);
    if (playback.playing && changedAt) position += Math.max(0, Date.now() - changedAt) / 1000;
    return { playing: Boolean(playback.playing), position, trackId: clean(playback.trackId) };
  }

  function savedVolume() {
    try {
      const value = Number(localStorage.getItem(VOLUME_KEY));
      return Number.isFinite(value) ? clamp(value, 0, 1) : 1;
    } catch (_) {
      return 1;
    }
  }

  function saveVolume(value) {
    try { localStorage.setItem(VOLUME_KEY, String(clamp(value, 0, 1))); } catch (_) {}
  }

  function formatTime(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function directAdapter(video) {
    return {
      play: () => video.play(),
      pause: () => video.pause(),
      isPlaying: () => !video.paused && !video.ended,
      getTime: () => Number(video.currentTime || 0),
      setTime: value => {
        if (!Number.isFinite(Number(value))) return;
        try { video.currentTime = Math.max(0, Number(value)); } catch (_) {}
      },
      getDuration: () => Number(video.duration || 0),
      setVolume: value => { video.volume = clamp(value, 0, 1); video.muted = false; },
      setMuted: value => { video.muted = Boolean(value); },
      element: video
    };
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (state.youtubePromise) return state.youtubePromise;
    state.youtubePromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const timeout = window.setTimeout(() => reject(new Error('YouTube Player API не ответил.')), 15000);
      window.onYouTubeIframeAPIReady = () => {
        try { previous?.(); } catch (_) {}
        window.clearTimeout(timeout);
        resolve(window.YT);
      };
      if (!document.querySelector('script[data-oc-youtube-api]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.dataset.ocYoutubeApi = '1';
        script.onerror = () => { window.clearTimeout(timeout); reject(new Error('Не удалось загрузить YouTube Player API.')); };
        document.head.append(script);
      }
    });
    return state.youtubePromise;
  }

  function youtubeAdapter(player) {
    return {
      play: () => player.playVideo(),
      pause: () => player.pauseVideo(),
      isPlaying: () => player.getPlayerState() === window.YT.PlayerState.PLAYING,
      getTime: () => Number(player.getCurrentTime?.() || 0),
      setTime: value => player.seekTo(Math.max(0, Number(value) || 0), true),
      getDuration: () => Number(player.getDuration?.() || 0),
      setVolume: value => { player.unMute(); player.setVolume(clamp(value, 0, 1) * 100); },
      setMuted: value => value ? player.mute() : player.unMute(),
      element: player.getIframe?.(),
      destroy: () => player.destroy()
    };
  }

  function setupPlayer(root, entry, isHost) {
    const direct = root.querySelector('[data-shared-direct]');
    if (direct) {
      state.playerKind = 'direct';
      state.player = directAdapter(direct);
      bindPlayerControls(root, isHost);
      direct.addEventListener('loadedmetadata', () => applyRemotePlayback(true), { once: true });
      direct.addEventListener('ended', () => { if (isHost) void publishPlayback(false, true); });
      applyRemotePlayback(true);
      return;
    }
    const youtube = root.querySelector('[data-shared-youtube]');
    if (!youtube) return;
    const videoId = youtube.dataset.sharedYoutube;
    void loadYouTubeApi().then(YT => {
      if (!youtube.isConnected || currentOpeningId() !== String(entry.id)) return;
      const player = new YT.Player(youtube, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, origin: location.origin },
        events: {
          onReady: () => {
            if (!root.isConnected) return;
            state.playerKind = 'youtube';
            state.player = youtubeAdapter(player);
            bindPlayerControls(root, isHost);
            applyRemotePlayback(true);
          },
          onStateChange: event => {
            if (isHost && event.data === YT.PlayerState.ENDED) void publishPlayback(false, true);
          }
        }
      });
    }).catch(error => {
      console.error(error);
      const media = root.querySelector('.oc-shared-media');
      if (media) media.insertAdjacentHTML('beforeend', `<div class="oc-shared-player-error">${escapeHtml(error.message)}</div>`);
    });
  }

  function bindPlayerControls(root, isHost) {
    const adapter = state.player;
    if (!adapter) return;
    const toggle = root.querySelector('[data-player-toggle]');
    const seek = root.querySelector('[data-player-seek]');
    const volume = root.querySelector('[data-player-volume]');
    const enable = root.querySelector('[data-player-enable]');
    const fullscreen = root.querySelector('[data-player-fullscreen]');
    const localVolume = savedVolume();
    if (volume) volume.value = String(localVolume);
    if (isHost) adapter.setVolume(localVolume);
    else adapter.setMuted(true);
    toggle?.addEventListener('click', async () => {
      if (!isHost) return;
      try {
        if (adapter.isPlaying()) {
          adapter.pause();
          await publishPlayback(false, true);
        } else {
          await adapter.play();
          await publishPlayback(true, true);
        }
      } catch (error) {
        console.warn('Shared playback toggle failed', error);
      }
      updatePlayerUi();
    });
    seek?.addEventListener('input', () => {
      if (!isHost) return;
      const duration = adapter.getDuration();
      if (duration > 0) adapter.setTime(duration * Number(seek.value) / 1000);
      updatePlayerUi();
    });
    seek?.addEventListener('change', () => { if (isHost) void publishPlayback(adapter.isPlaying(), true); });
    volume?.addEventListener('input', () => {
      const value = clamp(volume.value, 0, 1);
      adapter.setVolume(value);
      saveVolume(value);
      enable?.classList.add('hidden');
    });
    enable?.addEventListener('click', async () => {
      adapter.setVolume(localVolume);
      const remote = playbackTarget();
      try { if (remote.playing) await adapter.play(); } catch (_) {}
      enable.classList.add('hidden');
    });
    fullscreen?.addEventListener('click', () => {
      const stage = root.querySelector('[data-player-stage]');
      if (document.fullscreenElement) void document.exitFullscreen?.();
      else void stage?.requestFullscreen?.();
    });
    state.playerTimer = window.setInterval(() => {
      if (!state.player || !state.room) return;
      if (isHost) {
        if (state.player.isPlaying() && Date.now() - state.lastPlaybackPublish >= PLAYBACK_REFRESH_INTERVAL) void publishPlayback(true, false);
      } else {
        applyRemotePlayback();
      }
      updatePlayerUi();
    }, 500);
    updatePlayerUi();
  }

  function updatePlayerUi() {
    const adapter = state.player;
    const root = document.querySelector('.oc-shared-room');
    if (!adapter || !root) return;
    const time = Math.max(0, adapter.getTime());
    const duration = Math.max(0, adapter.getDuration());
    const label = root.querySelector('[data-player-time]');
    const seek = root.querySelector('[data-player-seek]');
    const toggle = root.querySelector('[data-player-toggle]');
    if (label) label.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
    if (seek && duration > 0 && document.activeElement !== seek) seek.value = String(Math.round(time / duration * 1000));
    if (toggle && currentUser().uid === state.room?.hostUid) toggle.textContent = adapter.isPlaying() ? '❚❚' : '▶';
  }

  function applyRemotePlayback(force = false) {
    const adapter = state.player;
    const room = state.room;
    if (!adapter || !room || room.status === 'finished') return;
    const remote = playbackTarget(room);
    if (remote.trackId && remote.trackId !== String(currentOpeningId(room))) return;
    const isHost = currentUser().uid === room.hostUid;
    if (isHost && !force) return;
    const localTime = adapter.getTime();
    if (force || Math.abs(localTime - remote.position) > 1.25) adapter.setTime(remote.position);
    if (remote.playing && !adapter.isPlaying()) {
      try {
        const result = adapter.play();
        if (result?.catch) result.catch(() => document.querySelector('[data-player-enable]')?.classList.remove('hidden'));
      } catch (_) {
        document.querySelector('[data-player-enable]')?.classList.remove('hidden');
      }
    } else if (!remote.playing && adapter.isPlaying()) {
      adapter.pause();
    }
    updatePlayerUi();
  }

  async function publishPlayback(playing, immediate) {
    const room = state.room;
    const adapter = state.player;
    if (!room || !adapter || currentUser().uid !== room.hostUid) return;
    if (!immediate && Date.now() - state.lastPlaybackPublish < PLAYBACK_REFRESH_INTERVAL) return;
    state.pendingPlayback = {
      trackId: String(currentOpeningId(room)),
      playing: Boolean(playing),
      position: Math.max(0, Number(adapter.getTime() || 0)),
      revision: Number(room.playback?.revision || 0) + 1,
      changedAtLocal: Date.now()
    };
    if (state.playbackWriteBusy) return;
    state.playbackWriteBusy = true;
    try {
      while (state.pendingPlayback) {
        const next = state.pendingPlayback;
        state.pendingPlayback = null;
        const api = await firebase();
        await hostPatch({ playback: { ...next, changedAt: api.serverTimestamp() } });
        state.lastPlaybackPublish = Date.now();
      }
    } catch (error) {
      console.warn('Shared playback update failed', error);
    } finally {
      state.playbackWriteBusy = false;
    }
  }

  function mountButton() {
    const head = document.querySelector('.oc-season-head');
    if (!head || document.querySelector('[data-shared-season-open]')) return;
    let actions = document.querySelector('.oc-season-extra-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'oc-season-extra-actions';
      head.insertAdjacentElement('afterend', actions);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'oc-secondary-btn oc-shared-season-button';
    button.dataset.sharedSeasonOpen = '1';
    button.textContent = 'Совместный просмотр';
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
      closeRoomLocal();
    });
  }

  function init() {
    mountButton();
    new MutationObserver(mountButton).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('oped:app-data-updated', () => {
      if (state.room) renderRoom();
      maybeAutoJoin();
    });
    window.addEventListener('oped:route-ready', maybeAutoJoin);
    window.addEventListener('pageshow', () => {
      if (!state.room) return;
      void touchPresence();
      applyRemotePlayback(true);
    });
    window.setTimeout(maybeAutoJoin, 300);
  }

  window.OC_SHARED_SEASON_RATING = {
    snapshot: () => ({ room: state.room, submissions: state.submissions.slice(), playerKind: state.playerKind }),
    leave: () => leaveRoom(),
    sync: () => applyRemotePlayback(true)
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
