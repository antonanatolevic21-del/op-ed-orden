(() => {
	const configs = [
		{
			from: '#ev-guess-from-year',
			to: '#ev-guess-to-year',
			prepare(grid) {
				moveAfter(grid, '#ev-guess-content', '#ev-guess-type');
				markHalf(grid, '#ev-guess-type');
				markHalf(grid, '#ev-guess-content');
			}
		},
		{
			from: '#ev-bw-from-year',
			to: '#ev-bw-to-year'
		},
		{
			from: '#ev-cn-from-year',
			to: '#ev-cn-to-year',
			prepare(grid) {
				markHalf(grid, '#ev-cn-type');
			}
		},
		{
			from: '[data-blind-field="fromYear"]',
			to: '[data-blind-field="toYear"]',
			prepare(grid) {
				moveAfter(grid, '[data-blind-field="content"]', '[data-blind-field="type"]');
			}
		}
	];

	function directField(grid, selector) {
		const control = grid.querySelector(selector);
		const field = control?.closest('.ev-guess-field');
		return field?.parentElement === grid ? field : null;
	}

	function moveAfter(grid, movingSelector, anchorSelector) {
		const moving = directField(grid, movingSelector);
		const anchor = directField(grid, anchorSelector);
		if (moving && anchor && anchor.nextElementSibling !== moving) anchor.after(moving);
	}

	function markHalf(grid, selector) {
		directField(grid, selector)?.classList.add('ev-date-layout-half');
	}

	function arrangeGrid(grid) {
		configs.forEach(config => {
			if (!grid.querySelector(config.from) || !grid.querySelector(config.to)) return;
			config.prepare?.(grid);

			const fromField = directField(grid, config.from);
			const toField = directField(grid, config.to);
			if (!fromField || !toField) return;

			const row = document.createElement('div');
			row.className = 'ev-date-filter-row';
			fromField.before(row);
			row.append(fromField, toField);
		});
	}

	function applyLayouts() {
		document.querySelectorAll('.ev-guess-grid').forEach(arrangeGrid);
	}

	let scheduled = false;
	function schedule() {
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			applyLayouts();
		});
	}

	new MutationObserver(schedule).observe(document.documentElement, {
		childList: true,
		subtree: true
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', schedule, { once: true });
	} else {
		schedule();
	}
})();
