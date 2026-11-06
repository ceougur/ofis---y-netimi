// Deney: node:sqlite satırlarının bellek maliyeti (all() ↔ iterate() + kopya). node --expose-gc deney-satir-bellek.mjs <dosya> <kip>
import { DatabaseSync } from "node:sqlite";
const [file, mode] = process.argv.slice(2);
const db = new DatabaseSync(file, { readOnly: true });
const sql = `SELECT e.id, e.rowid AS seq, e.kind, e.amount, e.date, e.note, e.source, e.source_id AS sourceId, e.method, e.fin_ref AS ref, a.type AS accountType, e.account_id AS party,
  COALESCE(c.direction, '') AS chequeDirection, COALESCE(c.instrument, '') AS chequeInstrument, COALESCE(m.reason, '') AS moveReason, 0 AS bankReturned, e.invoice_id AS invoiceId, e.doubtful_skip AS doubtfulSkip
  FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL LEFT JOIN cheques c ON e.source = 'cheque' AND c.id = e.source_id LEFT JOIN stock_moves m ON e.source = 'stock' AND m.id = e.source_id`;
const heap = () => {
  globalThis.gc();
  globalThis.gc();
  return process.memoryUsage().heapUsed;
};
const base = heap();
const t0 = performance.now();
let rows;
const stmt = db.prepare(sql);
if (mode === "all") rows = stmt.all();
else if (mode === "spread") {
  rows = [];
  for (const row of stmt.iterate()) rows.push({ ...row });
} else if (mode === "assign") {
  rows = [];
  let keys = null;
  for (const row of stmt.iterate()) {
    keys ??= Object.keys(row);
    const out = {};
    for (const key of keys) out[key] = row[key];
    rows.push(out);
  }
} else if (mode === "arrays") {
  stmt.setReturnArrays(true);
  rows = stmt.all();
}
const ms = performance.now() - t0;
const used = heap() - base;
console.log(`${mode}: ${rows.length} satır, ${Math.round(used / 1048576)} MB, satır başına ${Math.round(used / rows.length)} bayt, ${Math.round(ms)} ms; örnek anahtar sayısı ${Object.keys(rows[0]).length}`);
