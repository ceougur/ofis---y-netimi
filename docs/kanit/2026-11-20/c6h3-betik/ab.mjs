// Ç6-HESAP tur 3 — kilitsiz Bilanço / Gelir Tablosu: ESKİ (c6h2-uc) ↔ YENİ financial-statements.mjs AYNI süreçte, AYNI girdilerle, sırayla dönüşümlü (A/B; ölçüm kilidi ÖZEL).
// Uygulama yeni kodla açılır; iki modülün saf işlevleri (balanceSheet, incomeStatement) aynı maddeler / değerleme / mutabakatla çağrılır — fark yalnız kodun hesabıdır.
// Kullanım: node ab.mjs <yeni kök> <eski kök> <veri kopyası>
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [neuRoot, oldRoot, dir] = process.argv.slice(2);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const { createApp } = await import(pathToFileURL(path.join(neuRoot, "server/app.mjs")).href);
const neu = await import(pathToFileURL(path.join(neuRoot, "server/lib/financial-statements.mjs")).href);
const old = await import(pathToFileURL(path.join(oldRoot, "server/lib/financial-statements.mjs")).href);
const sv = await import(pathToFileURL(path.join(neuRoot, "server/lib/stock-valuation.mjs")).href);
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
await app.listen(0, "127.0.0.1");
const ledger = app.context.ledger;
const store = app.store;
console.log(`yük (başta) ${load()} · kapsam ${ledger.snapshots.state().coverage || "—"}`);
const checked = ledger.check();
const entries = ledger.book({ to: "2026-12-31", live: checked.entries });
const valuation = sv.createStockValuation(sv.loadValuationInput(store));
const args = { entries, valuation, date: "2026-12-31", bookType: "unset", closedOn: "", reconciliation: checked.reconciliation };
const gt = { entries: entries.filter(e => e.date >= "2026-01-01"), valuation, from: "2026-01-01", to: "2026-12-31", bookType: "unset" };
const times = { "eski balanceSheet": [], "yeni balanceSheet": [], "eski incomeStatement": [], "yeni incomeStatement": [], "eski balanceSheetOf": [], "yeni balanceSheetOf": [] };
const same = JSON.stringify(old.balanceSheet(args)) === JSON.stringify(neu.balanceSheet(args));
for (let i = 0; i < 7; i += 1) {
  for (const [label, fn] of i % 2 ? [["yeni", neu], ["eski", old]] : [["eski", old], ["yeni", neu]]) {
    let s = performance.now();
    fn.balanceSheet(args);
    times[`${label} balanceSheet`].push(performance.now() - s);
    s = performance.now();
    fn.incomeStatement(gt);
    times[`${label} incomeStatement`].push(performance.now() - s);
    s = performance.now();
    fn.balanceSheetOf({ store, ledger, date: "2026-12-31" });
    times[`${label} balanceSheetOf`].push(performance.now() - s);
  }
}
const r = v => Math.round(v);
for (const [label, list] of Object.entries(times)) {
  const sorted = list.slice(1).sort((a, b) => a - b);
  console.log(`  ${label}: en iyi ${r(sorted[0])} ms · ortanca ${r(sorted[Math.floor(sorted.length / 2)])} ms · en kötü ${r(sorted.at(-1))} ms (n=${sorted.length}; ilk ${r(list[0])})`);
}
console.log(`aynı çıktı (balanceSheet): ${same} · madde ${entries.length} · yük (sonda) ${load()}`);
await app.close?.();
process.exit(0);
