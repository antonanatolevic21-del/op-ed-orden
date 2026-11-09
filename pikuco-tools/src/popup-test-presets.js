(() => {
  'use strict';

  const container = document.querySelector('#test-presets');
  const common = document.querySelector('#common-test-presets');
  const status = document.querySelector('#test-presets-status');
  const legacy = document.querySelector('#test-presets-legacy');

  chrome.storage.local.get(testPresetDefaults(), (settings) => {
    if (chrome.runtime.lastError) {
      status.textContent = 'Не удалось загрузить автонастройки.';
      return;
    }

    function usesLegacy(id) {
      return settings[testPresetKey('common', id)] === null &&
        testPresetFormats.some(format => settings[testPresetKey(format.id, id)] === true);
    }

    function updateLegacy() {
      legacy.hidden = !commonTestPresetOptions.some(usesLegacy);
    }

    function renderOption(parent, format, id, afterSave) {
      const option = testPresetOptions[id];
      const key = testPresetKey(format, id);
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = settings[key] === true;
      input.indeterminate = format === 'common' && usesLegacy(id);
      label.append(option.action ?? option.text, input);
      parent.append(label);

      input.addEventListener('change', () => {
        const enabled = input.checked;
        input.disabled = true;
        status.textContent = '';
        chrome.storage.local.set({ [key]: enabled }, () => {
          if (chrome.runtime.lastError) {
            input.checked = settings[key] === true;
            input.indeterminate = format === 'common' && usesLegacy(id);
            status.textContent = 'Не удалось сохранить автонастройку.';
          } else {
            settings[key] = enabled;
          }
          input.disabled = false;
          afterSave();
        });
      });
      return input;
    }

    for (const id of commonTestPresetOptions) renderOption(common, 'common', id, updateLegacy);
    updateLegacy();

    for (const format of testPresetFormats) {
      const group = document.createElement('details');
      const summary = document.createElement('summary');
      const count = document.createElement('span');
      count.className = 'count';
      summary.append(format.name, count);
      group.append(summary);

      const inputs = format.options.map(id => renderOption(group, format.id, id, updateCount));

      function updateCount() {
        count.textContent = inputs.filter(input => input.checked).length + '/' + inputs.length;
      }

      updateCount();
      container.append(group);
    }
  });
})();
