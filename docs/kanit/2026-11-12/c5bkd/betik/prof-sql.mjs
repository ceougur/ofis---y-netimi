// Ç5-B kapanış düzeltmesi madde 5 — TANI (kabul ölçümü DEĞİL): bir isteğin içindeki SQL sürelerinin dökümü (store.all / get / run sarılır).
// Kullanım: node prof-sql.mjs <kod kökü> <veri kopyası> [borc|zil|zililk|kart] [tekrar]
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, what = "borc", repeatText = "4"] = process.argv.slice(2);
const repeat = Number(repeatText) || 4;
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
const acc = new Map();
let on = false;
for (const name of ["all", "get", "run", "exec"]) {
  const original = store[name]?.bind(store);
  if (!original) continue;
  store[name] = (sql, ...args) => {
    if (!on) return original(sql, ...args);
    const s = performance.now();
    try { return original(sql, ...args); } finally {
      const key = `${name} ${String(sql).replace(/\s+/g, " ").slice(0, 150)}`;
      const row = acc.get(key) || { ms: 0, n: 0 };
      row.ms += performance.now() - s; row.n += 1;
      acc.set(key, row);
    }
  };
}
const RANGE = "from=2026-01-01&to=2027-12-31";
await client.get("/api/workspace/accounts?status=all&limit=50");
await client.get(`/api/workspace/overview/vade-takip?${RANGE}`);
await client.get("/api/workspace/dues");
const other = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND type = 'customer' ORDER BY rowid LIMIT 1 OFFSET 10").id;
const plan = store.get("SELECT p.id FROM plans p WHERE p.deleted_at IS NULL AND p.status = 'active' AND p.account_id <> '' ORDER BY (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = p.account_id) DESC LIMIT 1");
const ms = [];
for (let i = 0; i < repeat; i += 1) {
  if (what === "zil" || what === "kart") { on = false; await client.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "10", date: "2026-10-08", method: "cash", cashForce: true }); }
  on = true;
  const s = performance.now();
  const res = what === "borc" ? await client.post(`/api/workspace/accounts/${other}/entries`, { kind: "debt", amount: "1", date: "2026-10-08", note: `hız ${i}` })
    : what === "kart" ? await client.get(`/api/workspace/plans/${plan.id}`)
    : await client.get("/api/workspace/dues");
  ms.push(performance.now() - s);
  on = false;
  if (res.status !== 200) throw new Error(`${what} ${res.status}`);
}
console.log(`kod ${root}\n${what} × ${repeat}: ${ms.map(r).join(" ")} ms`);
const total = [...acc.values()].reduce((a, b) => a + b.ms, 0);
console.log(`SQL toplam ${r(total / repeat)} ms/çağrı`);
for (const [key, row] of [...acc.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 14)) console.log(`${String(r(row.ms / repeat)).padStart(7)} ms/çağrı · ${r(row.n / repeat)} kez · ${key}`);
await app.close();
