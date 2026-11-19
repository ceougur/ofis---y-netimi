"""Koşu klasöründen (kos.mjs --cikti) senaryo × sınıf tablosu ve kırmızı satırların dökümü.
python3 -I ozet.py <cikti> [tablo|dokum [senaryo-önek]]"""
import glob, json, os, sys
from collections import defaultdict

kok = sys.argv[1]
kip = sys.argv[2] if len(sys.argv) > 2 else "tablo"
onek = sys.argv[3] if len(sys.argv) > 3 else ""
SIN = ("AYNI", "U", "P", "K", "R", "SINIFLANMADI", "OLCULEMEDI", "SUSMA")
tab = defaultdict(lambda: defaultdict(int))
for tz in sorted(os.listdir(kok)):
    d = os.path.join(kok, tz)
    if not os.path.isdir(d):
        continue
    for f in sorted(glob.glob(os.path.join(d, "*.fark.json"))):
        ad = os.path.basename(f)[:-10]
        if onek and not ad.startswith(onek):
            continue
        x = json.load(open(f, encoding="utf-8"))
        t = tab[(ad, tz)]
        for s in SIN:
            t[s] += x["ozet"].get(s, 0)
        t["adim_sinifsiz"] += x["ozet"].get("adim_sinifsiz", 0)
        t["adim_susma"] += x["ozet"].get("adim_susma", 0)
        rf = [r for r in x["redler"] if r["sonuc"] != "AYNI"]
        t["red_fark"] += sum(1 for r in rf if not r.get("sinif"))
        for r in rf:
            if r.get("sinif") and r["sinif"] != "U":
                for c in r["sinif"].split("/"):
                    t[c] += 1
        ua = [u for u in x["uygulanamayan"] if not u.get("sinif") or u["sinif"] == "SINIFLANMADI"]
        t["uygulanamayan"] += len(ua)
        t["oz_bozuk"] += 0 if x["oz_denetim"]["raporlar_ayni"] else 1
        t["degismez"] += sum(1 for k, v in x["degismezler"].items() if v is False and not k.startswith("kahin"))
        if kip == "dokum":
            for rn, rr in x["raporlar"].items():
                for y in rr["satirlar"]:
                    if y["sinif"] not in ("AYNI", "U", "SUSMA", "OLCULEMEDI"):
                        print(f"{ad} [{tz}] RAPOR {rn} {y['alan']}:{y['anahtar']} p {y.get('program')} k {y.get('kahin')} b {y.get('bugun')} → {y['sinif']} {str(y.get('aciklama', ''))[:120]}")
            for y in x["son"]:
                if y["sinif"] not in ("AYNI", "U", "SUSMA", "OLCULEMEDI"):
                    print(f"{ad} [{tz}] SON {y['alan']}:{y['anahtar']} p {y.get('program')} k {y.get('kahin')} b {y.get('bugun')} → {y['sinif']}")
            for a in x["adim_farklari"]:
                if a.get("sinif") == "SINIFLANMADI" or (a.get("sinif") not in ("SUSMA", "OLCULEMEDI") and a.get("sinif") and "U" != a.get("sinif") and onek):
                    print(f"{ad} [{tz}] ADIM {a['no']} {a['olay_turu']} {a.get('id','')} {json.dumps(a['degisim'], ensure_ascii=False)} → {a.get('sinif')} {a.get('kod','')}")
            for r in rf:
                if r.get("sinif") != "U":
                    print(f"{ad} [{tz}] RED #{r['no']} {r['tur']} {r.get('id','')} kâhin {r.get('kahin')} program {r.get('program')} → {r.get('sinif') or 'SINIFLANMADI'}")
            for u in x["uygulanamayan"]:
                print(f"{ad} [{tz}] OLAY #{u['no']} {u['tur']} {u['durum']} → {u.get('sinif')} {str(u.get('neden'))[:160]}")
if kip == "tablo":
    kol = list(SIN) + ["red_fark", "uygulanamayan", "adim_sinifsiz", "adim_susma", "oz_bozuk", "degismez"]
    print("senaryo | tz | " + " | ".join(kol))
    top = defaultdict(lambda: defaultdict(int))
    for (ad, tz), t in sorted(tab.items()):
        kirmizi = sum(t[c] for c in ("P", "K", "R", "SINIFLANMADI", "red_fark", "uygulanamayan", "adim_sinifsiz", "oz_bozuk", "degismez"))
        if kirmizi or "-v" in sys.argv:
            print(f"{ad} | {tz} | " + " | ".join(str(t[c]) for c in kol))
        for c in kol:
            top[tz][c] += t[c]
    for tz, t in top.items():
        print(f"TOPLAM | {tz} | " + " | ".join(str(t[c]) for c in kol))
