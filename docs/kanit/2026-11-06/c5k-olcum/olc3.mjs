// Ç5-K ölçüm 3 (ders 47): Mutabakat Testi tam taramasında yeni "cash-opening" bölümünün süresi (integrity.stats().run.sections) — 100.000+ nakit satırlı kopya.
// açılışsız / açılış 2000-01-01 (önce satır yok) / açılış ortada (çok sayıda önce satır).
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, dir] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false, gateVerify: false, legacyCasePayments: true,
});
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
async function run(label) {
  for (let i = 0; i < 3; i += 1) {
    const t = performance.now();
    const r = await client.get("/api/workspace/ledger/integrity");
    const ms = performance.now() - t;
    const s = app.integrity.stats().run;
    const c = (r.data?.data || r.data)?.checks?.find(x => x.code === "cash:before-opening");
    console.log(`${label} #${i + 1}: ${r.status} · istek ${Math.round(ms)} ms · tarama ${Math.round(s?.ms ?? NaN)} ms · cash-opening bölümü ${(s?.sections?.["cash-opening"] ?? NaN).toFixed(1)} ms · uyarı ${c?.count ?? 0}`);
  }
}
await run("AÇILIŞSIZ");
const r = await client.post("/api/workspace/cash/opening", { amount: "1.000", date: "2000-01-01" });
console.log(`açılış 2000-01-01: ${r.status}`);
await run("AÇILIŞ 2000-01-01");
const mid = app.store.get("SELECT date AS d FROM cash_entries WHERE method = 'cash' AND is_opening = 0 ORDER BY date LIMIT 1 OFFSET (SELECT COUNT(*) / 2 FROM cash_entries WHERE method = 'cash' AND is_opening = 0)").d;
app.store.run("UPDATE cash_entries SET date = ? WHERE is_opening = 1", mid);
console.log(`açılış tarihi doğrudan ${mid} yapıldı (önce satırlar eski veri gibi; R8 denetimi API'de)`);
await run(`AÇILIŞ ${mid}`);
await app.close();
