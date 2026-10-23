/* ═══════════════════════════════════════════════════════════════
   KONFIGURASI
   ═══════════════════════════════════════════════════════════════ */
// URL Baru dari Deploy Ulang Apps Script
const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbwHzvNoZcxGHl84H4lJk8lhDMZy85_Pq58Ea-OFnqjAnQBaguSz7nfNiz2K767Gg1S_/exec';
const API_KEY = 'ERP_2026';
const PPN_DEFAULT = 11;

const LINI = {
  SB: { nama: 'Stroberi',   ico: '🍓', warna: '#dc2626' },
  DR: { nama: 'Dairy',      ico: '🥛', warna: '#2563eb' },
  AY: { nama: 'Ayam',       ico: '🐔', warna: '#b45309' },
  PK: { nama: 'Pakan Ayam', ico: '🌾', warna: '#16a34a' },
};

const CHANNELS = {
  mitra:  { nama:'Mitra / B2B', ico:'🤝' },
  toko:   { nama:'Toko Fisik',  ico:'🏪' },
  online: { nama:'Online',      ico:'🌐' },
  farm:   { nama:'Farm / D2C',  ico:'🚜' },
};

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
const daysBetween = (a,b) => Math.floor((new Date(b) - new Date(a)) / 86400000);

function toast(msg, type, ms){
  const t = $('#st'); if (!t) return;
  t.textContent = msg;
  t.className = type === 'error' ? 'error' : '';
  t.style.display = 'block';
  clearTimeout(window._tt);
  window._tt = setTimeout(() => t.style.display = 'none', ms || 2200);
}

/* ═══════════════════════════════════════════════════════════════
   STORAGE
   ═══════════════════════════════════════════════════════════════ */
const K_URL        = 'erp_url';
const K_DATA       = 'erp_data_v6';
const K_QUEUE      = 'erp_queue_v2';
const K_FAILED     = 'erp_failed';      // operasi yang gagal 5x (tidak memblokir antrian)
const K_BOOT       = 'erp_bootstrapped';
const K_SESSION    = 'erp_session';
const K_ACTIVE_DIV = 'erp_active_div';
const K_SERVER_TIME= 'erp_server_time'; // Waktu terakhir data ditarik dari server (HANYA diisi oleh bootstrapSync)

const getUrl   = () => localStorage[K_URL] || '';
const hasUrl   = () => !!localStorage[K_URL];
const getQueue = () => { try { return JSON.parse(localStorage[K_QUEUE] || '[]'); }
                         catch { return []; } };
const setQueue = q => { localStorage[K_QUEUE] = JSON.stringify(q); updateStatus(); };

const getFailed = () => { try { return JSON.parse(localStorage[K_FAILED] || '[]'); }
                          catch { return []; } };
const failedCount = () => getFailed().length;

/* ═══════════════════════════════════════════════════════════════
   STATE & MIGRATION
   ═══════════════════════════════════════════════════════════════ */
