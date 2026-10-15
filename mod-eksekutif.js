/* ═══════════════════════════════════════════════════════════════
   RINGKASAN EKSEKUTIF — laba, arus kas keluar per pos, titik penghematan
   Semua dihitung dari data transaksi; saran bersifat indikasi (rule-based).
   ═══════════════════════════════════════════════════════════════ */
let _exPer = 'bln';
const EX_BUCKET = [
  ['Utilitas (listrik/air/internet)', /listrik|air\b|pdam|internet|wifi|pulsa|telepon|token/i],
  ['Tenaga kerja (gaji/upah)', /gaji|upah|honor|lembur|thr|bonus|tukang|buruh|panen harian/i],
  ['Transport & BBM', /bensin|solar|bbm|transport|ongkir|ongkos|kurir|parkir|\btol\b|kirim/i],
  ['Perawatan & perbaikan', /servis|service|perbaik|perawatan|reparasi|sparepart|ganti/i],
  ['Kantor & ATK', /atk|kertas|alat tulis|fotokopi|print/i],
  ['Konsumsi', /makan|minum|konsumsi|snack|kopi/i],
];
const exBucket = ket => (EX_BUCKET.find(b => b[1].test(ket || '')) || ['Lain-lain'])[0];
const exYmd = (y, m, d) => { const x = new Date(y, m, d);
  return x.getFullYear() + '-' + String(x.getMonth()+1).padStart(2,'0') + '-' + String(x.getDate()).padStart(2,'0'); };
