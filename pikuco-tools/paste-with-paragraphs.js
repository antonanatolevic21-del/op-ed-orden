(() => {
  'use strict';

  let enabled;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pasteWithParagraphs) {
      enabled = changes.pasteWithParagraphs.newValue ?? true;
    }
  });

  chrome.storage.local.get({ pasteWithParagraphs: true }, (settings) => {
    if (!chrome.runtime.lastError) {
      enabled ??= settings.pasteWithParagraphs;
    }
  });

  // Capture paste before Editor.js can split the text into blocks.
  window.addEventListener('paste', (event) => {
    if (!enabled || !event.cancelable || event.defaultPrevented) return;

    const block = event.target instanceof Element
      ? event.target.closest('.codex-editor .ce-paragraph[contenteditable="true"]')
      : null;
    const clipboard = event.clipboardData;
    if (!block || !clipboard || clipboard.files.length) return;

    const text = clipboard.getData('text/plain').replace(/\r\n?/g, '\n');
    if (!text.includes('\n')) return;

    const selection = document.getSelection();
    if (!selection || selection.rangeCount !== 1) return;

    const range = selection.getRangeAt(0);
    if (!block.contains(range.startContainer) || !block.contains(range.endContainer)) return;

    const escaped = document.createElement('span');
    escaped.textContent = text;
    const html = escaped.innerHTML.replace(/\n/g, '<br>');

    // Native editing keeps the insertion in the browser's undo history.
    if (document.execCommand('insertHTML', false, html)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
