(() => {
  if (window.__OC_PROFILE_TOP_DUEL_BLOCKS_READY__) return;
  window.__OC_PROFILE_TOP_DUEL_BLOCKS_READY__ = true;

  const BLOCK_SIZE = 50;
  const DRAFT_VERSION = 2;
  const EDITOR_DRAFT_VERSION = 2;
  const EDITOR_DRAFT_PREFIX = 'oc-top100-editor-v2-draft:';
  let autoPausePending = false;
  let decoratePending = false;
  let applyingResult = false;

  const clean = value => String(value ?? '').trim();
  const norm = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const normalizeUser = value => {
    try {
      return window.OPED_DB?.normalizeNickname?.(value) || norm(value).replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60);
    } catch (_) {
      return norm(value).replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 60);
    }
  };
  const uniqueIds = values => Array.from(new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))).slice(0, 100);
  const snapshot = () => window.OC_APP_BRIDGE?.snapshot?.() || window.OC_APP_DATA || {};
  const currentUser = () => clean(snapshot().currentUser?.nickname);
  const currentType = () => document.querySelector('#oc-profile-duel-type')?.value === 'ED' ? 'ED' : 'OP';

  function draftKey(type = currentType()) {
    const user = norm(currentUser()).replace(/[^a-zа-я0-9_-]+/gi, '_');
    return `op-ed-profile-duel-draft-v${DRAFT_VERSION}:${user}:${type}`;
  }

  function editorDraftKey() {
    return EDITOR_DRAFT_PREFIX + normalizeUser(currentUser());
  }

  function storedDraft() {
    try {
      return JSON.parse(localStorage.getItem(draftKey()) || 'null');
    } catch (_) {
      return null;
    }
  }

  function completedBlock(draft) {
    if (!draft || draft.complete || draft.stage === 1 && draft.stageOneComplete) return 0;
    const comparisons = Math.max(0, Number(draft.stageComparisons) || 0);
    return comparisons > 0 && comparisons % BLOCK_SIZE === 0 ? comparisons / BLOCK_SIZE : 0;
  }

  function manualRow() {
    const data = snapshot();
    const rows = data.manualRanks || {};
    const user = currentUser();
    const key = normalizeUser(user);
    return rows[user] || rows[key] || Object.values(rows).find(row => normalizeUser(row?.nickname || row?.nicknameKey || row?.displayName || row?.name) === key) || {};
  }

  function savedOrders() {
    const row = manualRow();
    return {
      OP: uniqueIds(row.OP || row.manualOP),
      ED: uniqueIds(row.ED || row.manualED)
    };
  }

  function existingEditorDraft() {
    try {
      const row = JSON.parse(localStorage.getItem(editorDraftKey()) || 'null');
      if (!row || row.version !== EDITOR_DRAFT_VERSION || !row.draft) return null;
      return {
        OP: uniqueIds(row.draft.OP),
        ED: uniqueIds(row.draft.ED)
      };
    } catch (_) {
      return null;
    }
  }

  function persistEditorDraft(type, order) {
    const next = existingEditorDraft() || savedOrders();
    next[type] = uniqueIds(order);
    localStorage.setItem(editorDraftKey(), JSON.stringify({
      version: EDITOR_DRAFT_VERSION,
      draft: next,
      savedAt: Date.now(),
      source: 'duel'
    }));
    return next;
  }

  function resultOrder(root) {
    const preview = Array.from(root.querySelectorAll('.oc-discovery-list')).find(list =>
      /готовый порядок|промежуточный топ/i.test(clean(list.querySelector('h4')?.textContent))
    );
    return uniqueIds(Array.from(preview?.querySelectorAll('[data-profile-duel-open]') || []).map(button => button.dataset.profileDuelOpen));
  }

  function toast(message, type = '') {
    window.OC_TOAST?.show?.(message, { type });
    const status = document.querySelector('#oc-status');
    if (status) status.textContent = message;
  }

  async function waitForEditor(attempt = 0) {
    const edit = document.querySelector('#oc-manual-edit-btn');
    const op = document.querySelector('#oc-profile-op');
    const ed = document.querySelector('#oc-profile-ed');
    if (edit && op && ed) return edit;
    if (attempt >= 80) throw new Error('Редактор топ-100 ещё не загрузился.');
    await new Promise(resolve => setTimeout(resolve, 50));
    return waitForEditor(attempt + 1);
  }

  function applyThroughOpenEditor(type, order) {
    const container = document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op');
    if (!container) return false;
    const wanted = new Set(order);
    const currentIds = Array.from(container.querySelectorAll(':scope > .oc-profile-item')).map(card => clean(card.dataset.top100Id)).filter(Boolean);

    const originalConfirm = window.confirm;
    try {
      window.confirm = () => true;
      currentIds.filter(id => !wanted.has(id)).forEach(id => {
        container.querySelector(`[data-top100-action="remove"][data-id="${CSS.escape(id)}"]`)?.click();
      });
    } finally {
      window.confirm = originalConfirm;
    }

    for (let index = order.length - 1; index >= 0; index -= 1) {
      document.dispatchEvent(new CustomEvent('oc:top100-place', {
        detail: { type, id: order[index], place: 1, source: 'duel-result' }
      }));
    }
    return true;
  }

  async function openEditorWithDraft(type, order) {
    persistEditorDraft(type, order);
    const edit = await waitForEditor();
    const typeButton = document.querySelector(`.oc-profile-top-type-btn[data-type="${type}"]`);
    if (typeButton && !typeButton.classList.contains('active')) typeButton.click();

    if (edit.classList.contains('active')) {
      applyThroughOpenEditor(type, order);
    } else {
      edit.click();
    }

    window.setTimeout(() => {
      document.querySelector(type === 'ED' ? '#oc-profile-ed' : '#oc-profile-op')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  async function stageCompletedResult(root, button) {
    if (applyingResult) return;
    const order = resultOrder(root);
    if (!order.length) {
      toast('Не удалось получить итоговый порядок дуэли.', 'error');
      return;
    }

    applyingResult = true;
    const type = currentType();
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Переношу…';
    try {
      await openEditorWithDraft(type, order);
      try { localStorage.removeItem(draftKey(type)); } catch (_) {}
      root.dataset.duelDraftApplied = type;
      button.textContent = 'Перенесено в редактор';
      toast(`Предварительный ${type}-топ расставлен. Отредактируй его и нажми обычную кнопку «Сохранить топ-100», когда всё будет готово.`, 'success');
    } catch (error) {
      console.error('Could not stage duel result', error);
      button.disabled = false;
      button.textContent = oldText;
      toast(error?.message || 'Не удалось перенести результат в редактор.', 'error');
    } finally {
      applyingResult = false;
      scheduleDecorate();
    }
  }

  function decorate() {
    decoratePending = false;
    const root = document.querySelector('#oc-profile-top-duel');
    if (!root) return;

    const description = root.querySelector('.oc-discovery-head p');
    if (description) {
      description.textContent = 'До 150 элементов проходят два этапа. Работа разбита на блоки по 50 сравнений. После завершения результат переносится в предварительный порядок редактора и публикуется только обычной кнопкой сохранения топа.';
    }

    const finalButton = root.querySelector('#oc-profile-duel-save');
    if (finalButton) {
      if (root.dataset.duelDraftApplied) {
        finalButton.textContent = 'Перенесено в редактор';
        finalButton.disabled = true;
      } else {
        finalButton.textContent = 'Перенести в редактор';
      }
    }

    const completeBar = Array.from(root.querySelectorAll('.oc-top100-candidate-bar')).find(bar =>
      /оба этапа завершены/i.test(clean(bar.querySelector('strong')?.textContent))
    );
    const completeDetails = completeBar?.querySelector('span');
    if (completeDetails) {
      const comparisons = clean(completeDetails.textContent).match(/\d+/)?.[0] || '';
      completeDetails.textContent = `${comparisons ? comparisons + ' сравнений. ' : ''}Результат готов к переносу в предварительный топ-100 для ручной правки.`;
    }

    const candidateBar = Array.from(root.querySelectorAll('.oc-top100-candidate-bar')).find(bar =>
      /^кандидаты:/i.test(clean(bar.querySelector('strong')?.textContent))
    );
    const candidateDetails = candidateBar?.querySelector('span');
    if (candidateDetails) {
      candidateDetails.textContent = `Они попадут в пул первыми. В дуэль берётся до 150 незакреплённых элементов; итоговые первые 100 станут предварительным порядком редактора.`;
    }

    const draft = storedDraft();
    const block = completedBlock(draft);
    if (!block || root.querySelector('#oc-profile-duel-save-exit')) return;

    const bars = Array.from(root.querySelectorAll('.oc-top100-candidate-bar'));
    const draftBar = bars.find(bar => bar.querySelector('#oc-profile-duel-resume'));
    if (!draftBar) return;

    const strong = draftBar.querySelector('strong');
    const details = draftBar.querySelector('span');
    const stage = Number(draft.stage) === 2 ? 2 : 1;
    if (strong) strong.textContent = `Этап ${stage} · блок ${block} завершён`;
    if (details) details.textContent = `${BLOCK_SIZE} сравнений в блоке · ${Number(draft.comparisons) || 0} всего. Промежуточный результат сохранён на этом устройстве.`;

    const resume = draftBar.querySelector('#oc-profile-duel-resume');
    if (resume) resume.textContent = `Продолжить · блок ${block + 1}`;
  }

  function scheduleDecorate() {
    if (decoratePending) return;
    decoratePending = true;
    requestAnimationFrame(decorate);
  }

  function pauseAfterBlock() {
    const draft = storedDraft();
    if (!completedBlock(draft)) return;
    const saveButton = document.querySelector('#oc-profile-top-duel #oc-profile-duel-save-exit');
    if (!saveButton) return;

    autoPausePending = true;
    saveButton.click();
    window.setTimeout(() => {
      autoPausePending = false;
      scheduleDecorate();
    }, 0);
  }

  document.addEventListener('click', event => {
    const finalButton = event.target.closest('#oc-profile-top-duel #oc-profile-duel-save');
    if (finalButton && !finalButton.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const root = finalButton.closest('#oc-profile-top-duel');
      if (root) void stageCompletedResult(root, finalButton);
      return;
    }
    if (autoPausePending || !event.target.closest('#oc-profile-top-duel [data-profile-duel-choice]')) return;
    window.setTimeout(pauseAfterBlock, 0);
  }, true);

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('oped:app-data-updated', scheduleDecorate);
  window.addEventListener('oped:profile-top-open', scheduleDecorate);
  scheduleDecorate();
})();