function seed(){
  return {
    entities: {
      HQ: { kas: 0 }, SB: { kas: 0 }, DR: { kas: 0 },
      AY: { kas: 0 }, PK: { kas: 0 },
    },
    kasKecil: {
      perEntity: {
        HQ:{saldo:0,mutasi:[]}, SB:{saldo:0,mutasi:[]}, DR:{saldo:0,mutasi:[]},
        AY:{saldo:0,mutasi:[]}, PK:{saldo:0,mutasi:[]},
      }
    },
    barang: [], supplier: [], pelanggan: [],
    pembelian: [], penjualan: [],
    pembayaran: [], penerimaan: [],
    transfer: [],
    permintaan: [], pesanan: [],
    jurnalUmum: [],
    // Modul Farm
    produksi: [], panen: [], kandang: [], kandangLog: [],
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

function migrate(){
  let changed = false;
  if (!S.entities){
    S.entities = { HQ: { kas: S.kas || 0 }, SB: { kas: 0 }, DR: { kas: 0 }, AY: { kas: 0 }, PK: { kas: 0 } };
    delete S.kas; changed = true;
  }
  ['HQ','SB','DR','AY','PK'].forEach(k => {
    if (!S.entities[k]){ S.entities[k] = { kas: 0 }; changed = true; }
    if (typeof S.entities[k].kas !== 'number'){ S.entities[k].kas = 0; changed = true; }
  });

  if (!S.kasKecil) S.kasKecil = {};
  if (!S.kasKecil.perEntity){
    const per = {};
    ['HQ','SB','DR','AY','PK'].forEach(k => per[k] = { saldo: 0, mutasi: [] });
    if (typeof S.kasKecil.saldo === 'number'){
      per.HQ.saldo = S.kasKecil.saldo || 0;
      per.HQ.mutasi = Array.isArray(S.kasKecil.mutasi)
        ? S.kasKecil.mutasi.map(m => ({ ...m, entity: m.entity || 'HQ' })) : [];
    }
    S.kasKecil = { perEntity: per }; changed = true;
  }
  ['HQ','SB','DR','AY','PK'].forEach(k => {
    if (!S.kasKecil.perEntity[k]){ S.kasKecil.perEntity[k] = { saldo: 0, mutasi: [] }; changed = true; }
    if (!Array.isArray(S.kasKecil.perEntity[k].mutasi)){ S.kasKecil.perEntity[k].mutasi = []; changed = true; }
  });

  ['barang','supplier','pelanggan','pembelian','penjualan','pembayaran','penerimaan','transfer','permintaan','pesanan','jurnalUmum', 'produksi', 'panen', 'kandang', 'kandangLog'].forEach(k => {
    if (!Array.isArray(S[k])){ S[k] = []; changed = true; }
  });

  if (!Array.isArray(S.users) || !S.users.length){
    S.users = [
      { id:'u-owner',  nama:'Owner',      role:'owner',   entity:'HQ', pin:'1234' },
      { id:'u-man-sb', nama:'Manajer SB', role:'manajer', entity:'SB', pin:'1111' },
      { id:'u-man-dr', nama:'Manajer DR', role:'manajer', entity:'DR', pin:'2222' },
      { id:'u-man-ay', nama:'Manajer AY', role:'manajer', entity:'AY', pin:'3333' },
      { id:'u-man-pk', nama:'Manajer PK', role:'manajer', entity:'PK', pin:'4444' },
    ]; changed = true;
  }

  ['pembelian','penjualan','pembayaran','penerimaan','permintaan','pesanan','transfer'].forEach(key => {
    (S[key] || []).forEach(r => { if (!r.entity){ r.entity = 'HQ'; changed = true; } });
  });
  (S.barang || []).forEach(b => {
    if (!b.lini){ b.lini = (b.kode || '').split('-')[0] || 'SB'; if (!LINI[b.lini]) b.lini = 'SB'; changed = true; }
  });

  if (changed){ localStorage[K_DATA] = JSON.stringify(S); }
}
migrate();

function persist(){
  localStorage[K_DATA] = JSON.stringify(S);
  updateStatus();
}

/* ═══════════════════════════════════════════════════════════════
   ENTITY HELPERS
   ═══════════════════════════════════════════════════════════════ */
const ENTITIES = {
  HQ: { kode:'HQ', nama:'Kantor Pusat', ico:'🏢', warna:'#6b7280' },
  SB: { kode:'SB', nama:'Stroberi',     ico:'🍓', warna:'#dc2626' },
  DR: { kode:'DR', nama:'Dairy',        ico:'🥛', warna:'#2563eb' },
  AY: { kode:'AY', nama:'Ayam',         ico:'🐔', warna:'#b45309' },
  PK: { kode:'PK', nama:'Pakan Ayam',   ico:'🌾', warna:'#16a34a' },
};
const entInfo = k => ENTITIES[k] || { kode:k, nama:k||'?', ico:'•', warna:'#888' };

let activeDiv = localStorage[K_ACTIVE_DIV] || 'HQ';

function enterDiv(div){
  activeDiv = div;
  localStorage[K_ACTIVE_DIV] = div;
  view = 'dashboard';
  closeModal();
  window.scrollTo(0,0);
  boot();
}

function exitDiv(){
  activeDiv = 'HQ';
  localStorage[K_ACTIVE_DIV] = 'HQ';
  view = 'home';
  closeModal();
  window.scrollTo(0,0);
  boot();
}

function visibleEntities(){
  const u = typeof currentUser === 'function' ? currentUser() : null;
  if (!u) return [];
  if (u.role === 'owner') return Object.keys(ENTITIES);
  return [u.entity];
}

function activeEntity(){
  const u = typeof currentUser === 'function' ? currentUser() : null;
  if (u && u.role !== 'owner') return u.entity;
  return activeDiv === 'HQ' ? 'ALL' : activeDiv;
}

function entityFilter(x){
  const a = activeEntity();
  if (a === 'ALL') return true;
  return x.entity === a;
}

/* Kas */
function kasOf(k){ return (S.entities[k] && S.entities[k].kas) || 0; }
function addKas(k, d){
  if (!S.entities[k]) S.entities[k] = { kas: 0 };
  S.entities[k].kas += d;
}
function totalKas(){
  return Object.keys(ENTITIES).reduce((s,k) => s + kasOf(k), 0);
}

/* Kas kecil */
function kkOf(k){
  if (!S.kasKecil.perEntity) S.kasKecil.perEntity = {};
  if (!S.kasKecil.perEntity[k]) S.kasKecil.perEntity[k] = { saldo:0, mutasi:[] };
  return S.kasKecil.perEntity[k];
}
function kkSaldo(k){ return kkOf(k).saldo; }
function totalKK(){
  return Object.keys(ENTITIES).reduce((s,k) => s + kkSaldo(k), 0);
}

/* ═══════════════════════════════════════════════════════════════
   BUSINESS LOGIC
   ═══════════════════════════════════════════════════════════════ */
const brg      = id => S.barang.find(b => b.id === id);
const brgKode  = k  => S.barang.find(b => b.kode === k);

function dppOf(p){ return sum(p.items || [], i => i.qty * i.harga); }
function ppnOf(p){ return Math.round(dppOf(p) * (p.ppnPersen || 0) / 100); }
function totSell(p){ return dppOf(p) + ppnOf(p); }
function totBuy(p){  return dppOf(p) + ppnOf(p); }
const hppSell = p => sum(p.items || [], i => i.qty * (i.hpp || 0));
const nilaiStok = () => sum(S.barang, b => b.stok * (b.hargaBeli || 0));

function piutangEnt(kode){
  return sum(S.penjualan.filter(p => (kode === 'ALL' || p.entity === kode) && p.status !== 'lunas'), p => totSell(p) - (p.dibayar || 0));
}
function hutangEnt(kode){
  return sum(S.pembelian.filter(p => (kode === 'ALL' || p.entity === kode) && p.status !== 'lunas'), p => totBuy(p) - (p.dibayar || 0));
}

function labaRugiEnt(kode){
  const filt = x => kode === 'ALL' || x.entity === kode;
  const penj = S.penjualan.filter(filt);
  let kkJ = [];
  if (kode === 'ALL'){
    kkJ = Object.values(S.kasKecil.perEntity || {}).flatMap(x => x.mutasi || []);
  } else {
    kkJ = (S.kasKecil.perEntity?.[kode]?.mutasi) || [];
  }
  const pend  = sum(penj, totSell);
  const hpp   = sum(penj, hppSell);
  const beban = sum(kkJ.filter(m => m.keluar), m => m.keluar);
  const kotor = pend - hpp;
  return { pend, hpp, kotor, beban, bersih: kotor - beban };
}

function neracaEnt(kode){
  const kas = kode === 'ALL' ? totalKas() : kasOf(kode);
  const kk  = kode === 'ALL' ? totalKK()  : kkSaldo(kode);
  const piu = piutangEnt(kode);
  const hut = hutangEnt(kode);
  const stok = sum(S.barang.filter(b => kode === 'ALL' || b.lini === kode), b => b.stok * (b.hargaBeli || 0));
  const aset = kas + kk + piu + stok;
  return { kas, kk, piu, stok, aset, liab: hut, ekuitas: aset - hut };
}

function jurnal(){
  const J = [];
  S.pembelian.forEach(p => J.push({ tgl:p.tgl, ref:p.no, ent:p.entity, ket:'Beli barang', d:'Persediaan', k:'Kas/Hutang', j:totBuy(p) }));
  S.penjualan.forEach(p => {
    J.push({ tgl:p.tgl, ref:p.no, ent:p.entity, ket:'Jual barang', d:'Kas/Piutang', k:'Pendapatan', j:totSell(p) });
    J.push({ tgl:p.tgl, ref:p.no, ent:p.entity, ket:'HPP terjual', d:'HPP', k:'Persediaan', j:hppSell(p) });
  });
  Object.entries(S.kasKecil.perEntity || {}).forEach(([ent, obj]) => {
    (obj.mutasi || []).forEach(m => {
      if (m.masuk) J.push({ tgl:m.tgl, ref:'KK-'+ent, ent, ket:'Isi kas kecil', d:'Kas Kecil', k:'Kas', j:m.masuk });
      if (m.keluar) J.push({ tgl:m.tgl, ref:'KK-'+ent, ent, ket:'Kas kecil keluar', d:'Beban', k:'Kas Kecil', j:m.keluar });
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
   SYNC & STATUS (BATCH + ACK PER ITEM)
   ═══════════════════════════════════════════════════════════════ */
let busy = false;
function trackSync(){ localStorage.last_sync = Date.now(); }
function lastSyncText(){
  const t = localStorage.last_sync;
  if (!t) return '○ Belum tersinkron';
  const d = new Date(+t);
  return '✓ Tersinkron — ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

/* Kunci unik operasi: type|id (untuk menggabungkan upsert ganda) */
const opKey = o => (o.type || '') + '|' + (o.id || (o.record && o.record.id) || '');

function moveToFailed(op, err){
  const f = getFailed();
  delete op._try;
  f.push({ op, err: String(err || ''), at: Date.now() });
  localStorage[K_FAILED] = JSON.stringify(f);
}

/* Kirim ulang operasi yang gagal (bisa dipanggil dari tombol / console) */
function retryFailed(){
  const f = getFailed();
  if (!f.length){ toast('Tidak ada data gagal'); return; }
  const q = getQueue();
  f.forEach(x => { x.op._try = 0; q.push(x.op); });
  localStorage[K_FAILED] = '[]';
  setQueue(q);
  flush();
}

async function flush(){
  const url = getUrl();
  if (!url || url === 'DEMO' || busy || !navigator.onLine) return;
  busy = true;
  updateStatus();

  try {
    while (true){
      const q = getQueue();
      if (!q.length) break;

      // Pastikan tiap operasi punya ID unik (antrian lama belum punya)
      let dirty = false;
      q.forEach(o => { if (!o._q){ o._q = uid(); dirty = true; } });
      if (dirty) setQueue(q);

      // Maksimal 50 operasi per kirim
      const chunk = q.slice(0, 50);
      const payload = { action: 'batch', ops: chunk, key: API_KEY };

      let json = null;
      try {
        const res = await fetch(url, { method:'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify(payload) });
        const txt = await res.text();
        try { json = JSON.parse(txt); } catch(_){ json = null; }
        if (!json || !json.ok || !Array.isArray(json.results)){
          console.error('Sync Server Error:', txt);
          break;
        }
      } catch(e){
        console.error('Network Error:', e);
        break;
      }

      // Hanya operasi yang dibalas ok:true yang dihapus dari antrian
      const acked = new Set();
      const failedMap = new Map();
      chunk.forEach((op, i) => {
        const r = json.results[i];
        if (r && r.ok) acked.add(op._q);
        else failedMap.set(op._q, (r && r.error) || 'tanpa balasan');
      });

      // Baca antrian TERBARU (mungkin sudah ada item baru selama request berjalan)
      const rest = [];
      getQueue().forEach(op => {
        if (acked.has(op._q)) return;
        if (failedMap.has(op._q)){
          op._try = (op._try || 0) + 1;
          if (op._try >= 5){ moveToFailed(op, failedMap.get(op._q)); return; }
        }
        rest.push(op);
      });
      setQueue(rest);

      if (failedMap.size) break; // coba lagi di pemicu berikutnya
    }
    if (!getQueue().length && hasUrl() && getUrl() !== 'DEMO') trackSync();
  } finally {
    busy = false;
    updateStatus();
  }
}

function queue(payload){
  if (!hasUrl() || getUrl() === 'DEMO') return;
  // updatedAt dipakai Stale Guard di Code.gs v2.0
  if (payload.action === 'upsert' && payload.record) {
    payload.record.updatedAt = new Date().toISOString();
  }
  let q = getQueue();
  // Gabungkan: upsert lama untuk record yang sama dibuang, hanya versi terbaru yang dikirim
  if (payload.action === 'upsert' || payload.action === 'delete'){
    const key = opKey(payload);
    q = q.filter(o => !(o.action === 'upsert' && opKey(o) === key));
  }
  payload._q = uid();
  q.push(payload);
  setQueue(q);
  flush();
}

async function sync(){
  if (!hasUrl()){ toast('Belum tersambung','error'); return; }
  if (getUrl() === 'DEMO'){ toast('Mode demo'); return; }
  if (!navigator.onLine){ toast('Offline','error'); return; }
  toast('Menyinkronkan…');
  await flush(); updateStatus();
  if (!getQueue().length) toast('✓ Tersinkron');
}

function updateStatus(){
  const syEl = $('#sy');
  const btnSync = $('#btn-sync');
  if (!syEl) return;

  if (!hasUrl()){
    syEl.textContent = '○ Belum tersambung';
    if (btnSync) btnSync.innerHTML = '↑ Sync';
    return;
  }

  const isDemo = getUrl() === 'DEMO';
  const n = getQueue().length;
  const nf = failedCount();
  const online = navigator.onLine;

  if (isDemo){
    syEl.textContent = '🎬 Mode demo';
    if (btnSync) btnSync.innerHTML = '↑ Sync';
  } else if (!online){
    syEl.textContent = n > 0 ? `🔴 Offline · ${n} data tersimpan lokal` : '🔴 Offline · lokal';
    if (btnSync) btnSync.innerHTML = '↑ Sync';
  } else if (busy) {
    syEl.textContent = `⏳ Menyingkronkan ${n > 0 ? n + ' data' : ''}...`;
    if (btnSync) btnSync.innerHTML = `<span style="display:inline-block; animation:spin 1s linear infinite">↻</span> Sync`;
  } else if (n > 0){
    syEl.textContent = `⏳ ${n} perubahan menunggu sync`;
    if (btnSync) btnSync.innerHTML = '↑ Sync';
  } else if (nf > 0){
    syEl.textContent = `⚠ ${nf} data gagal sync`;
    if (btnSync) btnSync.innerHTML = '↑ Sync';
  } else {
    syEl.textContent = lastSyncText();
    if (btnSync) btnSync.innerHTML = '↑ Sync';
  }
}

/* ═══════════════════════════════════════════════════════════════
   SISTEM UPDATE (Cepat & Responsif)
   ═══════════════════════════════════════════════════════════════ */
let latestVer = null;
let currentVer = localStorage.app_v || '0';

async function checkAppUpdate(isManual = false) {
  const btn = document.getElementById('btn-update');
  if (!btn) return;

  if (isManual) {
    btn.innerHTML = '⏳ Memeriksa...';
    btn.style.cursor = 'wait';
  }

  try {
    const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    const j = await r.json();
    latestVer = String(j.v);

    const todayStr = new Date().toISOString().slice(0,10);
    const elVer = document.getElementById('app-version');
    if (elVer) elVer.textContent = `v${latestVer} · ${todayStr}`;

    if (currentVer === '0') {
      localStorage.app_v = latestVer;
      currentVer = latestVer;
    }

    if (currentVer !== latestVer) {
      btn.innerHTML = `⬇ Update v${latestVer}`;
      btn.style.background = '#2563eb';
      btn.style.color = '#fff';
      btn.style.border = '1px solid #1e40af';
      btn.style.cursor = 'pointer';
      if (isManual) toast('Versi baru tersedia! Klik tombol biru untuk update.');
    } else {
      btn.innerHTML = '⬇ Update';
      btn.style.background = '#e5e7eb';
      btn.style.color = '#374151';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      if (isManual) toast(`✓ Sudah versi terbaru (v${latestVer})`);
    }
  } catch(e) {
    btn.innerHTML = '⬇ Update';
    btn.style.cursor = 'pointer';
    if (isManual) toast('Gagal memeriksa update', 'error');
  }
}

function handleUpdateClick() {
  if (latestVer && currentVer !== latestVer) {
    if (confirm('Versi terbaru v' + latestVer + ' tersedia.\nMuat ulang aplikasi sekarang?')) {
      localStorage.app_v = latestVer;
      hardReset();
    }
  } else {
    checkAppUpdate(true);
  }
}

async function hardReset() {
  toast('Membersihkan cache & memuat ulang...', null, 5000);
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) await reg.unregister();
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch(e) {}

  setTimeout(() => {
    window.location.href = window.location.pathname + '?fresh=' + Date.now();
  }, 800);
}

/* ═══════════════════════════════════════════════════════════════
   BOOTSTRAP (Tarik Data dari Google Sheet - INCREMENTAL)
   ═══════════════════════════════════════════════════════════════ */
async function bootstrapSync(){
  if (!hasUrl() || getUrl() === 'DEMO') return;
  if (!navigator.onLine){ toast('Offline — sync otomatis nanti'); return; }

  // 1) Kirim dulu semua perubahan lokal. Pull TIDAK BOLEH jalan kalau masih ada antrian,
  //    supaya data offline yang belum terkirim tidak tertimpa data dari Sheet.
  await flush();
  if (getQueue().length){
    toast('Masih ada data belum terkirim — tarik data ditunda', 'error');
    return;
  }

  const lastTime = localStorage[K_SERVER_TIME];
  const isFirstPull = !lastTime;

  toast(isFirstPull ? 'Memuat semua data dari Sheet…' : 'Memuat pembaruan dari Sheet…');

  try {
    let url = getUrl() + '?action=pull&key=' + encodeURIComponent(API_KEY);
    if (lastTime){
      // Mundur 5 detik sebagai margin (merge bersifat idempotent, aman bila ada yang terambil ulang)
      const since = new Date(Date.parse(lastTime) - 5000).toISOString();
      url += '&since=' + encodeURIComponent(since);
    }

    const res = await fetch(url);
    const txt = await res.text();
    let json; try { json = JSON.parse(txt); } catch(e){ throw new Error('invalid'); }

    if (!(json && json.ok && json.data)){
      toast('Gagal memuat dari Sheet' + (json && json.error ? ': ' + json.error : ''), 'error');
      return;
    }

    const d = json.data;

    if (isFirstPull) {
      // --- FULL REPLACE (pertama kali tarik data) ---
      const ada = (d.barang?.length) || (d.supplier?.length) || (d.pelanggan?.length) || (d.pembelian?.length) || (d.penjualan?.length);

      if (!ada){
        // Sheet masih kosong → kirim data lokal ke Sheet
        if (json.serverTime) localStorage[K_SERVER_TIME] = json.serverTime;
        pushAllToSheet();
        return;
      }

      if (d.barang?.length)    S.barang     = d.barang;
      if (d.supplier)          S.supplier   = d.supplier;
      if (d.pelanggan)         S.pelanggan  = d.pelanggan;
      if (d.pembelian)         S.pembelian  = d.pembelian;
      if (d.penjualan)         S.penjualan  = d.penjualan;
      if (d.pembayaran)        S.pembayaran = d.pembayaran;
      if (d.penerimaan)        S.penerimaan = d.penerimaan;
      if (d.transfer)          S.transfer   = d.transfer;
      if (d.permintaan)        S.permintaan = d.permintaan;
      if (d.pesanan)           S.pesanan    = d.pesanan;
      if (d.users?.length)     S.users      = d.users;
      if (d.produksi)          S.produksi   = d.produksi;
      if (d.panen)             S.panen      = d.panen;
      if (d.kandang)           S.kandang    = d.kandang;
      if (d.kandangLog)        S.kandangLog = d.kandangLog;

      if (d.kk?.length){
        const per = {};
        ['HQ','SB','DR','AY','PK'].forEach(k => per[k] = { saldo: 0, mutasi: [] });
        d.kk.forEach(m => {
          const e = m.entity || 'HQ';
          if (!per[e]) per[e] = { saldo:0, mutasi:[] };
          per[e].mutasi.push(m);
          per[e].saldo += (m.masuk||0) - (m.keluar||0);
        });
        S.kasKecil.perEntity = per;
      }

    } else {
      // --- INCREMENTAL MERGE (hanya gabungkan data yang berubah) ---
      // Urutan lama dipertahankan; record baru ditaruh di depan (terbaru di atas).
      // Record lokal yang updatedAt-nya lebih baru tidak ditimpa.
      const mergeData = (key, newItems) => {
        if (!newItems || !newItems.length) return;
        if (!Array.isArray(S[key])) S[key] = [];
        const arr = S[key];
        const pos = new Map(arr.map((x, i) => [x.id, i]));
        const fresh = [];
        newItems.forEach(item => {
          const i = pos.get(item.id);
          if (i === undefined){ fresh.push(item); return; }
          const old = arr[i];
          if (old.updatedAt && item.updatedAt && old.updatedAt > item.updatedAt) return;
          arr[i] = item;
        });
        S[key] = fresh.concat(arr);
      };

      mergeData('barang', d.barang);
      mergeData('supplier', d.supplier);
      mergeData('pelanggan', d.pelanggan);
      mergeData('pembelian', d.pembelian);
      mergeData('penjualan', d.penjualan);
      mergeData('pembayaran', d.pembayaran);
      mergeData('penerimaan', d.penerimaan);
      mergeData('transfer', d.transfer);
      mergeData('permintaan', d.permintaan);
      mergeData('pesanan', d.pesanan);
      mergeData('users', d.users);
      mergeData('produksi', d.produksi);
      mergeData('panen', d.panen);
      mergeData('kandang', d.kandang);
      mergeData('kandangLog', d.kandangLog);

      // Merge Kas Kecil
      if (d.kk && d.kk.length) {
        d.kk.forEach(m => {
          const ent = m.entity || 'HQ';
          if (!S.kasKecil.perEntity[ent]) S.kasKecil.perEntity[ent] = {saldo:0, mutasi:[]};
          const per = S.kasKecil.perEntity[ent];
          const idx = per.mutasi.findIndex(x => x.id === m.id);
          if (idx >= 0){
            const old = per.mutasi[idx];
            if (old.updatedAt && m.updatedAt && old.updatedAt > m.updatedAt) return;
            per.mutasi[idx] = m;
          } else per.mutasi.unshift(m);
        });
        Object.keys(S.kasKecil.perEntity).forEach(k => {
          const obj = S.kasKecil.perEntity[k];
          obj.saldo = obj.mutasi.reduce((acc, curr) => acc + ((curr.masuk||0) - (curr.keluar||0)), 0);
        });
      }

      // Tombstone (penghapusan dari device lain)
      if (json.deleted && json.deleted.length) {
        json.deleted.forEach(del => {
          if (S[del.type] && Array.isArray(S[del.type])) {
            S[del.type] = S[del.type].filter(x => x.id !== del.id);
          }
          if (del.type === 'kk') {
            Object.keys(S.kasKecil.perEntity).forEach(k => {
              const obj = S.kasKecil.perEntity[k];
              obj.mutasi = obj.mutasi.filter(x => x.id !== del.id);
              obj.saldo = obj.mutasi.reduce((acc, curr) => acc + ((curr.masuk||0) - (curr.keluar||0)), 0);
            });
          }
        });
      }
    }

    // Simpan serverTime (hanya di sini) agar pull berikutnya incremental
    if (json.serverTime) localStorage[K_SERVER_TIME] = json.serverTime;

    migrate();
    recalcKas();
    persist(); refreshAll();
    trackSync();
    toast('✓ Data disinkronkan dengan Sheet');
  } catch(e){
    // Jangan push otomatis di sini: data lokal akan dianggap "terbaru" dan menimpa Sheet.
    console.warn('pull gagal:', e);
    toast('Gagal memuat dari Sheet', 'error');
  }
}

function pushAllToSheet(){
  if (!hasUrl() || getUrl() === 'DEMO') return;
  const now = new Date().toISOString();
  const ops = [];
  const push = (t, r) => {
    if (r?.id) {
      r.updatedAt = now;
      ops.push({ type:t, action:'upsert', record:r, _q: uid() });
    }
  };
  S.barang.forEach(b => push('barang', b));
  (S.supplier||[]).forEach(s => push('supplier', s));
  (S.pelanggan||[]).forEach(p => push('pelanggan', p));
  S.pembelian.forEach(p => push('pembelian', p));
  S.penjualan.forEach(p => push('penjualan', p));
  (S.pembayaran||[]).forEach(p => push('pembayaran', p));
  (S.penerimaan||[]).forEach(p => push('penerimaan', p));
  (S.transfer||[]).forEach(p => push('transfer', p));
  (S.permintaan||[]).forEach(p => push('permintaan', p));
  (S.pesanan||[]).forEach(p => push('pesanan', p));
  (S.produksi||[]).forEach(p => push('produksi', p));
  (S.panen||[]).forEach(p => push('panen', p));
  (S.kandang||[]).forEach(p => push('kandang', p));
  (S.kandangLog||[]).forEach(p => push('kandangLog', p));
  (S.users||[]).forEach(u => push('users', u));

  Object.values(S.kasKecil.perEntity||{}).forEach(o => (o.mutasi||[]).forEach(m => push('kk', m)));

  // Buang upsert lama di antrian untuk record yang sama (hindari kirim ganda)
  const keys = new Set(ops.map(opKey));
  const q = getQueue().filter(o => !(o.action === 'upsert' && keys.has(opKey(o))));
  persist(); // simpan updatedAt yang baru di-stamp
  setQueue(q.concat(ops));
  localStorage[K_BOOT] = '1';
  if (ops.length) {
    toast('⬆ Mengirim ' + ops.length + ' data…');
    flush();
  }
}

function disconnect(){
  if (!confirm('Putuskan koneksi ke Google Sheet?\nData lokal tetap tersimpan.')) return;
  delete localStorage[K_URL];
  delete localStorage[K_SERVER_TIME];
  toast('Koneksi diputuskan');
  setTimeout(() => location.reload(), 500);
}

async function pullFromSheet(){
  if (!hasUrl()){ toast('Belum tersambung','error'); return; }
  if (getUrl() === 'DEMO'){ toast('Mode demo'); return; }
  if (!navigator.onLine){ toast('Sedang offline','error'); return; }
  toast('Memuat dari Sheet…');
  await bootstrapSync();
  updateStatus();
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGASI
   ═══════════════════════════════════════════════════════════════ */
let view = 'home';

/* Menu "Lainnya" — untuk HP & iPad portrait (nav bawah hanya muat 5 tombol) */
function moreItems(){
  const u = typeof currentUser === 'function' ? currentUser() : null;
  const isOwner = !!u && u.role === 'owner';
  const base = activeDiv === 'HQ' ? [
    { id:'eksekutif', icon:'🧭', label:'Ringkasan Eksekutif' },
    { id:'jurnal',    icon:'📚', label:'Jurnal Global' },
    { id:'supplier',  icon:'🏭', label:'Supplier' },
    { id:'pelanggan', icon:'👥', label:'Pelanggan' },
    { id:'akun',      icon:'👤', label:'Kelola Akun' },
  ] : [
    { id:'pembayaran',icon:'💸', label:'Pembayaran' },
    { id:'kaskecil',  icon:'👛', label:'Kas Kecil' },
    { id:'jurnal',    icon:'📚', label:'Jurnal Divisi' },
  ];
  return base.filter(i => (i.id !== 'akun' || isOwner) && canAccess(i.id));
}

function openMore(){
  const u = currentUser(); if (!u) return;
  const isOwner = u.role === 'owner';
  const row = (ic, label, js) =>
    `<button class="more-item" onclick="${js}"><span class="more-ic">${ic}</span><span class="more-lbl">${esc(label)}</span><span class="more-arrow">›</span></button>`;

  let html = '';
  if (isOwner && activeDiv !== 'HQ') html += row('🏢', 'Kembali ke Pusat', 'closeModal();exitDiv()');
  html += moreItems().map(i => row(i.icon, i.label, `closeModal();openModule('${i.id}')`)).join('');
  if (isOwner && activeDiv === 'HQ'){
    html += '<div class="more-sec">Divisi Usaha</div>' +
      Object.keys(LINI).map(k => row(LINI[k].ico, LINI[k].nama, `closeModal();enterDiv('${k}')`)).join('');
  }
  html += '<div class="more-sec">Akun</div>' + row('🚪', 'Keluar', 'closeModal();logout()');

  $('#mc').innerHTML = `
    <div class="mhead">
      <div><h3>Menu Lainnya</h3><div class="msub">${esc(u.nama)} · ${u.role.toUpperCase()}</div></div>
      <button class="mx" onclick="closeModal()">×</button>
    </div>
    <div class="more-list">${html}</div>`;
  modalOk = null;
  $('#modal').classList.add('show');
}

function renderNav(){
  const nav = $('#nav'); if (!nav) return;

  let navItems = [];
  if (activeDiv === 'HQ') {
    navItems = [
      { id:'home', icon:'🏠', label:'Home' },
      { id:'dashboard', icon:'📊', label:'Pusat' },
      { id:'barang', icon:'📦', label:'Master' }
    ];
  } else {
    navItems = [
      { id:'dashboard', icon:'📊', label:'Dasbor' },
      { id:'penjualan', icon:'🧾', label:'Jual' },
      { id:'pembelian', icon:'🛒', label:'Beli' },
      { id:'penerimaan', icon:'💰', label:'Kas' }
    ];
  }

  const moreOn = moreItems().some(i => i.id === view);
  nav.innerHTML = navItems.map(n =>
    `<button data-t="${n.id}" class="${n.id===view?'on':''}" onclick="openModule('${n.id}')">
       <span class="ic">${n.icon}</span>${n.label}
     </button>`
  ).join('') +
  `<button data-t="more" class="${moreOn?'on':''}" onclick="openMore()">
     <span class="ic">⋯</span>Lainnya
   </button>`;
}

function renderSidebar(){
  const el = document.getElementById('sidebar');
  if (!el) return;
  const u = typeof currentUser === 'function' ? currentUser() : null;
  if (!u) return;
  const e = entInfo(u.entity);

  let menuHtml = '';
  if (activeDiv === 'HQ') {
    menuHtml = `
      <div class="sb-section">Kantor Pusat</div>
      <div class="sb-item ${view==='home'?'on':''}" onclick="openModule('home')"><span class="sb-ic">🏠</span><span class="sb-lbl">Home</span></div>
      <div class="sb-item ${view==='dashboard'?'on':''}" onclick="openModule('dashboard')"><span class="sb-ic">📊</span><span class="sb-lbl">Dashboard Konsolidasi</span></div>
      <div class="sb-item ${view==='eksekutif'?'on':''}" onclick="openModule('eksekutif')"><span class="sb-ic">🧭</span><span class="sb-lbl">Ringkasan Eksekutif</span></div>
      <div class="sb-item ${view==='jurnal'?'on':''}" onclick="openModule('jurnal')"><span class="sb-ic">📚</span><span class="sb-lbl">Jurnal Global</span></div>

      <div class="sb-section">Master Data</div>
      <div class="sb-item ${view==='barang'?'on':''}" onclick="openModule('barang')"><span class="sb-ic">📦</span><span class="sb-lbl">Barang</span></div>
      <div class="sb-item ${view==='supplier'?'on':''}" onclick="openModule('supplier')"><span class="sb-ic">🏭</span><span class="sb-lbl">Supplier</span></div>
      <div class="sb-item ${view==='pelanggan'?'on':''}" onclick="openModule('pelanggan')"><span class="sb-ic">👥</span><span class="sb-lbl">Pelanggan</span></div>

      <div class="sb-section">Divisi Usaha</div>
      ${Object.keys(LINI).map(k => {
        const d = LINI[k];
        return `<div class="sb-item" onclick="enterDiv('${k}')">
          <span class="sb-ic">${d.ico}</span>
          <span class="sb-lbl">${d.nama}</span>
          <span class="sb-arrow">›</span>
        </div>`;
      }).join('')}

      ${u.role === 'owner' ? `
      <div class="sb-section">Sistem & Pengaturan</div>
      <div class="sb-item ${view==='akun'?'on':''}" onclick="openModule('akun')"><span class="sb-ic">👤</span><span class="sb-lbl">Kelola Akun</span></div>
      ` : ''}
    `;
  } else {
    const d = entInfo(activeDiv);
    menuHtml = `
      <div class="sb-back" onclick="exitDiv()">← Kembali ke Pusat</div>
      <div class="sb-section" style="color:${d.warna}">${d.ico} Divisi ${d.nama}</div>

      <div class="sb-item ${view==='dashboard'?'on':''}" onclick="openModule('dashboard')"><span class="sb-ic">📊</span><span class="sb-lbl">Dashboard</span></div>

      <div class="sb-section">Transaksi</div>
      <div class="sb-item ${view==='penjualan'?'on':''}" onclick="openModule('penjualan')"><span class="sb-ic">🧾</span><span class="sb-lbl">Faktur Jual</span></div>
      <div class="sb-item ${view==='pembelian'?'on':''}" onclick="openModule('pembelian')"><span class="sb-ic">🛒</span><span class="sb-lbl">Faktur Beli</span></div>
      <div class="sb-item ${view==='penerimaan'?'on':''}" onclick="openModule('penerimaan')"><span class="sb-ic">💰</span><span class="sb-lbl">Penerimaan</span></div>
      <div class="sb-item ${view==='pembayaran'?'on':''}" onclick="openModule('pembayaran')"><span class="sb-ic">💸</span><span class="sb-lbl">Pembayaran</span></div>
      <div class="sb-item ${view==='kaskecil'?'on':''}" onclick="openModule('kaskecil')"><span class="sb-ic">👛</span><span class="sb-lbl">Kas Kecil</span></div>

      <div class="sb-section">Laporan</div>
      <div class="sb-item ${view==='jurnal'?'on':''}" onclick="openModule('jurnal')"><span class="sb-ic">📚</span><span class="sb-lbl">Jurnal Divisi</span></div>
    `;
  }

  el.innerHTML = `
    <div class="sb-head">
      <div class="sb-logo" style="background:${activeDiv==='HQ'?'#2d5016':entInfo(activeDiv).warna}">
        ${activeDiv==='HQ'?'🌱':entInfo(activeDiv).ico}
      </div>
      <div class="sb-title">
        <b>${activeDiv==='HQ'?'IMB Pusat':entInfo(activeDiv).nama}</b>
        <span>PT. Insan Muda Berdikari</span>
      </div>
    </div>
    <div class="sb-nav">${menuHtml}</div>
    <div class="sb-foot">
      <div class="sb-user">
        <div class="sb-user-ico">${e.ico}</div>
        <div class="sb-user-info"><b>${esc(u.nama)}</b><span>${u.role.toUpperCase()}</span></div>
        <button class="sb-logout" onclick="logout()">Keluar</button>
      </div>
    </div>`;
}

function openModule(id){
  if (!hasUrl()){ renderWelcome(); return; }
  if (!isLoggedIn()){ renderLogin(); return; }
  if (!canAccess(id)){ toast('Akses ditolak','error'); return; }
  view = id;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + id));
  renderNav();
  renderSidebar();
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
    jurnal:    () => typeof renderJurnal === 'function' && renderJurnal(),
    akun:      () => typeof renderAkun === 'function' && renderAkun(),
    eksekutif: () => typeof renderEksekutif === 'function' && renderEksekutif(),
    produksi:  () => typeof renderProduksi === 'function' && renderProduksi(),
    panen:     () => typeof renderPanen === 'function' && renderPanen(),
    kandang:   () => typeof renderKandang === 'function' && renderKandang(),
  };
  if (map[id]) map[id]();
}

function refreshAll(){
  Object.keys({
    home:1, dashboard:1, barang:1, supplier:1, pelanggan:1, pembelian:1, penjualan:1, pembayaran:1, penerimaan:1, kaskecil:1, jurnal:1, akun:1, eksekutif:1, produksi:1, panen:1, kandang:1
  }).forEach(refreshView);
  updateStatus();
  renderSidebar();
}

/* ═══════════════════════════════════════════════════════════════
   HOME
   ═══════════════════════════════════════════════════════════════ */
function renderHome(){
  const u = currentUser(); if (!u) return;
  const e = entInfo(u.entity);

  const ico = document.getElementById('uc-ico');
  const nm  = document.getElementById('uc-nama');
  const inf = document.getElementById('uc-info');
  if (ico) ico.textContent = e.ico;
  if (nm)  nm.textContent  = u.nama;
  if (inf) inf.textContent = `${u.role.toUpperCase()} · ${e.nama}`;

  const divGrid = document.getElementById('home-div-grid');
  if (divGrid) {
    divGrid.innerHTML = Object.keys(LINI).map(k => {
      const d = LINI[k];
      return `<div class="div-card" onclick="enterDiv('${k}')" style="border-top: 4px solid ${d.warna}">
        <div class="div-card-ico">${d.ico}</div>
        <div class="div-card-name">${d.nama}</div>
        <div class="div-card-sub">Masuk ke Divisi →</div>
      </div>`;
    }).join('');
  }

  const sysMenu = document.getElementById('sys-menu');
  const sysLabel = document.getElementById('sys-label');
  if (u.role === 'owner') {
    if (sysMenu) sysMenu.style.display = '';
    if (sysLabel) sysLabel.style.display = '';
  } else {
    if (sysMenu) sysMenu.style.display = 'none';
    if (sysLabel) sysLabel.style.display = 'none';
  }

  if (typeof applyMenuAccess === 'function') applyMenuAccess();
}

function hideWelcome(){
  const w = document.getElementById('welcome');
  const m = document.getElementById('m');
  const nav = document.getElementById('nav');
  const sb = document.getElementById('sidebar');
  const hb = document.getElementById('hdr-btns');
  if (w){ w.style.display='none'; w.innerHTML=''; }
  if (m) m.style.display = 'block';
  if (nav) nav.style.display = 'flex';
  if (sb) sb.style.display = '';
  if (hb) hb.style.display = 'flex';
}

/* ═══════════════════════════════════════════════════════════════
   MODAL, ITEM ROW & AUTO UPDATE
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
function closeModal(){ $('#modal').classList.remove('show'); modalOk = null; }
document.addEventListener('DOMContentLoaded', () => {
  const md = $('#modal');
  if (md) md.onclick = e => { if (e.target.id === 'modal') closeModal(); };
});

function optBarang(filter, selectedKode){
  return S.barang
    .filter(b => !filter || (Array.isArray(filter) ? filter.includes(b.lini) : b.tipe === filter))
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
  return [...document.querySelectorAll('.irow')]
    .filter(r => r.querySelector('.' + prefix + '-brg'))
    .map(r => ({
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
    $('#ib')?.remove();
  });
});
window.addEventListener('appinstalled', () => $('#ib')?.remove());
if (/iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(matchMedia('(display-mode: standalone)').matches || navigator.standalone)){
  window.addEventListener('load', () => showInstall('⬇ Cara pasang di iPhone', () => {
    alert('Buka lewat Safari → Bagikan → "Tambah ke Layar Utama".');
  }));
}

window.addEventListener('online', () => { updateStatus(); toast('Online'); flush(); });
window.addEventListener('offline', () => { updateStatus(); toast('Offline','error'); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden){
    flush();
    checkAppUpdate(false);
  }
});

const _api = new URLSearchParams(location.search).get('api');
if (_api){ localStorage[K_URL] = _api; history.replaceState(null,'',location.pathname); }
if (new URLSearchParams(location.search).get('fresh'))
  history.replaceState(null,'',location.pathname);

function boot(){
  if (!hasUrl()){ localStorage[K_URL] = DEFAULT_URL; }

  if (!isLoggedIn()){
    if (typeof renderLogin === 'function') renderLogin();
    return;
  }

  const u = currentUser();
  if (u.role !== 'owner') {
    activeDiv = u.entity;
  } else if (!localStorage[K_ACTIVE_DIV]) {
    activeDiv = 'HQ';
  }

  hideWelcome();
  renderNav();
  renderSidebar();
  updateStatus();

  $$('.view').forEach(v => {
    const id = v.id.replace('v-','');
    if (!canAccess(id)) v.style.display = 'none';
  });
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + view));

  refreshAll();

  checkAppUpdate(false);
}
window.bootApp = boot;

/* ═══════════════════════════════════════════════════════════════
   BACKUP & RESTORE (Khusus IMB ERP)
   ═══════════════════════════════════════════════════════════════ */
function backupAllData() {
  try {
    const data = {
      _app: 'IMB_ERP',
      _version: '1.0',
      _exported_at: new Date().toISOString(),
      state: S
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];

    link.href = URL.createObjectURL(blob);
    link.download = `Backup_IMB_${today}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);

    toast('✅ File backup berhasil didownload');
  } catch (err) {
    console.error(err);
    toast('Gagal backup: ' + err.message, 'error');
  }
}

function restoreAllData(input) {
  const file = input.files[0];
  if (!file) return;

  if (!confirm('⚠️ PERINGATAN!\n\nRestore data akan MENGHAPUS semua data lokal saat ini dan menimpanya dengan data dari file backup.\n\nLanjutkan?')) {
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.state) {
        throw new Error('Format file tidak dikenali. Pastikan ini file backup IMB ERP.');
      }

      S = data.state;
      migrate();
      persist();

      // Kirim hasil restore ke Sheet agar tidak hilang saat pull berikutnya
      // (K_SERVER_TIME sengaja TIDAK dihapus supaya pull berikutnya tetap inkremental)
      pushAllToSheet();

      toast('✅ Data berhasil direstore! Memuat ulang aplikasi...');
      setTimeout(() => {
        location.reload();
      }, 1500);

    } catch (err) {
      console.error(err);
      toast('Gagal restore: ' + err.message, 'error');
      input.value = '';
    }
  };
  reader.readAsText(file);
}

/* ═══════════════════════════════════════════════════════════════
   PEMULIHAN KAS DARI RIWAYAT TRANSAKSI
   ═══════════════════════════════════════════════════════════════ */
function recalcKas(){
  const kas = {};
  Object.keys(ENTITIES).forEach(k => kas[k] = 0);
  const add = (e, v) => { const k = e || 'HQ'; kas[k] = (kas[k] || 0) + v; };
  const totalFaktur = p => {
    const dpp = sum(p.items || [], i => i.qty * i.harga);
    return dpp + (p.ppnPersen ? Math.round(dpp * p.ppnPersen / 100) : 0);
  };

  const bayarKeFaktur = {};
  (S.pembayaran || []).forEach(b => {
    add(b.entity, -(b.jumlah || 0));
    (b.fakturLinks || []).forEach(l => bayarKeFaktur[l.id] = (bayarKeFaktur[l.id] || 0) + l.jumlah);
  });
  S.pembelian.forEach(p => {
    const total = totalFaktur(p);
    const paid = p.dibayar != null ? p.dibayar : (p.status === 'lunas' ? total : 0);
    add(p.entity, -Math.max(0, paid - (bayarKeFaktur[p.id] || 0)));
  });

  const terimaKeFaktur = {};
  (S.penerimaan || []).forEach(t => {
    add(t.entity, t.jumlah || 0);
    (t.fakturLinks || []).forEach(l => terimaKeFaktur[l.id] = (terimaKeFaktur[l.id] || 0) + l.jumlah);
  });
  S.penjualan.forEach(p => {
    const total = totalFaktur(p);
    const paid = p.dibayar != null ? p.dibayar : (p.status === 'lunas' ? total : 0);
    add(p.entity, Math.max(0, paid - (terimaKeFaktur[p.id] || 0)));
  });

  Object.entries(S.kasKecil.perEntity || {}).forEach(([e, o]) =>
    (o.mutasi || []).forEach(m => add(e, (m.keluar || 0) - (m.masuk || 0))));

  Object.keys(kas).forEach(k => {
    if (!S.entities[k]) S.entities[k] = { kas: 0 };
    S.entities[k].kas = kas[k];
  });
}
