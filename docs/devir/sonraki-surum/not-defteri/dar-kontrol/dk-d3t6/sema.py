import sqlite3, sys
for f in sys.argv[1:]:
    c = sqlite3.connect(f)
    tabs = [r[0] for r in c.execute("select name from sqlite_master where type='table' order by name")]
    cols = [r[1] for r in c.execute("pragma table_info(plans)")]
    uv = c.execute("pragma user_version").fetchone()[0]
    meta = None
    for t in ("meta", "schema_meta", "settings", "app_meta", "schema_version", "migrations"):
        if t in tabs:
            meta = (t, c.execute(f"select * from {t}").fetchall()[-3:])
    print(f, "user_version", uv, "tablo", len(tabs), "plans cols", cols, meta)
    print(" plan_entries", c.execute("select count(*), sum(amount) from plan_entries").fetchone(), "plans", c.execute("select status,count(*) from plans group by status").fetchall())
