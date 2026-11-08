(() => {
  'use strict';

  const storageKey = 'pikucoFollowingAccounts';
  const priorityKey = 'pikucoFollowingPriorityAuthors';
  const priorityLimit = 10;
  const modeHash = '#pikuco-following';
  const hiddenAttribute = 'data-pikuco-following-hidden';
  const resultAttribute = 'data-pikuco-following-result';
  const passedSelector = '.test-item__passed';
  const excluded = 'script, style, textarea, [contenteditable], header, footer, nav, aside';
  const isTestFeed = /^\/tests\/?$/i.test(location.pathname);

  const accountPath = /^\/(?:personal|account|cabinet|lk|profile)(?:\/|$)/i;
  const subscriptionTabs = ['подписчики', 'подписки', 'заблокированные'];
  const subscriptionLabels = new Set([...subscriptionTabs, 'отписаться']);
  const navigationControl = 'a[href], button, label, [role="tab"], [role="button"]';
  const refreshInterval = 5 * 60 * 1000;
  if (/^\/posts(?:\/|$)/i.test(location.pathname)) return;

  chrome.storage.local.get({ enableFollowingFeed: true, [storageKey]: null, [priorityKey]: [] }, (settings) => {
    if (chrome.runtime.lastError || !settings.enableFollowingFeed || !document.body) return;
    const priorities = readPriorities(settings[priorityKey]);
    if (isTestFeed) installFeed(settings[storageKey], priorities);
    else installSubscriptionsReader(settings[storageKey], priorities);
  });

  function normalize(text) {
    return text.toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();
  }

  function readPriorities(value) {
    const priorities = new Map();
    for (const item of Array.isArray(value) ? value : []) {
      if (typeof item?.id !== 'string' || !/^\d+$/.test(item.id) || priorities.has(item.id)) continue;
      priorities.set(item.id, typeof item.name === 'string' ? item.name : `Профиль ${item.id}`);
      if (priorities.size === priorityLimit) break;
    }
    return priorities;
  }

  function sameSiteUrl(value, base = location.href) {
    if (!value) return null;
    try {
      const url = new URL(value, base);
      return url.origin === location.origin ? url : null;
    } catch {
      return null;
    }
  }

  function accountId(link) {
    const path = sameSiteUrl(link.getAttribute('href'), link.ownerDocument?.URL)?.pathname;
    return path?.match(/^\/profile\/(\d+)\/?$/i)?.[1] ?? null;
  }

  function itemKey(link) {
    const path = sameSiteUrl(link.getAttribute('href'), link.ownerDocument?.URL)?.pathname;
    return path?.match(/^\/tests\/(\d+)\/?$/i)?.[1] ?? null;
  }

  function visible(element) {
    return element.getClientRects().length > 0 && !element.closest('[hidden], [aria-hidden="true"]');
  }

  function exactLabels(root, names) {
    const matches = new Map();
    const walker = (root.ownerDocument ?? document).createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const name = normalize(node.nodeValue);
      const element = node.parentElement;
      if (!names.has(name) || element.closest(excluded) || !visible(element)) continue;
      if (!matches.has(name)) matches.set(name, []);
      matches.get(name).push(element);
    }
    return matches;
  }

  function observeChanges(update) {
    let timer;
    function schedule() {
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        update();
      }, 100);
    }
    const observer = new MutationObserver((records) => {
      if (records.some(record => record.type === 'characterData' ||
          [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();
    return schedule;
  }

  function isCabinet(doc) {
    return /личный\s+кабинет/i.test(doc.body?.textContent ?? '');
  }

  function selectedScore(label, group) {
    let score = 0;
    const view = label.ownerDocument?.defaultView ?? window;
    for (let element = label; element && element !== group; element = element.parentElement) {
      if (element.matches('[aria-selected="true"], [aria-current="page"], [aria-pressed="true"]') ||
          element.querySelector('input[type="radio"]:checked')) return 3;
        const style = view.getComputedStyle ? view.getComputedStyle(element) : getComputedStyle(element);
        const color = style.backgroundColor?.match(/\d+/g)?.map(Number);
      if (color && color[0] >= 190 && color[1] >= 135 && color[1] - color[2] >= 40) score = 2;
      else if (!score && /(?:^|[\s_-])(?:active|selected|current|checked)(?:$|\s)/i
        .test(element.getAttribute('class') ?? '')) score = 1;
    }
    return score;
  }

  function subscriptionView(doc) {
    if (!isCabinet(doc)) return null;
    const labels = exactLabels(doc.body, subscriptionLabels);
    for (const tab of labels.get('подписки') ?? []) {
      for (let group = tab.parentElement, depth = 0; group && depth < 4; group = group.parentElement, depth++) {
        if (!subscriptionTabs.every(name => (labels.get(name) ?? []).some(label => group.contains(label)))) continue;
        const score = selectedScore(tab, group);
        const selected = score > 0 && !['подписчики', 'заблокированные'].some(name =>
          (labels.get(name) ?? []).some(label => group.contains(label) && selectedScore(label, group) >= score));
        return { labels, tab, group, selected };
      }
    }
    return null;
  }

  function readSubscribedAccounts(doc, view) {
    const ids = new Set();
    const cards = new Map();
    const ratings = {};
    for (const label of view.labels.get('отписаться') ?? []) {
      for (let card = label.parentElement, depth = 0; card && depth < 6; card = card.parentElement, depth++) {
        if (card.contains(view.tab)) break;
        const links = [...card.querySelectorAll('a[href]')];
        const accounts = new Set(links.map(accountId).filter(Boolean));
        if (accounts.size > 1) break;
        const dataId = card.getAttribute('data-user-id') ?? card.getAttribute('data-profile-id');
        const id = accounts.values().next().value ?? dataId;
        if (/^\d+$/.test(id ?? '')) {
          ids.add(id);
          const profile = links.find(link => link.textContent.trim() && accountId(link) === id);
          const name = profile?.textContent.trim() || `Профиль ${id}`;
          cards.set(card, { id, name, control: label.closest(navigationControl) ?? label });
          const rating = readAccountRating(card);
          if (rating !== undefined) ratings[id] = rating;
          break;
        }
      }
    }
    if (ids.size) return { ids, cards, ratings, last: [...cards.keys()].at(-1) };
    const empty = /нет (?:активных )?подписок|ни на кого не подписан/.test(normalize(doc.body.innerText));
    return empty ? { ids, cards, ratings } : null;
  }

  function readAccountRating(card) {
    for (const node of card.querySelectorAll('div, span, p, b, strong, small, [title], [aria-label]')) {
      const text = normalize(node.textContent);
      const label = normalize(node.getAttribute('title') ?? node.getAttribute('aria-label') ?? '');
      const match = text.match(/^(?:рейтинг\s*([+−-]?\d[\d ]*)|([+−-]?\d[\d ]*)\s*рейтинг)$/);
      const value = match?.[1] ?? match?.[2] ??
        (/^рейтинг(?: пользователя)?$/.test(label) && /^[+−-]?\d[\d ]*$/.test(text) ? text : undefined);
      if (value !== undefined) {
        const rating = Number(value.replaceAll(' ', '').replace('−', '-'));
        if (Number.isSafeInteger(rating)) return rating;
      }
    }
    return undefined;
  }

  function safeSource(value) {
    const url = sameSiteUrl(value);
    if (!url) return undefined;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/(?:token|sess|sid|auth|key|code|csrf|nonce|signature|pass)/i.test(key)) url.searchParams.delete(key);
    }
    return url.pathname + url.search;
  }

  function isPaged(url) {
    return [...url.searchParams.keys()].some(key =>
      /^(?:PAGEN_\d+|page)$/i.test(key) && Number(url.searchParams.get(key)) > 1);
  }

  function sameAccounts(previous, ids) {
    return previous?.ids?.length === ids.length && previous.ids.every((id, index) => id === ids[index]);
  }

  function installSubscriptionsReader(saved, priorities) {
    if (!isCabinet(document) && !accountPath.test(location.pathname)) return;
    let previous = saved;
    let status;
    let priorityPanel;
    let prioritySummary;
    let priorityList;
    let renderedPriorities;
    let write = Promise.resolve();
    const stars = new Map();

    function changePriority(id, name, remove = false) {
      async function save() {
        const stored = await chrome.storage.local.get({ [priorityKey]: [] });
        const next = readPriorities(stored[priorityKey]);
        if (next.has(id)) next.delete(id);
        else if (!remove && next.size < priorityLimit) next.set(id, name);
        else {
          priorities = next;
          update();
          return;
        }
        await chrome.storage.local.set({ [priorityKey]: Array.from(next, ([id, name]) => ({ id, name })) });
        priorities = next;
        update();
      }
      write = write.then(() => navigator.locks ? navigator.locks.request(priorityKey, save) : save())
        .catch(() => {
          if (status?.isConnected) status.textContent = 'Не удалось сохранить звёздочку.';
        });
    }

    function renderPriorities(cards) {
      for (const [card, star] of stars) {
        const account = cards.get(card);
        if (!account || account.id !== star.getAttribute('data-author-id') ||
            star.nextElementSibling !== account.control) {
          star.remove();
          stars.delete(card);
        }
      }
      for (const [card, { id, name, control }] of cards) {
        let star = stars.get(card);
        if (!star) {
          star = document.createElement('button');
          star.type = 'button';
          star.className = 'pikuco-following-star';
          star.setAttribute('data-author-id', id);
          star.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            changePriority(id, name);
          });
          control.before(star);
          stars.set(card, star);
        }
        const selected = priorities.has(id);
        star.setAttribute('aria-pressed', String(selected));
        star.disabled = !selected && priorities.size >= priorityLimit;
        const action = selected ? 'Снять звёздочку' : 'Обрабатывать первым';
        star.setAttribute('aria-label', `${action} · ${name}`);
        star.title = star.disabled ? `Можно отметить до ${priorityLimit} авторов` : action;
        const symbol = selected ? '★' : '☆';
        if (star.textContent !== symbol) star.textContent = symbol;
      }

      if (renderedPriorities === priorities) return;
      prioritySummary.textContent = `Приоритетные авторы ${priorities.size} из ${priorityLimit}`;
      const list = document.createDocumentFragment();
      for (const [id, name] of priorities) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = `${name} ×`;
        remove.setAttribute('aria-label', `Снять звёздочку · ${name}`);
        remove.addEventListener('click', () => changePriority(id, name, true));
        list.append(remove);
      }
      if (!priorities.size) list.append(document.createTextNode('Нажми ☆ рядом с нужным автором.'));
      priorityList.replaceChildren(list);
      renderedPriorities = priorities;
    }

    function update() {
      const view = subscriptionView(document);
      const found = view?.selected && readSubscribedAccounts(document, view);
      if (!found) {
        status?.remove();
        status = undefined;
        priorityPanel?.remove();
        for (const star of stars.values()) star.remove();
        stars.clear();
        return;
      }
      const url = new URL(location.href);
      const paged = isPaged(url);
      const all = paged ? new Set([...(previous?.ids ?? []), ...found.ids]) : found.ids;
      const ids = [...all].sort();
      const ratings = paged ? { ...previous?.ratings, ...found.ratings } : found.ratings;
      const source = safeSource(url.href);
      if (!sameAccounts(previous, ids) || !previous?.ratings ||
          ids.some(id => ratings[id] !== previous.ratings[id]) || previous?.source !== source || !previous?.updatedAt) {
        previous = { ids, ratings, source, updatedAt: Date.now() };
        chrome.storage.local.set({ [storageKey]: previous });
      }
      if (!status?.isConnected) {
        status = document.createElement('p');
        status.className = 'pikuco-following-capture';
        status.setAttribute('role', 'status');
        view.group.after(status);
        priorityPanel?.remove();
        priorityPanel = document.createElement('details');
        priorityPanel.className = 'pikuco-following-priority';
        prioritySummary = document.createElement('summary');
        priorityList = document.createElement('div');
        priorityPanel.append(prioritySummary, priorityList);
        status.after(priorityPanel);
        renderedPriorities = undefined;
      }
      const message = `Пикуко — инструменты: авторов для ленты подписок — ${ids.length}.`;
      if (status.textContent !== message) status.textContent = message;
      renderPriorities(found.cards);
    }
    const schedule = observeChanges(update);
    document.addEventListener('click', schedule, true);
    window.addEventListener('popstate', schedule);
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[priorityKey]) return;
      priorities = readPriorities(changes[priorityKey].newValue);
      schedule();
    });
  }

  function accountEntry(saved) {
    const remembered = sameSiteUrl(saved?.source);
    if (remembered && !isPaged(remembered)) return remembered.href;
    for (const link of document.querySelectorAll('a[href]')) {
      const url = sameSiteUrl(link.getAttribute('href'));
      if (!url || !accountPath.test(url.pathname)) continue;
      if (/^\/(?:personal|account|cabinet|lk)(?:\/?$|\/users\/?$)/i.test(url.pathname) ||
          /личный\s+кабинет/i.test([link.textContent, link.title, link.getAttribute('aria-label')].join(' '))) return url.href;
    }
    return new URL('/personal/', location.origin).href;
  }

  function navigateAccount(frame, doc, label) {
    const control = label.closest(navigationControl) ?? label;
    const href = control.getAttribute('href');
    if (href && !href.startsWith('#') && !/^javascript:/i.test(href)) {
      const url = sameSiteUrl(href, doc.URL);
      if (!url) return false;
      if (url.href.split('#')[0] !== doc.URL.split('#')[0]) {
        frame.src = url.href;
        return true;
      }
    }
    if (control.matches('button') && control.type === 'submit' && control.form) return false;
    control.click();
    return true;
  }

  function readAccountsInBackground(saved) {
    return new Promise((resolve) => {
      const frame = document.createElement('iframe');
      frame.className = 'pikuco-following-reader';
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      frame.tabIndex = -1;
      frame.src = accountEntry(saved);

      let usersOpened = false;
      let subscriptionsOpened = false;
      let source;
      let settledAt = Date.now();
      let snapshot;
      const ids = new Set();
      const ratings = {};
      const requestedPages = new Set();
      const deadline = Date.now() + 10000;

      function finish(result) {
        clearInterval(timer);
        frame.remove();
        resolve(result);
      }

      const timer = setInterval(() => {
        if (Date.now() >= deadline) {
          finish(null);
          return;
        }
        const doc = frame.contentDocument;
        if (!doc?.body || !sameSiteUrl(doc.URL) || !isCabinet(doc)) return;

        const view = subscriptionView(doc);
        if (!view) {
          if (usersOpened) return;
          const tabs = exactLabels(doc.body, new Set(['пользователи'])).get('пользователи') ?? [];
          if (tabs.length === 1) usersOpened = navigateAccount(frame, doc, tabs[0]);
          return;
        }
        if (!view.selected) {
          if (!subscriptionsOpened) subscriptionsOpened = navigateAccount(frame, doc, view.tab);
          return;
        }
        const found = readSubscribedAccounts(doc, view);
        if (!found) return;
        source ??= safeSource(doc.URL);
        for (const id of found.ids) ids.add(id);
        Object.assign(ratings, found.ratings);
        const signature = [...found.ids].sort().join(',');
        if (snapshot !== signature) {
          snapshot = signature;
          settledAt = Date.now();
        }
        const next = found.last && [...doc.querySelectorAll('a[href], button, [role="button"]')].find(element =>
          visible(element) && isAfter(found.last, element) && !found.last.contains(element) &&
          !element.closest('footer, nav') &&
          /^(?:(?:показать|загрузить|подгрузить) еще|следующая(?: страница)?)$/.test(normalize(element.textContent)));
        if (next && requestedPages.size < 8) {
          const page = doc.URL + '|' + signature;
          if (requestedPages.has(page)) return;
          if (navigateAccount(frame, doc, next)) {
            requestedPages.add(page);
            return;
          }
        }
        if (Date.now() - settledAt >= 350) finish({ ids: [...ids].sort(), ratings, source, updatedAt: Date.now() });
      }, 150);
      document.body.append(frame);
    });
  }

  function isAfter(first, second) {
    return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function readCards(scope, sortGroup, status) {
    const seeds = new Map();
    const nativeCards = new Map();
    const foundKeys = new Set();
    for (const link of scope.querySelectorAll('a[href]')) {
      const key = itemKey(link);
      if (!key || !link.textContent.trim() || foundKeys.has(key) || !isAfter(sortGroup, link) ||
          link.closest(`${excluded}, .pikuco-following-status, [${resultAttribute}]`)) continue;
      const native = link.closest('.test_item_wrap');
      if (native && native.querySelector('.test_item h3')?.contains(link)) {
        nativeCards.set(native, null);
        foundKeys.add(key);
        continue;
      }
      for (let parent = link.parentElement, depth = 0; parent && parent !== scope && depth < 7;
          parent = parent.parentElement, depth++) {
        if (parent.contains(sortGroup) || parent.contains(status) || parent.matches('header, footer, nav, aside, main')) break;
        const links = [...parent.querySelectorAll('a[href]')];
        if (links.map(itemKey).find(Boolean) !== key) break;
        const ids = new Set(links.filter(author => isAfter(author, link)).map(accountId).filter(Boolean));
        if (ids.size > 1) break;
        if (ids.size === 1) {
          foundKeys.add(key);
          seeds.set(parent, ids.values().next().value);
          break;
        }
      }
    }

    const counts = new Map();
    for (const seed of seeds.keys()) {
      for (let parent = seed.parentElement; parent && parent !== scope; parent = parent.parentElement) {
        counts.set(parent, (counts.get(parent) ?? 0) + 1);
      }
    }

    const cards = nativeCards;
    for (const [seed, id] of seeds) {
      let card = seed;
      while (card.parentElement && card.parentElement !== scope) {
        if (card.matches('article, [class~="post-item"], [class~="test-item"], [class~="post-card"], [class~="test-card"]')) break;
        const parent = card.parentElement;
        if (parent.contains(sortGroup) || parent.contains(status) || parent.matches('header, footer, nav, aside, main') ||
            counts.get(parent) > 1) break;
        const siblings = [...parent.children].filter(element => element !== card);
        if (siblings.some(element => element.matches('footer, nav, aside') ||
            /^(?:показать еще|загрузить еще|подгрузить еще|загрузка|загружаем)/.test(normalize(element.textContent)))) break;
        card = parent;
      }
      cards.set(card, id);
    }
    return cards;
  }

  function installFeed(initial, priorities) {
    const names = new Set(['интересные', 'новые', 'лучшие']);
    const minimumLoadingTime = 550;
    const sourceBatchSize = 10;
    let saved = initial;
    let group;
    let tab;
    let status;
    let message;
    let results;
    let rendered;
    let nativeAnchor;
    let nativeRows = [];
    let sourceState;
    let sourceLoad;
    let filtered = new Set();
    let attemptedSync = false;
    let syncing = false;
    const renderedRows = new WeakMap();
    const renderedNativeRows = new WeakMap();
    const passedIds = new Set();
    const coverTargets = new WeakMap();
    const requestedCovers = new WeakSet();
    const coverCache = new Map();
    const coverQueue = [];
    let pendingCovers = 0;
    const coverObserver = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((changes) => {
        for (const change of changes) {
          if (!change.isIntersecting || !active()) continue;
          coverObserver.unobserve(change.target);
          const entry = coverTargets.get(change.target);
          if (entry && !requestedCovers.has(change.target)) {
            requestedCovers.add(change.target);
            requestCover(entry, change.target);
          }
        }
      }, { rootMargin: '200px' })
      : null;

    function active() {
      return location.hash === modeHash;
    }

    function followingUrl() {
      const url = new URL(location.href);
      url.hash = modeHash;
      return url.href;
    }

    function clearFilter() {
      for (const card of filtered) card.removeAttribute(hiddenAttribute);
      filtered.clear();
      nativeAnchor = undefined;
      if (nativeRows.length) {
        removeNativeRows();
        rendered = undefined;
      }
    }

    function removeNativeRows() {
      for (const row of nativeRows) row.remove();
      nativeRows = [];
    }

    function syncAccounts() {
      if (attemptedSync || (saved?.ratings && saved.updatedAt && Date.now() - saved.updatedAt < refreshInterval)) return;
      attemptedSync = true;
      syncing = true;
      readAccountsInBackground(saved).then((result) => {
        syncing = false;
        if (result) {
          saved = result;
          chrome.storage.local.set({ [storageKey]: result });
        }
        update();
      });
    }

    function mount() {
      const labels = exactLabels(document.body, names);
      let reference;
      for (const newest of labels.get('новые') ?? []) {
        for (let parent = newest.parentElement, depth = 0; parent && depth < 5; parent = parent.parentElement, depth++) {
          if (![...names].every(name => (labels.get(name) ?? []).some(element => parent.contains(element)))) continue;
          group = parent;
          reference = newest;
          break;
        }
        if (group) break;
      }
      if (!group) return;
      const cells = [...group.children].filter(visible);
      for (const cell of cells) cell.classList.add('pikuco-following-sort-cell');
      group.classList.add('pikuco-following-sort-group');
      group.style.setProperty('--pikuco-following-columns', String(cells.length + 1));
      tab = document.createElement('a');
      tab.className = 'pikuco-following-tab pikuco-following-sort-cell';
      tab.href = followingUrl();
      tab.textContent = 'Подписки';
      group.append(tab);

      const fontSize = getComputedStyle(reference).fontSize;
      if (fontSize) tab.style.setProperty('--pikuco-following-font-size', fontSize);

      status = document.createElement('div');
      status.className = 'pikuco-following-status';
      status.hidden = true;
      message = document.createElement('span');
      message.setAttribute('role', 'status');
      results = document.createElement('ol');
      results.className = 'pikuco-following-results';
      status.append(message, results);
      rendered = undefined;
      group.addEventListener('click', (event) => {
        if (!active() || event.target === tab || tab.contains(event.target)) return;
        const url = new URL(location.href);
        url.hash = '';
        history.replaceState(history.state, '', url);
        update();
      }, true);
    }

    async function loadSources(older = false) {
      if (sourceLoad || !sourceState) return;
      const state = sourceState;
      if (older) {
        const order = new Map(state.ids.map((id, index) => [id, index]));
        state.cursors.sort((first, second) => (order.get(first.id) ?? Infinity) - (order.get(second.id) ?? Infinity));
      }
      const inputs = older ? state.cursors.slice() : state.ids.filter(id => !state.loadedAuthors.has(id));
      if (!inputs.length) return;
      const controller = new AbortController();
      const load = {
        controller, older,
        done: older ? state.archivePages : state.loadedAuthors.size,
        total: state.ids.length,
      };
      sourceLoad = load;
      renderStatus();

      const minimum = older ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, minimumLoadingTime));
      for (let offset = 0; offset < inputs.length; offset += sourceBatchSize) {
        const batch = inputs.slice(offset, offset + sourceBatchSize);
        const entries = new Map();
        const cursors = [];
        let errors = 0;
        await pikucoFollowingAuthors.collect(batch, older, controller.signal, (result) => {
          for (const entry of result.entries) entries.set(entry.key, entry);
          cursors.push(...result.cursors);
          if (result.error) errors++;
          load.done++;
          renderStatus();
        }).catch(() => {
          errors++;
        });
        await minimum;
        if (sourceLoad !== load || !active()) return;

        for (const [key, entry] of entries) state.entries.set(key, entry);
        if (older) {
          state.cursors.splice(0, batch.length);
          state.archivePages += batch.length;
        } else {
          for (const id of batch) state.loadedAuthors.add(id);
        }
        state.cursors.push(...cursors);
        state.errors += errors;
        if (offset + batch.length === inputs.length) sourceLoad = undefined;
        renderResults();
      }
      if (state.cursors.length) loadSources(true);
    }

    function cancelSourceLoad() {
      sourceLoad?.controller.abort();
      sourceLoad = undefined;
    }

    function setCover(link, url) {
      if (!url) return;
      if (link.matches('.test_item_photo')) {
        if (!link.style.backgroundImage) link.style.backgroundImage = `url(${JSON.stringify(url)})`;
        return;
      }
      if (link.querySelector('img')) return;
      const image = document.createElement('img');
      image.src = url;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      link.append(image);
    }

    function pumpCovers() {
      while (active() && pendingCovers < 2 && coverQueue.length) {
        const { entry, resolve } = coverQueue.shift();
        pendingCovers++;
        pikucoFollowingAuthors.readCoverFromTest(entry.url, entry.title)
          .then(resolve, () => resolve(null))
          .finally(() => {
            pendingCovers--;
            pumpCovers();
          });
      }
    }

    function requestCover(entry, link) {
      if (!coverCache.has(entry.url)) {
        const promise = new Promise(resolve => coverQueue.push({ entry, resolve }));
        coverCache.set(entry.url, promise);
      }
      coverCache.get(entry.url).then(url => setCover(link, url));
      pumpCovers();
    }

    function markPassed(row) {
      if (!row || row.querySelector(passedSelector)) return;
      const upper = row.querySelector('.upper');
      const badge = document.createElement('div');
      badge.className = upper
        ? 'test-item__icon test-item__passed'
        : 'test-item__passed pikuco-following-passed';
      badge.setAttribute('role', 'img');
      badge.setAttribute('aria-label', 'Тест пройден!');
      badge.title = 'Тест пройден!';
      if (!upper) badge.textContent = '✓ Пройден';
      (upper ?? row).prepend(badge);
    }

    function createResultCard(entry) {
      const row = document.createElement('li');
      row.className = 'pikuco-following-test-card';
      const cover = document.createElement('a');
      cover.className = 'pikuco-following-test-cover';
      cover.href = entry.url;
      cover.setAttribute('aria-label', entry.title);
      if (entry.cover) setCover(cover, entry.cover);
      else coverTargets.set(cover, entry);

      const content = document.createElement('div');
      content.className = 'pikuco-following-test-content';
      const author = document.createElement('a');
      author.className = 'pikuco-following-test-author';
      author.href = entry.authorUrl;
      author.textContent = entry.owner;
      const title = document.createElement('a');
      title.className = 'pikuco-following-result-title';
      title.href = entry.url;
      title.textContent = entry.title;
      content.append(author, title);

      if (entry.description) {
        const description = document.createElement('p');
        description.className = 'pikuco-following-test-description';
        description.textContent = entry.description;
        description.title = entry.description;
        content.append(description);
      }

      const metrics = document.createElement('div');
      metrics.className = 'pikuco-following-test-metrics';
      function metric(symbol, value, label, href) {
        if (!value) return;
        const item = document.createElement(href ? 'a' : 'span');
        if (href) item.href = href;
        item.title = label;
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = symbol;
        item.append(icon, document.createTextNode(value));
        metrics.append(item);
      }
      metric('★', entry.rating, 'Рейтинг');
      metric('▶', entry.passes, 'Прохождения', entry.statsUrl);
      metric('▦', entry.options, 'Количество вариантов или вопросов');
      if (metrics.children.length) content.append(metrics);
      row.append(cover, content);
      if (entry.passed || passedIds.has(entry.key)) markPassed(row);
      renderedRows.set(entry, row);
      return row;
    }

    function createNativeResultCard(entry) {
      function element(tag, className, text, href) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        if (href) node.href = href;
        return node;
      }

      let row = entry.nativeCard;
      if (!row) {
        row = element('div', 'test_item_wrap preserved');
        const card = element('div', 'test_item');
        card.setAttribute('data-id', entry.key);
        const upper = element('div', 'upper');
        const info = element('div', 'test_item_info with_fav');
        const icons = element('div', 'test-item__top-icons');
        const author = element('a', 'test_item_profile_link', '', entry.authorUrl);
        author.append(element('i', '', entry.owner));
        icons.append(author);
        if (entry.statsUrl) {
          const stats = element('a', 'test_item_rating_link', '', entry.statsUrl);
          stats.title = 'Статистика и комментарии';
          icons.append(stats);
        }
        const title = element('h3');
        title.append(element('a', '', entry.title, entry.url));
        info.append(icons, title);
        if (entry.description) info.append(element('p', '', entry.description));
        upper.append(info);
        const bottom = element('div', 'bottom');
        const metrics = element('div', 'test_item_bottom');
        if (entry.rating) metrics.append(element('div', 'test_item_rating', entry.rating));
        if (entry.passes) {
          const passes = element('div', 'test_item_rating');
          passes.title = 'Количество уникальных прохождений';
          passes.append(element('a', '', entry.passes, entry.statsUrl));
          metrics.append(passes);
        }
        if (entry.options) {
          const types = element('div', 'test_item_types');
          types.append(element('div', 'test_item_limit', entry.options));
          metrics.append(types);
        }
        bottom.append(metrics);
        card.append(upper, bottom);
        row.append(card);
      }
      let cover = row.querySelector('.test_item_photo');
      if (!cover) {
        cover = element('a', 'test_item_photo', '', entry.url);
        cover.setAttribute('aria-label', entry.title);
        row.querySelector('.upper')?.prepend(cover);
      }
      if (entry.cover) setCover(cover, entry.cover);
      else coverTargets.set(cover, entry);
      if (entry.passed || passedIds.has(entry.key)) markPassed(row);
      row.setAttribute(resultAttribute, '');
      renderedNativeRows.set(entry, row);
      return row;
    }

    function renderResults() {
      if (!active() || !results?.isConnected) return;
      const ordered = pikucoFollowingAuthors.sortEntries(sourceState?.entries.values() ?? []);
      const anchor = nativeAnchor?.isConnected ? nativeAnchor : null;
      const host = anchor?.parentElement ?? results;
      if (rendered?.host !== host || rendered.anchor !== anchor || ordered.length !== rendered.entries.length ||
          ordered.some((entry, index) => entry !== rendered.entries[index]) ||
          nativeRows.some(row => row.parentElement !== host)) {
        coverObserver?.disconnect();
        const rows = ordered.map(entry => anchor
          ? renderedNativeRows.get(entry) ?? createNativeResultCard(entry)
          : renderedRows.get(entry) ?? createResultCard(entry));
        if (anchor && rendered?.anchor === anchor && nativeRows.length) {
          const kept = new Set(rows);
          for (const row of nativeRows) {
            if (!kept.has(row)) row.remove();
          }
          let previous = anchor;
          for (const row of rows) {
            if (previous.nextElementSibling !== row) previous.after(row);
            previous = row;
          }
        } else {
          removeNativeRows();
          const fragment = document.createDocumentFragment();
          fragment.append(...rows);
          if (anchor) {
            if (results.firstChild) results.replaceChildren();
            anchor.after(fragment);
          } else {
            results.replaceChildren(fragment);
          }
        }
        if (anchor) nativeRows = rows;
        results.hidden = Boolean(anchor);
        if (coverObserver) {
          for (const row of rows) {
            const cover = row.querySelector('.test_item_photo, .pikuco-following-test-cover');
            if (coverTargets.has(cover) && !requestedCovers.has(cover)) coverObserver.observe(cover);
          }
        }
        rendered = { host, anchor, entries: ordered };
      }

      renderStatus();
    }

    function renderStatus() {
      if (!active() || !status?.isConnected) return;
      const count = sourceState?.entries.size ?? 0;
      const loading = Boolean(sourceLoad || (!saved && syncing));
      message.classList.toggle('pikuco-following-loading', loading);
      let text;
      if (!saved && syncing) text = 'Читаю список подписок…';
      else if (!saved) text = 'Не удалось прочитать подписки автоматически. Открой «Личный кабинет → Пользователи → Подписки».';
      else if (!saved.ids.length) text = 'Список подписок пуст.';
      else if (sourceLoad?.older) text = `Загружаю архив… Обработано страниц: ${sourceLoad.done}. Карточек в ленте: ${count}.`;
      else if (sourceLoad) text = `Загружаю тесты… Обработано ${sourceLoad.done} из ${sourceLoad.total} авторов.`;
      else if (!count) text = 'На страницах авторов пока нет публикаций.';
      else text = `Публикаций из подписок: ${count}.`;
      if (!loading && sourceState?.errors) text += ` Не удалось загрузить страниц: ${sourceState.errors}.`;
      if (message.textContent !== text) message.textContent = text;
    }

    function placeResults(firstCard) {
      if (firstCard) {
        let container = group.parentElement;
        while (container && !container.contains(firstCard)) container = container.parentElement;
        if (container && !group.contains(firstCard)) {
          let feedBranch = firstCard;
          while (feedBranch.parentElement !== container) feedBranch = feedBranch.parentElement;
          if (!feedBranch.contains(group)) {
            if (feedBranch !== firstCard && feedBranch.matches('main, [role="main"]')) {
              while (firstCard.parentElement !== feedBranch) firstCard = firstCard.parentElement;
              feedBranch = firstCard;
            }
            if (feedBranch.previousElementSibling !== status) feedBranch.before(status);
            return;
          }
        }
      }

      if (status.isConnected) return;
      const container = group.parentElement?.closest('main, [role="main"]') ?? document.body;
      let branch = group;
      while (branch.parentElement && branch.parentElement !== container) branch = branch.parentElement;
      branch.after(status);
    }

    function hideNativeFeed() {
      const cards = [...readCards(document.body, group, status).keys()];
      for (const card of cards) {
        const icon = card.querySelector(passedSelector);
        const test = icon?.closest('.test_item');
        const key = test?.getAttribute('data-id');
        if (!/^\d+$/.test(key ?? '') || passedIds.has(key)) continue;
        passedIds.add(key);
        const entry = sourceState?.entries.get(key);
        if (entry) {
          markPassed(renderedRows.get(entry));
          markPassed(renderedNativeRows.get(entry));
        }
      }
      nativeAnchor = cards.find(card => card.matches('.test_item_wrap'));
      placeResults(cards[0]);
      const last = cards.at(-1);
      const next = new Set(cards);
      if (last) {
        for (const control of document.querySelectorAll('button, a[href], [class*="loading" i], [class*="load-more" i]')) {
          if (isAfter(last, control) && !last.contains(control) && !control.contains(status) &&
              !status.contains(control) &&
              !control.closest(`footer, nav, [${resultAttribute}]`) &&
              /^(?:(?:показать|загрузить|подгрузить) еще|следующая|загрузка|загружаем)/.test(normalize(control.textContent))) {
            next.add(control);
          }
        }
      }
      for (const element of next) {
        if (!filtered.has(element)) element.setAttribute(hiddenAttribute, '');
      }
      for (const element of filtered) {
        if (!next.has(element)) element.removeAttribute(hiddenAttribute);
      }
      filtered = next;
    }

    function update() {
      if (!group?.isConnected) {
        clearFilter();
        status?.remove();
        group = undefined;
        mount();
      }
      if (!tab?.isConnected) return;
      tab.href = followingUrl();
      const enabled = active();
      tab.classList.toggle('pikuco-following-tab-active', enabled);
      if (enabled) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
      status.hidden = !enabled;
      if (!enabled) {
        clearFilter();
        cancelSourceLoad();
        return;
      }

      syncAccounts();
      pumpCovers();
      hideNativeFeed();
      const ids = [...new Set(saved?.ids ?? [])].filter(id => /^\d+$/.test(id)).sort();
      const key = ids.join(',');
      const rating = id => saved?.ratings?.[id] ?? -Infinity;
      ids.sort((first, second) => Number(priorities.has(second)) - Number(priorities.has(first)) ||
        rating(second) - rating(first));
      if (sourceState?.key !== key) {
        cancelSourceLoad();
        sourceState = { key, ids, loadedAuthors: new Set(), entries: new Map(), cursors: [], archivePages: 0, errors: 0 };
      } else if (!sameAccounts(sourceState, ids)) {
        const pending = order => order.filter(id => !sourceState.loadedAuthors.has(id)).join(',');
        if (sourceLoad && !sourceLoad.older && pending(sourceState.ids) !== pending(ids)) cancelSourceLoad();
        sourceState.ids = ids;
      }
      if (!syncing || saved?.ratings) {
        if (sourceState.loadedAuthors.size < ids.length) loadSources();
        else if (sourceState.cursors.length) loadSources(true);
      }
      renderResults();
    }

    const schedule = observeChanges(update);
    window.addEventListener('hashchange', schedule);
    window.addEventListener('popstate', schedule);
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || (!changes[storageKey] && !changes[priorityKey])) return;
      if (changes[storageKey]) saved = changes[storageKey].newValue;
      if (changes[priorityKey]) priorities = readPriorities(changes[priorityKey].newValue);
      schedule();
    });
  }
})();
