/* ═══════════════════════════════════════════════════════════════
   TOOLS — riwayat aktivitas, ganti PIN, kesehatan data (v63)
   ═══════════════════════════════════════════════════════════════ */

/* ─── Riwayat aktivitas (audit log) ─── */
const AUDIT_MAX = 1500;
function logAudit(aksi, ket){
  try {
    const u = typeof currentUser === 'function' ? currentUser() : null;
    if (!Array.isArray(S.audit)) S.audit = [];
    const rec = { id: uid(), t: new Date().toISOString(), userId: u ? u.id : '', nama: u ? u.nama : '-', aksi, ket: String(ket || '').slice(0, 200), dev: getDeviceId() };
    S.audit.unshift(rec);
    if (S.audit.length > AUDIT_MAX) S.audit.length = AUDIT_MAX;
    queue({ type: 'audit', action: 'upsert', record: rec });
    persist();
  } catch (e) { console.warn('audit gagal', e); }
}
/* Hapus di modul yang tidak punya log khusus tetap tercatat (jenis + id) */
const AUDIT_SKIP = ['audit', 'jurnalUmum', 'penjualan', 'pembelian', 'kk', 'users'];
function logAuditDelete(p){
  if (!p || AUDIT_SKIP.includes(p.type)) return;
  logAudit('hapus_' + p.type, 'id ' + p.id);
}

const AUDIT_LABEL = {
  login: '🔓 Masuk', restore: '📤 Restore data', ubah_pin: '🔑 Ganti PIN', buat_akun: '👤 Akun baru', ubah_akun: '✏️ Ubah akun',
  hapus_akun: '🗑️ Hapus akun', hapus_penjualan: '🗑️ Hapus faktur jual', hapus_pembelian: '🗑️ Hapus faktur beli',
  hapus_kas_kecil: '🗑️ Hapus kas kecil', hapus_jurnal: '🗑️ Hapus jurnal', hapus_jurnal_yatim: '🧹 Bersihkan jurnal yatim'
};
function openRiwayat(){
  const u = currentUser(); if (!u || u.role !== 'owner') return toast('Hanya owner', 'error');
  const list = (S.audit || []).slice().sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 80);
  const dt = t => { const d = new Date(t); return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const body = list.length ? `<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Siapa</th><th>Aksi</th></tr></thead><tbody>${list.map(a =>
    `<tr><td style="white-space:nowrap">${dt(a.t)}</td><td>${esc(a.nama)}<div class="hint" style="margin:0">${esc(a.dev || '')}</div></td><td>${esc(AUDIT_LABEL[a.aksi] || a.aksi)}<div class="hint" style="margin:0">${esc(a.ket)}</div></td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty"><span class="e">📜</span>Belum ada aktivitas tercatat</div>';
  openModal('📜 Riwayat Aktivitas', '80 catatan terakhir', body, closeModal, 'Tutup');
}

/* ─── Ganti PIN sendiri ─── */
function openGantiPin(paksa){
  const u = currentUser(); if (!u) return;
  openModal('🔑 Ganti PIN', paksa ? 'PIN kamu pendek atau mudah ditebak. Ganti sekarang.' : u.nama, `
    <div class="form-grid">
      <div><label>PIN lama</label><input id="gp-old" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password"></div>
      <div><label>PIN baru (6–8 angka)</label><input id="gp-new" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></div>
      <div><label>Ulangi PIN baru</label><input id="gp-new2" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></div>
    </div>`, gantiPinSimpan, 'Simpan');
}
async function gantiPinSimpan(){
  const u = currentUser(); if (!u) return;
  const v = id => (document.getElementById(id) || {}).value || '';
  const lama = v('gp-old'), baru = v('gp-new'), baru2 = v('gp-new2');
  if (!(u._needsHash ? String(u._needsHash) === lama : await verifyPin(lama, u.pin))) return toast('PIN lama salah', 'error');
  if (!/^\d{6,8}$/.test(baru)) return toast('PIN baru harus 6–8 angka', 'error');
  if (WEAK_PINS.includes(baru)) return toast('PIN terlalu mudah ditebak', 'error');
  if (baru !== baru2) return toast('Pengulangan PIN tidak sama', 'error');
  if (baru === lama) return toast('PIN baru harus berbeda', 'error');
  u.pin = await makePinHash(baru); delete u._needsHash;
  persist(); queue({ type: 'users', action: 'upsert', record: u });
  logAudit('ubah_pin', u.nama);
  sessionStorage.removeItem('erp_weak_pin');
  closeModal(); toast('✓ PIN diganti');
}
function maybePromptPin(){
  if (sessionStorage.erp_weak_pin && typeof isLoggedIn === 'function' && isLoggedIn()){
    sessionStorage.removeItem('erp_weak_pin'); openGantiPin(true);
  }
}
window.addEventListener('load', () => setTimeout(maybePromptPin, 1800));

