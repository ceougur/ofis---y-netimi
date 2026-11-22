// SQL biçimlerinin karşılaştırması (donmuş 100 bin kopyası; salt okunur bağlantı). node sql-bench.mjs <sqlite yolu> <kapsam>
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
const [file, cover] = process.argv.slice(2);
const db = new DatabaseSync(file, { readOnly: true });
const load = () => readFileSync("/proc/loadavg", "utf8").split(" ").slice(0, 3).join(" ");
const P = "CASE WHEN instr(entry_id, ':') > 0 THEN substr(entry_id, 1, instr(entry_id, ':') - 1) ELSE substr(entry_id, 1, length(entry_id) - 1) END";
const V = "CASE WHEN substr(entry_id, 1, 7) = 'voucher' THEN 1 ELSE 0 END";
const from = "2026-01-01";
const Q = {
  "yıl (eski, iç)": [`SELECT substr(date, 1, 4) AS year, CASE WHEN date >= ?3 THEN 1 ELSE 0 END AS part, ${P} AS prefix, ${V} AS voucher, account, sub, party, SUM(debit_minor - credit_minor) AS net, COUNT(*) AS lines, MAX(date) AS last FROM ledger_snapshots WHERE date >= ?1 AND date <= ?2 GROUP BY 1, 2, 3, 4, account, sub, party`, [from, cover, from]],
  "tamamı (tur 4)": [`SELECT substr(date, 1, 4) AS year, CASE WHEN date >= ?3 THEN 1 ELSE 0 END AS part, ${P} AS prefix, ${V} AS voucher, account, sub, party, SUM(debit_minor - credit_minor) AS net, COUNT(*) AS lines, MAX(date) AS last FROM ledger_snapshots WHERE date >= ?1 AND date <= ?2 GROUP BY 1, 2, 3, 4, account, sub, party`, ["", cover, ""]],
  "tek çağrı (tur 5)": [`SELECT substr(date, 1, 4) AS year, CASE WHEN date >= ?1 AND date <= ?2 THEN (CASE WHEN date >= ?3 THEN 1 ELSE 0 END) ELSE -1 END AS part, CASE WHEN date >= ?1 AND date <= ?2 THEN ${P} ELSE '' END AS prefix, ${V} AS voucher, account, sub, party, SUM(debit_minor - credit_minor) AS net, COUNT(*) AS lines, MAX(date) AS last FROM ledger_snapshots WHERE date <= ?4 GROUP BY 1, 2, 3, 4, account, sub, party`, [from, cover, from, cover]],
  "dışarı kaba (date < from)": [`SELECT substr(date, 1, 4) AS year, ${V} AS voucher, account, sub, party, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots WHERE date < ?1 GROUP BY 1, 2, account, sub, party`, [from]],
  "dışarı kaba, voucher süzülü": [`SELECT substr(date, 1, 4) AS year, account, sub, party, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots WHERE date < ?1 AND substr(entry_id, 1, 7) <> 'voucher' GROUP BY 1, account, sub, party`, [from]],
  "dışarı yalnız hesap × yıl (alt / cari yok)": [`SELECT substr(date, 1, 4) AS year, account, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots WHERE date < ?1 GROUP BY 1, account`, [from]],
  "satır say (date < from)": [`SELECT COUNT(*) AS n FROM ledger_snapshots WHERE date < ?1`, [from]],
  "toplam (date < from), gruplamasız": [`SELECT SUM(debit_minor - credit_minor) AS n FROM ledger_snapshots WHERE date < ?1`, [from]],
  "madde sayımı tamamı (tur 4'ün entries'i)": [`SELECT year, part, COUNT(*) AS entries FROM (SELECT substr(date, 1, 4) AS year, 1 AS part, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots WHERE date <= ?1 GROUP BY run, entry_id, date) GROUP BY year, part`, [cover]],
};
console.log(`yük ${load()} · ${file}`);
console.log(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'ledger_snapshots'").get().sql.replace(/\s+/g, " ").slice(0, 600));
for (const [label, [sql, args]] of Object.entries(Q)) {
  const stmt = db.prepare(sql);
  const ms = [];
  let n = 0;
  for (let i = 0; i < 6; i += 1) {
    const s = performance.now();
    n = stmt.all(...args).length;
    ms.push(performance.now() - s);
  }
  const rest = ms.slice(1).sort((a, b) => a - b);
  console.log(`  ${label}: en iyi ${rest[0].toFixed(0)} · ortanca ${rest[2].toFixed(0)} ms · satır ${n}`);
}
console.log(`yük (sonda) ${load()}`);
