(() => {
  if (window.__OC_MANUAL_TOP_INSERT_FIX_READY__) return;

  const clean = value => String(value || '').trim();
  let localDirty = false;
  let wasEditing = false;
  let expandTimer = 0;

  function viewedUser() {
    return clean(document.querySelector('#oc-profile-user')?.value || document.querySelector('#oc-myname')?.value);
  }

  function containerFor(type) {
    return document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op');
  }

  function cardId(card) {
    return clean(card?.querySelector('[data-action="set-rank"][data-id]')?.dataset.id);
  }

  function cardsFor(type) {
    return [...(containerFor(type)?.children || [])].filter(node => node.classList?.contains('oc-profile-item') && node.classList.contains('manual'));
  }

  function findCard(type, id) {
    return cardsFor(type).find(card => cardId(card) === clean(id)) || null;
  }

  function showMessage(message, type = '') {
    window.OC_TOAST?.show?.(message, { type });
    const status = document.querySelector('#oc-status');
    if (status) status.textContent = message;
  }

  function markDirty() {
    localDirty = true;
    document.querySelector('#oc-manual-save-btn')?.classList.add('active');
  }

  function removeEmptySlot(type) {
    containerFor(type)?.querySelector(':scope > .oc-manual-local-empty-slot')?.remove();
  }

  function ensureEmptySlot(type) {
    const container = containerFor(type);
    if (!container) return;
    removeEmptySlot(type);
    const cards = cardsFor(type);
    if (cards.length >= 100) return;
    const place = cards.length + 1;
    const slot = document.createElement('div');
    slot.className = 'oc-manual-local-empty-slot';
    slot.dataset.place = String(place);
    slot.innerHTML = `<span class="oc-manual-local-empty-rank">${place}</span><span class="oc-manual-local-empty-text">Пустое место</span>`;
    const expand = container.querySelector('[data-action="toggle-profile-top"]');
    if (expand) container.insertBefore(slot, expand);
    else container.append(slot);
  }

  function renumber(type) {
    const cards = cardsFor(type);
    cards.forEach((card, index) => {
      const rank = card.querySelector('[data-action="set-rank"]');
      if (rank) rank.textContent = String(index + 1);
      const up = card.querySelector('[data-action="move-up"]');
      const down = card.querySelector('[data-action="move-down"]');
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === cards.length - 1;
    });
    ensureEmptySlot(type);
  }

  function closeInsertPanel() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.querySelectorAll('.oc-manual-insert-zone.active').forEach(zone => zone.classList.remove('active'));
  }

  function makeLocalCard({ id, type, title, meta, score, image, fallback }) {
    const card = document.createElement('div');
    card.className = 'oc-profile-item manual oc-manual-local-card';
    const imageHtml = image
      ? `<span class="oc-image-link"><div class="oc-profile-thumb"><img class="oc-track-image" src="${image}" data-fallback="${fallback || ''}" alt="" loading="lazy" decoding="async"></div></span>`
      : `<span class="oc-image-link"><div class="oc-profile-thumb oc-manual-local-noimage">${type}</div></span>`;
    card.innerHTML = `
      <button type="button" class="oc-rank-jump-btn" data-action="set-rank" data-type="${type}" data-id="${id}">—</button>
      ${imageHtml}
      <div><div class="oc-profile-name"><span class="oc-clickable-title">${title}</span></div>${meta ? `<div class="oc-profile-meta">${meta}</div>` : ''}</div>
      <div class="oc-profile-score">${score || '—'}</div>
      <div class="oc-move-btns"><button class="oc-move-btn" data-action="move-up" data-type="${type}" data-id="${id}" title="Выше">▲</button><button class="oc-move-btn" data-action="move-down" data-type="${type}" data-id="${id}" title="Ниже">▼</button></div>
      <div class="oc-manual-row-actions"><button type="button" class="oc-ar-top-btn" data-action="remove-from-top" data-type="${type}" data-id="${id}" title="Убрать из текущего топ-100">Удалить из топа</button></div>`;
    return card;
  }

  function insertCardAt(type, card, targetPlace) {
    const container = containerFor(type);
    if (!container) return false;
    removeEmptySlot(type);
    const cards = cardsFor(type).filter(item => item !== card);
    card.remove();
    const target = Math.max(1, Math.min(100, Math.round(Number(targetPlace) || 1)));
    const reference = cards[target - 1] || container.querySelector('[data-action="toggle-profile-top"]') || null;
    if (reference) container.insertBefore(card, reference);
    else container.append(card);

    const after = cardsFor(type);
    if (after.length > 100) after[after.length - 1].remove();
    renumber(type);
    return true;
  }

  function localMove(type, id, targetPlace) {
    const card = findCard(type, id);
    if (!card) return false;
    const current = cardsFor(type).indexOf(card) + 1;
    const target = Math.max(1, Math.min(cardsFor(type).length, Math.round(Number(targetPlace) || current)));
    if (current === target) return false;
    return insertCardAt(type, card, target);
  }

  function localRemove(type, id) {
    const card = findCard(type, id);
    if (!card) return false;
    card.remove();
    renumber(type);
    return true;
  }

  function selectedCandidate(panel) {
    const selected = panel?.querySelector('.oc-manual-insert-result.selected');
    const preview = panel?.querySelector('.oc-manual-insert-preview');
    const img = selected?.querySelector('img') || preview?.querySelector('img');
    return {
      id: clean(selected?.dataset.id),
      title: clean(panel?.querySelector('.oc-manual-insert-preview-title')?.textContent),
      meta: clean(selected?.querySelector('.oc-manual-insert-result-meta')?.textContent),
      score: clean(selected?.querySelector('.oc-manual-insert-result-score')?.textContent),
      image: clean(img?.getAttribute('src')),
      fallback: clean(img?.dataset.fallback)
    };
  }

  function persistLocalMirror(user, payload) {
    try {
      const raw = JSON.parse(localStorage.getItem('manual-ranks') || '{}');
      const safe = window.OPED_DB?.normalizeNickname?.(user) || clean(user).toLowerCase();
      const existing = raw[user] || raw[safe] || {};
      const row = { ...existing, nickname: user, nicknameKey: safe, OP: payload.OP, ED: payload.ED, manualOP: payload.OP, manualED: payload.ED };
      raw[user] = row;
      if (safe && safe !== user) raw[safe] = row;
      localStorage.setItem('manual-ranks', JSON.stringify(raw));
    } catch (error) {
      console.warn('Could not mirror local top order', error);
    }
  }

  async function saveLocalOrder() {
    const user = viewedUser();
    if (!user) throw new Error('Не удалось определить пользователя.');
    const payload = {
      OP: cardsFor('OP').map(cardId).filter(Boolean).slice(0, 100),
      ED: cardsFor('ED').map(cardId).filter(Boolean).slice(0, 100)
    };
    if (!window.OPED_DB?.saveManualRanks) throw new Error('Сохранение топа сейчас недоступно.');
    await window.OPED_DB.saveManualRanks(user, payload);
    persistLocalMirror(user, payload);
    localDirty = false;
    document.querySelector('#oc-manual-save-btn')?.classList.remove('active');
  }

  function ensureExpanded() {
    if (!document.querySelector('#oc-manual-edit-btn')?.classList.contains('active')) return;
    ['OP', 'ED'].forEach(type => {
      const container = containerFor(type);
      const button = container?.querySelector('[data-action="toggle-profile-top"]');
      if (button && /Показать весь топ/i.test(clean(button.textContent))) button.click();
    });
  }

  function editingStateChanged() {
    const editing = Boolean(document.querySelector('#oc-manual-edit-btn')?.classList.contains('active'));
    if (editing === wasEditing) return;
    wasEditing = editing;
    if (!editing) {
      localDirty = false;
      document.querySelectorAll('.oc-manual-local-empty-slot').forEach(slot => slot.remove());
      return;
    }
    window.clearTimeout(expandTimer);
    expandTimer = window.setTimeout(() => {
      ensureExpanded();
      window.setTimeout(() => { renumber('OP'); renumber('ED'); }, 80);
    }, 0);
  }

  document.addEventListener('click', event => {
    const confirmButton = event.target.closest?.('.oc-manual-insert-confirm');
    if (!confirmButton) return;
    const panel = confirmButton.closest('.oc-manual-insert-panel');
    const zone = panel?.closest('.oc-manual-insert-zone');
    const type = clean(zone?.dataset.type);
    const target = Number(zone?.dataset.targetPlace);
    const candidate = selectedCandidate(panel);
    if (!panel || !candidate.id || !type || !Number.isFinite(target)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const currentCard = findCard(type, candidate.id);
    if (currentCard) {
      const current = cardsFor(type).indexOf(currentCard) + 1;
      if (current <= target) {
        showMessage(`Этот трек уже находится на ${current}-м месте или выше.`, 'error');
        return;
      }
      insertCardAt(type, currentCard, target);
    } else {
      const card = makeLocalCard({ ...candidate, type });
      insertCardAt(type, card, target);
    }

    closeInsertPanel();
    markDirty();
    showMessage(`${candidate.title}: локально поставлен на ${target}-е место.`, 'success');
  }, true);

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#oc-profile-op .oc-profile-item.manual [data-action], #oc-profile-ed .oc-profile-item.manual [data-action]');
    if (!button) return;
    const action = clean(button.dataset.action);
    if (!['remove-from-top', 'move-up', 'move-down', 'set-rank'].includes(action)) return;
    const type = clean(button.dataset.type);
    const id = clean(button.dataset.id);
    if (!type || !id) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (action === 'remove-from-top') {
      if (!window.confirm('Убрать из текущего топ-100? Оценка останется. Освободившееся место останется пустым внизу топа.')) return;
      if (localRemove(type, id)) {
        markDirty();
        showMessage('Удалено из топа локально. Нижнее место оставлено пустым.', 'success');
      }
      return;
    }

    const cards = cardsFor(type);
    const card = findCard(type, id);
    const current = cards.indexOf(card) + 1;
    if (!current) return;

    let target = current;
    if (action === 'move-up') target = current - 1;
    if (action === 'move-down') target = current + 1;
    if (action === 'set-rank') {
      const raw = window.prompt(`Введите место от 1 до ${cards.length}.`, String(current));
      if (raw === null) return;
      target = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(target)) return;
    }

    if (target < 1 || target > cards.length) return;
    if (localMove(type, id, target)) {
      markDirty();
      showMessage(`Место изменено локально: №${target}.`, 'success');
    }
  }, true);

  document.addEventListener('click', async event => {
    const button = event.target.closest?.('#oc-manual-save-btn');
    if (!button || !localDirty) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = 'Сохраняю…';
    try {
      await saveLocalOrder();
      showMessage('Топ-100 сохранён.', 'success');
    } catch (error) {
      showMessage(error?.message || 'Не удалось сохранить топ-100.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }, true);

  const observer = new MutationObserver(() => editingStateChanged());
  const profile = document.querySelector('#oc-profile-panel');
  if (profile) observer.observe(profile, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  editingStateChanged();

  window.__OC_MANUAL_TOP_INSERT_FIX_READY__ = true;
})();
