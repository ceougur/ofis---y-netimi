// AH: veri dosyasını salt okunur inceler (sürüm, satır sayıları, onarım adayı kartlar).
import { DatabaseSync } from "node:sqlite";
const file = process.argv[2];
const db = new DatabaseSync(file, { readOnly: true });
const one = sql => db.prepare(sql).get();
console.log("user_version", one("PRAGMA user_version"));
for (const t of ["accounts", "account_entries", "invoices", "plans", "plan_items", "plan_entries", "cheques", "cheque_events", "invoice_offsets", "cash_entries", "payments"]) {
  try { console.log(t, one(`SELECT COUNT(*) AS n FROM ${t}`).n); } catch (e) { console.log(t, "yok", e.message); }
}
const rows = db.prepare(`SELECT DISTINCT i.id, i.number, i.plan_id AS planId, i.account_id AS accountId FROM invoices i
      JOIN invoices r ON r.original_id = i.id AND r.kind = 'sale_return' AND r.status = 'issued'
      JOIN plans pl ON pl.id = i.plan_id AND pl.deleted_at IS NULL AND pl.status <> 'closed'
      WHERE i.status = 'issued' AND i.plan_id <> ''`).all();
console.log("onarım adayı fatura", rows.length, "ayrı cari", new Set(rows.map(r => r.accountId)).size);
console.log("indeksler", db.prepare("SELECT tbl_name, name, sql FROM sqlite_master WHERE type='index' AND tbl_name IN ('invoices','account_entries','cheque_events','cheques','invoice_offsets','plan_items','plans') ORDER BY tbl_name").all().map(r => `${r.tbl_name}: ${r.sql || r.name}`).join("\n"));
