"""İki sürücü koşusunun (aynı kâhin, iki program commit'i) senaryo başına fark listesi karşılaştırması.
Kullanım: python3 -I iki_kosu_fark.py <karsilastirma A.json> <karsilastirma B.json> [ad A] [ad B]
Çıktı: davranış farkı listesi iki koşuda AYNI olan / farklı olan senaryolar (farklı olanların ayrıntısı)."""
import json, sys
a = {x["ad"]: x for x in json.load(open(sys.argv[1], encoding="utf-8")) if x.get("ad")}
b = {x["ad"]: x for x in json.load(open(sys.argv[2], encoding="utf-8")) if x.get("ad")}
an = sys.argv[3] if len(sys.argv) > 3 else "A"; bn = sys.argv[4] if len(sys.argv) > 4 else "B"
ayni = farkli = 0
for ad in sorted(set(a) | set(b)):
    x, y = a.get(ad), b.get(ad)
    if not x or not y:
        print(f"YALNIZ {'A' if x else 'B'}: {ad}"); continue
    dx = sorted(x.get("davranis_farki") or x.get("farklar") or []); dy = sorted(y.get("davranis_farki") or y.get("farklar") or [])
    if dx == dy:
        ayni += 1; continue
    farkli += 1
    print(f"FARKLI {ad}: {an} {len(dx)} davranış farkı, {bn} {len(dy)}")
    for f in [f for f in dx if f not in dy][:6]: print(f"   yalnız {an}: {f[:230]}")
    for f in [f for f in dy if f not in dx][:6]: print(f"   yalnız {bn}: {f[:230]}")
print(f"# {ayni} senaryoda davranış farkı listesi aynı, {farkli} senaryoda farklı")
