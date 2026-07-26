(() => {
	if (window.__OC_NAVIGATION_REAL_LINKS_READY__) return;
	window.__OC_NAVIGATION_REAL_LINKS_READY__ = true;

	const MAIN_VIEWS = new Set(['chart', 'profile', 'top100', 'season', 'tier', 'stats', 'entity-studios', 'entity-performers', 'entity-directors', 'entity-franchises']);
	const EVENT_MODES = new Set(['rating', 'guess', 'bestworst', 'predictions', 'codenames', 'blindtier', 'whoami']);
	const EVENT_STAGES = new Set(['basket', 'first', 'semi', 'final']);
	let routeTimers = [];

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

	function isModifiedClick(event) {
		return event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
	}

	// Must be registered before deep-links.js: its capture listener would otherwise
	// rewrite the current tab URL even when Ctrl/middle-click is meant for a new tab.
	document.addEventListener('click', event => {
		const link = event.target?.closest?.('a.oc-nav-real-hit[data-nav-real-link="1"]');
		if (link && isModifiedClick(event)) event.stopImmediatePropagation();
	}, true);

	function installOverlayLink(button, href) {
		if (!button || button.tagName !== 'BUTTON' || !href) return;
		button.classList.add('oc-nav-real-host');
		let link = button.querySelector(':scope > .oc-nav-real-hit');
		if (!link) {
			link = document.createElement('a');
			link.className = 'oc-nav-real-hit';
			link.dataset.navRealLink = '1';
			link.tabIndex = -1;
			button.append(link);
			link.addEventListener('click', event => {
				if (isModifiedClick(event)) return;
				event.preventDefault();
				event.stopImmediatePropagation();
				button.click();
			});
			link.addEventListener('auxclick', event => {
				if (event.button === 1) event.stopPropagation();
			});
		}
		link.href = href;
		const label = String(button.textContent || '').trim();
		link.setAttribute('aria-label', label ? `Открыть «${label}»` : 'Открыть раздел');
		link.title = label;
	}

	function syncLinks() {
		document.querySelectorAll('.oc-tab-btn[data-tab]').forEach(button => {
			const view = String(button.dataset.tab || '');
			if (MAIN_VIEWS.has(view)) installOverlayLink(button, mainHref(view));
		});
		document.querySelectorAll('.ev-mode-tab[data-mode]').forEach(button => {
			const mode = String(button.dataset.mode || 'rating');
			installOverlayLink(button, eventModeHref(mode));
		});
		document.querySelectorAll('.ev-tab[data-stage]').forEach(button => {
			const stage = String(button.dataset.stage || 'basket');
			installOverlayLink(button, eventStageHref(stage));
		});
	}

	function applyRequestedRoute() {
		const params = new URL(window.location.href).searchParams;
		if (document.querySelector('#opedchart-root')) {
			const view = String(params.get('view') || '');
			if (MAIN_VIEWS.has(view)) {
				const button = document.querySelector(`.oc-tab-btn[data-tab="${CSS.escape(view)}"]`);
				if (button && !button.classList.contains('active')) button.click();
			}
		}
		if (document.querySelector('.ev-root')) {
			const mode = String(params.get('mode') || 'rating');
			if (EVENT_MODES.has(mode)) {
				const button = document.querySelector(`.ev-mode-tab[data-mode="${CSS.escape(mode)}"]`);
				if (button && !button.classList.contains('active')) button.click();
			}
			const stage = String(params.get('stage') || '');
			if ((mode || 'rating') === 'rating' && EVENT_STAGES.has(stage)) {
				const button = document.querySelector(`.ev-tab[data-stage="${CSS.escape(stage)}"]`);
				if (button && !button.classList.contains('active')) button.click();
			}
		}
	}

	function scheduleRouteSync() {
		routeTimers.forEach(timer => clearTimeout(timer));
		routeTimers = [0, 80, 180, 350, 700, 1200, 2200, 3500, 5500, 8000].map(delay => setTimeout(() => {
			syncLinks();
			applyRequestedRoute();
		}, delay));
	}

	new MutationObserver(() => syncLinks()).observe(document.documentElement, { childList: true, subtree: true });
	window.addEventListener('oped-account-restored', scheduleRouteSync);
	window.addEventListener('oped-db-ready', scheduleRouteSync);
	window.addEventListener('pageshow', scheduleRouteSync);
	window.addEventListener('popstate', scheduleRouteSync);
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleRouteSync, { once: true });
	else scheduleRouteSync();
})();