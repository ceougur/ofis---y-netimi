"""İki senaryolar.json'un (eski, yeni) beklenen sonuçlarını ADLA karşılaştırır (girdisi değişen senaryolar için: eski girdi yeni kâhinde koşulamıyorsa)."""
import json, sys
eski = {s["ad"]: s for s in json.load(open(sys.argv[1], encoding="utf-8"))["senaryolar"]}
yeni = {s["ad"]: s for s in json.load(open(sys.argv[2], encoding="utf-8"))["senaryolar"]}
def gez(a, b, yol, out):
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(a, b)):
            gez(x, y, f"{yol}[{i}]", out)
    elif isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            gez(a.get(k, "<YOK>"), b.get(k, "<YOK>"), f"{yol}.{k}" if yol else k, out)
    elif json.dumps(a, sort_keys=True, ensure_ascii=False) != json.dumps(b, sort_keys=True, ensure_ascii=False):
        out.append((yol, a, b))
n = 0
for ad in eski:
    if ad not in yeni:
        print("KALKTI", ad); n += 1; continue
    out = []
    gez(eski[ad]["girdi"], yeni[ad]["girdi"], "girdi", out)
    gez(eski[ad]["beklenen"], yeni[ad]["beklenen"], "beklenen", out)
    if out:
        n += 1
        print("DEĞİŞTİ", ad)
        for yol, a, b in out[:14]:
            print("   ", yol, ":", json.dumps(a, ensure_ascii=False)[:110], "→", json.dumps(b, ensure_ascii=False)[:110])
for ad in yeni:
    if ad not in eski:
        print("YENİ", ad)
print(f"{n} / {len(eski)} senaryo değişti (girdi ya da beklenen)")
