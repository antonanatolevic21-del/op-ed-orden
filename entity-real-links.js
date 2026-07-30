(() => {
	if (window.__OC_ENTITY_REAL_LINKS_READY__) return;
	window.__OC_ENTITY_REAL_LINKS_READY__ = true;

	let syncTimer = 0;
	const clean = value => String(value || '').trim();
	const loadingGif = 'https://www.image2url.com/r2/default/gifs/1785398081496-70cb3d2d-c6f9-49e7-9840-d635f8c2157e.gif';

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

	function syncAlbumPlaceholders() {
		if (window.OC_CATALOG_ADMIN_WORKSPACE === true) return;
		const grid = document.querySelector('#oc-entity-grid');
		if (!grid) return;

		const empty = grid.querySelector(':scope > .oc-empty');
		if (empty && clean(empty.textContent) === 'Альбомов пока нет.') {
			empty.className = 'oc-inline-loader oc-inline-loader-compact oc-entity-gif-placeholder';
			empty.setAttribute('role', 'status');
			empty.setAttribute('aria-label', 'Загрузка альбомов');
			empty.innerHTML = `<img src="${loadingGif}" alt="Загрузка альбомов" referrerpolicy="no-referrer" />`;
		}

		grid.querySelectorAll('.oc-progressive-more[data-progressive-more="entity-cards"]').forEach(button => {
			if (button.classList.contains('oc-progressive-more-gif')) return;
			const label = clean(button.textContent) || 'Загрузить ещё альбомы';
			button.classList.add('oc-progressive-more-gif');
			button.setAttribute('aria-label', label);
			button.title = label;
			button.innerHTML = `<img src="${loadingGif}" alt="" referrerpolicy="no-referrer" />`;
		});
	}

	function syncLinks() {
		window.clearTimeout(syncTimer);
		syncAlbumPlaceholders();
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
