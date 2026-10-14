let stokFilterLini = 'ALL';

function renderStok(){
  const kritis = S.barang.filter(b => b.stok <= 5).length;
  const st = document.getElementById('stok-stats');
  if (st) st.innerHTML = `
    <div class="stat"><div class="l">Nilai Persediaan</div>
      <div class="v">${rp(nilaiStok())}</div>
      <div class="d">${S.barang.length} SKU</div></div>
    <div class="stat ${kritis?'red':'green'}"><div class="l">Stok Kritis</div>
      <div class="v ${kritis?'neg':'pos'}">${kritis}</div>
      <div class="d">≤ 5 unit</div></div>`;

  const el = document.getElementById('stok-list');
  if (!el) return;

  const filterHtml = `
    <div class="btn-row" style="margin-bottom:10px">
      <select onchange="stokFilterLini=this.value;renderStok()">
        <option value="ALL" ${stokFilterLini==='ALL'?'selected':''}>Semua Lini</option>
        ${Object.keys(LINI).map(k =>
          `<option value="${k}" ${stokFilterLini===k?'selected':''}>
            ${LINI[k].ico} ${LINI[k].nama}</option>`).join('')}
      </select>
    </div>`;

  const list = stokFilterLini === 'ALL'
    ? S.barang
    : S.barang.filter(b => b.lini === stokFilterLini);

  if (!list.length){
    el.innerHTML = filterHtml +
      `<div class="empty"><span class="e">🏬</span>Belum ada barang</div>`;
    return;
  }
  el.innerHTML = filterHtml +
    `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px">
    <table>
      <thead><tr><th>Kode</th><th>Nama</th>
        <th class="num">Stok</th><th class="num">HPP</th>
        <th class="num">Nilai</th></tr></thead>
      <tbody>${list.map(b => `<tr>
        <td><b>${esc(b.kode)}</b></td>
        <td>${esc(b.nama)}</td>
        <td class="num ${b.stok<=5?'neg':''}"><b>${b.stok}</b></td>
        <td class="num">${rp(b.hargaBeli)}</td>
        <td class="num">${rp(b.stok * b.hargaBeli)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}
