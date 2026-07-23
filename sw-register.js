    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(error => {
          console.warn('Image cache service worker registration failed', error);
        });
      });
    }
