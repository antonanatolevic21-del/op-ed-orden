(() => {
	const SELECT_IDS = ['ev-guess-excluded', 'ev-bw-excluded', 'ev-blind-excluded'];
	const GROUPS = [
		{ kind: 'performer', label: 'Исполнители' },
		{ kind: 'studio', label: 'Студии' },
		{ kind: 'director', label: 'Режиссёры' },
		{ kind: 'franchise', label: 'Франшизы' }
	];
	const states = new Map();
	let scheduled = false;

	function normalize(value) {
		return String(value || '')
			.trim()
			.toLocaleLowerCase('ru')
			.replace(/ё/g, 'е')
			.replace(/\s+/g, ' ');
	}

	function stateFor(id) {
		if (!states.has(id)) {
			states.set(id, {
				active: 'performer',
				search: { performer: '', studio: '', director: '', franchise: '' },
				scroll: { performer: 0, studio: 0, director: 0, franchise: 0 },
				restoreY: null
			});
		}
		return states.get(id);
	}

	function optionInfo(option) {
		const raw = String(option.value || '');
		const separator = raw.indexOf('::');
		if (separator < 1) return null;
		return {
			kind: raw.slice(0, separator),
			name: raw.slice(separator + 2),
			token: raw,
			option
		};
	}

	function optionsByKind(select) {
		const grouped = new Map(GROUPS.map(group => [group.kind, []]));
		Array.from(select.options).forEach(option => {
			const info = optionInfo(option);
			if (info && grouped.has(info.kind)) grouped.get(info.kind).push(info);
		});
		return grouped;
	}

	function enhance(select) {
		if (!select || select.dataset.exclusionEnhanced === '1') return;
		select.dataset.exclusionEnhanced = '1';
		select.classList.add('ev-exclusion-native');

		const state = stateFor(select.id);
		const grouped = optionsByKind(select);
		const field = select.closest('.ev-exclusion-field') || select.parentElement;
		if (!field) return;
		field.classList.add('ev-exclusion-enhanced');

		const picker = document.createElement('div');
		picker.className = 'ev-exclusion-picker';
		picker.dataset.exclusionFor = select.id;

		const tabs = document.createElement('div');
		tabs.className = 'ev-exclusion-tabs';
		picker.append(tabs);

		const panels = new Map();
		const lists = new Map();

		GROUPS.forEach(group => {
			const entries = grouped.get(group.kind) || [];
			const selectedCount = entries.filter(entry => entry.option.selected).length;

			const tab = document.createElement('button');
			tab.type = 'button';
			tab.className = `ev-exclusion-tab${state.active === group.kind ? ' active' : ''}`;
			tab.dataset.exclusionTab = group.kind;
			tab.disabled = select.disabled;
			tab.innerHTML = `<span>${group.label}</span><span class="ev-exclusion-tab-count">${selectedCount}</span>`;
			tabs.append(tab);

			const panel = document.createElement('div');
			panel.className = `ev-exclusion-panel${state.active === group.kind ? ' active' : ''}`;
			panel.dataset.exclusionPanel = group.kind;

			const search = document.createElement('input');
			search.type = 'search';
			search.className = 'ev-exclusion-search';
			search.placeholder = 'Введите название…';
			search.autocomplete = 'off';
			search.value = state.search[group.kind] || '';
			search.disabled = select.disabled;
			panel.append(search);

			const list = document.createElement('div');
			list.className = 'ev-exclusion-list';
			list.dataset.exclusionList = group.kind;
			panel.append(list);

			entries.forEach(entry => {
				const item = document.createElement('div');
				item.className = 'ev-exclusion-item';
				item.dataset.searchText = normalize(entry.name);

				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.checked = entry.option.selected;
				checkbox.disabled = select.disabled;
				checkbox.dataset.exclusionToken = entry.token;

				const title = document.createElement('span');
				title.textContent = entry.name;
				item.append(checkbox, title);
				list.append(item);

				const commit = checked => {
					entry.option.selected = checked;
					state.scroll[group.kind] = list.scrollTop;
					state.restoreY = window.scrollY;
					select.dispatchEvent(new Event('change', { bubbles: true }));
				};

				checkbox.addEventListener('click', event => event.stopPropagation());
				checkbox.addEventListener('change', () => commit(checkbox.checked));
				item.addEventListener('click', event => {
					if (select.disabled || event.target === checkbox) return;
					event.preventDefault();
					event.stopPropagation();
					checkbox.checked = !checkbox.checked;
					commit(checkbox.checked);
				});
			});

			if (!entries.length) {
				const empty = document.createElement('div');
				empty.className = 'ev-exclusion-empty';
				empty.textContent = 'Нет вариантов.';
				list.append(empty);
			}

			const applySearch = () => {
				const query = normalize(search.value);
				state.search[group.kind] = search.value;
				let visible = 0;
				list.querySelectorAll('.ev-exclusion-item').forEach(item => {
					const show = !query || item.dataset.searchText.includes(query);
					item.hidden = !show;
					if (show) visible += 1;
				});
				let empty = list.querySelector('.ev-exclusion-search-empty');
				if (!visible && entries.length) {
					if (!empty) {
						empty = document.createElement('div');
						empty.className = 'ev-exclusion-empty ev-exclusion-search-empty';
						empty.textContent = 'Ничего не найдено.';
						list.append(empty);
					}
					empty.hidden = false;
				} else if (empty) {
					empty.hidden = true;
				}
			};

			search.addEventListener('click', event => event.stopPropagation());
			search.addEventListener('input', applySearch);
			list.addEventListener('scroll', () => {
				state.scroll[group.kind] = list.scrollTop;
			}, { passive: true });
			applySearch();

			panels.set(group.kind, panel);
			lists.set(group.kind, list);
			picker.append(panel);
		});

		function activate(kind) {
			const currentList = lists.get(state.active);
			if (currentList) state.scroll[state.active] = currentList.scrollTop;
			state.active = kind;
			picker.querySelectorAll('[data-exclusion-tab]').forEach(tab => {
				tab.classList.toggle('active', tab.dataset.exclusionTab === kind);
			});
			panels.forEach((panel, key) => panel.classList.toggle('active', key === kind));
			requestAnimationFrame(() => {
				const target = lists.get(kind);
				if (target) target.scrollTop = state.scroll[kind] || 0;
				panels.get(kind)?.querySelector('.ev-exclusion-search')?.focus({ preventScroll: true });
			});
		}

		tabs.querySelectorAll('[data-exclusion-tab]').forEach(tab => {
			tab.addEventListener('click', event => {
				event.preventDefault();
				event.stopPropagation();
				activate(tab.dataset.exclusionTab);
			});
		});

		const note = field.querySelector('.ev-guess-note');
		if (note) field.insertBefore(picker, note);
		else field.append(picker);

		requestAnimationFrame(() => {
			const list = lists.get(state.active);
			if (list) list.scrollTop = state.scroll[state.active] || 0;
			if (Number.isFinite(state.restoreY)) {
				window.scrollTo(0, state.restoreY);
				state.restoreY = null;
			}
		});
	}

	function enhanceAll() {
		SELECT_IDS.forEach(id => enhance(document.getElementById(id)));
	}

	function scheduleEnhance() {
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			enhanceAll();
		});
	}

	new MutationObserver(scheduleEnhance).observe(document.documentElement, {
		childList: true,
		subtree: true
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', scheduleEnhance, { once: true });
	} else {
		scheduleEnhance();
	}
})();
