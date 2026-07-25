(() => {
  if (window.__OC_REGISTERED_USERS_ONLY_READY__) return;
  window.__OC_REGISTERED_USERS_ONLY_READY__ = true;

  const PROFILE_LIST_ID = 'oc-profile-user';
  const EVENT_DATALIST_ID = 'ev-registered-participants';
  let registeredByKey = new Map();
  let profilesLoaded = false;
  let syncQueued = false;
  let unsubscribe = null;

  const clean = value => String(value || '').trim();
  const normalize = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60);

  function profileName(row) {
    return clean(row?.nickname || row?.displayName || row?.name || row?.nicknameKey || row?.id);
  }

  function registeredRows(rows) {
    const next = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const name = profileName(row);
      const key = normalize(row?.nicknameKey || name || row?.id);
      if (!name || !key || !clean(row?.authUid)) return;
      const existing = next.get(key);
      if (!existing || (!clean(existing.avatar) && clean(row?.avatar))) next.set(key, { ...row, nickname: name, nicknameKey: key });
    });
    return [...next.values()].sort((a, b) => profileName(a).localeCompare(profileName(b), 'ru', { sensitivity: 'base' }));
  }

  function setProfiles(rows) {
    const profiles = registeredRows(rows);
    registeredByKey = new Map(profiles.map(row => [normalize(row.nicknameKey || profileName(row)), row]));
    profilesLoaded = true;
    scheduleSync();
  }

  function currentAccountName() {
    return clean(
      document.querySelector('#oc-myname')?.value ||
      document.querySelector('#ev-myname')?.value ||
      localStorage.getItem('op-ed-primary-account-name') ||
      localStorage.getItem('my-display-name')
    );
  }

  function optionSignature(select) {
    return [...select.options].map(option => `${option.value}\u0000${option.textContent}`).join('\u0001');
  }

  function syncMainProfileSelect() {
    const select = document.getElementById(PROFILE_LIST_ID);
    if (!select || !profilesLoaded || !registeredByKey.size) return;

    const profiles = [...registeredByKey.values()].sort((a, b) => profileName(a).localeCompare(profileName(b), 'ru', { sensitivity: 'base' }));
    const previous = clean(select.value);
    const previousKey = normalize(previous);
    const accountKey = normalize(currentAccountName());
    const selectedRow = registeredByKey.get(previousKey) || registeredByKey.get(accountKey) || profiles[0];
    const selectedName = profileName(selectedRow);

    const expected = profiles.map(row => {
      const name = profileName(row);
      const avatar = clean(row.avatar) || '🙂';
      return { value: name, label: `${avatar} ${name}` };
    });
    const expectedSignature = expected.map(row => `${row.value}\u0000${row.label}`).join('\u0001');
    const selectionChanged = normalize(previous) !== normalize(selectedName);

    if (optionSignature(select) !== expectedSignature) {
      select.replaceChildren(...expected.map(row => {
        const option = document.createElement('option');
        option.value = row.value;
        option.textContent = row.label;
        return option;
      }));
    }
    select.value = selectedName;
    if (selectionChanged) select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function ensureEventDatalist() {
    if (!profilesLoaded || !registeredByKey.size) return null;
    let datalist = document.getElementById(EVENT_DATALIST_ID);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = EVENT_DATALIST_ID;
      document.body.append(datalist);
    }
    const profiles = [...registeredByKey.values()].sort((a, b) => profileName(a).localeCompare(profileName(b), 'ru', { sensitivity: 'base' }));
    const expected = profiles.map(profileName);
    const current = [...datalist.options].map(option => option.value);
    if (current.join('\u0001') !== expected.join('\u0001')) {
      datalist.replaceChildren(...expected.map(name => {
        const option = document.createElement('option');
        option.value = name;
        return option;
      }));
    }
    return datalist;
  }

  function syncEventParticipantInputs() {
    if (!profilesLoaded || !registeredByKey.size) return;
    ensureEventDatalist();
    document.querySelectorAll('.ev-participant-input').forEach(input => {
      const name = clean(input.value);
      const key = normalize(name);
      const profile = key ? registeredByKey.get(key) : null;
      if (name && !profile) input.value = '';
      else if (profile && name !== profileName(profile)) input.value = profileName(profile);
      if (!input.disabled) input.setAttribute('list', EVENT_DATALIST_ID);
      input.dataset.registeredOnly = '1';
      input.title = input.disabled ? input.title : 'Выберите зарегистрированный аккаунт из базы';
    });
  }

  function syncAll() {
    syncQueued = false;
    syncMainProfileSelect();
    syncEventParticipantInputs();
  }

  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(syncAll);
  }

  async function subscribeProfiles() {
    if (typeof window.OPED_DB?.watchUserProfiles === 'function') {
      unsubscribe = window.OPED_DB.watchUserProfiles(setProfiles);
      return;
    }

    const [{ getApp, getApps }, { getFirestore, collection, onSnapshot }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
    ]);
    for (let attempt = 0; attempt < 120 && !getApps().length; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!getApps().length) return;
    unsubscribe = onSnapshot(collection(getFirestore(getApp()), 'userProfiles'), snapshot => {
      setProfiles(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }, error => console.warn('Registered users list load failed', error));
  }

  document.addEventListener('change', event => {
    const input = event.target?.closest?.('.ev-participant-input');
    if (!input || !profilesLoaded || !registeredByKey.size) return;
    const profile = registeredByKey.get(normalize(input.value));
    if (profile) input.value = profileName(profile);
    else input.value = '';
  }, true);

  new MutationObserver(scheduleSync).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('beforeunload', () => { try { unsubscribe?.(); } catch (_) {} }, { once: true });

  subscribeProfiles().catch(error => console.warn('Registered users filter failed', error));
  [100, 500, 1200, 2500].forEach(delay => window.setTimeout(scheduleSync, delay));
})();
