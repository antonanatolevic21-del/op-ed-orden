(() => {
  if (window.__OC_ENTITY_ALBUM_EDITOR_READY__) return;
  window.__OC_ENTITY_ALBUM_EDITOR_READY__ = true;

  const POSITION_LABELS = { top: 'Верх', center: 'Центр', bottom: 'Низ' };
  const POSITION_CSS = { top: '50% 0%', center: '50% 50%', bottom: '50% 100%' };
  let cards = [];
  let unsubscribe = null;
  let pendingCreate = null;
  let syncTimer = 0;

  const clean = value => String(value || '').trim();
  const normalizePosition = value => ['top', 'center', 'bottom'].includes(String(value || '')) ? String(value) : 'center';
  const isAdmin = () => clean(document.querySelector('#oc-access-badge')?.textContent).toLocaleLowerCase('ru') === 'админ';
  const activeType = () => clean(document.querySelector('.oc-tab-btn.active[data-tab^="entity-"]')?.dataset.tab).replace(/^entity-/, '');

  function cardById(id) {
    return cards.find(card => String(card?.id || '') === String(id || '')) || null;
  }

  function ensureCreatePositionField() {
    const form = document.querySelector('#oc-entity-create');
    const image = document.querySelector('#oc-entity-image');
    if (!form || !image || form.querySelector('#oc-entity-image-position')) return;
    const fields = form.querySelector('.oc-entity-form-fields');
    const createButton = fields?.querySelector('.oc-entity-create-btn');
    if (!fields || !createButton) return;

    const label = document.createElement('label');
    label.className = 'oc-entity-field oc-entity-position-field';
    label.innerHTML = '<span>Показывать</span><select id="oc-entity-image-position" aria-label="Положение обложки"><option value="top">Верх картинки</option><option value="center" selected>Центр картинки</option><option value="bottom">Низ картинки</option></select>';
    fields.insertBefore(label, createButton);
  }

  async function firebaseTools() {
    const [{ getApp, getApps }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
    ]);
    for (let attempt = 0; attempt < 120 && !getApps().length; attempt += 1) await new Promise(resolve => setTimeout(resolve, 50));
    if (!getApps().length) throw new Error('Firebase ещё не готов.');
    const app = getApp();
    return { db: firestore.getFirestore(app), ...firestore };
  }

  async function patchCard(id, patch) {
    if (!id) throw new Error('Не удалось определить альбом.');
    const tools = await firebaseTools();
    await tools.setDoc(tools.doc(tools.db, 'entityCards', String(id)), {
      ...patch,
      updatedAt: tools.serverTimestamp()
    }, { merge: true });
  }

  async function saveBaseCard(card) {
    for (let attempt = 0; attempt < 120 && typeof window.OPED_DB?.saveEntityCard !== 'function'; attempt += 1) await new Promise(resolve => setTimeout(resolve, 50));
    if (typeof window.OPED_DB?.saveEntityCard !== 'function') throw new Error('Сервис альбомов ещё не готов.');
    return window.OPED_DB.saveEntityCard(card);
  }

  async function patchPendingCreate() {
    if (!pendingCreate || !cards.length) return;
    const match = cards.find(card =>
      String(card?.type || '') === pendingCreate.type &&
      clean(card?.value) === pendingCreate.value &&
      clean(card?.image) === pendingCreate.image
    );
    if (!match) return;
    const desired = normalizePosition(pendingCreate.imagePosition);
    pendingCreate = null;
    if (normalizePosition(match.imagePosition) === desired && match.imagePosition) return;
    try {
      await patchCard(match.id, { imagePosition: desired });
    } catch (error) {
      console.warn('Entity cover position save failed', error);
    }
  }

  function applyCoverPosition(article, card) {
    const image = article.querySelector('.oc-entity-cover img');
    if (!image) return;
    const position = normalizePosition(card?.imagePosition);
    image.style.setProperty('object-position', POSITION_CSS[position], 'important');
    image.dataset.entityImagePosition = position;
  }

  function ensureEditButton(article, card) {
    let button = article.querySelector('.oc-entity-edit');
    if (!isAdmin()) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'oc-entity-edit';
      button.textContent = '✎';
      button.title = 'Редактировать альбом';
      button.setAttribute('aria-label', 'Редактировать альбом');
      article.append(button);
    }
    button.dataset.entityEdit = String(card.id || '');
  }

  function syncCards() {
    window.clearTimeout(syncTimer);
    ensureCreatePositionField();
    document.querySelectorAll('.oc-entity-card[data-entity-open]').forEach(article => {
      const id = article.getAttribute('data-entity-open');
      const card = cardById(id);
      if (!card) return;
      applyCoverPosition(article, card);
      ensureEditButton(article, card);
    });
    void patchPendingCreate();
  }

  function queueSync(delay = 0) {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(syncCards, delay);
  }

  function optionRowsForCard(card) {
    const rows = new Map();
    if (card?.value) rows.set(clean(card.value).toLocaleLowerCase('ru'), clean(card.value));
    document.querySelectorAll('#oc-entity-value option').forEach(option => {
      const value = clean(option.value);
      if (value) rows.set(value.toLocaleLowerCase('ru'), value);
    });
    return [...rows.values()].sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function ensureModal() {
    let modal = document.querySelector('#oc-entity-edit-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'oc-entity-edit-modal';
    modal.className = 'oc-entity-edit-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    document.body.append(modal);
    return modal;
  }

  function closeModal() {
    const modal = ensureModal();
    modal.classList.add('hidden');
    modal.replaceChildren();
  }

  function openModal(card) {
    if (!card || !isAdmin()) return;
    const modal = ensureModal();
    const position = normalizePosition(card.imagePosition);
    const options = optionRowsForCard(card).map(value => `<option value="${escapeHtml(value)}"${value === clean(card.value) ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
    modal.innerHTML = `<div class="oc-entity-edit-dialog" data-entity-edit-id="${escapeHtml(card.id)}">
      <div class="oc-entity-edit-head"><div><div class="oc-section-label">редактирование альбома</div><h2>${escapeHtml(card.value)}</h2></div><button type="button" class="oc-entity-edit-close" aria-label="Закрыть">×</button></div>
      <div class="oc-entity-edit-preview"><img src="${escapeHtml(card.image || '')}" alt="" style="object-position:${POSITION_CSS[position]}"></div>
      <div class="oc-entity-edit-fields">
        <label><span>Объект альбома</span><select data-entity-edit-value>${options}</select></label>
        <label><span>Обложка</span><input data-entity-edit-image type="url" value="${escapeHtml(card.image || '')}" placeholder="https://…/cover.webp"></label>
        <label><span>Показывать</span><select data-entity-edit-position>${Object.entries(POSITION_LABELS).map(([key, label]) => `<option value="${key}"${key === position ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
      </div>
      <div class="oc-entity-edit-actions"><button type="button" class="oc-secondary-btn" data-entity-edit-cancel>Отмена</button><button type="button" class="oc-addbtn" data-entity-edit-save>Сохранить</button></div>
    </div>`;
    modal.classList.remove('hidden');
    const imageInput = modal.querySelector('[data-entity-edit-image]');
    const positionSelect = modal.querySelector('[data-entity-edit-position]');
    const preview = modal.querySelector('.oc-entity-edit-preview img');
    const refreshPreview = () => {
      if (!preview) return;
      preview.src = clean(imageInput?.value);
      preview.style.objectPosition = POSITION_CSS[normalizePosition(positionSelect?.value)];
    };
    imageInput?.addEventListener('input', refreshPreview);
    positionSelect?.addEventListener('change', refreshPreview);
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  async function saveModal(modal) {
    const dialog = modal.querySelector('[data-entity-edit-id]');
    const id = dialog?.dataset.entityEditId;
    const card = cardById(id);
    if (!card) return;
    const value = clean(modal.querySelector('[data-entity-edit-value]')?.value);
    const image = clean(modal.querySelector('[data-entity-edit-image]')?.value);
    const imagePosition = normalizePosition(modal.querySelector('[data-entity-edit-position]')?.value);
    if (!value || !image) {
      window.alert('Укажите объект альбома и ссылку на обложку.');
      return;
    }
    const save = modal.querySelector('[data-entity-edit-save]');
    if (save) { save.disabled = true; save.textContent = 'Сохраняю…'; }
    try {
      const newId = await saveBaseCard({ type: card.type, value, image });
      await patchCard(newId, { imagePosition });
      if (String(newId) !== String(id) && typeof window.OPED_DB?.deleteEntityCard === 'function') await window.OPED_DB.deleteEntityCard(id);
      closeModal();
    } catch (error) {
      console.error('Entity album edit failed', error);
      window.alert('Не удалось сохранить изменения альбома.');
      if (save) { save.disabled = false; save.textContent = 'Сохранить'; }
    }
  }

  async function subscribeCards() {
    for (let attempt = 0; attempt < 120 && typeof window.OPED_DB?.watchEntityCards !== 'function'; attempt += 1) await new Promise(resolve => setTimeout(resolve, 50));
    if (typeof window.OPED_DB?.watchEntityCards !== 'function') return;
    unsubscribe = window.OPED_DB.watchEntityCards(rows => {
      cards = Array.isArray(rows) ? rows : [];
      queueSync(0);
    });
  }

  document.addEventListener('submit', event => {
    if (event.target?.id !== 'oc-entity-create') return;
    pendingCreate = {
      type: activeType(),
      value: clean(document.querySelector('#oc-entity-value')?.value),
      image: clean(document.querySelector('#oc-entity-image')?.value),
      imagePosition: normalizePosition(document.querySelector('#oc-entity-image-position')?.value)
    };
  }, true);

  document.addEventListener('click', event => {
    const edit = event.target?.closest?.('[data-entity-edit]');
    if (edit) {
      event.preventDefault();
      event.stopPropagation();
      openModal(cardById(edit.dataset.entityEdit));
      return;
    }
    const modal = event.target?.closest?.('#oc-entity-edit-modal');
    if (!modal) return;
    if (event.target === modal || event.target.closest('.oc-entity-edit-close, [data-entity-edit-cancel]')) {
      closeModal();
      return;
    }
    if (event.target.closest('[data-entity-edit-save]')) void saveModal(modal);
  }, true);

  new MutationObserver(() => queueSync(30)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('beforeunload', () => { try { unsubscribe?.(); } catch (_) {} }, { once: true });

  ensureCreatePositionField();
  subscribeCards().catch(error => console.warn('Entity album editor failed', error));
  [100, 500, 1200, 2500].forEach(delay => window.setTimeout(() => queueSync(0), delay));
})();
