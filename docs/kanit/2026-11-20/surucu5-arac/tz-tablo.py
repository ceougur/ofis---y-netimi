"""TZ başına ve senaryo başına sınıf tablosu: python3 -I tz-tablo.py <çıktı kökü>"""
import glob, json, os, sys
kok = sys.argv[1]
SIN = ("AYNI", "U", "P", "K", "R", "SINIFLANMADI", "OLCULEMEDI", "SUSMA")
for tz in ("UTC", "Europe-Istanbul"):
    top = dict.fromkeys(SIN, 0) | {"adim_sinifsiz": 0, "red_fark": 0, "uyg": 0, "adimR_P": 0}
    satir = []
    for f in sorted(glob.glob(os.path.join(kok, tz, "*.fark.json"))):
        d = json.load(open(f, encoding="utf-8"))
        o = d["ozet"]
        for k in SIN:
            top[k] += o.get(k, 0)
        top["adim_sinifsiz"] += o.get("adim_sinifsiz", 0)
        rf = sum(1 for r in d["redler"] if r["sonuc"] != "AYNI" and not r.get("sinif"))
        rp = sum(1 for r in d["redler"] if r["sonuc"] != "AYNI" and r.get("sinif") in ("P", "K", "R"))
        up = sum(1 for u in d["uygulanamayan"] if u.get("sinif") in ("P", "K", "R"))
        us = sum(1 for u in d["uygulanamayan"] if u.get("sinif") in (None, "SINIFLANMADI"))
        top["red_fark"] += rf
        top["uyg"] += us
        top["adimR_P"] += rp + up
        kir = o.get("P", 0) + o.get("K", 0) + o.get("R", 0) + o.get("SINIFLANMADI", 0) + o.get("adim_sinifsiz", 0) + rf + rp + up + us
        if kir:
            satir.append(f"  {os.path.basename(f)[:-10]}: AYNI {o['AYNI']} · U {o['U']} · P {o['P']} · K {o['K']} · R {o['R']} · SINIFLANMADI {o['SINIFLANMADI']} · red/olay P-K-R {rp + up} · red farkı {rf} · sınıfsız adım {o.get('adim_sinifsiz', 0)} · uygulanamayan {us}")
    print(f"[{tz}] " + " · ".join(f"{k} {top[k]}" for k in SIN) + f" · sınıfsız adım {top['adim_sinifsiz']} · red farkı {top['red_fark']} · uygulanamayan {top['uyg']} · red/olay P-K-R {top['adimR_P']}")
    print("\n".join(satir))
