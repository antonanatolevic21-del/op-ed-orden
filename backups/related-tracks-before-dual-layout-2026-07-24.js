(() => {
  if (window.__OC_RELATED_TRACKS_READY__) return;

  let lastTrackId = '';

  const norm = value => String(value || '').trim().toLowerCase().replace(/ё/g, 'е');
  const list = value => Array.isArray(value) ? value.map(norm).filter(Boolean) : [];
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const intersects = (a, b) => {
    const set = new Set(list(a));
    return list(b).filter(item => set.has(item)).length;
  };

  function scorePair(base, other) {
    let score = 0;
    if (base.sameSongGroupId && String(base.sameSongGroupId) === String(other.sameSongGroupId || '')) score += 100;
    score += intersects(base.franchises, other.franchises) * 30;
    score += intersects(base.performers, other.performers) * 20;
    score += intersects(base.studios, other.studios) * 10;
    score += intersects(base.directors, other.directors) * 10;
    if (norm(base.title) === norm(other.title)) score += 12;
    return score;
  }

  function openTrack(id) {
    const url = new URL(location.href);
    url.searchParams.delete('view');
    url.searchParams.delete('profile');
    url.searchParams.delete('section');
    url.searchParams.delete('album');
    url.searchParams.set('track', id);
    history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  function renderRows(block, rows) {
    const grid = block.querySelector('.oc-related-grid');
    if (!grid) return;
    if (!rows.length) {
      grid.innerHTML = '<div class="oc-related-empty">Похожих треков по франшизе, исполнителю, студии, режиссёру или одинаковой песне не найдено.</div>';
      return;
    }

    grid.innerHTML = rows.map(row => {
      const img = String(row.image || row.fallbackImage || '').trim();
      const meta = [row.type || '', row.year || '', row.season || ''].filter(Boolean).join(' · ');
      return `<button type="button" class="oc-related-card" data-related-id="${escapeHtml(row.id)}">
        <span class="oc-related-thumb">${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async">` : ''}</span>
        <span><span class="oc-related-title">${escapeHtml(row.title || 'Без названия')}</span><span class="oc-related-meta">${escapeHtml(meta)}</span></span>
      </button>`;
    }).join('');
  }

  async function loadRelated(block, id) {
    const button = block.querySelector('.oc-related-load');
    if (button) {
      button.disabled = true;
      button.textContent = 'Загрузка…';
    }
    try {
      const rows = await window.OC_CATALOG_CACHE.load();
      const base = rows.find(row => String(row.id) === String(id));
      if (!base) throw new Error('Трек не найден в каталоге.');
      const related = rows
        .filter(row => String(row.id) !== String(id))
        .map(row => ({ row, score: scorePair(base, row) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || Number(b.row.year || 0) - Number(a.row.year || 0) || String(a.row.title || '').localeCompare(String(b.row.title || ''), 'ru'))
        .slice(0, 6)
        .map(item => item.row);
      renderRows(block, related);
      if (button) button.remove();
    } catch (error) {
      console.error('Related tracks load failed', error);
      if (button) {
        button.disabled = false;
        button.textContent = 'Повторить';
      }
      const grid = block.querySelector('.oc-related-grid');
      if (grid) grid.innerHTML = '<div class="oc-related-empty">Не удалось загрузить связанные треки.</div>';
    }
  }

  function mountFor(id, attempt = 0) {
    const modal = document.querySelector('#oc-opening-modal:not(.hidden) .oc-opening-detail-modal');
    if (!modal) {
      if (attempt < 25) window.setTimeout(() => mountFor(id, attempt + 1), 40);
      return;
    }
    if (modal.querySelector('.oc-related-block')) return;

    const block = document.createElement('section');
    block.className = 'oc-related-block';
    block.innerHTML = '<div class="oc-related-head"><strong>Связанные треки</strong><button type="button" class="oc-related-load">Показать связанные</button></div><div class="oc-related-grid"></div>';
    const rate = modal.querySelector('.oc-opening-rate-panel');
    if (rate) rate.before(block);
    else modal.append(block);

    block.querySelector('.oc-related-load')?.addEventListener('click', () => void loadRelated(block, id));
    block.addEventListener('click', event => {
      const target = event.target.closest('[data-related-id]');
      if (target) openTrack(String(target.dataset.relatedId || ''));
    });
  }

  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-action="open-card"]');
    if (!opener?.dataset?.id) return;
    lastTrackId = String(opener.dataset.id);
    window.setTimeout(() => mountFor(lastTrackId), 0);
  }, true);

  window.addEventListener('popstate', () => {
    const id = new URL(location.href).searchParams.get('track');
    if (!id) return;
    lastTrackId = id;
    window.setTimeout(() => mountFor(id), 120);
  });

  window.__OC_RELATED_TRACKS_READY__ = true;
})();
