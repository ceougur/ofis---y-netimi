#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 7 (cari) — G1 taraması: elle senaryolarda seriden numara alan belge adımlarının (satış faturası — `fatura` tur ≠ alis, taslak dahil — ve `iade`)
senaryo içindeki TARİH SIRASI. Program AÇILMAZ; yalnız senaryo dosyaları okunur.

  python3 -I g1-tara.py <senaryolar klasörü> [--sert]

Okuma (girdi G1): "aynı fatura serisinde belgeleri TARİH SIRASIYLA kabul eder … bütün fatura (ve seriden numara alan iade) adımları, hangi cariye ait olursa olsun,
tarih sırasıyla (eşit ya da artan) girilmelidir." Alış faturası satıcının numarasıyla girilir (koşucu `number` verir — kos.mjs eşlemesi) → seriden numara ALMAZ; yine de
`--sert` ile alış da aynı dizide sayılır (bilgi için ayrı satır). Tarih = adımın `tarih`'i, yoksa senaryonun `bugun`'ü (koşucunun kuralı).
Çıktı: senaryo başına ihlal (önceki en büyük tarih > bu adımın tarihi). Son satır "N/M denetim geçti" (ihlalsiz senaryo / senaryo)."""
import json
import os
import sys

D = sys.argv[1]
SERT = "--sert" in sys.argv


def seri_mi(a, sert):
    if a.get("islem") == "iade":
        return True
    if a.get("islem") == "fatura":
        return sert or a.get("tur", "satis") != "alis"
    return False


def ihlaller(sen, sert=False):
    out, enb, enb_id = [], None, None
    for i, a in enumerate(sen["adimlar"]):
        if not seri_mi(a, sert):
            continue
        t = a.get("tarih") or sen["bugun"]
        if enb is not None and t < enb:
            out.append((i, a["id"], t, enb_id, enb))
        if enb is None or t > enb:
            enb, enb_id = t, a["id"]
    return out


if __name__ == "__main__":
    gecen = kalan = 0
    sert_kalan = []
    for f in sorted(os.listdir(D)):
        if not f.endswith(".json"):
            continue
        with open(os.path.join(D, f), encoding="utf-8") as g:
            sen = json.load(g)
        iy = ihlaller(sen)
        if iy:
            kalan += 1
            print("  ✗ %s: %d ihlal — %s" % (f, len(iy), "; ".join("adım %d %s %s < %s (%s)" % (i, aid, t, enb, eid) for i, aid, t, eid, enb in iy)))
        else:
            gecen += 1
        if SERT:
            s = ihlaller(sen, True)
            if s and not iy:
                sert_kalan.append(f)
                print("  (bilgi, --sert: alış dahil) %s: %s" % (f, "; ".join("adım %d %s %s < %s (%s)" % (i, aid, t, enb, eid) for i, aid, t, eid, enb in s)))
    print("G1 TARAMASI (satış faturası + iade, senaryo içi tarih sırası): %d senaryo ihlalsiz, %d ihlalli%s" % (gecen, kalan, "; --sert ile yalnız alış yüzünden ihlalli %d" % len(sert_kalan) if SERT else ""))
    toplam = gecen + kalan
    print("# tests %d" % toplam)
    print("# pass %d" % gecen)
    print("# fail %d" % kalan)
    print("%d/%d denetim geçti" % (gecen, toplam))
    sys.exit(0 if kalan == 0 else 1)
