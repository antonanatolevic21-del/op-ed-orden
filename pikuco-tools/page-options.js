(() => {
  'use strict';

  chrome.storage.local.get({ skipIntro: false, removeTextLimits: false }, (settings) => {
    if (chrome.runtime.lastError) return;

    function start() {
      const root = document.documentElement;
      if (settings.skipIntro) skipIntro(root);
      if (settings.removeTextLimits) removeTextLimits(root);
    }

    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  });

  function addedElements(records) {
    const elements = new Set();
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && node.isConnected) elements.add(node);
      }
    }
    return elements;
  }

  function topLevel(elements) {
    return [...elements].filter(element => {
      if (!element.isConnected) return false;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (elements.has(parent)) return false;
      }
      return true;
    });
  }

  function isVerificationText(text) {
    return /проверка\s*!?\s*для\s*продолжения\s*нажмите\s*на/i.test(text);
  }

  function fillsViewport(element) {
    const width = window.innerWidth * 0.9;
    const height = window.innerHeight * 0.9;
    if (element.offsetWidth >= width && element.offsetHeight >= height) return true;
    const box = element.getBoundingClientRect();
    return box.width >= width && box.height >= height;
  }

  function removeTextLimits(root) {
    const fieldSelector = 'input[maxlength], textarea[maxlength]';
    const pendingRoots = new Set();
    const pendingFields = new Set();
    let scheduled = false;

    function stripField(field) {
      if (field.matches(fieldSelector)) field.removeAttribute('maxlength');
    }

    function stripTree(element) {
      stripField(element);
      element.querySelectorAll(fieldSelector).forEach(stripField);
    }

    stripTree(root);

    new MutationObserver((records) => {
      for (const element of addedElements(records)) pendingRoots.add(element);
      for (const record of records) {
        if (record.type === 'attributes' && record.target.matches(fieldSelector)) {
          pendingFields.add(record.target);
        }
      }
      if (scheduled || (!pendingRoots.size && !pendingFields.size)) return;

      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        for (const element of topLevel(pendingRoots)) stripTree(element);
        for (const field of pendingFields) {
          if (field.isConnected) stripField(field);
        }
        pendingRoots.clear();
        pendingFields.clear();
      });
    }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['maxlength'] });

    // Also handle fields focused before the next animation frame.
    document.addEventListener('focusin', (event) => {
      if (event.target instanceof Element) stripField(event.target);
    });
  }

  function skipIntro(root) {
    const hiddenAttribute = 'data-pikuco-tools-intro-hidden';
    const introNames = /intro|splash|curtain|(?:^|[\s_-])wipe|preloader|(?:page|site|pikuco)[\s_-]*(?:loader|transition)/i;
    const logoNames = /logo|pikuco|пикуко/i;
    const loaderNames = /(?:^|[\s_-])(?:loader|loading|transition|stripe)(?:$|[\s_.-])/i;
    const protectedSelector = [
      'button', 'input', 'textarea', 'select', 'iframe', 'canvas', 'dialog', 'a[href]', '[onclick]',
      '.test-window__anticlicker',
      '[role="button"]', '[role="dialog"]', '[role="alertdialog"]', '[role="alert"]', '[aria-modal="true"]',
      '[contenteditable="true"]', '[class*="captcha" i]', '[id*="captcha" i]',
      '[class*="turnstile" i]', '[id*="turnstile" i]',
    ].join(', ');
    const coverHints = [
      '[style*="fixed" i]', '[class~="fixed"]', '[class*="overlay" i]', '[id*="overlay" i]',
      '[class*="fullscreen" i]', '[class*="full-screen" i]',
    ].join(', ');
    const markerSelector = selectorFor(['intro', 'splash', 'curtain', 'wipe', 'preloader',
      'loader', 'loading', 'transition', 'stripe', 'logo', 'pikuco', 'пикуко']) + ', use, image, ' + coverHints;
    const pending = new Set([root]);
    const hidden = new Map();
    const candidates = new WeakSet();
    const finishing = new WeakSet();
    const hiddenSelector = `[${hiddenAttribute}]`;
    let scheduled = false;

    function selectorFor(words) {
      return words.flatMap(word => [
        `[id*="${word}" i]`, `[class*="${word}" i]`,
        `img[src*="${word}" i]`, `img[alt*="${word}" i]`,
      ]).join(', ');
    }

    function signature(element) {
      const source = element.getAttribute('src') ??
        (element.matches('use, image')
          ? element.getAttribute('href') ?? element.getAttribute('xlink:href') ?? ''
          : '');
      const filename = source.split(/[?#]/, 1)[0].split('/').pop();
      const fragment = element.matches('use') ? source.split('#')[1] : '';
      return [element.id, element.getAttribute('class'), element.getAttribute('alt'), filename, fragment]
        .join(' ')
        .replace(/([a-z\d])([A-Z])/g, '$1-$2');
    }

    function isDecorativeIntro(cover) {
      if (cover.closest(protectedSelector) || cover.querySelector(protectedSelector)) return false;
      if (isVerificationText(cover.textContent)) return false;
      const markers = [cover, ...cover.querySelectorAll(markerSelector)].map(signature);
      const brandingOnly = /^(?:логотип\s*)?(?:pikuco|пикуко)?$/i.test(cover.textContent.trim());
      const hasLoader = markers.some(marker => loaderNames.test(marker));
      return markers.some(marker => introNames.test(marker)) ||
        (markers.some(marker => logoNames.test(marker)) && (brandingOnly || hasLoader)) ||
        (brandingOnly && hasLoader && cover.matches(coverHints));
    }

    function restore(cover) {
      if (hidden.has(cover)) {
        hidden.get(cover).disconnect();
        hidden.delete(cover);
        cover.removeAttribute(hiddenAttribute);
      }
    }

    function finishIntroAnimations(cover) {
      if (finishing.has(cover)) return;
      finishing.add(cover);
      requestAnimationFrame(() => {
        finishing.delete(cover);
        if (!hidden.has(cover) || !cover.isConnected || !isDecorativeIntro(cover)) return;

        for (const animation of cover.getAnimations({ subtree: true })) {
          if (animation.playState !== 'running' || animation.playbackRate <= 0 ||
              !Number.isFinite(animation.effect?.getComputedTiming().endTime)) continue;

          // Finish normally so the site can receive the browser's completion events.
          try {
            animation.finish();
          } catch (error) {
            if (error.name !== 'InvalidStateError') throw error;
          }
        }
      });
    }

    function hide(cover) {
      const observer = new MutationObserver(() => {
        if (!cover.isConnected || !isDecorativeIntro(cover)) restore(cover);
        else finishIntroAnimations(cover);
      });
      hidden.set(cover, observer);
      cover.setAttribute(hiddenAttribute, '');
      observer.observe(cover, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'id', 'role', 'aria-modal', 'src', 'alt', 'href', 'onclick', 'contenteditable'],
      });
      finishIntroAnimations(cover);
    }

    function inspect(marker, checked) {
      const name = signature(marker);
      if (!introNames.test(name) && !logoNames.test(name) && !marker.matches(coverHints)) return;

      let distance = 0;
      for (let cover = marker; cover && cover !== document.body && cover !== root; cover = cover.parentElement) {
        if (checked.has(cover) || hidden.has(cover)) return;
        checked.add(cover);
        if (distance++ < 4) candidates.add(cover);
        if (!(cover instanceof HTMLElement) || getComputedStyle(cover).position !== 'fixed') continue;

        // Layout dimensions still describe the viewport when the animation scales the cover.
        if (!fillsViewport(cover)) continue;

        if (isDecorativeIntro(cover)) hide(cover);
        return;
      }
    }

    function schedule() {
      if (scheduled || !pending.size) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const checked = new WeakSet();
        for (const element of topLevel(pending)) {
          for (const marker of element.querySelectorAll(markerSelector)) inspect(marker, checked);
          if (element.matches(markerSelector)) inspect(element, checked);
        }
        pending.clear();
      });
    }

    new MutationObserver((records) => {
      for (const cover of hidden.keys()) {
        if (!cover.isConnected) restore(cover);
      }
      for (const element of addedElements(records)) pending.add(element);
      for (const record of records) {
        if (record.type === 'attributes') queueChanged(record.target);
      }
      schedule();
    }).observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'id', 'hidden', 'src', 'alt', 'href'],
    });

    function queueChanged(element) {
      if (element !== root && element !== document.body && !hidden.has(element) &&
          (candidates.has(element) || element.matches(markerSelector))) {
        pending.add(element);
      }
    }

    function animationStarted(event) {
      if (!(event.target instanceof Element)) return;
      const cover = hidden.size ? event.target.closest(hiddenSelector) : null;
      if (cover && hidden.has(cover)) {
        finishIntroAnimations(cover);
        return;
      }
      queueChanged(event.target);
      schedule();
    }

    root.addEventListener('animationstart', animationStarted, true);
    root.addEventListener('transitionrun', animationStarted, true);
    schedule();
  }
})();
