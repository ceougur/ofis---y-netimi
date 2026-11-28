// S1: kararın örneği AYNEN + onarım yolları + "Nisan fişi değişiklikten ÖNCE kesilmiş" çeşidi. ROOT=<kod> node s1-ornek.mjs
import { program, monthEnd } from "./ortak.mjs";

const NOTES = ["KDV Mahsup Fişi", "Mahsuptan Sonra Değişen Ay", "Zincirle Uyuşmayan Mahsup Fişi", "Mahsup Edilmemiş Ay"];
async function dump(h, title, months) {
  const range = await h.report({ from: `${months[0]}-01`, to: monthEnd(months.at(-1)) });
  const each = [];
  for (const m of months) each.push(`${m.slice(5)} ${(await h.report({ from: `${m}-01`, to: monthEnd(m) })).three.map(x => x / 100).join("/")}`);
  const fark = range.three[1] - range.three[2] + range.three[0] - (range.h391 - range.h191);
  console.log(`--- ${title}`);
  console.log(`  aralık ${range.three.map(x => x / 100).join("/")}  391−191 ${(range.h391 - range.h191) / 100}  SAPMA ${fark / 100}`);
  console.log(`  aylar  ${each.join(" | ")}`);
  for (const k of NOTES) if (range.summary[k]) console.log(`  [${k}] ${range.summary[k]}`);
  const act = (await h.offsets()).filter(o => o.status === "active").map(o => `${o.month.slice(5)}:${o.carryInMinor / 100}/${o.payableMinor / 100}/${o.carryOutMinor / 100}${o.stale ? "(güncel değil)" : ""}`);
  console.log(`  fişler ${act.join(" ")}`);
  return fark;
}

async function base(nisanOnce) {
  const h = await program("2026-06-15T12:00:00+03:00", "S1");
  await h.buy("2026-01-10", 5000);
  console.log("Ocak fişi", JSON.stringify(await h.offset("2026-01")));
  await h.sell("2026-02-10", 10000);
  await h.buy("2026-02-11", 2500);
  console.log("Şubat fişi", JSON.stringify(await h.offset("2026-02")));
  await h.sell("2026-03-10", 5000);
  const mar = await h.buy("2026-03-11", 1000);
  await h.buy("2026-03-12", 500);
  console.log("Mart fişi", JSON.stringify(await h.offset("2026-03")));
  await h.sell("2026-04-10", 2500);
  if (nisanOnce) console.log("Nisan fişi (değişiklikten ÖNCE)", JSON.stringify(await h.offset("2026-04")));
  await h.buy("2026-02-20", 1500);
  await h.cancel(mar);
  return h;
}

const M4 = ["2026-01", "2026-02", "2026-03", "2026-04"];
const M5 = [...M4, "2026-05"];
{
  console.log("===== A: kararın örneği (Nisan fişsiz)");
  const h = await base(false);
  await dump(h, "A0 değişiklikten sonra", M4);
  console.log("  Nisan ön izlemesi", JSON.stringify(await h.preview("2026-04")));
  console.log("  Nisan fişi (ön izlemeyle)", JSON.stringify(await h.offset("2026-04")));
  await dump(h, "A1 Nisan ön izlemeyle mahsup edildi", M4);
  // Uyuşmazlık notunun önerdiği onarım: "bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin" → Nisan geri al, yeniden kes.
  console.log("  Nisan geri al:", await h.reverse("2026-04"));
  console.log("  Nisan ön izlemesi (yeniden)", JSON.stringify(await h.preview("2026-04")));
  console.log("  Nisan fişi (yeniden)", JSON.stringify(await h.offset("2026-04")));
  await dump(h, "A2 notun önerdiği onarımdan sonra (yalnız Nisan geri al + yeniden)", M4);
  // Şubat'ın 'güncel değil' notunun onarımı: Şubat'ı geri al (önce sonrakiler), sırayla yeniden.
  for (const m of ["2026-04", "2026-03", "2026-02"]) console.log(`  ${m} geri al:`, await h.reverse(m));
  for (const m of ["2026-02", "2026-03", "2026-04"]) console.log(`  ${m} yeniden fiş`, JSON.stringify(await h.offset(m)));
  await dump(h, "A3 Şubat'tan başlayarak geri al + sırayla mahsup", M4);
  await h.close();
}
{
  console.log("===== B: Nisan fişi değişiklikten ÖNCE sırayla kesilmiş (Mayıs fişsiz satış 500)");
  const h = await base(true);
  await h.sell("2026-05-10", 2500);
  await dump(h, "B0 değişiklikten sonra", M5);
  console.log("  Mayıs ön izlemesi", JSON.stringify(await h.preview("2026-05")));
  // Uyuşmazlık notunun önerdiği onarım: Nisan geri al + yeniden.
  console.log("  Nisan geri al:", await h.reverse("2026-04"));
  console.log("  Nisan ön izlemesi", JSON.stringify(await h.preview("2026-04")));
  console.log("  Nisan fişi (yeniden)", JSON.stringify(await h.offset("2026-04")));
  await dump(h, "B1 yalnız Nisan geri al + yeniden", M5);
  for (const m of ["2026-04", "2026-03", "2026-02"]) console.log(`  ${m} geri al:`, await h.reverse(m));
  for (const m of ["2026-02", "2026-03", "2026-04"]) console.log(`  ${m} yeniden fiş`, JSON.stringify(await h.offset(m)));
  await dump(h, "B2 Şubat'tan başlayarak geri al + sırayla", M5);
  await h.close();
}
