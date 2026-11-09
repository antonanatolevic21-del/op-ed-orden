const pikucoFollowingAuthors = (() => {
  'use strict';

  const excluded = 'header, footer, nav, aside, [contenteditable]';
  const dateNodes = 'time, [itemprop="datePublished"], [data-published-at], [data-publish-date], [class*="date" i]';
  const cardTags = new Set(['div', 'a', 'h3', 'p', 'span', 'i', 'b', 'strong', 'em', 'br', 'small']);
  const nextLabel = /^(?:(?:показать|загрузить|подгрузить) ещ[её]|следующая(?: страница)?|next)$/i;
  const moreLabel = /^(?:(?:показать|загрузить|подгрузить) ещ[её](?: тесты)?|load more)$/i;
  const pageParameter = /^(?:PAGEN_\d+|page|paged)$/i;
  const loaderLabel = /^(?:загрузка|загружаем|loading|downloading)\b|^(?:загрузка|загружаем)(?:[.…\s]|$)/i;
  function urlAt(href, base = location.href) {
    if (!href) return null;
    try {
      const url = new URL(href, base);
      return url.origin === location.origin ? url : null;
    } catch {
      return null;
    }
  }

  function newest(url) {
    url.searchParams.set('SORT', 'ID');
    url.hash = '';
    return url;
  }

  function parseDate(value) {
    const text = value?.trim();
    if (!text) return null;
    if (/^\d{10}$/.test(text)) return Number(text) * 1000;
    if (/^\d{13}$/.test(text)) return Number(text);
    const local = text.match(/(?:^|\s)(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (local) {
      const [, day, month, year, hour = '00', minute = '00', second = '00'] = local;
      const date = Date.parse(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}+03:00`);
      return Number.isFinite(date) ? date : null;
    }
    if (!/^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{4}/.test(text)) return null;
    const date = Date.parse(text);
    return Number.isFinite(date) ? date : null;
  }

  function readDate(scope) {
    for (const node of scope.querySelectorAll(dateNodes)) {
      if (/modified|updated|edited|измен[её]н|редакт/i.test(
        [node.getAttribute('itemprop'), node.getAttribute('class'), node.getAttribute('title')].join(' '))) continue;
      const date = parseDate(node.getAttribute('datetime') || node.getAttribute('content') ||
        node.getAttribute('data-published-at') || node.getAttribute('data-publish-date') || node.textContent);
      if (date !== null) return date;
    }
    return null;
  }

  function publicationKey(url) {
    return url?.pathname.match(/^\/tests\/(\d+)\/?$/i)?.[1];
  }

  function authorId(link, base) {
    return urlAt(link.getAttribute('href'), base)?.pathname.match(/^\/profile\/(\d+)\/?$/i)?.[1];
  }

  function imageUrl(value, base) {
    if (!value) return null;
    const source = value.trim().match(/^url\(\s*["']?(.*?)["']?\s*\)$/i)?.[1] ?? value.trim();
    try {
      const url = new URL(source, base);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch {
      return null;
    }
  }

  const imageSources = 'img, source, [data-bg], [data-background], [data-background-image], [style*="url(" i]';

  function sourceImage(node, base) {
    const inline = node.getAttribute('style')?.match(/url\([^)]*\)/i)?.[0];
    const srcset = node.getAttribute('data-srcset') ?? node.getAttribute('srcset');
    const srcsetUrl = srcset?.split(',')[0]?.trim().split(/\s+/)[0];
    return [
      node.getAttribute('data-src'), node.getAttribute('data-original'), node.getAttribute('data-lazy-src'),
      node.getAttribute('data-bg'), node.getAttribute('data-background'), node.getAttribute('data-background-image'),
      srcsetUrl, node.getAttribute('src'), inline,
    ].map(value => imageUrl(value, base)).find(url => url &&
      !/\/(?:blank|placeholder|no[_-]?image|logo)(?:\.[a-z]+)(?:[?#]|$)/i.test(url)) ?? null;
  }

  function readCover(scope, base, key, title, detail = false) {
    let cover = null;
    let best = 0;
    for (const node of scope.querySelectorAll(imageSources)) {
      const link = node.closest('a[href]');
      if (link && authorId(link, base)) continue;
      const ownLink = link && publicationKey(urlAt(link.getAttribute('href'), base)) === key;
      const className = [node.getAttribute('class'), node.parentElement?.getAttribute('class')].join(' ');
      if (/avatar|author[-_]|profile[-_]|user[-_](?:icon|avatar)/i.test(className)) continue;
      const sameTitle = node.getAttribute('alt')?.trim() === title;
      const testImage = /test-window.*(?:cover|poster|preview|image|picture)/i.test(className);
      if (detail && !ownLink && !sameTitle && !testImage) continue;
      const score = (ownLink ? 4 : 0) + (sameTitle ? 5 : 0) +
        (/(?:cover|poster|preview|image|picture)/i.test(className) ? 2 : 0);
      if (score <= best) continue;
      const source = sourceImage(node, base);
      if (!source) continue;
      cover = source;
      best = score;
    }
    return cover;
  }

  function readCardFields(card, link, base, key, title) {
    const description = [...card.querySelectorAll('[class*="description" i], [class*="desc" i], [class*="anons" i], p')]
      .map(node => node.textContent.trim()).find(text => text.length > 8 && text !== title) ?? '';
    const leaves = [...card.querySelectorAll('a, span, div, small')].filter(node => !node.children.length);
    const rating = [...card.querySelectorAll('.test_item_rating'), ...leaves].map(node => node.textContent.trim())
      .find(text => /^(?:\d{1,2}(?:[.,]\d+)?|[–—-])\s*\(\s*[\d\s]+\)$/.test(text)) ?? '';
    const statLinks = [...card.querySelectorAll('a[href]')].filter(node => {
      const path = urlAt(node.getAttribute('href'), base)?.pathname;
      return path?.replace(/\/$/, '') === `/stats/${key}`;
    });
    const passLink = statLinks.find(node => /^\d[\d\s]*$/.test(node.textContent.trim()));
    const statLink = passLink ?? statLinks[0];
    const options = card.querySelector('.test_item_limit')?.textContent.trim() || (passLink ? leaves.find(node =>
      node !== passLink && !passLink.contains(node) &&
      (passLink.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      /^\d[\d\s]*$/.test(node.textContent.trim()))?.textContent.trim() ?? '' : '');
    const cover = card.querySelector('.test_item_photo');

    return {
      cover: (cover && sourceImage(cover, base)) || readCover(card, base, key, title),
      description: description || [...card.querySelectorAll('div, span')].find(node =>
        !node.children.length && !link.contains(node) && node.textContent.trim() !== title &&
        (link.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        node.textContent.trim().length >= 30)?.textContent.trim() || '',
      rating,
      passes: passLink?.textContent.trim() ?? '',
      statsUrl: statLink ? urlAt(statLink.getAttribute('href'), base).href : null,
      options,
      ...readCardStatus(card),
    };
  }

  function readCardStatus(card) {
    const rating = card.querySelector('.test_item_rating.dislike, .test_item_rating.like') ??
      card.querySelector('.test_item_rating.bad, .test_item_rating.good');
    return {
      passed: Boolean(card.querySelector('.test-item__passed')),
      ratingClass: ['dislike', 'like', 'bad', 'good'].find(name => rating?.classList.contains(name)),
    };
  }

  function copyNativeCard(source, base, key, id) {
    const wrapper = document.createElement('div');
    wrapper.className = 'test_item_wrap preserved';
    const originalWrapper = source.parentElement;
    if (originalWrapper.matches('.test_item_wrap')) {
      for (const attribute of originalWrapper.getAttributeNames()) {
        if (/^data-v-[a-f\d]+$/.test(attribute)) wrapper.setAttribute(attribute, '');
      }
    }

    function copy(node) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue);
      if (!cardTags.has(node.localName) || node.matches('.test_item_to_fav')) return null;
      const element = document.createElement(node.localName);
      for (const attribute of node.getAttributeNames()) {
        if (attribute === 'class' || attribute === 'title' || attribute === 'aria-label' ||
            /^data-v-[a-f\d]+$/.test(attribute)) {
          element.setAttribute(attribute, node.getAttribute(attribute));
        }
      }
      if (node === source) element.setAttribute('data-id', key);
      if (node.matches('.test_item_profile_link') && node.getAttribute('data-user-tooltip') === id) {
        element.setAttribute('data-user-tooltip', id);
      }
      if (node.localName === 'a') {
        const url = urlAt(node.getAttribute('href'), base);
        if (url && !url.username && !url.password &&
            (/^\/(?:tests|profile|stats)\/\d+\/?$/i.test(url.pathname) || /^\/materials\/[\w-]+\/?$/i.test(url.pathname))) {
          element.href = url.href;
        }
      }
      if (node.matches('.test_item_photo, .test_item_profile_link span')) {
        const image = sourceImage(node, base);
        if (image) element.style.backgroundImage = `url(${JSON.stringify(image)})`;
      }
      for (const child of node.childNodes) {
        const cloned = copy(child);
        if (cloned) element.append(cloned);
      }
      return element;
    }

    wrapper.append(copy(source));
    return wrapper;
  }

  async function readCoverFromTest(href, title, signal) {
    const { doc, url } = await getPage(href, signal);
    const key = publicationKey(urlAt(url));
    const actual = readCover(doc.body, url, key, title, true);
    if (actual) return actual;
    for (const meta of doc.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')) {
      const image = imageUrl(meta.getAttribute('content'), url);
      if (image && !/\/(?:blank|placeholder|no[_-]?image|logo)\.[a-z]+(?:[?#]|$)/i.test(image)) return image;
    }
    return null;
  }

  function readEntries(doc, base, id, entries = new Map()) {
    const links = [...doc.body.querySelectorAll('a[href]')];
    const keys = new Map(links.map(link => [link, publicationKey(urlAt(link.getAttribute('href'), base))]));
    const owners = new Map(links.map(link => [link, authorId(link, base)]));
    for (const link of links) {
      const key = keys.get(link);
      const title = link.textContent.trim();
      if (!key || !title || link.closest(excluded)) continue;
      let owner;
      let card;
      const native = link.closest('h3') && link.closest('.test_item');
      const profile = native?.querySelector('.test_item_profile_link[href]');
      if (profile && (!native.hasAttribute('data-id') || native.getAttribute('data-id') === key)) {
        if (owners.get(profile) !== id) continue;
        owner = profile;
        card = native;
      }
      const previous = entries.get(key);
      if (previous) {
        if (card) {
          const status = readCardStatus(card);
          previous.passed ||= status.passed;
          previous.ratingClass = status.ratingClass ?? previous.ratingClass;
        }
        continue;
      }
      for (let parent = card ? null : link.parentElement, depth = 0; parent && parent !== doc.body && depth < 7;
          parent = parent.parentElement, depth++) {
        if (parent.matches('main, header, footer, nav, aside')) break;
        const children = [...parent.querySelectorAll('a[href]')];
        if (children.map(child => keys.get(child)).find(Boolean) !== key) break;
        const preceding = children.slice(0, children.indexOf(link)).filter(child => owners.get(child));
        if (!owner && preceding.length) {
          if (preceding.some(child => owners.get(child) !== id)) break;
          owner = preceding.find(child => child.textContent.trim()) ?? preceding[0];
        }
        if (owner && parent.querySelector('h1, form, input[type="radio"], [rel="next"]')) break;
        const multiple = children.some(child => keys.get(child) && keys.get(child) !== key);
        const article = parent.matches('article');
        if (owner && (!card || !multiple || article)) card = parent;
        if (owner && (article || multiple)) break;
      }
      if (!owner || !card) continue;
      const url = urlAt(link.getAttribute('href'), base);
      url.hash = '';
      entries.set(key, {
        key, url: url.href, title, owner: owner.textContent.trim() || `Профиль ${id}`,
        authorUrl: urlAt(owner.getAttribute('href'), base).href,
        published: readDate(card),
        ...readCardFields(card, link, base, key, title),
        nativeCard: card === native ? copyNativeCard(native, base, key, id) : null,
      });
    }
    return [...entries.values()];
  }

  async function getPage(url, signal) {
    const response = await fetch(url, { credentials: 'same-origin', signal });
    if (!response.ok || !urlAt(response.url)) throw new Error('Страница недоступна');
    return { doc: new DOMParser().parseFromString(await response.text(), 'text/html'), url: response.url };
  }

  function pageKey(url) {
    const key = newest(new URL(url));
    key.pathname = key.pathname.replace(/\/$/, '');
    key.searchParams.sort();
    return key.href;
  }

  function sameList(first, second) {
    return first?.pathname.replace(/\/$/, '') === second.pathname.replace(/\/$/, '');
  }

  function getNext(doc, base, current, visited) {
    const route = new URL(current);
    const params = route.searchParams;
    let numbered;
    let closestPage = Infinity;
    for (const link of doc.querySelectorAll('a[href], link[href]')) {
      const url = urlAt(link.getAttribute('href'), base);
      if (!sameList(url, route) || !url.search || visited.has(pageKey(url)) ||
          link.closest('header, footer, aside, [contenteditable]')) continue;
      const page = [...url.searchParams].find(([name, value]) =>
        pageParameter.test(name) && /^\d+$/.test(value) && value !== params.get(name));
      const number = Number(page?.[1]);
      if (page && number <= Number(params.get(page[0]) ?? 1)) continue;
      const label = link.textContent.trim() || link.getAttribute('aria-label') || link.getAttribute('title') || '';
      if (link.rel?.split(/\s+/).includes('next') || nextLabel.test(label) || moreLabel.test(label)) {
        return newest(url).href;
      }
      if (page && number < closestPage) {
        numbered = newest(url).href;
        closestPage = number;
      }
    }
    return numbered;
  }

  function hasLoader(doc, onlyVisible = false) {
    return [...doc.body.querySelectorAll('div, span, p, button')].some(node =>
      !node.children.length && !node.closest(excluded) &&
      (!onlyVisible || node.getClientRects().length > 0) &&
      loaderLabel.test(node.textContent.trim()));
  }

  function loadMoreControl(doc, onlyVisible = false) {
    return [...doc.body.querySelectorAll('button, a, [role="button"]')].find(node => {
      if (node.closest(excluded) || node.disabled || node.getAttribute('aria-disabled') === 'true' ||
          (onlyVisible && !node.getClientRects().length)) return false;
      const href = node.getAttribute('href');
      return (!href || href.startsWith('#') || /^javascript:\s*void\(0\);?$/i.test(href)) &&
        !(node.type === 'submit' && node.form) &&
        moreLabel.test(node.textContent.trim() || node.getAttribute('aria-label') || '');
    });
  }

  function hasScrollHint(doc) {
    return [...doc.body.querySelectorAll('[data-next-page], [data-load-more], [class*="load-more" i], [class*="load_more" i], [class*="infinite-scroll" i]')]
      .some(node => !node.closest(excluded));
  }

  function isEmptyList(doc) {
    return /нет (?:опубликованных )?(?:тестов|постов|публикаций)|здесь пока пусто|no published tests|it[’']s empty here/i
      .test(doc.body.textContent);
  }

  function scrollPage(cursor, signal, firstOnly = false) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const frame = document.createElement('iframe');
      frame.className = 'pikuco-following-author-reader';
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      frame.src = cursor.start;
      let progressedAt = Date.now();
      let lastSize = -1;
      let lastControl;
      const entries = new Map();

      function finish(result, error) {
        clearInterval(timer);
        signal.removeEventListener('abort', abort);
        frame.remove();
        if (error) reject(error);
        else resolve({ entries: [...entries.values()], ...result });
      }
      function abort() {
        finish(null, signal.reason);
      }

      const timer = setInterval(() => {
        try {
          const doc = frame.contentDocument;
          if (doc?.body && sameList(urlAt(doc.URL), new URL(cursor.start))) {
            readEntries(doc, doc.URL, cursor.id, entries);
            const href = getNext(doc, doc.URL, cursor.start, cursor.visited);
            const control = loadMoreControl(doc, true);
            const waiting = Boolean(control || hasLoader(doc, true));
            const scrollHint = hasScrollHint(doc);
            if (href || (firstOnly && entries.size) || (!entries.size && isEmptyList(doc))) {
              finish({ href, canScroll: Boolean((firstOnly && entries.size) || waiting || scrollHint) });
              return;
            }
            if (entries.size !== lastSize || control !== lastControl) {
              if (entries.size > 0 && entries.size !== lastSize) progressedAt = Date.now();
              lastSize = entries.size;
              lastControl = control;
              control?.click();
              const view = doc.defaultView;
              const last = doc.scrollingElement?.scrollHeight ?? doc.body.scrollHeight;
              view.scrollTo(0, last);
              view.dispatchEvent(new view.Event('scroll'));
            }
            const idle = Date.now() - progressedAt;
            if (idle >= (waiting || scrollHint || !entries.size ? 5500 : 900)) {
              finish({ error: waiting || !entries.size });
            }
          } else if (Date.now() - progressedAt >= 5500) {
            finish({ error: true });
          }
        } catch (error) {
          finish(null, error);
        }
      }, 200);
      signal.addEventListener('abort', abort, { once: true });
      document.body.append(frame);
    });
  }

  async function readSource(cursor, signal) {
    let entries;
    let href;
    let start = cursor.start;
    let canScroll = false;
    let error = false;
    const visited = new Set(cursor.visited);
    if (cursor.next) {
      const { doc, url } = await getPage(cursor.next, signal);
      if (!sameList(urlAt(url), new URL(cursor.next))) throw new Error('Список тестов недоступен');
      visited.add(pageKey(cursor.next));
      visited.add(pageKey(url));
      entries = readEntries(doc, url, cursor.id);
      href = getNext(doc, url, cursor.next, visited);
      canScroll = Boolean(loadMoreControl(doc) || hasLoader(doc) || hasScrollHint(doc));
      if (!href && !entries.length && (canScroll || (!cursor.seen.size && !isEmptyList(doc)))) {
        const loaded = await scrollPage({ ...cursor, start: cursor.next, visited }, signal, !cursor.seen.size);
        ({ entries, href, canScroll, error } = loaded);
      }
      start = cursor.next;
    } else {
      const loaded = await scrollPage(cursor, signal);
      ({ entries, href, error } = loaded);
    }
    const seen = new Set(cursor.seen);
    const fresh = entries.filter(entry => {
      if (seen.has(entry.key)) return false;
      seen.add(entry.key);
      return true;
    });
    const repeated = entries.length && !fresh.length;
    const next = !repeated && (href || canScroll)
      ? { id: cursor.id, start, next: href, seen, visited }
      : null;
    return { entries: fresh, cursors: next ? [next] : [], error };
  }

  function readAuthor(id, signal) {
    const start = newest(new URL(`/profile/tournaments/${id}/`, location.origin)).href;
    return readSource({ id, start, next: start, seen: new Set(), visited: new Set() }, signal);
  }

  async function collect(inputs, older, signal, onResult) {
    let index = 0;
    const worker = async () => {
      while (index < inputs.length && !signal.aborted) {
        const input = inputs[index++];
        let result;
        try {
          result = older ? await readSource(input, signal) : await readAuthor(input, signal);
        } catch (error) {
          if (signal.aborted) return;
          result = { entries: [], cursors: [], error: true };
        }
        if (!signal.aborted) onResult(result);
      }
    };
    await Promise.all([worker(), worker()]);
  }

  function sortEntries(entries) {
    const all = [...entries];
    const useTestIds = all.some(entry => entry.published === null);
    return all.sort((first, second) => useTestIds
      ? Number(second.key) - Number(first.key)
      : (second.published ?? -1) - (first.published ?? -1));
  }

  return { collect, sortEntries, readCoverFromTest, readCardStatus };
})();
