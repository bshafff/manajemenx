function renderDashboard(){
  const ent = activeEntity();
  const lr = labaRugiEnt(ent);
  const nc = neracaEnt(ent);
  const kritis = S.barang.filter(b =>
    (ent === 'ALL' || b.lini === ent) && b.stok <= (b.minStok || 5)).length;

  /* Hero */
  const heroEl = document.getElementById('dash-hero');
  if (heroEl){
    const bulanIni = new Date().toISOString().slice(0,7);
    const lrBulanIni = labaRugiBulan(ent, bulanIni);
    const lrBulanLalu = labaRugiBulan(ent, prevMonth(bulanIni));
    const delta = lrBulanIni.bersih - lrBulanLalu.bersih;
    const pct = lrBulanLalu.bersih !== 0
      ? Math.round(delta / Math.abs(lrBulanLalu.bersih) * 100) : 0;
    const entLabel = ent === 'ALL' ? 'Konsolidasi' : entInfo(ent).nama;

    heroEl.innerHTML = `
      <div class="hero-label">Laba Bersih · ${entLabel}</div>
      <div class="hero-value ${lrBulanIni.bersih>=0?'pos':'neg'}">
        ${rp(lrBulanIni.bersih)}</div>
      <div class="hero-delta ${delta>=0?'up':'down'}">
        ${delta >= 0 ? '▲' : '▼'} ${rp(Math.abs(delta))}
        ${pct ? `(${pct>0?'+':''}${pct}%)` : ''} vs bulan lalu</div>`;
  }

  /* Stats 2×2 */
  const st = document.getElementById('dash-stats');
  if (st) st.innerHTML = `
    <div class="stat gold"><div class="l">💰 Piutang</div>
      <div class="v">${rp(nc.piu)}</div>
      <div class="d">Belum tertagih</div></div>
    <div class="stat red"><div class="l">💸 Hutang</div>
      <div class="v">${rp(nc.liab)}</div>
      <div class="d">Ke supplier</div></div>
    <div class="stat"><div class="l">📦 Persediaan</div>
      <div class="v">${rp(nc.stok)}</div>
      <div class="d">${S.barang.length} SKU</div></div>
    <div class="stat ${kritis?'red':''}"><div class="l">⚠️ Stok Kritis</div>
      <div class="v ${kritis?'neg':'pos'}">${kritis}</div>
      <div class="d">≤ min stok</div></div>`;

  /* Kas per entitas */
  const kasEl = document.getElementById('dash-kas-ent');
  if (kasEl){
    const u = currentUser();
    if (u && u.role === 'owner'){
      kasEl.style.display = 'block';
      kasEl.innerHTML = `
        <h3>💵 Kas per Entitas</h3>
        ${Object.keys(ENTITIES).map(k => {
          const e = entInfo(k);
          const total = kasOf(k) + kkSaldo(k);
          return `<div class="kas-row">
            <span class="kas-ico">${e.ico}</span>
            <div class="kas-info"><b>${e.nama}</b>
              <div class="hint" style="margin:0">
                Kas ${rp(kasOf(k))} · KK ${rp(kkSaldo(k))}</div></div>
            <b class="kas-total">${rp(total)}</b>
          </div>`;
        }).join('')}
        <div class="kas-row" style="border-top:2px solid var(--line);
             margin-top:6px;padding-top:10px">
          <span class="kas-ico">🌐</span>
          <div class="kas-info"><b>Total</b></div>
          <b class="kas-total">${rp(totalKas() + totalKK())}</b>
        </div>`;
    } else kasEl.style.display = 'none';
  }

  /* Performa 4 lini */
  const liniEl = document.getElementById('dash-lini');
  if (liniEl){
    const L = {};
    Object.keys(LINI).forEach(k => {
      L[k] = labaRugiEnt(k);
      L[k].kas = kasOf(k);
    });
    const maxPend = Math.max(1, ...Object.values(L).map(x => x.pend));
    liniEl.innerHTML = `
      <h3>🍓 Performa 4 Lini</h3>
      ${Object.keys(LINI).map(k => {
        const li = LINI[k], d = L[k];
        const pct = d.pend > 0 ? (d.pend / maxPend * 100) : 0;
        return `<div class="lini-row">
          <div class="lini-head">
            <span style="font-size:16px">${li.ico}</span>
            <b>${li.nama}</b>
            <span class="spacer"></span>
            <b class="${d.bersih>=0?'pos':'neg'}">${rp(d.bersih)}</b>
          </div>
          <div class="bar" style="height:5px">
            <i style="width:${pct}%;background:${li.warna}"></i></div>
          <div class="hint" style="margin:0;font-size:10.5px">
            Omzet ${rp(d.pend)} · Kas ${rp(d.kas)}</div>
        </div>`;
      }).join('')}`;
  }

  /* Laporan lengkap */
  const lrEl = document.getElementById('dash-lr');
  if (lrEl) lrEl.innerHTML = `
    <h3>Laba / Rugi ${ent==='ALL'?'Konsolidasi':ent}</h3>
    <table>
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
      <tr><td>Kas</td><td class="num">${rp(nc.kas)}</td></tr>
      <tr><td>Kas Kecil</td><td class="num">${rp(nc.kk)}</td></tr>
      <tr><td>Piutang</td><td class="num">${rp(nc.piu)}</td></tr>
      <tr><td>Persediaan</td><td class="num">${rp(nc.stok)}</td></tr>
      <tr style="background:#f0fdf4"><td><b>Total Aset</b></td>
        <td class="num"><b>${rp(nc.aset)}</b></td></tr>
      <tr><td>Hutang</td><td class="num">${rp(nc.liab)}</td></tr>
      <tr><td>Ekuitas</td><td class="num">${rp(nc.ekuitas)}</td></tr>
      <tr style="background:#2d5016;color:#fff"><td><b>Total</b></td>
        <td class="num"><b>${rp(nc.liab + nc.ekuitas)}</b></td></tr>
    </table>`;
}

function labaRugiBulan(ent, yyyymm){
  const filt = x => (ent === 'ALL' || x.entity === ent) &&
    String(x.tgl || '').startsWith(yyyymm);
  const penj = S.penjualan.filter(filt);
  const pend = sum(penj, totSell);
  const hpp  = sum(penj, hppSell);
  let kkJ = ent === 'ALL'
    ? Object.values(S.kasKecil.perEntity || {}).flatMap(x => x.mutasi || [])
    : (S.kasKecil.perEntity?.[ent]?.mutasi || []);
  const beban = sum(kkJ.filter(m =>
    m.keluar && String(m.tgl||'').startsWith(yyyymm)), m => m.keluar);
  const kotor = pend - hpp;
  return { pend, hpp, kotor, beban, bersih: kotor - beban };
}
function prevMonth(yyyymm){
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m - 2, 1).toISOString().slice(0,7);
}
