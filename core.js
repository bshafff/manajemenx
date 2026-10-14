/* ═══════════════════════════════════════════════════════════════
   KONFIGURASI
   ═══════════════════════════════════════════════════════════════ */
const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbyC8yxByi0lmkQlujnR1Px5QmwGVF-PIlMqjofvEXN--BStn1vQu0WbPBukU0i8Vmrl/exec';
const API_KEY = 'ERP_2026';

/* ═══════════════════════════════════════════════════════════════
   LINI USAHA
   ═══════════════════════════════════════════════════════════════ */
const LINI = {
  SB: { nama: 'Stroberi',   ico: '🍓', warna: '#dc2626' },
  DR: { nama: 'Dairy',      ico: '🥛', warna: '#2563eb' },
  AY: { nama: 'Ayam',       ico: '🐔', warna: '#b45309' },
  PK: { nama: 'Pakan Ayam', ico: '🌾', warna: '#16a34a' },
};
const liniOf = kode => String(kode || '').split('-')[0].toUpperCase();

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
  window._tt = setTimeout(() => t.style.display = 'none', ms || 2200);
}

/* ═══════════════════════════════════════════════════════════════
   STORAGE
   ═══════════════════════════════════════════════════════════════ */
const K_URL     = 'erp_url';
const K_DATA    = 'erp_data_v5';     // ← bumped untuk skema baru
const K_QUEUE   = 'erp_queue_v2';
const K_BOOT    = 'erp_bootstrapped';
const K_SESSION = 'erp_session';

const getUrl    = () => localStorage[K_URL] || '';
const hasUrl    = () => !!localStorage[K_URL];
const getQueue  = () => { try { return JSON.parse(localStorage[K_QUEUE] || '[]'); }
                          catch { return []; } };
const setQueue  = q => { localStorage[K_QUEUE] = JSON.stringify(q); updateStatus(); };

/* ═══════════════════════════════════════════════════════════════
   STATE — 5 entitas · 4 lini
   ═══════════════════════════════════════════════════════════════ */
