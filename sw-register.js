(() => {
  const version = '20260724-features-no-refactor3';
  let enhancementsLoaded = false;
  let entityProgressLoaded = false;

  function legacyReady() {
    const list = document.querySelector('#oc-list-container');
    const result = document.querySelector('#oc-resultcount');
    if (!list) return true;
    const loading = /загрузка списка/i.test(String(list.textContent || ''));
    const rendered = /показано:/i.test(String(result?.textContent || ''));
    return rendered || !loading;
  }

  function idle(callback) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(callback, { timeout: 900 });
    else window.setTimeout(callback, 80);
  }

  function loadEntityProgress() {
    if (entityProgressLoaded) return;
    entityProgressLoaded = true;
    const script = document.createElement('script');
    script.src = `./entity-progress-refresh.js?v=${version}`;
    document.body.append(script);
  }

  function loadEnhancements() {
    if (enhancementsLoaded) return;
    enhancementsLoaded = true;

    const styles = [
      './filter-ui-fixes.css',
      './entity-album-cards.css',
      './styles/product-shell.css',
      './styles/product-shell-fixes.css'
    ];
    if (document.querySelector('.oc-addbar')) styles.push('./track-add-panel.css');
    styles.forEach(href => {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = `${href}?v=${version}`;
      document.head.append(stylesheet);
    });

    document.addEventListener('click', event => {
      if (event.target?.closest?.('[data-entity-home], [data-entity-open]')) loadEntityProgress();
    }, true);
    if (document.querySelector('#oc-entity-panel:not(.hidden)')) loadEntityProgress();

    if (document.querySelector('.oc-addbar')) {
      const script = document.createElement('script');
      script.src = `./track-add-panel.js?v=${version}`;
      document.body.append(script);
    }

    const featureScript = document.createElement('script');
    featureScript.type = 'module';
    featureScript.src = `./app/app-shell.js?v=${version}`;
    document.body.append(featureScript);
  }

  function waitForLegacy() {
    if (legacyReady()) {
      idle(loadEnhancements);
      return;
    }
    const root = document.querySelector('#oc-list-container') || document.body;
    const observer = new MutationObserver(() => {
      if (!legacyReady()) return;
      observer.disconnect();
      idle(loadEnhancements);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForLegacy, { once: true });
  else waitForLegacy();
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js?v=20260724-force10', {
        updateViaCache: 'none'
      });
      await registration.update();
    } catch (error) {
      console.warn('Image cache service worker registration failed', error);
    }
  });
}
