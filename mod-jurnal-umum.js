function renderJurnalUmum(){
  const el = document.getElementById('jurnal-umum-list'); if (!el) return;
  const list = S.jurnalUmum || [];
  if (!list.length) { el.innerHTML = `<div class="empty"><span class="e">📒</span>Belum ada jurnal</div>`; return; }
  
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Tanggal</th><th>Ref</th><th>Keterangan</th><th>Akun</th><th class="num">Debit</th><th class="num">Kredit</th><th></th></tr></thead>
    <tbody>${list.map(j => {
      return j.lines.map((l, i) => `<tr>
        ${i === 0 ? `<td rowspan="${j.lines.length}">${dmy(j.tgl)}</td><td rowspan="${j.lines.length}"><b>${esc(j.ref)}</b></td><td rowspan="${j.lines.length}">${esc(j.ket)}</td>` : ''}
        <td>${l.akun}</td>
        <td class="num pos">${l.debit ? rp(l.debit) : '-'}</td>
        <td class="num neg">${l.kredit ? rp(l.kredit) : '-'}</td>
        ${i === 0 ? `<td rowspan="${j.lines.length}" class="tb-actions"><button class="ibtn" onclick="delJurnalUmum('${j.id}')">🗑️</button></td>` : ''}
      </tr>`).join('');
    }).join('')}</tbody>
  </table></div>`;
}

function editJurnalUmum(){
  openModal('➕ Jurnal Umum Baru', 'Input manual Debit & Kredit', `
    <div class="form-grid">
      <div><label>Tanggal</label><input id="ju-tgl" type="date" value="${today()}"></div>
      <div><label>Referensi</label><input id="ju-ref" placeholder="JU-001"></div>
      <div style="grid-column:1/-1"><label>Keterangan</label><input id="ju-ket" placeholder="Penyesuaian..."></div>
    </div>
    <div id="ju-lines" style="margin-top:12px">
      <div class="ju-row" style="display:grid;grid-template-columns:2fr 1fr 1fr 40px;gap:8px;margin-bottom:8px;">
        <select class="ju-akun">${S.accounts.map(a => `<option value="${a.id}">${a.id} · ${a.nama}</option>`).join('')}</select>
        <input class="ju-debit" type="number" placeholder="Debit" value="0">
        <input class="ju-kredit" type="number" placeholder="Kredit" value="0">
        <button class="ibtn" onclick="this.parentNode.remove()">✕</button>
      </div>
    </div>
    <button class="btn btn-s btn-sm" onclick="addJurnalRow()">+ Tambah Baris</button>
  `, saveJurnalUmum, 'Simpan');
}

function addJurnalRow(){
  const html = `<div class="ju-row" style="display:grid;grid-template-columns:2fr 1fr 1fr 40px;gap:8px;margin-bottom:8px;">
    <select class="ju-akun">${S.accounts.map(a => `<option value="${a.id}">${a.id} · ${a.nama}</option>`).join('')}</select>
    <input class="ju-debit" type="number" placeholder="Debit" value="0">
    <input class="ju-kredit" type="number" placeholder="Kredit" value="0">
    <button class="ibtn" onclick="this.parentNode.remove()">✕</button>
  </div>`;
  document.getElementById('ju-lines').insertAdjacentHTML('beforeend', html);
}

function saveJurnalUmum(){
  const tgl = document.getElementById('ju-tgl').value;
  const ref = document.getElementById('ju-ref').value.trim() || genDocNo('JU');
  const ket = document.getElementById('ju-ket').value.trim();
  const lines = [];
  document.querySelectorAll('.ju-row').forEach(r => {
    const akun = r.querySelector('.ju-akun').value;
    const debit = +r.querySelector('.ju-debit').value || 0;
    const kredit = +r.querySelector('.ju-kredit').value || 0;
    if (isPeriodLocked(tgl)) return toast('Periode ditutup', 'error');
    if (debit > 0 || kredit > 0) lines.push({ akun, debit, kredit });
  });
  if (!lines.length) return toast('Isi minimal 1 baris', 'error');
  
  const td = sum(lines, l => l.debit);
  const tk = sum(lines, l => l.kredit);
  if (Math.abs(td - tk) > 0.01) return toast(`Jurnal tidak seimbang! D: ${rp(td)} vs K: ${rp(tk)}`, 'error');

  postJournal(tgl, ref, ket, activeEntity() === 'ALL' ? 'HQ' : activeEntity(), lines);
  closeModal(); renderJurnalUmum(); toast('✓ Jurnal disimpan');
}

function delJurnalUmum(id){
  if (isPeriodLocked(j.tgl)) return toast('Periode ditutup', 'error');
  if (!confirm('Hapus jurnal ini?')) return;
  S.jurnalUmum = S.jurnalUmum.filter(x => x.id !== id);
  persist(); queue({ type:'jurnalUmum', action:'delete', id }); renderJurnalUmum(); toast('Dihapus');
}

window.renderJurnalUmum = renderJurnalUmum; window.editJurnalUmum = editJurnalUmum; window.addJurnalRow = addJurnalRow; window.saveJurnalUmum = saveJurnalUmum; window.delJurnalUmum = delJurnalUmum;
