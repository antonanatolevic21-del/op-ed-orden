import { productState, subscribeProductState } from './state.js';
import { openTrack } from './router.js';

let modal = null;

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function buildIssues() {
  const openings = productState.openings;
  const duplicateMap = new Map();
  openings.forEach(opening => {
    const key = `${normalize(opening.title)}|${String(opening.type || '')}|${String(opening.year || '')}`;
    if (!normalize(opening.title)) return;
    if (!duplicateMap.has(key)) duplicateMap.set(key, []);
    duplicateMap.get(key).push(opening);
  });
  const duplicateIds = new Set([...duplicateMap.values()].filter(rows => rows.length > 1).flat().map(row => String(row.id)));

  const rules = [
    ['image', 'Без основной картинки', opening => !String(opening.image || '').trim()],
    ['fallback', 'Без запасной картинки', opening => !String(opening.fallbackImage || '').trim()],
    ['performer', 'Без исполнителя', opening => !(opening.performers || []).length],
    ['franchise', 'Без франшизы', opening => !(opening.franchises || []).length],
    ['director', 'Без режиссёра', opening => !(opening.directors || []).length],
    ['studio', 'Без студии', opening => !(opening.studios || []).length],
    ['link', 'Без ссылки на видео', opening => !String(opening.link || '').trim()],
    ['duplicate', 'Возможные дубликаты', opening => duplicateIds.has(String(opening.id))]
  ];
  return rules.map(([id, label, test]) => ({ id, label, rows: openings.filter(test) }));
}

function completeness(issues) {
  const openings = productState.openings.length;
  if (!openings) return 100;
  const critical = issues.filter(issue => ['image','performer','franchise','link'].includes(issue.id)).reduce((sum, issue) => sum + issue.rows.length, 0);
  const max = openings * 4;
  return Math.max(0, Math.round((1 - critical / max) * 100));
}

function ensureModal() {
  if (modal?.isConnected) return modal;
  modal = document.createElement('div');
  modal.className = 'oc-quality-modal hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Качество базы');
  document.body.append(modal);
  modal.addEventListener('click', event => {
    if (event.target === modal || event.target.closest('[data-quality-close]')) closeQualityCenter();
    const track = event.target.closest('[data-quality-track]');
    if (track) {
      closeQualityCenter();
      openTrack(track.dataset.qualityTrack);
    }
  });
  return modal;
}

function render() {
  const root = ensureModal();
  const issues = buildIssues();
  const score = completeness(issues);
  const issueHtml = issues.map(issue => {
    const rows = issue.rows.slice(0, 60);
    return `<details class="oc-quality-issue" ${issue.rows.length && issue.rows.length <= 8 ? 'open' : ''}>
      <summary><span>${issue.label}</span><strong>${issue.rows.length}</strong></summary>
      <div class="oc-quality-track-list">
        ${rows.length ? rows.map(opening => `<button type="button" data-quality-track="${opening.id}"><span>${opening.title || 'Без названия'}</span><small>${opening.type || '—'} · ${opening.year || '—'}${opening.season ? ` · ${opening.season}` : ''}</small></button>`).join('') : '<div class="oc-quality-ok">Проблем не найдено ✓</div>'}
        ${issue.rows.length > rows.length ? `<div class="oc-quality-more">И ещё ${issue.rows.length - rows.length}…</div>` : ''}
      </div>
    </details>`;
  }).join('');

  root.innerHTML = `<div class="oc-quality-dialog">
    <div class="oc-quality-head">
      <div><div class="oc-section-label">админ · качество базы</div><h2>Проверка каталога</h2><p>Быстрая сводка по пустым связям, изображениям, ссылкам и возможным дубликатам.</p></div>
      <button type="button" class="oc-quality-close" data-quality-close aria-label="Закрыть">×</button>
    </div>
    <div class="oc-quality-summary">
      <div><strong>${productState.openings.length}</strong><span>треков</span></div>
      <div><strong>${score}%</strong><span>заполненность ключевых полей</span></div>
      <div><strong>${issues.reduce((sum, issue) => sum + issue.rows.length, 0)}</strong><span>срабатываний проверок</span></div>
    </div>
    <div class="oc-quality-issues">${issueHtml}</div>
  </div>`;
}

export function openQualityCenter() {
  const root = ensureModal();
  render();
  root.classList.remove('hidden');
  document.body.classList.add('oc-modal-open');
  root.querySelector('[data-quality-close]')?.focus();
}

export function closeQualityCenter() {
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('oc-modal-open');
}

export function initQualityCenter() {
  ensureModal();
  window.addEventListener('oped-open-quality', openQualityCenter);
  subscribeProductState(() => {
    if (modal && !modal.classList.contains('hidden')) render();
  });
}
