// Tohum 3'ün en küçük örneği (gerçek programın 8 satırı, kimlikler kısaltıldı). ROOT=<kod> node ornek3.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";
const q = await import(pathToFileURL(path.join(process.env.ROOT, "server/lib/obligation-queue.mjs")).href);
const at = m => `2026-11-23T06:${m}.000Z`;
const lines = [
  { id: "F1", origin: "invoice", kind: "debt", date: "2026-08-16", at: at("01:51.144"), sourceId: "F1", debit: 5944.84, credit: 0 },
  { id: "plan:C1", origin: "plan", kind: "plan", planId: "C1", covers: true, coverTotal: 5944.84, coverGross: 5944.84, date: "2026-08-16", at: at("01:51.144"), debit: 0, credit: 0 },
  { id: "A", origin: "account", kind: "credit", date: "2026-08-24", at: at("02:58.402"), debit: 0, credit: Number(process.env.ALACAK || 32083.69) },
  { id: "F2", origin: "invoice", kind: "debt", date: "2026-09-02", at: at("04:41.730"), sourceId: "F2", debit: 250811.27, credit: 0 },
  { id: "S", origin: "stock", kind: "debt", date: "2026-09-21", at: at("09:53.822"), sourceId: "m-S", stockReason: "", debit: 393.67, credit: 0 },
  { id: "plan-entry:P1", origin: "plan", kind: "plan-in", planId: "C1", itemId: "", date: "2026-09-21", at: at("10:03.942"), debit: 0, credit: 4817.64 },
  { id: "plan:C2", origin: "plan", kind: "plan", planId: "C2", covers: true, coverTotal: 207.05, coverGross: 207.05, date: "2026-09-21", at: at("10:05.981"), debit: 0, credit: 0 },
  { id: "plan-entry:P2", origin: "plan", kind: "plan-in", planId: "C2", itemId: "", date: "2026-09-25", at: at("11:09.574"), debit: 0, credit: 8528.77 },
].filter(l => !(process.env.AT || "").split(",").includes(l.id));
const sched1 = ["2026-09-02", "2026-10-02", "2026-11-02", "2026-12-02", "2027-01-02", "2027-02-02"].map((d, i) => ({ id: `C1-${i + 1}`, seq: i + 1, dueDate: d, amount: i === 5 ? 990.84 : 990.8 }));
const invoices = [
  { id: "F1", kind: "sale", status: "issued", payable: 5944.84, dueDate: "2027-02-02", planId: "C1", issuedAt: at("01:51.143"), planTotal: 5944.84, schedule: sched1.map(s => ({ dueDate: s.dueDate, amount: s.amount })) },
  { id: "F2", kind: "sale", status: "issued", payable: 250811.27, dueDate: "2026-09-29", planId: "", issuedAt: at("04:41.729") },
];
const schedules = new Map([["C1", sched1], ["C2", [{ id: "C2-1", seq: 1, dueDate: "2026-10-12", amount: 207.05 }]]]);
// Dönem kilidi izi: 06:05:32'de kilit 30.08 (Alacak 24.08 kilitli döneme düşer), 06:11:50'de kaldırıldı. KILITSIZ=1 → kilit izi yok.
const lockAt = process.env.KILITSIZ ? undefined : q.lockAtOf([{ at: at("05:32.969"), value: "2026-08-30" }, { at: at("11:50.490"), value: "" }]);
const r = q.buildObligations({ lines, invoices, schedules, today: "2026-11-23", ...(lockAt ? { lockAt } : {}) });
const sig = Math.round(r.items.reduce((s, i) => s + (i.side === "receivable" ? i.remaining : -i.remaining), 0) * 100);
const bal = Math.round(lines.reduce((s, l) => s + l.debit - l.credit, 0) * 100);
console.log(`Σ kalem ${sig / 100} · bakiye ${bal / 100} · fark ${(sig - bal) / 100} · geçiş ${JSON.stringify(r.prepaidPasses)}`);
for (const i of r.items) console.log(`  kalem ${i.key} ${i.side} tutar ${i.amount} kalan ${i.remaining}`);
for (const [k, v] of r.installments) console.log(`  kart ${k}: ${[...v.values()].map(x => `${x.amount}/${x.remaining}`).join(" ")}`);
