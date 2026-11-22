// Kuyruk kurulumu mikro ölçümü (ders 47): kartlı en kalabalık 12 carinin buildObligations süresi (obligationsFor), 15 tekrar. node mikro.mjs <kod> <veri kopyası>
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
await app.listen(0, "127.0.0.1");
const s = app.store;
const inv = app.context.invoices;
const ids = s.all(`SELECT p.account_id AS id, (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = p.account_id) AS n FROM plans p WHERE p.deleted_at IS NULL AND p.covers_balance = 1 GROUP BY p.account_id ORDER BY n DESC`).map(r => r.id);
const acc = app.context.accounts;
const ledgers = new Map(ids.map(id => [id, acc.detail(id, { id: "system", role: "admin" }, { withRemaining: false }).ledger]));
const times = []; let passes = 0;
for (let rep = 0; rep < 5; rep += 1) {
  const t = performance.now();
  for (const id of ids) { const r = inv.obligationsFor(id, ledgers.get(id)); if (rep === 0) passes += r.prepaidPasses?.count || 0; }
  times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
console.log(`MİKRO | ${root.split("/").pop()} | cari ${ids.length} | en iyi ${times[0].toFixed(1)} | ortanca ${times[2].toFixed(1)} | ön ödeme geçişi ${passes} | yük ${readFileSync("/proc/loadavg", "utf8").split(" ").slice(0, 3).join(" ")}`);
await app.close();
