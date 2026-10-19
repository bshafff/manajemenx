/* ═══════════════════════════════════════════════════════════════
   MASTER PELANGGAN
   ═══════════════════════════════════════════════════════════════ */

function renderPelanggan(){
  const el = document.getElementById('pelanggan-list');
  if (!el) return;
  const list = S.pelanggan.filter(entityFilter);
  if (!list.length){
    el.innerHTML = `<div class="empty"><span class="e">👥</span>
      Belum ada pelanggan</div>`;
    return;
  }
  el.innerHTML = `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px">
    <table>
      <thead><tr><th>Kode</th><th>Nama</th><th>Channel</th>
        <th>Kontak</th><th></th></tr></thead>
      <tbody>${list.map(p => {
        const e = entInfo(p.entity);
        const ch = CHANNELS[p.channel] || { ico:'•', nama:p.channel||'-' };
        return `<tr>
        <td><b>${esc(p.kode)}</b>
          <div class="hint" style="margin:0">${e.ico} ${e.kode}</div></td>
        <td>${esc(p.nama)}
          <div class="hint" style="margin:0">${esc(p.alamat||'')}</div></td>
        <td><span class="tag t-inf">${ch.ico} ${ch.nama}</span>
          <div class="hint" style="margin:0">TOP ${p.top||0} hari</div></td>
        <td>${esc(p.telp||'-')}
          <div class="hint" style="margin:0">${esc(p.email||'')}</div></td>
        <td style="white-space:nowrap">
          <button class="ibtn" onclick="editPelanggan('${p.id}')">✏️</button>
          <button class="ibtn" onclick="delPelanggan('${p.id}')">🗑️</button>
        </td>
      </tr>`; }).join('')}</tbody>
    </table></div>`;
}

function pelangganForm(p){
  const vis = visibleEntities();
  return `
    <div class="grid">
      <div><label>Kode</label>
        <input id="p-kode" value="${esc(p.kode)}"></div>
      <div><label>Entitas</label>
        <select id="p-ent">${vis.map(k => {
          const e = entInfo(k);
          return `<option value="${k}" ${p.entity===k?'selected':''}>
            ${e.ico} ${e.nama}</option>`;
        }).join('')}</select></div>
    </div>
    <label>Nama Pelanggan</label>
    <input id="p-nama" value="${esc(p.nama)}">
    <label>Channel</label>
    <select id="p-ch">${Object.entries(CHANNELS).map(([k,v]) =>
      `<option value="${k}" ${p.channel===k?'selected':''}>
        ${v.ico} ${v.nama}</option>`).join('')}</select>
    <label>Alamat</label>
    <input id="p-alamat" value="${esc(p.alamat||'')}">
    <div class="grid">
      <div><label>Telepon</label>
        <input id="p-telp" value="${esc(p.telp||'')}"></div>
      <div><label>Email</label>
        <input id="p-email" value="${esc(p.email||'')}"></div>
    </div>
    <div class="grid">
      <div><label>Termin (hari)</label>
        <input id="p-top" type="number" value="${p.top||0}"></div>
      <div><label>Limit Kredit</label>
        <input id="p-limit" type="number" value="${p.limit||0}"></div>
    </div>
    <label>NPWP</label>
    <input id="p-npwp" value="${esc(p.npwp||'')}">`;
}

function readPelangganForm(){
  const vis = visibleEntities();
  return {
    kode:    document.getElementById('p-kode').value.trim() || 'CUS-' + uid().slice(0,4).toUpperCase(),
    entity:  document.getElementById('p-ent').value || (vis[0] || 'SB'),
    nama:    document.getElementById('p-nama').value.trim(),
    channel: document.getElementById('p-ch').value,
    alamat:  document.getElementById('p-alamat').value.trim(),
    telp:    document.getElementById('p-telp').value.trim(),
    email:   document.getElementById('p-email').value.trim(),
    top:     +document.getElementById('p-top').value || 0,
    limit:   +document.getElementById('p-limit').value || 0,
    npwp:    document.getElementById('p-npwp').value.trim(),
  };
}

function addPelanggan(){
  const blank = { kode:'', entity:(visibleEntities()[0]||'SB'),
    nama:'', channel:'mitra', alamat:'', telp:'', email:'',
    top:0, limit:0, npwp:'' };
  openModal('Tambah Pelanggan', '', pelangganForm(blank), () => {
    const d = readPelangganForm();
    if (!d.nama) return toast('Nama wajib diisi', 'error');
    const rec = { id: uid(), ...d };
    S.pelanggan.push(rec);
    persist();
    queue({ type:'pelanggan', action:'upsert', record:rec });
    closeModal(); renderPelanggan(); toast('Pelanggan disimpan');
  });
}
function editPelanggan(id){
  const p = S.pelanggan.find(x => x.id === id); if (!p) return;
  openModal('Edit Pelanggan', '', pelangganForm(p), () => {
    Object.assign(p, readPelangganForm());
    persist();
    queue({ type:'pelanggan', action:'upsert', record:p });
    closeModal(); renderPelanggan(); toast('Diperbarui');
  });
}
function delPelanggan(id){
  if (!confirm('Hapus pelanggan ini?')) return;
  S.pelanggan = S.pelanggan.filter(x => x.id !== id);
  persist();
  queue({ type:'pelanggan', action:'delete', id });
  renderPelanggan(); toast('Dihapus');
}
