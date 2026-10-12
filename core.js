/* ═══════════════════════════════════════════════════════════════
   KONFIGURASI
   ═══════════════════════════════════════════════════════════════ */
const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbzGEHDt8USdnMKzNhdaNHVSaRP9hbxCpifPFAI2gCmVddnVkeXNMqnMrKopihXm0PYZ/exec';

/* ═══════════════════════════════════════════════════════════════
   UTIL
   ═══════════════════════════════════════════════════════════════ */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const fmt = n => new Intl.NumberFormat('id-ID').format(Math.round(+n||0));
const rp  = n => 'Rp' + fmt(n);
const today = () => new Date().toISOString().slice(0,10);
const dmy = s => { if(!s) return '-'; const d = new Date(s);
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); };
const esc = s => String(s??'').replace(/[&<>"]/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sum = (a,f) => a.reduce((s,x) => s + f(x), 0);

function toast(msg, type, ms){
  const t = $('#st');
  if (!t) return;
  t.textContent = msg;
  t.className = type === 'error' ? 'error' : '';
  t.style.display = 'block';
  clearTimeout(window._tt);
  window._tt = setTimeout(() => t.style.display = 'none', ms || 1800);
}

/* ═══════════════════════════════════════════════════════════════
   STORAGE
   ═══════════════════════════════════════════════════════════════ */
const K_URL   = 'erp_url';
const K_DATA  = 'erp_data_v1';
const K_QUEUE = 'erp_queue_v1';

const getUrl    = () => localStorage[K_URL] || '';
const hasUrl    = () => !!localStorage[K_URL];
const getQueue  = () => { try { return JSON.parse(localStorage[K_QUEUE] || '[]'); }
                          catch { return []; } };
const setQueue  = q => { localStorage[K_QUEUE] = JSON.stringify(q); updateStatus(); };

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
function seed(){
  return {
    kas: 25000000,
    kasKecil: { saldo: 1500000, mutasi: [] },
    barang: [
      { id:uid(), kode:'BB-001', nama:'Kertas Art Paper 120gsm', satuan:'rim',
        hargaBeli:55000, hargaJual:78000, stok:40, tipe:'bahan' },
      { id:uid(), kode:'BB-002', nama:'Tinta Offset CMYK', satuan:'kg',
        hargaBeli:120000, hargaJual:165000, stok:25, tipe:'bahan' },
      { id:uid(), kode:'BB-003', nama:'Lem Hotmelt', satuan:'kg',
        hargaBeli:48000, hargaJual:65000, stok:30, tipe:'bahan' },
      { id:uid(), kode:'BJ-001', nama:'Kemasan Box Custom', satuan:'pcs',
        hargaBeli:0, hargaJual:0, stok:0, tipe:'jadi' },
    ],
    pembelian: [], penjualan: [],
    pembayaran: [], penerimaan: [],
    permintaan: [], pesanan: [],
  };
}

let S;
try { S = JSON.parse(localStorage[K_DATA]) || seed(); }
catch { S = seed(); }

function persist(){
  localStorage[K_DATA] = JSON.stringify(S);
  updateStatus();
}

/* ═══════════════════════════════════════════════════════════════
   BUSINESS LOGIC
   ═══════════════════════════════════════════════════════════════ */
const brg = id => S.barang.find(b => b.id === id);
const totBuy  = p => sum(p.items, i => i.qty * i.harga);
const totSell = p => sum(p.items, i => i.qty * i.harga);
const hppSell = p => sum(p.items, i => i.qty * (i.hpp || 0));
const nilaiStok = () => sum(S.barang, b => b.stok * (b.hargaBeli || 0));
const piutang = () => sum(S.penjualan.filter(p => p.status !== 'lunas'), totSell);
const hutang  = () => sum(S.pembelian.filter(p => p.status !== 'lunas'), totBuy);

function labaRugi(){
  const pend  = sum(S.penjualan, totSell);
  const hpp   = sum(S.penjualan, hppSell);
  const beban = sum(S.kasKecil.mutasi.filter(m => m.keluar), m => m.keluar);
  const kotor = pend - hpp;
  return { pend, hpp, kotor, beban, bersih: kotor - beban };
}

function jurnal(){
  const J = [];
  S.pembelian.forEach(p => J.push({ tgl:p.tgl, ref:p.no,
    ket:'Beli barang', d:'Persediaan', k:'Kas/Hutang', j:totBuy(p) }));
  S.penjualan.forEach(p => {
    J.push({ tgl:p.tgl, ref:p.no, ket:'Jual barang',
      d:'Kas/Piutang', k:'Pendapatan', j:totSell(p) });
    J.push({ tgl:p.tgl, ref:p.no, ket:'HPP terjual',
      d:'HPP', k:'Persediaan', j:hppSell(p) });
  });
  S.kasKecil.mutasi.forEach(m => {
    if (m.masuk) J.push({ tgl:m.tgl, ref:'KK',
      ket:'Isi kas kecil', d:'Kas Kecil', k:'Kas', j:m.masuk });
    if (m.keluar) J.push({ tgl:m.tgl, ref:'KK',
      ket:'Kas kecil keluar', d:'Beban', k:'Kas Kecil', j:m.keluar });
  });
  return J.sort((a,b) => (b.tgl||'').localeCompare(a.tgl||''));
}

function stokMasuk(id, qty, harga){
  const b = brg(id); if (!b) return;
  const nl = b.stok * (b.hargaBeli || 0);
  b.stok += qty;
  if (b.stok > 0 && harga > 0) b.hargaBeli = (nl + qty * harga) / b.stok;
}
function stokKeluar(id, qty){
  const b = brg(id); if (!b) return 0;
  const hpp = b.hargaBeli || 0;
  b.stok -= qty;
  return hpp;
}

/* ═══════════════════════════════════════════════════════════════
   SYNC
   ═══════════════════════════════════════════════════════════════ */
let busy = false;

async function flush(){
  const url = getUrl();
  if (!url || url === 'DEMO' || busy || !navigator.onLine) return;
  busy = true;
  try {
    while (true){
      const q = getQueue();
      if (!q.length) break;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(q[0])
        });
        const txt = await res.text();
        if (txt.trim() !== 'ok') break;
        const cur = getQueue(); cur.shift(); setQueue(cur);
      } catch(e){ break; }
    }
  } finally { busy = false; }
}

