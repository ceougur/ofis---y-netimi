// Ç7b taksit küçük turu — HIZ (ders 47 / 53 (a)): Excel'den taksit kartı yüklemesi (POST /api/workspace/plans/import), 2.000 satır, temiz 100 bin verinin KOPYASINDA.
// Satırlar veriden belirlenimli seçilir: 800 var olan cari aynı ad + aynı telefon, 400 aynı ad + farklı telefon, 300 aynı ad telefonsuz, 500 yeni ad — yinelenen
// kart denetiminin (yeni: kişi kuralı) her dalı çalışır. Ölçülen: yanıt süresi + olay döngüsü en çok; sonuç sayıları (created / skipped nedenleri) da yazılır.
// Kullanım: node olc-excel.mjs <kod kökü> <veri kopyası> <kilitsiz|kilitli>
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, mode = "kilitsiz"] = process.argv.slice(2);
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
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const store = app.store;
const counts = store.get("SELECT (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL) AS a, (SELECT COUNT(*) FROM plans WHERE deleted_at IS NULL) AS p, (SELECT COUNT(*) FROM account_entries) AS e");
if (mode === "kilitli") {
  const r = await client.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" });
  if (r.status !== 200) throw new Error(`kilit ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
}
console.log(`kod ${root} · ${mode} · kilit '${app.period?.lockedUntil?.() || ""}' · veri: ${counts.a} cari, ${counts.p} açık kart, ${counts.e} cari satırı · yük ${load()}`);
const withPhone = store.all("SELECT name, phone FROM accounts WHERE deleted_at IS NULL AND length(replace(replace(phone, ' ', ''), '-', '')) >= 7 ORDER BY rowid LIMIT 1200");
const anyName = store.all("SELECT name FROM accounts WHERE deleted_at IS NULL ORDER BY rowid DESC LIMIT 300");
const rows = [];
const yuk = process.argv[5] || "karma";
if (yuk === "esit") {
  // EŞİT İŞ: iki kodda aynı sonuç sayısı — 1.000 var olan aynı ad + aynı telefon (iki kodda da atlanır; neden metni farklı) + 1.000 yeni ad (iki kodda da açılır).
  withPhone.slice(0, 1000).forEach(a => rows.push([a.name, a.phone, "1.200", "3", "01.11.2026"]));
} else {
  withPhone.slice(0, 800).forEach(a => rows.push([a.name, a.phone, "1.200", "3", "01.11.2026"]));
  withPhone.slice(800, 1200).forEach((a, i) => rows.push([a.name, `0599 ${String(100000 + i).padStart(7, "0")}`, "900", "3", "01.11.2026"]));
  anyName.forEach(a => rows.push([a.name, "", "600", "2", "01.11.2026"]));
}
for (let i = 0; rows.length < 2000; i += 1) rows.push([`Ölçüm Kişisi ${i}`, i % 2 ? `0598 ${String(200000 + i).padStart(7, "0")}` : "", "1.000", "4", "01.11.2026"]);
const matrix = [["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"], ...rows];
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
h.reset();
const started = performance.now();
const res = await client.post("/api/workspace/plans/import", { matrix, headerAt: 0, roles: { 0: "name", 1: "phone", 2: "total", 3: "count", 4: "firstDue" }, linkRecords: false, fileName: "olcum.xlsx" });
const ms = performance.now() - started;
const loop = h.max / 1e6;
const data = res.data?.data || res.data;
const reasons = {};
for (const s of data?.skipped || []) reasons[s.reason.slice(0, 60)] = (reasons[s.reason.slice(0, 60)] || 0) + 1;
console.log(`SONUÇ ${mode}: durum ${res.status} · yanıt ${Math.round(ms)} ms · olay döngüsü en çok ${Math.round(loop)} ms · satır ${rows.length} · açılan ${data?.created} · bağlanan ${data?.linked} · atlanan ${JSON.stringify(reasons)} · yük ${load()}`);
await app.close?.();
process.exit(0);
