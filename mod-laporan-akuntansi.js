function renderLaporanAkuntansi(){
  const el = document.getElementById('neraca-saldo-list'); if (!el) return;
  const ent = activeEntity();
  
  let totalD = 0, totalK = 0;
  const rows = S.accounts.map(a => {
    let saldo = 0;
    S.jurnalUmum.forEach(j => {
      if (ent !== 'ALL' && j.entity !== ent) return;
      j.lines.forEach(l => { if (l.akun === a.id) saldo += (l.debit || 0) - (l.kredit || 0); });
    });
    
    let d = 0, k = 0;
    if (saldo > 0) d = saldo;
    if (saldo < 0) k = Math.abs(saldo);
    totalD += d; totalK += k;
    
    return `<tr>
      <td>${a.id}</td><td>${esc(a.nama)}</td><td>${a.tipe}</td>
      <td class="num">${d ? rp(d) : '-'}</td>
      <td class="num">${k ? rp(k) : '-'}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Kode</th><th>Nama Akun</th><th>Tipe</th><th class="num">Debit (Rp)</th><th class="num">Kredit (Rp)</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot style="background:#f3f4f6;font-weight:800">
      <tr><td colspan="3">TOTAL</td><td class="num">${rp(totalD)}</td><td class="num">${rp(totalK)}</td></tr>
    </tfoot>
  </table></div>
  <div class="hint" style="margin-top:12px;${Math.abs(totalD-totalK)>0.01?'color:red;font-weight:800':''}">
    Status: ${Math.abs(totalD-totalK)<=0.01 ? '✅ Seimbang' : '❌ Tidak Seimbang (Cek Jurnal)'}
  </div>`;
}

window.renderLaporanAkuntansi = renderLaporanAkuntansi;
