(() => {
	if (window.__OC_TOP100_RANK_READABILITY_READY__) return;
	window.__OC_TOP100_RANK_READABILITY_READY__ = true;

	const normalize = value => ({ '①': '1', '②': '2', '③': '3' }[String(value || '').trim()] || String(value || '').trim());
	let timer = 0;

	function syncRanks() {
		window.clearTimeout(timer);
		const selectors = [
			'#oc-profile-panel[data-profile-view="top100"] .oc-profile-rank',
			'#oc-profile-panel[data-profile-view="top100"] .oc-rank-jump-btn',
			'#oc-globaltop-list .oc-profile-rank'
		].join(',');
		document.querySelectorAll(selectors).forEach(rank => {
			const value = normalize(rank.textContent);
			if (value && rank.textContent.trim() !== value) rank.textContent = value;
			if (value) {
				rank.dataset.top100Place = value;
				rank.setAttribute('aria-label', `Место ${value}`);
				if (!rank.title) rank.title = `Место ${value}`;
			}
		});
	}

	function queueSync(delay = 0) {
		window.clearTimeout(timer);
		timer = window.setTimeout(syncRanks, delay);
	}

	new MutationObserver(() => queueSync(25)).observe(document.documentElement, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
		attributeFilter: ['data-profile-view', 'class']
	});

	document.addEventListener('click', () => queueSync(0), true);
	window.addEventListener('oped:route-ready', event => {
		if (event?.detail?.tab === 'top100' || event?.detail?.tab === 'profile') queueSync(0);
	});
	window.addEventListener('oped:data-ready', event => {
		if (event?.detail?.source === 'manualRanks' || event?.detail?.source === 'ratings') queueSync(0);
	});
	queueSync(0);
})();
