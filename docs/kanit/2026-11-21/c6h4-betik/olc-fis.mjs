// Ç6-HESAP tur 4 — kilitli temiz 100 bin (kilit.py: 30.06.2026, 2.4.9 kurallı onarım koşusu): (1) fişten ÖNCE 5 yanıtın tam JSON'u dosyaya (eski ↔ yeni karşılaştırması: yalnız neden satırları
// mı farklı); (2) Kural Farkı Düzeltme Fişi programın ucuyla; (3) fişten SONRA aynı yanıtlar dosyaya + süre (≥ 5 tekrar, en iyi / ortanca, olay döngüsü en çok) — KALAN yolu (ORTA-2).
// Kullanım: node olc-fis.mjs <kod kökü> <veri kopyası> <çıktı öneki> [tekrar=5]
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, out, repeatText = "5"] = process.argv.slice(2);
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
console.log(`kod ${root} · yük ${load()} · TZ ${process.env.TZ || "(yerel)"}`);
const d0 = performance.now();
await app.ledger.snapshots.runPending();
console.log(`donma ${r(performance.now() - d0)} ms · kapsam ${app.ledger.snapshots.state().coverage}`);
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const FS = "/api/workspace/financial-statements";
const plan = [
  ["Bilanço 2026-12-31", `${FS}/balance-sheet?date=2026-12-31`], ["Bilanço 2026-06-30", `${FS}/balance-sheet?date=2026-06-30`], ["Bilanço 2026-07-01", `${FS}/balance-sheet?date=2026-07-01`],
  ["Gelir Tablosu yıl 2026", `${FS}/income-statement?from=2026-01-01&to=2026-12-31`], ["Gelir Tablosu 2026 H1", `${FS}/income-statement?from=2026-01-01&to=2026-06-30`],
  ["Gelir Tablosu 2025", `${FS}/income-statement?from=2025-01-01&to=2025-12-31`],
];
app.store.db.exec("CREATE TEMP TABLE IF NOT EXISTS c6h4_olcum (n INTEGER)");
const bust = () => app.store.db.exec("INSERT INTO c6h4_olcum VALUES (1)");
const snap = async label => {
  const all = {};
  for (const [name, url] of plan) {
    bust();
    const res = await client.get(url);
    all[name] = res.data;
  }
  writeFileSync(`${out}-${label}.json`, JSON.stringify(all));
  for (const [name, body] of Object.entries(all)) {
    const kd = body?.data?.kesinDegil || [];
    const rule = kd.find(row => row.kod === "kural-farki");
    console.log(`  ${label} · ${name}: Kesin Değil ${kd.map(row => row.kod).join(",")} · kural-farki ayrıntı ${rule?.ayrinti?.length ?? 0} satır · bilgi ${JSON.stringify(body?.data?.bilgi?.map(row => row.baslik) || null)}`);
  }
};
await snap("once");
const view = (await client.get("/api/admin/ledger/rule-diff-correction")).data.data;
console.log(`Yönetim: ${view.count} madde · ${view.lines.length} satır · pasif ${view.disabled} ${view.code} · dışlanan ${view.excluded.length}`);
if (!view.disabled) {
  const res = await client.post("/api/admin/ledger/rule-diff-correction", { requestId: "c6h4-olcum-fis-000000001", digest: view.digest, confirm: true });
  console.log(`fiş ${res.status} ${res.status !== 200 ? JSON.stringify(res.data).slice(0, 300) : res.data.data.voucher.no}`);
  const after = (await client.get("/api/admin/ledger/rule-diff-correction")).data.data;
  console.log(`Yönetim fişten sonra: ${after.lines.length} satır · ${after.code}`);
}
await snap("sonra");
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
for (const [name, url] of [plan[0], plan[3]]) {
  const ms = [];
  const loop = [];
  for (let i = 0; i < repeat + 1; i += 1) {
    bust();
    h.reset();
    const s = performance.now();
    const res = await client.get(url);
    ms.push(performance.now() - s);
    loop.push(h.max / 1e6);
    if (res.status !== 200) throw new Error(`${name} ${res.status}`);
  }
  const rest = ms.slice(1).sort((a, b) => a - b);
  console.log(`  süre (fişten sonra) ${name}: ilk ${r(ms[0])} · en iyi ${r(rest[0])} · ortanca ${r(rest[Math.floor(rest.length / 2)])} · en kötü ${r(rest.at(-1))} ms · olay döngüsü en çok ${r(Math.max(...loop.slice(1)))} ms (n=${rest.length})`);
}
console.log(`yük (sonda) ${load()}`);
await app.close?.();
process.exit(0);
