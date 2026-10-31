/* ═══════════════════════════════════════════════════════════════
   AUTH — login PIN + role-based access (HASHED PIN)
   ═══════════════════════════════════════════════════════════════ */

const ROLE_ACCESS = {
  owner:    ['*'],
  manajer:  ['home','dashboard','eksekutif','barang','supplier','pelanggan',
             'pembelian','penjualan','pembayaran','penerimaan',
             'kaskecil','jurnal','produksi','panen','kandang'],
  kasir:    ['home','dashboard','penjualan','pembayaran',
             'penerimaan','kaskecil'],
  gudang:   ['home','dashboard','barang','supplier','pembelian'],
  produksi: ['home','dashboard','barang','produksi','panen','kandang'],
};

/* ─── Keamanan PIN & sesi ─── */
const IDLE_MS = 30 * 60 * 1000;           // logout otomatis setelah 30 menit tidak aktif
const PIN_ITER = 100000;                  // iterasi PBKDF2
const WEAK_PINS = ['1234','0000','1111','2222','123456','000000','111111','654321','12345678','00000000'];

const _hex = u8 => Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
const _unhex = h => new Uint8Array((String(h).match(/.{2}/g) || []).map(x => parseInt(x, 16)));
function _sameStr(a, b){ a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function _pbkdf2(pin, salt, iter){
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return _hex(new Uint8Array(bits));
}
async function makePinHash(pin){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return 'pbkdf2$' + PIN_ITER + '$' + _hex(salt) + '$' + await _pbkdf2(pin, salt, PIN_ITER);
}
async function verifyPin(pin, stored){
  stored = String(stored || '');
  if (stored.startsWith('pbkdf2$')){
    const p = stored.split('$'); if (p.length !== 4) return false;
    return _sameStr(await _pbkdf2(pin, _unhex(p[2]), +p[1]), p[3]);
  }
  return _sameStr(await hashPin(pin), stored);   // hash lama (SHA-256 polos)
}
const isLegacyHash = h => !String(h || '').startsWith('pbkdf2$');

/* Kunci sementara setelah salah PIN berulang (di perangkat ini) */
const _lk = id => 'erp_lock_' + id;
function lockInfo(id){ try { return JSON.parse(localStorage[_lk(id)] || 'null') || { n: 0, until: 0 }; } catch { return { n: 0, until: 0 }; } }
function lockRemainSec(id){ return Math.max(0, Math.ceil((lockInfo(id).until - Date.now()) / 1000)); }
function lockFail(id){ const l = lockInfo(id); l.n++; if (l.n >= 5) l.until = Date.now() + Math.min(15 * 60000, 30000 * Math.pow(2, l.n - 5)); try { localStorage[_lk(id)] = JSON.stringify(l); } catch {} return l.n; }
function lockReset(id){ localStorage.removeItem(_lk(id)); }

function currentUser(){
  try {
    const s = JSON.parse(localStorage[K_SESSION] || 'null');
    if (!s) return null;
    if (Date.now() - (s.last || s.at || 0) > IDLE_MS){ localStorage.removeItem(K_SESSION); return null; }
    const u = (S.users || []).find(x => x.id === s.userId);
    if (!u){ localStorage.removeItem(K_SESSION); return null; }
    return u;
  } catch { return null; }
}
function isLoggedIn(){ return !!currentUser(); }

/* Catat aktivitas supaya sesi tidak berakhir saat masih dipakai */
let _lastTouch = 0;
function touchSession(){
  const now = Date.now(); if (now - _lastTouch < 15000) return; _lastTouch = now;
  try { const s = JSON.parse(localStorage[K_SESSION] || 'null'); if (s){ s.last = now; localStorage[K_SESSION] = JSON.stringify(s); } } catch {}
}
['click', 'keydown', 'touchstart', 'scroll'].forEach(ev => document.addEventListener(ev, touchSession, { passive: true, capture: true }));
function cekSesi(){
  const ada = !!localStorage[K_SESSION]; const u = currentUser();
  if (ada && !u){ toast('Sesi berakhir karena tidak aktif. Masuk lagi.'); setTimeout(() => location.reload(), 900); }
}
setInterval(cekSesi, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) cekSesi(); });

async function login(userId, pin){
  const u = (S.users || []).find(x => x.id === userId);
  if (!u) return { ok: false, msg: 'User tidak ditemukan' };

  const sisa = lockRemainSec(userId);
  if (sisa > 0) return { ok: false, msg: 'Terlalu banyak percobaan. Coba lagi ' + sisa + ' detik' };

  const ok = u._needsHash ? _sameStr(pin, u._needsHash) : await verifyPin(pin, u.pin);
  if (!ok){
    const n = lockFail(userId);
    return { ok: false, msg: n >= 5 ? 'PIN salah. Akun dikunci sementara di perangkat ini' : 'PIN salah (' + n + '/5)' };
  }
  lockReset(userId);

  /* Naikkan hash lama ke PBKDF2 berbumbu saat login berhasil */
  if (!u._needsHash && isLegacyHash(u.pin)){
    try { u.pin = await makePinHash(pin); persist(); queue({ type: 'users', action: 'upsert', record: u }); } catch (e) { console.warn('upgrade hash gagal', e); }
  }

  const now = Date.now();
  localStorage[K_SESSION] = JSON.stringify({ userId: u.id, at: now, last: now });
  if (WEAK_PINS.includes(String(pin)) || String(pin).length < 6) sessionStorage.erp_weak_pin = '1';
  if (typeof logAudit === 'function') logAudit('login', u.nama + ' masuk');
  return { ok: true, user: u };
}

