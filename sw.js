const CACHE = 'imb-v39';
const SHELL = [
  './', './index.html', './style.css',
  './core.js', './auth.js', './tools.js', './import.js',
  './mod-print.js', './app.js',
  './mod-dashboard.js', './mod-barang.js', './mod-supplier.js',
  './mod-pelanggan.js', './mod-pembelian.js', './mod-penjualan.js',
  './mod-pembayaran.js', './mod-penerimaan.js', './mod-kaskecil.js',
  './mod-jurnal.js', './mod-farm.js', './mod-akun.js', './mod-eksekutif.js',
  './home.html', './dashboard.html', './barang.html',
  './supplier.html', './pelanggan.html', './pembelian.html',
  './penjualan.html', './pembayaran.html', './penerimaan.html',
  './kaskecil.html', './jurnal.html',
  './produksi.html', './panen.html', './kandang.html', './akun.html', './eksekutif.html',
  './manifest.json', './icon.svg', './version.json',
  './responsive.css', './ui.js', './chart.umd.js',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', 
  
   // ── FASE 1: Akuntansi ──
  './coa.html', './jurnal-umum.html', './laporan-akuntansi.html', './laporan-keuangan.html',
  './mod-coa.js', './mod-jurnal-umum.js', './mod-laporan-akuntansi.js', './mod-laporan-keuangan.js', 
  
  // ── FASE 2: Persediaan ──
  './penyesuaian.html', './mod-penyesuaian.js', 

  // ── FASE 3 & 4: Alur Dokumen (PO, GRN, Retur) & Tutup Buku ──
  './pesanan-pembelian.html', './mod-pesanan-pembelian.js',
  './penerimaan-barang.html', './mod-penerimaan-barang.js',
  './retur.html', './mod-retur.js', 
  './tutup-buku.html', './mod-tutup-buku.js',

  // ── FASE 5: Aset Tetap & Migrasi ──
  './aset.html', './mod-aset.js',
  './migrasi.html', './mod-migrasi.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(err =>
        console.warn('Precache partial:', err)))
      .then(() => self.skipWaiting())
  );
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
  const url = new URL(req.url);
  
  if (req.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith('/version.json')){
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(res => res)
        .catch(() => caches.match(req).then(r => r || new Response(
          '{"v":0}', { headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => {
        return caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
      })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
