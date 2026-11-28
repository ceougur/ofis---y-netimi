// S2: rastgele sıra — Ocak–Haziran rastgele alış / satış, rastgele önek mahsup (ara sıra ay atlanarak), sonra fişten SONRA rastgele değişiklik (alış ekle = İ artışı,
// alış İptal Et = İ azalması, satış İptal Et = 391 azalması), Temmuz'da her zaman mahsupsuz satış (azalmanın düşüleceği sonraki ay). Değişmez (S-M1K3-1 = A metni "aralık
// toplamı her durumda 391 − 191"; S-DKM1-1 = A "azalma sonraki ayda"): Ocak–Temmuz Ödenecek − Sonraki + Önceki = 391 − 191. Kullanım: ROOT=… node s2-rastgele.mjs <ilk tohum> <adet>
import { program } from "./ortak.mjs";
const first = Number(process.argv[2] || 1);
const count = Number(process.argv[3] || 10);
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const months = ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"];
let bad = 0;
for (let seed = first; seed < first + count; seed += 1) {
  const r = rng(seed * 7919 + 17);
  const pick = list => list[Math.floor(r() * list.length)];
  const h = await program("2027-04-15T12:00:00+03:00", `R${seed}`);
  const log = [];
  try {
    const buys = [];
    const sells = [];
    for (const m of months) {
      const nb = Math.floor(r() * 3);
      const ns = Math.floor(r() * 4);
      for (let i = 0; i < ns; i += 1) sells.push([m, await h.sell(`${m}-${String(5 + i).padStart(2, "0")}`, 1000 * (1 + Math.floor(r() * 10)))]);
      for (let i = 0; i < nb; i += 1) buys.push([m, await h.buy(`${m}-${String(10 + i).padStart(2, "0")}`, 500 * (1 + Math.floor(r() * 10)))]);
    }
    const upto = Math.floor(r() * 7);
    for (const m of months.slice(0, upto)) {
      if (r() < 0.12) { log.push(`atla ${m}`); continue; }
      const o = await h.offset(m);
      log.push(`fiş ${m} ${Array.isArray(o) ? JSON.stringify(o) : "RED"}`);
    }
    const changes = 1 + Math.floor(r() * 4);
    for (let i = 0; i < changes; i += 1) {
      const kind = pick(["addbuy", "cancelbuy", "cancelsell"]);
      if (kind === "addbuy") {
        const m = pick(months);
        await h.buy(`${m}-25`, 500 * (1 + Math.floor(r() * 6)));
        log.push(`alış ekle ${m}`);
      } else if (kind === "cancelbuy" && buys.length) {
        const [m, id] = buys.splice(Math.floor(r() * buys.length), 1)[0];
        await h.cancel(id);
        log.push(`alış iptal ${m}`);
      } else if (kind === "cancelsell" && sells.length) {
        const [m, id] = sells.splice(Math.floor(r() * sells.length), 1)[0];
        await h.cancel(id);
        log.push(`satış iptal ${m}`);
      }
    }
    await h.sell("2027-03-05", 500);
    const rep = await h.report({ from: "2026-09-01", to: "2027-03-31" });
    const bal = rep.three[1] - rep.three[2] + rep.three[0];
    const want = rep.h391 - rep.h191;
    // Ay ay: her ayın satırları toplamı aralıkla aynı mı (Ödenecek toplamı)
    let monthSum = 0;
    for (const m of [...months, "2027-03"]) {
      const [y, mm] = m.split("-").map(Number);
      const one = await h.report({ from: `${m}-01`, to: new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10) });
      monthSum += one.three[1];
    }
    const ok = bal === want && monthSum === rep.three[1];
    if (!ok) bad += 1;
    console.log(`tohum ${seed}: ${ok ? "TAMAM" : "SAPMA"} aralık ${rep.three.join("/")} · 391−191 ${want} · fark ${bal - want} · ay toplamı Ödenecek ${monthSum} vs ${rep.three[1]} | ${log.join("; ")}`);
    if (!ok) for (const [k, v] of Object.entries(rep.notes)) console.log(`   not [${k}] ${v}`);
  } finally {
    await h.ctx.server.close();
  }
}
console.log(`SONUÇ: ${count} tohum, ${bad} sapma`);
