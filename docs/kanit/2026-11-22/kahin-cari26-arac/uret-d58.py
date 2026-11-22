#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 26 (§38): (1) d56 / d57'nin elle tablolarını kararlara göre DEĞİŞTİRİR (adımlar değişmez), (2) yeni d58 elle senaryosunu yazar.
Elle beklenenler KARAR METİNLERİNDEN (girdi §1–§4) ve §38'in yorumlarından, kâhin KOŞULMADAN elle hesaplandı (her satırın yanında hesap); model.py'nin çıktısından
TÜRETİLMEZ (ders 5, 40). Kullanım: python3 -I uret-d58.py <senaryolar klasörü>"""
import json
import os
import sys

HEDEF = sys.argv[1]
TL = 100  # kuruş


def oku(ad):
    with open(os.path.join(HEDEF, ad + ".json"), encoding="utf-8") as f:
        return json.load(f)


def yaz(ad, sen):
    with open(os.path.join(HEDEF, ad + ".json"), "w", encoding="utf-8") as f:
        json.dump(sen, f, ensure_ascii=False, indent=1)
        f.write("\n")


E, Y, B = {}, [], []


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


def sus_kendi(k, c, f, neden):
    """Y26-4 / Y26-5: carinin kuyruğu ve kendi kartının göstergeleri SUS (bakiye ayrıca değerle)."""
    Y.extend(["%s:cari:%s:gecikmis" % (k, c), "%s:cari:%s:acikToplam" % (k, c), "%s:fatura:%s:acik" % (k, f),
              "%s:kart:fatura:%s:toplam" % (k, f), "%s:kart:fatura:%s:kalan" % (k, f), "%s:kart:fatura:%s:kapali" % (k, f)])
    B.append(neden)


def ok(*ids):
    for i in ids:
        E["adim:%s:durum" % i] = "ok"


def degistir(sen, sil_anahtar, yeni_E, yeni_Y, yeni_B=()):
    eb = {k: v for k, v in sen["elleBeklenen"].items() if not sil_anahtar(k)}
    eb.update(yeni_E)
    sen["elleBeklenen"] = eb
    sen["elleYok"] = [y for y in sen.get("elleYok", []) if not sil_anahtar(y)] + list(yeni_Y)
    if yeni_B:
        sen["elleBelirsiz"] = [x for x in sen.get("elleBelirsiz", []) if x not in yeni_B] + list(yeni_B)


# ───────────────────────── (1a) d56 N1 / N2 — S243 = A (bugün 20.11.2026): A 600 (01.09), B 600 (02.09), 05.09 elle kart 600 (2 × 300; 05.10 / 05.11) → kart EN ESKİ faturayı (A) alır
d56 = oku("d56-c5-s238-s240-iade-ve-secilmeyen")
E, Y, B = {}, [], []
for c, fa, fb, no in (("N1", "FN1A", "FN1B", "KN1"), ("N2", "FN2A", "FN2B", "KN2")):
    # k0 (iptal / iade öncesi): bakiye 1.200; kart 600 / 0 / 600; A kartta (gösterilen 0, Taksitte), B kendi vadesiyle (02.09) dışarıda; gecikmiş 05.10 300 + 05.11 300 + B 600 = 1.200
    cr("k0", c, 1200, 1200, 1200); kr("k0", no, 600, 0, 600); ft("k0", fa, 600, 0, 600, True); ft("k0", fb, 600, 600, 0, False)
# N1 k1 — seçilmeyen B'nin İptal Et'i kartı DEĞİŞTİRMEZ: bakiye 600; kart 600 / 0 / 600; A Taksitte; gecikmiş 05.10 + 05.11 = 600
cr("k1", "N1", 600, 600, 600); kr("k1", "KN1", 600, 0, 600); ft("k1", "FN1A", 600, 0, 600, True); E["k1:fatura:FN1B:durum"] = "iptal"
# N2 k1 — seçilen A'nın iadesi (600, 10.11) kartı karar (4) ile küçültür: dış açık 0, kartın payı 600 → 05.10 300 → 0, 05.11 300 → 0; kart 0 / 0 / 0; bakiye 600 (B); gecikmiş B 600 (02.09)
cr("k1", "N2", 600, 600, 600); kr("k1", "KN2", 0, 0, 0); E["k1:fatura:FN2A:acik"] = 0; E["k1:fatura:FN2A:gosterilen"] = 0; E["k1:fatura:FN2A:kartta"] = 0
E["k1:fatura:FN2A:taksitte"] = False  # Y23-4: kart küçülmeyle faturadan hiçbir şey taşımıyor (kartta 0) — "kartın almadığı fatura Taksitte değil". ELLE HESAP DÜZELTMESİ (açıkça): ilk tasarımda
#   Y23-3 (i) SUS yazılmıştı; (i) "kartın aldığı kısım kartın taksitleriyle ödenmiş" durumudur (J2 / K1), burada kartın payı iadeyle 0 — ilk elle koşuda fark, kural metni okunarak düzeltildi
Y.extend(["k1:kart:KN2:taksit1:odenen", "k1:kart:KN2:taksit2:odenen"])  # Y24-9 (iv): taksiti 0'a inen kartın satırları — 2.5.1'E (görünüm; d56 G1 ile aynı)
ft("k1", "FN2B", 600, 600, 0, False); E["k1:fatura:IN2:acik"] = 0
degistir(d56, lambda k: (":N1:" in k or ":N2:" in k or ":KN1:" in k or ":KN2:" in k or ":FN1A:" in k or ":FN1B:" in k or ":FN2A:" in k or ":FN2B:" in k or ":IN2:" in k), E, Y)
d56["aciklama"] = d56["aciklama"] if "bakım 26" in d56["aciklama"] else d56["aciklama"].replace("§3'ün kendi örneği SUS (N1 / N2 SK-45)", "§3'ün kendi örneği (N1 / N2 — bakım 26: S243 = A, en eski fatura kartta; SK-45 SUS kalktı)")
d56["dayanak"] += "" if "§38" in d56["dayanak"] else ", §38 Y26-6"
yaz(d56["ad"], d56)
n56 = (len(E), len(Y))

# ───────────────────────── (1b) d57 K3 / P1 (bugün 20.11.2026)
d57 = oku("d57-c5-s241-s242-duzenle")
E, Y, B = {}, [], []
# K3 — §2 SUS (SK-48 (a)): kendi kartı 900 (3 × 300), kart seçilmeden tahsilat 600 (1. / 2. taksit kapalı), Düzenle 900 → 300 — bakiye her seçenekte −300 (fatura 300 − tahsilat 600)
E["k1:cari:K3:bakiye"] = -300 * TL
sus_kendi("k1", "K3", "FK3", "SK-48")
Y.append("k1:cari:K3:acikEsitBakiye")
# P1 — S246 = B kararın KENDİ örneği: fatura 300, kendi kartı 3 × 100 (05.10 / 05.11 / 05.12), Düzenle 300 → 900 → kendi kartı 900 (3 × 300), Kalan 900; 20.11 gecikmişi 05.10 300 + 05.11 300 = 600
cr("k1", "P1", 900, 600, 900); ft("k1", "FP1", 900); fk("k1", "FP1", 900, 900, False)
degistir(d57, lambda k: k.startswith("k1:") and (":K3:" in k or ":FK3:" in k or ":P1:" in k or ":FP1:" in k), E, Y, B)
d57["aciklama"] = d57["aciklama"] if "bakım 26" in d57["aciklama"] else d57["aciklama"].replace("K3 kendi kartlı faturada", "K3 kendi kartlı faturada — bakım 26: §2 SUS, SK-48").replace(
    "P1 kararın örneği — kendi kartı", "P1 — bakım 26: S246 = B, kendi kartı yeni tutarla yeniden kurulur")
d57["dayanak"] += "" if "§38" in d57["dayanak"] else ", §38 Y26-1 / Y26-5"
yaz(d57["ad"], d57)
n57 = (len(E), len(Y), len(B))

# ───────────────────────── (2) d58 — kendi kartında Düzenle (S246 / S235 / §2) + S243 elle borçlu kolu (bugün 08.10.2026)
E, Y, B = {}, [], []
A = []


def cari(id_, ad, isim, tarih="2026-09-01"):
    return {"id": id_, "islem": "cari_ac", "ad": ad, "isim": isim, "tarih": tarih}


def fatura(id_, ad, c, tutar, adet, tarih, taksit=None):
    a = {"id": id_, "islem": "fatura", "ad": ad, "cari": c, "tur": "satis", "tutar": str(tutar), "adet": adet, "tarih": tarih}
    if taksit:
        a["taksit"] = taksit
    return a


def tah(id_, c, tutar, tarih):
    return {"id": id_, "islem": "tahsilat", "cari": c, "tutar": str(tutar), "tarih": tarih}


T3 = {"sayi": 3, "ilkVade": "2026-10-05"}
# R1 — Y26-3 (S246 = B, açık kart, ödemeli): fatura 300 (3 × 100), tahsilat 100 (05.10 taksiti kapanır), Düzenle 300 → 900
A += [cari("cr1", "R1", "Rana Ödemeli Artış"), fatura("fr1", "FR1", "R1", 300, 1, "2026-09-01", T3), tah("tr1", "R1", 100, "2026-09-03")]
# R2 — Y26-2 (S235 = B kararın örneği): fatura 900 (3 adet × 300; 3 × 300), Kartı Kapat bugün (08.10), Düzenle 3 → 4 adet (1.200)
A += [cari("cr2", "R2", "Recep Kapalı Kart Artış"), fatura("fr2", "FR2", "R2", 900, 3, "2026-09-01", T3), {"id": "kkr2", "islem": "kart_kapat", "fatura": "FR2"}]
# R3 — Y26-4 (a) SK-49: fatura 300 (3 × 100), tahsilat 100, Kartı Kapat, Düzenle 300 → 900
A += [cari("cr3", "R3", "Rüya Kapalı Ödemeli Artış"), fatura("fr3", "FR3", "R3", 300, 1, "2026-09-01", T3), tah("tr3", "R3", 100, "2026-09-03"),
      {"id": "kkr3", "islem": "kart_kapat", "fatura": "FR3"}]
# R4 — Y26-4 (b) SK-49: fatura 900 (3 adet × 300), 10.09 iade 1 adet (300 — 05.10 taksiti 0'a; Y24-4), Düzenle 3 → 4 adet
A += [cari("cr4", "R4", "Rıza İadeli Artış"), fatura("fr4", "FR4", "R4", 900, 3, "2026-09-01", T3)]  # iade adımı aşağıda — numaralı belgeler senaryoda tarih sırasıyla (§19 Y7-1; SENARYO DÜZELTMESİ, beklenen değişmez)
# T1 — Y26-5 (a) SK-48: fatura 900 (3 × 300), tahsilat 300 (05.10 taksiti kapanır), Düzenle 3 → 2 adet (600 — kartın açık kalanına sığar)
A += [cari("ct1", "T1", "Tülay Ödemeli Azaltma"), fatura("ft1", "FT1", "T1", 900, 3, "2026-09-01", T3), tah("tt1", "T1", 300, "2026-09-03")]
# T2 — Y26-5 (b) SK-48: fatura 900 (3 × 300), Kartı Kapat, Düzenle 3 → 2 adet
A += [cari("ct2", "T2", "Tarık Kapalı Kart Azaltma"), fatura("ft2", "FT2", "T2", 900, 3, "2026-09-01", T3), {"id": "kkt2", "islem": "kart_kapat", "fatura": "FT2"}]
# T3 — Y26-5 (c): açık, tahsilatsız: fatura 900 (3 × 300), Düzenle 3 → 2 adet — §36 KAPSAM (b) + (e): vadesi en önce gelen açık taksitten küçülür (0 / 300 / 300)
A += [cari("ct3", "T3", "Tuna Açık Kart Azaltma"), fatura("ft3", "FT3", "T3", 900, 3, "2026-09-01", T3)]
# V1 — Y26-7 (S245 = C): S246 ile kendi kartı yeniden kurulan faturaya iade — fatura 300 (3 × 100), Düzenle 300 → 900, sonra iade 1 adet (300) → SK-47 SUS
A += [cari("cv1", "V1", "Vedat Yeniden Kurulan İade"), fatura("fv1", "FV1", "V1", 300, 1, "2026-09-01", T3)]
# V2 — Y26-7 (S245 = C kararın örneği 900 → 300 → 600): Mevcut Borç kartlı fatura 900, kart 900 (3 × 300), art arda Düzenle 3 → 1 → 2 adet → SK-47 SUS (kartın göstergeleri de)
A += [cari("cv2", "V2", "Vildan Art Arda Düzenle"), fatura("fv2", "FV2", "V2", 900, 3, "2026-09-01"),
      {"id": "kv2", "islem": "kart_ac", "ad": "KV2", "cari": "V2", "tutar": "900", "taksit": 3, "ilkVade": "2026-10-05", "tarih": "2026-09-02", "mevcut": True}]
# N3 — (numaralı belgeler tarih sırasıyla — Y7-1: 02.09 / 03.09 faturaları 01.09'luların ardından) Y26-6 (S243 = A, elle borçlu S200 kartı, iki aday fatura): Borç 200 (01.09), FA 600 (02.09), FB 600 (03.09), 05.09 elle kart 500 (2 × 250; 05.10 / 05.11)
#   S200: önce elle borç 200, eksik 300 faturalardan eskiden yeniye → FA'nın 300'ü kartta (FA dışarıda 300), FB kartın dışında
A += [cari("cn3", "N3", "Nevin Borçlu İki Fatura"), {"id": "bn3", "islem": "borc", "cari": "N3", "tutar": "200", "tarih": "2026-09-01"},
      fatura("fn3a", "FN3A", "N3", 600, 2, "2026-09-02"), fatura("fn3b", "FN3B", "N3", 600, 2, "2026-09-03"),
      {"id": "kn3", "islem": "kart_ac", "ad": "KN3", "cari": "N3", "tutar": "500", "taksit": 2, "ilkVade": "2026-10-05", "tarih": "2026-09-05", "mevcut": True}]
A += [{"id": "ir4", "islem": "iade", "ad": "IR4", "fatura": "FR4", "adet": 1, "tarih": "2026-09-10"}]  # R4: 10.09 iade 1 adet (300)
A += [{"id": "k0", "islem": "kontrol", "gecikmis": True, "acikToplam": True}]
cr("k0", "V1", 300, 100, 300); ft("k0", "FV1", 300)  # 05.10 taksiti (100) gecikmiş
cr("k0", "V2", 900, 300, 900); kr("k0", "KV2", 900, 0, 900); ft("k0", "FV2", 900, 0, 900, True)  # 05.10 300 gecikmiş; fatura tamamen kartta
# k0 (bugün 08.10)
cr("k0", "R1", 200, 0, 200); ft("k0", "FR1", 200)  # 05.10 taksiti (100) tahsilatla kapalı; 05.11 / 05.12 gelmedi
cr("k0", "R2", 900, 300, 900); ft("k0", "FR2", 900); fk("k0", "FR2", 900, 900, True)  # kapanış 08.10: 05.10 kendi vadesinde (S220) gecikmiş, öbürleri min(vade, 08.10) = bugün
cr("k0", "R3", 200, 0, 200); ft("k0", "FR3", 200); fk("k0", "FR3", 300, 200, True)
cr("k0", "R4", 600, 0, 600); ft("k0", "FR4", 600); E["k0:fatura:IR4:acik"] = 0  # iade 300 → 05.10 taksiti 0'a (Y24-4); 05.11 / 05.12 gelmedi
cr("k0", "T1", 600, 0, 600); ft("k0", "FT1", 600)
cr("k0", "T2", 900, 300, 900); ft("k0", "FT2", 900); fk("k0", "FT2", 900, 900, True)
cr("k0", "T3", 900, 300, 900); ft("k0", "FT3", 900)
# N3 k0: bakiye 1.400; kart 500 / 0 / 500; FA kendi 600, kartta 300, gösterilen 300 (Taksitte DEĞİL); FB 600 dışarıda; Borç kendi kalanı 200 (kartta)
#   gecikmiş: kart 05.10 250 + FA dışarıda 300 (02.09) + FB 600 (03.09) = 1.150
cr("k0", "N3", 1400, 1150, 1400); kr("k0", "KN3", 500, 0, 500); ft("k0", "FN3A", 600, 300, 300, False); ft("k0", "FN3B", 600, 600, 0, False); E["k0:hareket:bn3:kalan"] = 200 * TL
A += [{"id": "dr1", "islem": "fatura_duzenle", "fatura": "FR1", "adet": 3}, {"id": "dr2", "islem": "fatura_duzenle", "fatura": "FR2", "adet": 4},
      {"id": "dr3", "islem": "fatura_duzenle", "fatura": "FR3", "adet": 3}, {"id": "dr4", "islem": "fatura_duzenle", "fatura": "FR4", "adet": 4},
      {"id": "dt1", "islem": "fatura_duzenle", "fatura": "FT1", "adet": 2}, {"id": "dt2", "islem": "fatura_duzenle", "fatura": "FT2", "adet": 2},
      {"id": "dt3", "islem": "fatura_duzenle", "fatura": "FT3", "adet": 2}, {"id": "ifn3", "islem": "fatura_iptal", "fatura": "FN3B"},
      {"id": "dv1", "islem": "fatura_duzenle", "fatura": "FV1", "adet": 3}, {"id": "iv1", "islem": "iade", "ad": "IV1", "fatura": "FV1", "adet": 1, "tarih": "2026-10-08"},
      {"id": "dv2a", "islem": "fatura_duzenle", "fatura": "FV2", "adet": 1}, {"id": "dv2b", "islem": "fatura_duzenle", "fatura": "FV2", "adet": 2},
      {"id": "k1", "islem": "kontrol", "gecikmis": True, "acikToplam": True}]
ok("dr1", "dr2", "dr3", "dr4", "dt1", "dt2", "dt3", "ifn3", "dv1", "iv1", "dv2a", "dv2b")
E["k1:cari:V1:bakiye"] = 600 * TL; sus_kendi("k1", "V1", "FV1", "SK-47"); Y.append("k1:fatura:IV1:acik")  # 900 − 300 (bakiye her okumada); kart / kuyruk S245 = C (iade belgesinin açığı da
#   carinin kuyruğundan — C13.4 (11) düzeni; ELLE HESAP DÜZELTMESİ (açıkça): ilk tasarımda değerle (0) yazılmıştı — SUS caride belge açığı yazılmaz, d56 Q2 / N-dizisi ile aynı)
E["k1:cari:V2:bakiye"] = 600 * TL  # son tutar 600 (bakiye her okumada)
Y.extend(["k1:cari:V2:gecikmis", "k1:cari:V2:acikToplam", "k1:fatura:FV2:acik", "k1:fatura:FV2:gosterilen", "k1:fatura:FV2:kartta", "k1:fatura:FV2:taksitte",
          "k1:kart:KV2:toplam", "k1:kart:KV2:kalan", "k1:kart:KV2:odenen"])
# k1
cr("k1", "R1", 800, 200, 800); ft("k1", "FR1", 800); fk("k1", "FR1", 900, 800, False)  # yeni kart 3 × 300; tahsilat 100 → 05.10 taksitinin 100'ü; 05.10'un 200'ü gecikmiş
cr("k1", "R2", 1200, 400, 1200); ft("k1", "FR2", 1200); fk("k1", "FR2", 1200, 1200, False)  # S235 = B: açık; 3 × 400; 05.10 400 gecikmiş
E["k1:cari:R3:bakiye"] = 800 * TL; sus_kendi("k1", "R3", "FR3", "SK-49")  # 900 − 100
sus_kendi("k1", "R4", "FR4", "SK-49")  # 1.200 − 300 = 900 Düzenle kabul dünyasında; Düzenle yok dünyasında 600
#   Y26-9 SK-50: iadesi olan faturanın Düzenle'si — kabul mü ret mi kararda yok → adımın durumu ve iki dünyada farklı sayılar (bakiye) SUS (program koşusunun ilk sonucundan SONRA eklenen kural;
#   elle tablo yeni kuralın metninden — ilk tasarımda adım 'ok' ve bakiye 900 yazılıydı)
del E["adim:dr4:durum"]; Y.extend(["adim:dr4:durum", "k1:cari:R4:bakiye"]); B.append("SK-50")
E["k1:cari:T1:bakiye"] = 300 * TL; sus_kendi("k1", "T1", "FT1", "SK-48")  # 600 − 300
E["k1:cari:T2:bakiye"] = 600 * TL; sus_kendi("k1", "T2", "FT2", "SK-48")
cr("k1", "T3", 600, 0, 600); ft("k1", "FT3", 600); fk("k1", "FT3", 600, 600, False)  # 300 küçülme 05.10 taksitinden (0 / 300 / 300); 05.11 / 05.12 gelmedi
# N3 k1 — seçilmeyen FB'nin İptal Et'i kartı DEĞİŞTİRMEZ: bakiye 800; kart 500 / 0 / 500; FA aynen; gecikmiş 250 + 300 = 550
cr("k1", "N3", 800, 550, 800); kr("k1", "KN3", 500, 0, 500); ft("k1", "FN3A", 600, 300, 300, False); E["k1:fatura:FN3B:durum"] = "iptal"; E["k1:hareket:bn3:kalan"] = 200 * TL
d58 = {"dil": "destekofis-cari/3", "ad": "d58-c5-s246-s243-kendi-kart-duzenle",
       "aciklama": "Bakım 26 (§38): taksitli faturanın KENDİ kartında Düzenle — S246 = B ödemeli açık kartta (R1 — okuma Y26-3), S235 = B kararın örneği kapanmış tahsilatsız kartta (R2 — kart AÇIK kurulur), SK-49 SUS (R3 kapanmış + ödemeli, R4 iadeli), "
                   "azaltma §2 SUS SK-48 (T1 ödemeli, T2 kapanmış tahsilatsız), açık tahsilatsız azaltma §36 KAPSAM (b) + (e) (T3); S243 = A elle borçlu S200 kartında seçilmeyen faturanın iptali (N3); S245 = C SUS (V1 yeniden kurulan kendi kartına iade, "
                   "V2 art arda Düzenle 900 → 300 → 600). Bugün 08.10.2026. "
                   "Elle tablo karar metinlerinden, kâhin koşulmadan (üreteç docs/kanit/2026-11-22/kahin-cari26-arac/uret-d58.py).",
       "dayanak": "KARARLAR.md §38 (Y26-1 … Y26-6), §36 Y24-2 / Y24-4 / Y24-6, §35 Y23-5", "bugun": "2026-10-08",
       "elleBeklenen": dict(E), "elleYok": list(Y), "elleBelirsiz": list(B), "adimlar": A}
yaz(d58["ad"], d58)
print("d56 (N1 / N2) elle %d + elleYok %d · d57 (K3 / P1) elle %d + elleYok %d + belirsiz %d · d58 elle %d + elleYok %d + belirsiz %d" % (n56 + n57 + (len(E), len(Y), len(B))))
