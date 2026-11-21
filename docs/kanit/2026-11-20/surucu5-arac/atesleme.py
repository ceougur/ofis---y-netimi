"""siniflama.json kurallarından hangisi bir çıktıda ATEŞLEDİ (adım kodu ya da satırın açıklaması kuralınkiyle aynı): python3 -I atesleme.py <siniflama.json> <çıktı kökü>"""
import glob, json, os, sys
from collections import Counter

K = json.load(open(sys.argv[1], encoding="utf-8"))["kurallar"]
kok = sys.argv[2]
say = Counter()
for f in glob.glob(os.path.join(kok, "*", "*.fark.json")):
    d = json.load(open(f, encoding="utf-8"))
    ack = []
    for a in d["adim_farklari"]:
        for k in str(a.get("kod", "")).split(","):
            if k:
                say[k] += 1
    for r in d["redler"]:
        ack.append(r.get("aciklama"))
    for x in d["uygulanamayan"]:
        ack.append(x.get("aciklama"))
    for r in list(d["raporlar"].values()) + [{"satirlar": d["son"]}]:
        for x in r["satirlar"]:
            ack.append(x.get("aciklama"))
    for k in K:
        if k["kapsam"] != "adim":
            say[k["kod"]] += sum(1 for a in ack if a and a == k.get("aciklama"))
for k in K:
    print(f"{say[k['kod']]:5d}  {k['kod']}  ({k['kapsam']}, {k['sinif']})")
print("ATEŞLEMEYEN:", [k["kod"] for k in K if not say[k["kod"]]])
