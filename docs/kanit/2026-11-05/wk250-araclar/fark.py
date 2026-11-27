"""Eski ve yeni senaryolar.json: ortak senaryoların TAM model sonucu (beklenen) + girdi + elle farkı; yeni / çıkan senaryolar."""
import json
import sys


def m(d):
    return json.dumps(d, sort_keys=True, ensure_ascii=False)


def yollar(a, b, yol=""):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            out += yollar(a.get(k, "<YOK>"), b.get(k, "<YOK>"), f"{yol}.{k}" if yol else k)
        return out
    if m(a) != m(b):
        return [f"{yol}: {m(a)[:160]} → {m(b)[:160]}"]
    return []


eski = {s["ad"]: s for s in json.load(open(sys.argv[1], encoding="utf-8"))["senaryolar"]}
yeni = {s["ad"]: s for s in json.load(open(sys.argv[2], encoding="utf-8"))["senaryolar"]}
ortak = [a for a in eski if a in yeni]
print(f"eski {len(eski)}, yeni {len(yeni)}, ortak {len(ortak)}, yeni eklenen {len([a for a in yeni if a not in eski])}, çıkan {len([a for a in eski if a not in yeni])}")
ayni = 0
for a in ortak:
    e, y = eski[a], yeni[a]
    d = []
    for alan in ("girdi", "elle", "beklenen", "kaynak", "aciklama", "baslik"):
        if m(e[alan]) != m(y[alan]):
            d.append(alan)
    if not d:
        ayni += 1
        continue
    print(f"== {a}: değişen alanlar {d}")
    if "beklenen" in d:
        for s in yollar(e["beklenen"][0]["sonuc"], y["beklenen"][0]["sonuc"]):
            print("   beklenen.", s)
    if "elle" in d:
        for s in yollar(e["elle"][0]["yollar"], y["elle"][0]["yollar"]):
            print("   elle.", s)
    if "girdi" in d:
        for s in yollar(e["girdi"], y["girdi"]):
            print("   girdi.", s)
print(f"bayt bayt aynı (girdi + elle + beklenen + kaynak + açıklama): {ayni}/{len(ortak)}")
