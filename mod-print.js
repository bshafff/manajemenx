/* ═══════════════════════════════════════════════════════════════
   PRINT ENGINE — kwitansi, bukti bayar, surat jalan, faktur pajak
   ═══════════════════════════════════════════════════════════════ */

/* Helper: render dokumen ke modal + auto print */
function showPrintDoc(title, html){
  openModal(title, 'Preview cetak — tekan 🖨 Cetak', `
    <div class="print-doc">${html}</div>
  `, () => window.print(), '🖨 Cetak');
}

/* Helper: format tanggal panjang Indonesia */
function dmyLong(s){
  if (!s) return '-';
  const d = new Date(s);
  return d.toLocaleDateString('id-ID',{
    day:'2-digit', month:'long', year:'numeric'
  });
}
function dmyShort(s){ return dmy(s); }

/* ─── Kop surat ─── */
function kopSurat(){
  return `
    <div class="pd-kop">
      <div class="pd-logo">🌱</div>
      <div class="pd-kop-text">
        <div class="pd-kop-title">PT. INSAN MUDA BERDIKARI</div>
        <div class="pd-kop-sub">Integrated Multi Business · 4 Lini Usaha</div>
        <div class="pd-kop-line">Stroberi · Dairy · Ayam · Pakan Ayam</div>
      </div>
    </div>
    <div class="pd-hr"></div>`;
}

/* ─── Nomor dokumen (auto dari tgl) ─── */
function docNo(prefix, tgl, seq){
  const d = new Date(tgl || today());
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth()+1).padStart(2,'0');
  return `${prefix}/${y}${m}/${String(seq || 1).padStart(4,'0')}`;
}

/* ═══════════════════════════════════════════════════════════════
   1. KWITANSI (dari faktur penjualan LUNAS)
   ═══════════════════════════════════════════════════════════════ */
