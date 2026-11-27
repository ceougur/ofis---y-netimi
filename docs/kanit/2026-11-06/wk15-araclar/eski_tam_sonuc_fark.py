#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WK 15: eski (taban b91d82b9, değişiklikten ÖNCE alınmış kopya) senaryolar.json ↔ yeni senaryolar.json — eski senaryoların TAM kaydı
(başlık, açıklama, kaynak, girdi, elle, modelin bütün beklenen sonucu) bayt bayt karşılaştırılır; sıra da denetlenir; üst alanlardan değişenler yazılır.
Özet satırları (kanit.mjs): tests = eski senaryo sayısı + 1 (sıra), pass = bayt bayt aynı (+ sıra korunuyorsa 1), fail = farklı / eksik.
Kullanım: python3 -I eski_tam_sonuc_fark.py <eski senaryolar.json> <yeni senaryolar.json>"""
import json
import sys


def metin(d):
    return json.dumps(d, ensure_ascii=False, indent=1)


def main(eski_yol, yeni_yol):
    with open(eski_yol, encoding="utf-8") as f:
        eski = json.load(f)
    with open(yeni_yol, encoding="utf-8") as f:
        yeni = json.load(f)
    e_ad = [s["ad"] for s in eski["senaryolar"]]
    y_ad = [s["ad"] for s in yeni["senaryolar"]]
    yeni_s = {s["ad"]: s for s in yeni["senaryolar"]}
    ayni = farkli = eksik = 0
    for s in eski["senaryolar"]:
        y = yeni_s.get(s["ad"])
        if y is None:
            print("EKSİK", s["ad"]); eksik += 1
            continue
        if metin(s) == metin(y):
            ayni += 1
        else:
            farkli += 1
            for k in sorted(set(s) | set(y)):
                if metin(s.get(k)) != metin(y.get(k)):
                    print("FARKLI", s["ad"], "alan:", k)
    sira = y_ad[:len(e_ad)] == e_ad
    print(f"eski senaryo {len(e_ad)}: aynı {ayni}, farklı {farkli}, eksik {eksik}; sıra korunuyor: {sira}")
    print(f"yeni senaryo toplam {len(y_ad)}; yeni eklenen: {len(y_ad) - len(e_ad)} → {', '.join(y_ad[len(e_ad):])}")
    for k in sorted(set(eski) | set(yeni)):
        if k == "senaryolar":
            continue
        if metin(eski.get(k)) != metin(yeni.get(k)):
            if isinstance(eski.get(k), dict) and isinstance(yeni.get(k), dict):
                ek = sorted(set(yeni[k]) - set(eski[k])); cik = sorted(set(eski[k]) - set(yeni[k]))
                deg = sorted(a for a in set(eski[k]) & set(yeni[k]) if metin(eski[k][a]) != metin(yeni[k][a]))
                print(f"üst alan '{k}' değişti: eklenen {ek}, çıkan {cik}, değişen {deg}")
            else:
                print(f"üst alan '{k}' değişti")
        else:
            print(f"üst alan '{k}' aynı")
    toplam = len(e_ad) + 1                                                  # her eski senaryo + sıra denetimi
    gecen = ayni + (1 if sira else 0)
    print(f"1..{toplam}")
    for ad_, n_ in (("tests", toplam), ("pass", gecen), ("fail", toplam - gecen), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
        print(f"# {ad_} {n_}")
    return 0 if (farkli == 0 and eksik == 0 and sira) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
