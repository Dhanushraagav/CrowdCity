// CrowdCity AI - Service Worker
// Production-grade Service Worker with Stale-While-Revalidate static asset caching and offline fallback.

const CACHE_NAME = 'crowdcity-static-v14';
const OFFLINE_URL = 'offline.html';

const PRECACHE_ASSETS = [
  'offline.html',
  'css/style.css',
  'css/components.css',
  'images/crowdcity_icon_transparent.png'
];
// NOTE: JS files are NOT precached — they always use network-first to prevent stale code bugs.

// 1. Install Event: Pre-cache core shell assets (no JS)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// 2. Activate Event: Clean up legacy caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. Fetch Event: Network-first for JS; Stale-While-Revalidate for CSS/images; network-first for navigation
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Never intercept POST/PUT/DELETE, API endpoints, or database calls
  if (
    event.request.method !== 'GET' ||
    requestUrl.pathname.startsWith('/api/') ||
    event.request.url.includes('supabase.co')
  ) {
    return;
  }

  // Navigation requests: Try Network first, fallback to Offline HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match(OFFLINE_URL);
        return cachedOffline || Response.error();
      })
    );
    return;
  }

  // JavaScript files: ALWAYS network-first, no stale-cache serving
  // This prevents serving outdated auth.js/api.js/app.js after a deployment.
  if (event.request.destination === 'script') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Only use cached version if network completely fails (offline)
        return caches.match(event.request);
      })
    );
    return;
  }

  // CSS, Fonts, Images: Stale-While-Revalidate (safe to cache)
  if (
    event.request.destination === 'style' ||
    event.request.destination === 'font' ||
    event.request.destination === 'image'
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
