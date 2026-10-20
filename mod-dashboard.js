/* ═══════════════════════════════════════════════════════════════
   DASHBOARD EKSEKUTIF (Chart.js)
   ═══════════════════════════════════════════════════════════════ */

let chartOmzetInst = null;
let chartLabaInst = null;
let chartBiayaInst = null;

/* Helper Format Angka Sumbu Y Chart (Juta / Ribu) */
function formatRpShort(v) {
  if (!v || v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1000000000) return 'Rp ' + (v / 1000000000).toFixed(1).replace('.0', '') + ' M';
  if (abs >= 1000000) return 'Rp ' + (v / 1000000).toFixed(1).replace('.0', '') + ' Jt';
  if (abs >= 1000) return 'Rp ' + (v / 1000).toFixed(1).replace('.0', '') + ' Rb';
  return 'Rp ' + v;
}

function renderDashboard(){
  try {
    _renderDashboard();
  } catch(e) {
    console.error('Dashboard error:', e);
    const el = document.getElementById('dash-hero');
    if (el) el.innerHTML = `<div style="color:#fff">
      <div style="font-size:13px">⚠️ Dashboard error</div>
      <div style="font-size:11px;opacity:.8;margin-top:4px">${esc(e.message)}</div>
    </div>`;
  }
}

function _renderDashboard(){
  const ent = activeEntity();
  
  // --- 1. HERO: Laba Bersih Bulan Ini ---
  const bulanIni = new Date().toISOString().slice(0,7);
  const lrBulanIni = labaRugiBulan(ent, bulanIni);
  const lrBulanLalu = labaRugiBulan(ent, prevMonth(bulanIni));
  const delta = lrBulanIni.bersih - lrBulanLalu.bersih;
  const pct = lrBulanLalu.bersih !== 0 ? Math.round(delta / Math.abs(lrBulanLalu.bersih) * 100) : 0;
  const entLabel = ent === 'ALL' ? 'Konsolidasi (Semua Divisi)' : entInfo(ent).nama;

  const heroEl = document.getElementById('dash-hero');
  if (heroEl){
    heroEl.innerHTML = `
      <div class="hero-label">Laba Bersih · ${entLabel}</div>
      <div class="hero-value ${lrBulanIni.bersih>=0?'pos':'neg'}">
        ${rp(lrBulanIni.bersih)}
      </div>
      <div class="hero-delta ${delta>=0?'up':'down'}">
        ${delta >= 0 ? '▲' : '▼'} ${rp(Math.abs(delta))}
        ${pct ? `(${pct>0?'+':''}${pct}%)` : ''} vs bulan lalu
      </div>`;
  }

  // --- 2. STATS (Piutang, Hutang, Persediaan, Stok Kritis) ---
  const nc = neracaEnt(ent);
  const kritis = S.barang.filter(b => (ent === 'ALL' || b.lini === ent) && b.stok <= (b.minStok || 5)).length;
  
  const st = document.getElementById('dash-stats');
  if (st) st.innerHTML = `
    <div class="stat gold"><div class="l">💰 Piutang</div>
      <div class="v">${rp(nc.piu)}</div><div class="d">Belum tertagih</div></div>
    <div class="stat red"><div class="l">💸 Hutang</div>
      <div class="v">${rp(nc.liab)}</div><div class="d">Ke supplier</div></div>
    <div class="stat"><div class="l">📦 Persediaan</div>
      <div class="v">${rp(nc.stok)}</div><div class="d">${S.barang.length} SKU</div></div>
    <div class="stat ${kritis?'red':''}"><div class="l">⚠️ Stok Kritis</div>
      <div class="v ${kritis?'neg':'pos'}">${kritis}</div><div class="d">≤ min stok</div></div>`;

  // --- 3. CHART 1: Omzet per Lini (Bar Chart) ---
  const omzetData = { SB: 0, DR: 0, AY: 0, PK: 0 };
  S.penjualan.forEach(p => {
    if (ent !== 'ALL' && p.entity !== ent) return;
    p.items.forEach(it => {
      const b = brg(it.barangId);
      if (b && omzetData[b.lini] !== undefined) omzetData[b.lini] += (it.qty * it.harga);
    });
  });
  renderChartOmzet(omzetData);

  // --- 4. CHART 2: Tren Laba (Line Chart 6 Bulan) ---
  const months = [];
  const labaData = [];
  let curM = bulanIni;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(curM + '-01');
    d.setMonth(d.getMonth() - i);
    const ym = d.toISOString().slice(0,7);
    months.push(d.toLocaleDateString('id-ID',{month:'short'}));
    labaData.push(labaRugiBulan(ent, ym).bersih);
  }
  renderChartLaba(months, labaData);

  // --- 5. CHART 3: Komposisi Biaya (Donut Chart) ---
  let totalBahan = 0;
  let totalOperasional = 0;
  S.pembelian.forEach(p => { if(ent === 'ALL' || p.entity === ent) totalBahan += totBuy(p); });
  let kkJ = ent === 'ALL' ? Object.values(S.kasKecil.perEntity||{}).flatMap(x=>x.mutasi||[]) : (S.kasKecil.perEntity?.[ent]?.mutasi||[]);
  totalOperasional = sum(kkJ.filter(m => m.keluar), m => m.keluar);
  renderChartBiaya(totalBahan, totalOperasional);

  // --- 6. LIST: Top 5 Barang Terlaris ---
  const terjual = {};
  S.penjualan.forEach(p => {
    if (ent !== 'ALL' && p.entity !== ent) return;
    p.items.forEach(it => {
      if(!terjual[it.barangId]) terjual[it.barangId] = 0;
      terjual[it.barangId] += it.qty;
    });
  });
  const topBarang = Object.keys(terjual)
    .map(id => ({ id, qty: terjual[id], brg: brg(id) }))
    .filter(x => x.brg)
    .sort((a,b) => b.qty - a.qty)
    .slice(0, 5);

  const topEl = document.getElementById('dash-top-barang');
  if (topEl) {
    if (!topBarang.length) topEl.innerHTML = `<div class="empty" style="padding:20px">Belum ada penjualan</div>`;
    else topEl.innerHTML = topBarang.map((x, i) => `
      <div class="list-row">
        <div class="list-rank">#${i+1}</div>
        <div class="list-name">${esc(x.brg.nama)}</div>
        <div class="list-val">${x.qty} ${x.brg.satuan}</div>
      </div>
    `).join('');
  }

  // --- 7. LIST: Stok Kritis ---
  const stokKritis = S.barang
    .filter(b => (ent === 'ALL' || b.lini === ent) && b.stok <= (b.minStok || 5))
    .sort((a,b) => a.stok - b.stok)
    .slice(0, 5);

  const kritisEl = document.getElementById('dash-stok-kritis');
  if (kritisEl) {
    if (!stokKritis.length) kritisEl.innerHTML = `<div class="empty" style="padding:20px">Semua stok aman</div>`;
    else kritisEl.innerHTML = stokKritis.map(x => `
      <div class="list-row">
        <div class="list-name">${esc(x.nama)}</div>
        <div class="list-val neg">Sisa ${x.stok} ${x.satuan}</div>
      </div>
    `).join('');
  }
}

