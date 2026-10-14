/* ═══════════════════════════════════════════════════════════════
   AUTH — login PIN sederhana + role-based access
   ═══════════════════════════════════════════════════════════════ */

/* ─── Role → modul yang boleh diakses ─── */
const ROLE_ACCESS = {
  owner:    ['*'],
  manajer:  ['home','dashboard','barang','supplier','pelanggan',
             'pembelian','penjualan','pembayaran','penerimaan',
             'kaskecil','jurnal'],
  kasir:    ['home','dashboard','penjualan','pembayaran',
             'penerimaan','kaskecil'],
  gudang:   ['home','dashboard','barang','pembelian'],
  produksi: ['home','dashboard'],
};

/* ─── Session ─── */
function currentUser(){
  try {
    const s = JSON.parse(localStorage[K_SESSION] || 'null');
    if (!s) return null;
    const u = (S.users || []).find(x => x.id === s.userId);
    if (!u){ localStorage.removeItem(K_SESSION); return null; }
    return u;
  } catch { return null; }
}
function isLoggedIn(){ return !!currentUser(); }

function login(userId, pin){
  const u = (S.users || []).find(x => x.id === userId);
  if (!u) return { ok:false, msg:'User tidak ditemukan' };
  if (String(u.pin) !== String(pin)) return { ok:false, msg:'PIN salah' };
  localStorage[K_SESSION] = JSON.stringify({ userId: u.id, at: Date.now() });
  return { ok:true, user: u };
}

function logout(){
  if (!confirm('Keluar dari akun ini?')) return;
  localStorage.removeItem(K_SESSION);
  location.reload();
}

/* ─── Access check ─── */
function canAccess(moduleId){
  const u = currentUser();
  if (!u) return false;
  const allow = ROLE_ACCESS[u.role] || [];
  if (allow.includes('*')) return true;
  return allow.includes(moduleId);
}

/* ─── Login Screen ─── */
function renderLogin(){
  const w = document.getElementById('welcome');
  const m = document.getElementById('m');
  const nav = document.getElementById('nav');
  if (!w) return;
  if (m) m.style.display = 'none';
  if (nav) nav.style.display = 'none';
  w.style.display = 'block';

  const users = S.users || [];
  if (!users.length){
    w.innerHTML = `<div class="card welcome">
      <div class="ico">⚠️</div>
      <h2>Belum ada user</h2>
      <p>Hubungi admin untuk setup user terlebih dahulu.</p>
    </div>`;
    return;
  }

  w.innerHTML = `<div class="card welcome" style="text-align:left">
    <div style="text-align:center">
      <div class="ico">🔐</div>
      <h2 style="margin:0 0 4px">Masuk IMB</h2>
      <p style="margin:0 0 22px">PT. Insan Muda Berdikari</p>
    </div>
    <label>Pilih Akun</label>
    <select id="login-user">
      ${users.map(u => {
        const e = entInfo(u.entity);
        return `<option value="${u.id}">
          ${e.ico} ${esc(u.nama)} — ${esc(u.role)} (${e.kode})
        </option>`;
      }).join('')}
    </select>
    <label>PIN</label>
    <input id="login-pin" type="password" inputmode="numeric"
           maxlength="6" placeholder="••••" autocomplete="off">
    <button class="btn btn-p" style="width:100%;margin-top:16px"
            onclick="doLogin()">Masuk</button>
    <div class="hint" style="margin-top:14px;text-align:center">
      Default PIN: <b>1234</b> (owner) · <b>1111</b> (SB) ·
      <b>2222</b> (DR) · <b>3333</b> (AY) · <b>4444</b> (PK)
    </div>
  </div>`;
}

function doLogin(){
  const uid_ = document.getElementById('login-user').value;
  const pin  = document.getElementById('login-pin').value;
  const r = login(uid_, pin);
  if (!r.ok){ toast(r.msg, 'error'); return; }
  toast(`Halo, ${r.user.nama}`);
  setTimeout(() => location.reload(), 500);
}

window.renderLogin = renderLogin;
window.doLogin = doLogin;
window.logout = logout;
