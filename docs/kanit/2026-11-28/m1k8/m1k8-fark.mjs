// m1k8 fark betiği: ön izleme / mahsup fişi / defter (190, 191, 391, 360) ve rapor sayıları — aynı üreteç, ROOT=<kod> ile yeni ↔ taban.
// ROOT=<kod> SEEDS=1-100 SET=ay|yil node fark.mjs > cikti.jsonl
import { program, monthEnd } from "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-m1k5/ortak.mjs";

const [a, b] = (process.env.SEEDS || "1-20").split("-").map(Number);
const SET = process.env.SET || "ay";
const shape = SET === "yil"
  ? { now: "2027-04-15T12:00:00+03:00", months: ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"], last: "2027-03", cur: "2027-04", to: "2027-04-15" }
  : { now: "2026-08-15T12:00:00+03:00", months: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"], last: "2026-07", cur: "2026-08", to: "2026-08-15" };
const all = [...shape.months, shape.last, shape.cur];

async function snap(h) {
  const out = { pre: {}, rep: {} };
  for (const m of all) {
    out.pre[m] = await h.preview(m);
    out.rep[m] = (await h.report({ from: `${m}-01`, to: monthEnd(m) })).three;
  }
  const r = await h.report({ from: `${all[0]}-01`, to: monthEnd(shape.cur) });
  out.range = [...r.three, r.h391 - r.h191];
  const tb = (await h.api.get(`/api/workspace/ledger?to=${shape.to}`)).data.trial.accounts;
  out.gl = Object.fromEntries(tb.filter(row => ["190", "191", "391", "360"].includes(row.code)).map(row => [row.code, Math.round(row.balance * 100)]));
  return out;
}

for (let seed = a; seed <= b; seed += 1) {
  const rng = (s => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648))(seed * 7727 + 3 + (SET === "yil" ? 991 : 0));
  const pick = list => list[Math.floor(rng() * list.length)];
  const h = await program(shape.now, `F${seed}`);
  const log = [];
  const buys = [];
  const sells = [];
  try {
    for (const m of shape.months) {
      const nb = Math.floor(rng() * 3);
      const ns = Math.floor(rng() * 4);
      for (let i = 0; i < ns; i += 1) sells.push([m, await h.sell(`${m}-${String(5 + i).padStart(2, "0")}`, 1000 * (1 + Math.floor(rng() * 10)))]);
      for (let i = 0; i < nb; i += 1) buys.push([m, await h.buy(`${m}-${String(10 + i).padStart(2, "0")}`, 500 * (1 + Math.floor(rng() * 10)))]);
    }
    const upto = Math.floor(rng() * 7);
    for (const m of shape.months.slice(0, upto)) {
      if (rng() < 0.12) continue;
      log.push(["fiş", m, await h.offset(m)]);
    }
    for (let i = 0, n = 1 + Math.floor(rng() * 4); i < n; i += 1) {
      const kind = pick(["addbuy", "cancelbuy", "cancelsell"]);
      if (kind === "addbuy") await h.buy(`${pick(shape.months)}-25`, 500 * (1 + Math.floor(rng() * 6)));
      else if (kind === "cancelbuy" && buys.length) await h.cancel(buys.splice(Math.floor(rng() * buys.length), 1)[0][1]);
      else if (kind === "cancelsell" && sells.length) await h.cancel(sells.splice(Math.floor(rng() * sells.length), 1)[0][1]);
    }
    if (rng() < 0.5) await h.sell(`${shape.last}-05`, 500);
    const s1 = await snap(h);
    // ikinci evre: geri al + sırayla mahsup (ön izlemenin yazdığı fişler), sonra alış İptal Et
    while (await h.reverseLatest()) {}
    for (const m of [...shape.months, shape.last]) log.push(["2fiş", m, await h.offset(m)]);
    if (buys.length) await h.cancel(buys.splice(Math.floor(rng() * buys.length), 1)[0][1]);
    const s2 = await snap(h);
    console.log(JSON.stringify({ seed, set: SET, log, s1, s2 }));
  } finally {
    h.close();
  }
}
