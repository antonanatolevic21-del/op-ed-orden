(() => {
  if (window.__EV_TITLE_WORDS_READY__) return;

  const PREFS_KEY = 'aboba-events-ui-preferences-v1';
  const CN_MODE_KEY = 'aboba-events-codenames-title-mode-v1';
  const displayToInternal = new Map();
  const TITLE_SELECTORS = [
    '.ev-guess-result-title',
    '.ev-guess-option',
    '.ev-guess-suggestion',
    '.ev-guess-feedback-answer',
    '.ev-bw-opening-title',
    '[data-bw-answer] option',
    '.ev-bw-truth-line',
    '.ev-bw-other-guess',
    '.ev-bw-your-choice',
    '.ev-cn-card-title',
    '.ev-blind-slot-title',
    '.ev-blind-current h2',
    '#ev-who-pick-titles option',
    '#ev-who-titles option'
  ].join(',');

  function prefs() {
    try {
      const value = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_) {
      return {};
    }
  }

  function activeMode() {
    return String(document.querySelector('.ev-mode-tab.active')?.dataset?.mode || '');
  }

  function rememberCodenamesMode() {
    const select = document.querySelector('#ev-cn-type');
    if (!select) return;
    localStorage.setItem(CN_MODE_KEY, String(select.value || 'all'));
  }

  function modeIsMixed(mode = activeMode()) {
    const state = prefs();
    if (mode === 'guess') return !String(state.guessFilters?.type || '');
    if (mode === 'bestworst') {
      const visible = document.querySelector('#ev-bw-type');
      if (visible) return String(visible.value || 'both') === 'both';
      return String(state.bestWorstFilters?.typeFilter || 'both') === 'both';
    }
    if (mode === 'blindtier') {
      const visible = document.querySelector('[data-blind-field="type"]');
      if (visible) return !String(visible.value || '');
      return !String(state.blindTierFilters?.type || '');
    }
    if (mode === 'whoami') {
      const visible = document.querySelector('#ev-who-type');
      if (visible) return !String(visible.value || '');
      return !String(state.whoAmISettings?.type || '');
    }
    if (mode === 'codenames') {
      const visible = document.querySelector('#ev-cn-type');
      if (visible) {
        rememberCodenamesMode();
        return String(visible.value || 'all') === 'all';
      }
      const cardTypes = new Set([...document.querySelectorAll('.ev-cn-card-meta')].map(node => String(node.textContent || '').trim()).filter(Boolean));
      if (cardTypes.has('OP') && cardTypes.has('ED')) return true;
      const saved = String(localStorage.getItem(CN_MODE_KEY) || '');
      return saved ? saved === 'all' : true;
    }
    return false;
  }

  function hasRussianWord(value, word) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^А-Яа-яЁё])${escaped}(?=$|[^А-Яа-яЁё])`, 'iu').test(String(value || ''));
  }

  function replaceTypeToken(value, token, russianWord) {
    const source = String(value || '');
    const tokenRe = new RegExp(`\\b${token}\\b(?=(?:\\s*#?\\d+)?\\s*(?:[»”"'’\\)\\]}]|·|\\/|$))`, 'giu');
    return source.replace(tokenRe, (match, offset) => {
      const prefix = source.slice(0, offset);
      return hasRussianWord(prefix, russianWord) ? '' : russianWord;
    });
  }

  function toDisplay(value) {
    return replaceTypeToken(replaceTypeToken(value, 'OP', 'опенинг'), 'ED', 'эндинг')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([»”"'’\)\]}])/g, '$1');
  }

  function lookupKey(value) {
    return String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
  }

  function rememberMapping(displayValue, internalValue) {
    const display = String(displayValue || '').trim();
    const internal = String(internalValue || '').trim();
    const key = lookupKey(display);
    if (key && internal && !displayToInternal.has(key)) displayToInternal.set(key, internal);
  }

  function toInternal(value) {
    const source = String(value || '');
    const mapped = displayToInternal.get(lookupKey(source));
    if (mapped) return mapped;
    return source
      .replace(/(^|[^А-Яа-яЁё])опенинг(?=(?:\s*#?\d+)?\s*$)/iu, '$1OP')
      .replace(/(^|[^А-Яа-яЁё])эндинг(?=(?:\s*#?\d+)?\s*$)/iu, '$1ED');
  }

  function rewriteTextNodes(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    nodes.forEach(node => {
      const before = String(node.nodeValue || '');
      const after = toDisplay(before);
      if (after !== before) node.nodeValue = after;
    });
  }

  function rewriteElement(element) {
    if (!(element instanceof Element) || !modeIsMixed()) return;
    const before = String(element.textContent || '');
    const after = toDisplay(before);
    rememberMapping(after, before);
    rewriteTextNodes(element);

    if (element.matches('.ev-guess-suggestion[data-guess-suggestion]')) {
      const original = String(element.dataset.guessSuggestion || '');
      const display = toDisplay(original);
      rememberMapping(display, original);
      element.dataset.guessSuggestion = display;
    }
    if (element.matches('#ev-who-pick-titles option,#ev-who-titles option')) {
      const original = String(element.getAttribute('value') || before);
      const display = toDisplay(original);
      rememberMapping(display, original);
      element.value = display;
    }
  }

  function processNode(node) {
    if (!(node instanceof Element)) return;
    if (node.matches(TITLE_SELECTORS)) rewriteElement(node);
    node.querySelectorAll(TITLE_SELECTORS).forEach(rewriteElement);
    if (node.querySelector?.('#ev-cn-type') || node.matches?.('#ev-cn-type')) rememberCodenamesMode();
  }

  function prepareInput(selector, dispatchInput = false) {
    const input = document.querySelector(selector);
    if (!input || !modeIsMixed()) return;
    const internal = toInternal(input.value);
    if (internal === input.value) return;
    input.value = internal;
    if (dispatchInput) input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  document.addEventListener('change', event => {
    if (event.target?.matches?.('#ev-cn-type')) rememberCodenamesMode();
  }, true);

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#ev-guess-manual-submit')) prepareInput('#ev-guess-manual-input');
    if (event.target?.closest?.('#ev-who-pick-submit')) prepareInput('#ev-who-pick-input', true);
    if (event.target?.closest?.('#ev-who-guess')) prepareInput('#ev-who-guess-input', true);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target?.matches?.('#ev-guess-manual-input')) prepareInput('#ev-guess-manual-input');
  }, true);

  function init() {
    const roots = [document.querySelector('#ev-app'), document.querySelector('#ev-guess-game')].filter(Boolean);
    roots.forEach(root => {
      processNode(root);
      new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(processNode));
      }).observe(root, { childList: true, subtree: true });
    });
    rememberCodenamesMode();
  }

  window.__EV_TITLE_WORDS_READY__ = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
