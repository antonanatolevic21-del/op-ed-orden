(() => {
	if (window.__OC_TOP100_RANK_READABILITY_READY__) return;
	window.__OC_TOP100_RANK_READABILITY_READY__ = true;

	const normalize = value => ({ '①': '1', '②': '2', '③': '3' }[String(value || '').trim()] || String(value || '').trim());
	const clean = value => String(value ?? '').trim();
	const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[character]));
	const exportState = { running: false, urls: [] };
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
		ensureExportButton();
	}

	function queueSync(delay = 0) {
		window.clearTimeout(timer);
		timer = window.setTimeout(syncRanks, delay);
	}

	function viewedUser() {
		return clean(document.querySelector('#oc-profile-user')?.value || document.querySelector('#oc-myname')?.value || 'user');
	}

	function activeType() {
		return document.querySelector('.oc-profile-top-type-btn.active')?.dataset.type === 'ED' ? 'ED' : 'OP';
	}

	function safeFilePart(value) {
		return clean(value)
			.toLocaleLowerCase('ru')
			.replace(/ё/g, 'е')
			.replace(/[^a-zа-я0-9_-]+/gi, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 60) || 'user';
	}

	function collectVisibleTop(type) {
		const container = document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op');
		if (!container) return [];
		return [...container.querySelectorAll(':scope > .oc-profile-item')].slice(0, 100).map((card, index) => {
			const image = card.querySelector('img');
			return {
				id: clean(card.dataset.top100Id || card.dataset.explicitTopId || card.querySelector('[data-id]')?.dataset.id),
				place: index + 1,
				title: clean(card.querySelector('[data-top100-title]')?.textContent || card.querySelector('.oc-profile-name')?.textContent) || `Место ${index + 1}`,
				meta: clean(card.querySelector('.oc-profile-meta')?.textContent) || type,
				image: clean(image?.currentSrc || image?.getAttribute('src')),
				fallback: clean(image?.dataset.fallback)
			};
		});
	}

	function revokeExportUrls() {
		exportState.urls.forEach(url => URL.revokeObjectURL(url));
		exportState.urls = [];
	}

	function closeExportModal() {
		document.querySelector('.oc-top100-modal[data-kind="export"]')?.remove();
		revokeExportUrls();
	}

	function createExportModal() {
		document.querySelector('.oc-top100-modal')?.remove();
		revokeExportUrls();
		const modal = document.createElement('div');
		modal.className = 'oc-top100-modal';
		modal.dataset.kind = 'export';
		modal.innerHTML = '<div class="oc-top100-dialog"><button type="button" class="oc-top100-modal-close" aria-label="Закрыть">×</button><div class="oc-top100-modal-body"></div></div>';
		document.body.append(modal);
		modal.addEventListener('click', event => {
			if (event.target === modal || event.target.closest('.oc-top100-modal-close')) closeExportModal();
		});
		return modal;
	}

	function wrapText(context, text, x, y, maxWidth, lineHeight, maxLines = 3) {
		const words = clean(text).split(/\s+/).filter(Boolean);
		let line = '';
		let wordIndex = 0;
		for (let lineIndex = 0; lineIndex < maxLines && wordIndex < words.length; lineIndex += 1) {
			line = '';
			while (wordIndex < words.length) {
				const candidate = line ? `${line} ${words[wordIndex]}` : words[wordIndex];
				if (line && context.measureText(candidate).width > maxWidth) break;
				line = candidate;
				wordIndex += 1;
			}
			if (lineIndex === maxLines - 1 && wordIndex < words.length) {
				while (line && context.measureText(`${line}…`).width > maxWidth) line = line.slice(0, -1);
				line += '…';
				wordIndex = words.length;
			}
			context.fillText(line, x, y + lineIndex * lineHeight);
		}
	}

	function loadCanvasImage(item) {
		const candidates = [...new Set([clean(item?.original), clean(item?.image), clean(item?.fallback)].filter(Boolean))];
		return new Promise(resolve => {
			const tryCandidate = index => {
				if (index >= candidates.length) { resolve(null); return; }
				const image = new Image();
				image.crossOrigin = 'anonymous';
				image.referrerPolicy = 'no-referrer';
				let finished = false;
				const finish = loaded => {
					if (finished) return;
					finished = true;
					window.clearTimeout(timeout);
					image.onload = null;
					image.onerror = null;
					if (loaded) resolve(image);
					else { image.src = ''; tryCandidate(index + 1); }
				};
				const timeout = window.setTimeout(() => finish(false), 4000);
				image.onload = () => finish(true);
				image.onerror = () => finish(false);
				try { image.src = new URL(candidates[index], document.baseURI).href; }
				catch (_) { finish(false); }
			};
			tryCandidate(0);
		});
	}

	async function renderExportCanvas(items, startPlace, type) {
		const size = 1500;
		const cell = 300;
		const resolution = 2;
		const canvas = document.createElement('canvas');
		canvas.width = size * resolution;
		canvas.height = size * resolution;
		const context = canvas.getContext('2d');
		context.scale(resolution, resolution);
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = 'high';
		context.fillStyle = '#0b0a10';
		context.fillRect(0, 0, size, size);
		const images = await Promise.all(items.map(item => item ? loadCanvasImage(item) : null));

		for (let index = 0; index < 25; index += 1) {
			const item = items[index] || null;
			const column = index % 5;
			const row = Math.floor(index / 5);
			const x = column * cell;
			const y = row * cell;
			context.fillStyle = '#100d16';
			context.fillRect(x + 5, y + 5, cell - 10, cell - 10);
			context.strokeStyle = '#30283a';
			context.lineWidth = 2;
			context.strokeRect(x + 5, y + 5, cell - 10, cell - 10);

			const imageX = x + 14;
			const imageY = y + 14;
			const imageWidth = cell - 28;
			const imageHeight = 170;
			context.fillStyle = '#17131e';
			context.fillRect(imageX, imageY, imageWidth, imageHeight);
			const image = images[index];
			if (image) {
				const scale = Math.max(imageWidth / image.width, imageHeight / image.height);
				const sourceWidth = imageWidth / scale;
				const sourceHeight = imageHeight / scale;
				const sourceX = (image.width - sourceWidth) / 2;
				const sourceY = (image.height - sourceHeight) / 2;
				try { context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, imageX, imageY, imageWidth, imageHeight); }
				catch (_) {}
			}

			context.fillStyle = 'rgba(8,7,12,.82)';
			context.fillRect(imageX, imageY, 72, 44);
			context.fillStyle = type === 'ED' ? '#ff5f86' : '#08d9d6';
			context.font = '800 24px Space Mono, monospace';
			context.fillText(String(startPlace + index), imageX + 10, imageY + 30);
			context.fillStyle = '#f5f3fa';
			context.font = '700 18px Inter, Arial, sans-serif';
			wrapText(context, item?.title || 'Пустое место', x + 16, y + 214, cell - 32, 24, 3);
			context.fillStyle = '#8f879b';
			context.font = '600 13px Space Mono, monospace';
			context.fillText(item?.meta || type, x + 16, y + 286);
		}
		return canvas;
	}

	async function openExport() {
		if (exportState.running) return;
		const user = viewedUser();
		const type = activeType();
		const sourceItems = collectVisibleTop(type);
		if (!sourceItems.length) {
			window.OC_TOAST?.show?.('В этом топе пока нет карточек для скачивания.', { type: 'error' });
			return;
		}

		exportState.running = true;
		const modal = createExportModal();
		const body = modal.querySelector('.oc-top100-modal-body');
		body.innerHTML = `<div class="oc-top100-modal-head"><div><h2>Экспорт топ-100</h2><p>${escapeHtml(user)} · ${type} · четыре PNG 3000×3000 без потерь, по 25 мест.</p></div></div><div class="oc-top100-export-status">Подготавливаю карточки…</div><div class="oc-top100-export-grid"></div>`;
		const grid = body.querySelector('.oc-top100-export-grid');
		const status = body.querySelector('.oc-top100-export-status');
		try {
			const catalog = new Map([
				...(window.OC_CATALOG_STORE?.peek?.() || []),
				...(window.OC_CATALOG_CACHE?.peek?.() || []),
				...(window.OC_APP_BRIDGE?.snapshot?.()?.entries || [])
			].map(entry => [String(entry.id), entry]));
			const missingIds = [...new Set(sourceItems.map(item => item.id).filter(id => id && !catalog.has(id)))];
			if (missingIds.length) {
				try {
					const rows = await window.OC_CATALOG_CACHE?.byIds?.(missingIds);
					rows?.forEach(entry => catalog.set(String(entry.id), entry));
				} catch (error) { console.warn('Top-100 export original images unavailable', error); }
			}
			const allItems = Array.from({ length: 100 }, (_, index) => {
				const item = sourceItems[index];
				if (!item) return null;
				const entry = catalog.get(item.id);
				return { ...item, original: clean(entry?.image), fallback: clean(entry?.fallbackImage) || item.fallback };
			});
			if (document.fonts) {
				await Promise.allSettled([
					document.fonts.load('700 18px Inter'),
					document.fonts.load('800 24px "Space Mono"'),
					document.fonts.load('600 13px "Space Mono"')
				]);
			}
			for (let part = 0; part < 4; part += 1) {
				if (!modal.isConnected) break;
				status.textContent = `Генерирую ${part + 1} из 4…`;
				const from = part * 25 + 1;
				const to = part * 25 + 25;
				const canvas = await renderExportCanvas(allItems.slice(part * 25, part * 25 + 25), from, type);
				if (!modal.isConnected) break;
				const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Не удалось собрать PNG.')), 'image/png'));
				if (!modal.isConnected) break;
				const url = URL.createObjectURL(blob);
				exportState.urls.push(url);
				const card = document.createElement('div');
				card.className = 'oc-top100-export-card';
				card.innerHTML = `<img src="${url}" alt="Топ ${from}–${to}"><div><strong>Места ${from}–${to}</strong><a download="top100-${safeFilePart(user)}-${type.toLowerCase()}-${from}-${to}.png" href="${url}">Скачать PNG</a></div>`;
				grid.append(card);
			}
			if (modal.isConnected) status.textContent = 'Готово: четыре PNG 3000×3000 без потерь.';
		} catch (error) {
			console.error('Top-100 PNG export failed', error);
			if (modal.isConnected) status.textContent = error?.message || 'Не удалось создать изображения.';
		} finally {
			exportState.running = false;
		}
	}

	function ensureExportButton() {
		const extra = document.querySelector('#oc-profile-panel .oc-top100-toolbar .oc-top100-extra');
		if (!extra || extra.querySelector('[data-top100-export]')) return;
		const button = document.createElement('button');
		button.type = 'button';
		button.dataset.top100Export = '';
		button.textContent = '4 PNG';
		button.title = 'Скачать топ-100: четыре PNG 3000×3000 без потерь';
		button.addEventListener('click', () => void openExport());
		extra.append(button);
	}

	new MutationObserver(() => queueSync(25)).observe(document.documentElement, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
		attributeFilter: ['data-profile-view', 'class']
	});

	document.addEventListener('click', () => queueSync(0), true);
	document.addEventListener('keydown', event => {
		if (event.key === 'Escape' && document.querySelector('.oc-top100-modal[data-kind="export"]')) closeExportModal();
	});
	window.addEventListener('oped:route-ready', event => {
		if (event?.detail?.tab === 'top100' || event?.detail?.tab === 'profile') queueSync(0);
	});
	window.addEventListener('oped:data-ready', event => {
		if (event?.detail?.source === 'manualRanks' || event?.detail?.source === 'ratings') queueSync(0);
	});
	queueSync(0);
})();