/* ─── Kesehatan data ─── */
function storageBytes(){
  let n = 0; try { for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); n += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch {}
  return n;
}
function renderKesehatan(){
  const el = document.getElementById('kesehatan-card'); if (!el) return;
  const u = currentUser(); if (!u) return; const owner = u.role === 'owner';
  const q = getQueue().length, f = getFailed().length;
  const used = storageBytes(), cap = 5 * 1024 * 1024, pct = Math.min(100, Math.round(used / cap * 100));
  const warna = pct >= 85 ? '#dc2626' : pct >= 65 ? '#f59e0b' : '#2d5016';
  const sync = q ? `⏳ ${q} data menunggu dikirim` : (typeof lastSyncText === 'function' ? lastSyncText() : '');
  el.innerHTML = `
    <div class="card-title" style="border-bottom:none;margin-bottom:.5rem;color:#475569;font-weight:700">🩺 Kesehatan Data</div>
    <div style="font-size:13.5px;margin-bottom:6px"><b>Sinkron:</b> ${esc(sync)}${f ? ` · <span style="color:#dc2626">⚠ ${f} data gagal</span>` : ''}</div>
    <div style="font-size:13.5px"><b>Penyimpanan perangkat:</b> ${(used / 1024 / 1024).toFixed(2)} MB dari ±5 MB (${pct}%)</div>
    <div style="height:8px;background:#e5e7eb;border-radius:6px;margin:6px 0 ${pct >= 65 ? '4px' : '12px'};overflow:hidden"><div style="height:100%;width:${pct}%;background:${warna}"></div></div>
    ${pct >= 65 ? '<div class="hint" style="color:#b45309;margin-bottom:10px">Penyimpanan mulai penuh. Lakukan Backup berkala.</div>' : ''}
    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
      <button class="btn btn-s btn-sm" onclick="sync()">🔄 Sync sekarang</button>
      ${f ? '<button class="btn btn-s btn-sm" onclick="retryFailed();renderKesehatan()">♻️ Kirim ulang yang gagal</button>' : ''}
      ${owner ? '<button class="btn btn-s btn-sm" onclick="cekData()">🔍 Cek Data</button><button class="btn btn-s btn-sm" onclick="openRiwayat()">📜 Riwayat</button>' : ''}
      <button class="btn btn-s btn-sm" onclick="openGantiPin()">🔑 Ganti PIN</button>
    </div>`;
}

