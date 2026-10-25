#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Maliyet Hesap Kartı — bağımsız TEMİZ ODA kâhini (2.4.6 madde 0c; dil "destekofis-maliyet/1").

Kaynak YALNIZ not defterindeki FORMÜL TABLOSU (müşteri Excel'inden fiyatsız çıkarılmış hesap düzeni: hücre adresi, işlem türü, oran,
bölen, kaynak hücre, fark sembolü). Programın kodu (server/, client/) OKUNMADI. Müşteri fiyatı/miktarı/fark tutarı bu dosyada YOK.

Bu dosya üç şey tutar (koşucu kos.py, üretici uretici.py, kendi testi test_kahin.py ve excel_denetle.py aynı kuralı kullanır):
  1. ŞABLON: 4 sekme (cam, liste-1, mika, liste-2), kartlar, satırlar, adımlar, fiyat listesi matrislerinin hücre kuralları —
     her biri Excel hücre adresiyle (FORMÜL TABLOSU §3–§4'ten satır satır).
  2. MODEL: programın kullanıcıya göstereceği değerler (satır tutarı → ARA → oran/bölen adımları → sonuç; taban + fark) ve pencere
     davranışı (Aç, Kaydet, Çık sorusu, satır ekle/sil, ✎ ad, oran/bölen değiştir).
  3. KARŞILAŞTIRMA: programın okunan görüntüsü ile kâhinin beklediği görüntü (tam / yakın / ad / ilişkisel / küme).

Kurallar ve gerekçeler README.md'de (AÇIK, KARAR GEREKİR, KÂHİN VARSAYIMI). Program geliştiricisi bu dosyayı ve kabul.json'u şablon
KAYNAĞI olarak kullanmaz (ders 5): programın şablonu FORMÜL TABLOSU'ndan ayrı elle yazılır; yoksa iki taraf aynı yazım hatasını taşır.
Yalnız standart kütüphane.
"""
import copy
import math
import re
from decimal import Decimal, ROUND_HALF_UP

DIL = "destekofis-maliyet/1"
TOL_GORELI = 1e-9       # FORMÜL TABLOSU §1: bağımsız yeniden hesabın kendi toleransı
TOL_MUTLAK = 1e-12
KARAR_BOLEN_0 = "K-BOLEN-0"   # bölen 0 ya da boş: "ret" | "tanimsiz" (README KARAR GEREKİR K1)
KARAR_FARK = "K-FARK"         # fiyat listesi farkı: "hucre" (hücre başına) | "sembol" (sembol başına ortak) (K2)
SECENEKLER = {KARAR_BOLEN_0: ("ret", "tanimsiz"), KARAR_FARK: ("hucre", "sembol")}
VARSAYILAN_SECENEK = {KARAR_BOLEN_0: "tanimsiz", KARAR_FARK: "hucre"}
SIFIRA_BOLME = "SIFIRA_BOLME"

# ---------------------------------------------------------------------------------------------------------------------------------
# 1. ŞABLON
# ---------------------------------------------------------------------------------------------------------------------------------
# Sekme sırası Excel'deki gibi (1 cam, 2 liste-1, 3 mika, 4 liste-2). Adlarda marka ve yıl yok (kullanıcı kuralı); adlar karşılaştırılmaz.
SEKMELER = [
    {"kod": "cam", "ad": "Cam Maliyet", "excel_sekme": 1},
    {"kod": "liste-1", "ad": "Liste Bayii", "excel_sekme": 2},
    {"kod": "mika", "ad": "Mika Maliyet", "excel_sekme": 3},
    {"kod": "liste-2", "ad": "Liste Bayı", "excel_sekme": 4},
]

_KOLONLAR = {"A": ("A", "B", "C", "D", "E"), "G": ("G", "H", "I", "J", "K"), "M": ("M", "N", "O", "P", "Q")}
_MALZEME_CAM = [("Aliminyum", "Kgr"), ("Cam", "M2"), ("Fitil", "Kgr"), ("Mıknatıs", "Kgr"), ("Plastik Malz.", "Adet"),
                ("Tekerlek", "Adet"), ("Vida", "Adet")]
_MALZEME_MIKA = [("Aliminyum", "Kgr"), ("Mika", "Kgr"), ("Fitil", "Kgr"), ("Mıknatıs", "Kgr"), ("Plastik Malz.", "Adet"),
                 ("Tekerlek", "Adet"), ("Vida", "Adet")]
_MALZEME_MIKA_KOSE = [("Aliminyum", "Kgr"), ("Mika", "Kgr"), ("Fitil", "Kgr"), ("Mıknatıs", "Kgr"), ("Plastik Malz.", "Adet"),
                      ("Tekerlek Köşe", "Adet"), ("Vida", "Adet")]


def _zincir(sekme, kod, ad, bas_kolon, bas_satir, malzemeler, carpim, yuzde, yuzde_ekle, son):
    """Maliyet kartı (FORMÜL TABLOSU §2–§3). bas_satir: başlık satırı (1 ya da 15). yuzde/yuzde_ekle: (etiket, oran).
    son: ("bolme", etiket, bölen) ya da ("elle", etiket)."""
    m, q, b, f, t = _KOLONLAR[bas_kolon]
    ilk = bas_satir + 1
    satirlar = []
    for i, (mad, birim) in enumerate(malzemeler):
        r = ilk + i
        satirlar.append({"kimlik": f"s{i + 1}", "ad": mad, "birim": birim,
                         "excel": {"ad": f"{m}{r}", "miktar": f"{q}{r}", "birim": f"{b}{r}", "fiyat": f"{f}{r}", "tutar": f"{t}{r}"}})
    bos = ilk + len(malzemeler)          # ARA aralığının içindeki boş / not satırı (Excel 9. ve 23. satır)
    ara = bos + 1
    adimlar = [
        {"kod": "ara", "islem": "toplam", "etiket": "Ara", "excel": f"{t}{ara}", "excel_toplam": f"SUM({t}{ilk}:{t}{bos})"},
        {"kod": "yuzde", "islem": "yuzde", "kaynak": "ara", "oran": yuzde[1], "etiket": yuzde[0], "excel": f"{t}{ara + 1}"},
        {"kod": "toplama", "islem": "toplama", "kaynak": ["ara", "yuzde"], "etiket": "", "excel": f"{t}{ara + 2}"},
        {"kod": "yuzde_ekle", "islem": "yuzde_ekle", "kaynak": "toplama", "oran": yuzde_ekle[1], "etiket": yuzde_ekle[0],
         "excel": f"{t}{ara + 3}"},
    ]
    cm = f"{q}{ara + 1}"                 # «… CM MALİYETİ» değeri: miktar sütunu, yüzde satırı (B11, H11, N11, B25, H25)
    if son[0] == "bolme":
        adimlar.append({"kod": "bolme", "islem": "bolme", "kaynak": "yuzde_ekle", "bolen": son[2], "etiket": son[1], "excel": cm})
    else:
        adimlar.append({"kod": "cm_elle", "islem": "elle", "etiket": son[1], "excel": cm})
    return {"kod": f"{sekme}/{kod}", "sekme": sekme, "tur": "zincir", "ad": ad, "carpim": carpim, "satirlar": satirlar,
            "adimlar": adimlar, "excel": {"aralik": f"{m}{bas_satir}:{t}{ara + 3}", "baslik": f"{m}{bas_satir}", "bos_satir": bos}}


def _yan_panel():
    """Ek blok A «80 lik yan panel» (MİKA A32:E41): bölme yok, ARA LİSTE biçimi, 2. adım etiketi «%20», oranı 15 (tutarsızlık 11)."""
    malz = [("Alüminyum", "Kğ"), ("Mıka", "Kğ"), ("Plastık ve Vıda", "Ad"), ("Fitil", "Kğ")]
    satirlar = [{"kimlik": f"s{i + 1}", "ad": a, "birim": u,
                 "excel": {"ad": f"A{33 + i}", "miktar": f"B{33 + i}", "birim": f"C{33 + i}", "fiyat": f"D{33 + i}", "tutar": f"E{33 + i}"}}
                for i, (a, u) in enumerate(malz)]
    adimlar = [
        {"kod": "ara", "islem": "toplam", "etiket": "Ara", "excel": "E38", "excel_toplam": "SUM(E33,E34,E35,E36)"},
        {"kod": "yuzde", "islem": "yuzde", "kaynak": "ara", "oran": 15, "etiket": "Masraf", "excel": "E39"},
        {"kod": "toplama", "islem": "toplama", "kaynak": ["yuzde", "ara"], "etiket": "Genel", "excel": "E40"},
        {"kod": "yuzde_ekle", "islem": "yuzde_ekle", "kaynak": "toplama", "oran": 15, "etiket": "%20 Maliyet", "excel": "E41"},
    ]
    return {"kod": "mika/80-lik-yan-panel", "sekme": "mika", "tur": "zincir", "ad": "80 Lik Yan Panel", "carpim": "fiyat*miktar",
            "satirlar": satirlar, "adimlar": adimlar, "excel": {"aralik": "A32:E41", "baslik": "B32", "bos_satir": 37}}


_GRAMAJ_PARCALAR = ["Arka Sabit", "Duvar Dikmesi", "Köşe Dönüşü", "Haş Fitil", "Yan Fitil", "Köşe Mıknatısı", "Mıknatıs",
                    "Karşılık 1S1Ç", "Karşılık 1S2Ç", "Plastik Profil", "İç Ray", "Dış Ray", "Askılık"]
GRAMAJ_SAYI_ALANLARI = ("giden_mt", "boy", "br_gramaj", "giden_kg", "alis_ft")


def _gramaj():
    """Ek blok B profil gramaj tablosu (MİKA M18:T33): R = BOY × BR.GRAMAJ (R20 ELLE), T = ALIŞ FT × GİDEN KĞ, R33 / T33 toplam."""
    satirlar = []
    for i, p in enumerate(_GRAMAJ_PARCALAR):
        r = 20 + i
        satirlar.append({"kimlik": f"s{i + 1}", "parca": p, "cins": "Kgr", "elle_kg": i == 0,
                         "excel": {"parca": f"M{r}", "giden_mt": f"N{r}", "boy": f"O{r}", "br_gramaj": f"P{r}", "cins": f"Q{r}",
                                   "giden_kg": f"R{r}", "alis_ft": f"S{r}", "satir_top": f"T{r}"}})
    return {"kod": "mika/profil-agirliklari", "sekme": "mika", "tur": "gramaj", "ad": "Profil Ağırlıkları Net", "satirlar": satirlar,
            "excel": {"aralik": "M18:T33", "baslik": "M18", "toplam": {"giden_kg": "R33", "satir_top": "T33"}}}


_HUCRE = re.compile(r"^([A-Z]+)(\d+)\+(Δ\d+)$")


def _matris(sekme, kod, ad, baslik, olcu_kolon, kolonlar, sutun_adlari, satirlar):
    """Bayi fiyat listesi matrisi (FORMÜL TABLOSU §4). satirlar: [(excel satırı, ölçü metni, "T | B5+Δ1 | B5+Δ2 | D5+Δ3")].
    T = TABAN (elle girdi); "X+Δn" = aynı matristeki X hücresi + hücrenin kendi farkı (Δn yalnız sembol: aynı sembol Excel'de aynı sayıydı)."""
    satir_kimlik = {es: f"r{i + 1}" for i, (es, _o, _k) in enumerate(satirlar)}
    hucreler = {}
    for i, (es, _olcu, kural) in enumerate(satirlar):
        parcalar = [p.strip() for p in kural.split("|")]
        if len(parcalar) != len(kolonlar):
            raise ValueError(f"{kod} satır {es}: {len(parcalar)} hücre")
        for j, p in enumerate(parcalar):
            anahtar = f"r{i + 1}c{j + 1}"
            adres = f"{kolonlar[j]}{es}"
            if p == "T":
                hucreler[anahtar] = {"tur": "taban", "excel": adres}
                continue
            m = _HUCRE.match(p)
            if not m or m.group(1) not in kolonlar or int(m.group(2)) not in satir_kimlik:
                raise ValueError(f"{kod} {adres}: matris dışı ya da çözülemeyen başvuru {p!r}")
            kk, ks = m.group(1), int(m.group(2))
            hucreler[anahtar] = {"tur": "formul", "kaynak": f"{satir_kimlik[ks]}c{kolonlar.index(kk) + 1}", "sembol": m.group(3),
                                 "excel": adres, "excel_kaynak": f"{kk}{ks}"}
    return {"kod": f"{sekme}/{kod}", "sekme": sekme, "tur": "matris", "ad": ad,
            "sutunlar": {f"c{j + 1}": s for j, s in enumerate(sutun_adlari)},
            "satirlar": [{"kimlik": satir_kimlik[es], "olcu": o, "excel_satir": es} for es, o, _k in satirlar],
            "hucreler": hucreler, "excel": {"baslik": baslik, "olcu_kolon": olcu_kolon, "kolonlar": list(kolonlar)}}


def _zincir_satirlari(kolonlar, ilk, olculer, sembol, ozel=None):
    """2019 düzeni: her sütun kendi zinciri, bir üst satır + sembol (FORMÜL TABLOSU §4 "zincir + Δ"); ilk satır TABAN.
    ozel: {excel satırı: "elle yazılmış kural"} — tablodaki istisnalar (I5, H15:K15, B30) AYNEN."""
    ozel = ozel or {}
    out = []
    for i, o in enumerate(olculer):
        es = ilk + i
        if es in ozel:
            kural = ozel[es]
        elif i == 0:
            kural = " | ".join("T" for _ in kolonlar)
        else:
            kural = " | ".join(f"{k}{es - 1}+{sembol}" for k in kolonlar)
        out.append((es, o, kural))
    return out


_S24 = ["Beyaz ALM / Mika Cam", "Siyah ALM / Mika Cam", "Parlak ALM / Mika Cam", "Beyaz ALM / Tesettür Cam"]
_S24B = ["Beyaz ALM Mika Cam", "Siyah ALM / Mika Cam", "Parlak ALM / Mika Cam", "Beyaz ALM / Tesettür Cam"]
_S19 = ["Beyaz / Polistren", "Beyaz 4 MM / Şeffaf", "Beyaz 4 MM / Dekoratif", "Beyaz 4 MM / Kumlama"]
_ARALIK_91_170 = ["91 - 100", "101 - 110", "111 - 120", "121 - 130", "131 - 140", "141 - 150", "151 - 160", "161 - 170"]
_YAN_PANEL_OLCU = ["01-20", "21 - 30", "31 - 40", "41 - 50", "51 - 60", "61 - 70", "71 - 80", "81 - 90", "91 - 100"]
_BCDE, _HIJK = ("B", "C", "D", "E"), ("H", "I", "J", "K")

_LISTE_1 = [
    _matris("liste-1", "seri-2-sabit-2-acilir", "Seri 2 Sabit 2 Açılır", "B3", "A", _BCDE, _S24, [
        (5, "141 - 150", "T | B5+Δ1 | B5+Δ2 | D5+Δ3"),
        (6, "151 - 160", "B5+Δ4 | B6+Δ5 | B6+Δ2 | D6+Δ3"),
        (7, "161 - 170", "B6+Δ4 | B7+Δ5 | B7+Δ2 | D7+Δ3"),
        (8, "171 - 180", "B5+Δ6 | B8+Δ5 | B8+Δ2 | D8+Δ3"),
        (9, "181 - 190", "B5+Δ7 | B9+Δ5 | B9+Δ2 | D9+Δ3"),
        (10, "191 - 200", "B5+Δ8 | B10+Δ5 | B10+Δ2 | D10+Δ3"),
        (11, "201 - 210", "B5+Δ9 | B11+Δ5 | B11+Δ2 | D11+Δ3"),
        (12, "211 - 220", "B5+Δ10 | B12+Δ5 | B12+Δ2 | D12+Δ3"),
        (13, "221 - 230", "B5+Δ11 | B13+Δ5 | B13+Δ2 | D13+Δ3"),
        (14, "231 - 240", "B5+Δ12 | B14+Δ5 | B14+Δ2 | D14+Δ3"),
    ]),
    _matris("liste-1", "1-sabit-1-calisir", "1 Sabit 1 Çalışır", "H3", "G", _HIJK, _S24, [
        (5, "101 - 110", "T | H5+Δ1 | H5+Δ2 | J5+Δ3"),
        (6, "111 - 120", "H5+Δ3 | H6+Δ5 | H6+Δ2 | J6+Δ3"),
        (7, "121 - 130", "H5+Δ4 | H7+Δ5 | H7+Δ2 | J7+Δ3"),
        (8, "131 - 140", "H5+Δ1 | H8+Δ5 | H8+Δ2 | J8+Δ3"),
        (9, "141 - 150", "H5+Δ2 | H9+Δ5 | H9+Δ2 | J9+Δ3"),
    ]),
    _matris("liste-1", "seri-kose-girisli", "Seri Köşe Girişli", "A17", "A", _BCDE, _S24, [
        (19, "85 * 85", "T | B19+Δ1 | B19+Δ2 | D19+Δ3"),
        (20, "90 * 90", "B19+Δ4 | B20+Δ5 | B20+Δ2 | D20+Δ3"),
        (21, "95 * 95", "B19+Δ5 | B21+Δ5 | B21+Δ2 | D21+Δ3"),
        (22, "100*100", "B19+Δ6 | B22+Δ5 | B22+Δ2 | D22+Δ3"),
        (23, "105*105", "B19+Δ13 | B23+Δ5 | B23+Δ2 | D23+Δ3"),
        (24, "110*110", "B19+Δ8 | B24+Δ5 | B24+Δ2 | D24+Δ3"),
        (25, "115*115", "B19+Δ9 | B25+Δ5 | B25+Δ2 | D25+Δ3"),
        (26, "120*120", "B19+Δ10 | B26+Δ5 | B26+Δ2 | D26+Δ3"),
        (27, "125*125", "B19+Δ14 | B27+Δ5 | B27+Δ2 | D27+Δ3"),
    ]),
    _matris("liste-1", "1-sabit-2-calisir", "1 Sabit 2 Çalışır", "G17", "G", _HIJK, _S24B, [
        (19, "101 - 110", "T | H19+Δ1 | H19+Δ2 | J19+Δ3"),
        (20, "111 - 120", "H19+Δ3 | H20+Δ1 | H20+Δ2 | J20+Δ3"),
        (21, "121 - 130", "H20+Δ3 | H21+Δ1 | H21+Δ2 | J21+Δ3"),
        (22, "131 - 140", "H21+Δ3 | H22+Δ1 | H22+Δ2 | J22+Δ3"),
        (23, "141 - 150", "H22+Δ3 | H23+Δ1 | H23+Δ2 | J23+Δ3"),
    ]),
    _matris("liste-1", "seri-oval-2-sabit-4-calisir", "Seri Oval 2 Sabit 4 Çalışır", "B30", "A", _BCDE, _S24B, [
        (32, "80 * 80", "T | B32+Δ1 | B32+Δ2 | D32+Δ3"),
        (33, "85 * 85", "B32+Δ4 | B33+Δ1 | B33+Δ2 | D33+Δ3"),
        (34, "90 * 90", "B32+Δ1 | B34+Δ1 | B34+Δ2 | D34+Δ3"),
        (35, "95 * 95", "B32+Δ6 | B35+Δ1 | B35+Δ2 | D35+Δ3"),
        (36, "100*100", "B32+Δ2 | B36+Δ1 | B36+Δ2 | D36+Δ3"),
        (37, "105*105", "B32+Δ7 | B37+Δ1 | B37+Δ2 | D37+Δ3"),
        (38, "110*110", "B32+Δ15 | B38+Δ1 | B38+Δ2 | D38+Δ3"),
        (39, "115*115", "B32+Δ8 | B39+Δ1 | B39+Δ2 | D39+Δ3"),
        (40, "120*120", "B32+Δ9 | B40+Δ1 | B40+Δ2 | D40+Δ3"),
        (41, "125*125", "B32+Δ11 | B41+Δ1 | B41+Δ2 | D41+Δ3"),
    ]),
    _matris("liste-1", "seri-yan-panel", "Seri Yan Panel", "H30", "G", _HIJK, _S24B, [
        (32, "01-20", "T | H32+Δ1 | H32+Δ6 | J32+Δ3"),
        (33, "21 - 30", "H32+Δ3 | H33+Δ1 | H33+Δ6 | J33+Δ3"),
        (34, "31 - 40", "H32+Δ4 | H34+Δ1 | H34+Δ6 | J34+Δ3"),
        (35, "41 - 50", "H32+Δ5 | H35+Δ1 | H35+Δ6 | J35+Δ3"),
        (36, "51 - 60", "H32+Δ7 | H36+Δ1 | H36+Δ6 | J36+Δ3"),
        (37, "61 - 70", "H32+Δ15 | H37+Δ1 | H37+Δ6 | J37+Δ3"),
        (38, "71 - 80", "H32+Δ16 | H38+Δ1 | H38+Δ6 | J38+Δ3"),
        (39, "81 - 90", "H32+Δ10 | H39+Δ1 | H39+Δ6 | J39+Δ3"),
        (40, "91 - 100", "H32+Δ11 | H40+Δ1 | H40+Δ6 | J40+Δ3"),
    ]),
]

_LISTE_2 = [
    _matris("liste-2", "seri-2-sabit-2-acilir", "Seri 2 Sabit 2 Açılır", "B2", "A", _BCDE, _S19, _zincir_satirlari(
        _BCDE, 4, ["121  -  130", "131  - 140", "141 - 150", "151 - 160", "161 - 170", "171 - 180", "181 - 190", "191 - 200",
                   "201 - 210", "211 - 220", "221 - 230", "231 - 240", "241 - 250"], "Δ1")),
    _matris("liste-2", "seri-kose-girisli", "Seri Köşe Girişli", "H2", "G", _HIJK, _S19, _zincir_satirlari(
        _HIJK, 4, ["70 * 70", "80 * 80", "85 * 85", "90 * 90", "95 * 95", "100 * 100", "105 * 105", "110 * 110", "115 * 115",
                   "120 * 120", "125 * 125", "130 * 130"], "Δ1",
        ozel={5: "H4+Δ1 | T | J4+Δ1 | K4+Δ1",      # I5 elle (tutarsızlık 7)
              15: "T | T | T | T"})),               # H15:K15 elle (tutarsızlık 8)
    _matris("liste-2", "seri-oval-2-sabit-4-calisir", "Seri Oval 2 Sabit 4 Çalışır", "B18", "A", _BCDE, _S19, _zincir_satirlari(
        _BCDE, 20, ["80 * 80", "85 * 85", "90 * 90", "95 * 95", "100 * 100", "105 * 105", "110 * 110", "115 * 115", "120 * 120",
                    "125 * 125", "130 * 130"], "Δ1",
        ozel={30: "T | C29+Δ1 | D29+Δ1 | E29+Δ1"})),  # B30 elle (tutarsızlık 9)
    _matris("liste-2", "1-sabit-1-calisir", "1 Sabit 1 Çalışır", "H18", "G", _HIJK, _S19,
            _zincir_satirlari(_HIJK, 20, _ARALIK_91_170, "Δ1")),
    _matris("liste-2", "1-sabit-2-calisir", "1 Sabit 2 Çalışır", "B32", "A", _BCDE, _S19,
            _zincir_satirlari(_BCDE, 34, _ARALIK_91_170, "Δ1")),
    _matris("liste-2", "seri-yan-panel", "Seri Yan Panel", "H32", "G", _HIJK, _S19,
            _zincir_satirlari(_HIJK, 34, _YAN_PANEL_OLCU, "Δ2")),
]


def _bilgi(sekme, kod, ad, satirlar):
    """Hiçbir hesaba bağlı olmayan bilgi satırları (FORMÜL TABLOSU §4 matris dışı; tutarsızlık 15, 23): değerleri boş gelir."""
    return {"kod": f"{sekme}/{kod}", "sekme": sekme, "tur": "bilgi", "ad": ad,
            "satirlar": [{"kimlik": f"b{i + 1}", "ad": a, "hucre": h, "excel": e} for i, (a, h, e) in enumerate(satirlar)]}


_BILGI = [
    _bilgi("liste-1", "katlanir-kapi", "Katlanır Kapı Siyah Alüminyum Mika", [
        ("70-90 Arası H190", 2, ["J12", "K12"]), ("90-110 Arası H190", 2, ["J13", "K13"]),
        ("Kumlama Farkı", 1, ["K14"]), ("Parlak Alüminyum Farkı", 1, ["K15"])]),
    _bilgi("liste-1", "fark-satirlari", "Fark Satırları", [
        ("Parlak Profil Farkı", 1, ["C44"]), ("Siyah Profil Farkı", 1, ["C45"]), ("Tesettür Mika Farkı", 1, ["C46"]),
        ("Parlak Profil 40x40 Kutu Mt", 1, ["C47"]), ("Beyaz Profil 40x40 Kutu Mt", 1, ["C48"])]),
    _bilgi("liste-2", "fark-satirlari", "Fark Satırları", [
        ("Parlak Profil Farkı", 1, ["C44"]), ("Tesettür Mika Farkı", 1, ["C45"]), ("Parlak Profil 40x40 Kutu Mt", 1, ["C46"]),
        ("Beyaz Profil 40x40 Kutu Mt", 1, ["C47"])]),
    _bilgi("liste-2", "montaj-satirlari", "Montaj Satırları", [
        ("Kabin Montajı", 1, ["J44"]), ("Süperlüx Kabin Montajı", 1, ["J45"]), ("Tekne Montajı", 1, ["J46"]),
        ("Küvet Montajı", 1, ["J47"])]),
]

_CAM = [
    _zincir("cam", "100x100-oval-kabin", "100X100 Oval Kabin", "A", 1, _MALZEME_CAM, "miktar*fiyat",
            ("KDV/18", 18), ("%20 Maliyet", 20), ("bolme", "Oval Kabin CM Maliyeti", 200)),
    _zincir("cam", "100x100-kose-kabin", "100X100 Köşe Kabin", "G", 1, _MALZEME_CAM, "miktar*fiyat",
            ("KDV/18", 18), ("%20 Maliyet", 20), ("bolme", "Köşe Kabin CM Maliyeti", 200)),
    _zincir("cam", "170-2s2c-h182", "170 2S2Ç H:182", "M", 1, _MALZEME_CAM, "miktar*fiyat",
            ("KDV/18", 18), ("%20 Maliyet", 20), ("bolme", "2S2Ç Kabin CM Maliyeti", 170)),
    _zincir("cam", "130-1s1c-h182-kabin", "130 1S1Ç H:182 Kabin", "A", 15, _MALZEME_CAM, "miktar*fiyat",
            ("KDV/18", 18), ("%20 Maliyet", 20), ("bolme", "1S1Ç Kabin CM Maliyeti", 120)),       # ÷120 (tutarsızlık 1)
    _zincir("cam", "130-1s2c-h182-kabin", "130 1S2Ç H:182 Kabin", "G", 15, _MALZEME_CAM, "miktar*fiyat",
            ("KDV/18", 18), ("%20 Maliyet", 20), ("elle", "1S2Ç Kabin CM Maliyeti")),             # H25 elle (tutarsızlık 4)
]

_MIKA = [
    _zincir("mika", "100x100-oval-kabin", "100X100 Oval Kabin", "A", 1, _MALZEME_MIKA, "fiyat*miktar",
            ("Masraf%", 11), ("%15 Maliyet", 15), ("bolme", "Oval Kabin CM Maliyeti", 200)),
    _zincir("mika", "100x100-kose-kabin", "100X100 Köşe Kabin", "G", 1, _MALZEME_MIKA_KOSE, "fiyat*miktar",
            ("Masraf%", 11), ("%15 Maliyet", 15), ("bolme", "Köşe Kabin CM Maliyeti", 200)),
    _zincir("mika", "170-2s2c-h182", "170 2S2Ç H:182", "M", 1, _MALZEME_MIKA, "fiyat*miktar",
            ("Masraf%", 13), ("%15 Maliyet", 15), ("bolme", "2S2Ç Kabin CM Maliyeti", 170)),
    _zincir("mika", "150-1s1c-h182-kabin", "150 1S1Ç H:182 Kabin", "A", 15, _MALZEME_MIKA, "fiyat*miktar",
            ("Masraf%", 17), ("%15 Maliyet", 15), ("bolme", "1S1Ç Kabin CM Maliyeti", 120)),       # ÷120 (tutarsızlık 2)
    _zincir("mika", "120-1s2c-h182-kabin", "120 1S2Ç H:182 Kabin", "G", 15, _MALZEME_MIKA, "fiyat*miktar",
            ("Masraf %", 16), ("%15 Maliyet", 15), ("bolme", "", 120)),                           # G25 etiket yerinde sayı (5)
    _gramaj(),
    _yan_panel(),
]

KARTLAR = {k["kod"]: k for k in _CAM + _LISTE_1[:2] + _BILGI[:1] + _LISTE_1[2:] + _BILGI[1:2] + _MIKA + _LISTE_2 + _BILGI[2:]}
for _s in SEKMELER:
    _s["kartlar"] = [k for k, v in KARTLAR.items() if v["sekme"] == _s["kod"]]


def kartlar(tur=None, sekme=None):
    return [k for k in KARTLAR.values() if (tur is None or k["tur"] == tur) and (sekme is None or k["sekme"] == sekme)]


def formul_sayimi():
    """Şablonun Excel'de karşılığı olan formül hücresi sayısı, sekme ve kalıp başına (FORMÜL TABLOSU §1 ile karşılaştırılır)."""
    out = {s["kod"]: {} for s in SEKMELER}

    def ekle(sekme, tur, n=1):
        out[sekme][tur] = out[sekme].get(tur, 0) + n

    for k in KARTLAR.values():
        s = k["sekme"]
        if k["tur"] == "zincir":
            ekle(s, "carpim", len(k["satirlar"]))
            for a in k["adimlar"]:
                if a["islem"] == "toplam":
                    ekle(s, "toplam_liste" if "," in a["excel_toplam"] else "toplam_aralik")
                elif a["islem"] != "elle":
                    ekle(s, a["islem"])
        elif k["tur"] == "gramaj":
            ekle(s, "carpim", sum(1 for r in k["satirlar"] if not r["elle_kg"]) + len(k["satirlar"]))
            ekle(s, "toplam_aralik", 2)
        elif k["tur"] == "matris":
            ekle(s, "sabit_fark", sum(1 for h in k["hucreler"].values() if h["tur"] == "formul"))
    return out


# ---------------------------------------------------------------------------------------------------------------------------------
# 2. MODEL
# ---------------------------------------------------------------------------------------------------------------------------------
MUTASYONLAR = {
    # Kâhinin dişi (test_kahin.py): her biri kabul karşılaştırmasında en az bir farka yol açmalı.
    "ara-son-satir-yok": "ARA son satırı toplamaz",
    "yuzde-oran2": "yüzde adımı 2. oranı kullanır",
    "toplama-yuzdesiz": "toplama adımı yüzdeyi eklemez",
    "yuzde-ekle-carpan": "yüzde ekle (T × q/100) + T yerine T × q/100",
    "bolme-yanlis-kaynak": "bölme yüzde ekle yerine toplamayı böler",
    "kurus-yuvarla-tutar": "satır tutarı kuruşa yuvarlanır (Excel yuvarlamaz)",
    "kurus-yuvarla-ara": "ARA kuruşa yuvarlanır",
    "cam5-cm-hesapla": "CAM 130 1S2Ç CM maliyeti elle değil ÷120 hesaplanır",
    "cam4-bolen-130": "CAM 130 1S1Ç bölen 130'a 'düzeltilir'",
    "mika9-bolen-150": "MİKA 150 1S1Ç bölen 150'ye 'düzeltilir'",
    "yan-panel-oran-20": "yan panel 2. oranı etiketteki %20'ye 'düzeltilir'",
    "oran-ortak": "oran değişikliği sekmedeki öbür kartlara da yazılır",
    "bolen-ortak": "bölen değişikliği sekmedeki öbür kartlara da yazılır",
    "ortak-malzeme-fiyati": "aynı adlı malzemenin fiyatı sekmedeki bütün kartlarda ortak",
    "eklenen-satir-ara-disi": "eklenen satır ARA'ya girmez",
    "silinen-satir-sayilir": "silinen satır toplamda kalır",
    "ad-ile-birlestir": "aynı adlı satırlardan yalnız ilki sayılır",
    "bos-null": "boş kartta hesaplanan değerler 0 yerine boş (null)",
    "gramaj-r20-hesapla": "gramaj R20 elle değil Boy × Br. Gramaj",
    "gramaj-giden-mt": "gramaj Giden Kğ = Giden Mt × Br. Gramaj",
    "gramaj-eklenen-toplam-disi": "eklenen gramaj satırı toplamlara girmez",
    "gramaj-toplam-elle-yok": "elle Giden Kğ toplama girmez",
    "matris-b7-capa": "liste-1 2 Sabit 2 Açılır B7 = B5 + fark (zincir yerine çapa)",
    "matris-h-zincir-capa": "liste-1 1 Sabit 2 Çalışır H21:H23 ilk satıra bağlanır (zincir yerine çapa)",
    "matris-tesettur-tabandan": "liste-1 tesettür sütunu parlak yerine tabandan türetilir",
    "matris-fark-ilk-satir": "liste-1 siyah sütununda bütün satırlar ilk satırın farkını kullanır",
    "matris-yan-panel-parlak-c3": "liste-1 Seri Yan Panel parlak sütunu kendi farkı yerine 2 Sabit 2 Açılır'ın ilk parlak farkını kullanır",
    "matris-elle-zincir": "liste-2 elle hücreleri (I5, H15:K15, B30) üst satırdan hesaplanır",
    "matris-bos-fark-null": "boş fark 0 yerine boş (hücre hesaplanmaz)",
    "fark-sembole-bagli": "fark hücre başına değil sembol başına (ilk hücrenin farkı) okunur",
    "bilgi-bagli": "liste-1 'Parlak Profil Farkı' bilgi satırı parlak sütununun farkı olarak okunur",
    "bolen-sifir-sonsuz": "bölen 0 kabul edilir ve sonsuz (ya da 0) gösterilir",
    "kaydet-yuvarla-girdi": "Kaydet girdileri 2 basamağa yuvarlar",
    "cik-soru-yok": "kaydedilmemiş değişiklikle Çık'ta soru sorulmaz",
    "cik-kaydetmeden-kaydeder": "'Kaydetmeden Çık' yine de kaydeder",
    "oran-etiket-bagli": "oran değişince etiket kendiliğinden değişir",
    "yeniden-baslat-kayip": "program yeniden başlayınca son Kaydet kaybolur",
}


def sayi(x):
    """Excel aritmetiği: boş hücre 0 sayılır (KÂHİN VARSAYIMI V1)."""
    return 0.0 if x is None else float(x)


def kurus(x):
    return float(Decimal(repr(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _ad_anahtari(s):
    return (s or "").strip().casefold()


def bos_girdi(kart):
    """Ürünle gelen BOŞ YAPI: adlar, birimler, oranlar ve bölenler dolu; miktar, fiyat, taban, fark, elle değer boş."""
    t = kart["tur"]
    if t == "zincir":
        return {"ad": kart["ad"], "_kullanici": [], "silinen": [],
                "satirlar": [{"kimlik": s["kimlik"], "ad": s["ad"], "birim": s["birim"], "miktar": None, "fiyat": None, "eklenen": False}
                             for s in kart["satirlar"]],
                "adimlar": {a["kod"]: {k: a[k] for k in ("etiket", "oran", "bolen") if k in a} | ({"deger": None} if a["islem"] == "elle" else {})
                            for a in kart["adimlar"]}}
    if t == "gramaj":
        return {"ad": kart["ad"], "_kullanici": [], "silinen": [],
                "satirlar": [{"kimlik": s["kimlik"], "parca": s["parca"], "cins": s["cins"], "elle": s["elle_kg"], "eklenen": False,
                              **{a: None for a in GRAMAJ_SAYI_ALANLARI}} for s in kart["satirlar"]]}
    if t == "matris":
        return {"ad": kart["ad"], "_kullanici": [], "sutunlar": dict(kart["sutunlar"]),
                "olculer": {s["kimlik"]: s["olcu"] for s in kart["satirlar"]}, "taban": {}, "fark": {}}
    return {"ad": kart["ad"], "_kullanici": [], "satirlar": {s["kimlik"]: {"ad": s["ad"], "degerler": [None] * s["hucre"]} for s in kart["satirlar"]}}


def _hesap_zincir(kart, g, mut):
    satirlar = list(g["satirlar"]) + (list(g["silinen"]) if "silinen-satir-sayilir" in mut else [])
    hepsi_bos = all(r["miktar"] is None and r["fiyat"] is None for r in g["satirlar"])
    tutar = {}
    for r in satirlar:
        a, b = sayi(r["miktar"]), sayi(r["fiyat"])
        v = a * b if kart["carpim"] == "miktar*fiyat" else b * a     # Excel: CAM =Miktar*Fiyat, MİKA =Fiyat*Miktar (FORMÜL TABLOSU §0)
        if "kurus-yuvarla-tutar" in mut:
            v = kurus(v)
        tutar[r["kimlik"]] = v
    ara_sat = satirlar
    if "ara-son-satir-yok" in mut and ara_sat:
        ara_sat = ara_sat[:-1]
    if "eklenen-satir-ara-disi" in mut:
        ara_sat = [r for r in ara_sat if not r["eklenen"]]
    if "ad-ile-birlestir" in mut:
        gorulen, tek = [], []
        for r in ara_sat:
            if _ad_anahtari(r["ad"]) in gorulen and r["ad"]:
                continue
            gorulen.append(_ad_anahtari(r["ad"]))
            tek.append(r)
        ara_sat = tek
    deger, hata = {}, {}
    ara = 0.0
    for r in ara_sat:                    # Excel SUM: satır sırasıyla, soldan sağa
        ara = ara + tutar[r["kimlik"]]
    if "kurus-yuvarla-ara" in mut:
        ara = kurus(ara)
    deger["ara"] = ara
    for a in kart["adimlar"][1:]:
        kod, islem, ga = a["kod"], a["islem"], g["adimlar"][a["kod"]]
        if islem == "yuzde":             # =ARA*p/100  → (ARA × p) / 100
            p = sayi(ga.get("oran"))
            if "yuzde-oran2" in mut:
                p = sayi(g["adimlar"]["yuzde_ekle"].get("oran"))
            deger[kod] = (deger[a["kaynak"]] * p) / 100
        elif islem == "toplama":         # =X+Y
            x, y = a["kaynak"]
            deger[kod] = deger[x] if "toplama-yuzdesiz" in mut else deger[x] + deger[y]
        elif islem == "yuzde_ekle":      # =T*q/100+T → ((T × q) / 100) + T
            q, t = sayi(ga.get("oran")), deger[a["kaynak"]]
            deger[kod] = (t * q) / 100 if "yuzde-ekle-carpan" in mut else (t * q) / 100 + t
        elif islem == "bolme":           # =X/k
            k = sayi(ga.get("bolen"))
            x = deger["toplama"] if "bolme-yanlis-kaynak" in mut else deger[a["kaynak"]]
            if k == 0:
                if "bolen-sifir-sonsuz" in mut:
                    deger[kod] = math.inf
                else:
                    deger[kod], hata[kod] = None, SIFIRA_BOLME
            else:
                deger[kod] = x / k
        elif islem == "elle":            # CAM H25: elle yazılmış hücre; hiçbir adıma girmez, hiçbir adımdan okunmaz
            deger[kod] = deger["yuzde_ekle"] / 120 if "cam5-cm-hesapla" in mut else ga.get("deger")
    son = [a for a in kart["adimlar"] if a["islem"] != "elle"][-1]["kod"]
    if "bos-null" in mut and hepsi_bos:
        elle = {a["kod"] for a in kart["adimlar"] if a["islem"] == "elle"}
        tutar = {k: None for k in tutar}
        deger = {k: (v if k in elle else None) for k, v in deger.items()}
    return tutar, deger, hata, deger[son]


def _hesap_gramaj(kart, g, mut):
    satirlar = list(g["satirlar"]) + (list(g["silinen"]) if "silinen-satir-sayilir" in mut else [])
    kg, top = {}, {}
    for r in satirlar:
        if r["elle"] and "gramaj-r20-hesapla" not in mut:
            v = sayi(r["giden_kg"])                                    # R20 elle (tutarsızlık 6)
        elif "gramaj-giden-mt" in mut:
            v = sayi(r["giden_mt"]) * sayi(r["br_gramaj"])
        else:
            v = sayi(r["boy"]) * sayi(r["br_gramaj"])                  # =O*P
        kg[r["kimlik"]] = v
        top[r["kimlik"]] = sayi(r["alis_ft"]) * v                      # =S*R
    t_kg = t_top = 0.0
    for r in satirlar:
        if "gramaj-eklenen-toplam-disi" in mut and r["eklenen"]:
            continue
        if not ("gramaj-toplam-elle-yok" in mut and r["elle"]):
            t_kg = t_kg + kg[r["kimlik"]]
        t_top = t_top + top[r["kimlik"]]
    return kg, top, {"giden_kg": t_kg, "satir_top": t_top}


def _hesap_matris(kart, g, mut, bilgi=None):
    deger = {}
    sembol_ilk = {}
    if "fark-sembole-bagli" in mut:
        for anahtar, h in kart["hucreler"].items():
            if h["tur"] == "formul" and h["sembol"] not in sembol_ilk:
                sembol_ilk[h["sembol"]] = anahtar
    kod = kart["kod"]

    def hesap(anahtar, iz=()):
        if anahtar in deger:
            return deger[anahtar]
        if anahtar in iz:
            raise ValueError(f"{kod}: döngü {iz}")
        h = kart["hucreler"][anahtar]
        r, c = (int(x) for x in anahtar[1:].split("c"))
        if h["tur"] == "taban":
            if "matris-elle-zincir" in mut and kart["sekme"] == "liste-2" and r > 1:
                v = hesap(f"r{r - 1}c{c}", iz + (anahtar,))
            else:
                v = sayi(g["taban"].get(anahtar))
            deger[anahtar] = v
            return v
        kaynak = h["kaynak"]
        if "matris-b7-capa" in mut and kod == "liste-1/seri-2-sabit-2-acilir" and anahtar == "r3c1":
            kaynak = "r1c1"
        if "matris-h-zincir-capa" in mut and kod == "liste-1/1-sabit-2-calisir" and c == 1 and r >= 3:
            kaynak = "r1c1"
        if "matris-tesettur-tabandan" in mut and kart["sekme"] == "liste-1" and c == 4:
            kaynak = f"r{r}c1"
        fark_anahtari = anahtar
        if "matris-fark-ilk-satir" in mut and kart["sekme"] == "liste-1" and c == 2:
            fark_anahtari = "r1c2"
        if "fark-sembole-bagli" in mut:
            fark_anahtari = sembol_ilk[h["sembol"]]
        f = g["fark"].get(fark_anahtari)
        if "matris-yan-panel-parlak-c3" in mut and kod == "liste-1/seri-yan-panel" and c == 3:
            f = (bilgi or {}).get("_m1_r1c3")
        if "bilgi-bagli" in mut and kart["sekme"] == "liste-1" and c == 3 and bilgi and bilgi.get("parlak") is not None:
            f = bilgi["parlak"]
        if f is None and "matris-bos-fark-null" in mut:
            deger[anahtar] = None
            return None
        v0 = hesap(kaynak, iz + (anahtar,))
        v = None if v0 is None else v0 + sayi(f)                      # =X+Δ
        deger[anahtar] = v
        return v

    for anahtar in kart["hucreler"]:
        hesap(anahtar)
    return deger


def goruntu(kart, g, mut=frozenset(), baglam=None):
    """Programın bu kart için göstermesi gereken değerler (koşucu programdan aynı biçimi ister; README §6)."""
    t = kart["tur"]
    if t == "zincir":
        tutar, deger, hata, sonuc = _hesap_zincir(kart, g, mut)
        adimlar = {}
        for a in kart["adimlar"]:
            ga = g["adimlar"][a["kod"]]
            d = {"etiket": ga["etiket"], "deger": deger[a["kod"]]}
            for k in ("oran", "bolen"):
                if k in ga:
                    d[k] = ga[k]
            if a["islem"] == "bolme":
                d["hata"] = hata.get(a["kod"])
            adimlar[a["kod"]] = d
        return {"ad": g["ad"], "satirlar": {r["kimlik"]: {"ad": r["ad"], "birim": r["birim"], "miktar": r["miktar"], "fiyat": r["fiyat"],
                                                          "tutar": tutar[r["kimlik"]]} for r in g["satirlar"]},
                "adimlar": adimlar, "sonuc": sonuc}
    if t == "gramaj":
        kg, top, toplam = _hesap_gramaj(kart, g, mut)
        return {"ad": g["ad"], "toplam": toplam,
                "satirlar": {r["kimlik"]: {"parca": r["parca"], "cins": r["cins"], "giden_mt": r["giden_mt"], "boy": r["boy"],
                                           "br_gramaj": r["br_gramaj"], "giden_kg": kg[r["kimlik"]], "alis_ft": r["alis_ft"],
                                           "satir_top": top[r["kimlik"]]} for r in g["satirlar"]}}
    if t == "matris":
        deger = _hesap_matris(kart, g, mut, baglam)
        hucreler = {}
        for anahtar, h in kart["hucreler"].items():
            alan = "taban" if h["tur"] == "taban" else "fark"
            hucreler[anahtar] = {alan: (g["taban"] if alan == "taban" else g["fark"]).get(anahtar), "deger": deger[anahtar]}
        return {"ad": g["ad"], "sutunlar": dict(g["sutunlar"]), "olculer": dict(g["olculer"]), "hucreler": hucreler}
    return {"ad": g["ad"], "satirlar": {k: {"ad": v["ad"], "degerler": list(v["degerler"])} for k, v in g["satirlar"].items()}}


def sablon_normal(mut=frozenset()):
    """Şablonun programdan bağımsız normal biçimi (sablon_oku adımının beklenen yanıtı; README §6.4)."""
    durum = Model(mut=mut).kayitli
    out = {"sekmeler": {s["kod"]: {"ad": s["ad"], "kartlar": list(s["kartlar"])} for s in SEKMELER}, "kartlar": {}}
    for kod, k in KARTLAR.items():
        g = durum[kod]
        if k["tur"] == "zincir":
            out["kartlar"][kod] = {"ad": k["ad"], "tur": "zincir", "satirlar": [s["kimlik"] for s in k["satirlar"]],
                                   "adim_sirasi": [a["kod"] for a in k["adimlar"]],
                                   "adim_islem": {a["kod"]: a["islem"] for a in k["adimlar"]},
                                   "oranlar": {a["kod"]: g["adimlar"][a["kod"]]["oran"] for a in k["adimlar"] if "oran" in a},
                                   "bolen": next((g["adimlar"][a["kod"]]["bolen"] for a in k["adimlar"] if "bolen" in a), None),
                                   "elle": [a["kod"] for a in k["adimlar"] if a["islem"] == "elle"]}
            if "cam5-cm-hesapla" in mut and out["kartlar"][kod]["elle"]:
                out["kartlar"][kod]["adim_islem"]["cm_elle"] = "bolme"
                out["kartlar"][kod]["elle"] = []
        elif k["tur"] == "gramaj":
            out["kartlar"][kod] = {"ad": k["ad"], "tur": "gramaj", "satirlar": [s["kimlik"] for s in k["satirlar"]],
                                   "elle_kg": [] if "gramaj-r20-hesapla" in mut else [s["kimlik"] for s in k["satirlar"] if s["elle_kg"]]}
        elif k["tur"] == "matris":
            hucreler = {}
            for a, h in k["hucreler"].items():
                hucreler[a] = "taban" if h["tur"] == "taban" else h["kaynak"]
            if "matris-b7-capa" in mut and kod == "liste-1/seri-2-sabit-2-acilir":
                hucreler["r3c1"] = "r1c1"
            out["kartlar"][kod] = {"ad": k["ad"], "tur": "matris", "satirlar": [s["kimlik"] for s in k["satirlar"]],
                                   "sutunlar": list(k["sutunlar"]), "hucreler": hucreler}
        else:
            out["kartlar"][kod] = {"ad": k["ad"], "tur": "bilgi", "satirlar": [s["kimlik"] for s in k["satirlar"]]}
    return out


class SenaryoHatasi(Exception):
    """Senaryo dilinin kendi hatası (üretici yanlış adım yazdı) — programın hatası değil."""


class Model:
    """Programın beklenen davranışı. secenekler: KARAR GEREKİR maddelerinin seçeneği; mut: kâhinin kendi testi için bilerek bozma."""

    def __init__(self, secenekler=None, mut=frozenset()):
        self.sec = dict(VARSAYILAN_SECENEK)
        self.sec.update(secenekler or {})
        self.mut = frozenset(mut)
        self.kayitli = {kod: bos_girdi(k) for kod, k in KARTLAR.items()}
        if "cam4-bolen-130" in self.mut:
            self.kayitli["cam/130-1s1c-h182-kabin"]["adimlar"]["bolme"]["bolen"] = 130
        if "mika9-bolen-150" in self.mut:
            self.kayitli["mika/150-1s1c-h182-kabin"]["adimlar"]["bolme"]["bolen"] = 150
        if "yan-panel-oran-20" in self.mut:
            self.kayitli["mika/80-lik-yan-panel"]["adimlar"]["yuzde_ekle"]["oran"] = 20
        self.calisma = None
        self.yedek = None    # yeniden-baslat-kayip mutasyonu için bir önceki Kaydet

    # -- yardımcılar
    def _g(self, kod):
        if self.calisma is None:
            raise SenaryoHatasi("pencere açık değil")
        if kod not in self.calisma:
            raise SenaryoHatasi(f"bilinmeyen kart {kod}")
        return self.calisma[kod]

    def _satir(self, g, kimlik):
        for r in g["satirlar"]:
            if r["kimlik"] == kimlik:
                return r
        raise SenaryoHatasi(f"satır yok: {kimlik}")

    @staticmethod
    def _isaretle(g, yol):
        if yol not in g["_kullanici"]:
            g["_kullanici"].append(yol)

    def _baglam(self, kaynak, kart):
        if kart["tur"] != "matris" or kart["sekme"] != "liste-1":
            return None
        b = kaynak["liste-1/fark-satirlari"]["satirlar"]["b1"]["degerler"][0]
        return {"parlak": b, "_m1_r1c3": kaynak["liste-1/seri-2-sabit-2-acilir"]["fark"].get("r1c3")}

    def _kaydet(self):
        self.yedek = self.kayitli
        self.kayitli = copy.deepcopy(self.calisma)
        if "kaydet-yuvarla-girdi" in self.mut:
            for g in self.kayitli.values():
                for r in g.get("satirlar", []) if isinstance(g.get("satirlar"), list) else []:
                    for k in ("miktar", "fiyat") + GRAMAJ_SAYI_ALANLARI:
                        if isinstance(r.get(k), float):
                            r[k] = kurus(r[k])
                for alan in ("taban", "fark"):
                    for k, v in g.get(alan, {}).items():
                        g[alan][k] = kurus(v) if isinstance(v, float) else v

    # -- adımlar (README §5)
    def uygula(self, a):
        islem = a["islem"]
        if islem == "ac":
            if self.calisma is not None:
                raise SenaryoHatasi("pencere zaten açık")
            self.calisma = copy.deepcopy(self.kayitli)
            return {"durum": "tamam"}
        if islem == "kaydet":
            self._g(next(iter(KARTLAR)))
            self._kaydet()
            return {"durum": "tamam"}
        if islem == "cik":
            self._g(next(iter(KARTLAR)))
            degisti = self.calisma != self.kayitli
            soru = degisti and "cik-soru-yok" not in self.mut
            if degisti:
                yanit = a.get("yanit")
                if soru and yanit not in ("kaydet", "kaydetme"):
                    if not self.mut:
                        raise SenaryoHatasi("değişiklik var; 'yanit' (kaydet / kaydetme) gerekli")
                    yanit = "kaydetme"   # beklenmeyen soru: uyarlayıcı "Kaydetmeden Çık" der ve soru: true bildirir (README §6.3)
                if soru and (yanit == "kaydet" or "cik-kaydetmeden-kaydeder" in self.mut):
                    self._kaydet()
            self.calisma = None
            return {"durum": "tamam", "soru": soru}
        if islem == "yeniden_ac":
            self._g(next(iter(KARTLAR)))
            if self.calisma != self.kayitli and not self.mut:
                raise SenaryoHatasi("yeniden_ac kaydedilmemiş değişiklikle kullanılmaz (önce kaydet ya da cik)")
            self.calisma = copy.deepcopy(self.kayitli)
            return {"durum": "tamam"}
        if islem == "yeniden_baslat":
            self.calisma = None
            if "yeniden-baslat-kayip" in self.mut and self.yedek is not None:
                self.kayitli = self.yedek
            return {"durum": "tamam"}
        if islem == "oku":
            kaynak = self.calisma if self.calisma is not None else self.kayitli
            out = {}
            for kod in a["kartlar"]:
                if kod not in KARTLAR:
                    raise SenaryoHatasi(f"bilinmeyen kart {kod}")
                out[kod] = goruntu(KARTLAR[kod], kaynak[kod], self.mut, self._baglam(kaynak, KARTLAR[kod]))
            return {"durum": "tamam", "kartlar": out}
        if islem == "sablon_oku":
            return {"durum": "tamam", "sablon": sablon_normal(self.mut)}

        kod = a["kart"]
        kart, g = KARTLAR.get(kod), self._g(kod)
        if islem == "satir_yaz":
            r = self._satir(g, a["satir"])
            for alan, v in a["alanlar"].items():
                izinli = ("ad", "birim", "miktar", "fiyat") if kart["tur"] == "zincir" else ("parca", "cins") + GRAMAJ_SAYI_ALANLARI
                if alan not in izinli or (alan == "giden_kg" and not r["elle"]):
                    raise SenaryoHatasi(f"{kod} {a['satir']}: '{alan}' yazılamaz")
                r[alan] = v
                if alan in ("ad", "birim", "parca", "cins"):
                    self._isaretle(g, f"satirlar/{r['kimlik']}/{alan}")
                if alan == "fiyat" and "ortak-malzeme-fiyati" in self.mut:
                    for diger in kartlar("zincir", kart["sekme"]):
                        for r2 in self.calisma[diger["kod"]]["satirlar"]:
                            if _ad_anahtari(r2["ad"]) == _ad_anahtari(r["ad"]):
                                r2["fiyat"] = v
            return {"durum": "tamam"}
        if islem == "satir_ekle":
            if kart["tur"] not in ("zincir", "gramaj"):
                raise SenaryoHatasi(f"{kod}: satır eklenmez (README AÇIK A13 / KARAR K3)")
            if any(r["kimlik"] == a["satir"] for r in g["satirlar"]):
                raise SenaryoHatasi(f"{kod}: {a['satir']} zaten var")
            alanlar = a.get("alanlar", {})
            if kart["tur"] == "zincir":
                r = {"kimlik": a["satir"], "ad": alanlar.get("ad", ""), "birim": alanlar.get("birim", ""), "miktar": alanlar.get("miktar"),
                     "fiyat": alanlar.get("fiyat"), "eklenen": True}
                adlar = ("ad", "birim")
            else:
                r = {"kimlik": a["satir"], "parca": alanlar.get("parca", ""), "cins": alanlar.get("cins", ""), "elle": False, "eklenen": True,
                     **{k: alanlar.get(k) for k in GRAMAJ_SAYI_ALANLARI if k != "giden_kg"}, "giden_kg": None}
                if "giden_kg" in alanlar:
                    raise SenaryoHatasi("eklenen gramaj satırında Giden Kğ hesaplanır, yazılmaz")
                adlar = ("parca", "cins")
            g["satirlar"].append(r)
            for alan in adlar:
                if alan in alanlar:
                    self._isaretle(g, f"satirlar/{r['kimlik']}/{alan}")
            return {"durum": "tamam"}
        if islem == "satir_sil":
            r = self._satir(g, a["satir"])
            g["satirlar"].remove(r)
            g["silinen"].append(r)
            g["_kullanici"] = [y for y in g["_kullanici"] if not y.startswith(f"satirlar/{r['kimlik']}/")]
            return {"durum": "tamam"}
        if islem == "ad_degistir":
            hedef, ad = a["hedef"], a["ad"]
            if hedef == "kart":
                g["ad"] = ad
                self._isaretle(g, "ad")
            elif hedef == "satir":
                if kart["tur"] == "bilgi":
                    g["satirlar"][a["kimlik"]]["ad"] = ad
                    self._isaretle(g, f"satirlar/{a['kimlik']}/ad")
                else:
                    alan = "ad" if kart["tur"] == "zincir" else "parca"
                    self._satir(g, a["kimlik"])[alan] = ad
                    self._isaretle(g, f"satirlar/{a['kimlik']}/{alan}")
            elif hedef == "adim":
                g["adimlar"][a["kimlik"]]["etiket"] = ad
                self._isaretle(g, f"adimlar/{a['kimlik']}/etiket")
            elif hedef in ("sutun", "olcu"):
                alan = "sutunlar" if hedef == "sutun" else "olculer"
                if a["kimlik"] not in g[alan]:
                    raise SenaryoHatasi(f"{kod}: {hedef} {a['kimlik']} yok")
                g[alan][a["kimlik"]] = ad
                self._isaretle(g, f"{alan}/{a['kimlik']}")
            else:
                raise SenaryoHatasi(f"bilinmeyen ad hedefi {hedef}")
            return {"durum": "tamam"}
        if islem == "oran_degistir":
            if a["adim"] not in ("yuzde", "yuzde_ekle") or "oran" not in g["adimlar"].get(a["adim"], {}):
                raise SenaryoHatasi(f"{kod}: {a['adim']} oran adımı değil")
            hedefler = [kod] + ([k["kod"] for k in kartlar("zincir", kart["sekme"]) if k["kod"] != kod] if "oran-ortak" in self.mut else [])
            for h in hedefler:
                self.calisma[h]["adimlar"][a["adim"]]["oran"] = a["oran"]
                if "oran-etiket-bagli" in self.mut:
                    self.calisma[h]["adimlar"][a["adim"]]["etiket"] = f"%{a['oran']}"
            return {"durum": "tamam"}
        if islem == "bolen_degistir":
            if "bolme" not in g.get("adimlar", {}):
                raise SenaryoHatasi(f"{kod}: bölme adımı yok")
            k = a["bolen"]
            if (k is None or k == 0) and self.sec[KARAR_BOLEN_0] == "ret" and "bolen-sifir-sonsuz" not in self.mut:
                return {"durum": "ret"}
            hedefler = [kod] + ([x["kod"] for x in kartlar("zincir", kart["sekme"]) if x["kod"] != kod and "bolme" in self.calisma[x["kod"]]["adimlar"]]
                                if "bolen-ortak" in self.mut else [])
            for h in hedefler:
                self.calisma[h]["adimlar"]["bolme"]["bolen"] = k
            return {"durum": "tamam"}
        if islem == "elle_yaz":
            ad = g["adimlar"].get(a["adim"])
            if ad is None or "deger" not in ad:
                raise SenaryoHatasi(f"{kod}: {a['adim']} elle hücre değil")
            ad["deger"] = a["deger"]
            return {"durum": "tamam"}
        if islem in ("taban_yaz", "fark_yaz"):
            h = kart["hucreler"].get(a["hucre"]) if kart["tur"] == "matris" else None
            istenen = "taban" if islem == "taban_yaz" else "formul"
            if h is None or h["tur"] != istenen:
                raise SenaryoHatasi(f"{kod} {a['hucre']}: {istenen} hücresi değil")
            g["taban" if islem == "taban_yaz" else "fark"][a["hucre"]] = a["deger"]
            return {"durum": "tamam"}
        if islem == "bilgi_yaz":
            if kart["tur"] != "bilgi":
                raise SenaryoHatasi(f"{kod}: bilgi kartı değil")
            g["satirlar"][a["satir"]]["degerler"][a["sira"]] = a["deger"]
            return {"durum": "tamam"}
        raise SenaryoHatasi(f"bilinmeyen işlem {islem}")

    def kullanici_adlari(self, kod):
        kaynak = self.calisma if self.calisma is not None else self.kayitli
        return list(kaynak[kod]["_kullanici"])


def beklenen_hesapla(adimlar, secenekler=None, mut=frozenset()):
    """Senaryo adımlarını modelde yürütür; her adımın beklenen sonucunu verir (oku: kart görüntüsü + kullanıcı adları + ilk okuma)."""
    m = Model(secenekler, mut)
    ilk = {}
    out = []
    for i, a in enumerate(adimlar):
        r = m.uygula(a)
        if a["islem"] == "oku":
            kartlar_ = {}
            for kod, gor in r["kartlar"].items():
                kartlar_[kod] = beklenen_kart(kod, gor, m.kullanici_adlari(kod), ilk.get(kod))
                ilk.setdefault(kod, i)
            r = {"durum": "tamam", "kartlar": kartlar_}
        out.append(r)
    return out


def beklenen_kart(kod, gor, kullanici, ilk_oku):
    """Kabul dosyasına yazılan beklenen kart: şablonun varsayılan adları ÇIKARILIR (karşılaştırılmaz, V16); kullanıcının ✎ ile yazdığı
    adlar kalır (tam). Kimlik kümeleri ayrı tutulur. ilk_oku: bu karttaki ilk okuma adımı (ilişkisel 'ad kendiliğinden değişmez')."""
    kart = KARTLAR[kod]
    kullanici = sorted(kullanici)
    satir_elle = {s["kimlik"]: s["elle_kg"] for s in kart.get("satirlar", []) if isinstance(s, dict) and "elle_kg" in s}
    sade = {}
    for yol, v in _duzle(gor):
        if _sinif(kart, yol, satir_elle) == "ad" and "/".join(yol) not in kullanici:
            continue
        d = sade
        for k in yol[:-1]:
            d = d.setdefault(k, {})
        d[yol[-1]] = v
    kumeler = {"/".join(ky): _kume_anahtarlari(kart, ky, gor) for ky in _KUMELER[kart["tur"]]}
    return {"goruntu": sade, "kumeler": kumeler, "kullanici": kullanici, "ilk_oku": ilk_oku}


def program_gibi(adimlar, secenekler=None, mut=frozenset()):
    """Kendi testi için: modeli 'program' gibi yanıtlatır (uyarlayıcı yanıtı biçiminde). Programın yerine GEÇMEZ."""
    m = Model(secenekler, mut)
    out = []
    for a in adimlar:
        r = m.uygula(a)
        out.append(r)
    return out


# ---------------------------------------------------------------------------------------------------------------------------------
# 3. KARŞILAŞTIRMA (README §7)
# ---------------------------------------------------------------------------------------------------------------------------------
YASAK_AD = re.compile(r"(?i)\bbel+a\b|\b(?:19|20)\d{2}\b")


def _sinif(kart, yol, satir_elle):
    """Bir görüntü yolunun karşılaştırma sınıfı: 'tam' (girdi, kesin eşit), 'yakin' (hesap, tolerans), 'ad' (metin)."""
    t = kart["tur"]
    if yol == ("ad",):
        return "ad"
    n = len(yol)
    if t == "zincir":
        if yol[0] == "satirlar" and n == 3:
            return {"ad": "ad", "birim": "ad", "miktar": "tam", "fiyat": "tam", "tutar": "yakin"}.get(yol[2])
        if yol[0] == "adimlar" and n == 3:
            if yol[2] == "etiket":
                return "ad"
            if yol[2] in ("oran", "bolen", "hata"):
                return "tam"
            if yol[2] == "deger":
                return "tam" if yol[1] == "cm_elle" else "yakin"
            return None
        return "yakin" if yol == ("sonuc",) else None
    if t == "gramaj":
        if yol[0] == "toplam" and n == 2:
            return "yakin"
        if yol[0] != "satirlar" or n != 3:
            return None
        alan = yol[2]
        if alan in ("parca", "cins"):
            return "ad"
        if alan == "giden_kg":
            return "tam" if satir_elle.get(yol[1]) else "yakin"
        if alan == "satir_top":
            return "yakin"
        return "tam" if alan in GRAMAJ_SAYI_ALANLARI else None
    if t == "matris":
        if yol[0] in ("sutunlar", "olculer") and n == 2:
            return "ad"
        if yol[0] == "hucreler" and n == 3:
            return {"deger": "yakin", "taban": "tam", "fark": "tam"}.get(yol[2])
        return None
    if yol[0] == "satirlar" and n == 3 and yol[2] == "ad":
        return "ad"
    return "tam" if yol[0] == "satirlar" and n == 4 and yol[2] == "degerler" else None


def _duzle(d, onek=()):
    if isinstance(d, dict):
        for k, v in d.items():
            yield from _duzle(v, onek + (str(k),))
    elif isinstance(d, list):
        for i, v in enumerate(d):
            yield from _duzle(v, onek + (str(i),))
    else:
        yield onek, d


def _al(d, yol):
    for k in yol:
        if isinstance(d, dict) and k in d:
            d = d[k]
        elif isinstance(d, list) and k.isdigit() and int(k) < len(d):
            d = d[int(k)]
        else:
            return False, None
    return True, d


def _sayi_mi(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _tam_esit(b, p):
    if b is None:
        return p is None
    if isinstance(b, str):
        return isinstance(p, str) and p == b
    return _sayi_mi(p) and math.isfinite(p) and float(p) == float(b)


def _yakin(b, p, ayar):
    if b is None:
        return p is None
    if p is None:
        return bool(ayar.get("bos_sifir_sayilir")) and b == 0
    if not _sayi_mi(p) or not math.isfinite(p):
        return False
    tol = max(TOL_GORELI * max(abs(b), abs(p)), TOL_MUTLAK, ayar.get("gosterim_tol", 0.0))
    return abs(p - b) <= tol


def _kume_anahtarlari(kart, tur_yolu, d):
    var, v = _al(d, tur_yolu)
    if not var or not isinstance(v, dict):
        return None
    anahtarlar = list(v.keys())
    if kart["tur"] in ("zincir", "gramaj") and tur_yolu == ("satirlar",):
        # Programın şablonunda adsız BOŞ satır varsa (Excel'in 9./23. satırı gibi) uyarlayıcı ona "bos<n>" kimliği verir; boş kaldıkça yok sayılır (V3).
        anahtarlar = [k for k in anahtarlar if not (k.startswith("bos") and all(
            v[k].get(a) is None for a in (("miktar", "fiyat") if kart["tur"] == "zincir" else GRAMAJ_SAYI_ALANLARI)))]
    return sorted(anahtarlar)


_KUMELER = {"zincir": [("satirlar",), ("adimlar",)], "gramaj": [("satirlar",)], "matris": [("hucreler",), ("olculer",), ("sutunlar",)],
            "bilgi": [("satirlar",)]}


def kart_karsilastir(kod, bek, prog, prog_ilk, ayar):
    """bek: {goruntu, kullanici, ilk_oku}; prog: programın görüntüsü; prog_ilk: programın aynı karttaki ilk okuması (ilişkisel ad denetimi).
    Dönüş: (denetim sayısı, [fark iletileri])."""
    kart = KARTLAR[kod]
    gor = bek["goruntu"]
    kullanici = set(bek["kullanici"])
    satir_elle = {s["kimlik"]: s["elle_kg"] for s in kart.get("satirlar", []) if isinstance(s, dict) and "elle_kg" in s}
    n, farklar = 0, []
    if not isinstance(prog, dict):
        return 1, [f"{kod}: kart görüntüsü okunamadı ({type(prog).__name__})"]
    for ky in _KUMELER[kart["tur"]]:
        n += 1
        b, p = bek["kumeler"]["/".join(ky)], _kume_anahtarlari(kart, ky, prog)
        if b != p:
            farklar.append(f"{kod} {'/'.join(ky)}: kimlik kümesi beklenen {b} program {p}")
    # 'Ad kendiliğinden değişmez' (V9, V16): kullanıcının yazmadığı her ad/etiket, programın bu karttaki İLK okumasındaki değeriyle aynı kalır.
    if bek.get("ilk_oku") is not None and isinstance(prog_ilk, dict):
        for yol, pv0 in _duzle(prog_ilk):
            ys = "/".join(yol)
            if _sinif(kart, yol, satir_elle) != "ad" or ys in kullanici:
                continue
            var, pv = _al(prog, yol)
            if var:
                n += 1
                if pv != pv0:
                    farklar.append(f"{kod} {ys}: ad kendiliğinden değişti {pv0!r} → {pv!r}")
    for yol, deger in _duzle(gor):
        sinif = _sinif(kart, yol, satir_elle)
        ys = "/".join(yol)
        var, pv = _al(prog, yol)
        if sinif == "ad":
            n += 1
            if not _tam_esit(deger, pv):
                farklar.append(f"{kod} {ys}: ad beklenen {deger!r} program {pv!r} (✎ ile yazılan ad aynen kalmalı)")
            continue
        if sinif is None:
            n += 1
            farklar.append(f"{kod} {ys}: kâhinin tanımadığı yol (kâhin hatası)")
            continue
        n += 1
        if sinif == "tam":
            if not _tam_esit(deger, pv):
                farklar.append(f"{kod} {ys}: girdi beklenen {deger!r} program {pv!r}{'' if var else ' (yok)'}")
        elif not _yakin(deger, pv, ayar):
            farklar.append(f"{kod} {ys}: hesap beklenen {deger!r} program {pv!r}{'' if var else ' (yok)'}")
    return n, farklar


def sablon_karsilastir(bek, prog):
    n, farklar = 0, []
    if not isinstance(prog, dict):
        return 1, ["şablon okunamadı"]
    kume_sonlari = {"kartlar", "satirlar", "sutunlar", "elle", "elle_kg"}
    n += 1
    if sorted(bek["kartlar"]) != sorted((prog.get("kartlar") or {}).keys()):
        farklar.append(f"şablon kart kümesi: beklenen {sorted(bek['kartlar'])} program {sorted((prog.get('kartlar') or {}).keys())}")
    n += 1
    if sorted(bek["sekmeler"]) != sorted((prog.get("sekmeler") or {}).keys()):
        farklar.append(f"şablon sekme kümesi: beklenen {sorted(bek['sekmeler'])} program {sorted((prog.get('sekmeler') or {}).keys())}")
    for bolum in ("sekmeler", "kartlar"):
        for kod, v in bek[bolum].items():
            pk = (prog.get(bolum) or {}).get(kod)
            if not isinstance(pk, dict):
                continue
            for alan, bv in v.items():
                ys = f"{bolum}/{kod}/{alan}"
                pv = pk.get(alan)
                if alan == "ad":
                    n += 1
                    if not isinstance(pv, str) or YASAK_AD.search(pv):
                        farklar.append(f"{ys}: ad {pv!r} (marka / yıl geçmez, metin olmalı)")
                    continue
                if alan in kume_sonlari and isinstance(bv, list):
                    n += 1
                    pl = [x for x in (pv if isinstance(pv, list) else []) if not (alan == "satirlar" and isinstance(x, str) and x.startswith("bos"))]
                    if sorted(bv) != sorted(pl) or not isinstance(pv, list):
                        farklar.append(f"{ys}: küme beklenen {sorted(bv)} program {pv!r}")
                elif isinstance(bv, dict):
                    pd = pv if isinstance(pv, dict) else {}
                    n += 1
                    if sorted(bv) != sorted(pd):
                        farklar.append(f"{ys}: anahtar kümesi beklenen {sorted(bv)} program {sorted(pd)}")
                    for k2, v2 in bv.items():
                        n += 1
                        if pd.get(k2) != v2:
                            farklar.append(f"{ys}/{k2}: beklenen {v2!r} program {pd.get(k2)!r}")
                else:
                    n += 1
                    if bv != pv:
                        farklar.append(f"{ys}: beklenen {bv!r} program {pv!r}")
    return n, farklar


def senaryo_karsilastir(sen, bek_adimlar, prog_adimlar, ayar):
    """Bir senaryonun bütün adımları: durum (ders 3: ret başarı değildir), Çık sorusu, okunan kartlar, şablon."""
    n, farklar = 0, []
    if not isinstance(prog_adimlar, list) or len(prog_adimlar) != len(sen["adimlar"]):
        return 1, [f"adım sayısı: beklenen {len(sen['adimlar'])} program {len(prog_adimlar) if isinstance(prog_adimlar, list) else 'yok'}"]
    for i, (a, b, p) in enumerate(zip(sen["adimlar"], bek_adimlar, prog_adimlar)):
        etiket = f"adım {i} {a['islem']}"
        n += 1
        pd = p.get("durum") if isinstance(p, dict) else None
        if pd != b["durum"]:
            neden = (p.get("neden") if isinstance(p, dict) else None) or ""
            farklar.append(f"{etiket}: durum beklenen {b['durum']} program {pd} {neden}".rstrip())
            continue
        if "soru" in b:
            n += 1
            if p.get("soru") is not b["soru"]:
                farklar.append(f"{etiket}: Çık sorusu beklenen {'var' if b['soru'] else 'yok'} program {p.get('soru')!r}")
        if a["islem"] == "oku":
            pk = p.get("kartlar") if isinstance(p.get("kartlar"), dict) else {}
            for kod, bk in b["kartlar"].items():
                ilk = None
                if bk.get("ilk_oku") is not None:
                    pi = prog_adimlar[bk["ilk_oku"]]
                    ilk = (pi.get("kartlar") or {}).get(kod) if isinstance(pi, dict) else None
                k_n, k_f = kart_karsilastir(kod, bk, pk.get(kod), ilk, ayar)
                n += k_n
                farklar += [f"{etiket} {x}" for x in k_f]
        elif a["islem"] == "sablon_oku":
            k_n, k_f = sablon_karsilastir(b["sablon"], p.get("sablon"))
            n += k_n
            farklar += [f"{etiket} {x}" for x in k_f]
    return n, farklar


def secenek_anahtari(sen, beyan):
    """Senaryonun beklenen kümesi: karar gerektirmiyorsa '*'; gerektiriyorsa programın beyan ettiği seçenek (yoksa None → koşulmaz)."""
    karar = sen.get("karar")
    if not karar:
        return "*"
    v = (beyan or {}).get(karar)
    return v if v in SECENEKLER[karar] else None
