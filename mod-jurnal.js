function renderJurnal(){
  const el = document.getElementById('jurnal-list');
  if (!el) return;
  const J = jurnal();
  if (!J.length){
    el.innerHTML = `<div class="empty"><span class="e">📚</span>Belum ada jurnal</div>`;
    return;
  }
  el.innerHTML = `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px">
    <table>
      <thead><tr><th>Tgl</th><th>Ref</th><th>Keterangan</th>
        <th class="num">Jumlah</th></tr></thead>
      <tbody>${J.map(j => `<tr>
        <td>${dmy(j.tgl)}</td>
        <td><b>${esc(j.ref)}</b></td>
        <td>${esc(j.ket)}
          <div class="hint">${esc(j.d)} → ${esc(j.k)}</div></td>
        <td class="num"><b>${rp(j.j)}</b></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}
