(() => {
  'use strict';

  let enabled;
  let stop;
  function setEnabled(value) {
    enabled = value;
    if (enabled && !stop && document.body) stop = install();
    if (!enabled && stop) {
      stop();
      stop = undefined;
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.viewUnfinishedTestCard) {
      setEnabled(changes.viewUnfinishedTestCard.newValue ?? true);
    }
  });
  chrome.storage.local.get({ viewUnfinishedTestCard: true }, (settings) => {
    if (!chrome.runtime.lastError && enabled === undefined) setEnabled(settings.viewUnfinishedTestCard);
  });

  function install() {
    const body = document.body;
    const root = document.documentElement;
    const hidden = 'data-pikuco-tools-resume-hidden';
    const titlePattern = /^не(?:оконченное|законченное|завершенное) прохождение$/;
    const dialogSelector = 'dialog, [role="dialog"], [aria-modal="true"]';
    const modalHint = '[class*="modal" i], [class*="popup" i], [id*="modal" i], [id*="popup" i]';
    const backdropSelector = [
      '[class*="backdrop" i]', '[class*="modal-overlay" i]', '[class*="modal__overlay" i]',
      '[class*="modal-mask" i]', '[class*="modal__mask" i]', '[class*="popup-overlay" i]',
      '[class*="modal-background" i]', '[class*="modal__background" i]',
    ].join(', ');
    const titles = new Set();
    const resetPrompts = new Set();
    const pending = new Set([body]);
    const installed = new Map();
    const boundTitles = new WeakMap();
    let collapsed;
    let scheduled = false;
    let running = true;

    function normalize(text) {
      return text.toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();
    }

    function isResetPrompt(text) {
      return /^вы действительно хотите сбросить (?:весь )?прогресс прохождения/.test(text);
    }

    function isVisible(element) {
      return element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible' &&
        !element.closest('[hidden], [aria-hidden="true"], [inert]');
    }

    function isPanelContent(element, panel, allowHidden) {
      if (!allowHidden) return isVisible(element);

      // A collapsed outer layer has no layout. Its inactive inner views still need to be excluded.
      for (let part = element; part && part !== panel; part = part.parentElement) {
        if (part.matches('[hidden], [aria-hidden="true"], [inert]') || getComputedStyle(part).display === 'none') return false;
      }
      return true;
    }

    function collectTitles(node) {
      function inspect(text) {
        const words = normalize(text.nodeValue);
        if (words && (words.startsWith('вы действительно хотите') || 'вы действительно хотите'.startsWith(words))) {
          for (let element = text.parentElement, depth = 0; element && depth < 3; element = element.parentElement, depth++) {
            if (!isResetPrompt(normalize(element.textContent))) continue;
            resetPrompts.add(element);
            return;
          }
        }
        if (!words.startsWith('неоконченное') && !words.startsWith('незаконченное') &&
            !words.startsWith('незавершенное')) return;

        for (let element = text.parentElement, depth = 0; element && depth < 3; element = element.parentElement, depth++) {
          if (!titlePattern.test(normalize(element.textContent))) continue;
          if (!element.closest('script, style, textarea, [contenteditable="true"]')) titles.add(element);
          break;
        }
      }

      if (node.nodeType === Node.TEXT_NODE) {
        inspect(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        for (let text = walker.nextNode(); text; text = walker.nextNode()) inspect(text);
      }
    }

    function hasResumeActions(panel, allowHidden) {
      let resume;
      let restart;
      const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = normalize(node.nodeValue);
        if (!text) continue;
        const resetLabel = text === 'предупреждение' || isResetPrompt(text);
        const resumeLabel = text === 'возобновить';
        const restartLabel = 'начать заново'.startsWith(text) && (
          text === 'начать заново' || normalize(node.parentElement.parentElement?.textContent ?? '') === 'начать заново'
        );
        if ((!resetLabel && !resumeLabel && !restartLabel) || !isPanelContent(node.parentElement, panel, allowHidden)) continue;
        if (resetLabel) return false;
        if (resumeLabel) resume = true;
        if (restartLabel) restart = true;
      }
      return Boolean(resume && restart);
    }

    function findPanel(title, allowHidden) {
      if (!titlePattern.test(normalize(title.textContent)) || (!allowHidden && !isVisible(title))) return null;
      const dialog = title.closest(dialogSelector);
      for (let panel = title.parentElement, depth = 0; panel && panel !== body && depth < 7;
          panel = panel.parentElement, depth++) {
        if (hasResumeActions(panel, allowHidden)) return panel;
        if (panel === dialog) break;
      }
      return null;
    }

    function resetIsShowing() {
      let showing = false;
      for (const prompt of resetPrompts) {
        if (!prompt.isConnected || !isResetPrompt(normalize(prompt.textContent))) resetPrompts.delete(prompt);
        else if (isVisible(prompt) && isModalPanel(prompt)) showing = true;
      }
      return showing;
    }

    function coversViewport(element) {
      const { position } = getComputedStyle(element);
      if (position !== 'fixed' && position !== 'absolute') return false;
      const box = element.getBoundingClientRect();
      return box.width >= window.innerWidth * 0.9 && box.height >= window.innerHeight * 0.9;
    }

    function isBackdrop(element) {
      return !element.textContent.trim() && coversViewport(element) &&
        !element.querySelector('button, a[href], input, iframe, video, canvas, main, article, [role="dialog"]');
    }

    function isDecoration(element) {
      return isBackdrop(element) ||
        element.matches('[class*="modal-close" i], [class*="modal__close" i]') ||
        (element.matches('[aria-hidden="true"]') && !element.children.length && !element.textContent.trim());
    }

    function isModalPanel(panel) {
      for (let element = panel; element && element !== body; element = element.parentElement) {
        if (element.matches(dialogSelector) || element.matches(modalHint) ||
            getComputedStyle(element).position === 'fixed') return true;
      }
      return false;
    }

    function getLayers(panel) {
      let layer = panel.closest(dialogSelector) ?? panel;
      if (layer.matches('dialog:modal')) return [];

      for (let branch = layer; branch.parentElement && branch.parentElement !== body; branch = branch.parentElement) {
        const parent = branch.parentElement;
        const siblings = [...parent.children].filter(node => node !== branch && node.getClientRects().length);
        if (siblings.some(node => !isDecoration(node))) break;
        if (coversViewport(parent)) {
          layer = parent;
          break;
        }
        if (parent.matches(modalHint) || getComputedStyle(parent).position === 'fixed') layer = parent;
      }

      if (coversViewport(layer)) return [layer];
      const backdrops = [layer.previousElementSibling, layer.nextElementSibling]
        .filter(element => element && element.matches(backdropSelector) && isBackdrop(element));
      return backdrops.length === 1 ? [layer, backdrops[0]] : [layer];
    }

    function holdStyles(element, overrides) {
      const saved = new Map();
      const { style } = element;
      const matches = (name, value) =>
        style.getPropertyValue(name) === value && style.getPropertyPriority(name) === 'important';

      function apply() {
        for (const [name, value] of Object.entries(overrides)) {
          if (matches(name, value)) continue;
          saved.set(name, [style.getPropertyValue(name), style.getPropertyPriority(name)]);
          style.setProperty(name, value, 'important');
        }
      }

      apply();
      const observer = new MutationObserver(apply);
      observer.observe(element, { attributes: true, attributeFilter: ['style'] });

      return () => {
        observer.disconnect();
        for (const [name, [value, priority]] of saved) {
          if (!matches(name, overrides[name])) continue;
          if (value) style.setProperty(name, value, priority);
          else style.removeProperty(name);
        }
      };
    }

    function hideLayer(layer) {
      layer.setAttribute(hidden, '');
      const undo = holdStyles(layer, { display: 'none' });
      return () => {
        undo();
        layer.removeAttribute(hidden);
      };
    }

    function viewportHits() {
      const points = [[0.5, 0.5], [0.16, 0.2], [0.84, 0.2], [0.16, 0.8], [0.84, 0.8]];
      return points.map(([x, y]) => document.elementFromPoint(
        Math.round(window.innerWidth * x), Math.round(window.innerHeight * y)));
    }

    function hasShade(style) {
      const tinted = style.backgroundColor && style.backgroundColor !== 'transparent' &&
        !/^rgba\([^)]*,\s*0\)$/.test(style.backgroundColor);
      return tinted || (style.backgroundImage && style.backgroundImage !== 'none') ||
        (style.backdropFilter && style.backdropFilter !== 'none');
    }

    function exposeCard(state) {
      const otherDialog = [...body.querySelectorAll(dialogSelector)].some(element =>
        !state.layers.some(layer => layer.contains(element)) && element.getClientRects().length &&
        getComputedStyle(element).visibility === 'visible');
      if (otherDialog) return;

      function hideBackdrop(element) {
        if (state.pageUndo.has(element) || state.layers.some(layer => layer.contains(element))) return;
        state.pageUndo.set(element, hideLayer(element));
      }

      for (const element of body.querySelectorAll(backdropSelector)) {
        if (isBackdrop(element)) hideBackdrop(element);
      }

      // A framework can mount an unlabelled backdrop in a separate portal.
      const hitCounts = new Map();
      for (const target of viewportHits()) {
        for (let element = target; element && element !== body && element !== root; element = element.parentElement) {
          hitCounts.set(element, (hitCounts.get(element) ?? 0) + 1);
        }
      }
      for (const [element, count] of hitCounts) {
        if (count >= 2 && isBackdrop(element) &&
            (!element.children.length || hasShade(getComputedStyle(element)))) hideBackdrop(element);
      }

      const hits = viewportHits();
      const scrollHosts = new Set([root, body, document.scrollingElement]);
      const pseudoHosts = new Set([root, body, ...hits]);
      for (const target of hits) {
        for (let element = target; element && element !== body && element !== root; element = element.parentElement) {
          if (element.clientHeight >= window.innerHeight * 0.65) scrollHosts.add(element);
        }
      }

      for (const host of pseudoHosts) {
        if (!host) continue;
        for (const side of ['before', 'after']) {
          const style = getComputedStyle(host, `::${side}`);
          const fullSize = parseFloat(style.width) >= window.innerWidth * 0.9 &&
            parseFloat(style.height) >= window.innerHeight * 0.9;
          const zIndex = parseFloat(style.zIndex);
          if (style.position !== 'fixed' || style.visibility === 'hidden' || style.display === 'none' ||
              !style.content || ['none', 'normal'].includes(style.content) ||
              !fullSize || !hasShade(style) || zIndex < 0 ||
              (!Number.isFinite(zIndex) && style.pointerEvents === 'none')) continue;
          const attribute = `data-pikuco-tools-resume-shade-${side}`;
          if (host.hasAttribute(attribute)) continue;
          host.setAttribute(attribute, '');
          state.pseudoUndo.push(() => host.removeAttribute(attribute));
        }
      }

      for (const host of scrollHosts) {
        if (!host || state.pageUndo.has(host)) continue;
        const style = getComputedStyle(host);
        const pageRoot = host === root || host === body || host === document.scrollingElement;
        const overrides = {};
        if (['hidden', 'clip'].includes(style.overflowY) && (pageRoot || host.scrollHeight > host.clientHeight + 1)) {
          overrides['overflow-y'] = 'auto';
        }
        if (style.touchAction === 'none') overrides['touch-action'] = 'auto';
        if (pageRoot && style.pointerEvents === 'none') overrides['pointer-events'] = 'auto';

        const scrollOffset = host === body && style.position === 'fixed' ? -parseFloat(style.top) : 0;
        if (host === body && style.position === 'fixed' && (overrides['overflow-y'] ||
            (scrollOffset >= 0 && (scrollOffset > 0 || body.scrollHeight > window.innerHeight)))) {
          overrides.position = 'static';
        }
        if (!Object.keys(overrides).length) continue;
        state.pageUndo.set(host, holdStyles(host, overrides));
        if (scrollOffset > 0) window.scrollTo({ top: scrollOffset, behavior: 'instant' });
      }
    }

    function restore(focus) {
      if (!collapsed) return;
      const { undo, pageUndo, pseudoUndo, reopen, trigger } = collapsed;
      collapsed = undefined;
      for (const restorePage of pageUndo.values()) restorePage();
      for (const restorePseudo of pseudoUndo) restorePseudo();
      for (const restoreLayer of undo) restoreLayer();
      reopen.remove();
      if (focus && trigger.isConnected) trigger.focus({ preventScroll: true });
    }

    function collapse(panel, trigger) {
      const layers = getLayers(panel);
      if (!layers.length) return;

      restore(false);
      const reopen = document.createElement('button');
      reopen.type = 'button';
      reopen.className = 'pikuco-tools-resume-reopen';
      reopen.textContent = 'Вернуть окно прохождения';
      reopen.addEventListener('click', (event) => {
        event.stopPropagation();
        restore(true);
      });
      collapsed = {
        panel, layers, trigger, reopen, undo: layers.map(hideLayer), pageUndo: new Map(),
        pseudoUndo: [], route: location.pathname + location.search,
      };
      exposeCard(collapsed);
      body.append(reopen);
      reopen.focus({ preventScroll: true });
    }

    function enhance() {
      scheduled = false;
      if (!running) return;
      if (collapsed && collapsed.route !== location.pathname + location.search) restore(false);

      const contentAdded = pending.size > 0;
      for (const node of pending) {
        if (node.isConnected && !pending.has(node.parentElement)) collectTitles(node);
      }
      pending.clear();

      const resetting = resetIsShowing();
      for (const [panel, { title, trigger }] of installed) {
        const allowHidden = collapsed?.layers.some(layer => layer.contains(panel));
        if (trigger.isConnected && !resetting && panel.contains(title) &&
            titlePattern.test(normalize(title.textContent)) && isPanelContent(title, panel, allowHidden) &&
            hasResumeActions(panel, allowHidden)) continue;

        trigger.remove();
        installed.delete(panel);
      }

      for (const title of titles) {
        if (!title.isConnected || !titlePattern.test(normalize(title.textContent))) {
          titles.delete(title);
          continue;
        }
        if (resetting) continue;
        let trigger = boundTitles.get(title);
        let panel = trigger?.parentElement;
        if (!trigger?.isConnected) {
          const allowHidden = collapsed?.layers.some(layer => layer.contains(title));
          panel = findPanel(title, allowHidden);
          if (!panel || !isModalPanel(panel) || panel.closest('dialog:modal')) continue;
          trigger = installed.get(panel)?.trigger;
          if (!trigger?.isConnected) {
            trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'pikuco-tools-resume-view-card';
            trigger.textContent = 'Посмотреть карточку';
            const button = trigger;
            trigger.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopImmediatePropagation();
              if (!resetIsShowing() && titlePattern.test(normalize(title.textContent)) &&
                  panel.contains(title) && isVisible(title) && hasResumeActions(panel, false)) collapse(panel, button);
            });
            installed.set(panel, { title, trigger });
            panel.append(trigger);
          }
          boundTitles.set(title, trigger);
        }

        if (collapsed && !collapsed.trigger.isConnected) {
          if (!collapsed.layers.some(layer => layer.contains(panel))) {
            if (!title.getClientRects().length) continue;
            const layers = getLayers(panel);
            if (!layers.length) continue;
            for (const restoreLayer of collapsed.undo) restoreLayer();
            collapsed.layers = layers;
            collapsed.undo = layers.map(hideLayer);
          }
          collapsed.panel = panel;
          collapsed.trigger = trigger;
        }
      }
      if (collapsed && (!collapsed.panel.isConnected || !collapsed.trigger.isConnected)) restore(false);
      if (collapsed && contentAdded) exposeCard(collapsed);
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(enhance);
    }

    const observer = new MutationObserver((records) => {
      let visibilityChanged = false;
      const watched = [...titles, ...resetPrompts, ...installed.keys()];
      for (const record of records) {
        if (record.type === 'attributes') {
          if (!visibilityChanged) visibilityChanged = watched.some(element =>
            record.target.contains(element) || element.contains(record.target));
          continue;
        }
        if (record.type === 'characterData') pending.add(record.target);
        for (const node of record.addedNodes) pending.add(node);
        if (record.removedNodes?.length && (installed.size || resetPrompts.size)) visibilityChanged = true;
      }
      if (pending.size || collapsed || visibilityChanged) schedule();
    });
    observer.observe(body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden', 'inert', 'class', 'style'],
    });
    const onNavigate = () => restore(false);
    window.addEventListener('popstate', onNavigate);
    schedule();
    return () => {
      running = false;
      observer.disconnect();
      window.removeEventListener('popstate', onNavigate);
      restore(false);
      for (const { trigger } of installed.values()) trigger.remove();
    };
  }
})();
