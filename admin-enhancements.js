/* Generated admin bundle. */
/* admin-missing-inline.js */
(() => {
  if (window.__OC_ADMIN_MISSING_INLINE_READY__) return;
  window.__OC_ADMIN_MISSING_INLINE_READY__ = true;

  const ADMIN_CLASS = 'oc-admin-missing-tools';
  const MARKER_SELECTOR = '.oc-missing-link';
  const REQUIRED_EDIT_FIELDS = [
    '.oc-e-title',
    '.oc-e-year',
    '.oc-e-season',
    '.oc-e-studio',
    '.oc-e-director',
    '.oc-e-performer',
    '.oc-e-franchise',
    '.oc-e-image',
    '.oc-e-link'
  ];
  const FORM_HOTKEY_SELECTOR = [
    '#oc-add-type',
    '.oc-e-type',
    '#oc-add-season',
    '.oc-e-season',
    '.oc-addbar input[type="checkbox"]',
    '.oc-editcard input[type="checkbox"]'
  ].join(', ');
  const ENTRY_DATA_KEYS = ['id', 'openingId', 'trackId', 'entryId', 'qualityTrack'];
  let hoveredFormHotkeyControl = null;
  let markerOpenPending = false;

  function isAdminUi() {
    const badge = document.querySelector('#oc-access-badge');
    return Boolean(
      badge &&
      badge.classList.contains('admin') &&
      String(badge.textContent || '').trim().toLocaleLowerCase('ru') === 'админ'
    );
  }

  function syncAdminClass() {
    const admin = isAdminUi();
    document.documentElement.classList.toggle(ADMIN_CLASS, admin);
    if (admin) enhanceMissingMarkers(document);
  }

  function editableControls(scope) {
    if (!scope) return [];
    return [...scope.querySelectorAll(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not(.oc-add-field-pin):not([disabled])'
    )].filter(control => {
      if (!(control instanceof HTMLElement)) return false;
      if (control.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(control);
      return style.display !== 'none' && style.visibility !== 'hidden' && control.getClientRects().length > 0;
    });
  }

  function firstMissingEditField(editor) {
    for (const selector of REQUIRED_EDIT_FIELDS) {
      const control = editor.querySelector(selector);
      if (!control) continue;
      const value = String(control.value || '').trim();
      if (!value) return control;
    }
    return editor.querySelector('input, select, textarea, button');
  }

  function focusInlineEditor(id) {
    const editor = [...document.querySelectorAll('#oc-list-container .oc-editcard')]
      .find(card => String(card.dataset.id || '') === String(id || ''));
    if (!editor) return false;

    editor.classList.add('oc-missing-editor-open');
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => editor.classList.remove('oc-missing-editor-open'), 1100);

    const control = firstMissingEditField(editor);
    if (!control) return true;
    control.focus({ preventScroll: true });
    if (control instanceof HTMLInputElement && ['text', 'number', 'url', 'search'].includes(control.type)) {
      try { control.select(); } catch (_) {}
    }
    return true;
  }

  function dataValue(element) {
    if (!(element instanceof HTMLElement)) return '';
    for (const key of ENTRY_DATA_KEYS) {
      const value = String(element.dataset?.[key] || '').trim();
      if (value) return value;
    }
    const edit = element.matches?.('[data-action="edit"][data-id]')
      ? element
      : element.querySelector?.('[data-action="edit"][data-id]');
    return String(edit?.dataset?.id || '').trim();
  }

  function markerEntryId(marker) {
    let node = marker;
    while (node && node !== document.documentElement) {
      const value = dataValue(node);
      if (value) return value;
      node = node.parentElement;
    }

    const href = marker.closest('a[href]')?.href || '';
    if (href) {
      try {
        const url = new URL(href, location.href);
        const value = url.searchParams.get('track') || url.searchParams.get('opening') || url.searchParams.get('id');
        if (value) return String(value);
      } catch (_) {}
    }

    const modal = marker.closest('#oc-opening-modal, .oc-opening-modal, .oc-modal');
    if (modal && !modal.classList.contains('hidden')) {
      try {
        const value = new URL(location.href).searchParams.get('track');
        if (value) return String(value);
      } catch (_) {}
    }
    return '';
  }

  function markerEntryTitle(marker) {
    const direct = String(
      marker.dataset?.openingTitle ||
      marker.dataset?.trackTitle ||
      marker.dataset?.title || ''
    ).trim();
    if (direct) return direct;

    const scope = marker.closest(
      '.oc-main-card, .oc-unified-card, .oc-profile-item, .oc-season-card, .oc-modal-card, article, li, tr'
    ) || marker.parentElement;
    const titleElement = scope?.querySelector?.(
      '[data-opening-title], [data-track-title], .oc-card-title, .oc-unified-title, .oc-opening-title, .oc-title-link, h2, h3, h4'
    );
    return String(
      titleElement?.dataset?.openingTitle ||
      titleElement?.dataset?.trackTitle ||
      titleElement?.textContent || ''
    ).replace(/😡/g, '').trim();
  }

  function mainRowById(id) {
    if (!id) return null;
    return [...document.querySelectorAll('#oc-list-container .oc-main-card')]
      .find(row => String(row.dataset.id || '') === String(id));
  }

  function mainRowByTitle(title) {
    const target = String(title || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
    if (!target) return null;
    return [...document.querySelectorAll('#oc-list-container .oc-main-card')].find(row => {
      const shown = String(row.querySelector('.oc-card-title, .oc-title-link, h2, h3, h4')?.textContent || '')
        .trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
      return shown === target || shown.includes(target) || target.includes(shown);
    }) || null;
  }

  function openRowEditor(row, id) {
    const editButton = row?.querySelector('[data-action="edit"]');
    if (!(editButton instanceof HTMLElement)) return false;
    const resolvedId = String(id || row.dataset.id || editButton.dataset.id || '').trim();
    editButton.click();
    requestAnimationFrame(() => requestAnimationFrame(() => focusInlineEditor(resolvedId)));
    return true;
  }

  function dispatchFilterChange(control) {
    if (!control) return;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function prepareMainList(title) {
    document.querySelector('.oc-tab-btn[data-tab="chart"]')?.click();

    const search = document.querySelector('#oc-f-search');
    if (search && title) {
      search.value = title;
      dispatchFilterChange(search);
    }
  }

  function waitForMainRow(id, title, attempts = 24) {
    return new Promise(resolve => {
      const check = left => {
        const row = mainRowById(id) || mainRowByTitle(title);
        if (row || left <= 0) {
          resolve(row || null);
          return;
        }
        window.setTimeout(() => check(left - 1), 45);
      };
      check(attempts);
    });
  }

  async function openInlineEditor(marker) {
    if (!isAdminUi() || markerOpenPending) return;

    const directRow = marker.closest('#oc-list-container .oc-main-card');
    const directId = String(directRow?.dataset.id || '').trim();
    if (directRow && openRowEditor(directRow, directId)) return;

    markerOpenPending = true;
    try {
      const id = markerEntryId(marker);
      const title = markerEntryTitle(marker);

      const localEdit = marker.closest('[data-id], [data-opening-id], [data-track-id], article, li, tr')
        ?.querySelector?.('[data-action="edit"]');
      if (localEdit instanceof HTMLElement) {
        localEdit.click();
        requestAnimationFrame(() => requestAnimationFrame(() => focusInlineEditor(id)));
        return;
      }

      prepareMainList(title);
      let row = await waitForMainRow(id, title, 10);

      if (!row) {
        document.querySelector('#oc-reset-filters')?.click();
        if (title) {
          const search = document.querySelector('#oc-f-search');
          if (search) {
            search.value = title;
            dispatchFilterChange(search);
          }
        }
        row = await waitForMainRow(id, title, 18);
      }

      if (row) openRowEditor(row, id || row.dataset.id);
    } finally {
      markerOpenPending = false;
    }
  }

  function enhanceMarker(marker) {
    if (!(marker instanceof HTMLElement)) return;
    marker.classList.add('oc-missing-edit-trigger');
    marker.setAttribute('role', 'button');
    marker.setAttribute('tabindex', '0');
    marker.setAttribute('aria-label', marker.title
      ? `Редактировать незаполненные поля. ${marker.title}`
      : 'Редактировать незаполненные поля');
  }

  function enhanceMissingMarkers(root) {
    if (!(root instanceof Element || root instanceof Document)) return;
    if (root instanceof Element && root.matches(MARKER_SELECTOR)) enhanceMarker(root);
    root.querySelectorAll?.(MARKER_SELECTOR).forEach(enhanceMarker);
  }

  function dispatchFormControlChange(control) {
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function resolveFormHotkeyControl(event) {
    const focused = event.target instanceof HTMLElement && event.target.matches(FORM_HOTKEY_SELECTOR)
      ? event.target
      : null;
    if (focused) return focused;
    if (hoveredFormHotkeyControl?.isConnected && hoveredFormHotkeyControl.matches(FORM_HOTKEY_SELECTOR)) {
      return hoveredFormHotkeyControl;
    }
    return null;
  }

  function handleFieldChoiceHotkeys(event) {
    if (!isAdminUi() || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const control = resolveFormHotkeyControl(event);
    if (!(control instanceof HTMLElement)) return;
    if (!control.closest('.oc-addbar, .oc-editcard')) return;

    if (control.matches('#oc-add-type, .oc-e-type') && (event.key === '1' || event.key === '2')) {
      event.preventDefault();
      event.stopPropagation();
      control.value = event.key === '1' ? 'OP' : 'ED';
      dispatchFormControlChange(control);
      return;
    }

    if (control.matches('#oc-add-season, .oc-e-season') && ['1', '2', '3', '4'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      control.value = { '1': 'winter', '2': 'spring', '3': 'summer', '4': 'fall' }[event.key];
      dispatchFormControlChange(control);
      return;
    }

    if (control.matches('input[type="checkbox"]') && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      control.checked = !control.checked;
      dispatchFormControlChange(control);
    }
  }

  function handleFormArrowNavigation(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !isAdminUi()) return;
    if (!(event.target instanceof HTMLElement)) return;

    const scope = event.target.closest('.oc-addbar, .oc-editcard');
    if (!scope) return;

    const controls = editableControls(scope);
    const currentIndex = controls.indexOf(event.target);
    if (currentIndex < 0) return;

    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = controls[currentIndex + delta];
    if (!next) return;

    event.preventDefault();
    event.stopPropagation();
    next.focus({ preventScroll: true });
    next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

    if (next instanceof HTMLInputElement && ['text', 'number', 'url', 'search'].includes(next.type)) {
      try { next.select(); } catch (_) {}
    }
  }

  const badge = document.querySelector('#oc-access-badge');
  if (badge) {
    new MutationObserver(syncAdminClass).observe(badge, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  const root = document.querySelector('#opedchart-root') || document.documentElement;
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) enhanceMissingMarkers(node);
    }));
    syncAdminClass();
  }).observe(root, { childList: true, subtree: true });

  document.addEventListener('click', event => {
    const marker = event.target instanceof Element ? event.target.closest(MARKER_SELECTOR) : null;
    if (!marker || !isAdminUi()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void openInlineEditor(marker);
  }, true);

  document.addEventListener('keydown', event => {
    const marker = event.target instanceof Element ? event.target.closest(MARKER_SELECTOR) : null;
    if (marker && isAdminUi() && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void openInlineEditor(marker);
      return;
    }
    handleFieldChoiceHotkeys(event);
    handleFormArrowNavigation(event);
  }, true);

  document.addEventListener('pointerover', event => {
    const control = event.target instanceof Element ? event.target.closest(FORM_HOTKEY_SELECTOR) : null;
    hoveredFormHotkeyControl = control && control.closest('.oc-addbar, .oc-editcard') ? control : null;
  }, true);
  document.addEventListener('pointerout', event => {
    if (!hoveredFormHotkeyControl) return;
    const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest(FORM_HOTKEY_SELECTOR) : null;
    if (next === hoveredFormHotkeyControl) return;
    hoveredFormHotkeyControl = null;
  }, true);

  syncAdminClass();
})();

/* quality-center.js */
(() => {
  if (window.__OC_QUALITY_CENTER_READY__) return;

  const SEASON_LABEL = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  const ISSUE_LIMIT = 40;
  let modal = null;
  let cachedOpenings = null;
  let loadingPromise = null;
  let triggerButton = null;
  let adminPanelLink = null;
  let currentIssues = new Map();
  let qualityNotice = '';
  let rejectedFranchisePairs = new Set();
  let firestoreToolsPromise = null;
  const unreachableImages = new Set();
  const QUALITY_META_ID = 'qualityCenter';

  const normalize = value => String(value || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  const cleanList = value => Array.isArray(value) ? value.filter(item => String(item || '').trim()).length : String(value || '').split(',').filter(item => item.trim()).length;
  const listValues = value => (Array.isArray(value) ? value : String(value || '').split(',')).map(item => String(item || '').trim()).filter(Boolean);

  function validHttpUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
    } catch (_) {
      return false;
    }
  }

  function imageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || /^(?:data|blob|javascript):/i.test(raw)) return null;
    try {
      const url = new URL(raw, window.location.href);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
      const absolute = /^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith('//');
      if (!absolute && (
        /\s/.test(raw)
        || url.origin !== window.location.origin
        || !/^(?:\/|\.\.?\/|images\/)/i.test(raw)
      )) return null;
      return url.href;
    } catch (_) {
      return null;
    }
  }

  function validImageUrl(value) {
    return Boolean(imageUrl(value));
  }

  function plausibleTrackLink(value) {
    if (!validHttpUrl(value)) return false;
    const url = new URL(String(value).trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return url.pathname.length > 2;
    if (host.endsWith('youtube.com')) return Boolean(url.searchParams.get('v') || /\/(shorts|embed)\//.test(url.pathname));
    if (host.endsWith('rutube.ru')) return /\/video\/[\w-]+/i.test(url.pathname);
    if (host.endsWith('vk.com') || host.endsWith('vkvideo.ru')) return /video|clip/i.test(url.href);
    return true;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function isAdminUi() {
    return normalize(document.querySelector('#oc-access-badge')?.textContent).includes('админ');
  }

  function yieldToUi() {
    return new Promise(resolve => requestAnimationFrame(() => window.setTimeout(resolve, 0)));
  }

  async function waitForFirebase() {
    if (window.OPED_DB) return;
    await new Promise(resolve => {
      const timer = window.setTimeout(resolve, 5000);
      window.addEventListener('oped-db-ready', () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }

  async function getFirestoreTools() {
    if (firestoreToolsPromise) return firestoreToolsPromise;
    firestoreToolsPromise = (async () => {
      await waitForFirebase();
      const [{ getApp, getApps }, firestore] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
      ]);
      if (!getApps().length) throw new Error('Firebase ещё не инициализирован.');
      return { app: getApp(), db: firestore.getFirestore(getApp()), ...firestore };
    })();
    return firestoreToolsPromise;
  }

  async function loadRejectedFranchisePairs() {
    try {
      const tools = await getFirestoreTools();
      const snapshot = await tools.getDoc(tools.doc(tools.db, 'meta', QUALITY_META_ID));
      const values = snapshot.exists() ? snapshot.data()?.rejectedFranchisePairs : [];
      rejectedFranchisePairs = new Set(Array.isArray(values) ? values.map(String) : []);
    } catch (error) {
      console.warn('Could not load rejected franchise pairs', error);
      rejectedFranchisePairs = new Set();
    }
  }

  async function loadOpenings(force = false) {
    if (!force && cachedOpenings) return cachedOpenings;
    if (!force && loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      if (window.OC_CATALOG_CACHE?.load) {
        cachedOpenings = await window.OC_CATALOG_CACHE.load(force);
        return cachedOpenings;
      }
      await waitForFirebase();
      const [{ getApp, getApps }, { getFirestore, collection, getDocs }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
      ]);
      if (!getApps().length) throw new Error('Firebase ещё не инициализирован.');
      const snapshot = await getDocs(collection(getFirestore(getApp()), 'openings'));
      cachedOpenings = snapshot.docs.map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
      return cachedOpenings;
    })();

    try {
      return await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  function compactFranchise(value) {
    return normalize(value)
      .replace(/&/g, 'and')
      .replace(/[«»„“”"'’‘`]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  }

  function franchiseWords(value) {
    const ignored = new Set(['the', 'a', 'an', 'season', 'сезон', 'tv', 'ova', 'ona', 'movie', 'фильм']);
    return normalize(value)
      .replace(/&/g, ' and ')
      .split(/[^\p{L}\p{N}]+/gu)
      .filter(word => word && !ignored.has(word));
  }

  function levenshteinDistance(first, second) {
    const a = String(first || '');
    const b = String(second || '');
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = new Array(b.length + 1);
    for (let row = 1; row <= a.length; row += 1) {
      current[0] = row;
      for (let column = 1; column <= b.length; column += 1) {
        const cost = a[row - 1] === b[column - 1] ? 0 : 1;
        current[column] = Math.min(
          previous[column] + 1,
          current[column - 1] + 1,
          previous[column - 1] + cost
        );
      }
      for (let column = 0; column <= b.length; column += 1) previous[column] = current[column];
    }
    return previous[b.length];
  }

  function franchisePairKey(first, second) {
    return [normalize(first), normalize(second)].sort((a, b) => a.localeCompare(b, 'ru')).join(' ↔ ');
  }

  function franchiseSimilarity(first, second) {
    const a = compactFranchise(first);
    const b = compactFranchise(second);
    if (!a || !b || String(first).trim() === String(second).trim()) return 0;
    if (a === b) return 100;

    const maxLength = Math.max(a.length, b.length);
    const minLength = Math.min(a.length, b.length);
    if (minLength < 4) return 0;

    let score = 0;
    if ((a.includes(b) || b.includes(a)) && minLength / maxLength >= 0.58) {
      score = Math.max(score, 76 + (minLength / maxLength) * 16);
    }

    const aWords = franchiseWords(first);
    const bWords = franchiseWords(second);
    if (aWords.length && bWords.length) {
      const bSet = new Set(bWords);
      const common = aWords.filter(word => bSet.has(word)).length;
      const coverage = common / Math.min(aWords.length, bWords.length);
      if (common >= 2 && coverage >= 0.66) score = Math.max(score, 76 + coverage * 18);
    }

    if (Math.abs(a.length - b.length) <= 3) {
      const distance = levenshteinDistance(a, b);
      const ratio = 1 - distance / maxLength;
      const allowedDistance = maxLength <= 8 ? 1 : maxLength <= 14 ? 2 : 3;
      if (distance <= allowedDistance && ratio >= 0.72) score = Math.max(score, 76 + ratio * 20 - distance);
      if (ratio >= 0.86) score = Math.max(score, 72 + ratio * 22);
    }

    return Math.round(score);
  }

  function buildSimilarFranchisePairs(openings) {
    const names = new Map();
    for (const opening of openings) {
      for (const value of listValues(opening.franchises)) {
        const key = String(value).trim();
        if (!key) continue;
        if (!names.has(key)) {
          names.set(key, {
            name: value,
            compact: compactFranchise(value),
            words: franchiseWords(value),
            ids: new Set()
          });
        }
        names.get(key).ids.add(String(opening.id));
      }
    }

    const variants = [...names.values()];
    const tokenIndex = new Map();
    const compactIndex = new Map();
    variants.forEach((variant, index) => {
      if (variant.compact) {
        if (!compactIndex.has(variant.compact)) compactIndex.set(variant.compact, []);
        compactIndex.get(variant.compact).push(index);
      }

      const tokens = new Set(variant.words.filter(word => word.length >= 3).map(word => `w:${word}`));
      const partLength = variant.compact.length <= 5 ? 2 : 3;
      for (let offset = 0; offset + partLength <= variant.compact.length; offset += 1) {
        tokens.add(`p:${variant.compact.slice(offset, offset + partLength)}`);
      }
      for (const token of tokens) {
        if (!tokenIndex.has(token)) tokenIndex.set(token, []);
        tokenIndex.get(token).push(index);
      }
    });

    const candidateKeys = new Set();
    const addCandidateGroup = indexes => {
      for (let first = 0; first < indexes.length; first += 1) {
        for (let second = first + 1; second < indexes.length; second += 1) {
          const a = Math.min(indexes[first], indexes[second]);
          const b = Math.max(indexes[first], indexes[second]);
          candidateKeys.add(`${a}:${b}`);
        }
      }
    };
    compactIndex.forEach(addCandidateGroup);
    tokenIndex.forEach(indexes => {
      if (indexes.length >= 2 && indexes.length <= 80) addCandidateGroup(indexes);
    });

    const pairs = [];
    const suggestedKeys = new Set();
    for (const candidateKey of candidateKeys) {
      const [firstIndex, secondIndex] = candidateKey.split(':').map(Number);
      const first = variants[firstIndex];
      const second = variants[secondIndex];
      const key = franchisePairKey(first.name, second.name);
      if (rejectedFranchisePairs.has(key) || suggestedKeys.has(key)) continue;
      const score = franchiseSimilarity(first.name, second.name);
      if (score < 84) continue;
      suggestedKeys.add(key);
      const defaultName = first.ids.size > second.ids.size
        ? first.name
        : second.ids.size > first.ids.size
          ? second.name
          : first.name.length <= second.name.length ? first.name : second.name;
      pairs.push({
        id: key,
        key,
        first: first.name,
        second: second.name,
        firstCount: first.ids.size,
        secondCount: second.ids.size,
        score,
        defaultName
      });
    }
    return pairs.sort((a, b) => b.score - a.score || (b.firstCount + b.secondCount) - (a.firstCount + a.secondCount));
  }

  function buildIssues(openings) {
    const issues = [
      { id: 'title', label: 'Без названия', rows: [] },
      { id: 'image', label: 'Без основной картинки', rows: [] },
      { id: 'fallback', label: 'Без запасной картинки', rows: [] },
      { id: 'performer', label: 'Без исполнителя', rows: [] },
      { id: 'studio', label: 'Без студии', rows: [] },
      { id: 'director', label: 'Без режиссёра', rows: [] },
      { id: 'franchise', label: 'Без франшизы', rows: [] },
      { id: 'franchise-suspicious', label: 'Подозрительные франшизы', rows: [] },
      { id: 'franchise-similar', label: 'Похожие названия франшиз', type: 'franchisePairs', rows: buildSimilarFranchisePairs(openings) },
      { id: 'link', label: 'Без ссылки на видео', rows: [] },
      { id: 'link-invalid', label: 'Некорректные ссылки на видео', rows: [] },
      { id: 'image-invalid', label: 'Некорректный формат ссылок на картинки', rows: [] },
      { id: 'image-unreachable', label: 'Недоступные картинки после проверки', rows: [] },
      { id: 'same-song', label: 'Одинаковая песня без группы', rows: [] },
      { id: 'duplicate', label: 'Возможные дубликаты', rows: [] }
    ];
    const byId = new Map(issues.map(issue => [issue.id, issue]));
    const duplicateMap = new Map();
    const franchiseVariants = new Map();

    for (const opening of openings) {
      for (const franchise of listValues(opening.franchises)) {
        const canonical = normalize(franchise).replace(/[^\p{L}\p{N}]+/gu, '');
        if (!canonical) continue;
        if (!franchiseVariants.has(canonical)) franchiseVariants.set(canonical, new Set());
        franchiseVariants.get(canonical).add(normalize(franchise));
      }
    }

    for (const opening of openings) {
      const rawTitle = String(opening.title || opening.anime || '').trim();
      if (!rawTitle) byId.get('title').rows.push(opening);
      const hasPrimaryImage = Boolean(String(opening.image || '').trim());
      if (!hasPrimaryImage) byId.get('image').rows.push(opening);
      if (hasPrimaryImage && !String(opening.fallbackImage || opening.imageFallback || '').trim()) byId.get('fallback').rows.push(opening);
      if (!cleanList(opening.performers)) byId.get('performer').rows.push(opening);
      if (!cleanList(opening.studios)) byId.get('studio').rows.push(opening);
      if (!cleanList(opening.directors)) byId.get('director').rows.push(opening);
      const franchises = listValues(opening.franchises);
      if (!franchises.length) byId.get('franchise').rows.push(opening);
      if (franchises.some(value => /https?:\/\/|www\.|^[,;|]|[,;|]$/i.test(value) || value.length > 120)) {
        byId.get('franchise-suspicious').rows.push(opening);
      } else if (franchises.some(value => {
        const canonical = normalize(value).replace(/[^\p{L}\p{N}]+/gu, '');
        return (franchiseVariants.get(canonical)?.size || 0) > 1;
      })) {
        byId.get('franchise-suspicious').rows.push(opening);
      }
      const trackLink = String(opening.link || '').trim();
      if (!trackLink) byId.get('link').rows.push(opening);
      else if (!plausibleTrackLink(trackLink)) byId.get('link-invalid').rows.push(opening);
      const imageUrls = [opening.image, opening.fallbackImage || opening.imageFallback].map(value => String(value || '').trim()).filter(Boolean);
      if (imageUrls.some(value => !validImageUrl(value))) byId.get('image-invalid').rows.push(opening);
      if (imageUrls.some(value => unreachableImages.has(value))) byId.get('image-unreachable').rows.push(opening);
      if (String(opening.sameSongTitle || opening.songGroupTitle || '').trim() && !String(opening.sameSongGroupId || opening.songGroupId || '').trim()) byId.get('same-song').rows.push(opening);

      const title = normalize(rawTitle);
      if (title) {
        const key = `${title}|${String(opening.type || '')}|${String(opening.year || '')}|${String(opening.season || '')}`;
        const group = duplicateMap.get(key);
        if (group) group.push(opening);
        else duplicateMap.set(key, [opening]);
      }
    }

    for (const group of duplicateMap.values()) {
      if (group.length > 1) byId.get('duplicate').rows.push(...group);
    }
    return issues;
  }

  function completeness(openings, issues) {
    if (!openings.length) return 100;
    const keyIds = new Set(['image', 'performer', 'studio', 'director', 'franchise', 'link']);
    let missing = 0;
    for (const issue of issues) if (keyIds.has(issue.id)) missing += issue.rows.length;
    return Math.max(0, Math.round((1 - missing / (openings.length * keyIds.size)) * 100));
  }

  function ensureModal() {
    if (modal?.isConnected) return modal;
    modal = document.createElement('div');
    modal.className = 'oc-quality-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Центр качества базы');
    document.body.append(modal);

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-quality-close]')) {
        closeQualityCenter();
        return;
      }

      const refresh = event.target.closest('[data-quality-refresh]');
      if (refresh) {
        void openQualityCenter(true);
        return;
      }

      const checkLinks = event.target.closest('[data-quality-check-links]');
      if (checkLinks) {
        void checkImageLinks(checkLinks);
        return;
      }

      const chooseFranchise = event.target.closest('[data-quality-franchise-choice]');
      if (chooseFranchise) {
        const row = chooseFranchise.closest('[data-quality-franchise-pair]');
        const input = row?.querySelector('[data-quality-franchise-target]');
        if (input) {
          input.value = String(chooseFranchise.dataset.qualityFranchiseChoice || '');
          input.focus();
          input.select();
        }
        return;
      }

      const mergeFranchisesButton = event.target.closest('[data-quality-franchise-merge]');
      if (mergeFranchisesButton) {
        void mergeFranchisePair(mergeFranchisesButton);
        return;
      }

      const rejectFranchisesButton = event.target.closest('[data-quality-franchise-reject]');
      if (rejectFranchisesButton) {
        void rejectFranchisePair(rejectFranchisesButton);
        return;
      }

      const summary = event.target.closest('.oc-quality-issue > summary');
      if (summary) {
        const details = summary.parentElement;
        window.setTimeout(() => {
          if (details?.open) renderIssueRows(details);
        }, 0);
        return;
      }

      const track = event.target.closest('[data-quality-track]');
      if (track) openTrack(String(track.dataset.qualityTrack || ''), String(track.dataset.qualityTitle || ''));
    });

    return modal;
  }

  function renderIssueRows(details) {
    if (!details || details.dataset.qualityRendered === '1') return;
    const issue = currentIssues.get(details.dataset.qualityIssue || '');
    const list = details.querySelector('.oc-quality-track-list');
    if (!issue || !list) return;

    details.dataset.qualityRendered = '1';
    if (!issue.rows.length) {
      list.innerHTML = '<div class="oc-quality-ok">Проблем не найдено ✓</div>';
      return;
    }

    if (issue.type === 'franchisePairs') {
      const visibleRows = issue.rows.slice(0, ISSUE_LIMIT);
      list.innerHTML = visibleRows.map(pair => `
        <article class="oc-quality-franchise-pair" data-quality-franchise-pair="${escapeHtml(pair.key)}">
          <div class="oc-quality-franchise-variants">
            <button type="button" data-quality-franchise-choice="${escapeHtml(pair.first)}">
              <strong>${escapeHtml(pair.first)}</strong>
              <small>${pair.firstCount} ${pair.firstCount === 1 ? 'трек' : 'треков'}</small>
            </button>
            <span aria-hidden="true">≈</span>
            <button type="button" data-quality-franchise-choice="${escapeHtml(pair.second)}">
              <strong>${escapeHtml(pair.second)}</strong>
              <small>${pair.secondCount} ${pair.secondCount === 1 ? 'трек' : 'треков'}</small>
            </button>
          </div>
          <label class="oc-quality-franchise-target">
            <span>Общее название после объединения</span>
            <input type="text" value="${escapeHtml(pair.defaultName)}" data-quality-franchise-target autocomplete="off" />
          </label>
          <div class="oc-quality-franchise-actions">
            <button type="button" class="oc-quality-franchise-reject" data-quality-franchise-reject="${escapeHtml(pair.key)}">Не объединять</button>
            <button type="button" class="oc-quality-franchise-merge" data-quality-franchise-merge="${escapeHtml(pair.key)}">Объединить</button>
          </div>
        </article>`).join('') + (issue.rows.length > visibleRows.length ? `<div class="oc-quality-more">Показаны первые ${visibleRows.length} из ${issue.rows.length}</div>` : '');
      return;
    }

    const visibleRows = issue.rows.slice(0, ISSUE_LIMIT);
    list.innerHTML = visibleRows.map(opening => {
      const season = opening.season ? `${SEASON_LABEL[opening.season] || opening.season} ${opening.year || ''}`.trim() : String(opening.year || '—');
      const title = String(opening.title || opening.anime || 'Без названия');
      return `<button type="button" class="oc-quality-track" data-quality-track="${escapeHtml(opening.id)}" data-quality-title="${escapeHtml(title)}"><span>${escapeHtml(title)}</span><small>${escapeHtml(opening.type || '—')} · ${escapeHtml(season)}</small></button>`;
    }).join('') + (issue.rows.length > visibleRows.length ? `<div class="oc-quality-more">Показаны первые ${visibleRows.length} из ${issue.rows.length}</div>` : '');
  }

  function franchisePairByKey(key) {
    return currentIssues.get('franchise-similar')?.rows.find(pair => pair.key === key) || null;
  }

  function showFranchisePairError(row, message) {
    if (!row) return;
    row.classList.add('is-error');
    let error = row.querySelector('.oc-quality-franchise-error');
    if (!error) {
      error = document.createElement('div');
      error.className = 'oc-quality-franchise-error';
      row.append(error);
    }
    error.textContent = message;
  }

  function refreshFranchiseSection(message) {
    qualityNotice = message;
    render(cachedOpenings || []);
    const details = modal?.querySelector('[data-quality-issue="franchise-similar"]');
    if (details) {
      details.open = true;
      renderIssueRows(details);
    }
  }

  async function rejectFranchisePair(button) {
    if (button.disabled) return;
    const key = String(button.dataset.qualityFranchiseReject || '');
    const pair = franchisePairByKey(key);
    if (!pair) return;

    button.disabled = true;
    button.textContent = 'Сохраняю…';
    try {
      const tools = await getFirestoreTools();
      await tools.setDoc(tools.doc(tools.db, 'meta', QUALITY_META_ID), {
        rejectedFranchisePairs: tools.arrayUnion(key),
        updatedAt: tools.serverTimestamp()
      }, { merge: true });
      rejectedFranchisePairs.add(key);
      refreshFranchiseSection(`Пара «${pair.first}» / «${pair.second}» отклонена и больше не будет предлагаться.`);
    } catch (error) {
      console.error('Could not reject franchise pair', error);
      button.disabled = false;
      button.textContent = 'Не объединять';
      showFranchisePairError(
        button.closest('.oc-quality-franchise-pair'),
        `Не удалось сохранить отклонение: ${error?.message || 'неизвестная ошибка'}`
      );
    }
  }

  function mergedFranchiseValues(values, pair, targetName) {
    const replaced = [];
    const sourceNames = new Set([normalize(pair.first), normalize(pair.second)]);
    for (const value of listValues(values)) {
      const next = sourceNames.has(normalize(value)) ? targetName : value;
      if (!replaced.some(existing => normalize(existing) === normalize(next))) replaced.push(next);
    }
    return replaced;
  }

  async function migrateFranchiseAlbum(pair, targetName, tools) {
    if (!window.OPED_DB?.saveEntityCard || !window.OPED_DB?.deleteEntityCard) return;
    const snapshot = await tools.getDocs(tools.collection(tools.db, 'entityCards'));
    const cards = snapshot.docs
      .map(cardSnapshot => ({ id: cardSnapshot.id, ...cardSnapshot.data() }))
      .filter(card => card.type === 'franchises');
    const sourceNames = new Set([normalize(pair.first), normalize(pair.second)]);
    const sourceCards = cards.filter(card => sourceNames.has(normalize(card.value)));
    let targetCard = cards.find(card => String(card.value || '').trim() === targetName) || null;

    if (!targetCard) {
      const sourceWithImage = cards.find(card =>
        normalize(card.value) === normalize(targetName) && String(card.image || '').trim()
      ) || sourceCards.find(card => String(card.image || '').trim());
      if (sourceWithImage) {
        const id = await window.OPED_DB.saveEntityCard({
          type: 'franchises',
          value: targetName,
          image: sourceWithImage.image
        });
        targetCard = { id, type: 'franchises', value: targetName, image: sourceWithImage.image };
      }
    }

    const keepId = String(targetCard?.id || '');
    const staleCards = sourceCards.filter(card => String(card.id) !== keepId);
    for (const card of staleCards) await window.OPED_DB.deleteEntityCard(card.id);
  }

  async function mergeFranchisePair(button) {
    if (button.disabled) return;
    const key = String(button.dataset.qualityFranchiseMerge || '');
    const pair = franchisePairByKey(key);
    const row = button.closest('[data-quality-franchise-pair]');
    const input = row?.querySelector('[data-quality-franchise-target]');
    const targetName = String(input?.value || '').trim();
    if (!pair || !targetName) {
      input?.focus();
      showFranchisePairError(row, 'Укажите общее название.');
      return;
    }

    row?.querySelectorAll('button,input').forEach(control => { control.disabled = true; });
    button.textContent = 'Объединяю…';

    try {
      const tools = await getFirestoreTools();
      const affected = (cachedOpenings || []).filter(opening =>
        listValues(opening.franchises).some(value => [normalize(pair.first), normalize(pair.second)].includes(normalize(value)))
      );

      for (let offset = 0; offset < affected.length; offset += 400) {
        const batch = tools.writeBatch(tools.db);
        for (const opening of affected.slice(offset, offset + 400)) {
          const franchises = mergedFranchiseValues(opening.franchises, pair, targetName);
          batch.update(tools.doc(tools.db, 'openings', String(opening.id)), {
            franchises,
            updatedAt: tools.serverTimestamp()
          });
        }
        await batch.commit();
      }

      for (const opening of affected) {
        opening.franchises = mergedFranchiseValues(opening.franchises, pair, targetName);
      }
      window.OC_CATALOG_CACHE?.invalidate?.();

      let albumWarning = '';
      try {
        await migrateFranchiseAlbum(pair, targetName, tools);
      } catch (error) {
        console.warn('Could not migrate franchise album', error);
        albumWarning = ' Треки объединены, но обложку альбома проверить не удалось.';
      }

      refreshFranchiseSection(
        `Франшизы «${pair.first}» и «${pair.second}» объединены как «${targetName}» в ${affected.length} треках.${albumWarning}`
      );
    } catch (error) {
      console.error('Could not merge franchise pair', error);
      row?.querySelectorAll('button,input').forEach(control => { control.disabled = false; });
      button.textContent = 'Объединить';
      showFranchisePairError(row, `Не удалось объединить: ${error?.message || 'неизвестная ошибка'}`);
    }
  }

  function renderLoading() {
    const root = ensureModal();
    currentIssues = new Map();
    root.innerHTML = `
      <div class="oc-quality-dialog">
        <div class="oc-quality-head">
          <div>
            <div class="oc-quality-kicker">админ · качество базы</div>
            <h2>Центр качества</h2>
            <p>Проверяю только коллекцию треков. Оценки и другие большие коллекции не загружаются.</p>
          </div>
          <button class="oc-quality-close" type="button" data-quality-close aria-label="Закрыть">×</button>
        </div>
        <div class="oc-quality-loading">Проверяю каталог…</div>
      </div>`;
  }

  function renderError(error) {
    const root = ensureModal();
    currentIssues = new Map();
    root.innerHTML = `
      <div class="oc-quality-dialog">
        <div class="oc-quality-head">
          <div><div class="oc-quality-kicker">админ · качество базы</div><h2>Центр качества</h2><p>Не удалось получить каталог.</p></div>
          <button class="oc-quality-close" type="button" data-quality-close aria-label="Закрыть">×</button>
        </div>
        <div class="oc-quality-error">${escapeHtml(error?.message || 'Неизвестная ошибка')}</div>
        <button class="oc-quality-refresh" type="button" data-quality-refresh>Попробовать ещё раз</button>
      </div>`;
  }

  function render(openings) {
    const root = ensureModal();
    const issues = buildIssues(openings);
    currentIssues = new Map(issues.map(issue => [issue.id, issue]));
    const score = completeness(openings, issues);
    const uniqueProblemIds = new Set();
    let totalHits = 0;
    for (const issue of issues) {
      totalHits += issue.rows.length;
      if (issue.type !== 'franchisePairs') {
        for (const opening of issue.rows) uniqueProblemIds.add(String(opening.id));
      }
    }

    const issueHtml = issues.map(issue => `
      <details class="oc-quality-issue" data-quality-issue="${issue.id}">
        <summary><span>${escapeHtml(issue.label)}</span><strong>${issue.rows.length}</strong></summary>
        <div class="oc-quality-track-list"><div class="oc-quality-more">Список загрузится при открытии раздела</div></div>
      </details>`).join('');

    root.innerHTML = `
      <div class="oc-quality-dialog">
        <div class="oc-quality-head">
          <div>
            <div class="oc-quality-kicker">админ · качество базы</div>
            <h2>Центр качества</h2>
            <p>Пустые поля, похожие франшизы, одинаковая песня без группы и возможные дубликаты. Списки создаются только когда ты раскрываешь нужный раздел.</p>
          </div>
          <div class="oc-quality-head-actions">
            <button class="oc-quality-refresh" type="button" data-quality-check-links>Проверить картинки</button>
            <button class="oc-quality-refresh" type="button" data-quality-refresh>Обновить</button>
            <button class="oc-quality-close" type="button" data-quality-close aria-label="Закрыть">×</button>
          </div>
        </div>
        <div class="oc-quality-summary">
          <div><strong>${openings.length}</strong><span>треков</span></div>
          <div><strong>${score}%</strong><span>ключевые поля</span></div>
          <div><strong>${uniqueProblemIds.size}</strong><span>треков с проблемами</span></div>
          <div><strong>${totalHits}</strong><span>срабатываний</span></div>
        </div>
        ${qualityNotice ? `<div class="oc-quality-notice">${escapeHtml(qualityNotice)}</div>` : ''}
        <div class="oc-quality-issues">${issueHtml}</div>
      </div>`;
  }

  function probeImage(url) {
    return new Promise(resolve => {
      const image = new Image();
      const resolvedUrl = imageUrl(url);
      if (!resolvedUrl) {
        resolve(false);
        return;
      }
      const timer = window.setTimeout(() => {
        image.src = '';
        resolve(false);
      }, 8000);
      image.onload = () => {
        window.clearTimeout(timer);
        resolve(Boolean(image.naturalWidth && image.naturalHeight));
      };
      image.onerror = () => {
        window.clearTimeout(timer);
        resolve(false);
      };
      image.referrerPolicy = 'no-referrer';
      image.src = resolvedUrl;
    });
  }

  async function checkImageLinks(button) {
    if (!cachedOpenings?.length || button.disabled) return;
    const urls = [...new Set(cachedOpenings.flatMap(opening => [
      String(opening.image || '').trim(),
      String(opening.fallbackImage || opening.imageFallback || '').trim()
    ]).filter(validImageUrl))];
    unreachableImages.clear();
    button.disabled = true;
    let completed = 0;
    const queue = urls.slice();
    const workers = Array.from({ length: Math.min(8, queue.length) }, async () => {
      while (queue.length) {
        const url = queue.shift();
        if (!await probeImage(url)) unreachableImages.add(url);
        completed += 1;
        button.textContent = `Проверено ${completed}/${urls.length}`;
      }
    });
    await Promise.all(workers);
    render(cachedOpenings);
  }

  function fallbackOpenTrack(title) {
    document.querySelector('.oc-tab-btn[data-tab="chart"]')?.click();
    document.querySelector('#oc-reset-filters')?.click();
    window.setTimeout(() => {
      const search = document.querySelector('#oc-f-search');
      if (!search) return;
      search.value = title;
      search.dispatchEvent(new Event('input', { bubbles: true }));
      search.dispatchEvent(new Event('change', { bubbles: true }));
      search.focus();
    }, 0);
  }

  function openTrack(id, title) {
    closeQualityCenter(true);
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'oped-admin-open-track', id }, window.location.origin);
    }
    if (window.__OC_DEEP_LINKS_READY__ && id) {
      const url = new URL(window.location.href);
      ['view', 'profile', 'section', 'album'].forEach(key => url.searchParams.delete(key));
      url.searchParams.set('track', id);
      history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    fallbackOpenTrack(title);
  }

  async function openQualityCenter(force = false) {
    if (!isAdminUi()) return;
    const root = ensureModal();
    root.classList.remove('hidden');
    document.body.classList.add('oc-quality-open');
    renderLoading();

    try {
      await yieldToUi();
      if (force) qualityNotice = '';
      const [openings] = await Promise.all([
        loadOpenings(force),
        loadRejectedFranchisePairs()
      ]);
      if (root.classList.contains('hidden')) return;
      await yieldToUi();
      render(openings);
    } catch (error) {
      console.error('Quality center load failed', error);
      if (!root.classList.contains('hidden')) renderError(error);
    }
  }

  function closeQualityCenter(force = false) {
    if (!force && document.documentElement.classList.contains('oc-admin-quality-route')) return;
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('oc-quality-open');
  }

  function syncTriggerVisibility() {
    const hidden = !isAdminUi();
    if (triggerButton) triggerButton.hidden = hidden;
    if (adminPanelLink) adminPanelLink.hidden = hidden;
  }

  function mountTrigger(attempt = 0) {
    if (triggerButton?.isConnected) return;
    const host = document.querySelector('.oc-topbar-admin');
    if (!host) {
      if (attempt < 40) window.setTimeout(() => mountTrigger(attempt + 1), 100);
      return;
    }

    triggerButton = document.createElement('button');
    triggerButton.id = 'oc-quality-center-btn';
    triggerButton.className = 'oc-franchise-repair-btn oc-quality-trigger';
    triggerButton.type = 'button';
    triggerButton.textContent = 'Центр качества базы';
    triggerButton.addEventListener('click', () => { void openQualityCenter(false); });
    host.append(triggerButton);
    adminPanelLink = document.createElement('a');
    adminPanelLink.className = 'oc-admin-panel-link';
    adminPanelLink.href = 'admin.html';
    adminPanelLink.textContent = 'Открыть админ-панель';
    host.append(adminPanelLink);
    syncTriggerVisibility();

    const badge = document.querySelector('#oc-access-badge');
    if (badge) new MutationObserver(syncTriggerVisibility).observe(badge, { childList: true, characterData: true, subtree: true });
  }

  window.addEventListener('oped-open-quality', () => { void openQualityCenter(false); });
  window.addEventListener('oped-close-quality', () => closeQualityCenter(true));
  window.__OC_QUALITY_CENTER_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountTrigger(), { once: true });
  else mountTrigger();
})();
