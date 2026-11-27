# Ç5-A tur 1c: openingCounterpart ve H1 / H2 küçük sorgularının süresi ve sorgu planı (salt okunur). Kullanım: python3 -I sql-zaman.py <veri dosyası>
import sqlite3, sys, time

c = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
print("şema", c.execute("PRAGMA user_version").fetchone())
qs = {
    "cash": "SELECT COALESCE(SUM(CAST(ROUND(amount * 100) AS INTEGER)), 0) AS n FROM cash_entries WHERE is_opening = 1 AND kind = 'in' AND COALESCE(transfer_id, '') = ''",
    "acc": """SELECT COALESCE(SUM(CASE e.kind WHEN 'debt' THEN -CAST(ROUND(e.amount * 100) AS INTEGER) ELSE CAST(ROUND(e.amount * 100) AS INTEGER) END), 0) AS n
       FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
       WHERE e.kind IN ('debt', 'credit') AND e.source NOT IN ('cheque', 'invoice', 'doubtful', 'stock') AND (e.is_opening = 1 OR e.opening_review IN ('candidate', 'confirmed'))""",
    "acc CROSS": """SELECT COALESCE(SUM(CASE e.kind WHEN 'debt' THEN -CAST(ROUND(e.amount * 100) AS INTEGER) ELSE CAST(ROUND(e.amount * 100) AS INTEGER) END), 0) AS n
       FROM account_entries e CROSS JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
       WHERE e.kind IN ('debt', 'credit') AND e.source NOT IN ('cheque', 'invoice', 'doubtful', 'stock') AND (e.is_opening = 1 OR e.opening_review IN ('candidate', 'confirmed'))""",
    "plans1":"""SELECT p.total, COALESCE((SELECT SUM(e.amount) FROM plan_entries e WHERE e.plan_id = p.id AND e.kind = 'in' AND e.opening = 1), 0) AS paid
       FROM plans p WHERE p.deleted_at IS NULL AND p.import_id <> '' AND NOT p.covers_balance""",
    "plans2": """SELECT COALESCE(SUM(CAST(ROUND(e.amount * 100) AS INTEGER)), 0) AS n FROM plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL
       WHERE e.kind = 'in' AND e.opening = 1 AND NOT (p.import_id <> '' AND NOT p.covers_balance)""",
    "stock": "SELECT qty, unit_price AS price FROM stock_moves WHERE is_opening = 1 AND kind = 'in' AND pay = 'none'",
    "bank": "SELECT COALESCE(SUM(CASE l.side WHEN 'D' THEN l.try_minor ELSE -l.try_minor END), 0) AS n FROM bank_lines l JOIN fin_events f ON f.id = l.event_id WHERE l.role IN ('opening', 'closing') AND l.gl = '500' AND l.try_minor > 0",
    "cheq": """SELECT COALESCE(SUM(CASE WHEN c.direction = 'in' THEN -CAST(ROUND(c.amount * 100) AS INTEGER) ELSE CAST(ROUND(c.amount * 100) AS INTEGER) END
                          + CASE WHEN c.direction = 'in' AND c.status = 'bounced' AND EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.kind = 'bounce') AND NOT EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id AND e.kind = 'debt')
                                 THEN CAST(ROUND(c.amount * 100) AS INTEGER) ELSE 0 END), 0) AS n
       FROM cheques c
       WHERE c.deleted_at IS NULL AND c.is_opening = 1 AND NOT EXISTS (SELECT 1 FROM plan_entries pe JOIN plans p ON p.id = pe.plan_id AND p.deleted_at IS NULL WHERE pe.cheque_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                         WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id AND e.kind = CASE WHEN c.direction = 'in' THEN 'credit' ELSE 'debt' END)""",
    "v519": "SELECT COALESCE(SUM(debit_minor - credit_minor), 0) AS n FROM ledger_voucher_lines WHERE account = '519'",
    "flag (H1)": "SELECT e.id, e.is_opening, e.opening_review FROM account_entries e WHERE (e.is_opening = 1 OR e.opening_review IN ('candidate', 'confirmed'))",
    "imp (H2)": "SELECT p.id FROM plans p WHERE p.deleted_at IS NULL AND p.import_id <> ''",
}
for k, q in qs.items():
    best = None
    for _ in range(3):
        t = time.perf_counter()
        r = c.execute(q).fetchall()
        dt = (time.perf_counter() - t) * 1000
        best = dt if best is None else min(best, dt)
    plan = [x[3] for x in c.execute("EXPLAIN QUERY PLAN " + q).fetchall()]
    print(f"{k}: en iyi {best:.1f} ms · {len(r)} satır · {r[0] if len(r) == 1 else ''} · plan {plan}")
