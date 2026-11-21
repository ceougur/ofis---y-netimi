"""Bir çıktı klasöründe kırmızı / U satırların dökümü: python3 -I dokum.py <çıktı kökü> [senaryo öneki,...] [--u]"""
import glob, json, os, sys

kok = sys.argv[1]
onek = [x for x in (sys.argv[2].split(",") if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else []) if x]
U = "--u" in sys.argv
KIRMIZI = {"P", "K", "R", "SINIFLANMADI"}
for tz in ("UTC", "Europe-Istanbul"):
    for f in sorted(glob.glob(os.path.join(kok, tz, "*.fark.json"))):
        ad = os.path.basename(f)[:-10]
        if onek and not any(ad.startswith(o) for o in onek):
            continue
        d = json.load(open(f, encoding="utf-8"))
        sat = []
        for a in d["adim_farklari"]:
            if a.get("sinif") in KIRMIZI or (U and a.get("sinif") == "U"):
                sat.append(f"  ADIM {a['no']} {a['olay_turu']} {a.get('id', '')} {json.dumps(a['degisim'], ensure_ascii=False)} → {a.get('sinif')} {a.get('kod', '')}")
        for r in d["redler"]:
            if r["sonuc"] != "AYNI" and (r.get("sinif") in KIRMIZI or not r.get("sinif") or (U and r.get("sinif") == "U")):
                sat.append(f"  RED {r['no']} {r['tur']} {r['id']} kâhin {r['kahin']} program {r['program']} → {r.get('sinif') or 'SINIFLANMADI'}")
        for x in d["uygulanamayan"]:
            if x.get("sinif") != "U" or U:
                sat.append(f"  OLAY {x['no']} {x['tur']} {x['durum']} → {x.get('sinif')} {str(x.get('neden'))[:160]}")
        for rad, r in list(d["raporlar"].items()) + [("son", {"satirlar": d["son"]})]:
            for x in r["satirlar"]:
                s = str(x.get("sinif"))
                if set(s.split("/")) & KIRMIZI or (U and s == "U"):
                    sat.append(f"  {rad} {x['alan']}:{x['anahtar']} program {json.dumps(x.get('program'), ensure_ascii=False)} · kâhin {json.dumps(x.get('kahin'), ensure_ascii=False)} · bugün {json.dumps(x.get('bugun'), ensure_ascii=False)} → {s} {x.get('kimlik', '')}")
        bad = {k: v for k, v in d["degismezler"].items() if v is False and not k.startswith("kahin")}
        if bad:
            sat.append(f"  DEĞİŞMEZ {bad}")
        if not d["oz_denetim"].get("raporlar_ayni"):
            sat.append("  ÖZ DENETİM BOZUK")
        if sat:
            print(f"{ad} [{tz}] ({len(sat)})")
            print("\n".join(s[:420] for s in sat))
