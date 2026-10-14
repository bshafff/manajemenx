let barangFilterLini = 'ALL';

function renderBarang(){
  const el = document.getElementById('barang-list');
  if (!el) return;

  // Filter dropdown
  const filterHtml = `
    <div class="btn-row" style="margin-bottom:10px">
      <select id="bar-fil" onchange="barangFilterLini=this.value;renderBarang()">
        <option value="ALL" ${barangFilterLini==='ALL'?'selected':''}>Semua Lini</option>
        ${Object.keys(LINI).map(k =>
          `<option value="${k}" ${barangFilterLini===k?'selected':''}>
            ${LINI[k].ico} ${LINI[k].nama}
          </option>`).join('')}
      </select>
    </div>`;

  const list = barangFilterLini === 'ALL'
    ? S.barang
    : S.barang.filter(b => b.lini === barangFilterLini);

  if (!list.length){
    el.innerHTML = filterHtml +
      `<div class="empty"><span class="e">📦</span>Belum ada barang</div>`;
    return;
  }

  el.innerHTML = filterHtml +
    `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px">
    <table>
      <thead><tr><th>Lini</th><th>Kode / Nama</th>
        <th class="num">Stok</th><th class="num">HPP</th>
        <th class="num">Jual</th><th></th></tr></thead>
      <tbody>${list.map(b => {
        const li = LINI[b.lini] || { ico:'•', nama:'?', warna:'#888' };
        return `<tr>
        <td><span class="tag" style="background:${li.warna}22;
          color:${li.warna};font-weight:700">${li.ico} ${b.lini}</span></td>
        <td><b>${esc(b.kode)}</b>
          <div class="hint" style="margin:0">${esc(b.nama)} · ${esc(b.satuan)} · ${b.tipe}</div></td>
        <td class="num ${b.stok<=5?'neg':''}"><b>${b.stok}</b></td>
        <td class="num">${rp(b.hargaBeli)}</td>
        <td class="num">${rp(b.hargaJual)}</td>
        <td style="white-space:nowrap">
          <button class="ibtn" onclick="editItem('${b.id}')">✏️</button>
          <button class="ibtn" onclick="delItem('${b.id}')">🗑️</button>
        </td>
      </tr>`; }).join('')}</tbody>
    </table></div>`;
}

function itemForm(b){
  return `
    <div class="grid">
      <div><label>Lini Usaha</label>
        <select id="f-lini">
          ${Object.keys(LINI).map(k =>
            `<option value="${k}" ${b.lini===k?'selected':''}>
              ${LINI[k].ico} ${LINI[k].nama}</option>`).join('')}
        </select></div>
      <div><label>Kode</label>
        <input id="f-kode" value="${esc(b.kode)}"></div>
    </div>
    <label>Nama Barang</label>
    <input id="f-nama" value="${esc(b.nama)}">
    <div class="grid">
      <div><label>Satuan</label>
        <input id="f-sat" value="${esc(b.satuan)}"></div>
      <div><label>Tipe</label>
        <select id="f-tipe">
          <option value="bahan" ${b.tipe==='bahan'?'selected':''}>Bahan Baku</option>
          <option value="jadi" ${b.tipe==='jadi'?'selected':''}>Barang Jadi</option>
        </select></div>
    </div>
    <div class="grid">
      <div><label>Stok</label>
        <input id="f-stok" type="number" value="${b.stok}"></div>
      <div><label>HPP / Beli</label>
        <input id="f-hb" type="number" value="${b.hargaBeli}"></div>
    </div>
    <label>Harga Jual</label>
    <input id="f-hj" type="number" value="${b.hargaJual}">`;
}

function readItemForm(){
  const lini = document.getElementById('f-lini').value;
  const kodeRaw = document.getElementById('f-kode').value.trim();
  return {
    lini,
    kode: kodeRaw || (lini + '-B' + uid().slice(0,3).toUpperCase()),
    nama: document.getElementById('f-nama').value.trim(),
    satuan: document.getElementById('f-sat').value.trim() || 'pcs',
    tipe: document.getElementById('f-tipe').value,
    stok: +document.getElementById('f-stok').value || 0,
    hargaBeli: +document.getElementById('f-hb').value || 0,
    hargaJual: +document.getElementById('f-hj').value || 0,
  };
}

function addItem(){
  const blank = { lini:'SB', kode:'', nama:'', satuan:'pcs', tipe:'bahan',
    stok:0, hargaBeli:0, hargaJual:0 };
  openModal('Tambah Barang', '', itemForm(blank), () => {
    const d = readItemForm();
    if (!d.nama) return toast('Nama wajib diisi', 'error');
    const item = { id: uid(), ...d };
    S.barang.push(item);
    persist();
    queue({ type: 'barang', action: 'upsert', record: item });
    closeModal(); renderBarang(); toast('Barang disimpan');
  });
}

function editItem(id){
  const b = brg(id); if (!b) return;
  openModal('Edit Barang', '', itemForm(b), () => {
    const d = readItemForm();
    if (!d.nama) return toast('Nama wajib diisi', 'error');
    Object.assign(brg(id), d);
    persist();
    queue({ type: 'barang', action: 'upsert', record: brg(id) });
    closeModal(); renderBarang(); toast('Diperbarui');
  });
}

function delItem(id){
  if (!confirm('Hapus barang ini?')) return;
  S.barang = S.barang.filter(b => b.id !== id);
  persist();
  queue({ type: 'barang', action: 'delete', id });
  renderBarang(); toast('Dihapus');
}
