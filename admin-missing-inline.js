(() => {
  if (window.__OC_ADMIN_MISSING_INLINE_READY__) return;
  window.__OC_ADMIN_MISSING_INLINE_READY__ = true;

  const ADMIN_CLASS = 'oc-admin-missing-tools';
  const MARKER_SELECTOR = '.oc-missing-link';
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
  const ENTRY_DATA_KEYS = ['id', 'openingId', 'trackId', 'entryId', 'qualityTrack'];
  let hoveredFormHotkeyControl = null;
  let markerOpenPending = false;

  function isAdminUi() {
    const badge = document.querySelector('#oc-access-badge');
    return Boolean(
      badge &&
      badge.classList.contains('admin') &&
      String(badge.textContent || '').trim().toLocaleLowerCase('ru') === 'админ'
    );
  }

  function syncAdminClass() {
    const admin = isAdminUi();
    document.documentElement.classList.toggle(ADMIN_CLASS, admin);
    if (admin) enhanceMissingMarkers(document);
  }

  function editableControls(scope) {
    if (!scope) return [];
    return [...scope.querySelectorAll(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not(.oc-add-field-pin):not([disabled])'
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
    if (!editor) return false;

    editor.classList.add('oc-missing-editor-open');
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => editor.classList.remove('oc-missing-editor-open'), 1100);

    const control = firstMissingEditField(editor);
    if (!control) return true;
    control.focus({ preventScroll: true });
    if (control instanceof HTMLInputElement && ['text', 'number', 'url', 'search'].includes(control.type)) {
      try { control.select(); } catch (_) {}
    }
    return true;
  }

  function dataValue(element) {
    if (!(element instanceof HTMLElement)) return '';
    for (const key of ENTRY_DATA_KEYS) {
      const value = String(element.dataset?.[key] || '').trim();
      if (value) return value;
    }
    const edit = element.matches?.('[data-action="edit"][data-id]')
      ? element
      : element.querySelector?.('[data-action="edit"][data-id]');
    return String(edit?.dataset?.id || '').trim();
  }

  function markerEntryId(marker) {
    let node = marker;
    while (node && node !== document.documentElement) {
      const value = dataValue(node);
      if (value) return value;
      node = node.parentElement;
    }

    const href = marker.closest('a[href]')?.href || '';
    if (href) {
      try {
        const url = new URL(href, location.href);
        const value = url.searchParams.get('track') || url.searchParams.get('opening') || url.searchParams.get('id');
        if (value) return String(value);
      } catch (_) {}
    }

    const modal = marker.closest('#oc-opening-modal, .oc-opening-modal, .oc-modal');
    if (modal && !modal.classList.contains('hidden')) {
      try {
        const value = new URL(location.href).searchParams.get('track');
        if (value) return String(value);
      } catch (_) {}
    }
    return '';
  }

  function markerEntryTitle(marker) {
    const direct = String(
      marker.dataset?.openingTitle ||
      marker.dataset?.trackTitle ||
      marker.dataset?.title || ''
    ).trim();
    if (direct) return direct;

    const scope = marker.closest(
      '.oc-main-card, .oc-unified-card, .oc-profile-item, .oc-season-card, .oc-modal-card, article, li, tr'
    ) || marker.parentElement;
    const titleElement = scope?.querySelector?.(
      '[data-opening-title], [data-track-title], .oc-card-title, .oc-unified-title, .oc-opening-title, .oc-title-link, h2, h3, h4'
    );
    return String(
      titleElement?.dataset?.openingTitle ||
      titleElement?.dataset?.trackTitle ||
      titleElement?.textContent || ''
    ).replace(/😡/g, '').trim();
  }

  function mainRowById(id) {
    if (!id) return null;
    return [...document.querySelectorAll('#oc-list-container .oc-main-card')]
      .find(row => String(row.dataset.id || '') === String(id));
  }

  function mainRowByTitle(title) {
    const target = String(title || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
    if (!target) return null;
    return [...document.querySelectorAll('#oc-list-container .oc-main-card')].find(row => {
      const shown = String(row.querySelector('.oc-card-title, .oc-title-link, h2, h3, h4')?.textContent || '')
        .trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
      return shown === target || shown.includes(target) || target.includes(shown);
    }) || null;
  }

  function openRowEditor(row, id) {
    const editButton = row?.querySelector('[data-action="edit"]');
    if (!(editButton instanceof HTMLElement)) return false;
    const resolvedId = String(id || row.dataset.id || editButton.dataset.id || '').trim();
    editButton.click();
    requestAnimationFrame(() => requestAnimationFrame(() => focusInlineEditor(resolvedId)));
    return true;
  }

  function dispatchFilterChange(control) {
    if (!control) return;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function prepareMainList(title) {
    document.querySelector('.oc-tab-btn[data-tab="chart"]')?.click();

    const search = document.querySelector('#oc-f-search');
    if (search && title) {
      search.value = title;
      dispatchFilterChange(search);
    }
  }

  function waitForMainRow(id, title, attempts = 24) {
    return new Promise(resolve => {
      const check = left => {
        const row = mainRowById(id) || mainRowByTitle(title);
        if (row || left <= 0) {
          resolve(row || null);
          return;
        }
        window.setTimeout(() => check(left - 1), 45);
      };
      check(attempts);
    });
  }

  async function openInlineEditor(marker) {
    if (!isAdminUi() || markerOpenPending) return;

    const directRow = marker.closest('#oc-list-container .oc-main-card');
    const directId = String(directRow?.dataset.id || '').trim();
    if (directRow && openRowEditor(directRow, directId)) return;

    markerOpenPending = true;
    try {
      const id = markerEntryId(marker);
      const title = markerEntryTitle(marker);

      const localEdit = marker.closest('[data-id], [data-opening-id], [data-track-id], article, li, tr')
        ?.querySelector?.('[data-action="edit"]');
      if (localEdit instanceof HTMLElement) {
        localEdit.click();
        requestAnimationFrame(() => requestAnimationFrame(() => focusInlineEditor(id)));
        return;
      }

      prepareMainList(title);
      let row = await waitForMainRow(id, title, 10);

      if (!row) {
        document.querySelector('#oc-reset-filters')?.click();
        if (title) {
          const search = document.querySelector('#oc-f-search');
          if (search) {
            search.value = title;
            dispatchFilterChange(search);
          }
        }
        row = await waitForMainRow(id, title, 18);
      }

      if (row) openRowEditor(row, id || row.dataset.id);
    } finally {
      markerOpenPending = false;
    }
  }

  function enhanceMarker(marker) {
    if (!(marker instanceof HTMLElement)) return;
    marker.classList.add('oc-missing-edit-trigger');
    marker.setAttribute('role', 'button');
    marker.setAttribute('tabindex', '0');
    marker.setAttribute('aria-label', marker.title
      ? `Редактировать незаполненные поля. ${marker.title}`
      : 'Редактировать незаполненные поля');
  }

  function enhanceMissingMarkers(root) {
    if (!(root instanceof Element || root instanceof Document)) return;
    if (root instanceof Element && root.matches(MARKER_SELECTOR)) enhanceMarker(root);
    root.querySelectorAll?.(MARKER_SELECTOR).forEach(enhanceMarker);
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

  const root = document.querySelector('#opedchart-root') || document.documentElement;
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) enhanceMissingMarkers(node);
    }));
    syncAdminClass();
  }).observe(root, { childList: true, subtree: true });

  document.addEventListener('click', event => {
    const marker = event.target instanceof Element ? event.target.closest(MARKER_SELECTOR) : null;
    if (!marker || !isAdminUi()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void openInlineEditor(marker);
  }, true);

  document.addEventListener('keydown', event => {
    const marker = event.target instanceof Element ? event.target.closest(MARKER_SELECTOR) : null;
    if (marker && isAdminUi() && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void openInlineEditor(marker);
      return;
    }
    handleFieldChoiceHotkeys(event);
    handleFormArrowNavigation(event);
  }, true);

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

  syncAdminClass();
})();
