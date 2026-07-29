(() => {
	if (window.__OC_ADMIN_PROFILE_PICKER_READY__) return;
	window.__OC_ADMIN_PROFILE_PICKER_READY__ = true;

	const select = document.getElementById('oc-profile-user');
	if (!select) return;

	const cleanLabel = value => String(value || '').replace(/^🔧\s*/u, '').trim();
	let lastSignature = '';

	const picker = document.createElement('div');
	picker.className = 'oc-profile-picker';

	const toggle = document.createElement('button');
	toggle.type = 'button';
	toggle.className = 'oc-profile-picker-toggle';
	toggle.setAttribute('aria-haspopup', 'listbox');
	toggle.setAttribute('aria-expanded', 'false');

	const menu = document.createElement('div');
	menu.className = 'oc-profile-picker-menu hidden';

	select.parentNode.insertBefore(picker, select);
	picker.append(select, toggle, menu);
	select.classList.add('oc-profile-user-native');

	const search = document.createElement('input');
	search.type = 'search';
	search.className = 'oc-profile-picker-search';
	search.placeholder = 'Найти профиль…';
	search.autocomplete = 'off';
	search.setAttribute('aria-label', 'Найти профиль');
	menu.append(search);

	const optionsHost = document.createElement('div');
	optionsHost.className = 'oc-profile-picker-options';
	optionsHost.setAttribute('role', 'listbox');
	menu.append(optionsHost);

	function closeMenu() {
		picker.classList.remove('open');
		menu.classList.add('hidden');
		toggle.setAttribute('aria-expanded', 'false');
	}

	function openMenu() {
		picker.classList.add('open');
		menu.classList.remove('hidden');
		toggle.setAttribute('aria-expanded', 'true');
		search.value = '';
		filterOptions();
		window.setTimeout(() => search.focus(), 0);
	}

	function syncSelection() {
		const selected = select.selectedOptions?.[0] || [...select.options].find(option => option.value === select.value) || select.options[0];
		if (!selected) {
			toggle.textContent = 'Выберите профиль';
			toggle.classList.remove('is-admin');
			return;
		}
		toggle.textContent = cleanLabel(selected.textContent);
		toggle.classList.toggle('is-admin', selected.dataset.admin === '1');
		optionsHost.querySelectorAll('.oc-profile-picker-option').forEach(button => {
			button.classList.toggle('selected', button.dataset.value === select.value);
			button.setAttribute('aria-selected', button.dataset.value === select.value ? 'true' : 'false');
		});
	}

	function filterOptions() {
		const query = String(search.value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
		let visible = 0;
		optionsHost.querySelectorAll('.oc-profile-picker-option').forEach(button => {
			const label = String(button.textContent || '').toLocaleLowerCase('ru').replace(/ё/g, 'е');
			const matched = !query || label.includes(query);
			button.hidden = !matched;
			if (matched) visible += 1;
		});
		optionsHost.classList.toggle('is-empty', visible === 0);
	}

	function renderOptions() {
		const rows = [...select.options].map(option => ({
			value: option.value,
			label: cleanLabel(option.textContent),
			admin: option.dataset.admin === '1'
		}));
		const signature = rows.map(row => `${row.value}\u0000${row.label}\u0000${row.admin ? 1 : 0}`).join('\u0001');
		if (signature !== lastSignature) {
			lastSignature = signature;
			optionsHost.replaceChildren(...rows.map(row => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = `oc-profile-picker-option${row.admin ? ' is-admin' : ''}`;
				button.dataset.value = row.value;
				button.setAttribute('role', 'option');

				const label = document.createElement('span');
				label.className = 'oc-profile-picker-option-label';
				label.textContent = row.label;
				button.append(label);

				if (row.admin) {
					const crown = document.createElement('span');
					crown.className = 'oc-profile-admin-crown';
					crown.textContent = '♛';
					crown.title = 'Администратор';
					crown.setAttribute('aria-label', 'Администратор');
					button.append(crown);
				}
				return button;
			}));
		}
		syncSelection();
		filterOptions();
	}

	toggle.addEventListener('click', () => {
		if (menu.classList.contains('hidden')) openMenu();
		else closeMenu();
	});

	menu.addEventListener('click', event => {
		const button = event.target.closest('.oc-profile-picker-option');
		if (!button) return;
		if (select.value !== button.dataset.value) {
			select.value = button.dataset.value;
			select.dispatchEvent(new Event('change', { bubbles: true }));
		}
		syncSelection();
		closeMenu();
		toggle.focus();
	});
	search.addEventListener('input', filterOptions);
	search.addEventListener('keydown', event => {
		if (event.key !== 'ArrowDown') return;
		const first = optionsHost.querySelector('.oc-profile-picker-option:not([hidden])');
		if (first) {
			event.preventDefault();
			first.focus();
		}
	});
	optionsHost.addEventListener('keydown', event => {
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		const visible = [...optionsHost.querySelectorAll('.oc-profile-picker-option:not([hidden])')];
		if (!visible.length) return;
		event.preventDefault();
		const current = visible.indexOf(document.activeElement);
		let next = 0;
		if (event.key === 'End') next = visible.length - 1;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'ArrowDown') next = Math.min(visible.length - 1, current + 1);
		else next = Math.max(0, current < 0 ? 0 : current - 1);
		visible[next]?.focus();
	});

	select.addEventListener('change', syncSelection);
	document.addEventListener('pointerdown', event => {
		if (!picker.contains(event.target)) closeMenu();
	});
	document.addEventListener('keydown', event => {
		if (event.key === 'Escape' && !menu.classList.contains('hidden')) {
			closeMenu();
			toggle.focus();
		}
	});

	new MutationObserver(renderOptions).observe(select, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
		attributeFilter: ['data-admin', 'value', 'selected']
	});

	renderOptions();
	window.addEventListener('oped:data-ready', event => {
		if (event?.detail?.source === 'userProfiles' || event?.detail?.source === 'ratings') renderOptions();
	});
	window.addEventListener('oped:route-ready', event => {
		if (event?.detail?.tab === 'profile') renderOptions();
	});
})();
