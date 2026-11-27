// Yıl başına gruplama ↔ tek sorgu (donmuş 100 bin kopyası; salt okunur). node sql-bench3.mjs <sqlite>
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2], { readOnly: true });
console.log(JSON.stringify(db.prepare("SELECT substr(date, 1, 4) AS y, COUNT(*) AS n FROM ledger_snapshots GROUP BY 1").all()));
const t = (label, fn) => {
  const ms = [];
  let n;
  for (let i = 0; i < 6; i += 1) {
    const s = performance.now();
    n = fn();
    ms.push(performance.now() - s);
  }
  const r = ms.slice(1).sort((a, b) => a - b);
  console.log(`  ${label}: en iyi ${r[0].toFixed(0)} · ortanca ${r[2].toFixed(0)} ms · ${n}`);
};
const years = db.prepare("SELECT DISTINCT substr(date, 1, 4) AS y FROM ledger_snapshots WHERE date < '2026-01-01'").all().map(r => r.y);
const per = db.prepare("SELECT account, sub, party, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots WHERE date >= ?1 AND date < ?2 AND substr(entry_id, 1, 7) <> 'voucher' GROUP BY account, sub, party");
t(`yıl başına ${years.join(",")} (ifadesiz anahtar, tek tek)`, () => years.reduce((s, y) => s + per.all(`${y}-01-01`, `${Number(y) + 1}-01-01`).length, 0));
const one = db.prepare("SELECT substr(date, 1, 4) AS year, account, sub, party, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots WHERE date < ?1 AND substr(entry_id, 1, 7) <> 'voucher' GROUP BY 1, account, sub, party");
t("tek sorgu, yıl ifadesi anahtarda", () => one.all("2026-01-01").length);
const perAcc = db.prepare("SELECT account, SUM(debit_minor - credit_minor) AS net FROM ledger_snapshots WHERE date >= ?1 AND date < ?2 GROUP BY account");
t("yıl başına yalnız hesap", () => years.reduce((s, y) => s + perAcc.all(`${y}-01-01`, `${Number(y) + 1}-01-01`).length, 0));
