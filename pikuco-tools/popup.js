'use strict';

const toggles = [...document.querySelectorAll('input[data-setting]')];
const statusMessage = document.querySelector('#status');
const defaultSettings = Object.fromEntries(toggles.map(input => [input.dataset.setting, input.defaultChecked]));

chrome.storage.local.get(defaultSettings, (settings) => {
  if (chrome.runtime.lastError) {
    statusMessage.textContent = 'Не удалось загрузить настройки.';
    return;
  }

  for (const input of toggles) {
    input.checked = settings[input.dataset.setting];
    input.disabled = false;
  }
});

for (const input of toggles) {
  input.addEventListener('change', () => {
    const enabled = input.checked;
    input.disabled = true;
    statusMessage.textContent = '';

    chrome.storage.local.set({ [input.dataset.setting]: enabled }, () => {
      if (chrome.runtime.lastError) {
        input.checked = !enabled;
        statusMessage.textContent = 'Не удалось сохранить настройку.';
      }

      input.disabled = false;
    });
  });
}
