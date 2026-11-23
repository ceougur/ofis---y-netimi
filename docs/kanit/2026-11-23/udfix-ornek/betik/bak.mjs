// Küçük girdinin kuyruk sonucunu ayrıntılı yazar (satırları süzerek: --at satırId,... ; --plan-only planId'ler dışındaki plan-in satırlarını atar).
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const q = await import(pathToFileURL(path.join(ROOT, "server/lib/obligation-queue.mjs")).href);
const dec = v => {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === "object") {
    if (v.__map) return new Map(v.__map.map(([a, b]) => [a, dec(b)]));
    if (v.__set) return new Set(v.__set.map(dec));
    if (v.__lock) return q.lockAtOf(v.__lock);
    if (v.__fn) return undefined;
    return Object.fromEntries(Object.entries(v).map(([a, b]) => [a, dec(b)]));
  }
  return v;
};
const raw = JSON.parse(readFileSync(process.argv[2], "utf8"));
const input = dec(raw.input);
const drop = new Set((process.argv[3] || "").split(",").filter(Boolean));
input.lines = input.lines.filter(l => !drop.has(l.id));
const r = q.buildObligations(input);
const sig = r.items.reduce((s, i) => s + (i.side === "receivable" ? 1 : -1) * Math.round(i.remaining * 100), 0);
const bal = Math.round(input.lines.reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0) * 100);
console.log(`Σ kalem ${sig} · Σ satır ${bal} · fark ${sig - bal} · geçiş ${JSON.stringify(r.prepaidPasses)}`);
for (const l of input.lines) console.log(`  satır ${l.id.slice(0, 40)} ${l.origin}/${l.kind} ${l.date} ${l.at} B ${l.debit} A ${l.credit} plan ${l.planId || ""} ${l.covers ? "kapsam " + l.coverTotal : ""}`);
for (const i of r.items) console.log(`  kalem ${i.key} ${i.kind} ${i.side} tutar ${i.amount} kalan ${i.remaining} vade ${i.vade}`);
for (const [k, v] of r.installments) console.log(`  kart ${k}: ${JSON.stringify([...v])}`);
for (const [k, v] of r.invoices) console.log(`  fatura ${k}: ödenecek ${v.payable} ödenen ${v.paid} açık ${v.open} kapsanan ${v.covered}`);
const sch = input.schedules;
for (const l of input.lines) if (l.kind === "plan") console.log(`  takvim ${l.planId}: ${JSON.stringify(sch.get(l.planId))}`);
