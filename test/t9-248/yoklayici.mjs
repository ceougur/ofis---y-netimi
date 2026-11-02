// T9 ÖLÇEK — AYRI SÜREÇTE masaüstü yoklayıcı: verilen ucu art arda (aralık 200 ms) çağırır, her yanıtın süresini ölçer. Ölçülen programla aynı süreçte
// olmadığı için programın olay döngüsü kilitliyken de zamanlayıcısı işler — başka bir kullanıcının o sırada ne kadar beklediğini gösterir.
// Kullanım: node yoklayici.mjs <taban adres> <çerez> <yol> <sn>  → stdout'a JSON { n, p50, p95, enCok, durumlar }
const [base, cookie, yol, sn = "30"] = process.argv.slice(2);
const sureler = [];
const durumlar = {};
const bitis = Date.now() + Number(sn) * 1000;
while (Date.now() < bitis) {
  const t = performance.now();
  try {
    const r = await fetch(base + yol, { headers: { cookie } });
    await r.arrayBuffer();
    durumlar[r.status] = (durumlar[r.status] || 0) + 1;
  } catch (error) {
    durumlar[error.name] = (durumlar[error.name] || 0) + 1;
  }
  sureler.push(performance.now() - t);
  await new Promise(res => setTimeout(res, 200));
}
const s = sureler.slice().sort((a, b) => a - b);
const p = q => Math.round(s[Math.min(s.length - 1, Math.ceil((q / 100) * s.length) - 1)]);
process.stdout.write(JSON.stringify({ n: s.length, p50: p(50), p95: p(95), enCok: Math.round(s.at(-1)), durumlar }));
