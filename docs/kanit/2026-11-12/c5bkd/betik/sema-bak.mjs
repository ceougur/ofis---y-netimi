// Yalnız okuma: veri kopyasındaki çek / cari / iz tablolarının satır sayıları ve dizinleri (hız tanısı).
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2], { readOnly: true });
for (const t of ["cheque_events", "cheques", "account_entries", "audit_events", "plans", "plan_items", "invoices"]) {
  const n = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  const idx = db.prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ?`).all(t).map(r => r.sql ? r.sql.replace(/^CREATE (UNIQUE )?INDEX (IF NOT EXISTS )?/, "") : r.name);
  console.log(`${t}: ${n} satır · dizinler: ${idx.join(" | ")}`);
}
const q = process.argv[3];
if (q) for (const row of db.prepare(`EXPLAIN QUERY PLAN ${q}`).all(...process.argv.slice(4))) console.log(`  PLAN ${row.detail}`);
