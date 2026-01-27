const CACHE_NAME = 'iosano-v3';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './service-worker.js',
  './js/app.js',
  './js/state.js',
  './js/listView.js',
  './js/mapView.js',
  './js/statsView.js',
  './js/ui.js',
  './js/utils.js',
  './icons/icon-120.png',
  './icons/icon-152.png',
  './icons/icon-167.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
