(() => {
  if (window.__OC_MANUAL_TOP_INSERT_FIX_READY__) return;

  const FILTER_IDS = [
    'oc-p-search', 'oc-p-type', 'oc-p-score-cmp', 'oc-p-score-value',
    'oc-p-from-year', 'oc-p-from-season', 'oc-p-to-year', 'oc-p-to-season',
    'oc-p-studio', 'oc-p-director', 'oc-p-performer', 'oc-p-franchise',
    'oc-ar-type', 'oc-ar-metric', 'oc-ar-score', 'oc-content-filter-select'
  ];
  const clean = value => String(value || '').trim();
  const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  let busy = false;

  function actionButton(action, id) {
    return [...document.querySelectorAll(`[data-action="${action}"][data-id]`)]
      .find(button => button.isConnected && clean(button.dataset.id) === clean(id)) || null;
  }

  function rankFromButton(button) {
    const match = clean(button?.textContent).match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function visibleRank(type, id) {
    const container = document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op');
    const button = [...(container?.querySelectorAll('.oc-profile-item.manual [data-action="set-rank"][data-id]') || [])]
      .find(item => clean(item.dataset.id) === clean(id));
    return rankFromButton(button);
  }

  async function waitFor(check, timeout = 5000, interval = 50) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const value = check();
      if (value) return value;
      await sleep(interval);
    }
    return null;
  }

  function captureFilters() {
    const snapshot = {};
    FILTER_IDS.forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      snapshot[id] = element.multiple
        ? [...element.options].filter(option => option.selected).map(option => option.value)
        : element.value;
    });
    return snapshot;
  }

  async function restoreFilters(snapshot) {
    FILTER_IDS.forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      if (element.multiple) {
        const selected = new Set(Array.isArray(snapshot[id]) ? snapshot[id].map(String) : []);
        [...element.options].forEach(option => { option.selected = selected.has(String(option.value)); });
      } else {
        element.value = snapshot[id] ?? '';
      }
    });
    FILTER_IDS.forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      element.dispatchEvent(new Event(element.matches('input') ? 'input' : 'change', { bubbles: true }));
    });
    await sleep(150);
  }

  function setControl(selector, value, eventType = 'change') {
    const element = document.querySelector(selector);
    if (!element) return;
    element.value = value;
    element.dispatchEvent(new Event(eventType, { bubbles: true }));
  }

  function showToast(message, type = '') {
    window.OC_TOAST?.show?.(message, { type });
    const status = document.querySelector('#oc-status');
    if (status) status.textContent = message;
  }

  function closeOriginalPanel() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.querySelectorAll('.oc-manual-insert-zone.active').forEach(zone => zone.classList.remove('active'));
  }

  function createProgressNotice(title, target) {
    document.querySelector('.oc-manual-insert-progress')?.remove();
    const notice = document.createElement('div');
    notice.className = 'oc-manual-insert-progress';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.innerHTML = `<div class="oc-manual-insert-progress-title">${clean(title) || 'Изменение топа'} · место ${target}</div><div class="oc-manual-insert-progress-text">Начинаю изменение…</div>`;
    document.body.append(notice);
    return notice;
  }

  function setProgress(notice, text, error = false) {
    if (!notice) return;
    const line = notice.querySelector('.oc-manual-insert-progress-text');
    if (line) line.textContent = text || '';
    notice.classList.toggle('error', error);
  }

  function removeProgress(notice, delay = 0) {
    if (!notice) return;
    window.setTimeout(() => notice.remove(), delay);
  }

  async function prepareCandidate(id, title, type) {
    document.querySelector('#oc-p-reset-filters')?.click();
    await sleep(100);
    setControl('#oc-content-filter-select', 'all');
    setControl('#oc-ar-type', type);
    setControl('#oc-ar-score', '');
    setControl('#oc-p-search', title, 'input');

    const findControls = () => {
      const controls = {
        rank: actionButton('all-set-rank', id),
        add: actionButton('all-to-top100', id),
        unhide: actionButton('all-unhide-manual', id)
      };
      return controls.rank || controls.add || controls.unhide ? controls : null;
    };

    let controls = await waitFor(findControls, 6000);
    if (controls?.unhide && !controls.rank) {
      controls.unhide.click();
      controls = await waitFor(findControls, 6000);
    }
    if (!controls?.rank && !controls?.add) {
      throw new Error('Не удалось найти выбранный трек в редакторе топа.');
    }
    return controls;
  }

  async function moveByRankButton(rankButton, id, type, target) {
    let promptCalled = false;
    const originalPrompt = window.prompt;
    window.prompt = () => {
      promptCalled = true;
      return String(target);
    };
    try {
      rankButton.click();
    } finally {
      window.prompt = originalPrompt;
    }
    if (!promptCalled) throw new Error('Редактор места не сработал.');

    const changed = await waitFor(() => {
      const hiddenRank = rankFromButton(actionButton('all-set-rank', id));
      const topRank = visibleRank(type, id);
      return hiddenRank === target || topRank === target;
    }, 6000);
    if (!changed) throw new Error('Место трека не изменилось.');
  }

  async function performMove({ id, title, type, target, notice }) {
    const filters = captureFilters();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    let successful = false;
    try {
      setProgress(notice, 'Подготавливаю выбранный трек…');
      let controls = await prepareCandidate(id, title, type);
      let rankButton = controls.rank;
      let current = rankFromButton(rankButton);

      if (current && current <= target) {
        throw new Error(`Трек уже находится на ${current}-м месте или выше.`);
      }

      if (!rankButton) {
        setProgress(notice, 'Добавляю трек в ручной список…');
        controls.add.click();
        rankButton = await waitFor(() => actionButton('all-set-rank', id), 6000);
        current = rankFromButton(rankButton);
        if (!rankButton || !current) throw new Error('После добавления не удалось определить место трека.');
      }

      if (current !== target) {
        setProgress(notice, `Перемещаю на ${target}-е место…`);
        await moveByRankButton(rankButton, id, type, target);
      }
      successful = true;
    } finally {
      setProgress(notice, successful ? 'Восстанавливаю прежний вид…' : 'Возвращаю прежний вид…');
      await restoreFilters(filters);
      requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
    }

    const confirmed = await waitFor(() => visibleRank(type, id) === target || rankFromButton(actionButton('all-set-rank', id)) === target, 4000);
    if (!confirmed) throw new Error('Трек не появился на выбранном месте.');
  }

  document.addEventListener('click', async event => {
    const confirmButton = event.target.closest?.('.oc-manual-insert-confirm');
    if (!confirmButton || busy) return;

    const panel = confirmButton.closest('.oc-manual-insert-panel');
    const zone = panel?.closest('.oc-manual-insert-zone');
    const selected = panel?.querySelector('.oc-manual-insert-result.selected');
    const id = clean(selected?.dataset.id);
    const type = clean(zone?.dataset.type);
    const target = Number(zone?.dataset.targetPlace);
    const title = clean(panel?.querySelector('.oc-manual-insert-preview-title')?.textContent);
    if (!panel || !id || !type || !Number.isFinite(target)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    busy = true;
    const notice = createProgressNotice(title, target);
    closeOriginalPanel();

    try {
      await performMove({ id, title, type, target, notice });
      setProgress(notice, 'Готово. Осталось сохранить топ-100.');
      removeProgress(notice, 1800);
      showToast(`${title}: теперь ${target}-е место. Нажми «Сохранить топ-100».`, 'success');
    } catch (error) {
      const message = error?.message || 'Не удалось изменить топ.';
      setProgress(notice, message, true);
      removeProgress(notice, 5000);
      showToast(message, 'error');
    } finally {
      busy = false;
    }
  }, true);

  window.__OC_MANUAL_TOP_INSERT_FIX_READY__ = true;
})();
