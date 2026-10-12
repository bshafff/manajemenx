function renderPenjualan(){
  const el = document.getElementById('penjualan-list');
  if (!el) return;
  if (!S.penjualan.length){
    el.innerHTML = `<div class="empty"><span class="e">🧾</span>Belum ada penjualan</div>`;
    return;
  }
  el.innerHTML = S.penjualan.map(p => {
    const total = totSell(p), hpp = hppSell(p);
    return `<div class="list-item">
      <div class="li-head">
        <b>${esc(p.no)}</b>
        <span class="tag ${p.status==='lunas'?'t-ok':'t-warn'}">${p.status}</span>
        <span class="spacer"></span>
        <b class="pos">${rp(total)}</b>
        <button class="ibtn" onclick="delSell('${p.id}')">🗑️</button>
      </div>
      <div class="hint">${dmy(p.tgl)} · ${esc(p.pelanggan||'-')} ·
        HPP ${rp(hpp)} · Margin ${rp(total-hpp)}</div>
      <table style="margin-top:6px">
        ${p.items.map(i => { const b = brg(i.barangId); return `<tr>
          <td>${b ? esc(b.nama) : '—'}</td>
          <td class="num">${i.qty} × ${rp(i.harga)}</td>
          <td class="num"><b>${rp(i.qty*i.harga)}</b></td>
        </tr>`; }).join('')}
      </table>
    </div>`;
  }).join('');
}

function addSell(){
  openModal('Faktur Penjualan', 'Stok & HPP dihitung otomatis', `
    <div class="grid">
      <div><label>No. Faktur</label>
        <input id="f-no" value="PJ-${Date.now().toString().slice(-6)}"></div>
      <div><label>Tanggal</label>
        <input id="f-tgl" type="date" value="${today()}"></div>
    </div>
    <label>Pelanggan</label>
    <input id="f-pel" placeholder="Nama pelanggan">
    <label>Status</label>
    <select id="f-status">
      <option value="lunas">Lunas (kas bertambah)</option>
      <option value="piutang">Piutang</option>
    </select>
    <label>Barang Terjual</label>
    <div id="rows">${itemRow('o', null)}</div>
    <button class="btn btn-s btn-sm" onclick="addRow('rows','o')">＋ Tambah Baris</button>
  `, () => {
    const items = readRows('o');
    if (!items.length) return toast('Minimal 1 barang', 'error');
    for (const it of items){
      const b = brg(it.barangId);
      if (b && it.qty > b.stok)
        return toast(`Stok ${b.nama} cuma ${b.stok}`, 'error');
    }
    items.forEach(it => { it.hpp = stokKeluar(it.barangId, it.qty); });
    const total = items.reduce((a,x) => a + x.qty*x.harga, 0);
    const p = {
      id: uid(),
      no: document.getElementById('f-no').value,
      tgl: document.getElementById('f-tgl').value,
      pelanggan: document.getElementById('f-pel').value,
      status: document.getElementById('f-status').value,
      items,
    };
    if (p.status === 'lunas') S.kas += total;
    S.penjualan.unshift(p);
    persist();
    queue({ type: 'penjualan', action: 'upsert', record: p });
    closeModal(); renderPenjualan(); toast('Penjualan disimpan');
  });
}

function delSell(id){
  if (!confirm('Hapus faktur penjualan? Stok dikembalikan.')) return;
  const p = S.penjualan.find(x => x.id === id);
  if (p) p.items.forEach(i => { const b = brg(i.barangId); if (b) b.stok += i.qty; });
  S.penjualan = S.penjualan.filter(x => x.id !== id);
  persist();
  queue({ type: 'penjualan', action: 'delete', id });
  renderPenjualan(); toast('Dihapus');
}
