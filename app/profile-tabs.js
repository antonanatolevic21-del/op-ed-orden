import { setProfileRoute } from './router.js';

const VIEWS = new Set(['overview', 'top100', 'ratings', 'daily']);
let currentView = 'overview';

function panel() { return document.querySelector('#oc-profile-panel'); }

function ensureTabs() {
  const root = panel();
  if (!root || root.querySelector('.oc-profile-subtabs')) return;
  const anchor = root.querySelector('.oc-profile-select-wrap');
  const tabs = document.createElement('div');
  tabs.className = 'oc-profile-subtabs';
  tabs.setAttribute('role', 'tablist');
  tabs.innerHTML = `
    <button type="button" role="tab" data-profile-view="overview">Обзор</button>
    <button type="button" role="tab" data-profile-view="top100">Мой топ-100</button>
    <button type="button" role="tab" data-profile-view="ratings">Все оценки</button>
    <button type="button" role="tab" data-profile-view="daily">Дейлики</button>`;
  anchor?.insertAdjacentElement('afterend', tabs);
  tabs.addEventListener('click', event => {
    const button = event.target.closest('[data-profile-view]');
    if (button) setView(button.dataset.profileView, true);
  });
}

function setVisible(selector, visible) {
  document.querySelectorAll(selector).forEach(element => element.classList.toggle('oc-profile-section-hidden', !visible));
}

export function setView(view, push = false) {
  currentView = VIEWS.has(view) ? view : 'overview';
  const root = panel();
  if (!root) return;
  ensureTabs();
  root.dataset.profileView = currentView;
  root.querySelectorAll('.oc-profile-subtabs [data-profile-view]').forEach(button => {
    const active = button.dataset.profileView === currentView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });

  setVisible('#oc-profile-stats', currentView === 'overview');
  setVisible('.oc-topmode-toggle,.oc-topmode-hint,.oc-manual-actions,.oc-profile-columns', currentView === 'top100');
  setVisible('.oc-allratings', currentView === 'ratings');
  setVisible('#oc-daily-panel', currentView === 'daily');
  setVisible('.oc-profile-filterbar', currentView !== 'daily');

  let dailyPlaceholder = root.querySelector('.oc-profile-daily-placeholder');
  if (currentView === 'daily') {
    const daily = document.querySelector('#oc-daily-panel');
    if (!dailyPlaceholder) {
      dailyPlaceholder = document.createElement('div');
      dailyPlaceholder.className = 'oc-profile-daily-placeholder oc-empty';
      dailyPlaceholder.textContent = 'Настройки ежедневной оценки появятся здесь для выбранного профиля.';
      daily?.insertAdjacentElement('afterend', dailyPlaceholder);
    }
    dailyPlaceholder.hidden = Boolean(daily && !daily.classList.contains('hidden'));
  } else if (dailyPlaceholder) {
    dailyPlaceholder.hidden = true;
  }

  if (push) setProfileRoute(currentView);
}

export function initProfileTabs() {
  ensureTabs();
  setView(new URL(location.href).searchParams.get('profile') || 'overview', false);
  window.addEventListener('oped-profile-route', event => setView(event.detail?.profile || 'overview', false));
  const daily = document.querySelector('#oc-daily-panel');
  if (daily) new MutationObserver(() => { if (currentView === 'daily') setView(currentView, false); }).observe(daily, { attributes: true, attributeFilter: ['class'] });
}
