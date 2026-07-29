(() => {
  if (window.__OC_REGISTERED_USERS_ONLY_READY__) return;
  window.__OC_REGISTERED_USERS_ONLY_READY__ = true;

  const PROFILE_LIST_ID = 'oc-profile-user';
  const EVENT_DATALIST_ID = 'ev-known-participants';
  const ADMIN_ORDER = ['пес_кошачий', 'пёс_кошачий', 'toxexex', 'egortos', 'кофа'];
  let knownByKey = new Map();
  let profilesLoaded = false;
  let syncQueued = false;

  const clean = value => String(value || '').trim();
  const normalize = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60);

  function profileName(row) {
    return clean(row?.nickname || row?.displayName || row?.name || row?.nicknameKey || row?.id);
  }

  function adminRank(rowOrName) {
    const name = typeof rowOrName === 'string' ? rowOrName : profileName(rowOrName);
    const key = normalize(name);
    const ranks = ['пес_кошачий', 'toxexex', 'egortos', 'кофа'];
    return ranks.indexOf(key);
  }

  function isAdminProfile(rowOrName) {
    return adminRank(rowOrName) >= 0;
  }

  function compareProfiles(a, b) {
    const rankA = adminRank(a);
    const rankB = adminRank(b);
    if (rankA >= 0 || rankB >= 0) {
      if (rankA < 0) return 1;
      if (rankB < 0) return -1;
      return rankA - rankB;
    }
    return profileName(a).localeCompare(profileName(b), 'ru', { sensitivity: 'base' });
  }

  function knownRows(rows) {
    const next = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const name = profileName(row);
      const key = normalize(row?.nicknameKey || name || row?.id);
      if (!name || !key) return;
      const existing = next.get(key);
      if (!existing || (!clean(existing.avatar) && clean(row?.avatar))) next.set(key, { ...row, nickname: name, nicknameKey: key });
    });
    return [...next.values()].sort(compareProfiles);
  }

  function setProfiles(rows) {
    const profiles = knownRows(rows);
    knownByKey = new Map(profiles.map(row => [normalize(row.nicknameKey || profileName(row)), row]));
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
    if (!select || !profilesLoaded || !knownByKey.size) return;

    const profiles = [...knownByKey.values()].sort(compareProfiles);
    const previous = clean(select.value);
    const previousKey = normalize(previous);
    const accountKey = normalize(currentAccountName());
    const selectedRow = knownByKey.get(previousKey) || knownByKey.get(accountKey) || profiles[0];
    const selectedName = profileName(selectedRow);

    const expected = profiles.map(row => {
      const name = profileName(row);
      const avatar = clean(row.avatar) || '🙂';
      const admin = isAdminProfile(row);
      return { value: name, label: `${admin ? '🔧 ' : ''}${avatar} ${name}`, admin };
    });
    const expectedSignature = expected.map(row => `${row.value}\u0000${row.label}`).join('\u0001');
    const selectionChanged = normalize(previous) !== normalize(selectedName);

    if (optionSignature(select) !== expectedSignature) {
      select.replaceChildren(...expected.map(row => {
        const option = document.createElement('option');
        option.value = row.value;
        option.textContent = row.label;
        if (row.admin) option.dataset.admin = '1';
        return option;
      }));
    }
    select.value = selectedName;
    if (selectionChanged) select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function ensureEventDatalist() {
    if (!profilesLoaded || !knownByKey.size) return null;
    let datalist = document.getElementById(EVENT_DATALIST_ID);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = EVENT_DATALIST_ID;
      document.body.append(datalist);
    }
    const profiles = [...knownByKey.values()].sort(compareProfiles);
    const expected = profiles.map(row => ({ name: profileName(row), admin: isAdminProfile(row) }));
    const current = [...datalist.options].map(option => `${option.value}\u0000${option.label || ''}`);
    const signature = expected.map(row => `${row.name}\u0000${row.admin ? '🔧 админ' : ''}`);
    if (current.join('\u0001') !== signature.join('\u0001')) {
      datalist.replaceChildren(...expected.map(row => {
        const option = document.createElement('option');
        option.value = row.name;
        if (row.admin) option.label = '🔧 админ';
        return option;
      }));
    }
    return datalist;
  }

  function syncEventParticipantInputs() {
    ensureEventDatalist();
    document.querySelectorAll('.ev-participant-input').forEach(input => {
      const name = clean(input.value);
      const profile = knownByKey.get(normalize(name));
      if (profile && name !== profileName(profile)) input.value = profileName(profile);
      if (!input.disabled && knownByKey.size) input.setAttribute('list', EVENT_DATALIST_ID);
      input.removeAttribute('data-registered-only');
      if (!input.disabled) input.title = 'Можно выбрать пользователя из списка или ввести гостевой ник вручную';
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

  document.addEventListener('change', event => {
    const input = event.target?.closest?.('.ev-participant-input');
    if (!input || !profilesLoaded) return;
    const profile = knownByKey.get(normalize(input.value));
    if (profile) input.value = profileName(profile);
  }, true);

  new MutationObserver(scheduleSync).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('oped:user-profiles-updated', event => setProfiles(event?.detail?.rows));
  window.addEventListener('oped:route-ready', event => {
    if (event?.detail?.tab === 'profile') scheduleSync();
  });
  const initialRows = window.OC_APP_DATA?.userProfiles;
  if (Array.isArray(initialRows)) setProfiles(initialRows);
  else scheduleSync();
})();
