function renderTutupBuku(){
  const el = document.getElementById('tb-list'); if (!el) return;
  const lockRec = (S.pengaturan || []).find(x => x.id === 'lockedPeriods');
  const periods = lockRec ? lockRec.value : [];

  if (!periods.length) {
    el.innerHTML = `<div class="empty"><span class="e">🔓</span>Belum ada periode yang dikunci</div>`;
    return;
  }

  // Urutkan dari yang terbaru
  const sorted = [...periods].sort((a,b) => b.localeCompare(a));

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Periode</th><th>Status</th><th>Aksi</th></tr></thead>
    <tbody>${sorted.map(p => `
      <tr>
        <td><b>${p}</b></td>
        <td><span class="tag t-ok">Terkunci 🔒</span></td>
        <td class="tb-actions">
          <button class="ibtn" onclick="bukaKunci('${p}')" title="Buka Kunci (Hati-hati!)">🔓</button>
        </td>
      </tr>
    `).join('')}</tbody>
  </table></div>`;
}

function kunciPeriode(){
  const el = document.getElementById('tb-periode');
  const period = el.value;
  if (!period) return toast('Pilih bulan terlebih dahulu', 'error');
  if (!confirm(`KUNCI PERIODE ${period}?\n\nSemua transaksi di bulan ini tidak akan bisa diedit atau dihapus.`)) return;

  const lockRec = (S.pengaturan || []).find(x => x.id === 'lockedPeriods');
  if (!lockRec) {
    S.pengaturan = [{ id: 'lockedPeriods', value: [period] }];
  } else {
    if (lockRec.value.includes(period)) return toast('Periode ini sudah terkunci', 'error');
    lockRec.value.push(period);
  }

  persist();
  queue({ type: 'pengaturan', action: 'upsert', record: S.pengaturan.find(x => x.id === 'lockedPeriods') });
  
  el.value = '';
  renderTutupBuku();
  toast(`✓ Periode ${period} berhasil dikunci`);
}

function bukaKunci(period){
  if (currentUser().role !== 'owner') return toast('Hanya Owner yang boleh membuka kunci', 'error');
  if (!confirm(`⚠️ PERINGATAN!\n\nMembuka kunci periode ${period} memungkinkan siapa pun mengubah data keuangan masa lalu. Lanjutkan?`)) return;

  const lockRec = (S.pengaturan || []).find(x => x.id === 'lockedPeriods');
  if (lockRec) {
    lockRec.value = lockRec.value.filter(p => p !== period);
    persist();
    queue({ type: 'pengaturan', action: 'upsert', record: lockRec });
    renderTutupBuku();
    toast(`✓ Kunci periode ${period} dibuka`);
  }
}

window.renderTutupBuku = renderTutupBuku;
window.kunciPeriode = kunciPeriode;
window.bukaKunci = bukaKunci;
