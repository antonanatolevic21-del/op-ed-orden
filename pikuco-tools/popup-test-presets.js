(() => {
  'use strict';

  const container = document.querySelector('#test-presets');
  const status = document.querySelector('#test-presets-status');

  chrome.storage.local.get(testPresetDefaults(), (settings) => {
    if (chrome.runtime.lastError) {
      status.textContent = 'Не удалось загрузить автонастройки.';
      return;
    }

    for (const format of testPresetFormats) {
      const group = document.createElement('details');
      const summary = document.createElement('summary');
      const count = document.createElement('span');
      count.className = 'count';
      summary.append(format.name, count);
      group.append(summary);

      const inputs = [];
      for (const id of format.options) {
        const option = testPresetOptions[id];
        const key = testPresetKey(format.id, id);
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = settings[key] === true;
        inputs.push(input);
        label.append(option.action ?? option.text, input);
        group.append(label);

        input.addEventListener('change', () => {
          const enabled = input.checked;
          input.disabled = true;
          status.textContent = '';
          chrome.storage.local.set({ [key]: enabled }, () => {
            if (chrome.runtime.lastError) {
              input.checked = !enabled;
              status.textContent = 'Не удалось сохранить автонастройку.';
            }
            input.disabled = false;
            updateCount();
          });
        });
      }

      function updateCount() {
        count.textContent = inputs.filter(input => input.checked).length + '/' + inputs.length;
      }

      updateCount();
      container.append(group);
    }
  });
})();
