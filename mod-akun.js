/* ═══════════════════════════════════════════════════════════════
   KELOLA AKUN — tambah/ubah/hapus akun, atur entitas & akses menu
   Hanya owner. Menu Home & navigasi mengikuti akses akun yang login.
   ═══════════════════════════════════════════════════════════════ */

const MOD_LIST = [
  ['dashboard','📊 Ringkasan'], ['eksekutif','🧭 Ringkasan Eksekutif'], ['coa','🏦 Akun Perkiraan'], ['jurnalUmum','📒 Jurnal Umum'], ['laporanAkuntansi','⚖️ Neraca Saldo'],
  ['barang','📦 Barang'], ['supplier','🚚 Supplier'], ['pelanggan','👥 Pelanggan'], ['pembelian','🛒 Pembelian'], ['penjualan','🧾 Penjualan'],
  ['penerimaan','💰 Penerimaan'], ['pembayaran','💸 Pembayaran'], ['kaskecil','👛 Kas Kecil'], ['jurnal','📚 Jurnal Buku Besar'], ['produksi','🏭 Produksi'], ['panen','🍓 Panen'], ['kandang','🐔 Kandang'], ['laporanKeuangan','📈 Laba Rugi & Neraca'], ['penyesuaian','⚙️ Stok Opname'], ['pesananPembelian','📝 Pesanan Beli'], ['penerimaanBarang','📥 Terima Barang'], ['retur','↩️ Retur'], ['tutupBuku','🔒 Tutup Buku'], ['aset','🏢 Aset Tetap'], ['migrasi','🚀 Migrasi Saldo Awal'], 
];

const ROLES = ['owner','manajer','kasir','gudang','produksi'];

// Mengambil default menu berdasarkan role (abaikan 'home' & '*' karena otomatis)
const roleDefault = r => (ROLE_ACCESS[r] || []).filter(x => x !== 'home' && x !== '*');

// Mengambil menu yang aktif untuk user (custom atau default)
const userMods = u => {
  if (u.role === 'owner') return MOD_LIST.map(m => m[0]);
  if (Array.isArray(u.akses)) return u.akses;
  return roleDefault(u.role);
};

function akFillMods(role){
  const def = role === 'owner' ? MOD_LIST.map(m => m[0]) : roleDefault(role);
  MOD_LIST.forEach(([k]) => {
    const c = document.getElementById('ak-m-' + k);
    if (c) {
      c.checked = def.includes(k); 
      c.disabled = role === 'owner';
    }
  });
}

function akModal(id){
  const u = id ? S.users.find(x => x.id === id) : null;
  const role = u ? u.role : 'manajer';
  const mods = u ? userMods(u) : roleDefault(role);
  
  openModal(u ? '✏️ Ubah Akun' : '➕ Akun Baru', 'Atur siapa boleh membuka menu apa', `
    <div class="form-grid">
      <div><label>Nama</label><input id="ak-nama" value="${u ? esc(u.nama) : ''}" placeholder="Nama staf"></div>
      <div><label>PIN (4–6 angka)</label><input id="ak-pin" inputmode="numeric" maxlength="6" value="${u ? esc(u.pin) : ''}"></div>
      <div><label>Role</label><select id="ak-role" onchange="akFillMods(this.value)">${ROLES.map(r => `<option ${r===role?'selected':''}>${r}</option>`).join('')}</select></div>
      <div><label>Entitas (lini)</label><select id="ak-ent">${entOpts(u ? u.entity : 'SB')}</select></div>
    </div>
    <label style="margin-top:10px">Menu yang boleh diakses</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${MOD_LIST.map(([k, l]) =>
      `<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="ak-m-${k}" ${mods.includes(k)?'checked':''} ${role==='owner'?'disabled':''}> ${l}</label>`).join('')}</div>
    <div class="hint">Role mengisi pilihan awal; centang manual untuk menyesuaikan. Owner selalu akses penuh.</div>`,
    () => akSave(id), 'Simpan');
}

