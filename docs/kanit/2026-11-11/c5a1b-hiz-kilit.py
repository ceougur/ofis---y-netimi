# Ölçüm kopyasında eski sürümün koyduğu kilidi benzetir (yalnız KENDİ kopyamda): ledger.lockedUntil = 2026-06-30 → göç 47 bekleyen 2.4.9 koşusu açar.
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
c.execute("UPDATE settings SET value='2026-06-30' WHERE key='ledger.lockedUntil'")
c.commit()
print('kilit', c.execute("SELECT value FROM settings WHERE key='ledger.lockedUntil'").fetchone())
