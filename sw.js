/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MAC Exam Hub — Service Worker                                  ║
 * ║   Features: Offline static caching, network-first dynamic fallbacks║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const CACHE_NAME = 'machub-static-cache-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles/tailwind.css',
  '/styles/base.css',
  '/styles/components.css',
  '/styles/mobile-optimized.css',
  '/styles/mac_ai_chat.css',
  '/styles/desktop.css',
  '/styles/claim_profile.css',
  '/js/firebase-init.js',
  '/js/api.js',
  '/js/mac_ai.js',
  '/js/smart_finder.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/profile.js',
  '/js/home.js',
  '/js/timetable.js',
  '/js/seats.js',
  '/js/resources.js',
  '/js/app.js',
  '/js/onboarding.js',
  '/js/claim_profile.js',
  '/js/pin_lock.js',
  '/js/qr_id.js',
  '/js/bootstrap.js',
  '/js/mgu_result.js',
  '/js/chat.js',
  '/data/common/mac_ai_database.js',
  '/data/common/student_names.js',
  '/data/common/students_db.js',
  '/data/common/class_info.js',
  '/data/common/announcements.js',
  '/assets/img/file_00000000378c7207842a975d80367515.png',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/bcryptjs/2.4.3/bcrypt.min.js'
];

// Install: Cache all static shell files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Some assets failed to pre-cache (non-fatal):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network first, fallback to cache for static shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip POST, PUT, DELETE or non-http requests
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Network-first with cache fallback strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If successful response, put clone in cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: Fallback to cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If offline and request is HTML document, return index shell
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
          return new Response('Offline and asset not cached.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});