async function akSave(id){
  const nama = val('ak-nama'), pin = val('ak-pin'), role = val('ak-role'), entity = val('ak-ent');
  if (!nama) return toast('Nama wajib diisi', 'error');
  if (!/^\d{4,6}$/.test(pin)) return toast('PIN harus 4–6 angka', 'error');
  
  const sel = MOD_LIST.map(m => m[0]).filter(k => document.getElementById('ak-m-' + k).checked);
  const def = roleDefault(role);
  
  const sama = sel.length === def.length && sel.every(k => def.includes(k));
  const akses = role === 'owner' || sama ? null : sel;
  
  let u = id ? S.users.find(x => x.id === id) : null;
  if (u){
    if (u.role === 'owner' && role !== 'owner' && S.users.filter(x => x.role === 'owner').length < 2)
      return toast('Harus ada minimal satu owner', 'error');
    
    // Hash PIN baru
    const hashed = await hashPin(pin);
    Object.assign(u, { nama, pin: hashed, role, entity, akses });
  } else {
    // Hash PIN user baru
    const hashed = await hashPin(pin);
    u = { id: uid(), nama, pin: hashed, role, entity, akses };
    S.users.push(u);
  }
  
  persist(); 
  if (typeof farmQueue === 'function') farmQueue('users', 'upsert', u);
  
  closeModal(); 
  renderAkun(); 
  refreshAll(); 
  renderSidebar(); 
  toast('✓ Akun disimpan');
}

function akDel(id){
  const u = S.users.find(x => x.id === id); if (!u) return;
  if (u.id === currentUser().id) return toast('Tidak bisa menghapus akun yang sedang dipakai', 'error');
  if (u.role === 'owner' && S.users.filter(x => x.role === 'owner').length < 2)
    return toast('Harus ada minimal satu owner', 'error');
  if (!confirm(`Hapus akun ${u.nama}?`)) return;
  
  S.users = S.users.filter(x => x.id !== id);
  persist(); 
  if (typeof farmQueue === 'function') farmQueue('users', 'delete', null, id); 
  renderAkun();
}

function renderAkun(){
  const el = document.getElementById('akun-root'); if (!el) return;
  if (!canAccess('akun')){ el.innerHTML = ''; return; }
  
  /* Kirim akun ke Sheet jika belum (sekali saja) */
  if (typeof SYNC_NEW !== 'undefined' && SYNC_NEW && !localStorage.imb_users_synced){
    if (typeof farmQueue === 'function') S.users.forEach(u => farmQueue('users', 'upsert', u));
    localStorage.imb_users_synced = '1';
  }
  
  el.innerHTML = `<div class="card"><div class="card-header-flex"><h3>👤 Kelola Akun</h3>
    <button class="btn btn-p btn-sm" onclick="akModal()">+ Akun</button></div>
    <div class="hint">${S.users.length} akun · PIN disimpan apa adanya, ganti PIN bawaan sebelum dipakai sungguhan.</div>
    <div class="table-wrap"><table><thead><tr><th>Akun</th><th>Role</th><th>Lini</th><th>Menu</th><th></th></tr></thead><tbody>
    ${S.users.map(u => { const e = entInfo(u.entity); const m = userMods(u);
      return `<tr><td><b>${esc(u.nama)}</b><br><span class="hint">PIN ${'•'.repeat(String(u.pin).length)}</span></td>
      <td>${esc(u.role)}</td><td>${e.ico} ${e.kode}</td>
      <td>${u.role === 'owner' ? 'Semua' : m.length + ' menu' + (Array.isArray(u.akses) ? ' (manual)' : '')}</td>
      <td class="tb-actions"><button class="ibtn" onclick="akModal('${u.id}')">✏️</button>
      <button class="ibtn" onclick="akDel('${u.id}')">🗑️</button></td></tr>`; }).join('')}
    </tbody></table></div></div>`;
}

/* Sembunyikan kartu menu Home yang tidak boleh dibuka akun ini */
function applyMenuAccess(){
  const home = document.getElementById('v-home'); if (!home) return;
  const u = currentUser(), owner = u && u.role === 'owner';
  let label = null, shown = 0;
  const flush = () => { if (label) label.style.display = shown ? '' : 'none'; };
  [...home.children].forEach(el => {
    if (el.classList.contains('section-label')){ flush(); label = el; shown = 0; return; }
    if (!el.classList.contains('menu-card')) return;
    const on = el.getAttribute('onclick') || '';
    const m = on.match(/openModule\('(\w+)'\)/);
    const ok = m ? canAccess(m[1]) : (on.startsWith('restoreData') ? owner : true);
    el.style.display = ok ? '' : 'none';
    if (ok) shown++;
  });
  flush();
}

Object.assign(window, { akModal, akFillMods, akSave, akDel, renderAkun, applyMenuAccess });
