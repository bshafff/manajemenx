/* ═══════════════════════════════════════════════════════════════
   IMPORT CSV — modul generik untuk semua menu
   ═══════════════════════════════════════════════════════════════ */

/* ─── Parser angka: handle "3.500", "3,500", "3500", "Rp 3500" ─── */
function parseNum(v){
  if (v === null || v === undefined || v === '') return 0;
  let s = String(v).trim().replace(/\s/g, '').replace(/rp/gi, '');
  if (s.includes(',') && s.includes('.')){
    // Format ID: 1.500,50 → 1500.50
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')){
    const parts = s.split(',');
    // "1,500" (ribuan) vs "1500,50" (desimal)
    if (parts.length === 2 && parts[1].length === 3 && !parts[0].includes('.'))
      s = parts.join('');
    else s = s.replace(',', '.');
  } else if (s.includes('.')){
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length === 3) s = parts.join('');
  }
  return +s || 0;
}

/* ─── Deteksi separator: koma atau titik-koma (Excel ID) ─── */
function detectSep(text){
  const first = (text.split(/\r?\n/)[0] || '');
  const c = (first.match(/,/g) || []).length;
  const s = (first.match(/;/g) || []).length;
  return s > c ? ';' : ',';
}

/* ─── Parser CSV (RFC 4180, support quote) ─── */
function parseCSV(text){
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // BOM
  const sep = detectSep(text);
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i], n = text[i+1];
    if (inQ){
      if (c === '"' && n === '"'){ cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === sep){ row.push(cur); cur = ''; }
      else if (c === '\r'){ /* skip */ }
      else if (c === '\n'){ row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
  }
  if (cur !== '' || row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

/* ─── CSV → array of objects ─── */
function csvToObjects(text){
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const header = rows[0].map(h =>
    h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, ''));
  return rows.slice(1).map(r => {
    const o = {};
    header.forEach((h, i) => o[h] = String(r[i] ?? '').trim());
    return o;
  });
}

/* ─── Download CSV ─── */
function downloadCSV(filename, rows){
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ═══════════════════════════════════════════════════════════════
   KONFIGURASI TIAP JENIS IMPORT
   ═══════════════════════════════════════════════════════════════ */
const IMPORT_TYPES = {

  /* ─────── BARANG ─────── */
  barang: {
    label: 'Master Barang',
    hint: 'Kolom <b>lini</b>: SB / DR / AY / PK · <b>tipe</b>: bahan / jadi',
    template: () => [
      ['kode', 'lini', 'nama', 'satuan', 'tipe', 'stok', 'hpp', 'jual'],
      ['SB-B01', 'SB', 'Bibit Stroberi Sweet Charlie', 'polybag', 'bahan', '500', '3500', '7500'],
      ['DR-B01', 'DR', 'Susu Segar Mentah', 'liter', 'bahan', '200', '12000', '0'],
      ['PK-J01', 'PK', 'Pakan Starter (BR-1) 50kg', 'karung', 'jadi', '0', '0', '385000'],
    ],
    importer(rows){
      const errs = []; let count = 0;
      rows.forEach((r, i) => {
        const line = i + 2;
        const kode = (r.kode || '').toUpperCase();
        const nama = r.nama;
        if (!kode || !nama){ errs.push(`Baris ${line}: kode/nama kosong`); return; }
        if (S.barang.find(b => b.kode === kode)){
          errs.push(`Baris ${line}: kode ${kode} sudah ada`); return;
        }
        const lini = (r.lini || kode.split('-')[0] || 'SB').toUpperCase();
        if (!LINI[lini]){ errs.push(`Baris ${line}: lini ${lini} tidak valid`); return; }
        const b = {
          id: uid(), lini, kode, nama,
          satuan: r.satuan || 'pcs',
          tipe: (r.tipe || 'bahan').toLowerCase() === 'jadi' ? 'jadi' : 'bahan',
          stok: parseNum(r.stok),
          hargaBeli: parseNum(r.hpp),
          hargaJual: parseNum(r.jual),
        };
        S.barang.push(b);
        queue({ type:'barang', action:'upsert', record:b });
        count++;
      });
      return { count, errs };
    },
  },

  /* ─────── SUPPLIER ─────── */
  supplier: {
    label: 'Supplier',
    hint: '<b>entitas</b>: HQ / SB / DR / AY / PK · <b>pkp</b>: 1 atau 0',
    template: () => [
      ['kode','entitas','nama','alamat','telp','email','top','npwp','pkp'],
      ['SUP-001','SB','PT Benih Unggul','Jl. Raya Cipanas','08123456789','sales@benih.com','30','01.234.567.8-901.000','1'],
      ['SUP-002','DR','CV Nutrisi Prima','Bandung','08234567890','','14','','0'],
      ['SUP-003','AY','PT Pakan Sejahtera','Surabaya','08345678901','','30','02.345.678.9-012.000','1'],
    ],
    importer(rows){
      const errs = []; let count = 0;
      if (!S.supplier) S.supplier = [];
      rows.forEach((r, i) => {
        const line = i + 2;
        const kode = (r.kode || '').toUpperCase();
        const nama = r.nama;
        if (!kode || !nama){ errs.push(`Baris ${line}: kode/nama kosong`); return; }
        if (S.supplier.find(x => x.kode === kode)){
          errs.push(`Baris ${line}: kode ${kode} sudah ada`); return;
        }
        const ent = (r.entitas || 'HQ').toUpperCase();
        if (!ENTITIES[ent]){ errs.push(`Baris ${line}: entitas ${ent} tidak valid`); return; }
        const rec = {
          id: uid(), kode, entity: ent, nama,
          alamat: r.alamat || '', telp: r.telp || '',
          email: r.email || '',
          top: parseNum(r.top),
          npwp: r.npwp || '',
          pkp: String(r.pkp) === '1' || String(r.pkp).toLowerCase() === 'true',
        };
        S.supplier.push(rec);
        queue({ type:'supplier', action:'upsert', record:rec });
        count++;
      });
      return { count, errs };
    },
  },

  /* ─────── PELANGGAN ─────── */
  pelanggan: {
    label: 'Pelanggan',
    hint: '<b>channel</b>: mitra / toko / online / farm',
    template: () => [
      ['kode','entitas','nama','channel','alamat','telp','email','top','limit','npwp'],
      ['CUS-001','SB','Toko Buah Segar','mitra','Jakarta','08111111','','30','5000000',''],
      ['CUS-002','DR','Kafe Sehat','toko','Bandung','08222222','','14','2000000',''],
      ['CUS-003','AY','Warung Bu Sari','online','','08333333','','0','0',''],
    ],
    importer(rows){
      const errs = []; let count = 0;
      if (!S.pelanggan) S.pelanggan = [];
      rows.forEach((r, i) => {
        const line = i + 2;
        const kode = (r.kode || '').toUpperCase();
        const nama = r.nama;
        if (!kode || !nama){ errs.push(`Baris ${line}: kode/nama kosong`); return; }
        if (S.pelanggan.find(x => x.kode === kode)){
          errs.push(`Baris ${line}: kode ${kode} sudah ada`); return;
        }
        const ent = (r.entitas || 'HQ').toUpperCase();
        if (!ENTITIES[ent]){ errs.push(`Baris ${line}: entitas ${ent} tidak valid`); return; }
        const rec = {
          id: uid(), kode, entity: ent, nama,
          channel: (r.channel || 'mitra').toLowerCase(),
          alamat: r.alamat || '', telp: r.telp || '',
          email: r.email || '',
          top: parseNum(r.top),
          limit: parseNum(r.limit),
          npwp: r.npwp || '',
        };
        S.pelanggan.push(rec);
        queue({ type:'pelanggan', action:'upsert', record:rec });
        count++;
      });
      return { count, errs };
    },
  },

  /* ─────── PEMBELIAN (multi-item, grouping by no) ─────── */
  pembelian: {
    label: 'Pembelian',
    hint: '1 faktur boleh >1 baris dengan <b>no</b> yang sama · <b>status</b>: lunas / hutang',
    template: () => [
      ['no','tgl','supplier','status','kode_barang','qty','harga'],
      ['PB-001','2026-01-15','PT Benih Unggul','lunas','SB-B01','100','3500'],
      ['PB-001','2026-01-15','PT Benih Unggul','lunas','SB-B02','50','4000'],
      ['PB-002','2026-01-15','CV Nutrisi Prima','hutang','DR-B01','200','12000'],
    ],
    importer(rows){
      const errs = []; const map = {};
      rows.forEach((r, i) => {
        const line = i + 2;
        const no = r.no;
        const kode = (r.kode_barang || '').toUpperCase();
        if (!no || !kode){ errs.push(`Baris ${line}: no/kode_barang kosong`); return; }
        const b = brgKode(kode);
        if (!b){ errs.push(`Baris ${line}: barang ${kode} tidak ada`); return; }
        const qty = parseNum(r.qty);
        if (qty <= 0){ errs.push(`Baris ${line}: qty harus > 0`); return; }
        if (!map[no]){
          map[no] = {
            id: uid(), no,
            tgl: r.tgl || today(),
            supplier: r.supplier || '',
            status: (r.status || 'lunas').toLowerCase() === 'hutang' ? 'hutang' : 'lunas',
            items: [],
          };
        }
        map[no].items.push({ barangId: b.id, qty, harga: parseNum(r.harga) });
      });
      let count = 0;
      Object.values(map).forEach(p => {
        if (S.pembelian.find(x => x.no === p.no)){
          errs.push(`Faktur ${p.no}: sudah ada di sistem`); return;
        }
        p.items.forEach(it => stokMasuk(it.barangId, it.qty, it.harga));
        if (p.status === 'lunas'){
          const total = p.items.reduce((a,x) => a + x.qty * x.harga, 0);
          S.kas -= total;
        }
        S.pembelian.unshift(p);
        queue({ type:'pembelian', action:'upsert', record:p });
        count++;
      });
      return { count, errs };
    },
  },

  /* ─────── PENJUALAN (multi-item) ─────── */
  penjualan: {
    label: 'Penjualan',
    hint: '1 faktur boleh >1 baris dengan <b>no</b> yang sama · <b>status</b>: lunas / piutang',
    template: () => [
      ['no','tgl','pelanggan','status','kode_barang','qty','harga'],
      ['PJ-001','2026-01-15','Toko Buah Segar','lunas','SB-J01','5','95000'],
      ['PJ-001','2026-01-15','Toko Buah Segar','lunas','SB-J02','3','65000'],
      ['PJ-002','2026-01-15','Kafe Sehat','piutang','DR-J02','12','18000'],
    ],
    importer(rows){
      const errs = []; const map = {};
      rows.forEach((r, i) => {
        const line = i + 2;
        const no = r.no;
        const kode = (r.kode_barang || '').toUpperCase();
        if (!no || !kode){ errs.push(`Baris ${line}: no/kode_barang kosong`); return; }
        const b = brgKode(kode);
        if (!b){ errs.push(`Baris ${line}: barang ${kode} tidak ada`); return; }
        const qty = parseNum(r.qty);
        if (qty <= 0){ errs.push(`Baris ${line}: qty harus > 0`); return; }
        if (!map[no]){
          map[no] = {
            id: uid(), no,
            tgl: r.tgl || today(),
            pelanggan: r.pelanggan || '',
            status: (r.status || 'lunas').toLowerCase() === 'piutang' ? 'piutang' : 'lunas',
            items: [],
          };
        }
        map[no].items.push({ barangId: b.id, qty, harga: parseNum(r.harga) });
      });
      let count = 0;
      Object.values(map).forEach(p => {
        if (S.penjualan.find(x => x.no === p.no)){
          errs.push(`Faktur ${p.no}: sudah ada di sistem`); return;
        }
        // Cek stok total per barang
        const perlu = {};
        p.items.forEach(it => perlu[it.barangId] = (perlu[it.barangId] || 0) + it.qty);
        for (const [bid, q] of Object.entries(perlu)){
          const b = brg(bid);
          if (b && q > b.stok){
            errs.push(`Faktur ${p.no}: stok ${b.nama} cuma ${b.stok}, minta ${q}`);
            return;
          }
        }
        p.items.forEach(it => { it.hpp = stokKeluar(it.barangId, it.qty); });
        if (p.status === 'lunas'){
          const total = p.items.reduce((a,x) => a + x.qty * x.harga, 0);
          S.kas += total;
        }
        S.penjualan.unshift(p);
        queue({ type:'penjualan', action:'upsert', record:p });
        count++;
      });
      return { count, errs };
    },
  },

  /* ─────── PEMBAYARAN ─────── */
  pembayaran: {
    label: 'Pembayaran',
    hint: 'Kas keluar — saldo kas utama otomatis berkurang',
    template: () => [
      ['tgl','ket','jumlah'],
      ['2026-01-15','Bayar listrik','250000'],
      ['2026-01-16','Bayar internet','450000'],
    ],
    importer(rows){
      const errs = []; let count = 0;
      rows.forEach((r, i) => {
        const line = i + 2;
        const jml = parseNum(r.jumlah);
        if (jml <= 0){ errs.push(`Baris ${line}: jumlah tidak valid`); return; }
        const rec = {
          id: uid(),
          no: 'BY-' + Date.now().toString().slice(-6) + '-' + i,
          tgl: r.tgl || today(),
          ket: r.ket || 'Import CSV',
          jenis: 'beban',
          jumlah: jml,
        };
        S.kas -= jml;
        if (!S.pembayaran) S.pembayaran = [];
        S.pembayaran.unshift(rec);
        queue({ type:'pembayaran', action:'upsert', record:rec });
        count++;
      });
      return { count, errs };
    },
  },

  /* ─────── PENERIMAAN ─────── */
  penerimaan: {
    label: 'Penerimaan',
    hint: 'Kas masuk — saldo kas utama otomatis bertambah',
    template: () => [
      ['tgl','ket','jumlah'],
      ['2026-01-15','Pelunasan piutang Toko A','1500000'],
      ['2026-01-16','DP pesanan Kafe','500000'],
    ],
    importer(rows){
      const errs = []; let count = 0;
      rows.forEach((r, i) => {
        const line = i + 2;
        const jml = parseNum(r.jumlah);
        if (jml <= 0){ errs.push(`Baris ${line}: jumlah tidak valid`); return; }
        const rec = {
          id: uid(),
          no: 'TR-' + Date.now().toString().slice(-6) + '-' + i,
          tgl: r.tgl || today(),
          ket: r.ket || 'Import CSV',
          jumlah: jml,
        };
        S.kas += jml;
        if (!S.penerimaan) S.penerimaan = [];
        S.penerimaan.unshift(rec);
        queue({ type:'penerimaan', action:'upsert', record:rec });
        count++;
      });
      return { count, errs };
    },
  },

  /* ─────── KAS KECIL ─────── */
  kaskecil: {
    label: 'Kas Kecil',
    hint: 'Isi kolom <b>masuk</b> ATAU <b>keluar</b> (yang lain isi 0)',
    template: () => [
      ['tgl','ket','masuk','keluar'],
      ['2026-01-15','Isi dari kas utama','500000','0'],
      ['2026-01-15','Beli ATK','0','75000'],
      ['2026-01-16','Bensin kurir','0','50000'],
    ],
    importer(rows){
      const errs = []; let count = 0;
      rows.forEach((r, i) => {
        const line = i + 2;
        const masuk = parseNum(r.masuk);
        const keluar = parseNum(r.keluar);
        if (masuk === 0 && keluar === 0){
          errs.push(`Baris ${line}: masuk & keluar 0`); return;
        }
        if (masuk > 0 && keluar > 0){
          errs.push(`Baris ${line}: isi salah satu saja`); return;
        }
        if (masuk > S.kas){
          errs.push(`Baris ${line}: kas utama cuma ${rp(S.kas)}`); return;
        }
        if (keluar > S.kasKecil.saldo){
          errs.push(`Baris ${line}: saldo kas kecil cuma ${rp(S.kasKecil.saldo)}`); return;
        }
        S.kas += (keluar - masuk);
        S.kasKecil.saldo += (masuk - keluar);
        const rec = {
          id: uid(),
          tgl: r.tgl || today(),
          ket: r.ket || '',
          masuk, keluar,
        };
        S.kasKecil.mutasi.unshift(rec);
        queue({ type:'kk', action:'upsert', record:rec });
        count++;
      });
      return { count, errs };
    },
  },

  /* ─────── PERMINTAAN PEMBELIAN ─────── */
  permintaan: {
    label: 'Permintaan Pembelian',
    hint: '1 PR boleh >1 baris dengan <b>no</b> yang sama',
    template: () => [
      ['no','tgl','ket','kode_barang','qty'],
      ['PR-001','2026-01-15','Stok bibit menipis','SB-B01','200'],
      ['PR-001','2026-01-15','Stok bibit menipis','SB-B02','100'],
    ],
    importer(rows){
      const errs = []; const map = {};
      rows.forEach((r, i) => {
        const line = i + 2;
        const no = r.no;
        const kode = (r.kode_barang || '').toUpperCase();
        if (!no || !kode){ errs.push(`Baris ${line}: no/kode_barang kosong`); return; }
        const b = brgKode(kode);
        if (!b){ errs.push(`Baris ${line}: barang ${kode} tidak ada`); return; }
        if (!map[no]){
          map[no] = {
            id: uid(), no,
            tgl: r.tgl || today(),
            ket: r.ket || '',
            status: 'open',
            items: [],
          };
        }
        map[no].items.push({ barangId: b.id, qty: parseNum(r.qty), harga: 0 });
      });
      let count = 0;
      if (!S.permintaan) S.permintaan = [];
      Object.values(map).forEach(p => {
        if (S.permintaan.find(x => x.no === p.no)){
          errs.push(`PR ${p.no}: sudah ada`); return;
        }
        S.permintaan.unshift(p);
        queue({ type:'permintaan', action:'upsert', record:p });
        count++;
      });
      return { count, errs };
    },
  },

  /* ─────── WORK ORDER (PESANAN) ─────── */
  pesanan: {
    label: 'Work Order',
    hint: '<b>tipe</b>: b = bahan dipakai · o = output barang jadi',
    template: () => [
      ['no','tgl','pelanggan','biaya_kerja','tipe','kode_barang','qty'],
      ['WO-001','2026-01-15','Yogurt Stroberi Batch 1','50000','b','DR-B01','20'],
      ['WO-001','2026-01-15','Yogurt Stroberi Batch 1','50000','b','DR-B02','2'],
      ['WO-001','2026-01-15','Yogurt Stroberi Batch 1','50000','o','DR-J03','18'],
    ],
    importer(rows){
      const errs = []; const map = {};
      rows.forEach((r, i) => {
        const line = i + 2;
        const no = r.no;
        const kode = (r.kode_barang || '').toUpperCase();
        const tipe = (r.tipe || '').toLowerCase();
        if (!no || !kode){ errs.push(`Baris ${line}: no/kode_barang kosong`); return; }
        if (!['b','o'].includes(tipe)){ errs.push(`Baris ${line}: tipe harus b/o`); return; }
        const b = brgKode(kode);
        if (!b){ errs.push(`Baris ${line}: barang ${kode} tidak ada`); return; }
        if (!map[no]){
          map[no] = {
            id: uid(), no,
            tgl: r.tgl || today(),
            pelanggan: r.pelanggan || '',
            biayaKerja: parseNum(r.biaya_kerja),
            status: 'draft',
            bahan: [], output: [],
          };
        }
        const item = { barangId: b.id, qty: parseNum(r.qty), harga: b.hargaBeli || 0 };
        if (tipe === 'b') map[no].bahan.push(item);
        else map[no].output.push(item);
      });
      let count = 0;
      if (!S.pesanan) S.pesanan = [];
      Object.values(map).forEach(p => {
        if (!p.bahan.length || !p.output.length){
          errs.push(`WO ${p.no}: butuh minimal 1 bahan & 1 output`); return;
        }
        if (S.pesanan.find(x => x.no === p.no)){
          errs.push(`WO ${p.no}: sudah ada`); return;
        }
        S.pesanan.unshift(p);
        queue({ type:'pesanan', action:'upsert', record:p });
        count++;
      });
      return { count, errs };
    },
  },
};

/* ═══════════════════════════════════════════════════════════════
   UI: download template
   ═══════════════════════════════════════════════════════════════ */
function downloadTemplate(type){
  const cfg = IMPORT_TYPES[type];
  if (!cfg) return;
  downloadCSV(`template-${type}.csv`, cfg.template());
  toast('✓ Template diunduh');
}

/* ═══════════════════════════════════════════════════════════════
   UI: dialog import
   ═══════════════════════════════════════════════════════════════ */
function openImportDialog(type){
  const cfg = IMPORT_TYPES[type];
  if (!cfg){ toast('Tipe import tidak dikenal', 'error'); return; }

  let parsedRows = null;

  openModal(`📥 Import ${cfg.label}`, 'Unggah file CSV sesuai template', `
    <button class="btn btn-s" style="width:100%;margin-bottom:14px"
            onclick="downloadTemplate('${type}')">
      ⬇ Download Template CSV
    </button>
    <label>Pilih File CSV</label>
    <input type="file" id="csv-file" accept=".csv,text/csv">
    <div id="import-preview" style="margin-top:12px"></div>
    <div class="hint" style="margin-top:12px">${cfg.hint || ''}</div>
    <div class="hint" style="margin-top:6px">
      Format angka didukung: <b>3500</b> · <b>3.500</b> · <b>Rp 3.500</b>
    </div>
  `, () => {
    if (!parsedRows || !parsedRows.length){
      toast('Belum ada file atau data kosong', 'error');
      return;
    }
    let result;
    try { result = cfg.importer(parsedRows); }
    catch(e){ toast('Gagal impor: ' + e.message, 'error'); return; }

    persist();
    refreshAll();
    closeModal();

    if (result.errs.length){
      const msg = `✓ ${result.count} data diimpor\n` +
        `⚠️ ${result.errs.length} baris dilewati:\n\n` +
        result.errs.slice(0, 15).join('\n') +
        (result.errs.length > 15 ? `\n… dan ${result.errs.length - 15} lagi` : '');
      alert(msg);
    } else {
      toast(`✓ ${result.count} data diimpor`);
    }
  }, 'Import');

  // Wire up file input setelah modal render
  document.getElementById('csv-file').onchange = e => {
    const f = e.target.files[0];
    const prev = document.getElementById('import-preview');
    if (!f){ prev.innerHTML = ''; parsedRows = null; return; }
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        parsedRows = csvToObjects(ev.target.result);
        if (!parsedRows.length){
          prev.innerHTML = `<div style="color:var(--red);font-size:13px">
            ⚠️ File kosong atau tidak ada baris data</div>`;
          return;
        }
        const keys = Object.keys(parsedRows[0]);
        prev.innerHTML = `
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                      border-radius:8px;padding:10px">
            <div style="font-weight:700;color:#15803d;font-size:13px">
              ✓ ${parsedRows.length} baris terbaca
            </div>
            <div style="font-size:11px;color:var(--mute);margin-top:6px">
              Kolom: ${keys.map(k => esc(k)).join(' · ')}
            </div>
          </div>`;
      } catch(err){
        parsedRows = null;
        prev.innerHTML = `<div style="color:var(--red);font-size:13px">
          ⚠️ Gagal baca: ${esc(err.message)}</div>`;
      }
    };
    reader.readAsText(f, 'UTF-8');
  };
}

window.openImportDialog = openImportDialog;
window.downloadTemplate  = downloadTemplate;
