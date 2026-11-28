// S2: GENİŞ rastgele üreteç — mahsup / geri al / değişiklik İÇ İÇE (fişten sonra değişiklik, sonra yeni fiş, geri al + yeniden kes), satış EKLE dahil
// (391 artışı), ardışık 'güncel değil' aylar, ara sıra atlanan ay. Her tohumun sonucu JSON satırı (yeni / eski karşılaştırması ayrı betikte).
// ROOT=<kod> SEEDS=1-200 SET=yil|ay node s2-karisik.mjs > cikti.jsonl
import { program, monthEnd } from "./ortak.mjs";

const [a, b] = (process.env.SEEDS || "1-50").split("-").map(Number);
const SET = process.env.SET || "ay";
const shape = SET === "yil"
  ? { now: "2027-04-15T12:00:00+03:00", months: ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"], last: "2027-03" }
  : { now: "2026-08-15T12:00:00+03:00", months: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"], last: "2026-07" };
const NOTES = ["Mahsuptan Sonra Değişen Ay", "Zincirle Uyuşmayan Mahsup Fişi", "Mahsup Edilmemiş Ay"];
const next = m => {
  const [y, mm] = m.split("-").map(Number);
  return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`;
};

for (let seed = a; seed <= b; seed += 1) {
  const rng = (s => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648))(seed * 104729 + 31);
  const pick = list => list[Math.floor(rng() * list.length)];
  const { months, last, now } = shape;
  const h = await program(now, `K${seed}`);
  const log = [];
  const buys = [];
  const sells = [];
  let day = 0;
  let lastSale = "";
  const d = m => `${m}-${String(1 + ((day += 1) % 27)).padStart(2, "0")}`;
  try {
    for (const m of months) {
      const ns = Math.floor(rng() * 3);
      const nb = Math.floor(rng() * 3);
      for (let i = 0; i < ns; i += 1) {
        lastSale = `${m}-${String(3 + i).padStart(2, "0")}`;
        sells.push([m, await h.sell(lastSale, 1000 * (1 + Math.floor(rng() * 8)))]);
      }
      for (let i = 0; i < nb; i += 1) buys.push([m, await h.buy(d(m), 500 * (1 + Math.floor(rng() * 10)))]);
    }
    const ops = 6 + Math.floor(rng() * 12);
    let stale = false;
    for (let i = 0; i < ops; i += 1) {
      const kind = pick(["fis", "fis", "fis", "geri", "addbuy", "addbuy", "addsell", "cancelbuy", "cancelsell"]);
      if (kind === "fis") {
        const act = (await h.offsets()).filter(o => o.status === "active").map(o => o.month).sort();
        let m = act.length ? next(act.at(-1)) : months[0];
        if (rng() < 0.12) m = next(m);
        if (!months.includes(m)) continue;
        log.push(`fiş ${m.slice(2)} ${JSON.stringify(await h.offset(m))}`);
      } else if (kind === "geri") {
        const m = await h.reverseLatest();
        if (m) log.push(`geri ${m.slice(2)}`);
      } else if (kind === "addbuy") {
        const m = pick(months);
        buys.push([m, await h.buy(d(m), 500 * (1 + Math.floor(rng() * 6)))]);
        log.push(`+alış ${m.slice(2)}`);
      } else if (kind === "addsell") {
        // satış serisi tarih sırasında (chronology): son satıştan eski olamaz → son satışın ayı ya da sonrası.
        const m = pick(months.filter(x => !lastSale || x >= lastSale.slice(0, 7)));
        const day2 = m === lastSale.slice(0, 7) ? Math.min(28, Number(lastSale.slice(8)) + 1) : 3;
        lastSale = `${m}-${String(day2).padStart(2, "0")}`;
        sells.push([m, await h.sell(lastSale, 500 * (1 + Math.floor(rng() * 6)))]);
        log.push(`+satış ${m.slice(2)}`);
      } else if (kind === "cancelbuy" && buys.length) {
        const [m, id] = buys.splice(Math.floor(rng() * buys.length), 1)[0];
        await h.cancel(id);
        log.push(`−alış ${m.slice(2)}`);
      } else if (kind === "cancelsell" && sells.length) {
        const [m, id] = sells.splice(Math.floor(rng() * sells.length), 1)[0];
        await h.cancel(id);
        log.push(`−satış ${m.slice(2)}`);
      }
    }
    await h.sell(`${last}-05`, 500);
    const all = [...months, last];
    const range = await h.report({ from: `${all[0]}-01`, to: monthEnd(last) });
    const each = [];
    for (const m of all) each.push((await h.report({ from: `${m}-01`, to: monthEnd(m) })).three);
    // yıl / takvim parçaları: iki parçaya bölünmüş aralık (ilk 3 ay + kalan) — süreklilik ve toplam.
    const p1 = await h.report({ from: `${all[0]}-01`, to: monthEnd(all[2]) });
    const p2 = await h.report({ from: `${all[3]}-01`, to: monthEnd(last) });
    const offs = (await h.offsets()).filter(o => o.status === "active").map(o => ({ m: o.month, ci: o.carryInMinor, p: o.payableMinor, co: o.carryOutMinor, in: o.inMinor, out: o.outMinor, stale: o.stale, nowIn: o.nowInMinor, nowOut: o.nowOutMinor }));
    const notes = Object.fromEntries(NOTES.filter(k => range.summary[k]).map(k => [k, range.summary[k]]));
    const broken = [];
    const bal = range.three[1] - range.three[2] + range.three[0];
    if (bal !== range.h391 - range.h191) broken.push(`denge ${bal} ≠ 391−191 ${range.h391 - range.h191} (fark ${bal - (range.h391 - range.h191)})`);
    const sum = each.reduce((t, r) => t + r[1], 0);
    if (sum !== range.three[1]) broken.push(`ay toplamı ${sum} ≠ ${range.three[1]}`);
    for (let i = 1; i < each.length; i += 1) if (each[i - 1][2] !== each[i][0]) broken.push(`${all[i - 1]}→${all[i]} süreklilik ${each[i - 1][2]}≠${each[i][0]}`);
    if (p1.three[1] + p2.three[1] !== range.three[1]) broken.push(`parça toplamı ${p1.three[1]}+${p2.three[1]} ≠ ${range.three[1]}`);
    if (p1.three[2] !== p2.three[0]) broken.push(`parça süreklilik ${p1.three[2]}≠${p2.three[0]}`);
    console.log(JSON.stringify({ seed, set: SET, range: range.three, net: range.h391 - range.h191, each, offs, notes, broken, log }));
  } catch (error) {
    console.log(JSON.stringify({ seed, set: SET, error: String(error?.stack || error).slice(0, 500), log }));
  } finally {
    await h.close();
  }
}
