(() => {
  const version = '20260724-features-no-refactor2';

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

  let entityProgressLoaded = false;
  const loadEntityProgress = () => {
    if (entityProgressLoaded) return;
    entityProgressLoaded = true;
    const script = document.createElement('script');
    script.src = `./entity-progress-refresh.js?v=${version}`;
    document.body.append(script);
  };

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
