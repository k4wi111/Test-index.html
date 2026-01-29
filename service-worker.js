// service-worker.js
// NOTE: bumping CACHE_NAME forces clients to fetch the new app shell + JS.
// If you change any JS/CSS/HTML, increment this.
const CACHE_NAME = 'iosano-v2-FIXED';

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

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    // activate this SW immediately (avoid "half-updated" state)
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
    );
    // take control right away
    await self.clients.claim();
  })());
});

// Cache-first for same-origin static files, network-first for navigations.
// Also does a background update when cached.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML navigations to reduce "stale app shell" issues
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match('./index.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  // Cache-first for assets, with background revalidate
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      // update in background
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, fresh);
        } catch (_) {}
      })());
      return cached;
    }

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      return Response.error();
    }
  })());
});
