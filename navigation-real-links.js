(() => {
	if (window.__OC_NAVIGATION_REAL_LINKS_READY__) return;
	window.__OC_NAVIGATION_REAL_LINKS_READY__ = true;

	const MAIN_VIEWS = new Set(['chart', 'profile', 'top100', 'season', 'tier', 'stats', 'entity-studios', 'entity-performers', 'entity-directors', 'entity-franchises']);
	const ENTITY_VIEWS = new Set(['entity-studios', 'entity-performers', 'entity-directors', 'entity-franchises']);
	const EVENT_MODES = new Set(['rating', 'guess', 'bestworst', 'predictions', 'codenames', 'blindtier', 'whoami']);
	const EVENT_STAGES = new Set(['basket', 'first', 'semi', 'final']);
	const MAIN_ACCESS_KEY = 'op-ed-access-level';
	const EVENT_ACCESS_KEY = 'event-access-level';
	const STARTED_AT = Date.now();
	const ROUTE_CLASS_PREFIX = 'oc-route-view-';
	let routeTimers = [];
	let deferredMainAuth = false;
	let deferredEventAuth = false;
	let eventQuietSince = 0;

	function params() {
		return new URL(window.location.href).searchParams;
	}

	function relativeUrl(file, nextParams = {}) {
		const url = new URL(file, window.location.href);
		url.search = '';
		url.hash = '';
		Object.entries(nextParams).forEach(([key, value]) => {
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

	function fastMainAccess() {
		try { return Boolean(sessionStorage.getItem(MAIN_ACCESS_KEY)); } catch (_) { return false; }
	}

	function fastEventAccess() {
		try { return ['user', 'admin', 'guest'].includes(String(localStorage.getItem(EVENT_ACCESS_KEY) || '')); } catch (_) { return false; }
	}

	function accountResolved() {
		return window.__OC_ACCOUNT_RESTORE_DONE__ === true;
	}

	function mainDataReady() {
		const years = document.querySelector('#oc-f-from-year');
		const list = document.querySelector('#oc-list-container');
		const listText = String(list?.textContent || '');
		return Boolean((years?.options?.length || 0) > 1 && list && !/Загрузка списка/i.test(listText));
	}

	function eventsDataReady() {
		const app = document.querySelector('#ev-app');
		if (!app || /Загрузка ивентов/i.test(String(app.textContent || ''))) return false;
		if (!eventQuietSince) eventQuietSince = Date.now();
		return Date.now() - eventQuietSince >= 900;
	}

	function startupFallbackReady() {
		return Date.now() - STARTED_AT >= 8000;
	}

	function isModifiedClick(event) {
		return event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
	}

	function replaceCurrentUrl(href, push = true) {
		if (!href) return;
		const current = `${window.location.pathname}${window.location.search}`;
		if (current === href) return;
		window.history[push ? 'pushState' : 'replaceState']({}, '', href);
	}

	function wrapButton(button) {
		if (!button || button.tagName !== 'BUTTON') return null;
		let wrap = button.parentElement?.classList.contains('oc-nav-real-wrap') ? button.parentElement : null;
		if (!wrap) {
			wrap = document.createElement('span');
			wrap.className = 'oc-nav-real-wrap';
			button.before(wrap);
			wrap.append(button);
		}
		return wrap;
	}

	function installOverlayLink(button, href) {
		const wrap = wrapButton(button);
		if (!wrap || !href) return;
		let link = wrap.querySelector(':scope > .oc-nav-real-hit');
		if (!link) {
			link = document.createElement('a');
			link.className = 'oc-nav-real-hit';
			link.dataset.navRealLink = '1';
			wrap.append(link);
			link.addEventListener('click', event => {
				if (isModifiedClick(event)) return;
				event.preventDefault();
				event.stopImmediatePropagation();
				const host = link.parentElement?.querySelector('button');
				if (!host) return;
				replaceCurrentUrl(link.getAttribute('href') || '', true);
				if (host.matches('.oc-tab-btn[data-tab]')) {
					previewMainRoute(String(host.dataset.tab || 'chart'));
					if (canActivateMainRoute(String(host.dataset.tab || 'chart'))) host.click();
					else scheduleRouteSync();
					return;
				}
				if (host.matches('.ev-mode-tab[data-mode]')) {
					previewEventRoute(String(host.dataset.mode || 'rating'), '');
					if (canActivateEventRoute()) host.click();
					else scheduleRouteSync();
					return;
				}
				if (host.matches('.ev-tab[data-stage]')) {
					previewEventRoute('rating', String(host.dataset.stage || 'basket'));
					if (canActivateEventRoute()) host.click();
					else scheduleRouteSync();
				}
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

	// Modified clicks must remain native links and must not reach deep-link capture handlers
	// that could rewrite the URL of the current tab.
	document.addEventListener('click', event => {
		const link = event.target?.closest?.('a.oc-nav-real-hit[data-nav-real-link="1"]');
		if (link && isModifiedClick(event)) event.stopImmediatePropagation();
	}, true);

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

	function clearRouteClasses() {
		[...document.documentElement.classList].forEach(name => {
			if (name.startsWith(ROUTE_CLASS_PREFIX)) document.documentElement.classList.remove(name);
		});
		document.documentElement.classList.remove('oc-route-previewing');
		document.querySelectorAll('.oc-route-preview-active').forEach(element => element.classList.remove('oc-route-preview-active'));
	}

	function previewMainRoute(view) {
		if (!MAIN_VIEWS.has(view) || view === 'chart') {
			clearRouteClasses();
			return;
		}
		clearRouteClasses();
		document.documentElement.classList.add('oc-route-previewing', `${ROUTE_CLASS_PREFIX}${view}`);
		document.querySelector(`.oc-tab-btn[data-tab="${CSS.escape(view)}"]`)?.classList.add('oc-route-preview-active');
		if (ENTITY_VIEWS.has(view)) {
			const type = view.replace('entity-', '');
			document.querySelector(`[data-entity-home="${CSS.escape(type)}"]`)?.classList.add('oc-route-preview-active');
		}
	}

	function previewEventRoute(mode, stage) {
		document.querySelectorAll('.ev-mode-tab.oc-route-preview-active,.ev-tab.oc-route-preview-active').forEach(element => element.classList.remove('oc-route-preview-active'));
		if (EVENT_MODES.has(mode)) document.querySelector(`.ev-mode-tab[data-mode="${CSS.escape(mode)}"]`)?.classList.add('oc-route-preview-active');
		if ((mode || 'rating') === 'rating' && EVENT_STAGES.has(stage)) document.querySelector(`.ev-tab[data-stage="${CSS.escape(stage)}"]`)?.classList.add('oc-route-preview-active');
	}

	function requestedMainView() {
		if (!document.querySelector('#opedchart-root')) return '';
		const urlParams = params();
		if (urlParams.get('track')) return 'chart';
		const view = String(urlParams.get('view') || 'chart');
		return MAIN_VIEWS.has(view) ? view : 'chart';
	}

	function canActivateMainRoute(view) {
		if (!view || view === 'chart') return true;
		if (fastMainAccess()) return true;
		return accountResolved() && (mainDataReady() || startupFallbackReady());
	}

	function realMainRouteSatisfied(view) {
		if (!view || view === 'chart') return document.querySelector('.oc-tab-btn[data-tab="chart"]')?.classList.contains('active') || false;
		if (ENTITY_VIEWS.has(view)) return !document.querySelector('#oc-entity-panel')?.classList.contains('hidden');
		return document.querySelector(`.oc-tab-btn[data-tab="${CSS.escape(view)}"]`)?.classList.contains('active') || false;
	}

	function applyRequestedMainRoute() {
		const view = requestedMainView();
		if (!view || view === 'chart') return;
		previewMainRoute(view);
		if (!canActivateMainRoute(view)) return;
		let target = document.querySelector(`.oc-tab-btn[data-tab="${CSS.escape(view)}"]`);
		if (!target && ENTITY_VIEWS.has(view)) {
			const type = view.replace('entity-', '');
			target = document.querySelector(`[data-entity-home="${CSS.escape(type)}"]`);
		}
		if (target && !realMainRouteSatisfied(view)) target.click();
		if (realMainRouteSatisfied(view)) clearRouteClasses();
	}

	function canActivateEventRoute() {
		if (fastEventAccess()) return true;
		return accountResolved() && (eventsDataReady() || startupFallbackReady());
	}

	function applyRequestedEventRoute() {
		if (!document.querySelector('.ev-root')) return;
		const urlParams = params();
		const mode = EVENT_MODES.has(String(urlParams.get('mode') || '')) ? String(urlParams.get('mode')) : 'rating';
		const stage = EVENT_STAGES.has(String(urlParams.get('stage') || '')) ? String(urlParams.get('stage')) : '';
		previewEventRoute(mode, stage);
		if (!canActivateEventRoute()) return;
		const modeButton = document.querySelector(`.ev-mode-tab[data-mode="${CSS.escape(mode)}"]`);
		if (modeButton && !modeButton.classList.contains('active')) modeButton.click();
		if (mode === 'rating' && stage) {
			const stageButton = document.querySelector(`.ev-tab[data-stage="${CSS.escape(stage)}"]`);
			if (stageButton && !stageButton.classList.contains('active')) stageButton.click();
		}
		document.querySelectorAll('.ev-mode-tab.oc-route-preview-active,.ev-tab.oc-route-preview-active').forEach(element => element.classList.remove('oc-route-preview-active'));
	}

	function deferStartupAuthModal(modal, kind) {
		if (!modal || Date.now() - STARTED_AT > 12000) return;
		const isMain = kind === 'main';
		const hasAccess = isMain ? fastMainAccess() : fastEventAccess();
		const ready = isMain ? mainDataReady() : eventsDataReady();
		if (hasAccess) {
			if (isMain) deferredMainAuth = false;
			else deferredEventAuth = false;
			return;
		}
		if (!modal.classList.contains('hidden') && (!accountResolved() || !ready)) {
			modal.classList.add('hidden');
			if (isMain) deferredMainAuth = true;
			else deferredEventAuth = true;
		}
	}

	function flushDeferredAuth() {
		const mainModal = document.querySelector('#oc-auth-modal');
		if (deferredMainAuth) {
			if (fastMainAccess()) deferredMainAuth = false;
			else if (accountResolved() && (mainDataReady() || startupFallbackReady()) && mainModal) {
				mainModal.classList.remove('hidden');
				deferredMainAuth = false;
			}
		}
		const eventModal = document.querySelector('#ev-auth-modal');
		if (deferredEventAuth) {
			if (fastEventAccess()) deferredEventAuth = false;
			else if (accountResolved() && (eventsDataReady() || startupFallbackReady()) && eventModal) {
				eventModal.classList.remove('hidden');
				deferredEventAuth = false;
			}
		}
	}

	function bindAuthDeferral() {
		const mainModal = document.querySelector('#oc-auth-modal');
		if (mainModal && mainModal.dataset.navAuthDeferral !== '1') {
			mainModal.dataset.navAuthDeferral = '1';
			new MutationObserver(() => deferStartupAuthModal(mainModal, 'main')).observe(mainModal, { attributes: true, attributeFilter: ['class'] });
		}
		const eventModal = document.querySelector('#ev-auth-modal');
		if (eventModal && eventModal.dataset.navAuthDeferral !== '1') {
			eventModal.dataset.navAuthDeferral = '1';
			new MutationObserver(() => deferStartupAuthModal(eventModal, 'events')).observe(eventModal, { attributes: true, attributeFilter: ['class'] });
		}
	}

	function syncEverything() {
		syncLinks();
		bindAuthDeferral();
		applyRequestedMainRoute();
		applyRequestedEventRoute();
		flushDeferredAuth();
	}

	function scheduleRouteSync() {
		routeTimers.forEach(timer => clearTimeout(timer));
		routeTimers = [0, 60, 140, 280, 500, 850, 1300, 2000, 3200, 5000, 8000].map(delay => setTimeout(syncEverything, delay));
	}

	new MutationObserver(records => {
		let eventAppChanged = false;
		for (const record of records) {
			if (record.target?.closest?.('#ev-app') || [...record.addedNodes].some(node => node instanceof Element && (node.id === 'ev-app' || node.closest?.('#ev-app')))) eventAppChanged = true;
		}
		if (eventAppChanged) eventQuietSince = Date.now();
		syncLinks();
		bindAuthDeferral();
	}).observe(document.documentElement, { childList: true, subtree: true });

	window.addEventListener('oped-account-restored', scheduleRouteSync);
	window.addEventListener('oped-db-ready', scheduleRouteSync);
	window.addEventListener('pageshow', scheduleRouteSync);
	window.addEventListener('popstate', scheduleRouteSync);
	document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRouteSync(); });
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleRouteSync, { once: true });
	else scheduleRouteSync();
})();
