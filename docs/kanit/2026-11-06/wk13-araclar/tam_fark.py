# -*- coding: utf-8 -*-
"""WK13: eski senaryoların TAM model sonucu (girdi + elle + beklenen + başlık / kaynak / açıklama) eski senaryolar.json ↔ yeni kâhin.
Kullanım: python3 -I tam_fark.py <yeni kahin klasörü> <eski senaryolar.json>"""
import json
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin  # noqa: E402
import senaryolar  # noqa: E402


def m(x):
    return json.dumps(x, sort_keys=True, ensure_ascii=False)


def ilk_fark(a, b, yol=""):
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                return f"{yol}.{k}: {'yok' if k not in a else m(a[k])[:120]} ↔ {'yok' if k not in b else m(b[k])[:120]}"
            if m(a[k]) != m(b[k]):
                return ilk_fark(a[k], b[k], f"{yol}.{k}")
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(a, b)):
            if m(x) != m(y):
                return ilk_fark(x, y, f"{yol}[{i}]")
    return f"{yol}: {m(a)[:160]} ↔ {m(b)[:160]}"


with open(sys.argv[2], encoding="utf-8") as f:
    eski = json.load(f)
eski_s = {s["ad"]: s for s in eski["senaryolar"]}
yeni = {s["ad"]: s for s in senaryolar.tum_senaryolar()}
ayni = degisen = 0
for ad, es in eski_s.items():
    s = yeni.get(ad)
    if s is None:
        print("SİLİNDİ", ad); degisen += 1
        continue
    kayit = {"ad": s["ad"], "baslik": s["baslik"], "aciklama": s["aciklama"], "kaynak": s["kaynak"], "serbest": s.get("serbest", []),
             "girdi": {k: v for k, v in senaryolar.girdi(s).items() if k not in ("ad", "baslik", "aciklama", "kaynak")},
             "elle": [{"secim": k, "yollar": y} for k, y in s["elle"]], "beklenen": kahin.hesapla(senaryolar.girdi(s))}
    if m(kayit) == m(es):
        ayni += 1
    else:
        degisen += 1
        print("DEĞİŞTİ", ad, "—", ilk_fark(es, kayit))
ust_eski = {k: v for k, v in eski.items() if k != "senaryolar"}
ust_yeni_kararlar = kahin.KARARLAR
print("üst alan 'kararlar' eklenen anahtarlar:", sorted(set(ust_yeni_kararlar) - set(ust_eski.get("kararlar", {}))))
print("üst alan 'kararlar' değişen eski anahtarlar:", sorted(k for k in ust_eski.get("kararlar", {}) if m(ust_eski["kararlar"][k]) != m(ust_yeni_kararlar.get(k))))
print(f"eski senaryo: {len(eski_s)}; bayt bayt aynı: {ayni}; değişen: {degisen}")
