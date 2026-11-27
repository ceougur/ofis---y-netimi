#!/usr/bin/env node
// 2.5.1 D3 — devir ön izlemesinin HACİM ölçümü (docs/devir/D3-D4-TASARIM.md §3.10; G9; ders 47, 52, 53). Programın KENDİ ürettiği büyük veri kopyasında (ders 17): ön izleme ucu (iş
// parçacığı) baştan sona süre + ana iş parçacığının olay döngüsü en çok; iş parçacığının bileşen süreleri (okuma, yevmiye, tek borç sırası, değerleme, ön denetim, plan, rapor); ayrıca
// AYNI işlemde (ana iş parçacığında, ölçüm penceresi DIŞINDA) B-9 için kapanışın bileşenleri: tam Bilanço (balanceSheet) ↔ hesap bazında mizan (trialBalance) ↔ Gelir Tablosu (yıl başına).
// Bütçe: 100.000 para satırında ön izleme ≤ 10 sn, olay döngüsü en çok ≤ 50 ms. Yük (/proc/loadavg 1 dk) > 2 ise ölçüm GEÇERSİZ yazılır (ders 52; 4 çekirdek).
// Kullanım (ÖZEL kilitle, tek seferlik): flock -x -w 1800 <olcum.lock> node test/devir-d3-hacim.mjs <kod kökü> <veri kopyası (data/, backups/)> [K] [şimdi] [tekrar]
//   ör. K = 2025-12-31, şimdi = 2026-10-08T12:00:00+03:00 (temiz-100k). 1.000.000 satır: aynı betik, 1 M kopyasıyla (ana oturum).
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, K = "2025-12-31", NOW = "2026-10-08T12:00:00+03:00", repeatText = "2"] = process.argv.slice(2);
const repeat = Number(repeatText) || 2;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const loadOne = () => Number(readFileSync("/proc/loadavg", "utf8").split(" ")[0]);
const r = value => Math.round(value * 10) / 10;
console.log(`kod ${root} · veri ${dir} · K ${K} · şimdi ${NOW} · yük (başta) ${load()}`);
const loads = [loadOne()];
const mod = file => import(pathToFileURL(path.join(root, file)).href);
const { createApp } = await mod("server/app.mjs");
const { createClient } = await mod("test/helpers.mjs");
const PASS = "Devir-Olcum-2026!";
let t0 = performance.now();
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: { time: NOW, fixed: true }, moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
console.log(`açılış (bekleyen göç dahil) ${Math.round(performance.now() - t0)} ms`);
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const store = app.store;
const money = ["account_entries", "cash_entries", "stock_moves", "plan_entries", "invoices", "fin_events", "cheque_events", "payments"].map(table => [table, Number(store.get(`SELECT COUNT(*) AS n FROM ${table}`).n)]);
console.log(`veri: ${money.map(([t, n]) => `${t} ${n}`).join(" · ")} · Σ ${money.reduce((s, [, n]) => s + n, 0)} · cari ${store.get("SELECT COUNT(*) AS n FROM accounts").n}`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
for (let i = 0; i < repeat; i += 1) {
  h.reset();
  t0 = performance.now();
  const started = await client.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: K });
  if (started.status !== 200) throw new Error(`ön izleme başlamadı: ${started.status} ${JSON.stringify(started.data)}`);
  let job;
  for (;;) {
    job = (await client.get(`/api/admin/devir/preview/${started.data.data.id}`)).data.data;
    if (job.state !== "running") break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const ms = performance.now() - t0;
  loads.push(loadOne());
  if (job.state !== "done") throw new Error(`ön izleme başarısız: ${JSON.stringify(job.error)}`);
  const z = job.result.zamanlama;
  const s = job.result.plan.sayilar;
  console.log(`tur ${i + 1}: ön izleme (uç, iş parçacığı) ${r(ms)} ms · olay döngüsü en çok ${r(h.max / 1e6)} ms · yük ${load()}`);
  console.log(`  bileşenler (iş parçacığı, ms): okuma ${z.okuma} · yevmiye ${z.yevmiye} · tek borç sırası ${z.tekBorcSirasi} · değerleme ${z.degerleme} · ön denetim ${z.onDenetim} · plan ${z.plan} · rapor ${z.rapor} · toplam ${z.toplam}`);
  console.log(`  plan: sorun ${job.result.plan.sorunlar.length} · bozuk değişmez ${job.result.plan.degismezler.filter(row => !row.ok).length} · cari açılış ${s.cariAcilis} · açık fatura ${s.acikFatura.satis + s.acikFatura.alis} · açık kalem ${s.acikKalem.borc + s.acikKalem.alacak} · rapor satırı ${job.result.rapor.rows.length} · kapanış fişi ${job.result.plan.archive.kapanisFisleri.length}`);
  if (i === 0) console.log(`  sorunlar: ${JSON.stringify(job.result.plan.sorunlar).slice(0, 500)} · durdurur: ${job.result.onDenetim.durdurur.map(row => row.kod).join(", ")}`);
}
h.disable();
// ---- B-9: kapanışın bileşenleri (ana iş parçacığında; ölçüm penceresinin DIŞINDA) ----
const { readDevirFacts } = await mod("server/lib/devir/plan-reader.mjs");
const { buildDevirPlan } = await mod("server/lib/devir/plan.mjs");
const { balanceSheet, incomeStatement } = await mod("server/lib/financial-statements.mjs");
const { trialBalance } = await mod("server/lib/general-ledger.mjs");
const ledger = app.context.ledger;
app.db.exec("BEGIN");
t0 = performance.now();
const facts = readDevirFacts({ store, ledger, K, today: NOW.slice(0, 10) });
const readMs = performance.now() - t0;
app.db.exec("COMMIT");
t0 = performance.now();
const plan = buildDevirPlan(facts);
const planMs = performance.now() - t0;
t0 = performance.now();
balanceSheet({ entries: facts.entries, valuation: facts.valuation, date: K, bookType: facts.bookType, closedOn: facts.closedOn });
const bsMs = performance.now() - t0;
t0 = performance.now();
trialBalance(facts.entries, { to: K });
const tbMs = performance.now() - t0;
t0 = performance.now();
incomeStatement({ entries: facts.entries, valuation: facts.valuation, from: `${K.slice(0, 4)}-01-01`, to: K, bookType: facts.bookType });
const isMs = performance.now() - t0;
console.log(`B-9 (ana iş parçacığı, ms): okuyucu ${r(readMs)} (${JSON.stringify(facts.timings)}) · plan ${r(planMs)} · tam Bilanço (balanceSheet) ${r(bsMs)} · hesap bazında mizan (trialBalance) ${r(tbMs)} · K yılının Gelir Tablosu ${r(isMs)} · madde ${facts.entries.length} · önceki yıl fişi ${plan.archive.oncekiYillar.length}`);
const maxLoad = Math.max(...loads);
console.log(`yük (sonda) ${load()} · en yüksek 1 dk yükü ${maxLoad} → ölçüm ${maxLoad > 2 ? "GEÇERSİZ (yük > 2)" : "GEÇERLİ"}`);
await app.close?.();
process.exit(0);
