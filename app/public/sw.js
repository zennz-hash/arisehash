// AriseHash service worker — conservative caching.
// Never caches API calls; serves an offline fallback for navigations.
const CACHE = 'arisehash-v1'
const ASSETS = ['/', '/logo.png', '/favicon.svg', '/manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Bypass: non-GET, cross-origin, and API/SSE requests are always network.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return
  }

  // Navigations: network-first, fall back to cached shell when offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/') )
    )
    return
  }

  // Static assets (hashed JS/CSS/img): cache-first.
  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        if (res.ok && (url.pathname.startsWith('/assets/') || ASSETS.includes(url.pathname))) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
        }
        return res
      }).catch(() => cached)
    )
  )
})
