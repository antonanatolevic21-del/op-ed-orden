(() => {
  'use strict';

  const routes = {
    '/editor/new_test': 'tournament',
    '/editor/new_stand_test': 'standard',
    '/editor/new_tierlist_test': 'tierlist',
    '/editor/new_tree_test': 'tree',
    '/editor/new_post': 'post',
  };
  const path = location.pathname.replace(/\/$/, '');
  const route = routes[path];
  if (!route || !document.body || !isNewDraft()) return;

  function isNewDraft() {
    const query = new URLSearchParams(location.search);
    return location.pathname.replace(/\/$/, '') === path &&
      !['id', 'test_id', 'draft', 'draft_id', 'edit'].some(key => query.has(key));
  }

  const headings = {
    settings: 'дополнительные настройки',
    visibility: 'ограничения видимости',
    awards: 'награды',
  };
  const clickableSelector = 'button, label, [role="button"], [role="checkbox"], [role="switch"]';
  const optionTitles = Object.entries(testPresetOptions).flatMap(([id, option]) =>
    [option.text, ...(option.aliases ?? [])].map(text => [id, normalize(text)]));
  const titles = [...Object.entries(headings), ...optionTitles];
  const formats = testPresetFormats.filter(format => route === 'standard'
    ? !['tournament', 'tierlist'].includes(format.id)
    : format.id === route);

  const defaults = testPresetDefaults(formats);
  chrome.storage.local.get(defaults, (settings) => {
    if (chrome.runtime.lastError) return;
    start(settings);
  });

  function start(settings) {
    const handled = new Map(formats.map(format => [format.id, new Set()]));
    const handledCommon = new Map(commonTestPresetOptions.map(id => [id, new WeakSet()]));
    const clicked = new Set();
    const manual = new WeakSet();
    let timer;

    function run() {
      timer = undefined;
      if (!isNewDraft()) {
        observer.disconnect();
        return;
      }

      const controls = findControls();
      const formatId = route === 'standard' ? standardFormat(controls) : route;
      const format = formats.find(item => item.id === formatId);
      const processed = handled.get(formatId);
      const wanted = format?.options.filter(id => settings[testPresetKey(formatId, id)] === true) ?? [];
      for (const id of commonTestPresetOptions) {
        const common = settings[testPresetKey('common', id)];
        if ((common ?? settings[testPresetKey(formatId, id)]) === true) wanted.push(id);
      }
      let remaining = 0;
      for (const id of wanted) {
        const control = controls.get(id);
        const common = handledCommon.get(id);
        if (common ? common.has(control?.target) : processed.has(id)) continue;
        if (!control || !isVisible(control.title) || !canClick(control.target)) {
          remaining++;
          continue;
        }

        const state = toggleState(control);
        const desired = !testPresetOptions[id].defaultOn;
        if (common) common.add(control.target);
        else processed.add(id);
        if (state === desired || manual.has(control.target) || (!common && state === null && clicked.has(id))) continue;

        control.target.click();
        clicked.add(id);
      }

      if (route !== 'standard' && !remaining) {
        observer.disconnect();
      }
    }

    function rememberManualClick(event) {
      if (!event.isTrusted || !isNewDraft()) return;
      for (let element = event.target; element && element !== document.body; element = element.parentElement) {
        manual.add(element);
      }
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(run, 150);
    }

    const observer = new MutationObserver(schedule);
    function applySettings() {
      if (!isNewDraft() || !Object.values(settings).includes(true)) {
        observer.disconnect();
        clearTimeout(timer);
        return;
      }
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled', 'aria-disabled', 'inert'],
      });
      schedule();
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      let changed = false;
      for (const key of Object.keys(defaults)) {
        if (!changes[key]) continue;
        settings[key] = changes[key].newValue ?? defaults[key];
        changed = true;
      }
      if (changed) applySettings();
    });
    window.addEventListener('click', rememberManualClick, true);
    applySettings();
  }

  function standardFormat(controls) {
    if (controls.has('strictOrder')) return 'challenge';
    if (!controls.has('randomQuestions') || !controls.has('randomAnswers') || !controls.has('noBack')) return null;
    return controls.has('showCorrect') || controls.has('hideCorrectness') ? 'quiz' : 'identity';
  }

  function normalize(text) {
    return text.toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ').replace(/ +:/g, ':').trim();
  }

  function isVisible(element) {
    return element.isConnected && element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility === 'visible';
  }

  function comesBefore(first, second) {
    return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function findControls() {
    const matches = new Map(titles.map(([id]) => [id, new Set()]));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = normalize(node.nodeValue);
      if (!text) continue;

      for (const [id, title] of titles) {
        if (!title.startsWith(text) && !text.startsWith(title)) continue;
        const parent = node.parentElement;
        if (parent.closest('script, style, template, svg, [hidden], [aria-hidden="true"], [contenteditable], textarea, select')) continue;

        // The title can span multiple inline nodes. Keep its smallest visible element.
        for (let element = parent, depth = 0; element && depth < 4; element = element.parentElement, depth++) {
          const actual = normalize(element.textContent);
          if (actual === title || actual.startsWith(title + ':')) {
            if (isVisible(element)) matches.get(id).add(element);
            break;
          }
          if (!title.startsWith(actual)) break;
        }
      }
    }

    function single(id, filter = () => true) {
      const candidates = [...matches.get(id)].filter(filter);
      const innermost = candidates.filter(element =>
        !candidates.some(other => other !== element && element.contains(other)));
      return innermost.length === 1 ? innermost[0] : null;
    }

    const settings = single('settings');
    const visibility = single('visibility');
    const awards = visibility && single('awards', element => comesBefore(visibility, element));
    const hasTestSettings = settings && visibility && comesBefore(settings, visibility);
    const findStandaloneFlags = route === 'tree' || route === 'post';

    const controls = new Map();
    for (const [id, option] of Object.entries(testPresetOptions)) {
      const title = single(id, element => {
        if (!option.visibility) {
          return hasTestSettings && comesBefore(settings, element) && comesBefore(element, visibility);
        }
        return visibility
          ? comesBefore(visibility, element) && (!awards || comesBefore(element, awards))
          : findStandaloneFlags;
      });
      if (!title) continue;
      const target = clickTarget(title);
      if (option.visibility && !visibility && !target.matches(clickableSelector) &&
          getComputedStyle(target).cursor !== 'pointer') continue;
      controls.set(id, { title, target });
    }
    return controls;
  }

  function clickTarget(title) {
    const text = normalize(title.textContent);
    let target = title;

    for (let element = title; element; element = element.parentElement) {
      const content = normalize(element.textContent);
      // Stop before a common wrapper. A card has just its own title and optional description.
      if (!content.startsWith(text) || content.length > text.length + 300) break;
      if (optionTitles.some(([, other]) => !text.startsWith(other) && content.includes(other))) break;
      if (element.matches(clickableSelector)) return element;
      if (getComputedStyle(element).cursor === 'pointer') target = element;
      if (element === document.body || element.parentElement === document.body) break;
    }

    // A click on a text node's element also reaches its card via bubbling.
    return target;
  }

  function canClick(target) {
    if (target.closest('a[href], [inert], [aria-disabled="true"]') || target.matches(':disabled')) return false;
    return !(target.matches('button') && target.type === 'submit' && target.form);
  }

  function toggleState({ title, target }) {
    const text = normalize(title.textContent);
    if (/:\s*выключен[оаы]?(?:\s|$)/u.test(text)) return false;
    if (/:\s*включен[оаы]?(?:\s|$)/u.test(text)) return true;

    const checkbox = target.control ?? target.querySelector('input[type="checkbox"]');
    if (checkbox?.matches('input[type="checkbox"]')) return checkbox.checked;

    for (let element = title; element; element = element.parentElement) {
      for (const attribute of ['aria-checked', 'aria-pressed', 'data-checked', 'data-active']) {
        const value = element.getAttribute(attribute);
        if (value === 'true' || value === 'false') return value === 'true';
      }
      const dataState = element.getAttribute('data-state');
      if (dataState === 'checked' || dataState === 'unchecked') return dataState === 'checked';
      if (element.matches('.active, .selected, .checked')) return true;
      if (element.matches('.inactive, .unchecked')) return false;
      if (element === target) break;
    }

    return null;
  }
})();
