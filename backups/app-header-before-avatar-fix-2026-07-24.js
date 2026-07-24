import { navigateTab } from './router.js';

function optionHtml(select) {
  return [...(select?.options || [])].map(option => `<option value="${String(option.value).replace(/"/g, '&quot;')}">${option.textContent}</option>`).join('');
}
function isAdminUnlocked() { return Boolean(document.querySelector('.oc-admin-only:not(.oc-locked)')); }
function currentName() { return String(document.querySelector('#oc-myname')?.value || localStorage.getItem('my-display-name') || 'гость').trim() || 'гость'; }
function currentAvatar() { return String(document.querySelector('#oc-avatar-btn')?.textContent || localStorage.getItem('my-avatar') || '🙂').trim() || '🙂'; }

function makeHeader() {
  const root = document.querySelector('#opedchart-root');
  if (!root || document.querySelector('.oc-shell-header')) return null;
  const oldHeader = root.querySelector('.oc-header');
  const oldTabs = root.querySelector('.oc-tabs');
  if (!oldHeader || !oldTabs) return null;
  oldHeader.classList.add('oc-shell-legacy-hidden'); oldTabs.classList.add('oc-shell-legacy-hidden');
  const header = document.createElement('header');
  header.className = 'oc-shell-header';
  header.innerHTML = `
    <button type="button" class="oc-shell-brand" data-shell-tab="chart" aria-label="На главную">АБОБА</button>
    <nav class="oc-shell-nav" aria-label="Основная навигация">
      <button type="button" data-shell-tab="chart">Каталог</button><button type="button" data-shell-tab="profile">Профиль</button>
      <div class="oc-shell-nav-menu-wrap"><button type="button" class="oc-shell-ratings-toggle" aria-expanded="false">Рейтинги <span>⌄</span></button><div class="oc-shell-ratings-menu" hidden><button type="button" data-shell-tab="top100">Общий топ-100</button><button type="button" data-shell-tab="stats">Средние</button><button type="button" data-shell-tab="tier">Тир-лист</button></div></div>
      <button type="button" data-shell-tab="season">Сезоны</button><a href="events.html" class="oc-shell-events-link">Ивенты</a>
    </nav>
    <div class="oc-shell-account-wrap"><button type="button" class="oc-shell-daily" aria-label="Ежедневная оценка" title="Ежедневная оценка">🔔<span class="oc-shell-daily-dot"></span></button><button type="button" class="oc-shell-account" aria-expanded="false"><span class="oc-shell-avatar">${currentAvatar()}</span><span class="oc-shell-name">${currentName()}</span><span class="oc-shell-chevron">⌄</span></button><div class="oc-shell-account-menu" hidden><button type="button" class="oc-shell-account-action" data-shell-account>Аккаунт / вход</button><label class="oc-shell-menu-field"><span>Шкала оценки</span><select data-shell-scale></select></label><label class="oc-shell-menu-field"><span>Что показывать</span><select data-shell-content></select></label><div class="oc-shell-admin-menu" hidden><div class="oc-shell-menu-separator"></div><button type="button" data-shell-quality>Качество базы</button><button type="button" data-shell-repair>Починить франшизы</button><button type="button" data-shell-images>Копии изображений</button></div></div></div>`;
  root.insertBefore(header, root.firstChild); return header;
}
function syncActive(header) {
  const activeLegacy = [...document.querySelectorAll('.oc-tab-btn[data-tab].active')].find(button => !button.closest('.oc-shell-header'));
  const active = activeLegacy?.dataset.tab || 'chart';
  header.querySelectorAll('[data-shell-tab]').forEach(button => { const tab=button.dataset.shellTab; const ratingGroup=['top100','stats','tier'].includes(active); const on=tab===active||(button.classList.contains('oc-shell-ratings-toggle')&&ratingGroup); button.classList.toggle('active',on); if(on)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current'); });
  header.querySelector('.oc-shell-ratings-toggle')?.classList.toggle('active',['top100','stats','tier'].includes(active));
}
function syncAccount(header) { const name=header.querySelector('.oc-shell-name'); const avatar=header.querySelector('.oc-shell-avatar'); if(name)name.textContent=currentName(); if(avatar)avatar.textContent=currentAvatar(); const sourceDot=document.querySelector('#oc-daily-bell-dot'); header.querySelector('.oc-shell-daily-dot')?.classList.toggle('show',Boolean(sourceDot&&!sourceDot.classList.contains('hidden'))); const adminMenu=header.querySelector('.oc-shell-admin-menu'); if(adminMenu)adminMenu.hidden=!isAdminUnlocked(); }
function closeMenus(header) { const account=header.querySelector('.oc-shell-account'); const accountMenu=header.querySelector('.oc-shell-account-menu'); const ratingToggle=header.querySelector('.oc-shell-ratings-toggle'); const ratingMenu=header.querySelector('.oc-shell-ratings-menu'); if(accountMenu)accountMenu.hidden=true; account?.setAttribute('aria-expanded','false'); if(ratingMenu)ratingMenu.hidden=true; ratingToggle?.setAttribute('aria-expanded','false'); }
function bind(header) {
  const scaleSource=document.querySelector('#oc-scale-select'),contentSource=document.querySelector('#oc-content-filter-select'),scale=header.querySelector('[data-shell-scale]'),content=header.querySelector('[data-shell-content]');
  if(scale&&scaleSource){scale.innerHTML=optionHtml(scaleSource);scale.value=scaleSource.value} if(content&&contentSource){content.innerHTML=optionHtml(contentSource);content.value=contentSource.value}
  header.addEventListener('click',event=>{ const nav=event.target.closest('[data-shell-tab]'); if(nav){closeMenus(header);navigateTab(nav.dataset.shellTab);syncActive(header);return} if(event.target.closest('.oc-shell-ratings-toggle')){const toggle=header.querySelector('.oc-shell-ratings-toggle'),menu=header.querySelector('.oc-shell-ratings-menu'),willOpen=Boolean(menu?.hidden);closeMenus(header);if(menu)menu.hidden=!willOpen;toggle?.setAttribute('aria-expanded',String(willOpen));return} if(event.target.closest('.oc-shell-account')){const button=header.querySelector('.oc-shell-account'),menu=header.querySelector('.oc-shell-account-menu'),willOpen=Boolean(menu?.hidden);closeMenus(header);if(menu)menu.hidden=!willOpen;button?.setAttribute('aria-expanded',String(willOpen));return} if(event.target.closest('[data-shell-account]')){document.querySelector('#oc-access-badge')?.click();closeMenus(header)} if(event.target.closest('[data-shell-quality]')){window.dispatchEvent(new Event('oped-open-quality'));closeMenus(header)} if(event.target.closest('[data-shell-repair]')){document.querySelector('#oc-franchise-repair-btn')?.click();closeMenus(header)} if(event.target.closest('[data-shell-images]')){document.querySelector('#oc-image-migration-btn')?.click();closeMenus(header)} if(event.target.closest('.oc-shell-daily'))document.querySelector('#oc-daily-bell')?.click(); });
  scale?.addEventListener('change',()=>{if(!scaleSource)return;scaleSource.value=scale.value;scaleSource.dispatchEvent(new Event('change',{bubbles:true}))}); content?.addEventListener('change',()=>{if(!contentSource)return;contentSource.value=content.value;contentSource.dispatchEvent(new Event('change',{bubbles:true}))}); scaleSource?.addEventListener('change',()=>{if(scale)scale.value=scaleSource.value}); contentSource?.addEventListener('change',()=>{if(content)content.value=contentSource.value});
  document.addEventListener('click',event=>{if(!header.contains(event.target))closeMenus(header)}); new MutationObserver(()=>{syncActive(header);syncAccount(header)}).observe(document.querySelector('#opedchart-root'),{subtree:true,childList:true,attributes:true,attributeFilter:['class']}); document.querySelector('#oc-myname')?.addEventListener('input',()=>syncAccount(header)); window.setInterval(()=>syncAccount(header),800); syncActive(header); syncAccount(header);
}
export function initHeader(){const header=makeHeader();if(header)bind(header)}