/* ═══════════════════════════════════════════════════════════════
   HELPER: LABARUGI BULANAN (Untuk Line Chart)
   ═══════════════════════════════════════════════════════════════ */
function labaRugiBulan(ent, yyyymm){
  const filt = x => (ent === 'ALL' || x.entity === ent) && String(x.tgl || '').startsWith(yyyymm);
  const penj = S.penjualan.filter(filt);
  const pend = sum(penj, totSell);
  const hpp  = sum(penj, hppSell);
  
  let kkJ = ent === 'ALL' 
    ? Object.values(S.kasKecil.perEntity || {}).flatMap(x => x.mutasi || [])
    : (S.kasKecil.perEntity?.[ent]?.mutasi || []);
  const beban = sum(kkJ.filter(m => m.keluar && String(m.tgl||'').startsWith(yyyymm)), m => m.keluar);
  
  const kotor = pend - hpp;
  return { pend, hpp, kotor, beban, bersih: kotor - beban };
}

function prevMonth(yyyymm){
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m - 2, 1).toISOString().slice(0,7);
}

/* ═══════════════════════════════════════════════════════════════
   CHART.JS RENDERERS
   ═══════════════════════════════════════════════════════════════ */
function renderChartOmzet(data){
  const ctx = document.getElementById('chartOmzet');
  if (!ctx) return;
  if (chartOmzetInst) chartOmzetInst.destroy();

  chartOmzetInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['🍓 Stroberi', '🥛 Dairy', '🐔 Ayam', '🌾 Pakan'],
      datasets: [{
        label: 'Omzet',
        data: [data.SB, data.DR, data.AY, data.PK],
        backgroundColor: ['#dc2626', '#2563eb', '#b45309', '#16a34a'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { 
        y: { 
          beginAtZero: true, 
          ticks: { callback: v => formatRpShort(v) } 
        } 
      }
    }
  });
}

function renderChartLaba(labels, data){
  const ctx = document.getElementById('chartLaba');
  if (!ctx) return;
  if (chartLabaInst) chartLabaInst.destroy();

  chartLabaInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Laba Bersih',
        data: data,
        borderColor: '#2d5016',
        backgroundColor: 'rgba(45,80,22,.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#2d5016'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { 
        y: { 
          beginAtZero: true, 
          ticks: { callback: v => formatRpShort(v) } 
        } 
      }
    }
  });
}

function renderChartBiaya(bahan, operasional){
  const ctx = document.getElementById('chartBiaya');
  if (!ctx) return;
  if (chartBiayaInst) chartBiayaInst.destroy();

  if (bahan === 0 && operasional === 0) bahan = 1; 

  chartBiayaInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Bahan Baku (HPP)', 'Operasional (Beban)'],
      datasets: [{
        data: [bahan, operasional],
        backgroundColor: ['#2d5016', '#f59e0b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: {size: 11} } }
      }
    }
  });
}
