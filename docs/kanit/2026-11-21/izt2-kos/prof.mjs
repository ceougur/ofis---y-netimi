// İş 3 (Düzenle azaltma hızı) — CPU profili: node prof.mjs <kod kökü> <veri kopyası> <çıktı .cpuprofile>
// Aday seçimi hiz.mjs ile AYNI (kalabalık caride kapsayan kartı olan taksitsiz satış faturası); önce aynı içerik Düzenle (ısınma), sonra azaltma profillenir.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Session } from "node:inspector/promises";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, outFile] = process.argv.slice(2);
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
const W = "/api/workspace";
const body = res => (res.data && typeof res.data === "object" && "ok" in res.data ? (res.data.ok ? res.data.data : res.data) : res.data);
const s = app.store;
const c = s.get(`SELECT i.id AS inv, p.id AS plan, i.account_id AS acc, (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = i.account_id) AS n
  FROM invoices i JOIN plans p ON p.account_id = i.account_id AND p.deleted_at IS NULL AND p.status = 'active' AND p.covers_balance = 1 AND p.invoice_id = ''
  WHERE i.status = 'issued' AND i.kind = 'sale' AND i.plan_id = '' AND COALESCE(NULLIF(i.issued_at, ''), i.created_at) <= p.created_at
    AND NOT EXISTS (SELECT 1 FROM invoices r WHERE r.original_id = i.id AND r.status = 'issued')
  GROUP BY i.account_id ORDER BY n DESC LIMIT 1`);
const doc = body(await client.get(`${W}/invoices/${encodeURIComponent(c.inv)}`));
const payment = { cash: (doc.payment?.cash || []).map(x => ({ amount: String(x.amount), method: x.method, lineKey: x.lineKey, bankAccountId: x.bankAccountId || "" })), cheques: [], endorse: [], rest: "account", dueDate: doc.dueDate || "" };
const lines = (doc.lines || []).map(l => ({ itemId: l.itemId || "", code: l.code || "", name: l.name, unit: l.unit, qty: l.qty, unitPrice: l.unitPrice, discountRate: l.discountRate || 0, vatRate: l.vatRate, withholdingCode: l.withholdingCode || "", exemptionCode: l.exemptionCode || "" }));
const send = ls => client.post(`${W}/invoices/${encodeURIComponent(c.inv)}/edit`, { scenario: doc.scenario, accountId: c.acc, issueDate: doc.issueDate, issueTime: doc.issueTime, profile: doc.profile, pricesIncludeVat: doc.pricesIncludeVat, lines: ls, payment, note: doc.note || "", force: true });
let t = performance.now();
const same = await send(lines);
console.log(`aday cari ${c.acc} satır ${c.n} · aynı içerik ${same.status} ${(performance.now() - t).toFixed(0)} ms`);
const big = lines.findIndex(l => Number(l.qty) >= 2);
const less = lines.map((l, i) => (i === big ? { ...l, qty: Number(l.qty) - 1 } : l));
const session = new Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.setSamplingInterval", { interval: 200 });
await session.post("Profiler.start");
t = performance.now();
const r = await send(less);
const ms = performance.now() - t;
const { profile } = await session.post("Profiler.stop");
console.log(`azaltma ${r.status} ${ms.toFixed(0)} ms ${r.status !== 200 ? JSON.stringify(r.data).slice(0, 300) : ""}`);
writeFileSync(outFile, JSON.stringify(profile));
// Özet: işlev başına öz süre ve kapsayıcı süre (ad + dosya:satır).
const byId = new Map(profile.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const ch of n.children || []) parent.set(ch, n.id);
const self = new Map();
const dt = profile.timeDeltas;
const counts = new Map();
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
const key = n => `${n.callFrame.functionName || "(anon)"} ${String(n.callFrame.url).replace(/^.*\/(server|node_modules)\//, "$1/")}:${n.callFrame.lineNumber + 1}`;
const incl = new Map();
for (const [id, us] of counts) {
  const n = byId.get(id);
  self.set(key(n), (self.get(key(n)) || 0) + us);
  const seen = new Set();
  let cur = id;
  while (cur !== undefined) {
    const k = key(byId.get(cur));
    if (!seen.has(k)) {
      seen.add(k);
      incl.set(k, (incl.get(k) || 0) + us);
    }
    cur = parent.get(cur);
  }
}
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => `${(us / 1000).toFixed(0).padStart(6)} ms  ${k}`).join("\n");
console.log("ÖZ SÜRE (ilk 25):\n" + top(self, 25));
console.log("KAPSAYICI (server/, ilk 45):\n" + top(new Map([...incl].filter(([k]) => k.includes("server/"))), 45));
await app.close();
