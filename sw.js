/* ═══════════════════════════════════════════════════════════════
   IMB Service Worker — offline-first dengan auto-update
   ═══════════════════════════════════════════════════════════════ */
const CACHE = 'imb-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
 './core.js',
'./import.js',
'./app.js',
  './mod-dashboard.js',
  './mod-barang.js',
  './mod-pembelian.js',
  './mod-penjualan.js',
  './mod-pembayaran.js',
  './mod-penerimaan.js',
  './mod-kaskecil.js',
  './mod-permintaan.js',
  './mod-pesanan.js',
  './mod-stok.js',
  './mod-jurnal.js',
  './home.html',
  './dashboard.html',
  './barang.html',
  './pembelian.html',
  './penjualan.html',
  './pembayaran.html',
  './penerimaan.html',
  './kaskecil.html',
  './permintaan.html',
  './pesanan.html',
  './stok.html',
  './jurnal.html',
  './manifest.json',
  './icon.svg',
  './version.json',
];

/* ─── Install: precache app shell ─── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(err => {
        // Jangan gagal install hanya karena 1 file hilang
        console.warn('Precache partial:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

/* ─── Activate: buang cache lama ─── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ─── Fetch strategy ─── */
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Lewatkan non-GET & cross-origin (Apps Script, Google Fonts)
  if (req.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  // version.json → network-first, jangan pernah cache hasil sukses
  if (url.pathname.endsWith('/version.json')){
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => res)
        .catch(() => caches.match(req).then(r => r || new Response(
          '{"v":0}', { headers: { 'Content-Type': 'application/json' } }
        )))
    );
    return;
  }

  // Semua aset same-origin → network-first, fallback cache
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(r =>
          r || caches.match('./index.html')
        )
      )
  );
});

/* ─── Terima pesan skipWaiting dari halaman ─── */
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
