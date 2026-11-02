const CACHE_NAME = 'zikrsphere-v1';
const ASSETS_TO_CACHE = [
  '/namaz/',
  '/namaz/index.html',
  '/namaz/style.css',
  '/namaz/translations.js',
  '/namaz/app.js',
  '/namaz/logo.jpg',
  '/namaz/abbu-shahma.jpeg',
  '/namaz/muhammad-sibgathullah.jpg',
  '/namaz/md-firoz-alam.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('script.google.com')) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
