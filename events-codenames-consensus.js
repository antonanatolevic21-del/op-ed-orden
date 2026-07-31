(() => {
  if (window.__OC_CODENAMES_CONSENSUS_READY__) return;
  window.__OC_CODENAMES_CONSENSUS_READY__ = true;

  const ROOM_SELECTION_KEY = 'aboba-event-room-selection-v1';
  const NAME_KEY = 'my-display-name';
  const COLLECTION = 'eventCodenames';
  const VOTES_FIELD = 'consensusVotes';
  const ROUND_FIELD = 'consensusRoundKey';
  const CARD_SELECTOR = '.ev-cn-card[data-cn-card]';

  let firebasePromise = null;
  let roomUnsubscribe = null;
  let roomId = '';
  let roomState = null;
  let votePending = false;
  let renderQueued = false;

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

  function activeVotes(room = roomState) {
    if (!room || String(room[ROUND_FIELD] || '') !== roundKey(room)) return {};
    const raw = room[VOTES_FIELD];
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
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

  async function firebaseTools() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js'),
      import('./firebase-config.js')
    ]).then(([appModule, firestore, config]) => {
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(config.firebaseConfig);
      return { db: firestore.getFirestore(app), ...firestore };
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

    buttons.forEach(button => {
      const index = Number(button.dataset.cnCard);
      const voters = eligible.filter(player => Number(votes[player.key]) === index);
      button.querySelector('.oc-cn-consensus-badge')?.remove();
      button.classList.remove('oc-cn-has-votes', 'oc-cn-my-vote', 'oc-cn-unanimous', 'oc-cn-red-vote', 'oc-cn-blue-vote');
      button.removeAttribute('data-cn-vote-count');

      if (!voters.length || room.board?.[index]?.revealed) return;

      button.classList.add('oc-cn-has-votes', room.turn === 'red' ? 'oc-cn-red-vote' : 'oc-cn-blue-vote');
      if (voters.some(player => player.key === myKey)) button.classList.add('oc-cn-my-vote');
      if (total > 0 && voters.length >= total) button.classList.add('oc-cn-unanimous');
      button.dataset.cnVoteCount = `${voters.length}/${total}`;

      const badge = document.createElement('div');
      badge.className = 'oc-cn-consensus-badge';
      badge.innerHTML = `<strong>${voters.length}/${total}</strong><span>${voters.map(player => escapeHtml(player.name)).join(', ')}</span>`;
      button.append(badge);
    });
  }

  function scheduleDecorate() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(decorateBoard);
  }

  async function subscribeRoom(nextRoomId) {
    if (nextRoomId === roomId) return;
    roomUnsubscribe?.();
    roomUnsubscribe = null;
    roomId = nextRoomId;
    roomState = null;
    scheduleDecorate();
    if (!roomId) return;

    const tools = await firebaseTools();
    roomUnsubscribe = tools.onSnapshot(tools.doc(tools.db, COLLECTION, roomId), snapshot => {
      roomState = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      scheduleDecorate();
    }, error => {
      console.warn('Codenames consensus subscription failed', error);
      roomState = null;
      scheduleDecorate();
    });
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
      log: [...(Array.isArray(room.log) ? room.log : []), message].slice(-80),
      [VOTES_FIELD]: {},
      [ROUND_FIELD]: ''
    };
  }

  async function voteForCard(index) {
    const selectedId = selectedRoomId();
    if (!selectedId || votePending) return;
    votePending = true;
    document.querySelector(`${CARD_SELECTOR}[data-cn-card="${CSS.escape(String(index))}"]`)?.classList.add('oc-cn-vote-pending');

    try {
      const tools = await firebaseTools();
      const roomRef = tools.doc(tools.db, COLLECTION, selectedId);
      const result = await tools.runTransaction(tools.db, async transaction => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists()) throw new Error('Комната Codenames не найдена.');
        const room = { id: snapshot.id, ...snapshot.data() };
        const board = Array.isArray(room.board) ? room.board.map(card => ({ ...card })) : [];
        const card = board[index];
        const me = players(room).find(player => String(player.key) === currentPlayerKey()) || null;
        const eligible = eligiblePlayers(room);

        if (room.status !== 'playing' || room.winner) throw new Error('Игра уже завершена.');
        if (!me || me.team !== room.turn || me.role === 'spymaster') throw new Error('Сейчас голосуют полевые игроки активной команды.');
        if (Number(room.guessesLeft || 0) <= 0 || !card || card.revealed) throw new Error('Эту карточку сейчас выбрать нельзя.');
        if (!eligible.length) throw new Error('В активной команде нет полевых игроков.');

        const key = roundKey(room);
        const votes = String(room[ROUND_FIELD] || '') === key && room[VOTES_FIELD] && typeof room[VOTES_FIELD] === 'object'
          ? { ...room[VOTES_FIELD] }
          : {};
        const eligibleKeys = new Set(eligible.map(player => String(player.key)));
        Object.keys(votes).forEach(playerKey => {
          if (!eligibleKeys.has(playerKey)) delete votes[playerKey];
        });

        if (Number(votes[me.key]) === index) delete votes[me.key];
        else votes[me.key] = index;

        const unanimous = eligible.every(player => Number(votes[player.key]) === index);
        const basePatch = {
          updatedAtLocal: new Date().toISOString(),
          updatedAt: tools.serverTimestamp()
        };

        if (unanimous) {
          transaction.set(roomRef, { ...buildRevealPatch(room, board, card), ...basePatch }, { merge: true });
          return { revealed: true, count: eligible.length, total: eligible.length };
        }

        transaction.set(roomRef, {
          [VOTES_FIELD]: votes,
          [ROUND_FIELD]: key,
          ...basePatch
        }, { merge: true });
        const count = eligible.filter(player => Number(votes[player.key]) === index).length;
        return { revealed: false, count, total: eligible.length, removed: !Object.prototype.hasOwnProperty.call(votes, me.key) };
      });

      if (result.revealed) showStatus('Все игроки подтвердили карточку — она раскрыта.');
      else if (result.removed) showStatus('Выбор карточки снят.');
      else showStatus(`Голос учтён: ${result.count}/${result.total}.`);
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
      .ev-cn-card.oc-cn-has-votes {
        isolation: isolate;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, .16), 0 14px 32px rgba(0, 0, 0, .34) !important;
      }
      .ev-cn-card.oc-cn-red-vote { box-shadow: 0 0 0 3px rgba(255, 74, 99, .72), 0 14px 34px rgba(255, 74, 99, .22) !important; }
      .ev-cn-card.oc-cn-blue-vote { box-shadow: 0 0 0 3px rgba(62, 191, 255, .72), 0 14px 34px rgba(62, 191, 255, .22) !important; }
      .ev-cn-card.oc-cn-my-vote::after {
        content: 'твой выбор';
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 5;
        padding: 4px 7px;
        border-radius: 999px;
        background: rgba(8, 217, 214, .92);
        color: #071313;
        font: 800 9px "Space Mono", monospace;
        letter-spacing: .04em;
        text-transform: uppercase;
      }
      .oc-cn-consensus-badge {
        position: absolute;
        z-index: 6;
        right: 8px;
        bottom: 8px;
        display: grid;
        max-width: calc(100% - 16px);
        gap: 2px;
        padding: 6px 8px;
        border: 1px solid rgba(255, 255, 255, .22);
        border-radius: 9px;
        background: rgba(10, 8, 15, .88);
        color: #fff;
        pointer-events: none;
        text-align: right;
        backdrop-filter: blur(8px);
      }
      .oc-cn-consensus-badge strong { font: 900 12px "Space Mono", monospace; }
      .oc-cn-consensus-badge span { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
      .ev-cn-card.oc-cn-unanimous { animation: ocCnConsensusPulse .65s ease-in-out infinite alternate; }
      .ev-cn-card.oc-cn-vote-pending { opacity: .72; pointer-events: none; }
      .oc-cn-consensus-status {
        margin-bottom: 12px;
        padding: 10px 12px;
        border: 1px solid rgba(8, 217, 214, .34);
        border-radius: 10px;
        background: rgba(8, 217, 214, .08);
        color: #8ff8ef;
        font-size: 12px;
      }
      .oc-cn-consensus-status.bad { border-color: rgba(255, 74, 99, .42); background: rgba(255, 74, 99, .09); color: #ff9cad; }
      @keyframes ocCnConsensusPulse {
        from { transform: translateY(0); }
        to { transform: translateY(-2px); }
      }
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

  new MutationObserver(scheduleDecorate).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('storage', event => {
    if (event.key === ROOM_SELECTION_KEY || event.key === NAME_KEY) void subscribeRoom(selectedRoomId());
  });

  installStyles();
  void subscribeRoom(selectedRoomId());
  window.setInterval(() => void subscribeRoom(selectedRoomId()), 500);
})();