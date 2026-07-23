(() => {
  const version = '20260723-track-panel-compact8';

  const albumStylesheet = document.createElement('link');
  albumStylesheet.rel = 'stylesheet';
  albumStylesheet.href = `./entity-album-cards.css?v=${version}`;
  document.head.append(albumStylesheet);

  const entityProgressScript = document.createElement('script');
  entityProgressScript.src = `./entity-progress-refresh.js?v=${version}`;
  document.body.append(entityProgressScript);

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
      const registration = await navigator.serviceWorker.register('./sw.js?v=20260723-force9', {
        updateViaCache: 'none'
      });
      await registration.update();
    } catch (error) {
      console.warn('Image cache service worker registration failed', error);
    }
  });
}
