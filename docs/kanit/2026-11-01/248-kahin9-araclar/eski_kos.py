import sys, json
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin, senaryolar
n = 0
for s in senaryolar.SENARYOLAR:
    if not s["baslik"].startswith("J"):
        continue
    try:
        b = kahin.hesapla(senaryolar.girdi(s))
        f = senaryolar.elle_denetle(s, b)
    except Exception as e:
        f = [f"istisna {type(e).__name__}: {e}"]
    print(("FARKLI " if f else "AYNI   ") + s["ad"] + ("  ← " + f[0][len(s['ad'])+1:][:170] if f else ""))
    n += bool(f)
print(n, "yeni senaryo eski kâhinde farklı")
