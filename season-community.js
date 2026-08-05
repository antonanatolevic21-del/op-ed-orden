(() => {
  if (window.__OC_SEASON_COMMUNITY_READY__) return;
  window.__OC_SEASON_COMMUNITY_READY__ = true;

  const FIREBASE_VERSION = '12.15.0';
  const PERSONAL_COLLECTION = 'eventRatings';
  const ROOM_COLLECTION = 'bestWorstRooms';
  const VOTE_COLLECTION = 'bestWorstSubmissions';
  const SEASON_LABEL = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  const AWARDS = [
    { id: 'overall', title: '', note: 'По общему среднему баллу' },
    { id: 'song', title: 'Лучшая песня', note: 'По отдельным оценкам песни' },
    { id: 'visual', title: 'Лучший визуал', note: 'По отдельным оценкам визуала' },
    { id: 'controversial', title: 'Самый спорный', note: 'Наибольший разброс оценок' },
    { id: 'hidden', title: 'Скрытая жемчужина', note: 'Высокий балл при небольшом числе оценок' }
  ];
  const state = {
    firebase: null,
    tab: 'awards',
    personalRows: [],
    personalUnsub: null,
    room: null,
    roomUnsub: null,
    votes: [],
    votesUnsub: null,
    tournamentIndexes: [],
    tournamentIndexesUnsub: null,
    tournamentListMode: 'active',
    creatorSelectedIds: new Set(),
    autoJoinTried: false
  };

  const clean = value => String(value || '').trim();
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const safePart = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  const natural = new Intl.Collator(['ru', 'en'], { numeric: true, sensitivity: 'base' });

  function itemTerms(type) {
    return String(type || '').toUpperCase() === 'ED'
      ? { one: 'эндинг', capital: 'Эндинг', genitive: 'эндинга', plural: 'эндингов', instrumental: 'эндингами' }
      : { one: 'опенинг', capital: 'Опенинг', genitive: 'опенинга', plural: 'опенингов', instrumental: 'опенингами' };
  }

  function snapshot() {
    return window.OC_APP_BRIDGE?.snapshot?.() || window.OC_APP_DATA || { entries: [], currentUser: {} };
  }

  function currentUser() {
    const row = snapshot().currentUser || {};
    return { uid: clean(row.uid), name: clean(row.nickname), avatar: clean(row.avatar) };
  }

  function requireUser() {
    const user = currentUser();
    if (!user.uid || !user.name) {
      alert('Для сезонных активностей сначала войди в личный аккаунт.');
      return null;
    }
    return user;
  }

  function selectedContext() {
    const selected = document.querySelector('[data-season-select].active');
    const type = document.querySelector('[data-season-type].active')?.dataset.seasonType || 'OP';
    const ids = [...document.querySelectorAll('#oc-season-list [data-op-rate]')]
      .map(button => clean(button.getAttribute('data-op-rate')))
      .filter(Boolean);
    const map = new Map((snapshot().entries || []).map(entry => [String(entry.id), entry]));
    const year = Number(selected?.dataset.year || 0);
    const season = clean(selected?.dataset.season);
    return {
      year,
      season,
      type,
      key: year && season ? `${type}-${year}-${season}` : '',
      tracks: ids.map(id => map.get(id)).filter(Boolean)
    };
  }

  function contextFromRoom(room) {
    const map = new Map((snapshot().entries || []).map(entry => [String(entry.id), entry]));
    return {
      year: Number(room?.year || 0),
      season: clean(room?.season),
      type: clean(room?.type || 'OP'),
      key: room?.year && room?.season ? `${room.type}-${room.year}-${room.season}` : '',
      sourceKind: clean(room?.sourceKind || 'season'),
      sourceLabel: clean(room?.sourceLabel),
      tracks: (room?.originalTrackIds || []).map(id => map.get(String(id))).filter(Boolean)
    };
  }

  function trackById(id) {
    return (snapshot().entries || []).find(entry => String(entry.id) === String(id)) || null;
  }

  async function firebase() {
    if (state.firebase) return state.firebase;
    const [appApi, authApi, firestore] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]);
    for (let attempt = 0; attempt < 120 && !appApi.getApps().length; attempt += 1) await new Promise(resolve => setTimeout(resolve, 50));
    if (!appApi.getApps().length) throw new Error('Firebase ещё не готов.');
    const app = appApi.getApp();
    const auth = authApi.getAuth(app);
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    if (!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('Нужен зарегистрированный аккаунт.');
    state.firebase = { db: firestore.getFirestore(app), auth, ...firestore };
    return state.firebase;
  }

  function values(map) {
    return Object.values(map || {}).map(Number).filter(Number.isFinite);
  }

  function average(map) {
    const rows = values(map);
    return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
  }

  function deviation(map) {
    const rows = values(map);
    if (rows.length < 3) return null;
    const mean = rows.reduce((sum, value) => sum + value, 0) / rows.length;
    return Math.sqrt(rows.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / rows.length);
  }

  function formatScore(value) {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(1).replace('.0', '') : '—';
  }

  function nominees(context, category) {
    const tracks = context.tracks.slice();
    const byMetric = (metric, count = track => values(track.scores).length, minimum = 1) => tracks
      .map(track => ({ track, metric: metric(track), votes: count(track) }))
      .filter(row => Number.isFinite(row.metric) && row.votes >= minimum)
      .sort((a, b) => b.metric - a.metric || natural.compare(a.track.title, b.track.title))
      .slice(0, 5);
    if (category === 'song') return byMetric(track => average(track.songScores), track => values(track.songScores).length);
    if (category === 'visual') return byMetric(track => average(track.visualScores), track => values(track.visualScores).length);
    if (category === 'controversial') return byMetric(track => deviation(track.scores), track => values(track.scores).length, 3);
    if (category === 'hidden') {
      const counts = tracks.map(track => values(track.scores).length).filter(count => count > 0).sort((a, b) => a - b);
      const threshold = counts.length ? counts[Math.max(0, Math.floor((counts.length - 1) / 2))] : 0;
      return tracks
        .map(track => ({ track, metric: average(track.scores), votes: values(track.scores).length }))
        .filter(row => Number.isFinite(row.metric) && row.votes > 0 && row.votes <= threshold)
        .sort((a, b) => b.metric - a.metric || a.votes - b.votes || natural.compare(a.track.title, b.track.title))
        .slice(0, 5);
    }
    return byMetric(track => average(track.scores));
  }

  function root() {
    return document.querySelector('.oc-season-community');
  }

  function openHub(tab = state.tab) {
    const user = requireUser();
    if (!user) return;
    const context = state.room ? contextFromRoom(state.room) : selectedContext();
    if (!state.room && (!context.key || !context.tracks.length)) {
      alert(`Сначала выбери сезон с ${itemTerms(context.type).instrumental}.`);
      return;
    }
    state.tab = tab;
    if (!root()) {
      const modal = document.createElement('div');
      modal.className = 'oc-season-community';
      document.body.append(modal);
    }
    renderHub();
    if (context.key) void watchPersonalRows(context.key);
  }

  function closeHub() {
    if (state.room) leaveTournament(false);
    root()?.remove();
    if (!state.room) {
      state.personalUnsub?.();
      state.personalUnsub = null;
    }
  }

  function renderHub() {
    const modal = root();
    if (!modal) return;
    const context = state.room ? contextFromRoom(state.room) : selectedContext();
    modal.innerHTML = `<div class="oc-community-card">
      <div class="oc-community-head">
        <div><div class="oc-section-label">сезонный центр</div><h2>${escapeHtml(context.type)} · ${escapeHtml(SEASON_LABEL[context.season])} ${escapeHtml(context.year)}</h2></div>
        <button type="button" class="oc-community-x" data-community-close aria-label="Закрыть">×</button>
      </div>
      <div class="oc-community-tabs">
        <button type="button" data-community-tab="awards" class="${state.tab === 'awards' ? 'active' : ''}">Награды</button>
        <button type="button" data-community-tab="prediction" class="${state.tab === 'prediction' ? 'active' : ''}">Прогноз</button>
        <button type="button" data-community-tab="tournament" class="${state.tab === 'tournament' ? 'active' : ''}">Турниры</button>
      </div>
      <div class="oc-community-content">${state.tab === 'prediction' ? predictionMarkup(context) : state.tab === 'tournament' ? tournamentMarkup(context) : awardsMarkup(context)}</div>
    </div>`;
    bindHub(modal, context);
  }

  function awardRows(context) {
    return state.personalRows.filter(row => row.kind === 'season-award' && row.seasonKey === context.key);
  }

  function awardsMarkup(context) {
    const rows = awardRows(context);
    const user = currentUser();
    const terms = itemTerms(context.type);
    return `<div class="oc-community-intro"><h3>Сезонные награды</h3><p>Номинанты рассчитаны автоматически. Повторное нажатие снимает голос, выбор другого варианта переносит его.</p></div>
      <div class="oc-award-grid">${AWARDS.map(category => {
        const choices = nominees(context, category.id);
        const mine = rows.find(row => row.category === category.id && row.ownerUid === user.uid)?.openingId || '';
        const counts = new Map();
        rows.filter(row => row.category === category.id).forEach(row => counts.set(String(row.openingId), (counts.get(String(row.openingId)) || 0) + 1));
        const title = category.id === 'overall' ? `Лучший ${terms.one}` : category.title;
        return `<section class="oc-award-card"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(category.note)}</p>
          ${choices.length ? `<div class="oc-award-options">${choices.map(choice => {
            const id = String(choice.track.id);
            return `<button type="button" data-award-category="${category.id}" data-award-track="${escapeHtml(id)}" class="${mine === id ? 'active' : ''}">
              <span>${escapeHtml(choice.track.title)}</span><small>${category.id === 'controversial' ? `σ ${formatScore(choice.metric)}` : `${formatScore(choice.metric)} · ${choice.votes} оц.`}</small><b>${counts.get(id) || 0}</b>
            </button>`;
          }).join('')}</div>` : '<div class="oc-community-empty">Пока недостаточно оценок для номинации.</div>'}
        </section>`;
      }).join('')}</div>`;
  }

  async function voteAward(context, category, openingId) {
    const user = requireUser();
    if (!user) return;
    const api = await firebase();
    const id = `community-award-${safePart(context.key)}-${safePart(category)}-${user.uid}`;
    const previous = awardRows(context).find(row => row.category === category && row.ownerUid === user.uid);
    if (String(previous?.openingId || '') === String(openingId)) {
      await api.deleteDoc(api.doc(api.db, PERSONAL_COLLECTION, id));
      return;
    }
    await api.setDoc(api.doc(api.db, PERSONAL_COLLECTION, id), {
      ownerUid: user.uid,
      nickname: user.name,
      kind: 'season-award',
      seasonKey: context.key,
      year: context.year,
      season: context.season,
      type: context.type,
      category,
      openingId: String(openingId),
      updatedAt: api.serverTimestamp(),
      updatedAtLocal: new Date().toISOString()
    });
  }

  function predictionRow(context) {
    const user = currentUser();
    return state.personalRows.find(row => row.kind === 'season-prediction' && row.seasonKey === context.key && row.ownerUid === user.uid) || null;
  }

  function actualPersonalTop(context) {
    return context.tracks
      .map(track => ({ track, score: window.OC_APP_BRIDGE?.userScore?.(track.id) }))
      .filter(row => row.score !== null && row.score !== undefined && Number.isFinite(Number(row.score)))
      .sort((a, b) => Number(b.score) - Number(a.score) || natural.compare(a.track.title, b.track.title));
  }

  function predictionAccuracy(predicted, actual) {
    const top = actual.slice(0, predicted.length).map(row => String(row.track.id));
    let points = 0;
    predicted.forEach((id, index) => {
      const actualIndex = top.indexOf(String(id));
      if (actualIndex === index) points += 5;
      else if (actualIndex >= 0 && Math.abs(actualIndex - index) === 1) points += 3;
      else if (actualIndex >= 0) points += 1;
    });
    return { points, maximum: predicted.length * 5 };
  }

  function predictionMarkup(context) {
    const saved = predictionRow(context);
    const count = Math.min(5, context.tracks.length);
    const actual = actualPersonalTop(context);
    const terms = itemTerms(context.type);
    const options = context.tracks.map(track => `<option value="${escapeHtml(track.id)}">${escapeHtml(track.title)}</option>`).join('');
    if (!saved) {
      return `<div class="oc-community-intro"><h3>Прогноз личного топа</h3><p>Расставь будущий топ-${count}. После сохранения прогноз фиксируется и сравнивается с твоими реальными оценками.</p></div>
        <div class="oc-prediction-editor">${Array.from({ length: count }, (_, index) => `<label><b>${index + 1}</b><select data-prediction-position="${index}"><option value="">Выбрать ${terms.one}</option>${options}</select></label>`).join('')}</div>
        <button type="button" class="oc-addbtn oc-prediction-save" data-prediction-save>Зафиксировать прогноз</button>
        <div class="oc-community-error" aria-live="polite"></div>`;
    }
    const ids = (saved.trackIds || []).map(String);
    const scored = actual.length;
    const complete = scored === context.tracks.length;
    const accuracy = predictionAccuracy(ids, actual);
    return `<div class="oc-community-intro"><h3>Прогноз зафиксирован</h3><p>${complete ? `Сезон оценён полностью: точность ${accuracy.points} из ${accuracy.maximum}.` : `Оценено ${scored} из ${context.tracks.length}. Итоговая точность появится после оценки всего сезона.`}</p></div>
      <div class="oc-prediction-compare"><section><h4>Прогноз</h4>${ids.map((id, index) => `<div><b>${index + 1}</b><span>${escapeHtml(trackById(id)?.title || `${terms.capital} удалён`)}</span></div>`).join('')}</section>
      <section><h4>Фактический топ</h4>${actual.slice(0, ids.length).map((row, index) => `<div><b>${index + 1}</b><span>${escapeHtml(row.track.title)}</span><small>${formatScore(row.score)}</small></div>`).join('') || '<div class="oc-community-empty">Оценок пока нет.</div>'}</section></div>
      ${complete ? `<div class="oc-prediction-score"><strong>${accuracy.points}/${accuracy.maximum}</strong><span>5 очков за точное место, 3 — за соседнее, 1 — за попадание в топ.</span></div>` : ''}`;
  }

  async function savePrediction(context, modal) {
    const user = requireUser();
    if (!user) return;
    const ids = [...modal.querySelectorAll('[data-prediction-position]')].map(select => clean(select.value));
    const error = modal.querySelector('.oc-community-error');
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
      if (error) error.textContent = `Каждое место нужно заполнить разными ${itemTerms(context.type).instrumental}.`;
      return;
    }
    if (!confirm('Зафиксировать прогноз? После сохранения изменить его нельзя.')) return;
    const api = await firebase();
    const id = `community-prediction-${safePart(context.key)}-${user.uid}`;
    await api.setDoc(api.doc(api.db, PERSONAL_COLLECTION, id), {
      ownerUid: user.uid,
      nickname: user.name,
      kind: 'season-prediction',
      seasonKey: context.key,
      year: context.year,
      season: context.season,
      type: context.type,
      trackIds: ids,
      locked: true,
      createdAt: api.serverTimestamp(),
      createdAtLocal: new Date().toISOString()
    });
  }

  function roomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return [...bytes].map(value => alphabet[value % alphabet.length]).join('');
  }

  function roomId(code) {
    return `tournament-${clean(code).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`;
  }

  function tournamentVotes(room = state.room) {
    return state.votes.filter(row => Number(row.matchSerial) === Number(room?.matchSerial));
  }

  function tournamentMarkup(context) {
    if (state.room) return activeTournamentMarkup(state.room);
    const availableCounts = [8, 16, 32, 64, 128].filter(count => context.tracks.length >= count);
    const terms = itemTerms(context.type);
    if (!availableCounts.length) return `<div class="oc-community-empty">Для турнира в сезоне нужно хотя бы 8 ${terms.plural}.</div>`;
    return `<div class="oc-community-intro"><h3>Пользовательский турнир</h3><p>Выбери размер сетки от 8 до 128 ${terms.plural}. Участники голосуют по одной паре, хост закрывает матч и ведёт сетку дальше.</p></div>
      <div class="oc-tournament-create-row"><label>Название<input data-tournament-title maxlength="80" value="Турнир · ${escapeHtml(context.type)} ${escapeHtml(SEASON_LABEL[context.season])} ${context.year}"></label>
      <label>Размер<select data-tournament-size>${availableCounts.map(count => `<option value="${count}">${count} ${terms.plural}</option>`).join('')}</select></label>
      <button type="button" class="oc-secondary-btn" data-tournament-autofill>Выбрать первые</button></div>
      <div class="oc-tournament-counter">Выбрано: <b data-tournament-count>0</b></div>
      <div class="oc-tournament-picker">${context.tracks.map(track => `<label><input type="checkbox" data-tournament-track value="${escapeHtml(track.id)}"><span>${escapeHtml(track.title)}</span></label>`).join('')}</div>
      <div class="oc-community-actions"><button type="button" class="oc-secondary-btn" data-tournament-join>Войти по коду</button><button type="button" class="oc-addbtn" data-tournament-create>Создать турнир</button></div>
      <div class="oc-community-error" aria-live="polite"></div>`;
  }

  function activeTournamentMarkup(room) {
    const user = currentUser();
    const isHost = user.uid === room.hostUid;
    if (room.status === 'finished') {
      const champion = trackById(room.championId);
      return `<div class="oc-tournament-finished"><div class="oc-section-label">победитель турнира</div><h3>${escapeHtml(room.title)}</h3>${trackCard(champion, 'champion')}<button type="button" class="oc-secondary-btn" data-tournament-leave>Закрыть турнир</button></div>`;
    }
    const pair = room.currentPair || [];
    const first = trackById(pair[0]);
    const second = trackById(pair[1]);
    const votes = tournamentVotes(room);
    const mine = votes.find(row => row.ownerUid === user.uid)?.choice || '';
    const firstVotes = votes.filter(row => String(row.choice) === String(pair[0])).length;
    const secondVotes = votes.filter(row => String(row.choice) === String(pair[1])).length;
    const leader = firstVotes === secondVotes ? '' : firstVotes > secondVotes ? String(pair[0]) : String(pair[1]);
    return `<div class="oc-tournament-active">
      <div class="oc-tournament-toolbar"><div><div class="oc-section-label">код ${escapeHtml(room.code)} · ${escapeHtml(room.title)}</div><h3>Раунд ${Number(room.roundNumber || 0) + 1} · матч ${Number(room.matchNumber || 0) + 1}</h3></div>
      <div><button type="button" class="oc-secondary-btn" data-tournament-copy>Скопировать ссылку</button><button type="button" class="oc-community-x" data-tournament-leave>×</button></div></div>
      <div class="oc-tournament-pair">
        ${trackCard(first, mine === String(pair[0]) ? 'voted' : '', `<button type="button" data-tournament-vote="${escapeHtml(pair[0])}">${mine === String(pair[0]) ? 'Снять голос' : 'Голосовать'} · ${firstVotes}</button>`)}
        <div class="oc-tournament-vs">VS</div>
        ${trackCard(second, mine === String(pair[1]) ? 'voted' : '', `<button type="button" data-tournament-vote="${escapeHtml(pair[1])}">${mine === String(pair[1]) ? 'Снять голос' : 'Голосовать'} · ${secondVotes}</button>`)}
      </div>
      <div class="oc-tournament-status">Проголосовало: ${votes.length} · участников в комнате: ${(room.players || []).length}</div>
      ${isHost ? `<div class="oc-community-actions">${leader
        ? `<button type="button" class="oc-addbtn" data-tournament-advance="${escapeHtml(leader)}">Завершить матч — проходит ${escapeHtml(trackById(leader)?.title || '')}</button>`
        : `<span>Ничья: выбери победителя</span><button type="button" class="oc-secondary-btn" data-tournament-advance="${escapeHtml(pair[0])}">${escapeHtml(first?.title || '')}</button><button type="button" class="oc-secondary-btn" data-tournament-advance="${escapeHtml(pair[1])}">${escapeHtml(second?.title || '')}</button>`}</div>` : '<div class="oc-tournament-status">Матч закрывает хост.</div>'}
      <div class="oc-tournament-log"><h4>Прошедшие матчи</h4>${(room.bracketLog || []).slice().reverse().slice(0, 12).map(row => `<div><span>${escapeHtml(trackById(row.a)?.title || '')} — ${escapeHtml(trackById(row.b)?.title || '')}</span><b>${escapeHtml(trackById(row.winner)?.title || '')}</b></div>`).join('') || '<div class="oc-community-empty">Это первый матч.</div>'}</div>
    </div>`;
  }

  function trackCard(track, className = '', action = '') {
    if (!track) return `<article class="oc-tournament-track"><div class="oc-community-empty">${itemTerms(state.room?.type || selectedContext().type).capital} не найден.</div></article>`;
    return `<article class="oc-tournament-track ${className}">${track.image ? `<img src="${escapeHtml(track.image)}" alt="" loading="lazy">` : ''}<div><small>${escapeHtml(track.type || '')}</small><h4>${escapeHtml(track.title)}</h4><p>${escapeHtml((track.performers || []).join(', '))}</p></div>${action}</article>`;
  }

  function selectedTournamentIds(modal) {
    if (modal?.id === 'oc-tournaments-panel') return [...state.creatorSelectedIds];
    return [...modal.querySelectorAll('[data-tournament-track]:checked')].map(input => String(input.value));
  }

  function autofillTournament(modal) {
    const size = Number(modal.querySelector('[data-tournament-size]')?.value || 8);
    modal.querySelectorAll('[data-tournament-track]').forEach((input, index) => { input.checked = index < size; });
    updateTournamentCount(modal);
  }

  function updateTournamentCount(modal) {
    const count = selectedTournamentIds(modal).length;
    const box = modal.querySelector('[data-tournament-count]');
    if (box) box.textContent = String(count);
  }

  async function createTournament(context, modal) {
    const user = requireUser();
    if (!user) return;
    const size = Number(modal.querySelector('[data-tournament-size]')?.value || 8);
    const ids = selectedTournamentIds(modal);
    const error = modal.querySelector('.oc-community-error');
    if (ids.length !== size) {
      if (error) error.textContent = `Нужно выбрать ровно ${size} ${itemTerms(context.type).plural}.`;
      return;
    }
    const shuffled = ids.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    const code = roomCode();
    const id = roomId(code);
    const api = await firebase();
    const title = clean(modal.querySelector('[data-tournament-title]')?.value).slice(0, 80) || `Турнир ${context.type}`;
    const roomData = {
      roomType: 'track-tournament',
      code,
      title,
      hostUid: user.uid,
      hostName: user.name,
      memberUids: [user.uid],
      players: [{ uid: user.uid, name: user.name, avatar: user.avatar }],
      year: context.year,
      season: context.season,
      type: context.type,
      sourceKind: clean(context.sourceKind || 'season'),
      sourceLabel: clean(context.sourceLabel || (context.year && context.season ? `${SEASON_LABEL[context.season]} ${context.year}` : 'Своя подборка')),
      originalTrackIds: shuffled,
      currentPair: shuffled.slice(0, 2),
      remainingRoundIds: shuffled.slice(2),
      nextRoundIds: [],
      roundNumber: 0,
      matchNumber: 0,
      matchSerial: 0,
      bracketLog: [],
      status: 'voting',
      createdAt: api.serverTimestamp(),
      createdAtLocal: new Date().toISOString(),
      updatedAt: api.serverTimestamp(),
      updatedAtLocal: new Date().toISOString()
    };
    await api.setDoc(api.doc(api.db, ROOM_COLLECTION, id), roomData);
    await saveTournamentIndex(api, id, roomData, user);
    await watchTournament(id);
  }

  async function saveTournamentIndex(api, roomIdValue, room, user = currentUser()) {
    const indexId = `track-tournament-index-${roomIdValue}`;
    await api.setDoc(api.doc(api.db, PERSONAL_COLLECTION, indexId), {
      kind: 'track-tournament-index', ownerUid: room.hostUid || user.uid, hostName: room.hostName || user.name,
      roomId: roomIdValue, code: room.code, title: room.title, status: room.status || 'voting',
      year: Number(room.year || 0), season: clean(room.season), type: clean(room.type || 'OP'),
      sourceKind: clean(room.sourceKind || 'season'), sourceLabel: clean(room.sourceLabel),
      participantCount: Number((room.originalTrackIds || []).length), championId: clean(room.championId),
      roundNumber: Number(room.roundNumber || 0), matchNumber: Number(room.matchNumber || 0),
      updatedAt: api.serverTimestamp(), updatedAtLocal: new Date().toISOString(),
      createdAtLocal: room.createdAtLocal || new Date().toISOString()
    }, { merge: true });
  }

  async function joinTournament(code) {
    const user = requireUser();
    if (!user) return;
    const api = await firebase();
    const id = roomId(code);
    const reference = api.doc(api.db, ROOM_COLLECTION, id);
    const snap = await api.getDoc(reference);
    if (!snap.exists() || snap.data().roomType !== 'track-tournament') throw new Error('Турнир с таким кодом не найден.');
    await api.updateDoc(reference, {
      memberUids: api.arrayUnion(user.uid),
      players: api.arrayUnion({ uid: user.uid, name: user.name, avatar: user.avatar }),
      updatedAt: api.serverTimestamp(),
      updatedAtLocal: new Date().toISOString()
    });
    await watchTournament(id);
  }

  async function watchTournament(id) {
    const api = await firebase();
    state.roomUnsub?.();
    state.votesUnsub?.();
    state.roomUnsub = api.onSnapshot(api.doc(api.db, ROOM_COLLECTION, id), snap => {
      if (!snap.exists()) { leaveTournament(); return; }
      state.room = { id: snap.id, ...snap.data() };
      state.tab = 'tournament';
      const url = new URL(location.href);
      if (!url.searchParams.get('view')) url.searchParams.set('view', 'tournaments');
      url.searchParams.set('tournament', state.room.code);
      history.replaceState(history.state, '', url);
      if (!root()) openHub('tournament'); else renderHub();
    });
    const query = api.query(api.collection(api.db, VOTE_COLLECTION), api.where('gameId', '==', id));
    state.votesUnsub = api.onSnapshot(query, snap => {
      state.votes = snap.docs.map(row => ({ id: row.id, ...row.data(), choice: row.data()?.answers?.choice || row.data()?.choice || '' }));
      if (root()) renderHub();
    });
  }

  async function voteTournament(choice) {
    const room = state.room;
    const user = requireUser();
    if (!room || !user || !room.currentPair?.includes(String(choice))) return;
    const api = await firebase();
    const id = `${room.id}-${room.matchSerial}-${user.uid}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 220);
    const previous = tournamentVotes(room).find(row => row.ownerUid === user.uid);
    if (String(previous?.choice || '') === String(choice)) {
      await api.deleteDoc(api.doc(api.db, VOTE_COLLECTION, id));
      return;
    }
    await api.setDoc(api.doc(api.db, VOTE_COLLECTION, id), {
      ownerUid: user.uid,
      gameId: room.id,
      roundIndex: Number(room.matchSerial || 0),
      guesserKey: safePart(user.name).slice(0, 60) || user.uid.slice(0, 60),
      guesserName: user.name.slice(0, 80),
      answers: { choice: String(choice) },
      matchSerial: Number(room.matchSerial || 0),
      choice: String(choice),
      submittedAt: api.serverTimestamp(),
      submittedAtLocal: new Date().toISOString()
    });
  }

  async function advanceTournament(winner) {
    const room = state.room;
    if (!room || currentUser().uid !== room.hostUid || !room.currentPair?.includes(String(winner))) return;
    const api = await firebase();
    const remaining = (room.remainingRoundIds || []).map(String);
    const next = [...(room.nextRoundIds || []).map(String), String(winner)];
    const log = [...(room.bracketLog || []), { a: String(room.currentPair[0]), b: String(room.currentPair[1]), winner: String(winner), round: Number(room.roundNumber || 0), match: Number(room.matchNumber || 0) }];
    let patch;
    if (remaining.length >= 2) {
      patch = { currentPair: remaining.slice(0, 2), remainingRoundIds: remaining.slice(2), nextRoundIds: next, matchNumber: Number(room.matchNumber || 0) + 1, matchSerial: Number(room.matchSerial || 0) + 1, bracketLog: log };
    } else if (next.length === 1) {
      patch = { status: 'finished', championId: next[0], currentPair: [], remainingRoundIds: [], nextRoundIds: [], bracketLog: log };
    } else {
      patch = { currentPair: next.slice(0, 2), remainingRoundIds: next.slice(2), nextRoundIds: [], roundNumber: Number(room.roundNumber || 0) + 1, matchNumber: 0, matchSerial: Number(room.matchSerial || 0) + 1, bracketLog: log };
    }
    await api.updateDoc(api.doc(api.db, ROOM_COLLECTION, room.id), { ...patch, updatedAt: api.serverTimestamp(), updatedAtLocal: new Date().toISOString() });
    await saveTournamentIndex(api, room.id, { ...room, ...patch });
  }

  function leaveTournament(shouldRender = true) {
    state.roomUnsub?.();
    state.votesUnsub?.();
    state.room = null;
    state.votes = [];
    state.roomUnsub = null;
    state.votesUnsub = null;
    const url = new URL(location.href);
    url.searchParams.delete('tournament');
    history.replaceState(history.state, '', url);
    if (shouldRender && root()) renderHub();
  }

  async function watchPersonalRows(seasonKey) {
    const api = await firebase();
    state.personalUnsub?.();
    const query = api.query(api.collection(api.db, PERSONAL_COLLECTION), api.where('seasonKey', '==', seasonKey));
    state.personalUnsub = api.onSnapshot(query, snap => {
      state.personalRows = snap.docs.map(row => ({ id: row.id, ...row.data() }));
      if (root() && !state.room) renderHub();
    });
  }

  function ownCollections() {
    const data = snapshot();
    const user = currentUser();
    const profile = (data.userProfiles || []).find(row => clean(row.authUid || row.uid) === user.uid)
      || (data.userProfiles || []).find(row => clean(row.nickname).toLocaleLowerCase('ru') === user.name.toLocaleLowerCase('ru'));
    return Array.isArray(profile?.collections) ? profile.collections : [];
  }

  function collectionIds(collection) {
    const rows = collection?.trackIds || collection?.openingIds || collection?.ids || collection?.entries || [];
    return rows.map(row => String(typeof row === 'object' ? row.id : row)).filter(Boolean);
  }

  function creatorContext(panel) {
    const sourceKind = panel.querySelector('[data-tournament-source]')?.value || 'season';
    const type = panel.querySelector('[data-tournament-source-type]')?.value || 'OP';
    const entries = (snapshot().entries || []).filter(entry => clean(entry.type).toUpperCase() === type);
    let tracks = entries;
    let sourceLabel = 'Своя подборка';
    let year = 0;
    let season = '';
    if (sourceKind === 'season') {
      const value = panel.querySelector('[data-tournament-season]')?.value || '';
      [year, season] = value.split('|');
      year = Number(year || 0);
      tracks = entries.filter(entry => Number(entry.year) === year && clean(entry.season) === season);
      sourceLabel = `${SEASON_LABEL[season] || season} ${year}`;
    } else if (sourceKind === 'collection') {
      const collection = ownCollections().find(row => String(row.id) === panel.querySelector('[data-tournament-collection]')?.value);
      const ids = new Set(collectionIds(collection));
      tracks = entries.filter(entry => ids.has(String(entry.id)));
      sourceLabel = clean(collection?.title || collection?.name || 'Коллекция');
    }
    const search = clean(panel.querySelector('[data-tournament-search]')?.value).toLocaleLowerCase('ru');
    if (search) tracks = tracks.filter(entry => `${entry.title || ''} ${(entry.performers || []).join(' ')}`.toLocaleLowerCase('ru').includes(search));
    return { year, season, type, sourceKind, sourceLabel, key: year && season ? `${type}-${year}-${season}` : '', tracks };
  }

  function tournamentPanelMarkup() {
    const user = currentUser();
    const mode = state.tournamentListMode;
    const rows = state.tournamentIndexes
      .filter(row => mode === 'mine' ? row.ownerUid === user.uid : mode === 'completed' ? row.status === 'finished' : row.status !== 'finished')
      .sort((a, b) => clean(b.updatedAtLocal).localeCompare(clean(a.updatedAtLocal)));
    const seasons = [...new Set((snapshot().entries || []).map(entry => `${entry.year}|${entry.season}`).filter(value => !value.startsWith('0|')))]
      .sort((a, b) => b.localeCompare(a));
    const collections = ownCollections();
    return `<div class="oc-tournaments-page"><header><div><div class="oc-section-label">общие активности</div><h1>Турниры</h1><p>Создавай сетки из сезона, своей коллекции или любых опенингов и эндингов каталога.</p></div>
      <div class="oc-tournaments-join"><input data-tournaments-code maxlength="12" placeholder="Код турнира"><button class="oc-addbtn" data-tournaments-join>Войти</button></div></header>
      <div class="oc-tournaments-tabs"><button data-tournaments-mode="active" class="${mode === 'active' ? 'active' : ''}">Активные</button><button data-tournaments-mode="completed" class="${mode === 'completed' ? 'active' : ''}">Завершённые</button><button data-tournaments-mode="mine" class="${mode === 'mine' ? 'active' : ''}">Мои</button></div>
      <div class="oc-tournaments-grid">${rows.map(row => `<article><div><small>${escapeHtml(row.type)} · ${escapeHtml(row.sourceLabel || 'Своя подборка')}</small><h3>${escapeHtml(row.title)}</h3><p>Хост: ${escapeHtml(row.hostName)} · сетка на ${Number(row.participantCount || 0)} · раунд ${Number(row.roundNumber || 0) + 1}</p></div><button class="oc-secondary-btn" data-tournaments-open="${escapeHtml(row.code)}">${row.status === 'finished' ? 'Посмотреть' : 'Войти'}</button></article>`).join('') || '<div class="oc-community-empty">Здесь пока нет турниров.</div>'}</div>
      <section class="oc-tournament-builder"><div><div class="oc-section-label">новый турнир</div><h2>Собрать сетку</h2></div>
        <div class="oc-tournament-source-row"><label>Источник<select data-tournament-source><option value="season">Сезон</option><option value="collection">Моя коллекция</option><option value="custom">Произвольный выбор</option></select></label><label>Тип<select data-tournament-source-type><option>OP</option><option>ED</option></select></label>
        <label data-source-season-wrap>Сезон<select data-tournament-season>${seasons.map(value => { const [year, season] = value.split('|'); return `<option value="${value}">${SEASON_LABEL[season] || season} ${year}</option>`; }).join('')}</select></label>
        <label data-source-collection-wrap class="hidden">Коллекция<select data-tournament-collection>${collections.map(row => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.title || row.name || 'Без названия')}</option>`).join('')}</select></label></div>
        <div class="oc-tournament-create-row"><label>Название<input data-tournament-title maxlength="80" placeholder="Название турнира"></label><label>Размер<select data-tournament-size>${[8,16,32,64,128].map(count => `<option value="${count}">${count}</option>`).join('')}</select></label><label>Поиск<input data-tournament-search placeholder="Название или исполнитель"></label></div>
        <div class="oc-tournament-counter">Выбрано: <b data-tournament-count>${state.creatorSelectedIds.size}</b></div><div class="oc-tournament-picker" data-tournament-global-picker></div>
        <div class="oc-community-actions"><button class="oc-secondary-btn" data-tournament-autofill>Выбрать первые</button><button class="oc-addbtn" data-tournament-create>Создать турнир</button></div><div class="oc-community-error"></div>
      </section></div>`;
  }

  function renderTournamentPanel() {
    const panel = document.querySelector('#oc-tournaments-panel');
    if (!panel) return;
    panel.innerHTML = tournamentPanelMarkup();
    const renderPicker = () => {
      const context = creatorContext(panel);
      const picker = panel.querySelector('[data-tournament-global-picker]');
      picker.innerHTML = context.tracks.map(track => `<label><input type="checkbox" data-tournament-track value="${escapeHtml(track.id)}" ${state.creatorSelectedIds.has(String(track.id)) ? 'checked' : ''}><span><b>${escapeHtml(track.title)}</b><small>${escapeHtml((track.performers || []).join(', '))}</small></span></label>`).join('') || '<div class="oc-community-empty">Подходящих позиций нет.</div>';
      picker.querySelectorAll('[data-tournament-track]').forEach(input => input.addEventListener('change', () => {
        if (input.checked) state.creatorSelectedIds.add(String(input.value)); else state.creatorSelectedIds.delete(String(input.value));
        updateTournamentCount(panel);
      }));
    };
    const sourceChanged = () => {
      const source = panel.querySelector('[data-tournament-source]').value;
      panel.querySelector('[data-source-season-wrap]').classList.toggle('hidden', source !== 'season');
      panel.querySelector('[data-source-collection-wrap]').classList.toggle('hidden', source !== 'collection');
      state.creatorSelectedIds.clear(); renderPicker(); updateTournamentCount(panel);
    };
    panel.querySelectorAll('[data-tournaments-mode]').forEach(button => button.addEventListener('click', () => { state.tournamentListMode = button.dataset.tournamentsMode; renderTournamentPanel(); }));
    panel.querySelectorAll('[data-tournaments-open]').forEach(button => button.addEventListener('click', () => void joinTournament(button.dataset.tournamentsOpen)));
    panel.querySelector('[data-tournaments-join]')?.addEventListener('click', () => void joinTournament(panel.querySelector('[data-tournaments-code]').value).catch(error => alert(error.message)));
    panel.querySelector('[data-tournament-source]')?.addEventListener('change', sourceChanged);
    panel.querySelectorAll('[data-tournament-source-type],[data-tournament-season],[data-tournament-collection]').forEach(input => input.addEventListener('change', () => { state.creatorSelectedIds.clear(); renderPicker(); updateTournamentCount(panel); }));
    panel.querySelector('[data-tournament-search]')?.addEventListener('input', renderPicker);
    panel.querySelector('[data-tournament-autofill]')?.addEventListener('click', () => { const context = creatorContext(panel); const size = Number(panel.querySelector('[data-tournament-size]').value); state.creatorSelectedIds = new Set(context.tracks.slice(0, size).map(track => String(track.id))); renderPicker(); updateTournamentCount(panel); });
    panel.querySelector('[data-tournament-create]')?.addEventListener('click', () => void createTournament(creatorContext(panel), panel));
    sourceChanged();
  }

  async function watchTournamentIndexes() {
    if (state.tournamentIndexesUnsub) return;
    const api = await firebase();
    const query = api.query(api.collection(api.db, PERSONAL_COLLECTION), api.where('kind', '==', 'track-tournament-index'));
    state.tournamentIndexesUnsub = api.onSnapshot(query, snap => {
      state.tournamentIndexes = snap.docs.map(row => ({ id: row.id, ...row.data() }));
      renderTournamentPanel();
    });
  }

  function bindHub(modal, context) {
    modal.querySelector('[data-community-close]')?.addEventListener('click', closeHub);
    modal.querySelectorAll('[data-community-tab]').forEach(button => button.addEventListener('click', () => {
      state.tab = button.dataset.communityTab;
      renderHub();
    }));
    modal.querySelectorAll('[data-award-track]').forEach(button => button.addEventListener('click', () => void voteAward(context, button.dataset.awardCategory, button.dataset.awardTrack)));
    modal.querySelector('[data-prediction-save]')?.addEventListener('click', () => void savePrediction(context, modal));
    modal.querySelector('[data-tournament-autofill]')?.addEventListener('click', () => autofillTournament(modal));
    modal.querySelector('[data-tournament-size]')?.addEventListener('change', () => autofillTournament(modal));
    modal.querySelectorAll('[data-tournament-track]').forEach(input => input.addEventListener('change', () => updateTournamentCount(modal)));
    modal.querySelector('[data-tournament-create]')?.addEventListener('click', () => void createTournament(context, modal));
    modal.querySelector('[data-tournament-join]')?.addEventListener('click', () => {
      const code = prompt('Код турнира:');
      if (code) void joinTournament(code).catch(error => { const box = modal.querySelector('.oc-community-error'); if (box) box.textContent = error?.message || 'Не удалось войти.'; });
    });
    modal.querySelectorAll('[data-tournament-vote]').forEach(button => button.addEventListener('click', () => void voteTournament(button.dataset.tournamentVote)));
    modal.querySelectorAll('[data-tournament-advance]').forEach(button => button.addEventListener('click', () => void advanceTournament(button.dataset.tournamentAdvance)));
    modal.querySelector('[data-tournament-copy]')?.addEventListener('click', async event => {
      await navigator.clipboard.writeText(location.href);
      event.currentTarget.textContent = 'Ссылка скопирована ✓';
    });
    modal.querySelectorAll('[data-tournament-leave]').forEach(button => button.addEventListener('click', leaveTournament));
  }

  function mountButton() {
    const head = document.querySelector('.oc-season-head');
    if (!head || document.querySelector('[data-season-community-open]')) return;
    let actions = document.querySelector('.oc-season-extra-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'oc-season-extra-actions';
      head.insertAdjacentElement('afterend', actions);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'oc-secondary-btn oc-season-community-button';
    button.dataset.seasonCommunityOpen = '1';
    button.textContent = 'Сезонный центр';
    button.addEventListener('click', () => openHub('awards'));
    actions.append(button);
    const tournamentButton = document.createElement('button');
    tournamentButton.type = 'button';
    tournamentButton.className = 'oc-secondary-btn oc-season-tournament-button';
    tournamentButton.dataset.seasonTournamentOpen = '1';
    tournamentButton.textContent = 'Турнир сезона';
    tournamentButton.addEventListener('click', () => openHub('tournament'));
    actions.append(tournamentButton);
  }

  function maybeAutoJoin() {
    if (state.autoJoinTried) return;
    const code = new URL(location.href).searchParams.get('tournament');
    if (!code) return;
    state.autoJoinTried = true;
    void joinTournament(code).catch(error => {
      console.error(error);
      alert(error?.message || 'Не удалось войти в турнир.');
      leaveTournament();
    });
  }

  function init() {
    if (new URL(location.href).searchParams.get('view') === 'tournaments') {
      window.setTimeout(() => document.querySelector('.oc-tab-btn[data-tab="tournaments"]')?.click(), 0);
    }
    mountButton();
    new MutationObserver(mountButton).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('oped:app-data-updated', () => { if (root()) renderHub(); if (!document.querySelector('#oc-tournaments-panel')?.classList.contains('hidden')) renderTournamentPanel(); maybeAutoJoin(); });
    window.addEventListener('oped:route-change', event => {
      if (event.detail?.tab === 'tournaments') { renderTournamentPanel(); void watchTournamentIndexes().catch(error => console.error(error)); }
    });
    window.addEventListener('oped:route-ready', maybeAutoJoin);
    if (new URL(location.href).searchParams.get('view') === 'tournaments') { renderTournamentPanel(); void watchTournamentIndexes().catch(error => console.error(error)); }
    window.setTimeout(maybeAutoJoin, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
