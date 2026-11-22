// Parça ayrıştırması (KOD DEĞİŞMEZ): kilitli temiz 100 bin + Kural Farkı Düzeltme Fişi → Gelir Tablosu yıl 2026'nın KALAN yolunun parçaları (iş parçacığısız, aynı süreç).
// Kullanım: node parca-fis.mjs <kod kökü> <veri kopyası>
import path from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { createApp } = await imp("server/app.mjs");
const { createClient } = await imp("test/helpers.mjs");
const fs = await imp("server/lib/financial-statements.mjs");
const { frozenSums } = await imp("server/lib/ledger-snapshots.mjs");
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
await client.post("/api/admin/ledger/rule-diff-correction", { requestId: "c6h4-parca-fis-0000000001", digest: view.digest, confirm: true });
console.log(`yük ${load()} · fiş yazıldı`);
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
const live = await t("ledger.build() (canlı türetme)", () => ledger.build());
console.log(`  madde ${live.length}`);
await t("incomeStatementOf yıl 2026 (tam)", () => fs.incomeStatementOf({ store, ledger, from: "2026-01-01", to: "2026-12-31" }));
const sums = await t("frozenSums kapsamın tamamı (SQL)", () => frozenSums(store, { from: "", through: cover }));
const part = await t("frozenPartOf (tamamı)", () => fs.frozenPartOf(sums));
await t("periodRuleDiff (tamamı, cari boyutlu, bütün hesaplar)", () => fs.periodRuleDiff({ frozen: [], frozenSums: part, live, from: "", to: cover, accounts: () => true, party: true }));
await t("expected every (alt defter hesapları)", () => new Set(Object.keys(ledger.expected([], [], { every: true }))));
await t("postedCorrectionsAt", () => fs.postedCorrectionsAt(store, "2026-12-31"));
console.log(`yük (sonda) ${load()}`);
await app.close?.();
process.exit(0);
