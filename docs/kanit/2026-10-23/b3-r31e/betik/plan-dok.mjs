// Tur 8 senaryosunun sekmelerinde kolon rolleri ve borç planı (KOK kod kökü).
import { readFileSync } from "node:fs";
const K = process.env.KOK;
const { analyzeColumns } = await import(`${K}/server/lib/insight/columns.mjs`);
const { amountCandidates, debtPlan, sparseDebtColumn } = await import(`${K}/server/lib/insight/debt-column.mjs`);
const spec = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const sheet of spec.sheets) {
  const [head, ...body] = sheet.matrix;
  const rows = body.map(r => Object.fromEntries(head.map((h, i) => [h, String(r[i] ?? "").startsWith("@d") ? "20.10.2026" : r[i]])));
  const analyses = analyzeColumns(rows, head, { now: new Date(2026, 9, 23) });
  const sparse = sparseDebtColumn(head, rows, undefined, { analyses });
  const plan = debtPlan(amountCandidates(analyses), { sparse });
  console.log(sheet.name, JSON.stringify(analyses.map(a => [a.column, a.role])), "aday", JSON.stringify(amountCandidates(analyses)), "seyrek", sparse, "plan", JSON.stringify(plan));
}
