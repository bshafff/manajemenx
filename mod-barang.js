/* ═══════════════════════════════════════════════════════════════
   MASTER BARANG
   ═══════════════════════════════════════════════════════════════ */
let editBarangId = null;

function renderBarang(){
  const cnt = document.getElementById('barang-count'); if (cnt) cnt.textContent = S.barang.length;
  const el = document.getElementById('barang-list'); if (!el) return;

  if (!S.barang.length){
    el.innerHTML = `<div class="empty"><span class="e">📦</span>Belum ada barang. Tambah lewat form di atas.</div>`;
    return;
  }

  const ent = activeEntity();
  const list = ent === 'ALL' ? S.barang : S.barang.filter(b => b.lini === ent);

  el.innerHTML = `<div class="table-wrap">
    <table>
      <thead><tr>
        <th>ID</th><th>Nama</th><th>UoM</th><th>Lini</th>
        <th>Kategori</th><th class="num">Stok</th>
        <th class="num">H. Beli</th><th class="num">H. Jual</th>
        <th class="num">Min</th><th></th>
      </tr></thead>
      <tbody>${list.map(b => {
        const li = LINI[b.lini] || { ico:'•', nama:'?', warna:'#888' };
        const kritis = b.stok <= (b.minStok || 5);
        return `<tr>
          <td><b>${esc(b.kode)}</b></td>
          <td>${esc(b.nama)}</td>
          <td>${esc(b.satuan)}</td>
          <td><span class="tag" style="background:${li.warna}22;color:${li.warna};font-weight:700">${li.ico} ${b.lini}</span></td>
          <td>${b.tipe === 'jadi' ? 'Barang Jadi' : 'Bahan Baku'}</td>
          <td class="num ${kritis?'neg':''}"><b>${b.stok}</b></td>
          <td class="num">${rp(b.hargaBeli)}</td>
          <td class="num">${rp(b.hargaJual)}</td>
          <td class="num">${b.minStok || 5}</td>
          <td class="tb-actions">
            <button class="ibtn" onclick="kartuStok('${b.id}')" title="Kartu stok">📜</button>
            <button class="ibtn" onclick="editBarang('${b.id}')">✏️</button>
            <button class="ibtn" onclick="delBarang('${b.id}')">🗑️</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function readBarangForm(){
  return {
    lini:     document.getElementById('f-lini').value,
    kode:     document.getElementById('f-kode').value.trim(),
    nama:     document.getElementById('f-nama').value.trim(),
    satuan:   document.getElementById('f-sat').value.trim() || 'pcs',
    tipe:     document.getElementById('f-tipe').value,
    stokAwal: +document.getElementById('f-stok').value || 0,
    hargaBeli: +document.getElementById('f-hb').value || 0,
    hargaJual: +document.getElementById('f-hj').value || 0,
    minStok:  +document.getElementById('f-min').value || 5,
    catatan:  document.getElementById('f-cat').value.trim(),
  };
}
function fillBarangForm(b){
  document.getElementById('f-lini').value   = b.lini || 'SB';
  document.getElementById('f-kode').value   = b.kode || '';
  document.getElementById('f-nama').value   = b.nama || '';
  document.getElementById('f-sat').value    = b.satuan || 'pcs';
  document.getElementById('f-tipe').value   = b.tipe || 'bahan';
  document.getElementById('f-stok').value   = b.stokAwal || 0;
  document.getElementById('f-hb').value     = b.hargaBeli || 0;
  document.getElementById('f-hj').value     = b.hargaJual || 0;
  document.getElementById('f-min').value    = b.minStok || 5;
  document.getElementById('f-cat').value    = b.catatan || '';
}
function clearBarangForm(){
  fillBarangForm({ lini:'SB', kode:'', nama:'', satuan:'pcs', tipe:'bahan', stokAwal:0, hargaBeli:0, hargaJual:0, minStok:5, catatan:'' });
  editBarangId = null;
  document.getElementById('barang-form-title').textContent = '📦 Tambah Barang';
  document.getElementById('barang-submit').textContent = '＋ Tambah Barang';
  document.getElementById('barang-cancel').style.display = 'none';
}

function saveBarang(){
  const d = readBarangForm();
  if (!d.nama) return toast('Nama barang wajib diisi', 'error');

  if (editBarangId){
    const b = brg(editBarangId); if (!b) return;
    Object.assign(b, d);
    if (!b.kode) b.kode = d.lini + '-B' + uid().slice(0,3).toUpperCase();
    recalcStok(); // Hitung ulang stok setelah edit stokAwal
    persist(); queue({ type:'barang', action:'upsert', record:b });
    toast('✓ Barang diperbarui');
  } else {
    if (!d.kode) d.kode = d.lini + '-B' + uid().slice(0,3).toUpperCase();
    if (S.barang.find(b => b.kode === d.kode)) return toast('Kode ' + d.kode + ' sudah dipakai', 'error');
    const rec = { id: uid(), ...d };
    S.barang.push(rec);
    recalcStok(); // Hitung stok awal
    persist(); queue({ type:'barang', action:'upsert', record:rec });
    toast('✓ Barang ditambahkan');
  }
  clearBarangForm(); renderBarang(); refreshDashboard();
}

function editBarang(id){
  const b = brg(id); if (!b) return;
  fillBarangForm(b); editBarangId = id;
  document.getElementById('barang-form-title').textContent = '✏️ Edit Barang';
  document.getElementById('barang-submit').textContent = '💾 Simpan Perubahan';
  document.getElementById('barang-cancel').style.display = 'inline-flex';
  document.getElementById('v-barang').scrollIntoView({ behavior:'smooth' });
}

function cancelEditBarang(){ clearBarangForm(); }

function delBarang(id){
  const b = brg(id); if (!b) return;
  if (!confirm(`Hapus barang "${b.nama}"?`)) return;
  S.barang = S.barang.filter(x => x.id !== id);
  persist(); queue({ type:'barang', action:'delete', id }); renderBarang(); refreshDashboard(); toast('Dihapus');
}

function refreshDashboard(){
  if (typeof renderDashboard === 'function' && document.getElementById('v-dashboard')?.classList.contains('active')) renderDashboard();
}

window.saveBarang = saveBarang;
window.editBarang = editBarang;
window.delBarang = delBarang;
window.cancelEditBarang = cancelEditBarang;
