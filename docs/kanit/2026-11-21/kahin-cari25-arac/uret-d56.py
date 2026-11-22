#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 25 (§37): d56 (iade / iade iptali — S238 / S239 / S240, §3) ve d57 (Düzenle — S241 / S242) elle senaryolarını yazar.
Elle beklenenler KARAR METİNLERİNDEN (girdi §1–§3) ve §37'nin yorumlarından, kâhin KOŞULMADAN elle hesaplandı (her satırın yanında hesap); model.py'nin çıktısından
TÜRETİLMEZ (ders 5, 40). Kullanım: python3 -I uret-d56.py <senaryolar klasörü>"""
import json
import os
import sys

HEDEF = sys.argv[1]
TL = 100  # kuruş


def yaz(ad, sen):
    with open(os.path.join(HEDEF, ad + ".json"), "w", encoding="utf-8") as f:
        json.dump(sen, f, ensure_ascii=False, indent=1)
        f.write("\n")


def cari(id_, ad, isim, tarih="2026-09-01"):
    return {"id": id_, "islem": "cari_ac", "ad": ad, "isim": isim, "tarih": tarih}


def fatura(id_, ad, c, tutar, adet, tarih, taksit=None):
    a = {"id": id_, "islem": "fatura", "ad": ad, "cari": c, "tur": "satis", "tutar": str(tutar), "adet": adet, "tarih": tarih}
    if taksit:
        a["taksit"] = taksit
    return a


def kart(id_, ad, c, tutar, n, ilk, tarih):
    return {"id": id_, "islem": "kart_ac", "ad": ad, "cari": c, "tutar": str(tutar), "taksit": n, "ilkVade": ilk, "tarih": tarih, "mevcut": True}


def kt(id_, k, tutar, tarih):
    return {"id": id_, "islem": "kart_tahsilat", "kayit": k, "tutar": str(tutar), "tarih": tarih}


def tah(id_, c, tutar, tarih):
    return {"id": id_, "islem": "tahsilat", "cari": c, "tutar": str(tutar), "tarih": tarih}


def borc(id_, c, tutar, tarih):
    return {"id": id_, "islem": "borc", "cari": c, "tutar": str(tutar), "tarih": tarih}


def iade(id_, ad, f, adet, tarih):
    return {"id": id_, "islem": "iade", "ad": ad, "fatura": f, "adet": adet, "tarih": tarih}


def kontrol(id_):
    return {"id": id_, "islem": "kontrol", "gecikmis": True, "acikToplam": True}


E, Y = {}, []


def cr(k, c, bakiye, gecikmis, acik=None, esit=True):
    E["%s:cari:%s:bakiye" % (k, c)] = bakiye * TL
    if gecikmis is None:
        Y.append("%s:cari:%s:gecikmis" % (k, c))
    else:
        E["%s:cari:%s:gecikmis" % (k, c)] = gecikmis * TL
    if acik is not None:
        E["%s:cari:%s:acikToplam" % (k, c)] = acik * TL
        E["%s:cari:%s:acikEsitBakiye" % (k, c)] = esit


def kr(k, no, toplam, odenen, kalan, kapali=None):
    E["%s:kart:%s:var" % (k, no)] = True
    E["%s:kart:%s:mevcutBorc" % (k, no)] = True
    E["%s:kart:%s:toplam" % (k, no)] = toplam * TL
    E["%s:kart:%s:odenen" % (k, no)] = odenen * TL
    E["%s:kart:%s:kalan" % (k, no)] = kalan * TL
    if kapali is not None:
        E["%s:kart:%s:kapali" % (k, no)] = kapali


def tks(k, no, *odenen):
    for i, v in enumerate(odenen):
        E["%s:kart:%s:taksit%d:odenen" % (k, no, i + 1)] = v * TL


def tks_yok(k, no, n=3):
    for i in range(n):
        Y.append("%s:kart:%s:taksit%d:odenen" % (k, no, i + 1))  # Y24-9 (iv): taksiti 0'a inen kartın satırları — 2.5.1'E (görünüm)


def ft(k, f, acik, gosterilen=None, kartta=None, taksitte=None):
    E["%s:fatura:%s:acik" % (k, f)] = acik * TL
    if gosterilen is not None:
        E["%s:fatura:%s:gosterilen" % (k, f)] = gosterilen * TL
        E["%s:fatura:%s:kartta" % (k, f)] = kartta * TL
    if taksitte is not None:
        E["%s:fatura:%s:taksitte" % (k, f)] = taksitte


def fk(k, f, toplam, kalan, kapali=None):
    E["%s:kart:fatura:%s:toplam" % (k, f)] = toplam * TL
    E["%s:kart:fatura:%s:kalan" % (k, f)] = kalan * TL
    if kapali is not None:
        E["%s:kart:fatura:%s:kapali" % (k, f)] = kapali


def ok(*ids):
    for i in ids:
        E["adim:%s:durum" % i] = "ok"


# ───────────────────────── d56 — iade / iade iptali (bugün 20.11.2026)
A = []
# G1 — S238 = A kararın KENDİ örneği, KAPANMIŞ kartta (Kartı Kapat bugün 20.11): kart 900 (05.10 / 05.11 / 05.12), tahsilat 300 (1. taksit), 10.11 iade 300 (2. taksit 0'a), iade iptali
A += [cari("cg1", "G1", "Gaye Kapalı Kart İptal"), fatura("fg1", "FG1", "G1", 900, 3, "2026-09-01"), kart("kg1", "KG1", "G1", 900, 3, "2026-10-05", "2026-09-02"),
      kt("tg1", "KG1", 300, "2026-09-03"), {"id": "kkg1", "islem": "kart_kapat", "kart": "KG1"}]
# H1 — S239 = A kararın KENDİ örneği: fatura 900, kart 600 (E = 0 — S200 / Y23-5: faturanın 600'ü kartta, 300'ü kendi vadesiyle (01.09) dışarıda), iade 300
A += [cari("ch1", "H1", "Hale Kısmen Kartta"), fatura("fh1", "FH1", "H1", 900, 3, "2026-09-01"), kart("kh1", "KH1", "H1", 600, 2, "2026-10-05", "2026-09-02")]
# H2 — S239 artan kolu (Y25-3 okuma): aynı, iade 600 → dış 300 önce, artan 300 kartı küçültür (05.10 taksiti 0'a)
A += [cari("ch2", "H2", "Halil Dış Önce Sonra Kart"), fatura("fh2", "FH2", "H2", 900, 3, "2026-09-01"), kart("kh2", "KH2", "H2", 600, 2, "2026-10-05", "2026-09-02")]
# J1 — S240 = A (SK-44'ün örneği): elle Borç 400 + fatura 500 → kart 900 (S126), tahsilat 300, faturaya iade 200
A += [cari("cj1", "J1", "Jale Çok Kalemli Kart"), borc("bj1", "J1", 400, "2026-09-01"), fatura("fj1", "FJ1", "J1", 500, 5, "2026-09-02"),
      kart("kj1", "KJ1", "J1", 900, 3, "2026-10-05", "2026-09-03"), kt("tj1", "KJ1", 300, "2026-09-04")]
# J2 — S240 okuma: F1 400 (01.09) + F2 500 (02.09) → kart 900, tahsilat 300, ESKİ faturaya (F1) iade 200
A += [cari("cj2", "J2", "Jülide İki Faturalı Kart"), fatura("fj2a", "FJ2A", "J2", 400, 4, "2026-09-01"), fatura("fj2b", "FJ2B", "J2", 500, 5, "2026-09-02"),
      kart("kj2", "KJ2", "J2", 900, 3, "2026-10-05", "2026-09-03"), kt("tj2", "KJ2", 300, "2026-09-04")]
# L1 / L2 — §3, S110 (TEK eşit elle borç): elle Borç 900 + fatura 600, kart 900 ⇒ kart elle borcu taşır; faturanın iadesi (L1) / iptali (L2) kartı değiştirmez
A += [cari("cl1", "L1", "Leman Kartsız Fatura İade"), borc("bl1", "L1", 900, "2026-09-01"), fatura("fl1", "FL1", "L1", 600, 2, "2026-09-02"),
      kart("kl1", "KL1", "L1", 900, 3, "2026-10-05", "2026-09-03"), kt("tl1", "KL1", 300, "2026-09-04")]
A += [cari("cl2", "L2", "Levent Kartsız Fatura İptal"), borc("bl2", "L2", 900, "2026-09-01"), fatura("fl2", "FL2", "L2", 600, 2, "2026-09-02"),
      kart("kl2", "KL2", "L2", 900, 3, "2026-10-05", "2026-09-03"), kt("tl2", "KL2", 300, "2026-09-04")]
# M1 / M2 — §3, S120 (kararın örneği): F 600 + X 500 + Y 700, kart 900 ⇒ X 500 + Y 400 kartta; F ayrı. F'nin iadesi (M1) / iptali (M2)
A += [cari("cm1", "M1", "Mert Elle Borçlu Kart İade"), fatura("fm1", "FM1", "M1", 600, 2, "2026-09-01"), borc("xm1", "M1", 500, "2026-09-02"), borc("ym1", "M1", 700, "2026-09-03"),
      kart("km1", "KM1", "M1", 900, 3, "2026-10-05", "2026-09-04")]
A += [cari("cm2", "M2", "Melis Elle Borçlu Kart İptal"), fatura("fm2", "FM2", "M2", 600, 2, "2026-09-01"), borc("xm2", "M2", 500, "2026-09-02"), borc("ym2", "M2", 700, "2026-09-03"),
      kart("km2", "KM2", "M2", 900, 3, "2026-10-05", "2026-09-04")]
# N1 / N2 — §3'ün KENDİ örneği (yalnız faturalar, E = 0): A 600 (01.09), B 600 (02.09), 05.09 elle kart 600 → hangi fatura kartta AÇIKÇA yok → iptal / iade sonrası SUS (SK-45)
A += [cari("cn1", "N1", "Nazlı İki Fatura İptal"), fatura("fn1a", "FN1A", "N1", 600, 2, "2026-09-01"), fatura("fn1b", "FN1B", "N1", 600, 2, "2026-09-02"),
      kart("kn1", "KN1", "N1", 600, 2, "2026-10-05", "2026-09-05")]
A += [cari("cn2", "N2", "Necdet İki Fatura İade"), fatura("fn2a", "FN2A", "N2", 600, 2, "2026-09-01"), fatura("fn2b", "FN2B", "N2", 600, 2, "2026-09-02"),
      kart("kn2", "KN2", "N2", 600, 2, "2026-10-05", "2026-09-05")]
# Q1 / Q2 — S200 alanında (O > T) çok kalemli kart: elle Borç 300 + fatura 900, kart 1.000 (S200: Borç 300 + faturanın 700'ü; 200 dışarıda).
#   Q1 iade 100 ≤ dış 200 → S239 'önce dış' — kart değişmez (değer). Q2 iade 500 > dış → artan karttan; S200 → S126 sınıf değişimi — SUS (SK-46)
A += [cari("cq1", "Q1", "Kader Dış Açıklı Çok Kalem"), borc("bq1", "Q1", 300, "2026-09-01"), fatura("fq1", "FQ1", "Q1", 900, 9, "2026-09-02"),
      kart("kq1", "KQ1", "Q1", 1000, 2, "2026-10-05", "2026-09-03")]
A += [cari("cq2", "Q2", "Kerem Sınıf Değişen Kart"), borc("bq2", "Q2", 300, "2026-09-01"), fatura("fq2", "FQ2", "Q2", 900, 9, "2026-09-02"),
      kart("kq2", "KQ2", "Q2", 1000, 2, "2026-10-05", "2026-09-03")]
# SENARYO DÜZELTMESİ (açıkça — kural değil): seriden numara alan faturalar senaryoda tarih sırasıyla yazılmalı (§19 Y7-1) — kurulum adımları tarihe göre (eşit tarihte yazım sırası) dizilir; tarihsiz
# Kartı Kapat kurulumun sonunda (kapanış bugün). İlk tasarımda cari blokları sırayla yazılmıştı (oz-test Y7-1 denetimi kırmızı).
A = sorted([x for x in A if x.get("tarih")], key=lambda x: x["tarih"]) + [x for x in A if not x.get("tarih")]
A += [kontrol("k0")]
# k0 (bugün 20.11; iadeler yok)
cr("k0", "G1", 600, 300, 600); kr("k0", "KG1", 900, 300, 600, True); ft("k0", "FG1", 600, 0, 600, True)  # 05.11 taksiti gecikmiş (S220 kendi vadesi), 05.12 → kapanış 20.11 (bugün) gecikmemiş
cr("k0", "H1", 900, 900, 900); kr("k0", "KH1", 600, 0, 600); ft("k0", "FH1", 900, 300, 600, False)  # dış 300 (01.09) + 05.10 300 + 05.11 300 gecikmiş
cr("k0", "H2", 900, 900, 900); kr("k0", "KH2", 600, 0, 600); ft("k0", "FH2", 900, 300, 600, False)
cr("k0", "J1", 600, 300, 600); kr("k0", "KJ1", 900, 300, 600); ft("k0", "FJ1", 500, 0, 500, True); E["k0:hareket:bj1:kalan"] = 100 * TL  # ödeme 300 önce elle Borç (01.09 — S126 içine alma sırası)
cr("k0", "J2", 600, 300, 600); kr("k0", "KJ2", 900, 300, 600); ft("k0", "FJ2A", 100, 0, 100, True); ft("k0", "FJ2B", 500, 0, 500, True)
cr("k0", "L1", 1200, 900, 1200); kr("k0", "KL1", 900, 300, 600); ft("k0", "FL1", 600, 600, 0, False); E["k0:hareket:bl1:kalan"] = 600 * TL  # gecikmiş: FL1 600 (02.09) + 05.11 300
cr("k0", "L2", 1200, 900, 1200); kr("k0", "KL2", 900, 300, 600); ft("k0", "FL2", 600, 600, 0, False); E["k0:hareket:bl2:kalan"] = 600 * TL
cr("k0", "M1", 1800, 1500, 1800); kr("k0", "KM1", 900, 0, 900); ft("k0", "FM1", 600, 600, 0, False); E["k0:hareket:xm1:kalan"] = 500 * TL; E["k0:hareket:ym1:kalan"] = 700 * TL
#   M1 gecikmiş: FM1 600 (01.09) + Y'nin kart dışı 300 (03.09) + 05.10 300 + 05.11 300 = 1.500
cr("k0", "M2", 1800, 1500, 1800); kr("k0", "KM2", 900, 0, 900); ft("k0", "FM2", 600, 600, 0, False); E["k0:hareket:xm2:kalan"] = 500 * TL; E["k0:hareket:ym2:kalan"] = 700 * TL
E["k0:cari:N1:bakiye"] = 1200 * TL; E["k0:kart:KN1:toplam"] = 600 * TL; E["k0:cari:N2:bakiye"] = 1200 * TL; E["k0:kart:KN2:toplam"] = 600 * TL  # seçimden bağımsız
cr("k0", "Q1", 1200, 1200, 1200); kr("k0", "KQ1", 1000, 0, 1000); ft("k0", "FQ1", 900, 200, 700, False); E["k0:hareket:bq1:kalan"] = 300 * TL  # dış 200 (02.09) + 05.10 500 + 05.11 500
cr("k0", "Q2", 1200, 1200, 1200); kr("k0", "KQ2", 1000, 0, 1000); ft("k0", "FQ2", 900, 200, 700, False); E["k0:hareket:bq2:kalan"] = 300 * TL
A += [iade("ig1", "IG1", "FG1", 1, "2026-11-10"), iade("ih1", "IH1", "FH1", 1, "2026-11-10"), iade("ih2", "IH2", "FH2", 2, "2026-11-10"),
      iade("ij1", "IJ1", "FJ1", 2, "2026-11-10"), iade("ij2", "IJ2", "FJ2A", 2, "2026-11-10"), iade("il1", "IL1", "FL1", 1, "2026-11-10"),
      {"id": "ifl2", "islem": "fatura_iptal", "fatura": "FL2"}, iade("im1", "IM1", "FM1", 2, "2026-11-10"), {"id": "ifm2", "islem": "fatura_iptal", "fatura": "FM2"},
      {"id": "ifn1", "islem": "fatura_iptal", "fatura": "FN1B"}, iade("in2", "IN2", "FN2A", 2, "2026-11-10"),
      iade("iq1", "IQ1", "FQ1", 1, "2026-11-10"), iade("iq2", "IQ2", "FQ2", 5, "2026-11-10"), kontrol("k1")]
ok("ig1", "ih1", "ih2", "ij1", "ij2", "il1", "ifl2", "im1", "ifm2", "ifn1", "in2", "iq1", "iq2")
# k1
cr("k1", "G1", 300, 0, 300); kr("k1", "KG1", 600, 300, 300, True); ft("k1", "FG1", 300, 0, 300, True); E["k1:fatura:IG1:acik"] = 0; tks_yok("k1", "KG1")  # 2. taksit 0'a; 05.12 → 20.11 gecikmemiş
cr("k1", "H1", 600, 600, 600); kr("k1", "KH1", 600, 0, 600); ft("k1", "FH1", 600, 0, 600, True); E["k1:fatura:IH1:acik"] = 0  # S239 = A: dış 300 kapandı, kart değişmez
cr("k1", "H2", 300, 300, 300); kr("k1", "KH2", 300, 0, 300); ft("k1", "FH2", 300, 0, 300, True); E["k1:fatura:IH2:acik"] = 0; tks_yok("k1", "KH2", 2)  # 05.10 taksiti 0'a; 05.11 300 gecikmiş
cr("k1", "J1", 400, 100, 400); kr("k1", "KJ1", 700, 300, 400); ft("k1", "FJ1", 300, 0, 300, True); E["k1:hareket:bj1:kalan"] = 100 * TL; E["k1:fatura:IJ1:acik"] = 0
#   J1: kart 200 küçülür — 2. taksit (05.11) 300 → 100 (gecikmiş 100); elle Borç Kalan 100 (S126 sırası AYNEN), faturanın kendi açığı 500 − 200 = 300
cr("k1", "J2", 400, 100, 400); kr("k1", "KJ2", 700, 300, 400); E["k1:fatura:FJ2A:acik"] = 0; E["k1:fatura:FJ2A:gosterilen"] = 0; E["k1:fatura:FJ2A:kartta"] = 0
ft("k1", "FJ2B", 400, 0, 400, True); E["k1:fatura:IJ2:acik"] = 0; Y.append("k1:fatura:FJ2A:taksitte")  # FJ2A kartta 200, ödeme 300 → 200 FJ2A, 100 FJ2B; kendi açığı 0 → taksitte SUS (Y23-3)
cr("k1", "L1", 900, 600, 900); kr("k1", "KL1", 900, 300, 600); ft("k1", "FL1", 300, 300, 0, False); E["k1:hareket:bl1:kalan"] = 600 * TL; E["k1:fatura:IL1:acik"] = 0
cr("k1", "L2", 600, 300, 600); kr("k1", "KL2", 900, 300, 600); E["k1:fatura:FL2:durum"] = "iptal"; E["k1:hareket:bl2:kalan"] = 600 * TL
cr("k1", "M1", 1200, 900, 1200); kr("k1", "KM1", 900, 0, 900); ft("k1", "FM1", 0, 0, 0, False); E["k1:fatura:IM1:acik"] = 0; E["k1:hareket:xm1:kalan"] = 500 * TL; E["k1:hareket:ym1:kalan"] = 700 * TL
cr("k1", "M2", 1200, 900, 1200); kr("k1", "KM2", 900, 0, 900); E["k1:fatura:FM2:durum"] = "iptal"; E["k1:hareket:xm2:kalan"] = 500 * TL; E["k1:hareket:ym2:kalan"] = 700 * TL
E["k1:cari:N1:bakiye"] = 600 * TL; E["k1:fatura:FN1B:durum"] = "iptal"; Y.extend(["k1:cari:N1:gecikmis", "k1:kart:KN1:toplam", "k1:kart:KN1:kalan", "k1:fatura:FN1A:acik"])  # SK-45 SUS
E["k1:cari:N2:bakiye"] = 600 * TL; Y.extend(["k1:cari:N2:gecikmis", "k1:kart:KN2:toplam", "k1:kart:KN2:kalan", "k1:fatura:FN2A:acik"])
cr("k1", "Q1", 1100, 1100, 1100); kr("k1", "KQ1", 1000, 0, 1000); ft("k1", "FQ1", 800, 100, 700, False); E["k1:hareket:bq1:kalan"] = 300 * TL; E["k1:fatura:IQ1:acik"] = 0
E["k1:cari:Q2:bakiye"] = 700 * TL; Y.extend(["k1:cari:Q2:gecikmis", "k1:kart:KQ2:toplam", "k1:kart:KQ2:kalan", "k1:fatura:FQ2:acik"])  # SK-46 SUS
A += [{"id": "iig1", "islem": "fatura_iptal", "fatura": "IG1"}, kontrol("k2")]
ok("iig1")
# k2 — S238 = A: geri gelen 300 AYNI (05.11) taksite; 20.11 gecikmişi 300; bakiye 600
cr("k2", "G1", 600, 300, 600); kr("k2", "KG1", 900, 300, 600, True); ft("k2", "FG1", 600, 0, 600, True); E["k2:fatura:IG1:durum"] = "iptal"; tks("k2", "KG1", 300, 0, 0)
d56 = {"dil": "destekofis-cari/3", "ad": "d56-c5-s238-s240-iade-ve-secilmeyen",
       "aciklama": "Bakım 25 (§37): S238 = A kararın örneği KAPANMIŞ kartta (G1), S239 = A kısmen kartta faturaya iade (H1 kararın örneği; H2 artan karttan — okuma), S240 = A çok kalemli kartta iade (J1 SK-44 örneği, J2 eski kaleme iade — okuma), "
                   "§3 kartın içine almadığı faturanın iadesi / iptali (L1 / L2 S110, M1 / M2 S120), §3'ün kendi örneği SUS (N1 / N2 SK-45), S200 çok kalemli kartta dış önce (Q1) ve sınıf değişimi SUS (Q2 SK-46). "
                   "Bugün 20.11.2026. Elle tablo karar metinlerinden, kâhin koşulmadan (üreteç docs/kanit/2026-11-21/kahin-cari25-arac/uret-d56.py).",
       "dayanak": "KARARLAR.md §37 (Y25-2 … Y25-4, Y25-7), §36 Y24-3 / Y24-5, §35 Y23-5, §21 Y9-2 / Y9-3, §20", "bugun": "2026-11-20",
       "elleBeklenen": dict(E), "elleYok": list(Y), "adimlar": A}
yaz(d56["ad"], d56)
n56 = (len(E), len(Y))

# ───────────────────────── d57 — Düzenle (bugün 20.11.2026)
E, Y = {}, []
A = []
# K1 — S241 = A kararın KENDİ örneği (açık kart): kart 900 (3 × 300), kart tahsilatı 600, Düzenle 900 → 300
A += [cari("ck1", "K1", "Kaan Düzenle Fazlası"), fatura("fk1", "FK1", "K1", 900, 3, "2026-09-01"), kart("kk1", "KK1", "K1", 900, 3, "2026-10-05", "2026-09-02"), kt("tk1", "KK1", 600, "2026-09-03")]
# K2 — S241 kapanmış (Borçta Kalsın) kartta
A += [cari("ck2", "K2", "Kamil Kapalı Kart Fazlası"), fatura("fk2", "FK2", "K2", 900, 3, "2026-09-01"), kart("kk2", "KK2", "K2", 900, 3, "2026-10-05", "2026-09-02"), kt("tk2", "KK2", 600, "2026-09-03"),
      {"id": "kkk2", "islem": "kart_kapat", "kart": "KK2"}]
# K3 — S241 kendi kartlı (taksitli) faturada: 900 (3 × 300), kart seçilmeden tahsilat 600 (S50 — 1. / 2. taksit), Düzenle 900 → 300
A += [cari("ck3", "K3", "Kerime Taksitli Fazla"), fatura("fk3", "FK3", "K3", 900, 3, "2026-09-01", {"sayi": 3, "ilkVade": "2026-10-05"}), tah("tk3", "K3", 600, "2026-09-03")]
# K5 — KAPSAM (iade ile AYNI) + S239: kısmen kartta faturanın Düzenle ile azaltılması önce dış açığı kapatır: fatura 900, kart 600 (dış 300), Düzenle 900 → 600
A += [cari("ck5", "K5", "Koray Düzenle Dış Önce"), fatura("fk5", "FK5", "K5", 900, 3, "2026-09-01"), kart("kk5", "KK5", "K5", 600, 2, "2026-10-05", "2026-09-02")]
# P1 — S242 = A kararın KENDİ örneği: fatura 300, kendi kartı 300 (taksitli, 3 × 100), Düzenle 300 → 900
A += [cari("cp1", "P1", "Pakize Artış Kendi Kartı"), fatura("fp1", "FP1", "P1", 300, 1, "2026-09-01", {"sayi": 3, "ilkVade": "2026-10-05"})]
# P2 — S242 Mevcut Borç kartında: fatura 300, kart 300 (3 × 100), Düzenle 300 → 900
A += [cari("cp2", "P2", "Polat Artış Mevcut Borç"), fatura("fp2", "FP2", "P2", 300, 1, "2026-09-01"), kart("kp2", "KP2", "P2", 300, 3, "2026-10-05", "2026-09-02")]
# P3 — S242 kapanmış kartta
A += [cari("cp3", "P3", "Pınar Artış Kapalı Kart"), fatura("fp3", "FP3", "P3", 300, 1, "2026-09-01"), kart("kp3", "KP3", "P3", 300, 3, "2026-10-05", "2026-09-02"),
      {"id": "kkp3", "islem": "kart_kapat", "kart": "KP3"}]
A += [kontrol("k0")]
cr("k0", "K1", 300, 0, 300); kr("k0", "KK1", 900, 600, 300); ft("k0", "FK1", 300, 0, 300, True)  # 05.12 açık, gecikmemiş
cr("k0", "K2", 300, 0, 300); kr("k0", "KK2", 900, 600, 300, True); ft("k0", "FK2", 300, 0, 300, True)  # 05.12 → kapanış 20.11 (bugün) — gecikmemiş
cr("k0", "K3", 300, 0, 300); ft("k0", "FK3", 300)  # SENARYO DÜZELTMESİ (açıkça — kural değil): kendi kartının göstergeleri kâhinde yalnız Kartı Kapat / Düzenle görmüş faturada yazılır (§36 Y24-1) — ilk tasarımdaki k0 satırları kaldırıldı
cr("k0", "K5", 900, 900, 900); kr("k0", "KK5", 600, 0, 600); ft("k0", "FK5", 900, 300, 600, False)
cr("k0", "P1", 300, 200, 300); ft("k0", "FP1", 300)  # 05.10 + 05.11 = 200 gecikmiş (k0 kendi kartı satırları — K3 ile aynı senaryo düzeltmesi)
cr("k0", "P2", 300, 200, 300); kr("k0", "KP2", 300, 0, 300); ft("k0", "FP2", 300, 0, 300, True)
cr("k0", "P3", 300, 200, 300); kr("k0", "KP3", 300, 0, 300, True); ft("k0", "FP3", 300, 0, 300, True)
A += [{"id": "dk1", "islem": "fatura_duzenle", "fatura": "FK1", "adet": 1}, {"id": "dk2", "islem": "fatura_duzenle", "fatura": "FK2", "adet": 1},
      {"id": "dk3", "islem": "fatura_duzenle", "fatura": "FK3", "adet": 1}, {"id": "dk5", "islem": "fatura_duzenle", "fatura": "FK5", "adet": 2},
      {"id": "dp1", "islem": "fatura_duzenle", "fatura": "FP1", "adet": 3}, {"id": "dp2", "islem": "fatura_duzenle", "fatura": "FP2", "adet": 3},
      {"id": "dp3", "islem": "fatura_duzenle", "fatura": "FP3", "adet": 3}, kontrol("k1")]
ok("dk1", "dk2", "dk3", "dk5", "dp1", "dp2", "dp3")
# k1 — S241: kart 600 / Tahsil Edilen 600 / Kalan 0; fazla 300 avans (bakiye −300; açık belge toplamı 0 ≠ bakiye — dağıtılmamış alacak)
cr("k1", "K1", -300, 0, 0, False); kr("k1", "KK1", 600, 600, 0); E["k1:fatura:FK1:acik"] = 0; E["k1:fatura:FK1:gosterilen"] = 0; E["k1:fatura:FK1:kartta"] = 0; tks_yok("k1", "KK1")
Y.append("k1:fatura:FK1:taksitte")  # kendi açığı 0 olan kartlı fatura — Y23-3 SUS
cr("k1", "K2", -300, 0, 0, False); kr("k1", "KK2", 600, 600, 0, True); E["k1:fatura:FK2:acik"] = 0; E["k1:fatura:FK2:gosterilen"] = 0; E["k1:fatura:FK2:kartta"] = 0; tks_yok("k1", "KK2")
Y.append("k1:fatura:FK2:taksitte")
cr("k1", "K3", -300, 0, 0, False); ft("k1", "FK3", 0); fk("k1", "FK3", 600, 0)
cr("k1", "K5", 600, 600, 600); kr("k1", "KK5", 600, 0, 600); ft("k1", "FK5", 600, 0, 600, True)  # dış 300 kapandı; kart değişmez; 05.10 + 05.11 gecikmiş
# S242: artış kartı değiştirmez; artan 600 faturanın günüyle (01.09) — 20.11'de gecikmiş
cr("k1", "P1", 900, 800, 900); ft("k1", "FP1", 900); fk("k1", "FP1", 300, 300)
cr("k1", "P2", 900, 800, 900); kr("k1", "KP2", 300, 0, 300); ft("k1", "FP2", 900, 600, 300, False)
cr("k1", "P3", 900, 800, 900); kr("k1", "KP3", 300, 0, 300, True); ft("k1", "FP3", 900, 600, 300, False)
d57 = {"dil": "destekofis-cari/3", "ad": "d57-c5-s241-s242-duzenle",
       "aciklama": "Bakım 25 (§37): kesilmiş faturanın Düzenle'si (POST /invoices/:id/edit) — S241 = A kartın açık kalanından fazla azaltma, fazlası avans (K1 kararın örneği açık kartta, K2 kapanmış kartta, K3 kendi kartlı "
                   "faturada); KAPSAM 'iade ile AYNI' + S239 dış önce (K5); S242 = A artırma kartı değiştirmez, artan faturanın günüyle ayrı açık (P1 kararın örneği — kendi kartı, P2 Mevcut Borç kartı, P3 kapanmış kart). "
                   "Bugün 20.11.2026. Elle tablo karar metinlerinden, kâhin koşulmadan (üreteç docs/kanit/2026-11-21/kahin-cari25-arac/uret-d56.py).",
       "dayanak": "KARARLAR.md §37 (Y25-1, Y25-5, Y25-6), §36 Y24-6", "bugun": "2026-11-20", "elleBeklenen": dict(E), "elleYok": list(Y), "adimlar": A}
yaz(d57["ad"], d57)
print("d56 elle %d + elleYok %d · d57 elle %d + elleYok %d" % (n56 + (len(E), len(Y))))
