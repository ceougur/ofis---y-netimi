// Ç6-HESAP tur 1 — kilitli kipte Gelir Tablosu süresinin parçaları (iş parçacığısız, ana iş parçacığında; yalnız ayrıştırma): build, book, ruleDiff, değerleme, hesap.
import path from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const lib = await import(pathToFileURL(path.join(root, "server", "lib", "financial-statements.mjs")).href);
const sv = await import(pathToFileURL(path.join(root, "server", "lib", "stock-valuation.mjs")).href);
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
if (app.ledger.snapshots.state().pending) await app.ledger.snapshots.runPending();
console.log(`yük ${load()} · kapsam ${app.ledger.snapshots.state().coverage || "—"}`);
const L = app.ledger;
const t = (label, fn) => {
  const s = performance.now();
  const out = fn();
  console.log(`  ${label}: ${Math.round(performance.now() - s)} ms`);
  return out;
};
for (let i = 0; i < 3; i += 1) {
  const live = t("build (canlı türetme)", () => L.build());
  const entries = t("book 2026 (live verildi)", () => L.book({ from: "2026-01-01", to: "2026-12-31", live }));
  const diff = t("ruleDiff (live verildi)", () => L.snapshots.ruleDiff({ live }));
  const input = t("değerleme girdisi (2 sorgu)", () => sv.loadValuationInput(app.store));
  const valuation = sv.createStockValuation(input);
  const out = t("Gelir Tablosu hesabı (incomeStatement)", () => lib.incomeStatement({ entries, valuation, from: "2026-01-01", to: "2026-12-31", bookType: "unset", ruleDiff: diff }));
  console.log(`  → madde ${entries.length}, fark ${diff.count}, dnk ${out.subtotals.donemNetKari}`);
}
console.log(`yük ${load()}`);
process.exit(0);
