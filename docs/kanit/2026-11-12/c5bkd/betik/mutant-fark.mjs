// Ç5-B kapanış düzeltmesi madde 6 — EŞDEĞERLİK ARAMASI: bir mutantın (motorun değiştirilmiş kopyası) çıktısı asıl motordan farklı olan girdi var mı?
// Üretici test/tyk-kapanis-sigma-250.test.mjs'teki geriye tarihli üreticinin genişletilmişi: 1–3 Mevcut Borç kartı (biri satış kartı, öbürleri elle), kart tahsilatları her karta.
// Kullanım: node mutant-fark.mjs <asıl kök> <mutant kök> [tohum başı=7000] [tohum sayısı=40] [cari=250] [gösterilecek fark=2]
import path from "node:path";
import { pathToFileURL } from "node:url";
const [rootA, rootB, seed0 = "7000", seeds = "40", per = "250", show = "2"] = process.argv.slice(2);
const load = async root => (await import(pathToFileURL(path.join(root, "server", "lib", "obligation-queue.mjs")).href)).buildObligations;
const A = await load(rootA);
const B = await load(rootB);
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const dayOf = n => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
const generate = (r, seed, a) => {
  const lines = [];
  const invoices = [];
  const schedules = new Map();
  let n = 0;
  const at = () => `2026-12-01T${String(Math.floor(n / 60)).padStart(2, "0")}:${String((n += 1) % 60).padStart(2, "0")}:00.000Z`;
  const kurus = r() < 0.3;
  const amount = (min, max) => (kurus ? Math.round((min + r() * (max - min)) * 100) / 100 : 10 * Math.round((min + r() * (max - min)) / 10));
  const push = (id, origin, kind, date, debit, credit, extra = {}) => lines.push({ id: `${id}${seed}-${a}-${lines.length}`, origin, kind, date, at: at(), debit, credit, ...extra });
  const saleDay = 150 + Math.floor(r() * 120);
  const cards = [];
  const addCard = (planId, total, extra) => {
    lines.push({ id: `plan:${planId}`, origin: "plan", planId, kind: "plan", covers: true, coverTotal: total, coverGross: total, date: r() < 0.5 ? "2025-06-01" : dayOf(Math.floor(r() * 300)), at: at(), debit: 0, credit: 0, ...extra });
    const first = Math.round(total * 50) / 100;
    schedules.set(planId, [{ id: `${planId}-1`, seq: 1, dueDate: dayOf(saleDay + Math.floor(r() * 60) - 30), amount: first }, { id: `${planId}-2`, seq: 2, dueDate: dayOf(saleDay + Math.floor(r() * 90)), amount: Math.round((total - first) * 100) / 100 }]);
    cards.push({ planId, total });
  };
  const early = () => { if (r() < 0.5) push("B", "account", "debt", dayOf(Math.floor(r() * saleDay)), amount(50, 900), 0); if (r() < 0.4) push("P", "account", "in", dayOf(Math.floor(r() * saleDay)), 0, amount(50, 600)); if (r() < 0.3) push("Y", "account", "credit", dayOf(Math.floor(r() * saleDay)), 0, amount(50, 400)); };
  early();
  const sale = amount(300, 1500);
  push("S", "stock", "debt", dayOf(saleDay), sale, 0, { sourceId: `m-${seed}-${a}`, stockReason: "" });
  addCard(`C${seed}-${a}`, sale, { coverSale: r() < 0.5 ? `m-${seed}-${a}` : "" });
  if (r() < 0.6) { early(); addCard(`D${seed}-${a}`, amount(100, 900), {}); }
  if (r() < 0.25) { early(); addCard(`E${seed}-${a}`, amount(100, 600), {}); }
  const extras = 3 + Math.floor(r() * 7);
  for (let i = 0; i < extras; i += 1) {
    const p = r();
    const before = dayOf(Math.floor(r() * saleDay));
    const any = dayOf(Math.floor(r() * 320));
    const card = cards[Math.floor(r() * cards.length)];
    if (p < 0.22) push("Y", "account", "credit", before, 0, amount(50, 500));
    else if (p < 0.5) lines.push({ id: `plan-entry:E${seed}-${a}-${i}`, origin: "plan", planId: card.planId, kind: r() < 0.1 ? "plan-out" : "plan-in", itemId: "", date: r() < 0.7 ? before : any, at: at(), debit: 0, credit: 0, max: card.total });
    else if (p < 0.66) push("B", "account", "debt", any, amount(50, 800), 0);
    else if (p < 0.84) push("P", "account", "in", any, 0, amount(50, 800));
    else if (p < 0.9) push("O", "account", "out", any, amount(20, 300), 0);
    else {
      const id = `F${seed}-${a}-${i}`;
      const value = amount(100, 1200);
      const when = at();
      lines.push({ id: `l-${id}`, origin: "invoice", kind: "debt", sourceId: id, date: any, at: when, debit: value, credit: 0 });
      invoices.push({ id, kind: "sale", status: "issued", payable: value, dueDate: r() < 0.5 ? dayOf(Math.floor(r() * 330)) : "", planId: "", issuedAt: when });
    }
  }
  const paid = new Map();
  for (const line of lines) {
    const had = paid.get(line.planId) || 0;
    if (line.kind === "plan-in") {
      line.credit = amount(40, Math.max(60, line.max * 0.9));
      paid.set(line.planId, Math.round((had + line.credit) * 100) / 100);
    } else if (line.kind === "plan-out") {
      line.debit = Math.min(had, amount(10, 200));
      paid.set(line.planId, Math.round((had - line.debit) * 100) / 100);
    }
    delete line.max;
  }
  return { lines: lines.filter(line => line.debit > 0 || line.credit > 0 || line.kind === "plan"), invoices, schedules };
};
const digest = r => JSON.stringify({
  items: r.items.map(i => [i.key || i.lineId, i.side, i.remaining, i.amount, i.dueDate || i.date || ""]).sort(),
  inst: [...r.installments].map(([k, m]) => [k, [...m].map(([id, row]) => [id, row.remaining, row.amount, row.collected])]),
  cov: [...r.coverage].map(([k, v]) => [k, v.rule, v.consumed, v.advance, v.trimmed]),
  entries: [...r.entries].map(([k, v]) => [k, v.remaining]).sort(),
  invoices: [...(r.invoices instanceof Map ? r.invoices : new Map(Object.entries(r.invoices || {})))].map(([k, v]) => [k, v.open, v.state]).sort(),
  passes: r.prepaidPasses,
});
let total = 0, differ = 0, multi = 0;
const shown = [];
for (let seed = Number(seed0); seed < Number(seed0) + Number(seeds); seed += 1) {
  const r = rng(seed);
  for (let a = 0; a < Number(per); a += 1) {
    const input = generate(r, seed, a);
    const args = () => ({ lines: input.lines.map(l => ({ ...l })), invoices: input.invoices.map(i => ({ ...i })), schedules: new Map([...input.schedules].map(([k, v]) => [k, v.map(x => ({ ...x }))])), today: dayOf(320) });
    const da = digest(A(args()));
    const db = digest(B(args()));
    total += 1;
    if (input.schedules.size > 1) multi += 1;
    if (da !== db) {
      differ += 1;
      if (shown.length < Number(show)) shown.push({ seed, a, lines: input.lines.length, cards: input.schedules.size, input: { lines: input.lines, invoices: input.invoices, schedules: [...input.schedules] }, asil: JSON.parse(da), mutant: JSON.parse(db) });
    }
  }
}
console.log(JSON.stringify({ cari: total, cokKartli: multi, FARKLI: differ }));
for (const s of shown.sort((x, y) => x.lines - y.lines)) console.log(JSON.stringify(s));
