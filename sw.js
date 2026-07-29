const CACHE_NAME = 'op-ed-images-v3-20260729-performance1';
const MAX_IMAGE_ENTRIES = 400;

async function trimImageCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_IMAGE_ENTRIES) return;
  const excess = keys.slice(0, keys.length - MAX_IMAGE_ENTRIES);
  await Promise.all(excess.map(key => cache.delete(key)));
}

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
      const refresh = fetch(request).then(async response => {
        if (response && response.ok) {
          await cache.put(request, response.clone());
          await trimImageCache(cache);
        }
        return response;
      });
      if (cached) {
        event.waitUntil(refresh.catch(() => null));
        return cached;
      }
      return refresh;
    })
  );
});
