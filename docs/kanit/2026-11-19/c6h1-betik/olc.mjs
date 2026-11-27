// Ç6-HESAP tur 1 HACİM (ders 47, 53 (a); çekirdek planı §8: 100.000 satırda ≤ 3 sn, olay döngüsü en çok ≤ 50 ms): temiz 100 bin satırlık verinin taze kopyasında Gelir Tablosu (yıllık + dört çeyrek)
// ve değerleme ucu — iş parçacığı yolu (üretim) ve bilgi için iş parçacığısız yol. Her ölçümden önce sonucun önbelleği düşürülür (veri tabanına yazım YOK; önbellek anahtarı değişsin diye
// yeni uygulama yerine her tekrarda farklı parametre kullanılmaz — önbellek ayrı ölçülür). Kullanım: node olc.mjs <kod kökü> <veri kopyası> [tekrar=5]
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "5"] = process.argv.slice(2);
const repeat = Number(repeatText) || 5;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const t0 = performance.now();
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const r = v => Math.round(v * 10) / 10;
console.log(`kod ${root} · yük (başta) ${load()} · TZ ${process.env.TZ || "(yerel)"} · açılış ${r(performance.now() - t0)} ms`);
{
  const st = app.ledger.snapshots.state();
  if (st.pending) {
    const d0 = performance.now();
    await app.ledger.snapshots.runPending();
    console.log(`donma (bekleyen koşu): ${r(performance.now() - d0)} ms · kapsam ${app.ledger.snapshots.state().coverage}`);
  } else console.log(`donma: bekleyen koşu yok (kapsam ${st.coverage || "—"})`);
}
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const counts = app.store.get("SELECT (SELECT COUNT(*) FROM stock_moves) AS moves, (SELECT COUNT(*) FROM stock_items) AS items, (SELECT COUNT(*) FROM account_entries) AS entries, (SELECT COUNT(*) FROM cash_entries) AS cash, (SELECT COUNT(*) FROM invoices) AS invoices");
console.log(`veri: ${JSON.stringify(counts)}`);
const fs = app.context.financialStatements;
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const results = new Map();
// Önbelleği düşürmek için sayaç: önbellek anahtarı bağlantının total_changes'ını içerir — zararsız, veri değiştirmeyen bir yazım (geçici tablo) sayacı artırır.
app.store.db.exec("CREATE TEMP TABLE IF NOT EXISTS c6h1_olcum (n INTEGER)");
const bust = () => app.store.db.exec("INSERT INTO c6h1_olcum VALUES (1)");
const timed = async (label, call) => {
  bust();
  h.reset();
  const s = performance.now();
  const res = await call();
  const ms = performance.now() - s;
  if (!results.has(label)) results.set(label, { ms: [], loop: [], status: new Set(), sample: null });
  const row = results.get(label);
  row.ms.push(ms);
  row.loop.push(h.max / 1e6);
  row.status.add(res.status ?? 200);
  row.sample ??= res.sample;
};
const FS = "/api/workspace/financial-statements";
const periods = [["2026-01-01", "2026-12-31", "yıl 2026"], ["2026-01-01", "2026-03-31", "Ç1 2026"], ["2026-04-01", "2026-06-30", "Ç2 2026"], ["2026-07-01", "2026-09-30", "Ç3 2026"], ["2026-10-01", "2026-12-31", "Ç4 2026"], ["2025-01-01", "2025-12-31", "yıl 2025"]];
for (let i = 0; i < repeat; i += 1) {
  for (const [from, to, label] of periods) {
    await timed(`Gelir Tablosu ${label} (uç, iş parçacığı)`, async () => {
      const res = await client.get(`${FS}/income-statement?from=${from}&to=${to}`);
      return { status: res.status, sample: res.status === 200 ? { donemNetKari: res.data.data.subtotals.donemNetKari, smm: res.data.data.smm.minor, kesinDegil: res.data.data.kesinDegil.map(row => row.kod) } : res.data };
    });
  }
  await timed("Stok değerlemesi 30.09.2026 (uç, iş parçacığı)", async () => {
    const res = await client.get(`${FS}/stock-valuation?date=2026-09-30`);
    return { status: res.status, sample: res.status === 200 ? { dss: res.data.data.totals.dssMinor, products: res.data.data.products.length, negative: res.data.data.negative.length, warnings: res.data.data.warnings.length } : res.data };
  });
  if (process.env.OLC_INLINE !== "0") {
    await timed("Gelir Tablosu yıl 2026 (iş parçacığısız — bilgi)", async () => ({ status: 200, sample: fs.inline({ kind: "income", from: "2026-01-01", to: "2026-12-31" }).subtotals.donemNetKari }));
    await timed("Stok değerlemesi (iş parçacığısız — bilgi)", async () => ({ status: 200, sample: fs.inline({ kind: "valuation", date: "2026-09-30" }).totals.dssMinor }));
  }
}
// Önbellek: aynı istek ikinci kez (veri değişmedi).
await client.get(`${FS}/income-statement?from=2026-01-01&to=2026-12-31`);
h.reset();
const c0 = performance.now();
await client.get(`${FS}/income-statement?from=2026-01-01&to=2026-12-31`);
console.log(`  önbellekten (aynı istek): ${r(performance.now() - c0)} ms · olay döngüsü en çok ${r(h.max / 1e6)} ms`);
for (const [label, row] of results) {
  const sorted = [...row.ms].sort((a, b) => a - b);
  console.log(`  ${label}: durum ${[...row.status].join("/")} · en iyi ${r(sorted[0])} ms · ortanca ${r(sorted[Math.floor(sorted.length / 2)])} ms · en kötü ${r(sorted.at(-1))} ms · olay döngüsü en çok ${r(Math.max(...row.loop))} ms (n=${row.ms.length}) · örnek ${JSON.stringify(row.sample)}`);
}
console.log(`yük (sonda) ${load()}`);
await app.close?.();
process.exit(0);
