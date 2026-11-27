#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 30 (KARARLAR.md §42) — d62 elle senaryosunun üreteci. Beklenenler ELLE (kâhin koşulmadan; hesap her carinin yorumunda).
  python3 -I docs/kanit/2026-11-27/kc30-arac/uret-d62.py > test/bagimsiz/cari/senaryolar/d62-c5-m2-degersiz-siniri.json
Taban T (her cari): F 2.900 (10.09) + Borç 3.400 (12.09) · 17.09 F'ye bağlı tahsilat 2.876,45 · 17.09 tahsilattan SONRA Şüpheliye Al 3.000.
  S-M2-1 = B (Y30-1): bağlı tahsilat aynı gün sırasıyla kayıttan sonra; pay şüpheliye alma anında (tahsilat hariç): F kuyruk 2.900, R 3.000 → F görünen 0 → pay 2.900
  → düşen 2.876,45 → kalan 123,55; bakiye 3.423,55.
"""
import json
import sys

A, E, Y, B = [], {}, [], []   # adımlar, elleBeklenen, elleYok, elleBelirsiz
CARI = []
FAT = []   # satış faturaları — senaryo başında tarih sırasıyla (Y7-1)
BAK = {}
EXC, CLO = "doubtful-writeoff-exceeds", "doubtful-closed"


def k(tl):
    return int(round(float(tl.replace(".", "").replace(",", ".")) * 100))


def cari(ad, isim):
    CARI.append((ad, isim))


def adim(**a):
    A.append(a)
    return a["id"]


def ok(i):
    E["adim:%s:durum" % i] = "ok"


def ret(i, kod=None):
    E["adim:%s:durum" % i] = "ret"
    if kod:
        E["adim:%s:kod" % i] = kod


def fatura(ad, c, tutar, tarih="2026-09-10"):
    FAT.append({"id": "f-" + ad.lower(), "islem": "fatura", "ad": ad, "cari": c, "tur": "satis", "tutar": tutar, "tarih": tarih})


def taban(c, sira=("bt", "al"), nt=None, bt_tarih="2026-09-17", al_tutar="3000", bt_tutar="2876,45", borc="3400", f_tutar="2900"):
    """T: fatura + borç + (bağlı tahsilat, şüpheliye al, [bağsız tahsilat]) verilen yazım sırasıyla."""
    fatura("F" + c, c, f_tutar)
    adim(id="b-" + c.lower(), islem="borc", cari=c, tutar=borc, tarih="2026-09-12")
    for s in sira:
        if s == "bt":
            ok(adim(id="t-" + c.lower(), islem="tahsilat", cari=c, tutar=bt_tutar, tarih=bt_tarih, fatura="F" + c))
        elif s == "al":
            ok(adim(id="s-" + c.lower(), islem="supheli_al", ad="S" + c, cari=c, tutar=al_tutar, tarih="2026-09-17"))
        elif s == "nt":
            ok(adim(id="n-" + c.lower(), islem="tahsilat", cari=c, tutar=nt[0], tarih=nt[1]))


def deg(i, c, tutar, tarih, kayit=None):
    return adim(id=i, islem="degersiz", supheli=kayit or ("S" + c), tutar=tutar, tarih=tarih)


# ── C1 (girdi §3 m.1; S264 = A): sınır(17.09) = F (17.09'un bağlı payı çıkarılmış zaman çizelgesi) = 3.000; denetim: 3.000 → 0, bağlı satır 0 düşer (normal),
#    bakiye 3.423,55 − 3.000 = 423,55 ≥ 0.
cari("A1", "Aslı S264 Tam Tutar")
taban("A1")
ret(deg("a1d1", "A1", "3000,01", "2026-09-17"), EXC)
ok(deg("a1d2", "A1", "3000", "2026-09-17"))
ret(deg("a1d3", "A1", "0,01", "2026-09-17"), CLO)          # F = 3.000 − 3.000 = 0 → kayıt kapalı (Y30-4)
BAK["A1"] = "423,55"
# ── C2 (m.2; S269): 1.000 + 2.000 @17.09 — F 3.000 sonra 2.000; bakiye 423,55. Üç adım 1.000 × 3 (F 3.000 → 2.000 → 1.000), dördüncü 0,01 kapalı.
cari("A2", "Ayten İki Parça")
taban("A2")
ok(deg("a2d1", "A2", "1000", "2026-09-17"))
ok(deg("a2d2", "A2", "2000", "2026-09-17"))
BAK["A2"] = "423,55"
cari("A3", "Ayla Üç Parça")
taban("A3")
for n in (1, 2, 3):
    ok(deg("a3d%d" % n, "A3", "1000", "2026-09-17"))
ret(deg("a3d4", "A3", "0,01", "2026-09-17"), CLO)
BAK["A3"] = "423,55"
# ── C3 (m.3; S269 — bağlı tahsilat şüpheli tutara eşit): F 3.000 + Borç 3.400; bağlı 3.000 (önce) → al 3.000: pay 3.000 → kalan 0 (bugün 'kapalı').
#    sınır(17.09) = 3.000 (bağlı pay düşülmez); denetim: bakiye 3.400 − 3.000 = 400 ≥ 0 → KABUL; bakiye 400.
cari("A4", "Ahu Eşit Bağlı")
taban("A4", bt_tutar="3000", f_tutar="3000")
ok(deg("a4d1", "A4", "3000", "2026-09-17"))
BAK["A4"] = "400"
# ── C3b (Y30-3 (ii)): F 3.000 + Borç 400; al 3.000 → SONRA bağlı 3.000 (S168 payı 3.000 → kalan 0; bakiye 400). sınır(17.09) = min(F 3.000, bakiye 400) = 400;
#    sonra bakiye 0 → sınır 0 (kapalı).
cari("A5", "Alp Bakiye Sınırı")
taban("A5", sira=("al", "bt"), bt_tutar="3000", f_tutar="3000", borc="400")
ret(deg("a5d1", "A5", "400,01", "2026-09-17"), EXC)
ok(deg("a5d2", "A5", "400", "2026-09-17"))
ret(deg("a5d3", "A5", "0,01", "2026-09-17"), CLO)
BAK["A5"] = "0"
# ── C4 + C14 (m.4, m.14; S-M2-1 = B): @18.09 sınır = 3.000 − 2.876,45 (önceki günün bağlı payı) = 123,55. Sonra @17.09: X @17.09 bağlı satırın düşüşünü X kadar azaltır,
#    18.09'daki 123,55 için kalan −X → en büyük X = 0 → kapalı (dar kontrolün ölçtüğü "ekran 2.876,45 önerdi, sunucu reddetti"nin doğru sınırı 0).
cari("A6", "Arda Ertesi Gün")
taban("A6")
ret(deg("a6d1", "A6", "123,56", "2026-09-18"), EXC)
ok(deg("a6d2", "A6", "123,55", "2026-09-18"))
ret(deg("a6d3", "A6", "0,01", "2026-09-17"), CLO)
BAK["A6"] = "3300"
# ── C5 (m.5): Değersiz 100 @25.09 (sınır 123,55) → @17.09: F 2.900; denetim: 3.000 − X − min(3.000 − X, 2.876,45) − 100 ≥ 0 → X ≤ 23,55. Sonra @25.09 sınır 0.
cari("A7", "Atilla Sonraki Değersiz")
taban("A7")
ok(deg("a7d1", "A7", "100", "2026-09-25"))
ret(deg("a7d2", "A7", "23,56", "2026-09-17"), EXC)
ok(deg("a7d3", "A7", "23,55", "2026-09-17"))
ret(deg("a7d4", "A7", "0,01", "2026-09-25"), CLO)
BAK["A7"] = "3300"
# ── C5b (Y30-2 (3); bağlı satır yok): al 3.000 → Değersiz 500 @20.09 → 01.10 bağsız 1.000 (düşer; kalan 1.500) → @17.09: F = 3.000 − 500 − 1.000 = 1.500
#    (denetim tek başına 2.500'e izin verirdi — bağsız satırı normale kaydırarak). Bakiye 6.300 − 500 − 1.000 − 1.500 = 3.300.
cari("A8", "Asude Sonraki Satırlar")
fatura("FA8", "A8", "2900")
adim(id="b-a8", islem="borc", cari="A8", tutar="3400", tarih="2026-09-12")
ok(adim(id="s-a8", islem="supheli_al", ad="SA8", cari="A8", tutar="3000", tarih="2026-09-17"))
ok(deg("a8d1", "A8", "500", "2026-09-20"))
ok(adim(id="n-a8", islem="tahsilat", cari="A8", tutar="1000", tarih="2026-10-01"))
ret(deg("a8d2", "A8", "1500,01", "2026-09-17"), EXC)
ok(deg("a8d3", "A8", "1500", "2026-09-17"))
BAK["A8"] = "3300"
# ── C6 (m.6): T + 01.10 bağsız 1.000 (bakiye 2.423,55; düşen 123,55). @17.09: F = 3.000 − 1.000 (bağsız — 17.09'un bağlı payı düşülmemiş dünyada) = 2.000;
#    bakiye 423,55. @01.10 ve @18.09: F = 3.000 − 2.876,45 − 123,55 = 0 → kapalı.
cari("A9", "Ayşe Sonradan Bağsız")
taban("A9", sira=("bt", "al", "nt"), nt=("1000", "2026-10-01"))
ret(deg("a9d1", "A9", "3000", "2026-09-17"), EXC)           # geri alınan uygulamanın kabul ettiği tutar (bakiye −576,45 olurdu)
ret(deg("a9d2", "A9", "2000,01", "2026-09-17"), EXC)
ok(deg("a9d3", "A9", "2000", "2026-09-17"))
BAK["A9"] = "423,55"
cari("A10", "Ahmet Sonraki Tarihler")
taban("A10", sira=("bt", "al", "nt"), nt=("1000", "2026-10-01"))
ret(deg("a10d1", "A10", "0,01", "2026-10-01"), CLO)
ret(deg("a10d2", "A10", "0,01", "2026-09-18"), CLO)
BAK["A10"] = "2423,55"
# ── C7 (m.7): aynı gün (A11–A16) / ertesi gün (A17, A18) bağsız 50 — yazım sıraları; Değersiz 2.950 @17.09 KABUL (F = 3.000 − 50), 50 RET (kapalı);
#    bakiye 6.300 − 2.876,45 − 50 − 2.950 = 423,55 (her sırada).
for c, sira, nt in (("A11", ("bt", "al", "nt"), "2026-09-17"), ("A12", ("bt", "nt", "al"), "2026-09-17"), ("A13", ("al", "bt", "nt"), "2026-09-17"),
                    ("A14", ("al", "nt", "bt"), "2026-09-17"), ("A15", ("nt", "al", "bt"), "2026-09-17"), ("A16", ("nt", "bt", "al"), "2026-09-17"),
                    ("A17", ("bt", "al", "nt"), "2026-09-18"), ("A18", ("nt", "bt", "al"), "2026-09-18")):
    cari(c, "Altı Sıra %s" % c)
    taban(c, sira=sira, nt=("50", nt))
    ok(deg(c.lower() + "d1", c, "2950", "2026-09-17"))
    ret(deg(c.lower() + "d2", c, "50", "2026-09-17"), CLO)
    BAK[c] = "423,55"
# A12 / A18: bağlı satırın payı iki okumada farklı (Y30-1 — SK-55): (i) şüpheliye alma anında (önce yazılmış bağsız 50 dahil) 2.850; (ii) aynı günün sırasında kendi yerinde
#   (kendisinden sonra yazılmış / sonra tarihli satırlar yok) 2.876,45. Yukarıdaki adımlar ve bakiye iki okumada AYNI (değerle); ayrışan denetimler yazılmaz.
B.append(["cari A12", "SK-55"])
B.append(["cari A18", "SK-55"])
# ── A19: A12'nin sırası + Değersiz 100 @18.09 — (i) kalan 3.000 − 2.850 − 50 = 100 → KABUL; (ii) 3.000 − 2.876,45 − 50 = 73,55 → RET: SUS (SK-55).
cari("A19", "Aynur Sıra Okuması")
taban("A19", sira=("bt", "nt", "al"), nt=("50", "2026-09-17"))
deg("a19d1", "A19", "100", "2026-09-18")
Y += ["adim:a19d1:durum", "k1:cari:A19:bakiye"]
B.append(["cari A19", "SK-55"])
# ── C8 (m.8): aynı gün iki kayıt 1.500 + 1.500 (bağlı tahsilat önce). S2'nin alınışında bağlı satır yeniden ölçülür: R 3.000 → pay 2.900 → düşen 2.876,45
#    (S1 1.500, S2 1.376,45; S2 kalanı 123,55). S1'e 1.500 @17.09: F(S1) 1.500; denetim: bağlı satır S1'e 0, S2'ye 1.500 → sonlar 0 / 0; bakiye 1.923,55.
cari("A20", "Asım İki Kayıt")
taban("A20", al_tutar="1500")
ok(adim(id="s2-a20", islem="supheli_al", ad="S2A20", cari="A20", tutar="1500", tarih="2026-09-17"))
ok(deg("a20d1", "A20", "1500", "2026-09-17"))
BAK["A20"] = "1923,55"
#    Öbür kayda (S2) bugünün tarihiyle 123,55 yazılmışken S1'e @17.09: X bağlı satırı S2'ye kaydırır → S2 sonu −X → en büyük X = 0 (kapalı); bakiye 3.300.
cari("A21", "Aynur İki Kayıt Bugün")
taban("A21", al_tutar="1500")
ok(adim(id="s2-a21", islem="supheli_al", ad="S2A21", cari="A21", tutar="1500", tarih="2026-09-17"))
ret(deg("a21d1", "A21", "123,56", "2026-10-15", kayit="S2A21"), EXC)
ok(deg("a21d2", "A21", "123,55", "2026-10-15", kayit="S2A21"))
ret(deg("a21d3", "A21", "0,01", "2026-09-17", kayit="SA21"), CLO)
BAK["A21"] = "3300"
# ── C10 (m.10; dilde olan yollar): Değersiz 3.000 @17.09'dan SONRA bağlı tahsilatın silinmesi (bakiye 6.300 − 3.000 = 3.300); bağlı ÇEKİN bağının kaldırılması
#    (bakiye değişmez 423,55) / çekin silinmesi (3.300). Değersiz kalır (sonraki adımlar Değersiz'i yeniden denetlemez).
cari("A22", "Ali Bağlı Silinir")
taban("A22")
ok(deg("a22d1", "A22", "3000", "2026-09-17"))
ok(adim(id="a22x", islem="hareket_sil", hareket="t-a22"))
BAK["A22"] = "3300"
for c, son in (("A23", "bag"), ("A24", "sil")):
    cari(c, "Arif Bağlı Çek %s" % son)
    fatura("F" + c, c, "2900")
    adim(id="b-" + c.lower(), islem="borc", cari=c, tutar="3400", tarih="2026-09-12")
    ok(adim(id="e-" + c.lower(), islem="evrak", ad="E" + c, cari=c, tur="cek", tutar="2876,45", tarih="2026-09-17", fatura="F" + c))
    ok(adim(id="s-" + c.lower(), islem="supheli_al", ad="S" + c, cari=c, tutar="3000", tarih="2026-09-17"))
    ok(deg(c.lower() + "d1", c, "3000", "2026-09-17"))
    if son == "bag":
        ok(adim(id="a23x", islem="bag_degistir", evrak="EA23", fatura=""))
        BAK[c] = "423,55"
    else:
        ok(adim(id="a24x", islem="evrak_sil", evrak="EA24"))
        BAK[c] = "3300"
# ── Y30-6 (S155 ile birlikte): S2 500 @25.09 (K1: 500 ≤ 3.423,55 − 123,55); S1'e Değersiz @17.09: sınır 3.000 (bağlı pay S2'ye düşemez — S2 sonra tarihli);
#    S155: normal 2.800 − (X − 123,55) ≥ 0 → kabul edilen en çok 2.923,55; bakiye 3.423,55 − 2.923,55 = 500 (= açık S2).
cari("A26", "Asena S155 Birlikte")
taban("A26")
ok(adim(id="s2-a26", islem="supheli_al", ad="S2A26", cari="A26", tutar="500", tarih="2026-09-25"))
ret(deg("a26d1", "A26", "3000", "2026-09-17"))              # S155 RET (sarmalayıcı; kod yazılmaz)
ret(deg("a26d2", "A26", "2923,56", "2026-09-17"))
ok(deg("a26d3", "A26", "2923,55", "2026-09-17"))
BAK["A26"] = "500"
# ── C30.8 (Y30-2 (1) — D'den SONRAKİ günün bağlı payı düşülmez; BAŞ MİMAR değerlendirir): al 3.000 (17.09) → SONRA 20.09 bağlı 2.876,45 (S168 payı → kalan 123,55).
#    @18.09 sınır 3.000 (bakiye 423,55); @21.09 sınır 123,55 (bakiye 3.300).
cari("A27", "Asya Sonraki Gün Bağlı")
taban("A27", sira=("al", "bt"), bt_tarih="2026-09-20")
ret(deg("a27d1", "A27", "3000,01", "2026-09-18"), EXC)
ok(deg("a27d2", "A27", "3000", "2026-09-18"))
BAK["A27"] = "423,55"
cari("A28", "Aziz Bağlıdan Sonra")
taban("A28", sira=("al", "bt"), bt_tarih="2026-09-20")
ret(deg("a28d1", "A28", "123,56", "2026-09-21"), EXC)
ok(deg("a28d2", "A28", "123,55", "2026-09-21"))
BAK["A28"] = "3300"
# ── C12 (m.12; dönem kilidi 17.09 — kâhinin dilinde kilit yalnız vade alanını kilitler (K6.5 (b)); yalnız kilit SONRASI tarih): @18.09 sınır 123,55; bakiye 3.300.
cari("A25", "Ayhan Dönem Kilidi")
taban("A25")
ok(adim(id="kilit", islem="donem_kilitle", tarih="2026-09-17"))
ret(deg("a25d1", "A25", "123,56", "2026-09-18"), EXC)
ok(deg("a25d2", "A25", "123,55", "2026-09-18"))
BAK["A25"] = "3300"

adimlar = [{"id": "c-" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim, "tarih": "2026-09-01"} for c, isim in CARI] + FAT + A + [{"id": "k1", "islem": "kontrol"}]
for c, v in BAK.items():
    E["k1:cari:%s:bakiye" % c] = k(v)
sen = {"dil": "destekofis-cari/3", "ad": "d62-c5-m2-degersiz-siniri", "bugun": "2026-10-15",
       "aciklama": "Bakım 30 (§42): Değersiz Alacak sınırı — S264 = A (o günün bağlı payından önce), S269 = A (kapalı denetiminden önce), S270 = A (sonradan gelen bağsız tahsilat "
                   "ve sonraki Değersiz satırları; değişmez), S-M2-1 = B (aynı gün, şüpheliye almadan önce yazılmış bağlı tahsilat düşer; sonraki tarihte önceki günlerin bağlı payı "
                   "düşülmüş kalan). Girdi §3 sınıfları 1–8, 10 (dilde olan yollar), 12 (kilit sonrası), 14.",
       "dayanak": "KARARLAR.md §42 (Y30-1 … Y30-7), §8 (ŞÜPHELİ KALAN), §27 (S155), §31 (S168 payı)",
       "elleBeklenen": dict(sorted(E.items())), "elleYok": Y, "elleBelirsiz": B, "adimlar": adimlar}
sys.stdout.write(json.dumps(sen, ensure_ascii=False, indent=1) + "\n")
