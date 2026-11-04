/* Digital Ainwan service worker.
 * - Pages and public data: try the network first (fresh news), fall back to the copy saved last time.
 * - Built files (/assets, names change on every release) and photos: from the saved copy, they never change.
 * - Anything personal (sign-in, my account, admin, receipts) is never saved here.
 */
const VERSION = 'ainwan-v2';
const PAGES = `${VERSION}-pages`;
const FILES = `${VERSION}-files`;
const DATA = `${VERSION}-data`;
const PHOTOS = `${VERSION}-photos`;
const KEEP = [PAGES, FILES, DATA, PHOTOS];
const OFFLINE = '/offline.html';
const PRIVATE = /^\/(?:en\/)?(?:admin|account|login|register|receipt)(?:\/|$)|^\/api\/(?:auth|me|admin)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(FILES)
      .then((c) => c.addAll([OFFLINE, '/offline.css', '/icon-192.png', '/manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

async function networkFirst(request, cacheName, ms) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([fetch(request), timeout(ms)]);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const saved = await cache.match(request);
    if (saved) return saved;
    throw new Error('offline');
  }
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  if (saved) return saved;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    if (max) {
      const keys = await cache.keys();
      for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k);
    }
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // maps, YouTube: the browser handles them
  if (PRIVATE.test(url.pathname) || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, PAGES, 6000).catch(async () => {
        // Not saved yet: the home page's copy can still start the site; else the offline note.
        const shell = await caches.match('/', { cacheName: PAGES });
        return shell || caches.match(OFFLINE);
      }),
    );
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, FILES));
    return;
  }
  if (url.pathname.startsWith('/uploads/images/')) {
    event.respondWith(cacheFirst(request, PHOTOS, 120));
    return;
  }
  if (url.pathname.startsWith('/api/public/')) {
    event.respondWith(networkFirst(request, DATA, 6000));
  }
});
