// CrowdCity AI - Service Worker (Diagnostic Mode: Transparent Network Pass-Through)
const CACHE_NAME = 'crowdcity-static-v19';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Transparent pass-through: do not intercept any requests
  return;
});
