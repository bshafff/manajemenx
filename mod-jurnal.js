/* ═══════════════════════════════════════════════════════════════
   JURNAL — otomatis dari semua transaksi
   ═══════════════════════════════════════════════════════════════ */

function renderJurnal(){
  const el = document.getElementById('jurnal-list');
  if (!el) return;
  const ent = activeEntity();
  let J = jurnal();
  if (ent !== 'ALL') J = J.filter(x => x.ent === ent);

  const cnt = document.getElementById('jr-count');
  if (cnt) cnt.textContent = J.length + ' entri';

  if (!J.length){
    el.innerHTML = `<div class="empty"><span class="e">📚</span>
      Belum ada jurnal</div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap">
    <table>
      <thead><tr>
        <th>Tgl</th><th>Ref</th><th>Keterangan</th>
        <th class="num">Debet</th><th class="num">Kredit</th>
      </tr></thead>
      <tbody>${J.map(j => `
        <tr>
          <td>${dmy(j.tgl)}</td>
          <td><b>${esc(j.ref)}</b>
            ${j.ent && ent === 'ALL' ? `<div class="hint" style="margin:0">
              ${entInfo(j.ent).ico} ${j.ent}</div>` : ''}</td>
          <td>${esc(j.ket)}
            <div class="hint" style="margin:0">${esc(j.d)} → ${esc(j.k)}</div></td>
          <td class="num pos">${rp(j.j)}</td>
          <td class="num neg">—</td>
        </tr>
      `).join('')}</tbody>
    </table>
  </div>`;
}
