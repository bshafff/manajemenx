/* ═══════════════════════════════════════════════════════════════
   MASTER SUPPLIER
   ═══════════════════════════════════════════════════════════════ */

function renderSupplier(){
  const el = document.getElementById('supplier-list');
  if (!el) return;
  const list = (S.supplier || []).filter(entityFilter);
  if (!list.length){
    el.innerHTML = `<div class="empty"><span class="e">🏭</span>
      Belum ada supplier</div>`;
    return;
  }
  el.innerHTML = `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px">
    <table>
      <thead><tr><th>Kode</th><th>Nama</th><th>Kontak</th>
        <th>Termin</th><th></th></tr></thead>
      <tbody>${list.map(s => {
        const e = entInfo(s.entity);
        return `<tr>
        <td><b>${esc(s.kode)}</b>
          <div class="hint" style="margin:0">${e.ico} ${e.kode}</div></td>
        <td>${esc(s.nama)}
          <div class="hint" style="margin:0">${esc(s.alamat||'')}</div></td>
        <td>${esc(s.telp||'-')}
          <div class="hint" style="margin:0">${esc(s.email||'')}</div></td>
        <td>${s.top || 0} hari</td>
        <td style="white-space:nowrap">
          <button class="ibtn" onclick="editSupplier('${s.id}')">✏️</button>
          <button class="ibtn" onclick="delSupplier('${s.id}')">🗑️</button>
        </td>
      </tr>`; }).join('')}</tbody>
    </table></div>`;
}

function supplierForm(s){
  const vis = visibleEntities();
  return `
    <div class="grid">
      <div><label>Kode</label>
        <input id="s-kode" value="${esc(s.kode)}"></div>
      <div><label>Entitas</label>
        <select id="s-ent">${vis.map(k => {
          const e = entInfo(k);
          return `<option value="${k}" ${s.entity===k?'selected':''}>
            ${e.ico} ${e.nama}</option>`;
        }).join('')}</select></div>
    </div>
    <label>Nama Supplier</label>
    <input id="s-nama" value="${esc(s.nama)}">
    <label>Alamat</label>
    <input id="s-alamat" value="${esc(s.alamat||'')}">
    <div class="grid">
      <div><label>Telepon</label>
        <input id="s-telp" value="${esc(s.telp||'')}"></div>
      <div><label>Email</label>
        <input id="s-email" value="${esc(s.email||'')}"></div>
    </div>
    <div class="grid">
      <div><label>Termin (hari)</label>
        <input id="s-top" type="number" value="${s.top||0}"></div>
      <div><label>NPWP</label>
        <input id="s-npwp" value="${esc(s.npwp||'')}"></div>
    </div>
    <label><input type="checkbox" id="s-pkp" ${s.pkp?'checked':''}
      style="width:auto;margin-right:6px">Supplier PKP (kena PPN)</label>`;
}

function readSupplierForm(){
  const vis = visibleEntities();
  return {
    kode:   document.getElementById('s-kode').value.trim() || 'SUP-' + uid().slice(0,4).toUpperCase(),
    entity: document.getElementById('s-ent').value || (vis[0] || 'HQ'),
    nama:   document.getElementById('s-nama').value.trim(),
    alamat: document.getElementById('s-alamat').value.trim(),
    telp:   document.getElementById('s-telp').value.trim(),
    email:  document.getElementById('s-email').value.trim(),
    top:    +document.getElementById('s-top').value || 0,
    npwp:   document.getElementById('s-npwp').value.trim(),
    pkp:    document.getElementById('s-pkp').checked,
  };
}

function addSupplier(){
  const blank = { kode:'', entity:(visibleEntities()[0]||'SB'),
    nama:'', alamat:'', telp:'', email:'', top:0, npwp:'', pkp:false };
  openModal('Tambah Supplier', '', supplierForm(blank), () => {
    const d = readSupplierForm();
    if (!d.nama) return toast('Nama wajib diisi', 'error');
    const rec = { id: uid(), ...d };
    S.supplier.push(rec);
    persist();
    queue({ type:'supplier', action:'upsert', record:rec });
    closeModal(); renderSupplier(); toast('Supplier disimpan');
  });
}
function editSupplier(id){
  const s = S.supplier.find(x => x.id === id); if (!s) return;
  openModal('Edit Supplier', '', supplierForm(s), () => {
    Object.assign(s, readSupplierForm());
    persist();
    queue({ type:'supplier', action:'upsert', record:s });
    closeModal(); renderSupplier(); toast('Diperbarui');
  });
}
function delSupplier(id){
  if (!confirm('Hapus supplier ini?')) return;
  S.supplier = S.supplier.filter(x => x.id !== id);
  persist();
  queue({ type:'supplier', action:'delete', id });
  renderSupplier(); toast('Dihapus');
}
