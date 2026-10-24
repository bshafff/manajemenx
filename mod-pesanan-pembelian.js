function renderPesananPembelian(){
  const el = document.getElementById('po-list'); if (!el) return;
  const list = (S.pesananPembelian || []).filter(entityFilter).slice(0, 20);
  if (!list.length) { el.innerHTML = `<div class="empty"><span class="e">📝</span>Belum ada Pesanan Pembelian</div>`; return; }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>No PO</th><th>Tgl</th><th>Supplier</th><th class="num">Total</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(p => {
      const total = sum(p.items||[], i => i.qty*i.harga);
      return `<tr>
        <td><b>${esc(p.no)}</b></td><td>${dmy(p.tgl)}</td><td>${esc(p.supplier)}</td>
        <td class="num">${rp(total)}</td>
        <td><span class="tag ${p.status==='selesai'?'t-ok':'t-warn'}">${p.status}</span></td>
        <td class="tb-actions"><button class="ibtn" onclick="delPO('${p.id}')">🗑️</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function editPO(){
  openModal('📝 Pesanan Pembelian Baru', 'PO tidak menambah stok', `
    <div class="form-grid">
      <div><label>Tanggal</label><input id="po-tgl" type="date" value="${today()}"></div>
      <div><label>Supplier</label><select id="po-sup">${S.supplier.map(s => `<option value="${s.nama}">${esc(s.nama)}</option>`).join('')}</select></div>
      <div><label>Kantor</label><select id="po-ent">${visibleEntities().map(k => `<option value="${k}">${entInfo(k).nama}</option>`).join('')}</select></div>
    </div>
    <label>Barang Dipesan</label>
    <div id="po-items">
      <div class="irow">
        <select class="po-brg">${S.barang.map(b => `<option value="${b.id}">${esc(b.nama)}</option>`).join('')}</select>
        <input class="po-qty" type="number" value="1">
        <input class="po-hrg" type="number" value="0">
        <button class="x2" onclick="this.parentNode.remove()">✕</button>
      </div>
    </div>
    <button class="btn btn-s btn-sm" onclick="document.getElementById('po-items').insertAdjacentHTML('beforeend', itemRow('po'))">+ Baris</button>
  `, () => {
    const tgl = document.getElementById('po-tgl').value;
    const sup = document.getElementById('po-sup').value;
    const ent = document.getElementById('po-ent').value;
    const items = [...document.querySelectorAll('#po-items .irow')].map(r => ({
      barangId: r.querySelector('.po-brg').value, qty: +r.querySelector('.po-qty').value || 0, harga: +r.querySelector('.po-hrg').value || 0
    })).filter(x => x.qty > 0);
    if (!items.length) return toast('Isi minimal 1 barang', 'error');
    
    const rec = { id: uid(), no: genDocNo('PO'), tgl, entity: ent, supplier: sup, items, status: 'open' };
    S.pesananPembelian.unshift(rec);
    persist(); queue({ type:'pesananPembelian', action:'upsert', record:rec });
    closeModal(); renderPesananPembelian(); toast('✓ PO dibuat');
  }, 'Simpan PO');
}

function delPO(id){
  if (!confirm('Hapus PO ini?')) return;
  S.pesananPembelian = S.pesananPembelian.filter(x => x.id !== id);
  persist(); queue({ type:'pesananPembelian', action:'delete', id }); renderPesananPembelian(); toast('Dihapus');
}

window.renderPesananPembelian = renderPesananPembelian; window.editPO = editPO; window.delPO = delPO;
