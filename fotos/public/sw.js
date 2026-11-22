// Service worker: app instalable, funciona sin conexión (carcasa) y recibe fotos desde "Compartir" (Android).
const VERSION = 'v3';
const SHELL = ['/', '/style.css', '/app.js', '/extra.js', '/home.js', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/manifest.webmanifest'];
const SHARE_CACHE = 'shared-photos';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== SHARE_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === 'POST' && url.pathname === '/share') {
    event.respondWith((async () => {
      const form = await req.formData();
      const files = form.getAll('photos').filter((f) => f && f.size);
      const cache = await caches.open(SHARE_CACHE);
      for (const k of await cache.keys()) await cache.delete(k);
      let i = 0;
      for (const f of files) await cache.put('/shared/' + i++, new Response(f, { headers: { 'content-type': f.type || 'image/jpeg', 'x-date': String(f.lastModified || Date.now()) } }));
      return Response.redirect('/?share=' + files.length, 303);
    })());
    return;
  }
  // los datos (/api) siempre van a la red; la carcasa: red primero, caché si no hay conexión
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
