// Yalnız okuma: chequeLinkMoments sorgusunun iki yazımı — plan + süre + sonuç eşitliği (veri kopyası).
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2], { readOnly: true });
const acc = db.prepare("SELECT id FROM accounts WHERE deleted_at IS NULL AND type = 'customer' ORDER BY rowid LIMIT 1 OFFSET 10").get().id;
const busy = db.prepare("SELECT account_id AS id FROM cheques GROUP BY account_id ORDER BY COUNT(*) DESC LIMIT 1").get().id;
console.log(`çek olayları: ${JSON.stringify(db.prepare("SELECT COUNT(*) AS hepsi, SUM(invoice_id <> '') AS bagli, SUM(kind IN ('receive','issue')) AS ilk, SUM(account_id <> '') AS carili FROM cheque_events").get())} · NULL invoice_id ${db.prepare("SELECT COUNT(*) AS n FROM cheque_events WHERE invoice_id IS NULL").get().n}`);
const SEL = `SELECT ev.effects_json AS effects, ev.created_at AS created,
           (SELECT MAX(a.created_at) FROM audit_events a WHERE a.entity_id = ev.cheque_id AND a.type = 'cheque.updated' AND json_extract(a.payload_json, '$.invoiceId') IS NOT NULL) AS changed
         FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id`;
const variants = {
  bugun: `${SEL} WHERE ev.kind IN ('receive', 'issue') AND ev.invoice_id <> '' AND (c.account_id = ? OR c.endorse_account_id = ? OR ev.account_id = ?)`,
  dizin: `${SEL} WHERE ev.kind IN ('receive', 'issue') AND ev.invoice_id > '' AND (c.account_id = ? OR c.endorse_account_id = ? OR ev.account_id = ?)`,
};
for (const id of [acc, busy]) {
  const results = {};
  for (const [name, sql] of Object.entries(variants)) {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(id, id, id).map(r => r.detail).join(" ; ");
    const st = db.prepare(sql);
    const times = [];
    let rows = [];
    for (let i = 0; i < 9; i += 1) { const s = performance.now(); rows = st.all(id, id, id); times.push(performance.now() - s); }
    times.sort((a, b) => a - b);
    results[name] = JSON.stringify(rows.map(r => `${r.created}|${r.changed}|${r.effects}`).sort());
    console.log(`${name} · cari ${id.slice(0, 20)} · ${rows.length} satır · en iyi ${times[0].toFixed(2)} ms · ortanca ${times[4].toFixed(2)} ms\n   PLAN ${plan}`);
  }
  console.log(`   sonuçlar eşit: ${results.bugun === results.dizin}`);
}
