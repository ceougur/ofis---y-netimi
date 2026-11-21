# YOKLAMA (c7bt, depoya girmez): s51'in KOPYASINI (yalnız not defterindeki kod kopyasında) S200 örneğine çevirir — F1 50.000 + BY1 30.000, Mevcut Borç kartı 60.000;
# 16.02 gecikmiş raporu eklenir. Kâhin bu durumda susar (README bakım 13 KULLANICIYA SORULMALI 1); amaç programın değerini okumak.
import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding="utf8"))
for o in d["olaylar"]:
    if o.get("id") == "BY1":
        o["tutar"] = 30000
d["olaylar"].insert(3, {"ad": "g0", "cari": "C1", "rapor": "gecikmis", "tarih": "2026-02-16", "tur": "rapor"})
json.dump(d, open(p, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print("yoklama senaryosu hazır")
