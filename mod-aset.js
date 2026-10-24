function renderAset(){
  const el = document.getElementById('aset-list'); if (!el) return;
  const list = (S.aset || []).filter(entityFilter);
  if (!list.length) { el.innerHTML = `<div class="empty"><span class="e">🏢</span>Belum ada aset tetap</div>`; return; }
  
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Nama Aset</th><th>Tgl Beli</th><th class="num">Harga</th><th class="num">Penyusutan/bln</th><th class="num">Nilai Buku</th><th>Status</th><th>Aksi</th></tr></thead>
    <tbody>${list.map(a => {
      const umurBln = a.umur * 12;
      const penyusutanBln = umurBln > 0 ? (a.harga - a.residu) / umurBln : 0;
      const nilaiBuku = a.harga - (penyusutanBln * (a.terdepresiasi || 0));
      return `<tr>
        <td><b>${esc(a.nama)}</b></td>
        <td>${dmy(a.tglBeli)}</td>
        <td class="num">${rp(a.harga)}</td>
        <td class="num">${rp(penyusutanBln)}</td>
        <td class="num"><b>${rp(nilaiBuku)}</b></td>
        <td><span class="tag ${a.status==='aktif'?'t-ok':'t-warn'}">${a.status}</span></td>
        <td class="tb-actions">
          ${a.status === 'aktif' ? `<button class="ibtn" onclick="hitungPenyusutan('${a.id}')" title="Hitung Penyusutan Bulan Ini">📉</button>
          <button class="ibtn" onclick="disposisiAset('${a.id}')" title="Jual / Hapus">🗑️</button>` : ''}
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function editAset(){
  openModal('🏢 Tambah Aset Tetap', 'Pencatatan Inventaris', `
    <div class="form-grid">
      <div><label>Nama Aset</label><input id="as-nama" placeholder="Misal: Mesin Pasteurisasi"></div>
      <div><label>Tanggal Beli</label><input id="as-tgl" type="date" value="${today()}"></div>
      <div><label>Harga Beli (Rp)</label><input id="as-harga" type="number" value="0"></div>
      <div><label>Nilai Residu (Rp)</label><input id="as-residu" type="number" value="0"></div>
      <div><label>Umur Ekonomis (Tahun)</label><input id="as-umur" type="number" value="5"></div>
      <div><label>Kantor</label><select id="as-ent">${visibleEntities().map(k => `<option value="${k}">${entInfo(k).nama}</option>`).join('')}</select></div>
    </div>
  `, () => {
    const nama = document.getElementById('as-nama').value.trim();
    const tglBeli = document.getElementById('as-tgl').value;
    const harga = +document.getElementById('as-harga').value || 0;
    const residu = +document.getElementById('as-residu').value || 0;
    const umur = +document.getElementById('as-umur').value || 5;
    const entity = document.getElementById('as-ent').value;
    if (!nama || harga <= 0) return toast('Nama & Harga wajib diisi', 'error');

    const rec = { id: uid(), nama, tglBeli, harga, residu, umur, entity, terdepresiasi: 0, status: 'aktif' };
    S.aset.push(rec);
    persist(); queue({ type:'aset', action:'upsert', record:rec });

    // JURNAL PEMBELIAN ASET (Dr. Aset Tetap, Cr. Kas)
    postJournal(tglBeli, genDocNo('AST'), `Beli Aset: ${nama}`, entity, [
      { akun: '1401', debit: harga, kredit: 0 },
      { akun: '1001', debit: 0, kredit: harga }
    ]);

    closeModal(); renderAset(); toast('✓ Aset dicatat');
  }, 'Simpan Aset');
}

function hitungPenyusutan(id){
  const a = S.aset.find(x => x.id === id); if (!a) return;
  const umurBln = a.umur * 12;
  if ((a.terdepresiasi || 0) >= umurBln) return toast('Aset sudah habis umur ekonomisnya', 'error');

  const nilaiSusut = (a.harga - a.residu) / umurBln;
  const blnIni = new Date().toISOString().slice(0,7);
  
  if (!confirm(`Posting penyusutan sebesar ${rp(nilaiSusut)} untuk bulan ${blnIni}?`)) return;

  a.terdepresiasi = (a.terdepresiasi || 0) + 1;
  persist(); queue({ type:'aset', action:'upsert', record:a });

  // JURNAL PENYUSUTAN (Dr. Beban Penyusutan, Cr. Akumulasi)
  postJournal(today(), genDocNo('DEP'), `Penyusutan ${a.nama}`, a.entity, [
    { akun: '6005', debit: nilaiSusut, kredit: 0 },
    { akun: '1402', debit: 0, kredit: nilaiSusut }
  ]);
  renderAset(); toast('✓ Penyusutan diposting');
}

function disposisiAset(id){
  const a = S.aset.find(x => x.id === id); if (!a) return;
  const umurBln = a.umur * 12;
  const penyusutanBln = umurBln > 0 ? (a.harga - a.residu) / umurBln : 0;
  const akumulasi = penyusutanBln * (a.terdepresiasi || 0);
  const nilaiBuku = a.harga - akumulasi;

  const inputHargaJual = prompt(`Jual aset "${a.nama}".\nNilai Buku: ${rp(nilaiBuku)}\n\nMasukkan Harga Jual (Rp):`, "0");
  if (inputHargaJual === null) return;
  const hargaJual = +inputHargaJual || 0;
  
  if (!confirm(`Jual aset seharga ${rp(hargaJual)}?`)) return;

  a.status = 'dijual';
  persist(); queue({ type:'aset', action:'upsert', record:a });

  // JURNAL DISPOSISI
  const jLines = [];
  if (hargaJual > 0) jLines.push({ akun: '1001', debit: hargaJual, kredit: 0 });
  jLines.push({ akun: '1402', debit: akumulasi, kredit: 0 }); // Hapus Akumulasi
  jLines.push({ akun: '1401', debit: 0, kredit: a.harga }); // Hapus Aset
  
  const labaRugi = hargaJual - nilaiBuku;
  if (labaRugi > 0) jLines.push({ akun: '4003', debit: 0, kredit: labaRugi });
  else if (labaRugi < 0) jLines.push({ akun: '6006', debit: Math.abs(labaRugi), kredit: 0 });

  postJournal(today(), genDocNo('DSP'), `Jual Aset: ${a.nama}`, a.entity, jLines);
  renderAset(); toast('✓ Aset didisposisi');
}

window.renderAset = renderAset; window.editAset = editAset; window.hitungPenyusutan = hitungPenyusutan; window.disposisiAset = disposisiAset;
