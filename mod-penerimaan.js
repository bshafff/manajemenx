/* ═══════════════════════════════════════════════════════════════
   PENERIMAAN UANG — form pintar + kwitansi otomatis
   ═══════════════════════════════════════════════════════════════ */

const JENIS_TERIMA = {
  pelunasan:  { nama:'Pelunasan Piutang', ico:'💰' },
  dp:         { nama:'DP / Uang Muka',    ico:'📝' },
  tunai:      { nama:'Penjualan Tunai',   ico:'💵' },
  lain:       { nama:'Lain-lain',         ico:'📌' },
};

const METODE_TERIMA = {
  cash:     { nama:'Tunai',       ico:'💵' },
  transfer: { nama:'Transfer Bank', ico:'🏦' },
  qris:     { nama:'QRIS',        ico:'📱' },
  cek:      { nama:'Cek / Giro',  ico:'📄' },
};

function renderPenerimaan(){
  const el = document.getElementById('penerimaan-list');
  if (!el) return;
  const list = S.penerimaan.filter(entityFilter);
  if (!list.length){
    el.innerHTML = `<div class="empty"><span class="e">💰</span>
      Belum ada penerimaan</div>`;
    return;
  }
  el.innerHTML = list.map(p => {
    const e = entInfo(p.entity);
    const jt = JENIS_TERIMA[p.jenis] || JENIS_TERIMA.lain;
    const mt = METODE_TERIMA[p.metode] || METODE_TERIMA.cash;
    return `<div class="list-item">
      <div class="li-head">
        <b>${esc(p.no)}</b>
        <span class="tag t-inf">${jt.ico} ${jt.nama}</span>
        <span class="spacer"></span>
        <b class="pos">${rp(p.jumlah)}</b>
        <button class="ibtn" onclick="viewKwitansi('${p.id}')">👁</button>
        <button class="ibtn" onclick="delTerima('${p.id}')">🗑️</button>
      </div>
      <div class="hint">${dmy(p.tgl)} · ${mt.ico} ${mt.nama}
        · ${e.ico} ${e.kode}
        ${p.dari ? ' · dari ' + esc(p.dari) : ''}</div>
      ${p.fakturLinks?.length ? `<div class="hint" style="margin-top:2px">
        Melunasi: ${p.fakturLinks.map(f =>
          `<b>${esc(f.no)}</b> (${rp(f.jumlah)})`).join(', ')}
      </div>` : ''}
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   FORM — pilih pelanggan → piutang muncul → auto kwitansi
   ═══════════════════════════════════════════════════════════════ */
function addTerima(){
  const vis = visibleEntities();
  const nextNo = 'TR-' + Date.now().toString().slice(-6);

  openModal('Catat Penerimaan', 'Pilih jenis → pelanggan → jumlah', `
    <div class="grid">
      <div><label>Jenis Penerimaan</label>
        <select id="f-jenis" onchange="penerimaanOnChange()">
          ${Object.entries(JENIS_TERIMA).map(([k,v]) =>
            `<option value="${k}">${v.ico} ${v.nama}</option>`).join('')}
        </select></div>
      <div><label>No. Terima</label>
        <input id="f-no" value="${nextNo}"></div>
    </div>
    <div class="grid">
      <div><label>Tanggal Terima</label>
        <input id="f-tgl" type="date" value="${today()}"></div>
      <div><label>Metode</label>
        <select id="f-metode">
          ${Object.entries(METODE_TERIMA).map(([k,v]) =>
            `<option value="${k}">${v.ico} ${v.nama}</option>`).join('')}
        </select></div>
    </div>
    <label>Diterima Dari</label>
    <select id="f-dari" onchange="penerimaanOnChange()">
      <option value="">— Pilih Pelanggan —</option>
      ${S.pelanggan.filter(p => entityFilter(p)).map(p =>
        `<option value="${p.id}">${esc(p.nama)} · ${p.kode}</option>`).join('')}
    </select>

    <!-- Panel piutang (muncul kalau jenis = pelunasan) -->
    <div id="f-piutang-panel" style="display:none;margin-top:12px"></div>

    <div class="grid">
      <div><label>Total Diterima</label>
        <input id="f-jml" type="number" value="0" oninput="penerimaanOnChange()"></div>
      <div><label>Tujuan Kas</label>
        <select id="f-ent">${vis.map(k => {
          const e = entInfo(k);
          return `<option value="${k}">${e.ico} ${e.nama}</option>`;
        }).join('')}</select></div>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;
                padding:10px;margin-top:10px">
      <div style="font-size:12px;font-weight:700;color:#15803d">
        📊 Status Piutang Pelanggan Ini
      </div>
      <div id="f-sisa-info" class="hint" style="margin-top:4px">
        Pilih pelanggan untuk lihat sisa piutang
      </div>
    </div>

    <label>Bukti Transfer / Nota (opsional)</label>
    <input type="file" id="f-bukti" accept="image/*,application/pdf">
    <div class="hint" id="f-bukti-info"></div>

    <label style="display:flex;align-items:center;gap:8px;margin-top:14px;cursor:pointer">
      <input type="checkbox" id="f-kwitansi" checked style="width:auto">
      <span>Terbitkan Kwitansi otomatis</span>
    </label>

    <label>Keterangan</label>
    <input id="f-ket" placeholder="Misal: transfer BCA 15 Jan">
  `, () => {
    const dari = document.getElementById('f-dari').value;
    const jenis = document.getElementById('f-jenis').value;
    const jml = +document.getElementById('f-jml').value || 0;
    if (jml <= 0) return toast('Jumlah tidak valid', 'error');
    if (jenis === 'pelunasan' && !dari)
      return toast('Pilih pelanggan dulu', 'error');

    const ent = document.getElementById('f-ent').value;
    const pel = dari ? S.pelanggan.find(x => x.id === dari) : null;

    /* Ambil alokasi faktur (kalau pelunasan) */
    const fakturLinks = [];
    if (jenis === 'pelunasan' && dari){
      document.querySelectorAll('.piutang-row[data-no]').forEach(row => {
        const bayar = +row.querySelector('input').value || 0;
        if (bayar > 0){
          const no = row.dataset.no;
          const faktur = S.penjualan.find(x => x.no === no);
          if (faktur){
            fakturLinks.push({ id: faktur.id, no, jumlah: bayar });
            // Update status faktur
            const total = totSell(faktur);
            const dibayar = (faktur.dibayar || 0) + bayar;
            faktur.dibayar = dibayar;
            if (dibayar >= total - 1) faktur.status = 'lunas';
            queue({ type:'penjualan', action:'upsert', record: faktur });
          }
        }
      });
    }

    /* Kas masuk */
    addKas(ent, jml);

    /* Bukti */
    const bf = document.getElementById('f-bukti')?.files?.[0];
    const bukti = bf ? { nama: bf.name, ukuran: bf.size, tipe: bf.type } : null;

    /* Kwitansi */
    const kwitansi = document.getElementById('f-kwitansi').checked;

    const rec = {
      id: uid(),
      no: document.getElementById('f-no').value,
      tgl: document.getElementById('f-tgl').value,
      jenis,
      metode: document.getElementById('f-metode').value,
      entity: ent,
      dari: pel ? pel.nama : '',
      dariId: pel ? pel.id : '',
      jumlah: jml,
      fakturLinks,
      bukti,
      kwitansi,
      ket: document.getElementById('f-ket').value,
    };
    S.penerimaan.unshift(rec);
    persist();
    queue({ type:'penerimaan', action:'upsert', record:rec });
    closeModal();
    renderPenerimaan();
    if (typeof renderDashboard === 'function') renderDashboard();
    toast(kwitansi ? '✓ Penerimaan dicatat · kwitansi terbit' : 'Penerimaan dicatat');
    if (kwitansi) setTimeout(() => viewKwitansi(rec.id), 400);
  }, 'Simpan');
}

/* ═══════════════════════════════════════════════════════════════
   ON-CHANGE handler — update panel piutang + sisa
   ═══════════════════════════════════════════════════════════════ */
function penerimaanOnChange(){
  const jenis = document.getElementById('f-jenis').value;
  const dari = document.getElementById('f-dari').value;
  const panel = document.getElementById('f-piutang-panel');
  const sisaInfo = document.getElementById('f-sisa-info');
  if (!panel || !sisaInfo) return;

  if (jenis === 'pelunasan' && dari){
    const pel = S.pelanggan.find(x => x.id === dari);
    const piutang = S.penjualan.filter(p =>
      p.pelanggan === pel?.nama && p.status !== 'lunas');

    if (!piutang.length){
      panel.style.display = 'none';
      sisaInfo.innerHTML = `<b>${esc(pel?.nama || '-')}</b> ·
        <span class="pos">Tidak ada piutang outstanding</span>`;
      return;
    }

    panel.style.display = 'block';
    panel.innerHTML = `
      <label>Pilih Faktur yang Dilunasi</label>
      <div style="background:#fff;border:1px solid var(--line);
                  border-radius:8px;padding:8px;max-height:220px;overflow-y:auto">
        ${piutang.map(p => {
          const total = totSell(p);
          const dibayar = p.dibayar || 0;
          const sisa = total - dibayar;
          return `<div class="piutang-row" data-no="${esc(p.no)}"
            style="display:grid;grid-template-columns:1fr 110px;gap:8px;
                   padding:6px 0;border-bottom:1px solid var(--line);
                   align-items:center">
            <div>
              <b style="font-size:13px">${esc(p.no)}</b>
              <div class="hint" style="margin:0">
                ${dmy(p.tgl)} · Sisa <b class="neg">${rp(sisa)}</b>
              </div>
            </div>
            <input type="number" placeholder="0" min="0" max="${sisa}"
              value="0" data-max="${sisa}"
              oninput="penerimaanHitTotal()">
          </div>`;
        }).join('')}
      </div>
      <button class="btn btn-s btn-sm" style="margin-top:8px"
              onclick="penerimaanIsiSemua()">Isi Otomatis (FIFO)</button>`;

    const totalPiu = sum(piutang, p => totSell(p) - (p.dibayar || 0));
    sisaInfo.innerHTML = `
      <b>${esc(pel?.nama || '-')}</b> ·
      Total piutang: <b class="neg">${rp(totalPiu)}</b>
      (${piutang.length} faktur)`;
  } else {
    panel.style.display = 'none';
    if (dari){
      const pel = S.pelanggan.find(x => x.id === dari);
      sisaInfo.innerHTML = `<b>${esc(pel?.nama || '-')}</b> · 
        Jenis "${JENIS_TERIMA[jenis]?.nama}" tidak perlu pilih faktur`;
    } else {
      sisaInfo.textContent = 'Pilih pelanggan untuk lihat sisa piutang';
    }
  }
  penerimaanHitTotal();
}

/* Hitung total dari input faktur + auto-isi field total */
function penerimaanHitTotal(){
  let sum_ = 0;
  document.querySelectorAll('.piutang-row input').forEach(inp => {
    let v = +inp.value || 0;
    const max = +inp.dataset.max || 0;
    if (v > max) v = max;
    sum_ += v;
  });
  const fJml = document.getElementById('f-jml');
  if (fJml && sum_ > 0) fJml.value = sum_;
}

/* Auto isi FIFO: bayar faktur dari yang paling lama */
function penerimaanIsiSemua(){
  const fJml = document.getElementById('f-jml');
  let saldo = +fJml.value || 0;
  document.querySelectorAll('.piutang-row').forEach(row => {
    if (saldo <= 0) return;
    const max = +row.querySelector('input').dataset.max || 0;
    const bayar = Math.min(saldo, max);
    row.querySelector('input').value = bayar;
    saldo -= bayar;
  });
}

/* ═══════════════════════════════════════════════════════════════
   LIHAT KWITANSI
   ═══════════════════════════════════════════════════════════════ */
function viewKwitansi(id){
  const p = S.penerimaan.find(x => x.id === id);
  if (!p) return;
  const ent = entInfo(p.entity);
  const jt = JENIS_TERIMA[p.jenis] || JENIS_TERIMA.lain;
  const mt = METODE_TERIMA[p.metode] || METODE_TERIMA.cash;
  const pel = p.dariId ? S.pelanggan.find(x => x.id === p.dariId) : null;

  openModal('Kwitansi ' + p.no, 'Bukti penerimaan uang', `
    <div id="kwitansi-print" style="border:2px solid var(--green);
         border-radius:12px;padding:16px;background:#fafff7">
      <div style="text-align:center;padding-bottom:12px;
                  border-bottom:2px dashed var(--line);margin-bottom:12px">
        <div style="font-size:11px;color:var(--mute)">PT. INSAN MUDA BERDIKARI</div>
        <h3 style="margin:4px 0;color:var(--green);font-family:Fraunces">
          KWITANSI</h3>
        <div style="font-size:11px;color:var(--mute)">${ent.ico} ${ent.nama}</div>
      </div>

      <table style="font-size:13px">
        <tr><td style="color:var(--mute);width:130px">No. Kwitansi</td>
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
        ${p.ket ? `<tr><td style="color:var(--mute)">Keterangan</td>
          <td>${esc(p.ket)}</td></tr>` : ''}
      </table>

      <div style="background:var(--green);color:#fff;padding:12px;
                  border-radius:8px;margin:14px 0;text-align:center">
        <div style="font-size:11px;opacity:.8">JUMLAH DITERIMA</div>
        <div style="font-family:Fraunces;font-size:26px;font-weight:600">
          ${rp(p.jumlah)}
        </div>
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

      ${p.bukti ? `<div class="hint" style="margin-top:10px">
        📎 Bukti: ${esc(p.bukti.nama)} (${Math.round(p.bukti.ukuran/1024)} KB)
      </div>` : ''}

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
  `, () => {
    window.print();
  }, '🖨 Cetak');
}

/* ═══════════════════════════════════════════════════════════════
   HAPUS — rollback kas + status faktur
   ═══════════════════════════════════════════════════════════════ */
function delTerima(id){
  const p = S.penerimaan.find(x => x.id === id);
  if (!p || !confirm('Batalkan penerimaan ini? Status faktur akan dikembalikan.')) return;

  /* Kembalikan kas */
  addKas(p.entity, -p.jumlah);

  /* Rollback status faktur */
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
  if (typeof renderDashboard === 'function') renderDashboard();
  toast('Dibatalkan');
}
