(() => {
  const panel = document.querySelector('.oc-addbar');
  if (!panel) return;

  const PIN_STORAGE_KEY = 'op-ed-add-field-pins-v1';
  const LAST_TITLE_STORAGE_KEY = 'op-ed-last-added-title-v1';
  const FIELD_HISTORY_STORAGE_KEY = 'op-ed-add-field-history-v1';
  const FORM_STATE_STORAGE_KEY = 'op-ed-add-form-state-v2';
  const pinFieldIds = [
    'oc-add-type', 'oc-add-year', 'oc-add-season',
    'oc-add-studio', 'oc-add-director', 'oc-add-performer', 'oc-add-same-song',
    'oc-add-franchise', 'oc-add-alt-titles',
    'oc-add-chinese', 'oc-add-movie', 'oc-add-shortened',
    'oc-add-backup-image'
  ];
  const uniqueFieldIds = [
    'oc-add-title', 'oc-add-image', 'oc-add-fallback-image', 'oc-add-link', 'oc-add-notes'
  ];
  const uncertaintyFields = {
    'oc-add-performer': 'oc-add-uncertain-performer',
    'oc-add-director': 'oc-add-uncertain-director',
    'oc-add-image': 'oc-add-uncertain-image'
  };
  let formState = { pins: {}, history: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(FORM_STATE_STORAGE_KEY) || 'null');
    if (parsed && typeof parsed === 'object') formState = { pins: parsed.pins || {}, history: parsed.history || {} };
  } catch (_) {}
  let pinState = formState.pins;
  if (!Object.keys(pinState).length) {
    try {
      const parsed = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) || '{}');
      if (parsed && typeof parsed === 'object') pinState = parsed;
    } catch (_) {}
  }
  formState.pins = pinState;
  uniqueFieldIds.forEach(id => delete pinState[id]);
  try { localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinState)); } catch (_) {}

  function controlValue(control) {
    return control.type === 'checkbox' ? Boolean(control.checked) : String(control.value || '');
  }

  function saveFormState() {
    formState.pins = pinState;
    try {
      localStorage.setItem(FORM_STATE_STORAGE_KEY, JSON.stringify(formState));
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinState));
    } catch (_) {}
  }

  function savePinState() {
    saveFormState();
  }

  function restorePinnedValue(control) {
    const saved = pinState[control.id];
    if (!saved?.pinned) return;
    if (control.type === 'checkbox') control.checked = Boolean(saved.value);
    else control.value = String(saved.value ?? '');
  }

  function syncPinButton(control, button) {
    const pinned = Boolean(pinState[control.id]?.pinned);
    button.classList.toggle('active', pinned);
    button.setAttribute('aria-pressed', String(pinned));
    button.title = pinned ? 'Открепить поле' : 'Закрепить поле';
    button.setAttribute('aria-label', button.title);
  }

  function makePinButton(control) {
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = 'oc-add-field-pin';
    button.textContent = '📌';
    syncPinButton(control, button);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (pinState[control.id]?.pinned) {
        delete pinState[control.id];
      } else {
        pinState[control.id] = { pinned: true, value: controlValue(control) };
      }
      savePinState();
      syncPinButton(control, button);
    });
    const rememberValue = () => {
      if (!pinState[control.id]?.pinned) return;
      pinState[control.id].value = controlValue(control);
      savePinState();
    };
    control.addEventListener('input', rememberValue);
    control.addEventListener('change', rememberValue);
    return button;
  }

  function addUncertaintyToggle(control, wrapper) {
    const checkboxId = uncertaintyFields[control.id];
    if (!checkboxId || document.getElementById(checkboxId)) return;
    wrapper.classList.add('oc-add-status-field');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.hidden = true;
    const button = document.createElement('span');
    button.tabIndex = -1;
    button.setAttribute('role', 'button');
    button.className = 'oc-add-field-pin oc-add-field-uncertain';
    button.textContent = '❓';
    const sync = () => {
      button.classList.toggle('active', checkbox.checked);
      button.setAttribute('aria-pressed', String(checkbox.checked));
      button.title = checkbox.checked ? 'Снять пометку «неуверенно»' : 'Пометить как неуверенное';
      button.setAttribute('aria-label', button.title);
    };
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
    checkbox.addEventListener('change', sync);
    wrapper.append(checkbox, button);
    sync();
  }

  pinFieldIds.forEach(id => {
    const control = document.getElementById(id);
    if (!control || control.dataset.pinReady === '1') return;
    control.dataset.pinReady = '1';
    restorePinnedValue(control);
    const button = makePinButton(control);
    const label = control.closest('.oc-flag-check');
    const wrapper = document.createElement('span');
    wrapper.className = label ? 'oc-add-pin-flag' : 'oc-add-pin-field';
    if (label) {
      label.before(wrapper);
      wrapper.append(label, button);
    } else {
      control.before(wrapper);
      wrapper.append(control, button);
    }
    addUncertaintyToggle(control, wrapper);
  });

  const imageControl = document.getElementById('oc-add-image');
  if (imageControl && imageControl.dataset.uncertaintyReady !== '1') {
    imageControl.dataset.uncertaintyReady = '1';
    const wrapper = document.createElement('span');
    wrapper.className = 'oc-add-pin-field';
    imageControl.before(wrapper);
    wrapper.append(imageControl);
    addUncertaintyToggle(imageControl, wrapper);
  }

  window.OC_ADD_FIELD_PINS = {
    isPinned(id) {
      return Boolean(pinState[String(id || '')]?.pinned);
    }
  };

  const placeholders = {
    'oc-add-title': 'Название (аниме — OP/ED N)',
    'oc-add-year': 'Год (напр. 2024)',
    'oc-add-studio': 'Студии (через запятую)',
    'oc-add-director': 'Режиссёры опа (через запятую)',
    'oc-add-performer': 'Исполнители (через запятую)',
    'oc-add-same-song': 'Одинаковая песня — общее название',
    'oc-add-franchise': 'Франшизы: одна строка = одна франшиза. Заполняется только вручную',
    'oc-add-image': 'Основная картинка / постер (URL)',
    'oc-add-fallback-image': 'Запасная картинка (например images/название.webp)',
    'oc-add-link': 'Ссылка (anisongdb.com и т.п.)',
    'oc-add-alt-titles': 'Альтернативные названия — каждое с новой строки или через ;. Можно оставить пустым'
  };

  Object.entries(placeholders).forEach(([id, placeholder]) => {
    const control = document.getElementById(id);
    if (control) control.placeholder = placeholder;
  });

  const commaListFieldIds = ['oc-add-studio', 'oc-add-director', 'oc-add-performer'];
  const alternativeSeparatorPattern = /(?:\s+(?:и|and)\s+|\s*[&＆×✕✖•·∙⋅・;|/／+]\s*)/iu;
  const alternativeSeparatorGlobalPattern = /(?:\s+(?:и|and)\s+|\s*[&＆×✕✖•·∙⋅・;|/／+]\s*)/giu;

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function protectedListValue(control, rawValue) {
    let value = String(rawValue || '');
    const protectedValues = [];
    const datalist = document.getElementById(control.getAttribute('list') || '');
    const known = [...(datalist?.options || [])]
      .map(option => String(option.value || '').trim())
      .filter(item => item && alternativeSeparatorPattern.test(item))
      .sort((left, right) => right.length - left.length);
    known.forEach(item => {
      const pattern = new RegExp(escapeRegExp(item), 'giu');
      value = value.replace(pattern, () => {
        const token = `\uE000${protectedValues.length}\uE001`;
        protectedValues.push(item);
        return token;
      });
    });
    return { value, protectedValues };
  }

  function suggestedCommaList(control) {
    const raw = String(control.value || '').trim();
    if (!raw) return '';
    const protectedValue = protectedListValue(control, raw);
    if (!alternativeSeparatorPattern.test(protectedValue.value)) return '';
    let proposed = protectedValue.value
      .replace(alternativeSeparatorGlobalPattern, ', ')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .join(', ');
    protectedValue.protectedValues.forEach((item, index) => {
      proposed = proposed.replaceAll(`\uE000${index}\uE001`, item);
    });
    return proposed && proposed !== raw ? proposed : '';
  }

  function bindCommaListSuggestion(control) {
    if (!control || control.dataset.listSuggestionReady === '1') return;
    const wrapper = control.closest('.oc-add-pin-field');
    if (!wrapper) return;
    control.dataset.listSuggestionReady = '1';
    wrapper.classList.add('oc-list-suggestion-host');
    const suggestion = document.createElement('span');
    suggestion.className = 'oc-list-normalize-suggestion';
    suggestion.hidden = true;
    suggestion.setAttribute('role', 'status');
    suggestion.setAttribute('aria-live', 'polite');
    const label = document.createElement('span');
    label.className = 'oc-list-normalize-label';
    label.textContent = 'Записать через запятую:';
    const value = document.createElement('code');
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'oc-list-normalize-apply';
    apply.textContent = 'Применить';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'oc-list-normalize-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Скрыть предложение');
    suggestion.append(label, value, apply, close);
    wrapper.append(suggestion);

    let proposed = '';
    let dismissedValue = '';
    const update = () => {
      const raw = String(control.value || '');
      proposed = raw === dismissedValue ? '' : suggestedCommaList(control);
      suggestion.hidden = !proposed;
      value.textContent = proposed;
      value.title = proposed;
    };
    apply.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (!proposed) return;
      control.value = proposed;
      dismissedValue = '';
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
      control.focus();
    });
    close.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      dismissedValue = String(control.value || '');
      suggestion.hidden = true;
    });
    control.addEventListener('input', update);
    control.addEventListener('change', update);
    update();
  }

  commaListFieldIds.forEach(id => bindCommaListSuggestion(document.getElementById(id)));

  function readFieldHistory() {
    if (formState.history && Object.keys(formState.history).length) return formState.history;
    try {
      const parsed = JSON.parse(localStorage.getItem(FIELD_HISTORY_STORAGE_KEY) || '{}');
      formState.history = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      formState.history = {};
    }
    return formState.history;
  }

  function captureFieldHistory() {
    const history = {};
    panel.querySelectorAll('[id^="oc-add-"]').forEach(control => {
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) return;
      if (control.id === 'oc-add-btn') return;
      history[control.id] = controlValue(control);
    });
    try {
      formState.history = history;
      saveFormState();
      localStorage.setItem(FIELD_HISTORY_STORAGE_KEY, JSON.stringify(history));
      if (history['oc-add-title']) localStorage.setItem(LAST_TITLE_STORAGE_KEY, String(history['oc-add-title']));
    } catch (_) {}
    return history;
  }

  function restorePreviousFieldValue(control) {
    const history = readFieldHistory();
    let previous = history[control.id];
    if (previous === undefined && control.id === 'oc-add-title') {
      try { previous = localStorage.getItem(LAST_TITLE_STORAGE_KEY) || ''; } catch (_) {}
    }
    if (previous === undefined || previous === null) return false;
    if (control.type === 'checkbox') control.checked = Boolean(previous);
    else control.value = String(previous);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    if (control instanceof HTMLInputElement && ['text', 'number', 'url', 'search'].includes(control.type)) {
      try { control.setSelectionRange(control.value.length, control.value.length); } catch (_) {}
    }
    return true;
  }

  panel.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(control => {
    control.addEventListener('keydown', event => {
      if (event.key !== 'ArrowDown' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!restorePreviousFieldValue(control)) return;
      event.preventDefault();
      event.stopPropagation();
    });
  });

  window.OC_ADD_FIELD_HISTORY = { capture: captureFieldHistory };

  const head = panel.querySelector('.oc-addbar-head');
  if (head) {
    const title = document.createElement('div');
    title.className = 'oc-section-label oc-addbar-compact-title';
    title.textContent = '+ ДОБАВИТЬ ТРЕК';
    head.replaceChildren(title);
  }

  const addButton = document.getElementById('oc-add-btn');
  if (addButton) addButton.textContent = 'Добавить';

  const hint = panel.querySelector('.oc-hint');
  if (hint) {
    hint.textContent = 'Студии/режиссёры/исполнители — через запятую. Если использовать «и», &, ×, • или другой разделитель, появится вариант исправления. Франшизы — по одной на строку.';
  }

  panel.classList.remove('oc-addbar-v2');
  panel.classList.add('oc-addbar-compact');
  panel.dataset.trackPanelUpgraded = 'compact';
})();
