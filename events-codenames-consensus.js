(() => {
  if (window.__OC_CODENAMES_CONSENSUS_READY__) return;
  window.__OC_CODENAMES_CONSENSUS_READY__ = true;

  const ROOM_SELECTION_KEY = 'aboba-event-room-selection-v1';
  const NAME_KEY = 'my-display-name';
  const ROOM_COLLECTION = 'eventCodenames';
  const VOTE_COLLECTION = 'eventCodenamesVotes';
  const CARD_SELECTOR = '.ev-cn-card[data-cn-card]';

  let firebasePromise = null;
  let roomUnsubscribe = null;
  let votesUnsubscribe = null;
  let roomId = '';
  let roomState = null;
  let voteRows = new Map();
  let votePending = false;
  let revealPending = false;
  let renderQueued = false;
  let boardObserver = null;

  function normalizeNickname(value) {
    return String(value || '')
      .trim()
      .toLocaleLowerCase('ru')
      .replace(/[^a-zа-яё0-9_-]+/gi, '_')
      .slice(0, 60);
  }

  function currentName() {
    return String(localStorage.getItem(NAME_KEY) || '').trim();
  }

  function currentPlayerKey() {
    return normalizeNickname(currentName());
  }

  function selectedRoomId() {
    try {
      const selected = JSON.parse(localStorage.getItem(ROOM_SELECTION_KEY) || '{}');
      return String(selected?.codenames || '').trim();
    } catch (_) {
      return '';
    }
  }

  function players(room = roomState) {
    return Array.isArray(room?.players)
      ? room.players.filter(player => player?.key && player?.name)
      : [];
  }

  function eligiblePlayers(room = roomState) {
    return players(room).filter(player => player.team === room?.turn && player.role !== 'spymaster');
  }

  function roundKey(room) {
    const clue = room?.clue || {};
    return JSON.stringify([
      String(room?.turn || ''),
      String(clue.word || ''),
      Number(clue.count || 0),
      Number(room?.guessesLeft || 0)
    ]);
  }

  function activeVotes(room = roomState, rows = voteRows) {
    const key = roundKey(room);
    const out = {};
    rows.forEach(row => {
      const playerKey = normalizeNickname(row?.playerKey);
      const index = Number(row?.index);
      if (!playerKey || String(row?.roundKey || '') !== key || !Number.isInteger(index)) return;
      const previous = out[playerKey];
      if (!previous || Number(row.updatedAtLocal || 0) >= Number(previous.updatedAtLocal || 0)) {
        out[playerKey] = { ...row, index };
      }
    });
    return out;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function teamLabel(team) {
    return team === 'red' ? 'Красные' : 'Синие';
  }

  function winnerFromBoard(board) {
    const redLeft = board.some(card => card.identity === 'red' && !card.revealed);
    const blueLeft = board.some(card => card.identity === 'blue' && !card.revealed);
    if (!redLeft) return 'red';
    if (!blueLeft) return 'blue';
    return '';
  }

  function hash(value) {
    let result = 2166136261;
    const source = String(value || '');
    for (let index = 0; index < source.length; index += 1) {
      result ^= source.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  async function firebaseTools() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js'),
      import('./firebase-config.js')
    ]).then(([appModule, firestore, authModule, config]) => {
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(config.firebaseConfig);
      return {
        db: firestore.getFirestore(app),
        auth: authModule.getAuth(app),
        ...firestore
      };
    });
    return firebasePromise;
  }

  function showStatus(message, error = false) {
    const panel = document.querySelector('.ev-cn-panel');
    if (!panel) return;
    let status = panel.querySelector('.oc-cn-consensus-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'oc-cn-consensus-status';
      panel.prepend(status);
    }
    status.textContent = message;
    status.classList.toggle('bad', error);
    status.hidden = !message;
    if (message && !error) {
      window.setTimeout(() => {
        if (status.textContent === message) status.hidden = true;
      }, 2200);
    }
  }

  function decorateBoard() {
    renderQueued = false;
    const room = roomState;
    const buttons = [...document.querySelectorAll(CARD_SELECTOR)];
    if (!room || !buttons.length) return;

    const eligible = eligiblePlayers(room);
    const votes = activeVotes(room);
    const myKey = currentPlayerKey();
    const total = eligible.length;

    boardObserver?.disconnect();
    try {
      buttons.forEach(button => {
        const index = Number(button.dataset.cnCard);
        const voters = eligible.filter(player => Number(votes[player.key]?.index) === index);
        button.querySelector('.oc-cn-consensus-badge')?.remove();
        button.classList.remove('oc-cn-has-votes', 'oc-cn-my-vote', 'oc-cn-unanimous', 'oc-cn-red-vote', 'oc-cn-blue-vote');

        if (!voters.length || room.board?.[index]?.revealed) return;

        button.classList.add('oc-cn-has-votes', room.turn === 'red' ? 'oc-cn-red-vote' : 'oc-cn-blue-vote');
        if (voters.some(player => player.key === myKey)) button.classList.add('oc-cn-my-vote');
        if (total > 0 && voters.length >= total) button.classList.add('oc-cn-unanimous');

        const badge = document.createElement('div');
        badge.className = 'oc-cn-consensus-badge';
        badge.innerHTML = `<strong>${voters.length}/${total}</strong><span>${voters.map(player => escapeHtml(player.name)).join(', ')}</span>`;
        button.append(badge);
      });
    } finally {
      boardObserver?.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  function scheduleDecorate() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(decorateBoard);
  }

  function buildRevealPatch(room, board, card) {
    card.revealed = true;
    let turn = room.turn;
    let clue = room.clue || null;
    let guessesLeft = Math.max(0, Number(room.guessesLeft || 0) - 1);
    let winner = '';
    const other = room.turn === 'red' ? 'blue' : 'red';
    let message = `Все игроки команды подтвердили «${card.title}» — `;

    if (card.identity === 'assassin') {
      winner = other;
      message += 'УБИЙЦА.';
    } else if (card.identity === room.turn) {
      message += 'своя карточка.';
      if (guessesLeft <= 0) {
        turn = other;
        clue = null;
      }
    } else if (card.identity === other) {
      message += 'карточка соперников.';
      turn = other;
      clue = null;
      guessesLeft = 0;
    } else {
      message += 'нейтральная карточка.';
      turn = other;
      clue = null;
      guessesLeft = 0;
    }

    if (!winner) winner = winnerFromBoard(board);
    if (winner) message += ` Победили ${teamLabel(winner).toLowerCase()}.`;

    return {
      board,
      turn,
      clue,
      guessesLeft,
      winner,
      status: winner ? 'finished' : 'playing',
      log: [...(Array.isArray(room.log) ? room.log : []), message].slice(-80)
    };
  }

  function rowsFromSnapshot(snapshot, expectedRoomId) {
    const byPlayer = new Map();
    snapshot.docs.forEach(documentSnapshot => {
      const row = { id: documentSnapshot.id, ...documentSnapshot.data() };
      if (String(row.roomId || '') !== String(expectedRoomId || '')) return;
      const playerKey = normalizeNickname(row.playerKey);
      if (!playerKey) return;
      const previous = byPlayer.get(playerKey);
      if (!previous || Number(row.updatedAtLocal || 0) >= Number(previous.updatedAtLocal || 0)) {
        byPlayer.set(playerKey, row);
      }
    });
    return byPlayer;
  }

  async function revealIfUnanimous(room = roomState) {
    if (!room || revealPending || room.status !== 'playing' || room.winner) return;

    const eligible = eligiblePlayers(room).sort((left, right) => String(left.key).localeCompare(String(right.key), 'ru'));
    const myKey = currentPlayerKey();
    if (!eligible.length || eligible[0]?.key !== myKey) return;

    const votes = activeVotes(room);
    const index = Number(votes[eligible[0].key]?.index);
    if (!Number.isInteger(index) || !eligible.every(player => Number(votes[player.key]?.index) === index)) return;

    revealPending = true;
    try {
      const tools = await firebaseTools();
      const roomRef = tools.doc(tools.db, ROOM_COLLECTION, String(room.id || roomId));
      const [roomSnapshot, votesSnapshot] = await Promise.all([
        tools.getDoc(roomRef),
        tools.getDocs(tools.query(
          tools.collection(tools.db, VOTE_COLLECTION),
          tools.where('roomId', '==', String(room.id || roomId))
        ))
      ]);
      if (!roomSnapshot.exists()) return;

      const fresh = { id: roomSnapshot.id, ...roomSnapshot.data() };
      const freshEligible = eligiblePlayers(fresh).sort((left, right) => String(left.key).localeCompare(String(right.key), 'ru'));
      const freshRows = rowsFromSnapshot(votesSnapshot, fresh.id);
      const freshVotes = activeVotes(fresh, freshRows);
      if (!freshEligible.length || freshEligible[0]?.key !== myKey) return;
      if (!freshEligible.every(player => Number(freshVotes[player.key]?.index) === index)) return;

      const board = Array.isArray(fresh.board) ? fresh.board.map(card => ({ ...card })) : [];
      const card = board[index];
      if (!card || card.revealed || fresh.status !== 'playing' || fresh.winner || Number(fresh.guessesLeft || 0) <= 0) return;

      await tools.updateDoc(roomRef, {
        ...buildRevealPatch(fresh, board, card),
        consensusVotes: tools.deleteField(),
        consensusRoundKey: tools.deleteField(),
        updatedAtLocal: new Date().toISOString(),
        updatedAt: tools.serverTimestamp()
      });
      showStatus('Все игроки подтвердили карточку — она раскрыта.');
    } catch (error) {
      console.error('Codenames consensus reveal failed', error);
      showStatus(error?.message || 'Не удалось раскрыть карточку.', true);
    } finally {
      revealPending = false;
    }
  }

  async function subscribeRoom(nextRoomId) {
    if (nextRoomId === roomId) return;
    roomUnsubscribe?.();
    votesUnsubscribe?.();
    roomUnsubscribe = null;
    votesUnsubscribe = null;
    roomId = nextRoomId;
    roomState = null;
    voteRows = new Map();
    scheduleDecorate();
    if (!roomId) return;

    const tools = await firebaseTools();
    roomUnsubscribe = tools.onSnapshot(tools.doc(tools.db, ROOM_COLLECTION, roomId), snapshot => {
      roomState = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      scheduleDecorate();
      void revealIfUnanimous(roomState);
    }, error => {
      console.warn('Codenames consensus room subscription failed', error);
      roomState = null;
      scheduleDecorate();
    });

    votesUnsubscribe = tools.onSnapshot(tools.query(
      tools.collection(tools.db, VOTE_COLLECTION),
      tools.where('roomId', '==', roomId)
    ), snapshot => {
      voteRows = rowsFromSnapshot(snapshot, roomId);
      scheduleDecorate();
      void revealIfUnanimous(roomState);
    }, error => {
      console.warn('Codenames consensus votes subscription failed', error);
      voteRows = new Map();
      scheduleDecorate();
      showStatus('Не удалось синхронизировать нажатия игроков.', true);
    });
  }

  async function voteForCard(index) {
    const room = roomState;
    const selectedId = selectedRoomId();
    if (!room || !selectedId || votePending) return;

    const me = players(room).find(player => String(player.key) === currentPlayerKey()) || null;
    const eligible = eligiblePlayers(room);
    const card = Array.isArray(room.board) ? room.board[index] : null;
    if (room.status !== 'playing' || room.winner) return showStatus('Игра уже завершена.', true);
    if (!me || me.team !== room.turn || me.role === 'spymaster') return showStatus('Сейчас голосуют полевые игроки активной команды.', true);
    if (!eligible.length || Number(room.guessesLeft || 0) <= 0 || !card || card.revealed) return showStatus('Эту карточку сейчас выбрать нельзя.', true);

    votePending = true;
    document.querySelector(`${CARD_SELECTOR}[data-cn-card="${CSS.escape(String(index))}"]`)?.classList.add('oc-cn-vote-pending');

    try {
      const tools = await firebaseTools();
      if (typeof tools.auth.authStateReady === 'function') await tools.auth.authStateReady();
      const user = tools.auth.currentUser;
      if (!user) throw new Error('Для голосования нужно войти в ивенты.');

      const votes = activeVotes(room);
      const sameCard = Number(votes[me.key]?.index) === index;
      const voteRef = tools.doc(
        tools.db,
        VOTE_COLLECTION,
        `cnv-${hash(selectedId)}-${hash(user.uid)}`
      );

      if (sameCard) {
        await tools.deleteDoc(voteRef);
      } else {
        await tools.setDoc(voteRef, {
          ownerUid: String(user.uid),
          roomId: selectedId,
          playerKey: String(me.key),
          playerName: String(me.name || currentName()),
          team: String(me.team || ''),
          index,
          roundKey: roundKey(room),
          updatedAtLocal: Date.now(),
          updatedAt: tools.serverTimestamp()
        }, { merge: true });
      }

      showStatus(sameCard ? 'Выбор карточки снят.' : 'Голос учтён. Ждём остальных игроков.');
    } catch (error) {
      console.error('Codenames consensus vote failed', error);
      showStatus(error?.message || 'Не удалось сохранить выбор карточки.', true);
    } finally {
      votePending = false;
      document.querySelectorAll('.oc-cn-vote-pending').forEach(node => node.classList.remove('oc-cn-vote-pending'));
    }
  }

  function installStyles() {
    if (document.querySelector('#oc-cn-consensus-style')) return;
    const style = document.createElement('style');
    style.id = 'oc-cn-consensus-style';
    style.textContent = `
      .ev-cn-card.oc-cn-has-votes { isolation:isolate; box-shadow:0 0 0 3px rgba(255,255,255,.16),0 14px 32px rgba(0,0,0,.34)!important; }
      .ev-cn-card.oc-cn-red-vote { box-shadow:0 0 0 3px rgba(255,74,99,.72),0 14px 34px rgba(255,74,99,.22)!important; }
      .ev-cn-card.oc-cn-blue-vote { box-shadow:0 0 0 3px rgba(62,191,255,.72),0 14px 34px rgba(62,191,255,.22)!important; }
      .ev-cn-card.oc-cn-my-vote::after { content:'твой выбор'; position:absolute; top:8px; left:8px; z-index:5; padding:4px 7px; border-radius:999px; background:rgba(8,217,214,.92); color:#071313; font:800 9px "Space Mono",monospace; letter-spacing:.04em; text-transform:uppercase; }
      .oc-cn-consensus-badge { position:absolute; z-index:6; right:8px; bottom:8px; display:grid; max-width:calc(100% - 16px); gap:2px; padding:6px 8px; border:1px solid rgba(255,255,255,.22); border-radius:9px; background:rgba(10,8,15,.88); color:#fff; pointer-events:none; text-align:right; backdrop-filter:blur(8px); }
      .oc-cn-consensus-badge strong { font:900 12px "Space Mono",monospace; }
      .oc-cn-consensus-badge span { overflow:hidden; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
      .ev-cn-card.oc-cn-unanimous { animation:ocCnConsensusPulse .65s ease-in-out infinite alternate; }
      .ev-cn-card.oc-cn-vote-pending { opacity:.72; pointer-events:none; }
      .oc-cn-consensus-status { margin-bottom:12px; padding:10px 12px; border:1px solid rgba(8,217,214,.34); border-radius:10px; background:rgba(8,217,214,.08); color:#8ff8ef; font-size:12px; }
      .oc-cn-consensus-status.bad { border-color:rgba(255,74,99,.42); background:rgba(255,74,99,.09); color:#ff9cad; }
      @keyframes ocCnConsensusPulse { from { transform:translateY(0); } to { transform:translateY(-2px); } }
    `;
    document.head.append(style);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.(CARD_SELECTOR);
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void voteForCard(Number(button.dataset.cnCard));
  }, true);

  boardObserver = new MutationObserver(scheduleDecorate);
  boardObserver.observe(document.documentElement, { childList: true, subtree: true });
  installStyles();

  const syncRoom = () => void subscribeRoom(selectedRoomId());
  window.setInterval(syncRoom, 500);
  window.addEventListener('storage', syncRoom);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncRoom();
  });
  syncRoom();
})();
