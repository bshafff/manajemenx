function renderPenerimaanBarang(){
  const el = document.getElementById('grn-list'); if (!el) return;
  const list = (S.penerimaanBarang || []).filter(entityFilter).slice(0, 20);
  if (!list.length) { el.innerHTML = `<div class="empty"><span class="e">📥</span>Belum ada penerimaan barang</div>`; return; }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>No GRN</th><th>Tgl</th><th>Supplier</th><th class="num">Total Nilai</th><th></th></tr></thead>
    <tbody>${list.map(p => {
      const total = sum(p.items||[], i => i.qty*i.harga);
      return `<tr>
        <td><b>${esc(p.no)}</b></td><td>${dmy(p.tgl)}</td><td>${esc(p.supplier)}</td>
        <td class="num">${rp(total)}</td>
        <td class="tb-actions"><button class="ibtn" onclick="delGRN('${p.id}')">🗑️</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function editGRN(){
  openModal('📥 Penerimaan Barang', 'Stok akan bertambah otomatis', `
    <div class="form-grid">
      <div><label>Tanggal</label><input id="grn-tgl" type="date" value="${today()}"></div>
      <div><label>Supplier</label><select id="grn-sup">${S.supplier.map(s => `<option value="${s.nama}">${esc(s.nama)}</option>`).join('')}</select></div>
      <div><label>Kantor</label><select id="grn-ent">${visibleEntities().map(k => `<option value="${k}">${entInfo(k).nama}</option>`).join('')}</select></div>
      <div style="grid-column:1/-1"><label>Ref PO (Opsional)</label><select id="grn-po"><option value="">— Tanpa PO —</option>${(S.pesananPembelian||[]).filter(p=>p.status==='open').map(p => `<option value="${p.id}">${esc(p.no)} · ${esc(p.supplier)}</option>`).join('')}</select></div>
    </div>
    <label>Barang Diterima</label>
    <div id="grn-items">
      <div class="irow">
        <select class="grn-brg">${S.barang.map(b => `<option value="${b.id}">${esc(b.nama)}</option>`).join('')}</select>
        <input class="grn-qty" type="number" value="1">
        <input class="grn-hrg" type="number" value="0">
        <button class="x2" onclick="this.parentNode.remove()">✕</button>
      </div>
    </div>
    <button class="btn btn-s btn-sm" onclick="document.getElementById('grn-items').insertAdjacentHTML('beforeend', itemRow('grn'))">+ Baris</button>
  `, () => {
    const tgl = document.getElementById('grn-tgl').value;
    const sup = document.getElementById('grn-sup').value;
    const ent = document.getElementById('grn-ent').value;
    const poId = document.getElementById('grn-po').value;
    const items = [...document.querySelectorAll('#grn-items .irow')].map(r => ({
      barangId: r.querySelector('.grn-brg').value, qty: +r.querySelector('.grn-qty').value || 0, harga: +r.querySelector('.grn-hrg').value || 0
    })).filter(x => x.qty > 0);
    if (!items.length) return toast('Isi minimal 1 barang', 'error');
    
    items.forEach(i => stokMasuk(i.barangId, i.qty, i.harga));
    const total = sum(items, i => i.qty * i.harga);
    const rec = { id: uid(), no: genDocNo('GRN'), tgl, entity: ent, supplier: sup, items, poId, total };
    S.penerimaanBarang.unshift(rec);
    
    // Ubah status PO jika ada
    if (poId) {
      const po = S.pesananPembelian.find(x => x.id === poId);
      if (po) { po.status = 'selesai'; queue({ type:'pesananPembelian', action:'upsert', record:po }); }
    }

    recalcStok(); persist(); queue({ type:'penerimaanBarang', action:'upsert', record:rec });

    // POST JURNAL (Dr. Persediaan, Cr. Hutang Belum Difaktur)
    const jLines = [];
    jLines.push({ akun: '1301', debit: total, kredit: 0 });
    jLines.push({ akun: '2002', debit: 0, kredit: total });
    postJournal(tgl, rec.no, `Terima Barang dari ${sup}`, ent, jLines);

    closeModal(); renderPenerimaanBarang(); toast('✓ Barang diterima, Stok bertambah');
  }, 'Simpan GRN');
}

function delGRN(id){
  const p = S.penerimaanBarang.find(x => x.id === id); if (!p) return;
  if (!confirm('Hapus penerimaan ini? Stok akan dikurangi kembali.')) return;
  p.items.forEach(i => { const b = brg(i.barangId); if (b) b.stok -= i.qty; });
  S.penerimaanBarang = S.penerimaanBarang.filter(x => x.id !== id);
  recalcStok(); persist(); queue({ type:'penerimaanBarang', action:'delete', id }); renderPenerimaanBarang(); toast('Dihapus');
}

window.renderPenerimaanBarang = renderPenerimaanBarang; window.editGRN = editGRN; window.delGRN = delGRN;
