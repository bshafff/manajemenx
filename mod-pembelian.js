/* ═══════════════════════════════════════════════════════════════
   PEMBELIAN — form inline multi-item
   ═══════════════════════════════════════════════════════════════ */

function renderPembelian(){
  /* Default */
  const noEl = document.getElementById('pb-no');
  if (noEl && !noEl.value)
    noEl.value = 'PB-' + String((S.pembelian?.length||0) + 1).padStart(3,'0');
  const tglEl = document.getElementById('pb-tgl');
  if (tglEl && !tglEl.value) tglEl.value = today();

  /* Supplier */
  const supEl = document.getElementById('pb-sup');
  if (supEl){
    const cur = supEl.value;
    supEl.innerHTML = `<option value="">— Pilih Supplier —</option>` +
      S.supplier.filter(entityFilter).map(s =>
        `<option value="${s.id}" ${cur===s.id?'selected':''}>${esc(s.nama)} · ${s.kode}</option>`
      ).join('');
  }

  /* Entitas */
  const entEl = document.getElementById('pb-ent');
  if (entEl){
    const cur = entEl.value;
    const vis = visibleEntities();
    entEl.innerHTML = vis.map(k => {
      const e = entInfo(k);
      return `<option value="${k}" ${cur===k?'selected':''}>${e.ico} ${e.nama}</option>`;
    }).join('');
  }

  /* Items: pastikan minimal 1 baris */
  const items = document.getElementById('pb-items');
  if (items && !items.children.length) pbAddItem();

  pbHitung();

  /* Counter */
  const cnt = document.getElementById('pb-count');
  if (cnt) cnt.textContent = (S.pembelian || []).length;

  /* Tabel */
  const el = document.getElementById('pembelian-list');
  if (!el) return;
  const list = (S.pembelian || []).filter(entityFilter).slice(0, 10);
  if (!list.length){
    el.innerHTML = `<div class="empty"><span class="e">🛒</span>Belum ada faktur</div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap">
    <table>
      <thead><tr>
        <th>No</th><th>Tanggal</th><th>Supplier</th>
        <th class="num">DPP</th><th class="num">PPN</th>
        <th class="num">Total</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>${list.map(p => {
        const dpp = sum(p.items||[], i => i.qty*i.harga);
        const ppn = p.ppnPersen ? Math.round(dpp * p.ppnPersen / 100) : 0;
        return `<tr>
          <td><b>${esc(p.no)}</b></td>
          <td>${dmy(p.tgl)}</td>
          <td>${esc(p.supplier||'-')}</td>
          <td class="num">${rp(dpp)}</td>
          <td class="num">${p.ppnPersen ? rp(ppn)+' ('+p.ppnPersen+'%)' : '-'}</td>
          <td class="num"><b>${rp(dpp+ppn)}</b></td>
          <td><span class="tag ${p.status==='lunas'?'t-ok':'t-warn'}">${p.status}</span></td>
          <td class="tb-actions">
            <button class="ibtn" onclick="pbView('${p.id}')">👁</button>
            <button class="ibtn" onclick="pbDel('${p.id}')">🗑️</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

/* ─── Item row ─── */
function pbAddItem(){
  const tb = document.getElementById('pb-items');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="pb-brg" onchange="pbOnBarang(this)">
        <option value="">— Pilih Barang —</option>
        ${S.barang.map(b =>
          `<option value="${b.id}">${esc(b.kode)} · ${esc(b.nama)}</option>`
        ).join('')}
      </select>
    </td>
    <td><input class="pb-qty" type="number" min="1" value="1" oninput="pbHitung()"></td>
    <td><input class="pb-hrg" type="number" min="0" value="0" oninput="pbHitung()"></td>
    <td class="num pb-sub">Rp0</td>
    <td class="col-x">
      <button class="x2" onclick="this.closest('tr').remove();pbHitung()">✕</button>
    </td>`;
  tb.appendChild(tr);
}

function pbOnBarang(sel){
  const tr = sel.closest('tr');
  const b = brg(sel.value); if (!b) return;
  const hrg = tr.querySelector('.pb-hrg');
  if (hrg && !+hrg.value) hrg.value = b.hargaBeli || 0;
  pbHitung();
}

function pbReadItems(){
  return [...document.querySelectorAll('#pb-items tr')].map(tr => {
    const id = tr.querySelector('.pb-brg').value;
    const qty = +tr.querySelector('.pb-qty').value || 0;
    const hrg = +tr.querySelector('.pb-hrg').value || 0;
    return { barangId: id, qty, harga: hrg };
  }).filter(x => x.barangId && x.qty > 0);
}

function pbHitung(){
  let dpp = 0;
  document.querySelectorAll('#pb-items tr').forEach(tr => {
    const qty = +tr.querySelector('.pb-qty')?.value || 0;
    const hrg = +tr.querySelector('.pb-hrg')?.value || 0;
    const sub = qty * hrg;
    const subEl = tr.querySelector('.pb-sub');
    if (subEl) subEl.textContent = rp(sub);
    dpp += sub;
  });
  const ppn = +document.getElementById('pb-ppn')?.value || 0;
  const ppnVal = Math.round(dpp * ppn / 100);
  const total = dpp + ppnVal;

  const el = document.getElementById('pb-total');
  if (el) el.innerHTML = `
    <div class="row-total">
      <span class="lbl">DPP (Dasar Pengenaan Pajak)</span>
      <span>${rp(dpp)}</span>
    </div>
    <div class="row-total">
      <span class="lbl">PPN ${ppn}%</span>
      <span>${rp(ppnVal)}</span>
    </div>
    <div class="row-total big-row">
      <span class="lbl">Total Faktur</span>
      <span class="val">${rp(total)}</span>
    </div>`;
}

/* ─── Save ─── */
function pbSave(){
  const no = document.getElementById('pb-no').value.trim();
  const tgl = document.getElementById('pb-tgl').value;
  const supId = document.getElementById('pb-sup').value;
  const status = document.getElementById('pb-status').value;
  const ppnPersen = +document.getElementById('pb-ppn').value || 0;
  const entity = document.getElementById('pb-ent').value;
  const ket = document.getElementById('pb-ket').value.trim();
  const items = pbReadItems();

  if (!items.length) return toast('Minimal 1 barang', 'error');
  if (S.pembelian.find(x => x.no === no))
    return toast('No faktur ' + no + ' sudah dipakai', 'error');

  const sup = supId ? S.supplier.find(s => s.id === supId) : null;
  const dpp = sum(items, i => i.qty * i.harga);
  const ppnVal = Math.round(dpp * ppnPersen / 100);
  const total = dpp + ppnVal;

  if (status === 'lunas' && total > kasOf(entity))
    return toast(`Kas ${entity} cuma ${rp(kasOf(entity))}`, 'error');

  /* Stok masuk */
  items.forEach(it => stokMasuk(it.barangId, it.qty, it.harga));
  if (status === 'lunas') addKas(entity, -total);

  const rec = {
    id: uid(), no, tgl, entity,
    supplier: sup ? sup.nama : '',
    supplierId: sup ? sup.id : '',
    status, items, ppnPersen, ket,
    dibayar: status === 'lunas' ? total : 0,
  };
  S.pembelian.unshift(rec);
  persist();
  queue({ type:'pembelian', action:'upsert', record:rec });

  /* Reset */
  document.getElementById('pb-no').value =
    'PB-' + String((S.pembelian?.length||0) + 1).padStart(3,'0');
  document.getElementById('pb-sup').value = '';
  document.getElementById('pb-items').innerHTML = '';
  document.getElementById('pb-ket').value = '';
  document.getElementById('pb-ppn').value = 0;
  pbAddItem(); pbHitung();

  renderPembelian();
  refreshDashboard();
  toast('✓ Faktur disimpan');
}

function pbView(id){
  const p = S.pembelian.find(x => x.id === id); if (!p) return;
  const dpp = sum(p.items, i => i.qty*i.harga);
  const ppnVal = p.ppnPersen ? Math.round(dpp * p.ppnPersen / 100) : 0;
  openModal('Faktur ' + p.no, dmy(p.tgl), `
    <table style="font-size:13px">
      <tr><td>Supplier</td><td><b>${esc(p.supplier||'-')}</b></td></tr>
      <tr><td>Status</td><td><span class="tag ${p.status==='lunas'?'t-ok':'t-warn'}">${p.status}</span></td></tr>
      <tr><td>Kantor</td><td>${entInfo(p.entity).ico} ${entInfo(p.entity).nama}</td></tr>
    </table>
    <table style="font-size:13px;margin-top:10px">
      <thead><tr><th>Barang</th><th class="num">Qty</th>
        <th class="num">Harga</th><th class="num">Sub</th></tr></thead>
      ${p.items.map(i => {
        const b = brg(i.barangId);
        return `<tr>
          <td>${b?esc(b.nama):'—'}</td>
          <td class="num">${i.qty}</td>
          <td class="num">${rp(i.harga)}</td>
          <td class="num">${rp(i.qty*i.harga)}</td>
        </tr>`;
      }).join('')}
    </table>
    <div class="total-area" style="margin-top:10px">
      <div class="row-total"><span class="lbl">DPP</span><span>${rp(dpp)}</span></div>
      <div class="row-total"><span class="lbl">PPN ${p.ppnPersen||0}%</span><span>${rp(ppnVal)}</span></div>
      <div class="row-total big-row"><span class="lbl">Total</span><span class="val">${rp(dpp+ppnVal)}</span></div>
    </div>
  `, () => closeModal(), 'Tutup');
}

function pbDel(id){
  const p = S.pembelian.find(x => x.id === id); if (!p) return;
  if (!confirm('Hapus faktur? Stok dikembalikan.')) return;
  p.items.forEach(i => { const b = brg(i.barangId); if (b) b.stok -= i.qty; });
  const dpp = sum(p.items, i => i.qty*i.harga);
  const ppnVal = p.ppnPersen ? Math.round(dpp * p.ppnPersen / 100) : 0;
  if (p.status === 'lunas') addKas(p.entity, dpp + ppnVal);
  S.pembelian = S.pembelian.filter(x => x.id !== id);
  persist();
  queue({ type:'pembelian', action:'delete', id });
  renderPembelian();
  refreshDashboard();
  toast('Dihapus');
}

window.pbAddItem = pbAddItem;
window.pbOnBarang = pbOnBarang;
window.pbHitung = pbHitung;
window.pbSave = pbSave;
window.pbView = pbView;
window.pbDel = pbDel;
