#!/usr/bin/env node
// AH: 1.000.000 satırda ESKİ onarımın aday başına okumasının maliyeti (eski kod açılışı saatler sürdüğünden tam koşu yerine örneklem): veri YENİ kodla açılır,
// sonra eski repairOwnCards'ın aday başına yaptığı okumalar — refundsFor (iade başına iki sorgu) + coverState (paymentStates([satır]) → accounts.detail +
// accountSettleInput; bu iki işlev yeni kodda DEĞİŞMEDİ) — eşit aralıklı örneklem adaylarda zamanlanır; eski onarım ≈ ortalama × geri ödemeli aday sayısı.
// Aynı betik yeni onarımı da soğuk zamanlar (önbellek bayatlatılarak). flock ile (ders 15).
//   node eski-maliyet-olc.mjs --kod <yeni kök> --veri <n-1000000> --calisma <klasör> --cikti <json> [--ornek 40]
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import v8 from "node:v8";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const opt = (name, fallback = null) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const kod = path.resolve(opt("kod"));
const veri = path.resolve(opt("veri"));
const calisma = path.resolve(opt("calisma"));
const cikti = path.resolve(opt("cikti"));
const sample = Number(opt("ornek", 40));
const { createApp } = await import(pathToFileURL(path.join(kod, "server", "app.mjs")).href);
rmSync(calisma, { recursive: true, force: true });
mkdirSync(calisma, { recursive: true });
cpSync(veri, calisma, { recursive: true });
const result = { kod, veri, cpu: os.cpus().length, yiginSiniriMb: Math.round(v8.getHeapStatistics().heap_size_limit / 2 ** 20), yukBasta: os.loadavg().map(v => Math.round(v * 10) / 10) };
// Sürecin tepe RSS'i (VmHWM, MB; Linux) — adımdan önce sıfırlanır (/proc/self/clear_refs 5).
const peak = () => {
  try {
    return Math.round(Number(/VmHWM:\s+(\d+)/.exec(readFileSync("/proc/self/status", "utf8"))[1]) / 1024);
  } catch {
    return null;
  }
};
const resetPeak = () => {
  try {
    writeFileSync("/proc/self/clear_refs", "5");
  } catch {
    // Linux dışı
  }
};
const heapMb = () => Math.round(process.memoryUsage().heapUsed / 2 ** 20);
const lag = () => {
  let last = performance.now();
  let worst = 0;
  const probe = setInterval(() => {
    const at = performance.now();
    worst = Math.max(worst, at - last - 5);
    last = at;
  }, 5);
  return () => {
    clearInterval(probe);
    return Math.round(Math.max(worst, performance.now() - last - 5));
  };
};
let stop = lag();
let at = performance.now();
const app = createApp({ dataDir: path.join(calisma, "data"), backupDir: path.join(calisma, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false });
result.yeniAcilisMs = Math.round(performance.now() - at);
result.acilisTepeRssMb = peak();
await new Promise(resolve => setTimeout(resolve, 20));
result.yeniAcilisOlayDongusuMs = stop();
result.acilisOnarimi = { fixed: app.context.ownCardRepair?.fixed?.length, locked: app.context.ownCardRepair?.locked?.length };
const store = app.store;
const inv = app.context.invoices;
// Yeni onarım, soğuk (toplu kapama önbelleği bayat).
store.setSetting("ah.olcum.soguk", String(Date.now()));
if (global.gc) global.gc();
result.onarimOncesiYiginMb = heapMb();
resetPeak();
result.onarimOncesiRssMb = peak();
stop = lag();
at = performance.now();
const repaired = inv.repairOwnCards({});
result.yeniOnarimSogukMs = Math.round(performance.now() - at);
result.onarimTepeRssMb = peak();
result.onarimSonrasiYiginMb = heapMb();
await new Promise(resolve => setTimeout(resolve, 20));
result.yeniOnarimOlayDongusuMs = stop();
result.yeniOnarim = { fixed: repaired.fixed.length, locked: repaired.locked.length };
// Eski onarımın aday başına okuması.
const rows = store.all(`SELECT DISTINCT i.id, i.number, i.plan_id AS planId FROM invoices i
      JOIN invoices r ON r.original_id = i.id AND r.kind = 'sale_return' AND r.status = 'issued'
      JOIN plans pl ON pl.id = i.plan_id AND pl.deleted_at IS NULL AND pl.status <> 'closed'
      WHERE i.status = 'issued' AND i.plan_id <> ''`);
const refundOf = returnId => store.all("SELECT amount FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'out'", returnId).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
const refundsFor = id => store.all("SELECT id FROM invoices WHERE kind = 'sale_return' AND status = 'issued' AND original_id = ?", id).reduce((sum, row) => sum + refundOf(row.id), 0);
const picks = Array.from({ length: Math.min(sample, rows.length) }, (_, k) => rows[Math.floor((k * rows.length) / Math.min(sample, rows.length))]);
let refundMs = 0;
let coverMs = 0;
let withRefund = 0;
for (const row of picks) {
  let t = performance.now();
  const refunds = refundsFor(row.id);
  refundMs += performance.now() - t;
  if (!(refunds > 0.005)) continue;
  withRefund += 1;
  t = performance.now();
  const full = store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson FROM invoices WHERE id = ?", row.id);
  inv.paymentStates([full]);
  coverMs += performance.now() - t;
}
// Geri ödemeli aday sayısı (bütün adaylar; tek toplu sorgu ile).
const refunded = new Set(store.all("SELECT DISTINCT r.original_id AS id FROM invoices r JOIN account_entries e ON e.source = 'invoice' AND e.source_id = r.id AND e.kind = 'out' WHERE r.kind = 'sale_return' AND r.status = 'issued'").map(row => row.id));
const candidatesWithRefund = rows.filter(row => refunded.has(row.id)).length;
result.eski = {
  aday: rows.length, geriOdemeliAday: candidatesWithRefund, ornek: picks.length, ornekGeriOdemeli: withRefund,
  refundsForOrtMs: Math.round((refundMs / picks.length) * 10) / 10,
  coverStateOrtMs: withRefund ? Math.round((coverMs / withRefund) * 10) / 10 : null,
};
result.eski.tahminiOnarimSn = Math.round(((refundMs / picks.length) * rows.length + (withRefund ? coverMs / withRefund : 0) * candidatesWithRefund) / 1000);
result.satir = Object.fromEntries(["account_entries", "invoices", "plans", "cheque_events"].map(table => [table, store.get(`SELECT COUNT(*) AS n FROM ${table}`).n]));
result.yukSonda = os.loadavg().map(v => Math.round(v * 10) / 10);
await app.close();
rmSync(calisma, { recursive: true, force: true });
writeFileSync(cikti, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
