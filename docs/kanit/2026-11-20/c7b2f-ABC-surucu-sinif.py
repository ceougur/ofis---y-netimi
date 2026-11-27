# Kullanım: python3 -I surucu-sinif.py <sürücü çıktı klasörü> <siniflama.json> — fark dosyalarındaki P / R / K sınıflarını sınıflama koduna göre sayar.
import json, sys, os, collections

root, sfile = sys.argv[1], sys.argv[2]
s = json.load(open(sfile, encoding="utf-8"))
print("sınıflama P/R/K kodları:", sorted({k["kod"].split("/")[0] for k in s["kurallar"] if k.get("sinif") in ("P", "R", "K")}))
c = collections.Counter()
ornek = {}


def walk(v, tz, ad):
    if isinstance(v, dict):
        sn = v.get("sinif")
        if sn in ("P", "R", "K", "SINIFLANMADI"):
            kod = str(v.get("kod") or v.get("kural") or v.get("etiket") or "?").split("/")[0]
            c[(sn, kod, tz)] += 1
            ornek.setdefault((sn, kod), f"{ad} {str(v)[:160]}")
        for x in v.values():
            walk(x, tz, ad)
    elif isinstance(v, list):
        for x in v:
            walk(x, tz, ad)


for tz in ("UTC", "Europe-Istanbul"):
    d = os.path.join(root, tz)
    for name in sorted(os.listdir(d)):
        if name.endswith(".fark.json"):
            walk(json.load(open(os.path.join(d, name), encoding="utf-8")), tz, name)
for k, v in sorted(c.items()):
    print(k, v)
for k, v in sorted(ornek.items()):
    print("ÖRNEK", k, v)
