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
