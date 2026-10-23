/* ui.js — pelengkap responsive.css (tidak mengubah logika bisnis) */
(function(){
  // 1) Penanda offline di <body> (header berubah warna)
  const setOff = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online', setOff);
  window.addEventListener('offline', setOff);
  setOff();

  // 2) Tabel → kartu di HP: beri data-label dari <th>. Opt-out: class="no-stack".
  function label(tbl){
    if (tbl.classList.contains('no-stack') || tbl.closest('.no-stack')) return;
    const ths = tbl.querySelectorAll('thead tr:last-child th');
    if (!ths.length) return;
    const names = [...ths].map(t => t.textContent.trim());
    tbl.classList.add('stack');
    tbl.querySelectorAll('tbody tr, tfoot tr').forEach(tr => {
      [...tr.children].forEach((td, i) => {
        if (td.tagName === 'TD' && !td.hasAttribute('data-label'))
          td.setAttribute('data-label', names[i] || '');
      });
    });
  }
  let raf;
  const run = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() =>
      document.querySelectorAll('#m table, #mc table').forEach(label));
  };
  ['m', 'mc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(run).observe(el, { childList: true, subtree: true });
  });
  run();
})();
