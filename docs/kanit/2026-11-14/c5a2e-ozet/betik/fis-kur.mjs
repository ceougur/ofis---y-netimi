// K-m hazırlık (yeni kod): büyük veride kilit + Kural Farkı Düzeltme Fişi (programın vouchers.post'u ile; tür rule-diff-correction) + Açılış Eşleştirme Fişi (API).
// <kod kökü> <veri kökü> <bugün> <kilit>
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, today, lock] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: process.env.ESD_PASS || ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: { time: `${today}T12:00:00+03:00`, fixed: true }, moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
await client.login("admin", process.env.ESD_PASS || ADMIN_PASSWORD);
await app.ledger.snapshots.runPending();
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const lk = await client.put("/api/admin/period-lock", { lockedUntil: lock });
console.log("kilit", lk.status);
await app.ledger.snapshots.runPending();
const user = app.store.get("SELECT * FROM users WHERE username = 'admin'");
const next = new Date(`${lock}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
const v1 = app.store.tx(() => app.ledger.vouchers.post(user, { type: "rule-diff-correction", date: next.toISOString().slice(0, 10), description: "Ölçüm", source: "Kural Farkı Düzeltme", requestKey: "api:rule-diff:olcum-0000000001", lines: [{ account: "500", sub: "", debit: 100, credit: 0 }, { account: "519", sub: "", debit: 0, credit: 100 }] }));
console.log("düzeltme fişi", v1.noText || v1.id);
const g = unwrap(await client.get(`/api/admin/ledger/opening-match?date=${today}`));
console.log("519", g.balanceMinor / 100, g.disabled, g.code);
if (!g.disabled) {
  const amount = (Math.min(Math.abs(g.balanceMinor), 100000) / 100).toFixed(2);
  const m = await client.post("/api/admin/ledger/opening-match", { requestId: "olcum-eslestirme-0001", date: today, lines: [{ account: "500", side: g.balanceMinor < 0 ? "credit" : "debit", amount }], confirm: true });
  console.log("eşleştirme fişi", m.status, JSON.stringify(unwrap(m)).slice(0, 120));
}
const it = unwrap(await client.get("/api/workspace/ledger/integrity"));
console.log("Mutabakat:", it.ok, (it.failures || []).map(x => x.code).join(","));
await app.close();
