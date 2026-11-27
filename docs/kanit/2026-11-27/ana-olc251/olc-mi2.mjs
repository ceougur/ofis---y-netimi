// Mİ tur 2 hız ölçümü (ders 47, 53 — DEĞİŞEN her yol): tur 1 kodu (taban) ↔ tur 2 kodu, temiz 100 bin verinin KOPYASINDA (para dışı değişiklik yok).
// Kullanım: flock -x -w 1800 <olcum.lock> node olc-mi2.mjs <kod kökü> <veri kopyası> <etiket> [tekrar=5]
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, kind = "yeni", repeatText = "5"] = process.argv.slice(2);
const repeat = Number(repeatText) || 5;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
console.log(`kod ${root} (${kind}) · veri ${dir} · yük (başta) ${load()}`);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const store = app.store;
const counts = store.get("SELECT (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL) AS a, (SELECT COUNT(*) FROM account_entries) AS e, (SELECT COUNT(*) FROM plan_entries) AS pe, (SELECT COUNT(*) FROM plan_items) AS pi, (SELECT COUNT(*) FROM plans WHERE deleted_at IS NULL) AS p");
console.log(`veri: ${counts.a} cari, ${counts.e} cari satırı, ${counts.p} kart, ${counts.pi} taksit, ${counts.pe} taksit hareketi`);
// En çok kartlı / hareketli cari (cari kartı ölçümü).
const heavy = store.get("SELECT p.account_id AS id, COUNT(*) AS n FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE p.account_id <> '' AND p.deleted_at IS NULL GROUP BY p.account_id ORDER BY n DESC LIMIT 1");
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const r = v => Math.round(v * 10) / 10;
const paths = [
  ["Cari Listesi (Aktif, 300)", "/api/workspace/accounts?status=active&limit=300"],
  ["Cari kartı (en hareketli cari)", `/api/workspace/accounts/${heavy?.id}`],
  ["Zil / takvim (dues)", "/api/workspace/dues"],
  ["Taksitler listesi", "/api/workspace/plans?status=active"],
  ["Vade Takip", "/api/workspace/overview/vade-takip?preset=all"],
  ["Tüm Cari Hareketleri (Bu Yıl)", "/api/workspace/report-center/cari-hareketleri?preset=thisYear"],
  ["Taksit Tahsilatları (Bu Yıl)", "/api/workspace/report-center/taksit-tahsilatlari?preset=thisYear"],
  ["Taksit Vadeleri (Bu Yıl)", "/api/workspace/report-center/taksit-vadeleri?preset=thisYear"],
];
for (const [label, url] of paths) {
  const warm = await client.get(url);
  if (warm.status !== 200) throw new Error(`${label}: ${warm.status}`);
  const times = [];
  h.reset();
  for (let i = 0; i < repeat; i += 1) {
    const t0 = performance.now();
    const res = await client.get(url);
    times.push(performance.now() - t0);
    if (res.status !== 200) throw new Error(`${label}: ${res.status}`);
  }
  times.sort((a, b) => a - b);
  console.log(`${label}: orta ${r(times[Math.floor(times.length / 2)])} ms · en az ${r(times[0])} · en çok ${r(times.at(-1))} · olay döngüsü en çok ${r(h.max / 1e6)} ms`);
}
console.log(`yük (sonda) ${load()}`);
await app.close();
process.exit(0);
