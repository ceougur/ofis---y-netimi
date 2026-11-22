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
  "dışarı kaba, voucher süzülü (A)": [`SELECT substr(date, 1, 4) AS year, account, sub, party, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots WHERE date < ?1 AND substr(entry_id, 1, 7) <> 'voucher' GROUP BY 1, account, sub, party`, [from]],
  "A NOT INDEXED": [`SELECT substr(date, 1, 4) AS year, account, sub, party, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots NOT INDEXED WHERE date < ?1 AND substr(entry_id, 1, 7) <> 'voucher' GROUP BY 1, account, sub, party`, [from]],
  "A anahtar sırası account, sub, party, yıl": [`SELECT substr(date, 1, 4) AS year, account, sub, party, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots WHERE date < ?1 AND substr(entry_id, 1, 7) <> 'voucher' GROUP BY account, sub, party, 1`, [from]],
  "A entry_id NOT GLOB": [`SELECT substr(date, 1, 4) AS year, account, sub, party, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots WHERE date < ?1 AND entry_id NOT GLOB 'voucher*' GROUP BY 1, account, sub, party`, [from]],
  "yıl başına (2025) ifadesiz anahtar": [`SELECT account, sub, party, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots WHERE date >= '2025-01-01' AND date < '2026-01-01' AND substr(entry_id, 1, 7) <> 'voucher' GROUP BY account, sub, party`, []],
  "yıl dağılımı": [`SELECT substr(date, 1, 4) AS y, COUNT(*) FROM ledger_snapshots GROUP BY 1`, []],
  "cari boş mu (party = '') oranı": [`SELECT party = '' AS bos, COUNT(*) FROM ledger_snapshots WHERE date < ?1 GROUP BY 1`, [from]],
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
