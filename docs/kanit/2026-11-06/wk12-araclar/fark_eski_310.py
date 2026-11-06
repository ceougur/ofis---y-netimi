#!/usr/bin/env python3
"""WK güncellemesi 12: taban (b12a03d6, değişiklikten önce alınmış kopya) senaryolar.json ↔ yeni senaryolar.json.
Eski 310 senaryonun girdi / elle / TAM model sonucu bayt bayt aynı mı; yeni senaryolar hangileri; üst alanlardan değişenler."""
import json
import sys

eski_yol, yeni_yol = sys.argv[1], sys.argv[2]
with open(eski_yol, encoding="utf-8") as f:
    eski = json.load(f)
with open(yeni_yol, encoding="utf-8") as f:
    yeni = json.load(f)


def d(o):
    return json.dumps(o, sort_keys=True, ensure_ascii=False)


es = {s["ad"]: s for s in eski["senaryolar"]}
ys = {s["ad"]: s for s in yeni["senaryolar"]}
print(f"eski senaryo: {len(es)}  yeni senaryo: {len(ys)}")
eksik = sorted(set(es) - set(ys))
print(f"yeni dosyada OLMAYAN eski senaryo: {len(eksik)} {eksik}")
yeni_adlar = [a for a in ys if a not in es]
print(f"yeni senaryo ({len(yeni_adlar)}): {yeni_adlar}")
ayni = 0
degisen = []
for ad, s in es.items():
    if ad not in ys:
        continue
    y = ys[ad]
    alanlar = [k for k in ("girdi", "elle", "beklenen", "baslik", "kaynak", "aciklama") if d(s.get(k)) != d(y.get(k))]
    if alanlar:
        degisen.append((ad, alanlar))
    else:
        ayni += 1
print(f"eski senaryolardan bayt bayt AYNI (girdi + elle + tam sonuç + başlık/kaynak/açıklama): {ayni}/{len(es)}")
print(f"DEĞİŞEN: {len(degisen)}")
for ad, alanlar in degisen:
    print(f"  {ad}: {alanlar}")
for k in sorted(set(eski) | set(yeni)):
    if k == "senaryolar":
        continue
    if d(eski.get(k)) != d(yeni.get(k)):
        if isinstance(eski.get(k), dict) and isinstance(yeni.get(k), dict):
            eklenen = sorted(set(yeni[k]) - set(eski[k]))
            cikan = sorted(set(eski[k]) - set(yeni[k]))
            deg = sorted(a for a in set(eski[k]) & set(yeni[k]) if d(eski[k][a]) != d(yeni[k][a]))
            print(f"üst alan '{k}': eklenen {eklenen}, çıkan {cikan}, değişen {deg}")
        else:
            print(f"üst alan '{k}' değişti")
sys.exit(1 if (eksik or degisen) else 0)
