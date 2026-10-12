function renderPermintaan(){
  const el = document.getElementById('permintaan-list');
  if (!el) return;
  const list = S.permintaan || [];
  if (!list.length){
    el.innerHTML = `<div class="empty"><span class="e">📝</span>Belum ada permintaan</div>`;
    return;
  }
  el.innerHTML = list.map(p => `
    <div class="list-item">
      <div class="li-head">
        <b>${esc(p.no)}</b>
        <span class="tag t-inf">${p.status || 'open'}</span>
        <span class="spacer"></span>
        <button class="ibtn" onclick="delPermintaan('${p.id}')">🗑️</button>
      </div>
      <div class="hint">${dmy(p.tgl)} · ${esc(p.ket||'-')}</div>
      <table style="margin-top:6px">
        ${p.items.map(i => { const b = brg(i.barangId); return `<tr>
          <td>${b ? esc(b.nama) : '—'}</td>
          <td class="num">${i.qty}</td></tr>`; }).join('')}
      </table>
    </div>`).join('');
}

function addPermintaan(){
  openModal('Permintaan Pembelian', '', `
    <div class="grid">
      <div><label>No</label>
        <input id="f-no" value="PR-${Date.now().toString().slice(-6)}"></div>
      <div><label>Tanggal</label>
        <input id="f-tgl" type="date" value="${today()}"></div>
    </div>
    <label>Keterangan</label>
    <input id="f-ket" placeholder="Kebutuhan produksi minggu depan">
    <label>Barang Diminta</label>
    <div id="rows">${itemRow('p', 'bahan')}</div>
    <button class="btn btn-s btn-sm" onclick="addRow('rows','p','bahan')">＋ Tambah Baris</button>
  `, () => {
    const items = readRows('p');
    if (!items.length) return toast('Minimal 1 barang', 'error');
    if (!S.permintaan) S.permintaan = [];
    const rec = {
      id: uid(),
      no: document.getElementById('f-no').value,
      tgl: document.getElementById('f-tgl').value,
      ket: document.getElementById('f-ket').value,
      status: 'open',
      items,
    };
    S.permintaan.unshift(rec);
    persist();
    queue({ type: 'permintaan', action: 'upsert', record: rec });
    closeModal(); renderPermintaan(); toast('Permintaan dibuat');
  });
}

function delPermintaan(id){
  if (!confirm('Hapus permintaan ini?')) return;
  S.permintaan = S.permintaan.filter(x => x.id !== id);
  persist();
  queue({ type: 'permintaan', action: 'delete', id });
  renderPermintaan(); toast('Dihapus');
}
