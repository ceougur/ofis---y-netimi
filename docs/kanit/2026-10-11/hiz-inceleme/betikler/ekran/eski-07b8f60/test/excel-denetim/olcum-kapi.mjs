// Ölçüm (2.0.22 madde 1/2): mutabakat kapısının (integrity.run) içinde her SQL'in süresi.
// Kullanım: SP=<çalışma klasörü (canli/ içinde)> node olcum-kapi.mjs
// Ölçüm (geçici): mutabakat denetiminin (integrity.run) içinde her SQL'in ve her bölümün süresi — gerçek veriyle.
import fs from "node:fs"; import path from "node:path";
import { startServer } from "./ortak.mjs";
const ROOT = path.join(process.env.SP, "canli");
const app = startServer(ROOT, { fresh: false }); await app.listen(0, "127.0.0.1");
const store = app.store;
const timing = new Map();
for (const name of ["all", "get"]) {
  const original = store[name];
  store[name] = (sql, ...args) => { const t = performance.now(); try { return original(sql, ...args); } finally { const k = sql.replace(/\s+/g, " ").slice(0, 150); const v = timing.get(k) || { ms: 0, n: 0 }; v.ms += performance.now() - t; v.n += 1; timing.set(k, v); } };
}
const runs = 5; const t0 = performance.now();
for (let i = 0; i < runs; i++) app.integrity.run();
const total = (performance.now() - t0) / runs;
const sqlTotal = [...timing.values()].reduce((s, v) => s + v.ms, 0) / runs;
console.log(`run(): ${total.toFixed(1)} ms/çağrı; SQL toplamı ${sqlTotal.toFixed(1)} ms; JS ${(total - sqlTotal).toFixed(1)} ms`);
for (const [k, v] of [...timing].sort((a, b) => b[1].ms - a[1].ms).slice(0, 25)) console.log(`${(v.ms / runs).toFixed(1).padStart(7)} ms  ×${String(v.n / runs).padStart(4)}  ${k}`);
const counts = ["invoices", "invoice_lines", "account_entries", "accounts", "plans", "plan_items", "plan_entries", "cash_entries", "stock_moves", "cheques", "cheque_events", "invoice_offsets"].map(t => `${t}=${store.get(`SELECT COUNT(*) AS n FROM ${t}`).n}`);
console.log(counts.join(" "));
await app.close();
