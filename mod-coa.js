function renderCOA(){
  const el = document.getElementById('coa-list'); if (!el) return;
  const list = S.accounts || [];
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Kode Akun</th><th>Nama Akun</th><th>Tipe</th><th>Saldo Normal</th><th>Saldo (Rp)</th><th></th></tr></thead>
    <tbody>${list.map(a => {
      const saldo = getAccountBalance(a.id);
      return `<tr>
        <td><b>${esc(a.id)}</b></td><td>${esc(a.nama)}</td><td>${a.tipe}</td><td>${a.saldoNormal}</td>
        <td class="num">${rp(saldo)}</td>
        <td class="tb-actions">
          <button class="ibtn" onclick="editCOA('${a.id}')">✏️</button>
          <button class="ibtn" onclick="delCOA('${a.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function editCOA(id){
  const a = id ? S.accounts.find(x => x.id === id) : null;
  openModal(a ? '✏️ Edit Akun' : '➕ Tambah Akun', 'Akun Perkiraan (COA)', `
    <div class="form-grid">
      <div><label>Kode Akun</label><input id="coa-kode" value="${a ? a.id : ''}" ${a ? 'readonly' : ''} placeholder="1005"></div>
      <div><label>Nama Akun</label><input id="coa-nama" value="${a ? esc(a.nama) : ''}" placeholder="Nama akun"></div>
      <div><label>Tipe</label>
        <select id="coa-tipe">${['Aset','Kewajiban','Ekuitas','Pendapatan','Beban'].map(t => `<option ${a&&a.tipe===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div><label>Saldo Normal</label>
        <select id="coa-sn"><option ${a&&a.saldoNormal==='Debit'?'selected':''}>Debit</option><option ${a&&a.saldoNormal==='Kredit'?'selected':''}>Kredit</option></select>
      </div>
    </div>
  `, () => saveCOA(id), 'Simpan');
}

function saveCOA(id){
  const kode = document.getElementById('coa-kode').value.trim();
  const nama = document.getElementById('coa-nama').value.trim();
  if (!kode || !nama) return toast('Kode & Nama wajib diisi', 'error');
  if (!id && S.accounts.find(x => x.id === kode)) return toast('Kode akun sudah dipakai', 'error');
  const rec = { id: kode, nama, tipe: document.getElementById('coa-tipe').value, saldoNormal: document.getElementById('coa-sn').value };
  if (id) { const idx = S.accounts.findIndex(x => x.id === id); S.accounts[idx] = rec; }
  else { S.accounts.push(rec); }
  persist(); queue({ type:'accounts', action:'upsert', record:rec });
  closeModal(); renderCOA(); toast('✓ Akun disimpan');
}

function delCOA(id){
  if (getAccountBalance(id) !== 0) return toast('Tidak bisa hapus akun yang masih ada saldo', 'error');
  if (!confirm('Hapus akun ini?')) return;
  S.accounts = S.accounts.filter(x => x.id !== id);
  persist(); queue({ type:'accounts', action:'delete', id }); renderCOA(); toast('Dihapus');
}

window.renderCOA = renderCOA; window.editCOA = editCOA; window.saveCOA = saveCOA; window.delCOA = delCOA;
