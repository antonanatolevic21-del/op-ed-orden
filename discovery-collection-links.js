(() => {
  if (window.__OC_DISCOVERY_COLLECTION_LINKS_READY__) return;
  window.__OC_DISCOVERY_COLLECTION_LINKS_READY__ = true;

  const panel = document.querySelector('#oc-discovery-panel');
  if (!panel) return;

  const normalize = value => String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
  let applying = false;
  let applyTimer = 0;
  let applyAttempt = 0;

  function currentUrl() {
    return new URL(window.location.href);
  }

  function collectionRoute() {
    const url = currentUrl();
    const id = String(url.searchParams.get('collection') || '').trim();
    if (url.searchParams.get('view') !== 'discovery' || !id) return null;
    return {
      id,
      owner: String(url.searchParams.get('owner') || '').trim()
    };
  }

  function collectionHref(owner, id) {
    const url = currentUrl();
    url.search = '';
    url.hash = '';
    url.searchParams.set('view', 'discovery');
    if (owner) url.searchParams.set('owner', String(owner));
    url.searchParams.set('collection', String(id));
    return `${url.pathname}${url.search}`;
  }

  function writeCollectionUrl(owner, id) {
    const href = collectionHref(owner, id);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === href) return;
    window.history.pushState({ ...(window.history.state || {}), ocCollectionDetail: true }, '', href);
  }

  function clearCollectionUrl(replace = true) {
    const url = currentUrl();
    if (!url.searchParams.has('collection') && !url.searchParams.has('owner')) return;
    url.searchParams.delete('collection');
    url.searchParams.delete('owner');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', next);
  }

  function selectedOwner() {
    return String(panel.querySelector('#oc-collection-owner')?.value || collectionRoute()?.owner || '').trim();
  }

  function copyAttributes(source, target) {
    [...source.attributes].forEach(attribute => {
      if (attribute.name === 'type') return;
      target.setAttribute(attribute.name, attribute.value);
    });
  }

  function upgradeCollectionLinks(root = panel) {
    const owner = selectedOwner();
    root.querySelectorAll('button[data-collection-open]').forEach(button => {
      const id = String(button.dataset.collectionOpen || '').trim();
      if (!id) return;
      const link = document.createElement('a');
      copyAttributes(button, link);
      link.href = collectionHref(owner, id);
      link.innerHTML = button.innerHTML;
      link.setAttribute('aria-label', `Открыть подборку «${String(button.closest('.oc-collection-item')?.querySelector('h4')?.textContent || '').trim() || id}»`);
      button.replaceWith(link);
    });
    root.querySelectorAll('a[data-collection-open]').forEach(link => {
      const id = String(link.dataset.collectionOpen || '').trim();
      if (id) link.href = collectionHref(owner, id);
    });
  }

  function modifiedActivation(event) {
    return event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
  }

  function activeCollectionId() {
    return String(panel.querySelector('[data-collection-album-view]')?.getAttribute('data-collection-album-view') || '').trim();
  }

  function clickWhileApplying(element) {
    if (!element) return false;
    applying = true;
    try {
      element.click();
    } finally {
      applying = false;
    }
    return true;
  }

  function matchingOwnerOption(select, owner) {
    const wanted = normalize(owner);
    return [...(select?.options || [])].find(option => normalize(option.value) === wanted || normalize(option.textContent) === wanted) || null;
  }

  function scheduleApply(delay = 0, resetAttempts = false) {
    if (resetAttempts) applyAttempt = 0;
    window.clearTimeout(applyTimer);
    applyTimer = window.setTimeout(applyRoute, delay);
  }

  function applyRoute() {
    const route = collectionRoute();
    upgradeCollectionLinks();

    if (!route) {
      applyAttempt = 0;
      if (activeCollectionId()) {
        clickWhileApplying(panel.querySelector('#oc-collection-detail-back'));
      }
      return;
    }

    const discoveryButton = document.querySelector('.oc-tab-btn[data-tab="discovery"]');
    if (discoveryButton && !discoveryButton.classList.contains('active')) {
      clickWhileApplying(discoveryButton);
      scheduleApply(80);
      return;
    }

    const collectionsTab = panel.querySelector('[data-discovery-tab="collections"]');
    if (!collectionsTab) {
      if (applyAttempt++ < 100) scheduleApply(100);
      return;
    }
    if (!collectionsTab.classList.contains('active')) {
      clickWhileApplying(collectionsTab);
      scheduleApply(40);
      return;
    }

    const ownerSelect = panel.querySelector('#oc-collection-owner');
    if (route.owner && ownerSelect) {
      const option = matchingOwnerOption(ownerSelect, route.owner);
      if (!option) {
        if (applyAttempt++ < 100) scheduleApply(100);
        return;
      }
      if (ownerSelect.value !== option.value) {
        applying = true;
        ownerSelect.value = option.value;
        ownerSelect.dispatchEvent(new Event('change', { bubbles: true }));
        applying = false;
        scheduleApply(50);
        return;
      }
    }

    const currentId = activeCollectionId();
    if (currentId === route.id) {
      applyAttempt = 0;
      return;
    }
    if (currentId) {
      clickWhileApplying(panel.querySelector('#oc-collection-detail-back'));
      scheduleApply(50);
      return;
    }

    upgradeCollectionLinks();
    const opener = [...panel.querySelectorAll('[data-collection-open]')]
      .find(element => String(element.dataset.collectionOpen || '') === route.id);
    if (opener) {
      applyAttempt = 0;
      clickWhileApplying(opener);
      return;
    }
    if (applyAttempt++ < 100) scheduleApply(100);
  }

  document.addEventListener('click', event => {
    const opener = event.target?.closest?.('[data-collection-open]');
    if (opener && panel.contains(opener)) {
      if (applying) return;
      if (opener.tagName === 'A' && modifiedActivation(event)) {
        event.stopPropagation();
        return;
      }
      writeCollectionUrl(selectedOwner(), opener.dataset.collectionOpen);
      return;
    }

    if (event.target?.closest?.('#oc-collection-detail-back') && panel.contains(event.target)) {
      if (applying) return;
      if (window.history.state?.ocCollectionDetail) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.history.back();
      } else {
        clearCollectionUrl(true);
      }
      return;
    }

    if (event.target?.closest?.('#oc-collection-detail-edit') && panel.contains(event.target)) {
      if (!applying) clearCollectionUrl(true);
      return;
    }

    const discoveryTab = event.target?.closest?.('[data-discovery-tab]');
    if (discoveryTab && panel.contains(discoveryTab) && !applying) {
      clearCollectionUrl(true);
      return;
    }

    const mainTab = event.target?.closest?.('.oc-tab-btn[data-tab]');
    if (mainTab && !applying) {
      window.setTimeout(() => {
        if (mainTab.dataset.tab !== 'discovery' || !collectionRoute()) clearCollectionUrl(true);
      }, 0);
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target?.matches?.('#oc-collection-owner')) {
      window.setTimeout(() => upgradeCollectionLinks(), 0);
    }
  }, true);

  window.addEventListener('popstate', () => scheduleApply(0, true));
  window.addEventListener('pageshow', () => scheduleApply(0, true));
  window.addEventListener('oped:user-profiles-updated', () => scheduleApply(30));
  window.addEventListener('oped:app-data-updated', () => scheduleApply(30));
  window.addEventListener('oped:route-change', event => {
    const url = currentUrl();
    if (url.searchParams.get('view') === 'discovery' && url.searchParams.get('collection')) {
      scheduleApply(30);
      return;
    }
    if (event.detail?.tab !== 'discovery') {
      clearCollectionUrl(true);
      applyAttempt = 0;
    }
  });

  new MutationObserver(() => {
    upgradeCollectionLinks();
    if (collectionRoute()) scheduleApply(20);
  }).observe(panel, { childList: true, subtree: true });

  upgradeCollectionLinks();
  scheduleApply(0, true);
})();