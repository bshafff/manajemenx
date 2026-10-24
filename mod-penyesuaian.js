function renderPenyesuaian(){
  const el = document.getElementById('penyesuaian-list'); if (!el) return;
  const list = (S.penyesuaian || []).filter(entityFilter).slice(0, 50);
  if (!list.length) { el.innerHTML = `<div class="empty"><span class="e">⚙️</span>Belum ada riwayat opname</div>`; return; }
  
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Tgl</th><th>Barang</th><th class="num">Stok Sistem</th><th class="num">Stok Fisik</th><th class="num">Selisih</th><th>Ket</th><th></th></tr></thead>
    <tbody>${list.map(p => {
      const b = brg(p.barangId);
      return `<tr>
        <td>${dmy(p.tgl)}</td>
        <td>${b ? esc(b.nama) : '-'}</td>
        <td class="num">${p.stokSistem}</td>
        <td class="num">${p.stokFisik}</td>
        <td class="num ${p.selisih > 0 ? 'pos' : (p.selisih < 0 ? 'neg' : '')}"><b>${p.selisih > 0 ? '+' : ''}${p.selisih}</b></td>
        <td>${esc(p.ket)}</td>
        <td class="tb-actions"><button class="ibtn" onclick="delPenyesuaian('${p.id}')">🗑️</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function editPenyesuaian(){
  openModal('⚙️ Stok Opname / Penyesuaian', 'Cocokkan stok fisik dengan sistem', `
    <div class="form-grid">
      <div><label>Tanggal</label><input id="pn-tgl" type="date" value="${today()}"></div>
      <div><label>Barang</label>
        <select id="pn-brg" onchange="pnOnBarang()">
          <option value="">— Pilih Barang —</option>
          ${S.barang.map(b => `<option value="${b.id}">${esc(b.kode)} · ${esc(b.nama)}</option>`).join('')}
        </select>
      </div>
      <div><label>Stok Sistem (Auto)</label><input id="pn-sys" type="text" readonly style="background:#f3f4f6"></div>
      <div><label>Stok Fisik (Hitung Manual)</label><input id="pn-fisik" type="number" step="any" value="0"></div>
      <div><label>Selisih (Auto)</label><input id="pn-selisih" type="text" readonly style="background:#f3f4f6"></div>
    </div>
    <div class="form-grid" style="grid-template-columns:1fr">
      <div><label>Keterangan (Alasan)</label><input id="pn-ket" placeholder="Misal: Barang rusak / susut / salah input"></div>
    </div>
  `, savePenyesuaian, 'Simpan');
}

function pnOnBarang(){
  const bid = document.getElementById('pn-brg').value;
  const b = brg(bid);
  const sysEl = document.getElementById('pn-sys');
  const fisikEl = document.getElementById('pn-fisik');
  const selEl = document.getElementById('pn-selisih');
  
  if (!b) { sysEl.value = 0; fisikEl.value = 0; selEl.value = 0; return; }
  sysEl.value = b.stok;
  fisikEl.value = b.stok;
  selEl.value = 0;
}

function savePenyesuaian(){
  const bid = document.getElementById('pn-brg').value;
  if (!bid) return toast('Pilih barang dulu', 'error');
  
  const b = brg(bid);
  const tgl = document.getElementById('pn-tgl').value;
  const stokSistem = b.stok;
  const stokFisik = +document.getElementById('pn-fisik').value || 0;
  const ket = document.getElementById('pn-ket').value.trim() || 'Stok Opname';
  const selisih = stokFisik - stokSistem;
  if (isPeriodLocked(tgl)) return toast('Periode ditutup', 'error');
  if (selisih === 0) return toast('Stok fisik sama dengan sistem, tidak perlu penyesuaian', 'error');

  const entity = b.lini === 'HQ' ? 'HQ' : b.lini;
  const rec = { id: uid(), tgl, entity, barangId: bid, stokSistem, stokFisik, selisih, ket };
  S.penyesuaian.unshift(rec);
  
  recalcStok();
  persist(); queue({ type:'penyesuaian', action:'upsert', record:rec });

  // JURNAL OTOMATIS PENYESUAIAN
  const hppUnit = b.hargaBeli || 0;
  const nilai = Math.abs(selisih) * hppUnit;
  const jLines = [];

  if (selisih > 0) {
    // Surplus: Persediaan bertambah, Pendapatan bertambah
    jLines.push({ akun: '1301', debit: nilai, kredit: 0 });
    jLines.push({ akun: '4002', debit: 0, kredit: nilai });
  } else {
    // Susut/Rusak: Beban bertambah, Persediaan berkurang
    jLines.push({ akun: '6004', debit: nilai, kredit: 0 });
    jLines.push({ akun: '1301', debit: 0, kredit: nilai });
  }

  postJournal(tgl, genDocNo('ADJ'), `Penyesuaian Stok: ${b.nama} (${ket})`, entity, jLines);

  closeModal(); renderPenyesuaian(); toast('✓ Penyesuaian disimpan & Stok diperbarui');
}

function delPenyesuaian(id){
  const p = S.penyesuaian.find(x => x.id === id); if (!p) return;
  if (isPeriodLocked(p.tgl)) return toast('Periode ditutup', 'error');
  if (!confirm('Hapus riwayat ini? Stok akan dikembalikan ke kondisi semula.')) return;
  S.penyesuaian = S.penyesuaian.filter(x => x.id !== id);
  recalcStok();
  persist(); queue({ type:'penyesuaian', action:'delete', id });
  renderPenyesuaian(); toast('Dihapus');
}

window.renderPenyesuaian = renderPenyesuaian; window.editPenyesuaian = editPenyesuaian; window.pnOnBarang = pnOnBarang; window.savePenyesuaian = savePenyesuaian; window.delPenyesuaian = delPenyesuaian;
