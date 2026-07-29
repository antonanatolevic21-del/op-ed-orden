/* Generated entity route bundle. */
/* entity-album-editor.js */
(() => {
  if (window.__OC_ENTITY_ALBUM_EDITOR_READY__) return;
  window.__OC_ENTITY_ALBUM_EDITOR_READY__ = true;

  let cards = [];
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
  window.addEventListener('oped:entity-cards-updated', event => {
    cards = Array.isArray(event?.detail?.rows) ? event.detail.rows : [];
    queueSync(0);
  });
  window.addEventListener('oped:route-ready', event => {
    if (String(event?.detail?.tab || '').startsWith('entity-')) queueSync(0);
  });

  removeLegacyPositionField();
  cards = Array.isArray(window.OC_APP_DATA?.entityCards) ? window.OC_APP_DATA.entityCards : [];
  queueSync(0);
})();

/* entity-real-links.js */
(() => {
	if (window.__OC_ENTITY_REAL_LINKS_READY__) return;
	window.__OC_ENTITY_REAL_LINKS_READY__ = true;

	let syncTimer = 0;
	const clean = value => String(value || '').trim();

	function currentEntityType() {
		const active = document.querySelector('.oc-tab-btn.active[data-tab^="entity-"]');
		if (active?.dataset.tab) return clean(active.dataset.tab).replace(/^entity-/, '');
		const view = new URL(window.location.href).searchParams.get('view') || '';
		return view.startsWith('entity-') ? view.slice('entity-'.length) : '';
	}

	function albumHref(id) {
		const type = currentEntityType();
		if (!type || !id) return '';
		const url = new URL(window.location.href);
		url.search = '';
		url.hash = '';
		url.searchParams.set('view', `entity-${type}`);
		url.searchParams.set('album', String(id));
		return `${url.pathname}${url.search}`;
	}

	function syncBackUrl() {
		const url = new URL(window.location.href);
		const view = clean(url.searchParams.get('view'));
		if (url.searchParams.has('album')) {
			url.searchParams.delete('album');
			url.searchParams.delete('track');
		} else if (view.startsWith('entity-')) {
			url.searchParams.delete('view');
			url.searchParams.delete('album');
			url.searchParams.delete('track');
		}
		window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
	}

	function syncLinks() {
		window.clearTimeout(syncTimer);
		document.querySelectorAll('.oc-entity-card[data-entity-open]').forEach(card => {
			const id = clean(card.getAttribute('data-entity-open'));
			if (!id) return;
			let link = card.querySelector(':scope > .oc-entity-card-link');
			if (!link) {
				link = document.createElement('a');
				link.className = 'oc-entity-card-link';
				card.prepend(link);
			}
			link.href = albumHref(id);
			link.dataset.entityAlbumLink = id;
			const title = clean(card.querySelector('.oc-entity-card-body h3')?.textContent);
			link.setAttribute('aria-label', title ? `Открыть альбом «${title}»` : 'Открыть альбом');
			link.title = title ? `Открыть «${title}»` : 'Открыть альбом';
		});
	}

	function queueSync(delay = 0) {
		window.clearTimeout(syncTimer);
		syncTimer = window.setTimeout(syncLinks, delay);
	}

	// Ordinary left click stays inside the SPA. Modified clicks retain native
	// anchor behaviour and must not trigger the old delegated album opener in
	// the current tab.
	document.addEventListener('click', event => {
		if (event.target?.closest?.('#oc-entity-back')) {
			syncBackUrl();
			return;
		}

		const link = event.target?.closest?.('a.oc-entity-card-link[data-entity-album-link]');
		if (!link) return;
		const modified = event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
		if (modified) {
			event.stopImmediatePropagation();
			return;
		}
		event.preventDefault();
	}, true);

	new MutationObserver(() => queueSync(20)).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-tab'] });
	window.addEventListener('popstate', () => queueSync(0));
	window.addEventListener('oped:route-ready', event => {
		if (String(event?.detail?.tab || '').startsWith('entity-')) queueSync(0);
	});
	window.addEventListener('oped:entity-cards-updated', () => queueSync(0));
	queueSync(0);
})();
