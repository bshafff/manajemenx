/* ═══════════════════════════════════════════════════════════════
   PENJUALAN — form inline + channel + HPP + print docs
   ═══════════════════════════════════════════════════════════════ */

function renderPenjualan(){
  const noEl = document.getElementById('pj-no');
  if (noEl && !noEl.value)
    noEl.value = 'PJ-' + String((S.penjualan?.length||0) + 1).padStart(3,'0');
  const tglEl = document.getElementById('pj-tgl');
  if (tglEl && !tglEl.value) tglEl.value = today();

  const pelEl = document.getElementById('pj-pel');
  if (pelEl){
    const cur = pelEl.value;
    pelEl.innerHTML = `<option value="">— Pilih Pelanggan —</option>` +
      S.pelanggan.filter(entityFilter).map(p =>
        `<option value="${p.id}" ${cur===p.id?'selected':''}>${esc(p.nama)} · ${p.kode}</option>`
      ).join('');
  }

  const entEl = document.getElementById('pj-ent');
  if (entEl){
    const cur = entEl.value;
    const vis = visibleEntities();
    entEl.innerHTML = vis.map(k => {
      const e = entInfo(k);
      return `<option value="${k}" ${cur===k?'selected':''}>${e.ico} ${e.nama}</option>`;
    }).join('');
  }

  const items = document.getElementById('pj-items');
  if (items && !items.children.length) pjAddItem();

  pjHitung();

  const cnt = document.getElementById('pj-count');
  if (cnt) cnt.textContent = (S.penjualan || []).length;

  const el = document.getElementById('penjualan-list');
  if (!el) return;
  const list = (S.penjualan || []).filter(entityFilter).slice(0, 10);
  if (!list.length){
    el.innerHTML = `<div class="empty"><span class="e">🧾</span>Belum ada faktur</div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap">
    <table>
      <thead><tr>
        <th>No</th><th>Tanggal</th><th>Pelanggan</th>
        <th>Ch</th><th class="num">Total</th>
        <th class="num">Margin</th><th>Status</th><th>Aksi</th>
      </tr></thead>
      <tbody>${list.map(p => {
        const dpp = sum(p.items||[], i => i.qty*i.harga);
        const ppn = p.ppnPersen ? Math.round(dpp * p.ppnPersen / 100) : 0;
        const hpp = sum(p.items||[], i => i.qty*(i.hpp||0));
        const ch = CHANNELS[p.channel] || { ico:'•', nama:'-' };
        const lunas = p.status === 'lunas';
        return `<tr>
          <td><b>${esc(p.no)}</b></td>
          <td>${dmy(p.tgl)}</td>
          <td>${esc(p.pelanggan||'-')}</td>
          <td>${ch.ico}</td>
          <td class="num"><b>${rp(dpp+ppn)}</b></td>
          <td class="num pos">${rp(dpp - hpp)}</td>
          <td><span class="tag ${lunas?'t-ok':'t-warn'}">${p.status}</span></td>
          <td class="tb-actions">
            <button class="ibtn" onclick="pjView('${p.id}')" title="Detail">👁</button>
            <button class="ibtn" onclick="printSuratJalan('${p.id}')" title="Surat Jalan">📋</button>
            ${lunas
              ? `<button class="ibtn" onclick="printKwitansiPenjualan('${p.id}')" title="Kwitansi">🖨</button>`
              : `<button class="ibtn" style="opacity:.4;cursor:not-allowed" title="Kwitansi (perlu lunas)">🖨</button>`}
            ${p.ppnPersen && p.nsfp
              ? `<button class="ibtn" onclick="printFakturPajak('${p.id}','jual')" title="Faktur Pajak">🧾</button>`
              : `<button class="ibtn" style="opacity:.4;cursor:not-allowed" title="Faktur Pajak (perlu NSFP + PPN)">🧾</button>`}
            <button class="ibtn" onclick="pjDel('${p.id}')" title="Hapus">🗑️</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function pjAddItem(){
  const tb = document.getElementById('pj-items');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="pj-brg" onchange="pjOnBarang(this)">
        <option value="">— Pilih Barang —</option>
        ${S.barang.map(b =>
          `<option value="${b.id}">${esc(b.kode)} · ${esc(b.nama)} (stok ${b.stok})</option>`
        ).join('')}
      </select>
    </td>
    <td><input class="pj-qty" type="number" min="1" value="1" oninput="pjHitung()"></td>
    <td><input class="pj-hrg" type="number" min="0" value="0" oninput="pjHitung()"></td>
    <td class="num pj-sub">Rp0</td>
    <td class="col-x">
      <button class="x2" onclick="this.closest('tr').remove();pjHitung()">✕</button>
    </td>`;
  tb.appendChild(tr);
}

function pjOnBarang(sel){
  const tr = sel.closest('tr');
  const b = brg(sel.value); if (!b) return;
  const hrg = tr.querySelector('.pj-hrg');
  if (hrg && !+hrg.value) hrg.value = b.hargaJual || 0;
  pjHitung();
}

function pjReadItems(){
  return [...document.querySelectorAll('#pj-items tr')].map(tr => {
    const id = tr.querySelector('.pj-brg').value;
    const qty = +tr.querySelector('.pj-qty').value || 0;
    const hrg = +tr.querySelector('.pj-hrg').value || 0;
    return { barangId: id, qty, harga: hrg };
  }).filter(x => x.barangId && x.qty > 0);
}

function pjHitung(){
  let dpp = 0, hpp = 0, warning = false;
  document.querySelectorAll('#pj-items tr').forEach(tr => {
    const bid = tr.querySelector('.pj-brg')?.value;
    const qty = +tr.querySelector('.pj-qty')?.value || 0;
    const hrg = +tr.querySelector('.pj-hrg')?.value || 0;
    const b = brg(bid);
    const sub = qty * hrg;
    if (b) hpp += qty * (b.hargaBeli || 0);
    if (b && qty > b.stok) warning = true;
    const subEl = tr.querySelector('.pj-sub');
    if (subEl) subEl.textContent = rp(sub);
    dpp += sub;
  });
  const ppn = +document.getElementById('pj-ppn')?.value || 0;
  const ppnVal = Math.round(dpp * ppn / 100);
  const total = dpp + ppnVal;
  const margin = dpp - hpp;

  const el = document.getElementById('pj-total');
  if (el) el.innerHTML = `
    <div class="row-total">
      <span class="lbl">DPP</span><span>${rp(dpp)}</span>
    </div>
    <div class="row-total">
      <span class="lbl">PPN ${ppn}%</span><span>${rp(ppnVal)}</span>
    </div>
    <div class="row-total big-row">
      <span class="lbl">Total Faktur</span>
      <span class="val">${rp(total)}</span>
    </div>
    <div class="row-total" style="border-top:1px dashed #86efac;
         margin-top:8px;padding-top:8px;font-size:12px">
      <span class="lbl">HPP</span><span>${rp(hpp)}</span>
    </div>
    <div class="row-total" style="font-size:12px">
      <span class="lbl">Margin</span>
      <span class="${margin>=0?'pos':'neg'}"><b>${rp(margin)}</b></span>
    </div>
    ${warning ? `<div style="color:var(--red);font-size:11px;
      margin-top:6px;font-weight:700">⚠️ Ada barang yang stoknya kurang</div>` : ''}`;
}

function pjSave(){
  const no = document.getElementById('pj-no').value.trim();
  const tgl = document.getElementById('pj-tgl').value;
  const pelId = document.getElementById('pj-pel').value;
  const channel = document.getElementById('pj-ch').value;
  const status = document.getElementById('pj-status').value;
  const ppnPersen = +document.getElementById('pj-ppn').value || 0;
  const entity = document.getElementById('pj-ent').value;
  const noSuratJalan = document.getElementById('pj-sj').value.trim();
  const nsfp = document.getElementById('pj-nsfp').value.trim();
  const ket = document.getElementById('pj-ket').value.trim();
  const items = pjReadItems();

  if (!items.length) return toast('Minimal 1 barang', 'error');
  if (S.penjualan.find(x => x.no === no))
    return toast('No faktur sudah dipakai', 'error');

  const perlu = {};
  items.forEach(it => perlu[it.barangId] = (perlu[it.barangId] || 0) + it.qty);
  for (const [bid, q] of Object.entries(perlu)){
    const b = brg(bid);
    if (b && q > b.stok)
      return toast(`Stok ${b.nama} cuma ${b.stok}, minta ${q}`, 'error');
  }

  const pel = pelId ? S.pelanggan.find(p => p.id === pelId) : null;
  const dpp = sum(items, i => i.qty * i.harga);
  const ppnVal = Math.round(dpp * ppnPersen / 100);
  const total = dpp + ppnVal;

  items.forEach(it => { it.hpp = stokKeluar(it.barangId, it.qty); });
  if (status === 'lunas') addKas(entity, total);

  const rec = {
    id: uid(), no, tgl, entity,
    pelanggan: pel ? pel.nama : '',
    pelangganId: pel ? pel.id : '',
    channel, status, items, ppnPersen, ket,
    noSuratJalan, nsfp,
    dibayar: status === 'lunas' ? total : 0,
  };
  S.penjualan.unshift(rec);
  persist();
  queue({ type:'penjualan', action:'upsert', record:rec });

  /* Reset */
  document.getElementById('pj-no').value =
    'PJ-' + String((S.penjualan?.length||0) + 1).padStart(3,'0');
  document.getElementById('pj-pel').value = '';
  document.getElementById('pj-items').innerHTML = '';
  document.getElementById('pj-ket').value = '';
  document.getElementById('pj-ppn').value = 0;
  document.getElementById('pj-sj').value = '';
  document.getElementById('pj-nsfp').value = '';
  pjAddItem(); pjHitung();

  renderPenjualan();
  refreshDashboard();
  toast('✓ Faktur disimpan');
}

function pjView(id){
  const p = S.penjualan.find(x => x.id === id); if (!p) return;
  const dpp = sum(p.items, i => i.qty*i.harga);
  const ppnVal = p.ppnPersen ? Math.round(dpp * p.ppnPersen / 100) : 0;
  const hpp = sum(p.items, i => i.qty*(i.hpp||0));
  const ch = CHANNELS[p.channel] || { ico:'•', nama:'-' };
  openModal('Faktur ' + p.no, dmy(p.tgl), `
    <table style="font-size:13px">
      <tr><td>Pelanggan</td><td><b>${esc(p.pelanggan||'-')}</b></td></tr>
      <tr><td>Channel</td><td>${ch.ico} ${ch.nama}</td></tr>
      <tr><td>Status</td><td><span class="tag ${p.status==='lunas'?'t-ok':'t-warn'}">${p.status}</span></td></tr>
      <tr><td>Kantor</td><td>${entInfo(p.entity).ico} ${entInfo(p.entity).nama}</td></tr>
      ${p.noSuratJalan ? `<tr><td>Surat Jalan</td><td>${esc(p.noSuratJalan)}</td></tr>` : ''}
      ${p.nsfp ? `<tr><td>NSFP</td><td><code>${esc(p.nsfp)}</code></td></tr>` : ''}
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
      <div class="row-total" style="font-size:12px"><span class="lbl">HPP</span><span>${rp(hpp)}</span></div>
      <div class="row-total" style="font-size:12px"><span class="lbl">Margin</span><span class="pos"><b>${rp(dpp-hpp)}</b></span></div>
    </div>
  `, () => closeModal(), 'Tutup');
}

function pjDel(id){
  const p = S.penjualan.find(x => x.id === id); if (!p) return;
  if (!confirm('Hapus faktur? Stok dikembalikan.')) return;
  p.items.forEach(i => { const b = brg(i.barangId); if (b) b.stok += i.qty; });
  const dpp = sum(p.items, i => i.qty*i.harga);
  const ppnVal = p.ppnPersen ? Math.round(dpp * p.ppnPersen / 100) : 0;
  if (p.status === 'lunas') addKas(p.entity, -(dpp + ppnVal));
  S.penjualan = S.penjualan.filter(x => x.id !== id);
  persist();
  queue({ type:'penjualan', action:'delete', id });
  renderPenjualan();
  refreshDashboard();
  toast('Dihapus');
}

window.pjAddItem = pjAddItem;
window.pjOnBarang = pjOnBarang;
window.pjHitung = pjHitung;
window.pjSave = pjSave;
window.pjView = pjView;
window.pjDel = pjDel;
