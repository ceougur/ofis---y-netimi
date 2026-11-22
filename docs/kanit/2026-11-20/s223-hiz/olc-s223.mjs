// S223 hız kabul ölçümü (ders 47, 53 (a)): değişen dört yükleme yolu — cari Excel 2.000 satır, taksit Excel 2.000 satır, çek / senet 500 satır, Tablodan Aktar
// (ön izleme + aktarım, 300 kayıt). İki iş yükü: KARMA (yarısı var olan carilerin BÜYÜK HARFLİ adı + telefonu, yarısı yeni ad) ve YENİ (hepsi yeni ad — Türkçe
// yedek eşleşmenin en kötü durumu: her satırda NOCASE boş, harita kurulur). Yanıt süresi + olay döngüsü en çok. Veri KOPYADA (her koşu taze kopya).
// Kullanım: node olc-s223.mjs <kod kökü> <veri kopyası> <iş yükü: karma|yeni>
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, mode = "karma"] = process.argv.slice(2);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false, legacyTableTransfer: true,
});
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
const login = await client.login("admin", PASS);
if (login.status !== 200) throw new Error(`giriş ${login.status}`);
const store = app.store;
const counts = store.get("SELECT (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL) AS a, (SELECT COUNT(*) FROM plans WHERE deleted_at IS NULL) AS p, (SELECT COUNT(*) FROM cheques) AS c");
const upper = value => String(value).toLocaleUpperCase("tr-TR");
// Var olan, telefonlu, adı benzersiz cariler (rowid sırası; iki kod kökünde aynı veri → aynı satırlar).
const existing = store.all(
  "SELECT name, phone FROM accounts WHERE deleted_at IS NULL AND length(replace(replace(replace(phone, ' ', ''), '-', ''), '(', '')) >= 7 AND name IN (SELECT name FROM accounts WHERE deleted_at IS NULL GROUP BY name HAVING COUNT(*) = 1) ORDER BY rowid LIMIT 2600",
);
const fresh = (prefix, i) => `${prefix} Yenişehirli Çağlayan ${i}`;
const people = (n, prefix, offset) => {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    if (mode === "karma" && i % 2 === 0 && existing[offset + i / 2]) {
      const row = existing[offset + i / 2];
      out.push([upper(row.name), row.phone]);
    } else out.push([fresh(prefix, i), `0599 ${String(100000 + i).slice(0, 3)} ${String(i % 100).padStart(2, "0")} ${String((i * 7) % 100).padStart(2, "0")}`]);
  }
  return out;
};
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const r = v => Math.round(v * 10) / 10;
const results = {};
async function measure(label, call) {
  h.reset();
  const started = performance.now();
  const response = await call();
  const ms = performance.now() - started;
  const loop = h.max / 1e6;
  results[label] = { ms: r(ms), loop: r(loop), status: response.status };
  const data = response.data?.data || response.data || {};
  const summary = ["created", "updated", "linked", "accountsCreated", "skippedTotal"].filter(key => key in data).map(key => `${key}=${data[key]}`).join(" ");
  console.log(`${label}: durum ${response.status} · ${r(ms)} ms · olay döngüsü en çok ${r(loop)} ms · ${summary}${Array.isArray(data.skipped) ? ` skipped=${data.skipped.length}` : ""}`);
  if (response.status !== 200) console.log(`    yanıt: ${JSON.stringify(response.data).slice(0, 300)}`);
  return data;
}
console.log(`kod ${root} · iş yükü ${mode} · veri: ${counts.a} cari, ${counts.p} kart, ${counts.c} çek · aday ${existing.length} · yük ${load()}`);
// 1) cari Excel 2.000
await measure("cari-excel-2000", () => client.post("/api/workspace/accounts/import", { matrix: [["Ad Soyad", "Telefon"], ...people(2000, "Cari", 0)], headerAt: 0, roles: { 0: "name", 1: "phone" }, mode: "skip", fileName: "olc-cari.xlsx" }));
// 2) taksit Excel 2.000
await measure("taksit-excel-2000", () => client.post("/api/workspace/plans/import", {
  matrix: [["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"], ...people(2000, "Taksit", 1000).map(([name, phone]) => [name, phone, "1.200", "3", "01.11.2026"])],
  headerAt: 0, roles: { 0: "name", 1: "phone", 2: "total", 3: "count", 4: "firstDue" }, linkRecords: false, fileName: "olc-taksit.xlsx",
}));
// 3) çek / senet 500
await measure("cek-500", () => client.post("/api/workspace/cheques/import", {
  matrix: [["Çek No", "Banka", "Keşideci", "Tutar", "Vade"], ...people(500, "Çek", 2000).map(([name], i) => [`OLC-${i}`, "Ziraat", name, "750", "01.12.2026"])],
  headerAt: 0, roles: { 0: "serial", 1: "bank", 2: "drawer", 3: "amount", 4: "due" }, direction: "in", fileName: "olc-cek.xlsx",
}));
// 4) Tablodan Aktar 300 kayıt (tablo yüklemesi ölçüme girmez)
const tableRows = people(300, "Tablo", 2250).map(([name, phone], i) => [`T-${i}`, name, phone, 2400, 0, 2, "2026-11-01"]);
const staged = await client.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "olc-tablo.xlsx", sheets: [{ name: "Taksitler", matrix: [["Dosya No", "Ad Soyad", "Telefon", "Toplam Tutar", "Ödenen", "Taksit Sayısı", "İlk Vade"], ...tableRows] }] });
const stageId = (staged.data?.data || staged.data)?.stageId;
const committed = await client.post("/api/workspace/dataset/commit", { stageId, mode: "replace" });
if (committed.status !== 200) console.log(`tablo kaydı ${committed.status} ${JSON.stringify(committed.data).slice(0, 300)}`);
const preview = await measure("tablodan-aktar-onizleme", () => client.get("/api/workspace/plans/from-table"));
const keys = (preview.records || []).filter(item => item.selectable !== false && ["ready", "warning", "link", "closed"].includes(item.status)).map(item => item.key);
const matched = (preview.records || []).filter(item => item.account === "match").length;
console.log(`    ön izleme: ${(preview.records || []).length} kayıt, aktarılabilir ${keys.length}, eşleşen cari ${matched}`);
await measure("tablodan-aktar-aktarim", () => client.post("/api/workspace/plans/from-table", { keys, fingerprint: preview.fingerprint }));
console.log(`SONUC ${JSON.stringify({ root, mode, load: load(), results })}`);
await app.close?.();
process.exit(0);
