(() => {
  const panel = document.querySelector('.oc-addbar');
  if (!panel) return;

  const PIN_STORAGE_KEY = 'op-ed-add-field-pins-v1';
  const LAST_TITLE_STORAGE_KEY = 'op-ed-last-added-title-v1';
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
  let pinState = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) || '{}');
    if (parsed && typeof parsed === 'object') pinState = parsed;
  } catch (_) {}
  uniqueFieldIds.forEach(id => delete pinState[id]);
  try { localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinState)); } catch (_) {}

  function controlValue(control) {
    return control.type === 'checkbox' ? Boolean(control.checked) : String(control.value || '');
  }

  function savePinState() {
    try { localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinState)); } catch (_) {}
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
  });

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

  const titleInput = document.getElementById('oc-add-title');
  titleInput?.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    let previousTitle = '';
    try { previousTitle = String(localStorage.getItem(LAST_TITLE_STORAGE_KEY) || ''); } catch (_) {}
    if (!previousTitle) return;
    event.preventDefault();
    titleInput.value = previousTitle;
    titleInput.setSelectionRange(previousTitle.length, previousTitle.length);
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
  });

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
    hint.textContent = 'Студии/режиссёры/исполнители — через запятую. Франшизы — по одной на строку, чтобы названия с запятой не дробились.';
  }

  panel.classList.remove('oc-addbar-v2');
  panel.classList.add('oc-addbar-compact');
  panel.dataset.trackPanelUpgraded = 'compact';
})();
