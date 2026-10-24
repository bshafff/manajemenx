/* ═══════════════════════════════════════════════════════════════
   PEMBAYARAN — form inline + integrasi hutang supplier
   ═══════════════════════════════════════════════════════════════ */
const METODE_BAYAR = {
  cash:     { nama:'Tunai',        ico:'💵' },
  transfer: { nama:'Transfer Bank', ico:'🏦' },
  qris:     { nama:'QRIS',         ico:'📱' },
  cek:      { nama:'Cek / Giro',   ico:'📄' },
};

function renderPembayaran(){
  /* Isi form */
  const noEl = document.getElementById('pay-no');
  if (noEl && !noEl.value)
    noEl.value = 'PAY-' + String((S.pembayaran?.length || 0) + 1).padStart(3,'0');
  const tglEl = document.getElementById('pay-tgl');
  if (tglEl && !tglEl.value) tglEl.value = today();

  /* Isi dropdown supplier */
  const supEl = document.getElementById('pay-sup');
  if (supEl){
    const cur = supEl.value;
    supEl.innerHTML = `<option value="">— Pilih Supplier —</option>` +
      S.supplier.filter(s => entityFilter(s)).map(s =>
        `<option value="${s.id}" ${cur===s.id?'selected':''}>
          ${esc(s.nama)} · ${s.kode}
        </option>`).join('');
  }

  /* Isi dropdown entitas */
  const entEl = document.getElementById('pay-ent');
  if (entEl){
    const cur = entEl.value;
    const vis = visibleEntities();
    entEl.innerHTML = vis.map(k => {
      const e = entInfo(k);
      return `<option value="${k}" ${cur===k?'selected':''}>
        ${e.ico} ${e.nama} (${rp(kasOf(k))})
      </option>`;
    }).join('');
  }

  /* Counter */
  const cnt = document.getElementById('bayar-count');
  if (cnt) cnt.textContent = (S.pembayaran || []).length;

  /* Tabel */
  const el = document.getElementById('pembayaran-list');
  if (!el) return;
  const list = (S.pembayaran || []).filter(entityFilter).slice(0, 10);
  if (!list.length){
    el.innerHTML = `<div class="empty"><span class="e">💸</span>
      Belum ada pembayaran</div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap">
    <table>
      <thead><tr>
        <th>ID</th><th>Tanggal</th><th>Pihak</th>
        <th>Metode</th><th>Kas</th>
        <th class="num">Total</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>${list.map(p => {
        const mt = METODE_BAYAR[p.metode] || METODE_BAYAR.cash;
        const e = entInfo(p.entity);
        return `<tr>
          <td><b>${esc(p.no)}</b></td>
          <td>${dmy(p.tgl)}</td>
          <td>${esc(p.dari || p.supplier || p.ket || '-')}</td>
          <td>${mt.ico} ${mt.nama}</td>
          <td>${e.ico} ${e.kode}</td>
          <td class="num neg"><b>${rp(p.jumlah)}</b></td>
          <td><span class="tag t-ok">Posted</span></td>
          <td class="tb-actions">
            <button class="ibtn" onclick="delBayar('${p.id}')">🗑️</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

/* ─── Handler on-change ─── */
function payOnJenis(){
  const jenis = document.getElementById('pay-jenis').value;
  const supEl = document.getElementById('pay-sup');
  if (jenis !== 'supplier') supEl.value = '';
  payOnSup();
}
function payOnSup(){
  const supId = document.getElementById('pay-sup').value;
  const sisaEl = document.getElementById('pay-sisa');
  if (!sisaEl) return;
  if (!supId){
    sisaEl.value = 0;
    return;
  }
  const sup = S.supplier.find(s => s.id === supId);
  if (!sup){ sisaEl.value = 0; return; }
  const hutang = sum(
    S.pembelian.filter(p => p.supplier === sup.nama && p.status !== 'lunas'),
    totBuy
  );
  sisaEl.value = hutang;
}
function payOnJml(){
  /* Auto-update: kalau jenis supplier & total <= sisa, tandai */
  /* Optional: tidak ada efek */
}

/* ─── Save ─── */
function saveBayar(){
  const jenis = document.getElementById('pay-jenis').value;
  const no = document.getElementById('pay-no').value.trim();
  const tgl = document.getElementById('pay-tgl').value;
  const supId = document.getElementById('pay-sup').value;
  const metode = document.getElementById('pay-metode').value;
  const entity = document.getElementById('pay-ent').value;
  const jml = +document.getElementById('pay-jml').value || 0;
  const terbit = document.getElementById('pay-terbit').value === '1';
  const ket = document.getElementById('pay-ket').value.trim();

  if (jml <= 0) return toast('Total bayar tidak valid', 'error');
  if (jml > kasOf(entity))
    return toast(`Kas ${entity} cuma ${rp(kasOf(entity))}`, 'error');

  const sup = supId ? S.supplier.find(s => s.id === supId) : null;

  /* Kalau bayar supplier → alokasikan ke faktur pembelian (FIFO) */
  const fakturLinks = [];
  if (jenis === 'supplier' && sup){
    let sisaBayar = jml;
    const hutangList = S.pembelian
      .filter(p => p.supplier === sup.nama && p.status !== 'lunas')
      .sort((a,b) => (a.tgl||'').localeCompare(b.tgl||''));
    for (const f of hutangList){
      if (sisaBayar <= 0) break;
      const total = totBuy(f);
      const dibayar = f.dibayar || 0;
      const sisaFaktur = total - dibayar;
      const bayar = Math.min(sisaBayar, sisaFaktur);
      f.dibayar = dibayar + bayar;
      if (f.dibayar >= total - 1) f.status = 'lunas';
      fakturLinks.push({ id: f.id, no: f.no, jumlah: bayar });
      queue({ type:'pembelian', action:'upsert', record: f });
      sisaBayar -= bayar;
    }
  }

  /* Kas keluar */
  addKas(entity, -jml);
     // POST JURNAL OTOMATIS (PEMBAYARAN)
  const jLines = [];
  jLines.push({ akun: jenis === 'supplier' ? '2001' : '6001', debit: jml, kredit: 0 }); // Hutang atau Beban
  jLines.push({ akun: '1001', debit: 0, kredit: jml }); // Kas Keluar
  postJournal(tgl, no, ket || 'Pembayaran', entity, jLines);

  const rec = {
    id: uid(),
    no: no || 'PAY-' + Date.now().toString().slice(-6),
    tgl,
    jenis,
    metode,
    entity,
    supplier: sup ? sup.nama : '',
    supplierId: sup ? sup.id : '',
    dari: sup ? sup.nama : '',
    jumlah: jml,
    fakturLinks,
    terbitkan: terbit,
    ket,
  };
  if (!S.pembayaran) S.pembayaran = [];
  S.pembayaran.unshift(rec);
  persist();
  queue({ type:'pembayaran', action:'upsert', record:rec });

  /* Reset form & refresh */
  document.getElementById('pay-jml').value = 0;
  document.getElementById('pay-ket').value = '';
  document.getElementById('pay-sup').value = '';
  document.getElementById('pay-sisa').value = 0;
  document.getElementById('pay-no').value =
    'PAY-' + String((S.pembayaran?.length || 0) + 1).padStart(3,'0');

  renderPembayaran();
  refreshDashboard();
  toast('✓ Pembayaran dicatat');
}

function delBayar(id){
  const p = (S.pembayaran || []).find(x => x.id === id);
  if (!p || !confirm('Batalkan pembayaran ini?')) return;

  /* Rollback kas */
  addKas(p.entity, p.jumlah);

  /* Rollback faktur pembelian */
  (p.fakturLinks || []).forEach(fl => {
    const f = S.pembelian.find(x => x.id === fl.id);
    if (f){
      f.dibayar = Math.max(0, (f.dibayar || 0) - fl.jumlah);
      if (f.dibayar < totBuy(f) - 1) f.status = 'hutang';
      queue({ type:'pembelian', action:'upsert', record: f });
    }
  });

  S.pembayaran = S.pembayaran.filter(x => x.id !== id);
  persist();
  queue({ type:'pembayaran', action:'delete', id });
  renderPembayaran();
  refreshDashboard();
  toast('Dibatalkan');
}

window.saveBayar = saveBayar;
window.delBayar = delBayar;
window.payOnJenis = payOnJenis;
window.payOnSup = payOnSup;
window.payOnJml = payOnJml;
