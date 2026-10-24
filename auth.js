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

/* Fungsi Hash PIN */
async function hashPin(pin){
  const msgBuffer = new TextEncoder().encode(String(pin));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function login(userId, pin){
  const u = (S.users || []).find(x => x.id === userId);
  if (!u) return { ok:false, msg:'User tidak ditemukan' };
  
  // Hash input PIN lalu bandingkan dengan hash di database
  const inputHash = await hashPin(pin);
  
  if (u.pin !== inputHash) {
    return { ok:false, msg:'PIN salah' };
  }
  
  localStorage[K_SESSION] = JSON.stringify({ userId: u.id, at: Date.now() });
  return { ok:true, user: u };
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
    <input id="login-pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••" onkeydown="if(event.key==='Enter')doLogin()">
    <button class="btn btn-p" style="width:100%; margin-top:20px" onclick="doLogin()">Masuk</button>
    <div class="hint" style="margin-top:16px;text-align:center">Default PIN: <b>1234</b> (owner)</div>
  </div>`;
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
window.hashPin = hashPin;