function queue(payload){
  if (!hasUrl() || getUrl() === 'DEMO') return;
  const q = getQueue();
  q.push(payload);
  setQueue(q);
  flush();
}

async function sync(){
  if (!hasUrl()){ toast('Belum tersambung', 'error'); return; }
  if (getUrl() === 'DEMO'){ toast('Mode demo · sync dimatikan'); return; }
  if (!navigator.onLine){ toast('Sedang offline', 'error'); return; }
  toast('Menyinkronkan…');
  await flush();
  updateStatus();
  if (!getQueue().length) toast('✓ Tersinkron');
}

function updateStatus(){
  const subEl = $('#sub'), syEl = $('#sy'), cnEl = $('#cn');
  if (!subEl) return;
  if (!hasUrl()){
    subEl.textContent = 'Belum tersambung';
    syEl.textContent = '';
    cnEl.textContent = '';
    return;
  }
  const isDemo = getUrl() === 'DEMO';
  const n = getQueue().length;
  const online = navigator.onLine;
  subEl.textContent = isDemo ? 'PT. Agri Wangi Berry · Demo'
    : online ? 'PT. Agri Wangi Berry · Online'
    : 'PT. Agri Wangi Berry · Offline';
  cnEl.textContent = isDemo ? '🎬 Mode demo'
    : online ? '🟢 Online' : '🔴 Offline · lokal';
  syEl.textContent = isDemo ? '' : n
    ? '· ' + n + ' perubahan menunggu sync'
    : '· tersinkron otomatis';
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGASI
   ═══════════════════════════════════════════════════════════════ */
const NAV = [
  { id:'home',      icon:'🏠', label:'Home' },
  { id:'dashboard', icon:'📊', label:'Ringkasan' },
  { id:'barang',    icon:'📦', label:'Barang' },
  { id:'pembelian', icon:'🛒', label:'Beli' },
  { id:'penjualan', icon:'🧾', label:'Jual' },
];

let view = 'home';

function renderNav(){
  const nav = $('#nav');
  if (!nav) return;
  nav.innerHTML = NAV.map(n =>
    `<button data-t="${n.id}" class="${n.id===view?'on':''}">
       <span class="ic">${n.icon}</span>${n.label}
     </button>`).join('');
  nav.querySelectorAll('button').forEach(b =>
    b.onclick = () => openModule(b.dataset.t));
}

function openModule(id){
  if (!hasUrl()){
    renderWelcome();
    return;
  }
  view = id;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + id));
  $$('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === id));
  window.scrollTo({top:0});
  refreshView(id);
}

function refreshView(id){
  const map = {
    home:      () => typeof renderHome === 'function' && renderHome(),
    dashboard: () => typeof renderDashboard === 'function' && renderDashboard(),
    barang:    () => typeof renderBarang === 'function' && renderBarang(),
    pembelian: () => typeof renderPembelian === 'function' && renderPembelian(),
    penjualan: () => typeof renderPenjualan === 'function' && renderPenjualan(),
    pembayaran:() => typeof renderPembayaran === 'function' && renderPembayaran(),
    penerimaan:() => typeof renderPenerimaan === 'function' && renderPenerimaan(),
    kaskecil:  () => typeof renderKasKecil === 'function' && renderKasKecil(),
    permintaan:() => typeof renderPermintaan === 'function' && renderPermintaan(),
    pesanan:   () => typeof renderPesanan === 'function' && renderPesanan(),
    stok:      () => typeof renderStok === 'function' && renderStok(),
    jurnal:    () => typeof renderJurnal === 'function' && renderJurnal(),
  };
  if (map[id]) map[id]();
}

