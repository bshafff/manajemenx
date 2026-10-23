/* ═══════════════════════════════════════════════════════════════
   FARM — Backup/Restore · Kartu Stok · Produksi (WO) · Panen · Kandang
   Data baru disimpan lokal (S.produksi, S.panen, S.kandang, S.kandangLog).
   Set SYNC_NEW = true SETELAH Apps Script punya handler untuk tipe:
   produksi, panen, kandang, kandangLog (kalau belum, antrean sync macet).
   ═══════════════════════════════════════════════════════════════ */
const SYNC_NEW = true;
function farmQueue(type, action, rec, id){
  if (!SYNC_NEW) return;
  queue(action === 'delete' ? { type, action, id } : { type, action, record: rec });
}
['produksi','panen','kandang','kandangLog'].forEach(k => { if (!Array.isArray(S[k])) S[k] = []; });

const num = id => +document.getElementById(id).value || 0;
const val = id => document.getElementById(id).value.trim();
const entOpts = (sel) => Object.values(ENTITIES).map(e =>
  `<option value="${e.kode}" ${e.kode===sel?'selected':''}>${e.ico} ${e.nama}</option>`).join('');
const defEnt = (d) => { const a = activeEntity(); return a === 'ALL' ? d : a; };
const brgOpts = (ent, tipe, sel) => S.barang
  .filter(b => (!ent || b.lini === ent || b.lini === 'HQ') && (!tipe || b.tipe === tipe))
  .map(b => `<option value="${b.id}" ${b.id===sel?'selected':''}>${esc(b.kode)} · ${esc(b.nama)} (${b.stok} ${esc(b.satuan)})</option>`).join('');
const statBox = (l, v, d, c) => `<div class="stat ${c||''}"><div class="l">${l}</div><div class="v">${v}</div>${d?`<div class="d">${d}</div>`:''}</div>`;

