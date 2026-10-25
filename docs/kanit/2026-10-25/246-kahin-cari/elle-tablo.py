#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""2.4.6 cari kâhini — ELLE hesaplanmış tablo ↔ kâhin (25.10 ~15:30 BAŞ MİMAR düzeltmesi: K-b tek FIFO + KS8.1 artan; KS8.3 geri alındı). Değerler kâhinden DEĞİL, karar
metinlerinden (KARARLAR.md §10–§11, senaryo açıklamaları) elle hesaplandı; eski okumaların (mutant 133 / 137 / 142 / 143) ayırt edici beklentileri de elle. Program açılmaz.

  python3 -I docs/kanit/2026-10-25/246-kahin-cari/elle-tablo.py test/bagimsiz/cari

Son satır "N/M denetim geçti" (tools/kanit.mjs tanır); uyuşmazlık varsa çıkış 1.
"""
import json, subprocess, sys
KOK = sys.argv[1]
def model(f, mut=0):
    arg = ["python3", "-I", KOK + "/model.py", KOK + "/senaryolar/%s.json" % f] + (["--mutasyon", str(mut)] if mut else [])
    return json.loads(subprocess.run(arg, capture_output=True, text=True, check=True).stdout)["denetimler"]
IN = lambda a: {"amount": a, "direction": "in"}
OUT = lambda a: {"amount": a, "direction": "out"}
el = {
"c11-ks81-sa-mevcut-borc-karti": {
 "k1:fatura:SA:acik": 70000, "k1:cari:M:bakiye": 70000, "k1:cari:M:acikToplam": 70000, "k1:cari:M:acikEsitBakiye": True,
 "k1:takvim:cariToplam:M": 70000, "k1:vadeTakip:cariToplam:M": 70000, "k1:projeksiyon:cariToplam:M": 70000,
 "k1:vadeTakip:fatura:SA": IN(70000), "k1:projeksiyon:fatura:SA": IN(70000), "k1:takvim:fatura:SA": IN(70000),
 "k2:fatura:SA:acik": 100000, "k2:cari:M:bakiye": 100000, "k2:cari:M:acikEsitBakiye": True, "k2:takvim:cariToplam:M": 100000, "k2:projeksiyon:cariToplam:M": 100000, "k2:kasa": -30000,
 "k3:fatura:SA:acik": 100000, "k3:cari:M:bakiye": 100000, "k3:cari:M:acikToplam": 100000, "k3:cari:M:acikEsitBakiye": True,
 "k3:kart:KM:toplam": 100000, "k3:kart:KM:odenen": 0, "k3:kart:KM:kalan": 100000, "k3:kart:KM:mevcutBorc": True, "k3:kart:KM:taksit1:odenen": 0, "k3:kart:KM:taksit2:odenen": 0,
 "k3:takvim:cariToplam:M": 50000, "k3:vadeTakip:cariToplam:M": {"catal": [50000, 100000]}, "k3:projeksiyon:cariToplam:M": 100000,
 "k3:takvim:fatura:SA": "yok", "k3:vadeTakip:fatura:SA": "yok", "k3:projeksiyon:fatura:SA": "yok", "k3:kasa": -30000},
"c12-ks81-sb-kalan-dagilimi": {
 "k1:hareket:bb1:kalan": 0, "k1:cari:B1:bakiye": -30000, "k1:cari:B1:acikToplam": 0, "k1:cari:B1:acikEsitBakiye": False,
 "k1:fatura:FB:acik": 0, "k1:fatura:IB:acik": 10000, "k1:cari:B2:bakiye": -10000, "k1:cari:B2:acikToplam": -10000, "k1:cari:B2:acikEsitBakiye": True,
 "k1:hareket:ab3:kalan": 0, "k1:cari:B3:bakiye": 30000, "k1:cari:B3:acikToplam": 0, "k1:cari:B3:acikEsitBakiye": False,
 "k1:hareket:bb4:kalan": 0, "k1:hareket:ab4:kalan": 15000, "k1:cari:B4:bakiye": -25000, "k1:cari:B4:acikToplam": -15000, "k1:cari:B4:acikEsitBakiye": False, "k1:kasa": 60000,
 "k1:fatura:FA5:acik": 30000, "k1:fatura:FB5:acik": 0, "k1:fatura:IB5:acik": 0, "k1:cari:B5:bakiye": 30000, "k1:cari:B5:acikToplam": 30000, "k1:cari:B5:acikEsitBakiye": True,
 "k2:hareket:bb1:kalan": 10000, "k2:cari:B1:bakiye": 10000, "k2:cari:B1:acikToplam": 10000, "k2:cari:B1:acikEsitBakiye": True,
 "k2:takvim:cariToplam:B1": 10000, "k2:vadeTakip:cariToplam:B1": 10000, "k2:projeksiyon:cariToplam:B1": 10000,
 "k2:fatura:FB:acik": 20000, "k2:fatura:IB:acik": 0, "k2:cari:B2:bakiye": 20000, "k2:cari:B2:acikEsitBakiye": True, "k2:takvim:cariToplam:B2": 20000, "k2:projeksiyon:fatura:FB": IN(20000),
 "k2:hareket:ab3:kalan": 10000, "k2:cari:B3:bakiye": -10000, "k2:cari:B3:acikToplam": -10000, "k2:cari:B3:acikEsitBakiye": True, "k2:projeksiyon:cariToplam:B3": -10000,
 "k2:hareket:bb4:kalan": 20000, "k2:hareket:ab4:kalan": 0, "k2:cari:B4:bakiye": 25000, "k2:cari:B4:acikToplam": 20000, "k2:cari:B4:acikEsitBakiye": False,
 "k2:fatura:FA5:acik": 50000, "k2:fatura:FB5:acik": 0, "k2:fatura:IB5:acik": 0, "k2:cari:B5:bakiye": 50000, "k2:cari:B5:acikToplam": 50000, "k2:cari:B5:acikEsitBakiye": True,
 "k2:takvim:cariToplam:B5": 50000, "k2:vadeTakip:cariToplam:B5": 50000, "k2:projeksiyon:cariToplam:B5": 50000, "k2:projeksiyon:fatura:FA5": IN(50000), "k2:projeksiyon:fatura:FB5": "yok",
 "k2:kasa": -40000},
"c13-ks83-ayni-gun-sira": {
 **{"k1:fatura:F%d:acik" % i: 20000 for i in (1, 2, 3, 6)}, "k1:fatura:F4:acik": 50000, "k1:fatura:F5:acik": 50000, "k1:fatura:AT9:acik": 20000,
 **{"k1:hareket:a%d:kalan" % i: 0 for i in (1, 2, 3, 6, 7)}, "k1:hareket:a8:kalan": 30000, "k1:hareket:b9:kalan": 0,
 **{"k1:cari:S%d:bakiye" % i: 20000 for i in (1, 2, 3, 6)}, "k1:cari:S4:bakiye": 50000, "k1:cari:S5:bakiye": 50000,
 "k1:cari:S7:bakiye": -30000, "k1:cari:S8:bakiye": -30000, "k1:cari:S9:bakiye": -20000,
 **{"k1:cari:S%d:acikEsitBakiye" % i: True for i in (1, 2, 3, 4, 5, 6, 8, 9)}, "k1:cari:S7:acikEsitBakiye": False,
 "k1:cari:S7:acikToplam": 0, "k1:cari:S8:acikToplam": -30000, "k1:cari:S9:acikToplam": -20000,
 **{"k1:%s:cariToplam:S%d" % (g, i): 20000 for g in ("takvim", "vadeTakip", "projeksiyon") for i in (1, 2, 3, 6)},
 **{"k1:%s:cariToplam:S4" % g: 50000 for g in ("takvim", "vadeTakip", "projeksiyon")},
 **{"k1:%s:cariToplam:S8" % g: -30000 for g in ("takvim", "vadeTakip", "projeksiyon")},
 **{"k1:%s:cariToplam:S9" % g: -20000 for g in ("takvim", "vadeTakip", "projeksiyon")},
 "k1:vadeTakip:hareket:a8": {"amount": 30000, "date": "2026-06-18", "direction": "out"}, "k1:projeksiyon:hareket:a8": {"amount": 30000, "date": "2026-06-18", "direction": "out"},
 "k1:takvim:hareket:a7": "yok", "k1:projeksiyon:hareket:a7": "yok", "k1:takvim:hareket:a6": "yok", "k1:takvim:hareket:b9": "yok",
 "k1:kasa": -180000},
"c8-ks8-iade-geri-odemesi": {
 "k3:fatura:FE1:acik": 20000, "k3:hareket:ae1:kalan": 0, "k3:cari:E:bakiye": 20000, "k4:fatura:FE1:acik": 20000, "k4:hareket:ae1:kalan": 0,
 "k3:fatura:FA1:acik": 50000, "k3:hareket:ba1:kalan": 30000, "k3:fatura:FA2:acik": 20000, "k3:hareket:ba2:kalan": 40000, "k3:fatura:FB2:acik": 20000, "k3:fatura:FC2:acik": 20000,
 "k3:fatura:FD1:acik": 30000, "k4:fatura:FD1:acik": 50000, "k4:hareket:bd1:kalan": 30000, "k4:cari:D:bakiye": 85000,
 "k3:fatura:AS1:acik": 50000, "k3:hareket:aa1:kalan": 30000, "k3:fatura:AS2:acik": 15000,
 "k5:fatura:FA1:acik": 20000, "k6:fatura:FA1:acik": 50000},
"c8b-ks8-bagli-iade-odemesi": {"k3:fatura:FF1:acik": 30000, "k3:fatura:FF2:acik": 20000, "k3:cari:F:bakiye": 80000},
}
yok = {"c12-ks81-sb-kalan-dagilimi": ["k1:takvim:cariToplam:B1", "k1:takvim:cariToplam:B2", "k2:takvim:cariToplam:B4"],
       "c13-ks83-ayni-gun-sira": ["k1:takvim:cariToplam:S7", "k1:takvim:cariToplam:S5"]}
# Mutantlarla elle karşılaştırma (yalnız ayırt edici değerler): eski okumaların beklentisi de elle
mut = {133: {"c13-ks83-ayni-gun-sira": {"k1:fatura:F1:acik": 50000, "k1:hareket:a1:kalan": 30000, "k1:fatura:AT9:acik": 50000, "k1:hareket:b9:kalan": 30000},
             "c8-ks8-iade-geri-odemesi": {"k3:fatura:FE1:acik": 50000, "k3:hareket:ae1:kalan": 30000}},
       142: {"c13-ks83-ayni-gun-sira": {"k1:fatura:F3:acik": 50000, "k1:hareket:a3:kalan": 30000, "k1:fatura:F1:acik": 20000, "k1:fatura:F6:acik": 50000, "k1:hareket:a6:kalan": 30000}},
       143: {"c12-ks81-sb-kalan-dagilimi": {"k2:fatura:FA5:acik": 30000, "k2:fatura:FB5:acik": 20000}},
       137: {"c12-ks81-sb-kalan-dagilimi": {"k2:hareket:bb1:kalan": 0, "k2:fatura:FB:acik": 0, "k2:hareket:ab3:kalan": 0, "k2:fatura:FA5:acik": 30000},
             "c8-ks8-iade-geri-odemesi": {"k3:fatura:FA1:acik": 20000}}}
n = h = 0
for f, tab in el.items():
    d = model(f)
    for k, v in tab.items():
        n += 1
        if d.get(k, {}).get("b", "YOK") != v:
            h += 1; print("UYUŞMAZ", f, k, "elle", v, "model", d.get(k, {}).get("b", "YOK"))
    for k in yok.get(f, []):
        n += 1
        if k in d:
            h += 1; print("OLMAMALI", f, k, d[k]["b"])
    print(f, "etiketler:", sorted({v["e"] for k, v in d.items() if "cariToplam" in k or "acik" in k or "kalan" in k}))
for m, tablo in mut.items():
    for f, tab in tablo.items():
        d = model(f, m)
        for k, v in tab.items():
            n += 1
            if d.get(k, {}).get("b", "YOK") != v:
                h += 1; print("UYUŞMAZ mutant", m, f, k, "elle", v, "model", d.get(k, {}).get("b", "YOK"))
print("elle denetim", n, "uyuşmaz", h)
print("%d/%d denetim geçti" % (n - h, n))
sys.exit(1 if h else 0)
