function renderPembelian(){
  const el = document.getElementById('pembelian-list');
  if (!el) return;
  if (!S.pembelian.length){
    el.innerHTML = `<div class="empty"><span class="e">🛒</span>Belum ada pembelian</div>`;
    return;
  }
  el.innerHTML = S.pembelian.map(p => `
    <div class="list-item">
      <div class="li-head">
        <b>${esc(p.no)}</b>
        <span class="tag ${p.status==='lunas'?'t-ok':'t-warn'}">${p.status}</span>
        <span class="spacer"></span>
        <b>${rp(totBuy(p))}</b>
        <button class="ibtn" onclick="delBuy('${p.id}')">🗑️</button>
      </div>
      <div class="hint">${dmy(p.tgl)} · ${esc(p.supplier||'-')}</div>
      <table style="margin-top:6px">
        ${p.items.map(i => { const b = brg(i.barangId); return `<tr>
          <td>${b ? esc(b.nama) : '—'}</td>
          <td class="num">${i.qty} × ${rp(i.harga)}</td>
          <td class="num"><b>${rp(i.qty*i.harga)}</b></td>
        </tr>`; }).join('')}
      </table>
    </div>`).join('');
}

function addBuy(){
  openModal('Faktur Pembelian', 'Stok bertambah otomatis', `
    <div class="grid">
      <div><label>No. Faktur</label>
        <input id="f-no" value="PB-${Date.now().toString().slice(-6)}"></div>
      <div><label>Tanggal</label>
        <input id="f-tgl" type="date" value="${today()}"></div>
    </div>
    <label>Supplier</label>
    <input id="f-sup" placeholder="Nama supplier">
    <label>Status</label>
    <select id="f-status">
      <option value="lunas">Lunas (kas berkurang)</option>
      <option value="hutang">Hutang</option>
    </select>
    <label>Barang Terbeli</label>
    <div id="rows">${itemRow('i', null)}</div>
    <button class="btn btn-s btn-sm" onclick="addRow('rows','i')">＋ Tambah Baris</button>
  `, () => {
    const items = readRows('i');
    if (!items.length) return toast('Minimal 1 barang', 'error');
    const total = items.reduce((a,x) => a + x.qty*x.harga, 0);
    const p = {
      id: uid(),
      no: document.getElementById('f-no').value,
      tgl: document.getElementById('f-tgl').value,
      supplier: document.getElementById('f-sup').value,
      status: document.getElementById('f-status').value,
      items,
    };
    items.forEach(x => stokMasuk(x.barangId, x.qty, x.harga));
    if (p.status === 'lunas') S.kas -= total;
    S.pembelian.unshift(p);
    persist();
    queue({ type: 'pembelian', action: 'upsert', record: p });
    closeModal(); renderPembelian(); toast('Pembelian disimpan');
  });
}

function delBuy(id){
  if (!confirm('Hapus faktur pembelian? Stok dikembalikan.')) return;
  const p = S.pembelian.find(x => x.id === id);
  if (p) p.items.forEach(i => { const b = brg(i.barangId); if (b) b.stok -= i.qty; });
  S.pembelian = S.pembelian.filter(x => x.id !== id);
  persist();
  queue({ type: 'pembelian', action: 'delete', id });
  renderPembelian(); toast('Dihapus');
}
