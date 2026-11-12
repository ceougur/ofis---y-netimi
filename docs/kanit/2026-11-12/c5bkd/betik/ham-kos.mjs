// Saf kuyruk girdisini (dar kontrolün ham / küçük dosyaları) verilen kodla koşar: bakiye, Σ kalem, gecikmiş, geçiş sayısı. Kullanım: ROOT=<kod> node ham-kos.mjs <dosya...>
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const { buildObligations } = await import(pathToFileURL(path.join(process.env.ROOT, "server/lib/obligation-queue.mjs")).href);
for (const file of process.argv.slice(2)) {
  const input = JSON.parse(readFileSync(file, "utf8"));
  const t0 = performance.now();
  const res = buildObligations({ lines: input.lines, invoices: input.invoices, links: new Map(input.links), schedules: new Map(input.schedules), today: "2026-11-17" });
  const ms = performance.now() - t0;
  const bal = Math.round(input.lines.reduce((s, l) => s + l.debit - l.credit, 0) * 100) / 100;
  const sum = Math.round(res.items.reduce((s, i) => s + (i.side === "receivable" ? i.remaining : -i.remaining), 0) * 100) / 100;
  console.log(path.basename(file), "satır", input.lines.length, "bakiye", bal, "Σ", sum, sum === bal ? "TUTUYOR" : `FARK ${Math.round((sum - bal) * 100) / 100}`, "gecikmiş", res.overdue("2026-11-17").amount, "geçiş", JSON.stringify(res.prepaidPasses || null), `${ms.toFixed(1)} ms`);
}
