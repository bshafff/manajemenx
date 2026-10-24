/* ═══════════════════════════════════════════════════════════════
   KAS KECIL — per entitas
   ═══════════════════════════════════════════════════════════════ */

function renderKasKecil(){
  /* Entitas dropdown */
  const entEl = document.getElementById('kk-ent');
  if (entEl){
    const cur = entEl.value || activeEntity();
    const vis = visibleEntities();
    entEl.innerHTML = vis.map(k => {
      const e = entInfo(k);
      return `<option value="${k}" ${cur===k?'selected':''}>${e.ico} ${e.nama}</option>`;
    }).join('');
    if (!entEl.value) entEl.value = vis[0];
  }

  /* Defaults */
  const tglEl = document.getElementById('kk-tgl');
  if (tglEl && !tglEl.value) tglEl.value = today();

  /* Stats — total per entitas */
  const st = document.getElementById('kk-stats');
  if (st){
    const ent = activeEntity();
    const list = ent === 'ALL' ? Object.keys(ENTITIES) : [ent];
    st.innerHTML = list.map(k => {
      const e = entInfo(k);
      return `<div class="stat pur"><div class="l">${e.ico} ${e.nama}</div>
        <div class="v">${rp(kkSaldo(k))}</div>
        <div class="d">Saldo kas kecil</div></div>`;
    }).join('') +
    `<div class="stat"><div class="l">Total KK</div>
      <div class="v">${rp(totalKK())}</div>
      <div class="d">Semua entitas</div></div>`;
  }

  /* Update saldo fields */
  const ent = document.getElementById('kk-ent')?.value || 'HQ';
  const saldoEl = document.getElementById('kk-saldo');
  const kasEl = document.getElementById('kk-kasutama');
  if (saldoEl) saldoEl.value = kkSaldo(ent);
  if (kasEl) kasEl.value = kasOf(ent);

  /* Mutasi */
  const el = document.getElementById('kk-mutasi');
  if (!el) return;
  const obj = kkOf(ent);
  const m = obj.mutasi || [];
  const cnt = document.getElementById('kk-count');
  if (cnt) cnt.textContent = m.length;

  if (!m.length){
    el.innerHTML = `<div class="empty"><span class="e">👛</span>Belum ada mutasi</div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap">
    <table>
      <thead><tr>
        <th>Tanggal</th><th>Keterangan</th>
        <th class="num">Masuk</th><th class="num">Keluar</th><th></th>
      </tr></thead>
      <tbody>${m.map(x => `<tr>
        <td>${dmy(x.tgl)}</td>
        <td>${esc(x.ket||'-')}</td>
        <td class="num pos">${x.masuk ? rp(x.masuk) : '-'}</td>
        <td class="num neg">${x.keluar ? rp(x.keluar) : '-'}</td>
        <td class="tb-actions">
          <button class="ibtn" onclick="kkDelMutasi('${x.id}')">🗑️</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function kkSave(){
  const ent = document.getElementById('kk-ent').value;
  const jenis = document.getElementById('kk-jenis').value;
  const tgl = document.getElementById('kk-tgl').value;
  const jml = +document.getElementById('kk-jml').value || 0;
  const ket = document.getElementById('kk-ket').value.trim();

  if (jml <= 0) return toast('Jumlah tidak valid', 'error');

  if (jenis === 'masuk'){
    if (jml > kasOf(ent))
      return toast(`Kas utama ${ent} cuma ${rp(kasOf(ent))}`, 'error');
    addKas(ent, -jml);
    kkOf(ent).saldo += jml;
  } else {
    if (jml > kkSaldo(ent))
      return toast(`Saldo KK cuma ${rp(kkSaldo(ent))}`, 'error');
    addKas(ent, jml);
    kkOf(ent).saldo -= jml;
  }

  const rec = {
    id: uid(), entity: ent, tgl, ket,
    masuk: jenis === 'masuk' ? jml : 0,
    keluar: jenis === 'keluar' ? jml : 0,
  };
  kkOf(ent).mutasi.unshift(rec);
     // POST JURNAL OTOMATIS (KAS KECIL)
  const jLines = [];
  if (jenis === 'masuk') {
    jLines.push({ akun: '1002', debit: jml, kredit: 0 }); // Kas Kecil
    jLines.push({ akun: '1001', debit: 0, kredit: jml }); // Kas Utama
  } else {
    jLines.push({ akun: '6001', debit: jml, kredit: 0 }); // Beban
    jLines.push({ akun: '1002', debit: 0, kredit: jml }); // Kas Kecil
  }
  postJournal(tgl, 'KK-'+ent, ket || 'Kas Kecil', ent, jLines);
  persist();
  queue({ type:'kk', action:'upsert', record:rec });

  /* Reset */
  document.getElementById('kk-jml').value = 0;
  document.getElementById('kk-ket').value = '';

  renderKasKecil();
  refreshDashboard();
  toast('✓ Dicatat');
}

function kkDelMutasi(id){
  const ent = document.getElementById('kk-ent')?.value || 'HQ';
  const m = kkOf(ent).mutasi.find(x => x.id === id); if (!m) return;
  if (!confirm('Batalkan mutasi ini?')) return;
  kkOf(ent).saldo += (m.keluar || 0) - (m.masuk || 0);
  addKas(ent, (m.masuk || 0) - (m.keluar || 0));
  kkOf(ent).mutasi = kkOf(ent).mutasi.filter(x => x.id !== id);
  persist();
  queue({ type:'kk', action:'delete', id });
  renderKasKecil();
  refreshDashboard();
  toast('Dibatalkan');
}

window.kkSave = kkSave;
window.kkDelMutasi = kkDelMutasi;
