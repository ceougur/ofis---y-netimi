// Ç5-K ölçümü (ders 47): Kasa açılış denetimi her nakit yazımında COMMIT'te çalışır — 100.000+ nakit satırlı şirkette tek yazımın süresi ve olay döngüsü,
// açılışsız ve açılışlı. Aynı veri kopyasıyla önce (f5903164) / sonra (HEAD). Kullanım:
//   HUKUK_LICENSE_URL=http://127.0.0.1:9 flock <olcum.lock> node olc.mjs <kod kökü> <veri klasörü (kopya)> <tekrar>
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const [root, dir, repeatText = "30"] = process.argv.slice(2);
const repeat = Number(repeatText) || 30;
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const t0 = performance.now();
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false, gateVerify: false, legacyCasePayments: true,
});
const { port } = await app.listen(0, "127.0.0.1");
console.log(`kod ${root} · açılış ${Math.round(performance.now() - t0)} ms`);
const client = createClient(`http://127.0.0.1:${port}`);
const login = await client.login("admin", PASS);
if (login.status !== 200) throw new Error(`giriş ${login.status}`);
const store = app.store;
const count = sql => store.get(sql).n;
console.log(`nakit satırı: cash_entries ${count("SELECT COUNT(*) AS n FROM cash_entries WHERE method = 'cash'")} · cari ${count("SELECT COUNT(*) AS n FROM account_entries WHERE method = 'cash' AND kind IN ('in','out')")} · kayıt ${count("SELECT COUNT(*) AS n FROM payments WHERE method = 'cash'")} · taksit ${count("SELECT COUNT(*) AS n FROM plan_entries WHERE method = 'cash'")} · stok ${count("SELECT COUNT(*) AS n FROM stock_moves WHERE method = 'cash' AND pay = 'cash'")} · çek ${count("SELECT COUNT(*) AS n FROM cheque_events WHERE method = 'cash'")}`);
const account = store.get("SELECT a.id FROM accounts a WHERE a.deleted_at IS NULL AND a.type = 'customer' ORDER BY (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = a.id), a.rowid LIMIT 1").id; // en az hareketli cari: yanıt (cari kartı) küçük, ölçülen yazım
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
async function measure(label, call) {
  const times = [];
  const loops = [];
  let status = 0;
  for (let i = 0; i < repeat; i += 1) {
    h.reset();
    const started = performance.now();
    const response = await call(i);
    times.push(performance.now() - started);
    loops.push(h.max / 1e6);
    status = response.status;
    if (status !== 200) throw new Error(`${label}: ${status} ${JSON.stringify(response.data).slice(0, 300)}`);
  }
  const sorted = times.slice().sort((a, b) => a - b);
  const q = p => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
  console.log(`${label}: ${repeat} istek · ilk ${times[0].toFixed(1)} ms · medyan ${q(0.5).toFixed(1)} ms · p95 ${q(0.95).toFixed(1)} ms · olay döngüsü en çok ${Math.max(...loops).toFixed(1)} ms`);
}
const kasa = i => client.post("/api/workspace/cash", { kind: "in", amount: "1", date: "2026-10-07", description: `ölçüm ${i}`, method: "cash" });
const cari = i => client.post(`/api/workspace/accounts/${account}/entries`, { kind: "in", amount: "1", date: "2026-10-07", method: "cash", note: `ölçüm ${i}`, cashForce: true });
const kayit = i => client.post("/api/workspace/cases/OLCUM-1/payments", { amount: "1", date: "2026-10-07", method: "cash", note: `ölçüm ${i}`, caseTitle: "Ölçüm" });
await measure("AÇILIŞSIZ Kasa Giriş", kasa);
await measure("AÇILIŞSIZ cari nakit tahsilat", cari);
await measure("AÇILIŞSIZ kayıt nakit tahsilatı", kayit);
const first = store.get("SELECT MIN(date) AS d FROM cash_entries WHERE method = 'cash'").d;
const opened = await client.post("/api/workspace/cash/opening", { amount: "1.000", date: "2000-01-01" });
console.log(`açılış 2000-01-01 (ilk Kasa satırı ${first}): ${opened.status}`);
await measure("AÇILIŞLI Kasa Giriş", kasa);
await measure("AÇILIŞLI cari nakit tahsilat", cari);
await measure("AÇILIŞLI kayıt nakit tahsilatı", kayit);
h.reset();
const it0 = performance.now();
const integrity = await client.get("/api/workspace/ledger/integrity");
console.log(`Mutabakat Testi (tam tarama): ${integrity.status} · ${Math.round(performance.now() - it0)} ms · olay döngüsü en çok ${(h.max / 1e6).toFixed(0)} ms · uyarı ${JSON.stringify((integrity.data?.data || integrity.data)?.checks?.find(x => x.code === "cash:before-opening")?.count ?? null)}`);
h.disable();
await app.close();
