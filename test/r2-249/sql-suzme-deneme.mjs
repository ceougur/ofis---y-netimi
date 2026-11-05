// 2.4.9 R2 tasarım ön ölçümü (ürün kodu değil): eski tam tarama + JSON.parse ↔ kart kimliğiyle SQL'de süzülmüş sorgu (instr; JSON kaçışı varsa satır yine okunur),
// çağrı başına süre — süzme seçeneği bu ölçümle elendi (1.310 kartlı caride ~2 sn). Veri kopyası salt okunur açılır.
// Kullanım: node test/r2-249/sql-suzme-deneme.mjs <şirket veri dosyası kopyası (destekofis.sqlite)>
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2], { readOnly: true });
const n = s => db.prepare(s).get();
console.log(n("SELECT COUNT(*) AS n FROM invoices"), n("SELECT COUNT(*) AS n FROM invoices WHERE kind='sale_return'"), n("SELECT COUNT(*) AS n FROM plans"), n("SELECT COUNT(DISTINCT account_id) AS n FROM plans WHERE deleted_at IS NULL"), n("SELECT AVG(length(payment_json)) AS L, MAX(length(payment_json)) AS M FROM invoices WHERE kind='sale_return'"));
console.log(n("SELECT payment_json AS j FROM invoices WHERE kind='sale_return' AND payment_json LIKE '%coverCuts%' LIMIT 1"));
console.log("ters bölülü iade", n("SELECT COUNT(*) AS n FROM invoices WHERE kind='sale_return' AND instr(payment_json, char(92)) > 0"));
const BASE = "SELECT payment_json AS j FROM invoices WHERE kind = 'sale_return' AND status = 'issued' AND payment_json LIKE '%coverCuts%'";
const FILT = `${BASE} AND (instr(payment_json, char(92)) > 0 OR EXISTS (SELECT 1 FROM json_each(?) AS w WHERE instr(invoices.payment_json, w.value) > 0))`;
console.log("plan eski:", db.prepare(`EXPLAIN QUERY PLAN ${BASE}`).all().map(r => r.detail).join(" | "));
console.log("plan yeni:", db.prepare(`EXPLAIN QUERY PLAN ${FILT}`).all("[]").map(r => r.detail).join(" | "));
const plans = db.prepare("SELECT id, account_id AS a FROM plans WHERE deleted_at IS NULL").all();
const byAcc = new Map();
for (const p of plans) {
  if (!byAcc.has(p.a)) byAcc.set(p.a, []);
  byAcc.get(p.a).push(p.id);
}
const accs = [...byAcc.keys()];
const full = db.prepare(BASE);
let t = performance.now();
for (let i = 0; i < 200; i++) {
  for (const r of full.all()) {
    try {
      JSON.parse(r.j).coverCuts;
    } catch {}
  }
}
console.log("eski tam tarama+parse ms/çağrı", ((performance.now() - t) / 200).toFixed(3));
const q = db.prepare(FILT);
t = performance.now();
let rows = 0;
for (const a of accs) rows += q.all(JSON.stringify(byAcc.get(a))).length;
console.log("yeni süzgeçli ms/çağrı", ((performance.now() - t) / accs.length).toFixed(3), "kartlı cari", accs.length, "satır", rows);
const q3 = db.prepare(`${BASE} AND instr(payment_json, ?) > 0`);
t = performance.now();
rows = 0;
for (const a of accs) rows += q3.all(byAcc.get(a)[0]).length;
console.log("tek instr ms/çağrı", ((performance.now() - t) / accs.length).toFixed(3), "satır", rows);
const q4 = db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'sale_return' AND status = 'issued'");
t = performance.now();
for (const a of accs) q4.get();
console.log("yalnız indeks sayımı ms/çağrı", ((performance.now() - t) / accs.length).toFixed(3));
