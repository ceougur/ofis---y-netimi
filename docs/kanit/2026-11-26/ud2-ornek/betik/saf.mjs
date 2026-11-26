// Dökülen kuyruk girdisini (surucu3.mjs GIRDI_YAZ) saf kuyrukta koşar. Kullanım: ROOT=<kod> node saf.mjs <girdi.json>
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const q = await import(pathToFileURL(path.join(process.env.ROOT, "server/lib/obligation-queue.mjs")).href);
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
const input = dec(JSON.parse(readFileSync(process.argv[2], "utf8")).input);
if (process.env.KILIT) input.lockAt = q.lockAtOf(JSON.parse(process.env.KILIT));
const r = q.buildObligations(input);
const sig = r.items.reduce((s, i) => s + (i.side === "receivable" ? 1 : -1) * Math.round(i.remaining * 100), 0) / 100;
const bal = Math.round(input.lines.reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0) * 100) / 100;
console.log("Σ kalem", sig, "bakiye", bal, "kalemler", JSON.stringify(r.items.map(i => [i.key.slice(0, 40), i.remaining])), "kilit izi", JSON.stringify(input.lockAt?.history || null));
