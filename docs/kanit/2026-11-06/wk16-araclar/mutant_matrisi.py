#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WK 16 — mutant matrisi: güncelleme 16'nın mutantları (M223–M235) + ilgili eski mutantlar, yeni / değişen senaryolarda DEĞERLE mi (elle beklenen) İSTİSNAYLA mı yakalanıyor.
Kullanım: python3 -I mutant_matrisi.py <kahin dizini>   (senaryolar.py'yi o dizinden içe aktarır)
"""
import importlib
import sys

MUTANTLAR = ("M223", "M224", "M225", "M226", "M227", "M228", "M229", "M230", "M231", "M232", "M233", "M234", "M235",
             "M198", "M213", "M214", "M215", "M216", "M217", "M219", "M222")
ONEK = ("S29-", "S30-", "S31-", "S32-", "S23-05-", "SW3-05-")


def main(argv):
    sys.path.insert(0, argv[0])
    kahin = importlib.import_module("kahin")
    senaryolar = importlib.import_module("senaryolar")
    secili = [s for s in senaryolar.tum_senaryolar() if s["ad"].startswith(ONEK)]
    print(f"senaryo {len(secili)}: {[s['ad'][:8] for s in secili]}")
    eksik = []
    for m in MUTANTLAR:
        deger, istisna = [], []
        for s in secili:
            try:
                b = kahin.hesapla(senaryolar.girdi(s), frozenset([m]))
            except Exception as e:  # noqa: BLE001
                istisna.append(f"{s['ad'][:8]}({type(e).__name__}: {str(e)[:60]})")
                continue
            if senaryolar.elle_denetle(s, b):
                deger.append(s["ad"][:8])
        print(f"{m}: değerle {len(deger)} {deger}; istisnayla {len(istisna)} {istisna}")
        if m.startswith("M2") and int(m[1:]) >= 223 and not deger:
            eksik.append(m)
    print(f"# güncelleme 16 mutantlarından değerle yakalanmayan: {eksik or 'YOK'}")
    return 1 if eksik else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
