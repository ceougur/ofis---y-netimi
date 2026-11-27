// M2 hız kabulü (ders 47, 53 (a)): Değersiz sınırının değiştirdiği yollar — şüpheli kayıt listesi, cari kartı, formun sınır ucu (yalnız yeni), Değersiz Yaz, Değersiz sil +
// Silinenler'den geri yükleme. Temiz 100 bin kopyası, şüpheli kaydı EN ÇOK olan cari. Önce / sonra aynı veri kopyasından (her kod taze kopyada).
// Kullanım: flock -x -w 1800 <olcum.lock> node olc-m2.mjs <kod kökü> <veri kopyası> [tekrar=5]
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "5"] = process.argv.slice(2);
const repeat = Number(repeatText) || 5;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
console.log(`kod ${root} · veri ${dir} · yük (başta) ${load()}`);
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
const party = store.get("SELECT d.account_id AS id, COUNT(*) AS n FROM doubtful_receivables d JOIN accounts a ON a.id = d.account_id WHERE a.deleted_at IS NULL AND d.status <> 'cancelled' GROUP BY d.account_id ORDER BY n DESC LIMIT 1");
const rows = store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", party.id).n;
console.log(`ölçülen cari ${party.id}: ${party.n} şüpheli kaydı, ${rows} cari satırı`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const r = v => Math.round(v * 10) / 10;
const samples = new Map();
const timed = async (label, call) => {
  h.reset();
  const s = performance.now();
  const res = await call();
  const ms = performance.now() - s;
  if (!samples.has(label)) samples.set(label, []);
  samples.get(label).push(ms);
  console.log(`  ${label}: ${res.status} · ${r(ms)} ms · olay döngüsü en çok ${r(h.max / 1e6)} ms`);
  return res;
};
const ACC = `/api/workspace/accounts/${party.id}`;
await client.get(ACC);
await client.get(`${ACC}/doubtful`);
for (let i = 0; i < repeat; i += 1) {
  console.log(`tur ${i + 1} · yük ${load()}`);
  const list = await timed("şüpheli kayıt listesi", () => client.get(`${ACC}/doubtful`));
  await timed("cari kartı", () => client.get(ACC));
  const records = list.data?.data?.records || [];
  const open = records.find(item => item.status === "open" && (item.writeOff ? item.writeOff.anyMinor > 0 && item.writeOff.today?.limitMinor > 100 : item.remainingMinor > 100));
  if (!open) {
    console.log("  açık kayıt kalmadı");
    break;
  }
  const quote = await timed("form sınır ucu (yalnız yeni kod)", () => client.get(`${ACC}/doubtful/${open.id}/write-off?date=2026-10-08`));
  const wo = await timed("YAZIM Değersiz Yaz", () => client.post(`${ACC}/doubtful/${open.id}/write-off`, { amount: "1", date: "2026-10-08", note: "ölçüm" }));
  if (wo.status !== 200) {
    console.log("  RED", JSON.stringify(wo.data).slice(0, 200));
    continue;
  }
  const entryId = store.get("SELECT id FROM account_entries WHERE source = 'doubtful' AND source_id = ? ORDER BY rowid DESC LIMIT 1", open.id).id;
  await client.del(`${ACC}/doubtful/${open.id}/write-offs/${entryId}`);
  const trash = (await client.get("/api/admin/trash")).data?.data || [];
  const item = trash.find(row => row.kind === "doubtful-writeoff" && row.ref === entryId);
  const back = await timed("YAZIM Silinenler'den geri yükleme", () => client.post("/api/admin/trash/restore", { id: item.id }));
  if (back.status !== 200) console.log("  RED geri yükleme", JSON.stringify(back.data).slice(0, 200));
  void quote;
}
console.log("ORTANCA (ms):");
for (const [label, list] of samples) {
  const sorted = [...list].sort((a, b) => a - b);
  console.log(`  ${label}: ${r(sorted[Math.floor(sorted.length / 2)])} (n=${list.length}, en az ${r(sorted[0])}, en çok ${r(sorted.at(-1))})`);
}
console.log(`yük (sonda) ${load()}`);
await app.close();
