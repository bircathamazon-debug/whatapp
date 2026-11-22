// Service worker: recibe fotos del menú "Compartir" (Android) y deja la app instalable.
const SHARE_CACHE = 'shared-photos';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/share') {
    event.respondWith((async () => {
      const form = await event.request.formData();
      const files = form.getAll('photos').filter((f) => f && f.size);
      const cache = await caches.open(SHARE_CACHE);
      for (const k of await cache.keys()) await cache.delete(k);
      let i = 0;
      for (const f of files) {
        await cache.put('/shared/' + i++, new Response(f, { headers: { 'content-type': f.type || 'image/jpeg', 'x-date': String(f.lastModified || Date.now()) } }));
      }
      return Response.redirect('/?share=' + files.length, 303);
    })());
  }
});