function cariJurnalYatim(){
  const ids = new Set();
  (S.penjualan || []).forEach(x => ids.add(x.id)); (S.pembelian || []).forEach(x => ids.add(x.id));
  Object.values((S.kasKecil && S.kasKecil.perEntity) || {}).forEach(e => (e.mutasi || []).forEach(m => ids.add(m.id)));
  const noPj = new Set((S.penjualan || []).map(x => x.no)), noFb = new Set((S.pembelian || []).map(x => x.no));
  return (S.jurnalUmum || []).filter(j => {
    if (j.src) return !ids.has(j.src);
    const r = String(j.ref || '');
    if (/^PJ-/.test(r)) return !noPj.has(r);
    if (/^FB-/.test(r)) return !noFb.has(r);
    return false;
  });
}
function cariNomorGanda(){
  const out = [];
  [['penjualan', 'Penjualan'], ['pembelian', 'Pembelian']].forEach(([k, label]) => {
    const c = {}; (S[k] || []).forEach(x => { (c[x.no] = c[x.no] || []).push(x); });
    Object.keys(c).forEach(no => { if (c[no].length > 1) out.push({ jenis: label, no, n: c[no].length }); });
  });
  return out;
}
function cekData(){
  const yatim = cariJurnalYatim(), ganda = cariNomorGanda();
  const kas = Object.keys(ENTITIES).map(k => ({ k, app: (S.entities[k] && S.entities[k].kas) || 0, jur: getAccountBalance('1001', k) })).filter(x => x.app || x.jur);
  const sinkron = getQueue().length === 0;
  const body = `
    <div class="hint" style="margin-bottom:10px">Pemeriksaan hanya membaca data. Pembersihan jurnal yatim butuh konfirmasi.</div>
    <div class="card-title">Jurnal yatim (faktur sudah dihapus)</div>
    <div style="margin-bottom:12px">${yatim.length ? `<b style="color:#dc2626">${yatim.length} jurnal</b> tanpa dokumen asal (total ${rp(yatim.reduce((t, j) => t + (j.lines || []).reduce((s, l) => s + (l.debit || 0), 0), 0))}).${sinkron ? ' Tekan <b>Hapus Yatim</b> untuk membersihkan.' : ' <b>Kirim dulu data yang menunggu sinkron.</b>'}<div class="hint">Tekan Muat sebelum membersihkan agar tidak salah hapus.</div>` : '✓ Tidak ada'}</div>
    <div class="card-title">Nomor dokumen ganda</div>
    <div style="margin-bottom:12px">${ganda.length ? ganda.map(g => `<div>${esc(g.jenis)} <b>${esc(g.no)}</b> (${g.n}×)</div>`).join('') + '<div class="hint">Terjadi bila dua perangkat membuat nomor sama saat offline. Ubah salah satunya.</div>' : '✓ Tidak ada'}</div>
    <div class="card-title">Kas aplikasi vs jurnal (akun 1001)</div>
    ${kas.length ? `<div class="table-wrap"><table><thead><tr><th>Lini</th><th class="num">Kas app</th><th class="num">Jurnal</th><th class="num">Selisih</th></tr></thead><tbody>${kas.map(x => `<tr><td>${esc(entInfo(x.k).kode)}</td><td class="num">${rp(x.app)}</td><td class="num">${rp(x.jur)}</td><td class="num ${Math.abs(x.app - x.jur) > 1 ? 'neg' : 'pos'}">${rp(x.app - x.jur)}</td></tr>`).join('')}</tbody></table></div><div class="hint">Selisih wajar jika ada saldo awal/penyesuaian yang belum dijurnal. Hanya informasi.</div>` : '<div>Belum ada data kas</div>'}`;
  openModal('🔍 Cek Data', 'Hasil pemeriksaan', body, yatim.length && sinkron ? hapusJurnalYatim : closeModal, yatim.length && sinkron ? 'Hapus Yatim' : 'Tutup');
}
function hapusJurnalYatim(){
  const yatim = cariJurnalYatim().filter(j => !isPeriodLocked(j.tgl));
  if (!yatim.length) { closeModal(); return toast('Tidak ada yang bisa dihapus (periode ditutup?)'); }
  if (getQueue().length) return toast('Kirim data yang menunggu dulu', 'error');
  if (!confirm(`Hapus ${yatim.length} jurnal yatim? Tidak bisa dibatalkan.`)) return;
  yatim.forEach(j => queue({ type: 'jurnalUmum', action: 'delete', id: j.id }));
  const set = new Set(yatim.map(j => j.id));
  S.jurnalUmum = S.jurnalUmum.filter(j => !set.has(j.id));
  logAudit('hapus_jurnal_yatim', yatim.length + ' jurnal');
  persist(); closeModal(); refreshAll(); toast(`✓ ${yatim.length} jurnal yatim dibersihkan`);
}

window.logAudit = logAudit; window.logAuditDelete = logAuditDelete; window.openRiwayat = openRiwayat;
window.openGantiPin = openGantiPin; window.renderKesehatan = renderKesehatan; window.cekData = cekData; window.hapusJurnalYatim = hapusJurnalYatim;
