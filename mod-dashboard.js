function renderDashboard(){
  const lr = labaRugi();
  const nc = neraca();
  const kritis = S.barang.filter(b => b.stok <= 5).length;

  const st = document.getElementById('dash-stats');
  if (st) st.innerHTML = `
    <div class="stat"><div class="l">Kas Utama</div>
      <div class="v">${rp(S.kas)}</div>
      <div class="d">Saldo tunai</div></div>
    <div class="stat pur"><div class="l">Kas Kecil</div>
      <div class="v">${rp(S.kasKecil.saldo)}</div>
      <div class="d">Petty cash</div></div>
    <div class="stat gold"><div class="l">Piutang</div>
      <div class="v">${rp(piutang())}</div>
      <div class="d">Belum tertagih</div></div>
    <div class="stat red"><div class="l">Hutang</div>
      <div class="v">${rp(hutang())}</div>
      <div class="d">Ke supplier</div></div>
    <div class="stat"><div class="l">Persediaan</div>
      <div class="v">${rp(nilaiStok())}</div>
      <div class="d">${S.barang.length} SKU</div></div>
    <div class="stat ${kritis?'red':''}"><div class="l">Stok Kritis</div>
      <div class="v ${kritis?'neg':'pos'}">${kritis}</div>
      <div class="d">≤ 5 unit</div></div>`;

  /* ─── Kartu Performa per Lini ─── */
  const liniEl = document.getElementById('dash-lini');
  if (liniEl){
    const L = statsLini();
    liniEl.innerHTML = `
      <h3>Performa 4 Lini Usaha</h3>
      ${Object.keys(LINI).map(k => {
        const li = LINI[k], d = L[k];
        const max = Math.max(1, ...Object.values(L).map(x => x.pend));
        const pct = d.pend > 0 ? (d.pend / max * 100) : 0;
        return `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:22px">${li.ico}</span>
            <div style="flex:1">
              <div style="font-weight:700;font-size:14px">${li.nama}</div>
              <div class="hint" style="margin:0">${d.kritis} SKU kritis ·
                stok ${rp(d.stok)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-family:Fraunces;font-weight:600;
                color:${d.margin>=0?'var(--ok)':'var(--red)'}">
                ${rp(d.margin)}</div>
              <div class="hint" style="margin:0">Omzet ${rp(d.pend)}</div>
            </div>
          </div>
          <div class="bar" style="margin-top:6px">
            <i style="width:${pct}%;background:${li.warna}"></i>
          </div>
        </div>`;
      }).join('')}
      <div class="hint" style="margin-top:8px">
        Omzet = total penjualan · Margin = omzet − HPP
      </div>`;
  }

  const lrEl = document.getElementById('dash-lr');
  if (lrEl) lrEl.innerHTML = `
    <h3>Laba / Rugi</h3>
    <div class="mute">Laba bersih</div>
    <div class="big ${lr.bersih>=0?'pos':'neg'}">${rp(lr.bersih)}</div>
    <div class="bar"><i style="width:${lr.pend>0?(lr.kotor/lr.pend*100):0}%"></i></div>
    <table style="margin-top:10px">
      <tr><td>Pendapatan</td><td class="num pos">${rp(lr.pend)}</td></tr>
      <tr><td>HPP</td><td class="num neg">(${rp(lr.hpp)})</td></tr>
      <tr><td><b>Laba Kotor</b></td><td class="num"><b>${rp(lr.kotor)}</b></td></tr>
      <tr><td>Beban</td><td class="num neg">(${rp(lr.beban)})</td></tr>
      <tr style="background:#f0fdf4"><td><b>Laba Bersih</b></td>
        <td class="num"><b>${rp(lr.bersih)}</b></td></tr>
    </table>`;

  const nEl = document.getElementById('dash-neraca');
  if (nEl) nEl.innerHTML = `
    <h3>Neraca</h3>
    <table>
      <tr><td colspan="2" class="mute" style="font-size:11px;font-weight:700">ASET</td></tr>
      <tr><td>Kas</td><td class="num">${rp(S.kas)}</td></tr>
      <tr><td>Kas Kecil</td><td class="num">${rp(S.kasKecil.saldo)}</td></tr>
      <tr><td>Piutang</td><td class="num">${rp(piutang())}</td></tr>
      <tr><td>Persediaan</td><td class="num">${rp(nilaiStok())}</td></tr>
      <tr style="background:#f0fdf4"><td><b>Total Aset</b></td>
        <td class="num"><b>${rp(nc.aset)}</b></td></tr>
      <tr><td colspan="2" class="mute" style="font-size:11px;font-weight:700;padding-top:8px">LIAB & EKUITAS</td></tr>
      <tr><td>Hutang</td><td class="num">${rp(nc.liab)}</td></tr>
      <tr><td>Ekuitas</td><td class="num">${rp(nc.ekuitas)}</td></tr>
      <tr style="background:#2d5016;color:#fff"><td><b>Total</b></td>
        <td class="num"><b>${rp(nc.liab + nc.ekuitas)}</b></td></tr>
    </table>`;
}
