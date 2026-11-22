// Teşhis: kart penceresi GET (yazımdan hemen sonra) ve iade yazımı — CPU profili. node hiz3.mjs <kod> <kopya> <çıktı.cpuprofile>
import { writeFileSync } from "node:fs";
import path from "node:path";
import { Session } from "node:inspector/promises";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, outFile] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false });
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
await client.login("admin", PASS);
const W = "/api/workspace";
const body = res => (res.data && typeof res.data === "object" && "ok" in res.data ? (res.data.ok ? res.data.data : res.data) : res.data);
const cands = app.store.all(`SELECT i.id AS inv, p.id AS plan, i.account_id AS acc, (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = i.account_id) AS n
  FROM invoices i JOIN plans p ON p.account_id = i.account_id AND p.deleted_at IS NULL AND p.status = 'active' AND p.covers_balance = 1 AND p.invoice_id = ''
  WHERE i.status = 'issued' AND i.kind = 'sale' AND i.plan_id = '' AND COALESCE(NULLIF(i.issued_at, ''), i.created_at) <= p.created_at
    AND NOT EXISTS (SELECT 1 FROM invoices r WHERE r.original_id = i.id AND r.status = 'issued')
  GROUP BY i.account_id ORDER BY n DESC LIMIT 12`);
const session = new Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.setSamplingInterval", { interval: 100 });
const times = { get: [], ret: [] };
await session.post("Profiler.start");
for (const c of cands.slice(0, 8)) {
  await client.post(`${W}/accounts/${encodeURIComponent(c.acc)}/entries`, { kind: "debt", amount: "1", date: "2026-10-08", note: "teşhis" });
  let t = performance.now();
  await client.get(`${W}/plans/${encodeURIComponent(c.plan)}`);
  times.get.push(performance.now() - t);
  const doc = body(await client.get(`${W}/invoices/${encodeURIComponent(c.inv)}`)) || {};
  const item = (doc.returnable || []).find(row => Number(row.left) > 0);
  if (!item) continue;
  t = performance.now();
  const r = await client.post(`${W}/invoices`, { kind: "sale_return", accountId: c.acc, originalId: c.inv, issueDate: "2026-10-08", lines: [{ originLineId: item.lineId || item.id || item.originLineId, qty: Math.min(1, Number(item.left)) }], payment: { cash: [] }, force: true });
  times.ret.push(performance.now() - t);
  if (r.status !== 200) console.log("iade", r.status);
}
const { profile } = await session.post("Profiler.stop");
writeFileSync(outFile, JSON.stringify(profile));
const med = a => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)]?.toFixed(1);
console.log(`kart penceresi GET ortanca ${med(times.get)} ms (n ${times.get.length}) · iade yazımı ortanca ${med(times.ret)} ms (n ${times.ret.length})`);
const byId = new Map(profile.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const ch of n.children || []) parent.set(ch, n.id);
const counts = new Map();
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (profile.timeDeltas[i] || 0)));
const key = n => `${n.callFrame.functionName || "(anon)"} ${String(n.callFrame.url).replace(/^.*\/(server)\//, "$1/")}:${n.callFrame.lineNumber + 1}`;
const incl = new Map();
for (const [id, us] of counts) {
  const seen = new Set();
  for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
    const k = key(byId.get(cur));
    if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + us); }
  }
}
console.log([...incl].filter(([k]) => k.includes("server/")).sort((a, b) => b[1] - a[1]).slice(0, 45).map(([k, us]) => `${(us / 1000).toFixed(0).padStart(6)} ms  ${k}`).join("\n"));
await app.close();
