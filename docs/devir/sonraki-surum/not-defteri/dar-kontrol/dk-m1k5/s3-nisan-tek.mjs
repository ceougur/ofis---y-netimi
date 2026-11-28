// S3: kararın örneğinde Nisan TEK AY seçimi — ekranda Ödenecek 700 ile 391 500 / 191 0 arasındaki farkı açıklayan bir not var mı?
// Karşılaştırma: S-DKM1-1'in kendi örneği (önceki karar; 'güncel değil' ay YOK) — Mart'ın azalması Nisan'da: Nisan tek ay notları.
import { program, monthEnd } from "./ortak.mjs";

const show = async (h, title, m) => {
  const r = await h.report({ from: `${m}-01`, to: monthEnd(m) });
  console.log(`--- ${title}: ${m} tek ay ${r.three.map(x => x / 100).join("/")} · 391 ${r.h391 / 100} · 191 ${r.h191 / 100}`);
  for (const [k, v] of Object.entries(r.summary)) if (!/^(Hesaplanan|İndirilecek|Alıcı|Önceki|Ödenecek|Sonraki)/.test(k)) console.log(`   [${k}] ${v}`);
  const rows = r.data.rows.filter(x => !["Satış", "Alış", "Satıştan İade", "Alıştan İade", "Serbest Meslek Makbuzu"].includes(x[1]));
  if (rows.length) console.log(`   sonuç satırları ${JSON.stringify(rows.map(x => [x[0], x[1], x[5]]))}`);
};
{
  const h = await program("2026-06-15T12:00:00+03:00", "S3a");
  await h.buy("2026-01-10", 5000);
  await h.offset("2026-01");
  await h.sell("2026-02-10", 10000);
  await h.buy("2026-02-11", 2500);
  await h.offset("2026-02");
  await h.sell("2026-03-10", 5000);
  const mar = await h.buy("2026-03-11", 1000);
  await h.buy("2026-03-12", 500);
  await h.offset("2026-03");
  await h.sell("2026-04-10", 2500);
  await h.buy("2026-02-20", 1500);
  await h.cancel(mar);
  await show(h, "kararın örneği (S-DKM1K-1), Nisan fişsiz", "2026-04");
  console.log("   Nisan ön izlemesi", JSON.stringify(await h.preview("2026-04")));
  await h.close();
}
{
  // 'güncel değil' ay olmadan: Mart'ın azalması Nisan'da — Nisan ön izlemesi de 700 olmalı (S-DKM1-1 = A), rapor = ön izleme.
  const h = await program("2026-06-15T12:00:00+03:00", "S3b");
  await h.buy("2026-01-10", 5000);
  await h.offset("2026-01");
  await h.sell("2026-02-10", 10000);
  await h.buy("2026-02-11", 2500);
  await h.offset("2026-02");
  await h.sell("2026-03-10", 5000);
  const mar = await h.buy("2026-03-11", 1000);
  await h.buy("2026-03-12", 500);
  await h.offset("2026-03");
  await h.sell("2026-04-10", 2500);
  await h.cancel(mar);
  await show(h, "karşılaştırma (yalnız Mart azalması), Nisan fişsiz", "2026-04");
  console.log("   Nisan ön izlemesi", JSON.stringify(await h.preview("2026-04")));
  await h.close();
}
