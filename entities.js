/* ═══════════════════════════════════════════════════════════════
   ENTITIES — 5 entitas (HQ + 4 lini operasional)
   ═══════════════════════════════════════════════════════════════ */

const ENTITIES = {
  HQ: { kode:'HQ', nama:'Kantor Pusat',  ico:'🏢', warna:'#6b7280' },
  SB: { kode:'SB', nama:'Stroberi',      ico:'🍓', warna:'#dc2626' },
  DR: { kode:'DR', nama:'Dairy',         ico:'🥛', warna:'#2563eb' },
  AY: { kode:'AY', nama:'Ayam',          ico:'🐔', warna:'#b45309' },
  PK: { kode:'PK', nama:'Pakan Ayam',    ico:'🌾', warna:'#16a34a' },
};

/* ─── Info entity ─── */
const entInfo = k => ENTITIES[k] || { kode:k, nama:k||'?', ico:'•', warna:'#888' };

/* ─── Entitas yang user boleh lihat ─── */
function visibleEntities(){
  const u = currentUser();
  if (!u) return [];
  if (u.role === 'owner') return Object.keys(ENTITIES);
  return [u.entity];
}

/* ─── Kas per entitas ─── */
function kasOf(kode){ return (S.entities[kode] && S.entities[kode].kas) || 0; }
function addKas(kode, delta){
  if (!S.entities[kode]) S.entities[kode] = { kas: 0 };
  S.entities[kode].kas += delta;
}
function totalKas(){
  return Object.keys(S.entities).reduce((s,k) => s + kasOf(k), 0);
}

/* ─── Kas kecil per entitas ─── */
function kkOf(kode){
  if (!S.kasKecil.perEntity) S.kasKecil.perEntity = {};
  if (!S.kasKecil.perEntity[kode])
    S.kasKecil.perEntity[kode] = { saldo: 0, mutasi: [] };
  return S.kasKecil.perEntity[kode];
}
function kkSaldo(kode){ return kkOf(kode).saldo; }
function totalKK(){
  return Object.keys(ENTITIES).reduce((s,k) => s + kkSaldo(k), 0);
}

/* ─── Filter records by entity ─── */
function scopeEntity(list){
  const vis = visibleEntities();
  if (vis.length === Object.keys(ENTITIES).length) return list;
  return list.filter(x => vis.includes(x.entity));
}

/* ─── Laba/Rugi per entity ─── */
function labaRugiEnt(kode){
  const filt = x => kode === 'ALL' ? true : x.entity === kode;
  const penjualan = S.penjualan.filter(filt);

  let kkMutar = [];
  if (kode === 'ALL'){
    kkMutar = Object.values(S.kasKecil.perEntity || {})
      .flatMap(x => x.mutasi || []);
  } else {
    kkMutar = (S.kasKecil.perEntity?.[kode]?.mutasi) || [];
  }

  const pend  = sum(penjualan, totSell);
  const hpp   = sum(penjualan, hppSell);
  const beban = sum(kkMutar.filter(m => m.keluar), m => m.keluar);
  const kotor = pend - hpp;
  return { pend, hpp, kotor, beban, bersih: kotor - beban };
}

/* ─── Neraca per entity ─── */
function neracaEnt(kode){
  const filt = x => kode === 'ALL' ? true : x.entity === kode;
  const kas = kode === 'ALL' ? totalKas() : kasOf(kode);
  const kk  = kode === 'ALL' ? totalKK()  : kkSaldo(kode);
  const piu = sum(S.penjualan.filter(p => filt(p) && p.status !== 'lunas'), totSell);
  const hut = sum(S.pembelian.filter(p => filt(p) && p.status !== 'lunas'), totBuy);
  const stok = sum(S.barang.filter(b => kode === 'ALL' || b.entity === kode),
                   b => b.stok * (b.hargaBeli || 0));
  const aset = kas + kk + piu + stok;
  return { kas, kk, piu, stok, aset, liab: hut, ekuitas: aset - hut };
}

/* ─── Entity filter context ─── */
let _activeEntity = 'ALL';
function activeEntity(){
  const u = currentUser();
  if (!u || u.role === 'owner') return _activeEntity;
  return u.entity;
}
function entityFilter(x){
  const ent = activeEntity();
  if (ent === 'ALL') return true;
  return (x.entity || x.lini) === ent;
}
function piutangEnt(kode){
  const filt = p => (kode === 'ALL' || p.entity === kode) && p.status !== 'lunas';
  return sum(S.penjualan.filter(filt), p => totSell(p) - (p.dibayar || 0));
}

/* ─── Entity switcher bar (owner saja) ─── */
function renderEntitySwitcher(){
  let bar = document.getElementById('ent-bar');
  if (!bar){
    bar = document.createElement('div');
    bar.id = 'ent-bar';
    const header = document.querySelector('header');
    header.parentNode.insertBefore(bar, header.nextSibling);
  }
  const u = currentUser();
  if (!u || u.role !== 'owner'){ bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  const opts = [['ALL','🌐','Semua'], ...Object.entries(ENTITIES).map(([k,e]) => [k, e.ico, e.nama])];
  bar.innerHTML = opts.map(([k,ico,nama]) =>
    `<button class="ent-pill ${activeEntity()===k?'on':''}" onclick="setEntity('${k}')">${ico} ${nama}</button>`
  ).join('');
}
function setEntity(k){
  _activeEntity = k;
  renderEntitySwitcher();
  refreshAll();
}
window.setEntity = setEntity;

/* ═══════════════════════════════════════════════════════════════
   PEMULIHAN KAS dari riwayat transaksi
   Kas per entitas hanya tersimpan di perangkat (tidak ada di Sheet).
   Kalau perangkat baru / data browser terhapus, saldo kas dihitung
   ulang dari transaksi yang ditarik dari Sheet.
   ═══════════════════════════════════════════════════════════════ */
function kasKosong(){
  return Object.keys(ENTITIES).every(k => kasOf(k) === 0);
}

function recalcKas(){
  const kas = {};
  Object.keys(ENTITIES).forEach(k => kas[k] = 0);
  const add = (e, v) => { const k = e || 'HQ'; kas[k] = (kas[k] || 0) + v; };
  const totalFaktur = p => {
    const dpp = sum(p.items || [], i => i.qty * i.harga);
    return dpp + (p.ppnPersen ? Math.round(dpp * p.ppnPersen / 100) : 0);
  };

  /* Pembelian: uang keluar saat faktur dibuat (di luar pembayaran susulan) */
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

  /* Penjualan: uang masuk saat faktur dibuat (di luar penerimaan susulan) */
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

  /* Kas kecil: "masuk" mengambil dari kas utama, "keluar" mengembalikan */
  Object.entries(S.kasKecil.perEntity || {}).forEach(([e, o]) =>
    (o.mutasi || []).forEach(m => add(e, (m.keluar || 0) - (m.masuk || 0))));

  Object.keys(kas).forEach(k => {
    if (!S.entities[k]) S.entities[k] = { kas: 0 };
    S.entities[k].kas = kas[k];
  });
}
window.recalcKas = recalcKas;