function refreshAll(){
  Object.keys({
    home:1, dashboard:1, barang:1, pembelian:1, penjualan:1,
    pembayaran:1, penerimaan:1, kaskecil:1, permintaan:1, pesanan:1,
    stok:1, jurnal:1,
  }).forEach(refreshView);
  updateStatus();
}

/* ═══════════════════════════════════════════════════════════════
   WELCOME / CONNECT
   ═══════════════════════════════════════════════════════════════ */
function renderWelcome(){
  const m = $('#m');
  if (!m) return;
  m.innerHTML = `<div class="card welcome">
    <div class="ico">⚡</div>
    <h2>Sambungkan ke Google Sheet</h2>
    <p>Ketuk sekali untuk memuat data dan mulai<br>mengelola pembelian, penjualan & gudang.</p>
    <button class="btn-big" onclick="connect()">Sambung</button>
    <a href="#" class="demo" onclick="demoMode();return false">Coba mode demo dulu</a>
    <div class="feats">
      <b>✓ Tanpa daftar</b> — langsung pakai<br>
      <b>✓ Bisa offline</b> — data tersimpan lokal<br>
      <b>✓ Sinkron otomatis</b> — ke Google Sheet<br>
      <b>✓ Install sebagai app</b> — dari browser HP
    </div>
  </div>`;
}

function connect(){
  localStorage[K_URL] = DEFAULT_URL;
  toast('Menyambungkan…');
  boot();
}

function demoMode(){
  localStorage[K_URL] = 'DEMO';
  if (!localStorage[K_DATA]) persist();
  toast('Mode demo — data contoh');
  boot();
}

function cfg(){
  const current = localStorage[K_URL] || '';
  const v = prompt(
    'URL Web App Apps Script (…/exec).\nKosongkan untuk reset koneksi:',
    current === 'DEMO' ? '' : current
  );
  if (v === null) return;
  if (!v.trim()){
    delete localStorage[K_URL];
    toast('Koneksi direset');
    boot();
    return;
  }
  localStorage[K_URL] = v.trim();
  toast('URL diperbarui');
  boot();
}

/* ═══════════════════════════════════════════════════════════════
   MODAL
   ═══════════════════════════════════════════════════════════════ */
let modalOk = null;

function openModal(title, sub, body, onOk, okLabel){
  const m = $('#modal');
  $('#mc').innerHTML = `
    <div class="mhead">
      <div><h3>${esc(title)}</h3>${sub?`<div class="msub">${esc(sub)}</div>`:''}</div>
      <button class="mx" onclick="closeModal()">×</button>
    </div>
    ${body}
    <div class="mfoot">
      <button class="btn btn-s" onclick="closeModal()">Batal</button>
      <button class="btn btn-p" id="mOk">${esc(okLabel || 'Simpan')}</button>
    </div>`;
  modalOk = onOk;
  $('#mOk').onclick = () => { if (modalOk) modalOk(); };
  m.classList.add('show');
}
function closeModal(){
  $('#modal').classList.remove('show');
  modalOk = null;
}
document.addEventListener('DOMContentLoaded', () => {
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
});

/* ═══════════════════════════════════════════════════════════════
   ITEM ROW
   ═══════════════════════════════════════════════════════════════ */
function optBarang(filter){
  return S.barang
    .filter(b => !filter || b.tipe === filter)
    .map(b => `<option value="${b.id}">${esc(b.kode)} · ${esc(b.nama)}</option>`)
    .join('');
}
function itemRow(prefix, filter){
  return `<div class="irow">
    <select class="${prefix}-brg">${optBarang(filter)}</select>
    <input class="${prefix}-qty" type="number" min="1" value="1">
    <input class="${prefix}-hrg" type="number" min="0" value="0">
    <button class="x2" onclick="this.parentNode.remove()">✕</button>
  </div>`;
}
function addRow(cid, prefix, filter){
  const el = document.getElementById(cid);
  if (el) el.insertAdjacentHTML('beforeend', itemRow(prefix, filter));
}
function readRows(prefix){
  const rows = [...document.querySelectorAll('.irow')]
    .filter(r => r.querySelector('.' + prefix + '-brg'));
  return rows.map(r => ({
    barangId: r.querySelector('.' + prefix + '-brg').value,
    qty: +r.querySelector('.' + prefix + '-qty').value || 0,
    harga: +r.querySelector('.' + prefix + '-hrg').value || 0,
  })).filter(x => x.barangId && x.qty > 0);
}
document.addEventListener('change', e => {
  if (e.target.matches('select[class$="-brg"]')){
    const row = e.target.closest('.irow');
    const b = brg(e.target.value); if (!b) return;
    const hrg = row.querySelector('input[class$="-hrg"]');
    const prefix = e.target.className.replace('-brg','');
    if (hrg && (!+hrg.value || hrg.dataset.auto === '1')){
      hrg.value = prefix.startsWith('o') || prefix.startsWith('j')
        ? (b.hargaJual || b.hargaBeli) : b.hargaBeli;
      hrg.dataset.auto = '1';
    }
  }
});

