(() => {
  if (window.__OC_ADMIN_MISSING_INLINE_READY__) return;
  window.__OC_ADMIN_MISSING_INLINE_READY__ = true;

  const ADMIN_CLASS = 'oc-admin-missing-tools';
  const REQUIRED_EDIT_FIELDS = [
    '.oc-e-title',
    '.oc-e-year',
    '.oc-e-season',
    '.oc-e-studio',
    '.oc-e-director',
    '.oc-e-performer',
    '.oc-e-franchise',
    '.oc-e-image',
    '.oc-e-link'
  ];
  const FORM_HOTKEY_SELECTOR = [
    '#oc-add-type',
    '.oc-e-type',
    '#oc-add-season',
    '.oc-e-season',
    '.oc-addbar input[type="checkbox"]',
    '.oc-editcard input[type="checkbox"]'
  ].join(', ');
  let hoveredFormHotkeyControl = null;

  function isAdminUi() {
    const badge = document.querySelector('#oc-access-badge');
    return Boolean(
      badge &&
      badge.classList.contains('admin') &&
      String(badge.textContent || '').trim().toLocaleLowerCase('ru') === 'админ'
    );
  }

  function syncAdminClass() {
    document.documentElement.classList.toggle(ADMIN_CLASS, isAdminUi());
    if (isAdminUi()) enhanceMainMissingMarkers();
  }

  function editableControls(scope) {
    if (!scope) return [];
    return [...scope.querySelectorAll(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    )].filter(control => {
      if (!(control instanceof HTMLElement)) return false;
      if (control.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(control);
      return style.display !== 'none' && style.visibility !== 'hidden' && control.getClientRects().length > 0;
    });
  }

  function firstMissingEditField(editor) {
    for (const selector of REQUIRED_EDIT_FIELDS) {
      const control = editor.querySelector(selector);
      if (!control) continue;
      const value = String(control.value || '').trim();
      if (!value) return control;
    }
    return editor.querySelector('input, select, textarea, button');
  }

  function focusInlineEditor(id) {
    const editor = [...document.querySelectorAll('#oc-list-container .oc-editcard')]
      .find(card => String(card.dataset.id || '') === String(id || ''));
    if (!editor) return;

    editor.classList.add('oc-missing-editor-open');
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => editor.classList.remove('oc-missing-editor-open'), 1100);

    const control = firstMissingEditField(editor);
    if (!control) return;
    control.focus({ preventScroll: true });
    if (control instanceof HTMLInputElement && ['text', 'number', 'url', 'search'].includes(control.type)) {
      try { control.select(); } catch (_) {}
    }
  }

  function openInlineEditor(marker) {
    if (!isAdminUi()) return;
    const row = marker.closest('#oc-list-container .oc-main-card');
    const id = row?.dataset.id || '';
    const editButton = row?.querySelector('[data-action="edit"]');
    if (!row || !id || !(editButton instanceof HTMLElement)) return;

    editButton.click();
    requestAnimationFrame(() => requestAnimationFrame(() => focusInlineEditor(id)));
  }

  function bindMarker(marker) {
    if (!(marker instanceof HTMLElement) || marker.dataset.ocMissingInlineBound === '1') return;
    marker.dataset.ocMissingInlineBound = '1';
    marker.classList.add('oc-missing-edit-trigger');
    marker.setAttribute('role', 'button');
    marker.setAttribute('tabindex', '0');
    marker.setAttribute('aria-label', marker.title
      ? `Редактировать незаполненные поля. ${marker.title}`
      : 'Редактировать незаполненные поля');

    marker.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openInlineEditor(marker);
    });
    marker.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      openInlineEditor(marker);
    });
  }

  function enhanceMainMissingMarkers() {
    document.querySelectorAll('#oc-list-container .oc-main-card .oc-missing-link').forEach(bindMarker);
  }

  function dispatchFormControlChange(control) {
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function resolveFormHotkeyControl(event) {
    const focused = event.target instanceof HTMLElement && event.target.matches(FORM_HOTKEY_SELECTOR)
      ? event.target
      : null;
    if (focused) return focused;
    if (hoveredFormHotkeyControl?.isConnected && hoveredFormHotkeyControl.matches(FORM_HOTKEY_SELECTOR)) {
      return hoveredFormHotkeyControl;
    }
    return null;
  }

  function handleFieldChoiceHotkeys(event) {
    if (!isAdminUi() || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const control = resolveFormHotkeyControl(event);
    if (!(control instanceof HTMLElement)) return;
    if (!control.closest('.oc-addbar, .oc-editcard')) return;

    if (control.matches('#oc-add-type, .oc-e-type') && (event.key === '1' || event.key === '2')) {
      event.preventDefault();
      event.stopPropagation();
      control.value = event.key === '1' ? 'OP' : 'ED';
      dispatchFormControlChange(control);
      return;
    }

    if (control.matches('#oc-add-season, .oc-e-season') && ['1', '2', '3', '4'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      control.value = { '1': 'winter', '2': 'spring', '3': 'summer', '4': 'fall' }[event.key];
      dispatchFormControlChange(control);
      return;
    }

    if (control.matches('input[type="checkbox"]') && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      control.checked = !control.checked;
      dispatchFormControlChange(control);
    }
  }

  function handleFormArrowNavigation(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !isAdminUi()) return;
    if (!(event.target instanceof HTMLElement)) return;

    const scope = event.target.closest('.oc-addbar, .oc-editcard');
    if (!scope) return;

    const controls = editableControls(scope);
    const currentIndex = controls.indexOf(event.target);
    if (currentIndex < 0) return;

    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = controls[currentIndex + delta];
    if (!next) return;

    event.preventDefault();
    event.stopPropagation();
    next.focus({ preventScroll: true });
    next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

    if (next instanceof HTMLInputElement && ['text', 'number', 'url', 'search'].includes(next.type)) {
      try { next.select(); } catch (_) {}
    }
  }

  const badge = document.querySelector('#oc-access-badge');
  if (badge) {
    new MutationObserver(syncAdminClass).observe(badge, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  const list = document.querySelector('#oc-list-container');
  if (list) {
    new MutationObserver(() => {
      syncAdminClass();
      if (isAdminUi()) enhanceMainMissingMarkers();
    }).observe(list, { childList: true, subtree: true });
  }

  document.addEventListener('pointerover', event => {
    const control = event.target instanceof Element ? event.target.closest(FORM_HOTKEY_SELECTOR) : null;
    hoveredFormHotkeyControl = control && control.closest('.oc-addbar, .oc-editcard') ? control : null;
  }, true);
  document.addEventListener('pointerout', event => {
    if (!hoveredFormHotkeyControl) return;
    const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest(FORM_HOTKEY_SELECTOR) : null;
    if (next === hoveredFormHotkeyControl) return;
    hoveredFormHotkeyControl = null;
  }, true);
  document.addEventListener('keydown', handleFieldChoiceHotkeys, true);
  document.addEventListener('keydown', handleFormArrowNavigation, true);
  syncAdminClass();
})();