function seed(){
  return {
    /* ─── Entitas (kas per entitas) ─── */
    entities: {
      HQ: { kas: 120000000 },
      SB: { kas: 0 },
      DR: { kas: 0 },
      AY: { kas: 0 },
      PK: { kas: 0 },
    },

    /* ─── Kas kecil per entitas ─── */
    kasKecil: {
      perEntity: {
        HQ: { saldo: 0, mutasi: [] },
        SB: { saldo: 0, mutasi: [] },
        DR: { saldo: 0, mutasi: [] },
        AY: { saldo: 0, mutasi: [] },
        PK: { saldo: 0, mutasi: [] },
      }
    },

    /* ─── Master ─── */
    barang:    [],
    supplier:  [],
    pelanggan: [],

    /* ─── Transaksi ─── */
    pembelian:  [],
    penjualan:  [],
    pembayaran: [],
    penerimaan: [],
    permintaan: [],
    pesanan:    [],
    jurnalUmum: [],

    /* ─── Users ─── */
    users: [
      { id:'u-owner',  nama:'Owner',      role:'owner',   entity:'HQ', pin:'1234' },
      { id:'u-man-sb', nama:'Manajer SB', role:'manajer', entity:'SB', pin:'1111' },
      { id:'u-man-dr', nama:'Manajer DR', role:'manajer', entity:'DR', pin:'2222' },
      { id:'u-man-ay', nama:'Manajer AY', role:'manajer', entity:'AY', pin:'3333' },
      { id:'u-man-pk', nama:'Manajer PK', role:'manajer', entity:'PK', pin:'4444' },
    ],
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
const brg      = id => S.barang.find(b => b.id === id);
const brgKode  = k  => S.barang.find(b => b.kode === k);
const totBuy   = p => sum(p.items, i => i.qty * i.harga);
const totSell  = p => sum(p.items, i => i.qty * i.harga);
const hppSell  = p => sum(p.items, i => i.qty * (i.hpp || 0));
const nilaiStok = () => sum(S.barang, b => b.stok * (b.hargaBeli || 0));
const piutang  = () => sum(S.penjualan.filter(p => p.status !== 'lunas'), totSell);
const hutang   = () => sum(S.pembelian.filter(p => p.status !== 'lunas'), totBuy);

function labaRugi(){
  const pend  = sum(S.penjualan, totSell);
  const hpp   = sum(S.penjualan, hppSell);
  const beban = sum(
    Object.values(S.kasKecil.perEntity || {})
      .flatMap(x => x.mutasi || [])
      .filter(m => m.keluar),
    m => m.keluar
  );
  const kotor = pend - hpp;
  return { pend, hpp, kotor, beban, bersih: kotor - beban };
}

function neraca(){
  const aset = totalKas() + totalKK() + piutang() + nilaiStok();
  const liab = hutang();
  return { aset, liab, ekuitas: aset - liab };
}

function statsLini(){
  const r = {};
  Object.keys(LINI).forEach(k =>
    r[k] = { pend:0, hpp:0, margin:0, beli:0, jual:0, stok:0, kritis:0 });

  S.penjualan.forEach(p => p.items.forEach(it => {
    const b = brg(it.barangId); if (!b) return;
    const l = r[b.lini]; if (!l) return;
    l.pend += it.qty * it.harga;
    l.hpp  += it.qty * (it.hpp || 0);
    l.jual += it.qty;
  }));
  S.pembelian.forEach(p => p.items.forEach(it => {
    const b = brg(it.barangId); if (!b) return;
    const l = r[b.lini]; if (!l) return;
    l.beli += it.qty * it.harga;
  }));
  S.barang.forEach(b => {
    const l = r[b.lini]; if (!l) return;
    l.stok += b.stok * (b.hargaBeli || 0);
    if (b.stok <= 5) l.kritis++;
  });
  Object.keys(r).forEach(k => r[k].margin = r[k].pend - r[k].hpp);
  return r;
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
  Object.entries(S.kasKecil.perEntity || {}).forEach(([ent, obj]) => {
    (obj.mutasi || []).forEach(m => {
      if (m.masuk) J.push({ tgl:m.tgl, ref:'KK-' + ent,
        ket:'Isi kas kecil', d:'Kas Kecil', k:'Kas', j:m.masuk });
      if (m.keluar) J.push({ tgl:m.tgl, ref:'KK-' + ent,
        ket:'Kas kecil keluar', d:'Beban', k:'Kas Kecil', j:m.keluar });
    });
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
  const syEl = $('#sy'), cnEl = $('#cn');
  if (!syEl) return;
  if (!hasUrl()){
    syEl.textContent = '';
    if (cnEl) cnEl.textContent = '';
    return;
  }
  const isDemo = getUrl() === 'DEMO';
  const n = getQueue().length;
  const online = navigator.onLine;
  if (cnEl) cnEl.textContent = isDemo ? '🎬 Mode demo'
    : online ? '🟢 Online' : '🔴 Offline · lokal';
  syEl.textContent = isDemo
    ? 'Menampilkan data contoh — siap dipakai'
    : n ? '· ' + n + ' perubahan menunggu sync'
        : '· tersinkron otomatis';
}

/* ═══════════════════════════════════════════════════════════════
   BOOTSTRAP SYNC
   ═══════════════════════════════════════════════════════════════ */
async function bootstrapSync(){
  if (!hasUrl() || getUrl() === 'DEMO') return;
  if (!navigator.onLine){
    toast('Offline — data akan disync otomatis saat online');
    return;
  }
  toast('Memuat dari Google Sheet…');
  try {
    const pullUrl = getUrl() + '?action=pull&key=' + encodeURIComponent(API_KEY);
    const res = await fetch(pullUrl);
    const txt = await res.text();
    let json;
    try { json = JSON.parse(txt); }
    catch(e){
      console.warn('Response bukan JSON:', txt.slice(0, 300));
      throw new Error('Sheet response tidak valid');
    }

    if (json && json.ok && json.data){
      const d = json.data;
      const adaIsi =
        (d.barang && d.barang.length) ||
        (d.supplier && d.supplier.length) ||
        (d.pelanggan && d.pelanggan.length) ||
        (d.pembelian && d.pembelian.length) ||
        (d.penjualan && d.penjualan.length);

      if (adaIsi){
        if (d.barang && d.barang.length)    S.barang     = d.barang;
        if (d.supplier)                      S.supplier   = d.supplier;
        if (d.pelanggan)                     S.pelanggan  = d.pelanggan;
        if (d.pembelian)                     S.pembelian  = d.pembelian;
        if (d.penjualan)                     S.penjualan  = d.penjualan;
        if (d.pembayaran)                    S.pembayaran = d.pembayaran;
        if (d.penerimaan)                    S.penerimaan = d.penerimaan;
        if (d.permintaan)                    S.permintaan = d.permintaan;
        if (d.pesanan)                       S.pesanan    = d.pesanan;
        if (d.users && d.users.length)       S.users      = d.users;
        if (d.kk && d.kk.length){
          // d.kk = array mutasi → kelompokkan per entity
          const per = {};
          d.kk.forEach(m => {
            const e = m.entity || 'HQ';
            if (!per[e]) per[e] = { saldo:0, mutasi:[] };
            per[e].mutasi.push(m);
            per[e].saldo += (m.masuk || 0) - (m.keluar || 0);
          });
          S.kasKecil.perEntity = per;
        }
        persist();
        refreshAll();
        localStorage[K_BOOT] = '1';
        toast('✓ Data dimuat dari Sheet');
        return;
      }
    }
    pushAllToSheet();
  } catch(e){
    console.warn('Bootstrap pull gagal:', e);
    pushAllToSheet();
  }
}

function pushAllToSheet(){
  let count = 0;
  const push = (type, record) => {
    if (!record || !record.id) return;
    queue({ type, action: 'upsert', record });
    count++;
  };
  S.barang.forEach(b => push('barang', b));
  (S.supplier || []).forEach(s => push('supplier', s));
  (S.pelanggan || []).forEach(p => push('pelanggan', p));
  S.pembelian.forEach(p => push('pembelian', p));
  S.penjualan.forEach(p => push('penjualan', p));
  (S.pembayaran || []).forEach(p => push('pembayaran', p));
  (S.penerimaan || []).forEach(p => push('penerimaan', p));
  (S.permintaan || []).forEach(p => push('permintaan', p));
  (S.pesanan || []).forEach(p => push('pesanan', p));
  Object.values(S.kasKecil.perEntity || {}).forEach(obj =>
    (obj.mutasi || []).forEach(m => push('kk', m))
  );
  localStorage[K_BOOT] = '1';
  if (count > 0) toast('⬆ Mengirim ' + count + ' data ke Sheet…');
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
  if (!hasUrl()){ renderWelcome(); return; }
  if (!isLoggedIn()){ renderLogin(); return; }
  if (!canAccess(id)){
    toast('Akses ditolak', 'error');
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
    supplier:  () => typeof renderSupplier === 'function' && renderSupplier(),
    pelanggan: () => typeof renderPelanggan === 'function' && renderPelanggan(),
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
    home:1, dashboard:1, barang:1, supplier:1, pelanggan:1,
    pembelian:1, penjualan:1, pembayaran:1, penerimaan:1,
    kaskecil:1, permintaan:1, pesanan:1, stok:1, jurnal:1,
  }).forEach(refreshView);
  updateStatus();
}

/* ═══════════════════════════════════════════════════════════════
   HOME
   ═══════════════════════════════════════════════════════════════ */
function renderHome(){
  const u = currentUser();
  if (!u) return;
  const e = entInfo(u.entity);
  const ico = document.getElementById('uc-ico');
  const nm  = document.getElementById('uc-nama');
  const inf = document.getElementById('uc-info');
  if (ico) ico.textContent = e.ico;
  if (nm)  nm.textContent  = u.nama;
  if (inf) inf.textContent = `${u.role.toUpperCase()} · ${e.nama}`;
}

/* ═══════════════════════════════════════════════════════════════
   WELCOME / CONNECT
   ═══════════════════════════════════════════════════════════════ */
function renderWelcome(){
  const w = document.getElementById('welcome');
  if (!w) return;
  const m = document.getElementById('m');
  const nav = document.getElementById('nav');
  if (m) m.style.display = 'none';
  if (nav) nav.style.display = 'none';
  w.style.display = 'block';
  w.innerHTML = `<div class="card welcome">
    <div class="ico">🌱</div>
    <h2>Selamat Datang di IMB</h2>
    <p>PT. Insan Muda Berdikari<br>
    Sistem manajemen terpadu untuk 4 lini usaha:<br>
    🍓 Stroberi · 🥛 Dairy · 🐔 Ayam · 🌾 Pakan Ayam</p>
    <button class="btn-big" onclick="connect()">Mulai</button>
    <div class="feats">
      <b>✓ Tanpa daftar</b> — langsung pakai<br>
      <b>✓ Bisa offline</b> — data tersimpan lokal<br>
      <b>✓ Sinkron otomatis</b> — ke Google Sheet<br>
      <b>✓ Install sebagai app</b> — dari browser HP
    </div>
  </div>`;
}

function hideWelcome(){
  const w = document.getElementById('welcome');
  const m = document.getElementById('m');
  const nav = document.getElementById('nav');
  if (w){ w.style.display = 'none'; w.innerHTML = ''; }
  if (m) m.style.display = 'block';
  if (nav) nav.style.display = 'flex';
}

function connect(){
  localStorage[K_URL] = DEFAULT_URL;
  toast('Menyambungkan…');
  boot();
  setTimeout(() => bootstrapSync(), 600);
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
  const md = $('#modal');
  if (md) md.onclick = e => { if (e.target.id === 'modal') closeModal(); };
});

/* ═══════════════════════════════════════════════════════════════
   ITEM ROW
   ═══════════════════════════════════════════════════════════════ */
function optBarang(filter, selectedKode){
  return S.barang
    .filter(b => {
      if (!filter) return true;
      if (Array.isArray(filter)) return filter.includes(b.lini);
      return b.tipe === filter;
    })
    .map(b => `<option value="${b.id}" ${b.kode === selectedKode ? 'selected' : ''}>${esc(b.kode)} · ${esc(b.nama)}</option>`)
    .join('');
}
function itemRow(prefix, filter, selectedKode){
  return `<div class="irow">
    <select class="${prefix}-brg">${optBarang(filter, selectedKode)}</select>
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
    if (!seen){ localStorage.app_v = String(j.v); return 'first'; }
    if (String(j.v) !== String(seen)){
      localStorage.app_v = String(j.v);
      return String(j.v);
    }
    if (!silent) toast('✓ Sudah versi terbaru');
    return 'latest';
  } catch(e){
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
  if (r === 'error'){ toast('Gagal cek update', 'error'); return; }
  if (r === 'first' || r === 'latest'){ toast('✓ Sudah versi terbaru'); return; }
  toast('🔄 Versi baru ' + r + ' · memuat ulang…');
  setTimeout(hardReset, 800);
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
  updateStatus(); toast('Kembali online'); flush();
});
window.addEventListener('offline', () => {
  updateStatus(); toast('Mode offline', 'error');
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden){ flush(); checkUpdate(true); }
});

const _api = new URLSearchParams(location.search).get('api');
if (_api){
  localStorage[K_URL] = _api;
  history.replaceState(null, '', location.pathname);
}
if (new URLSearchParams(location.search).get('fresh')){
  history.replaceState(null, '', location.pathname);
}

/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
function boot(){
  if (!hasUrl()){ renderWelcome(); return; }
  if (!isLoggedIn()){ renderLogin(); return; }

  hideWelcome();
  renderNav();
  updateStatus();

  // Sembunyikan view yang role-nya tidak boleh
  $$('.view').forEach(v => {
    const id = v.id.replace('v-', '');
    if (!canAccess(id)) v.style.display = 'none';
  });

  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + view));
  refreshAll();
}

window.bootApp = boot;
