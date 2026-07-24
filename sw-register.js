(() => {
  const version = '20260724-emergency-restore2';

  const filterUiStylesheet = document.createElement('link');
  filterUiStylesheet.rel = 'stylesheet';
  filterUiStylesheet.href = `./filter-ui-fixes.css?v=${version}`;
  document.head.append(filterUiStylesheet);

  const albumStylesheet = document.createElement('link');
  albumStylesheet.rel = 'stylesheet';
  albumStylesheet.href = `./entity-album-cards.css?v=${version}`;
  document.head.append(albumStylesheet);

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
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `./track-add-panel.css?v=${version}`;
    document.head.append(stylesheet);

    const script = document.createElement('script');
    script.src = `./track-add-panel.js?v=${version}`;
    document.body.append(script);
  }
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
