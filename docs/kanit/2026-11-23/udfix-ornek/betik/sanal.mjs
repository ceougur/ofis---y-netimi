// Dökülen kuyruk girdisini (girdi.mjs) saf kuyrukta koşar; Σ kalem ↔ Σ satır. --kucult: satırlar üzerinde ddmin (fark sürdükçe satır atar).
// Kullanım: ROOT=<kod> node sanal.mjs <girdi.json> [--kucult] [--yaz <çıktı.json>]
import { readFileSync, writeFileSync } from "node:fs";
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
const file = process.argv[2];
const raw = JSON.parse(readFileSync(file, "utf8"));
const base = dec(raw.input);
const sig = r => r.items.reduce((s, i) => s + (i.side === "receivable" ? 1 : -1) * Math.round(i.remaining * 100), 0);
const bal = lines => Math.round(lines.reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0) * 100);
// Gerçekçi alt küme: fatura listesi yalnız satırı kalan faturalar; plan kartı ve onun hareketleri BİRLİKTE atılır (grup).
const run = lines => {
  const ids = new Set(lines.filter(l => l.origin === "invoice").map(l => l.sourceId));
  const plans = new Set(lines.filter(l => l.kind === "plan").map(l => l.planId));
  if (lines.some(l => l.origin === "plan" && l.kind !== "plan" && !plans.has(l.planId))) throw new Error("öksüz kart hareketi");
  const input = { ...base, lines, invoices: (base.invoices || []).filter(i => ids.has(i.id)) };
  const r = q.buildObligations(input);
  return { sig: sig(r), bal: bal(lines), r };
};
const fails = lines => {
  try {
    const x = run(lines);
    if (process.env.FATURA) {
      // FATURA=<fatura kimliği>:<kartın kendi kalanı> — faturanın açığı kartın kendi kalanını aşıyor mu (motorun üst sınırı)
      const [id, limit] = process.env.FATURA.split(":");
      if (!lines.some(l => l.sourceId === id)) return false;
      const own = lines.filter(l => l.planId === process.env.KART && l.kind === "plan-in").reduce((s, l) => s + l.credit, 0);
      if (Math.abs(own - Number(process.env.KARTODEME || own)) > 0.001) return false;
      return (x.r.invoices.get(id)?.open ?? 0) - Number(limit) > 0.01;
    }
    return process.env.FARK ? x.sig - x.bal === Number(process.env.FARK) : x.sig !== x.bal;
  } catch {
    return false;
  }
};
let lines = base.lines;
const groupOf = l => (l.origin === "plan" && l.planId ? `plan:${l.planId}` : l.id);
const first = run(lines);
console.log(`satır ${lines.length}; Σ kalem ${first.sig} · Σ satır ${first.bal} · fark ${first.sig - first.bal} · geçiş ${JSON.stringify(first.r.prepaidPasses)}`);
if (process.argv.includes("--kucult") && (process.env.FATURA || first.sig !== first.bal)) {
  let n = 2;
  while (true) {
    const groups = [...new Set(lines.map(groupOf))];
    if (groups.length < 2) break;
    const size = Math.ceil(groups.length / n);
    let reduced = false;
    for (let i = 0; i < n; i++) {
      const gone = new Set(groups.slice(i * size, (i + 1) * size));
      const rest = lines.filter(l => !gone.has(groupOf(l)));
      if (rest.length && fails(rest)) {
        lines = rest;
        n = Math.max(n - 1, 2);
        reduced = true;
        break;
      }
    }
    if (!reduced) {
      if (n >= groups.length) break;
      n = Math.min(groups.length, n * 2);
    }
  }
  const x = run(lines);
  console.log(`KÜÇÜLTÜLDÜ: ${lines.length} satır; Σ kalem ${x.sig} · Σ satır ${x.bal} · fark ${x.sig - x.bal} · geçiş ${JSON.stringify(x.r.prepaidPasses)}`);
  for (const l of lines) console.log(JSON.stringify(l));
  const yaz = process.argv.indexOf("--yaz");
  if (yaz > 0) writeFileSync(process.argv[yaz + 1], JSON.stringify({ ...raw, input: { ...raw.input, lines } }));
  console.log("KALEMLER:");
  for (const i of x.r.items) console.log(`  ${i.key} ${i.kind} ${i.side} tutar ${i.amount} kalan ${i.remaining} vade ${i.vade}`);
}
