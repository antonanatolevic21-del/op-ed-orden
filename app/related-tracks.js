import { openingById, productState } from './state.js';
import { openTrack } from './router.js';

let activeId = '';
let injecting = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function overlap(a = [], b = []) {
  const set = new Set(a.map(value => String(value).toLowerCase()));
  return b.filter(value => set.has(String(value).toLowerCase()));
}

function relation(entry, other) {
  if (!entry || !other || String(entry.id) === String(other.id)) return null;
  const sameSong = entry.sameSongGroupId && other.sameSongGroupId && String(entry.sameSongGroupId) === String(other.sameSongGroupId);
  const franchises = overlap(entry.franchises || [], other.franchises || []);
  const performers = overlap(entry.performers || [], other.performers || []);
  const directors = overlap(entry.directors || [], other.directors || []);
  const studios = overlap(entry.studios || [], other.studios || []);
  let score = 0;
  const reasons = [];
  if (sameSong) { score += 8; reasons.push('та же песня'); }
  if (franchises.length) { score += 5; reasons.push(`франшиза: ${franchises[0]}`); }
  if (performers.length) { score += 4; reasons.push(`исполнитель: ${performers[0]}`); }
  if (directors.length) { score += 2; reasons.push(`режиссёр: ${directors[0]}`); }
  if (studios.length) { score += 1; reasons.push(`студия: ${studios[0]}`); }
  if (!score) return null;
  return { opening: other, score, reasons };
}

function relatedRows(entry) {
  return productState.openings
    .map(other => relation(entry, other))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || String(a.opening.title || '').localeCompare(String(b.opening.title || ''), 'ru'))
    .slice(0, 8);
}

function render() {
  if (injecting || !activeId) return;
  const modal = document.querySelector('#oc-opening-modal');
  const dialog = modal?.querySelector('.oc-opening-detail-modal');
  if (!dialog || modal.classList.contains('hidden') || dialog.querySelector('.oc-related-tracks')) return;
  const entry = openingById(activeId);
  if (!entry) return;
  const rows = relatedRows(entry);
  if (!rows.length) return;

  injecting = true;
  try {
    const section = document.createElement('section');
    section.className = 'oc-related-tracks';
    section.innerHTML = `<div class="oc-related-head"><div><div class="oc-section-label">похожие</div><h3>Ещё из связанных работ</h3></div><span>${rows.length}</span></div>
      <div class="oc-related-grid">${rows.map(row => {
        const opening = row.opening;
        const image = opening.fallbackImage || opening.image || '';
        const safeId = escapeHtml(opening.id);
        const safeImage = escapeHtml(image);
        const safeTitle = escapeHtml(opening.title || 'Без названия');
        const safeReasons = escapeHtml(row.reasons.slice(0, 2).join(' · '));
        return `<button type="button" class="oc-related-card" data-related-track="${safeId}">
          <span class="oc-related-thumb">${image ? `<img src="${safeImage}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<b>OP/ED</b>'}</span>
          <span class="oc-related-copy"><strong>${safeTitle}</strong><small>${safeReasons}</small></span>
          <i>→</i>
        </button>`;
      }).join('')}</div>`;
    dialog.append(section);
    section.addEventListener('click', event => {
      const button = event.target.closest('[data-related-track]');
      if (!button) return;
      activeId = String(button.dataset.relatedTrack || '');
      openTrack(activeId);
    });
  } finally {
    injecting = false;
  }
}

export function initRelatedTracks() {
  document.addEventListener('click', event => {
    const open = event.target.closest('[data-action="open-card"]');
    if (open) activeId = String(open.dataset.id || open.closest('[data-id]')?.dataset.id || '');
  }, true);
  window.addEventListener('oped-track-opened', event => {
    activeId = String(event.detail?.id || activeId);
    window.setTimeout(render, 30);
  });
  const modal = document.querySelector('#oc-opening-modal');
  if (modal) new MutationObserver(() => window.setTimeout(render, 0)).observe(modal, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}
