// Ç5-B kapanış düzeltmesi madde 5 — PROFİL (kabul ölçümü DEĞİL): ılık zil / takvim ve Borç Yaz; --cpu-prof ile koşulur.
// Kullanım: node --cpu-prof --cpu-prof-dir=<klasör> prof-zil.mjs <kod kökü> <veri kopyası> [zil|borc|hepsi] [tekrar]
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, what = "hepsi", repeatText = "8"] = process.argv.slice(2);
const repeat = Number(repeatText) || 8;
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
const r = v => Math.round(v * 10) / 10;
const stats = list => { const s = [...list].sort((a, b) => a - b); return `en iyi ${r(s[0])} · ortanca ${r(s[Math.floor(s.length / 2)])} · en kötü ${r(s[s.length - 1])}`; };
console.log(`kod ${root} · yük ${load()}`);
const first = await client.get("/api/workspace/dues");
const d0 = first.data?.data || first.data;
const bySource = {};
const bytesBy = {};
for (const item of d0.items || []) {
  const k = item.source || "tablo";
  bySource[k] = (bySource[k] || 0) + 1;
  bytesBy[k] = (bytesBy[k] || 0) + JSON.stringify(item).length;
}
console.log(`zil ilk: ${first.status} · kalem ${d0.items?.length} ${JSON.stringify(bySource)} · bayt ${JSON.stringify(bytesBy)} · son tarih ${d0.deadlines?.length} · yanıt ${JSON.stringify(first.data).length} bayt · sürüm ${d0.version}`);
console.log(`örnek kalem alanları: ${JSON.stringify(Object.fromEntries(Object.keys(bySource).map(k => [k, Object.keys((d0.items || []).find(i => (i.source || "tablo") === k)).join(",")])))}`);
if (what !== "borc") {
  const ms = [];
  for (let i = 0; i < repeat; i += 1) { const s = performance.now(); await client.get("/api/workspace/dues"); ms.push(performance.now() - s); }
  console.log(`ILIK ZİL × ${repeat}: ${stats(ms)} ms · ${ms.map(r).join(" ")}`);
}
if (what !== "zil") {
  const other = (store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND type = 'customer' ORDER BY rowid LIMIT 1 OFFSET 10")).id;
  const ms = [];
  for (let i = 0; i < repeat; i += 1) {
    const s = performance.now();
    const res = await client.post(`/api/workspace/accounts/${other}/entries`, { kind: "debt", amount: "1", date: "2026-10-08", note: `hız ${i}` });
    ms.push(performance.now() - s);
    if (res.status !== 200) throw new Error(`Borç Yaz ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  }
  console.log(`BORÇ YAZ × ${repeat}: ${stats(ms)} ms · ${ms.map(r).join(" ")}`);
}
console.log(`yük (sonda) ${load()}`);
await app.close();
