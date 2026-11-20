// Ç6-HESAP tur 3 — Bilanço süresinin parça ayrıştırması YENİ kodda (iş parçacığısız, aynı işlevler; ölçüm kilidi ÖZEL). Kullanım: node parca.mjs <kod kökü> <veri kopyası>
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { createApp } = await imp("server/app.mjs");
const fsl = await imp("server/lib/financial-statements.mjs");
const lsn = await imp("server/lib/ledger-snapshots.mjs");
const sv = await imp("server/lib/stock-valuation.mjs");
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
await app.listen(0, "127.0.0.1");
const ledger = app.context.ledger;
if (ledger.snapshots.state().pending) await ledger.snapshots.runPending();
const store = app.store;
const r = v => Math.round(v);
const date = "2026-12-31";
console.log(`yük (başta) ${load()} · kapsam ${ledger.snapshots.state().coverage || "—"}`);
for (let i = 0; i < 3; i += 1) {
  const t = {};
  let s = performance.now();
  ledger.build();
  t.canliTuretme = performance.now() - s;
  s = performance.now();
  const checked = ledger.check();
  t.checkTamami = performance.now() - s;
  const cover = ledger.snapshots.state().coverage || "";
  const through = cover ? (date < cover ? date : cover) : "";
  s = performance.now();
  const sums = cover ? lsn.frozenSums(store, { from: "", through }) : null;
  t.donmusToplamSql = performance.now() - s;
  s = performance.now();
  const frozen = sums ? fsl.frozenPartOf(sums) : null;
  t.donmusBicim = performance.now() - s;
  s = performance.now();
  const next = cover ? new Date(Date.parse(`${cover}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : "";
  const entries = !cover ? ledger.book({ to: date, live: checked.entries }) : ledger.book({ from: next, to: date, live: checked.entries });
  t.bookKuyruk = performance.now() - s;
  s = performance.now();
  const ruleDiff = cover ? fsl.periodRuleDiff({ frozen: entries, frozenSums: frozen, live: checked.entries, from: "", to: through, accounts: () => true }) : null;
  t.kuralFarki = performance.now() - s;
  s = performance.now();
  const valuation = sv.createStockValuation(sv.loadValuationInput(store));
  t.degerlemeGirdi = performance.now() - s;
  s = performance.now();
  fsl.balanceSheet({ entries, valuation, date, bookType: "unset", closedOn: "", ruleDiff, reconciliation: checked.reconciliation, frozen });
  t.balanceSheetSaf = performance.now() - s;
  s = performance.now();
  fsl.balanceSheetOf({ store, ledger, date });
  t.balanceSheetOfTamami = performance.now() - s;
  console.log(`tekrar ${i + 1}: ${Object.entries(t).map(([k, v]) => `${k} ${r(v)} ms`).join(" · ")} · kuyruk madde ${entries.length}, canlı ${checked.entries.length}, donmuş grup ${sums?.groups.length ?? 0}`);
}
console.log(`yük (sonda) ${load()}`);
await app.close?.();
process.exit(0);
