#!/usr/bin/env node
// AH (2.5.0): şirket açılışının ve açılış onarımının (repairOwnCards) süresi — verilen KOD kökünün createApp'i, verilen VERİ klasörünün
// kopyasında. Ölçüm ders 15: flock <olcum.lock> ile tek başına; önce / sonra aynı veri kopyası.
//   node acilis-olc.mjs --kod <kök> --veri <n-100000 klasörü (data/ + backups/)> --calisma <boş klasör> --cikti <json> [--acilis 2] [--onarim 2]
// Adımlar: veri kopyalanır; createApp --acilis kez (ilk açılış göçü de yapar; sonrakiler kalıcı açılış), her birinde süre + olay döngüsü en çok
// (5 ms yoklayıcı; createApp eşzamanlı olduğundan açılışın tamamı tek boşluktur); son açılışta repairOwnCards() --onarim kez daha (idempotent;
// açılıştaki onarımla aynı iş) ve sonucu; onarım adayı fatura / cari sayısı; kapının taban taraması (integrity.start) ayrıca.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const opt = (name, fallback = null) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const kod = path.resolve(opt("kod"));
const veri = path.resolve(opt("veri"));
const calisma = path.resolve(opt("calisma"));
const cikti = path.resolve(opt("cikti"));
const opens = Number(opt("acilis", 2));
const repairs = Number(opt("onarim", 2));
const NOW = opt("now", "2026-10-08T12:00:00+03:00");
const PASS = "Kapi-Olcum-2026!";

const { createApp } = await import(pathToFileURL(path.join(kod, "server", "app.mjs")).href);
rmSync(calisma, { recursive: true, force: true });
mkdirSync(calisma, { recursive: true });
cpSync(veri, calisma, { recursive: true });
const dataDir = path.join(calisma, "data");
const options = () => ({
  dataDir, backupDir: path.join(calisma, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: NOW, moneyStrict: false,
});
async function timed(fn) {
  let last = performance.now();
  let worst = 0;
  const probe = setInterval(() => {
    const at = performance.now();
    worst = Math.max(worst, at - last - 5);
    last = at;
  }, 5);
  const started = performance.now();
  const value = await fn();
  const ms = performance.now() - started;
  await new Promise(resolve => setTimeout(resolve, 20));
  clearInterval(probe);
  worst = Math.max(worst, performance.now() - last - 5);
  return { value, ms: Math.round(ms), loopMaxMs: Math.round(worst) };
}
const result = { kod, veri, now: NOW, node: process.version, cpu: os.cpus().length, yukBasta: os.loadavg().map(v => Math.round(v * 10) / 10), acilislar: [], onarimlar: [] };
for (let k = 1; k <= opens; k += 1) {
  const step = await timed(() => createApp(options()));
  const app = step.value;
  const entry = { sira: k, createAppMs: step.ms, olayDongusuEnCokMs: step.loopMaxMs, yuk: os.loadavg().map(v => Math.round(v * 10) / 10) };
  const first = app.context?.ownCardRepair || null;
  entry.acilisOnarimi = first ? { fixed: first.fixed.length, locked: first.locked.length } : null;
  if (k === opens) {
    const store = app.store;
    const rows = store.all(`SELECT DISTINCT i.id, i.account_id AS accountId FROM invoices i
      JOIN invoices r ON r.original_id = i.id AND r.kind = 'sale_return' AND r.status = 'issued'
      JOIN plans pl ON pl.id = i.plan_id AND pl.deleted_at IS NULL AND pl.status <> 'closed'
      WHERE i.status = 'issued' AND i.plan_id <> ''`);
    result.aday = { fatura: rows.length, cari: new Set(rows.map(row => row.accountId)).size, userVersion: store.get("PRAGMA user_version").user_version };
    result.satir = Object.fromEntries(["account_entries", "invoices", "plans", "cheque_events", "cash_entries"].map(table => [table, store.get(`SELECT COUNT(*) AS n FROM ${table}`).n]));
    for (let r = 1; r <= repairs; r += 1) {
      // Soğuk ölçüm: zararsız bir ayar yazımı bağlantının total_changes()'ını artırır → yeni kodun toplu kapama önbelleği (settleKey) bayatlar;
      // açılıştaki onarımla aynı iş (eski kodda önbellek yok, etkisiz).
      app.store.setSetting("ah.olcum.soguk", String(Date.now()));
      const again = await timed(() => app.context.invoices.repairOwnCards({}));
      result.onarimlar.push({ sira: r, ms: again.ms, olayDongusuEnCokMs: again.loopMaxMs, fixed: again.value.fixed.length, locked: again.value.locked.length });
    }
    if (app.integrity?.start) {
      const scan = await timed(() => app.integrity.start());
      result.tabanTaramasiMs = scan.ms;
      result.tabanOk = scan.value?.baseline?.ok ?? null;
    }
  }
  result.acilislar.push(entry);
  await app.close();
}
result.yukSonda = os.loadavg().map(v => Math.round(v * 10) / 10);
rmSync(calisma, { recursive: true, force: true });
writeFileSync(cikti, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