function printKwitansiPenjualan(id){
  const p = S.penjualan.find(x => x.id === id);
  if (!p) return;
  const ent = entInfo(p.entity);
  const dpp = sum(p.items, i => i.qty * i.harga);
  const ppnVal = p.ppnPersen ? Math.round(dpp * p.ppnPersen / 100) : 0;
  const total = dpp + ppnVal;
  const pel = p.pelangganId ? S.pelanggan.find(x => x.id === p.pelangganId) : null;
  const kwitansiNo = p.noKwitansi || docNo('KW', p.tgl, (S.penjualan.indexOf(p)+1));

  const body = `
    ${kopSurat()}
    <h2 class="pd-title">KWITANSI PEMBAYARAN</h2>
    <div class="pd-meta">
      <div class="pd-meta-row">
        <span class="pd-lbl">No. Kwitansi</span>
        <span class="pd-val"><b>${esc(kwitansiNo)}</b></span>
        <span class="pd-lbl">Tanggal</span>
        <span class="pd-val"><b>${dmyLong(p.tgl)}</b></span>
      </div>
    </div>
    <div class="pd-section">
      <table class="pd-tbl">
        <tr>
          <td class="pd-lbl-td">Telah Terima Dari</td>
          <td class="pd-val-td">: <b>${esc(p.pelanggan || '-')}</b>
            ${pel?.alamat ? `<div class="pd-hint">${esc(pel.alamat)}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td class="pd-lbl-td">Uang Sejumlah</td>
          <td class="pd-val-td">: <b>${rp(total)}</b></td>
        </tr>
        <tr>
          <td class="pd-lbl-td">Untuk Pembayaran</td>
          <td class="pd-val-td">: Faktur <b>${esc(p.no)}</b>
            ${p.ket ? `<div class="pd-hint">${esc(p.ket)}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td class="pd-lbl-td">Kantor / Lini</td>
          <td class="pd-val-td">: ${ent.ico} ${esc(ent.nama)}</td>
        </tr>
      </table>
    </div>
    <div class="pd-amount">
      <div class="pd-amount-label">JUMLAH</div>
      <div class="pd-amount-value">${rp(total)}</div>
    </div>
    <div class="pd-sign">
      <div class="pd-sign-box">
        <div class="pd-sign-line"></div>
        <div class="pd-sign-label">Penerima</div>
      </div>
      <div class="pd-sign-box">
        <div class="pd-sign-line"></div>
        <div class="pd-sign-label">Pelanggan</div>
      </div>
    </div>`;

  showPrintDoc('Kwitansi ' + kwitansiNo, body);
}

/* ═══════════════════════════════════════════════════════════════
   2. BUKTI BAYAR (dari faktur pembelian LUNAS)
   ═══════════════════════════════════════════════════════════════ */
function printBuktiBayarPembelian(id){
  const p = S.pembelian.find(x => x.id === id);
  if (!p) return;
  const ent = entInfo(p.entity);
  const dpp = sum(p.items, i => i.qty * i.harga);
  const ppnVal = p.ppnPersen ? Math.round(dpp * p.ppnPersen / 100) : 0;
  const total = dpp + ppnVal;
  const sup = p.supplierId ? S.supplier.find(x => x.id === p.supplierId) : null;
  const buktiNo = p.noBuktiBayar || docNo('BB', p.tgl, (S.pembelian.indexOf(p)+1));

  const body = `
    ${kopSurat()}
    <h2 class="pd-title">BUKTI PEMBAYARAN</h2>
    <div class="pd-meta">
      <div class="pd-meta-row">
        <span class="pd-lbl">No. Bukti</span>
        <span class="pd-val"><b>${esc(buktiNo)}</b></span>
        <span class="pd-lbl">Tanggal</span>
        <span class="pd-val"><b>${dmyLong(p.tgl)}</b></span>
      </div>
    </div>
    <div class="pd-section">
      <table class="pd-tbl">
        <tr>
          <td class="pd-lbl-td">Dibayarkan Kepada</td>
          <td class="pd-val-td">: <b>${esc(p.supplier || '-')}</b>
            ${sup?.alamat ? `<div class="pd-hint">${esc(sup.alamat)}</div>` : ''}
            ${sup?.npwp ? `<div class="pd-hint">NPWP: ${esc(sup.npwp)}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td class="pd-lbl-td">Uang Sejumlah</td>
          <td class="pd-val-td">: <b>${rp(total)}</b></td>
        </tr>
        <tr>
          <td class="pd-lbl-td">Untuk Pembayaran</td>
          <td class="pd-val-td">: Faktur Pembelian <b>${esc(p.no)}</b>
            ${p.ket ? `<div class="pd-hint">${esc(p.ket)}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td class="pd-lbl-td">Kantor / Lini</td>
          <td class="pd-val-td">: ${ent.ico} ${esc(ent.nama)}</td>
        </tr>
      </table>
    </div>
    <div class="pd-amount">
      <div class="pd-amount-label">JUMLAH DIBAYAR</div>
      <div class="pd-amount-value">${rp(total)}</div>
    </div>
    <div class="pd-sign">
      <div class="pd-sign-box">
        <div class="pd-sign-line"></div>
        <div class="pd-sign-label">Pembayar</div>
      </div>
      <div class="pd-sign-box">
        <div class="pd-sign-line"></div>
        <div class="pd-sign-label">Penerima</div>
      </div>
    </div>`;

  showPrintDoc('Bukti Bayar ' + buktiNo, body);
}

/* ═══════════════════════════════════════════════════════════════
   3. SURAT JALAN (dari faktur penjualan — tanpa harga)
   ═══════════════════════════════════════════════════════════════ */
function printSuratJalan(id){
  const p = S.penjualan.find(x => x.id === id);
  if (!p) return;
  const ent = entInfo(p.entity);
  const pel = p.pelangganId ? S.pelanggan.find(x => x.id === p.pelangganId) : null;
  const sjNo = p.noSuratJalan || docNo('SJ', p.tgl, (S.penjualan.indexOf(p)+1));

  const body = `
    ${kopSurat()}
    <h2 class="pd-title">SURAT JALAN</h2>
    <div class="pd-meta">
      <div class="pd-meta-row">
        <span class="pd-lbl">No. Surat Jalan</span>
        <span class="pd-val"><b>${esc(sjNo)}</b></span>
        <span class="pd-lbl">Tanggal</span>
        <span class="pd-val"><b>${dmyLong(p.tgl)}</b></span>
      </div>
    </div>
    <div class="pd-section">
      <table class="pd-tbl">
        <tr>
          <td class="pd-lbl-td">Kepada</td>
          <td class="pd-val-td">: <b>${esc(p.pelanggan || '-')}</b>
            ${pel?.alamat ? `<div class="pd-hint">${esc(pel.alamat)}</div>` : ''}
            ${pel?.telp ? `<div class="pd-hint">Telp: ${esc(pel.telp)}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td class="pd-lbl-td">Referensi Faktur</td>
          <td class="pd-val-td">: ${esc(p.no)}</td>
        </tr>
        <tr>
          <td class="pd-lbl-td">Kantor / Lini</td>
          <td class="pd-val-td">: ${ent.ico} ${esc(ent.nama)}</td>
        </tr>
      </table>
    </div>
    <div class="pd-section">
      <table class="pd-tbl-items">
        <thead>
          <tr>
            <th style="width:30px">No</th>
            <th>Nama Barang</th>
            <th style="width:70px" class="num">Qty</th>
            <th style="width:70px">Satuan</th>
          </tr>
        </thead>
        <tbody>
          ${p.items.map((it, idx) => {
            const b = brg(it.barangId);
            return `<tr>
              <td class="num">${idx+1}</td>
              <td>${b ? esc(b.nama) : '—'}
                <div class="pd-hint">${b ? esc(b.kode) : ''}</div>
              </td>
              <td class="num"><b>${it.qty}</b></td>
              <td>${b ? esc(b.satuan) : '-'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="pd-note">
      Barang-barang tersebut di atas telah diterima dalam keadaan baik dan cukup.
    </div>
    <div class="pd-sign">
      <div class="pd-sign-box">
        <div class="pd-sign-top">Hormat kami,</div>
        <div class="pd-sign-line"></div>
        <div class="pd-sign-label">Pengirim</div>
      </div>
      <div class="pd-sign-box">
        <div class="pd-sign-top">Diterima oleh,</div>
        <div class="pd-sign-line"></div>
        <div class="pd-sign-label">Penerima</div>
      </div>
    </div>`;

  showPrintDoc('Surat Jalan ' + sjNo, body);
}

/* ═══════════════════════════════════════════════════════════════
   4. FAKTUR PAJAK (kalau ada NSFP)
   ═══════════════════════════════════════════════════════════════ */
function printFakturPajak(id, tipe){
  const list = tipe === 'beli' ? S.pembelian : S.penjualan;
  const p = list.find(x => x.id === id);
  if (!p) return;
  if (!p.nsfp){
    toast('Faktur ini tidak ada NSFP', 'error');
    return;
  }
  const ent = entInfo(p.entity);
  const dpp = sum(p.items, i => i.qty * i.harga);
  const ppnVal = p.ppnPersen ? Math.round(dpp * p.ppnPersen / 100) : 0;
  const pihak = tipe === 'beli' ? p.supplier : p.pelanggan;
  const isMasukan = tipe === 'beli';

  const body = `
    ${kopSurat()}
    <h2 class="pd-title">FAKTUR PAJAK ${isMasukan ? 'MASUKAN' : 'KELUARAN'}</h2>
    <div class="pd-nsfp">
      <div class="pd-nsfp-label">Nomor Seri Faktur Pajak</div>
      <div class="pd-nsfp-value">${esc(p.nsfp)}</div>
    </div>
    <div class="pd-section">
      <table class="pd-tbl">
        <tr>
          <td class="pd-lbl-td">${isMasukan ? 'Penjual (PKP)' : 'Pembeli (PKP)'}</td>
          <td class="pd-val-td">: <b>${esc(pihak || '-')}</b></td>
        </tr>
        <tr>
          <td class="pd-lbl-td">Referensi Faktur</td>
          <td class="pd-val-td">: ${esc(p.no)}</td>
        </tr>
        <tr>
          <td class="pd-lbl-td">Tanggal</td>
          <td class="pd-val-td">: ${dmyLong(p.tgl)}</td>
        </tr>
        <tr>
          <td class="pd-lbl-td">Kantor / Lini</td>
          <td class="pd-val-td">: ${ent.ico} ${esc(ent.nama)}</td>
        </tr>
      </table>
    </div>
    <div class="pd-section">
      <table class="pd-tbl-items">
        <thead>
          <tr>
            <th>Nama Barang</th>
            <th style="width:70px" class="num">Qty</th>
            <th style="width:120px" class="num">Harga</th>
            <th style="width:120px" class="num">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          ${p.items.map(it => {
            const b = brg(it.barangId);
            return `<tr>
              <td>${b ? esc(b.nama) : '—'}</td>
              <td class="num">${it.qty}</td>
              <td class="num">${rp(it.harga)}</td>
              <td class="num">${rp(it.qty*it.harga)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="pd-totals">
      <div class="pd-total-row">
        <span>Dasar Pengenaan Pajak (DPP)</span>
        <span>${rp(dpp)}</span>
      </div>
      <div class="pd-total-row">
        <span>PPN ${p.ppnPersen || 0}%</span>
        <span>${rp(ppnVal)}</span>
      </div>
      <div class="pd-total-row total">
        <span>Total</span>
        <span>${rp(dpp + ppnVal)}</span>
      </div>
    </div>
    <div class="pd-note" style="margin-top:16px;font-size:10px">
      Faktur pajak ini dibuat secara otomatis oleh sistem IMB —
      PT. Insan Muda Berdikari.
    </div>`;

  showPrintDoc('Faktur Pajak', body);
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════ */
window.printKwitansiPenjualan = printKwitansiPenjualan;
window.printBuktiBayarPembelian = printBuktiBayarPembelian;
window.printSuratJalan = printSuratJalan;
window.printFakturPajak = printFakturPajak;
