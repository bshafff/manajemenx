/* ═══════════════════════════════════════════════════════════════
   VIEW LOADER
   ═══════════════════════════════════════════════════════════════ */
const VIEW_FILES = {
  'home':       'home.html',
  'dashboard':  'dashboard.html',
  'barang':     'barang.html',
  'supplier':   'supplier.html',
  'pelanggan':  'pelanggan.html',
  'pembelian':  'pembelian.html',
  'penjualan':  'penjualan.html',
  'pembayaran': 'pembayaran.html',
  'penerimaan': 'penerimaan.html',
  'kaskecil':   'kaskecil.html',
  'jurnal':     'jurnal.html',
};

async function loadAllViews(){
  const container = document.getElementById('m');
  if (!container) return;
  const entries = Object.entries(VIEW_FILES);
  try {
    const texts = await Promise.all(entries.map(([_, f]) =>
      fetch('./' + f, { cache: 'no-cache' }).then(r => {
        if (!r.ok) throw new Error(`Gagal load ${f}: ${r.status}`);
        return r.text();
      })
    ));
    container.innerHTML = texts.join('\n');
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="card" style="color:#dc2626">
      <b>Gagal memuat tampilan.</b><br>
      <small>${err.message}</small>
    </div>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   SERVICE WORKER
   ═══════════════════════════════════════════════════════════════ */
if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch(e => console.warn('SW gagal:', e));
  });
}

/* ═══════════════════════════════════════════════════════════════
   BOOTSTRAP
   ═══════════════════════════════════════════════════════════════ */
async function initApp(){
  await loadAllViews();
  if (typeof boot === 'function') boot();
  checkUpdate(true);
  setInterval(() => {
    if (!document.hidden && typeof hasUrl === 'function' && hasUrl()) flush();
  }, 30000);
}

window.addEventListener('DOMContentLoaded', initApp);
