#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bir koşunun sürüm 2 kapsam sayacı: senaryoda ve üç tarafın ham çıktısında sürüm 2 ile değişen yolların gerçekten
sınanıp sınanmadığını sayar (rapor için; karşılaştırma değil, beklenen değer üretmez).

Kullanım (depo kökünden):  python3 -I test/bagimsiz/kapsam.py rastgele-1-500 [rastgele-2-500 ...]
Okur: test/bagimsiz/cikti/senaryolar/<ad>.json ve cikti/ham/<ad>.{a,b,program}.json
"""

import json
import os
import re
import sys

BURASI = os.path.dirname(os.path.abspath(__file__))
CIKTI = os.path.join(BURASI, "cikti")


def oku(yol):
    with open(yol, encoding="utf-8") as fh:
        return json.load(fh)


def say(ad):
    sen = oku(os.path.join(CIKTI, "senaryolar", ad + ".json"))
    a = oku(os.path.join(CIKTI, "ham", ad + ".a.json"))
    p = oku(os.path.join(CIKTI, "ham", ad + ".program.json"))
    if "alternatifler" in a:
        # eşzamanlı grup: fark.py'nin programa en yakın seçtiği alternatif (fark-<tohum>.json → alternatifSecimi.a.secilen)
        sec = 0
        m_ = re.match(r"rastgele-(\d+)-\d+(.*)$", ad)
        fy = os.path.join(CIKTI, "fark-%s.json" % ((m_.group(1) + m_.group(2)) if m_ else ad))
        if os.path.exists(fy):
            sec = ((oku(fy).get("alternatifSecimi") or {}).get("a") or {}).get("secilen") or 0
        ust_bel = a.get("belirsizler") or []
        a = dict(a["alternatifler"][sec])
        a["belirsizler"] = (a.get("belirsizler") or []) + ust_bel
    adimlar = {x["id"]: x for x in sen["adimlar"]}
    tur = {}
    for x in sen["adimlar"]:
        if "ad" in x:
            tur[x["ad"]] = x
    hesap_turu = {x["ad"]: x["tur"] for x in sen["adimlar"] if x["islem"] == "hesap_ac"}
    a_ret = {r["adim"]: r for r in a.get("retler") or []}
    p_ret = {r["adim"]: r for r in p.get("retler") or []}
    yin = set(a.get("yinelenenler") or [])
    p_yin = set(p.get("yinelenenler") or [])
    k = {}

    def ekle(ad_, n=1):
        k[ad_] = k.get(ad_, 0) + n
    for x in sen["adimlar"]:
        i = x["id"]
        if x["islem"] == "sil" and tur.get(x["hedef"], {}).get("islem") == "kasa_hareket":
            ekle("kasa_hareket silme adımı")
            if i not in a_ret:
                ekle("kasa_hareket silme (başarılı, kâhin)")
        if x["islem"] == "cari_odeme" and x.get("yol") == "kart":
            ekle("kartla cari ödeme")
        if x["islem"] == "fatura" and any(r.get("yol") == "kart" for r in (x.get("odeme") or {}).get("pesin") or []):
            ekle("kartla alış peşini")
        yol_ = x.get("yol") or ((x.get("odeme") or {}).get("pesin") or [{}])[0].get("yol")
        yer = {"kart": "kart", "havale": "banka"}.get(yol_, "Kasa" if x["islem"] in ("kasa_hareket", "kasa_banka")
                                                       or yol_ == "nakit" else "banka/diğer")
        if x.get("yineDeKaydet"):
            ekle("yineDeKaydet (cashForce) adımı — %s" % yer)
            if i not in a_ret and i not in p_ret:
                ekle("  … iki tarafta da kabul edildi (%s)" % yer)
        if i in yin:
            ekle("istek kimliği yinelemesi (kâhin)")
            if i in p_yin:
                ekle("  … programda da yineleme")
        if i in a_ret and a_ret[i].get("kod") in ("cash-negative", "cash-blocked"):
            ekle("eksi bakiye reti %s (%s)" % (a_ret[i]["kod"], yer))
            if p_ret.get(i, {}).get("kod") == a_ret[i]["kod"]:
                ekle("  … programda aynı kod")
        if x["islem"] == "iade" and (x.get("geri") or {}).get("yol") == "acik" and i not in a_ret:
            ekle("geri ödenmemiş iade")
    # iade artanı: kâhin çıktısında iade belgesi açığı < toplam ve asıl kapalı olan durumlar (yaklaşık sayaç)
    fat = a.get("faturalar") or {}
    bel = {b["alan"] for b in a.get("belirsizler") or []}
    for x in sen["adimlar"]:
        if x["islem"] == "iade" and x.get("ad") in fat and (x.get("geri") or {}).get("yol") == "acik":
            f = fat[x["ad"]]
            if "faturalar.%s.acik" % x["ad"] in bel:
                ekle("geri ödenmemiş iade — açığı belirsiz (BELİRSİZ-7/11)")
            elif 0 < f["acik"]:
                ekle("iade artanı kalan (iade belgesi açık > 0, karşılaştırıldı)")
    return k


def main(argv):
    toplam = {}
    for ad in argv[1:]:
        k = say(ad)
        print(ad, json.dumps(k, ensure_ascii=False, sort_keys=True))
        for x, n in k.items():
            toplam[x] = toplam.get(x, 0) + n
    print("TOPLAM", json.dumps(toplam, ensure_ascii=False, sort_keys=True, indent=1))


if __name__ == "__main__":
    main(sys.argv)
