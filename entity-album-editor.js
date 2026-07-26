(() => {
  if (window.__OC_ENTITY_ALBUM_EDITOR_READY__) return;
  window.__OC_ENTITY_ALBUM_EDITOR_READY__ = true;

  let cards = [];
  let unsubscribe = null;
  let syncTimer = 0;

  const clean = value => String(value || '').trim();
  const isAdmin = () => clean(document.querySelector('#oc-access-badge')?.textContent).toLocaleLowerCase('ru') === 'админ';

  function cardById(id) {
    return cards.find(card => String(card?.id || '') === String(id || '')) || null;
  }

  async function saveBaseCard(card) {
    for (let attempt = 0; attempt < 120 && typeof window.OPED_DB?.saveEntityCard !== 'function'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (typeof window.OPED_DB?.saveEntityCard !== 'function') throw new Error('Сервис альбомов ещё не готов.');
    return window.OPED_DB.saveEntityCard(card);
  }

  function removeLegacyPositionField() {
    document.querySelector('#oc-entity-image-position')?.closest('.oc-entity-field')?.remove();
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
    removeLegacyPositionField();
    document.querySelectorAll('.oc-entity-card[data-entity-open]').forEach(article => {
      const card = cardById(article.getAttribute('data-entity-open'));
      if (!card) return;
      const image = article.querySelector('.oc-entity-cover img');
      if (image) {
        image.style.removeProperty('object-position');
        delete image.dataset.entityImagePosition;
      }
      ensureEditButton(article, card);
    });
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

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function openModal(card) {
    if (!card || !isAdmin()) return;
    const modal = ensureModal();
    const options = optionRowsForCard(card).map(value => `<option value="${escapeHtml(value)}"${value === clean(card.value) ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
    modal.innerHTML = `<div class="oc-entity-edit-dialog" data-entity-edit-id="${escapeHtml(card.id)}">
      <div class="oc-entity-edit-head">
        <div><div class="oc-section-label">редактирование альбома</div><h2>${escapeHtml(card.value)}</h2></div>
        <button type="button" class="oc-entity-edit-close" aria-label="Закрыть">×</button>
      </div>
      <div class="oc-entity-edit-preview-wrap">
        <div class="oc-entity-edit-preview"><img src="${escapeHtml(card.image || '')}" alt="Предпросмотр обложки"></div>
        <div class="oc-entity-edit-preview-note">Так обложка будет выглядеть в квадратной карточке альбома.</div>
      </div>
      <div class="oc-entity-edit-fields">
        <label><span>Объект альбома</span><select data-entity-edit-value>${options}</select></label>
        <label><span>Обложка</span><input data-entity-edit-image type="url" value="${escapeHtml(card.image || '')}" placeholder="https://…/cover.webp"></label>
      </div>
      <div class="oc-entity-edit-actions">
        <button type="button" class="oc-secondary-btn" data-entity-edit-cancel>Отмена</button>
        <button type="button" class="oc-addbtn oc-entity-edit-save" data-entity-edit-save>Сохранить изменения</button>
      </div>
    </div>`;
    modal.classList.remove('hidden');

    const imageInput = modal.querySelector('[data-entity-edit-image]');
    const preview = modal.querySelector('.oc-entity-edit-preview img');
    imageInput?.addEventListener('input', () => {
      if (preview) preview.src = clean(imageInput.value);
    });
  }

  async function saveModal(modal) {
    const dialog = modal.querySelector('[data-entity-edit-id]');
    const id = dialog?.dataset.entityEditId;
    const card = cardById(id);
    if (!card) return;

    const value = clean(modal.querySelector('[data-entity-edit-value]')?.value);
    const image = clean(modal.querySelector('[data-entity-edit-image]')?.value);
    if (!value || !image) {
      window.alert('Укажите объект альбома и ссылку на обложку.');
      return;
    }

    const save = modal.querySelector('[data-entity-edit-save]');
    if (save) {
      save.disabled = true;
      save.textContent = 'Сохраняю…';
    }

    try {
      const newId = await saveBaseCard({ type: card.type, value, image });
      if (String(newId) !== String(id) && typeof window.OPED_DB?.deleteEntityCard === 'function') {
        await window.OPED_DB.deleteEntityCard(id);
      }
      closeModal();
    } catch (error) {
      console.error('Entity album edit failed', error);
      window.alert('Не удалось сохранить изменения альбома.');
      if (save) {
        save.disabled = false;
        save.textContent = 'Сохранить изменения';
      }
    }
  }

  async function subscribeCards() {
    for (let attempt = 0; attempt < 120 && typeof window.OPED_DB?.watchEntityCards !== 'function'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (typeof window.OPED_DB?.watchEntityCards !== 'function') return;
    unsubscribe = window.OPED_DB.watchEntityCards(rows => {
      cards = Array.isArray(rows) ? rows : [];
      queueSync(0);
    });
  }

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

  removeLegacyPositionField();
  subscribeCards().catch(error => console.warn('Entity album editor failed', error));
  [100, 500, 1200, 2500].forEach(delay => window.setTimeout(() => queueSync(0), delay));
})();