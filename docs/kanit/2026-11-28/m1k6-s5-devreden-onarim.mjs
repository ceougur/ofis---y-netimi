// m1k6: devreden farkı kolu — önceki 'güncel değil' (devreden yönde, İ artmış) Şubat'tan sonra Mart fişi eski devredenle kesilmiş. Notun önerdiği onarım
// ("bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin" = yalnız Mart geri al + yeniden) sonuç veriyor mu? ROOT=<kod> node s5-devreden-onarim.mjs
import { program, monthEnd } from "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-m1k5/ortak.mjs";

const NOTES = ["Mahsuptan Sonra Değişen Ay", "Zincirle Uyuşmayan Mahsup Fişi", "Güncel Olmayan Önceki Fiş"];
const dump = async (h, title) => {
  const r = await h.report({ from: "2026-01-01", to: "2026-05-31" });
  console.log(`--- ${title}: Ocak–Mayıs ${r.three.map(x => x / 100).join("/")} · 391−191 ${(r.h391 - r.h191) / 100}`);
  for (const k of NOTES) if (r.summary[k]) console.log(`  [${k}] ${r.summary[k]}`);
  console.log(`  fişler ${(await h.offsets()).filter(o => o.status === "active").map(o => `${o.month.slice(5)}:${o.carryInMinor / 100}/${o.payableMinor / 100}/${o.carryOutMinor / 100}${o.stale ? "(güncel değil)" : ""}`).join(" ")}`);
};
const h = await program("2026-07-15T12:00:00+03:00", "S5");
await h.buy("2026-01-10", 5000);
console.log("Ocak", await h.offset("2026-01"));
await h.sell("2026-02-10", 5000);
await h.buy("2026-02-11", 2500);
console.log("Şubat", await h.offset("2026-02"));
await h.sell("2026-03-10", 10000);
await h.buy("2026-03-11", 1000);
console.log("Mart", await h.offset("2026-03"));
await h.sell("2026-04-10", 5000);
const apr = await h.buy("2026-04-11", 1000);
await h.buy("2026-04-12", 500);
console.log("Nisan", await h.offset("2026-04"));
await h.sell("2026-05-10", 2500);
await h.buy("2026-02-20", 1500);
await h.cancel(apr);
await dump(h, "D0 değişiklikten sonra");
for (const m of ["2026-04", "2026-03"]) console.log(`  ${m} geri al:`, await h.reverse(m));
for (const m of ["2026-03", "2026-04"]) console.log(`  ${m} yeniden`, await h.offset(m));
await dump(h, "D1 notun önerdiği onarım (Mart ve sonrası geri al + sırayla)");
for (const m of ["2026-04", "2026-03", "2026-02"]) console.log(`  ${m} geri al:`, await h.reverse(m));
for (const m of ["2026-02", "2026-03", "2026-04"]) console.log(`  ${m} yeniden`, await h.offset(m));
await dump(h, "D2 Şubat'tan başlayarak geri al + sırayla");
await h.close();
