#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Maliyet Hesap Kartı kâhininin KENDİ testi (2.4.6 madde 0c).

    python3 -I test/bagimsiz/maliyet/test_kahin.py          # son satır "N/M denetim geçti"; çıkış 0 yalnız hepsi geçince

Bölümler:
  A. El hesapları — FORMÜL TABLOSU'nun her kalıbı için küçük, elle hesaplanmış örnekler (beklenen sayılar bu dosyada yazılı; modelden türetilmez).
  B. Şablon — formül sayımı (§1: 59 / 186 / 95 / 214 = 554), oran ve bölenler (§2), matris yapısı özeti (§4), elle hücreler (§6: 4, 6–9).
  C. Kabul dosyası — yeniden üretim aynı (tohumlu), dil, aile kapsamı, kâhin kendisiyle 0 fark.
  D. Mutasyon — kahin.MUTASYONLAR'ın her biri bilerek bozulmuş "program" olarak koşulur; kabul karşılaştırması her birini yakalamalı.
  E. Koşucu — program yokken BELİRSİZ (çıkış 3, "geçti" yazmaz); sahte uyarlayıcı (kâhinin kendisi) yalnız --kendi-testi ile; bozuk/eksik yanıt BELİRSİZ.
  F. Excel denetim aracı — sentetik hücre dökümüyle 0 fark; bozulan formül / değer / fazla formül yakalanır.
