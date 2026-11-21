// S229 / S230 hız kabulü (ders 47, 53 (a)): değişen istekler — Açık Faturalar, Anlık Durum, Faturalar listesi (süzgeçsiz + 'Açık'), fatura ayrıntısı (kapsanan + sıradan),
// Faturalar PDF / Excel, Mahsup adayları. Kullanım: node olc-s229.mjs <kod kökü> <veri kopyası> <tekrar> → satırlar "ÖLÇÜM\t<yol>\t<ms>\t<olay döngüsü en çok ms>".
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "3"] = process.argv.slice(2);
const repeat = Number(repeatText) || 3;
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
const covered = store.get("SELECT i.id, i.account_id AS acc FROM invoices i JOIN plans p ON p.account_id = i.account_id AND p.covers_balance = 1 AND p.deleted_at IS NULL WHERE i.status = 'issued' AND i.kind = 'sale' AND i.plan_id = '' ORDER BY i.rowid LIMIT 1");
const plain = store.get("SELECT i.id FROM invoices i WHERE i.status = 'issued' AND i.kind = 'sale' AND i.plan_id = '' AND NOT EXISTS (SELECT 1 FROM plans p WHERE p.account_id = i.account_id AND p.covers_balance = 1) ORDER BY i.rowid DESC LIMIT 1");
const counts = store.get("SELECT (SELECT COUNT(*) FROM accounts) AS a, (SELECT COUNT(*) FROM account_entries) AS e, (SELECT COUNT(*) FROM invoices) AS i, (SELECT COUNT(*) FROM plans WHERE covers_balance = 1) AS c");
console.log(`kod ${root} · veri ${counts.a} cari, ${counts.e} cari satırı, ${counts.i} fatura, ${counts.c} Mevcut Borç kartı · kapsanan fatura ${covered?.id || "YOK"} · sıradan ${plain?.id || "YOK"} · yük ${load()}`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const r = v => Math.round(v * 10) / 10;
const timed = async (label, call) => {
  h.reset();
  const s = performance.now();
  const res = await call();
  const ms = performance.now() - s;
  console.log(`ÖLÇÜM\t${label}\t${r(ms)}\t${r(h.max / 1e6)}\t${res.status}`);
  return res;
};
const raw = url => client.raw("GET", url);
await timed("ilk: Açık Faturalar (soğuk)", () => client.get("/api/workspace/report-center/acik-faturalar"));
for (let i = 0; i < repeat; i += 1) {
  await timed("Açık Faturalar", () => client.get("/api/workspace/report-center/acik-faturalar"));
  await timed("Anlık Durum", () => client.get("/api/workspace/overview"));
  await timed("Faturalar listesi", () => client.get("/api/workspace/invoices?tab=all&limit=200"));
  await timed("Faturalar listesi 'Açık'", () => client.get("/api/workspace/invoices?tab=all&pay=open&limit=200"));
  if (covered) await timed("fatura ayrıntısı (kapsanan)", () => client.get(`/api/workspace/invoices/${covered.id}`));
  if (plain) await timed("fatura ayrıntısı (sıradan)", () => client.get(`/api/workspace/invoices/${plain.id}`));
  if (covered) await timed("Mahsup adayları (kapsanan)", () => client.get(`/api/workspace/invoices/${covered.id}/offsets`));
  await timed("Faturalar Excel", () => raw("/api/workspace/invoices/export.xlsx?tab=all"));
  await timed("Faturalar PDF", () => raw("/api/workspace/invoices/liste.pdf?tab=all"));
  await timed("Açık Faturalar PDF", () => raw("/api/workspace/report-center/acik-faturalar/pdf"));
}
console.log(`yük (sonda) ${load()}`);
await app.close();
