function renderPembayaran(){
  const el = document.getElementById('pembayaran-list');
  if (!el) return;
  const list = S.pembayaran || [];
  if (!list.length){
    el.innerHTML = `<div class="empty"><span class="e">💸</span>Belum ada pembayaran</div>`;
    return;
  }
  el.innerHTML = `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px">
    <table>
      <thead><tr><th>No</th><th>Tgl</th><th>Ket</th>
        <th class="num">Jumlah</th><th></th></tr></thead>
      <tbody>${list.map(p => `<tr>
        <td><b>${esc(p.no)}</b></td>
        <td>${dmy(p.tgl)}</td>
        <td>${esc(p.ket || p.jenis || '-')}</td>
        <td class="num neg"><b>${rp(p.jumlah)}</b></td>
        <td><button class="ibtn" onclick="delBayar('${p.id}')">🗑️</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

function addBayar(){
  openModal('Catat Pembayaran', 'Pengeluaran kas', `
    <label>Keterangan</label>
    <input id="f-ket" placeholder="Misal: bayar supplier">
    <div class="grid">
      <div><label>Jumlah</label>
        <input id="f-jml" type="number" value="0"></div>
      <div><label>Tanggal</label>
        <input id="f-tgl" type="date" value="${today()}"></div>
    </div>
    <div class="hint">Kas utama: <b>${rp(S.kas)}</b></div>
  `, () => {
    const jml = +document.getElementById('f-jml').value || 0;
    if (jml <= 0) return toast('Jumlah tidak valid', 'error');
    const rec = {
      id: uid(),
      no: 'BY-' + Date.now().toString().slice(-6),
      tgl: document.getElementById('f-tgl').value,
      ket: document.getElementById('f-ket').value,
      jenis: 'beban',
      jumlah: jml,
    };
    S.kas -= jml;
    if (!S.pembayaran) S.pembayaran = [];
    S.pembayaran.unshift(rec);
    persist();
    queue({ type: 'pembayaran', action: 'upsert', record: rec });
    closeModal(); renderPembayaran(); toast('Pembayaran dicatat');
  });
}

function delBayar(id){
  const p = (S.pembayaran || []).find(x => x.id === id);
  if (!p || !confirm('Batalkan pembayaran ini?')) return;
  S.kas += p.jumlah;
  S.pembayaran = S.pembayaran.filter(x => x.id !== id);
  persist();
  queue({ type: 'pembayaran', action: 'delete', id });
  renderPembayaran(); toast('Dibatalkan');
}