Sahte uyarlayıcı kipi (yalnız E için): test_kahin.py --sahte-uyarlayici [--mutasyon X] [--katmanlar api,arayuz] [--beyansiz] [--bozuk-json] [--cikis N]
"""
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
from fractions import Fraction

sys.dont_write_bytecode = True
for _akis in (sys.stdout, sys.stderr):
    if hasattr(_akis, "reconfigure"):
        _akis.reconfigure(encoding="utf-8", errors="replace")   # Windows: -I ile PYTHONIOENCODING yok sayılır, boru ANSI kod sayfasına düşer
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import excel_denetle  # noqa: E402
import kahin  # noqa: E402
import uretici  # noqa: E402

SONUC = {"gecen": 0, "toplam": 0}


def denetim(ad, kosul, ayrinti=""):
    SONUC["toplam"] += 1
    if kosul:
        SONUC["gecen"] += 1
        print(f"✓ {ad}")
    else:
        print(f"✗ {ad}{': ' + str(ayrinti) if ayrinti else ''}")
    return kosul


def yakin(a, b):
    return a is not None and b is not None and abs(a - b) <= max(1e-9 * max(abs(a), abs(b)), 1e-12)


def calistir(adimlar, secenekler=None):
    return kahin.program_gibi(adimlar, secenekler)


Y, O, AC, K = uretici.YAZ, uretici.OKU, uretici.AC, uretici.KAYDET

# ---------------------------------------------------------------------------------------------------------------------------------
# A. El hesapları
# ---------------------------------------------------------------------------------------------------------------------------------


def zincir_beklenen(ad, kod, adimlar, tutarlar, ara, yuzde, toplama, yuzde_ekle, son, sonuc):
    r = calistir([AC] + adimlar + [K, O(kod)])[-1]["kartlar"][kod]
    adim = {k: v["deger"] for k, v in r["adimlar"].items()}
    ok = all(yakin(r["satirlar"][s]["tutar"], v) for s, v in tutarlar.items())
    ok = ok and yakin(adim["ara"], ara) and yakin(adim["yuzde"], yuzde) and yakin(adim["toplama"], toplama) and yakin(adim["yuzde_ekle"], yuzde_ekle)
    if son is not None:
        ok = ok and yakin(adim.get("bolme", adim.get("cm_elle")), son)
    ok = ok and yakin(r["sonuc"], sonuc)
    denetim(f"A el hesabı: {ad}", ok, json.dumps({"tutar": {s: r["satirlar"][s]["tutar"] for s in tutarlar}, "adim": adim, "sonuc": r["sonuc"]}))
    return r


def bolum_a():
    oval = "cam/100x100-oval-kabin"
    # çarpım + toplam (aralık) + yüzde + toplama + yüzde ekle + sabite bölme: 2,5×4=10; 3×5=15 → 25 → 4,5 → 29,5 → 35,4 → 0,177
    taban = [Y(oval, "s1", miktar=2.5, fiyat=4.0), Y(oval, "s2", miktar=3.0, fiyat=5.0)]
    zincir_beklenen("CAM 100X100 Oval (%18, %20, ÷200)", oval, taban, {"s1": 10, "s2": 15, "s3": 0}, 25, 4.5, 29.5, 35.4, 0.177, 0.177)
    zincir_beklenen("MİKA 170 2S2Ç (%13, %15, ÷170)", "mika/170-2s2c-h182", [Y("mika/170-2s2c-h182", "s1", miktar=10.0, fiyat=10.0)],
                    {"s1": 100}, 100, 13, 113, 129.95, float(Fraction(2599, 3400)), float(Fraction(2599, 3400)))
    zincir_beklenen("CAM 130 1S1Ç ÷120 (tutarsızlık 1)", "cam/130-1s1c-h182-kabin", [Y("cam/130-1s1c-h182-kabin", "s1", miktar=6.0, fiyat=10.0)],
                    {"s1": 60}, 60, 10.8, 70.8, 84.96, 0.708, 0.708)
    k5 = "cam/130-1s2c-h182-kabin"
    zincir_beklenen("CAM 130 1S2Ç elle CM (tutarsızlık 4): sonuç %20 Maliyet, CM elle yansır", k5,
                    [Y(k5, "s1", miktar=6.0, fiyat=10.0), uretici.ELLE(k5, "cm_elle", 5.0)], {"s1": 60}, 60, 10.8, 70.8, 84.96, 5.0, 84.96)
    zincir_beklenen("MİKA 150 1S1Ç ÷120 (tutarsızlık 2)", "mika/150-1s1c-h182-kabin", [Y("mika/150-1s1c-h182-kabin", "s1", miktar=1.0, fiyat=100.0)],
                    {"s1": 100}, 100, 17, 117, 134.55, 1.12125, 1.12125)
    zincir_beklenen("MİKA 120 1S2Ç (%16, ÷120)", "mika/120-1s2c-h182-kabin", [Y("mika/120-1s2c-h182-kabin", "s7", miktar=4.0, fiyat=25.0)],
                    {"s7": 100}, 100, 16, 116, 133.4, float(Fraction(667, 600)), float(Fraction(667, 600)))
    zincir_beklenen("MİKA 100X100 Oval (%11, %15, ÷200)", "mika/100x100-oval-kabin", [Y("mika/100x100-oval-kabin", "s3", miktar=0.5, fiyat=200.0)],
                    {"s3": 100}, 100, 11, 111, 127.65, 0.63825, 0.63825)
    yp = "mika/80-lik-yan-panel"
    r = zincir_beklenen("yan panel: toplam (liste) → masraf %15 → genel → «%20» etiketli %15 (tutarsızlık 11), bölme yok", yp,
                        [Y(yp, "s1", miktar=2.0, fiyat=50.0), Y(yp, "s3", miktar=4.0, fiyat=5.0)], {"s1": 100, "s3": 20}, 120, 18, 138, 158.7, None, 158.7)
    denetim("A yan panelde bölme adımı yok", "bolme" not in r["adimlar"] and "cm_elle" not in r["adimlar"], sorted(r["adimlar"]))
    # boş kart: Excel'de boş = 0 (V1)
    bos = calistir([AC, O(oval)])[-1]["kartlar"][oval]
    denetim("A boş kart: her hesap 0, girdiler boş", all(v["deger"] == 0 for v in bos["adimlar"].values()) and bos["sonuc"] == 0 and
            all(s["tutar"] == 0 and s["miktar"] is None and s["fiyat"] is None for s in bos["satirlar"].values()), bos)
    # negatif
    zincir_beklenen("negatif girdi Excel gibi", oval, [Y(oval, "s1", miktar=-2.0, fiyat=5.0), Y(oval, "s2", miktar=3.0, fiyat=-1.0)],
                    {"s1": -10, "s2": -3}, -13, -2.34, -15.34, -18.408, -0.09204, -0.09204)
    # satır ekle / sil / ad
    zincir_beklenen("satır ekle: 1×7 ARA'ya girer", oval, taban + [uretici.EKLE(oval, "e1", ad="Silikon", miktar=1.0, fiyat=7.0)],
                    {"e1": 7}, 32, 5.76, 37.76, 45.312, 0.22656, 0.22656)
    zincir_beklenen("satır sil: silinen satır toplamda yok", oval, taban + [uretici.SIL(oval, "s2")], {"s1": 10}, 10, 1.8, 11.8, 14.16, 0.0708, 0.0708)
    zincir_beklenen("✎ aynı ad iki satırda: ikisi de sayılır", oval, taban + [uretici.AD(oval, "satir", "Cam", "s1"), uretici.AD(oval, "kart", "Yeni")],
                    {"s1": 10, "s2": 15}, 25, 4.5, 29.5, 35.4, 0.177, 0.177)
    r = zincir_beklenen("oran değiştir (%10, %0): etiket değişmez", oval, taban + [uretici.ORAN(oval, "yuzde", 10.0), uretici.ORAN(oval, "yuzde_ekle", 0.0)],
                        {"s1": 10}, 25, 2.5, 27.5, 27.5, 0.1375, 0.1375)
    denetim("A oran değişince etiket aynı (V9)", r["adimlar"]["yuzde"]["etiket"] == "KDV/18" and r["adimlar"]["yuzde_ekle"]["etiket"] == "%20 Maliyet")
    # bölen 0 (K1)
    t = calistir([AC] + taban + [K, uretici.BOLEN(oval, 0.0), K, O(oval)], {kahin.KARAR_BOLEN_0: "tanimsiz"})
    b = t[-1]["kartlar"][oval]["adimlar"]["bolme"]
    denetim("A bölen 0 (tanımsız): bölme boş + SIFIRA_BOLME, öbür adımlar aynı",
            b["deger"] is None and b["hata"] == "SIFIRA_BOLME" and yakin(t[-1]["kartlar"][oval]["adimlar"]["yuzde_ekle"]["deger"], 35.4), b)
    t = calistir([AC] + taban + [K, uretici.BOLEN(oval, 0.0), K, O(oval)], {kahin.KARAR_BOLEN_0: "ret"})
    b = t[-1]["kartlar"][oval]["adimlar"]["bolme"]
    denetim("A bölen 0 (ret): istek reddedilir, bölen 200 ve sonuç 0,177 kalır", t[-3]["durum"] == "ret" and b["bolen"] == 200 and yakin(b["deger"], 0.177))
    # Kaydet / Çık
    t = calistir([AC] + taban + [K, Y(oval, "s1", miktar=100.0), uretici.CIK("kaydetme"), AC, O(oval), uretici.CIK()])
    denetim("A Kaydetmeden Çık: soru var, son kayıtlı hâl döner; değişmemiş kartta soru yok",
            t[-4]["soru"] is True and yakin(t[-2]["kartlar"][oval]["adimlar"]["ara"]["deger"], 25) and t[-1]["soru"] is False)
    t = calistir([AC] + taban + [uretici.CIK("kaydet"), AC, O(oval)])
    denetim("A Çık → Kaydet: değerler kalır", t[-3]["soru"] is True and yakin(t[-1]["kartlar"][oval]["adimlar"]["ara"]["deger"], 25))
    # gramaj: R = Boy × Br. Gramaj; T = Alış × Giden Kğ; R20 elle; Giden Mt hesaba girmez
    g = "mika/profil-agirliklari"
    r = calistir([AC, Y(g, "s2", boy=6.0, br_gramaj=0.5, alis_ft=40.0), Y(g, "s1", boy=10.0, br_gramaj=10.0, giden_kg=2.0, alis_ft=40.0, giden_mt=999.0),
                  uretici.EKLE(g, "e1", boy=2.0, br_gramaj=1.5, alis_ft=10.0), K, O(g)])[-1]["kartlar"][g]
    denetim("A gramaj: s2 3 Kğ / 120; s1 elle 2 Kğ / 80; eklenen 3 Kğ / 30; toplam 8 Kğ / 230",
            yakin(r["satirlar"]["s2"]["giden_kg"], 3) and yakin(r["satirlar"]["s2"]["satir_top"], 120) and yakin(r["satirlar"]["s1"]["giden_kg"], 2) and
            yakin(r["satirlar"]["s1"]["satir_top"], 80) and yakin(r["satirlar"]["e1"]["giden_kg"], 3) and yakin(r["satirlar"]["e1"]["satir_top"], 30) and
            yakin(r["toplam"]["giden_kg"], 8) and yakin(r["toplam"]["satir_top"], 230), r["toplam"])
    # matris: taban + sabit fark; çapa / zincir; tesettür parlaktan (E = D + Δ3)
    m1 = "liste-1/seri-2-sabit-2-acilir"
    farklar = {"r1c2": 200, "r1c3": 100, "r1c4": 50, "r2c1": 100, "r2c2": 150, "r2c3": 100, "r2c4": 50, "r3c1": 100, "r3c2": 150, "r3c3": 100,
               "r3c4": 50, "r4c1": 300, "r4c2": 150, "r4c3": 100, "r4c4": 50}
    r = calistir([AC, uretici.TABAN(m1, "r1c1", 1000.0)] + [uretici.FARK(m1, h, float(v)) for h, v in farklar.items()] + [K, O(m1)])[-1]["kartlar"][m1]
    bek = {"r1": [1000, 1200, 1100, 1150], "r2": [1100, 1250, 1200, 1250], "r3": [1200, 1350, 1300, 1350], "r4": [1300, 1450, 1400, 1450],
           "r5": [1000, 1000, 1000, 1000]}
    denetim("A 2024 2 Sabit 2 Açılır: B6 = B5+, B7 = B6+ (zincir), B8 = B5+ (çapa), E = D+; boş fark 0",
            all(yakin(r["hucreler"][f"{s}c{i + 1}"]["deger"], v) for s, vs in bek.items() for i, v in enumerate(vs)),
            {s: [r["hucreler"][f"{s}c{i + 1}"]["deger"] for i in range(4)] for s in bek})
    m4 = "liste-1/1-sabit-2-calisir"
    r = calistir([AC, uretici.TABAN(m4, "r1c1", 500.0)] + [uretici.FARK(m4, f"r{i}c1", 10.0) for i in range(2, 6)] +
                 [uretici.FARK(m4, "r2c2", 5.0), K, O(m4)])[-1]["kartlar"][m4]["hucreler"]
    denetim("A 2024 1 Sabit 2 Çalışır: taban sütunu zincir 510/520/530/540, I20 = 515",
            [r[f"r{i}c1"]["deger"] for i in range(1, 6)] == [500, 510, 520, 530, 540] and r["r2c2"]["deger"] == 515 and r["r5c4"]["deger"] == 540)
    m6 = "liste-1/seri-yan-panel"
    r = calistir([AC, uretici.TABAN(m6, "r1c1", 800.0), uretici.FARK(m6, "r1c3", 250.0), uretici.FARK(m6, "r1c4", 30.0), K, O(m6)])[-1]["kartlar"][m6]["hucreler"]
    denetim("A 2024 Yan Panel: J = H + Δ6 (1050), K = J + Δ3 (1080)", r["r1c3"]["deger"] == 1050 and r["r1c4"]["deger"] == 1080)
    n1 = "liste-2/seri-2-sabit-2-acilir"
    adim = [AC] + [uretici.TABAN(n1, f"r1c{c}", float(100 * c)) for c in range(1, 5)]
    adim += [uretici.FARK(n1, a, 10.0) for a, h in kahin.KARTLAR[n1]["hucreler"].items() if h["tur"] == "formul"] + [K, O(n1)]
    r = calistir(adim)[-1]["kartlar"][n1]["hucreler"]
    denetim("A 2019 2 Sabit 2 Açılır: her sütun kendi zinciri, 13. satır 220/320/420/520", [r[f"r13c{c}"]["deger"] for c in range(1, 5)] == [220, 320, 420, 520])
    n2 = "liste-2/seri-kose-girisli"
    adim = [AC] + [uretici.TABAN(n2, f"r1c{c}", 200.0) for c in range(1, 5)] + [uretici.TABAN(n2, "r2c2", 7.0)]
    adim += [uretici.TABAN(n2, f"r12c{c}", float(c)) for c in range(1, 5)]
    adim += [uretici.FARK(n2, a, 10.0) for a, h in kahin.KARTLAR[n2]["hucreler"].items() if h["tur"] == "formul"] + [K, O(n2)]
    r = calistir(adim)[-1]["kartlar"][n2]["hucreler"]
    denetim("A 2019 Köşe Girişli: I5 elle 7, I6 = 17, I14 = 97, H14 = 300, 130*130 satırı elle (1)",
            r["r2c1"]["deger"] == 210 and r["r2c2"]["deger"] == 7 and r["r3c2"]["deger"] == 17 and r["r11c2"]["deger"] == 97 and
            r["r11c1"]["deger"] == 300 and r["r12c1"]["deger"] == 1)
    n3 = "liste-2/seri-oval-2-sabit-4-calisir"
    adim = [AC] + [uretici.TABAN(n3, f"r1c{c}", 100.0) for c in range(1, 5)] + [uretici.TABAN(n3, "r11c1", 9.0)]
    adim += [uretici.FARK(n3, a, 10.0) for a, h in kahin.KARTLAR[n3]["hucreler"].items() if h["tur"] == "formul"] + [K, O(n3)]
    r = calistir(adim)[-1]["kartlar"][n3]["hucreler"]
    denetim("A 2019 Oval: B29 = 190, B30 elle 9, C30 = C29 + Δ1 = 200", r["r10c1"]["deger"] == 190 and r["r11c1"]["deger"] == 9 and r["r11c2"]["deger"] == 200)
    # bilgi satırı matrisi değiştirmez (tutarsızlık 15)
    r = calistir([AC, uretici.TABAN(m1, "r1c1", 1000.0), uretici.FARK(m1, "r1c3", 100.0), uretici.BILGI("liste-1/fark-satirlari", "b1", 0, 999.0), K,
                  O(m1, "liste-1/fark-satirlari")])[-1]["kartlar"]
    denetim("A bilgi satırı (Parlak Profil Farkı 999) parlak sütununu değiştirmez", r[m1]["hucreler"]["r1c3"]["deger"] == 1100 and
            r["liste-1/fark-satirlari"]["satirlar"]["b1"]["degerler"] == [999.0])


# ---------------------------------------------------------------------------------------------------------------------------------
# B. Şablon (FORMÜL TABLOSU'nun ayrı bölümlerinden ikinci el yazımla çapraz denetim)
# ---------------------------------------------------------------------------------------------------------------------------------
TABLO_1 = {"cam": {"carpim": 35, "toplam_aralik": 5, "yuzde": 5, "toplama": 5, "yuzde_ekle": 5, "bolme": 4},
           "liste-1": {"sabit_fark": 186},
           "mika": {"carpim": 64, "toplam_aralik": 7, "toplam_liste": 1, "yuzde": 6, "toplama": 6, "yuzde_ekle": 6, "bolme": 5},
           "liste-2": {"sabit_fark": 214}}
TABLO_2 = {"cam/100x100-oval-kabin": (18, 20, 200), "cam/100x100-kose-kabin": (18, 20, 200), "cam/170-2s2c-h182": (18, 20, 170),
           "cam/130-1s1c-h182-kabin": (18, 20, 120), "cam/130-1s2c-h182-kabin": (18, 20, "ELLE"),
           "mika/100x100-oval-kabin": (11, 15, 200), "mika/100x100-kose-kabin": (11, 15, 200), "mika/170-2s2c-h182": (13, 15, 170),
           "mika/150-1s1c-h182-kabin": (17, 15, 120), "mika/120-1s2c-h182-kabin": (16, 15, 120), "mika/80-lik-yan-panel": (15, 15, None)}
ELLE_HUCRELER = {("cam/130-1s2c-h182-kabin", "H25"), ("mika/profil-agirliklari", "R20"), ("liste-2/seri-kose-girisli", "I5"),
                 ("liste-2/seri-kose-girisli", "H15"), ("liste-2/seri-kose-girisli", "I15"), ("liste-2/seri-kose-girisli", "J15"),
                 ("liste-2/seri-kose-girisli", "K15"), ("liste-2/seri-oval-2-sabit-4-calisir", "B30")}


def bolum_b():
    s = kahin.formul_sayimi()
    denetim("B formül sayımı = FORMÜL TABLOSU §1 (sekme ve kalıp başına; toplam 554)", s == TABLO_1 and sum(sum(v.values()) for v in s.values()) == 554, s)
    for kod, (p, q, k) in TABLO_2.items():
        a = {x["kod"]: x for x in kahin.KARTLAR[kod]["adimlar"]}
        son = a["bolme"]["bolen"] if "bolme" in a else ("ELLE" if "cm_elle" in a else None)
        denetim(f"B {kod}: oran {p}/{q}, bölen {k} (§2)", (a["yuzde"]["oran"], a["yuzde_ekle"]["oran"], son) == (p, q, k))
        denetim(f"B {kod}: adım sırası sabit", [x["kod"] for x in kahin.KARTLAR[kod]["adimlar"]][:4] == ["ara", "yuzde", "toplama", "yuzde_ekle"])
    denetim("B kart sayısı: 10 maliyet + yan panel + gramaj + 12 matris + 4 bilgi", (len(kahin.kartlar("zincir")), len(kahin.kartlar("gramaj")),
            len(kahin.kartlar("matris")), len(kahin.kartlar("bilgi"))) == (11, 1, 12, 4))
    elle = set()
    for kod, k in kahin.KARTLAR.items():
        if k["tur"] == "zincir":
            elle |= {(kod, a["excel"]) for a in k["adimlar"] if a["islem"] == "elle"}
        elif k["tur"] == "gramaj":
            elle |= {(kod, s["excel"]["giden_kg"]) for s in k["satirlar"] if s["elle_kg"]}
        elif k["tur"] == "matris":
            elle |= {(kod, h["excel"]) for a, h in k["hucreler"].items() if h["tur"] == "taban" and not a.startswith("r1c")}
    denetim("B elle hücreler = tutarsızlık 4, 6, 7, 8, 9 (H25, R20, I5, H15:K15, B30)", elle == ELLE_HUCRELER, sorted(elle ^ ELLE_HUCRELER))
    ilk_taban = {kod: sorted(a for a, h in k["hucreler"].items() if h["tur"] == "taban" and a.startswith("r1c")) for kod, k in kahin.KARTLAR.items() if k["tur"] == "matris"}
    denetim("B 2024'te taban yalnız ilk satırın ilk hücresi; 2019'da ilk satırın 4 hücresi", all(
        v == (["r1c1"] if kod.startswith("liste-1") else ["r1c1", "r1c2", "r1c3", "r1c4"]) for kod, v in ilk_taban.items()), ilk_taban)
    sem = {sk: sorted({h["sembol"] for k in kahin.kartlar("matris", sk) for h in k["hucreler"].values() if h["tur"] == "formul"}) for sk in ("liste-1", "liste-2")}
    denetim("B fark sembolleri: 2024'te 16, 2019'da 2 (§4)", (len(sem["liste-1"]), len(sem["liste-2"])) == (16, 2), sem)
    hata = []
    for kod, k in kahin.KARTLAR.items():
        if k["tur"] != "matris":
            continue
        for a, h in k["hucreler"].items():
            if h["tur"] != "formul":
                continue
            r, c = (int(x) for x in a[1:].split("c"))
            kr, kc = (int(x) for x in h["kaynak"][1:].split("c"))
            if not ((kr == r and kc != c) or (kr == r - 1 and kc == c) or (kr == 1 and kc == c)):
                hata.append(f"{kod} {a}←{h['kaynak']}")
            if kod.startswith("liste-2") and not (kr == r - 1 and kc == c):
                hata.append(f"{kod} {a}: 2019'da sütunlar arası / çapa başvuru")
            if kod.startswith("liste-1"):
                bek = {2: f"r{r}c1", 3: f"r{r}c1", 4: f"r{r}c3"}.get(c)
                if bek and h["kaynak"] != bek:
                    hata.append(f"{kod} {a}: renk sütunu kaynağı {h['kaynak']} ≠ {bek}")
                if c == 3 and h["sembol"] != ("Δ6" if kod.endswith("seri-yan-panel") else "Δ2"):
                    hata.append(f"{kod} {a}: parlak sembolü {h['sembol']}")
                if c == 4 and h["sembol"] != "Δ3":
                    hata.append(f"{kod} {a}: tesettür sembolü {h['sembol']}")
    denetim("B matris başvuruları yalnız aynı satır / bir üst satır / ilk satır; 2019'da yalnız üst satır; 2024 renk sütunları §4 özetindeki gibi",
            not hata, hata[:10])
    zincir = {kod: [a for a, h in k["hucreler"].items() if h["tur"] == "formul" and a.endswith("c1") and h["kaynak"] != "r1c1"]
              for kod, k in kahin.KARTLAR.items() if k["tur"] == "matris" and kod.startswith("liste-1")}
    denetim("B 2024 taban sütunu: yalnız 2 Sabit 2 Açılır B7 ve 1 Sabit 2 Çalışır H20:H23 bir üst satıra bağlı (tutarsızlık 21)",
            {k: v for k, v in zincir.items() if v} == {"liste-1/seri-2-sabit-2-acilir": ["r3c1"], "liste-1/1-sabit-2-calisir": ["r3c1", "r4c1", "r5c1"]}, zincir)
    c2 = {kod: [k["hucreler"][f"r{i}c2"]["sembol"] for i in range(1, len(k["satirlar"]) + 1)] for kod, k in kahin.KARTLAR.items()
          if k["tur"] == "matris" and kod.startswith("liste-1")}
    denetim("B 2024 siyah sütunu: 2S2A / 1S1Ç / Köşe ilk satır Δ1 sonra Δ5; öbürleri hep Δ1 (tutarsızlık 13)", all(
        v == (["Δ1"] + ["Δ5"] * (len(v) - 1) if kod.split("/")[1] in ("seri-2-sabit-2-acilir", "1-sabit-1-calisir", "seri-kose-girisli") else ["Δ1"] * len(v))
        for kod, v in c2.items()), c2)
    adlar = [s["ad"] for s in kahin.SEKMELER] + [k["ad"] for k in kahin.KARTLAR.values()]
    denetim("B sekme ve kart adlarında marka / yıl yok", not [a for a in adlar if kahin.YASAK_AD.search(a)], [a for a in adlar if kahin.YASAK_AD.search(a)])
    # Döngü yok, bütün hücreler hesaplanır
    try:
        for k in kahin.kartlar("matris"):
            kahin.goruntu(k, kahin.bos_girdi(k))
        denetim("B matrislerde döngü yok", True)
    except ValueError as e:
        denetim("B matrislerde döngü yok", False, e)


# ---------------------------------------------------------------------------------------------------------------------------------
# C. Kabul dosyası
# ---------------------------------------------------------------------------------------------------------------------------------


def kabul_oku():
    with open(os.path.join(HERE, "kabul.json"), encoding="utf-8") as f:
        return json.load(f)


def secenek_listesi(s):
    if s.get("karar"):
        return [(sec, {s["karar"]: sec}) for sec in kahin.SECENEKLER[s["karar"]]]
    return [("*", {})]


def bolum_c(kabul):
    denetim("C kabul dili ve tohum", kabul.get("dil") == kahin.DIL and kabul.get("tohumlar") == uretici.tohumlari_coz(uretici.VARSAYILAN_TOHUM))
    yeni = uretici.kabul_uret(uretici.tohumlari_coz(uretici.VARSAYILAN_TOHUM))
    denetim("C kabul.json tohumdan aynen yeniden üretiliyor (CRLF'den bağımsız, ayrıştırılmış karşılaştırma)", json.loads(json.dumps(yeni)) == kabul)
    sen = kabul["senaryolar"]
    aileler = {}
    for s in sen:
        for a in s["adimlar"]:
            if "kart" in a or a["islem"] == "oku":
                for kod in ([a["kart"]] if "kart" in a else a["kartlar"]):
                    aileler.setdefault(kod, set()).add(s["aile"])
    eksik = []
    for kod, k in kahin.KARTLAR.items():
        ist = {"zincir": {"bos", "tek-satir", "dolu", "yari-bos", "satir-ekle", "satir-sil", "sil-ayni-adla-ekle", "ad-degistir", "oran-degistir",
                          "negatif", "ondalik", "buyuk", "kaydet-yeniden-ac"},
               "gramaj": {"bos", "tek-satir", "dolu", "satir-ekle", "satir-sil", "elle", "giden-mt", "negatif", "ondalik", "buyuk", "kaydet-yeniden-ac",
                          "ad-degistir"},
               "matris": {"bos", "taban", "sembol", "hucre-basina", "uc-degerler", "taban-degistir", "fark-degistir", "ad-degistir", "kaydet-yeniden-ac"},
               "bilgi": {"bos", "bilgi"}}[k["tur"]]
        if k["tur"] == "zincir" and any(a["islem"] == "bolme" for a in k["adimlar"]):
            ist |= {"bolen-degistir", "bolen-sifir"}
        if k["tur"] == "zincir" and any(a["islem"] == "elle" for a in k["adimlar"]):
            ist |= {"elle"}
        if ist - aileler.get(kod, set()):
            eksik.append(f"{kod}: {sorted(ist - aileler.get(kod, set()))}")
    denetim("C her kart türü için zorunlu senaryo aileleri var (boş, tek satır, ekle, sil, ✎, oran/bölen, bölen 0, negatif/ondalık/büyük, Kaydet→aç)",
            not eksik, eksik[:5])
    denetim("C arayüz katmanı: canlı hesap, Çık sorusu var/yok, Kaydetmeden Çık", {"canli", "cik"} <= {s["aile"] for s in sen if s["katman"] == "arayuz"})
    n = f = 0
    for s in sen:
        for sec, d in secenek_listesi(s):
            k, ff = kahin.senaryo_karsilastir(s, s["beklenen"][sec], kahin.program_gibi(s["adimlar"], d), {})
            n, f = n + k, f + len(ff)
    denetim(f"C kâhin kendisiyle: {n} denetim, 0 fark", f == 0 and n > 10000, f)
    return n


# ---------------------------------------------------------------------------------------------------------------------------------
# D. Mutasyon
# ---------------------------------------------------------------------------------------------------------------------------------


def mutasyon_farki(kabul, mut):
    fark = 0
    aileler = set()
    for s in kabul["senaryolar"]:
        for sec, d in secenek_listesi(s):
            try:
                prog = kahin.program_gibi(s["adimlar"], d, frozenset([mut]))
            except kahin.SenaryoHatasi as e:
                raise AssertionError(f"mutasyon {mut} senaryo {s['kimlik']}: model hatası {e}")
            _n, ff = kahin.senaryo_karsilastir(s, s["beklenen"][sec], prog, {})
            if ff:
                fark += len(ff)
                aileler.add(s["aile"])
    return fark, aileler


def bolum_d(kabul):
    yakalanan = 0
    for mut, aciklama in kahin.MUTASYONLAR.items():
        fark, aileler = mutasyon_farki(kabul, mut)
        yakalanan += fark > 0
        denetim(f"D mutasyon yakalandı: {mut} — {aciklama} ({fark} fark; aileler {', '.join(sorted(aileler)[:6])})", fark > 0)
    print(f"mutasyon: {yakalanan}/{len(kahin.MUTASYONLAR)} yakalandı")
    # Eşdeğer işlem sırası (matematikçe aynı, kayan noktada 1 ulp düzeyinde farklı) FARK SAYILMAZ: tolerans kuralı (V3, V5)
    oval = "cam/100x100-oval-kabin"
    adim = [AC] + uretici._doldur_zincir(oval, random.Random("esdeger")) + [K, O(oval)]
    bek = kahin.beklenen_hesapla(adim)
    prog = kahin.program_gibi(adim)
    a = prog[-1]["kartlar"][oval]["adimlar"]
    a["yuzde"]["deger"] = a["ara"]["deger"] * (18 / 100)
    a["yuzde_ekle"]["deger"] = a["toplama"]["deger"] * (1 + 20 / 100)
    _n, ff = kahin.senaryo_karsilastir({"adimlar": adim}, bek, prog, {})
    denetim("D eşdeğer işlem sırası (ARA × (p/100), T × (1 + q/100)) fark sayılmaz", not ff, ff[:2])
    prog[-1]["kartlar"][oval]["adimlar"]["ara"]["deger"] = a["ara"]["deger"] + 0.004
    _n, ff = kahin.senaryo_karsilastir({"adimlar": adim}, bek, prog, {})
    denetim("D kuruş altı (0,004) sapma yakalanır", bool(ff))


# ---------------------------------------------------------------------------------------------------------------------------------
# E. Koşucu (ayrı süreç; sahte uyarlayıcı bu dosyanın kendisi)
# ---------------------------------------------------------------------------------------------------------------------------------
GECTI_DESENLERI = [re.compile(r"(\d+)\s*/\s*(\d+) (?:denetim|kontrol) geçti"), re.compile(r"(\d+) denetim geçti, (\d+) başarısız"),
                   re.compile(r"(\d+) geçti, (\d+) kaldı"), re.compile(r"^\s*(?:#|ℹ)\s+tests\s+\d+", re.M)]   # tools/kanit.mjs parseSummary


def sahte_uyarlayici(argv):
    mut = argv[argv.index("--mutasyon") + 1] if "--mutasyon" in argv else None
    katmanlar = argv[argv.index("--katmanlar") + 1].split(",") if "--katmanlar" in argv else ["api", "arayuz"]
    if "--cikis" in argv:
        sys.stderr.write("sahte uyarlayıcı bilerek düştü\n")
        return int(argv[argv.index("--cikis") + 1])
    istek = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    if "--bozuk-json" in argv:
        sys.stdout.write("{bozuk")
        return 0
    beyan = {"katmanlar": katmanlar}
    if "--beyansiz" not in argv:
        beyan.update({kahin.KARAR_BOLEN_0: "tanimsiz", kahin.KARAR_FARK: "hucre"})
    sonuclar = []
    for s in istek["senaryolar"]:
        d = {s["karar"]: beyan.get(s["karar"], "tanimsiz")} if s.get("karar") else {}
        sonuclar.append({"kimlik": s["kimlik"], "adimlar": kahin.program_gibi(s["adimlar"], d, frozenset([mut]) if mut else frozenset())})
    json.dump({"dil": kahin.DIL, "uyarlayici": {"ad": "kahin-sahte", "program_surumu": "-", "commit": "-"}, "beyan": beyan, "sonuclar": sonuclar},
              sys.stdout, ensure_ascii=False)
    return 0


def kos(kopya, ek, sahte=None):
    komut = [sys.executable, "-I", os.path.join(kopya, "kos.py")] + ek
    if sahte is not None:
        komut += ["--", sys.executable, "-I", os.path.join(kopya, "test_kahin.py"), "--sahte-uyarlayici"] + sahte
    env = {k: v for k, v in os.environ.items() if k != "MALIYET_UYARLAYICI"}
    p = subprocess.run(komut, capture_output=True, env=env, timeout=900)
    return p.returncode, p.stdout.decode("utf-8", "replace")


def bolum_e():
    kopya = tempfile.mkdtemp(prefix="kahin-maliyet-test-")   # uyarlayici.mjs'siz ayrı kopya (ders 25: benzersiz klasör)
    try:
        for ad in ("kahin.py", "kos.py", "uretici.py", "excel_denetle.py", "test_kahin.py", "kabul.json"):
            shutil.copy(os.path.join(HERE, ad), os.path.join(kopya, ad))
        kod, cikti = kos(kopya, [])
        denetim("E program yokken BELİRSİZ: çıkış 3, 'program yok', 'geçti' özeti yok (ders 4)",
                kod == 3 and "BELİRSİZ" in cikti and "program yok" in cikti and not any(d.search(cikti) for d in GECTI_DESENLERI), (kod, cikti[-300:]))
        kod, cikti = kos(kopya, [], [])
        denetim("E sahte uyarlayıcı --kendi-testi olmadan reddedilir (BELİRSİZ, 3)", kod == 3 and "sahte" in cikti and not any(d.search(cikti) for d in GECTI_DESENLERI),
                (kod, cikti[-300:]))
        kod, cikti = kos(kopya, ["--kendi-testi"], [])
        m = GECTI_DESENLERI[0].search(cikti.strip().splitlines()[-1]) if cikti.strip() else None
        denetim("E sahte uyarlayıcı (kâhinin kendisi) --kendi-testi: çıkış 0, N/N denetim geçti", kod == 0 and m and m.group(1) == m.group(2),
                (kod, cikti[-300:]))
        kod, cikti = kos(kopya, ["--kendi-testi"], ["--mutasyon", "bos-null"])
        m = GECTI_DESENLERI[0].search(cikti)
        denetim("E bozuk program (bos-null): çıkış 1, ✗ satırı, G < N", kod == 1 and "✗" in cikti and m and int(m.group(1)) < int(m.group(2)), (kod, cikti[-300:]))
        kod, cikti = kos(kopya, ["--kendi-testi"], ["--katmanlar", "api"])
        denetim("E arayüz katmanı koşulmadıysa BELİRSİZ (3)", kod == 3 and "koşulmadı" in cikti and not any(d.search(cikti) for d in GECTI_DESENLERI), (kod, cikti[-300:]))
        kod, cikti = kos(kopya, ["--kendi-testi", "--katman", "api"], ["--katmanlar", "api"])
        denetim("E --katman api açıkça seçilince: çıkış 0, seçilmeyen sayısı yazılı", kod == 0 and "seçilmedi" in cikti, (kod, cikti[-300:]))
        kod, cikti = kos(kopya, ["--kendi-testi"], ["--beyansiz"])
        denetim("E KARAR beyanı yoksa ilgili senaryolar koşulmaz → BELİRSİZ (3)", kod == 3 and "beyan edilmedi" in cikti, (kod, cikti[-300:]))
        kod, cikti = kos(kopya, ["--kendi-testi"], ["--bozuk-json"])
        denetim("E bozuk JSON yanıtı BELİRSİZ (3)", kod == 3 and "JSON değil" in cikti, (kod, cikti[-300:]))
        kod, cikti = kos(kopya, ["--kendi-testi"], ["--cikis", "2"])
        denetim("E uyarlayıcı düşerse BELİRSİZ (3), hata satırı gösterilir", kod == 3 and "bilerek düştü" in cikti, (kod, cikti[-300:]))
    finally:
        shutil.rmtree(kopya)


# ---------------------------------------------------------------------------------------------------------------------------------
# F. Excel denetim aracı (sentetik döküm; müşteri verisi YOK)
# ---------------------------------------------------------------------------------------------------------------------------------


def sentetik_dokum(r):
    formul, elle = excel_denetle.beklenen_formuller()
    girdiler = {kod: kahin.bos_girdi(k) for kod, k in kahin.KARTLAR.items()}
    no = {s["kod"]: str(s["excel_sekme"]) for s in kahin.SEKMELER}
    dokum = {"sekmeler": {str(s["excel_sekme"]): {"degerler": {}, "formuller": {}} for s in kahin.SEKMELER}}
    for kod, k in kahin.KARTLAR.items():
        g, d = girdiler[kod], dokum["sekmeler"][no[k["sekme"]]]["degerler"]
        if k["tur"] == "zincir":
            for row, s in zip(g["satirlar"], k["satirlar"]):
                row["miktar"], row["fiyat"] = uretici.miktar(r), uretici.fiyat(r)
                d[s["excel"]["miktar"]], d[s["excel"]["fiyat"]], d[s["excel"]["ad"]] = row["miktar"], row["fiyat"], s["ad"]
            for a in k["adimlar"]:
                if a["islem"] == "elle":
                    g["adimlar"][a["kod"]]["deger"] = d[a["excel"]] = 1.79
        elif k["tur"] == "gramaj":
            for row, s in zip(g["satirlar"], k["satirlar"]):
                row.update(uretici.gramaj_satiri(r, s["elle_kg"]))
                for alan in ("giden_mt", "boy", "br_gramaj", "alis_ft") + (("giden_kg",) if s["elle_kg"] else ()):
                    d[s["excel"][alan]] = row[alan]
        elif k["tur"] == "matris":
            for a, h in k["hucreler"].items():
                if h["tur"] == "taban":
                    g["taban"][a] = d[h["excel"]] = uretici.taban(r)
                else:
                    g["fark"][a] = float(r.randint(-4, 60) * 25)
    for sn, bek in formul.items():
        sv = dokum["sekmeler"][str(sn)]
        for adres, spec in bek.items():
            kod, yol = spec[2], spec[3]
            v = kahin._al(kahin.goruntu(kahin.KARTLAR[kod], girdiler[kod]), yol)[1]
            sv["degerler"][adres] = v
            if spec[0] == "matris":
                f = girdiler[kod]["fark"][yol[1]]
                sv["formuller"][adres] = f"={spec[4]}{'-' if f < 0 else '+'}{int(abs(f)) if f == int(f) else abs(f)}"
            else:
                sv["formuller"][adres] = spec[1]
    return dokum


def bolum_f():
    dokum = sentetik_dokum(random.Random("excel-sentetik"))
    n, ff = excel_denetle.denetle(dokum)
    denetim(f"F sentetik döküm: {n} denetim, 0 fark (araç tesisatı)", not ff and n > 554 * 2, ff[:3])
    d1 = json.loads(json.dumps(dokum))
    d1["sekmeler"]["1"]["formuller"]["B11"] = "=E13/201"
    _n, ff = excel_denetle.denetle(d1)
    denetim("F bölen 200 → 201 yapı farkı olarak yakalanır", any("B11" in x and "YAPI" in x for x in ff), ff[:3])
    d2 = json.loads(json.dumps(dokum))
    d2["sekmeler"]["3"]["degerler"]["E41"] += 1.0
    _n, ff = excel_denetle.denetle(d2)
    denetim("F yan panel sonucu (E41) +1 değer farkı olarak yakalanır", any("E41" in x and "DEĞER" in x for x in ff), ff[:3])
    d3 = json.loads(json.dumps(dokum))
    d3["sekmeler"]["3"]["formuller"]["R20"] = "=O20*P20"
    _n, ff = excel_denetle.denetle(d3)
    denetim("F elle hücre (R20) formül olursa kapsam / elle farkı", any("R20" in x for x in ff), ff[:3])
    d4 = json.loads(json.dumps(dokum))
    d4["sekmeler"]["4"]["formuller"]["I5"] = "=I4+10"
    _n, ff = excel_denetle.denetle(d4)
    denetim("F 2019 I5 formül olursa yakalanır", any("I5" in x for x in ff), ff[:3])
    d5 = json.loads(json.dumps(dokum))
    d5["sekmeler"]["2"]["formuller"]["B7"] = "=B5" + d5["sekmeler"]["2"]["formuller"]["B7"][3:]
    _n, ff = excel_denetle.denetle(d5)
    denetim("F 2024 B7 kaynağı B6 → B5 yapı farkı", any("B7" in x and "YAPI" in x for x in ff), ff[:3])


def main(argv):
    if "--sahte-uyarlayici" in argv:
        return sahte_uyarlayici(argv)
    bolum_a()
    bolum_b()
    kabul = kabul_oku()
    bolum_c(kabul)
    bolum_d(kabul)
    bolum_e()
    bolum_f()
    print(f"{SONUC['gecen']}/{SONUC['toplam']} denetim geçti")
    return 0 if SONUC["gecen"] == SONUC["toplam"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
