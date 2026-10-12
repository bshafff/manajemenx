function renderKasKecil(){
  const st = document.getElementById('kk-stats');
  if (st) st.innerHTML = `
    <div class="stat pur"><div class="l">Saldo Kas Kecil</div>
      <div class="v">${rp(S.kasKecil.saldo)}</div>
      <div class="d">Petty cash</div></div>
    <div class="stat blue"><div class="l">Kas Utama</div>
      <div class="v">${rp(S.kas)}</div>
      <div class="d">Sumber pengisian</div></div>`;

  const el = document.getElementById('kk-mutasi');
  if (!el) return;
  const m = S.kasKecil.mutasi;
  if (!m.length){
    el.innerHTML = `<div class="empty"><span class="e">👛</span>Belum ada mutasi</div>`;
    return;
  }
  el.innerHTML = `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px">
    <table>
      <thead><tr><th>Tgl</th><th>Ket</th>
        <th class="num">Masuk</th><th class="num">Keluar</th><th></th></tr></thead>
      <tbody>${m.map(x => `<tr>
        <td>${dmy(x.tgl)}</td>
        <td>${esc(x.ket || '-')}</td>
        <td class="num pos">${x.masuk ? rp(x.masuk) : '-'}</td>
        <td class="num neg">${x.keluar ? rp(x.keluar) : '-'}</td>
        <td><button class="ibtn" onclick="delMutasiKK('${x.id}')">🗑️</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

function isiKK(){
  openModal('Isi Kas Kecil', 'Pindahkan dana dari kas utama', `
    <label>Jumlah</label>
    <input id="kk-jml" type="number" value="0">
    <label>Keterangan</label>
    <input id="kk-ket" value="Pengisian kas kecil">
    <div class="hint">Kas utama tersedia: <b>${rp(S.kas)}</b></div>
  `, () => {
    const j = +document.getElementById('kk-jml').value || 0;
    if (j <= 0) return toast('Jumlah tidak valid', 'error');
    if (j > S.kas) return toast('Kas utama tidak cukup', 'error');
    S.kas -= j; S.kasKecil.saldo += j;
    const rec = { id: uid(), tgl: today(), ket: document.getElementById('kk-ket').value,
      masuk: j, keluar: 0 };
    S.kasKecil.mutasi.unshift(rec);
    persist();
    queue({ type: 'kk', action: 'upsert', record: rec });
    closeModal(); renderKasKecil(); renderDashboard(); toast('Kas kecil terisi');
  });
}

function pakaiKK(){
  openModal('Pengeluaran Kas Kecil', '', `
    <label>Jumlah</label>
    <input id="kk-jml" type="number" value="0">
    <label>Keterangan</label>
    <input id="kk-ket" placeholder="Misal: beli ATK">
    <div class="hint">Saldo: <b>${rp(S.kasKecil.saldo)}</b></div>
  `, () => {
    const j = +document.getElementById('kk-jml').value || 0;
    if (j <= 0) return toast('Jumlah tidak valid', 'error');
    if (j > S.kasKecil.saldo) return toast('Saldo tidak cukup', 'error');
    S.kasKecil.saldo -= j;
    const rec = { id: uid(), tgl: today(), ket: document.getElementById('kk-ket').value,
      masuk: 0, keluar: j };
    S.kasKecil.mutasi.unshift(rec);
    persist();
    queue({ type: 'kk', action: 'upsert', record: rec });
    closeModal(); renderKasKecil(); renderDashboard(); toast('Dicatat');
  });
}

function delMutasiKK(id){
  const m = S.kasKecil.mutasi.find(x => x.id === id);
  if (!m) return;
  S.kasKecil.saldo += (m.keluar || 0) - (m.masuk || 0);
  S.kasKecil.mutasi = S.kasKecil.mutasi.filter(x => x.id !== id);
  persist();
  queue({ type: 'kk', action: 'delete', id });
  renderKasKecil(); renderDashboard(); toast('Dibatalkan');
}
