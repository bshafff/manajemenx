const CACHE = 'erpku-v2';

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // version.json selalu fresh
  if (url.pathname.endsWith('/version.json')){
    e.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Dokumen & HTML views: network-first
  if (req.mode === 'navigate' || req.destination === 'document'
      || url.pathname.endsWith('.html')){
    e.respondWith(
      fetch(req).then(res => {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
        return res;
      }).catch(() =>
        caches.match(req).then(c => c || caches.match('./index.html'))
      )
    );
    return;
  }

  // Aset lain: cache-first
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic'){
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put(req, cp));
        }
        return res;
      });
    })
  );
});
