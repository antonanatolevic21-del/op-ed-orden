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
	menu.setAttribute('role', 'listbox');

	select.parentNode.insertBefore(picker, select);
	picker.append(select, toggle, menu);
	select.classList.add('oc-profile-user-native');

	function closeMenu() {
		picker.classList.remove('open');
		menu.classList.add('hidden');
		toggle.setAttribute('aria-expanded', 'false');
	}

	function openMenu() {
		picker.classList.add('open');
		menu.classList.remove('hidden');
		toggle.setAttribute('aria-expanded', 'true');
		menu.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
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
		menu.querySelectorAll('.oc-profile-picker-option').forEach(button => {
			button.classList.toggle('selected', button.dataset.value === select.value);
			button.setAttribute('aria-selected', button.dataset.value === select.value ? 'true' : 'false');
		});
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
			menu.replaceChildren(...rows.map(row => {
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
