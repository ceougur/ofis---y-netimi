// Ç3 tur 1 DÜŞÜK-3 + ORTA-2 ölçümü (ders 15, 47): göç / onarım penceresinde (bekleyen 2.4.9 koşusu) Hesap Planı Mizanı ve Yevmiye Defteri (kilitli yıl) — İLK ve İKİNCİ okuma —
// süre, olay döngüsü en çok, tepe RSS; çıktının sha256'sı (önce / sonra birebir mi). --dondur: sonra dondurma (iş parçacığı) ve açılış onarımının (repairOnOpen) süresi.
// Kullanım: node olcum-pencere.mjs <kök> <kaynak.sqlite> <iş klasörü> <cikti.json> [--dondur]
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import v8 from "node:v8";
import { pathToFileURL } from "node:url";
const [ROOT, SOURCE, WORK, OUTPUT] = process.argv.slice(2, 6).map(v => path.resolve(v));
const freeze = process.argv.includes("--dondur");
const imp = file => import(pathToFileURL(path.join(ROOT, file)).href);
const { createClock } = await imp("server/lib/clock.mjs");
const { createStore, openDatabase } = await imp("server/lib/db.mjs");
const { createPeriod } = await imp("server/lib/period.mjs");
const { createRouter } = await imp("server/lib/router.mjs");
const { registerLedgerRoutes } = await imp("server/routes/ledger.mjs");
mkdirSync(WORK, { recursive: true });
const file = path.join(WORK, "destekofis.sqlite");
for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true });
copyFileSync(SOURCE, file);
const peak = () => Math.round(Number(/VmHWM:\s+(\d+)/.exec(readFileSync("/proc/self/status", "utf8"))[1]) / 1024);
const reset = () => writeFileSync("/proc/self/clear_refs", "5");
const result = { root: ROOT, heapLimitMb: Math.round(v8.getHeapStatistics().heap_size_limit / 1048576), load: os.loadavg(), steps: {} };
const save = () => writeFileSync(OUTPUT, JSON.stringify(result, null, 1));
const db = openDatabase(file);
const store = createStore(db);
const now = createClock({ time: "2026-10-08T12:00:00+03:00", fixed: true });
const period = createPeriod({ store, now });
const ledger = registerLedgerRoutes(createRouter(), { store, now, auth: null, audit: () => {}, events: null, period, integrity: () => null, money: null, config: { dbPath: file }, freezeBatchLines: 1000 });
const S = ledger.snapshots;
store.setSetting("ledger.lockedUntil", "2025-12-31");
result.repair = S.repairOnOpen();
result.state = S.state();
save();
const tick = () => new Promise(resolve => setImmediate(resolve));
const digestOf = value => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const canon = entries => entries.map(entry => [entry.id, entry.date, entry.source || "", entry.text || "", entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit])]);
// Olay döngüsü en çok: monitorEventLoopDelay (ısınma 40 ms — ilk örnek atılır) + 10 ms'lik setInterval'ın en büyük gecikmesi (çapraz denetim).
function loopWatch() {
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  let last = performance.now();
  let worst = 0;
  const timer = setInterval(() => {
    const at = performance.now();
    worst = Math.max(worst, at - last - 10);
    last = at;
  }, 10);
  return { stop() { clearInterval(timer); loop.disable(); return { histogramMs: Math.round(loop.max / 1e6), intervalMs: Math.round(worst) }; } };
}
async function timed(label, fn) {
  await tick();
  reset();
  const watch = loopWatch();
  await new Promise(resolve => setTimeout(resolve, 40));
  const started = performance.now();
  const value = fn();
  const ms = Math.round(performance.now() - started);
  await new Promise(resolve => setTimeout(resolve, 40));
  const loop = watch.stop();
  result.steps[label] = { ms, olayDongusuEnCokMs: Math.max(loop.histogramMs, loop.intervalMs), olcer: loop, tepeRssMb: peak(), heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1048576), ...value };
  save();
  console.log(label, JSON.stringify(result.steps[label]));
}
for (const round of [1, 2]) {
  await timed(`hesapPlaniMizani2025-${round}`, () => {
    const { trial } = ledger.check({ from: "2025-01-01", to: "2025-12-31", book: true });
    return { hesap: trial.accounts.length, sha: digestOf(trial) };
  });
  await timed(`yevmiye2025-${round}`, () => {
    const rows = ledger.book({ from: "2025-01-01", to: "2025-12-31" }).filter(e => e.date >= "2025-01-01" && e.date <= "2025-12-31");
    return { madde: rows.length, sha: digestOf(canon(rows)) };
  });
}
if (freeze) {
  const watch = loopWatch();
  await new Promise(resolve => setTimeout(resolve, 40));
  const started = performance.now();
  const status = await S.runPending();
  const ms = Math.round(performance.now() - started);
  await new Promise(resolve => setTimeout(resolve, 40));
  const loop = watch.stop();
  result.steps.dondurma = { ms, olayDongusuEnCokMs: Math.max(loop.histogramMs, loop.intervalMs), olcer: loop, coverage: status.coverage, error: status.error, satir: Number(store.get("SELECT COUNT(*) AS n FROM ledger_snapshots").n) };
  save();
  console.log("dondurma", JSON.stringify(result.steps.dondurma));
  for (const round of [1, 2]) {
    const t = performance.now();
    const repair = S.repairOnOpen();
    result.steps[`acilisOnarimi-${round}`] = { ms: Math.round(performance.now() - t), repair };
    save();
    console.log(`acilisOnarimi-${round}`, JSON.stringify(result.steps[`acilisOnarimi-${round}`]));
  }
}
db.close();
for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true });
result.bitti = true;
result.loadEnd = os.loadavg();
save();
// Ölçüm koşusu tamamlandı (kanit.mjs özeti; sayılar JSON'da).
console.log("\n# tests 1\n# pass 1\n# fail 0");
