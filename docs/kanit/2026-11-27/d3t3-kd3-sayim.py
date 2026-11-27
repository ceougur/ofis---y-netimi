# S-KD-3 etkisi (salt okuma; mode=ro): programın ürettiği veride Excel / tablodan yüklenen kartların Kayıt Tarihi ↔ yükleme günü; tarihi ve YILI değişen madde sayısı.
# argv: veri tabanı dosyaları. Yükleme günü = plan_imports.created_at'in Türkiye yerel günü (UTC+3; program da sürecin saat dilimiyle — burada UTC+3 varsayıldı).
import sqlite3, sys, datetime
for path in sys.argv[1:]:
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        rows = con.execute("""SELECT p.id, COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10)) AS reg, x.created_at AS up, p.total, p.covers_balance
                              FROM plans p JOIN plan_imports x ON x.id = p.import_id WHERE p.deleted_at IS NULL AND p.import_id <> ''""").fetchall()
    except sqlite3.OperationalError as error:
        print(f"{path}: okunamadı ({error})")
        continue
    lock = (con.execute("SELECT value FROM settings WHERE key = 'ledger.lockedUntil'").fetchone() or [""])[0]
    def local(stamp):
        at = datetime.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        return (at + datetime.timedelta(hours=3)).date().isoformat()
    cards = [r for r in rows if not r[4]]
    moved = [r for r in cards if local(r[2]) != r[1]]
    year = [r for r in moved if local(r[2])[:4] != r[1][:4]]
    straddle = [r for r in moved if lock and ((r[1] <= lock) != (local(r[2]) <= lock))]
    print(f"{path}: yüklenen kart {len(cards)} (kapsayan hariç); tarihi değişen {len(moved)}; YILI değişen {len(year)} (Σ {sum(r[3] for r in year):.2f} TL); kilit {lock or 'yok'}, kilit sınırını aşan {len(straddle)}")
