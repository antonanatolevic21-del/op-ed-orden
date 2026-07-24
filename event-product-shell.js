import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { showToast, initToasts } from './app/toast.js';
import { initAccessibility } from './app/accessibility.js';

let applyingRoute = false;

function cachedProfile() {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const cached = JSON.parse(storage.getItem('op-ed-auth-profile-v1') || 'null');
      if (cached?.profile) return cached.profile;
    } catch (_) {}
  }
  return null;
}

function accountName() {
  const profile = cachedProfile();
  return String(profile?.nickname || profile?.nicknameKey || localStorage.getItem('my-display-name') || document.querySelector('#ev-myname')?.value || 'гость').trim() || 'гость';
}

function syncPersistentAccount() {
  const profile = cachedProfile();
  const authUser = getApps().length ? getAuth(getApp()).currentUser : null;
  const name = String(profile?.nickname || authUser?.displayName || '').trim();
  const input = document.querySelector('#ev-myname');
  if (name && input && input.value !== name) {
    input.value = name;
    localStorage.setItem('my-display-name', name);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function buildAccountChip() {
  const header = document.querySelector('.ev-header');
  const old = document.querySelector('.ev-userbar');
  if (!header || header.querySelector('.ev-shell-account')) return;
  old?.classList.add('ev-shell-legacy-userbar');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ev-shell-account';
  button.innerHTML = `<span class="ev-shell-account-avatar">🙂</span><span class="ev-shell-account-name"></span><span>⌄</span>`;
  header.append(button);
  const sync = () => { const name = button.querySelector('.ev-shell-account-name'); if (name) name.textContent = accountName(); };
  button.addEventListener('click', () => {
    const badge = document.querySelector('#ev-access-badge');
    if (badge) badge.click();
    else document.querySelector('#ev-name-modal')?.classList.remove('hidden');
  });
  sync();
  window.setInterval(sync, 900);
}

function updateRoute(patch = {}, replace = false) {
  if (applyingRoute) return;
  const url = new URL(location.href);
  Object.entries(patch).forEach(([key, value]) => {
    if (!value) url.searchParams.delete(key); else url.searchParams.set(key, value);
  });
  history[replace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}`);
}

function applyRoute() {
  applyingRoute = true;
  try {
    const url = new URL(location.href);
    const game = url.searchParams.get('game');
    const stage = url.searchParams.get('stage');
    if (game) document.querySelector(`.ev-mode-tab[data-mode="${CSS.escape(game)}"]`)?.click();
    if (stage) document.querySelector(`.ev-tab[data-stage="${CSS.escape(stage)}"]`)?.click();
  } finally {
    window.setTimeout(() => { applyingRoute = false; }, 0);
  }
}

function bindRoute() {
  document.addEventListener('click', event => {
    const game = event.target.closest('.ev-mode-tab[data-mode]');
    if (game) updateRoute({ game: game.dataset.mode, stage: game.dataset.mode === 'rating' ? undefined : null });
    const stage = event.target.closest('.ev-tab[data-stage]');
    if (stage) updateRoute({ game: 'rating', stage: stage.dataset.stage });
  }, true);
  window.addEventListener('popstate', applyRoute);
  window.setTimeout(applyRoute, 120);
}

function skeleton() {
  const app = document.querySelector('#ev-app');
  if (!app || !/загрузка/i.test(app.textContent || '')) return;
  app.innerHTML = `<div class="ev-shell-skeleton">${Array.from({ length: 6 }, () => '<div><span></span><i></i><i></i></div>').join('')}</div>`;
}

function bindErrors() {
  document.querySelectorAll('.ev-error').forEach(error => {
    let last = '';
    new MutationObserver(() => {
      const text = String(error.textContent || '').trim();
      if (text && text !== last) { last = text; showToast(text, { type: 'error' }); }
    }).observe(error, { childList: true, subtree: true, characterData: true });
  });
}

function bindKeyboard() {
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const modal = [...document.querySelectorAll('.ev-modal')].reverse().find(node => !node.classList.contains('hidden') && node.getClientRects().length);
    if (!modal) return;
    const close = modal.querySelector('.ev-close,[data-close],[data-action="close"],button[title*="Закры"]');
    if (close) close.click(); else modal.classList.add('hidden');
    event.preventDefault();
  });
}

function init() {
  initToasts();
  initAccessibility();
  syncPersistentAccount();
  buildAccountChip();
  bindRoute();
  skeleton();
  bindErrors();
  bindKeyboard();
  window.setTimeout(syncPersistentAccount, 600);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
