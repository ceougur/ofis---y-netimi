// Ç6-HESAP tur 3 HACİM + EŞDEĞERLİK (ders 47, 52, 53 (a); çekirdek planı §8: 100.000 satırda ≤ 3 sn, 1 M satırda hedef ≤ 60 sn, olay döngüsü en çok ≤ 50 ms) — tur 2'nin düzeneği
// (docs/kanit/2026-11-20/c6h2-betik/olc.mjs) genişletildi: Bilanço (t = 31.12.2026, 30.06.2026, 31.03.2026, 31.12.2025), Gelir Tablosu (yıl 2026, Ç2 2026, Ç3 2026), değerleme (31.12.2026,
// 30.06.2026), ikinci şirket (hofCompany) Bilanço 31.12.2026 + Gelir Tablosu yıl 2026. Her isteğin İLK yanıtının tam JSON'unun sha256'sı yazılır (eski kod ↔ yeni kod AYNI kopyada
// karşılaştırılır — eşdeğerlik). Süre: ilk istek ayrı, ≥ 5 tekrar en iyi / ortanca; olay döngüsü en çok; süreç belleği (rss) en çok; önbellekten ayrı.
// Kullanım: node olc.mjs <kod kökü> <veri kopyası> [tekrar=5] [şirket2 kimliği]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "5", company2Arg = ""] = process.argv.slice(2);
const company2 = company2Arg === "auto" ? JSON.parse(readFileSync(path.join(dir, "data", "sirketler.json"), "utf8")).companies.find(row => row.code === "002")?.id || "" : company2Arg;
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
const counts = app.store.get("SELECT (SELECT COUNT(*) FROM stock_moves) AS moves, (SELECT COUNT(*) FROM account_entries) AS entries, (SELECT COUNT(*) FROM cash_entries) AS cash, (SELECT COUNT(*) FROM invoices) AS invoices, (SELECT COUNT(*) FROM ledger_snapshots) AS frozen");
console.log(`veri: ${JSON.stringify(counts)} · madde ${app.ledger.build().length}`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const results = new Map();
let rssMax = 0;
app.store.db.exec("CREATE TEMP TABLE IF NOT EXISTS c6h3_olcum (n INTEGER)");
const bust = () => app.store.db.exec("INSERT INTO c6h3_olcum VALUES (1)");
const sha = value => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const timed = async (label, url) => {
  bust();
  h.reset();
  const s = performance.now();
  const res = await client.get(url);
  const ms = performance.now() - s;
  rssMax = Math.max(rssMax, process.memoryUsage().rss);
  if (!results.has(label)) results.set(label, { ms: [], loop: [], status: new Set(), hash: "", sample: null });
  const row = results.get(label);
  row.ms.push(ms);
  row.loop.push(h.max / 1e6);
  row.status.add(res.status);
  if (!row.hash) {
    row.hash = sha(res.data);
    const data = res.data?.data;
    row.sample = res.status !== 200 ? res.data : data?.toplamlar ? { aktif: data.toplamlar.aktifMinor, fark: data.toplamlar.farkMinor, dnk: data.hesaplanmis.donemNetKari?.tutarMinor ?? null, kesinDegil: data.kesinDegil.map(x => x.kod) } : data?.subtotals ? { dnk: data.subtotals.donemNetKari, smm: data.smm.minor, kesinDegil: data.kesinDegil.map(x => x.kod) } : { dss: data?.totals?.dssMinor };
  }
};
const FS = "/api/workspace/financial-statements";
const plan = [];
const short = process.env.OLC_KISA === "1"; // 1 M: daha az istek (her biri ~dakika)
for (const date of short ? ["2026-12-31", "2026-06-30"] : ["2026-12-31", "2026-06-30", "2026-03-31", "2025-12-31"]) plan.push([`Bilanço ${date}`, `${FS}/balance-sheet?date=${date}`]);
for (const [from, to, label] of short ? [["2026-01-01", "2026-12-31", "yıl 2026"], ["2026-07-01", "2026-09-30", "Ç3 2026"]] : [["2026-01-01", "2026-12-31", "yıl 2026"], ["2026-04-01", "2026-06-30", "Ç2 2026"], ["2026-07-01", "2026-09-30", "Ç3 2026"]]) plan.push([`Gelir Tablosu ${label}`, `${FS}/income-statement?from=${from}&to=${to}`]);
for (const date of short ? ["2026-12-31"] : ["2026-12-31", "2026-06-30"]) plan.push([`Değerleme ${date}`, `${FS}/stock-valuation?date=${date}`]);
// İkinci şirket: önbellek ayracı (geçici tablo) yalnız 001'in bağlantısında → her tekrarda FARKLI gün (önbellek anahtarı parametreyi içerir; maliyet aynı). Önce bir kez açılır (şirket açılışı ölçüme girmez).
const days = ["2026-12-31", "2026-12-30", "2026-12-29", "2026-12-28", "2026-12-27", "2026-12-26", "2026-12-25", "2026-12-24", "2026-12-23", "2026-12-22", "2026-12-21"];
if (company2) await client.get(`${FS}/income-statement?from=2026-01-01&to=2026-01-01&hofCompany=${company2}`);
for (let i = 0; i < repeat + 1; i += 1) {
  for (const [label, url] of plan) await timed(label, url);
  if (company2) {
    await timed("Şirket 2 Bilanço (31.12.2026 − i gün)", `${FS}/balance-sheet?date=${days[i]}&hofCompany=${company2}`);
    await timed("Şirket 2 Gelir Tablosu (1 Ocak – 31.12.2026 − i gün)", `${FS}/income-statement?from=2026-01-01&to=${days[i]}&hofCompany=${company2}`);
  }
}
{
  await client.get(`${FS}/balance-sheet?date=2026-12-31`);
  h.reset();
  const c0 = performance.now();
  await client.get(`${FS}/balance-sheet?date=2026-12-31`);
  console.log(`  Bilanço önbellekten (aynı istek): ${r(performance.now() - c0)} ms · olay döngüsü en çok ${r(h.max / 1e6)} ms`);
}
for (const [label, row] of results) {
  const first = row.ms[0];
  const rest = row.ms.slice(1).sort((a, b) => a - b);
  console.log(`  ${label}: durum ${[...row.status].join("/")} · ilk ${r(first)} ms (olay döngüsü ${r(row.loop[0])} ms) · en iyi ${r(rest[0])} ms · ortanca ${r(rest[Math.floor(rest.length / 2)])} ms · en kötü ${r(rest.at(-1))} ms · olay döngüsü en çok ${r(Math.max(...row.loop.slice(1)))} ms (n=${rest.length}) · özet ${row.hash} · örnek ${JSON.stringify(row.sample)}`);
}
console.log(`bellek (rss) en çok ${Math.round(rssMax / 1048576)} MB · yük (sonda) ${load()}`);
await app.close?.();
process.exit(0);
