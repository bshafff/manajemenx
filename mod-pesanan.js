function renderPesanan(){
  const el = document.getElementById('pesanan-list');
  if (!el) return;
  const list = S.pesanan || [];
  if (!list.length){
    el.innerHTML = `<div class="card"><div class="empty">
      <span class="e">🏭</span>Belum ada work order</div></div>`;
    return;
  }
  el.innerHTML = list.map(p => {
    const bb = sum(p.bahan || [], x => x.qty * (x.harga || 0));
    const hpp = bb + (p.biayaKerja || 0);
    const cls = p.status === 'selesai' ? 't-ok' : p.status === 'proses' ? 't-warn' : 't-inf';
    return `<div class="card">
      <div class="li-head" style="margin-bottom:6px">
        <b>${esc(p.no)}</b>
        <span class="tag ${cls}">${p.status || 'draft'}</span>
        <span class="spacer"></span>
        <b style="color:var(--pur)">HPP ${rp(hpp)}</b>
      </div>
      <div class="hint">${dmy(p.tgl)} · ${esc(p.pelanggan||'-')}</div>
      <div class="btn-row" style="margin-top:11px;margin-bottom:0">
        ${p.status !== 'selesai'
          ? `<button class="btn btn-p btn-sm" onclick="woDone('${p.id}')">✅ Selesaikan</button>` : ''}
        ${p.status === 'draft'
          ? `<button class="btn btn-s btn-sm" onclick="woStart('${p.id}')">▶ Mulai</button>` : ''}
        <button class="btn btn-d btn-sm" onclick="woDel('${p.id}')">🗑️ Hapus</button>
      </div>
    </div>`;
  }).join('');
}

function addPesanan(){
  openModal('Buat Work Order', '', `
    <div class="grid">
      <div><label>No. WO</label>
        <input id="f-no" value="WO-${Date.now().toString().slice(-6)}"></div>
      <div><label>Tanggal</label>
        <input id="f-tgl" type="date" value="${today()}"></div>
    </div>
    <label>Pelanggan / Proyek</label>
    <input id="f-pel">
    <label>Biaya Kerja</label>
    <input id="f-kerja" type="number" value="0">
    <label>Bahan Dipakai</label>
    <div id="rowsB">${itemRow('b', 'bahan')}</div>
    <button class="btn btn-s btn-sm" onclick="addRow('rowsB','b','bahan')">＋ Tambah Bahan</button>
    <label>Output Barang Jadi</label>
    <div id="rowsO">${itemRow('o', 'jadi')}</div>
    <button class="btn btn-s btn-sm" onclick="addRow('rowsO','o','jadi')">＋ Tambah Output</button>
  `, () => {
    const bahan = readRows('b'), output = readRows('o');
    if (!bahan.length || !output.length) return toast('Isi bahan dan output', 'error');
    if (!S.pesanan) S.pesanan = [];
    const rec = {
      id: uid(),
      no: document.getElementById('f-no').value,
      tgl: document.getElementById('f-tgl').value,
      pelanggan: document.getElementById('f-pel').value,
      biayaKerja: +document.getElementById('f-kerja').value || 0,
      status: 'draft',
      bahan, output,
    };
    S.pesanan.unshift(rec);
    persist();
    queue({ type: 'pesanan', action: 'upsert', record: rec });
    closeModal(); renderPesanan(); toast('Work order dibuat');
  });
}

function woStart(id){
  const p = (S.pesanan || []).find(x => x.id === id);
  if (!p) return;
  p.status = 'proses';
  persist();
  queue({ type: 'pesanan', action: 'upsert', record: p });
  renderPesanan(); toast('Proses dimulai');
}
function woDone(id){
  const p = (S.pesanan || []).find(x => x.id === id);
  if (!p) return;
  for (const x of p.bahan || []){
    const b = brg(x.barangId);
    if (b && x.qty > b.stok) return toast(`Stok ${b.nama} tidak cukup`, 'error');
  }
  (p.bahan || []).forEach(x => stokKeluar(x.barangId, x.qty));
  (p.output || []).forEach(x => stokMasuk(x.barangId, x.qty, 0));
  p.status = 'selesai';
  persist();
  queue({ type: 'pesanan', action: 'upsert', record: p });
  renderPesanan(); toast('Selesai — stok diperbarui');
}
function woDel(id){
  if (!confirm('Hapus WO ini?')) return;
  S.pesanan = S.pesanan.filter(x => x.id !== id);
  persist();
  queue({ type: 'pesanan', action: 'delete', id });
  renderPesanan(); toast('Dihapus');
}
