// CrowdCity AI - Service Worker
// Production-ready service worker focusing on lightweight fetch handling, offline support, and client claims.

const OFFLINE_CACHE_NAME = 'crowdcity-offline-v1';
const OFFLINE_URL = 'offline.html';

// 1. Install Event: Cache the offline fallback page
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install Event triggered. Pre-caching offline fallback page...');
  event.waitUntil(
    caches.open(OFFLINE_CACHE_NAME).then((cache) => {
      // Pre-cache only the offline page.
      // Do not cache the rest of the application assets yet as per requirements.
      return cache.add(OFFLINE_URL);
    }).then(() => {
      // Force waiting service worker to become active immediately
      return self.skipWaiting();
    })
  );
});

// 2. Activate Event: Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate Event triggered. Claiming clients...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== OFFLINE_CACHE_NAME) {
            console.log('[Service Worker] Deleting outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim all clients immediately so that pages do not need to be reloaded to be controlled
      return self.clients.claim();
    })
  );
});

// 3. Fetch Event: Intercept navigation requests to display offline page on network failure
self.addEventListener('fetch', (event) => {
  // Keep the fetch handler lightweight:
  // - Only handle GET requests.
  // - Do NOT intercept API calls (to ensure backend/database APIs are unaffected).
  // - Do NOT intercept third-party API calls (e.g. Supabase, Mapbox, FontAwesome).
  const requestUrl = new URL(event.request.url);

  if (
    event.request.method !== 'GET' ||
    requestUrl.pathname.startsWith('/api/') ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('mapbox.com') ||
    event.request.url.includes('cloudflare')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first approach with cache fallback for navigation requests
  event.respondWith(
    fetch(event.request).catch(async (error) => {
      console.warn('[Service Worker] Fetch failed, checking cache for fallback:', error);

      // Only redirect navigation (page loads) to the offline fallback page
      if (event.request.mode === 'navigate') {
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        const cachedOffline = await cache.match(OFFLINE_URL);
        if (cachedOffline) {
          return cachedOffline;
        }
      }
      
      // Fallback for static assets (images, css, js) if they fail to load
      const cachedAsset = await caches.match(event.request);
      if (cachedAsset) {
        return cachedAsset;
      }

      // Return a basic network error response if nothing matches
      return Response.error();
    })
  );
});
