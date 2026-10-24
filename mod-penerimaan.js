/* ═══════════════════════════════════════════════════════════════
   PENERIMAAN — form inline + integrasi piutang + kuitansi
   ═══════════════════════════════════════════════════════════════ */
const JENIS_TERIMA = {
  pelunasan: { nama:'Pelunasan Piutang', ico:'💰' },
  tunai:     { nama:'Penjualan Tunai',   ico:'💵' },
  dp:        { nama:'DP / Uang Muka',    ico:'📝' },
  lain:      { nama:'Lain-lain',         ico:'📌' },
};
const METODE_TERIMA = {
  cash:     { nama:'Tunai',        ico:'💵' },
  transfer: { nama:'Transfer Bank', ico:'🏦' },
  qris:     { nama:'QRIS',         ico:'📱' },
  cek:      { nama:'Cek / Giro',   ico:'📄' },
};

function renderPenerimaan(){
  /* Form defaults */
  const noEl = document.getElementById('pn-no');
  if (noEl && !noEl.value)
    noEl.value = 'RCV-' + String((S.penerimaan?.length||0) + 1).padStart(3,'0');
  const tglEl = document.getElementById('pn-tgl');
  if (tglEl && !tglEl.value) tglEl.value = today();

  /* Pelanggan dropdown */
  const dariEl = document.getElementById('pn-dari');
  if (dariEl){
    const cur = dariEl.value;
    dariEl.innerHTML = `<option value="">— Pilih Pelanggan —</option>` +
      S.pelanggan.filter(p => entityFilter(p)).map(p =>
        `<option value="${p.id}" ${cur===p.id?'selected':''}>
          ${esc(p.nama)} · ${p.kode}
        </option>`).join('');
  }

  /* Entitas dropdown */
  const entEl = document.getElementById('pn-ent');
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

  /* Stats */
  const st = document.getElementById('pn-stats');
  if (st){
    const ent = activeEntity();
    const list = S.penerimaan.filter(p => ent === 'ALL' || p.entity === ent);
    const total = sum(list, p => p.jumlah || 0);
    st.innerHTML = `
      <div class="stat"><div class="l">Total Penerimaan</div>
        <div class="v pos">${rp(total)}</div>
        <div class="d">${ent==='ALL'?'Semua entitas':ent}</div></div>
      <div class="stat gold"><div class="l">Piutang Outstanding</div>
        <div class="v">${rp(piutangEnt(ent))}</div>
        <div class="d">Belum tertagih</div></div>`;
  }

  /* Counter */
  const cnt = document.getElementById('terima-count');
  if (cnt) cnt.textContent = (S.penerimaan || []).length;

  /* Tabel */
  const el = document.getElementById('penerimaan-list');
  if (!el) return;
  const list = (S.penerimaan || []).filter(entityFilter).slice(0, 20);
  if (!list.length){
    el.innerHTML = `<div class="empty"><span class="e">💰</span>
      Belum ada penerimaan</div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap">
    <table>
      <thead><tr>
        <th>ID</th><th>Tanggal</th><th>Diterima Dari</th>
        <th>Metode</th><th>Kas</th>
        <th class="num">Total</th><th></th>
      </tr></thead>
      <tbody>${list.map(p => {
        const mt = METODE_TERIMA[p.metode] || METODE_TERIMA.cash;
        const e = entInfo(p.entity);
        return `<tr>
          <td><b>${esc(p.no)}</b></td>
          <td>${dmy(p.tgl)}</td>
          <td>${esc(p.dari || '-')}</td>
          <td>${mt.ico} ${mt.nama}</td>
          <td>${e.ico} ${e.kode}</td>
          <td class="num pos"><b>${rp(p.jumlah)}</b></td>
          <td class="tb-actions">
            <button class="ibtn" onclick="viewKwitansi('${p.id}')">👁</button>
            <button class="ibtn" onclick="delTerima('${p.id}')">🗑️</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

/* ─── Handlers ─── */
function pnOnJenis(){ pnOnDari(); }
function pnOnDari(){
  const dari = document.getElementById('pn-dari').value;
  const sisaEl = document.getElementById('pn-sisa');
  if (!dari){ if (sisaEl) sisaEl.value = 0; return; }
  const pel = S.pelanggan.find(x => x.id === dari);
  if (!pel){ if (sisaEl) sisaEl.value = 0; return; }
  const piu = sum(
    S.penjualan.filter(p => p.pelanggan === pel.nama && p.status !== 'lunas'),
    p => totSell(p) - (p.dibayar || 0)
  );
  if (sisaEl) sisaEl.value = piu;
}
function pnOnJml(){ /* bisa dipakai untuk auto-fill */ }
function pnOnFile(input){
  const wrap = document.getElementById('pn-file-wrap');
  if (!wrap) return;
  if (input.files?.[0]){
    wrap.classList.add('has-file');
    wrap.childNodes[0].nodeValue = '📎 ' + input.files[0].name;
  } else {
    wrap.classList.remove('has-file');
    wrap.childNodes[0].nodeValue = '📎 Pilih foto / PDF';
  }
}

/* ─── Save ─── */
function saveTerima(){
  const jenis = document.getElementById('pn-jenis').value;
  const no    = document.getElementById('pn-no').value.trim();
  const tgl   = document.getElementById('pn-tgl').value;
  const dari  = document.getElementById('pn-dari').value;
  const metode= document.getElementById('pn-metode').value;
  const entity= document.getElementById('pn-ent').value;
  const jml   = +document.getElementById('pn-jml').value || 0;
  const terbit= document.getElementById('pn-terbit').value === '1';
  const ket   = document.getElementById('pn-ket').value.trim();
  const buktiUrl = document.getElementById('pn-bukti').value.trim();
  const bf = document.getElementById('pn-file')?.files?.[0];

   if (isPeriodLocked(tgl)) return toast('Periode ditutup', 'error');
  if (jml <= 0) return toast('Total diterima tidak valid', 'error');
  if (jenis === 'pelunasan' && !dari)
    return toast('Pilih pelanggan dulu', 'error');

  const pel = dari ? S.pelanggan.find(x => x.id === dari) : null;

  /* Alokasi ke faktur penjualan (FIFO) */
  const fakturLinks = [];
  if (jenis === 'pelunasan' && pel){
    let sisaTerima = jml;
    const piuList = S.penjualan
      .filter(p => p.pelanggan === pel.nama && p.status !== 'lunas')
      .sort((a,b) => (a.tgl||'').localeCompare(b.tgl||''));
    for (const f of piuList){
      if (sisaTerima <= 0) break;
      const total = totSell(f);
      const dibayar = f.dibayar || 0;
      const sisaFaktur = total - dibayar;
      const bayar = Math.min(sisaTerima, sisaFaktur);
      f.dibayar = dibayar + bayar;
      if (f.dibayar >= total - 1) f.status = 'lunas';
      fakturLinks.push({ id: f.id, no: f.no, jumlah: bayar });
      queue({ type:'penjualan', action:'upsert', record: f });
      sisaTerima -= bayar;
    }
  }

  /* Kas masuk */
  addKas(entity, jml);
     // POST JURNAL OTOMATIS (PENERIMAAN)
  const jLines = [];
  jLines.push({ akun: '1001', debit: jml, kredit: 0 }); // Kas Masuk
  jLines.push({ akun: jenis === 'pelunasan' ? '1201' : '4001', debit: 0, kredit: jml }); // Piutang atau Pendapatan
  postJournal(tgl, no, ket || 'Penerimaan', entity, jLines);

  /* Bukti */
  const bukti = buktiUrl ? { url: buktiUrl, nama: buktiUrl.split('/').pop() }
    : bf ? { nama: bf.name, ukuran: bf.size, tipe: bf.type } : null;

  const rec = {
    id: uid(),
    no: no || 'RCV-' + Date.now().toString().slice(-6),
    tgl, jenis, metode, entity,
    dari: pel ? pel.nama : '',
    dariId: pel ? pel.id : '',
    jumlah: jml,
    fakturLinks,
    bukti,
    terbitkan: terbit,
    ket,
  };
  if (!S.penerimaan) S.penerimaan = [];
  S.penerimaan.unshift(rec);
  persist();
  queue({ type:'penerimaan', action:'upsert', record:rec });

  /* Reset form */
  document.getElementById('pn-jml').value = 0;
  document.getElementById('pn-ket').value = '';
  document.getElementById('pn-bukti').value = '';
  document.getElementById('pn-dari').value = '';
  document.getElementById('pn-sisa').value = 0;
  document.getElementById('pn-no').value =
    'RCV-' + String((S.penerimaan?.length||0) + 1).padStart(3,'0');
  const fw = document.getElementById('pn-file-wrap');
  if (fw){ fw.classList.remove('has-file');
    fw.childNodes[0].nodeValue = '📎 Pilih foto / PDF'; }
  const fi = document.getElementById('pn-file'); if (fi) fi.value = '';

  renderPenerimaan();
  refreshDashboard();
  toast('✓ Penerimaan dicatat');
  if (terbit) setTimeout(() => viewKwitansi(rec.id), 350);
}

/* ─── Kuitansi ─── */
function viewKwitansi(id){
  const p = S.penerimaan.find(x => x.id === id);
  if (!p) return;
  const ent = entInfo(p.entity);
  const jt = JENIS_TERIMA[p.jenis] || JENIS_TERIMA.lain;
  const mt = METODE_TERIMA[p.metode] || METODE_TERIMA.cash;
  const pel = p.dariId ? S.pelanggan.find(x => x.id === p.dariId) : null;

  openModal('Kuitansi ' + p.no, 'Bukti penerimaan', `
    <div style="border:2px solid var(--green);border-radius:12px;
                padding:16px;background:#fafff7">
      <div style="text-align:center;padding-bottom:12px;
                  border-bottom:2px dashed var(--line);margin-bottom:12px">
        <div style="font-size:11px;color:var(--mute)">PT. INSAN MUDA BERDIKARI</div>
        <h3 style="margin:4px 0;color:var(--green);font-family:Fraunces">KWITANSI</h3>
        <div style="font-size:11px;color:var(--mute)">${ent.ico} ${ent.nama}</div>
      </div>
      <table style="font-size:13px">
        <tr><td style="color:var(--mute);width:130px">No. Kuitansi</td>
          <td><b>${esc(p.no)}</b></td></tr>
        <tr><td style="color:var(--mute)">Tanggal</td>
          <td><b>${dmy(p.tgl)}</b></td></tr>
        <tr><td style="color:var(--mute)">Jenis</td>
          <td>${jt.ico} ${jt.nama}</td></tr>
        <tr><td style="color:var(--mute)">Metode</td>
          <td>${mt.ico} ${mt.nama}</td></tr>
        ${p.dari ? `<tr><td style="color:var(--mute)">Diterima Dari</td>
          <td><b>${esc(p.dari)}</b>
          ${pel?.alamat ? `<div class="hint" style="margin:0">${esc(pel.alamat)}</div>` : ''}
          </td></tr>` : ''}
        ${p.ket ? `<tr><td style="color:var(--mute)">Catatan</td>
          <td>${esc(p.ket)}</td></tr>` : ''}
      </table>
      <div style="background:var(--green);color:#fff;padding:12px;
                  border-radius:8px;margin:14px 0;text-align:center">
        <div style="font-size:11px;opacity:.8">JUMLAH DITERIMA</div>
        <div style="font-family:Fraunces;font-size:26px;font-weight:600">
          ${rp(p.jumlah)}</div>
      </div>
      ${p.fakturLinks?.length ? `
        <div style="font-size:11px;color:var(--mute);margin-bottom:6px">
          ALOKASI PEMBAYARAN</div>
        <table style="font-size:12px">
          ${p.fakturLinks.map(f => `<tr>
            <td>${esc(f.no)}</td>
            <td class="num"><b>${rp(f.jumlah)}</b></td>
          </tr>`).join('')}
        </table>` : ''}
      ${p.bukti?.url ? `<div class="hint" style="margin-top:10px">
        📎 <a href="${esc(p.bukti.url)}" target="_blank">Lihat bukti transfer</a>
      </div>` : p.bukti?.nama ? `<div class="hint" style="margin-top:10px">
        📎 ${esc(p.bukti.nama)}</div>` : ''}
      <div style="display:flex;justify-content:space-between;
                  margin-top:24px;font-size:11px;color:var(--mute)">
        <div style="text-align:center">
          <div style="height:50px"></div>
          <div style="border-top:1px solid var(--line);padding-top:4px;
                      width:110px">Penerima</div>
        </div>
        <div style="text-align:center">
          <div style="height:50px"></div>
          <div style="border-top:1px solid var(--line);padding-top:4px;
                      width:110px">Pelanggan</div>
        </div>
      </div>
    </div>
  `, () => window.print(), '🖨 Cetak');
}

/* ─── Hapus ─── */
function delTerima(id){
  const p = S.penerimaan.find(x => x.id === id);
   if (isPeriodLocked(p.tgl)) return toast('Periode ditutup', 'error');
  if (!p || !confirm('Batalkan penerimaan ini?')) return;
  addKas(p.entity, -p.jumlah);
  (p.fakturLinks || []).forEach(fl => {
    const f = S.penjualan.find(x => x.id === fl.id);
    if (f){
      f.dibayar = Math.max(0, (f.dibayar || 0) - fl.jumlah);
      if (f.dibayar < totSell(f) - 1) f.status = 'piutang';
      queue({ type:'penjualan', action:'upsert', record: f });
    }
  });
  S.penerimaan = S.penerimaan.filter(x => x.id !== id);
  persist();
  queue({ type:'penerimaan', action:'delete', id });
  renderPenerimaan();
  refreshDashboard();
  toast('Dibatalkan');
}

window.saveTerima = saveTerima;
window.delTerima = delTerima;
window.viewKwitansi = viewKwitansi;
window.pnOnJenis = pnOnJenis;
window.pnOnDari = pnOnDari;
window.pnOnJml = pnOnJml;
window.pnOnFile = pnOnFile;
