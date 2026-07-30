(() => {
  if (window.__OC_PROFILE_TOP_DUEL_BLOCKS_READY__) return;
  window.__OC_PROFILE_TOP_DUEL_BLOCKS_READY__ = true;

  const BLOCK_SIZE = 50;
  const DRAFT_VERSION = 2;
  let autoPausePending = false;
  let decoratePending = false;

  const norm = value => String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const snapshot = () => window.OC_APP_BRIDGE?.snapshot?.() || window.OC_APP_DATA || {};
  const currentUser = () => String(snapshot().currentUser?.nickname || '').trim();
  const currentType = () => document.querySelector('#oc-profile-duel-type')?.value === 'ED' ? 'ED' : 'OP';

  function draftKey(type = currentType()) {
    const user = norm(currentUser()).replace(/[^a-zа-я0-9_-]+/gi, '_');
    return `op-ed-profile-duel-draft-v${DRAFT_VERSION}:${user}:${type}`;
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

  function decorate() {
    decoratePending = false;
    const root = document.querySelector('#oc-profile-top-duel');
    if (!root) return;

    const description = root.querySelector('.oc-discovery-head p');
    if (description) {
      description.textContent = 'До 150 элементов проходят два этапа. Работа разбита на блоки по 50 сравнений: после каждого блока результат сохраняется и можно спокойно продолжить позже.';
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
    if (autoPausePending || !event.target.closest('#oc-profile-top-duel [data-profile-duel-choice]')) return;
    window.setTimeout(pauseAfterBlock, 0);
  }, true);

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('oped:app-data-updated', scheduleDecorate);
  window.addEventListener('oped:profile-top-open', scheduleDecorate);
  scheduleDecorate();
})();
