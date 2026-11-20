// Ç6-HESAP tur 2 — Bilanço süresinin parça ayrıştırması (iş parçacığısız, aynı işlevler; ölçüm kilidi ÖZEL). Kullanım: node parca.mjs <kod kökü> <veri kopyası>
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { createApp } = await imp("server/app.mjs");
const fsl = await imp("server/lib/financial-statements.mjs");
const sv = await imp("server/lib/stock-valuation.mjs");
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
await app.listen(0, "127.0.0.1");
const ledger = app.context.ledger;
if (ledger.snapshots.state().pending) { const d0 = performance.now(); await ledger.snapshots.runPending(); console.log(`donma ${Math.round(performance.now() - d0)} ms · kapsam ${ledger.snapshots.state().coverage}`); }
const store = app.store;
const r = v => Math.round(v);
console.log(`yük (başta) ${load()}`);
for (let i = 0; i < 3; i += 1) {
  const t = {};
  let s = performance.now();
  const live = ledger.build();
  t.build = performance.now() - s;
  s = performance.now();
  const list = app.context.accounts.list({ id: "ledger", role: "admin", permissions: [] }, { status: "all" }).accounts;
  t.cariListesi = performance.now() - s;
  s = performance.now();
  ledger.expected(list);
  t.beklenen = performance.now() - s;
  s = performance.now();
  const checked = ledger.check();
  t.checkTamami = performance.now() - s;
  s = performance.now();
  const entries = ledger.book({ to: "2026-12-31", live: checked.entries });
  t.book = performance.now() - s;
  s = performance.now();
  const cover = ledger.snapshots.state().coverage || "";
  if (cover) fsl.periodRuleDiff({ frozen: entries, live: checked.entries, from: "", to: cover, accounts: () => true });
  t.kuralFarki = performance.now() - s;
  s = performance.now();
  const valuation = sv.createStockValuation(sv.loadValuationInput(store));
  t.degerlemeGirdi = performance.now() - s;
  s = performance.now();
  fsl.incomeStatement({ entries, valuation, from: "2026-01-01", to: "2026-12-31", bookType: "unset" });
  t.gtBuYil = performance.now() - s;
  s = performance.now();
  for (const y of [2022, 2023, 2024, 2025]) fsl.incomeStatement({ entries, valuation, from: `${y}-01-01`, to: `${y}-12-31`, bookType: "unset" });
  t.gtOncekiDortYil = performance.now() - s;
  s = performance.now();
  fsl.balanceSheet({ entries, valuation: sv.createStockValuation(sv.loadValuationInput(store)), date: "2026-12-31", bookType: "unset", closedOn: "", reconciliation: checked.reconciliation });
  t.balanceSheetSaf = performance.now() - s;
  console.log(`tekrar ${i + 1}: ${Object.entries(t).map(([k, v]) => `${k} ${r(v)} ms`).join(" · ")} · madde ${entries.length}, canlı ${live.length}`);
}
console.log(`yük (sonda) ${load()}`);
await app.close?.();
process.exit(0);
