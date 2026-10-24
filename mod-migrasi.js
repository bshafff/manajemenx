function renderMigrasi(){
  const el = document.getElementById('mig-form'); if (!el) return;
  
  // Urutkan akun: Aset, Kewajiban, Ekuitas, Pendapatan, Beban
  const types = ['Aset', 'Kewajiban', 'Ekuitas', 'Pendapatan', 'Beban'];
  let html = '';
  
  types.forEach(t => {
    const accs = S.accounts.filter(a => a.tipe === t);
    if (!accs.length) return;
    html += `<div style="font-weight:800; margin-top:16px; margin-bottom:8px; color:var(--green); border-bottom:1px solid var(--line); padding-bottom:4px;">${t.toUpperCase()}</div>`;
    html += `<div class="form-grid" style="grid-template-columns: repeat(2, 1fr);">`;
    accs.forEach(a => {
      html += `<div><label>${a.id} · ${esc(a.nama)} (${a.saldoNormal})</label><input type="number" class="mig-input" data-akun="${a.id}" value="0"></div>`;
    });
    html += `</div>`;
  });

  html += `<div style="margin-top:24px; text-align:right;">
    <button class="btn btn-p" onclick="simpanMigrasi()">💾 Simpan Jurnal Saldo Awal</button>
  </div>`;
  el.innerHTML = html;
}

function simpanMigrasi(){
  const tgl = document.getElementById('mig-tgl').value;
  if (!tgl) return toast('Pilih tanggal cutover', 'error');
  
  const inputs = document.querySelectorAll('.mig-input');
  const lines = [];
  let totalD = 0, totalK = 0;

  inputs.forEach(inp => {
    const val = +inp.value || 0;
    if (val === 0) return;
    const akunId = inp.dataset.akun;
    const acc = S.accounts.find(a => a.id === akunId);
    
    if (acc.saldoNormal === 'Debit') {
      lines.push({ akun: akunId, debit: val, kredit: 0 });
      totalD += val;
    } else {
      lines.push({ akun: akunId, debit: 0, kredit: val });
      totalK += val;
    }
  });

  if (!lines.length) return toast('Semua saldo 0, tidak ada yang disimpan', 'error');
  
  const selisih = totalD - totalK;
  if (Math.abs(selisih) > 0.01) {
    return toast(`Gagal: Neraca tidak seimbang! Total Debit ${rp(totalD)} vs Kredit ${rp(totalK)} (Selisih ${rp(selisih)}). Periksa kembali angka Anda.`, 'error');
  }

  if (!confirm(`Jurnal Saldo Awal seimbang (${rp(totalD)}). Posting sekarang?`)) return;

  // Posting Jurnal
  postJournal(tgl, 'SALDO-AWAL', 'Migrasi Saldo Awal', activeEntity() === 'ALL' ? 'HQ' : activeEntity(), lines);
  toast('✓ Saldo awal berhasil dibukukan!');
  renderMigrasi();
}

window.renderMigrasi = renderMigrasi; window.simpanMigrasi = simpanMigrasi;
