const CACHE_NAME = 'op-ed-images-v2-20260725-primary1';

function isLegacySiteCache(key) {
  const name = String(key || '').toLowerCase();
  if (name === CACHE_NAME.toLowerCase()) return false;
  return name.startsWith('op-ed-') || name.startsWith('oped-') || name.includes('op-ed-orden') || name.includes('aboba');
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(isLegacySiteCache).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.destination !== 'image') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !/\/images\/[^/]+\.webp(?:$|\?)/i.test(url.pathname + url.search)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response && response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
  );
});