/* ═══════════════════════════════════════════════════════════════
   AUTO-UPDATE
   ═══════════════════════════════════════════════════════════════ */
async function checkUpdate(silent){
  try {
    const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    const j = await r.json();
    const seen = localStorage.app_v;
    if (!seen){ localStorage.app_v = j.v; return 'first'; }
    if (j.v !== seen){
      console.log('Versi baru:', j.v, '(lama:', seen, ')');
      localStorage.app_v = j.v;
      return j.v;
    }
    if (!silent) toast('Sudah versi terbaru');
    return 'latest';
  } catch(e){
    console.warn('Cek update gagal:', e);
    if (!silent) toast('Gagal cek update', 'error');
    return 'error';
  }
}

async function hardReset(){
  try {
    if ('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) await reg.unregister();
    }
    if ('caches' in window){
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch(e){}
  location.replace(location.pathname + '?fresh=' + Date.now());
}

async function manualUpdate(){
  toast('Memeriksa update…');
  const r = await checkUpdate(true);
  if (r === 'error'){ toast('Gagal cek update, periksa koneksi', 'error'); return; }
  if (r === 'first'){ toast('Versi tersimpan, memuat ulang…'); await hardReset(); return; }
  if (r === 'latest'){ toast('Sudah versi terbaru · refresh…'); setTimeout(hardReset, 700); return; }
  toast('Versi baru ' + r + ' · memuat ulang…');
  setTimeout(hardReset, 700);
}

/* ═══════════════════════════════════════════════════════════════
   INSTALL PROMPT
   ═══════════════════════════════════════════════════════════════ */
let installPrompt = null;
function showInstall(text, fn){
  if ($('#ib')) return;
  const b = document.createElement('button');
  b.id = 'ib';
  b.innerHTML = text + ' <span style="margin-left:8px;opacity:.7">✕</span>';
  b.style.cssText = `position:fixed;bottom:calc(86px + env(safe-area-inset-bottom));
    left:50%;transform:translateX(-50%);background:#2d5016;color:#fff;
    padding:12px 22px;border:0;border-radius:30px;font:600 14px Figtree;
    box-shadow:0 4px 12px rgba(0,0,0,.25);z-index:9999;white-space:nowrap;
    font-family:inherit;cursor:pointer;`;
  b.onclick = ev => {
    if (ev.target.tagName === 'SPAN'){ b.remove(); return; }
    fn();
  };
  document.body.appendChild(b);
}
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  showInstall('⬇ Install Aplikasi', async () => {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    const b = $('#ib'); if (b) b.remove();
  });
});
window.addEventListener('appinstalled', () => {
  const b = $('#ib'); if (b) b.remove();
});
if (/iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(matchMedia('(display-mode: standalone)').matches || navigator.standalone)){
  window.addEventListener('load', () => showInstall('⬇ Cara pasang di iPhone', () => {
    alert('Buka lewat Safari → ketuk tombol Bagikan → pilih "Tambah ke Layar Utama".');
  }));
}

/* ═══════════════════════════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('online', () => {
  updateStatus();
  toast('Kembali online');
  flush();
});
window.addEventListener('offline', () => {
  updateStatus();
  toast('Mode offline', 'error');
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden){ flush(); checkUpdate(true); }
});

/* URL parameter ?api=... */
const _api = new URLSearchParams(location.search).get('api');
if (_api){
  localStorage[K_URL] = _api;
  history.replaceState(null, '', location.pathname);
}

/* URL parameter ?fresh=... → ignore */
if (new URLSearchParams(location.search).get('fresh')){
  history.replaceState(null, '', location.pathname);
}

/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
function boot(){
  renderNav();
  updateStatus();
  if (!hasUrl()){
    renderWelcome();
    return;
  }
  // Tampilkan view yang aktif
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + view));
  refreshAll();
}

/* Panggil boot() setelah app.js load views */
window.bootApp = boot;
