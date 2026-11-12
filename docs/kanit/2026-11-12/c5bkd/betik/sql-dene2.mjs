// Yalnız okuma: chequeLinkMoments'in tek cari sorgusu — bugünkü yazım ↔ carinin kendi evrak satırlarından süren yazım. BÜTÜN carilerde: carinin defter satırları için
// (account_entries.id, account_id = cari) iki haritanın verdiği an birebir aynı mı + süre.
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2], { readOnly: true });
const COLS = `SELECT ev.effects_json AS effects, ev.created_at AS created,
           (SELECT MAX(a.created_at) FROM audit_events a WHERE a.entity_id = ev.cheque_id AND a.type = 'cheque.updated' AND json_extract(a.payload_json, '$.invoiceId') IS NOT NULL) AS changed`;
const OLD = db.prepare(`${COLS} FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id WHERE ev.kind IN ('receive', 'issue') AND ev.invoice_id <> '' AND (c.account_id = ? OR c.endorse_account_id = ? OR ev.account_id = ?)`);
const NEWSQL = `${COLS} FROM (SELECT DISTINCT source_id AS id FROM account_entries WHERE account_id = ?1 AND +source = 'cheque') own CROSS JOIN cheque_events ev ON ev.cheque_id = own.id CROSS JOIN cheques c ON c.id = ev.cheque_id WHERE +ev.kind IN ('receive', 'issue') AND ev.invoice_id <> '' AND (c.account_id = ?1 OR c.endorse_account_id = ?1 OR ev.account_id = ?1)`;
const NEW = db.prepare(NEWSQL);
console.log(`PLAN yeni: ${db.prepare(`EXPLAIN QUERY PLAN ${NEWSQL}`).all("x").map(r => r.detail).join(" ; ")}`);
const mapOf = rows => {
  const out = new Map();
  for (const row of rows) {
    const at = String(row.changed || "") > String(row.created || "") ? String(row.changed) : String(row.created || "");
    if (!at) continue;
    const effects = JSON.parse(row.effects || "[]");
    for (const effect of Array.isArray(effects) ? effects : []) if (effect?.table === "account_entries" && effect.id) out.set(effect.id, at);
  }
  return out;
};
const lines = db.prepare("SELECT id FROM account_entries WHERE account_id = ?");
let accounts = 0, asked = 0, hits = 0, differ = 0, oldMs = 0, newMs = 0, oldRows = 0, newRows = 0;
for (const { id } of db.prepare("SELECT id FROM accounts").all()) {
  accounts += 1;
  let s = performance.now();
  const a = OLD.all(id, id, id);
  oldMs += performance.now() - s;
  s = performance.now();
  const b = NEW.all(id);
  newMs += performance.now() - s;
  oldRows += a.length; newRows += b.length;
  const ma = mapOf(a), mb = mapOf(b);
  for (const line of lines.all(id)) {
    asked += 1;
    if (ma.has(line.id)) hits += 1;
    if (ma.has(line.id) !== mb.has(line.id) || ma.get(line.id) !== mb.get(line.id)) differ += 1;
  }
}
console.log(`cari ${accounts} · sorulan defter satırı ${asked} · haritada olan ${hits} · FARKLI ${differ} · satır eski ${oldRows} / yeni ${newRows} · süre cari başına eski ${(oldMs / accounts).toFixed(2)} ms / yeni ${(newMs / accounts).toFixed(3)} ms`);
