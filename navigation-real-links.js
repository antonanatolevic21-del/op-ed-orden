(() => {
	if (window.__OC_NAVIGATION_REAL_LINKS_READY__) return;
	window.__OC_NAVIGATION_REAL_LINKS_READY__ = true;

	const MAIN_VIEWS = new Set(['chart', 'profile', 'top100', 'season', 'tier', 'stats', 'entity-studios', 'entity-performers', 'entity-directors', 'entity-franchises']);
	const EVENT_MODES = new Set(['rating', 'guess', 'bestworst', 'predictions', 'codenames', 'blindtier', 'whoami']);
	const EVENT_STAGES = new Set(['basket', 'first', 'semi', 'final']);

	function relativeUrl(file, params = {}) {
		const url = new URL(file, window.location.href);
		url.search = '';
		url.hash = '';
		Object.entries(params).forEach(([key, value]) => {
			if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
		});
		return `${url.pathname}${url.search}`;
	}

	function mainHref(view) {
		if (!MAIN_VIEWS.has(view) || view === 'chart') return relativeUrl('index.html');
		return relativeUrl('index.html', { view });
	}

	function eventModeHref(mode) {
		return relativeUrl('events.html', { mode: EVENT_MODES.has(mode) ? mode : 'rating' });
	}

	function eventStageHref(stage) {
		return relativeUrl('events.html', { mode: 'rating', stage: EVENT_STAGES.has(stage) ? stage : 'basket' });
	}

	function replaceButton(button, href) {
		if (!button || button.tagName === 'A') {
			if (button?.tagName === 'A' && href) button.href = href;
			return button;
		}
		const link = document.createElement('a');
		[...button.attributes].forEach(attribute => {
			if (attribute.name !== 'type') link.setAttribute(attribute.name, attribute.value);
		});
		link.innerHTML = button.innerHTML;
		link.href = href;
		link.dataset.navRealLink = '1';
		link.addEventListener('click', event => {
			const modified = event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
			if (!modified) event.preventDefault();
		});
		button.replaceWith(link);
		return link;
	}

	function convertMainNavigation() {
		document.querySelectorAll('.oc-tab-btn[data-tab]').forEach(button => {
			const view = String(button.dataset.tab || '');
			if (MAIN_VIEWS.has(view)) replaceButton(button, mainHref(view));
		});
	}

	function convertEventsNavigation() {
		document.querySelectorAll('.ev-mode-tab[data-mode]').forEach(button => {
			const mode = String(button.dataset.mode || 'rating');
			replaceButton(button, eventModeHref(mode));
		});
		document.querySelectorAll('.ev-tab[data-stage]').forEach(button => {
			const stage = String(button.dataset.stage || 'basket');
			replaceButton(button, eventStageHref(stage));
		});
	}

	// This listener is registered before the old deep-link handlers. Modified
	// clicks keep the anchor's native browser action, but never reach SPA click
	// handlers in the current tab.
	document.addEventListener('click', event => {
		const link = event.target?.closest?.('a[data-nav-real-link="1"]');
		if (!link) return;
		const modified = event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
		if (modified) event.stopImmediatePropagation();
	}, true);

	convertMainNavigation();
	convertEventsNavigation();
})();