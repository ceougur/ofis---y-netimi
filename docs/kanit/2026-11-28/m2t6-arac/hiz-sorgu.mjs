// m2t6 hız göstergesi (ders 47): tur 6'nın Değersiz'siz caride Alış Faturası Düzenle'ye eklediği TEK okuma — writeOffBalanceGuard'ın 'Değersiz satırı var mı' sorgusu
// (server/lib/bank/doubtful.mjs ownLines; metin AYNEN) — büyük veride (ana oturumun temiz-100k kopyası; salt okunur kopya) sorgu planı ve süresi.
// Kullanım: node hiz-sorgu.mjs <destekofis.sqlite kopyası>
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2], { readOnly: true });
const SQL = "SELECT id, source_id AS recordId, date, CAST(ROUND(amount * 100) AS INTEGER) AS minor FROM account_entries WHERE account_id = ? AND source = 'doubtful' AND kind = 'credit' ORDER BY created_at, rowid";
const total = db.prepare("SELECT COUNT(*) AS n FROM account_entries").get().n;
const top = db.prepare("SELECT account_id AS id, COUNT(*) AS n FROM account_entries GROUP BY account_id ORDER BY n DESC LIMIT 3").all();
const purchases = db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'purchase' AND status = 'issued'").get().n;
console.log(`cari hareketi ${total}, kesilmiş alış faturası ${purchases}`);
console.log("plan:", db.prepare(`EXPLAIN QUERY PLAN ${SQL}`).all("x").map(row => row.detail).join(" | "));
const stmt = db.prepare(SQL);
for (const { id, n } of top) {
  for (let i = 0; i < 20; i += 1) stmt.all(id); // ısınma
  const times = [];
  for (let i = 0; i < 200; i += 1) {
    const t = process.hrtime.bigint();
    stmt.all(id);
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  times.sort((a, b) => a - b);
  console.log(`cari ${n} hareketli: ortanca ${times[100].toFixed(3)} ms, en kötü ${times[199].toFixed(3)} ms, satır ${stmt.all(id).length}`);
}
console.log("loadavg", (await import("node:fs")).readFileSync("/proc/loadavg", "utf8").trim());
