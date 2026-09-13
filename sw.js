const CACHE_NAME = 'invitta-scanner-v1';
const ASSETS_TO_CACHE = [
  'scanner-acceso.html',
  'guest-manager.js',
  'theme.css',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Opened cache');
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(e => console.warn('Cache add error', e))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Serve from cache first, fall back to network
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
