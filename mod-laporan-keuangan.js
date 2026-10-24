function renderLaporanKeuangan(){
  const ent = activeEntity();
  const lr = labaRugiEnt(ent);
  const nc = neracaEnt(ent);
  const entLabel = ent === 'ALL' ? 'Konsolidasi (Semua Divisi)' : entInfo(ent).nama;

  // 1. Render Laba Rugi
  const elLR = document.getElementById('lap-laba-rugi');
  if (elLR) {
    elLR.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Keterangan</th><th class="num">Jumlah (Rp)</th></tr></thead>
      <tbody>
        <tr><td><b>Pendapatan</b></td><td class="num"><b>${rp(lr.pend)}</b></td></tr>
        <tr><td>&nbsp;&nbsp;- Harga Pokok Penjualan (HPP)</td><td class="num">(${rp(lr.hpp)})</td></tr>
        <tr style="background:#f0fdf4;font-weight:700;"><td>Laba Kotor</td><td class="num">${rp(lr.kotor)}</td></tr>
        <tr><td>&nbsp;&nbsp;- Beban Operasional</td><td class="num">(${rp(lr.beban)})</td></tr>
        <tr style="background:#2d5016;color:#fff;font-weight:800;font-size:15px;"><td>LABA BERSIH</td><td class="num">${rp(lr.bersih)}</td></tr>
      </tbody>
    </table></div>
    <div class="hint">*Dihitung otomatis dari Jurnal Umum. Lini: ${entLabel}</div>`;
  }

  // 2. Render Neraca
  const elNC = document.getElementById('lap-neraca');
  if (elNC) {
    elNC.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Keterangan</th><th class="num">Jumlah (Rp)</th></tr></thead>
      <tbody>
        <tr><td colspan="2" style="background:#e5e7eb;font-weight:700;">ASET</td></tr>
        <tr><td>&nbsp;&nbsp;- Kas</td><td class="num">${rp(nc.kas)}</td></tr>
        <tr><td>&nbsp;&nbsp;- Kas Kecil</td><td class="num">${rp(nc.kk)}</td></tr>
        <tr><td>&nbsp;&nbsp;- Piutang Usaha</td><td class="num">${rp(nc.piu)}</td></tr>
        <tr><td>&nbsp;&nbsp;- Persediaan Barang</td><td class="num">${rp(nc.stok)}</td></tr>
        <tr style="font-weight:700;border-top:2px solid var(--line);"><td>TOTAL ASET</td><td class="num">${rp(nc.aset)}</td></tr>
        
        <tr><td colspan="2" style="background:#e5e7eb;font-weight:700;">KEWAJIBAN & EKUITAS</td></tr>
        <tr><td>&nbsp;&nbsp;- Hutang Usaha</td><td class="num">${rp(nc.liab)}</td></tr>
        <tr><td>&nbsp;&nbsp;- Ekuitas (Modal + Laba)</td><td class="num">${rp(nc.ekuitas)}</td></tr>
        <tr style="font-weight:700;border-top:2px solid var(--line);"><td>TOTAL KEWAJIBAN & EKUITAS</td><td class="num">${rp(nc.liab + nc.ekuitas)}</td></tr>
      </tbody>
    </table></div>
    <div class="hint" style="margin-top:10px;${Math.abs(nc.aset - (nc.liab + nc.ekuitas)) > 0.01 ? 'color:red;font-weight:800;' : ''}">
      Status: ${Math.abs(nc.aset - (nc.liab + nc.ekuitas)) <= 0.01 ? '✅ Seimbang (Balance)' : '❌ Tidak Seimbang (Cek Jurnal)'}
    </div>`;
  }
}

function exportLaporanKeuangan(){
  const ent = activeEntity();
  const lr = labaRugiEnt(ent);
  const nc = neracaEnt(ent);
  const entLabel = ent === 'ALL' ? 'Konsolidasi' : entInfo(ent).nama;

  const rows = [
    ['LAPORAN KEUANGAN IMB', '', ''],
    ['Lini Usaha', entLabel, ''],
    ['Tanggal Export', new Date().toLocaleString('id-ID'), ''],
    ['', '', ''],
    ['LABA RUGI', '', ''],
    ['Pendapatan', lr.pend, ''],
    ['HPP', lr.hpp, ''],
    ['Laba Kotor', lr.kotor, ''],
    ['Beban Operasional', lr.beban, ''],
    ['Laba Bersih', lr.bersih, ''],
    ['', '', ''],
    ['NERACA', '', ''],
    ['Total Aset', nc.aset, ''],
    ['Total Kewajiban', nc.liab, ''],
    ['Total Ekuitas', nc.ekuitas, ''],
    ['', '', ''],
    ['RINCIAN ASET', '', ''],
    ['Kas', nc.kas, ''],
    ['Kas Kecil', nc.kk, ''],
    ['Piutang', nc.piu, ''],
    ['Persediaan', nc.stok, '']
  ];
  
  if (typeof downloadCSV === 'function') {
    downloadCSV(`Laporan_Keuangan_${new Date().toISOString().slice(0,10)}.csv`, rows);
    toast('✓ Laporan berhasil didownload');
  }
}

window.renderLaporanKeuangan = renderLaporanKeuangan;
window.exportLaporanKeuangan = exportLaporanKeuangan;