function logout(){
  if (!confirm('Keluar dari akun ini?')) return;
  localStorage.removeItem(K_SESSION);
  location.reload();
}

function canAccess(moduleId){
  const u = currentUser();
  if (!u) return false;
  if (u.role === 'owner') return true;
  if (Array.isArray(u.akses)) return u.akses.includes(moduleId);
  const allow = ROLE_ACCESS[u.role] || [];
  return allow.includes(moduleId);
}

/* ─── Login Screen ─── */
function renderLogin(){
  const w = document.getElementById('welcome');
  const m = document.getElementById('m');
  const nav = document.getElementById('nav');
  const sb = document.getElementById('sidebar');
  const hb = document.getElementById('hdr-btns');
  if (!w) return;
  
  if (m) m.style.display = 'none';
  if (nav) nav.style.display = 'none';
  if (sb) sb.style.display = 'none';
  if (hb) hb.style.display = 'none';
  w.style.display = 'block';

  const users = S.users || [];
  if (!users.length){
    w.innerHTML = `<div class="card welcome"><div class="ico">⚠️</div><h2>Belum ada user</h2><p>Hubungi admin.</p></div>`;
    return;
  }

  w.innerHTML = `<div class="card welcome" style="text-align:left; padding: 40px 22px">
    <div style="text-align:center; margin-bottom: 28px;">
      <div class="ico" style="font-size:64px; margin-bottom:14px; filter:drop-shadow(0 4px 10px rgba(45,80,22,.2))">🌱</div>
      <h2 style="margin:0 0 8px; color:var(--green); font-size:24px; font-family:Fraunces; font-weight:600">Selamat Datang di IMB</h2>
      <p style="color:var(--mute); font-size:13.5px; margin:0; line-height:1.6">PT. Insan Muda Berdikari<br>Sistem manajemen terpadu<br>🍓 Stroberi · 🥛 Dairy · 🐔 Ayam · 🌾 Pakan Ayam</p>
    </div>
    <label>Pilih Akun</label>
    <select id="login-user" style="margin-bottom: 12px;">
      ${users.map(u => {
        const e = entInfo(u.entity);
        return `<option value="${u.id}">${e.ico} ${esc(u.nama)} (${e.kode})</option>`;
      }).join('')}
    </select>
    <label>PIN</label>
    <input id="login-pin" type="password" inputmode="numeric" maxlength="8" placeholder="••••••" onkeydown="if(event.key==='Enter')doLogin()">
    <button class="btn btn-p" style="width:100%; margin-top:20px" onclick="doLogin()">Masuk</button>
    <div class="hint" id="login-hint" style="margin-top:16px;text-align:center"></div>
  </div>`;
  showDefaultPinHint();
}

/* Tampilkan petunjuk PIN bawaan HANYA kalau owner belum menggantinya */
async function showDefaultPinHint(){
  const el = document.getElementById('login-hint'); if (!el) return;
  try {
    for (const u of (S.users || [])){
      if (u.role !== 'owner') continue;
      const lemah = u._needsHash ? String(u._needsHash) === '1234' : await verifyPin('1234', u.pin);
      if (lemah){ el.innerHTML = '⚠️ PIN bawaan owner (<b>1234</b>) belum diganti. Ganti segera setelah masuk.'; return; }
    }
  } catch {}
}

async function doLogin(){
  const uid_ = document.getElementById('login-user').value;
  const pin  = document.getElementById('login-pin').value;
  
  const btn = document.querySelector('button[onclick="doLogin()"]');
  btn.textContent = 'Memeriksa...';
  
  const r = await login(uid_, pin);
  if (!r.ok){ toast(r.msg, 'error'); btn.textContent = 'Masuk'; return; }
  
  if (r.user.role !== 'owner') { activeDiv = r.user.entity; } else { activeDiv = 'HQ'; }
  localStorage[K_ACTIVE_DIV] = activeDiv;

  toast(`Halo, ${r.user.nama}`);
  setTimeout(() => location.reload(), 500);
}

window.renderLogin = renderLogin;
window.doLogin = doLogin;
window.logout = logout;
window.canAccess = canAccess;
window.hashPin = hashPin; window.makePinHash = makePinHash; window.verifyPin = verifyPin;