/* ═════════ BACKUP & RESTORE ═════════ */
function backupData(){
  const blob = new Blob([JSON.stringify({ app:'imb', v:1, tgl:new Date().toISOString(), data:S })],
    { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `imb-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('✓ Backup diunduh');
}
function restoreData(){
  const u = currentUser();
  if (!u || u.role !== 'owner') return toast('Restore hanya untuk owner', 'error');
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try {
      const j = JSON.parse(await inp.files[0].text());
      const d = j.data || j;
      if (!Array.isArray(d.barang) || !d.entities || !d.kasKecil) throw new Error('Format backup tidak dikenali');
      if (!confirm('Restore akan MENIMPA semua data di perangkat ini. Lanjutkan?')) return;
      Object.keys(S).forEach(k => delete S[k]);
      Object.assign(S, d);
      ['produksi','panen','kandang','kandangLog'].forEach(k => { if (!Array.isArray(S[k])) S[k] = []; });
      persist(); refreshAll();
      toast('✓ Data dipulihkan (lokal). Sheet tidak diubah.');
    } catch (e){ toast('Gagal restore: ' + e.message, 'error'); }
  };
  inp.click();
}

/* ═════════ KARTU STOK (diturunkan dari dokumen, selalu konsisten) ═════════ */
function stokMovements(bid){
  const mv = [];
  const pick = (list, f) => (list || []).forEach(d => f(d));
  pick(S.pembelian, p => p.items.forEach(i => i.barangId === bid &&
    mv.push({ tgl:p.tgl, ref:p.no, ket:'Pembelian ' + (p.supplier||''), q:+i.qty })));
  pick(S.penjualan, p => p.items.forEach(i => i.barangId === bid &&
    mv.push({ tgl:p.tgl, ref:p.no, ket:'Penjualan ' + (p.pelanggan||''), q:-i.qty })));
  pick(S.produksi, w => {
    w.bahan.forEach(i => i.barangId === bid && mv.push({ tgl:w.tgl, ref:w.no, ket:'Bahan produksi ' + w.nama, q:-i.qty }));
    w.output.forEach(i => i.barangId === bid && mv.push({ tgl:w.tgl, ref:w.no, ket:'Hasil produksi ' + w.nama, q:+i.qty }));
  });
  pick(S.panen, h => (h.items || []).forEach(i => i.barangId === bid &&
    mv.push({ tgl:h.tgl, ref:'PANEN', ket:`Panen ${h.batch||''} grade ${i.grade}`, q:+i.qty })));
  return mv.sort((a,b) => (a.tgl||'').localeCompare(b.tgl||''));
}
function kartuStok(bid){
  const b = brg(bid); if (!b) return;
  const mv = stokMovements(bid);
  const awal = b.stok - sum(mv, m => m.q);
  let saldo = awal;
  const rows = mv.map(m => { saldo += m.q; return `<tr><td>${dmy(m.tgl)}</td><td>${esc(m.ref)}</td><td>${esc(m.ket)}</td>
    <td class="num pos">${m.q>0?m.q:''}</td><td class="num neg">${m.q<0?-m.q:''}</td><td class="num"><b>${+saldo.toFixed(3)}</b></td></tr>`; }).join('');
  openModal('📜 Kartu Stok', `${b.kode} · ${b.nama} (${b.satuan})`,
    `<div class="table-wrap"><table><thead><tr><th>Tgl</th><th>Ref</th><th>Ket</th><th class="num">Masuk</th><th class="num">Keluar</th><th class="num">Saldo</th></tr></thead>
    <tbody><tr><td colspan="5"><i>Saldo awal / penyesuaian manual</i></td><td class="num"><b>${+awal.toFixed(3)}</b></td></tr>${rows}</tbody></table></div>
    <div class="hint">Stok sekarang: <b>${b.stok} ${esc(b.satuan)}</b></div>`, closeModal, 'Tutup');
}

/* ═════════ PRODUKSI / WORK ORDER ═════════ */
let _woEnt = 'DR';
function woRow(kind, ent){
  const t = kind === 'bahan' ? '' : 'jadi';
  return `<div class="form-grid wo-${kind}" style="grid-template-columns:2fr 1fr auto;align-items:end">
    <select>${brgOpts(ent, t)}</select><input type="number" step="any" placeholder="Qty">
    <button class="ibtn" onclick="this.parentNode.remove()">🗑️</button></div>`;
}
function woAdd(kind){
  document.getElementById('wo-' + kind).insertAdjacentHTML('beforeend', woRow(kind, val('wo-ent')));
}
function woEntChange(){ ['bahan','output'].forEach(k => document.getElementById('wo-'+k).innerHTML = ''); }
function woNew(){
  const e = defEnt('DR');
  openModal('🏭 Work Order Baru', 'Bahan keluar stok → barang jadi masuk stok', `
    <div class="form-grid">
      <div><label>Nama batch / produk</label><input id="wo-nama" placeholder="Yogurt plain batch 12"></div>
      <div><label>Tanggal</label><input id="wo-tgl" type="date" value="${today()}"></div>
      <div><label>Lini</label><select id="wo-ent" onchange="woEntChange()">${entOpts(e)}</select></div>
      <div><label>Biaya kerja/overhead (Rp)</label><input id="wo-biaya" type="number" value="0"></div>
    </div>
    <label>Bahan terpakai</label><div id="wo-bahan">${woRow('bahan', e)}</div>
    <button class="btn btn-s btn-sm" onclick="woAdd('bahan')">+ Bahan</button>
    <label style="margin-top:10px">Hasil jadi</label><div id="wo-output">${woRow('output', e)}</div>
    <button class="btn btn-s btn-sm" onclick="woAdd('output')">+ Hasil</button>`, woSave, 'Proses');
}
function woRead(kind){
  const rows = [...document.querySelectorAll('.wo-' + kind)].map(r => ({
    barangId: r.querySelector('select').value, qty: +r.querySelector('input').value || 0 })).filter(x => x.barangId && x.qty > 0);
  const m = {}; rows.forEach(x => m[x.barangId] = (m[x.barangId]||0) + x.qty);
  return Object.entries(m).map(([barangId, qty]) => ({ barangId, qty }));
}
function woSave(){
  const nama = val('wo-nama'), entity = val('wo-ent'), tgl = val('wo-tgl'), biaya = num('wo-biaya');
  const bahan = woRead('bahan'), output = woRead('output');
  if (!nama) return toast('Nama batch wajib diisi', 'error');
  if (!bahan.length || !output.length) return toast('Isi minimal 1 bahan dan 1 hasil', 'error');
  for (const x of bahan){ const b = brg(x.barangId);
    if (x.qty > b.stok) return toast(`Stok ${b.nama} cuma ${b.stok}`, 'error'); }
  
  bahan.forEach(x => { x.hpp = stokKeluar(x.barangId, x.qty); });
  const total = sum(bahan, x => x.qty * x.hpp) + biaya;
  const qOut = sum(output, x => x.qty), hppUnit = total / qOut;
  output.forEach(x => { x.hppUnit = hppUnit; stokMasuk(x.barangId, x.qty, hppUnit); });
  
  // Gunakan genDocNo
  const rec = { id: uid(), no: genDocNo('WO'), tgl, entity, nama, bahan, output, biaya, totalHpp: total, hppUnit };
  
  S.produksi.unshift(rec);
  recalcStok();
  persist(); farmQueue('produksi', 'upsert', rec);
  closeModal(); renderProduksi(); toast(`✓ WO selesai · HPP ${rp(hppUnit)}/unit`);
}
function woDel(id){
  const w = S.produksi.find(x => x.id === id); if (!w) return;
  for (const o of w.output){ const b = brg(o.barangId);
    if (b && b.stok < o.qty) return toast(`Stok ${b.nama} (${b.stok}) kurang dari hasil WO — sudah terjual/terpakai`, 'error'); }
  if (!confirm('Hapus WO? Stok bahan dikembalikan, stok hasil dikurangi.')) return;
  w.bahan.forEach(x => { const b = brg(x.barangId); if (b) b.stok += x.qty; });
  w.output.forEach(x => { const b = brg(x.barangId); if (b) b.stok -= x.qty; });
  S.produksi = S.produksi.filter(x => x.id !== id);
  recalcStok();
  persist(); farmQueue('produksi', 'delete', null, id); renderProduksi(); toast('Dihapus');
}
function renderProduksi(){
  const el = document.getElementById('prod-root'); if (!el) return;
  const list = S.produksi.filter(entityFilter);
  const bln = today().slice(0,7);
  const nm = id => (brg(id) || {}).nama || '?';
  el.innerHTML = `<div class="grid">${statBox('WO bulan ini', list.filter(w => (w.tgl||'').startsWith(bln)).length, '', 'blue')}
    ${statBox('Total HPP bulan ini', rp(sum(list.filter(w => (w.tgl||'').startsWith(bln)), w => w.totalHpp)), '', 'gold')}</div>
    <div class="card"><div class="card-header-flex"><h3>🏭 Produksi</h3>
      <button class="btn btn-p btn-sm" onclick="woNew()">+ Work Order</button></div>
    ${!list.length ? '<div class="empty"><span class="e">🏭</span>Belum ada work order.</div>' :
    `<div class="table-wrap"><table><thead><tr><th>No</th><th>Tgl</th><th>Batch</th><th>Bahan → Hasil</th><th class="num">HPP/unit</th><th></th></tr></thead><tbody>
    ${list.slice(0, 40).map(w => `<tr><td><b>${esc(w.no)}</b><br>${entInfo(w.entity).ico}</td><td>${dmy(w.tgl)}</td><td>${esc(w.nama)}</td>
      <td>${w.bahan.map(x => `${esc(nm(x.barangId))} ${x.qty}`).join(', ')}<br>→ <b>${w.output.map(x => `${esc(nm(x.barangId))} ${x.qty}`).join(', ')}</b></td>
      <td class="num">${rp(w.hppUnit)}</td><td class="tb-actions"><button class="ibtn" onclick="woDel('${w.id}')">🗑️</button></td></tr>`).join('')}
    </tbody></table></div>`}</div>`;
}

/* ═════════ PANEN STROBERI ═════════ */
function panenNew(){
  const sb = S.barang.filter(b => b.lini === 'SB' && b.tipe === 'jadi');
  const opt = '<option value="">— tidak dicatat —</option>' + brgOpts('SB', 'jadi');
  if (!sb.length) return toast('Tambah dulu barang jadi lini SB di menu Barang', 'error');
  openModal('🍓 Catat Panen', 'Hasil panen langsung masuk stok barang jadi', `
    <div class="form-grid">
      <div><label>Tanggal</label><input id="pn2-tgl" type="date" value="${today()}"></div>
      <div><label>Batch / blok</label><input id="pn2-batch" placeholder="GH1 · Blok A"></div>
      <div><label>Barang Grade A</label><select id="pn2-ba">${opt}</select></div>
      <div><label>Kg Grade A</label><input id="pn2-qa" type="number" step="any" value="0"></div>
      <div><label>Barang Grade B</label><select id="pn2-bb">${opt}</select></div>
      <div><label>Kg Grade B</label><input id="pn2-qb" type="number" step="any" value="0"></div>
      <div><label>HPP/kg (opsional)</label><input id="pn2-hpp" type="number" value="0"></div>
    </div>`, panenSave, 'Simpan');
}
function panenSave(){
  const items = [];
  [['A','pn2-ba','pn2-qa'],['B','pn2-bb','pn2-qb']].forEach(([g, s, q]) => {
    const bid = val(s), qty = num(q);
    if (bid && qty > 0) items.push({ grade: g, barangId: bid, qty });
  });
  if (!items.length) return toast('Isi minimal satu grade (barang + kg)', 'error');
  const hpp = num('pn2-hpp');
  items.forEach(i => stokMasuk(i.barangId, i.qty, hpp));
  const rec = { id: uid(), tgl: val('pn2-tgl'), entity: 'SB', batch: val('pn2-batch'), items, hpp };
  S.panen.unshift(rec);
  recalcStok();
  persist(); farmQueue('panen', 'upsert', rec);
  closeModal(); renderPanen(); toast('✓ Panen dicatat, stok bertambah');
}
function panenDel(id){
  const h = S.panen.find(x => x.id === id); if (!h) return;
  for (const i of h.items){ const b = brg(i.barangId);
    if (b && b.stok < i.qty) return toast(`Stok ${b.nama} (${b.stok}) kurang dari hasil panen — sudah terjual`, 'error'); }
  if (!confirm('Hapus catatan panen? Stok dikurangi.')) return;
  h.items.forEach(i => { const b = brg(i.barangId); if (b) b.stok -= i.qty; });
  S.panen = S.panen.filter(x => x.id !== id);
  recalcStok();
  persist(); farmQueue('panen', 'delete', null, id); renderPanen(); toast('Dihapus');
}
function renderPanen(){
  const el = document.getElementById('panen-root'); if (!el) return;
  const list = S.panen.filter(entityFilter);
  const bln = list.filter(h => (h.tgl||'').startsWith(today().slice(0,7)));
  const kg = (arr, g) => sum(arr, h => sum(h.items.filter(i => !g || i.grade === g), i => i.qty));
  const tot = kg(bln), a = kg(bln, 'A');
  el.innerHTML = `<div class="grid">${statBox('Panen bulan ini', +tot.toFixed(1) + ' kg', '', 'red')}
    ${statBox('Grade A', tot ? Math.round(a / tot * 100) + '%' : '-', +a.toFixed(1) + ' kg A · ' + +(tot - a).toFixed(1) + ' kg B', 'gold')}</div>
    <div class="card"><div class="card-header-flex"><h3>🍓 Panen Stroberi</h3>
      <button class="btn btn-p btn-sm" onclick="panenNew()">+ Catat Panen</button></div>
    ${!list.length ? '<div class="empty"><span class="e">🍓</span>Belum ada catatan panen.</div>' :
    `<div class="table-wrap"><table><thead><tr><th>Tgl</th><th>Batch</th><th class="num">A (kg)</th><th class="num">B (kg)</th><th></th></tr></thead><tbody>
    ${list.slice(0, 40).map(h => `<tr><td>${dmy(h.tgl)}</td><td>${esc(h.batch)}</td>
      <td class="num">${+kg([h],'A').toFixed(1)}</td><td class="num">${+kg([h],'B').toFixed(1)}</td>
      <td class="tb-actions"><button class="ibtn" onclick="panenDel('${h.id}')">🗑️</button></td></tr>`).join('')}
    </tbody></table></div>`}</div>`;
}

/* ═════════ KANDANG AYAM ═════════ */
function kdNew(){
  openModal('🐔 Kandang / Siklus Baru', 'DOC masuk', `<div class="form-grid">
    <div><label>Nama kandang</label><input id="kd-nama" placeholder="Kandang 1"></div>
    <div><label>Tgl DOC masuk</label><input id="kd-tgl" type="date" value="${today()}"></div>
    <div><label>Populasi awal (ekor)</label><input id="kd-pop" type="number" value="0"></div>
    <div><label>Strain / catatan</label><input id="kd-strain" placeholder="Broiler / Layer ..."></div></div>`, () => {
    const pop = num('kd-pop');
    if (!val('kd-nama') || pop <= 0) return toast('Nama & populasi wajib', 'error');
    const rec = { id: uid(), entity: 'AY', nama: val('kd-nama'), tglMasuk: val('kd-tgl'), popAwal: pop, strain: val('kd-strain'), status: 'aktif' };
    S.kandang.unshift(rec); persist(); farmQueue('kandang', 'upsert', rec);
    closeModal(); renderKandang(); toast('✓ Kandang ditambahkan');
  });
}
function kdLogNew(kid){
  const aktif = S.kandang.filter(k => k.status === 'aktif');
  if (!aktif.length) return toast('Belum ada kandang aktif', 'error');
  openModal('📝 Catatan Harian', '', `<div class="form-grid">
    <div><label>Kandang</label><select id="kl-k">${aktif.map(k => `<option value="${k.id}" ${k.id===kid?'selected':''}>${esc(k.nama)}</option>`).join('')}</select></div>
    <div><label>Tanggal</label><input id="kl-tgl" type="date" value="${today()}"></div>
    <div><label>Mati (ekor)</label><input id="kl-mati" type="number" value="0"></div>
    <div><label>Afkir (ekor)</label><input id="kl-afkir" type="number" value="0"></div>
    <div><label>Pakan (kg)</label><input id="kl-pakan" type="number" step="any" value="0"></div>
    <div><label>Berat rata-rata (gram)</label><input id="kl-bb" type="number" value="0"></div>
    <div><label>Panen (ekor)</label><input id="kl-pe" type="number" value="0"></div>
    <div><label>Panen (kg total)</label><input id="kl-pk" type="number" step="any" value="0"></div>
    </div><div class="form-grid" style="grid-template-columns:1fr"><div><label>Catatan</label><input id="kl-ket"></div></div>`, () => {
    const rec = { id: uid(), kandangId: val('kl-k'), tgl: val('kl-tgl'), mati: num('kl-mati'), afkir: num('kl-afkir'),
      pakanKg: num('kl-pakan'), bb: num('kl-bb'), panenEkor: num('kl-pe'), panenKg: num('kl-pk'), ket: val('kl-ket') };
    S.kandangLog.unshift(rec); persist(); farmQueue('kandangLog', 'upsert', rec);
    closeModal(); renderKandang(); toast('✓ Dicatat');
  });
}
function kdStat(k){
  const L = S.kandangLog.filter(l => l.kandangId === k.id);
  const mati = sum(L, l => l.mati), afkir = sum(L, l => l.afkir), pe = sum(L, l => l.panenEkor);
  const pop = k.popAwal - mati - afkir - pe;
  const pakan = sum(L, l => l.pakanKg), panenKg = sum(L, l => l.panenKg);
  const lastBB = (L.filter(l => l.bb > 0).sort((a,b) => b.tgl.localeCompare(a.tgl))[0] || {}).bb || 0;
  const biomassa = pop * lastBB / 1000 + panenKg;
  const umur = Math.max(0, Math.floor((Date.now() - new Date(k.tglMasuk)) / 864e5));
  return { pop, mati, mortPct: k.popAwal ? mati / k.popAwal * 100 : 0, pakan, lastBB, panenKg, umur,
    fcr: biomassa > 0 ? pakan / biomassa : 0 };
}
function kdClose(id){
  const k = S.kandang.find(x => x.id === id);
  if (!k || !confirm('Tutup siklus kandang ini?')) return;
  k.status = 'selesai'; persist(); farmQueue('kandang', 'upsert', k); renderKandang();
}
function kdLogDel(id){
  if (!confirm('Hapus catatan ini?')) return;
  S.kandangLog = S.kandangLog.filter(l => l.id !== id);
  persist(); farmQueue('kandangLog', 'delete', null, id); renderKandang();
}
function renderKandang(){
  const el = document.getElementById('kandang-root'); if (!el) return;
  const ks = S.kandang.filter(entityFilter);
  el.innerHTML = `<div class="card"><div class="card-header-flex"><h3>🐔 Kandang Ayam</h3>
    <button class="btn btn-p btn-sm" onclick="kdNew()">+ Kandang</button></div>
    ${!ks.length ? '<div class="empty"><span class="e">🐔</span>Belum ada kandang.</div>' : ''}</div>
    ${ks.map(k => { const s = kdStat(k); return `<div class="card">
      <div class="card-header-flex"><h3>${esc(k.nama)} <span class="tag ${k.status==='aktif'?'t-ok':'t-warn'}">${k.status}</span></h3>
        <div>${k.status==='aktif' ? `<button class="btn btn-p btn-sm" onclick="kdLogNew('${k.id}')">+ Harian</button>
          <button class="btn btn-s btn-sm" onclick="kdClose('${k.id}')">Tutup</button>` : ''}</div></div>
      <div class="hint">${esc(k.strain)} · DOC ${dmy(k.tglMasuk)} · umur ${s.umur} hari</div>
      <div class="grid">${statBox('Populasi', fmt(s.pop), 'dari ' + fmt(k.popAwal) + ' ekor', 'blue')}
        ${statBox('Mortalitas', s.mortPct.toFixed(1) + '%', fmt(s.mati) + ' ekor', 'red')}
        ${statBox('Pakan total', +s.pakan.toFixed(1) + ' kg', s.lastBB ? 'BB terakhir ' + s.lastBB + ' g' : '', 'gold')}
        ${statBox('FCR (estimasi)', s.fcr ? s.fcr.toFixed(2) : '-', 'panen ' + +s.panenKg.toFixed(1) + ' kg', 'pur')}</div>
      <div class="table-wrap"><table><thead><tr><th>Tgl</th><th class="num">Mati</th><th class="num">Pakan</th><th class="num">BB</th><th class="num">Panen</th><th></th></tr></thead><tbody>
      ${S.kandangLog.filter(l => l.kandangId === k.id).slice(0, 10).map(l => `<tr><td>${dmy(l.tgl)}</td><td class="num">${l.mati + l.afkir}</td>
        <td class="num">${l.pakanKg||''}</td><td class="num">${l.bb||''}</td><td class="num">${l.panenEkor ? l.panenEkor + ' / ' + l.panenKg + 'kg' : ''}</td>
        <td class="tb-actions"><button class="ibtn" onclick="kdLogDel('${l.id}')">🗑️</button></td></tr>`).join('')}
      </tbody></table></div></div>`; }).join('')}`;
}
Object.assign(window, { backupData, restoreData, kartuStok, woNew, woAdd, woEntChange, woSave, woDel, panenNew, panenSave, panenDel,
  kdNew, kdLogNew, kdClose, kdLogDel, renderProduksi, renderPanen, renderKandang });
