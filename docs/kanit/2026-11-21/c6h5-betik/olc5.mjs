// Ç6-HESAP tur 5 HIZ (ders 47, 52, 53 (a); değişen HER yol): temiz 100 bin kopyası, tek süreç. kilitsiz: Bilanço 31.12.2026, Gelir Tablosu yıl 2026 ve ilk yarı. kilitli (kilit.py 30.06.2026):
// dondurma koşusu süresi + aynı üç istek fişten ÖNCE; Kural Farkı Düzeltme Fişi (programın ucuyla) → fişten SONRA: Bilanço 31.12.2026, GT yıl 2026 (fiş içinde), GT 2026 ikinci yarı (fiş içinde),
// GT ilk yarı (fiş dışında). Her istek: ilk (ısınma) ayrı + N tekrar (en iyi / ortanca / en kötü), olay döngüsü en çok, yanıtın sha256'sı (üç kodda aynı mı). Önbellek her istekten önce bozulur.
// Kullanım: node olc5.mjs <kod kökü> <veri kopyası> <kilitsiz|kilitli> [tekrar=5]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, kip, repeatText = "5"] = process.argv.slice(2);
const repeat = Number(repeatText) || 5;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const r = v => Math.round(v * 10) / 10;
console.log(`kod ${root} · kip ${kip} · yük (başta) ${load()} · TZ ${process.env.TZ || "(yerel)"}`);
{
  const st = app.ledger.snapshots.state();
  if (st.pending) {
    const d0 = performance.now();
    await app.ledger.snapshots.runPending();
    console.log(`  donma (bekleyen koşu): ${r(performance.now() - d0)} ms · kapsam ${app.ledger.snapshots.state().coverage}`);
  } else console.log(`  donma: bekleyen koşu yok (kapsam ${st.coverage || "—"})`);
}
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
app.store.db.exec("CREATE TEMP TABLE IF NOT EXISTS c6h5_olcum (n INTEGER)");
const bust = () => app.store.db.exec("INSERT INTO c6h5_olcum VALUES (1)");
const sha = value => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const FS = "/api/workspace/financial-statements";
const measure = async (label, url) => {
  const ms = [];
  const loop = [];
  let hash = "";
  let sample = "";
  for (let i = 0; i < repeat + 1; i += 1) {
    bust();
    h.reset();
    const s = performance.now();
    const res = await client.get(url);
    ms.push(performance.now() - s);
    loop.push(h.max / 1e6);
    if (res.status !== 200) throw new Error(`${label} ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    const one = sha(res.data);
    if (!hash) {
      hash = one;
      const d = res.data.data;
      sample = JSON.stringify({ kesinDegil: d.kesinDegil.map(x => x.kod), bilgi: d.bilgi?.map(x => x.kod) || null, dnk: d.subtotals?.donemNetKari ?? d.hesaplanmis?.donemNetKari?.tutarMinor ?? null });
    } else if (one !== hash) throw new Error(`${label}: tekrarda yanıt değişti`);
  }
  const rest = ms.slice(1).sort((a, b) => a - b);
  console.log(`  ${label}: ilk ${r(ms[0])} · en iyi ${r(rest[0])} · ortanca ${r(rest[Math.floor(rest.length / 2)])} · en kötü ${r(rest.at(-1))} ms · olay döngüsü en çok ${r(Math.max(...loop.slice(1)))} ms (n=${rest.length}) · özet ${hash} · ${sample}`);
};
const before = [["Bilanço 2026-12-31", `${FS}/balance-sheet?date=2026-12-31`], ["GT yıl 2026", `${FS}/income-statement?from=2026-01-01&to=2026-12-31`], ["GT ilk yarı 2026", `${FS}/income-statement?from=2026-01-01&to=2026-06-30`]];
for (const [label, url] of before) await measure(`${kip} ${label}`, url);
if (kip === "kilitli") {
  const view = (await client.get("/api/admin/ledger/rule-diff-correction")).data.data;
  const res = await client.post("/api/admin/ledger/rule-diff-correction", { requestId: "c6h5-olcum-fis-0000000001", digest: view.digest, confirm: true });
  console.log(`  fiş ${res.status} ${res.status === 200 ? `${res.data.data.voucher.date} no ${res.data.data.voucher.no}` : JSON.stringify(res.data).slice(0, 200)} · Yönetim önce ${view.lines?.length} satır, dışlanan ${view.excluded?.length}`);
  if (res.status !== 200) throw new Error("fiş yazılamadı");
  for (const [label, url] of [
    ["fişten sonra Bilanço 2026-12-31", `${FS}/balance-sheet?date=2026-12-31`],
    ["fişten sonra GT yıl 2026 (fiş içinde)", `${FS}/income-statement?from=2026-01-01&to=2026-12-31`],
    ["fişten sonra GT ikinci yarı 2026 (fiş içinde)", `${FS}/income-statement?from=2026-07-01&to=2026-12-31`],
    ["fişten sonra GT ilk yarı 2026 (fiş dışında)", `${FS}/income-statement?from=2026-01-01&to=2026-06-30`],
  ]) await measure(label, url);
}
console.log(`  bellek (rss) ${Math.round(process.memoryUsage().rss / 1048576)} MB · yük (sonda) ${load()}`);
await app.close?.();
process.exit(0);
