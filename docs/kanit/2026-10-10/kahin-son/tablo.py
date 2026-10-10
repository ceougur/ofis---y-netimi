"""Sınıf × koşu tablosu (fark-*.json'dan; yalnız son durum + ret yaprakları, araDurumlar hariç)."""
import glob
import json
import os
import sys

klasor = sys.argv[1]
satir = []
siniflar = set()
for d in sorted(glob.glob(os.path.join(klasor, "fark-*.json"))):
    r = json.load(open(d, encoding="utf-8"))
    if r.get("durum") != "TAMAM":
        satir.append((r["senaryo"], r.get("cikisKodlari"), None, None, None, {}))
        continue
    say = {}
    for f in r["farklar"]:
        if f["yol"][0] == "araDurumlar":
            continue
        say[f["kokSinif"]] = say.get(f["kokSinif"], 0) + 1
        siniflar.add(f["kokSinif"])
    satir.append((r["senaryo"], r["cikisKodlari"], r["karsilastirilanYaprak"], r["atlananBelirsizYaprak"],
                  r["farkSayisi"], say))
sl = sorted(siniflar)
print("koşu | çıkış a/b/p | karşılaştırılan | belirsiz | fark (ara dahil) | " + " | ".join(sl) + " | açıklanamayan")
for ad, c, k, b, n, say in satir:
    c_ = "%s/%s/%s" % (c["a"], c["b"], c["program"]) if c else "-"
    acik = sum(v for s, v in say.items() if s.startswith(("ACIKLANMAMIS", "SINIFLANMAMIS")))
    print("%s | %s | %s | %s | %s | %s | %d" % (ad, c_, k, b, n, " | ".join(str(say.get(s, 0)) for s in sl), acik))
