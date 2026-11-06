#!/usr/bin/env python3
"""WK 17 (G3): eski senaryoların (taban 7d6c6369 senaryolar.json kopyası) TAM kaydı — ad, başlık, açıklama, kaynak, girdi, elle, beklenen — yeni senaryolar.json ile bayt bayt.
Kullanım: python3 -I eski_tam_sonuc_fark.py <eski senaryolar.json> <yeni senaryolar.json>"""
import json
import sys

eski = json.load(open(sys.argv[1], encoding="utf-8"))
yeni = json.load(open(sys.argv[2], encoding="utf-8"))
m = lambda x: json.dumps(x, sort_keys=True, ensure_ascii=False)  # noqa: E731
es = eski["senaryolar"]; ys = {s["ad"]: s for s in yeni["senaryolar"]}
print(f"eski {len(es)} senaryo, yeni {len(yeni['senaryolar'])}")
sira_eski = [s["ad"] for s in es]
sira_yeni = [s["ad"] for s in yeni["senaryolar"] if s["ad"] in set(sira_eski)]
print("sıra korunuyor" if sira_eski == sira_yeni else "SIRA DEĞİŞTİ")
degisen = []
for s in es:
    y = ys.get(s["ad"])
    if y is None:
        degisen.append((s["ad"], ["SİLİNDİ"])); continue
    alanlar = [k for k in sorted(set(s) | set(y)) if m(s.get(k)) != m(y.get(k))]
    if alanlar:
        degisen.append((s["ad"], alanlar))
for ad, alanlar in degisen:
    print(f"DEĞİŞTİ {ad}: {alanlar}")
print(f"aynı {len(es) - len(degisen)} / {len(es)}; değişen {len(degisen)}")
ust = [k for k in sorted(set(eski) | set(yeni)) if k != "senaryolar" and m(eski.get(k)) != m(yeni.get(k))]
print(f"üst alanlarda değişen: {ust}")
if "kararlar" in ust:
    ek = sorted(set(yeni["kararlar"]) - set(eski["kararlar"]))
    deg = sorted(k for k in eski["kararlar"] if m(eski["kararlar"][k]) != m(yeni["kararlar"].get(k)))
    print(f"kararlar: eklenen {ek}; eskilerden değişen {deg}")
