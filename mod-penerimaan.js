function renderPenerimaan(){
  const el = document.getElementById('penerimaan-list');
  if (!el) return;
  const list = S.penerimaan || [];
  if (!list.length){
    el.innerHTML = `<div class="empty"><span class="e">💰</span>Belum ada penerimaan</div>`;
    return;
  }
  el.innerHTML = `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px">
    <table>
      <thead><tr><th>No</th><th>Tgl</th><th>Ket</th>
        <th class="num">Jumlah</th><th></th></tr></thead>
      <tbody>${list.map(p => `<tr>
        <td><b>${esc(p.no)}</b></td>
        <td>${dmy(p.tgl)}</td>
        <td>${esc(p.ket || '-')}</td>
        <td class="num pos"><b>${rp(p.jumlah)}</b></td>
        <td><button class="ibtn" onclick="delTerima('${p.id}')">🗑️</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

function addTerima(){
  openModal('Catat Penerimaan', 'Kas masuk', `
    <label>Keterangan</label>
    <input id="f-ket" placeholder="Misal: pelunasan piutang">
    <div class="grid">
      <div><label>Jumlah</label>
        <input id="f-jml" type="number" value="0"></div>
      <div><label>Tanggal</label>
        <input id="f-tgl" type="date" value="${today()}"></div>
    </div>
  `, () => {
    const jml = +document.getElementById('f-jml').value || 0;
    if (jml <= 0) return toast('Jumlah tidak valid', 'error');
    const rec = {
      id: uid(),
      no: 'TR-' + Date.now().toString().slice(-6),
      tgl: document.getElementById('f-tgl').value,
      ket: document.getElementById('f-ket').value,
      jumlah: jml,
    };
    S.kas += jml;
    if (!S.penerimaan) S.penerimaan = [];
    S.penerimaan.unshift(rec);
    persist();
    queue({ type: 'penerimaan', action: 'upsert', record: rec });
    closeModal(); renderPenerimaan(); toast('Penerimaan dicatat');
  });
}

function delTerima(id){
  const p = (S.penerimaan || []).find(x => x.id === id);
  if (!p || !confirm('Batalkan penerimaan ini?')) return;
  S.kas -= p.jumlah;
  S.penerimaan = S.penerimaan.filter(x => x.id !== id);
  persist();
  queue({ type: 'penerimaan', action: 'delete', id });
  renderPenerimaan(); toast('Dibatalkan');
}
