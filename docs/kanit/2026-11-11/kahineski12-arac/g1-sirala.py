#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 7 (cari) — G1 düzeltmesi: senaryonun adımlarının YERİNİ değiştirir (KARARLAR.md §19 Y7-1). Tutar / tarih / ad / elle beklenen değer DEĞİŞMEZ.

  python3 -I g1-sirala.py <senaryo.json>…      (yerinde yazar; depodaki biçimle — bicim.py)

Yöntem: `kontrol` ve carisi çözülemeyen her adım SINIRDIR (yeri korunur). İki sınır arasındaki kesimde adımlar carilerine göre kuyruklara ayrılır (her carinin kendi adım sırası
AYNEN); `cari_ac` adımları kesimin başına ilk sıralarıyla; öbürleri k-yollu birleştirmeyle — her adımda kuyruk başları arasından tarihi (yoksa senaryonun `bugun`'ü) en küçük olan,
eşitte özgün sırası önce gelen alınır. Her carinin dizisi kendi içinde tarih sıralıysa kesim tarih sıralı çıkar (G1). Cari çözümü: `cari` alanı; `iade` → asıl faturanın carisi;
`kart_tahsilat` → kartın carisi; `cari_ac` → `ad`."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402


def cari_of(a, fatura_cari, kart_cari):
    i = a["islem"]
    if i == "kontrol":
        return None
    if i == "cari_ac":
        return a["ad"]
    if a.get("cari"):
        return a["cari"]
    if i == "iade":
        return fatura_cari.get(a.get("fatura"))
    if i == "kart_tahsilat":
        return kart_cari.get(a.get("kayit"))
    return None


def sirala(sen):
    fatura_cari, kart_cari = {}, {}
    adimlar = sen["adimlar"]
    for a in adimlar:
        if a["islem"] == "fatura":
            fatura_cari[a["ad"]] = a["cari"]
        if a["islem"] in ("kart_ac", "stok_satis_taksit"):
            kart_cari[a["ad"]] = a["cari"]
    out, kesim = [], []

    def bosalt():
        acilis = [x for x in kesim if x[1]["islem"] == "cari_ac"]
        kuyruk, sira = {}, []
        for i, a, c in kesim:
            if a["islem"] == "cari_ac":
                continue
            if c not in kuyruk:
                kuyruk[c] = []
                sira.append(c)
            kuyruk[c].append((i, a))
        out.extend(a for _i, a, _c in acilis)
        while any(kuyruk.values()):
            aday = min((c for c in sira if kuyruk[c]), key=lambda c: (kuyruk[c][0][1].get("tarih") or sen["bugun"], kuyruk[c][0][0]))
            out.append(kuyruk[aday].pop(0)[1])
        kesim.clear()

    for i, a in enumerate(adimlar):
        c = cari_of(a, fatura_cari, kart_cari)
        if c is None:
            bosalt()
            out.append(a)
        else:
            kesim.append((i, a, c))
    bosalt()
    assert sorted(map(id, out)) == sorted(map(id, adimlar)) and len(out) == len(adimlar)
    return dict(sen, adimlar=out)


if __name__ == "__main__":
    for p in sys.argv[1:]:
        with open(p, encoding="utf-8") as f:
            sen = json.load(f)
        yeni = sirala(sen)
        bicim.yaz(p, yeni)
        print("%s: %d adım, %d adımın yeri değişti" % (os.path.basename(p), len(yeni["adimlar"]), sum(1 for x, y in zip(sen["adimlar"], yeni["adimlar"]) if x is not y)))
