(() => {
  if (window.__OC_MY_EVENTS_PROFILE_READY__) return;
  window.__OC_MY_EVENTS_PROFILE_READY__ = true;

  const CURRENT_EVENT_YEAR = 2026;
  const SEASONS = ['winter', 'spring', 'summer', 'fall'];
  const SEASON_LABEL = { winter:'Зима', spring:'Весна', summer:'Лето', fall:'Осень' };
  const ASSIGNMENT_SEEN_PREFIX = 'oc-event-assignment-seen-v1:';
  let loadedForUid = '';
  let loading = false;
  let lastData = null;

  const clean = value => String(value || '').trim();
  const norm = value => clean(value).toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0,60);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

  function root() { return document.querySelector('#oc-profile-panel'); }
  function tab() { return root()?.querySelector('.oc-profile-subtabs [data-profile-view="events"]'); }
  function bell() { return document.querySelector('#oc-daily-bell'); }

  function ensurePanel() {
    const profile = root();
    if (!profile) return null;
    let panel = profile.querySelector('#oc-my-events-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'oc-my-events-panel';
      panel.className = 'oc-my-events-panel';
      const anchor = profile.querySelector('#oc-daily-panel') || profile.querySelector('.oc-allratings') || profile.lastElementChild;
      anchor?.insertAdjacentElement('afterend', panel);
    }
    panel.classList.toggle('oc-profile-section-hidden', profile.dataset.profileView !== 'events');
    return panel;
  }

  function seenAssignments(uid) {
    try {
      const raw = JSON.parse(localStorage.getItem(`${ASSIGNMENT_SEEN_PREFIX}${uid}`) || '[]');
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch (_) { return new Set(); }
  }

  function markSeen(uid, key) {
    const seen = seenAssignments(uid);
    seen.add(String(key));
    try { localStorage.setItem(`${ASSIGNMENT_SEEN_PREFIX}${uid}`, JSON.stringify([...seen])); } catch (_) {}
    updateNoticeBadge(lastData);
  }

  function bindingRows(row) { return Array.isArray(row?.participantBindings) ? row.participantBindings : []; }

  function accessibleSeason(row, nickname, uid) {
    if (!row || row.closed || Number(row.year || CURRENT_EVENT_YEAR) !== CURRENT_EVENT_YEAR) return null;
    const key = norm(nickname);
    const slots = Array.isArray(row.allowedNicknames) ? row.allowedNicknames : [];
    const slotIndex = slots.findIndex(name => norm(name) === key);
    if (slotIndex < 0 || slotIndex >= 15) return null;
    const binding = bindingRows(row).find(item => norm(item?.nicknameKey || item?.nickname) === key);
    if (binding?.authUid && String(binding.authUid) !== String(uid)) return null;
    return { ...row, key:String(row.key || row.id || `${CURRENT_EVENT_YEAR}_${row.season || ''}`), slot:slotIndex+1, selectedOpeningIds:Array.isArray(row.selectedOpeningIds) ? row.selectedOpeningIds.map(String) : [], accountLinked:Boolean(binding?.authUid ? String(binding.authUid) === String(uid) : true) };
  }

  async function firebaseTools() {
    const [{ getApp, getApps }, firestore, authModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js')
    ]);
    for (let attempt=0; attempt<100 && !getApps().length; attempt+=1) await new Promise(resolve => setTimeout(resolve,50));
    if (!getApps().length) throw new Error('Firebase ещё не готов.');
    const app = getApp();
    return { app, auth:authModule.getAuth(app), db:firestore.getFirestore(app), ...firestore };
  }

  async function accountProfile(tools, user) {
    const snapshot = await tools.getDocs(tools.query(tools.collection(tools.db,'userProfiles'), tools.where('authUid','==',String(user.uid)), tools.limit(1)));
    const docSnap = snapshot.docs[0];
    if (!docSnap) return null;
    const row = { id:docSnap.id, ...docSnap.data() };
    const nickname = clean(row.nickname || row.nicknameKey || docSnap.id);
    return nickname ? { ...row, nickname, nicknameKey:norm(row.nicknameKey || nickname) } : null;
  }

  async function loadData(force = false) {
    if (loading) return lastData;
    const tools = await firebaseTools();
    if (typeof tools.auth.authStateReady === 'function') await tools.auth.authStateReady();
    const user = tools.auth.currentUser;
    if (!user || user.isAnonymous) return null;
    if (!force && loadedForUid === user.uid && lastData) return lastData;
    loading = true;
    try {
      const profile = await accountProfile(tools, user);
      if (!profile?.nicknameKey) return null;
      const nickname = profile.nickname;
      const nicknameKey = profile.nicknameKey;
      const seasonPromise = tools.getDocs(tools.collection(tools.db,'eventSeasons'));
      const ratingPromise = tools.getDocs(tools.query(tools.collection(tools.db,'eventRatings'), tools.where('nicknameKey','==',nicknameKey)));
      const reminderPromise = tools.getDocs(tools.query(tools.collection(tools.db,'eventNotifications'), tools.where('recipientUid','==',String(user.uid)))).catch(error => {
        console.warn('My Events reminders load skipped', error);
        return null;
      });
      const [seasonSnapshot, ratingSnapshot, reminderSnapshot] = await Promise.all([seasonPromise, ratingPromise, reminderPromise]);
      const seasons = seasonSnapshot.docs.map(docSnap => accessibleSeason({ id:docSnap.id, ...docSnap.data() }, nickname, user.uid)).filter(Boolean).sort((a,b)=>SEASONS.indexOf(a.season)-SEASONS.indexOf(b.season));
      const ratings = ratingSnapshot.docs.map(docSnap => ({ id:docSnap.id, ...docSnap.data() }));
      const reminders = reminderSnapshot ? reminderSnapshot.docs.map(docSnap => ({ id:docSnap.id, ...docSnap.data() })).filter(row => row.eventType === 'season-reminder' && !row.acknowledged) : [];
      lastData = { uid:String(user.uid), nickname, nicknameKey, seasons, ratings, reminders };
      loadedForUid = user.uid;
      updateNoticeBadge(lastData);
      return lastData;
    } finally {
      loading = false;
    }
  }

  function progress(data, season) {
    const ids = new Set((season.selectedOpeningIds || []).map(String));
    const done = new Set(data.ratings.filter(row => String(row.seasonKey || '') === String(season.key) && ids.has(String(row.openingId || '')) && Number.isFinite(Number(row.score))).map(row => String(row.openingId)));
    return { done:done.size, total:ids.size, complete:ids.size>0 && done.size>=ids.size };
  }

  function pendingSeasons(data) {
    if (!data) return [];
    return data.seasons.filter(season => {
      const state = progress(data, season);
      return state.total > state.done;
    });
  }

  function activeReminders(data) {
    if (!data) return [];
    const pending = pendingSeasons(data);
    const pendingKeys = new Set(pending.map(season => String(season.key)));
    const pendingNames = new Set(pending.map(season => String(season.season || '')));
    return data.reminders.filter(row => {
      const seasonKey = String(row.seasonKey || '');
      if (seasonKey) return pendingKeys.has(seasonKey);
      const season = String(row.season || '');
      return Boolean(season && pendingNames.has(season));
    });
  }

  function noticeCount(data) {
    if (!data) return 0;
    const seen = seenAssignments(data.uid);
    const assignments = pendingSeasons(data).filter(row => !seen.has(String(row.key))).length;
    return assignments + activeReminders(data).length;
  }

  function updateNoticeBadge(data) {
    const count = noticeCount(data);
    const button = tab();
    if (button) {
      button.classList.toggle('oc-my-events-has-notice', count > 0);
      button.dataset.noticeCount = count ? String(count) : '';
    }
    const notificationBell = bell();
    if (notificationBell) {
      notificationBell.classList.toggle('oc-event-notice', count > 0);
      notificationBell.dataset.eventNoticeCount = count ? String(count) : '';
      if (count > 0) notificationBell.title = `Есть уведомления по ивентам: ${count}`;
      else if (notificationBell.title?.startsWith('Есть уведомления по ивентам')) notificationBell.removeAttribute('title');
    }
  }

  function ownProfileSelected(data) {
    const selected = clean(document.querySelector('#oc-profile-user')?.value);
    return !selected || norm(selected) === norm(data?.nickname);
  }

  function openMyEvents() {
    const profileButton = document.querySelector('.oc-tab-btn[data-tab="profile"]');
    if (profileButton && !profileButton.classList.contains('active')) profileButton.click();
    window.setTimeout(() => {
      const eventsTab = tab();
      if (eventsTab) {
        eventsTab.click();
        eventsTab.focus?.();
      }
    }, 0);
  }

  function render(data) {
    const panel = ensurePanel();
    if (!panel) return;
    if (!data) {
      panel.innerHTML = '<div class="oc-empty">Войди в зарегистрированный аккаунт, чтобы увидеть свои ивенты.</div>';
      return;
    }
    if (!ownProfileSelected(data)) {
      panel.innerHTML = '<div class="oc-empty">«Мои ивенты» показываются только для твоего собственного аккаунта.</div>';
      return;
    }

    const seasonCards = data.seasons.length ? data.seasons.map(season => {
      const p = progress(data, season);
      const unseen = !seenAssignments(data.uid).has(String(season.key));
      return `<article class="oc-my-events-season ${p.complete?'complete':''} ${unseen?'unseen':''}"><div class="oc-my-events-season-top"><div><span>${esc(SEASON_LABEL[season.season] || season.season)} ${season.year}</span><strong>${p.done}/${p.total} оценено${p.complete?' ✓':''}</strong></div><span class="oc-my-events-linked">аккаунт ✓</span></div><div class="oc-my-events-progress"><span style="width:${p.total?Math.round(p.done/p.total*100):0}%"></span></div><p>${p.complete?'Сезон полностью оценён.':`Осталось ${Math.max(0,p.total-p.done)} OP · строка участника ${season.slot}.`}</p><a href="events.html?season=${encodeURIComponent(season.season)}" data-my-events-open-season="${esc(season.key)}">${p.done ? 'Продолжить оценивание' : 'Начать оценку'}</a></article>`;
    }).join('') : '<div class="oc-empty">Сейчас твой ник не указан ни в одном открытом сезоне.</div>';

    const reminders = activeReminders(data);
    const reminderHtml = reminders.length ? `<section class="oc-my-events-reminders"><h3>Напоминания</h3>${reminders.map(row => `<div><strong>${esc(row.seasonLabel || SEASON_LABEL[row.season] || 'Сезон')}</strong><span>${esc(row.message || 'Есть незавершённые оценки.')}</span><a href="events.html?season=${encodeURIComponent(row.season || '')}">Открыть</a></div>`).join('')}</section>` : '';

    panel.innerHTML = `<div class="oc-my-events-head"><div><span>личный центр</span><h2>Мои ивенты</h2><p>${esc(data.nickname)} · сезоны и быстрый переход к игровым режимам.</p></div><a href="events.html">Открыть Events</a></div>${reminderHtml}<section class="oc-my-events-seasons"><h3>Сезонные оценки</h3><div class="oc-my-events-grid">${seasonCards}</div></section><section class="oc-my-events-games"><h3>Игровые режимы</h3><div><a href="events.html?full=1&mode=guess">Угадайка</a><a href="events.html?full=1&mode=bestworst">Лучшее / Худшее</a><a href="events.html?full=1&mode=codenames">Codenames</a><a href="events.html?full=1&mode=blindtier">Слепой тир-лист</a><a href="events.html?full=1&mode=whoami">Кто я?</a><a href="events.html?full=1&mode=predictions">Предикты</a></div></section>`;
    panel.querySelectorAll('[data-my-events-open-season]').forEach(link => link.addEventListener('click', () => markSeen(data.uid, link.dataset.myEventsOpenSeason)));
  }

  async function refresh(force = false) {
    try {
      const data = await loadData(force);
      updateNoticeBadge(data);
      if (root()?.dataset.profileView === 'events') render(data);
    } catch (error) {
      console.warn('My Events profile load failed', error);
      if (root()?.dataset.profileView === 'events') ensurePanel().innerHTML = '<div class="oc-empty">Не удалось загрузить ивенты.</div>';
    }
  }

  function watchProfileView() {
    const profile = root();
    if (!profile) return;
    ensurePanel();
    new MutationObserver(() => {
      const panel = ensurePanel();
      panel?.classList.toggle('oc-profile-section-hidden', profile.dataset.profileView !== 'events');
      if (profile.dataset.profileView === 'events') void refresh(false);
    }).observe(profile, { attributes:true, attributeFilter:['data-profile-view'] });
    profile.querySelector('#oc-profile-user')?.addEventListener('change', () => { if (profile.dataset.profileView === 'events') render(lastData); });
  }

  function bindBell() {
    document.addEventListener('click', event => {
      const notificationBell = event.target.closest?.('#oc-daily-bell');
      if (!notificationBell || noticeCount(lastData) <= 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openMyEvents();
    }, true);
  }

  function init() {
    watchProfileView();
    bindBell();
    window.setTimeout(() => void refresh(false), 800);
    window.addEventListener('oped-account-restored', () => { loadedForUid=''; lastData=null; void refresh(true); });
    window.addEventListener('storage', event => { if (event.key?.startsWith(ASSIGNMENT_SEEN_PREFIX)) updateNoticeBadge(lastData); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();