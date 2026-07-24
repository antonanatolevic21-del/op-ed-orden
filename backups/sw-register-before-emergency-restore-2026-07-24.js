(() => {
  const version = '20260724-product-shell2';

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

  const entityProgressScript = document.createElement('script');
  entityProgressScript.src = `./entity-progress-refresh.js?v=${version}`;
  document.body.append(entityProgressScript);

  if (document.querySelector('.oc-addbar')) {
    const addPanelScript = document.createElement('script');
    addPanelScript.src = `./track-add-panel.js?v=${version}`;
    document.body.append(addPanelScript);
  }

  const shellScript = document.createElement('script');
  shellScript.type = 'module';
  shellScript.src = `./app/app-shell.js?v=${version}`;
  document.body.append(shellScript);
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
