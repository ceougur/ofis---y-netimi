// Ç6-HESAP tur 5 — parça ayrıştırması (KOD DEĞİŞMEZ; tur 4'ün parca-fis.mjs'inin genişletilmiş kopyası): kilitli temiz 100 bin + Kural Farkı Düzeltme Fişi → Gelir Tablosu yıl 2026 ve parçaları.
// Kullanım: node parca5.mjs <ölçülen kod kökü> <veri kopyası> [<parça kodu kökü (ruleThrough'lu frozenSums)>]
import path from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, partRoot = root] = process.argv.slice(2);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const imp = (base, rel) => import(pathToFileURL(path.join(base, rel)).href);
const { createApp } = await imp(root, "server/app.mjs");
const { createClient } = await imp(root, "test/helpers.mjs");
const fs = await imp(root, "server/lib/financial-statements.mjs");
const { frozenSums } = await imp(partRoot, "server/lib/ledger-snapshots.mjs");
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
await app.ledger.snapshots.runPending();
const client = createClient(`http://127.0.0.1:${port}`);
await client.login("admin", PASS);
const view = (await client.get("/api/admin/ledger/rule-diff-correction")).data.data;
await client.post("/api/admin/ledger/rule-diff-correction", { requestId: "c6h5-parca-fis-0000000001", digest: view.digest, confirm: true });
console.log(`kod ${root} · yük ${load()} · fiş yazıldı`);
const { store, ledger } = app;
const t = async (label, fn, n = 5) => {
  const ms = [];
  let out;
  for (let i = 0; i < n; i += 1) {
    const s = performance.now();
    out = fn();
    ms.push(performance.now() - s);
  }
  ms.sort((a, b) => a - b);
  console.log(`  ${label}: en iyi ${ms[0].toFixed(0)} · ortanca ${ms[Math.floor(n / 2)].toFixed(0)} ms`);
  return out;
};
const cover = ledger.snapshots.state().coverage;
console.log(`  kapsam ${cover}`);
await t("incomeStatementOf yıl 2026 (tam; ilk çağrı dahil 6 kez)", () => fs.incomeStatementOf({ store, ledger, from: "2026-01-01", to: "2026-12-31" }), 6);
await t("incomeStatementOf 2026 H2 (07-01..12-31)", () => fs.incomeStatementOf({ store, ledger, from: "2026-07-01", to: "2026-12-31" }));
await t("frozenSums yıl [2026-01-01, kapsam] (tablonun kendi okuması)", () => frozenSums(store, { from: "2026-01-01", through: cover, split: "2026-01-01" }));
await t("frozenSums kapsamın tamamı ['', kapsam] (tur 4'ün ikinci okuması)", () => frozenSums(store, { from: "", through: cover }));
const wide = await t("frozenSums yıl + ruleThrough (tur 5 tek çağrı)", () => frozenSums(store, { from: "2026-01-01", through: cover, split: "2026-01-01", ruleThrough: cover }));
console.log(`  tek çağrı: groups ${wide.groups.length} · outside ${wide.outside?.length ?? "YOK"}`);
const count = store.get("SELECT COUNT(*) AS n, SUM(CASE WHEN date >= '2026-01-01' THEN 1 ELSE 0 END) AS y FROM ledger_snapshots WHERE date <= ?", cover);
console.log(`  donmuş satır ≤ kapsam ${count.n} · bunların 2026'sı ${count.y}`);
await t("expected every (alt defter hesapları)", () => new Set(Object.keys(ledger.expected([], [], { every: true }))));
console.log(`yük (sonda) ${load()}`);
await app.close?.();
process.exit(0);