function exPeriode(p){
  const d = new Date(), y = d.getFullYear(), m = d.getMonth(), f = exYmd;
  if (p === 'bln')  return { a:f(y,m,1),   b:f(y,m+1,0), pa:f(y,m-1,1), pb:f(y,m,0),   label:'Bulan ini' };
  if (p === 'lalu') return { a:f(y,m-1,1), b:f(y,m,0),   pa:f(y,m-2,1), pb:f(y,m-1,0), label:'Bulan lalu' };
  if (p === '3bln') return { a:f(y,m-2,1), b:f(y,m+1,0), pa:f(y,m-5,1), pb:f(y,m-2,0), label:'3 bulan terakhir' };
  return { a:'0000-00-00', b:'9999-12-31', pa:null, pb:null, label:'Semua periode' };
}
function exCalc(a, b, ent){
  const inE = e => ent === 'ALL' || (e || 'HQ') === ent;
  const inD = t => (t || '') >= a && (t || '') <= b;
  const pj = S.penjualan.filter(x => inE(x.entity) && inD(x.tgl));
  const pb = S.pembelian.filter(x => inE(x.entity) && inD(x.tgl));
  const by = (S.pembayaran || []).filter(x => x.jenis !== 'supplier' && inE(x.entity) && inD(x.tgl));
  const kk = Object.entries(S.kasKecil.perEntity || {}).filter(([e]) => inE(e))
    .flatMap(([e, o]) => (o.mutasi || []).filter(m => m.keluar > 0 && inD(m.tgl)).map(m => ({ ...m, entity: e })));
  const r = { pend: sum(pj, totSell), hpp: sum(pj, hppSell), belanja: sum(pb, totBuy), pos: {}, sup: {}, lini: {} };
  const L = e => r.lini[e || 'HQ'] = r.lini[e || 'HQ'] || { pend:0, hpp:0, beban:0 };
  pj.forEach(x => { L(x.entity).pend += totSell(x); L(x.entity).hpp += hppSell(x); });
  [...by.map(x => ({ ket: x.ket || x.jenis, v: x.jumlah, entity: x.entity })),
   ...kk.map(x => ({ ket: x.ket, v: x.keluar, entity: x.entity }))].forEach(x => {
    const k = exBucket(x.ket); r.pos[k] = (r.pos[k] || 0) + x.v; L(x.entity).beban += x.v;
  });
  pb.forEach(x => { const s = x.supplier || '(tanpa nama)'; r.sup[s] = (r.sup[s] || 0) + totBuy(x); });
  r.beban = sum(Object.values(r.pos), v => v);
  r.bersih = r.pend - r.hpp - r.beban;
  r.keluar = r.belanja + r.beban;
  return r;
}
function exInsights(c, prev, ent, piut, hut, kas){
  const out = [], R = n => rp(Math.round(n));
  const pos = Object.entries(c.pos).sort((x, y) => y[1] - x[1]);
  if (c.keluar > 0){
    const items = [['Belanja bahan', c.belanja], ...pos].sort((x, y) => y[1] - x[1]);
    out.push({ i:'🎯', t:`Pos pengeluaran terbesar: ${items[0][0]} (${R(items[0][1])}, ${Math.round(items[0][1] / c.keluar * 100)}% dari total). Tinjau dulu pos ini.` });
  }
  if (prev) pos.forEach(([k, v]) => { const p = prev.pos[k] || 0;
    if (v - p > 100000 && v > p * 1.2) out.push({ i:'📈', t:`${k} naik ${R(v - p)} dibanding periode sebelumnya (${R(p)} → ${R(v)}). Cek penyebabnya.` }); });
  if (prev && c.belanja > prev.belanja * 1.2 && c.belanja - prev.belanja > 100000)
    out.push({ i:'🛒', t:`Belanja bahan naik ${R(c.belanja - prev.belanja)} dari periode sebelumnya. Cocokkan dengan kenaikan penjualan/produksi.` });
  const sups = Object.entries(c.sup).sort((x, y) => y[1] - x[1]);
  if (sups.length > 1 && sups[0][1] / c.belanja > 0.5)
    out.push({ i:'🤝', t:`${Math.round(sups[0][1] / c.belanja * 100)}% belanja bahan ke satu supplier (${sups[0][0]}). Peluang negosiasi harga atau cari pembanding.` });
  Object.entries(c.lini).forEach(([e, l]) => {
    const nm = entInfo(e).nama;
    if (l.pend > 0 && (l.pend - l.hpp) / l.pend < 0.2)
      out.push({ i:'⚠️', t:`Margin kotor ${nm} hanya ${Math.round((l.pend - l.hpp) / l.pend * 100)}%. Tinjau harga jual atau HPP bahan.` });
    if (l.pend > 0 && l.beban / l.pend > 0.25)
      out.push({ i:'💸', t:`Beban operasional ${nm} ${Math.round(l.beban / l.pend * 100)}% dari penjualannya. Pos beban lini ini perlu dihemat.` });
    if (l.pend - l.hpp - l.beban < 0 && (l.pend || l.beban))
      out.push({ i:'🔻', t:`${nm} rugi ${R(-(l.pend - l.hpp - l.beban))} pada periode ini.` });
  });
  if (piut > 0 && piut > kas * 0.5)
    out.push({ i:'⏳', t:`Piutang ${R(piut)} setara ${kas > 0 ? Math.round(piut / kas * 100) + '% dari kas' : 'jauh di atas kas'}. Percepat penagihan agar arus kas longgar.` });
  if (hut > 0 && hut > kas)
    out.push({ i:'🏦', t:`Hutang supplier ${R(hut)} melebihi kas ${R(kas)}. Atur jadwal pembayaran.` });
  if (!out.length) out.push({ i:'✅', t: c.keluar > 0 ? 'Tidak ada pos yang mencolok pada periode ini.' : 'Belum ada data pengeluaran pada periode ini.' });
  return out;
}
function exSetPer(p){ _exPer = p; renderEksekutif(); }
function renderEksekutif(){
  const el = document.getElementById('eks-root'); if (!el) return;
  const ent = activeEntity(), P = exPeriode(_exPer);
  const c = exCalc(P.a, P.b, ent), prev = P.pa ? exCalc(P.pa, P.pb, ent) : null;
  const inE = e => ent === 'ALL' || (e || 'HQ') === ent;
  const kas = ent === 'ALL' ? totalKas() : kasOf(ent);
  const piut = ent === 'ALL' ? sum(Object.keys(ENTITIES), piutangEnt) : piutangEnt(ent);
  const hut = sum(S.pembelian.filter(p => inE(p.entity) && p.status !== 'lunas'), p => totBuy(p) - (p.dibayar || 0));
  const ins = exInsights(c, prev, ent, piut, hut, kas);
  const items = [['Belanja bahan', c.belanja], ...Object.entries(c.pos)].filter(x => x[1] > 0).sort((x, y) => y[1] - x[1]);
  const mx = items.length ? items[0][1] : 1;
  const box = (l, v, cls) => `<div class="stat ${cls||''}"><div class="l">${l}</div><div class="v">${v}</div></div>`;
  const per = [['bln','Bulan ini'],['lalu','Bulan lalu'],['3bln','3 bulan'],['all','Semua']];
  el.innerHTML = `
  <div class="card"><div class="card-header-flex"><h3>🧭 Ringkasan Eksekutif</h3>
    <button class="btn btn-s btn-sm" onclick="exShare()">📤 Bagikan</button></div>
    <div class="hint">${P.label} · ${ent === 'ALL' ? 'Semua lini' : entInfo(ent).nama}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${per.map(([k, l]) =>
      `<button class="ent-pill ${_exPer===k?'on':''}" onclick="exSetPer('${k}')">${l}</button>`).join('')}</div></div>
  <div class="grid">${box('Pendapatan', rp(c.pend), 'blue')}${box('Laba bersih', rp(c.bersih), c.bersih < 0 ? 'red' : 'gold')}
    ${box('Kas saat ini', rp(kas), 'pur')}${box('Piutang / Hutang', rp(piut) + ' / ' + rp(hut))}</div>
  <div class="card"><h3>💡 Titik penghematan</h3>
    ${ins.map(x => `<p style="margin:8px 0">${x.i} ${esc(x.t)}</p>`).join('')}
    <div class="hint">Indikasi otomatis dari data; pos dikelompokkan dari kata kunci pada keterangan pembayaran/kas kecil.</div></div>
  <div class="card"><h3>💸 Ke mana uang keluar</h3>
    ${!items.length ? '<div class="empty">Belum ada pengeluaran pada periode ini.</div>' : items.map(([k, v]) => `
    <div style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(k)}</span><b>${rp(v)} · ${Math.round(v / c.keluar * 100)}%</b></div>
    <div style="background:#e8e6da;border-radius:6px;height:10px"><div style="width:${Math.max(3, v / mx * 100)}%;background:#1f3d1a;height:10px;border-radius:6px"></div></div></div>`).join('')}</div>
  <div class="card"><h3>🏷️ Per lini</h3><div class="table-wrap"><table><thead><tr><th>Lini</th><th class="num">Pendapatan</th><th class="num">Margin</th><th class="num">Beban</th><th class="num">Laba</th></tr></thead><tbody>
    ${Object.entries(c.lini).map(([e, l]) => `<tr><td>${entInfo(e).ico} ${entInfo(e).nama}</td><td class="num">${rp(l.pend)}</td>
      <td class="num">${l.pend ? Math.round((l.pend - l.hpp) / l.pend * 100) + '%' : '-'}</td><td class="num">${rp(l.beban)}</td>
      <td class="num ${l.pend - l.hpp - l.beban < 0 ? 'neg' : 'pos'}">${rp(l.pend - l.hpp - l.beban)}</td></tr>`).join('') || '<tr><td colspan="5">Belum ada data</td></tr>'}
    </tbody></table></div></div>`;
  window._exText = `*Ringkasan Eksekutif IMB*\n${P.label} · ${ent === 'ALL' ? 'Semua lini' : entInfo(ent).nama}\n\nPendapatan: ${rp(c.pend)}\nLaba bersih: ${rp(c.bersih)}\nKas: ${rp(kas)} | Piutang: ${rp(piut)} | Hutang: ${rp(hut)}\n\n*Pengeluaran terbesar*\n` +
    items.slice(0, 5).map(([k, v], i) => `${i + 1}. ${k}: ${rp(v)} (${Math.round(v / c.keluar * 100)}%)`).join('\n') +
    `\n\n*Titik penghematan*\n` + ins.map(x => '- ' + x.t).join('\n');
}
function exShare(){
  const t = window._exText || '';
  if (navigator.share) navigator.share({ text: t }).catch(() => {});
  else window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
}
Object.assign(window, { renderEksekutif, exSetPer, exShare });
