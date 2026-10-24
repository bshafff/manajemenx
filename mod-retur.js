function renderRetur(){
  const el = document.getElementById('retur-list'); if (!el) return;
  const list = (S.retur || []).filter(entityFilter).slice(0, 20);
  if (!list.length) { el.innerHTML = `<div class="empty"><span class="e">↩️</span>Belum ada riwayat retur</div>`; return; }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Tgl</th><th>Tipe</th><th>Pihak</th><th class="num">Total</th><th></th></tr></thead>
    <tbody>${list.map(p => {
      const total = sum(p.items||[], i => i.qty*i.harga);
      return `<tr>
        <td>${dmy(p.tgl)}</td>
        <td><span class="tag ${p.type==='beli'?'t-warn':'t-inf'}">${p.type === 'beli' ? 'Retur Beli' : 'Retur Jual'}</span></td>
        <td>${esc(p.pihak)}</td>
        <td class="num">${rp(total)}</td>
        <td class="tb-actions"><button class="ibtn" onclick="delRetur('${p.id}')">🗑️</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function editRetur(type){
  const isBeli = type === 'beli';
  openModal(isBeli ? '↩️ Retur Pembelian' : '↩️ Retur Penjualan', isBeli ? 'Kembalikan barang ke Supplier' : 'Terima kembali barang dari Pelanggan', `
    <div class="form-grid">
      <div><label>Tanggal</label><input id="ret-tgl" type="date" value="${today()}"></div>
      <div><label>${isBeli ? 'Supplier' : 'Pelanggan'}</label>
        <select id="ret-pihak">${(isBeli ? S.supplier : S.pelanggan).map(s => `<option value="${s.nama}">${esc(s.nama)}</option>`).join('')}</select>
      </div>
      <div><label>Kantor</label><select id="ret-ent">${visibleEntities().map(k => `<option value="${k}">${entInfo(k).nama}</option>`).join('')}</select></div>
    </div>
    <label>Barang Diretur</label>
    <div id="ret-items">
      <div class="irow">
        <select class="ret-brg">${S.barang.map(b => `<option value="${b.id}">${esc(b.nama)}</option>`).join('')}</select>
        <input class="ret-qty" type="number" value="1">
        <input class="ret-hrg" type="number" value="0">
        <button class="x2" onclick="this.parentNode.remove()">✕</button>
      </div>
    </div>
    <button class="btn btn-s btn-sm" onclick="document.getElementById('ret-items').insertAdjacentHTML('beforeend', itemRow('ret'))">+ Baris</button>
  `, () => {
    const tgl = document.getElementById('ret-tgl').value;
    const pihak = document.getElementById('ret-pihak').value;
    const ent = document.getElementById('ret-ent').value;
    const items = [...document.querySelectorAll('#ret-items .irow')].map(r => ({
      barangId: r.querySelector('.ret-brg').value, qty: +r.querySelector('.ret-qty').value || 0, harga: +r.querySelector('.ret-hrg').value || 0
    })).filter(x => x.qty > 0);
    if (!items.length) return toast('Isi minimal 1 barang', 'error');

    if (isBeli) {
      items.forEach(i => { const b = brg(i.barangId); if (b) b.stok -= i.qty; });
    } else {
      items.forEach(i => { const b = brg(i.barangId); if (b) b.stok += i.qty; });
    }

    const total = sum(items, i => i.qty * i.harga);
    const rec = { id: uid(), no: genDocNo(isBeli ? 'RB' : 'RJ'), tgl, entity: ent, type, pihak, items };
    S.retur.unshift(rec);
    recalcStok(); persist(); queue({ type:'retur', action:'upsert', record:rec });

    const jLines = [];
    if (isBeli) {
      // Dr. Hutang, Cr. Persediaan
      jLines.push({ akun: '2001', debit: total, kredit: 0 });
      jLines.push({ akun: '1301', debit: 0, kredit: total });
    } else {
      // Dr. Pendapatan, Cr. Piutang (dan Dr. Persediaan, Cr. HPP)
      jLines.push({ akun: '4001', debit: total, kredit: 0 });
      jLines.push({ akun: '1201', debit: 0, kredit: total });
      const hppTotal = sum(items, i => { const b = brg(i.barangId); return i.qty * (b ? b.hargaBeli : 0); });
      if (hppTotal > 0) {
        jLines.push({ akun: '1301', debit: hppTotal, kredit: 0 });
        jLines.push({ akun: '5001', debit: 0, kredit: hppTotal });
      }
    }
    postJournal(tgl, rec.no, `Retur ${isBeli ? 'Beli' : 'Jual'} - ${pihak}`, ent, jLines);

    closeModal(); renderRetur(); toast('✓ Retur disimpan');
  }, 'Simpan Retur');
}

function delRetur(id){
  const p = S.retur.find(x => x.id === id); if (!p) return;
  if (!confirm('Hapus retur ini? Stok akan dikembalikan ke kondisi semula.')) return;
  if (p.type === 'beli') p.items.forEach(i => { const b = brg(i.barangId); if (b) b.stok += i.qty; });
  else p.items.forEach(i => { const b = brg(i.barangId); if (b) b.stok -= i.qty; });
  S.retur = S.retur.filter(x => x.id !== id);
  recalcStok(); persist(); queue({ type:'retur', action:'delete', id }); renderRetur(); toast('Dihapus');
}

window.renderRetur = renderRetur; window.editRetur = editRetur; window.delRetur = delRetur;
