#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Senaryo ve beklenen çıktı dosyalarını yazar / denetler (kâhin).

  python3 test/bagimsiz/muhasebe/uret_beklenen.py            # senaryolar/*.json ve senaryolar/beklenen/*.json yazar
  python3 test/bagimsiz/muhasebe/uret_beklenen.py --denetle  # diskteki dosyalar güncel mi (çıkış 1: değil)

senaryolar/<ad>.json kendi kendine yeter (tanımlar + olaylar + dallar + elle değerler); sürücü bunu programın API'sine çevirir.
senaryolar/beklenen/<ad>.json: her dal etiketi ("A", "KG6=B" …) için modelin tam çıktısı (raporlar, redler, değişmezler, devirler).
"""

import json
import os
import sys

BURASI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BURASI)
import model as M  # noqa: E402
import senaryolar_elle as E  # noqa: E402
import uretici as U  # noqa: E402

SEN = os.path.join(BURASI, "senaryolar")
BEK = os.path.join(SEN, "beklenen")


def tum_senaryolar():
    out = []
    for s in E.SENARYOLAR:
        x = {"dil": M.DIL}
        x.update(s)
        x.update(E.TANIM)
        out.append(x)
    for t in U.TOHUMLAR:
        out.append(U.uret(t))
    return out


def beklenen(s):
    b = {"dil": M.DIL, "ad": s["ad"], "dallar": {}}
    for et in M.dal_etiketleri(s):
        r = M.kos(s, M.Kurallar.etiketten(et))
        b["dallar"][et] = {k: r[k] for k in ("raporlar", "redler", "degismezler", "devirler", "acilis_olabilir")}
    return b


def metin(nesne):
    return json.dumps(nesne, ensure_ascii=False, indent=1, sort_keys=True) + "\n"


def main(denetle=False):
    os.makedirs(BEK, exist_ok=True)
    eski = []
    for s in tum_senaryolar():
        for yol, icerik in ((os.path.join(SEN, s["ad"] + ".json"), metin(s)), (os.path.join(BEK, s["ad"] + ".json"), metin(beklenen(s)))):
            if denetle:
                try:
                    with open(yol, encoding="utf-8") as f:
                        if f.read() != icerik:
                            eski.append(os.path.relpath(yol, BURASI))
                except FileNotFoundError:
                    eski.append(os.path.relpath(yol, BURASI) + " (yok)")
            else:
                with open(yol, "w", encoding="utf-8") as f:
                    f.write(icerik)
    if denetle:
        print("güncel" if not eski else "ESKİ: " + ", ".join(eski))
        return 1 if eski else 0
    print(f"{len(tum_senaryolar())} senaryo yazıldı")
    return 0


if __name__ == "__main__":
    sys.exit(main("--denetle" in sys.argv))
