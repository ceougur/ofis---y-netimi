#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Elle doğrulanabilir küçük senaryolar (kâhin; kodu görmeden, kural kitabından).

Her senaryo iş olaylarıyla yazılır (API'den bağımsız: "satış faturası kaydet", "tahsilat al", "devir yap") ve "elle" bölümünde
ELLE HESAPLANMIŞ beklenen sayılar taşır (yorum satırlarında hesabın kendisi). Tutarlar kuruş (100000 = 1.000,00 TL).
uret_beklenen.py bunları senaryolar/<ad>.json (kendi kendine yeten, tanımlar dahil) ve senaryolar/beklenen/<ad>.json (modelin tam
çıktısı, her dal için) olarak yazar; test_model.py elle değerleri ve dosyaların güncelliğini denetler.

Elle yol biçimi: "rapor_adı/anahtar/anahtar…" (raporlar altında) ya da "redler" / "acilis_olabilir" (kök). Anahtarlar: bilanço kalemi
"I.A", mizan satırı "120|C1" (hesap|cari), gelir tablosu kalemi "A", "DNK" …
"""

TANIM = {
    "cariler": {"C1": {"ad": "Ahmet Yılmaz", "tur": "musteri"}, "C2": {"ad": "Ahmet Yılmaz", "tur": "musteri"},
                "C3": {"ad": "Kaya Market", "tur": "musteri"}, "T1": {"ad": "Demir Ltd", "tur": "tedarikci"},
                "T2": {"ad": "Ofis Kira", "tur": "tedarikci"}, "D1": {"ad": "Ali Veli", "tur": "diger"}},
    "bankalar": {"B1": {"ad": "Ziraat Vadesiz"}, "B2": {"ad": "İş Bankası Ticari"}},
    "poslar": {"POS1": {"ad": "Ziraat POS", "banka": "B1"}},
    "kartlar": {"KK1": {"ad": "Şirket Kartı"}},
    "krediler": {"KR1": {"ad": "Ticari Kredi", "banka": "B1"}},
    "urunler": {"U1": {"ad": "Kalem", "birim": "Adet", "alis_fiyati": 1000, "kdv_orani": 20},
                "U2": {"ad": "Defter", "birim": "Adet", "alis_fiyati": 2500, "kdv_orani": 20},
                "U3": {"ad": "Silgi", "birim": "Adet"}},
}


def o(tur, tarih=None, **kw):
    d = {"tur": tur}
    if tarih:
        d["tarih"] = tarih
    d.update(kw)
    return d


def R(ad, rapor, **kw):
    return dict({"tur": "rapor", "ad": ad, "rapor": rapor}, **kw)


def GT(ad, bas, son, **kw):
    return R(ad, "gelir_tablosu", bas=bas, son=son, **kw)


def BIL(ad, tarih, **kw):
    return R(ad, "bilanco", tarih=tarih, **kw)


def MZ(ad, bas, son, **kw):
    return R(ad, "mizan", bas=bas, son=son, **kw)


SENARYOLAR = []


def S(ad, kapsam, olaylar, elle, dallar=(), aciklama="", defter_turu="bilanco"):
    SENARYOLAR.append({"ad": ad, "aciklama": aciklama, "kapsam": list(kapsam), "defter_turu": defter_turu, "olaylar": olaylar,
                       "dallar": list(dallar), "elle": elle})


# ------------------------------------------------------------------------------------------------ S01
S("s01-satis-tahsilat-nakit", ["M-01", "F-01", "T-01", "§4", "§7.4"], [
    o("kasa_acilis", "2026-01-02", tutar=100000),
    o("satis_faturasi", "2026-03-10", id="F1", cari="C1", M=100000, K=20000),
    o("tahsilat", "2026-03-20", cari="C1", yol="nakit", tutar=120000, fatura="F1"),
    MZ("mz", "2026-01-01", "2026-12-31"), GT("gt", "2026-01-01", "2026-12-31"), BIL("bil", "2026-03-31"),
], {"A": {
    # 100: 100000 + 120000; 120|C1: 120000 borç, 120000 alacak; 391: −20000; 600: −100000; 519: −100000
    "mz/satirlar/100/bakiye": 220000, "mz/satirlar/120|C1/borc": 120000, "mz/satirlar/120|C1/alacak": 120000,
    "mz/satirlar/120|C1/bakiye": 0, "mz/satirlar/391/bakiye": -20000, "mz/satirlar/600/bakiye": -100000,
    "mz/satirlar/519/bakiye": -100000, "mz/toplam/borc": 340000, "mz/toplam/alacak": 340000,
    "gt/kalemler/A": 100000, "gt/kalemler/DNK": 100000, "gt/tahmini": False,
    "bil/aktif/I.A": 220000, "bil/pasif/III.I": 20000, "bil/pasif/V.G": 100000, "bil/pasif/V.F": 100000,
    "bil/aktif_toplam": 220000, "bil/pasif_toplam": 220000, "bil/kesin_degil": ["TAMAMLANMAMIS_ACILIS"],
}}, aciklama="Kasa açılışı 519'a; satış ve nakit tahsilat; G ≠ 0 → Kesin Değil.")

# ------------------------------------------------------------------------------------------------ S02
S("s02-ihracat-tevkifat", ["F-02", "F-03", "KG-24"], [
    o("satis_faturasi", "2026-04-05", id="F1", cari="C1", M=500000, K=0, ihracat=True),
    o("satis_faturasi", "2026-04-06", id="F2", cari="C3", M=100000, K=20000, T=10000),
    GT("gt", "2026-01-01", "2026-12-31"), BIL("bil", "2026-04-30"), MZ("mz", "2026-01-01", "2026-12-31"),
], {"A": {
    # F2: CH = M + K − T = 110000; 391 = K − T = 10000
    "gt/kalemler/A": 600000, "gt/hesaplar/601": 500000, "gt/hesaplar/600": 100000, "gt/kalemler/DNK": 600000,
    "mz/satirlar/120|C3/bakiye": 110000, "mz/satirlar/391/bakiye": -10000, "mz/satirlar/120|C1/bakiye": 500000,
    "bil/aktif/I.C": 610000, "bil/pasif/III.I": 10000, "bil/pasif/V.F": 600000, "bil/kesin_degil": [],
}}, aciklama="İhracat 601; tevkifatlı satışta 391 = K − T.")

# ------------------------------------------------------------------------------------------------ S03
S("s03-alis-stok-tevkifat-havale", ["M-04", "F-05", "S-01", "T-05", "V-01", "V-02"], [
    o("banka_acilis", "2026-01-01", banka="B1", tutar=1000000),
    o("alis_faturasi", "2026-02-10", id="A1", cari="T1", fatura_turu="stok", M=200000, K=40000, T=20000, kalemler=[{"urun": "U1", "miktar": 20}]),
    o("odeme", "2026-02-20", cari="T1", yol="havale", banka="B1", tutar=220000, fatura="A1"),
    o("kdv_mahsup", ay="2026-02"),
    o("vergi_odeme", "2026-03-26", yol="havale", banka="B1", tutar=20000),
    BIL("bil", "2026-03-31"), MZ("mz", "2026-01-01", "2026-03-31"), GT("gt", "2026-01-01", "2026-03-31"),
], {"A": {
    # 191 tevkifatlıda TAMAMI (40000); CH = 200000 + 40000 − 20000 = 220000; 360 = T = 20000 → ödendi
    # Şubat mahsubu: H 0, İ 40000, D 0 → B 190 40000 / A 191 40000
    "mz/satirlar/102.B1/bakiye": 760000, "mz/satirlar/153/bakiye": 200000, "mz/satirlar/190/bakiye": 40000,
    "mz/satirlar/191/borc": 40000, "mz/satirlar/191/alacak": 40000, "mz/satirlar/360/borc": 20000, "mz/satirlar/360/alacak": 20000,
    "mz/satirlar/320|T1/bakiye": 0,
    # tahmini değerleme: 20 adet × 10000 = 200000 → satışların maliyeti 0
    "bil/aktif/I.A": 760000, "bil/aktif/I.E": 200000, "bil/aktif/I.H": 40000, "bil/pasif/V.G": 1000000,
    "bil/kesin_degil": ["SATISLARIN_MALIYETI_TAHMINI", "TAMAMLANMAMIS_ACILIS"], "gt/kalemler/D": 0, "gt/kalemler/DNK": 0,
}}, aciklama="Tevkifatlı stoklu alış; havale ödeme; KDV mahsubu net ≥ 0 (190).")

# ------------------------------------------------------------------------------------------------ S04
S("s04-gider-yansitma-stopaj-devir", ["F-06", "K-02", "N-02", "N-03", "N-04", "N-06", "N-07", "§7.1"], [
    o("kasa_acilis", "2026-01-01", tutar=5000000),
    o("alis_faturasi", "2026-05-02", id="G1", cari="T2", fatura_turu="gider", gider_turu="genel", M=1000000, K=0, S=200000),
    o("alis_faturasi", "2026-05-03", id="G2", cari="T1", fatura_turu="gider", gider_turu="satis", M=100000, K=20000),
    o("alis_faturasi", "2026-05-04", id="G3", cari="T1", fatura_turu="gider", gider_turu="finansman", M=50000, K=0),
    o("alis_faturasi", "2026-05-05", id="G4", cari="T1", fatura_turu="gider", gider_turu="demirbas", M=300000, K=60000),
    o("kasa_cikis", "2026-05-06", tutar=30000),
    GT("gt", "2026-01-01", "2026-12-31"), BIL("bil", "2026-05-31"), BIL("bil0630", "2026-06-30"),
    o("devir", K="2026-12-31", ad="devir"),
    MZ("mz_arsiv", "2026-01-01", "2026-12-31", dosya="arsiv"), GT("gt_arsiv", "2026-01-01", "2026-12-31", dosya="arsiv"),
    BIL("bil_yeni", "2027-01-01"),
    o("kdv_mahsup", ay="2027-01"),
], {"A": {
    # E = 770 1000000 + 770.90 30000 + 760 100000 = 1130000; H = 780 50000; DNK = −1180000
    "gt/kalemler/E": 1130000, "gt/kalemler/H": 50000, "gt/kalemler/DNK": -1180000, "gt/hesaplar/770.90": 30000,
    "bil/aktif/I.A": 4970000, "bil/aktif/I.H": 80000, "bil/aktif/II.D": 300000, "bil/pasif/III.B": 1330000,
    "bil/pasif/III.F": 200000, "bil/pasif/V.G": 5000000, "bil/pasif/V.F": -1180000, "bil/aktif_toplam": 5350000,
    # kapanış: N-02 631 100000, 632 1030000, 660 50000; zarar 591'e
    "mz_arsiv/satirlar/631/borc": 100000, "mz_arsiv/satirlar/631/alacak": 100000, "mz_arsiv/satirlar/632/borc": 1030000,
    "mz_arsiv/satirlar/761/borc": 100000, "mz_arsiv/satirlar/761/alacak": 100000, "mz_arsiv/satirlar/770/bakiye": 0,
    "mz_arsiv/satirlar/591/bakiye": 1180000, "gt_arsiv/kalemler/DNK": -1180000,
    "devir/yeni_acilis/100": 4970000, "devir/yeni_acilis/191": 80000, "devir/yeni_acilis/255": 300000,
    "devir/yeni_acilis/320|T1": -530000, "devir/yeni_acilis/320|T2": -800000, "devir/yeni_acilis/360": -200000,
    "devir/yeni_acilis/519": -5000000, "devir/yeni_acilis/591": 1180000, "devir/kapanis/sonuc": -1180000,
    "bil_yeni/pasif/V.F": -1180000, "bil_yeni/donem_net_kari": 0,
    # EK-1 M8-4 + EK-2 34 (bakım 2): dönemi önceki yılda kalan (mahsup edilmemiş) 191 brüt görünür + Kesin Değil "Önceki Yıl KDV Mahsubu
    # Yapılmamış" ay listesiyle (G2 / G4 Mayıs faturaları → 2026-05)
    "bil_yeni/kesin_degil": ["ONCEKI_YIL_KDV_MAHSUBU_YAPILMAMIS:2026-05", "TAMAMLANMAMIS_ACILIS"],
    # EK-2 34: t'nin yılında biten mahsupsuz ay yalnız bilgi uyarısı (Kesin Değil değil): 30.06'da Mayıs bitti
    "bil0630/bilgi": ["KDV_MAHSUBU_YAPILMAMIS:2026-05"], "bil/bilgi": [],
    # Aralık'ta mahsup edilmemiş 191 (80000) devirle etiketsiz gelir; Ocak mahsubunun İ'sine girmez (G4: yalnız Devri Yenile ile)
    "redler": ["KDV_MAHSUP_BOS"],
}}, aciklama="Gider türleri 760/770/780/255, kira stopajı; 7/A yansıtma kapanışta; zarar 591.")

# ------------------------------------------------------------------------------------------------ S05
S("s05-iadeler", ["F-07", "F-08", "KG-8", "V-01", "§5"], [
    o("alis_faturasi", "2026-03-01", id="A1", cari="T1", fatura_turu="stok", M=100000, K=20000, kalemler=[{"urun": "U1", "miktar": 10}]),
    o("satis_faturasi", "2026-03-05", id="F1", cari="C1", M=150000, K=30000, kalemler=[{"urun": "U1", "miktar": 6}]),
    o("satis_iade_faturasi", "2026-03-08", id="I1", cari="C1", M=50000, K=10000, asil_fatura="F1", kalemler=[{"urun": "U1", "miktar": 2}]),
    o("alis_iade_faturasi", "2026-03-09", id="R1", cari="T1", M=20000, K=4000, asil_fatura="A1", kalemler=[{"urun": "U1", "miktar": 2}]),
    o("kdv_mahsup", ay="2026-03"),
    GT("gt", "2026-03-01", "2026-03-31"), BIL("bil", "2026-03-31"), MZ("mz", "2026-03-01", "2026-03-31"),
], {"A": {
    # H = 30000 + 4000 = 34000; İ = 20000 + 10000 = 30000; net −4000 → 360 4000
    "mz/satirlar/360/bakiye": -4000, "mz/satirlar/191/bakiye": 0, "mz/satirlar/391/bakiye": 0,
    # alış 10 adet 100000 − iade 2 adet 20000 → 8 adet 80000, birim 10000; miktar 10−6+2−2 = 4 → 40000; SMM = 80000 − 40000
    "gt/kalemler/A": 150000, "gt/kalemler/B": 50000, "gt/kalemler/C": 100000, "gt/kalemler/D": 40000, "gt/kalemler/DNK": 60000,
    "bil/aktif/I.C": 120000, "bil/aktif/I.E": 40000, "bil/pasif/III.B": 96000, "bil/pasif/III.F": 4000, "bil/pasif/V.F": 60000,
    "bil/kesin_degil": ["SATISLARIN_MALIYETI_TAHMINI"],
}}, aciklama="Satıştan iade 610/191, alıştan iade 153/391; mahsupta 360.")

# ------------------------------------------------------------------------------------------------ S06
S("s06-esmm-gelen-smm", ["F-10", "F-11", "V-05", "V-06", "§7.5"], [
    o("esmm", "2026-06-01", id="E1", cari="C1", brut=1000000, K=200000, S=200000),
    o("gelen_smm", "2026-06-02", id="S1", cari="T1", brut=300000, K=60000, S=60000),
    GT("gt", "2026-01-01", "2026-12-31"), BIL("bil", "2026-06-30"),
], {"A": {
    # E1: CH = 1000000 − 200000 + 200000 = 1000000; 193 200000; S1: CH = 300000 + 60000 − 60000 = 300000; 360 60000
    "gt/kalemler/A": 1000000, "gt/kalemler/E": 300000, "gt/kalemler/DNK": 700000, "gt/kesin_degil": ["BILGI_AMACLI"],
    "bil/aktif/I.C": 1000000, "bil/aktif/I.H": 260000, "bil/pasif/III.B": 300000, "bil/pasif/III.F": 60000,
    "bil/pasif/III.I": 200000, "bil/pasif/V.F": 700000, "bil/bilgi_amacli": True, "bil/kesin_degil": ["BILGI_AMACLI"],
}}, aciklama="Serbest meslek makbuzu (stopaj 193) ve gelen SMM; Defter Türü Serbest Meslek → Bilgi Amaçlı.",
  defter_turu="serbest_meslek")

# ------------------------------------------------------------------------------------------------ S07
S("s07-duzenle-iptal-sil-kilit", ["F-14", "F-15", "F-12", "R-04", "G-7", "Ç3"], [
    o("satis_faturasi", "2026-07-01", id="F1", cari="C1", M=100000, K=20000),
    o("tahsilat", "2026-07-01", id="P1", cari="C1", yol="nakit", tutar=120000, fatura="F1", fatura_odemesi=True),
    o("satis_faturasi", "2026-07-02", id="F2", cari="C1", M=50000, K=10000),
    o("duzenle", kaynak="F2", degisiklik={"M": 80000, "K": 16000}),
    o("iptal", kaynak="F1"),
    o("satis_faturasi", "2026-07-03", id="F3", cari="C3", M=30000, K=6000),
    o("sil", kaynak="F3"), o("geri_yukle", kaynak="F3"),
    o("satis_faturasi", "2026-07-04", id="F4", cari="C3", M=10000, K=2000),
    o("sil", kaynak="F4"),
    o("donem_kilitle", tarih="2026-07-02"),
    o("duzenle", kaynak="F2", degisiklik={"M": 1}),
    o("borc_yaz", "2026-07-01", id="F5", cari="C1", tutar=100, aciklama="Fark"),   # kilitli tarihe yazım (seri dışı; VUK sıra-tarih karışmasın)
    o("sil", kaynak="F3"),
    MZ("mz", "2026-07-01", "2026-07-31"), GT("gt", "2026-07-01", "2026-07-31"),
], {"A": {
    # F1 iptal → peşin tahsilatı da yok; F2 düzenlendi 80000 + 16000; F3 geri yüklendi sonra (kilitten sonra) silindi; F4 silindi
    "mz/satirlar/120|C1/bakiye": 96000, "mz/satirlar/600/bakiye": -80000, "mz/satirlar/391/bakiye": -16000,
    "mz/toplam/borc": 96000, "gt/kalemler/DNK": 80000,
    "redler": ["KILITLI_DONEM", "KILITLI_DONEM"],
}}, aciklama="Açık dönemde düzenle / iptal / sil / geri yükle maddeyi yeniden türetir; kilitli tarihe yazım 409.")

# ------------------------------------------------------------------------------------------------ S08
S("s08-pos-kg6", ["T-03", "D-01", "D-03", "D-04", "F-07", "KG-6"], [
    o("satis_faturasi", "2026-08-10", id="F1", cari="C1", M=100000, K=0),
    o("tahsilat", "2026-08-10", id="P1", cari="C1", yol="pos", pos="POS1", tutar=100000, komisyon=2500, valor="2026-08-12"),
    o("satis_faturasi", "2026-08-11", id="F2", cari="C3", M=50000, K=0),
    o("tahsilat", "2026-08-11", id="P2", cari="C3", yol="pos", pos="POS1", tutar=50000, komisyon=1000, valor="2026-08-13"),
    o("iptal", kaynak="P2"),
    BIL("bil10", "2026-08-10"), GT("gt10", "2026-08-01", "2026-08-10"), BIL("bil12", "2026-08-12"),
    o("satis_faturasi", "2026-08-20", id="F3", cari="C1", M=40000, K=0),
    o("tahsilat", "2026-08-20", id="P3", cari="C1", yol="pos", pos="POS1", tutar=40000, komisyon=1000, valor="2026-08-25"),
    o("satis_iade_faturasi", "2026-08-22", id="I3", cari="C1", M=10000, K=0, asil_fatura="F3"),
    o("pos_iade", "2026-08-22", tahsilat="P3", cari="C1", tutar=10000),
    MZ("mz", "2026-08-01", "2026-08-31"), GT("gt", "2026-08-01", "2026-08-31"), BIL("bil", "2026-08-31"),
], {"A": {
    # KG-6 A: komisyon satış günü → 08-10'da 108 = 97500, 653 2500
    "bil10/aktif/I.A": 97500, "bil10/pasif/V.F": 97500, "gt10/kalemler/G": 2500, "gt10/kalemler/DNK": 97500,
    "bil12/detay/I.A/102.B1": 97500,
    # P3: valörde net = 40000 − 10000 iade − 1000 komisyon = 29000
    "mz/satirlar/102.B1/bakiye": 126500, "mz/satirlar/108.POS1/bakiye": 0, "mz/satirlar/653/bakiye": 3500,
    "mz/satirlar/120|C1/bakiye": 0, "mz/satirlar/120|C3/bakiye": 50000, "mz/satirlar/610/bakiye": 10000,
    "gt/kalemler/A": 190000, "gt/kalemler/B": 10000, "gt/kalemler/G": 3500, "gt/kalemler/DNK": 176500,
    "bil/aktif/I.A": 126500, "bil/aktif/I.C": 50000, "bil/pasif/V.F": 176500,
}, "KG6=B": {
    # KG-6 B: komisyon valör günü → 08-10'da 108 brüt 100000, gider yok
    "bil10/aktif/I.A": 100000, "bil10/pasif/V.F": 100000, "gt10/kalemler/G": 0, "gt10/kalemler/DNK": 100000,
    "bil12/detay/I.A/102.B1": 97500,
    "mz/satirlar/102.B1/bakiye": 126500, "mz/satirlar/653/bakiye": 3500, "gt/kalemler/DNK": 176500,
}}, dallar=["KG6=B"], aciklama="POS brüt 108, komisyon (KG-6), valör, POS iptal, valörden önce iade.")

# ------------------------------------------------------------------------------------------------ S09
S("s09-cek-senet-alinan", ["T-04", "Ç-01", "Ç-02", "Ç-04", "Ç-05", "Ç-06", "T-08", "Ç-07", "Ç-08"], [
    o("satis_faturasi", "2026-09-01", id="F1", cari="C1", M=300000, K=0),
    o("alis_faturasi", "2026-09-01", id="A1", cari="T1", fatura_turu="gider", M=80000, K=0),
    o("tahsilat", "2026-09-02", cari="C1", yol="cek", evrak="CK1", tutar=100000),
    o("tahsilat", "2026-09-02", cari="C1", yol="senet", evrak="SN1", tutar=50000),
    o("tahsilat", "2026-09-02", cari="C1", yol="cek", evrak="CK2", tutar=80000),
    o("tahsilat", "2026-09-02", cari="C1", yol="cek", evrak="CK3", tutar=30000),
    o("evrak_tahsile_ver", "2026-09-05", evrak="CK1", banka="B1"),
    BIL("bil05", "2026-09-05"),
    o("evrak_tahsil", "2026-09-10", evrak="CK1"),
    o("evrak_tahsil", "2026-09-11", evrak="SN1", yol="kasa"),
    o("odeme", "2026-09-12", cari="T1", yol="ciro", evrak="CK2", tutar=80000),
    o("evrak_karsiliksiz", "2026-09-15", evrak="CK3"),
    o("evrak_karsiliksiz", "2026-09-20", evrak="CK2"),
    o("evrak_tahsile_ver", "2026-09-21", evrak="CK1", banka="B1"),
    MZ("mz", "2026-09-01", "2026-09-30"), BIL("bil", "2026-09-30"),
], {"A": {
    # 09-05: 101.01 = 80000 + 30000; 101.02 = 100000; 121.01 50000; C1 = 300000 − 260000 = 40000
    "bil05/aktif/I.A": 210000, "bil05/aktif/I.C": 90000, "bil05/pasif/III.B": 80000, "bil05/pasif/V.F": 220000,
    "bil05/detay/I.A/101.02": 100000,
    # son: karşılıksız CK3 (portföy) ve CK2 (cirodan dönen) müşteriyi yeniden borçlandırır
    "mz/satirlar/101.01/bakiye": 0, "mz/satirlar/101.02/bakiye": 0, "mz/satirlar/121.01/bakiye": 0,
    "mz/satirlar/102.B1/bakiye": 100000, "mz/satirlar/100/bakiye": 50000, "mz/satirlar/120|C1/bakiye": 150000,
    "mz/satirlar/320|T1/bakiye": -80000,
    "bil/aktif/I.A": 150000, "bil/aktif/I.C": 150000, "bil/pasif/III.B": 80000, "bil/pasif/V.F": 220000,
    "redler": ["EVRAK_DURUMU"],
}}, aciklama="Alınan çek / senet portföy → tahsilde → tahsil, ciro, karşılıksız (portföyden ve cirodan dönen).")

# ------------------------------------------------------------------------------------------------ S10
S("s10-cek-senet-verilen", ["T-07", "Ç-09", "Ç-10", "Ç-11"], [
    o("banka_acilis", "2026-01-01", banka="B1", tutar=500000),
    o("alis_faturasi", "2026-10-01", id="A1", cari="T1", fatura_turu="gider", M=200000, K=0),
    o("odeme", "2026-10-02", cari="T1", yol="cek", evrak="VC1", tutar=120000, banka="B1"),
    o("odeme", "2026-10-02", cari="T1", yol="senet", evrak="VS1", tutar=80000),
    BIL("bil10", "2026-10-10"),
    o("verilen_evrak_ode", "2026-10-20", evrak="VC1", banka="B1"),
    o("verilen_evrak_geri_al", "2026-10-21", evrak="VS1"),
    BIL("bil", "2026-10-31"), MZ("mz", "2026-01-01", "2026-10-31"),
], {"A": {
    # 103 (−) Hazır Değerler içinde eksi
    "bil10/aktif/I.A": 380000, "bil10/detay/I.A/103": -120000, "bil10/pasif/III.B": 80000, "bil10/pasif/V.G": 500000,
    "bil10/pasif/V.F": -200000,
    "mz/satirlar/102.B1/bakiye": 380000, "mz/satirlar/103/bakiye": 0, "mz/satirlar/321/bakiye": 0,
    "mz/satirlar/320|T1/bakiye": -80000, "bil/aktif/I.A": 380000, "bil/pasif/III.B": 80000,
}}, aciklama="Verilen çek 103, senet 321; ödeme ve geri alma.")

# ------------------------------------------------------------------------------------------------ S11
S("s11-kasa-carisiz-kg3", ["K-01", "K-02", "K-03", "K-04", "T-14", "K-14", "M-02", "KG-3"], [
    o("cari_acilis", "2025-12-01", cari="C1", yon="borc", tutar=7000),
    o("hesapsiz_hareket", "2025-12-20", cari="C1", yon="tahsilat", tutar=7000),   # açılıştan ÖNCE bankaya gelmiş (K-14)
    o("banka_acilis", "2026-01-01", banka="B1", tutar=100000),
    o("kasa_giris", "2026-01-05", tutar=20000),
    o("kayit_tahsilati", "2026-01-06", tutar=30000),
    o("kasa_cikis", "2026-01-07", tutar=5000),
    o("bankadan_kasaya", "2026-01-08", banka="B1", tutar=10000),
    o("kasadan_bankaya", "2026-01-09", banka="B1", tutar=4000),
    MZ("mz", "2026-01-01", "2026-01-31"), GT("gt", "2026-01-01", "2026-01-31"), BIL("bil", "2026-01-31"),
], {"A": {
    # KG-3 A = ürün sahibine gösterilen ve onaylanan metin (05.11 17:16): kayıt (dosya) tahsilatı gelir değil → 336.90
    # "Sınıflandırılmamış Tahsilatlar"; carisiz Kasa girişi 649'da (649.90) kalır.
    # kasa 20000 + 30000 − 5000 + 10000 − 4000 = 51000; banka 100000 − 10000 + 4000 = 94000
    "mz/satirlar/100/bakiye": 51000, "mz/satirlar/102.B1/bakiye": 94000, "mz/satirlar/649.90/bakiye": -20000,
    "mz/satirlar/336.90/bakiye": -30000, "mz/satirlar/770.90/bakiye": 5000, "mz/satirlar/519/bakiye": -100000,
    "mz/satirlar/120|C1/bakiye": 0, "gt/kalemler/F": 20000, "gt/kalemler/E": 5000, "gt/kalemler/DNK": 15000,
    "bil/aktif/I.A": 145000, "bil/pasif/III.C": 30000, "bil/pasif/V.G": 100000, "bil/pasif/V.F": 15000,
    "bil/kesin_degil": ["SINIFLANDIRILMAMIS_TAHSILAT", "TAMAMLANMAMIS_ACILIS"],
}, "KG3=KITAP": {
    # GEÇERSİZ (kullanıcı A'yı onayladı): kural kitabı §9 A — ikisi de 649.90
    "mz/satirlar/649.90/bakiye": -50000, "gt/kalemler/F": 50000, "gt/kalemler/DNK": 45000,
    "bil/pasif/V.F": 45000, "bil/kesin_degil": ["TAMAMLANMAMIS_ACILIS"],
}, "KG3=B": {
    # GEÇERSİZ: kitap B — ikisi de 336.90
    "mz/satirlar/336.90/bakiye": -50000, "gt/kalemler/F": 0, "gt/kalemler/DNK": -5000, "bil/pasif/III.C": 50000,
}}, dallar=["KG3=KITAP", "KG3=B"], aciklama="Carisiz kasa girişi / kayıt tahsilatı (KG-3), kasa ↔ banka, hesapsız tahsilat G'ye.")

# ------------------------------------------------------------------------------------------------ S12
S("s12-banka-islemleri", ["K-05", "K-06", "K-07", "K-08", "K-09", "K-10", "K-11", "K-12", "KG-19", "KG-22"], [
    o("banka_acilis", "2026-01-01", banka="B1", tutar=1000000),
    o("banka_acilis", "2026-01-01", banka="B2", tutar=200000),
    o("banka_transfer", "2026-02-01", gonderen="B1", alici="B2", tutar=100000, ucret=500, bsmv=25),
    o("banka_transfer", "2026-02-27", gonderen="B1", alici="B2", tutar=50000, valor="2026-03-02"),
    o("banka_masraf", "2026-02-28", banka="B1", tutar=1000, bsmv=50),
    o("banka_masraf_faturali", "2026-02-28", banka="B2", M=10000, K=2000),
    o("faiz_geliri", "2026-02-28", banka="B1", brut=30000, stopaj=4500),
    o("faiz_gideri", "2026-02-28", banka="B2", tutar=8000),
    o("banka_diger_gelir", "2026-02-28", banka="B1", tutar=2000),
    o("banka_diger_gider", "2026-02-28", banka="B2", tutar=1500),
    BIL("bil", "2026-02-28"), GT("gt", "2026-01-01", "2026-02-28"), BIL("bil2", "2026-03-02"),
], {"A": {
    # B1: 1000000 − 100000 − 525 − 50000 − 1050 + 25500 + 2000 = 875925; B2: 200000 + 100000 − 12000 − 8000 − 1500 = 278500
    "bil/detay/I.A/102.B1": 875925, "bil/detay/I.A/102.B2": 278500, "bil/detay/I.A/108.90": 50000,
    "bil/aktif/I.A": 1204425, "bil/aktif/I.H": 6500, "bil/pasif/V.G": 1200000, "bil/pasif/V.F": 10925,
    # E = 525 + 1050 + 10000; F = 30000 + 2000; G = 1500; H = 8000
    "gt/kalemler/E": 11575, "gt/kalemler/F": 32000, "gt/kalemler/G": 1500, "gt/kalemler/H": 8000, "gt/kalemler/DNK": 10925,
    "bil2/detay/I.A/102.B2": 328500, "bil2/aktif/I.A": 1204425,
}}, aciklama="Transfer + ücret/BSMV, valörlü transfer 108.90, masraf, faizler, diğer gelir/gider.")

# ------------------------------------------------------------------------------------------------ S13
S("s13-kart-kredi-ters-bakiye", ["M-04", "T-06", "D-05", "D-06", "D-07", "D-08", "D-09", "D-10", "T-11", "§7.3"], [
    o("banka_acilis", "2026-01-01", banka="B1", tutar=-50000),
    o("alis_faturasi", "2026-03-01", id="A1", cari="T1", fatura_turu="gider", M=100000, K=0),
    o("odeme", "2026-03-02", cari="T1", yol="kart", kart="KK1", tutar=110000),
    o("kart_harcama", "2026-03-03", kart="KK1", urun="U2", miktar=2, tutar=5000),
    o("kart_faiz", "2026-03-04", kart="KK1", tutar=2000),
    o("kredi_kullan", "2026-03-05", kredi="KR1", banka="B1", tutar=200000),
    o("kart_borc_odeme", "2026-03-06", kart="KK1", banka="B1", tutar=120000),
    o("kredi_odeme", "2026-03-07", kredi="KR1", banka="B1", anapara=50000, faiz=3000),
    BIL("bil07", "2026-03-07"),
    o("tahsilat", "2026-03-08", cari="T1", yol="kart", kart="KK1", tutar=10000),
    BIL("bil", "2026-03-31"), GT("gt", "2026-01-01", "2026-03-31"),
], {"A": {
    # 102.B1 = −50000 + 200000 − 120000 − 53000 = −23000 (KMH → 300); 309 = −110000 − 5000 − 2000 + 120000 = +3000 (→ 136);
    # T1 fazla ödendi +10000 (→ 159); 300.KR1 = −150000; 519 +50000 (V.G eksi)
    "bil07/pasif/III.A": 173000, "bil07/aktif/I.D": 3000, "bil07/aktif/I.E": 15000, "bil07/detay/I.E/320|T1": 10000,
    "bil07/pasif/V.G": -50000, "bil07/pasif/V.F": -105000, "bil07/aktif_toplam": 18000, "bil07/pasif_toplam": 18000,
    "bil/aktif/I.D": 13000, "bil/aktif/I.E": 5000, "bil/aktif_toplam": 18000,
    "gt/kalemler/E": 100000, "gt/kalemler/H": 5000, "gt/kalemler/DNK": -105000,
}}, aciklama="Şirket kartı, kredi, KMH ters bakiye (300), borçlu kart (136), borçlu tedarikçi (159), kredi kartına iade.")

# ------------------------------------------------------------------------------------------------ S14
S("s14-kdv-mahsup-360", ["V-01", "V-02", "V-03", "R-03", "KG-14"], [
    o("banka_acilis", "2026-01-01", banka="B1", tutar=100000),
    o("satis_faturasi", "2026-01-10", id="F1", cari="C1", M=100000, K=20000),
    o("alis_faturasi", "2026-01-11", id="A1", cari="T1", fatura_turu="gider", M=50000, K=10000),
    o("kdv_mahsup", ay="2026-01"),
    o("vergi_odeme", "2026-02-26", yol="havale", banka="B1", tutar=10000),
    o("alis_faturasi", "2026-02-05", id="A2", cari="T1", fatura_turu="gider", M=100000, K=20000),
    o("satis_faturasi", "2026-02-06", id="F2", cari="C1", M=50000, K=10000),
    o("kdv_mahsup", ay="2026-02"),
    o("satis_faturasi", "2026-03-10", id="F3", cari="C1", M=40000, K=8000),
    o("alis_faturasi", "2026-03-11", id="A3", cari="T1", fatura_turu="gider", M=20000, K=4000),
    o("kdv_mahsup", ay="2026-03"),
    R("bd190", "buyuk_defter", hesap="190", bas="2026-01-01", son="2026-03-31"),
    o("satis_faturasi", "2026-04-10", id="F4", cari="C1", M=100000, K=20000),
    o("kdv_mahsup", ay="2026-04"),
    o("kdv_mahsup", ay="2026-04"),
    o("kdv_mahsup_geri_al", ay="2026-04"),
    o("kdv_mahsup", ay="2026-04"),
    o("gecikme_zammi", "2026-05-02", yol="havale", banka="B1", tutar=500),
    o("vergi_odeme", "2026-05-02", yol="havale", banka="B1", tutar=16000),
    BIL("bil", "2026-05-31"), GT("gt", "2026-01-01", "2026-05-31"), MZ("mz", "2026-01-01", "2026-05-31"),
], {"A": {
    # Oca: H 20000 İ 10000 → 360 10000; Şub: İ 20000 H 10000 → 190 +10000; Mar: D 10000, İ 4000, H 8000 → 190 −4000 (6000);
    # Nis: D 6000, H 20000 → A 190 6000, A 360 14000; ödenen 16000 → 360 borçlu 2000 → 198 + BORCLU_360
    "bd190/son_bakiye": 6000, "bd190/toplam_borc": 10000, "bd190/toplam_alacak": 4000,
    "mz/satirlar/190/bakiye": 0, "mz/satirlar/360/bakiye": 2000, "mz/satirlar/191/bakiye": 0, "mz/satirlar/391/bakiye": 0,
    "mz/satirlar/102.B1/bakiye": 73500,
    "gt/kalemler/A": 290000, "gt/kalemler/E": 170000, "gt/kalemler/J": 500, "gt/kalemler/DNK": 119500,
    "bil/aktif/I.H": 2000, "bil/aktif/I.C": 348000, "bil/pasif/III.B": 204000, "bil/aktif_toplam": 423500,
    "bil/kesin_degil": ["BORCLU_360", "TAMAMLANMAMIS_ACILIS"],
    "redler": ["KDV_MAHSUP_TEKRAR"],
}}, aciklama="KDV mahsubu üç durum (360 / 190 artı / 190 eksi), aynı ay iki kez red, Geri Al (ters fiş) ve yeniden; borçlu 360.")

# ------------------------------------------------------------------------------------------------ S15
S("s15-supheli-alacak", ["J-01", "J-02", "J-03", "J-04", "J-05", "J-06", "T-13", "KG-21"], [
    o("satis_faturasi", "2026-01-10", id="F1", cari="C1", M=1000000, K=0),
    o("satis_faturasi", "2026-01-10", id="F2", cari="C2", M=200000, K=0),
    o("supheliye_al", "2026-02-01", id="S1", cari="C1", tutar=800000),
    o("supheliye_al", "2026-02-01", id="S2", cari="C2", tutar=150000),
    o("karsilik_ayir", "2026-02-02", cari="C1", tutar=600000, kayit="S1"),     # EK-2 31: işlemler kayıt başına
    o("karsilik_ayir", "2026-02-02", cari="C2", tutar=50000, kayit="S2"),
    o("karsilik_ayir", "2026-02-03", cari="C1", tutar=300000, kayit="S1"),
    o("tahsilat", "2026-03-01", cari="C1", yol="havale", banka="B1", tutar=300000, supheliden=True),
    BIL("bil03", "2026-03-01"),
    o("degersiz_yaz", "2026-04-01", cari="C1", kayit="S1"),
    o("supheliden_cikar", "2026-05-01", cari="C2", kayit="S2"),
    o("supheliye_al", "2026-06-01", id="S3", cari="C3", tutar=10000),
    BIL("bil", "2026-06-30"), GT("gt", "2026-01-01", "2026-06-30"), MZ("mz", "2026-01-01", "2026-06-30"),
], {"A": {
    # C1: kalan 800000 − 300000 = 500000 < karşılık 600000 → J-04 100000 → 644
    "bil03/aktif/I.C": 350000, "bil03/aktif/I.A": 300000, "bil03/detay/I.C/129|C1": -500000,
    "mz/satirlar/128|C1/bakiye": 0, "mz/satirlar/129|C1/bakiye": 0, "mz/satirlar/128|C2/bakiye": 0,
    "mz/satirlar/120|C2/bakiye": 200000, "mz/satirlar/644/bakiye": -150000, "mz/satirlar/654/bakiye": 650000,
    "gt/kalemler/F": 150000, "gt/kalemler/G": 650000, "gt/kalemler/DNK": 700000,
    "bil/aktif/I.A": 300000, "bil/aktif/I.C": 400000, "bil/pasif/V.F": 700000,
    "redler": ["KARSILIK_FAZLA", "SUPHELI_FAZLA"],
}}, aciklama="Şüpheliye al, karşılık, şüpheliden tahsilat + karşılık çözülmesi, değersiz yaz, şüpheliden çıkar.")

# ------------------------------------------------------------------------------------------------ S16
S("s16-stok-modulu-kg2-kg11", ["S-02", "S-03", "S-04", "S-05", "S-06", "KG-2", "KG-11", "§5"], [
    o("kasa_acilis", "2026-01-01", tutar=500000),
    o("stok_giris", "2026-01-05", urun="U1", miktar=10, tutar=120000, karsi="nakit"),
    o("stok_giris", "2026-01-06", urun="U1", miktar=10, tutar=100000, karsi="cari", cari="T1"),
    o("stok_cikis_satis", "2026-01-10", urun="U1", miktar=5, tutar=90000, karsi="nakit"),
    o("stok_musteri_iadesi", "2026-01-12", urun="U1", miktar=1, tutar=18000, karsi="nakit"),
    o("stok_tedarikci_iadesi", "2026-01-15", urun="U1", miktar=2, tutar=20000, karsi="cari", cari="T1"),
    o("stok_duzeltme", "2026-01-20", urun="U1", miktar=-1),
    GT("gt", "2026-01-01", "2026-01-31"), BIL("bil", "2026-01-31"), R("deg", "degerleme", tarih="2026-01-31"),
], {"A": {
    # birim = (220000 − 20000) / (20 − 2) = 200000/18; miktar 13 → 2600000/18 = 144444,4 → 144444; SMM = 200000 − 144444 = 55556
    "deg/toplam": 144444, "gt/kalemler/A": 90000, "gt/kalemler/B": 18000, "gt/kalemler/D": 55556, "gt/kalemler/DNK": 16444,
    "gt/hesaplar/600.90": 90000, "gt/hesaplar/610.90": 18000,
    "bil/aktif/I.A": 452000, "bil/aktif/I.E": 144444, "bil/pasif/III.B": 80000, "bil/pasif/V.F": 16444,
    "bil/aktif_toplam": 596444, "bil/pasif_toplam": 596444,
}, "KG2=B": {
    # iç yüzde: 90000 × 20/120 = 15000; 18000 × 20/120 = 3000
    "gt/kalemler/A": 75000, "gt/kalemler/B": 15000, "gt/kalemler/DNK": 4444, "bil/pasif/III.I": 15000, "bil/aktif/I.H": 3000,
}, "KG11=B": {
    # satışların maliyeti hesaplanmadı: GT'de D boş; Bilanço'da 153 alış toplamı
    "gt/kalemler/D": 0, "gt/kalemler/DNK": 72000, "bil/aktif/I.E": 200000, "bil/pasif/V.F": 72000,
    "bil/kesin_degil": ["SATISLARIN_MALIYETI_HESAPLANMADI", "TAMAMLANMAMIS_ACILIS"],
}}, dallar=["KG2=B", "KG11=B"], aciklama="Stok modülü (faturasız) belgesiz gelir 600.90; dönemsel ağırlıklı ortalama, tahmini SMM.")

# ------------------------------------------------------------------------------------------------ S17
S("s17-cari-duzeltme-kg16", ["C-01", "C-02", "M-02", "M-03", "KG-16", "KG-4"], [
    o("cari_acilis", "2026-01-01", cari="C2", yon="borc", tutar=200000, aciklama="Devreden bakiye"),
    # kâhin bakımı 8 (W1, G3): KG-16 adayları göç verisidir ("göçte" / "eski kayıt") → yedekten=True; sayılar S47 ile (aşağıda)
    o("borc_yaz", "2026-01-02", id="BY3", cari="C3", tutar=30000, aciklama="Açılış bakiyesi", onay=True, yedekten=True),
    o("borc_yaz", "2026-01-03", id="BY4", cari="C1", tutar=40000, aciklama="açılış farkı", yedekten=True),
    o("alacak_yaz", "2026-01-04", id="AY2", cari="T1", tutar=25000, aciklama="AÇILIŞ", onay=True, yedekten=True),
    o("borc_yaz", "2026-01-05", cari="C1", tutar=50000, aciklama="Fark faturası"),
    o("alacak_yaz", "2026-01-06", cari="C1", tutar=10000, aciklama="İndirim"),
    MZ("mz", "2026-01-01", "2026-01-31"), GT("gt", "2026-01-01", "2026-01-31"),
], {"A": {
    # is_opening (açıklaması "Açılış" değil) → 519; onaylı "Açılış Olabilir" → 519; ONAY BEKLEYEN (BY4) → 519 (S47 A; bakım 7'ye kadar 602.90)
    # 519 = −200000 − 30000 − 40000 + 25000 = −245000; 602.90 = −50000 (Fark faturası); DNK = 50000 − 10000 = 40000
    "mz/satirlar/519/bakiye": -245000, "mz/satirlar/602.90/bakiye": -50000, "mz/satirlar/770.90/bakiye": 10000,
    "mz/satirlar/120|C1/bakiye": 80000, "mz/satirlar/120|C2/bakiye": 200000, "mz/satirlar/120|C3/bakiye": 30000,
    "mz/satirlar/320|T1/bakiye": -25000, "gt/kalemler/A": 50000, "gt/kalemler/DNK": 40000,
    "acilis_olabilir": ["AY2", "BY3", "BY4"],
}, "KG16=B": {
    "mz/satirlar/519/bakiye": -200000, "mz/satirlar/602.90/bakiye": -120000, "mz/satirlar/770.90/bakiye": 35000,
    "gt/kalemler/DNK": 85000, "acilis_olabilir": [],
}}, dallar=["KG16=B"], aciklama="Borç / Alacak Yaz 602.90 / 770.90; açılış işaretiyle (açıklamadan değil) 519; KG-16.")

# ------------------------------------------------------------------------------------------------ S18
S("s18-acilislar-eslestirme", ["M-01", "M-02", "M-03", "M-04", "M-05", "M-06", "M-07", "M-08", "M-09", "M-11", "G-1"], [
    o("kasa_acilis", "2026-01-01", tutar=100000),
    o("banka_acilis", "2026-01-01", banka="B1", tutar=500000),
    o("kart_acilis", "2026-01-01", kart="KK1", tutar=30000),
    o("kredi_acilis", "2026-01-01", kredi="KR1", tutar=200000),
    o("cari_acilis", "2026-01-01", cari="C1", yon="borc", tutar=150000),
    o("cari_acilis", "2026-01-01", cari="T1", yon="alacak", tutar=80000),
    o("stok_acilis", "2026-01-01", kalemler=[{"urun": "U1", "miktar": 2, "birim_maliyet": "10000/3"},
                                            {"urun": "U2", "miktar": 4, "birim_maliyet": 2500}]),
    o("evrak_acilis", "2026-01-01", evrak="CK9", evrak_turu="cek", yon="alinan", durum="portfoy", tutar=40000, cari="C1"),
    o("evrak_acilis", "2026-01-01", evrak="SN9", evrak_turu="senet", yon="alinan", durum="tahsilde", tutar=25000, banka="B1", cari="C1"),
    o("evrak_acilis", "2026-01-01", evrak="VC9", evrak_turu="cek", yon="verilen", tutar=60000, cari="T1", banka="B1"),
    o("kasa_acilis", "2026-01-01", tutar=1),
    BIL("bil0", "2026-01-01"),
    o("acilis_eslestir", tarih="2026-01-01", satirlar=[{"hesap": "500", "alacak": 500000}]),
    o("acilis_eslestir", tarih="2026-01-01", satirlar=[{"hesap": "500", "alacak": 400000}, {"hesap": "570", "alacak": 61667}]),
    o("acilis_eslestir", tarih="2026-01-01", satirlar=[{"hesap": "500", "alacak": 1}]),
    BIL("bil", "2026-01-01"),
], {"A": {
    # stok açılışı: 2 × 10000/3 = 6666,67 → 6667; 4 × 2500 = 10000 → 16667. G = −(100000 + 500000 + 150000 + 16667 + 40000 + 25000)
    # + (30000 + 200000 + 80000 + 60000) = −461667
    "bil0/pasif/V.G": 461667, "bil0/detay/I.E/153 (Tahmini Değerleme)": 16667,
    "bil/aktif/I.A": 580000, "bil/aktif/I.C": 175000, "bil/aktif/I.E": 16667, "bil/pasif/III.A": 230000,
    "bil/pasif/III.B": 80000, "bil/pasif/V.A": 400000, "bil/pasif/V.D": 61667, "bil/aktif_toplam": 771667,
    "bil/kesin_degil": ["SATISLARIN_MALIYETI_TAHMINI"],
    "redler": ["KASA_ACILIS_TEKRAR", "ESLESTIRME_TERS", "ESLESTIRME_TERS"],
}}, aciklama="Bütün modül açılışları G'ye (evrak 602/770'e değil); açılış eşleştirme fişi G'yi kapatır, ters bakiyeye geçiremez.")

# ------------------------------------------------------------------------------------------------ S19
S("s19-taksit-kg5", ["H-01", "H-03", "H-04", "H-06", "M-10", "KG-2", "KG-5", "B1"], [
    o("taksit_karti", "2026-03-01", id="TK1", cari="C1", kaynak="yeni_borc", toplam=120000,
      taksitler=[{"vade": "2026-04-01", "tutar": 40000}, {"vade": "2026-05-01", "tutar": 40000}, {"vade": "2026-06-01", "tutar": 40000}]),
    o("tahsilat", "2026-04-01", cari="C1", yol="nakit", tutar=40000, taksit_karti="TK1"),
    o("taksit_excel", "2026-03-01", id="TE1", cari="C2", toplam=100000, odenen=30000,
      taksitler=[{"vade": "2026-04-01", "tutar": 35000}, {"vade": "2026-05-01", "tutar": 35000}, {"vade": "2026-06-01", "tutar": 30000}]),
    BIL("bil", "2026-04-30"), GT("gt", "2026-01-01", "2026-04-30"),
    R("gec1", "gecikmis", cari="C1", tarih="2026-06-15"), R("gec2", "gecikmis", cari="C2", tarih="2026-06-15"),
], {"A": {
    # H-03 → 600.90 120000; Excel kart (KG-5 A) açılış alacağı 70000 / 519
    "bil/aktif/I.A": 40000, "bil/aktif/I.C": 150000, "bil/pasif/V.G": 70000, "bil/pasif/V.F": 120000,
    "gt/hesaplar/600.90": 120000, "gt/kalemler/DNK": 120000,
    # C1: 04-01 ödendi; 05-01 + 06-01 gecikmiş = 80000. C2: önceden ödenen 30000 ilk taksitten düşer → 5000 + 35000 + 30000
    "gec1/gecikmis": 80000, "gec2/gecikmis": 70000,
}, "KG5=B": {
    "bil/aktif/I.C": 150000, "bil/pasif/V.G": -30000, "bil/pasif/V.F": 220000, "gt/hesaplar/600.90": 220000,
}}, dallar=["KG5=B"], aciklama="Taksit Yeni Borç (belgesiz gelir), taksit tahsilatı, Excel'den yüklenen kart (KG-5).")

# ------------------------------------------------------------------------------------------------ S20
S("s20-ters-bakiye-avans-ayni-ad", ["T-12", "T-09", "§7.3", "G-2"], [

    o("tahsilat", "2026-06-01", cari="C1", yol="nakit", tutar=100000),
    o("odeme", "2026-06-02", cari="D1", yol="nakit", tutar=20000),
    BIL("bil05", "2026-06-05"),
    o("satis_faturasi", "2026-06-10", id="F1", cari="C2", M=30000, K=6000),
    BIL("bil", "2026-06-30"),
], {"A": {
    # avans alacaklı 120|C1 → 340 (III.D); borçlu 336|D1 → 136 (I.D); aynı adlı C1 ve C2 netleşmez
    "bil05/aktif/I.A": 80000, "bil05/aktif/I.D": 20000, "bil05/pasif/III.D": 100000,
    "bil/aktif/I.C": 36000, "bil/pasif/III.D": 100000, "bil/detay/III.D/120|C1": 100000, "bil/detay/I.C/120|C2": 36000,
    "bil/pasif/V.F": 30000, "bil/aktif_toplam": 136000,
}}, aciklama="Avans tahsilatı satış değildir (340), Diğer cariye ödeme borçlu 336 → 136; aynı adlı iki cari ayrı.")

# ------------------------------------------------------------------------------------------------ S21
S("s21-devir-ayni-adli-iki-cari", ["N-09", "N-10", "N-13", "G2"], [
    o("satis_faturasi", "2026-11-01", id="F1", cari="C1", M=100000, K=0),
    o("satis_faturasi", "2026-11-02", id="F2", cari="C2", M=50000, K=0),
    o("tahsilat", "2026-11-05", cari="C2", yol="nakit", tutar=80000),
    o("devir", K="2026-12-31", ad="devir"),
    BIL("bil", "2027-01-01"), GT("gt", "2027-01-01", "2027-12-31"),
], {"A": {
    "devir/yeni_acilis/120|C1": 100000, "devir/yeni_acilis/120|C2": -30000, "devir/yeni_acilis/100": 80000,
    "devir/yeni_acilis/590": -150000, "devir/acilis/cariler/C2/acilis": -30000, "devir/acilis/cariler/C1/acilis": 0,
    "bil/aktif/I.C": 100000, "bil/pasif/III.D": 30000, "bil/pasif/V.F": 150000, "bil/kesin_degil": [], "gt/kalemler/DNK": 0,
}}, aciklama="Aynı adlı iki cari devirde ayrı; açık kalem F1, avanslı C2 net açılış.")

# ------------------------------------------------------------------------------------------------ S22
S("s22-devir-temel", ["N-01", "N-02", "N-03", "N-04", "N-06", "N-07", "N-09", "N-10", "N-13", "§5", "§6", "V-01"], [
    o("kasa_acilis", "2026-01-01", tutar=200000),
    o("banka_acilis", "2026-01-01", banka="B1", tutar=1000000),
    o("alis_faturasi", "2026-02-01", id="A1", cari="T1", fatura_turu="stok", M=100000, K=20000, kalemler=[{"urun": "U1", "miktar": 10}]),
    o("odeme", "2026-03-01", cari="T1", yol="havale", banka="B1", tutar=120000, fatura="A1"),
    o("alis_faturasi", "2026-06-01", id="A2", cari="T1", fatura_turu="stok", M=140000, K=28000, kalemler=[{"urun": "U1", "miktar": 10}]),
    o("satis_faturasi", "2026-07-01", id="F1", cari="C1", M=200000, K=40000, vade="2026-08-01", kalemler=[{"urun": "U1", "miktar": 8}]),
    o("tahsilat", "2026-08-01", cari="C1", yol="havale", banka="B1", tutar=240000, fatura="F1"),
    o("satis_faturasi", "2026-12-20", id="F2", cari="C3", M=150000, K=30000, vade="2027-01-20", kalemler=[{"urun": "U1", "miktar": 5}]),
    o("alis_faturasi", "2026-12-28", id="G1", cari="T2", fatura_turu="gider", M=60000, K=12000),
    o("kasa_cikis", "2026-12-31", tutar=10000),
    o("kdv_mahsup", ay="2026-02"), o("kdv_mahsup", ay="2026-06"), o("kdv_mahsup", ay="2026-07"), o("kdv_mahsup", ay="2026-12"),
    o("satis_faturasi", "2027-01-05", id="F3", cari="C1", M=30000, K=6000),
    o("tahsilat", "2027-01-10", cari="C3", yol="nakit", tutar=180000, fatura="F2"),
    GT("gt_canli", "2026-01-01", "2026-12-31"),
    o("devir", K="2026-12-31", ad="devir"),
    GT("gt_arsiv", "2026-01-01", "2026-12-31", dosya="arsiv"), MZ("mz_arsiv", "2026-01-01", "2026-12-31", dosya="arsiv"),
    BIL("bil_arsiv", "2026-12-31", dosya="arsiv"),
    BIL("bil", "2027-01-31"), GT("gt", "2027-01-01", "2027-01-31"), R("acik3", "acik_faturalar", cari="C3", tarih="2027-01-31"),
], {"A": {
    # ağırlıklı ortalama (100000 + 140000)/20 = 12000; kalan 7 → DSS 84000; SMM 156000; kâr 350000 − 156000 − 70000 = 124000
    "gt_canli/kalemler/D": 156000, "gt_canli/kalemler/DNK": 124000,
    "devir/kapanis/N01/2026": 156000, "devir/kapanis/DSS": 84000, "devir/kapanis/sonuc": 124000,
    "gt_arsiv/kalemler/A": 350000, "gt_arsiv/kalemler/D": 156000, "gt_arsiv/kalemler/E": 70000, "gt_arsiv/kalemler/DNK": 124000,
    "gt_arsiv/tahmini": False,
    "mz_arsiv/satirlar/621/borc": 156000, "mz_arsiv/satirlar/621/alacak": 156000, "mz_arsiv/satirlar/690/bakiye": 0,
    "mz_arsiv/satirlar/590/bakiye": -124000, "mz_arsiv/satirlar/600/borc": 350000,
    # EK-2 38 / E17 (bakım 2): belgeli gider alışında gider türü boş → 770 (770.90 yalnız tanınmayan değer ve belgesiz çıkış); N-03 ile kapanır.
    # G1 60000 → 770; kasa çıkışı 10000 → 770.90 (ilk commit'te 0 / 70000 yazılmıştı — kasa çıkışı unutulmuştu; elle yeniden hesap)
    "mz_arsiv/satirlar/770.90/borc": 10000, "mz_arsiv/satirlar/770/borc": 60000,
    "bil_arsiv/donem_net_kari": 0, "bil_arsiv/pasif/V.F": 124000, "bil_arsiv/kesin_degil": ["TAMAMLANMAMIS_ACILIS"],
    "devir/arsiv_kapanis/100": 190000, "devir/arsiv_kapanis/102.B1": 1120000, "devir/arsiv_kapanis/153": 84000,
    "devir/arsiv_kapanis/360": -10000, "devir/arsiv_kapanis/320|T1": -168000, "devir/arsiv_kapanis/320|T2": -72000,
    "devir/yeni_acilis/120|C3": 180000, "devir/yeni_acilis/153": 84000, "devir/yeni_acilis/519": -1200000,
    "devir/yeni_acilis/590": -124000,
    "devir/acilis/N13/360": -10000, "devir/acilis/N13/590": -124000, "devir/acilis/N13/519": 134000,
    "bil/aktif/I.A": 1490000, "bil/aktif/I.C": 36000, "bil/aktif/I.E": 84000, "bil/pasif/III.B": 240000,
    "bil/pasif/V.F": 154000, "bil/donem_net_kari": 30000, "bil/aktif_toplam": 1610000,
    "gt/kalemler/A": 30000, "gt/kalemler/D": 0, "gt/kalemler/DNK": 30000, "acik3": [],
    # T1: borç 120000 (ödeme); alacak 120000 + 168000 − açık A2 168000
    "devir/acilis/ekstre/T1/Borç Toplamı": 120000, "devir/acilis/ekstre/T1/Alacak Toplamı": 120000,
}}, aciklama="Tam devir: değerleme, 7/A yansıtma, 690 → 692 → 590, açık kalemler, K sonrası kayıtlar, Aralık KDV mahsubu.")

# ------------------------------------------------------------------------------------------------ S23
S("s23-devir-pos-valor-kg6", ["N-11", "KG-6", "D-01"], [
    o("satis_faturasi", "2026-12-30", id="F1", cari="C1", M=100000, K=0),
    o("tahsilat", "2026-12-30", id="P1", cari="C1", yol="pos", pos="POS1", tutar=100000, komisyon=3000, valor="2027-01-02"),
    o("devir", K="2026-12-31", ad="devir"),
    BIL("bil", "2027-01-31"), GT("gt", "2027-01-01", "2027-01-31"), GT("gt_arsiv", "2026-01-01", "2026-12-31", dosya="arsiv"),
], {"A": {
    "devir/yeni_acilis/108.POS1": 97000, "devir/yeni_acilis/590": -97000, "gt_arsiv/kalemler/G": 3000,
    "bil/detay/I.A/102.B1": 97000, "bil/pasif/V.F": 97000, "gt/kalemler/G": 0, "gt/kalemler/DNK": 0,
}, "KG6=B": {
    "devir/yeni_acilis/108.POS1": 100000, "devir/yeni_acilis/590": -100000, "gt_arsiv/kalemler/G": 0,
    "bil/detay/I.A/102.B1": 97000, "bil/pasif/V.F": 97000, "gt/kalemler/G": 3000, "gt/kalemler/DNK": -3000,
}}, dallar=["KG6=B"], aciklama="Valörü K'den sonraya kalan POS: bekleyen kalem açılışı (KG-6'ya göre net).")

# ------------------------------------------------------------------------------------------------ S24
S("s24-devir-eksi-stok-kg9", ["KG-9", "KG-10", "N-01", "§5.2"], [
    o("alis_faturasi", "2026-03-01", id="A1", cari="T1", fatura_turu="stok", M=100000, K=0, kalemler=[{"urun": "U1", "miktar": 10}]),
    o("alis_faturasi", "2026-03-01", id="A2", cari="T1", fatura_turu="stok", M=50000, K=0, kalemler=[{"urun": "U2", "miktar": 2}]),
    o("satis_faturasi", "2026-06-01", id="F1", cari="C1", M=300000, K=0,
      kalemler=[{"urun": "U1", "miktar": 12}, {"urun": "U2", "miktar": 1}]),
    BIL("bil_arsiv_once", "2026-12-31"),
    o("devir", K="2026-12-31", ad="devir"),
    BIL("bil_arsiv", "2026-12-31", dosya="arsiv"),
    o("alis_faturasi", "2027-02-01", id="A3", cari="T1", fatura_turu="stok", M=120000, K=0, kalemler=[{"urun": "U1", "miktar": 10}]),
    GT("gt", "2027-01-01", "2027-02-28"), R("deg", "degerleme", tarih="2027-02-28"),
], {"A": {
    # KG-9 A: U1 −2 adet → 0; U2 1 × 25000 → DSS 25000; fark 150000 − 25000 = 125000; kâr 175000
    "devir/kapanis/DSS": 25000, "devir/kapanis/sonuc": 175000, "devir/yeni_acilis/153": 25000,
    "bil_arsiv/kesin_degil": ["EKSI_STOK"], "bil_arsiv_once/kesin_degil": ["EKSI_STOK", "SATISLARIN_MALIYETI_TAHMINI"],
    # 2027: U1 DBS (0, 0) + 10 adet 120000 → birim 12000, miktar 8 → 96000; U2 25000 → 121000; SMM = 145000 − 121000
    "deg/toplam": 121000, "gt/kalemler/D": 24000, "gt/kalemler/DNK": -24000,
}, "KG9=B": {
    # eksi değer −2 × 10000 = −20000 → DSS 5000; 2027 birim (−20000 + 120000)/(−2 + 10) = 12500 → 100000 + 25000
    "devir/kapanis/DSS": 5000, "devir/kapanis/sonuc": 155000, "deg/toplam": 125000, "gt/kalemler/D": 0,
}}, dallar=["KG9=B"], aciklama="Eksi miktarlı ürün değerlemesi (KG-9) ve sonraki yıl ortalamasına etkisi.")

# ------------------------------------------------------------------------------------------------ S25
S("s25-devir-onceki-yil-kg12", ["KG-12", "N-08", "§4", "§5.1"], [
    o("kasa_acilis", "2025-01-01", tutar=100000),
    o("alis_faturasi", "2025-03-01", id="A1", cari="T1", fatura_turu="stok", M=100000, K=0, kalemler=[{"urun": "U1", "miktar": 10}]),
    o("satis_faturasi", "2025-05-01", id="F1", cari="C1", M=90000, K=0, kalemler=[{"urun": "U1", "miktar": 6}]),
    o("kasa_cikis", "2025-06-01", tutar=5000),
    o("alis_faturasi", "2026-02-01", id="A2", cari="T1", fatura_turu="stok", M=180000, K=0, kalemler=[{"urun": "U1", "miktar": 12}]),
    o("satis_faturasi", "2026-04-01", id="F2", cari="C1", M=200000, K=0, kalemler=[{"urun": "U1", "miktar": 10}]),
    o("kasa_giris", "2026-05-01", tutar=30000),
    BIL("bil", "2026-12-31"),
    o("devir", K="2026-12-31", ad="devir"),
    GT("gt25", "2025-01-01", "2025-12-31", dosya="arsiv"), GT("gt26", "2026-01-01", "2026-12-31", dosya="arsiv"),
    BIL("bil_yeni", "2027-01-01"),
], {"A": {
    # 2025: SMM 60000, R 25000; 2026: birim (40000 + 180000)/16 = 13750, DSS 6 × 13750 = 82500, SMM 137500, R 92500
    "bil/donem_net_kari": 92500, "bil/gecmis_yillar_kapanmamis": 25000, "bil/pasif/V.K": 25000, "bil/aktif/I.E": 82500,
    "bil/aktif_toplam": 497500,
    "bil/kesin_degil": ["KAPANMAMIS_ONCEKI_YIL", "SATISLARIN_MALIYETI_TAHMINI", "TAMAMLANMAMIS_ACILIS"],
    # EK-1 M4: 2025 için fiş o yılın tarihine YAZILMAZ; K tarihli "Önceki Yıl Sonucu Fişi (2025)": SMM 60000, R 25000 → 570
    "devir/kapanis/onceki_yil/2025/SMM": 60000, "devir/kapanis/onceki_yil/2025/R": 25000, "devir/kapanis/N01/2026": 137500,
    # EK-2 26: yıl alt hesabı 570.2025
    "devir/yeni_acilis/570.2025": -25000, "devir/yeni_acilis/590": -92500,
    "gt25/kalemler/D": 60000, "gt25/kalemler/DNK": 25000, "gt25/tahmini": True, "gt26/kalemler/D": 137500, "gt26/kalemler/DNK": 92500,
    "gt26/tahmini": False,
    "bil_yeni/pasif/V.D": 25000, "bil_yeni/pasif/V.F": 92500,
}, "KG12=B": {
    "bil/donem_net_kari": 117500, "bil/gecmis_yillar_kapanmamis": 0, "devir/yeni_acilis/590": -117500,
}}, dallar=["KG12=B"], aciklama="Devir yapılmamış önceki yıl: yıl yıl değerleme ve sonuç (KG-12 A: 570 / 580).")

# ------------------------------------------------------------------------------------------------ S26 (iki seçenek)
for _sec, _ad in (("borc_alacak", "s26a-devir-borc-ve-alacaklari-aktar"), ("sadece_bakiye", "s26b-devir-sadece-bakiyeyi-aktar")):
    # EK-1 M12: Borç Toplamı = ≤K borç (50000 + 100000 + 20000) − devreden açık borç kalemleri (F1 75000 + BY 20000) = 75000;
    # Alacak Toplamı = 70000 + 5000 = 75000; "Sadece Bakiyeyi Aktar"da Devir Bakiyesi = 95000 − 95000 = 0 → satır yazılmaz
    _ekstre = ({"devir/acilis/ekstre/C1/Borç Toplamı": 75000, "devir/acilis/ekstre/C1/Alacak Toplamı": 75000,
                "devir/acilis/ekstre/C1/satirlar/0/aciklama": "Devir — Borç Toplamı", "devir/acilis/ekstre/C1/satirlar/2/aciklama": "Devir: F1 (2026-03-01)",
                "devir/acilis/ekstre/C1/satirlar/3/bakiye": 95000}
               if _sec == "borc_alacak" else
               {"devir/acilis/ekstre/C1/Devir Bakiyesi": 0, "devir/acilis/ekstre/C1/satirlar/0/aciklama": "Devir: F1 (2026-03-01)",
                "devir/acilis/ekstre/C1/satirlar/1/aciklama": "Devir: BY (2026-04-01)", "devir/acilis/ekstre/C1/satirlar/1/bakiye": 95000})
    S(_ad, ["§11.2", "KG-17", "G14", "B1", "G2"], [
        o("cari_acilis", "2026-01-01", cari="C1", yon="borc", tutar=50000),
        o("satis_faturasi", "2026-03-01", id="F1", cari="C1", M=100000, K=0),
        o("tahsilat", "2026-03-10", cari="C1", yol="nakit", tutar=70000),
        o("borc_yaz", "2026-04-01", id="BY", cari="C1", tutar=20000, aciklama="Fark"),
        o("alacak_yaz", "2026-05-01", cari="C1", tutar=5000, aciklama="İndirim"),
        R("gec_once", "gecikmis", cari="C1", tarih="2026-12-31"),
        o("devir", K="2026-12-31", secenek=_sec, ad="devir"),
        R("gec_sonra", "gecikmis", cari="C1", tarih="2027-03-15"), R("acik", "acik_faturalar", cari="C1", tarih="2027-01-01"),
    ], {"A": dict({
        # TYK (EK-1 §1, S1, S2): 70000 → vadesi ilk gelen açılış (01-01) 50000 + F1 (vade = belge 03-01) 20000; Alacak Yaz 5000 → F1
        # → F1 kalan 75000; Borç Yaz (vadesiz → 04-01) 20000 açık. Devirde ikisi de AYRI açık kalem (M2) → net kalan 0.
        "devir/yeni_acilis/120|C1": 95000, "devir/yeni_acilis/100": 70000, "devir/yeni_acilis/519": -50000,
        "devir/yeni_acilis/590": -115000, "devir/acilis/cariler/C1/acilis": 0,
        "devir/acilis/acik_kalemler/0/k": "fatura:F1", "devir/acilis/acik_kalemler/1/k": "borc:BY",
        "devir/acilis/acik_kalemler/1/vade": "2026-04-01",
        "acik/0/kalan": 75000, "acik/0/fatura": "F1",
        # S1: vadesiz Borç Yaz ertesi günden gecikmiş → 75000 + 20000; devirden sonra aynı (M2)
        "gec_once/gecikmis": 95000, "gec_sonra/gecikmis": 95000,
    }, **_ekstre)}, aciklama="Borç ve Alacakları Aktar / Sadece Bakiyeyi Aktar: defter aynı (cari başına net), ekstre farklı.")

# ------------------------------------------------------------------------------------------------ S27
S("s27-devir-yoldaki-supheli-evrak-taksit", ["N-11", "N-12", "K-07", "M-08", "M-09", "J-04", "H-04", "G3"], [
    o("banka_acilis", "2026-01-01", banka="B1", tutar=500000),
    o("satis_faturasi", "2026-10-01", id="F1", cari="C1", M=200000, K=0),
    o("supheliye_al", "2026-11-01", id="S1", cari="C1", tutar=150000),
    o("karsilik_ayir", "2026-11-02", cari="C1", tutar=100000, kayit="S1"),
    o("satis_faturasi", "2026-11-01", id="F2", cari="C2", M=40000, K=0),
    o("tahsilat", "2026-11-03", cari="C2", yol="cek", evrak="CK1", tutar=40000),
    o("evrak_tahsile_ver", "2026-12-01", evrak="CK1", banka="B1"),
    o("alis_faturasi", "2026-11-01", id="A1", cari="T1", fatura_turu="gider", M=60000, K=0),
    o("odeme", "2026-11-05", cari="T1", yol="cek", evrak="VC1", tutar=60000, banka="B1"),
    o("taksit_karti", "2026-11-10", id="TK1", cari="C3", kaynak="yeni_borc", toplam=90000,
      taksitler=[{"vade": "2026-12-10", "tutar": 30000}, {"vade": "2027-01-10", "tutar": 30000}, {"vade": "2027-02-10", "tutar": 30000}]),
    o("tahsilat", "2026-12-10", cari="C3", yol="nakit", tutar=30000, taksit_karti="TK1"),
    o("banka_transfer", "2026-12-31", gonderen="B1", alici="B2", tutar=100000, valor="2027-01-02"),
    o("devir", K="2026-12-31", ad="devir"),
    o("evrak_tahsil", "2027-01-15", evrak="CK1"),
    o("verilen_evrak_ode", "2027-01-20", evrak="VC1", banka="B1"),
    o("tahsilat", "2027-01-10", cari="C3", yol="nakit", tutar=30000, taksit_karti="TK1"),
    o("tahsilat", "2027-02-01", cari="C1", yol="havale", banka="B1", tutar=60000, supheliden=True),
    BIL("bil", "2027-02-28"), GT("gt", "2027-01-01", "2027-02-28"), R("gec3", "gecikmis", cari="C3", tarih="2027-02-15"),
], {"A": {
    "devir/arsiv_kapanis/108.90": 100000, "devir/yeni_acilis/108.90": 100000, "devir/yeni_acilis/128|C1": 150000,
    "devir/yeni_acilis/129|C1": -100000, "devir/yeni_acilis/101.02": 40000, "devir/yeni_acilis/103": -60000,
    "devir/yeni_acilis/120|C3": 60000, "devir/yeni_acilis/590": -170000, "devir/acilis/N13": {"590": -170000, "519": 170000},
    # 2027: kalan şüpheli 90000 < karşılık 100000 → 10000 → 644
    "gt/kalemler/F": 10000, "gt/kalemler/DNK": 10000,
    "bil/aktif/I.A": 600000, "bil/aktif/I.C": 80000, "bil/detay/I.A/102.B2": 100000, "bil/detay/I.A/102.B1": 440000,
    "bil/pasif/V.F": 180000, "gec3/gecikmis": 30000,
    # EK-1 M13: J-01 150000 F1'den çıkıp şüpheli kuyruğuna geçti; CH'de F1 50000 açık kalem; 128 ayrı (aynı tutar iki kez taşınmaz)
    "devir/acilis/acik_kalemler/0/k": "fatura:F1", "devir/acilis/acik_kalemler/0/kalan": 50000,
    "devir/acilis/supheli/C1/tutar": 150000, "devir/acilis/supheli/C1/kalemler/0/k": "fatura:F1",
    "devir/acilis/supheli/C1/kalemler/0/kalan": 150000,
    # taksit kartı açık taksitleriyle devreder (M1e / G3); net kalan 0
    "devir/acilis/kartlar/TK1/acik_taksitler/0/vade": "2027-01-10", "devir/acilis/kartlar/TK1/acik_taksitler/0/kalan": 30000,
    "devir/acilis/kartlar/TK1/acik_taksitler/1/kalan": 30000, "devir/acilis/cariler/C3/acilis": 0,
}}, aciklama="Yoldaki transfer, açık şüpheli, tahsildeki ve verilen çek, taksit kartı devirde; yeni yılda kapanışları.")

# ------------------------------------------------------------------------------------------------ S28
S("s28-devri-yenile-kg7", ["N-14", "KG-7", "G7", "G13", "V-01"], [
    o("banka_acilis", "2026-01-01", banka="B1", tutar=1000000),
    o("satis_faturasi", "2026-12-10", id="F1", cari="C1", M=100000, K=20000, vade="2027-01-10"),
    o("kdv_mahsup", ay="2026-12"),
    o("devir", K="2026-12-31", ad="devir"),
    o("tahsilat", "2027-01-15", cari="C1", yol="havale", banka="B1", tutar=60000, fatura="F1"),
    o("devri_yenile", ad="yenile", duzeltmeler=[
        o("alis_faturasi", "2026-12-28", id="G9", cari="T1", fatura_turu="gider", M=50000, K=10000, indirim_ayi="2027-01")]),
    o("kdv_mahsup", ay="2027-01"),
    BIL("bil", "2027-01-31"), MZ("mz", "2027-01-01", "2027-01-31"), R("acik", "acik_faturalar", cari="C1", tarih="2027-01-31"),
    o("devri_yenile", ad="yenile2", duzeltmeler=[
        o("satis_iade_faturasi", "2026-12-29", id="I9", cari="C1", M=100000, K=20000, asil_fatura="F1")]),
    BIL("bil_arsiv", "2026-12-31", dosya="arsiv"), R("af", "acilis_fisleri", tarih="2027-01-01"),
], {"A": {
    # bakım 2 — karar (7): yalnız devrin ürettiği fişler yeniden yazılır; yevmiyede TEK açılış fişi (iki yenilemeden sonra da)
    "af": ["devir_acilis:devir-2026-1"],
    "yenile/fark/590": 50000, "yenile/fark/191": 10000, "yenile/fark/320|T1": -60000,
    "yenile/acilis/N13/191@2027-01": 10000,
    # Ocak mahsubu: İ = devirle gelen, Ocak'a ertelenmiş 10000 → 190 10000
    "mz/satirlar/191/bakiye": 0, "mz/satirlar/190/bakiye": 10000, "mz/satirlar/120|C1/bakiye": 60000,
    "acik/0/kalan": 60000, "bil/pasif/V.F": 50000,
    # ikinci yenileme: I9 F1'i kapatır, F1'in K sonrası bağı (60000) var → çakışma, hiçbir şey değişmez
    "redler": ["DEVIR_YENILE_CAKISMA"], "bil_arsiv/pasif/V.F": 50000,
}}, aciklama="Devri Yenile: geç gelen Aralık faturası (KDV indirimi Ocak'ta, KG-7); Devir Raporu farkı; çakışma listesi.")

# ------------------------------------------------------------------------------------------------ S29
S("s29-devri-geri-al", ["N-15"], [
    o("kasa_acilis", "2026-01-01", tutar=10000),
    o("satis_faturasi", "2026-06-01", id="F1", cari="C1", M=20000, K=0),
    o("satis_faturasi", "2027-01-05", id="F2", cari="C1", M=5000, K=0),
    o("devir", K="2026-12-31", ad="devir"),
    o("satis_faturasi", "2027-01-10", id="F3", cari="C1", M=3000, K=0),
    o("devri_geri_al", ad="geri"),
    MZ("mz", "2026-01-01", "2027-12-31"),
], {"A": {
    "mz/satirlar/120|C1/bakiye": 25000, "mz/satirlar/600/bakiye": -25000, "mz/satirlar/519/bakiye": -10000,
    "geri/kaybolan_hareketler": ["F3"],
}}, aciklama="Devri Geri Al devir öncesi kalıcı yedeğe döner; devirden sonra girilen kayıt kaybolur (BİLİNEN SINIR).")

# ------------------------------------------------------------------------------------------------ S30
S("s30-kilit-kural-farki-kg15", ["Ç3", "KG-15", "N-16", "KG-16"], [
    o("kasa_acilis", "2026-01-01", tutar=100000),
    o("evrak_acilis", "2026-01-01", evrak="CK1", evrak_turu="cek", yon="alinan", durum="portfoy", tutar=30000, cari="C1"),
    o("evrak_acilis", "2026-01-01", evrak="VC1", evrak_turu="cek", yon="verilen", tutar=20000, cari="T1", banka="B1"),
    o("cari_acilis", "2026-01-01", cari="C1", yon="borc", tutar=40000, aciklama="Devreden bakiye"),
    o("borc_yaz", "2026-01-02", id="BY2", cari="C2", tutar=50000, aciklama="Açılış bakiyesi", yedekten=True),   # bakım 8 W1: göç verisi
    o("satis_faturasi", "2026-02-01", id="F1", cari="C3", M=100000, K=0),
    o("donem_kilitle", tarih="2026-03-31", kural="2.4.9"),
    R("fark", "kural_farki"),
    o("satis_faturasi", "2026-03-15", id="FX", cari="C3", M=100, K=0),
    o("satis_faturasi", "2026-04-10", id="F2", cari="C3", M=50000, K=0),
    o("acilis_onayla", kaynak="BY2", karar="onay"),   # bakım 8 W4: kilitli (göçte donan) adayın onayı fişten ÖNCE (B16 sırası)
    o("kural_farki_duzelt"),
    BIL("bil", "2026-04-30"), GT("gt", "2026-01-01", "2026-04-30"), MZ("mz", "2026-01-01", "2026-04-30"),
    BIL("bil0331", "2026-03-31"),
], {"A": {
    "bil0331/pasif/V.A": 150000,
    # donmuş (2.4.9): açılışlar 500, alınan evrak 602, verilen evrak 770, cari açılışı açıklamadan (C1 "Devreden bakiye" → 602.90, BY2 → 500);
    # güncel: hepsi 519 — BY2 de (S47 A: onaya kadar 519, onaylı 519; bakım 7'ye kadar 602.90): 519 = −(100000 + 30000 − 20000 + 40000 + 50000)
    "fark/500": 150000, "fark/519": -200000, "fark/602": 30000, "fark/770": -20000, "fark/602.90": 40000,
    "mz/satirlar/500/bakiye": 0, "mz/satirlar/519/bakiye": -200000, "mz/satirlar/602/bakiye": 0,
    "mz/satirlar/602.90/bakiye": 0,
    "gt/kalemler/A": 150000, "gt/kalemler/E": 0, "gt/kalemler/DNK": 150000,
    "bil/aktif_toplam": 350000, "bil/pasif/V.G": 200000, "bil/kesin_degil": ["TAMAMLANMAMIS_ACILIS"],
    "redler": ["KILITLI_DONEM"], "acilis_olabilir": ["BY2"],
}, "KG15=B": {
    "mz/satirlar/500/bakiye": -150000, "mz/satirlar/519/bakiye": 0, "gt/kalemler/A": 220000, "gt/kalemler/E": 20000,
    "gt/kalemler/DNK": 200000, "bil/pasif/V.A": 150000, "bil/kesin_degil": ["KURAL_DEGISIKLIGI_FARKI"],
    "redler": ["KILITLI_DONEM", "KG15_B_DUZELTILMEZ"],
}}, dallar=["KG15=B"], aciklama="2.4.9 kuralıyla donmuş kilitli dönem; KG-15 A ilk açık güne Kural Farkı Düzeltme Fişi.")

# ------------------------------------------------------------------------------------------------ S31
S("s31-eslestirme-sonra-devir", ["M-11", "N-13", "§6.3"], [
    o("kasa_acilis", "2026-01-01", tutar=50000),
    o("cari_acilis", "2026-01-01", cari="C1", yon="borc", tutar=20000),
    o("acilis_eslestir", tarih="2026-01-01", satirlar=[{"hesap": "500", "alacak": 60000}, {"hesap": "570", "alacak": 10000}]),
    o("satis_faturasi", "2026-05-01", id="F1", cari="C3", M=10000, K=0),
    o("devir", K="2026-12-31", ad="devir"),
    BIL("bil", "2027-01-01"),
], {"A": {
    # EK-2 26: eşleştirmede yıl girilmeyen 570 → 570.0000 "Yılı Belirtilmemiş"
    "devir/yeni_acilis/500": -60000, "devir/yeni_acilis/570.0000": -10000, "devir/yeni_acilis/590": -10000,
    "devir/acilis/N13/519": 80000, "devir/acilis/N13/500": -60000, "bil/kesin_degil": [], "bil/pasif/V.A": 60000,
    "bil/pasif/V.D": 10000, "bil/pasif/V.F": 10000,
}}, aciklama="Eşleştirilmiş açılış (G = 0) devirde de 0 kalır; 500 / 570 aynen açılır.")

# ------------------------------------------------------------------------------------------------ S32
S("s32-yil-donumu-29-subat", ["G-4", "V-01", "KG-12", "N-08", "M11"], [
    o("kasa_acilis", "2027-12-31", tutar=10000),
    o("satis_faturasi", "2027-12-31", id="F1", cari="C1", M=100000, K=20000),
    o("satis_faturasi", "2028-01-01", id="F2", cari="C1", M=50000, K=10000),
    o("alis_faturasi", "2028-02-29", id="A1", cari="T1", fatura_turu="gider", M=30000, K=6000),
    o("kdv_mahsup", ay="2027-12"), o("kdv_mahsup", ay="2028-01"), o("kdv_mahsup", ay="2028-02"),
    GT("gt27", "2027-01-01", "2027-12-31"), GT("gt28", "2028-01-01", "2028-12-31"), BIL("bil", "2028-02-29"),
    o("satis_faturasi", "2028-03-01", id="F3", cari="C1", M=10000, K=0),
    o("devir", K="2028-02-29", ad="devir_red"),                        # M11: K yalnız 31 Aralık → red
    o("devir", K="2028-12-31", bugun="2028-03-02", ad="devir_red2"),   # M11: K geçmiş bir yıl sonu olmalı → red
    o("devir", K="2027-12-31", ad="devir"),
    BIL("bil_yeni", "2028-03-01"),
    GT("gt_yeni", "2028-03-01", "2028-12-31"), R("yev", "yevmiye", bas="2028-03-01", son="2028-03-01"),
    R("yev29", "yevmiye", bas="2028-02-29", son="2028-02-29"),
], {"A": {
    "gt27/kalemler/DNK": 100000, "gt28/kalemler/DNK": 20000,
    "bil/donem_net_kari": 20000, "bil/gecmis_yillar_kapanmamis": 100000, "bil/aktif/I.H": 6000, "bil/pasif/III.F": 30000,
    "bil/aktif_toplam": 196000,
    "redler": ["DEVIR_K_31_ARALIK", "DEVIR_K_GELECEK"],
    # K = 2027-12-31: arşivde 2027 (F1 100000 → 590); yeni yıl 01.01.2028 açılışı; 2028 kayıtları yeni yılda
    "devir/yeni_acilis/590": -100000, "devir/yeni_acilis/120|C1": 120000, "devir/yeni_acilis/360": -20000,
    "devir/yeni_acilis/100": 10000, "devir/yeni_acilis/519": -10000,
    # 01.03.2028: 590 100000 (açılış) + hesaplanmış 2028 kârı 50000 − 30000 + 10000 = 30000 → V.F 130000
    "bil_yeni/pasif/V.F": 130000, "bil_yeni/donem_net_kari": 30000, "bil_yeni/kesin_degil": ["TAMAMLANMAMIS_ACILIS"],
    "gt_yeni/kalemler/A": 10000, "yev/0/sinif": 1, "yev/-1/kaynak": "F3",
    # 29 Şubat 2028 mahsup fişi ayın son günü (dönem sonu sınıfı)
    "yev29/1/tur": "kdv_mahsup", "yev29/1/tarih": "2028-02-29", "yev29/1/sinif": 2,
}}, aciklama="Yıl dönümü (31.12 / 01.01), 29 Şubat 2028 mahsup tarihi; K yalnız geçmiş bir yılın 31 Aralık'ı (EK-1 M11).")

# ------------------------------------------------------------------------------------------------ S33
S("s33-gecikmis-b1", ["B1", "H-01", "T-04"], [
    o("satis_faturasi", "2026-01-10", id="F1", cari="C1", M=100000, K=0, vade="2026-02-10"),
    o("satis_faturasi", "2026-02-10", id="F2", cari="C1", M=60000, K=0, vade="2026-03-10"),
    o("satis_faturasi", "2026-03-01", id="F3", cari="C1", M=120000, K=0),
    o("taksit_karti", "2026-03-01", id="TK1", cari="C1", kaynak="fatura", fatura="F3", toplam=120000,
      taksitler=[{"vade": "2026-04-01", "tutar": 40000}, {"vade": "2026-05-01", "tutar": 40000}, {"vade": "2026-06-01", "tutar": 40000}]),
    o("tahsilat", "2026-03-15", cari="C1", yol="nakit", tutar=70000),
    o("tahsilat", "2026-03-20", cari="C1", yol="cek", evrak="CK1", tutar=60000, fatura="F2"),
    o("tahsilat", "2026-04-01", cari="C1", yol="nakit", tutar=40000, taksit_karti="TK1"),
    o("borc_yaz", "2026-04-05", cari="C1", tutar=10000, aciklama="Gecikme bedeli", vade="2026-04-20"),
    R("gec0401", "gecikmis", cari="C1", tarih="2026-04-01"), R("gec0501", "gecikmis", cari="C1", tarih="2026-05-01"),
    R("gec0515", "gecikmis", cari="C1", tarih="2026-05-15"),
], {"A": {
    # bağsız 70000 en eski faturaya (F1 → 30000); F2 çekle kapandı; F3 yalnız taksit (05-01 40000); vadeli borç 10000
    # 05-01'de 05-01 vadeli taksit henüz gecikmiş değil (vade < tarih)
    "gec0401/gecikmis": 30000, "gec0501/gecikmis": 40000, "gec0515/gecikmis": 80000,
}, "B1=B": {
    "gec0401/gecikmis": 0, "gec0501/gecikmis": 10000, "gec0515/gecikmis": 50000,
}}, dallar=["B1=B"], aciklama="Ortak gecikmiş borç (B1): vadesi geçmiş fatura kalanı, taksitli faturada taksit, çekle kapanan.")

# ------------------------------------------------------------------------------------------------ S34
S("s34-ocakta-aralik-iadesi", ["F-09", "G13.1", "N-10"], [
    o("alis_faturasi", "2026-11-01", id="A1", cari="T1", fatura_turu="stok", M=100000, K=20000, kalemler=[{"urun": "U1", "miktar": 10}]),
    o("satis_faturasi", "2026-12-15", id="F1", cari="C1", M=150000, K=30000, kalemler=[{"urun": "U1", "miktar": 5}]),
    o("kdv_mahsup", ay="2026-11"), o("kdv_mahsup", ay="2026-12"),
    o("devir", K="2026-12-31", ad="devir"),
    o("satis_iade_faturasi", "2027-01-10", id="I1", cari="C1", M=30000, K=6000, asil_fatura="F1", kalemler=[{"urun": "U1", "miktar": 1}]),
    o("kdv_mahsup", ay="2027-01"),
    R("acik", "acik_faturalar", cari="C1", tarih="2027-01-31"), GT("gt", "2027-01-01", "2027-01-31"), BIL("bil", "2027-01-31"),
], {"A": {
    "devir/kapanis/sonuc": 100000, "devir/yeni_acilis/360": -10000,
    "acik/0/kalan": 144000, "gt/kalemler/B": 30000, "gt/kalemler/D": -10000, "gt/kalemler/DNK": -20000,
    "bil/aktif/I.E": 60000, "bil/aktif/I.H": 6000, "bil/aktif_toplam": 210000, "bil/pasif/V.F": 80000,
}}, aciklama="Ocak'ta Aralık faturasının iadesi: açık kalemi önce kapatır; 610 / 191 yeni yılda; stok geri girer.")

# ------------------------------------------------------------------------------------------------ S35
S("s35-banka-ters-kayit", ["R-01", "R-02", "KG-18"], [
    o("banka_acilis", "2026-01-01", banka="B1", tutar=100000),
    o("banka_masraf", "2026-03-01", id="M1", banka="B1", tutar=5000),
    o("banka_diger_gider", "2026-03-02", id="M2", banka="B1", tutar=2000),
    BIL("bil04", "2026-03-04"),
    o("ters", "2026-03-05", hedef="M1"),
    o("ters", "2026-03-06", hedef="M2"),
    o("banka_masraf", "2026-03-06", banka="B1", tutar=2500),
    BIL("bil", "2026-03-31"), GT("gt", "2026-01-01", "2026-03-31"), MZ("mz", "2026-01-01", "2026-03-31"),
], {"A": {
    "bil04/aktif/I.A": 93000, "bil04/pasif/V.F": -7000,
    "bil/aktif/I.A": 97500, "gt/kalemler/E": 2500, "gt/kalemler/G": 0, "gt/kalemler/DNK": -2500,
    "mz/satirlar/770/borc": 7500, "mz/satirlar/770/alacak": 5000,
}}, aciklama="Banka ters kaydı girildiği gün; asıl ve ters madde ikisi de kalır; Düzelt = ters + doğrusu.")

# ------------------------------------------------------------------------------------------------ S36
S("s36-yuvarlama-kg2-ic-yuzde", ["G-1", "KG-2", "§5.2"], [
    o("kasa_acilis", "2026-01-01", tutar=10000),
    o("stok_giris", "2026-01-02", urun="U1", miktar=2, tutar=600, karsi="nakit"),
    o("stok_cikis_satis", "2026-01-03", urun="U1", miktar=1, tutar=1001, karsi="nakit"),
    o("stok_cikis_satis", "2026-01-04", urun="U1", miktar=1, tutar=999, karsi="nakit"),
    o("stok_giris", "2026-01-05", urun="U3", miktar=3, tutar=1000, karsi="nakit"),
    o("stok_cikis_satis", "2026-01-06", urun="U3", miktar=1, tutar=500, karsi="nakit"),
    GT("gt", "2026-01-01", "2026-01-31"), R("deg", "degerleme", tarih="2026-01-31"), MZ("mz", "2026-01-01", "2026-01-31"),
], {"A": {
    # U3: 2 × 1000/3 = 666,67 → 667; SMM = 1600 − 667 = 933
    "deg/toplam": 667, "gt/kalemler/A": 2500, "gt/kalemler/D": 933, "gt/kalemler/DNK": 1567, "mz/satirlar/100/bakiye": 10900,
}, "KG2=B": {
    # 1001 × 20/120 = 166,83 → 167; 999 × 20/120 = 166,5 → 167 (yarım yukarı)
    "mz/satirlar/391/bakiye": -334, "gt/kalemler/A": 2166, "gt/kalemler/DNK": 1233,
}}, dallar=["KG2=B"], aciklama="Yuvarlama kuralı (yarım yukarı, ürün başına) ve iç yüzde KDV.")

# ------------------------------------------------------------------------------------------------ S37
S("s37-kart-borcuna-aktar", ["K-15", "M-05"], [
    o("alis_faturasi", "2026-01-10", id="A1", cari="T1", fatura_turu="gider", M=50000, K=0),
    o("kart_borcuna_aktar", "2026-01-15", cari="T1", kart="KK1", tutar=20000, acilistan_once=True),
    o("kart_acilis", "2026-02-01", kart="KK1", tutar=100000),
    o("kart_borcuna_aktar", "2026-02-10", cari="T1", kart="KK1", tutar=30000),
    BIL("bil", "2026-02-28"), MZ("mz", "2026-01-01", "2026-02-28"),
], {"A": {
    "mz/satirlar/320|T1/bakiye": 0, "mz/satirlar/309.KK1/bakiye": -130000, "mz/satirlar/519/bakiye": 80000,
    "bil/pasif/III.A": 130000, "bil/pasif/V.G": -80000, "bil/pasif/V.F": -50000, "bil/aktif_toplam": 0,
}}, aciklama="Kart Borcuna Aktar: açılıştan önceki hareket G'ye, sonraki 309'a.")

# ------------------------------------------------------------------------------------------------ S38
S("s38-cari-tur-degistir", ["G-2", "KG-25"], [
    o("kasa_acilis", "2026-03-01", tutar=100000),
    o("odeme", "2026-03-01", cari="D1", yol="nakit", tutar=10000),
    o("borc_yaz", "2026-03-02", cari="D1", tutar=30000, aciklama="Bedel"),
    BIL("bil1", "2026-03-31"),
    o("cari_tur_degistir", cari="D1", yeni_tur="musteri"),
    MZ("mz", "2026-03-01", "2026-03-31"), BIL("bil2", "2026-03-31"),
    o("donem_kilitle", tarih="2026-03-31"),
    o("cari_tur_degistir", cari="D1", yeni_tur="tedarikci"),
], {"A": {
    "bil1/aktif/I.D": 40000, "bil1/detay/I.D/336|D1": 40000, "mz/satirlar/120|D1/bakiye": 40000, "bil2/aktif/I.C": 40000,
    "redler": ["KILITLI_DONEM"],
}}, aciklama="Diğer cari 336; açık dönemde tür değişince maddeler yeni hesapla; kilitliyken değişmez.")

# ------------------------------------------------------------------------------------------------ S39
S("s39-mahsup-acik-kalem", ["F-16", "G2", "N-10"], [
    o("satis_faturasi", "2026-03-01", id="F1", cari="C1", M=100000, K=0),
    o("satis_faturasi", "2026-03-10", id="F2", cari="C1", M=50000, K=0),
    o("alis_faturasi", "2026-03-15", id="A1", cari="C1", fatura_turu="gider", M=30000, K=0),
    o("mahsup", "2026-03-20", fatura1="F2", fatura2="A1", tutar=30000),
    R("acik", "acik_faturalar", cari="C1", tarih="2026-03-31"), MZ("mz", "2026-03-01", "2026-03-31"),
    o("devir", K="2026-12-31", ad="devir"),
], {"A": {
    # mahsup madde üretmez (cari içi kapama); açık kalem dağıtımında F2 ↔ A1 önce eşleşir, F1 dokunulmaz (FIFO olsaydı F1 70000 / F2 50000)
    "acik/0/fatura": "F1", "acik/0/kalan": 100000, "acik/1/fatura": "F2", "acik/1/kalan": 20000,
    "mz/satirlar/120|C1/bakiye": 120000, "mz/toplam/borc": 180000,
    "devir/yeni_acilis/120|C1": 120000, "devir/acilis/acik_kalemler/0/kalan": 100000, "devir/acilis/acik_kalemler/1/kalan": 20000,
}}, aciklama="Mahsup Et (aynı cari): madde yok; açık kalemler mahsuba göre.")

# ================================================================================================ EK-1 + kullanıcı kararları S1–S5 (05.11.2026)
# Bu bölümdeki beklenen sayılar model DEĞİŞTİRİLMEDEN ÖNCE elle yazıldı (EK-1 §1 Tek Yükümlülük Kuyruğu, M1–M14, S1–S5 A).
# TYK okuması (README "KARAR GEREKİYOR" 23): olaylar tarih sırasıyla işlenir; bağsız alacak, O ANDA açık borç kalemlerine vadesi ilk
# gelenden (eşitse belge tarihi, sonra giriş sırası) uygulanır; bağ (Kapatılacak Fatura, Mahsup Et, kart tahsilatı, iade) hedefini önce kapatır.

# ------------------------------------------------------------------------------------------------ S40
S("s40-s1-vadesiz-gecikmis", ["S1", "M1b", "M1c", "M1d", "M1f", "B1", "H-07", "Ç-07"], [
    o("cari_acilis", "2026-01-01", id="AC1", cari="C1", yon="borc", tutar=10000),
    o("satis_faturasi", "2026-01-31", id="F1", cari="C1", M=20000, K=0),
    o("borc_yaz", "2026-02-28", id="BY1", cari="C1", tutar=5000, aciklama="Fark"),
    o("satis_faturasi", "2026-03-01", id="F2", cari="C3", M=30000, K=0, vade="2026-06-30"),
    o("tahsilat", "2026-03-02", cari="C3", yol="cek", evrak="CK1", tutar=30000, fatura="F2"),
    o("evrak_karsiliksiz", "2026-03-31", evrak="CK1"),
    o("taksit_karti", "2026-11-01", id="TK1", cari="C2", kaynak="yeni_borc", toplam=60000,
      taksitler=[{"vade": "2026-12-01", "tutar": 30000}, {"vade": "2027-01-01", "tutar": 30000}]),
    o("tahsilat", "2026-12-01", cari="C2", yol="nakit", tutar=30000, taksit_karti="TK1"),
    R("g1", "gecikmis", cari="C1", tarih="2026-01-01"), R("g2", "gecikmis", cari="C1", tarih="2026-01-02"),
    R("g3", "gecikmis", cari="C1", tarih="2026-01-31"), R("g4", "gecikmis", cari="C1", tarih="2026-02-01"),
    R("g5", "gecikmis", cari="C1", tarih="2026-02-28"), R("g6", "gecikmis", cari="C1", tarih="2026-03-01"),
    R("g7", "gecikmis", cari="C3", tarih="2026-03-31"), R("g8", "gecikmis", cari="C3", tarih="2026-04-01"),
    R("g9", "gecikmis", cari="C2", tarih="2026-12-15"),
    o("taksit_kapat", "2026-12-31", kart="TK1"),
    R("g10", "gecikmis", cari="C2", tarih="2026-12-31"), R("g11", "gecikmis", cari="C2", tarih="2027-01-01"),
    R("h", "hatirlatma", tarih="2027-01-01"), R("g8b", "gecikmis", cari="C3", tarih="2026-07-01"),
], {"A": {
    # S1 A: vadesiz kalemin vadesi belge / işlem günü; M1f: vade günü gecikmiş DEĞİL, ertesi gün gecikmiş
    "g1/gecikmis": 0, "g2/gecikmis": 10000,                      # açılış 01-01
    "g3/gecikmis": 10000, "g4/gecikmis": 30000,                  # vadesiz fatura 31 Ocak (ay sonu) → 1 Şubat
    "g5/gecikmis": 30000, "g6/gecikmis": 35000,                  # vadesiz Borç Yaz 28 Şubat → 1 Mart
    # bakım 2 — S8 A (kullanıcı 21:08) + EK-2 K-1: F2'yi (vade 30.06) kapatan BAĞLI çek karşılıksız → F2 kendi vadesiyle yeniden açılır
    # (eski M1c beklentisi g8 30000 idi); 01.07'de gecikmiş
    "g7/gecikmis": 0, "g8/gecikmis": 0, "g8b/gecikmis": 30000,
    "g9/gecikmis": 0,                                            # kart açıkken 2027-01-01 taksiti henüz gelmedi
    # M1d: Kartı Kapat (31.12) → kalan 30000 kapatma tarihli tek kalem → yıl dönümünde (01.01) gecikmiş
    "g10/gecikmis": 0, "g11/gecikmis": 30000,
    "h/otomatik": {"C1": 35000, "C2": 30000, "C3": 30000}, "h/supheli_etiketli": [],
}}, aciklama="S1: vadesiz açılış / fatura / Borç Yaz / karşılıksız çek / kapatılan kart kalanı ertesi gün gecikmiş (ay sonu, yıl dönümü).")

# ------------------------------------------------------------------------------------------------ S41
S("s41-s2-vade-sirasi", ["S2", "M1a", "TBK 102"], [
    o("satis_faturasi", "2026-03-01", id="F1", cari="C1", M=50000, K=0, vade="2026-06-30"),
    o("satis_faturasi", "2026-03-01", id="F6", cari="C2", M=40000, K=0, vade="2026-06-30"),
    o("tahsilat", "2026-04-01", cari="C2", yol="nakit", tutar=40000),
    o("satis_faturasi", "2026-05-10", id="F2", cari="C1", M=30000, K=0),
    o("satis_faturasi", "2026-05-10", id="F7", cari="C2", M=40000, K=0),
    o("tahsilat", "2026-05-20", cari="C1", yol="nakit", tutar=30000),
    R("g1", "gecikmis", cari="C1", tarih="2026-05-21"), R("g2", "gecikmis", cari="C1", tarih="2026-07-01"),
    R("acik1", "acik_faturalar", cari="C1", tarih="2026-05-31"), R("g3", "gecikmis", cari="C2", tarih="2026-05-11"),
    o("satis_faturasi", "2026-08-01", id="F3", cari="C3", M=10000, K=0, vade="2026-09-30"),
    o("satis_faturasi", "2026-08-15", id="F4", cari="C3", M=10000, K=0, vade="2026-09-30"),
    o("borc_yaz", "2026-08-10", id="BY5", cari="C3", tutar=10000, aciklama="Fark", vade="2026-09-30"),
    o("tahsilat", "2026-08-20", cari="C3", yol="nakit", tutar=15000),
    R("ak3", "acik_kalemler", cari="C3", tarih="2026-08-31"),
], {"A": {
    # S2 A: bağsız 30000 vadesi ilk gelene → F2 (vade 05-10) kapanır, belge tarihi eski F1 (vade 06-30) açık kalır
    "g1/gecikmis": 0, "g2/gecikmis": 50000,
    "acik1": [{"fatura": "F1", "kalan": 50000, "vade": "2026-06-30", "tarih": "2026-03-01"}],
    # ödeme günü yalnız F6 vardı → F6 kapandı; sonra gelen vadesiz F7 ertesi gün gecikmiş (KARAR GEREKİYOR 23: "havuz" okumasında 0)
    "g3/gecikmis": 40000,
    # eşit vadede belge tarihi: F3 (08-01) 10000, BY5 (08-10) 5000 → açık BY5 5000, F4 10000 (giriş sırası F4 önce olsa da)
    "ak3/0/k": "borc:BY5", "ak3/0/kalan": 5000, "ak3/1/k": "fatura:F4", "ak3/1/kalan": 10000,
}}, aciklama="S2: bağsız ödeme vadesi en önce gelen borca (belge sırası ile vade sırası ayrışır); eşit vadede belge tarihi.")

# ------------------------------------------------------------------------------------------------ S42
S("s42-s3-supheli-hatirlatma", ["S3", "M13", "J-01", "J-06"], [
    o("satis_faturasi", "2026-01-10", id="F1", cari="C1", M=100000, K=0, vade="2026-02-10"),
    o("satis_faturasi", "2026-01-20", id="F2", cari="C1", M=50000, K=0, vade="2026-03-20"),
    o("satis_faturasi", "2026-01-25", id="F3", cari="C3", M=20000, K=0),
    o("supheliye_al", "2026-04-01", id="S1", cari="C1", tutar=120000),
    R("g1", "gecikmis", cari="C1", tarih="2026-04-02"), R("h1", "hatirlatma", tarih="2026-04-02"),
    o("tahsilat", "2026-04-10", cari="C1", yol="havale", banka="B1", tutar=30000, normal_cari=True),   # K3: 120'de kalır
    R("g2", "gecikmis", cari="C1", tarih="2026-04-11"), R("h2", "hatirlatma", tarih="2026-04-11"),
    o("supheliden_cikar", "2026-05-01", cari="C1", kayit="S1"),
    R("g3", "gecikmis", cari="C1", tarih="2026-05-01"), R("acik", "acik_faturalar", cari="C1", tarih="2026-05-01"),
    R("h3", "hatirlatma", tarih="2026-05-01"),
], {"A": {
    # M13: J-01 120000 vadesi ilk gelenden çıkar → F1 100000 + F2 20000 şüpheli kuyruğuna; CH'de F2 30000
    # bakım 2 — S7 A (kullanıcı 21:08, EK-2 29): şüpheli kaydı AÇIK müşteri otomatik listeye HİÇ girmez (eski: tutar bazında C1 30000);
    # etiketle görünür, elle seçilirse şüphelisiz gecikmiş (30000)
    "g1/gecikmis": 30000, "g1/supheli": 120000,
    "h1/otomatik": {"C3": 20000}, "h1/supheli_etiketli": ["C1"], "h1/elle": {"C1": 30000},
    "g2/gecikmis": 0, "g2/supheli": 120000,
    "h2/otomatik": {"C3": 20000}, "h2/supheli_etiketli": ["C1"],
    # Şüpheliden Çıkar'dan sonra kayıt kapalı → otomatik listeye döner
    "h3/otomatik": {"C1": 120000, "C3": 20000}, "h3/supheli_etiketli": [], "h3/elle": {},
    # J-06: kalemler KENDİ vadeleriyle (02-10, 03-20) CH kuyruğuna döner → 01.05'te gecikmiş
    "g3/gecikmis": 120000, "g3/supheli": 0,
    "acik/0/fatura": "F1", "acik/0/kalan": 100000, "acik/1/fatura": "F2", "acik/1/kalan": 20000,
}}, aciklama="S3 + M13: şüpheliye alınan borç gecikmiş / otomatik hatırlatma dışında; Şüpheliden Çıkar kalemleri kendi vadeleriyle döndürür.")

# ------------------------------------------------------------------------------------------------ S43
S("s43-s4-mahsuptan-sonra-ters", ["S4", "M8-6", "V-01", "R-01", "K-09", "KG-18"], [
    o("banka_acilis", "2026-01-01", banka="B1", tutar=100000),
    o("banka_masraf_faturali", "2026-03-10", id="M1", banka="B1", M=10000, K=2000),
    o("satis_faturasi", "2026-03-15", id="F1", cari="C1", M=50000, K=10000),
    o("kdv_mahsup", ay="2026-03"),
    o("ters", "2026-04-05", hedef="M1"),
    o("satis_faturasi", "2026-04-20", id="F2", cari="C1", M=20000, K=4000),
    o("kdv_mahsup", ay="2026-04"),
    MZ("mz", "2026-01-01", "2026-04-30"), BIL("bil", "2026-04-30"),
    # bakım 3 (ana oturum K6): eski {"K": 12000} 50.000 matraha %24 KDV'ydi (geçerli oranlar %0 / %1 / %10 / %20) → faturanın kendi oranıyla (%20)
    o("duzenle", kaynak="F1", degisiklik={"M": 60000, "K": 12000}),
    BIL("bil2", "2026-04-30"),
], {"A": {
    # Mart: H 10000, İ 2000 → A 360 8000. Ters kayıt (04-05) 191'i 2000 alacaklandırır → KENDİ ayına (Nisan) etiketlenir.
    # Nisan: H 4000, İ = net −2000, D 0 → net −6000 → B 391 4000, B 191 2000, A 360 6000. 191 eksiye düşmez.
    "mz/satirlar/191/bakiye": 0, "mz/satirlar/391/bakiye": 0, "mz/satirlar/190/bakiye": 0, "mz/satirlar/360/bakiye": -14000,
    "mz/satirlar/770/bakiye": 0,
    "bil/aktif/I.A": 100000, "bil/aktif/I.C": 84000, "bil/pasif/III.F": 14000, "bil/pasif/V.F": 70000,
    "bil/kesin_degil": ["TAMAMLANMAMIS_ACILIS"],
    # mahsubu yapılmış ayın kaydı düzenlendi → "KDV Mahsubu Güncel Değil" + Kesin Değil (engel yok)
    "bil2/kesin_degil": ["KDV_MAHSUBU_GUNCEL_DEGIL:2026-03", "TAMAMLANMAMIS_ACILIS"],
}}, aciklama="S4: mahsuptan sonra 191'i azaltan ters kayıt girildiği ayın mahsubunda (net hareket); düzenlenen ay için uyarı.")

# ------------------------------------------------------------------------------------------------ S44
S("s44-s5-iptalde-avans", ["S5", "M10", "F-15", "F-12"], [
    o("satis_faturasi", "2026-07-01", id="F1", cari="C1", M=100000, K=0, vade="2026-07-31"),
    o("tahsilat", "2026-07-01", id="P1", cari="C1", yol="nakit", tutar=30000, fatura="F1", fatura_odemesi=True),
    o("tahsilat", "2026-07-05", id="P2", cari="C1", yol="havale", banka="B1", tutar=20000, fatura="F1"),
    o("iptal", kaynak="F1"),
    MZ("mz", "2026-07-01", "2026-07-31"), BIL("bil", "2026-07-31"),
    R("acik1", "acik_faturalar", cari="C1", tarih="2026-07-31"), R("g1", "gecikmis", cari="C1", tarih="2026-08-15"),
    o("satis_faturasi", "2026-08-01", id="F2", cari="C1", M=50000, K=0),
    R("g2", "gecikmis", cari="C1", tarih="2026-08-02"), R("acik2", "acik_faturalar", cari="C1", tarih="2026-08-02"),
], {"A": {
    # S5 A: formdaki peşin (P1) faturayla düşer; ayrıca bağlanan P2 avans kalır (340)
    "mz/satirlar/120|C1/bakiye": -20000, "mz/satirlar/100/bakiye": 0, "mz/satirlar/102.B1/bakiye": 20000,
    "bil/aktif/I.A": 20000, "bil/pasif/III.D": 20000, "acik1": [], "g1/gecikmis": 0,
    # sonraki fatura avansla kendiliğinden kapanır: 50000 − 20000
    "g2/gecikmis": 30000, "acik2/0/fatura": "F2", "acik2/0/kalan": 30000,
}}, aciklama="S5: fatura iptalinde yalnız formdaki peşin ödeme düşer; ayrıca bağlanan tahsilat cariye avans kalır.")

# ------------------------------------------------------------------------------------------------ S45
S("s45-m2-devirde-gecikmis-ayni", ["M2", "M9", "N-10", "N-14", "G7", "S1", "S2"], [
    o("cari_acilis", "2026-01-01", id="AC1", cari="C1", yon="borc", tutar=10000),
    o("borc_yaz", "2026-11-01", id="BY1", cari="C1", tutar=20000, aciklama="Fark", vade="2027-02-15"),
    o("satis_faturasi", "2026-12-10", id="F1", cari="C1", M=30000, K=0, vade="2027-01-20"),
    o("tahsilat", "2026-12-20", cari="C1", yol="nakit", tutar=5000),
    o("satis_faturasi", "2027-01-05", id="F2", cari="C1", M=8000, K=0),
    o("tahsilat", "2027-01-10", cari="C1", yol="nakit", tutar=8000),
    R("gec_once", "gecikmis", cari="C1", tarih="2027-01-21"),
    o("devir", K="2026-12-31", ad="devir"),
    o("tahsilat", "2027-01-25", id="P9", cari="C1", yol="nakit", tutar=25000, fatura="F1"),
    R("gec0111", "gecikmis", cari="C1", tarih="2027-01-11"), R("gec0121", "gecikmis", cari="C1", tarih="2027-01-21"),
    R("gec0216", "gecikmis", cari="C1", tarih="2027-02-16"),
    o("devri_yenile", ad="yenile", bugun="2027-02-16", duzeltmeler=[
        o("satis_iade_faturasi", "2026-12-28", id="I9", cari="C1", M=10000, K=0, asil_fatura="F1")]),
    R("gec_sonra", "gecikmis", cari="C1", tarih="2027-02-16"), R("acik", "acik_faturalar", cari="C1", tarih="2027-02-16"),
], {"A": {
    # K'de açık: açılış 5000 (vade 2026-01-01), F1 30000 (vade 2027-01-20), BY1 20000 (vade 2027-02-15) → her biri AYRI devir
    # açık kalemi kendi vadesiyle (M2 A); net kalan 0. Ocak: F2 8000, tahsilat 8000 → açılış 5000 + F2 3000.
    "gec_once/gecikmis": 35000,
    "devir/acilis/acik_kalemler/0/k": "acilis:AC1", "devir/acilis/acik_kalemler/0/kalan": 5000,
    "devir/acilis/acik_kalemler/0/vade": "2026-01-01", "devir/acilis/acik_kalemler/1/k": "fatura:F1",
    "devir/acilis/acik_kalemler/1/kalan": 30000, "devir/acilis/acik_kalemler/2/k": "borc:BY1",
    "devir/acilis/acik_kalemler/2/kalan": 20000, "devir/acilis/acik_kalemler/2/vade": "2027-02-15",
    "devir/acilis/cariler/C1/bakiye": 55000, "devir/acilis/cariler/C1/acilis": 0,
    "gec0111/gecikmis": 5000, "gec0121/gecikmis": 35000,
    # P9 25000 F1'e bağlı → F1 5000: 5000 (F2) + 5000 (F1) + 20000 (BY1)
    "gec0216/gecikmis": 30000,
    # Devri Yenile: I9 F1'i 20000'e indirir; P9'un bağı korunur, kapattığı 25000 → 20000, fazla 5000 bağsız → F2'yi kapatır (M9 A:
    # kısmi düşüşte çakışma yok)
    "yenile/bag_degisen/P9/once": 25000, "yenile/bag_degisen/P9/sonra": 20000,
    "yenile/gecikmis_degisen/C1/once": 30000, "yenile/gecikmis_degisen/C1/sonra": 20000,
    "gec_sonra/gecikmis": 20000, "acik": [], "redler": [],
}}, aciklama="M2: devirde her açık kalem kendi vadesiyle — gecikmiş devirden önce ve sonra aynı; Devri Yenile'de kısmi düşüş (M9).")

# ------------------------------------------------------------------------------------------------ S46
S("s46-m3-m12-tek-net-satir-ekstre", ["M3", "M12", "KG-17", "G14", "§11.3", "M14"], [
    o("kasa_acilis", "2026-01-01", tutar=100000),
    o("satis_faturasi", "2026-10-01", id="F1", cari="C1", M=40000, K=0, vade="2027-01-31"),
    o("satis_faturasi", "2026-11-01", id="F2", cari="C1", M=60000, K=0, vade="2027-02-28"),
    o("tahsilat", "2026-11-15", cari="C1", yol="nakit", tutar=10000),
    o("alis_faturasi", "2026-12-01", id="A1", cari="T1", fatura_turu="gider", gider_turu="genel", M=25000, K=0, vade="2027-01-15"),
    o("odeme", "2026-12-05", cari="T1", yol="nakit", tutar=5000),
    o("satis_faturasi", "2026-11-20", id="F9", cari="C3", M=10000, K=0),
    o("tahsilat", "2026-11-25", cari="C3", yol="nakit", tutar=10000, fatura="F9"),
    o("devir", K="2026-12-31", ad="devir"),
    R("bd120", "buyuk_defter", hesap="120", bas="2027-01-01", son="2027-01-01"),
    R("bd320", "buyuk_defter", hesap="320", bas="2027-01-01", son="2027-01-01"),
], {"A": {
    # M3: defterde cari başına TEK satır = K bakiyesi (açık kalemler dahil): C1 90000, T1 −20000; C3 (bakiye 0) satırsız
    "bd120/satir_sayisi": 1, "bd120/toplam_borc": 90000, "bd320/satir_sayisi": 1, "bd320/toplam_alacak": 20000,
    "devir/yeni_acilis/120|C1": 90000, "devir/yeni_acilis/320|T1": -20000, "devir/yeni_acilis/100": 115000,
    "devir/yeni_acilis/590": -85000,
    # M12: ekstre satırları K+1; Borç Toplamı = 100000 − (30000 + 60000); Alacak Toplamı = 10000; açık kalemler vade sırasıyla
    "devir/acilis/ekstre_cariler": ["C1", "T1"],
    # EK-2 27: toplam satırı K+1, VADESİZ
    "devir/acilis/ekstre/C1/satirlar/0/tarih": "2027-01-01", "devir/acilis/ekstre/C1/satirlar/0/borc": 10000,
    "devir/acilis/ekstre/C1/satirlar/0/vade": None, "devir/acilis/ekstre/C1/satirlar/1/vade": None,
    "devir/acilis/ekstre/C1/satirlar/1/alacak": 10000, "devir/acilis/ekstre/C1/satirlar/1/bakiye": 0,
    "devir/acilis/ekstre/C1/satirlar/2/aciklama": "Devir: F1 (2026-10-01)", "devir/acilis/ekstre/C1/satirlar/2/vade": "2027-01-31",
    "devir/acilis/ekstre/C1/satirlar/2/borc": 30000, "devir/acilis/ekstre/C1/satirlar/3/borc": 60000,
    "devir/acilis/ekstre/C1/satirlar/3/bakiye": 90000,
    # T1: borç 5000 − 0; alacak 25000 − açık A1 20000 = 5000; A1 kendi vadesiyle
    "devir/acilis/ekstre/T1/satirlar/0/borc": 5000, "devir/acilis/ekstre/T1/satirlar/1/alacak": 5000,
    "devir/acilis/ekstre/T1/satirlar/2/aciklama": "Devir: A1 (2026-12-01)", "devir/acilis/ekstre/T1/satirlar/2/alacak": 20000,
    "devir/acilis/ekstre/T1/satirlar/2/vade": "2027-01-15", "devir/acilis/ekstre/T1/satirlar/2/bakiye": -20000,
}}, aciklama="M3 defterde cari başına tek net satır; M12 ekstre satırları (K+1, Borç / Alacak Toplamı, açık kalemler); bakiyesi 0 cariye satır yok.")

# ------------------------------------------------------------------------------------------------ S47
S("s47-m4-onceki-yil-kilitli", ["M4", "KG-12", "N-08", "N-01", "§5.2", "Ç3"], [
    o("kasa_acilis", "2024-01-01", tutar=100000),
    o("kasa_cikis", "2024-03-01", tutar=3000),
    o("alis_faturasi", "2025-02-01", id="A1", cari="T1", fatura_turu="stok", M=50000, K=0, kalemler=[{"urun": "U1", "miktar": 10}]),
    o("satis_faturasi", "2025-06-01", id="F1", cari="C1", M=40000, K=0, kalemler=[{"urun": "U1", "miktar": 4}]),
    o("alis_faturasi", "2025-07-01", id="G1", cari="T1", fatura_turu="gider", gider_turu="genel", M=10000, K=0),
    o("donem_kilitle", tarih="2025-12-31"),
    o("alis_faturasi", "2026-03-01", id="A2", cari="T1", fatura_turu="stok", M=40000, K=0, kalemler=[{"urun": "U1", "miktar": 10}]),
    o("satis_faturasi", "2026-05-01", id="F2", cari="C1", M=20000, K=0, kalemler=[{"urun": "U1", "miktar": 12}]),
    o("kasa_cikis", "2026-06-01", tutar=5000),
    BIL("bil_once", "2026-12-31"),
    o("devir", K="2026-12-31", ad="devir"),
    MZ("mz_arsiv", "2026-01-01", "2026-12-31", dosya="arsiv"), R("yev25", "yevmiye", dosya="arsiv", bas="2025-12-31", son="2025-12-31"),
    GT("gt25", "2025-01-01", "2025-12-31", dosya="arsiv"), GT("gt26", "2026-01-01", "2026-12-31", dosya="arsiv"),
    BIL("bil_arsiv", "2026-12-31", dosya="arsiv"), R("yevK", "yevmiye", dosya="arsiv", bas="2026-12-31", son="2026-12-31"),
], {"A": {
    # bakım 2 — EK-2 25 / E13: K günü sıra Önceki Yıl Sonucu (2024, 2025; sınıf 4) → N-01 (sınıf 2) → N-02 … (sınıf 3)
    "yevK/0/tur": "onceki_yil_sonucu", "yevK/0/sinif": 4, "yevK/1/tur": "onceki_yil_sonucu", "yevK/1/sinif": 4,
    "yevK/2/tur": "stok_degerleme", "yevK/2/sinif": 2, "yevK/3/tur": "kapanis", "yevK/3/sinif": 3,
    # 2024 fişi (önce sonuç hesaplarının tersi, sonra 570 / 580): A 770.90 3000 / B 580.2024 3000 (SMM 0)
    "yevK/0/satirlar/0/h": "770.90", "yevK/0/satirlar/0/a": 3000, "yevK/0/satirlar/1/h": "580.2024", "yevK/0/satirlar/1/b": 3000,
    # 2024: R −3000 (zarar). 2025: SMM = 0 + 50000 − 6 × 5000 = 20000; R = 40000 − 10000 − 20000 = 10000 (kâr).
    # 2026: birim (30000 + 40000) / 16 = 4375; DSS 4 × 4375 = 17500; SMM 52500; R = 20000 − 5000 − 52500 = −37500.
    "bil_once/donem_net_kari": -37500, "bil_once/gecmis_yillar_kapanmamis": 7000, "bil_once/pasif/V.K": 7000,
    "bil_once/gecmis_yillar_kar": 10000, "bil_once/gecmis_yillar_zarar": 3000,
    # M4: önceki yıllar için K tarihli, kapanış sınıflı "Önceki Yıl Sonucu Fişi" (yıl yıl, 570 / 580 brüt); 2025 kilitli → o tarihe fiş YOK
    "devir/kapanis/onceki_yil/2024/R": -3000, "devir/kapanis/onceki_yil/2024/SMM": 0,
    "devir/kapanis/onceki_yil/2025/R": 10000, "devir/kapanis/onceki_yil/2025/SMM": 20000,
    "devir/kapanis/N01/2026": 52500, "devir/kapanis/sonuc": -37500,
    # EK-2 26: yıl alt hesapları; ana hesap tutarı aynı
    "mz_arsiv/satirlar/570.2025/bakiye": -10000, "mz_arsiv/satirlar/580.2024/bakiye": 3000, "mz_arsiv/ana/570/bakiye": -10000,
    "mz_arsiv/ana/580/bakiye": 3000, "mz_arsiv/satirlar/591/bakiye": 37500,
    "mz_arsiv/satirlar/153/bakiye": 17500, "mz_arsiv/satirlar/600/bakiye": 0, "mz_arsiv/satirlar/770/bakiye": 0,
    "yev25": [],
    "gt25/kalemler/D": 20000, "gt25/kalemler/DNK": 10000, "gt25/tahmini": True,
    "gt26/kalemler/A": 20000, "gt26/kalemler/D": 52500, "gt26/kalemler/E": 5000, "gt26/kalemler/DNK": -37500, "gt26/tahmini": False,
    "devir/yeni_acilis/570.2025": -10000, "devir/yeni_acilis/580.2024": 3000, "devir/yeni_acilis/591": 37500,
    "bil_arsiv/pasif/V.D": 10000, "bil_arsiv/pasif/V.E": -3000, "bil_arsiv/pasif/V.F": -37500,
}}, aciklama="M4: kapanmamış önceki yıllar (biri kilitli) K tarihli Önceki Yıl Sonucu Fişi ile; 570 / 580 yıl yıl brüt; N-01 = K yılının SMM'si.")

# ------------------------------------------------------------------------------------------------ S48
S("s48-m5-eksi-stok-devri", ["M5", "KG-9", "G3", "§6.4"], [
    o("alis_faturasi", "2026-03-01", id="A1", cari="T1", fatura_turu="stok", M=50000, K=0, kalemler=[{"urun": "U1", "miktar": 5}]),
    o("satis_faturasi", "2026-11-01", id="F1", cari="C1", M=100000, K=0, kalemler=[{"urun": "U1", "miktar": 8}]),
    o("devir", K="2026-12-31", ad="devir"),
    BIL("bil0101", "2027-01-01"),
    o("alis_faturasi", "2027-01-10", id="A2", cari="T1", fatura_turu="stok", M=36000, K=0, kalemler=[{"urun": "U1", "miktar": 3}]),
    R("deg", "degerleme", tarih="2027-01-31"), GT("gt", "2027-01-01", "2027-01-31"), BIL("bil", "2027-01-31"),
], {"A": {
    # K'de U1 −3 Adet: açılış miktarı −3 (eksi dahil), değeri 0 (KG-9 A); DSS 0 → N-01 = 50000, kâr 50000
    "devir/kapanis/DSS": 0, "devir/kapanis/N01/2026": 50000, "devir/kapanis/sonuc": 50000,
    "devir/acilis/eksi_stok": ["U1"], "devir/acilis/stok/U1/miktar": "-3", "devir/acilis/stok/U1/deger": 0,
    "bil0101/kesin_degil": ["EKSI_STOK"],
    # Ocak'ta gelen Aralık malı: −3 + 3 = 0 (hayalî stok yok); ortalamada eksi dönem başı 0 → birim 12000; SMM 36000
    "deg/urunler/U1/miktar": "0", "deg/urunler/U1/deger": 0, "deg/toplam": 0, "deg/eksi": [],
    "gt/kalemler/D": 36000, "gt/kalemler/DNK": -36000, "bil/kesin_degil": ["SATISLARIN_MALIYETI_TAHMINI"],
}}, aciklama="M5: eksi miktarlı ürün miktarıyla (eksi dahil), 0 değerle devreder; Ocak alışıyla sıfırlanır.")

# ------------------------------------------------------------------------------------------------ S49
S("s49-m7-kural-farki-671-681", ["M7", "KG-15", "N-16", "Ç3"], [
    o("kasa_acilis", "2026-01-01", tutar=100000),
    o("evrak_acilis", "2026-01-01", evrak="CK1", evrak_turu="cek", yon="alinan", durum="portfoy", tutar=30000, cari="C1"),
    o("evrak_acilis", "2026-01-01", evrak="VC1", evrak_turu="cek", yon="verilen", tutar=20000, cari="T1", banka="B1"),
    o("donem_kilitle", tarih="2026-12-31", kural="2.4.9"),
    o("kural_farki_duzelt"),
    GT("gt", "2027-01-01", "2027-12-31"), BIL("bil", "2027-01-01"), MZ("mz", "2026-01-01", "2027-01-01"),
], {"A": {
    # donmuş (2.4.9) 2026: 100 / 500 100000, 101.01 / 602 30000, 770 / 103 20000; güncel kural: hepsi 519.
    # Fiş 01.01.2027 (ilk açık gün, ÖNCEKİ mali yılın farkı): B 500 100000, B 681 30000 / A 519 110000, A 671 20000
    "mz/satirlar/500/bakiye": 0, "mz/satirlar/519/bakiye": -110000, "mz/satirlar/681/bakiye": 30000,
    "mz/satirlar/671/bakiye": -20000, "mz/satirlar/602/bakiye": -30000, "mz/satirlar/770/bakiye": 20000,
    "gt/kalemler/I": 20000, "gt/kalemler/J": 30000, "gt/kalemler/DNK": -10000, "gt/hesaplar/671": 20000, "gt/hesaplar/681": 30000,
    "gt/kalemler/A": 0, "gt/kalemler/E": 0,
    "bil/aktif/I.A": 110000, "bil/pasif/V.G": 110000, "bil/pasif/V.K": 10000, "bil/pasif/V.F": -10000,
    "bil/kesin_degil": ["KAPANMAMIS_ONCEKI_YIL", "TAMAMLANMAMIS_ACILIS"], "redler": [],
}}, aciklama="M7: önceki mali yılın donmuş kural farkı 671 / 681 ile (aynı yılda eski hesabın tersi — s30).")

# ------------------------------------------------------------------------------------------------ S50
S("s50-m13-supheli-devir", ["M13", "J-01", "J-03", "J-06", "N-12", "§6.4"], [
    o("satis_faturasi", "2026-09-01", id="F1", cari="C1", M=60000, K=0, vade="2026-10-01"),
    o("satis_faturasi", "2026-10-01", id="F2", cari="C1", M=40000, K=0, vade="2026-11-01"),
    o("supheliye_al", "2026-12-01", id="S1", cari="C1", tutar=70000),
    o("devir", K="2026-12-31", ad="devir"),
    R("g1", "gecikmis", cari="C1", tarih="2027-01-02"),
    o("tahsilat", "2027-01-05", cari="C1", yol="nakit", tutar=20000, supheliden=True),
    o("supheliden_cikar", "2027-02-01", cari="C1", kayit="S1"),
    R("g2", "gecikmis", cari="C1", tarih="2027-02-01"), R("acik", "acik_faturalar", cari="C1", tarih="2027-02-01"),
    BIL("bil", "2027-02-28"),
], {"A": {
    # J-01 70000: F1 60000 + F2 10000 şüpheli kuyruğuna; CH'de F2 30000. Devirde CH açık kalemi F2 30000, 128 ayrı 70000
    "devir/yeni_acilis/120|C1": 30000, "devir/yeni_acilis/128|C1": 70000,
    "devir/acilis/acik_kalemler/0/k": "fatura:F2", "devir/acilis/acik_kalemler/0/kalan": 30000,
    "devir/acilis/supheli/C1/tutar": 70000, "devir/acilis/supheli/C1/kalemler/0/k": "fatura:F1",
    "devir/acilis/supheli/C1/kalemler/0/kalan": 60000, "devir/acilis/supheli/C1/kalemler/1/k": "fatura:F2",
    "devir/acilis/supheli/C1/kalemler/1/kalan": 10000,
    "g1/gecikmis": 30000, "g1/supheli": 70000,
    # J-03 20000 şüpheli kuyruğunda vadesi ilk gelen F1'den; J-06 F1 40000 + F2 10000'i kendi vadeleriyle döndürür
    "g2/gecikmis": 80000, "g2/supheli": 0,
    "acik/0/fatura": "F1", "acik/0/kalan": 40000, "acik/1/fatura": "F2", "acik/1/kalan": 40000,
    "bil/aktif/I.C": 80000, "bil/aktif/I.A": 20000,
}}, aciklama="M13: şüpheli kuyruğu devirde 128 olarak ayrı taşınır (CH açık kalemiyle çift sayılmaz); J-06 sonrası kendi vadeleri.")

# ------------------------------------------------------------------------------------------------ S51
S("s51-m1e-mevcut-borc-karti", ["M1e", "H-02", "H-04", "S2"], [
    o("satis_faturasi", "2026-01-10", id="F1", cari="C1", M=50000, K=0, vade="2026-02-10"),
    o("borc_yaz", "2026-01-15", id="BY1", cari="C1", tutar=30000, aciklama="Fark", vade="2026-03-15"),
    o("taksit_karti", "2026-02-01", id="TK1", cari="C1", kaynak="mevcut_borc", toplam=60000,
      taksitler=[{"vade": "2026-03-01", "tutar": 30000}, {"vade": "2026-04-01", "tutar": 30000}]),
    R("g1", "gecikmis", cari="C1", tarih="2026-03-02"), R("g2", "gecikmis", cari="C1", tarih="2026-03-16"),
    R("acik", "acik_faturalar", cari="C1", tarih="2026-03-02"),
    o("tahsilat", "2026-03-20", cari="C1", yol="nakit", tutar=30000, taksit_karti="TK1"),
    R("g3", "gecikmis", cari="C1", tarih="2026-04-02"),
], {"A": {
    # kart 60000 alttaki açık kalemleri TÜKETİR (vadesi ilk gelen): F1 50000 + BY1 10000; kalan BY1 20000 + taksitler
    "g1/gecikmis": 30000, "g2/gecikmis": 50000, "acik": [],
    # kart tahsilatı kartın ilk taksitini kapatır: BY1 20000 + 04-01 taksiti 30000
    "g3/gecikmis": 50000,
}}, aciklama="M1e: Carinin Mevcut Borcu kartı alttaki borcu tüketir; kart ile alttaki borç birlikte sayılmaz.")

# ================================================================================================ ana oturum ek maddeleri (05.11.2026 ~19:50)
# Kaynak: docs/2.3.0-SUPHELI-KABUL.md §1 K3 + §2 (kaynağı docs/BANKA-MODULU-PLAN.md §3.11b/2), kitap M-01 + G-7, docs/GECMIS-KARARLAR.md
# "Fatura listesinde SİLME" kararı. Beklenenler model bu kurallarla değiştirilmeden ÖNCE elle yazıldı.

# ------------------------------------------------------------------------------------------------ S52
S("s52-k3-supheli-caride-alacak-satirlari", ["K3 (2.3.0 şüpheli kabul)", "§3.11b/2", "T-13", "J-03", "J-04", "J-05", "K6"], [
    # Ana senaryo (kabul §2 adım 0–4)
    o("borc_yaz", "2026-10-01", cari="C1", tutar=10000, aciklama="Bedel"),
    o("supheliye_al", "2026-10-05", id="SA", cari="C1", tutar=4000),
    o("karsilik_ayir", "2026-10-06", cari="C1", tutar=2500, kayit="SA"),
    o("tahsilat", "2026-10-07", cari="C1", yol="nakit", tutar=3000),
    o("degersiz_yaz", "2026-10-08", cari="C1", kayit="SA"),
    # D: tahsilat şüpheliyi aşınca
    o("borc_yaz", "2026-10-01", cari="C3", tutar=10000, aciklama="Bedel"),
    o("supheliye_al", "2026-10-05", cari="C3", tutar=4000),
    o("tahsilat", "2026-10-07", cari="C3", yol="nakit", tutar=5000),
    # aynı gün: önce girilen tahsilat, sonra girilen şüpheli kaydı → gün sırası al → alacak satırı
    o("tahsilat", "2026-10-10", cari="C3", yol="nakit", tutar=500),
    o("supheliye_al", "2026-10-10", cari="C3", tutar=2000),
    o("taksit_karti", "2026-10-15", id="TK3", cari="C3", kaynak="mevcut_borc", toplam=3000, taksitler=[{"vade": "2026-11-15", "tutar": 3000}]),
    o("tahsilat", "2026-11-15", cari="C3", yol="nakit", tutar=1000, taksit_karti="TK3"),
    # E: iki kayıt, en eskisi önce; Normal Cari Hesaba İşle + sınır; bağlı tahsilat; Alacak Yaz; iade; kayıttan sonra açılan kart
    o("borc_yaz", "2026-10-01", cari="C2", tutar=10000, aciklama="Bedel"),
    o("supheliye_al", "2026-10-03", cari="C2", tutar=2000),
    o("supheliye_al", "2026-10-04", cari="C2", tutar=3000),
    o("tahsilat", "2026-10-05", cari="C2", yol="nakit", tutar=2500),
    o("tahsilat", "2026-10-06", cari="C2", yol="nakit", tutar=1000, normal_cari=True),
    o("tahsilat", "2026-10-07", cari="C2", yol="nakit", tutar=4500, normal_cari=True),
    o("satis_faturasi", "2026-10-08", id="F7", cari="C2", M=3000, K=0),
    o("tahsilat", "2026-10-09", cari="C2", yol="nakit", tutar=3000, fatura="F7"),
    o("alacak_yaz", "2026-10-10", cari="C2", tutar=500, aciklama="İndirim"),
    o("satis_iade_faturasi", "2026-10-11", id="I7", cari="C2", M=400, K=0, asil_fatura="F7"),
    o("taksit_karti", "2026-10-12", id="TK7", cari="C2", kaynak="yeni_borc", toplam=1200, taksitler=[{"vade": "2026-11-01", "tutar": 1200}]),
    o("tahsilat", "2026-11-01", cari="C2", yol="nakit", tutar=1200, taksit_karti="TK7"),
    MZ("mz", "2026-10-01", "2026-11-30"), R("g3", "gecikmis", cari="C3", tarih="2026-11-16"),
], {"A": {
    # Ana (kabul §2 adım 4): 120 6000, 128 0, 129 0, 644 −1500, 654 2500, 659 0; tahsilat B 100 / A 128 3000, 644 = 2500 − 1000
    "mz/satirlar/120|C1/bakiye": 6000, "mz/satirlar/128|C1/bakiye": 0, "mz/satirlar/129|C1/bakiye": 0,
    "mz/satirlar/644/bakiye": -1500, "mz/satirlar/654/bakiye": 2500, "mz/satirlar/659/bakiye": 0,
    # C3: D → A 128 4000 + A 120 1000; 10.10 kayıt 2000, aynı günkü tahsilat 500 şüpheliden; Mevcut Borcu Taksitlendir kartının
    # taksiti her zaman şüpheliden (A 128 1000) → 120 3000, 128 500; taksit (11-15) CH'de ödenmedi → gecikmiş 3000
    "mz/satirlar/120|C3/bakiye": 3000, "mz/satirlar/128|C3/bakiye": 500, "g3/gecikmis": 3000, "g3/supheli": 500,
    # C2: 2500 → kayıt1 2000 + kayıt2 500; normal 1000 (120); normal 4500 > 120 4000 → red; F7 bağlı 3000 normal; Alacak Yaz 500 ve
    # iade 400 şüpheliden; kayıttan SONRA açılan kartın taksiti normal → 120 4000, 128 1600
    "mz/satirlar/120|C2/bakiye": 4000, "mz/satirlar/128|C2/bakiye": 1600,
    "mz/satirlar/100/bakiye": 17200, "redler": ["SUPHELI_NORMAL_ASIM"],
}}, aciklama="K3: şüpheli kaydı açık müşteride alacak satırları önce şüpheliden (en eski kayıt önce); istisnalar ve sınır.")

# ------------------------------------------------------------------------------------------------ S53
S("s53-kasa-acilis-duzelt-fatura-sil-geri-yukle", ["M-01", "G-7", "R-04", "Fatura SİLME kararı"], [
    o("kasa_acilis", "2026-01-01", id="KA", tutar=10000),
    o("kasa_giris", "2026-01-05", tutar=5000),
    o("duzenle", kaynak="KA", degisiklik={"tutar": 12000}),
    o("kasa_acilis", "2026-01-02", tutar=3000),
    o("duzenle", kaynak="KA", degisiklik={"tarih": "2026-01-03"}),
    o("alis_faturasi", "2026-01-20", id="A1", cari="T1", fatura_turu="stok", M=5000, K=0, kalemler=[{"urun": "U1", "miktar": 5}]),
    o("satis_faturasi", "2026-02-01", id="F1", cari="C1", M=10000, K=2000, kalemler=[{"urun": "U1", "miktar": 1}]),
    o("tahsilat", "2026-02-01", id="P1", cari="C1", yol="nakit", tutar=12000, fatura="F1", fatura_odemesi=True),
    o("sil", kaynak="F1"), o("geri_yukle", kaynak="F1"),
    o("tahsilat", "2026-02-05", id="P2", cari="C3", yol="nakit", tutar=1000),
    o("sil", kaynak="P2"), o("geri_yukle", kaynak="P2"),
    o("taslak", "2026-02-10", id="TS1"), o("sil", kaynak="TS1"), o("geri_yukle", kaynak="TS1"),
    MZ("mz", "2026-01-01", "2026-02-28"), R("deg", "degerleme", tarih="2026-02-28"),
    R("yevA", "yevmiye", bas="2026-01-03", son="2026-01-03"),
    R("durum_F1", "kaynak_durumu", kaynak="F1"), R("durum_P2", "kaynak_durumu", kaynak="P2"), R("durum_TS1", "kaynak_durumu", kaynak="TS1"),
    # bakım 2 — EK-2B 33: açılış tarihi ilk Kasa hareketinden (kasa_giris 05.01) SONRAYA düzeltilemez; aynı gün olur
    o("duzenle", kaynak="KA", degisiklik={"tarih": "2026-01-06"}),
    R("yevB", "yevmiye", bas="2026-01-03", son="2026-01-03"),
    o("duzenle", kaynak="KA", degisiklik={"tarih": "2026-01-05"}),
    R("yevC", "yevmiye", bas="2026-01-05", son="2026-01-05"),
], {"A": {
    # M-01: ikinci açılış red; açılışın düzeltilmesi G-7 (tutar ve tarih yeniden türetilir); 06.01'e alma red (hiçbir şey değişmez), 05.01 kabul
    "redler": ["KASA_ACILIS_TEKRAR", "KASA_ACILIS_SONRA"], "yevA/0/kaynak": "KA", "yevA/0/satirlar/0/b": 12000,
    "yevB/0/kaynak": "KA", "yevB/0/satirlar/0/b": 12000,
    "yevC/0/kaynak": "KA", "yevC/0/sinif": 0, "yevC/1/tur": "kasa_giris",
    "mz/satirlar/519/bakiye": -12000, "mz/satirlar/649.90/bakiye": -5000,
    # silinen kaydedilmiş fatura geri yüklenince ETKİSİZ ("İptal Edildi"): cari, gelir, KDV, stok ve formdaki peşin yok
    "durum_F1": "iptal", "mz/satirlar/120|C1/bakiye": 0, "mz/satirlar/600/bakiye": 0, "mz/satirlar/391/bakiye": 0,
    "deg/urunler/U1/miktar": "5",
    # fatura dışı kayıt (R-04) geri yüklenince etkin; taslak taslak olarak döner
    "durum_P2": "aktif", "mz/satirlar/120|C3/bakiye": -1000, "durum_TS1": "aktif",
    "mz/satirlar/100/bakiye": 18000,
}}, aciklama="Kasa açılışı bir kez; düzeltmesi G-7. Silinen kaydedilmiş fatura geri yüklenince etkisiz (İptal Edildi).")

# ================================================================================================ KÂHİN BAKIMI 2 (05.11.2026)
# Kaynak: kullanıcı kararları 05.11 21:08 (S7, S8) ve 21:30 (1)–(7) (iş listesi D, AYNEN), EK-2B (23, 24, 28, 32, 33, 35, K-2, K-3), EK-2 (geçerli
# maddeler). Beklenenler model bu kurallarla değiştirilmeden ÖNCE elle yazıldı (README "Kâhin bakımı 2", R1…R21).

# ------------------------------------------------------------------------------------------------ S54
S("s54-r1-ayni-gun-borc-once", ["karar (1)", "EK-2B 23", "S2"], [
    o("satis_faturasi", "2026-03-01", id="F1", cari="C1", M=10000, K=0, vade="2026-06-30"),
    o("tahsilat", "2026-04-01", id="P1", cari="C1", yol="nakit", tutar=10000),      # aynı gün, faturadan ÖNCE girildi
    o("satis_faturasi", "2026-04-01", id="F2", cari="C1", M=10000, K=0),             # vadesiz → vade 04-01
    R("g1", "gecikmis", cari="C1", tarih="2026-04-02"), R("ak", "acik_kalemler", cari="C1", tarih="2026-04-02"),
    R("g2", "gecikmis", cari="C1", tarih="2026-07-01"),
], {"A": {
    # aynı gün önce borç kalemleri: P1'in günü (04-01) açık borçlar F1 (vade 06-30) ve F2 (vade 04-01) → vadesi önce gelen F2 kapanır
    # (giriş sırasıyla işlenseydi P1 F1'i kapatır, F2 02.04'te 10000 gecikmiş olurdu)
    "g1/gecikmis": 0, "ak": [{"k": "fatura:F1", "tur": "fatura", "kalan": 10000, "vade": "2026-06-30", "tarih": "2026-03-01"}],
    "g2/gecikmis": 10000,
}}, aciklama="Karar (1): bağsız ödeme kendi gününde açık borçlara; aynı gün önce borç kalemleri sayılır (giriş saatine bağlı değil).")

# ------------------------------------------------------------------------------------------------ S55
S("s55-r2-bag-kendi-tarihinde", ["karar (2)", "EK-2B 24"], [
    o("satis_faturasi", "2026-03-01", id="F1", cari="C1", M=10000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-05", id="F2", cari="C1", M=10000, K=0, vade="2026-12-31"),
    o("tahsilat", "2026-03-10", id="P1", cari="C1", yol="nakit", tutar=10000),
    o("satis_faturasi", "2026-04-01", id="F3", cari="C1", M=10000, K=0),
    R("g0", "gecikmis", cari="C1", tarih="2026-04-02"),
    o("tahsilat", "2026-05-01", id="L1", cari="C1", yol="nakit", tutar=10000, fatura="F1"),
    R("g1", "gecikmis", cari="C1", tarih="2026-05-02"), R("ak", "acik_kalemler", cari="C1", tarih="2026-05-02"),
    R("af", "acik_faturalar", cari="C1", tarih="2026-05-02"),
], {"A": {
    # bağdan önce (02.04): P1 vadesi önce gelen F1'i kapatmış; açık F2 (12-31) + F3 (04-01) → gecikmiş F3 10000
    "g0/gecikmis": 10000,
    # L1 "Kapatılacak Fatura: F1" F1'i kapatır; P1 serbest kalır ve KENDİ GÜNÜNDE (10.03) dağılır: o gün açık olan (ayrılmamış) tek borç F2
    # → F2 kapanır; F3 açık kalır → 02.05'te gecikmiş 10000. (Serbest kalanı bağ gününe dağıtan okuma F3'ü kapatır, gecikmiş 0 verirdi.)
    "g1/gecikmis": 10000,
    "ak": [{"k": "fatura:F3", "tur": "fatura", "kalan": 10000, "vade": "2026-04-01", "tarih": "2026-04-01"}],
    "af": [{"fatura": "F3", "kalan": 10000, "vade": "2026-04-01", "tarih": "2026-04-01"}],
}}, aciklama="Karar (2): bağ hedefini her durumda kapatır; hedefi kapatmış bağsız ödeme serbest kalır ve kendi tarihinde yeniden dağılır.")

# ------------------------------------------------------------------------------------------------ S56
S("s56-r3-kilitli-bag", ["karar (3)", "EK-2B 28", "G2", "M2"], [
    o("satis_faturasi", "2026-11-01", id="F1", cari="C1", M=10000, K=0, vade="2026-11-30"),
    o("tahsilat", "2026-11-20", id="P1", cari="C1", yol="nakit", tutar=10000),
    o("satis_faturasi", "2026-12-05", id="F2", cari="C1", M=10000, K=0, vade="2027-03-31"),
    o("donem_kilitle", tarih="2026-12-31"),
    # açık dönemde aynı desen (C3, kilitten sonra) → karar (2) geçerli
    o("satis_faturasi", "2027-01-02", id="F4", cari="C3", M=10000, K=0, vade="2027-01-20"),
    o("tahsilat", "2027-01-03", id="P2", cari="C3", yol="nakit", tutar=10000),
    o("satis_faturasi", "2027-01-04", id="F5", cari="C3", M=10000, K=0, vade="2027-03-31"),
    o("satis_faturasi", "2027-01-05", id="F3", cari="C1", M=10000, K=0),
    o("satis_faturasi", "2027-01-08", id="F6", cari="C3", M=10000, K=0),
    o("tahsilat", "2027-01-10", id="T1", cari="C1", yol="nakit", tutar=10000, fatura="F1"),
    o("tahsilat", "2027-01-10", id="T2", cari="C3", yol="nakit", tutar=10000, fatura="F4"),
    R("g1", "gecikmis", cari="C1", tarih="2027-01-11"), R("ak1", "acik_kalemler", cari="C1", tarih="2027-01-11"),
    R("not1", "kilit_bag_notu", cari="C1", tarih="2027-01-11"),
    R("g3", "gecikmis", cari="C3", tarih="2027-01-11"), R("ak3", "acik_kalemler", cari="C3", tarih="2027-01-11"),
    R("not3", "kilit_bag_notu", cari="C3", tarih="2027-01-11"),
    o("devir", K="2026-12-31", ad="devir"),
    R("g1d", "gecikmis", cari="C1", tarih="2027-01-11"), R("ak1d", "acik_kalemler", cari="C1", tarih="2027-01-11"),
    R("g3d", "gecikmis", cari="C3", tarih="2027-01-11"),
], {"A": {
    # C1 (EK-2B 2B-S2 örneği): F1 kilitli dönemde (20.11) bağsız P1 ile kapandı → T1'in bağı onu geri ALMAZ; T1 bağsız gibi 10.01'de açık
    # borçlara: F2 (vade 31.03), F3 (vadesiz 05.01) → F3 kapanır; F2 açık → 11.01'de gecikmiş 0; program kayıtta söyler
    "g1/gecikmis": 0,
    "ak1": [{"k": "fatura:F2", "tur": "fatura", "kalan": 10000, "vade": "2027-03-31", "tarih": "2026-12-05"}],
    "not1": [{"kaynak": "T1", "hedef": "fatura:F1", "tutar": 10000, "tarih": "2027-01-10"}],
    # C3 (açık dönem, karar (2)): T2 F4'ü kapatır; P2 kendi gününde (03.01) ayrılmamış açık borç bulamaz → avans → 04.01'de F5'i kapatır;
    # F6 (vadesiz 08.01) açık → 11.01'de gecikmiş 10000
    "g3/gecikmis": 10000,
    "ak3": [{"k": "fatura:F6", "tur": "fatura", "kalan": 10000, "vade": "2027-01-08", "tarih": "2027-01-08"}],
    "not3": [],
    # devirden sonra aynı (G2: kapanmış ≤K faturaya bağ arşiv başvurusu → bağsız; M2 devirli = aynı kilitli devirsiz)
    "g1d/gecikmis": 0,
    "ak1d": [{"k": "fatura:F2", "tur": "fatura", "kalan": 10000, "vade": "2027-03-31", "tarih": "2026-12-05"}],
    "g3d/gecikmis": 10000,
}}, aciklama="Karar (3): kilitli / devredilmiş dönemde bağsız kapanmış kalem kilitten sonraki bağla yeniden açılmaz; açık dönemde karar (2).")

# ------------------------------------------------------------------------------------------------ S57
_TK3x3000 = [{"vade": "2026-02-01", "tutar": 3000}, {"vade": "2026-03-01", "tutar": 3000}, {"vade": "2026-04-01", "tutar": 3000}]
S("s57-r4-kart-kucultme", ["karar (4)", "2B-S3", "EK-2B 32", "F-07", "T-09", "H-01"], [
    o("kasa_acilis", "2026-01-01", tutar=10000),
    o("satis_faturasi", "2026-01-01", id="F1", cari="C1", M=9000, K=0),
    o("taksit_karti", "2026-01-01", id="TK1", cari="C1", kaynak="fatura", fatura="F1", toplam=9000, taksitler=_TK3x3000),
    o("satis_faturasi", "2026-01-05", id="F2", cari="C3", M=5000, K=0),
    o("satis_faturasi", "2026-01-10", id="F3", cari="C3", M=6000, K=0),
    o("taksit_karti", "2026-01-10", id="TK3", cari="C3", kaynak="fatura", fatura="F3", toplam=6000,
      taksitler=[{"vade": "2026-05-01", "tutar": 3000}, {"vade": "2026-06-01", "tutar": 3000}]),
    o("satis_faturasi", "2026-02-01", id="F4", cari="C2", M=4000, K=0),
    o("taksit_karti", "2026-02-01", id="TK4", cari="C2", kaynak="fatura", fatura="F4", toplam=4000,
      taksitler=[{"vade": "2026-03-01", "tutar": 2000}, {"vade": "2026-04-01", "tutar": 2000}]),
    o("tahsilat", "2026-03-01", cari="C2", yol="nakit", tutar=2000, taksit_karti="TK4"),
    o("satis_iade_faturasi", "2026-03-15", id="I1", cari="C1", M=3000, K=0, asil_fatura="F1"),
    R("g1", "gecikmis", cari="C1", tarih="2026-03-15"),
    o("satis_iade_faturasi", "2026-03-16", id="I1P", cari="C1", M=1000, K=0, asil_fatura="F1", para_iadesi="nakit"),
    o("satis_iade_faturasi", "2026-03-20", id="I3", cari="C3", M=3000, K=0, asil_fatura="F3"),
    R("g3", "gecikmis", cari="C3", tarih="2026-03-21"),
    o("satis_iade_faturasi", "2026-03-25", id="I4", cari="C2", M=3000, K=0, asil_fatura="F4"),
    R("ak2", "acik_kalemler", cari="C2", tarih="2026-03-26"),
    o("satis_faturasi", "2026-04-10", id="F5", cari="C2", M=1000, K=0),
    R("g1b", "gecikmis", cari="C1", tarih="2026-04-02"), R("g2", "gecikmis", cari="C2", tarih="2026-04-11"),
    R("g3b", "gecikmis", cari="C3", tarih="2026-06-02"), R("kt1", "kartlar", cari="C1", tarih="2026-04-02"),
    MZ("mz", "2026-01-01", "2026-04-30"),
], {"A": {
    # C1 (2B-S3 örneği): borçtan düşülen 3000 iade kartı vadesi en önce gelen açık taksitten (01.02) küçültür → 15.03'te gecikmiş 01.03 taksiti 3000
    "g1/gecikmis": 3000,
    # paralı iade (iade + müşteriye nakit 1000) kartı DEĞİŞTİRMEZ → 02.04'te 01.03 + 01.04 = 6000
    "g1b/gecikmis": 6000,
    "kt1": {"TK1": {"kapali": False, "taksitler": [{"vade": "2026-03-01", "tutar": 3000, "kalan": 3000},
                                                   {"vade": "2026-04-01", "tutar": 3000, "kalan": 3000}]}},
    # C3 (EK-2B madde 32 örneği): kartın faturasından iade kartı küçültür (05.01 taksiti), eski fatura F2 AYNEN → 21.03'te gecikmiş 5000
    # (bağsız alacak gibi dağıtılsaydı F2'den düşer, 2000 olurdu)
    "g3/gecikmis": 5000, "g3b/gecikmis": 8000,
    # C2: kartın açık kalanı 2000 (01.04 taksiti); iade 3000 → kart 2000 küçülür, fazla 1000 carinin avansı; sonra gelen F5 avansla kapanır
    "ak2": [{"k": "iade:I4", "tur": "iade", "kalan": -1000, "vade": "2026-03-25", "tarih": "2026-03-25"}], "g2/gecikmis": 0,
    # cari bakiyeleri: C1 9000 − 3000 − 1000 + 1000 = 6000; C2 4000 − 2000 − 3000 + 1000 = 0; C3 11000 − 3000 = 8000; Kasa 10000 + 2000 − 1000
    "mz/satirlar/120|C1/bakiye": 6000, "mz/satirlar/120|C2/bakiye": 0, "mz/satirlar/120|C3/bakiye": 8000,
    "mz/satirlar/100/bakiye": 11000, "mz/satirlar/610/bakiye": 10000,
}}, aciklama="Karar (4): iade kartı en erken açık taksitten küçültür, aşarsa avans; paralı iadede kart değişmez; kart_fark yok.")

# ------------------------------------------------------------------------------------------------ S58
S("s58-r9-kartli-fatura-sil-iptal", ["EK-2B 35", "karar (4)", "F-15", "R-04", "H-02"], [
    o("satis_faturasi", "2026-01-10", id="F1", cari="C1", M=9000, K=0),
    o("taksit_karti", "2026-01-10", id="TK1", cari="C1", kaynak="fatura", fatura="F1", toplam=9000,
      taksitler=[{"vade": "2026-02-10", "tutar": 3000}, {"vade": "2026-03-10", "tutar": 3000}, {"vade": "2026-04-10", "tutar": 3000}]),
    o("satis_faturasi", "2026-01-15", id="F2", cari="C3", M=6000, K=0),
    o("taksit_karti", "2026-01-15", id="TK2", cari="C3", kaynak="fatura", fatura="F2", toplam=6000,
      taksitler=[{"vade": "2026-02-15", "tutar": 3000}, {"vade": "2026-03-15", "tutar": 3000}]),
    o("satis_faturasi", "2026-01-20", id="F3", cari="C2", M=4000, K=0),
    o("borc_yaz", "2026-01-21", id="BY", cari="C2", tutar=2000, aciklama="Fark"),
    o("taksit_karti", "2026-02-01", id="TK3", cari="C2", kaynak="mevcut_borc", toplam=6000,
      taksitler=[{"vade": "2026-03-01", "tutar": 3000}, {"vade": "2026-04-01", "tutar": 3000}]),
    o("tahsilat", "2026-02-15", id="P2", cari="C3", yol="nakit", tutar=3000, taksit_karti="TK2"),
    o("sil", kaynak="F1"),
    o("sil", kaynak="F2"),           # kartta tahsilat var → red
    o("iptal", kaynak="F2"),
    o("iptal", kaynak="F3"),
    R("g1", "gecikmis", cari="C1", tarih="2026-03-11"), R("kt1", "kartlar", cari="C1", tarih="2026-03-11"),
    R("ak3", "acik_kalemler", cari="C3", tarih="2026-03-20"), R("g3", "gecikmis", cari="C3", tarih="2026-03-20"),
    R("kt3", "kartlar", cari="C3", tarih="2026-03-20"),
    R("g2a", "gecikmis", cari="C2", tarih="2026-03-02"), R("g2b", "gecikmis", cari="C2", tarih="2026-04-02"),
    R("kt2", "kartlar", cari="C2", tarih="2026-04-02"),
    MZ("mz", "2026-01-01", "2026-04-30"),
], {"A": {
    "redler": ["FATURA_SIL_TAHSILATLI_KART"],
    # C1: tahsilatsız kartlı fatura silindi → kart faturayla kalkar; bakiye fatura öncesine (0); gecikmiş 0
    "g1/gecikmis": 0, "kt1": {}, "mz/satirlar/120|C1/bakiye": 0,
    # C3: silme reddedildi; iptal → kart tahsilatı P2 bağı çözülür, avans (−3000). Bakım 4 (S15 "kart kapanır", README Y9): tahsilatı olan kart
    # KAPALI görünür, açık taksiti yok (eski beklenti kt3 {} — kart kalkar)
    "ak3": [{"k": "tahsilat:P2", "tur": "tahsilat", "kalan": -3000, "vade": "2026-02-15", "tarih": "2026-02-15"}],
    "g3/gecikmis": 0, "kt3": {"TK2": {"kapali": True, "taksitler": []}}, "mz/satirlar/120|C3/bakiye": -3000,
    # C2: Mevcut Borç kartının tükettiği F3 iptal → kart alttaki borç (BY 2000) kadar kalır, 4000 en erken taksitten küçülür
    # (01.03 3000 → 0, 01.04 3000 → 2000)
    "g2a/gecikmis": 0, "g2b/gecikmis": 2000,
    "kt2": {"TK3": {"kapali": False, "taksitler": [{"vade": "2026-04-01", "tutar": 2000, "kalan": 2000}]}},
    "mz/satirlar/120|C2/bakiye": 2000,
}}, aciklama="EK-2B 35: faturanın kendi kartı faturayla kalkar; tahsilatlı kartta silme red, iptalde tahsilat avans; Mevcut Borç kartı küçülür.")

# ------------------------------------------------------------------------------------------------ S59
S("s59-r5-ayni-kisi-alis-satis", ["karar (5)", "EK-2B K-2", "F-16", "S9"], [
    o("satis_faturasi", "2026-03-01", id="S1", cari="C1", M=10000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-02", id="S3", cari="C3", M=10000, K=0, vade="2026-03-31"),
    o("alis_faturasi", "2026-03-10", id="P1", cari="C1", fatura_turu="gider", gider_turu="genel", M=6000, K=0, vade="2026-04-30"),
    o("alis_faturasi", "2026-03-11", id="P3", cari="C3", fatura_turu="gider", gider_turu="genel", M=12000, K=0, vade="2026-04-30"),
    R("g1", "gecikmis", cari="C1", tarih="2026-04-15"), R("af1", "acik_faturalar", cari="C1", tarih="2026-04-15"),
    R("g3", "gecikmis", cari="C3", tarih="2026-04-15"), R("af3", "acik_faturalar", cari="C3", tarih="2026-04-15"),
    R("h", "hatirlatma", tarih="2026-04-15"),
    o("mahsup", "2026-04-20", fatura1="S1", fatura2="P1", tutar=6000),
    R("af1b", "acik_faturalar", cari="C1", tarih="2026-04-21"), R("g1b", "gecikmis", cari="C1", tarih="2026-04-21"),
], {"A": {
    # "Bakiyeden Netleşsin": gecikmiş net borcu aşmaz → C1 10000 − 6000 = 4000; C3 bize 2000 alacaklı → 0, hatırlatma yok
    "g1/gecikmis": 4000, "g3/gecikmis": 0, "h/otomatik": {"C1": 4000}, "h/supheli_etiketli": [], "h/elle": {},
    # faturaların Açık / Ödendi durumu yalnız Mahsup Et ile (karşı yönlü faturalar birbirini kendiliğinden kapatmaz)
    "af1": [{"fatura": "S1", "kalan": 10000, "vade": "2026-03-31", "tarih": "2026-03-01"},
            {"fatura": "P1", "kalan": -6000, "vade": "2026-04-30", "tarih": "2026-03-10"}],
    "af3": [{"fatura": "S3", "kalan": 10000, "vade": "2026-03-31", "tarih": "2026-03-02"},
            {"fatura": "P3", "kalan": -12000, "vade": "2026-04-30", "tarih": "2026-03-11"}],
    # Mahsup Et 6000 → S1 4000 açık, P1 kapandı; gecikmiş değişmez
    "af1b": [{"fatura": "S1", "kalan": 4000, "vade": "2026-03-31", "tarih": "2026-03-01"}], "g1b/gecikmis": 4000,
}}, aciklama="Karar (5): aynı kişide alış borcumuz gecikmişten düşülür (net); fatura durumu yalnız Mahsup Et ile değişir.")

# ------------------------------------------------------------------------------------------------ S60
_TK12x1000 = [{"vade": f"2026-{a:02d}-15", "tutar": 1000} for a in range(1, 13)]
S("s60-r6-kart-kapat-borcta-kalir", ["karar (6)", "EK-2B K-3", "H-07", "KG-23", "S1", "M1d"], [
    o("taksit_karti", "2026-01-01", id="TK1", cari="C1", kaynak="yeni_borc", toplam=12000, taksitler=_TK12x1000),
    o("taksit_karti", "2026-01-01", id="TK2", cari="C2", kaynak="yeni_borc", toplam=12000, taksitler=_TK12x1000),
    o("tahsilat", "2026-06-01", cari="C1", yol="nakit", tutar=7000, taksit_karti="TK1"),
    o("tahsilat", "2026-06-01", cari="C2", yol="nakit", tutar=7000, taksit_karti="TK2"),
    o("taksit_kapat", "2026-06-15", kart="TK1"),
    o("taksit_kapat", "2026-06-15", kart="TK2", eski=True),     # 2.5.0'dan önce kapatılmış kart (göç verisi): olduğu gibi kalır
    R("g1a", "gecikmis", cari="C1", tarih="2026-06-15"), R("g1", "gecikmis", cari="C1", tarih="2026-06-16"),
    R("g2", "gecikmis", cari="C2", tarih="2026-06-16"), R("h", "hatirlatma", tarih="2026-06-16"),
    MZ("mz", "2026-01-01", "2026-06-30"), GT("gt", "2026-01-01", "2026-06-30"),
], {"A": {
    # Kartı Kapat yalnız planı bitirir: kalan 5000 borçta, kapatma günü vadeli tek kalem → 16.06'da gecikmiş, hatırlatma gider; defterde madde yok
    "g1a/gecikmis": 0, "g1/gecikmis": 5000, "h/otomatik": {"C1": 5000}, "mz/satirlar/120|C1/bakiye": 5000,
    # eski kapama (2.4.9 davranışı korunur): kalan 689'a gider, cari kapanır, hatırlatma yok
    "g2/gecikmis": 0, "mz/satirlar/120|C2/bakiye": 0, "mz/satirlar/689/bakiye": 5000,
    "gt/kalemler/A": 24000, "gt/kalemler/J": 5000, "gt/kalemler/DNK": 19000,
}}, aciklama="Karar (6): Kartı Kapat kalanı borçta kalır (ertesi gün gecikmiş); 2.5.0'dan önce kapatılmış kart 689'la olduğu gibi kalır.")

# ------------------------------------------------------------------------------------------------ S61
S("s61-r20-karsiliksiz-fatura-vadesi", ["S8", "EK-2 K-1", "E22", "Ç-07", "M1c"], [
    o("satis_faturasi", "2026-03-01", id="F1", cari="C1", M=20000, K=0, vade="2026-06-30"),
    o("satis_faturasi", "2026-03-01", id="F2", cari="C3", M=10000, K=0),
    o("satis_faturasi", "2026-03-02", id="F3", cari="C3", M=5000, K=0, vade="2026-06-30"),
    o("taksit_karti", "2026-03-01", id="TK", cari="C2", kaynak="yeni_borc", toplam=6000,
      taksitler=[{"vade": "2026-04-01", "tutar": 3000}, {"vade": "2026-05-01", "tutar": 3000}]),
    o("tahsilat", "2026-03-05", cari="C1", yol="cek", evrak="CK1", tutar=20000, fatura="F1"),
    o("tahsilat", "2026-03-06", cari="C3", yol="cek", evrak="CK2", tutar=10000),
    o("tahsilat", "2026-03-20", id="P3", cari="C3", yol="nakit", tutar=5000),
    o("tahsilat", "2026-04-01", cari="C2", yol="cek", evrak="CK3", tutar=3000, taksit_karti="TK"),
    R("g3a", "gecikmis", cari="C3", tarih="2026-04-30"), R("g1o", "gecikmis", cari="C1", tarih="2026-05-01"),
    o("evrak_karsiliksiz", "2026-04-20", evrak="CK3"),
    o("evrak_karsiliksiz", "2026-05-02", evrak="CK1"),
    o("evrak_karsiliksiz", "2026-05-02", evrak="CK2"),
    R("g1a", "gecikmis", cari="C1", tarih="2026-05-03"), R("g1b", "gecikmis", cari="C1", tarih="2026-07-01"),
    R("af1", "acik_faturalar", cari="C1", tarih="2026-05-03"),
    R("g3b", "gecikmis", cari="C3", tarih="2026-05-02"), R("g3c", "gecikmis", cari="C3", tarih="2026-07-01"),
    R("ak3", "acik_kalemler", cari="C3", tarih="2026-05-03"),
    R("g2a", "gecikmis", cari="C2", tarih="2026-04-20"), R("g2b", "gecikmis", cari="C2", tarih="2026-04-21"),
    R("g2c", "gecikmis", cari="C2", tarih="2026-05-02"),
    MZ("mz", "2026-03-01", "2026-05-31"),
], {"A": {
    # karşılıksızdan önce: CK2 F2'yi, P3 F3'ü kapatmış; CK1 F1'i (bağlı) kapatmış → 0
    "g3a/gecikmis": 0, "g1o/gecikmis": 0,
    # C1: bağlı çek karşılıksız → F1 kendi vadesiyle (30.06) yeniden açık: 03.05'te gecikmiş değil, 01.07'de 20000
    "g1a/gecikmis": 0, "g1b/gecikmis": 20000, "af1": [{"fatura": "F1", "kalan": 20000, "vade": "2026-06-30", "tarih": "2026-03-01"}],
    # C3: bağsız çek karşılıksız → kapattığı F2 (vadesiz 01.03) yeniden açılır; öteki bağsız ödeme P3 KENDİ gününde (20.03) vadesi önce gelen
    # F2'ye dağılır → F2 5000 + F3 5000 açık; vadesiz F2 karşılıksız günü zaten gecikmiş (02.05'te 5000); 01.07'de 10000
    "g3b/gecikmis": 5000, "g3c/gecikmis": 10000,
    "ak3": [{"k": "fatura:F2", "tur": "fatura", "kalan": 5000, "vade": "2026-03-01", "tarih": "2026-03-01"},
            {"k": "fatura:F3", "tur": "fatura", "kalan": 5000, "vade": "2026-06-30", "tarih": "2026-03-02"}],
    # C2: taksit kartı tahsilatı olan çek ("taksitli değişmez", M1c): taksit kapalı kalır, karşılıksız ayrı kalem vade 20.04 → 21.04'te 3000
    "g2a/gecikmis": 0, "g2b/gecikmis": 3000, "g2c/gecikmis": 6000,
    # cari bakiyesi ve yevmiye değişmez (Ç-07 maddesi aynen)
    "mz/satirlar/120|C1/bakiye": 20000, "mz/satirlar/120|C3/bakiye": 10000, "mz/satirlar/120|C2/bakiye": 6000,
    "mz/satirlar/101.01/bakiye": 0,
}}, aciklama="S8: karşılıksız evrakla yeniden açılan fatura kendi vadesiyle gecikir; öteki bağsız ödemeler kendi günlerinde yeniden dağılır.")

# ------------------------------------------------------------------------------------------------ S62
S("s62-r16-127-ters-bakiye", ["EK-2 36", "E14", "M-11", "§7.3"], [
    o("kasa_acilis", "2026-01-01", tutar=100000),
    o("acilis_eslestir", tarih="2026-01-01", satirlar=[{"hesap": "127.K1", "alacak": 5000}, {"hesap": "127.K2", "borc": 8000},
                                                    {"hesap": "500", "alacak": 103000}]),
    BIL("bil", "2026-01-01"),
], {"A": {
    # alacaklı 127 (fazla tahsil edilmiş carisiz kart) Pasif III.D 340; kart (alt hesap) bazında brüt, borçlu 127.K2 ile netleşmez
    "bil/aktif/I.A": 100000, "bil/aktif/I.C": 8000, "bil/pasif/III.D": 5000, "bil/pasif/V.A": 103000,
    "bil/detay/III.D/127.K1": 5000, "bil/detay/I.C/127.K2": 8000, "bil/aktif_toplam": 108000, "bil/pasif_toplam": 108000,
    "bil/kesin_degil": [],
}}, aciklama="EK-2 36: 127 Diğer Ticari Alacaklar; alacaklı kart 340'ta, kart bazında brüt.")

# ================================================================================================ KÂHİN BAKIMI 3 (06.11.2026)
# Kaynak: kullanıcı kararı 06.11 03:35 UTC "hepsi A" — S11, S12 (iş listesi D, AYNEN); S8 (05.11 21:08) ve karar (3) (05.11 21:30) ile birlikte.
# Beklenenler model bu kurallarla değiştirilmeden ÖNCE elle yazıldı (README "Kâhin bakımı 3", T1…T13).

# ------------------------------------------------------------------------------------------------ S63
S("s63-s11-kilitli-karsiliksiz", ["S11", "S8", "karar (3)", "EK-1 M1c", "Ç-07", "Ç-08", "M2", "G2"], [
    # C3: karşılıksız da kilitli dönemde (kilitten ÖNCE girildi) → S8 aynen (T3)
    o("satis_faturasi", "2026-10-01", id="F7", cari="C3", M=10000, K=0, vade="2027-03-31"),
    o("tahsilat", "2026-10-05", id="P7", cari="C3", yol="cek", evrak="CK7", tutar=10000, fatura="F7"),
    # C1: bağlı çeklerle kapanan iki fatura (biri ciro edildi); T1: ciro edilen çekle kapanan alış faturası
    o("satis_faturasi", "2026-11-01", id="F1", cari="C1", M=20000, K=0, vade="2026-11-30"),
    o("satis_faturasi", "2026-11-03", id="F6", cari="C1", M=7000, K=0),
    o("tahsilat", "2026-11-04", id="P6", cari="C1", yol="cek", evrak="CK6", tutar=7000, fatura="F6"),
    o("alis_faturasi", "2026-11-05", id="A1", cari="T1", fatura_turu="gider", gider_turu="genel", M=7000, K=0),
    o("odeme", "2026-11-06", id="O6", cari="T1", yol="ciro", evrak="CK6"),
    o("tahsilat", "2026-11-10", id="P1", cari="C1", yol="cek", evrak="CK1", tutar=20000, fatura="F1"),
    # C3: kısmi — bağsız çek faturanın bir kısmını kilitli dönemde kapatır (T7)
    o("satis_faturasi", "2026-11-15", id="F4", cari="C3", M=30000, K=0, vade="2027-02-28"),
    o("tahsilat", "2026-11-20", id="P4", cari="C3", yol="cek", evrak="CK4", tutar=12000),
    o("evrak_karsiliksiz", "2026-12-01", id="KS7", evrak="CK7"),
    # C2: kilit günü sınırı — çek KİLİT GÜNÜ (31.12) faturayı kapatır; ikinci çek L+1 (01.01) alınır (T3)
    o("satis_faturasi", "2026-12-20", id="F2", cari="C2", M=5000, K=0, vade="2027-03-31"),
    o("tahsilat", "2026-12-31", id="P2", cari="C2", yol="cek", evrak="CK2", tutar=5000),
    o("donem_kilitle", tarih="2026-12-31"),
    o("satis_faturasi", "2027-01-01", id="F5", cari="C2", M=8000, K=0, vade="2027-02-15"),
    o("tahsilat", "2027-01-01", id="P5", cari="C2", yol="cek", evrak="CK5", tutar=8000, fatura="F5"),
    o("evrak_karsiliksiz", "2027-01-01", id="KS2", evrak="CK2"),
    o("evrak_karsiliksiz", "2027-01-10", id="KS4", evrak="CK4"),
    o("evrak_karsiliksiz", "2027-01-12", id="KS5", evrak="CK5"),
    o("evrak_karsiliksiz", "2027-01-15", id="KS1", evrak="CK1"),
    o("evrak_karsiliksiz", "2027-01-20", id="KS6", evrak="CK6"),
    R("g1a", "gecikmis", cari="C1", tarih="2027-01-15"), R("g1b", "gecikmis", cari="C1", tarih="2027-01-16"),
    R("g1c", "gecikmis", cari="C1", tarih="2027-01-21"),
    R("ak1", "acik_kalemler", cari="C1", tarih="2027-01-21"), R("af1", "acik_faturalar", cari="C1", tarih="2027-01-21"),
    R("g2a", "gecikmis", cari="C2", tarih="2027-01-02"), R("g2b", "gecikmis", cari="C2", tarih="2027-01-13"),
    R("g2c", "gecikmis", cari="C2", tarih="2027-02-16"),
    R("ak2", "acik_kalemler", cari="C2", tarih="2027-01-13"), R("af2", "acik_faturalar", cari="C2", tarih="2027-01-13"),
    R("g3a", "gecikmis", cari="C3", tarih="2027-01-11"), R("g3b", "gecikmis", cari="C3", tarih="2027-03-01"),
    R("g3c", "gecikmis", cari="C3", tarih="2027-04-01"),
    R("ak3", "acik_kalemler", cari="C3", tarih="2027-01-11"), R("af3", "acik_faturalar", cari="C3", tarih="2027-01-11"),
    R("akT", "acik_kalemler", cari="T1", tarih="2027-01-21"), R("afT", "acik_faturalar", cari="T1", tarih="2027-01-21"),
    R("hat", "hatirlatma", tarih="2027-01-21"),
    MZ("mz", "2026-10-01", "2027-01-31"),
    o("devir", K="2026-12-31", ad="devir"),
    R("g1cd", "gecikmis", cari="C1", tarih="2027-01-21"), R("ak1d", "acik_kalemler", cari="C1", tarih="2027-01-21"),
    R("af1d", "acik_faturalar", cari="C1", tarih="2027-01-21"),
    R("g2ad", "gecikmis", cari="C2", tarih="2027-01-02"), R("g2bd", "gecikmis", cari="C2", tarih="2027-01-13"),
    R("af2d", "acik_faturalar", cari="C2", tarih="2027-01-13"),
    R("g3ad", "gecikmis", cari="C3", tarih="2027-01-11"), R("ak3d", "acik_kalemler", cari="C3", tarih="2027-01-11"),
    R("akTd", "acik_kalemler", cari="T1", tarih="2027-01-21"), R("afTd", "acik_faturalar", cari="T1", tarih="2027-01-21"),
    R("hatd", "hatirlatma", tarih="2027-01-21"),
], {"A": {
    # C1 (T1, T2): P1 (10.11, bağlı F1) ve P6 (04.11, bağlı F6) kilitli dönemde tamamen dağıldı; karşılıksızlar kilitten sonra → F1, F6
    # yeniden AÇILMAZ; KS1 20000 (vade 15.01) ve KS6 7000 (vade 20.01) ayrı borç. 15.01: KS1'in vadesi bugün → gecikmiş değil (M1f) → 0;
    # 16.01: 20000; 21.01: 27000. (S8 harfiyen olsaydı F1 (vade 30.11) 15.01'de 20000 gecikmiş olurdu.) Kâhin bu durumda SUSMAZ (kural).
    "g1a/gecikmis": 0, "g1a/kahin_susuyor": 0, "g1b/gecikmis": 20000, "g1c/gecikmis": 27000, "g1c/kahin_susuyor": 0,
    "ak1": [{"k": "karsiliksiz:KS1", "tur": "karsiliksiz", "kalan": 20000, "vade": "2027-01-15", "tarih": "2027-01-15"},
            {"k": "karsiliksiz:KS6", "tur": "karsiliksiz", "kalan": 7000, "vade": "2027-01-20", "tarih": "2027-01-20"}],
    "af1": [],
    # C2 (T3 kilit günü): P2 KİLİT GÜNÜ (31.12) F2'yi kapattı → S11: F2 kapalı, KS2 5000 ayrı borç (vade 01.01) → 02.01'de 5000.
    # P5 L+1 (01.01) alındı → S8: KS5 P5'i geri alır, F5 kendi vadesiyle (15.02) açık; 13.01'de gecikmiş yalnız KS2 5000; 16.02'de 13000
    "g2a/gecikmis": 5000, "g2b/gecikmis": 5000, "g2c/gecikmis": 13000,
    "ak2": [{"k": "karsiliksiz:KS2", "tur": "karsiliksiz", "kalan": 5000, "vade": "2027-01-01", "tarih": "2027-01-01"},
            {"k": "fatura:F5", "tur": "fatura", "kalan": 8000, "vade": "2027-02-15", "tarih": "2027-01-01"}],
    "af2": [{"fatura": "F5", "kalan": 8000, "vade": "2027-02-15", "tarih": "2027-01-01"}],
    # C3: KS7 (01.12) kilitli dönemde → S8: P7 geri alınır, F7 kendi vadesiyle (31.03) açık. P4 (20.11) o gün açık F7 (vade 31.03) ve F4
    # (vade 28.02) arasında vadesi önce gelen F4'ün 12000'ini kapattı (tamamen dağıldı) → KS4 kilitten sonra: F4'ün kapanan kısmı açılmaz;
    # F4 kalan 18000 (vade 28.02), KS4 12000 ayrı borç (vade 10.01). 11.01: 12000; 01.03: 12000 + 18000 = 30000; 01.04: + F7 = 40000
    "g3a/gecikmis": 12000, "g3a/kahin_susuyor": 0, "g3b/gecikmis": 30000, "g3c/gecikmis": 40000,
    "ak3": [{"k": "karsiliksiz:KS4", "tur": "karsiliksiz", "kalan": 12000, "vade": "2027-01-10", "tarih": "2027-01-10"},
            {"k": "fatura:F4", "tur": "fatura", "kalan": 18000, "vade": "2027-02-28", "tarih": "2026-11-15"},
            {"k": "fatura:F7", "tur": "fatura", "kalan": 10000, "vade": "2027-03-31", "tarih": "2026-10-01"}],
    "af3": [{"fatura": "F4", "kalan": 18000, "vade": "2027-02-28", "tarih": "2026-11-15"},
            {"fatura": "F7", "kalan": 10000, "vade": "2027-03-31", "tarih": "2026-10-01"}],
    # T1 (T2 tedarikçi tarafı): ciro ödemesi O6 (06.11) A1'i kilitli dönemde kapattı → A1 açılmaz; ciro dönüşü 7000 ayrı alacak (vade 20.01)
    "akT": [{"k": "ciro_donus:KS6", "tur": "ciro_donus", "kalan": -7000, "vade": "2027-01-20", "tarih": "2027-01-20"}],
    "afT": [],
    # T5 hatırlatma: ayrı borç otomatik listede (şüpheli kaydı yok): C1 27000, C2 5000 (F5 vadesi gelmedi), C3 12000 (F4, F7 gelmedi)
    "hat/otomatik": {"C1": 27000, "C2": 5000, "C3": 12000}, "hat/supheli_etiketli": [], "hat/elle": {},
    # T5 cari bakiyesi ve yevmiye S8 ile aynı (Ç-07 / Ç-08 maddeleri aynen): C1 = F1 20000 + F6 7000 − P1 20000 − P6 7000 + KS1 20000
    # + KS6 7000 = 27000; C2 = 5000 + 8000 − 5000 − 8000 + 5000 + 8000 = 13000;
    # C3 = 10000 − 10000 + 10000 + 30000 − 12000 + 12000 = 40000; T1 = −7000 + 7000 − 7000 = −7000; bütün çekler portföyden çıktı
    "mz/satirlar/120|C1/bakiye": 27000, "mz/satirlar/120|C2/bakiye": 13000, "mz/satirlar/120|C3/bakiye": 40000,
    "mz/satirlar/320|T1/bakiye": -7000, "mz/satirlar/101.01/bakiye": 0, "mz/satirlar/600/bakiye": -80000, "mz/satirlar/770/bakiye": 7000,
    # T6 devirli = devirsiz (aynı kilit L = K): devirde K'de açık yalnız C3'ün F4 (18000) ve F7 (10000) kalanları (kendi vadeleriyle, M2);
    # yeni yılda çeklerin tahsilatı arşivde → karşılıksızlar M1c ayrı kalem; bütün sayılar devirden önceyle AYNI
    "devir/acilis/acik_kalemler": [
        {"cari": "C3", "k": "fatura:F4", "tur": "fatura", "kalan": 18000, "vade": "2027-02-28", "belge_tarihi": "2026-11-15"},
        {"cari": "C3", "k": "fatura:F7", "tur": "fatura", "kalan": 10000, "vade": "2027-03-31", "belge_tarihi": "2026-10-01"}],
    "g1cd/gecikmis": 27000,
    "ak1d": [{"k": "karsiliksiz:KS1", "tur": "karsiliksiz", "kalan": 20000, "vade": "2027-01-15", "tarih": "2027-01-15"},
             {"k": "karsiliksiz:KS6", "tur": "karsiliksiz", "kalan": 7000, "vade": "2027-01-20", "tarih": "2027-01-20"}],
    "af1d": [], "g2ad/gecikmis": 5000, "g2bd/gecikmis": 5000,
    "af2d": [{"fatura": "F5", "kalan": 8000, "vade": "2027-02-15", "tarih": "2027-01-01"}],
    "g3ad/gecikmis": 12000,
    "ak3d": [{"k": "karsiliksiz:KS4", "tur": "karsiliksiz", "kalan": 12000, "vade": "2027-01-10", "tarih": "2027-01-10"},
             {"k": "fatura:F4", "tur": "fatura", "kalan": 18000, "vade": "2027-02-28", "tarih": "2026-11-15"},
             {"k": "fatura:F7", "tur": "fatura", "kalan": 10000, "vade": "2027-03-31", "tarih": "2026-10-01"}],
    "akTd": [{"k": "ciro_donus:KS6", "tur": "ciro_donus", "kalan": -7000, "vade": "2027-01-20", "tarih": "2027-01-20"}],
    "afTd": [], "hatd/otomatik": {"C1": 27000, "C2": 5000, "C3": 12000},
}}, aciklama="S11: kilitli dönemde çekle kapanan fatura kilitten sonraki karşılıksızla yeniden açılmaz; karşılıksız tutar ayrı borç (vade karşılıksız günü); "
             "kilit günü sınırı, kısmi kapanış, ciro (tedarikçi tarafı); devirli ve devirsiz aynı.")

# ------------------------------------------------------------------------------------------------ S64
S("s64-s12-kasa-acilistan-once", ["S12", "M-01", "EK-2B 33", "EK-2 §4 (8)", "G-4"], [
    # T11 açılışsız Kasa: kural yok
    o("kasa_giris", "2026-01-20", id="KG0", tutar=200),
    o("kasa_giris", "2026-02-01", id="KG1", tutar=1000),
    o("kasa_acilis", "2026-02-15", tutar=10000),                          # red KASA_ACILIS_SONRA (ilk hareket 20.01; R8 aynen)
    o("kasa_acilis", "2026-01-20", id="KA", tutar=10000),                 # kabul: ilk hareketle aynı gün
    # T10 açılış günü / bir gün önce
    o("kasa_giris", "2026-01-20", tutar=300),                             # kabul (aynı gün)
    o("kasa_giris", "2026-01-19", tutar=400),                             # red KASA_ACILIS_ONCE
    # T9 Kasa'ya yazan her kaynak
    o("tahsilat", "2026-01-10", cari="C1", yol="nakit", tutar=1000),      # red
    o("odeme", "2026-01-15", cari="T1", yol="nakit", tutar=500),          # red
    o("satis_faturasi", "2026-01-10", id="F1", cari="C1", M=1000, K=0),   # kabul (Kasa'ya dokunmaz)
    o("tahsilat", "2026-01-12", id="P1", cari="C3", yol="cek", evrak="CK1", tutar=4000),   # kabul (101, Kasa değil)
    o("evrak_tahsil", "2026-01-18", evrak="CK1", yol="kasa"),             # red (çek Kasa'dan tahsil)
    o("evrak_tahsil", "2026-01-25", evrak="CK1", yol="kasa"),             # kabul
    # T12 düzeltme
    o("kasa_giris", "2026-02-10", id="KG2", tutar=700),
    o("duzenle", kaynak="KG2", degisiklik={"tarih": "2026-01-19"}),       # red (KG2 10.02'de kalır)
    o("duzenle", kaynak="KG2", degisiklik={"tarih": "2026-01-20"}),       # kabul (aynı gün)
    # T11 açılışı öne almak serbest; kural yeni tarihle işler
    o("duzenle", kaynak="KA", degisiklik={"tarih": "2026-01-05"}),
    o("kasa_giris", "2026-01-06", tutar=50),                              # kabul
    o("kasa_giris", "2026-01-04", tutar=60),                              # red
    MZ("mz", "2026-01-01", "2026-02-28"),
    R("yev", "yevmiye", bas="2026-01-04", son="2026-01-06"), R("yev20", "yevmiye", bas="2026-01-20", son="2026-01-20"),
    R("mod19", "moduller", tarih="2026-01-19"), R("mod20", "moduller", tarih="2026-01-20"),
], {"A": {
    # red sırası: açılışın ilk hareketten sonraya girilmesi (R8) + altı "açılıştan önce" (Kasa Girişi, nakit tahsilat, nakit ödeme, çekin Kasa'dan
    # tahsili, düzeltme, öne alınan açılıştan önceki giriş)
    "redler": ["KASA_ACILIS_SONRA", "KASA_ACILIS_ONCE", "KASA_ACILIS_ONCE", "KASA_ACILIS_ONCE", "KASA_ACILIS_ONCE", "KASA_ACILIS_ONCE",
               "KASA_ACILIS_ONCE"],
    # Kasa = KG0 200 + KG1 1000 + KA 10000 + 300 + çek 4000 + KG2 700 + 50 = 16250; carisiz girişler 649.90'da (KG-3 A) 200+1000+300+700+50
    "mz/satirlar/100/bakiye": 16250, "mz/satirlar/649.90/bakiye": -2250, "mz/satirlar/519/bakiye": -10000,
    # reddedilen nakit tahsilat / ödeme cariye de yazılmaz (kaydın tamamı reddedilir)
    "mz/satirlar/120|C1/bakiye": 1000, "mz/satirlar/320|T1/bakiye": 0, "mz/satirlar/120|C3/bakiye": -4000, "mz/satirlar/101.01/bakiye": 0,
    # 04.01–06.01: yalnız öne alınan açılış (05.01, açılış sınıfı) ve 06.01 girişi; 04.01 girişi yok
    "yev/0/kaynak": "KA", "yev/0/tarih": "2026-01-05", "yev/0/sinif": 0, "yev/1/tur": "kasa_giris", "yev/1/tarih": "2026-01-06",
    "yev/1/satirlar/0/b": 50,
    # KG2 düzeltmeyle 20.01'de (aynı gün kabul): 20.01 maddeleri KG0, 300'lük giriş, KG2
    "yev20/2/kaynak": "KG2",
    # Kasa 19.01 = 10000 + 50; 20.01 = + 200 + 300 + 700
    "mod19/kasa": 10050, "mod20/kasa": 11250,
}}, aciklama="S12: Kasa açılışından önce tarihli Kasa hareketi (yeni ya da düzeltme) reddedilir; aynı gün olur; açılışsız Kasa'da kural yok.")

# ------------------------------------------------------------------------------------------------ S65
S("s65-m1f-vade-gunu", ["M1f", "B1", "S1", "H-03", "EK-1 §1 adım 5"], [
    o("taksit_karti", "2026-03-01", id="TK", cari="C1", kaynak="yeni_borc", toplam=9000,
      taksitler=[{"vade": "2026-04-01", "tutar": 3000}, {"vade": "2026-04-02", "tutar": 3000}, {"vade": "2026-04-03", "tutar": 3000}]),
    o("satis_faturasi", "2026-03-10", id="F1", cari="C3", M=5000, K=0, vade="2026-04-02"),
    o("satis_faturasi", "2026-12-01", id="F2", cari="C2", M=4000, K=0, vade="2026-12-31"),
    R("g1a", "gecikmis", cari="C1", tarih="2026-04-01"), R("g1b", "gecikmis", cari="C1", tarih="2026-04-02"),
    R("g1c", "gecikmis", cari="C1", tarih="2026-04-03"), R("g1d", "gecikmis", cari="C1", tarih="2026-04-04"),
    R("g3a", "gecikmis", cari="C3", tarih="2026-04-02"), R("g3b", "gecikmis", cari="C3", tarih="2026-04-03"),
    R("h1", "hatirlatma", tarih="2026-04-02"), R("h2", "hatirlatma", tarih="2026-04-03"),
    R("g2a", "gecikmis", cari="C2", tarih="2026-12-31"), R("g2b", "gecikmis", cari="C2", tarih="2027-01-01"),
], {"A": {
    # M1f: gecikmiş ⇔ vade < bugün. 01.04: ilk taksitin vadesi BUGÜN → 0; 02.04: 01.04'lük taksit DÜN → 3000 (02.04'lük bugün, sayılmaz);
    # 03.04: 6000; 04.04: 9000
    "g1a/gecikmis": 0, "g1b/gecikmis": 3000, "g1b/detay": [{"kalem": "kart:TK", "vade": "2026-04-01", "kalan": 3000}],
    "g1c/gecikmis": 6000, "g1d/gecikmis": 9000,
    # fatura da aynı: vade 02.04 → 02.04'te 0, 03.04'te 5000
    "g3a/gecikmis": 0, "g3b/gecikmis": 5000,
    # hatırlatma = gecikmiş: 02.04'te yalnız C1 3000 (C3'ün faturası vade gününde); 03.04'te C1 6000, C3 5000
    "h1/otomatik": {"C1": 3000}, "h2/otomatik": {"C1": 6000, "C3": 5000},
    # yıl dönümü: vade 31.12 → 31.12'de 0, 01.01'de 4000
    "g2a/gecikmis": 0, "g2b/gecikmis": 4000,
}}, aciklama="M1f: vadesi bugün olan gecikmiş değildir, gecikme ertesi gün başlar (taksit, fatura, yıl dönümü, hatırlatma).")

# ================================================================================================ KÂHİN BAKIMI 4 (06.11.2026)
# Kaynak: kullanıcı kararı 06.11 04:50 UTC S14, S15, S18, S19, S20, S21 ("hepsine A"; iş listesi D, AYNEN). Beklenenler model DEĞİŞTİRİLMEDEN ÖNCE elle yazıldı
# (README "Kâhin bakımı 4", Y1…Y23).

# ------------------------------------------------------------------------------------------------ S66
S("s66-s18-avans-evrak-karsiliksiz", ["S18", "S11", "EK-1 M1c", "Ç-07", "karar (1)", "M2", "G2"], [
    o("satis_faturasi", "2026-11-01", id="F0", cari="C3", M=6000, K=0, vade="2026-11-30"),
    # C1: çek kilitli dönemde alındı, o gün açık borç yok → L'de tamamı avans
    o("tahsilat", "2026-11-10", id="P1", cari="C1", yol="cek", evrak="CK1", tutar=10000),
    # C3: çek F0'ın 6000'ini kapattı (kilitli dönem), 4000 avans
    o("tahsilat", "2026-11-10", id="P3", cari="C3", yol="cek", evrak="CK3", tutar=10000),
    # C2: çek avans; karşılıksız anında hâlâ 4000'i dağılmamış olacak
    o("tahsilat", "2026-11-12", id="P2", cari="C2", yol="cek", evrak="CK2", tutar=10000),
    o("donem_kilitle", tarih="2026-12-31"),
    # avanslar kilitten SONRA faturaları kapatır
    o("satis_faturasi", "2027-01-05", id="F1", cari="C1", M=10000, K=0, vade="2027-03-31"),
    o("satis_faturasi", "2027-01-06", id="F3", cari="C3", M=4000, K=0, vade="2027-03-31"),
    o("satis_faturasi", "2027-01-07", id="F2", cari="C2", M=6000, K=0, vade="2027-03-31"),
    o("evrak_karsiliksiz", "2027-01-10", id="KS1", evrak="CK1"),
    o("evrak_karsiliksiz", "2027-01-10", id="KS3", evrak="CK3"),
    o("evrak_karsiliksiz", "2027-01-10", id="KS2", evrak="CK2"),
    R("g1a", "gecikmis", cari="C1", tarih="2027-01-10"), R("g1b", "gecikmis", cari="C1", tarih="2027-01-11"),
    R("ak1", "acik_kalemler", cari="C1", tarih="2027-01-11"), R("af1", "acik_faturalar", cari="C1", tarih="2027-01-11"),
    R("g3", "gecikmis", cari="C3", tarih="2027-01-11"), R("ak3", "acik_kalemler", cari="C3", tarih="2027-01-11"),
    R("af3", "acik_faturalar", cari="C3", tarih="2027-01-11"),
    R("g2", "gecikmis", cari="C2", tarih="2027-01-11"), R("ak2", "acik_kalemler", cari="C2", tarih="2027-01-11"),
    R("hat", "hatirlatma", tarih="2027-01-11"),
    MZ("mz", "2026-11-01", "2027-01-31"),
    o("devir", K="2026-12-31", ad="devir"),
    R("g1d", "gecikmis", cari="C1", tarih="2027-01-11"), R("g3d", "gecikmis", cari="C3", tarih="2027-01-11"),
    R("g2d", "gecikmis", cari="C2", tarih="2027-01-11"), R("ak2d", "acik_kalemler", cari="C2", tarih="2027-01-11"),
], {"A": {
    # S18 A: kilitli dönemde alınmış çekin TAMAMI ayrı borç (vade karşılıksız günü); kilitten sonra kapattığı fatura AÇILMAZ; kâhin susmaz.
    # C1: KS1 10000 vade 10.01 → 10.01'de vadesi bugün (M1f) 0; 11.01'de 10000; F1 Ödendi. (S18 B olsaydı F1 kendi vadesiyle (31.03) açılır → 0.)
    "g1a/gecikmis": 0, "g1b/gecikmis": 10000, "g1b/kahin_susuyor": 0,
    "ak1": [{"k": "karsiliksiz:KS1", "tur": "karsiliksiz", "kalan": 10000, "vade": "2027-01-10", "tarih": "2027-01-10"}],
    "af1": [],
    # C3: F0 (kilitten önce) ve F3 (kilitten sonra, avansla) kapalı kalır; KS3 10000 ayrı borç → 10000. (B: F3 4000 açılır + 6000 → 6000; S8 harfiyen:
    # F0 6000 (vade 30.11, gecikmiş) + F3 4000 (vade 31.03) → 6000.)
    "g3/gecikmis": 10000, "g3/kahin_susuyor": 0,
    "ak3": [{"k": "karsiliksiz:KS3", "tur": "karsiliksiz", "kalan": 10000, "vade": "2027-01-10", "tarih": "2027-01-10"}],
    "af3": [],
    # C2: KS2 10000 ayrı borç; çekin hâlâ dağılmamış 4000'i (avans) kendi kuyruğunda ona uygulanır → açık 6000 (vade 10.01); bakiye −10000 + 6000 + 10000
    "g2/gecikmis": 6000, "g2/kahin_susuyor": 0,
    "ak2": [{"k": "karsiliksiz:KS2", "tur": "karsiliksiz", "kalan": 6000, "vade": "2027-01-10", "tarih": "2027-01-10"}],
    "hat/otomatik": {"C1": 10000, "C2": 6000, "C3": 10000}, "hat/supheli_etiketli": [], "hat/elle": {},
    "mz/satirlar/120|C1/bakiye": 10000, "mz/satirlar/120|C3/bakiye": 10000, "mz/satirlar/120|C2/bakiye": 6000,
    "mz/satirlar/101.01/bakiye": 0, "mz/satirlar/600/bakiye": -26000,
    # devirli = devirsiz: K'de avanslar devir net satırıyla (evraka bağlanmadan) taşınır; karşılıksızlar M1c ayrı kalem → aynı sayılar
    "g1d/gecikmis": 10000, "g3d/gecikmis": 10000, "g2d/gecikmis": 6000,
    "ak2d": [{"k": "karsiliksiz:KS2", "tur": "karsiliksiz", "kalan": 6000, "vade": "2027-01-10", "tarih": "2027-01-10"}],
}}, aciklama="S18: kilitli dönemde alınıp kilit günü sonunda tamamen dağılmamış (avans) çek karşılıksız dönerse çekin tamamı ayrı borç; devirli = devirsiz.")

# ------------------------------------------------------------------------------------------------ S67
S("s67-s19-kilit-ilerletme", ["S19", "S11", "S8", "karar (2)", "karar (3)", "EK-2B 28", "M1c"], [
    o("satis_faturasi", "2026-11-01", id="F1", cari="C1", M=10000, K=0, vade="2027-03-31"),
    o("satis_faturasi", "2026-11-02", id="F3", cari="C3", M=10000, K=0, vade="2027-03-31"),
    o("satis_faturasi", "2026-11-03", id="F2", cari="C2", M=10000, K=0, vade="2026-11-30"),
    o("tahsilat", "2026-11-10", id="P3", cari="C3", yol="cek", evrak="CK3", tutar=10000, fatura="F3"),
    o("donem_kilitle", tarih="2026-11-30"),                                                       # L1
    o("satis_faturasi", "2026-12-05", id="F4", cari="C2", M=10000, K=0, vade="2027-03-31"),
    o("tahsilat", "2026-12-20", id="P1", cari="C1", yol="cek", evrak="CK1", tutar=10000, fatura="F1"),
    o("tahsilat", "2026-12-20", id="P2", cari="C2", yol="nakit", tutar=10000),                   # bağsız: o gün F2'yi kapatır
    o("satis_faturasi", "2027-01-05", id="F5", cari="C2", M=10000, K=0),                         # vadesiz → vade 05.01
    o("tahsilat", "2027-01-10", id="T2", cari="C2", yol="nakit", tutar=10000, fatura="F2"),       # bağ, L1 altında yazıldı
    o("evrak_karsiliksiz", "2027-01-15", id="KS1", evrak="CK1"),                                  # L1 altında yazıldı
    o("evrak_karsiliksiz", "2027-01-15", id="KS3", evrak="CK3"),                                  # L1 altında yazıldı
    R("g1a", "gecikmis", cari="C1", tarih="2027-02-01"), R("ak1a", "acik_kalemler", cari="C1", tarih="2027-02-01"),
    R("g3a", "gecikmis", cari="C3", tarih="2027-02-01"), R("ak3a", "acik_kalemler", cari="C3", tarih="2027-02-01"),
    R("g2a", "gecikmis", cari="C2", tarih="2027-02-01"), R("ak2a", "acik_kalemler", cari="C2", tarih="2027-02-01"),
    R("not2a", "kilit_bag_notu", cari="C2", tarih="2027-02-01"),
    o("donem_kilitle", tarih="2026-12-31"),                                                       # kilit P1 / P2 günlerini kapsayacak biçimde ilerler
    R("g1b", "gecikmis", cari="C1", tarih="2027-02-01"), R("g3b", "gecikmis", cari="C3", tarih="2027-02-01"),
    R("g2b", "gecikmis", cari="C2", tarih="2027-02-01"), R("not2b", "kilit_bag_notu", cari="C2", tarih="2027-02-01"),
    o("donem_kilitle", tarih="2027-01-31"),                                                       # karşılıksız ve bağ günlerini de kapsar
    R("g1c", "gecikmis", cari="C1", tarih="2027-02-01"), R("ak1c", "acik_kalemler", cari="C1", tarih="2027-02-01"),
    R("g3c", "gecikmis", cari="C3", tarih="2027-02-01"), R("ak3c", "acik_kalemler", cari="C3", tarih="2027-02-01"),
    R("g2c", "gecikmis", cari="C2", tarih="2027-02-01"), R("ak2c", "acik_kalemler", cari="C2", tarih="2027-02-01"),
    MZ("mz", "2026-11-01", "2027-02-28"),
], {"A": {
    # C1: KS1 yazılırken kilit 30.11; çek 20.12'de alındı (> kilit) → S8: P1 geri alınır, F1 kendi vadesiyle (31.03) açık → 01.02'de 0.
    # Kilit 31.12'ye (çeki kapsayacak) ve 31.01'e ilerletilse de karar DEĞİŞMEZ (S19 A). (Güncel kilitle okunsaydı 31.12 kilidinde S11 → 10000.)
    "g1a/gecikmis": 0, "g1b/gecikmis": 0, "g1c/gecikmis": 0,
    "ak1a": [{"k": "fatura:F1", "tur": "fatura", "kalan": 10000, "vade": "2027-03-31", "tarih": "2026-11-01"}],
    "ak1c": [{"k": "fatura:F1", "tur": "fatura", "kalan": 10000, "vade": "2027-03-31", "tarih": "2026-11-01"}],
    # C3: KS3 yazılırken kilit 30.11 ve çek 10.11'de (≤ kilit) → S11: F3 kapalı, KS3 10000 ayrı borç (vade 15.01) → 10000. Kilit 31.01'e (karşılıksızı da
    # kapsayacak) ilerletilse de S11 kalır. (Güncel kilitle okunsaydı 31.01 kilidinde S8 → F3 31.03 vadesiyle → 0.)
    "g3a/gecikmis": 10000, "g3b/gecikmis": 10000, "g3c/gecikmis": 10000,
    "ak3a": [{"k": "karsiliksiz:KS3", "tur": "karsiliksiz", "kalan": 10000, "vade": "2027-01-15", "tarih": "2027-01-15"}],
    "ak3c": [{"k": "karsiliksiz:KS3", "tur": "karsiliksiz", "kalan": 10000, "vade": "2027-01-15", "tarih": "2027-01-15"}],
    # C2 (R3, README Y12): T2 yazılırken kilit 30.11; P2'nin F2'yi kapatışı 20.12'de (> kilit) → karar (2): T2 F2'yi kapatır, P2 serbest kalır ve KENDİ
    # gününde (20.12) F4'ü kapatır; F5 (vade 05.01) açık → 10000; kilit notu yok. Kilit 31.12'ye ilerlese de değişmez. (Güncel kilitle okunsaydı 31.12
    # kilidinde R3: P2 F2'de kalır, T2 bağsız 10.01'de F5'i kapatır, F4 (31.03) açık → 0 + kilit notu.)
    "g2a/gecikmis": 10000, "g2b/gecikmis": 10000, "g2c/gecikmis": 10000,
    "ak2a": [{"k": "fatura:F5", "tur": "fatura", "kalan": 10000, "vade": "2027-01-05", "tarih": "2027-01-05"}],
    "ak2c": [{"k": "fatura:F5", "tur": "fatura", "kalan": 10000, "vade": "2027-01-05", "tarih": "2027-01-05"}],
    "not2a": [], "not2b": [],
    # bakiyeler kilitten bağımsız (kuyruk kuralı; yevmiye aynı)
    "mz/satirlar/120|C1/bakiye": 10000, "mz/satirlar/120|C3/bakiye": 10000, "mz/satirlar/120|C2/bakiye": 10000,
    "mz/satirlar/100/bakiye": 20000, "mz/satirlar/101.01/bakiye": 0,
}}, aciklama="S19: S11 / R3 kararı karşılıksızın (bağın) yazıldığı andaki kilide göre bir kez verilir; kilit sonradan ilerletilirse değişmez.")

# ------------------------------------------------------------------------------------------------ S68
S("s68-s14-supheli-caride-bagli-cek", ["S14", "K3", "§3.11b/2 (b)", "karar (2)", "J-01", "J-04", "J-06", "K6", "M13"], [
    o("satis_faturasi", "2026-03-01", id="F1", cari="C1", M=10000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-01", id="F4", cari="C3", M=10000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-01", id="F6", cari="C2", M=6000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-02", id="F5", cari="C3", M=10000, K=0, vade="2026-04-15"),
    o("satis_faturasi", "2026-03-02", id="F7", cari="C2", M=3000, K=0, vade="2026-04-05"),
    o("satis_faturasi", "2026-03-03", id="F8", cari="C2", M=2000, K=0, vade="2026-04-10"),
    o("satis_faturasi", "2026-03-05", id="F2", cari="C1", M=8000, K=0, vade="2026-04-30"),
    # C2: üç kayıt (SC → F6, SD → F7, SG → F8); SD Şüpheliden Çıkar ile döner
    o("supheliye_al", "2026-04-01", id="SC", cari="C2", tutar=6000),
    o("supheliye_al", "2026-04-05", id="SD", cari="C2", tutar=3000),
    o("supheliye_al", "2026-04-06", id="SG", cari="C2", tutar=2000),
    o("supheliden_cikar", "2026-04-10", cari="C2", kayit="SD"),
    o("tahsilat", "2026-04-20", id="P4", cari="C2", yol="cek", evrak="CK4", tutar=3000, fatura="F7"),
    o("tahsilat", "2026-04-22", id="P5", cari="C2", yol="senet", evrak="SN5", tutar=2000, fatura="F8"),
    # C1: SA → F1; karşılık; kayıttan SONRA kesilen F3
    o("supheliye_al", "2026-05-01", id="SA", cari="C1", tutar=10000),
    # C3: SB 15000 → F4 10000 + F5'in 5000'i (F5 kısmen aktarıldı)
    o("supheliye_al", "2026-05-01", id="SB", cari="C3", tutar=15000),
    o("karsilik_ayir", "2026-05-02", cari="C1", tutar=4000, kayit="SA"),
    o("satis_faturasi", "2026-05-10", id="F3", cari="C1", M=5000, K=0, vade="2026-06-30"),
    o("tahsilat", "2026-05-15", id="P2", cari="C1", yol="senet", evrak="SN2", tutar=5000, fatura="F3"),
    o("tahsilat", "2026-05-16", id="P1", cari="C1", yol="cek", evrak="CK1", tutar=10000, fatura="F1"),
    o("tahsilat", "2026-05-20", id="P3", cari="C3", yol="cek", evrak="CK3", tutar=10000, fatura="F5"),
    R("g1", "gecikmis", cari="C1", tarih="2026-06-01"), R("g3", "gecikmis", cari="C3", tarih="2026-06-01"),
    R("g2", "gecikmis", cari="C2", tarih="2026-05-01"),
    R("sk1", "supheli_kayitlari", cari="C1"), R("sk2", "supheli_kayitlari", cari="C2"), R("sk3", "supheli_kayitlari", cari="C3"),
    R("hat", "hatirlatma", tarih="2026-06-01"),
    R("yevP1", "yevmiye", bas="2026-05-16", son="2026-05-16"),
    MZ("mz", "2026-03-01", "2026-06-30"),
], {"A": {
    # S14 A: bağlı çek / senet bağlı faturanın DURDUĞU hesaptan düşer. Eski kâhin (bağlı tahsilat her zaman 120, sınırıyla) P1, P3, P5'i
    # SUPHELI_NORMAL_ASIM ile reddederdi; S14'te yalnız 120'ye kalan kısım sınıra girer → red yok.
    "redler": [],
    # C1: F1 SA ile şüpheliye aktarıldı → P1 A 128 10000 (SA); SA kalanı 0 → karşılık 4000 644'e (K6). F3 kayıttan SONRA kesildi → P2 A 120 5000.
    # 120 = 10000 + 8000 + 5000 − 10000 (J-01) − 5000 (P2) = 8000 (F2); 128 0; 129 0. Gecikmiş 01.06: F2 (vade 30.04) 8000; şüpheli 0
    "mz/satirlar/120|C1/bakiye": 8000, "mz/satirlar/128|C1/bakiye": 0, "mz/satirlar/129|C1/bakiye": 0,
    "mz/satirlar/644/bakiye": -4000, "mz/satirlar/654/bakiye": 4000,
    "g1/gecikmis": 8000, "g1/supheli": 0, "g1/kahin_susuyor": 0,
    "sk1/0/id": "SA", "sk1/0/kalan": 0, "sk1/0/karsilik": 0,
    "yevP1/0/kaynak": "P1", "yevP1/0/satirlar/0/h": "101.01", "yevP1/0/satirlar/0/b": 10000, "yevP1/0/satirlar/1/h": "128",
    "yevP1/0/satirlar/1/c": "C1", "yevP1/0/satirlar/1/a": 10000, "yevP1/1/tur": "karsilik_cozulme", "yevP1/1/satirlar/1/h": "644",
    # C3: F5 kısmen aktarıldı (5000 128'de, 5000 120'de); çek F5'in iki kısmının toplamı kadar (10000) → tek okuma: A 128 5000 (SB) + A 120 5000.
    # 120 = 20000 − 15000 − 5000 = 0; 128 = 15000 − 5000 = 10000 (F4). Sınır: normal kısım 5000 = 120 bakiyesi 5000 → red yok
    "mz/satirlar/120|C3/bakiye": 0, "mz/satirlar/128|C3/bakiye": 10000,
    "g3/gecikmis": 0, "g3/supheli": 10000, "g3/kahin_susuyor": 0, "sk3/0/kalan": 10000,
    # C2: SD Şüpheliden Çıkar ile döndü → F7 120'de → P4 A 120 3000 (açık kayıt SC, SG olsa da). F8 SG'de → P5 A 128 2000 SG'den (en eski açık kayıt
    # SC'den DEĞİL). 120 = 11000 − 11000 + 3000 − 3000 = 0; 128 = 11000 − 3000 − 2000 = 6000 (SC: F6)
    "mz/satirlar/120|C2/bakiye": 0, "mz/satirlar/128|C2/bakiye": 6000,
    "g2/gecikmis": 0, "g2/supheli": 6000,
    "sk2/0/id": "SC", "sk2/0/kalan": 6000, "sk2/1/id": "SD", "sk2/1/kalan": 0, "sk2/2/id": "SG", "sk2/2/kalan": 0,
    # hatırlatma (S7 A): C1'in açık şüpheli kaydı yok → otomatik 8000; C2, C3 etiketli, şüphesiz gecikmiş yok
    "hat/otomatik": {"C1": 8000}, "hat/supheli_etiketli": ["C2", "C3"], "hat/elle": {},
    # evrak portföyü: CK1 10000 + CK4 3000 + CK3 10000; senet SN2 5000 + SN5 2000
    "mz/satirlar/101.01/bakiye": 23000, "mz/satirlar/121.01/bakiye": 7000, "mz/satirlar/600/bakiye": -54000,
}}, aciklama="S14: şüpheli alacaklı caride faturaya bağlı çek / senet bağlı faturanın durduğu hesaptan düşer (aktarılmış 128 — o kalemin kaydından; "
             "sonradan kesilmiş ya da Şüpheliden Çıkar ile dönmüş 120); sınır yalnız normal kısma.")

# ------------------------------------------------------------------------------------------------ S69
S("s69-s15-kartli-fatura-iptal", ["S15", "S5", "EK-2B 35", "F-15", "G-7", "karar (1)", "H-01", "H-04"], [
    o("satis_faturasi", "2026-01-05", id="F0", cari="C1", M=4000, K=0, vade="2026-01-31"),
    o("satis_faturasi", "2026-01-10", id="F1", cari="C1", M=12000, K=0),
    o("tahsilat", "2026-01-10", id="P0", cari="C1", yol="havale", banka="B1", tutar=3000, fatura="F1", fatura_odemesi=True),   # formdaki peşin
    o("taksit_karti", "2026-01-10", id="TK1", cari="C1", kaynak="fatura", fatura="F1", toplam=9000,
      taksitler=[{"vade": "2026-02-10", "tutar": 3000}, {"vade": "2026-03-10", "tutar": 3000}, {"vade": "2026-04-10", "tutar": 3000}]),
    o("satis_faturasi", "2026-01-20", id="F2", cari="C3", M=6000, K=0),
    o("taksit_karti", "2026-01-20", id="TK2", cari="C3", kaynak="fatura", fatura="F2", toplam=6000,
      taksitler=[{"vade": "2026-02-20", "tutar": 3000}, {"vade": "2026-03-20", "tutar": 3000}]),
    o("tahsilat", "2026-02-10", id="P1", cari="C1", yol="havale", banka="B1", tutar=3000, taksit_karti="TK1"),
    o("tahsilat", "2026-02-20", id="P3", cari="C3", yol="havale", banka="B1", tutar=3000, taksit_karti="TK2"),
    o("tahsilat", "2026-03-12", id="P2", cari="C1", yol="havale", banka="B1", tutar=1000, taksit_karti="TK1"),   # kısmi
    R("g1a", "gecikmis", cari="C1", tarih="2026-03-15"), R("kt1a", "kartlar", cari="C1", tarih="2026-03-15"),
    o("iptal", kaynak="F1"),
    R("g1b", "gecikmis", cari="C1", tarih="2026-03-16"), R("ak1b", "acik_kalemler", cari="C1", tarih="2026-03-16"),
    R("kt1b", "kartlar", cari="C1", tarih="2026-03-16"), R("af1b", "acik_faturalar", cari="C1", tarih="2026-03-16"),
    o("donem_kilitle", tarih="2026-02-28"),
    o("iptal", kaynak="F2"),                                                  # kilitli dönemdeki fatura → red
    R("g3", "gecikmis", cari="C3", tarih="2026-03-21"), R("kt3", "kartlar", cari="C3", tarih="2026-03-21"),
    R("durum_F1", "kaynak_durumu", kaynak="F1"), R("durum_F2", "kaynak_durumu", kaynak="F2"),
    MZ("mz", "2026-01-01", "2026-04-30"),
], {"A": {
    # iptalden önce (15.03): F0 4000 (vade 31.01) + 2. taksitin kalanı 2000 (vade 10.03) → 6000
    "g1a/gecikmis": 6000,
    "kt1a": {"TK1": {"kapali": False, "taksitler": [{"vade": "2026-02-10", "tutar": 3000, "kalan": 0},
                                                    {"vade": "2026-03-10", "tutar": 3000, "kalan": 2000},
                                                    {"vade": "2026-04-10", "tutar": 3000, "kalan": 3000}]}},
    # S15 A: iptal KABUL; formdaki peşin P0 faturayla düşer (S5); kart kapanır; P1 (10.02, 3000) ve P2 (12.03, 1000) carinin bağsız alacağı olur ve
    # KENDİ günlerinde açık borcu (F0 4000, vade 31.01) kapatır (karar (1)) → açık kalem yok, gecikmiş 0, bakiye 0
    "redler": ["KILITLI_DONEM"], "durum_F1": "iptal",
    "g1b/gecikmis": 0, "ak1b": [], "af1b": [], "kt1b": {"TK1": {"kapali": True, "taksitler": []}},
    "mz/satirlar/120|C1/bakiye": 0,
    # C3: kilitli dönemdeki fatura iptal edilemez (F-15 / G-7) → kart sürer; 2. taksit (20.03) 3000 gecikmiş
    "durum_F2": "aktif", "g3/gecikmis": 3000, "mz/satirlar/120|C3/bakiye": 3000,
    "kt3": {"TK2": {"kapali": False, "taksitler": [{"vade": "2026-02-20", "tutar": 3000, "kalan": 0},
                                                   {"vade": "2026-03-20", "tutar": 3000, "kalan": 3000}]}},
    # banka: P1 3000 + P2 1000 + P3 3000 (P0 faturayla düştü); gelir yalnız F0 + F2
    "mz/satirlar/102.B1/bakiye": 7000, "mz/satirlar/600/bakiye": -10000,
}}, aciklama="S15: taksit kartında tahsilatı olan faturanın İptal Et'i kabul; kart kapanır, kart tahsilatları carinin bağsız alacağı (avans) olur; kilitli dönemde iptal yok.")

# ------------------------------------------------------------------------------------------------ S70
S("s70-s20-silinenlerden-geri-yukle-kasa", ["S20", "S12", "G-7", "R-04", "M-01", "EK-2B 33", "EK-2 §4 (8)"], [
    o("kasa_giris", "2026-01-10", id="KG1", tutar=1000),                  # açılış yokken: kabul
    o("kasa_cikis", "2026-01-12", id="KC1", tutar=200),
    o("sil", kaynak="KG1"), o("sil", kaynak="KC1"),
    o("kasa_acilis", "2026-01-15", id="KA", tutar=10000),                 # Kasa'da etkin hareket yok → kabul
    o("geri_yukle", kaynak="KG1"),                                        # S20: aynen geri gelir (10.01 < açılış 15.01)
    R("mu1", "mutabakat_uyarilari", tarih="2026-01-31"),
    o("kasa_giris", "2026-01-11", tutar=500),                             # YENİ kayıt → red KASA_ACILIS_ONCE
    o("geri_yukle", kaynak="KC1"),
    o("kasa_giris", "2026-01-15", id="KG2", tutar=700),                   # açılış günü → kabul
    o("duzenle", kaynak="KA", degisiklik={"tarih": "2026-01-16"}),        # R8: ilk Kasa hareketi (geri yüklenen KG1) 10.01 → red KASA_ACILIS_SONRA
    R("mu2", "mutabakat_uyarilari", tarih="2026-01-31"),
    MZ("mz", "2026-01-01", "2026-01-31"),
    R("mod14", "moduller", tarih="2026-01-14"), R("mod15", "moduller", tarih="2026-01-15"),
    R("durum_KG1", "kaynak_durumu", kaynak="KG1"),
], {"A": {
    "redler": ["KASA_ACILIS_ONCE", "KASA_ACILIS_SONRA"],
    "mu1": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KG1", "tarih": "2026-01-10", "acilis": "2026-01-15"}],
    "mu2": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KG1", "tarih": "2026-01-10", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KC1", "tarih": "2026-01-12", "acilis": "2026-01-15"}],
    # Kasa = 1000 − 200 + 10000 + 700 = 11500 (500'lük yeni giriş yok); 649.90 = 1000 + 700; 770.90 = 200
    "mz/satirlar/100/bakiye": 11500, "mz/satirlar/649.90/bakiye": -1700, "mz/satirlar/770.90/bakiye": 200, "mz/satirlar/519/bakiye": -10000,
    "mod14/kasa": 800, "mod15/kasa": 11500, "durum_KG1": "aktif",
    # değişmez kasa_acilis_ilk: geri yüklenen kayıt hata DEĞİL (uyarı) — her senaryoda koşan değişmez denetimi temiz olmalı (README Y17)
}}, aciklama="S20: Silinenler'den geri yüklenen, Kasa açılışından önce tarihli Kasa hareketi aynen gelir (G-7); S12 yalnız yeni kayıtta; Mutabakat Testi uyarı verir.")

# ------------------------------------------------------------------------------------------------ S71
S("s71-s20-yedekten-eski-veri-kasa", ["S20", "S12", "G-7", "M-01", "EK-2B 33"], [
    # geri yüklenen yedekteki (eski sürümün yazdığı) kayıtlar: açılış 01.02, ondan önce tarihli iki Kasa hareketi
    o("kasa_acilis", "2026-02-01", id="KA", tutar=10000, yedekten=True),
    o("kasa_giris", "2026-01-20", id="KY", tutar=300, yedekten=True),
    o("tahsilat", "2026-01-25", id="PY", cari="C1", yol="nakit", tutar=500, yedekten=True),
    o("kasa_giris", "2026-01-26", tutar=400),                             # YENİ kayıt → red KASA_ACILIS_ONCE
    o("kasa_giris", "2026-02-01", id="KG3", tutar=100),                   # açılış günü → kabul
    o("duzenle", kaynak="KA", degisiklik={"tarih": "2026-02-02"}),        # R8 → red KASA_ACILIS_SONRA
    R("mu1", "mutabakat_uyarilari", tarih="2026-02-28"),
    MZ("mz", "2026-01-01", "2026-02-28"), R("mod31", "moduller", tarih="2026-01-31"),
    o("duzenle", kaynak="KA", degisiklik={"tarih": "2026-01-19"}),        # öne alma serbest → uyarı kalkar
    R("mu2", "mutabakat_uyarilari", tarih="2026-02-28"), R("mod31b", "moduller", tarih="2026-01-31"),
    R("yev", "yevmiye", bas="2026-01-19", son="2026-01-19"),
], {"A": {
    "redler": ["KASA_ACILIS_ONCE", "KASA_ACILIS_SONRA"],
    "mu1": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KY", "tarih": "2026-01-20", "acilis": "2026-02-01"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PY", "tarih": "2026-01-25", "acilis": "2026-02-01"}],
    # Kasa = 10000 + 300 + 500 + 100 = 10900; cari C1 −500; 649.90 = 300 + 100
    "mz/satirlar/100/bakiye": 10900, "mz/satirlar/120|C1/bakiye": -500, "mz/satirlar/649.90/bakiye": -400, "mz/satirlar/519/bakiye": -10000,
    "mod31/kasa": 800, "mod31/cari|C1": -500,
    "mu2": [], "mod31b/kasa": 10800,
    "yev/0/kaynak": "KA", "yev/0/sinif": 0, "yev/0/satirlar/0/h": "100", "yev/0/satirlar/0/b": 10000,
}}, aciklama="S20: yedekten geri yüklenen eski sürüm verisindeki açılış öncesi Kasa hareketi aynen; yeni kayda S12; açılışı öne almak uyarıyı kaldırır.")

# ------------------------------------------------------------------------------------------------ S72
S("s72-s21-pos-valor-resmi-tatil", ["S21", "2429", "D-01", "D-04", "T-03", "KG-6", "N-11"], [
    # 23 Nisan 2026 Perşembe (resmî tatil) → valör 24 Nisan Cuma; tatil günü yapılan POS iadesi "valörden önce" (108'den)
    o("satis_faturasi", "2026-04-22", id="F1", cari="C1", M=50000, K=0),
    o("tahsilat", "2026-04-22", id="P1", cari="C1", yol="pos", pos="POS1", tutar=50000, komisyon=1000, valor="2026-04-23"),
    o("satis_iade_faturasi", "2026-04-23", id="I1", cari="C1", M=10000, K=0, asil_fatura="F1"),
    o("pos_iade", "2026-04-23", tahsilat="P1", cari="C1", tutar=10000),
    R("mod0423", "moduller", tarih="2026-04-23"), R("mod0424", "moduller", tarih="2026-04-24"),
    R("yev0424", "yevmiye", bas="2026-04-24", son="2026-04-24"),
    # 1 Mayıs 2026 Cuma (tatil) + hafta sonu → 4 Mayıs Pazartesi
    o("satis_faturasi", "2026-04-30", id="F2", cari="C3", M=30000, K=0),
    o("tahsilat", "2026-04-30", id="P2", cari="C3", yol="pos", pos="POS1", tutar=30000, komisyon=600, valor="2026-05-01"),
    R("mod0503", "moduller", tarih="2026-05-03"), R("mod0504", "moduller", tarih="2026-05-04"),
    # 29 Ekim 2026 Perşembe → 30 Ekim Cuma (çekim günü 28 Ekim yarım gün; kaydırma yolu ona değmez)
    o("satis_faturasi", "2026-10-28", id="F4", cari="C3", M=10000, K=0),
    o("tahsilat", "2026-10-28", id="P4", cari="C3", yol="pos", pos="POS1", tutar=10000, komisyon=200, valor="2026-10-29"),
    R("mod1029", "moduller", tarih="2026-10-29"), R("mod1030", "moduller", tarih="2026-10-30"),
    # 1 Ocak 2027 Cuma → 4 Ocak Pazartesi; K'den sonraya kalan bekleyen POS devirde açılır (N-11)
    o("satis_faturasi", "2026-12-30", id="F3", cari="C1", M=20000, K=0),
    o("tahsilat", "2026-12-30", id="P3", cari="C1", yol="pos", pos="POS1", tutar=20000, komisyon=400, valor="2027-01-01"),
    MZ("mz", "2026-01-01", "2026-12-31"),
    o("devir", K="2026-12-31", ad="devir"),
    R("mod0103", "moduller", tarih="2027-01-03"), R("mod0104", "moduller", tarih="2027-01-04"),
], {"A": {
    # 23.04: valör henüz olmadı → POS bekleyen 50000 − 1000 (KG-6 komisyon çekim günü) − 10000 (iade 108'den) = 39000; banka 0
    "mod0423/pos|POS1": 39000, "mod0423/banka|B1": 0,
    # 24.04: 108 → 102 net 39000 (D-01, etkin valör günü)
    "mod0424/pos|POS1": 0, "mod0424/banka|B1": 39000,
    "yev0424/0/kaynak": "P1", "yev0424/0/tur": "pos_valor", "yev0424/0/satirlar/0/h": "102.B1", "yev0424/0/satirlar/0/b": 39000,
    # 03.05 Pazar: P2 bekliyor 30000 − 600; 04.05: bankada
    "mod0503/pos|POS1": 29400, "mod0503/banka|B1": 39000, "mod0504/pos|POS1": 0, "mod0504/banka|B1": 68400,
    "mod1029/pos|POS1": 9800, "mod1029/banka|B1": 68400, "mod1030/pos|POS1": 0, "mod1030/banka|B1": 78200,
    # K (31.12): P3 bekliyor 20000 − 400 = 19600; komisyon toplamı 1000 + 600 + 200 + 400
    "mz/satirlar/102.B1/bakiye": 78200, "mz/satirlar/108.POS1/bakiye": 19600, "mz/satirlar/653/bakiye": 2200,
    "mz/satirlar/120|C1/bakiye": 0, "mz/satirlar/120|C3/bakiye": 0, "mz/satirlar/610/bakiye": 10000, "mz/satirlar/600/bakiye": -110000,
    "devir/yeni_acilis/108.POS1": 19600, "devir/yeni_acilis/102.B1": 78200,
    # yeni yıl: 03.01 Pazar hâlâ bekliyor; 04.01'de bankada
    "mod0103/pos|POS1": 19600, "mod0103/banka|B1": 78200, "mod0104/pos|POS1": 0, "mod0104/banka|B1": 97800,
}}, aciklama="S21: POS valörü resmî tatile düşerse bir sonraki iş gününe kayar (tatil + hafta sonu zinciri, yıl dönümü); iade ve devir etkin valöre göre.")

# ================================================================================================ kâhin bakımı 5 (README Z1–Z12)
# Beklenenler model DEĞİŞTİRİLMEDEN ÖNCE elle yazıldı (kullanıcı kararı 06.11 06:26 UTC S24–S27 = A); hesaplar yorum satırlarında.

# ------------------------------------------------------------------------------------------------ S73
S("s73-s24-devir-k-kilidi", ["S24", "S19", "S11", "S8", "karar (2)", "karar (3)", "G2", "EK-1 M1c", "M2"], [
    o("satis_faturasi", "2026-11-01", id="F1", cari="C1", M=10000, K=0, vade="2027-03-31"),
    o("satis_faturasi", "2026-11-03", id="F2", cari="C2", M=10000, K=0, vade="2026-11-30"),
    o("donem_kilitle", tarih="2026-11-30"),                                                       # L1
    o("satis_faturasi", "2026-12-05", id="F4", cari="C2", M=10000, K=0, vade="2027-03-31"),
    o("satis_faturasi", "2026-12-06", id="F3", cari="C3", M=10000, K=0, vade="2027-03-31"),
    # iş listesi C'deki S24 örneği (C1): 01.11 fatura 10.000 vade 31.03 · kilit 30.11 · 20.12 çek · 15.01 karşılıksız · 20.01 devir
    o("tahsilat", "2026-12-20", id="P1", cari="C1", yol="cek", evrak="CK1", tutar=10000, fatura="F1"),
    o("tahsilat", "2026-12-20", id="P2", cari="C2", yol="nakit", tutar=10000),                   # bağsız: o gün F2'yi kapatır (vade 30.11 önce)
    o("tahsilat", "2026-12-20", id="P3", cari="C3", yol="cek", evrak="CK3", tutar=10000, fatura="F3"),
    o("satis_faturasi", "2027-01-05", id="F5", cari="C2", M=10000, K=0),                         # vadesiz → vade 05.01
    o("tahsilat", "2027-01-10", id="T2", cari="C2", yol="nakit", tutar=10000, fatura="F2"),       # bağ — L1 altında, devirden önce yazıldı
    o("evrak_karsiliksiz", "2027-01-15", id="KS1", evrak="CK1"),                                  # karşılıksız — L1 altında, devirden önce yazıldı
    R("g1a", "gecikmis", cari="C1", tarih="2027-01-16"), R("g1a2", "gecikmis", cari="C1", tarih="2027-03-31"),
    R("g1a3", "gecikmis", cari="C1", tarih="2027-04-01"), R("ak1a", "acik_kalemler", cari="C1", tarih="2027-01-16"),
    R("g2a", "gecikmis", cari="C2", tarih="2027-02-01"), R("ak2a", "acik_kalemler", cari="C2", tarih="2027-02-01"),
    R("not2a", "kilit_bag_notu", cari="C2", tarih="2027-02-01"),
    o("donem_kilitle", tarih="2026-12-31"),                                                       # kilit devirden önce K'ye gelir
    o("evrak_karsiliksiz", "2027-01-15", id="KS3", evrak="CK3"),                                  # K kilidi altında yazıldı (Z1: listede yok)
    R("g1b", "gecikmis", cari="C1", tarih="2027-01-16"), R("g2b", "gecikmis", cari="C2", tarih="2027-02-01"),
    R("g3a", "gecikmis", cari="C3", tarih="2027-01-16"), R("ak3a", "acik_kalemler", cari="C3", tarih="2027-01-16"),
    R("hat_b", "hatirlatma", tarih="2027-01-16"),
    o("devir", K="2026-12-31", bugun="2027-01-20", ad="devir"),
    R("g1d", "gecikmis", cari="C1", tarih="2027-01-16"), R("g1d2", "gecikmis", cari="C1", tarih="2027-03-31"),
    R("g1d3", "gecikmis", cari="C1", tarih="2027-04-01"), R("ak1d", "acik_kalemler", cari="C1", tarih="2027-01-16"),
    R("af1d", "acik_faturalar", cari="C1", tarih="2027-01-16"),
    R("g2d", "gecikmis", cari="C2", tarih="2027-02-01"), R("ak2d", "acik_kalemler", cari="C2", tarih="2027-02-01"),
    R("not2d", "kilit_bag_notu", cari="C2", tarih="2027-02-01"),
    R("g3d", "gecikmis", cari="C3", tarih="2027-01-16"), R("ak3d", "acik_kalemler", cari="C3", tarih="2027-01-16"),
    R("hat_d", "hatirlatma", tarih="2027-01-16"),
    MZ("mzd", "2027-01-01", "2027-02-28"),
], {"A": {
    # DEVİRDEN ÖNCE (canlı; S19 A — yazılış kilidi): KS1 yazılırken kilit 30.11, CK1 20.12'de alındı (> kilit) → S8: P1 geri alınır, F1 kendi vadesiyle (31.03) açık.
    # 16.01 ve 31.03'te gecikmiş 0 (vade bugün gecikmiş değil, M1f), 01.04'te 10000
    "g1a/gecikmis": 0, "g1a2/gecikmis": 0, "g1a3/gecikmis": 10000,
    "ak1a": [{"k": "fatura:F1", "tur": "fatura", "kalan": 10000, "vade": "2027-03-31", "tarih": "2026-11-01"}],
    # C2: T2 yazılırken kilit 30.11; P2'nin F2'yi kapatışı 20.12 (> kilit) → karar (2): T2 F2'yi kapatır, P2 serbest kalır ve kendi gününde (20.12) F4'ü kapatır;
    # F5 (vade 05.01) açık → 01.02'de 10000; kilit notu yok
    "g2a/gecikmis": 10000,
    "ak2a": [{"k": "fatura:F5", "tur": "fatura", "kalan": 10000, "vade": "2027-01-05", "tarih": "2027-01-05"}],
    "not2a": [],
    # kilit 31.12'ye ilerledi: S19 — KS1 ve T2'nin kararı değişmez (yazılış kilidi 30.11)
    "g1b/gecikmis": 0, "g2b/gecikmis": 10000,
    # C3: KS3 K kilidi altında yazıldı, CK3 20.12 ≤ 31.12 → S11: F3 kapalı, KS3 10000 ayrı borç (vade 15.01) → 16.01'de 10000
    "g3a/gecikmis": 10000,
    "ak3a": [{"k": "karsiliksiz:KS3", "tur": "karsiliksiz", "kalan": 10000, "vade": "2027-01-15", "tarih": "2027-01-15"}],
    "hat_b/otomatik": {"C2": 10000, "C3": 10000}, "hat_b/supheli_etiketli": [], "hat_b/elle": {},
    # DEVİR (S24 A, README Z1–Z3): KS1 ve T2 devirden önce, kilit K'den gerideyken yazıldı → Devir Raporu listeler; KS3 K kilidiyle yazıldı → listede yok
    "devir/s19_devir": ["KS1", "T2"],
    # DEVİRDEN SONRA (yeni yıl; S24 A): devir KS1'i K kilidiyle değerlendirir → CK1'in tahsilatı ≤ K → S11: F1 arşivde kapalı, KS1 TAM tutar ayrı borç (vade 15.01).
    # 16.01–31.03 arası gecikmiş 10000 (iş listesi C: "A'da 10.000, B'de 0"); 01.04'te de 10000. (S24 B: F1 açık taşınır, vade 31.03 → 16.01 ve 31.03'te 0.)
    "g1d/gecikmis": 10000, "g1d2/gecikmis": 10000, "g1d3/gecikmis": 10000,
    "ak1d": [{"k": "karsiliksiz:KS1", "tur": "karsiliksiz", "kalan": 10000, "vade": "2027-01-15", "tarih": "2027-01-15"}],
    "af1d": [],
    # C2: devir T2'yi K kilidiyle değerlendirir → P2'nin F2 kapanışı (20.12 ≤ K) geri alınmaz (karar (3); F2 arşivde kapalı, G2) → K'de F4 açık devreder (vade 31.03);
    # T2 bağsız gibi 10.01'de açık borçlara S2 sırasıyla: F5 (vade 05.01) F4'ten (31.03) önce → F5 kapanır; F4 açık → 01.02'de 0 (devirden önce 10000).
    # Hedef (F2) yeni yıl dosyasında yok → kilit notu yazılmaz
    "g2d/gecikmis": 0,
    "ak2d": [{"k": "fatura:F4", "tur": "fatura", "kalan": 10000, "vade": "2027-03-31", "tarih": "2026-12-05"}],
    "not2d": [],
    "g3d/gecikmis": 10000,
    "ak3d": [{"k": "karsiliksiz:KS3", "tur": "karsiliksiz", "kalan": 10000, "vade": "2027-01-15", "tarih": "2027-01-15"}],
    # hatırlatma devirle değişir: C1 girer (10000), C2 çıkar (F4 vadesi gelmedi)
    "hat_d/otomatik": {"C1": 10000, "C3": 10000}, "hat_d/supheli_etiketli": [], "hat_d/elle": {},
    # bakiyeler devirle değişmez: C1 0 + KS1 10000; C2 K'de 10000 (F4) + F5 − T2 = 10000; C3 0 + KS3 10000; evrak portföyü boş; Kasa P2 + T2 = 20000
    "mzd/satirlar/120|C1/bakiye": 10000, "mzd/satirlar/120|C2/bakiye": 10000, "mzd/satirlar/120|C3/bakiye": 10000,
    "mzd/satirlar/101.01/bakiye": 0, "mzd/satirlar/100/bakiye": 20000,
}}, aciklama="S24: Ocak'ta devirden önce, kilit K'den gerideyken yazılmış karşılıksız / bağ devirde K kilidiyle değerlendirilir; fatura kapalı, karşılıksız "
             "ayrı borç; Devir Raporu bu kayıtları listeler (devirden önce canlıda S19 aynen).")

# ------------------------------------------------------------------------------------------------ S74
S("s74-s25-ab-kismi-ve-fazla", ["S25 (a)", "S25 (b)", "S14", "K3", "karar (1)", "karar (2)", "J-01", "J-04", "K6", "M13", "§7.3"], [
    o("satis_faturasi", "2026-03-01", id="F11", cari="C1", M=10000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-01", id="F21", cari="C2", M=8000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-01", id="F31", cari="C3", M=10000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-02", id="F12", cari="C1", M=10000, K=0, vade="2026-04-15"),
    o("satis_faturasi", "2026-03-02", id="F32", cari="C3", M=4000, K=0, vade="2026-04-10"),
    o("satis_faturasi", "2026-03-03", id="F22", cari="C2", M=6000, K=0, vade="2026-04-30"),
    o("satis_faturasi", "2026-03-04", id="F23", cari="C2", M=5000, K=0, vade="2026-05-31"),
    # C1: SA 15000 → F11 10000 + F12'nin 5000'i (F12 kısmen aktarıldı: 5000 128'de, 5000 120'de)
    o("supheliye_al", "2026-05-01", id="SA", cari="C1", tutar=15000),
    # C2: SC 6000 → F21'in 6000'i (F21: 6000 128'de, 2000 120'de); F22, F23 120'de
    o("supheliye_al", "2026-05-01", id="SC", cari="C2", tutar=6000),
    # C3: SB 12000 → F31 10000 + F32'nin 2000'i; karşılık 6000
    o("supheliye_al", "2026-05-01", id="SB", cari="C3", tutar=12000),
    o("karsilik_ayir", "2026-05-02", cari="C3", tutar=6000, kayit="SB"),
    o("tahsilat", "2026-05-10", id="PA1", cari="C1", yol="cek", evrak="CK11", tutar=3000, fatura="F12"),    # (a) küçük: şüpheli kısımdan da küçük
    o("tahsilat", "2026-05-10", id="PC1", cari="C2", yol="cek", evrak="CK21", tutar=10000, fatura="F21"),   # (b) fazla 2000, başka açık fatura var
    o("tahsilat", "2026-05-10", id="PB1", cari="C3", yol="cek", evrak="CK31", tutar=4000, fatura="F32"),    # (a) iki kısmın tam toplamı
    o("tahsilat", "2026-05-15", id="PA2", cari="C1", yol="cek", evrak="CK12", tutar=4000, fatura="F12"),    # (a) ortanca: kalan şüpheli 2000 + 120'den 2000
    o("tahsilat", "2026-05-20", id="PB2", cari="C3", yol="cek", evrak="CK32", tutar=13000, fatura="F31"),   # (b) fazla 3000, açık borç yok → avans
    R("g1", "gecikmis", cari="C1", tarih="2026-06-01"), R("ak1", "acik_kalemler", cari="C1", tarih="2026-06-01"),
    R("g2", "gecikmis", cari="C2", tarih="2026-06-01"), R("ak2", "acik_kalemler", cari="C2", tarih="2026-06-01"),
    R("g3", "gecikmis", cari="C3", tarih="2026-06-01"), R("ak3", "acik_kalemler", cari="C3", tarih="2026-06-01"),
    R("sk1", "supheli_kayitlari", cari="C1"), R("sk2", "supheli_kayitlari", cari="C2"), R("sk3", "supheli_kayitlari", cari="C3"),
    R("hat", "hatirlatma", tarih="2026-06-01"),
    R("yevPB2", "yevmiye", bas="2026-05-20", son="2026-05-20"),
    MZ("mz", "2026-03-01", "2026-06-30"), BIL("bil", "2026-06-01"),
], {"A": {
    # S25 (a) A (README Z5): önce şüpheli kısım (128), kalan 120. Eski kâhin aynı sayıları verip "S14_KISMI" ile susuyordu; S25 (b) fazlası (Z6) avans → red yok.
    "redler": [],
    # C1: PA1 3000 < F12'nin şüpheli kısmı 5000 → A 128 3000 (SA); PA2 4000: kalan şüpheli 2000 → A 128 2000, A 120 2000 (F12'nin 120 kısmı 5000 → 3000).
    # 128 = 15000 − 3000 − 2000 = 10000 (F11); 120 = 20000 − 15000 − 2000 = 3000 (F12, vade 15.04). (S25 (a) B "önce 120": 128 13000, 120 0.)
    "mz/satirlar/128|C1/bakiye": 10000, "mz/satirlar/120|C1/bakiye": 3000,
    "g1/gecikmis": 3000, "g1/supheli": 10000, "g1/kahin_susuyor": 0,
    "ak1": [{"k": "fatura:F12", "tur": "fatura", "kalan": 3000, "vade": "2026-04-15", "tarih": "2026-03-02"}],
    "sk1/0/id": "SA", "sk1/0/kalan": 10000,
    # C2: PC1 10000; F21'in açık kısmı 6000 (128) + 2000 (120) → A 128 6000 (SC kalan 0), A 120 4000: 2000 F21'i kapatır, FAZLA 2000 bağsız alacak → 10.05'te
    # açık borçlara S2 sırasıyla: F22 (vade 30.04) 6000 → 4000; F23 5000. 120 = 19000 − 6000 − 4000 = 9000. 01.06'da F22 4000 + F23 5000 (vade 31.05) gecikmiş
    "mz/satirlar/128|C2/bakiye": 0, "mz/satirlar/120|C2/bakiye": 9000,
    "g2/gecikmis": 9000, "g2/supheli": 0, "g2/kahin_susuyor": 0,
    "ak2": [{"k": "fatura:F22", "tur": "fatura", "kalan": 4000, "vade": "2026-04-30", "tarih": "2026-03-03"},
            {"k": "fatura:F23", "tur": "fatura", "kalan": 5000, "vade": "2026-05-31", "tarih": "2026-03-04"}],
    "sk2/0/id": "SC", "sk2/0/kalan": 0,
    # C3: PB1 4000 = F32'nin iki kısmının toplamı (2000 + 2000) → A 128 2000 (SB 12000 → 10000), A 120 2000. PB2 13000: F31'in açık kısmı yalnız 128'de 10000
    # → A 128 10000 (SB kalan 0; karşılık 6000 > 0 → K6: B 129 / A 644 6000); FAZLA 3000 A 120 bağsız alacak, açık borç yok → AVANS (120 alacaklı −3000 → Bilanço 340).
    # Eski kâhin: normal kısım 3000 > 120 bakiyesi 0 → SUPHELI_NORMAL_ASIM (S25 (b) B "reddedilir" ile aynı sonuç).
    "mz/satirlar/128|C3/bakiye": 0, "mz/satirlar/129|C3/bakiye": 0, "mz/satirlar/120|C3/bakiye": -3000,
    "mz/satirlar/644/bakiye": -6000, "mz/satirlar/654/bakiye": 6000,
    "g3/gecikmis": 0, "g3/supheli": 0, "g3/kahin_susuyor": 0,
    "ak3": [{"k": "tahsilat:PB2", "tur": "tahsilat", "kalan": -3000, "vade": "2026-05-20", "tarih": "2026-05-20"}],
    "sk3/0/id": "SB", "sk3/0/kalan": 0, "sk3/0/karsilik": 0,
    "yevPB2/0/kaynak": "PB2", "yevPB2/0/satirlar/0/h": "101.01", "yevPB2/0/satirlar/0/b": 13000,
    "yevPB2/0/satirlar/1/h": "128", "yevPB2/0/satirlar/1/c": "C3", "yevPB2/0/satirlar/1/a": 10000,
    "yevPB2/0/satirlar/2/h": "120", "yevPB2/0/satirlar/2/c": "C3", "yevPB2/0/satirlar/2/a": 3000,
    "yevPB2/1/tur": "karsilik_cozulme", "yevPB2/1/satirlar/1/h": "644", "yevPB2/1/satirlar/1/a": 6000,
    # hatırlatma (S7 A): C1'in açık kaydı var → etiketli, elle şüphesiz gecikmiş 3000; C2 kaydı kapandı → otomatik 9000; C3 gecikmiş yok
    "hat/otomatik": {"C2": 9000}, "hat/supheli_etiketli": ["C1"], "hat/elle": {"C1": 3000},
    # evrak portföyü 3000 + 10000 + 4000 + 4000 + 13000; gelir 53000
    "mz/satirlar/101.01/bakiye": 34000, "mz/satirlar/600/bakiye": -53000,
    # Bilanço: alacaklı müşteri (C3 −3000) III.D Alınan Avanslar; I.C = 120 C1 3000 + 120 C2 9000 + 128 C1 10000
    "bil/pasif/III.D": 3000, "bil/aktif/I.C": 22000, "bil/aktif/I.A": 34000,
}}, aciklama="S25 (a) kısmen şüpheliye aktarılmış faturaya küçük / ortanca / tam toplam çek: önce şüpheli kısım (128), kalan 120; (b) çekin faturanın açık "
             "kısmını aşan fazlası carinin bağsız alacağı (avans, 120): başka açık faturaya ya da avansa; sınır fazlaya uygulanmaz.")

# ------------------------------------------------------------------------------------------------ S75
S("s75-s25-c-nakit-havale-pos", ["S25 (c)", "S14", "K3", "T-01", "T-02", "T-03", "KG-6", "D-01", "J-01", "J-04", "K6", "M13"], [
    o("satis_faturasi", "2026-03-01", id="F41", cari="C1", M=10000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-01", id="F51", cari="C2", M=8000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-01", id="F61", cari="C3", M=20000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-02", id="F52", cari="C2", M=8000, K=0, vade="2026-04-15"),
    o("satis_faturasi", "2026-03-05", id="F42", cari="C1", M=6000, K=0, vade="2026-04-30"),
    o("supheliye_al", "2026-05-01", id="SA", cari="C1", tutar=10000),             # F41 tamamı
    o("supheliye_al", "2026-05-01", id="SC", cari="C2", tutar=12000),             # F51 8000 + F52'nin 4000'i
    o("supheliye_al", "2026-05-01", id="SB", cari="C3", tutar=20000),             # F61 tamamı
    o("karsilik_ayir", "2026-05-02", cari="C1", tutar=4000, kayit="SA"),
    o("tahsilat", "2026-05-10", id="PH", cari="C1", yol="havale", banka="B1", tutar=10000, fatura="F41"),
    o("tahsilat", "2026-05-10", id="PN1", cari="C2", yol="nakit", tutar=3000, fatura="F52"),             # şüpheli kısımdan (4000) küçük
    o("tahsilat", "2026-05-11", id="PP", cari="C3", yol="pos", pos="POS1", tutar=12000, komisyon=240, valor="2026-05-12", fatura="F61"),
    o("tahsilat", "2026-05-12", id="PN2", cari="C2", yol="nakit", tutar=3000, fatura="F52"),             # kalan şüpheli 1000 + 120'den 2000
    R("g1", "gecikmis", cari="C1", tarih="2026-06-01"), R("g2", "gecikmis", cari="C2", tarih="2026-06-01"),
    R("g3", "gecikmis", cari="C3", tarih="2026-06-01"), R("ak2", "acik_kalemler", cari="C2", tarih="2026-06-01"),
    R("sk1", "supheli_kayitlari", cari="C1"), R("sk2", "supheli_kayitlari", cari="C2"), R("sk3", "supheli_kayitlari", cari="C3"),
    R("hat", "hatirlatma", tarih="2026-06-01"),
    R("mod0511", "moduller", tarih="2026-05-11"), R("mod0512", "moduller", tarih="2026-05-12"),
    R("yevPP", "yevmiye", bas="2026-05-11", son="2026-05-11"),
    MZ("mz", "2026-03-01", "2026-05-31"),
], {"A": {
    # S25 (c) A (README Z7): nakit / havale / POS ile şüpheliye aktarılmış faturaya bağlı tahsilat S14 ile aynı. Eski kâhin (bağlı tahsilat 120, sınırıyla)
    # PH (10000 > 120 bakiyesi 6000), PP (12000 > 0) ve PN2 (3000 > 1000) için SUPHELI_NORMAL_ASIM verirdi.
    "redler": [],
    # C1: PH F41'in tamamı 128'de → A 128 10000 (SA kalan 0) → karşılık 4000 644'e (K6). 120 = 16000 − 10000 = 6000 (F42, vade 30.04) → gecikmiş 6000
    "mz/satirlar/128|C1/bakiye": 0, "mz/satirlar/129|C1/bakiye": 0, "mz/satirlar/120|C1/bakiye": 6000,
    "mz/satirlar/644/bakiye": -4000, "mz/satirlar/654/bakiye": 4000,
    "g1/gecikmis": 6000, "g1/supheli": 0, "sk1/0/kalan": 0, "sk1/0/karsilik": 0,
    # C2: PN1 3000 < F52'nin şüpheli kısmı 4000 → A 128 3000 (SC 12000 → 9000); PN2 3000: kalan şüpheli 1000 → A 128 1000, A 120 2000 (F52'nin 120 kısmı 4000 → 2000).
    # 128 = 12000 − 4000 = 8000 (F51); 120 = 16000 − 12000 − 2000 = 2000 → gecikmiş 01.06: F52 2000 (vade 15.04)
    "mz/satirlar/128|C2/bakiye": 8000, "mz/satirlar/120|C2/bakiye": 2000,
    "g2/gecikmis": 2000, "g2/supheli": 8000, "sk2/0/kalan": 8000,
    "ak2": [{"k": "fatura:F52", "tur": "fatura", "kalan": 2000, "vade": "2026-04-15", "tarih": "2026-03-02"}],
    # C3: PP (POS, brüt 12000) F61'in şüpheli kısmından → A 128 12000 (SB 20000 → 8000); komisyon çekim günü (KG-6), valör 12.05 net 11760 bankada
    "mz/satirlar/128|C3/bakiye": 8000, "mz/satirlar/120|C3/bakiye": 0,
    "g3/gecikmis": 0, "g3/supheli": 8000, "sk3/0/kalan": 8000,
    "yevPP/0/kaynak": "PP", "yevPP/0/satirlar/0/h": "108.POS1", "yevPP/0/satirlar/0/b": 12000,
    "yevPP/0/satirlar/1/h": "128", "yevPP/0/satirlar/1/c": "C3", "yevPP/0/satirlar/1/a": 12000,
    "yevPP/1/tur": "pos_komisyon", "yevPP/1/satirlar/0/h": "653", "yevPP/1/satirlar/0/b": 240,
    "mod0511/pos|POS1": 11760, "mod0511/banka|B1": 10000, "mod0512/pos|POS1": 0, "mod0512/banka|B1": 21760,
    # hatırlatma: C1 kaydı kapandı → otomatik 6000; C2, C3 açık kayıt → etiketli; C2 elle şüphesiz gecikmiş 2000
    "hat/otomatik": {"C1": 6000}, "hat/supheli_etiketli": ["C2", "C3"], "hat/elle": {"C2": 2000},
    "mz/satirlar/100/bakiye": 6000, "mz/satirlar/102.B1/bakiye": 21760, "mz/satirlar/653/bakiye": 240, "mz/satirlar/600/bakiye": -52000,
}}, aciklama="S25 (c): nakit / havale / POS ile şüpheliye aktarılmış faturaya bağlı tahsilat S14 ile aynı — şüpheli kısım 128'den (o kalemin kaydından), kalan 120.")

# ------------------------------------------------------------------------------------------------ S76
S("s76-s26-geri-yuklenen-kasa-tutar-duzelt", ["S26", "S20", "S12", "T12", "G-7", "R-04", "M-01", "EK-2 §4 (8)"], [
    o("kasa_giris", "2026-01-10", id="KG1", tutar=1000),                  # açılış yokken: kabul
    o("sil", kaynak="KG1"),
    o("kasa_acilis", "2026-01-15", id="KA", tutar=10000),                 # Kasa'da etkin hareket yok → kabul
    o("geri_yukle", kaynak="KG1"),                                        # S20: Silinenler'den aynen (10.01 < 15.01)
    o("kasa_giris", "2026-01-12", id="KY", tutar=300, yedekten=True),     # S20: yedekten gelen eski veri
    o("tahsilat", "2026-01-13", id="PY", cari="C1", yol="nakit", tutar=500, yedekten=True),
    o("tahsilat", "2026-01-11", id="HY", cari="C1", yol="havale", banka="B1", tutar=400, yedekten=True),   # Kasa'ya yazmıyor
    R("mu0", "mutabakat_uyarilari", tarih="2026-01-31"),
    o("duzenle", kaynak="KG1", degisiklik={"tutar": 1200}),               # S26 A: yalnız tutar → kabul (Silinenler'den geri yüklenmiş; Z9)
    o("duzenle", kaynak="KY", degisiklik={"tutar": 350}),                 # S26 A: kabul (yedekten)
    o("duzenle", kaynak="PY", degisiklik={"tutar": 600, "tarih": "2026-01-13"}),   # tarih aynı (açıkça verildi) → kabul
    o("duzenle", kaynak="KY", degisiklik={"tarih": "2026-01-14"}),        # tarih açılıştan önceki başka güne → T12 red
    o("duzenle", kaynak="PY", degisiklik={"tutar": 700, "tarih": "2026-01-11"}),   # tarih değişiyor → T12 red (tutar da değişmez)
    o("duzenle", kaynak="HY", degisiklik={"yol": "nakit"}),               # açılıştan önce Kasa'ya çevirme → T12 red
    R("mu1", "mutabakat_uyarilari", tarih="2026-01-31"), R("mod14", "moduller", tarih="2026-01-14"),
    o("duzenle", kaynak="KY", degisiklik={"tutar": 360, "tarih": "2026-01-20"}),   # açılıştan sonraya → genel kural, kabul; uyarı kalkar
    R("mu2", "mutabakat_uyarilari", tarih="2026-01-31"), R("mod14b", "moduller", tarih="2026-01-14"), R("mod31", "moduller", tarih="2026-01-31"),
    MZ("mz", "2026-01-01", "2026-01-31"),
], {"A": {
    # S26 A (README Z9): geri yüklenmiş, açılıştan önce tarihli Kasa kaydının yalnız tutarı düzeltilirse kabul; tarihi değiştiren düzeltme T12 ile red.
    # Eski kâhin (T12 her düzeltmede) KG1, KY ve PY'nin tutar düzeltmelerini de reddederdi (5 red, tutarlar eski).
    "redler": ["KASA_ACILIS_ONCE", "KASA_ACILIS_ONCE", "KASA_ACILIS_ONCE"],
    "mu0": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KG1", "tarih": "2026-01-10", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KY", "tarih": "2026-01-12", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PY", "tarih": "2026-01-13", "acilis": "2026-01-15"}],
    # Mutabakat Testi uyarısı SÜRER (aynı kaynak ve tarih); 14.01'de Kasa = 1200 + 350 + 600 (HY havalede kaldı); cari C1 −600 − 400
    "mu1": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KG1", "tarih": "2026-01-10", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KY", "tarih": "2026-01-12", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PY", "tarih": "2026-01-13", "acilis": "2026-01-15"}],
    "mod14/kasa": 2150, "mod14/cari|C1": -1000, "mod14/banka|B1": 400,
    # KY açılıştan sonraya alındı → uyarıdan çıkar
    "mu2": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KG1", "tarih": "2026-01-10", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PY", "tarih": "2026-01-13", "acilis": "2026-01-15"}],
    "mod14b/kasa": 1800, "mod31/kasa": 12160, "mod31/banka|B1": 400,
    # Kasa = 10000 + 1200 + 360 + 600; 649.90 = 1200 + 360; 120|C1 = −600 − 400; 519 = −10000
    "mz/satirlar/100/bakiye": 12160, "mz/satirlar/649.90/bakiye": -1560, "mz/satirlar/120|C1/bakiye": -1000,
    "mz/satirlar/102.B1/bakiye": 400, "mz/satirlar/519/bakiye": -10000,
    # değişmez kasa_acilis_ilk: geri yüklenen kayıt düzeltildikten sonra da hata DEĞİL (uyarı; her senaryoda koşan değişmez denetimi temiz olmalı)
}}, aciklama="S26: geri yüklenmiş, Kasa açılışından önce tarihli Kasa kaydının yalnız tutarı düzeltilirse kabul (Mutabakat uyarısı sürer); tarihi değiştiren düzeltme T12 ile red.")

# ------------------------------------------------------------------------------------------------ S77
S("s77-s27-pos-valor-yarim-gun", ["S27", "S21", "2429", "D-01", "T-03", "KG-6"], [
    # 28 Ekim 2026 Çarşamba (yarım gün, 13:00'ten tatil) → İŞ GÜNÜ: valör kaymaz
    o("satis_faturasi", "2026-10-27", id="F1", cari="C1", M=10000, K=0),
    o("tahsilat", "2026-10-27", id="P1", cari="C1", yol="pos", pos="POS1", tutar=10000, komisyon=200, valor="2026-10-28"),
    R("mod1027", "moduller", tarih="2026-10-27"), R("mod1028", "moduller", tarih="2026-10-28"),
    R("yev1028", "yevmiye", bas="2026-10-28", son="2026-10-28"),
    # 28 Ekim 2027 Perşembe (yarım gün) → kaymaz; 29 Ekim 2027 Cuma (tam gün) + hafta sonu → 1 Kasım Pazartesi
    o("satis_faturasi", "2027-10-27", id="F2", cari="C3", M=20000, K=0),
    o("tahsilat", "2027-10-27", id="P2", cari="C3", yol="pos", pos="POS1", tutar=20000, komisyon=400, valor="2027-10-28"),
    o("satis_faturasi", "2027-10-28", id="F3", cari="C3", M=30000, K=0),
    o("tahsilat", "2027-10-28", id="P3", cari="C3", yol="pos", pos="POS1", tutar=30000, komisyon=600, valor="2027-10-29"),
    R("m271027", "moduller", tarih="2027-10-27"), R("m271028", "moduller", tarih="2027-10-28"),
    R("m271029", "moduller", tarih="2027-10-29"), R("m271031", "moduller", tarih="2027-10-31"), R("m271101", "moduller", tarih="2027-11-01"),
], {"A": {
    # S27 A (README Z11): yarım gün iş günüdür. 27.10.2026: P1 bekliyor 10000 − 200 (KG-6) = 9800; 28.10: bankada (S27 B olsaydı 29 tam gün → 30.10)
    "mod1027/pos|POS1": 9800, "mod1027/banka|B1": 0, "mod1028/pos|POS1": 0, "mod1028/banka|B1": 9800,
    "yev1028/0/kaynak": "P1", "yev1028/0/tur": "pos_valor", "yev1028/0/satirlar/0/h": "102.B1", "yev1028/0/satirlar/0/b": 9800,
    # 2027: P2 27.10'da bekliyor 19600; 28.10'da bankada (9800 + 19600); P3 28.10'da çekildi, bekliyor 29400 — valörü 29.10 tam gün → 30–31 hafta sonu → 01.11
    "m271027/pos|POS1": 19600, "m271027/banka|B1": 9800,
    "m271028/pos|POS1": 29400, "m271028/banka|B1": 29400,
    "m271029/pos|POS1": 29400, "m271029/banka|B1": 29400, "m271031/pos|POS1": 29400,
    "m271101/pos|POS1": 0, "m271101/banka|B1": 58800,
}}, aciklama="S27: POS valörü yarım güne (28 Ekim) düşerse yarım gün iş günüdür, valör kaymaz; tam gün tatil (29 Ekim) + hafta sonu atlanır.")

# ------------------------------------------------------------------------------------------------ S78 (kâhin bakımı 6; elle değerler model değiştirilmeden ÖNCE yazıldı)
S("s78-s39-kart-iade-supheli", ["S39", "S25 (a)", "S25 (b)", "S14", "T-11", "K3", "karar (1)", "J-01", "J-04", "K6", "M13"], [
    o("kart_acilis", "2026-01-02", tutar=50000, kart="KK1"),
    o("satis_faturasi", "2026-03-01", id="F11", cari="C1", M=10000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-02", id="F12", cari="C1", M=10000, K=0, vade="2026-04-15"),
    o("satis_faturasi", "2026-03-03", id="F21", cari="C2", M=8000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-03-04", id="F22", cari="C2", M=6000, K=0, vade="2026-04-30"),
    o("satis_faturasi", "2026-03-05", id="F31", cari="C3", M=5000, K=0, vade="2026-03-31"),
    # C1: SA 15000 → F11 10000 + F12'nin 5000'i (J-01 vade sırasıyla; F12: 5000 128'de, 5000 120'de)
    o("supheliye_al", "2026-05-01", id="SA", cari="C1", tutar=15000),
    # C2: SC 8000 → F21'in tamamı (F21'in 120'de kısmı yok); F22 120'de; karşılık 3000
    o("supheliye_al", "2026-05-01", id="SC", cari="C2", tutar=8000),
    o("karsilik_ayir", "2026-05-02", cari="C2", tutar=3000, kayit="SC"),
    o("tahsilat", "2026-05-10", id="KI1", cari="C1", yol="kart", kart="KK1", tutar=3000, fatura="F12"),   # küçük: F12'nin şüpheli kısmından (5000) küçük
    R("sk1a", "supheli_kayitlari", cari="C1"), MZ("mz0511", "2026-01-01", "2026-05-11"),
    R("yev0510", "yevmiye", bas="2026-05-10", son="2026-05-10"),
    o("tahsilat", "2026-05-12", id="KI2", cari="C1", yol="kart", kart="KK1", tutar=7000, fatura="F12"),   # tam: kalan şüpheli 2000 + 120 kısmı 5000
    o("tahsilat", "2026-05-13", id="KI3", cari="C2", yol="kart", kart="KK1", tutar=10000, fatura="F21"),  # fazla: açık kısım 8000 (hepsi 128) → fazla 2000
    R("yev0513", "yevmiye", bas="2026-05-13", son="2026-05-13"),
    # C3: KI0 şüpheli kaydından ÖNCE → 120 (bağ); SB aynı gün KI4'ten önce (K3 gün sırası) → KI4 S39 ile 128'den
    o("tahsilat", "2026-05-15", id="KI0", cari="C3", yol="kart", kart="KK1", tutar=1000, fatura="F31"),
    o("supheliye_al", "2026-05-20", id="SB", cari="C3", tutar=4000),
    o("tahsilat", "2026-05-20", id="KI4", cari="C3", yol="kart", kart="KK1", tutar=2000, fatura="F31"),
    R("g1", "gecikmis", cari="C1", tarih="2026-06-01"), R("ak1", "acik_kalemler", cari="C1", tarih="2026-06-01"),
    R("g2", "gecikmis", cari="C2", tarih="2026-06-01"), R("ak2", "acik_kalemler", cari="C2", tarih="2026-06-01"),
    R("g3", "gecikmis", cari="C3", tarih="2026-06-01"), R("ak3", "acik_kalemler", cari="C3", tarih="2026-06-01"),
    R("sk1", "supheli_kayitlari", cari="C1"), R("sk2", "supheli_kayitlari", cari="C2"), R("sk3", "supheli_kayitlari", cari="C3"),
    R("hat", "hatirlatma", tarih="2026-06-01"), R("mod0531", "moduller", tarih="2026-05-31"),
    MZ("mz", "2026-01-01", "2026-06-30"),
], {"A": {
    # S39 A (README X1–X5): faturaya bağlı Kredi Kartına İade S25 / S14 ile aynı — önce şüpheli kısım (128, kalemi taşıyan kayıttan), kalanı 120; fazla bağsız alacak.
    # Eski kâhin (bakım 5 Z8): KI1'de senaryo hatası (susar). S39 B (120 + SUPHELI_NORMAL_ASIM): KI1 120'ye (normal 3000 ≤ 120 bakiyesi 5000), KI2 (7000 > 2000),
    # KI3 (10000 > 6000) ve KI4 (2000 > 0) reddedilirdi.
    "redler": [],
    # C1: KI1 3000 < F12'nin şüpheli kısmı 5000 → A 128 3000 (SA 15000 → 12000); 11.05'te 128 12000, 120 5000 (F12'nin 120 kısmı açık)
    "sk1a/0/id": "SA", "sk1a/0/kalan": 12000,
    "mz0511/satirlar/128|C1/bakiye": 12000, "mz0511/satirlar/120|C1/bakiye": 5000,
    # madde (X5): B 309.KK1 3000 / A 128 3000
    "yev0510/0/kaynak": "KI1", "yev0510/0/satirlar/0/h": "309.KK1", "yev0510/0/satirlar/0/b": 3000,
    "yev0510/0/satirlar/1/h": "128", "yev0510/0/satirlar/1/c": "C1", "yev0510/0/satirlar/1/a": 3000,
    # KI2 7000 = kalan şüpheli 2000 + 120 kısmı 5000 → A 128 2000 (SA → 10000), A 120 5000 (F12 kapanır). 128 = 15000 − 5000 = 10000 (F11), 120 = 20000 − 15000 − 5000 = 0
    "mz/satirlar/128|C1/bakiye": 10000, "mz/satirlar/120|C1/bakiye": 0,
    "g1/gecikmis": 0, "g1/supheli": 10000, "g1/kahin_susuyor": 0, "ak1": [],
    "sk1/0/id": "SA", "sk1/0/kalan": 10000,
    # C2: KI3 10000; F21'in açık kısmı yalnız 128'de 8000 → A 128 8000 (SC kalan 0; karşılık 3000 > 0 → K6: B 129 / A 644 3000); FAZLA 2000 A 120 bağsız alacak
    # → 13.05'te açık borç F22 (vade 30.04) 6000 → 4000. 120 = 14000 − 8000 − 2000 = 4000 → 01.06'da gecikmiş 4000
    "mz/satirlar/128|C2/bakiye": 0, "mz/satirlar/129|C2/bakiye": 0, "mz/satirlar/120|C2/bakiye": 4000,
    "mz/satirlar/644/bakiye": -3000, "mz/satirlar/654/bakiye": 3000,
    "g2/gecikmis": 4000, "g2/supheli": 0, "g2/kahin_susuyor": 0,
    "ak2": [{"k": "fatura:F22", "tur": "fatura", "kalan": 4000, "vade": "2026-04-30", "tarih": "2026-03-04"}],
    "sk2/0/id": "SC", "sk2/0/kalan": 0, "sk2/0/karsilik": 0,
    "yev0513/0/kaynak": "KI3", "yev0513/0/satirlar/0/h": "309.KK1", "yev0513/0/satirlar/0/b": 10000,
    "yev0513/0/satirlar/1/h": "128", "yev0513/0/satirlar/1/c": "C2", "yev0513/0/satirlar/1/a": 8000,
    "yev0513/0/satirlar/2/h": "120", "yev0513/0/satirlar/2/c": "C2", "yev0513/0/satirlar/2/a": 2000,
    "yev0513/1/tur": "karsilik_cozulme", "yev0513/1/satirlar/1/h": "644", "yev0513/1/satirlar/1/a": 3000,
    # C3: KI0 (15.05) açık kayıt yok → A 120 1000 bağla F31'i 4000'e indirir; SB 4000 (≤ borç bakiyesi 4000) F31'in kalanını 128'e taşır; KI4 aynı gün, kayıt önce →
    # A 128 2000 (SB → 2000). 128 = 2000, 120 = 5000 − 1000 − 4000 = 0
    "mz/satirlar/128|C3/bakiye": 2000, "mz/satirlar/120|C3/bakiye": 0,
    "g3/gecikmis": 0, "g3/supheli": 2000, "ak3": [],
    "sk3/0/id": "SB", "sk3/0/kalan": 2000,
    # hatırlatma (S7 A): C1, C3 açık kayıt → etiketli (şüphesiz gecikmiş yok); C2 kaydı kapandı → otomatik 4000
    "hat/otomatik": {"C2": 4000}, "hat/supheli_etiketli": ["C1", "C3"], "hat/elle": {},
    # şirket kartı (309.KK1): açılış 50000 − iadeler (1000 + 3000 + 7000 + 10000 + 2000 = 23000) = 27000 borç; kart modülü aynı
    "mz/satirlar/309.KK1/bakiye": -27000, "mod0531/kart|KK1": 27000,
    "mz/satirlar/519/bakiye": 50000, "mz/satirlar/600/bakiye": -39000,
}}, aciklama="S39: şüpheli caride faturaya bağlı Kredi Kartına İade S25 / S14 ile aynı — küçük iade tamamı 128, tam toplam iki kısmı kapatır, fazla bağsız "
             "alacak (başka açık faturaya); kayıttan önceki iade 120, aynı gün açılan kayıtta 128.")

# ------------------------------------------------------------------------------------------------ S79 (kâhin bakımı 6; elle değerler model değiştirilmeden ÖNCE yazıldı)
S("s79-s40-geri-yuklenen-kasa-tutar-disi-alan", ["S40", "S26", "Z9", "S20", "S12", "T12", "G-7", "R-04", "karar (1)", "M-01", "EK-2 §4 (8)"], [
    o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-31"),
    o("satis_faturasi", "2026-01-06", id="F3", cari="C3", M=2000, K=0, vade="2026-01-20"),
    o("tahsilat", "2026-01-11", id="PS", cari="C1", yol="nakit", tutar=200),         # açılış yokken: kabul
    o("sil", kaynak="PS"),
    o("kasa_acilis", "2026-01-15", id="KA", tutar=10000),                             # Kasa'da etkin hareket yok → kabul
    o("geri_yukle", kaynak="PS"),                                                     # S20: Silinenler'den aynen (11.01 < 15.01)
    o("kasa_giris", "2026-01-10", id="KY", tutar=400, yedekten=True),                 # S20: yedekten gelen eski veri (carisiz → 649.90)
    o("tahsilat", "2026-01-12", id="PY", cari="C1", yol="nakit", tutar=500, yedekten=True),
    o("tahsilat", "2026-01-13", id="PZ", cari="C1", yol="nakit", tutar=300, yedekten=True),
    R("mu0", "mutabakat_uyarilari", tarih="2026-01-31"),
    R("g1a", "gecikmis", cari="C1", tarih="2026-02-01"), R("g3a", "gecikmis", cari="C3", tarih="2026-02-01"),
    o("duzenle", kaynak="KY", degisiklik={"aciklama": "Kasa sayım farkı"}),          # S40 A: yalnız açıklama → kabul (yedekten)
    o("duzenle", kaynak="PY", degisiklik={"aciklama": "Elden tahsilat"}),            # S40 A: kabul
    o("duzenle", kaynak="PS", degisiklik={"cari": "C3"}),                             # S40 A: cari → kabul (Silinenler'den geri yüklenmiş; Z9 BAŞ MİMAR KARARI)
    o("duzenle", kaynak="PZ", degisiklik={"tutar": 350, "aciklama": "Tutar düzeltmesi"}),   # S26 + S40: tutar ve açıklama birlikte → kabul
    o("duzenle", kaynak="PY", degisiklik={"aciklama": "Yanlış gün", "tarih": "2026-01-14"}),   # tarih açılıştan önceki başka güne → T12 red (açıklama da yazılmaz)
    o("duzenle", kaynak="PY", degisiklik={"cari": "C3", "tarih": "2026-01-09"}),     # tarih değişiyor → T12 red (cari de değişmez)
    R("mu1", "mutabakat_uyarilari", tarih="2026-01-31"), R("mod14", "moduller", tarih="2026-01-14"),
    R("g1", "gecikmis", cari="C1", tarih="2026-02-01"), R("ak1", "acik_kalemler", cari="C1", tarih="2026-02-01"),
    R("g3", "gecikmis", cari="C3", tarih="2026-02-01"), R("ak3", "acik_kalemler", cari="C3", tarih="2026-02-01"),
    R("hat", "hatirlatma", tarih="2026-02-01"),
    MZ("mz", "2026-01-01", "2026-01-31"),
], {"A": {
    # S40 A (README X7–X10): geri yüklenmiş, açılıştan önce tarihli Kasa kaydının açıklaması / carisi tarih değişmeden düzeltilirse kabul; Mutabakat uyarısı sürer.
    # Eski kâhin (bakım 5 Z10): ilk açıklama düzeltmesinde senaryo hatası (susar). S40 B (T12 ile red): KY, PY, PS ve PZ düzeltmeleri de reddedilir (6 red; Kasa 14.01'de
    # 1400, C1 gecikmiş 0, C3 2000).
    "redler": ["KASA_ACILIS_ONCE", "KASA_ACILIS_ONCE"],
    "mu0": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KY", "tarih": "2026-01-10", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PS", "tarih": "2026-01-11", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PY", "tarih": "2026-01-12", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PZ", "tarih": "2026-01-13", "acilis": "2026-01-15"}],
    # düzeltmeden önce: C1 F1 1000 = PS 200 + PY 500 + PZ 300 (kendi günlerinde) → kapalı; C3 F3 2000 (vade 20.01) gecikmiş
    "g1a/gecikmis": 0, "g3a/gecikmis": 2000,
    # Mutabakat Testi uyarısı SÜRER: aynı dört kaynak, aynı tarih (PS carisi değişti, geri yüklenmiş kalır)
    "mu1": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KY", "tarih": "2026-01-10", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PS", "tarih": "2026-01-11", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PY", "tarih": "2026-01-12", "acilis": "2026-01-15"},
            {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PZ", "tarih": "2026-01-13", "acilis": "2026-01-15"}],
    # X9: PS C1 → C3; Kasa değişmez (200). 14.01'de Kasa = 400 + 200 + 500 + 350; cari C1 = 1000 − 500 − 350 = 150; C3 = 2000 − 200 = 1800
    "mod14/kasa": 1450, "mod14/cari|C1": 150, "mod14/cari|C3": 1800,
    # TYK (karar (1)): C1 F1 = 1000 − PY 500 (12.01) − PZ 350 (13.01) = 150 açık (vade 31.01) → 01.02'de gecikmiş 150; C3 F3 = 2000 − PS 200 (11.01) = 1800
    "g1/gecikmis": 150, "g3/gecikmis": 1800,
    "ak1": [{"k": "fatura:F1", "tur": "fatura", "kalan": 150, "vade": "2026-01-31", "tarih": "2026-01-05"}],
    "ak3": [{"k": "fatura:F3", "tur": "fatura", "kalan": 1800, "vade": "2026-01-20", "tarih": "2026-01-06"}],
    "hat/otomatik": {"C1": 150, "C3": 1800}, "hat/supheli_etiketli": [], "hat/elle": {},
    # Kasa = 10000 + 400 + 200 + 500 + 350; 649.90 = 400 (carisiz Kasa girişi); 120|C1 = 150; 120|C3 = 1800; 519 = −10000; 600 = −3000
    "mz/satirlar/100/bakiye": 11450, "mz/satirlar/649.90/bakiye": -400, "mz/satirlar/120|C1/bakiye": 150, "mz/satirlar/120|C3/bakiye": 1800,
    "mz/satirlar/519/bakiye": -10000, "mz/satirlar/600/bakiye": -3000,
    # değişmez kasa_acilis_ilk: geri yüklenmiş kayıtların düzeltmesinden sonra da hata DEĞİL (her senaryoda koşan değişmez denetimi temiz olmalı)
}}, aciklama="S40: geri yüklenmiş (yedekten / Silinenler'den), Kasa açılışından önce tarihli Kasa kaydının açıklaması ve carisi tarih değişmeden düzeltilirse kabul "
             "(cari değişince eski ve yeni carinin kalemleri yeniden dağılır); tutar + açıklama birlikte kabul; tarihi değiştiren düzeltme T12 ile red; uyarı sürer.")

# ------------------------------------------------------------------------------------------------ S80 (kâhin bakımı 7; elle değerler model değiştirilmeden ÖNCE yazıldı)
_MU80 = [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PA", "tarih": "2026-01-10", "acilis": "2026-01-15"},
         {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PC", "tarih": "2026-01-10", "acilis": "2026-01-15"},
         {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PB", "tarih": "2026-01-11", "acilis": "2026-01-15"},
         {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "OD", "tarih": "2026-01-12", "acilis": "2026-01-15"}]
_MZ80 = {  # bağ düzeltmesi defteri DEĞİŞTİRMEZ (T-01; README V2): Kasa = 10000 + PA 1000 + PC 1000 + PB 1000 − OD 1000; 120|C1 = 2000 − 1000; 120|C2 = 3000 − AY 600 − PC 1000;
    # 120|C3 = 2000 − 1000; 320|T1 = −2000 + 1000; 600 = −7 × 1000; 770 = A1 + A2 (genel gider); 770.90 = Alacak Yaz 600; 519 = −10000
    "satirlar/100/bakiye": 12000, "satirlar/120|C1/bakiye": 1000, "satirlar/120|C2/bakiye": 1400, "satirlar/120|C3/bakiye": 1000,
    "satirlar/320|T1/bakiye": -1000, "satirlar/600/bakiye": -7000, "satirlar/770/bakiye": 2000, "satirlar/770.90/bakiye": 600,
    "satirlar/519/bakiye": -10000,
    # toplam = HAREKET toplamı (bakiye değil; s01 gibi): borç KA 10000 + 7 satış 7000 + A1 / A2 2000 + AY 600 + PA / PC / PB 3000 + OD 1000 = 23600; alacak aynı
    # (bakım 7'de ilk yazılan 18000 bakiye toplamıydı — elle hesap hatası, model koşusunda görüldü, elle yeniden hesaplandı; README bakım 7)
    "toplam/borc": 23600, "toplam/alacak": 23600}
S("s80-s44-geri-yuklenen-kasa-fatura-bagi", ["S44", "S40", "S26", "Z9", "S20", "S12", "T12", "G-7", "R-04", "T-01", "T-05", "karar (1)", "karar (2)", "S2",
                                             "EK-2 Soru 23", "EK-2 Soru 24"], [
    o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-20"),
    o("satis_faturasi", "2026-01-05", id="F3", cari="C3", M=1000, K=0, vade="2026-01-20"),
    o("satis_faturasi", "2026-01-05", id="F5", cari="C2", M=1000, K=0, vade="2026-01-25"),
    o("alis_faturasi", "2026-01-05", id="A1", cari="T1", fatura_turu="gider", gider_turu="genel", M=1000, K=0, vade="2026-01-20"),
    o("satis_faturasi", "2026-01-06", id="F2", cari="C1", M=1000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-01-06", id="F4", cari="C3", M=1000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-01-06", id="F6", cari="C2", M=1000, K=0, vade="2026-01-15"),
    o("alis_faturasi", "2026-01-06", id="A2", cari="T1", fatura_turu="gider", gider_turu="genel", M=1000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-01-07", id="F7", cari="C2", M=1000, K=0, vade="2026-03-31"),
    o("alacak_yaz", "2026-01-08", id="AY", cari="C2", tutar=600, aciklama="Fiyat farkı"),          # bağsız alacak (C-02)
    # C3: açılış yokken girilmiş, Silinenler'den geri yüklenecek bağlı tahsilat (Z9)
    o("tahsilat", "2026-01-11", id="PB", cari="C3", yol="nakit", tutar=1000, fatura="F4"),
    o("sil", kaynak="PB"),
    o("kasa_acilis", "2026-01-15", id="KA", tutar=10000),
    o("geri_yukle", kaynak="PB"),                                                                     # S20: aynen (11.01 < 15.01)
    o("tahsilat", "2026-01-10", id="PA", cari="C1", yol="nakit", tutar=1000, yedekten=True),        # S20: yedekten, bağsız
    o("tahsilat", "2026-01-10", id="PC", cari="C2", yol="nakit", tutar=1000, fatura="F5", yedekten=True),
    o("odeme", "2026-01-12", id="OD", cari="T1", yol="nakit", tutar=1000, fatura="A2", yedekten=True),
    R("mu0", "mutabakat_uyarilari", tarih="2026-01-31"), MZ("mz0", "2026-01-01", "2026-01-31"),
    R("ak1a", "acik_kalemler", cari="C1", tarih="2026-02-01"), R("g1a", "gecikmis", cari="C1", tarih="2026-02-01"),
    R("af1a", "acik_faturalar", cari="C1", tarih="2026-02-01"),
    R("ak2a", "acik_kalemler", cari="C2", tarih="2026-02-01"), R("g2a", "gecikmis", cari="C2", tarih="2026-01-16"),
    R("ak3a", "acik_kalemler", cari="C3", tarih="2026-02-01"), R("g3a", "gecikmis", cari="C3", tarih="2026-02-01"),
    R("akta", "acik_kalemler", cari="T1", tarih="2026-02-01"), R("hata", "hatirlatma", tarih="2026-02-01"),
    o("duzenle", kaynak="PA", degisiklik={"fatura": "F2"}),                  # S44 A: bağ EKLEME → kabul (yedekten)
    o("duzenle", kaynak="PC", degisiklik={"fatura": "F6"}),                  # S44 A: BAŞKA FATURAYA → kabul; F6'yı bağsız kapatmış AY serbest kalır (karar (2))
    o("duzenle", kaynak="PB", degisiklik={"fatura": None}),                  # S44 A: bağ KALDIRMA → kabul (Silinenler'den geri yüklenmiş; Z9)
    o("duzenle", kaynak="OD", degisiklik={"fatura": "A1"}),                  # S44 A: ödemenin alış faturası bağı başka faturaya → kabul
    o("duzenle", kaynak="PA", degisiklik={"fatura": "F1", "tarih": "2026-01-13"}),   # tarih de değişiyor (açılıştan önceki başka gün) → T12 red, bağ değişmez
    R("mu1", "mutabakat_uyarilari", tarih="2026-01-31"), MZ("mz", "2026-01-01", "2026-01-31"),
    R("ak1", "acik_kalemler", cari="C1", tarih="2026-02-01"), R("g1", "gecikmis", cari="C1", tarih="2026-02-01"),
    R("af1", "acik_faturalar", cari="C1", tarih="2026-02-01"),
    R("ak2", "acik_kalemler", cari="C2", tarih="2026-02-01"), R("g2", "gecikmis", cari="C2", tarih="2026-01-16"),
    R("g2b", "gecikmis", cari="C2", tarih="2026-02-01"),
    R("ak3", "acik_kalemler", cari="C3", tarih="2026-02-01"), R("g3", "gecikmis", cari="C3", tarih="2026-02-01"),
    R("akt", "acik_kalemler", cari="T1", tarih="2026-02-01"), R("hat", "hatirlatma", tarih="2026-02-01"),
], {"A": dict({
    # S44 A (README V1–V4): geri yüklenmiş, açılıştan önce tarihli Kasa kaydının fatura bağı tarih değişmeden düzeltilirse KABUL; kayıt kendi gününde yeni bağıyla
    # yeniden türetilir (G-7; karar (1), (2)); defter değişmez; Mutabakat uyarısı sürer. Eski kâhin (bakım 6 X11 (a)): ilk bağ düzeltmesinde senaryo hatası (susar).
    # S44 B (T12 ile red): dört düzeltme de reddedilirdi (5 red; açık kalemler düzeltme öncesindeki gibi kalırdı).
    "redler": ["KASA_ACILIS_ONCE"],
    "mu0": _MU80, "mu1": _MU80,
    # ÖNCE — C1: PA 1000 bağsız 10.01 → açık borçlar F1 (vade 20.01), F2 (vade 31.03) → S2: F1 kapanır; F2 açık
    "ak1a": [{"k": "fatura:F2", "tur": "fatura", "kalan": 1000, "vade": "2026-03-31", "tarih": "2026-01-06"}], "g1a/gecikmis": 0,
    "af1a": [{"fatura": "F2", "kalan": 1000, "vade": "2026-03-31", "tarih": "2026-01-06"}],
    # ÖNCE — C2: AY 600 bağsız 08.01 → vadesi ilk gelen F6 (15.01) 600 → F6 400; PC 10.01 F5'e bağlı → F5 kapanır. Açık F6 400, F7 1000; 16.01'de gecikmiş F6 400
    "ak2a": [{"k": "fatura:F6", "tur": "fatura", "kalan": 400, "vade": "2026-01-15", "tarih": "2026-01-06"},
             {"k": "fatura:F7", "tur": "fatura", "kalan": 1000, "vade": "2026-03-31", "tarih": "2026-01-07"}], "g2a/gecikmis": 400,
    # ÖNCE — C3: PB F4'e bağlı → F3 (vade 20.01) açık, 01.02'de gecikmiş 1000
    "ak3a": [{"k": "fatura:F3", "tur": "fatura", "kalan": 1000, "vade": "2026-01-20", "tarih": "2026-01-05"}], "g3a/gecikmis": 1000,
    # ÖNCE — T1: OD A2'ye bağlı → A1 açık (bizim borcumuz, alacak yönlü kalem)
    "akta": [{"k": "fatura:A1", "tur": "fatura", "kalan": -1000, "vade": "2026-01-20", "tarih": "2026-01-05"}],
    "hata/otomatik": {"C2": 400, "C3": 1000}, "hata/supheli_etiketli": [], "hata/elle": {},
    # SONRA — C1 (bağ ekleme): PA F2'ye bağlı (10.01; F2 06.01'de doğmuş) → F2 kapanır, F1 kendi vadesiyle (20.01) açık → 01.02'de gecikmiş 1000
    "ak1": [{"k": "fatura:F1", "tur": "fatura", "kalan": 1000, "vade": "2026-01-20", "tarih": "2026-01-05"}], "g1/gecikmis": 1000,
    "af1": [{"fatura": "F1", "kalan": 1000, "vade": "2026-01-20", "tarih": "2026-01-05"}],
    # SONRA — C2 (başka faturaya + karar (2)): PC F6'ya bağlı → F6'yı her durumda kapatır; F6'yı 08.01'de bağsız kapatmış AY 600 serbest kalır, KENDİ gününde (08.01)
    # açık F5 (vade 25.01) ve F7 (31.03) arasından S2 ile F5'e → F5 400 açık. 16.01'de gecikmiş 0 (F5 vadesi 25.01), 01.02'de 400
    "ak2": [{"k": "fatura:F5", "tur": "fatura", "kalan": 400, "vade": "2026-01-25", "tarih": "2026-01-05"},
            {"k": "fatura:F7", "tur": "fatura", "kalan": 1000, "vade": "2026-03-31", "tarih": "2026-01-07"}], "g2/gecikmis": 0, "g2b/gecikmis": 400,
    # SONRA — C3 (bağ kaldırma): PB bağsız 11.01 → S2: F3 (vade 20.01) kapanır, F4 (vade 31.03) açık → 01.02'de gecikmiş 0
    "ak3": [{"k": "fatura:F4", "tur": "fatura", "kalan": 1000, "vade": "2026-03-31", "tarih": "2026-01-06"}], "g3/gecikmis": 0,
    # SONRA — T1 (ödeme, başka alış faturasına): OD A1'e bağlı → A1 kapanır, A2 açık
    "akt": [{"k": "fatura:A2", "tur": "fatura", "kalan": -1000, "vade": "2026-03-31", "tarih": "2026-01-06"}],
    "hat/otomatik": {"C1": 1000, "C2": 400}, "hat/supheli_etiketli": [], "hat/elle": {},
}, **{"mz0/" + a: b for a, b in _MZ80.items()}, **{"mz/" + a: b for a, b in _MZ80.items()})},
  aciklama="S44: geri yüklenmiş (yedekten / Silinenler'den), Kasa açılışından önce tarihli Kasa kaydının Kapatılacak Fatura bağı tarih değişmeden eklenir / kaldırılır / "
           "başka faturaya alınırsa kabul; kayıt kendi gününde yeni bağıyla yeniden türetilir (karar (1), (2)), defter değişmez; tarih de değişirse T12 ile red; uyarı sürer.")

# ------------------------------------------------------------------------------------------------ S81 (kâhin bakımı 7; elle değerler model değiştirilmeden ÖNCE yazıldı)
_MU81 = [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PK", "tarih": "2026-01-10", "acilis": "2026-01-15"},
         {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PN", "tarih": "2026-01-10", "acilis": "2026-01-15"},
         {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PT", "tarih": "2026-01-11", "acilis": "2026-01-15"},
         {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PM", "tarih": "2026-01-12", "acilis": "2026-01-15"}]
S("s81-s44-geri-yuklenen-kasa-taksit-normal-cari", ["S44", "S40", "Z9", "S20", "S12", "T12", "G-7", "R-04", "H-04", "M1e", "T-13", "K3", "J-01", "M13", "karar (1)",
                                                    "karar (2)", "S2", "S3", "S7"], [
    o("satis_faturasi", "2026-01-02", id="F1", cari="C1", M=3000, K=0),
    o("taksit_karti", "2026-01-02", id="TK1", cari="C1", kaynak="fatura", fatura="F1", toplam=3000,
      taksitler=[{"vade": "2026-02-01", "tutar": 1000}, {"vade": "2026-03-01", "tutar": 1000}, {"vade": "2026-04-01", "tutar": 1000}]),
    o("satis_faturasi", "2026-01-02", id="F3", cari="C2", M=2000, K=0),
    o("taksit_karti", "2026-01-02", id="TK2", cari="C2", kaynak="fatura", fatura="F3", toplam=2000,
      taksitler=[{"vade": "2026-02-01", "tutar": 1000}, {"vade": "2026-03-01", "tutar": 1000}]),
    o("satis_faturasi", "2026-01-02", id="F4", cari="C3", M=10000, K=0, vade="2026-01-31"),
    o("satis_faturasi", "2026-01-03", id="F2", cari="C1", M=1000, K=0, vade="2026-01-20"),
    o("taksit_karti", "2026-01-03", id="TK3", cari="C2", kaynak="yeni_borc", toplam=1000, taksitler=[{"vade": "2026-02-15", "tutar": 1000}]),
    o("satis_faturasi", "2026-01-03", id="F5", cari="C3", M=5000, K=0, vade="2026-02-28"),
    # C3: SA 8000 → J-01 açık borçlardan vade sırasıyla: F4'ün 8000'i şüpheli kuyruğunda (128); CH'de F4 2000 + F5 5000
    o("supheliye_al", "2026-01-05", id="SA", cari="C3", tutar=8000),
    # açılış yokken girilmiş, Silinenler'den geri yüklenecek kayıtlar (Z9)
    o("tahsilat", "2026-01-11", id="PT", cari="C2", yol="nakit", tutar=1000, taksit_karti="TK2"),
    o("tahsilat", "2026-01-12", id="PM", cari="C3", yol="nakit", tutar=1000, normal_cari=True),     # normal 1000 ≤ 120 bakiyesi 7000
    o("sil", kaynak="PT"), o("sil", kaynak="PM"),
    o("kasa_acilis", "2026-01-15", id="KA", tutar=10000),
    o("geri_yukle", kaynak="PT"), o("geri_yukle", kaynak="PM"),
    o("tahsilat", "2026-01-10", id="PK", cari="C1", yol="nakit", tutar=1000, yedekten=True),        # bağsız
    o("tahsilat", "2026-01-10", id="PN", cari="C3", yol="nakit", tutar=3000, yedekten=True),        # K3: önce 128
    R("mu0", "mutabakat_uyarilari", tarih="2026-01-31"), MZ("mz0", "2026-01-01", "2026-01-31"), R("mod0", "moduller", tarih="2026-01-31"),
    R("g1a", "gecikmis", cari="C1", tarih="2026-01-21"), R("g1b", "gecikmis", cari="C1", tarih="2026-02-02"), R("kt1a", "kartlar", cari="C1", tarih="2026-02-02"),
    R("g2a", "gecikmis", cari="C2", tarih="2026-02-02"), R("g2b", "gecikmis", cari="C2", tarih="2026-02-16"), R("kt2a", "kartlar", cari="C2", tarih="2026-02-16"),
    R("g3a", "gecikmis", cari="C3", tarih="2026-02-01"), R("sk3a", "supheli_kayitlari", cari="C3"), R("hata", "hatirlatma", tarih="2026-02-01"),
    o("duzenle", kaynak="PK", degisiklik={"taksit_karti": "TK1"}),       # S44 A: taksit kartı bağı EKLEME → kabul (yedekten)
    o("duzenle", kaynak="PT", degisiklik={"taksit_karti": "TK3"}),       # S44 A: BAŞKA KARTA → kabul (Silinenler'den; Z9)
    R("mod1", "moduller", tarih="2026-01-31"),
    R("g2c", "gecikmis", cari="C2", tarih="2026-02-02"), R("kt2c", "kartlar", cari="C2", tarih="2026-02-16"),
    o("duzenle", kaynak="PT", degisiklik={"taksit_karti": None}),        # S44 A: bağ KALDIRMA → kabul
    o("duzenle", kaynak="PN", degisiklik={"normal_cari": True}),         # S44 A: "Normal Cari Hesaba İşle" SEÇİLDİ → kabul (normal 3000 ≤ 120 bakiyesi 7000)
    o("duzenle", kaynak="PM", degisiklik={"normal_cari": False}),        # S44 A: seçim KALDIRILDI → kabul
    o("duzenle", kaynak="PK", degisiklik={"taksit_karti": None, "tarih": "2026-01-13"}),   # tarih de değişiyor → T12 red, bağ değişmez
    R("mu1", "mutabakat_uyarilari", tarih="2026-01-31"), MZ("mz", "2026-01-01", "2026-01-31"), R("mod", "moduller", tarih="2026-01-31"),
    R("g1", "gecikmis", cari="C1", tarih="2026-01-21"), R("g1c", "gecikmis", cari="C1", tarih="2026-02-02"), R("kt1", "kartlar", cari="C1", tarih="2026-02-02"),
    R("g2", "gecikmis", cari="C2", tarih="2026-02-02"), R("g2d", "gecikmis", cari="C2", tarih="2026-02-16"), R("kt2", "kartlar", cari="C2", tarih="2026-02-16"),
    R("g3", "gecikmis", cari="C3", tarih="2026-02-01"), R("g3b", "gecikmis", cari="C3", tarih="2026-03-01"), R("sk3", "supheli_kayitlari", cari="C3"),
    R("hat", "hatirlatma", tarih="2026-02-01"),
], {"A": {
    # S44 A (README V1–V4): taksit kartı bağı ve Normal Cari Hesaba İşle düzeltmesi de KABUL; kayıt kendi gününde yeniden türetilir (M1e, K3, karar (1), (2)).
    # Eski kâhin (bakım 6 X11 (a)): ilk düzeltmede senaryo hatası (susar). S44 B (T12 ile red): beş düzeltme de reddedilirdi (6 red; sayılar "önce" değerlerinde kalırdı).
    "redler": ["KASA_ACILIS_ONCE"],
    "mu0": _MU81, "mu1": _MU81,
    # ÖNCE — C1: TK1 F1'i tüketir (taksitler 01.02 / 01.03 / 01.04); PK 1000 bağsız 10.01 → S2: F2 (vade 20.01) kapanır. 21.01'de gecikmiş 0; 02.02'de 01.02 taksiti 1000
    "g1a/gecikmis": 0, "g1b/gecikmis": 1000,
    "kt1a": {"TK1": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 1000, "kalan": 1000}, {"vade": "2026-03-01", "tutar": 1000, "kalan": 1000},
                                                    {"vade": "2026-04-01", "tutar": 1000, "kalan": 1000}]}},
    # ÖNCE — C2: PT TK2'ye bağlı (11.01) → TK2'nin 01.02 taksiti kapanır; TK3 (Yeni Borç, 15.02) açık → 02.02'de 0, 16.02'de 1000
    "g2a/gecikmis": 0, "g2b/gecikmis": 1000,
    "kt2a": {"TK2": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 1000, "kalan": 0}, {"vade": "2026-03-01", "tutar": 1000, "kalan": 1000}]},
             "TK3": {"kapali": False, "taksitler": [{"vade": "2026-02-15", "tutar": 1000, "kalan": 1000}]}},
    "mod0/taksit_odenen|TK1": 0, "mod0/taksit_odenen|TK2": 1000, "mod0/taksit_odenen|TK3": 0,
    # ÖNCE — C3: PN 3000 K3 ile önce 128 (SA 8000 → 5000); PM 1000 Normal Cari → 120, bağsız 12.01 → F4'ün CH kısmı 2000 → 1000. 128 = 5000; 120 = 15000 − 8000 − 1000 = 6000
    "mz0/satirlar/128|C3/bakiye": 5000, "mz0/satirlar/120|C3/bakiye": 6000,
    "g3a/gecikmis": 1000, "g3a/supheli": 5000, "sk3a/0/id": "SA", "sk3a/0/kalan": 5000,
    "hata/otomatik": {}, "hata/supheli_etiketli": ["C3"], "hata/elle": {"C3": 1000},
    # ARA — PT TK3'e (başka karta): TK3'ün taksiti kapanır, TK2'nin iki taksiti açık → 02.02'de gecikmiş 1000; kart modülünde ödenen TK2 1000 → 0, TK3 0 → 1000
    "mod1/taksit_odenen|TK1": 1000, "mod1/taksit_odenen|TK2": 0, "mod1/taksit_odenen|TK3": 1000,
    "g2c/gecikmis": 1000,
    "kt2c": {"TK2": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 1000, "kalan": 1000}, {"vade": "2026-03-01", "tutar": 1000, "kalan": 1000}]},
             "TK3": {"kapali": False, "taksitler": [{"vade": "2026-02-15", "tutar": 1000, "kalan": 0}]}},
    # SONRA — C1 (kart bağı ekleme): PK TK1'in vadesi ilk gelen taksitini (01.02) kapatır; F2 kendi vadesiyle (20.01) açık → 21.01'de 1000, 02.02'de F2 1000
    "g1/gecikmis": 1000, "g1c/gecikmis": 1000,
    "kt1": {"TK1": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 1000, "kalan": 0}, {"vade": "2026-03-01", "tutar": 1000, "kalan": 1000},
                                                   {"vade": "2026-04-01", "tutar": 1000, "kalan": 1000}]}},
    # SONRA — C2 (bağ kaldırma): PT bağsız 11.01 → S2: açık kalemlerden vadesi ilk gelen TK2 01.02 taksiti kapanır (kural gereği aynı kartın taksiti); TK3 açık
    # → 02.02'de 0, 16.02'de 1000; kart modülünde ödenen TK2 = TK3 = 0 (tahsilat artık kart tahsilatı değil)
    "g2/gecikmis": 0, "g2d/gecikmis": 1000,
    "kt2": {"TK2": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 1000, "kalan": 0}, {"vade": "2026-03-01", "tutar": 1000, "kalan": 1000}]},
            "TK3": {"kapali": False, "taksitler": [{"vade": "2026-02-15", "tutar": 1000, "kalan": 1000}]}},
    "mod/taksit_odenen|TK1": 1000, "mod/taksit_odenen|TK2": 0, "mod/taksit_odenen|TK3": 0,
    # SONRA — C3: PN Normal Cari → A 120 3000, bağsız 10.01: F4'ün CH kısmı 2000 kapanır, F5 5000 → 4000; PM seçimsiz → K3 ile A 128 1000 (SA 8000 → 7000).
    # 128 = 7000; 120 = 15000 − 8000 − 3000 = 4000; 01.02'de gecikmiş 0, 01.03'te F5 4000; carinin toplamı (120 + 128) 11000 ve Kasa değişmedi
    "mz/satirlar/128|C3/bakiye": 7000, "mz/satirlar/120|C3/bakiye": 4000,
    "g3/gecikmis": 0, "g3/supheli": 7000, "g3b/gecikmis": 4000, "sk3/0/id": "SA", "sk3/0/kalan": 7000,
    "mod/cari|C3": 11000, "mod0/cari|C3": 11000, "mod/kasa": 16000, "mod0/kasa": 16000,
    # hatırlatma (S3 / S7): C1 F2 1000 otomatik; C3 şüpheli kaydı açık → etiketli, şüphesiz gecikmiş yok
    "hat/otomatik": {"C1": 1000}, "hat/supheli_etiketli": ["C3"], "hat/elle": {},
    # mizan: Kasa = 10000 + PK 1000 + PT 1000 + PN 3000 + PM 1000; 120|C1 = 4000 − 1000; 120|C2 = 3000 − 1000; 600 = −21000; 600.90 = −1000 (TK3 Yeni Borç, KG-2); 519 = −10000
    "mz/satirlar/100/bakiye": 16000, "mz/satirlar/120|C1/bakiye": 3000, "mz/satirlar/120|C2/bakiye": 2000,
    "mz/satirlar/600/bakiye": -21000, "mz/satirlar/600.90/bakiye": -1000, "mz/satirlar/519/bakiye": -10000,
    "mz0/satirlar/100/bakiye": 16000, "mz0/satirlar/120|C1/bakiye": 3000, "mz0/satirlar/120|C2/bakiye": 2000,
}}, aciklama="S44: geri yüklenmiş, Kasa açılışından önce tarihli Kasa kaydının taksit kartı bağı (ekleme / başka kart / kaldırma) ve Normal Cari Hesaba İşle seçimi "
             "(açma / kapama) tarih değişmeden düzeltilirse kabul; kart taksitleri, 120 / 128 ayrımı ve gecikmiş kayıt gününden yeniden kurulur; tarih de değişirse red.")

# ------------------------------------------------------------------------------------------------ S82 (kâhin bakımı 7; elle değerler model değiştirilmeden ÖNCE yazıldı)
_MU82 = [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PB", "tarih": "2026-01-10", "acilis": "2026-01-15"},
         {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PT", "tarih": "2026-01-11", "acilis": "2026-01-15"}]
S("s82-s45-bagli-geri-yuklenen-kayit-cari", ["S45", "S44", "S40", "Z9", "S20", "S12", "T12", "G-7", "R-04", "H-04", "M1e", "karar (1)", "S2", "X9", "X10"], [
    o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-31"),
    o("satis_faturasi", "2026-01-05", id="F4", cari="C2", M=2000, K=0),
    o("taksit_karti", "2026-01-05", id="TK1", cari="C2", kaynak="fatura", fatura="F4", toplam=2000,
      taksitler=[{"vade": "2026-02-01", "tutar": 1000}, {"vade": "2026-03-01", "tutar": 1000}]),
    o("satis_faturasi", "2026-01-06", id="F2", cari="C1", M=500, K=0, vade="2026-01-20"),
    o("satis_faturasi", "2026-01-06", id="F3", cari="C3", M=2000, K=0, vade="2026-01-20"),
    # C2: açılış yokken girilmiş taksit tahsilatı, Silinenler'den geri yüklenecek (Z9)
    o("tahsilat", "2026-01-11", id="PT", cari="C2", yol="nakit", tutar=1000, taksit_karti="TK1"),
    o("sil", kaynak="PT"),
    o("kasa_acilis", "2026-01-15", id="KA", tutar=10000),
    o("geri_yukle", kaynak="PT"),
    o("tahsilat", "2026-01-10", id="PB", cari="C1", yol="nakit", tutar=1000, fatura="F1", yedekten=True),   # Kapatılacak Fatura: F1
    R("mu0", "mutabakat_uyarilari", tarih="2026-01-31"), MZ("mz0", "2026-01-01", "2026-01-31"),
    R("g1a", "gecikmis", cari="C1", tarih="2026-01-21"), R("g3a", "gecikmis", cari="C3", tarih="2026-01-21"),
    R("g2a", "gecikmis", cari="C2", tarih="2026-02-02"), R("kt2a", "kartlar", cari="C2", tarih="2026-02-02"),
    o("duzenle", kaynak="PB", degisiklik={"cari": "C3"}),                                          # S45 A: bağlı → BAG_KALDIRILMALI
    o("duzenle", kaynak="PB", degisiklik={"cari": "C3", "tutar": 800, "aciklama": "Yanlış cari"}),  # S45 A: düzeltmenin TAMAMI red (tutar da yazılmaz)
    o("duzenle", kaynak="PB", degisiklik={"cari": "C3", "tarih": "2026-01-12"}),                   # tarih de değişiyor → T12 önce (KASA_ACILIS_ONCE)
    o("duzenle", kaynak="PT", degisiklik={"cari": "C1"}),                                          # S45 A: taksit kartıyla bağlı → BAG_KALDIRILMALI
    o("duzenle", kaynak="PB", degisiklik={"cari": "C1", "aciklama": "Kapatılacak fatura doğru"}),  # aynı cari: cari düzeltmesi değil → kabul (S40)
    R("mz1", "mizan", bas="2026-01-01", son="2026-01-31"), R("g1b", "gecikmis", cari="C1", tarih="2026-01-21"),
    R("g3b", "gecikmis", cari="C3", tarih="2026-01-21"), R("kt2b", "kartlar", cari="C2", tarih="2026-02-02"),
    o("duzenle", kaynak="PB", degisiklik={"fatura": None}),                                        # S44 A: önce bağ kaldırılır → kabul
    R("g1c", "gecikmis", cari="C1", tarih="2026-01-21"), R("ak1c", "acik_kalemler", cari="C1", tarih="2026-01-21"),
    o("duzenle", kaynak="PB", degisiklik={"cari": "C3"}),                                          # S40 A: artık bağsız → kabul
    o("duzenle", kaynak="PT", degisiklik={"taksit_karti": None}),                                  # S44 A: kart bağı kaldırılır → kabul
    R("mz3", "mizan", bas="2026-01-01", son="2026-01-31"), R("g1d", "gecikmis", cari="C1", tarih="2026-02-01"),
    R("g3d", "gecikmis", cari="C3", tarih="2026-01-21"), R("kt2d", "kartlar", cari="C2", tarih="2026-02-02"), R("mod3", "moduller", tarih="2026-01-31"),
    o("duzenle", kaynak="PT", degisiklik={"cari": "C1"}),                                          # S40 A: artık bağsız → kabul
    R("mu1", "mutabakat_uyarilari", tarih="2026-01-31"), MZ("mz", "2026-01-01", "2026-01-31"),
    R("g1", "gecikmis", cari="C1", tarih="2026-01-21"), R("g1e", "gecikmis", cari="C1", tarih="2026-02-01"), R("ak1", "acik_kalemler", cari="C1", tarih="2026-02-01"),
    R("g2", "gecikmis", cari="C2", tarih="2026-02-02"), R("kt2", "kartlar", cari="C2", tarih="2026-02-02"),
    R("g3", "gecikmis", cari="C3", tarih="2026-02-01"), R("ak3", "acik_kalemler", cari="C3", tarih="2026-02-01"),
    R("hat", "hatirlatma", tarih="2026-02-02"),
], {"A": {
    # S45 A (README V5–V8): geri yüklenmiş, açılış öncesi Kasa kaydı Kapatılacak Fatura ya da taksit kartıyla bağlıysa carisi "önce bağı kaldırın" ile RED (düzeltmenin tamamı);
    # bağ ayrı düzeltmeyle kaldırılınca (S44) cari düzeltmesi kabul (S40). Eski kâhin (bakım 6 X11 (b)): ilk cari düzeltmesinde senaryo hatası (susar).
    # S45 B (bağ düşer, kayıt yeni caride bağsız): ilk düzeltme kabul — PB C3'e geçer, F1 açılır; PT C1'e geçer, TK1'in 01.02 taksiti açılır (redler yalnız KASA_ACILIS_ONCE).
    "redler": ["BAG_KALDIRILMALI", "BAG_KALDIRILMALI", "KASA_ACILIS_ONCE", "BAG_KALDIRILMALI"],
    "mu0": _MU82, "mu1": _MU82,
    # ÖNCE: C1 PB F1'e bağlı → F1 kapalı, F2 500 (vade 20.01) açık; C3 F3 2000 açık; C2 PT TK1'in 01.02 taksitini kapatır
    "g1a/gecikmis": 500, "g3a/gecikmis": 2000, "g2a/gecikmis": 0,
    "kt2a": {"TK1": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 1000, "kalan": 0}, {"vade": "2026-03-01", "tutar": 1000, "kalan": 1000}]}},
    "mz0/satirlar/100/bakiye": 12000, "mz0/satirlar/120|C1/bakiye": 500, "mz0/satirlar/120|C2/bakiye": 1000, "mz0/satirlar/120|C3/bakiye": 2000,
    # REDLERDEN SONRA hiçbir şey değişmedi (tutar 800 de yazılmadı: Kasa 12000, 120|C1 500)
    "mz1/satirlar/100/bakiye": 12000, "mz1/satirlar/120|C1/bakiye": 500, "mz1/satirlar/120|C2/bakiye": 1000, "mz1/satirlar/120|C3/bakiye": 2000,
    "g1b/gecikmis": 500, "g3b/gecikmis": 2000,
    "kt2b": {"TK1": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 1000, "kalan": 0}, {"vade": "2026-03-01", "tutar": 1000, "kalan": 1000}]}},
    # bağ kaldırıldı (S44): PB bağsız 10.01 → S2: F2 (vade 20.01) 500 kapanır, F1 (vade 31.01) 500 açık → 21.01'de gecikmiş 0
    "g1c/gecikmis": 0, "ak1c": [{"k": "fatura:F1", "tur": "fatura", "kalan": 500, "vade": "2026-01-31", "tarih": "2026-01-05"}],
    # PB C3'e (S40, X9): C1 F1 1000 + F2 500 açık → 01.02'de 1500; C3 F3 − PB 1000 = 1000 → 21.01'de 1000. PT bağsız: S2 ile TK1'in 01.02 taksitini yine kapatır,
    # kart modülünde ödenen 0
    "mz3/satirlar/120|C1/bakiye": 1500, "mz3/satirlar/120|C3/bakiye": 1000, "mz3/satirlar/120|C2/bakiye": 1000,
    "g1d/gecikmis": 1500, "g3d/gecikmis": 1000,
    "kt2d": {"TK1": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 1000, "kalan": 0}, {"vade": "2026-03-01", "tutar": 1000, "kalan": 1000}]}},
    "mod3/taksit_odenen|TK1": 0,
    # SONRA: PT C1'e (S40): C1'de 11.01 bağsız 1000 → S2: F2 500 kapanır, F1 500 açık (vade 31.01) → 21.01'de 0, 01.02'de 500; C2'de TK1'in iki taksiti açık → 02.02'de 1000
    "g1/gecikmis": 0, "g1e/gecikmis": 500, "ak1": [{"k": "fatura:F1", "tur": "fatura", "kalan": 500, "vade": "2026-01-31", "tarih": "2026-01-05"}],
    "g2/gecikmis": 1000,
    "kt2": {"TK1": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 1000, "kalan": 1000}, {"vade": "2026-03-01", "tutar": 1000, "kalan": 1000}]}},
    "g3/gecikmis": 1000, "ak3": [{"k": "fatura:F3", "tur": "fatura", "kalan": 1000, "vade": "2026-01-20", "tarih": "2026-01-06"}],
    "hat/otomatik": {"C1": 500, "C2": 1000, "C3": 1000}, "hat/supheli_etiketli": [], "hat/elle": {},
    # mizan: Kasa = 10000 + 1000 + 1000; 120|C1 = 1500 − 1000; 120|C2 = 2000; 120|C3 = 2000 − 1000; 600 = −5500; 519 = −10000
    "mz/satirlar/100/bakiye": 12000, "mz/satirlar/120|C1/bakiye": 500, "mz/satirlar/120|C2/bakiye": 2000, "mz/satirlar/120|C3/bakiye": 1000,
    "mz/satirlar/600/bakiye": -5500, "mz/satirlar/519/bakiye": -10000,
}}, aciklama="S45: geri yüklenmiş, Kasa açılışından önce tarihli Kasa kaydı Kapatılacak Fatura ya da taksit kartıyla bağlıysa carisinin düzeltilmesi 'önce bağı kaldırın' "
             "ile reddedilir (tutar / açıklama da yazılmaz); aynı cari kabul; bağ ayrı düzeltmeyle kaldırılınca cari düzeltmesi kabul; tarih de değişirse T12 önce.")

# ================================================================================================ kâhin bakımı 8 (S47–S53, B5, B6, B11, B14)
# Elle değerler model DEĞİŞTİRİLMEDEN ÖNCE yazıldı (README "Kâhin bakımı 8" W1–W19); hesaplar yorum satırlarında.

# ------------------------------------------------------------------------------------------------ S83: S47 + B6 (KG-16 "Açılış Olabilir" bekleyişi)
_AO83 = [("BYA", "C1", "borc", 1000, "2026-01-02"), ("BYB", "C2", "borc", 2000, "2026-01-02"), ("BYC", "C3", "borc", 3000, "2026-01-03"),
         ("AYD", "T1", "alacak", 4000, "2026-01-03")]


def _ao(satirlar, durumlar):
    return [{"kaynak": k, "cari": c, "yon": y, "tutar": t, "tarih": d, "durum": durumlar[k]} for (k, c, y, t, d) in satirlar]


S("s83-s47-b6-acilis-olabilir-bekleyis", ["S47", "B6", "KG-16", "M-02", "M-03", "C-01", "C-02", "M-11", "§7.4", "W1", "W2", "W3", "W5"], [
    # göç verisi (yedekten): B6 eşleşmesi — baştaki boşluk, Türkçe küçük harf, ç / ı / ş katlama; "Devir" / "Devreden" / ortada "açılış" girmez
    o("borc_yaz", "2026-01-02", id="BYA", cari="C1", tutar=1000, aciklama="AÇILIŞ", yedekten=True),
    o("borc_yaz", "2026-01-02", id="BYB", cari="C2", tutar=2000, aciklama="  Açilis farkı", yedekten=True),
    o("borc_yaz", "2026-01-03", id="BYC", cari="C3", tutar=3000, aciklama="ACILIS", yedekten=True),
    o("alacak_yaz", "2026-01-03", id="AYD", cari="T1", tutar=4000, aciklama="Açılışlar", yedekten=True),
    o("borc_yaz", "2026-01-04", id="BYE", cari="C1", tutar=500, aciklama="Devir bakiyesi", yedekten=True),
    o("borc_yaz", "2026-01-04", id="BYF", cari="C2", tutar=700, aciklama="Devreden", yedekten=True),
    o("borc_yaz", "2026-01-05", id="BYG", cari="C3", tutar=300, aciklama="Yeniden açılış", yedekten=True),
    o("borc_yaz", "2026-01-06", id="BYH", cari="C1", tutar=900, aciklama="Açılış bakiyesi"),      # 2.5.0'da girildi: aday DEĞİL (W1)
    o("satis_faturasi", "2026-02-01", id="F1", cari="C1", M=5000, K=0, vade="2026-02-10"),
    MZ("mz0", "2026-01-01", "2026-02-28"), GT("gt0", "2026-01-01", "2026-02-28"), BIL("bil0", "2026-02-28"),
    R("ao0", "acilis_olabilir", tarih="2026-02-28"), R("g1a", "gecikmis", cari="C1", tarih="2026-02-11"),
    o("acilis_onayla", kaynak="BYA", karar="onay"),
    o("acilis_onayla", kaynak="BYB", karar="red"),
    o("acilis_onayla", kaynak="AYD", karar="red"),
    MZ("mz1", "2026-01-01", "2026-02-28"), BIL("bil1", "2026-02-28"), R("ao1", "acilis_olabilir", tarih="2026-02-28"),
    R("g1b", "gecikmis", cari="C1", tarih="2026-02-11"),
    o("acilis_onayla", kaynak="BYC", karar="onay"),
    BIL("bil2", "2026-02-28"), R("ao2", "acilis_olabilir", tarih="2026-02-28"),
    o("acilis_eslestir", tarih="2026-02-28", satirlar=[{"hesap": "500", "alacak": 4000}]),
    BIL("bil3", "2026-02-28"), GT("gt", "2026-01-01", "2026-02-28"),
], {"A": {
    # BEKLERKEN (S47 A, W2): dört aday 519'da — BYA 1000, BYB 2000, BYC 3000 borçlu (B CH / A 519), AYD 4000 alacaklı (B 519 / A 320|T1):
    # 519 = −1000 − 2000 − 3000 + 4000 = −2000. Aday olmayanlar C-01: BYE 500 + BYF 700 + BYG 300 + BYH 900 = 2400 → 602.90
    "mz0/satirlar/519/bakiye": -2000, "mz0/satirlar/602.90/bakiye": -2400, "mz0/satirlar/120|C1/bakiye": 7400,
    "mz0/satirlar/120|C2/bakiye": 2700, "mz0/satirlar/120|C3/bakiye": 3300, "mz0/satirlar/320|T1/bakiye": -4000, "mz0/satirlar/600/bakiye": -5000,
    "gt0/kalemler/A": 7400, "gt0/kalemler/DNK": 7400,
    # Bilanço: Aktif I.C 13400 = Pasif III.B 4000 + V.G 2000 + V.F 7400; Kesin Değil "Onay Bekliyor" (W3) + G ≠ 0
    "bil0/aktif/I.C": 13400, "bil0/pasif/III.B": 4000, "bil0/pasif/V.G": 2000, "bil0/pasif/V.F": 7400, "bil0/aktif_toplam": 13400,
    "bil0/kesin_degil": ["ACILIS_OLABILIR_ONAY_BEKLIYOR", "TAMAMLANMAMIS_ACILIS"],
    "ao0": _ao(_AO83, {"BYA": "bekliyor", "BYB": "bekliyor", "BYC": "bekliyor", "AYD": "bekliyor"}),
    # onay gecikmişi değiştirmez (CH satırı aynı): C1 BYA 1000 (01-02) + BYE 500 + BYH 900 + F1 5000 (vade 02-10) → 11.02'de 7400
    "g1a/gecikmis": 7400, "g1b/gecikmis": 7400,
    # BYA onay (519 kalır), BYB red → 602.90, AYD red → C-02 B 770.90 / A 320|T1 (T1 şüphelisiz: K3 yok); BYC bekliyor
    # 519 = −1000 − 3000 = −4000; 602.90 = −2400 − 2000 = −4400; 770.90 = 4000; V.F = 4400 + 5000 − 4000 = 5400
    "mz1/satirlar/519/bakiye": -4000, "mz1/satirlar/602.90/bakiye": -4400, "mz1/satirlar/770.90/bakiye": 4000, "mz1/satirlar/320|T1/bakiye": -4000,
    "bil1/pasif/V.G": 4000, "bil1/pasif/V.F": 5400, "bil1/kesin_degil": ["ACILIS_OLABILIR_ONAY_BEKLIYOR", "TAMAMLANMAMIS_ACILIS"],
    "ao1": _ao(_AO83, {"BYA": "onaylandi", "BYB": "reddedildi", "BYC": "bekliyor", "AYD": "reddedildi"}),
    # BYC onay: bekleyen kalmadı → "Onay Bekliyor" düşer; G = −4000 ≠ 0 kalır
    "bil2/pasif/V.G": 4000, "bil2/kesin_degil": ["TAMAMLANMAMIS_ACILIS"],
    "ao2": _ao(_AO83, {"BYA": "onaylandi", "BYB": "reddedildi", "BYC": "onaylandi", "AYD": "reddedildi"}),
    # eşleştirme 4000 → 500: G = 0 → Kesin Değil yok; Pasif III.B 4000 + V.A 4000 + V.F 5400 = 13400
    "bil3/kesin_degil": [], "bil3/pasif/V.A": 4000, "bil3/pasif/V.G": 0, "bil3/pasif_toplam": 13400,
    "gt/kalemler/A": 9400, "gt/kalemler/E": 4000, "gt/kalemler/DNK": 5400, "gt/hesaplar/602.90": 4400, "gt/hesaplar/770.90": 4000,
    "acilis_olabilir": ["AYD", "BYA", "BYB", "BYC"], "redler": [],
}}, aciklama="S47: göç verisindeki 'Açılış…' açıklamalı işaretsiz Borç / Alacak Yaz onaya kadar 519'da, Bilanço 'Kesin Değil — Onay Bekliyor'; onay 519, red 602.90 / 770.90; "
             "B6 eşleşmesi (Türkçe küçük harf + ç/ı/ş katlama; Devir / Devreden girmez); 2.5.0'da girilen 'Açılış…' Borç Yaz aday değil.")

# ------------------------------------------------------------------------------------------------ S84: S48 (karşılıksız dönen carisiz açılış evrakı)
S("s84-s48-carisiz-acilis-evraki-karsiliksiz", ["S48", "M-08", "Ç-07", "M-11", "M1c", "S1", "§7.4", "W6", "W7"], [
    o("evrak_acilis", "2026-01-01", evrak="CK1", evrak_turu="cek", yon="alinan", durum="portfoy", tutar=10000),
    o("evrak_acilis", "2026-01-01", evrak="CK2", evrak_turu="cek", yon="alinan", durum="tahsilde", tutar=5000, banka="B1"),
    o("evrak_acilis", "2026-01-01", evrak="SN1", evrak_turu="senet", yon="alinan", durum="portfoy", tutar=3000),
    o("evrak_acilis", "2026-01-01", evrak="CK3", evrak_turu="cek", yon="alinan", durum="portfoy", tutar=2000, cari="C2"),   # carili (keşideci eşleşmiş)
    o("acilis_eslestir", tarih="2026-01-01", satirlar=[{"hesap": "500", "alacak": 20000}]),
    BIL("bil0", "2026-01-01"),
    o("evrak_karsiliksiz", "2026-02-10", id="KC1", evrak="CK1", cari="C1"),      # program cariyi sordu: C1 seçildi
    o("evrak_karsiliksiz", "2026-02-15", id="KC2", evrak="CK2"),                 # seçilmedi (bankada tahsildeydi)
    o("evrak_karsiliksiz", "2026-02-20", id="KS1", evrak="SN1", cari="C3"),      # senet, C3 seçildi
    o("evrak_karsiliksiz", "2026-02-25", id="KC3", evrak="CK3"),                 # carili evrak: Ç-07 aynen (C2)
    MZ("mz", "2026-01-01", "2026-02-28"), GT("gt", "2026-01-01", "2026-02-28"), BIL("bil", "2026-02-28"),
    R("g1a", "gecikmis", cari="C1", tarih="2026-02-10"), R("g1b", "gecikmis", cari="C1", tarih="2026-02-11"),
    R("ak1", "acik_kalemler", cari="C1", tarih="2026-02-11"), R("hat", "hatirlatma", tarih="2026-02-28"),
    R("mod", "moduller", tarih="2026-02-28"),
], {"A": {
    # açılış: 101.01 12000 + 101.02 5000 + 121.01 3000 = 20000 / A 519; eşleştirme 519 → 500 (G = 0)
    "bil0/aktif/I.A": 17000, "bil0/aktif/I.C": 3000, "bil0/aktif_toplam": 20000, "bil0/pasif/V.A": 20000, "bil0/kesin_degil": [],
    # KC1: B 120|C1 / A 101.01 10000 (cari borçlanır); KC2: B 519 / A 101.02 5000 (açılış geri alınmış); KS1: B 120|C3 / A 121.01 3000; KC3: B 120|C2 / A 101.01 2000
    "mz/satirlar/101.01/bakiye": 0, "mz/satirlar/101.02/bakiye": 0, "mz/satirlar/121.01/bakiye": 0,
    "mz/satirlar/120|C1/bakiye": 10000, "mz/satirlar/120|C2/bakiye": 2000, "mz/satirlar/120|C3/bakiye": 3000,
    "mz/satirlar/519/bakiye": 5000, "mz/satirlar/500/bakiye": -20000, "mz/satirlar/770.90/bakiye": 0, "mz/satirlar/770/bakiye": 0,
    # gelir / gider yok (S48 B'nin 770.90'ı, C'nin 770'i değil)
    "gt/kalemler/A": 0, "gt/kalemler/E": 0, "gt/kalemler/DNK": 0,
    # Bilanço: Aktif I.C 15000 = Pasif V.A 20000 + V.G −5000 (519 borçlu); G ≠ 0 → Tamamlanmamış Açılış (eşleştirme yeniden gerekir)
    "bil/aktif/I.C": 15000, "bil/aktif_toplam": 15000, "bil/pasif/V.A": 20000, "bil/pasif/V.G": -5000, "bil/pasif_toplam": 15000,
    "bil/kesin_degil": ["TAMAMLANMAMIS_ACILIS"],
    # TYK: karşılıksız ayrı borç kalemi (M1c), vade = karşılıksız günü (S1 A) → 10.02'de 0, 11.02'de 10000
    "g1a/gecikmis": 0, "g1b/gecikmis": 10000,
    "ak1": [{"k": "karsiliksiz:KC1", "tur": "karsiliksiz", "kalan": 10000, "vade": "2026-02-10", "tarih": "2026-02-10"}],
    "hat/otomatik": {"C1": 10000, "C2": 2000, "C3": 3000}, "hat/supheli_etiketli": [], "hat/elle": {},
    "mod/cari|C1": 10000, "mod/cari|C2": 2000, "mod/cari|C3": 3000,
    "redler": [],
}}, aciklama="S48: karşılıksız dönen carisiz açılış evrakında program cariyi sorar — seçilirse cari borçlanır (Ç-07, ayrı borç kalemi), seçilmezse B 519 / A 101; "
             "carili açılış evrakı Ç-07 aynen.")

# ------------------------------------------------------------------------------------------------ S85: S49 (formdan carisiz evrak, açılış değil)
S("s85-s49-formdan-carisiz-evrak", ["S49", "KG-3", "K-02", "Ç-04", "Ç-06", "Ç-10", "G-8", "W8"], [
    o("banka_acilis", "2026-01-01", banka="B1", tutar=10000),
    o("carisiz_evrak", "2026-03-10", id="CE1", evrak="CK5", evrak_turu="cek", yon="alinan", tutar=5000),
    o("carisiz_evrak", "2026-03-11", id="CE2", evrak="SN5", evrak_turu="senet", yon="alinan", tutar=2000),
    o("carisiz_evrak", "2026-03-12", id="CE3", evrak="VC5", evrak_turu="cek", yon="verilen", tutar=3000, banka="B1"),
    o("carisiz_evrak", "2026-03-13", id="CE4", evrak="VS5", evrak_turu="senet", yon="verilen", tutar=1000),
    MZ("mz0", "2026-03-01", "2026-03-13"),
    o("odeme", "2026-03-15", cari="T1", yol="ciro", evrak="SN5"),
    o("evrak_tahsil", "2026-03-20", evrak="CK5", yol="kasa"),
    o("verilen_evrak_ode", "2026-03-25", evrak="VC5"),
    MZ("mz", "2026-01-01", "2026-03-31"), GT("gt", "2026-01-01", "2026-03-31"), BIL("bil", "2026-03-31"),
], {"A": {
    # alınan: B 101.01 5000 / A 649.90; B 121.01 2000 / A 649.90 · verilen: B 770.90 3000 / A 103; B 770.90 1000 / A 321
    "mz0/satirlar/101.01/bakiye": 5000, "mz0/satirlar/121.01/bakiye": 2000, "mz0/satirlar/649.90/bakiye": -7000,
    "mz0/satirlar/770.90/bakiye": 4000, "mz0/satirlar/103/bakiye": -3000, "mz0/satirlar/321/bakiye": -1000,
    # dönem içinde 519 hareketi yok (banka açılışı 01.01 devirde; ilk yazımda "519/bakiye": 0 yanlıştı — mizan bakiyesi devri içerir)
    "mz0/satirlar/519/alacak": 0, "mz0/satirlar/602/bakiye": 0, "mz0/satirlar/770/bakiye": 0,
    # sonra: SN5 T1'e ciro (B 320|T1 / A 121.01 2000), CK5 Kasa'dan tahsil (B 100 / A 101.01 5000), VC5 ödendi (B 103 / A 102.B1 3000)
    "mz/satirlar/102.B1/bakiye": 7000, "mz/satirlar/100/bakiye": 5000, "mz/satirlar/101.01/bakiye": 0, "mz/satirlar/121.01/bakiye": 0,
    "mz/satirlar/103/bakiye": 0, "mz/satirlar/321/bakiye": -1000, "mz/satirlar/320|T1/bakiye": 2000, "mz/satirlar/649.90/bakiye": -7000,
    "mz/satirlar/770.90/bakiye": 4000, "mz/satirlar/519/bakiye": -10000,
    # GT: F 7000 (649.90), E 4000 (770.90 → 632); DNK = 7000 − 4000 = 3000
    "gt/kalemler/F": 7000, "gt/kalemler/E": 4000, "gt/kalemler/DNK": 3000, "gt/hesaplar/649.90": 7000, "gt/hesaplar/770.90": 4000,
    # Bilanço: I.A 100 5000 + 102.B1 7000 = 12000; borçlu 320|T1 → I.E 2000 (159); Pasif III.B 321 1000 + V.G 10000 + V.F 3000
    "bil/aktif/I.A": 12000, "bil/aktif/I.E": 2000, "bil/aktif_toplam": 14000, "bil/pasif/III.B": 1000, "bil/pasif/V.G": 10000,
    "bil/pasif/V.F": 3000, "bil/kesin_degil": ["TAMAMLANMAMIS_ACILIS"], "redler": [],
}}, aciklama="S49: formdan carisiz (açılış dışı) alınan evrak 649.90, verilen 770.90; tahsil, ciro, ödeme cari gerektirmeden aynen.")

# ------------------------------------------------------------------------------------------------ S86: S50 (tek kuyruk — kart seçilmeden tahsilat taksiti kapatır)
S("s86-s50-tek-kuyruk-kart-taksiti", ["S50", "M1a", "M1e", "S2", "karar (1)", "H-03", "H-04", "H-06", "KG-5", "W11"], [
    # C2: iki ayrı kart, aynı vadeli (01.02) taksitler — eşit vadede belge (kart) tarihi
    o("taksit_karti", "2026-01-01", id="TKa", cari="C2", kaynak="yeni_borc", toplam=1200,
      taksitler=[{"vade": "2026-02-01", "tutar": 600}, {"vade": "2026-03-01", "tutar": 600}]),
    o("taksit_karti", "2026-01-05", id="TKb", cari="C2", kaynak="yeni_borc", toplam=800,
      taksitler=[{"vade": "2026-02-01", "tutar": 400}, {"vade": "2026-04-01", "tutar": 400}]),
    # C3: Excel kartı + fatura; üç kart seçilmeden tahsilat (sonuncusu vadesi GELMEMİŞ taksiti kapatır)
    o("taksit_excel", "2026-01-15", id="TE1", cari="C3", toplam=2000, odenen=0,
      taksitler=[{"vade": "2026-02-01", "tutar": 1000}, {"vade": "2026-03-01", "tutar": 1000}]),
    o("satis_faturasi", "2026-01-20", id="F3", cari="C3", M=1000, K=0, vade="2026-02-10"),
    o("tahsilat", "2026-02-05", id="P3a", cari="C3", yol="havale", banka="B1", tutar=1000),
    R("g3a", "gecikmis", cari="C3", tarih="2026-02-11"),
    o("tahsilat", "2026-02-20", id="P3b", cari="C3", yol="havale", banka="B1", tutar=1000),
    R("g3b", "gecikmis", cari="C3", tarih="2026-02-21"),
    o("tahsilat", "2026-02-22", id="P3c", cari="C3", yol="havale", banka="B1", tutar=500),
    # C1: Yeni Borç kartı + vadesi sonra gelen fatura
    o("taksit_karti", "2026-02-01", id="TK1", cari="C1", kaynak="yeni_borc", toplam=3000,
      taksitler=[{"vade": "2026-03-01", "tutar": 1000}, {"vade": "2026-04-01", "tutar": 1000}, {"vade": "2026-05-01", "tutar": 1000}]),
    o("satis_faturasi", "2026-02-01", id="F1", cari="C1", M=2000, K=0, vade="2026-03-15"),
    o("tahsilat", "2026-03-10", id="P1", cari="C1", yol="nakit", tutar=1500),
    o("tahsilat", "2026-03-10", id="P2a", cari="C2", yol="nakit", tutar=1500),
    o("tahsilat", "2026-03-15", id="P2b", cari="C2", yol="nakit", tutar=200, taksit_karti="TKb"),   # kart tahsilatı (bağ): TKb'nin ilk açık taksiti
    R("kt1", "kartlar", cari="C1", tarih="2026-03-10"), R("ak1", "acik_kalemler", cari="C1", tarih="2026-03-10"),
    R("g1a", "gecikmis", cari="C1", tarih="2026-03-16"), R("g1b", "gecikmis", cari="C1", tarih="2026-04-02"),
    R("kt3", "kartlar", cari="C3", tarih="2026-03-02"), R("g3c", "gecikmis", cari="C3", tarih="2026-03-02"),
    R("kt2", "kartlar", cari="C2", tarih="2026-03-16"), R("g2a", "gecikmis", cari="C2", tarih="2026-03-11"),
    R("g2b", "gecikmis", cari="C2", tarih="2026-04-02"),
    R("mod", "moduller", tarih="2026-03-31"), R("hat", "hatirlatma", tarih="2026-03-16"), MZ("mz", "2026-01-01", "2026-03-31"),
], {"A": {
    # C1: P1 1500 (10.03) açık borçlara S2 ile: TK1 01.03 taksiti 1000 (vadesi önce gelen) + F1 (vade 15.03) 500 → F1 1500 açık
    "kt1": {"TK1": {"kapali": False, "taksitler": [{"vade": "2026-03-01", "tutar": 1000, "kalan": 0}, {"vade": "2026-04-01", "tutar": 1000, "kalan": 1000},
                                                    {"vade": "2026-05-01", "tutar": 1000, "kalan": 1000}]}},
    "ak1": [{"k": "fatura:F1", "tur": "fatura", "kalan": 1500, "vade": "2026-03-15", "tarih": "2026-02-01"},
            {"k": "kart:TK1", "tur": "taksit", "kalan": 1000, "vade": "2026-04-01", "tarih": "2026-02-01"},
            {"k": "kart:TK1", "tur": "taksit", "kalan": 1000, "vade": "2026-05-01", "tarih": "2026-02-01"}],
    "g1a/gecikmis": 1500, "g1b/gecikmis": 2500,
    # C3: P3a → TE1 01.02 (vadesi geçmiş taksit, F3'ten önce); 11.02'de F3 1000 gecikmiş; P3b → F3; 21.02'de 0; P3c 500 → TE1 01.03 (vadesi GELMEMİŞ — tek kuyruk)
    "g3a/gecikmis": 1000, "g3b/gecikmis": 0,
    "kt3": {"TE1": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 1000, "kalan": 0}, {"vade": "2026-03-01", "tutar": 1000, "kalan": 500}]}},
    "g3c/gecikmis": 500,
    # C2: P2a 1500 → TKa 01.02 600 (kart 01.01) + TKb 01.02 400 (kart 01.05) + TKa 01.03 500; P2b 200 (TKb'ye bağlı) → TKb 04.01
    "kt2": {"TKa": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 600, "kalan": 0}, {"vade": "2026-03-01", "tutar": 600, "kalan": 100}]},
            "TKb": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 400, "kalan": 0}, {"vade": "2026-04-01", "tutar": 400, "kalan": 200}]}},
    "g2a/gecikmis": 100, "g2b/gecikmis": 300,
    # kart modülü sayacı yalnız karta bağlı tahsilat (W11)
    "mod/taksit_odenen|TKb": 200, "mod/taksit_odenen|TKa": 0, "mod/taksit_odenen|TK1": 0, "mod/taksit_odenen|TE1": 0,
    "hat/otomatik": {"C1": 1500, "C2": 100, "C3": 500}, "hat/supheli_etiketli": [], "hat/elle": {},
    "mz/satirlar/120|C1/bakiye": 3500, "mz/satirlar/120|C2/bakiye": 300, "mz/satirlar/120|C3/bakiye": 500, "mz/satirlar/600.90/bakiye": -5000,
    "mz/satirlar/600/bakiye": -3000, "mz/satirlar/519/bakiye": -2000, "mz/satirlar/100/bakiye": 3200, "mz/satirlar/102.B1/bakiye": 2500,
    "redler": [],
}}, aciklama="S50: kart seçilmeden alınan tahsilat tek kuyrukta vadesi önce gelen açık kalemi kapatır — ayrı taksit kartının vadesi gelmiş (ve S2 ile gelmemiş) taksiti dahil; "
             "kart tahsilatı kendi kartına; Taksitler (kartlar) ve gecikmiş bunu gösterir.")

# ------------------------------------------------------------------------------------------------ S87: S51 (Silinenler'den geri alınan açılış)
_AO87 = [("AC1", "C1", "borc", 5000, "2026-01-01"), ("AC4", "C2", "borc", 3000, "2026-01-01"), ("BY7", "C3", "borc", 800, "2026-01-06")]
S("s87-s51-geri-alinan-acilis", ["S51", "S47", "KG-16", "B8", "G-7", "R-04", "M-02", "M-03", "C-01", "W10"], [
    o("cari_acilis", "2026-01-01", id="AC1", cari="C1", yon="borc", tutar=5000),
    o("sil", kaynak="AC1"),
    o("cari_acilis", "2026-01-01", id="AC2", cari="C1", yon="borc", tutar=6000),
    o("geri_yukle", kaynak="AC1"),                  # cari başka açılışla (AC2) → "Açılış Olabilir"
    o("cari_acilis", "2026-01-01", id="AC3", cari="C3", yon="alacak", tutar=2000),
    o("sil", kaynak="AC3"),
    o("geri_yukle", kaynak="AC3"),                  # başka açılış yok → G-7 aynen (açılış; aday değil)
    o("cari_acilis", "2026-01-01", id="AC4", cari="C2", yon="borc", tutar=3000),
    o("sil", kaynak="AC4"),
    o("cari_acilis", "2026-01-01", id="AC5", cari="C2", yon="borc", tutar=1000),
    o("geri_yukle", kaynak="AC4"),                  # cari başka açılışla (AC5) → "Açılış Olabilir"
    o("borc_yaz", "2026-01-05", id="BY6", cari="C1", tutar=700, aciklama="Açılış farkı"),   # 2.5.0 kaydı: geri alınsa da aday değil (W1, W10)
    o("sil", kaynak="BY6"),
    o("geri_yukle", kaynak="BY6"),
    o("borc_yaz", "2026-01-06", id="BY7", cari="C3", tutar=800, aciklama="Açılış bakiyesi", yedekten=True),   # B8: eski kayıt, geri alınınca da aday
    o("sil", kaynak="BY7"),
    o("geri_yukle", kaynak="BY7"),
    MZ("mz0", "2026-01-01", "2026-01-31"), BIL("bil0", "2026-01-31"), R("ao0", "acilis_olabilir", tarih="2026-01-31"),
    o("acilis_onayla", kaynak="AC1", karar="red"),
    o("acilis_onayla", kaynak="AC4", karar="onay"),
    o("acilis_onayla", kaynak="BY7", karar="onay"),
    MZ("mz1", "2026-01-01", "2026-01-31"), BIL("bil1", "2026-01-31"), R("ao1", "acilis_olabilir", tarih="2026-01-31"),
    GT("gt1", "2026-01-01", "2026-01-31"), R("g1", "gecikmis", cari="C1", tarih="2026-02-01"),
], {"A": {
    # BEKLERKEN: AC1 5000, AC4 3000, BY7 800 adaylar 519'da (S47); AC2 6000, AC5 1000, AC3 −2000 açılış 519; BY6 602.90
    # 519 = −5000 − 6000 + 2000 − 3000 − 1000 − 800 = −13800
    "mz0/satirlar/519/bakiye": -13800, "mz0/satirlar/602.90/bakiye": -700, "mz0/satirlar/120|C1/bakiye": 11700,
    "mz0/satirlar/120|C2/bakiye": 4000, "mz0/satirlar/120|C3/bakiye": -1200,
    # Bilanço: Aktif I.C 15700 = Pasif III.D 1200 (alacaklı C3) + V.G 13800 + V.F 700
    "bil0/aktif/I.C": 15700, "bil0/pasif/III.D": 1200, "bil0/pasif/V.G": 13800, "bil0/pasif/V.F": 700,
    "bil0/kesin_degil": ["ACILIS_OLABILIR_ONAY_BEKLIYOR", "TAMAMLANMAMIS_ACILIS"],
    "ao0": _ao(_AO87, {"AC1": "bekliyor", "AC4": "bekliyor", "BY7": "bekliyor"}),
    # AC1 red → C-01 B 120|C1 / A 602.90 5000; AC4, BY7 onay → 519. 519 = −13800 + 5000 = −8800; 602.90 = −5700
    "mz1/satirlar/519/bakiye": -8800, "mz1/satirlar/602.90/bakiye": -5700,
    "bil1/pasif/V.G": 8800, "bil1/pasif/V.F": 5700, "bil1/kesin_degil": ["TAMAMLANMAMIS_ACILIS"],
    "ao1": _ao(_AO87, {"AC1": "reddedildi", "AC4": "onaylandi", "BY7": "onaylandi"}),
    "gt1/kalemler/A": 5700, "gt1/kalemler/DNK": 5700,
    "g1/gecikmis": 11700,
    "acilis_olabilir": ["AC1", "AC4", "BY7"], "redler": [],
}}, aciklama="S51: Silinenler'den geri alınan cari açılışı, carinin başka açılışı varken 'Açılış Olabilir' listesine girer (onaya kadar 519); başka açılış yoksa aynen; "
             "geri alınan 2.5.0 Borç Yaz'ı aday olmaz, eski kayıt (yedekten) aday kalır.")

# ------------------------------------------------------------------------------------------------ S88: S52 (Ödeme Sözü)
def _hat(t, oto, soz=None, sus=None):
    x = {"tarih": t, "otomatik": oto, "supheli_etiketli": [], "elle": {}}
    if soz:
        x["odeme_sozu_var"] = soz
    if sus:
        x["kahin_susuyor"] = [{"cari": c, "neden": n} for c, n in sus]
    return x


S("s88-s52-odeme-sozu", ["S52", "B1", "S1", "M1f", "G-5", "S7", "W12", "W13", "W14", "S72", "S73", "P1", "P2"], [
    o("satis_faturasi", "2026-02-01", id="F1", cari="C1", M=1000, K=0, vade="2026-03-01"),
    o("satis_faturasi", "2026-02-02", id="F2", cari="C2", M=800, K=0, vade="2026-03-01"),
    o("satis_faturasi", "2026-02-03", id="F3", cari="C3", M=500, K=0, vade="2026-02-15"),
    o("satis_faturasi", "2026-02-04", id="F4", cari="C3", M=300, K=0, vade="2026-03-25"),
    R("hat0", "hatirlatma", tarih="2026-03-09"),
    o("odeme_sozu", "2026-03-10", cari="C1", soz_tarihi="2026-03-20"),
    o("odeme_sozu", "2026-03-10", cari="C3", soz_tarihi="2026-04-10"),
    o("tahsilat", "2026-03-12", cari="C1", yol="nakit", tutar=400),
    R("hat1", "hatirlatma", tarih="2026-03-15"), R("g1", "gecikmis", cari="C1", tarih="2026-03-15"),
    R("hat2", "hatirlatma", tarih="2026-03-19"),   # C1: söz tarihi yarın
    R("hat3", "hatirlatma", tarih="2026-03-20"),   # C1: söz günü (bakım 9: S72 A — girmez)
    R("hat4", "hatirlatma", tarih="2026-03-21"),   # C1: söz dün geçti
    R("hat5", "hatirlatma", tarih="2026-03-26"),   # C3: söz süresinde F4 gecikti (bakım 9: S73 A — söz bütün borcu kapsar)
    R("g3", "gecikmis", cari="C3", tarih="2026-03-26"),
    o("odeme_sozu", "2026-03-27", cari="C1", soz_tarihi="2026-04-05"),   # yeni söz öncekinin yerine
    R("hat6", "hatirlatma", tarih="2026-03-28"),
    R("hat7", "hatirlatma", tarih="2026-03-09"),   # sözler 10.03'te girildi: 09.03'te söz yok
], {"A": {
    "hat0": _hat("2026-03-09", {"C1": 1000, "C2": 800, "C3": 500}),
    # 15.03: C1 söz etkin (10.03 ≤ t < 20.03), gecikmiş F1 1000 − 400 = 600 (vade 01.03 < söz 10.03); C3 söz etkin, F3 500 (vade 15.02); C2 sözsüz
    "hat1": _hat("2026-03-15", {"C2": 800}, {"C1": 600, "C3": 500}), "g1/gecikmis": 600,
    "hat2": _hat("2026-03-19", {"C2": 800}, {"C1": 600, "C3": 500}),
    # G3 (bakım 9, S72 A): 20.03 C1'in söz günü — eskiden kahin_susuyor S52_SOZ_GUNU; artık "Ödeme Sözü Var" 600
    "hat3": _hat("2026-03-20", {"C2": 800}, {"C1": 600, "C3": 500}),
    "hat4": _hat("2026-03-21", {"C1": 600, "C2": 800}, {"C3": 500}),
    # 26.03: C3'te F4 (vade 25.03 ≥ söz 10.03) gecikti; gecikmiş 800 sayılır
    # G3 (bakım 9, S73 A): eskiden kahin_susuyor S52_YENI_GECIKME; söz bütün borcu kapsar → "Ödeme Sözü Var" 500 + 300 = 800
    "hat5": _hat("2026-03-26", {"C1": 600, "C2": 800}, {"C3": 800}), "g3/gecikmis": 800,
    # 28.03: C1 yeni söz (27.03 → 05.04) etkin, F1 vade 01.03 < 27.03 → "Ödeme Sözü Var"; C3 söz sürüyor (G3, S73 A: eskiden susma) → 800
    "hat6": _hat("2026-03-28", {"C2": 800}, {"C1": 600, "C3": 800}),
    "hat7": _hat("2026-03-09", {"C1": 1000, "C2": 800, "C3": 500}),
    "redler": [],
}}, aciklama="S52: vadesi geçmiş borca ileri tarihli Ödeme Sözü — borç gecikmiş sayılır, söz tarihine kadar otomatik hatırlatmaya girmez ('Ödeme Sözü Var'); "
             "S72 / S73 (bakım 9): söz günü de girmez, söz süresinde geciken kalem de sözün kapsamında.")

# ------------------------------------------------------------------------------------------------ S89 / S90: S53 (kilitsiz / kilitli şirkette geçmiş yıl)
_GOC53 = [
    o("satis_faturasi", "2024-05-01", id="F0", cari="C3", M=4000, K=0, yedekten=True),
    o("kasa_acilis", "2025-01-01", tutar=10000, yedekten=True),
    o("evrak_acilis", "2025-01-01", evrak="CK1", evrak_turu="cek", yon="alinan", durum="portfoy", tutar=3000, cari="C1", yedekten=True),
    o("borc_yaz", "2025-01-02", id="BY1", cari="C2", tutar=2000, aciklama="Açılış bakiyesi", yedekten=True),
    o("satis_faturasi", "2025-06-01", id="F1", cari="C1", M=5000, K=0, yedekten=True),
]
_BILGI53 = [{"kod": "KILITSIZ_GECMIS_YIL_YENI_KURAL", "yil": 2025, "oneri": "YILI_KILITLEYIN"}]
S("s89-s53-kilitsiz-gecmis-yil", ["S53", "G-7", "M-01", "M-08", "KG-16", "S47", "KG-12", "W15"], _GOC53 + [
    R("dm0", "defter_mutabakati_bilgi", tarih="2025-12-31"),
    o("satis_faturasi", "2026-02-01", id="F2", cari="C1", M=1000, K=0),
    MZ("mz25", "2025-01-01", "2025-12-31"), GT("gt25", "2025-01-01", "2025-12-31"), BIL("bil", "2026-03-01"),
    R("dm", "defter_mutabakati_bilgi", tarih="2026-03-01"),
    o("donem_kilitle", tarih="2025-12-31"),         # "yılı kilitleyin" önerisi uygulandı (2.5.0'da konan kilit: güncel kuralla donar)
    R("dm2", "defter_mutabakati_bilgi", tarih="2026-03-01"), MZ("mz25b", "2025-01-01", "2025-12-31"),
], {"A": {
    # 31.12.2025'te 2025 henüz geçmiş yıl değil; 2024'te yalnız satış (iki kural aynı) → ölçülmeyen
    "dm0": {"bilgi": [], "olculmeyen": [2024]},
    # kilitsiz 2025 yeni kuralla: Kasa 10000, CK1 3000, BY1 (aday, bekliyor) 2000 → 519 −15000; 500 / 602 yok
    "mz25/satirlar/519/bakiye": -15000, "mz25/satirlar/500/bakiye": 0, "mz25/satirlar/602/bakiye": 0, "mz25/satirlar/600/alacak": 5000,
    "gt25/kalemler/A": 5000, "gt25/kalemler/DNK": 5000,
    # Bilanço 01.03.2026: Aktif I.A 13000 + I.C 12000 = Pasif V.G 15000 + V.K 9000 (2024 4000 + 2025 5000) + V.F 1000
    "bil/aktif_toplam": 25000, "bil/pasif/V.G": 15000, "bil/pasif/V.K": 9000, "bil/pasif/V.F": 1000,
    "bil/kesin_degil": ["ACILIS_OLABILIR_ONAY_BEKLIYOR", "KAPANMAMIS_ONCEKI_YIL", "TAMAMLANMAMIS_ACILIS"],
    "dm": {"bilgi": _BILGI53, "olculmeyen": [2024]},
    # kilit 31.12.2025: iki geçmiş yıl da kilitli → bilgi yok; defter aynı (güncel kuralla donar)
    "dm2": {"bilgi": [], "olculmeyen": []}, "mz25b/satirlar/519/bakiye": -15000,
    "redler": [],
}}, aciklama="S53: kilitsiz şirkette geçmiş yılın defteri yeni kuralla (519); Defter Mutabakatı bilgisi 'Kilitlenmemiş geçmiş yıl yeni kuralla hesaplandı' + 'yılı kilitleyin'; "
             "kilitlenince bilgi kalkar.")

S("s90-s53-kilitli-gecmis-yil", ["S53", "Ç3", "KG-15", "KG-16", "S47", "W4", "W15"], _GOC53 + [
    o("donem_kilitle", tarih="2025-12-31", kural="2.4.9"),     # göçteki kilit: 2.4.9 kuralıyla donar
    o("satis_faturasi", "2026-02-01", id="F2", cari="C1", M=1000, K=0),
    MZ("mz25", "2025-01-01", "2025-12-31"), GT("gt25", "2025-01-01", "2025-12-31"), BIL("bil", "2026-03-01"),
    R("dm", "defter_mutabakati_bilgi", tarih="2026-03-01"), R("fark", "kural_farki"),
], {"A": {
    # donmuş 2025 (2.4.9): Kasa açılışı 500 10000, BY1 açıklamadan 500 2000 → 500 −12000; CK1 602 −3000; 519 yok
    "mz25/satirlar/519/bakiye": 0, "mz25/satirlar/500/bakiye": -12000, "mz25/satirlar/602/bakiye": -3000, "mz25/satirlar/600/alacak": 5000,
    "gt25/kalemler/A": 8000, "gt25/kalemler/DNK": 8000,
    # Bilanço: V.A 12000 + V.K 12000 (2024 4000 + 2025 8000) + V.F 1000 = 25000; BY1 listede bekliyor; donmuş ≠ güncel
    "bil/aktif_toplam": 25000, "bil/pasif/V.A": 12000, "bil/pasif/V.K": 12000, "bil/pasif/V.F": 1000, "bil/pasif/V.G": 0,
    "bil/kesin_degil": ["ACILIS_OLABILIR_ONAY_BEKLIYOR", "KAPANMAMIS_ONCEKI_YIL", "KURAL_DEGISIKLIGI_FARKI"],
    "dm": {"bilgi": [], "olculmeyen": []},
    "fark": {"500": 12000, "519": -15000, "602": 3000},
    "redler": [],
}}, aciklama="S53: kilitli (göçte 2.4.9 kuralıyla donmuş) geçmiş yılın defteri değişmez, bilgi yok; fark Kural Değişikliği Farkı olarak görünür.")

# ------------------------------------------------------------------------------------------------ S91: B5 (KG-5 madde tarihi = içe aktarmanın yerel günü)
S("s91-b5-kg5-yukleme-yerel-gunu", ["B5", "KG-5", "H-06", "M-10", "G-4", "M1e", "S50", "W16"], [
    # Kayıt Tarihi 10.02; içe aktarma 09.03 22:30 UTC = 10.03 01:30 İstanbul → madde 10.03
    o("taksit_excel", "2026-02-10", id="TE1", cari="C1", toplam=3000, odenen=1000, yukleme_ani="2026-03-09T22:30:00Z",
      taksitler=[{"vade": "2026-03-01", "tutar": 1000}, {"vade": "2026-04-01", "tutar": 1000}, {"vade": "2026-05-01", "tutar": 1000}]),
    # gün sınırı: 20:59:59 UTC = 23:59:59 İstanbul (05.03); 21:00:00 UTC = 00:00:00 İstanbul (06.03)
    o("taksit_excel", "2026-03-05", id="TE2", cari="C3", toplam=500, odenen=0, yukleme_ani="2026-03-05T20:59:59Z",
      taksitler=[{"vade": "2026-04-01", "tutar": 500}]),
    o("taksit_excel", "2026-03-05", id="TE3", cari="C2", toplam=700, odenen=0, yukleme_ani="2026-03-05T21:00:00Z",
      taksitler=[{"vade": "2026-04-01", "tutar": 700}]),
    MZ("mz0", "2026-01-01", "2026-03-09"), MZ("mz1", "2026-03-05", "2026-03-05"), MZ("mz2", "2026-01-01", "2026-03-10"),
    R("mod0", "moduller", tarih="2026-03-01"), R("mod1", "moduller", tarih="2026-03-05"),
    R("g1a", "gecikmis", cari="C1", tarih="2026-03-11"),
    o("tahsilat", "2026-03-20", cari="C1", yol="nakit", tutar=500),
    R("g1b", "gecikmis", cari="C1", tarih="2026-04-02"), R("kt1", "kartlar", cari="C1", tarih="2026-04-02"),
], {"A": {
    # defter: TE1 10.03'te (09.03'e kadar yok), TE2 05.03, TE3 06.03 — B CH (T − P) / A 519
    "mz0/satirlar/120|C1/bakiye": 0, "mz0/satirlar/120|C3/bakiye": 500, "mz0/satirlar/120|C2/bakiye": 700, "mz0/satirlar/519/bakiye": -1200,
    "mz1/satirlar/120|C3/borc": 500, "mz1/satirlar/120|C2/borc": 0, "mz1/satirlar/519/alacak": 500,
    "mz2/satirlar/120|C1/bakiye": 2000, "mz2/satirlar/519/bakiye": -3200,
    # cari modülü (ekstre) Kayıt Tarihi'nde: 01.03'te C1 2000 (defterde yok — B5 BİLİNEN SINIR); 05.03'te C3 500, C2 700
    "mod0/cari|C1": 2000, "mod0/taksit_odenen|TE1": 1000, "mod0/cari|C3": 0,
    "mod1/cari|C1": 2000, "mod1/cari|C3": 500, "mod1/cari|C2": 700,
    # TYK: P 1000 ilk taksiti (01.03) karşılar; 11.03'te açık 01.04, 01.05 → gecikmiş 0; 20.03 tahsilat 500 → 01.04 (S50) → 02.04'te 500
    "g1a/gecikmis": 0, "g1b/gecikmis": 500,
    "kt1": {"TE1": {"kapali": False, "taksitler": [{"vade": "2026-04-01", "tutar": 1000, "kalan": 500}, {"vade": "2026-05-01", "tutar": 1000, "kalan": 1000}]}},
    "redler": [],
}}, aciklama="B5: Excel'den yüklenen kartın KG-5 açılış maddesi içe aktarma anının İstanbul yerel gününde; Kayıt Tarihi cari modülünde (ekstre ↔ defter ayrışması BİLİNEN SINIR).")

# ------------------------------------------------------------------------------------------------ S92: B11 (Kasa açılışından önceye alınan düzeltme red)
S("s92-b11-kasa-acilis-oncesi-duzeltme", ["B11", "T12", "S12", "S20", "S26", "Z9", "M-01", "EK-2 §4 (8)", "W17"], [
    o("kasa_acilis", "2026-01-10", id="KA", tutar=10000),
    o("tahsilat", "2026-01-20", id="P1", cari="C1", yol="nakit", tutar=1000),
    o("duzenle", kaynak="P1", degisiklik={"tarih": "2026-01-10"}),      # açılış günü: kabul
    o("duzenle", kaynak="P1", degisiklik={"tarih": "2026-01-09"}),      # açılıştan önce: B11 red
    o("tahsilat", "2026-01-05", id="P2", cari="C1", yol="havale", banka="B1", tutar=500),   # Kasa değil: kabul
    o("duzenle", kaynak="P2", degisiklik={"yol": "nakit"}),            # açılıştan önce Kasa'ya çevirme: red
    o("kasa_cikis", "2026-01-15", id="KC", tutar=300),
    o("duzenle", kaynak="KC", degisiklik={"tarih": "2026-01-12"}),      # açılıştan sonra: kabul
    o("duzenle", kaynak="KC", degisiklik={"tarih": "2026-01-08"}),      # açılıştan önce: red
    o("kasa_giris", "2026-01-05", id="KG1", tutar=200, yedekten=True),  # S20: yedekten aynen
    o("duzenle", kaynak="KG1", degisiklik={"tarih": "2026-01-06"}),     # geri yüklenmiş ama tarih açılış öncesi başka güne: red
    R("mu0", "mutabakat_uyarilari", tarih="2026-01-31"),
    o("duzenle", kaynak="KG1", degisiklik={"tutar": 250}),              # S26: tarih değişmeden tutar: kabul
    o("duzenle", kaynak="KG1", degisiklik={"tarih": "2026-01-11"}),     # açılıştan sonraya: kabul, uyarı kalkar
    R("mu1", "mutabakat_uyarilari", tarih="2026-01-31"),
    MZ("mz", "2026-01-01", "2026-01-31"), MZ("mzg", "2026-01-10", "2026-01-10"), MZ("mzk", "2026-01-12", "2026-01-12"),
], {"A": {
    "redler": ["KASA_ACILIS_ONCE", "KASA_ACILIS_ONCE", "KASA_ACILIS_ONCE", "KASA_ACILIS_ONCE"],
    "mu0": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "KG1", "tarih": "2026-01-05", "acilis": "2026-01-10"}], "mu1": [],
    # Kasa = 10000 + P1 1000 − KC 300 + KG1 250 = 10950; P2 havale 500; 120|C1 −1500; 770.90 300; 649.90 −250
    "mz/satirlar/100/bakiye": 10950, "mz/satirlar/102.B1/bakiye": 500, "mz/satirlar/120|C1/bakiye": -1500, "mz/satirlar/519/bakiye": -10000,
    "mz/satirlar/770.90/bakiye": 300, "mz/satirlar/649.90/bakiye": -250,
    "mzg/satirlar/100/borc": 11000,          # 10.01: açılış 10000 + P1 1000 (açılış gününe alındı)
    "mzk/satirlar/100/alacak": 300,          # 12.01: KC
}}, aciklama="B11: Kasa hareketini açılıştan önceye alan ya da açılış öncesi kaydı Kasa'ya çeviren düzeltme reddedilir; açılış günü kabul; geri yüklenmişte S26 aynen.")

# ------------------------------------------------------------------------------------------------ S93: B14 (alt defter hesabında kural farkı fişle düzeltilmez)
S("s93-b14-alt-defter-kural-farki", ["B14", "KG-15", "M7", "N-16", "Ç3", "S14", "J-01", "§7.3", "W18"], [
    o("kasa_acilis", "2026-01-01", tutar=10000),
    o("satis_faturasi", "2026-02-01", id="F1", cari="C1", M=10000, K=0),
    o("supheliye_al", "2026-03-01", id="SA1", cari="C1", tutar=10000),
    o("tahsilat", "2026-03-10", id="P1", cari="C1", yol="cek", evrak="CK1", tutar=4000, fatura="F1"),   # S14: güncel 128, 2.4.9 120
    o("donem_kilitle", tarih="2026-03-31", kural="2.4.9"),
    R("fark0", "kural_farki"),
    o("kural_farki_duzelt"),
    R("fark1", "kural_farki"),
    o("kural_farki_duzelt"),                    # kalan fark yalnız alt defterde → red
    MZ("mz", "2026-01-01", "2026-04-30"), BIL("bil", "2026-04-30"),
], {"A": {
    # fark (güncel − donmuş): 500 +10000, 519 −10000 (Kasa açılışı); 120|C1 +4000, 128|C1 −4000 (S14 bağlı çek)
    "fark0": {"120|C1": 4000, "128|C1": -4000, "500": 10000, "519": -10000},
    # fiş (01.04): yalnız B 500 / A 519 10000 (B14) → kalan alt defter farkı raporda
    "fark1": {"120|C1": 4000, "128|C1": -4000},
    "redler": ["KURAL_FARKI_ALT_DEFTER"],
    # defter: donmuş 120|C1 = 10000 − 10000 − 4000 = −4000, 128|C1 10000; fişle 500 0, 519 −10000; cari bakiyesi 120 + 128 = 6000 (değişmez)
    "mz/satirlar/100/bakiye": 10000, "mz/satirlar/500/bakiye": 0, "mz/satirlar/519/bakiye": -10000, "mz/satirlar/120|C1/bakiye": -4000,
    "mz/satirlar/128|C1/bakiye": 10000, "mz/satirlar/101.01/bakiye": 4000, "mz/satirlar/600/bakiye": -10000,
    # Bilanço: Aktif I.A 14000 + I.C 10000 (128) = Pasif III.D 4000 (alacaklı 120) + V.G 10000 + V.F 10000; Kural Değişikliği Farkı kalır
    "bil/aktif/I.A": 14000, "bil/aktif/I.C": 10000, "bil/aktif_toplam": 24000, "bil/pasif/III.D": 4000, "bil/pasif/V.G": 10000,
    "bil/pasif/V.F": 10000, "bil/kesin_degil": ["KURAL_DEGISIKLIGI_FARKI", "TAMAMLANMAMIS_ACILIS"],
}}, aciklama="B14: Kural Farkı Düzeltme Fişi alt defter hesaplarına (120 ↔ 128) yazmaz; fark Bilanço'da Kural Değişikliği Farkı olarak kalır (BİLİNEN SINIR).")

# ================================================================================================ kâhin bakımı 8 ek kapsam (S54–S57; README U1–U8)
# Elle değerler S54–S57 için model DEĞİŞTİRİLMEDEN ÖNCE yazıldı; hesaplar yorum satırlarında.

# ------------------------------------------------------------------------------------------------ S94: S54 (geri yüklenmiş açılış öncesi kayıtta aynı düzeltmede bağ + cari)
_MU94 = [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": k, "tarih": t, "acilis": "2026-01-15"}
         for k, t in (("PA", "2026-01-10"), ("PB", "2026-01-11"), ("PC", "2026-01-12"), ("PD", "2026-01-12"))]
S("s94-s54-ayni-duzeltmede-bag-cari", ["S54", "S45", "S44", "S40", "S26", "Z9", "S20", "T12", "B11", "G-7", "karar (1)", "karar (2)", "M1e", "U1", "U2"], [
    o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-31"),
    o("satis_faturasi", "2026-01-06", id="F3", cari="C3", M=600, K=0, vade="2026-01-20"),
    o("taksit_karti", "2026-01-07", id="TK3", cari="C3", kaynak="yeni_borc", toplam=400, taksitler=[{"vade": "2026-02-01", "tutar": 400}]),
    o("kasa_acilis", "2026-01-15", id="KA", tutar=10000),
    o("tahsilat", "2026-01-10", id="PA", cari="C1", yol="nakit", tutar=300, fatura="F1", yedekten=True),
    o("tahsilat", "2026-01-11", id="PB", cari="C1", yol="nakit", tutar=200, fatura="F1", yedekten=True),
    o("tahsilat", "2026-01-12", id="PC", cari="C1", yol="nakit", tutar=100, fatura="F1", yedekten=True),
    o("tahsilat", "2026-01-12", id="PD", cari="C1", yol="nakit", tutar=50, fatura="F1", yedekten=True),
    R("mu0", "mutabakat_uyarilari", tarih="2026-01-31"), R("g1a", "gecikmis", cari="C1", tarih="2026-02-01"),
    R("g3a", "gecikmis", cari="C3", tarih="2026-01-21"),
    o("duzenle", kaynak="PA", degisiklik={"cari": "C3", "fatura": "F3", "tutar": 350, "aciklama": "doğru cari"}),   # S54: yeni carinin faturasına (+ tutar, X10)
    o("duzenle", kaynak="PB", degisiklik={"cari": "C3", "fatura": None, "taksit_karti": "TK3"}),               # S54: yeni carinin kartına
    o("duzenle", kaynak="PC", degisiklik={"cari": "C2", "fatura": None}),                                     # S54: bağ kaldırıldı + cari
    o("duzenle", kaynak="PD", degisiklik={"cari": "C3"}),                       # bağ değişmedi → S45 BAG_KALDIRILMALI
    o("duzenle", kaynak="PD", degisiklik={"cari": "C3", "fatura": "F1"}),       # aynı bağ yeniden yazıldı (değişmedi) → S45 BAG_KALDIRILMALI
    o("duzenle", kaynak="PD", degisiklik={"cari": "C3", "fatura": "F3", "tarih": "2026-01-13"}),   # tarih de açılış öncesi başka güne → T12 / B11 önce
    R("mu1", "mutabakat_uyarilari", tarih="2026-01-31"), MZ("mz", "2026-01-01", "2026-01-31"),
    R("g1b", "gecikmis", cari="C1", tarih="2026-02-01"), R("g3b", "gecikmis", cari="C3", tarih="2026-01-21"),
    R("g3c", "gecikmis", cari="C3", tarih="2026-02-02"), R("ak3", "acik_kalemler", cari="C3", tarih="2026-02-02"),
    R("kt3", "kartlar", cari="C3", tarih="2026-02-02"), R("mod", "moduller", tarih="2026-01-31"), R("hat", "hatirlatma", tarih="2026-02-02"),
], {"A": {
    # ÖNCE: F1 1000 − (300 + 200 + 100 + 50) = 350 açık (vade 31.01); C3 F3 600 (vade 20.01), TK3 400
    "mu0": _MU94, "g1a/gecikmis": 350, "g3a/gecikmis": 600,
    "redler": ["BAG_KALDIRILMALI", "BAG_KALDIRILMALI", "KASA_ACILIS_ONCE"],
    # SONRA: PA 350 → C3, F3'e bağlı (F3 250 açık); PB 200 → C3, TK3'e bağlı (taksit 200 açık); PC 100 → C2 bağsız (avans); PD 50 C1'de F1'e bağlı kaldı
    # Kasa = 10000 + 350 + 200 + 100 + 50 = 10700; 120|C1 = 1000 − 50; 120|C3 = 600 + 400 − 350 − 200; 120|C2 = −100
    "mz/satirlar/100/bakiye": 10700, "mz/satirlar/120|C1/bakiye": 950, "mz/satirlar/120|C3/bakiye": 450, "mz/satirlar/120|C2/bakiye": -100,
    "mz/satirlar/600/bakiye": -1600, "mz/satirlar/600.90/bakiye": -400, "mz/satirlar/519/bakiye": -10000,
    "g1b/gecikmis": 950, "g3b/gecikmis": 250, "g3c/gecikmis": 450,
    "ak3": [{"k": "fatura:F3", "tur": "fatura", "kalan": 250, "vade": "2026-01-20", "tarih": "2026-01-06"},
            {"k": "kart:TK3", "tur": "taksit", "kalan": 200, "vade": "2026-02-01", "tarih": "2026-01-07"}],
    "kt3": {"TK3": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 400, "kalan": 200}]}},
    "mod/taksit_odenen|TK3": 200,
    # dört kayıt da geri yüklenmiş, açılış öncesi: Mutabakat uyarısı sürer (S20 / S40)
    "mu1": _MU94,
    "hat/otomatik": {"C1": 950, "C3": 450}, "hat/supheli_etiketli": [], "hat/elle": {},
}}, aciklama="S54: geri yüklenmiş, Kasa açılışından önce tarihli bağlı kayıtta aynı düzeltmede bağ + cari kabul — bağ yeni carinin faturasına / kartına ya da kaldırılır; "
             "bağ değişmeden cari değişirse S45 red; tarih de değişirse T12 önce.")

# ------------------------------------------------------------------------------------------------ S95: S55 (bağlanan hedef kayıttan SONRA tarihli)
S("s95-s55-bag-hedefi-sonra", ["S55", "S44", "Z9", "S20", "karar (1)", "karar (2)", "karar (5)", "M1e", "EK-2 Soru 24", "U3", "U4"], [
    o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-15"),
    o("satis_faturasi", "2026-01-05", id="F3", cari="C3", M=400, K=0, vade="2026-01-08"),
    o("kasa_acilis", "2026-01-15", id="KA", tutar=10000),
    o("tahsilat", "2026-01-10", id="PY", cari="C1", yol="nakit", tutar=1000, yedekten=True),     # bağsız: F1'i kapatır
    o("satis_faturasi", "2026-01-20", id="F2", cari="C1", M=1000, K=0, vade="2026-03-31"),
    o("satis_faturasi", "2026-01-20", id="F5", cari="C2", M=500, K=0, vade="2026-01-20"),
    o("taksit_karti", "2026-01-25", id="TK7", cari="C3", kaynak="yeni_borc", toplam=400, taksitler=[{"vade": "2026-02-25", "tutar": 400}]),
    # olağan (geri yüklenmemiş) geriye tarihli tahsilatlar, sonradan tarihli karta / faturaya bağlı
    o("tahsilat", "2026-01-12", id="P3", cari="C3", yol="havale", banka="B1", tutar=400, taksit_karti="TK7"),
    o("tahsilat", "2026-01-10", id="P2", cari="C2", yol="havale", banka="B1", tutar=800, fatura="F5"),    # fazla 300 (U4 b)
    R("g1a", "gecikmis", cari="C1", tarih="2026-02-01"),
    o("duzenle", kaynak="PY", degisiklik={"fatura": "F2"}),                    # S44 + S55: hedef F2 (20.01) kayıttan (10.01) sonra
    R("g1b", "gecikmis", cari="C1", tarih="2026-02-01"), R("ak1", "acik_kalemler", cari="C1", tarih="2026-02-01"),
    R("g1x", "gecikmis", cari="C1", tarih="2026-01-20"), R("g1w", "gecikmis", cari="C1", tarih="2026-01-16"),
    R("g3", "gecikmis", cari="C3", tarih="2026-02-01"), R("ak3", "acik_kalemler", cari="C3", tarih="2026-03-01"),
    R("kt3", "kartlar", cari="C3", tarih="2026-03-01"), R("g2", "gecikmis", cari="C2", tarih="2026-02-01"),
    R("hat", "hatirlatma", tarih="2026-02-01"), MZ("mz", "2026-01-01", "2026-01-31"), R("mu", "mutabakat_uyarilari", tarih="2026-01-31"),
], {"A": {
    # ÖNCE (PY bağsız): F1 kapalı, F2 vadesi gelmemiş → 01.02'de 0
    "g1a/gecikmis": 0,
    # SONRA: bağ F2'nin doğduğu gün (20.01) uygulanır → F2 kapanır, F1 kendi vadesiyle (15.01) açık → 01.02'de 1000; 20.01'de de 1000 (susma yok)
    "g1b/gecikmis": 1000, "ak1": [{"k": "fatura:F1", "tur": "fatura", "kalan": 1000, "vade": "2026-01-15", "tarih": "2026-01-05"}],
    "g1x": {"cari": "C1", "tarih": "2026-01-20", "gecikmis": 1000, "supheli": 0, "detay": [{"kalem": "fatura:F1", "vade": "2026-01-15", "kalan": 1000}]},
    # 16.01: hedef henüz doğmadı → aradaki dönem kâhinde susar (U4 a, KULLANICIYA SORULMALI 6)
    "g1w/kahin_susuyor": [{"kaynak": "PY", "neden": "S55_BEKLEYEN_BAG", "tutar": 1000}],
    # C3 (olağan, kart bağı): P3 400 TK7'nin doğduğu gün (25.01) taksiti kapatır; F3 (vade 08.01) açık kalır → 01.02'de 400
    "g3": {"cari": "C3", "tarih": "2026-02-01", "gecikmis": 400, "supheli": 0, "detay": [{"kalem": "fatura:F3", "vade": "2026-01-08", "kalan": 400}]},
    "ak3": [{"k": "fatura:F3", "tur": "fatura", "kalan": 400, "vade": "2026-01-08", "tarih": "2026-01-05"}],
    "kt3": {"TK7": {"kapali": False, "taksitler": [{"vade": "2026-02-25", "tutar": 400, "kalan": 0}]}},
    # C2: P2 800 > F5 500 → fazla 300'ün dağılım günü belirsiz (U4 b, KULLANICIYA SORULMALI 7)
    "g2/kahin_susuyor": [{"kaynak": "P2", "neden": "S55_FAZLA", "tutar": 300}],
    "hat": {"tarih": "2026-02-01", "otomatik": {"C1": 1000, "C3": 400}, "supheli_etiketli": [], "elle": {},
            "kahin_susuyor": [{"cari": "C2", "neden": "S55_FAZLA"}]},
    # defter değişmez (bağ defter olayı değil, T-01): Kasa 11000; 102.B1 1200; 120|C1 1000; 120|C3 400; 120|C2 −300
    "mz/satirlar/100/bakiye": 11000, "mz/satirlar/102.B1/bakiye": 1200, "mz/satirlar/120|C1/bakiye": 1000, "mz/satirlar/120|C3/bakiye": 400,
    "mz/satirlar/120|C2/bakiye": -300, "mz/satirlar/600/bakiye": -2900, "mz/satirlar/600.90/bakiye": -400,
    "mu": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PY", "tarih": "2026-01-10", "acilis": "2026-01-15"}],
    "redler": [],
}}, aciklama="S55: düzeltmeyle (ya da olağan kayıtta) bağlanan fatura / taksit kartı kayıttan sonra tarihliyse bağ hedefin doğduğu gün uygulanır; aradaki dönem ve fazla kâhinde susar.")

# ------------------------------------------------------------------------------------------------ S96: S56 (S44 düzeltmesi şüpheli-normal sınırını aşarsa red)
S("s96-s56-s44-normal-cari-siniri", ["S56", "S44", "Z9", "S20", "T-13", "K3", "J-01", "§3.11b/2", "U5"], [
    o("satis_faturasi", "2026-01-02", id="F4", cari="C3", M=10000, K=0),
    o("supheliye_al", "2026-01-05", id="SA", cari="C3", tutar=9000),
    o("kasa_acilis", "2026-01-15", id="KA", tutar=10000),
    o("tahsilat", "2026-01-10", id="PN", cari="C3", yol="nakit", tutar=3000, yedekten=True),   # K3: 128'den
    MZ("mz0", "2026-01-01", "2026-01-31"),
    o("duzenle", kaynak="PN", degisiklik={"normal_cari": True}),                       # 3000 > 120 bakiyesi 1000 → red
    o("duzenle", kaynak="PN", degisiklik={"normal_cari": True, "aciklama": "x"}),      # düzeltmenin TAMAMI red
    MZ("mz1", "2026-01-01", "2026-01-31"),
    o("duzenle", kaynak="PN", degisiklik={"normal_cari": True, "tutar": 1000}),        # 1000 = 1000 → kabul (sınır "aşamaz")
    MZ("mz2", "2026-01-01", "2026-01-31"), R("mu", "mutabakat_uyarilari", tarih="2026-01-31"),
], {"A": {
    # ÖNCE: Kasa 13000; 120|C3 = 10000 − 9000 = 1000; 128|C3 = 9000 − 3000 = 6000
    "mz0/satirlar/100/bakiye": 13000, "mz0/satirlar/120|C3/bakiye": 1000, "mz0/satirlar/128|C3/bakiye": 6000,
    "redler": ["SUPHELI_NORMAL_ASIM", "SUPHELI_NORMAL_ASIM"],
    "mz1/satirlar/100/bakiye": 13000, "mz1/satirlar/120|C3/bakiye": 1000, "mz1/satirlar/128|C3/bakiye": 6000,
    # eşitlik kabul: PN 1000 → 120; Kasa 11000; 120|C3 0; 128|C3 9000
    "mz2/satirlar/100/bakiye": 11000, "mz2/satirlar/120|C3/bakiye": 0, "mz2/satirlar/128|C3/bakiye": 9000,
    "mu": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PN", "tarih": "2026-01-10", "acilis": "2026-01-15"}],
}}, aciklama="S56: geri yüklenmiş açılış öncesi kaydın S44 düzeltmesi şüpheli caride Normal Cari sınırını aşarsa SUPHELI_NORMAL_ASIM ile red (tamamı); eşitlik kabul.")

# ------------------------------------------------------------------------------------------------ S97: S57 (olağan bağlı kaydın carisi)
S("s97-s57-olagan-bagli-kayit-cari", ["S57", "S45", "G-7", "C-03", "T-01", "H-04", "M1e", "karar (1)", "U6"], [
    o("kasa_acilis", "2026-01-01", id="KA", tutar=1000),
    o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-31"),
    o("satis_faturasi", "2026-01-06", id="F3", cari="C3", M=500, K=0, vade="2026-01-20"),
    o("taksit_karti", "2026-01-07", id="TK1", cari="C1", kaynak="yeni_borc", toplam=300, taksitler=[{"vade": "2026-02-01", "tutar": 300}]),
    o("tahsilat", "2026-01-10", id="PB", cari="C1", yol="havale", banka="B1", tutar=400, fatura="F1"),
    o("tahsilat", "2026-01-11", id="PT", cari="C1", yol="havale", banka="B1", tutar=300, taksit_karti="TK1"),
    o("tahsilat", "2026-01-12", id="PK", cari="C1", yol="nakit", tutar=200, fatura="F1", yedekten=True),   # geri yüklenmiş ama açılıştan SONRA: olağan
    R("g1a", "gecikmis", cari="C1", tarih="2026-02-02"), R("g3a", "gecikmis", cari="C3", tarih="2026-01-21"),
    o("duzenle", kaynak="PB", degisiklik={"cari": "C3"}),                    # S57: BAG_KALDIRILMALI
    o("duzenle", kaynak="PB", degisiklik={"cari": "C3", "tutar": 350}),      # düzeltmenin TAMAMI red
    o("duzenle", kaynak="PT", degisiklik={"cari": "C3"}),                    # taksit kartı bağlı: red
    o("duzenle", kaynak="PK", degisiklik={"cari": "C3"}),                    # açılış sonrası geri yüklenmiş = olağan: red
    o("duzenle", kaynak="PB", degisiklik={"cari": "C1", "aciklama": "aynı cari"}),   # aynı cari → kabul
    MZ("mz1", "2026-01-01", "2026-01-31"),
    o("duzenle", kaynak="PB", degisiklik={"fatura": None}),                  # önce bağ kaldırılır (olağan düzeltme)
    R("g1c", "gecikmis", cari="C1", tarih="2026-02-02"),
    o("duzenle", kaynak="PB", degisiklik={"cari": "C3"}),                    # artık bağsız → kabul
    MZ("mz", "2026-01-01", "2026-01-31"), R("g1", "gecikmis", cari="C1", tarih="2026-02-02"), R("g3", "gecikmis", cari="C3", tarih="2026-01-21"),
    R("ak3", "acik_kalemler", cari="C3", tarih="2026-01-21"), R("mu", "mutabakat_uyarilari", tarih="2026-01-31"),
], {"A": {
    # ÖNCE: F1 1000 − PB 400 − PK 200 = 400 (vade 31.01); TK1 taksiti PT ile kapalı → 02.02'de 400; C3 F3 500
    "g1a/gecikmis": 400, "g3a/gecikmis": 500,
    "redler": ["BAG_KALDIRILMALI", "BAG_KALDIRILMALI", "BAG_KALDIRILMALI", "BAG_KALDIRILMALI"],
    # redlerden sonra hiçbir şey değişmedi (tutar 350 yazılmadı): 120|C1 = 1000 + 300 − 400 − 300 − 200 = 400; 102.B1 700; Kasa 1200
    "mz1/satirlar/120|C1/bakiye": 400, "mz1/satirlar/120|C3/bakiye": 500, "mz1/satirlar/102.B1/bakiye": 700, "mz1/satirlar/100/bakiye": 1200,
    # bağ kaldırıldı: PB bağsız 10.01 → S2: F1 (vade 31.01) önce → yine F1 400 açık
    "g1c/gecikmis": 400,
    # PB C3'e: F3 500 − 400 = 100 (vade 20.01); C1: F1 1000 − PK 200 = 800
    "mz/satirlar/120|C1/bakiye": 800, "mz/satirlar/120|C3/bakiye": 100, "mz/satirlar/600/bakiye": -1500, "mz/satirlar/600.90/bakiye": -300,
    "g1/gecikmis": 800, "g3/gecikmis": 100,
    "ak3": [{"k": "fatura:F3", "tur": "fatura", "kalan": 100, "vade": "2026-01-20", "tarih": "2026-01-06"}],
    "mu": [],
}}, aciklama="S57: olağan kayıt Kapatılacak Fatura / taksit kartıyla bağlıyken carisi düzeltilirse 'önce bağı kaldırın' ile red (tamamı); aynı cari kabul; "
             "bağ ayrı düzeltmeyle kaldırılınca cari kabul.")

# ================================================================================================ kâhin bakımı 8 ikinci ek kapsam (S65, S66, S68; README Q1–Q5)
# Elle değerler S65–S68 için model DEĞİŞTİRİLMEDEN ÖNCE yazıldı; S67 kâhin dilinde yok (Q3).

# ------------------------------------------------------------------------------------------------ S98: S65 ("açılış" ortada geçen eski kayıt aday değil)
S("s98-s65-acilis-ortada", ["S65", "B6", "KG-16", "S47", "C-01", "Q1"], [
    o("borc_yaz", "2026-01-03", id="BY1", cari="C1", tutar=700, aciklama="2025 açılış farkı", yedekten=True),     # ortada: aday DEĞİL
    o("borc_yaz", "2026-01-04", id="BY2", cari="C2", tutar=300, aciklama="Açılış farkı 2025", yedekten=True),     # başta: aday (bekliyor)
    MZ("mz", "2026-01-01", "2026-01-31"), R("ao", "acilis_olabilir", tarih="2026-01-31"), BIL("bil", "2026-01-31"),
], {"A": {
    "mz/satirlar/602.90/bakiye": -700, "mz/satirlar/519/bakiye": -300,
    "ao": [{"kaynak": "BY2", "cari": "C2", "yon": "borc", "tutar": 300, "tarih": "2026-01-04", "durum": "bekliyor"}],
    "bil/kesin_degil": ["ACILIS_OLABILIR_ONAY_BEKLIYOR", "TAMAMLANMAMIS_ACILIS"], "bil/pasif/V.F": 700, "bil/pasif/V.G": 300,
    "acilis_olabilir": ["BY2"], "redler": [],
}}, aciklama="S65: 'Açılış Olabilir' listesine yalnız açıklaması 'Açılış…' ile başlayan eski kayıt girer; ortada geçen sıradan Borç Yaz (602.90).")

# ------------------------------------------------------------------------------------------------ S99: S66 (formdan carisiz alınan evrakın karşılıksızı)
S("s99-s66-formdan-carisiz-evrak-karsiliksiz", ["S66", "S49", "S48", "Ç-07", "Ç-02", "M1c", "S1", "Q2"], [
    o("carisiz_evrak", "2026-03-10", id="CE1", evrak="CK1", evrak_turu="cek", yon="alinan", tutar=5000),
    o("carisiz_evrak", "2026-03-11", id="CE2", evrak="CK2", evrak_turu="cek", yon="alinan", tutar=2000),
    o("evrak_tahsile_ver", "2026-03-12", evrak="CK2", banka="B1"),
    o("evrak_karsiliksiz", "2026-03-20", id="KC1", evrak="CK1", cari="C1"),      # program cariyi sordu: C1 seçildi → cari borçlanır
    o("evrak_karsiliksiz", "2026-03-21", id="KC2", evrak="CK2"),                 # seçilmedi → B 649.90 / A 101.02 (S49 geliri geri alınır)
    MZ("mz", "2026-01-01", "2026-03-31"), GT("gt", "2026-01-01", "2026-03-31"),
    R("g1a", "gecikmis", cari="C1", tarih="2026-03-20"), R("g1b", "gecikmis", cari="C1", tarih="2026-03-21"),
    R("ak1", "acik_kalemler", cari="C1", tarih="2026-03-21"), R("hat", "hatirlatma", tarih="2026-03-31"),
], {"A": {
    # giriş: 649.90 −(5000 + 2000); KC1 B 120|C1 / A 101.01 5000; KC2 B 649.90 / A 101.02 2000 → 649.90 −5000
    "mz/satirlar/101.01/bakiye": 0, "mz/satirlar/101.02/bakiye": 0, "mz/satirlar/120|C1/bakiye": 5000, "mz/satirlar/649.90/bakiye": -5000,
    "mz/satirlar/770.90/bakiye": 0, "mz/satirlar/519/bakiye": 0,
    "gt/kalemler/F": 5000, "gt/kalemler/E": 0, "gt/kalemler/DNK": 5000,
    "g1a/gecikmis": 0, "g1b/gecikmis": 5000,
    "ak1": [{"k": "karsiliksiz:KC1", "tur": "karsiliksiz", "kalan": 5000, "vade": "2026-03-20", "tarih": "2026-03-20"}],
    "hat/otomatik": {"C1": 5000}, "hat/supheli_etiketli": [], "hat/elle": {},
    "redler": [],
}}, aciklama="S66: formdan carisiz (açılış değil) alınan evrak karşılıksız dönerse cari seçilirse cari borçlanır (Ç-07), seçilmezse B 649.90 / A 101.")

# ------------------------------------------------------------------------------------------------ S100: S68 (bizim bağsız ödememiz vadesi en önce gelen kalemi kapatır)
S("s100-s68-bagsiz-odeme-vade-sirasi", ["S68", "S2", "karar (1)", "T-05", "T-08", "T-09", "F-05", "C-02", "Q4"], [
    # T1: tedarikçiye ödeme — eski tarihli ama uzun vadeli A1 yerine vadesi önce gelen A2 kapanır
    o("alis_faturasi", "2026-01-05", id="A1", cari="T1", fatura_turu="gider", gider_turu="genel", M=1000, K=0, vade="2026-03-31"),
    o("alis_faturasi", "2026-02-01", id="A2", cari="T1", fatura_turu="gider", gider_turu="genel", M=600, K=0, vade="2026-02-15"),
    o("odeme", "2026-02-10", cari="T1", yol="havale", banka="B1", tutar=600),
    # C1: müşteriye iade bedeli (T-09) — iki alacak kalemi, vadesi önce gelen AY2 kapanır
    o("alacak_yaz", "2026-01-05", id="AY1", cari="C1", tutar=300, aciklama="İndirim", vade="2026-03-31"),
    o("alacak_yaz", "2026-02-01", id="AY2", cari="C1", tutar=200, aciklama="İade bedeli", vade="2026-02-10"),
    o("odeme", "2026-02-15", cari="C1", yol="nakit", tutar=200),
    # T2: ciro — müşteriden alınan çek tedarikçiye ciro edildi; vadesi önce gelen A4 kapanır
    o("alis_faturasi", "2026-01-05", id="A3", cari="T2", fatura_turu="gider", gider_turu="genel", M=800, K=0, vade="2026-04-30"),
    o("alis_faturasi", "2026-01-20", id="A4", cari="T2", fatura_turu="gider", gider_turu="genel", M=500, K=0, vade="2026-02-20"),
    o("tahsilat", "2026-01-10", cari="C3", yol="cek", evrak="CK7", tutar=500),
    o("odeme", "2026-02-01", cari="T2", yol="ciro", evrak="CK7"),
    R("ak1", "acik_kalemler", cari="T1", tarih="2026-02-11"), R("akc", "acik_kalemler", cari="C1", tarih="2026-02-16"),
    R("ak2", "acik_kalemler", cari="T2", tarih="2026-02-02"), MZ("mz", "2026-01-01", "2026-02-28"),
], {"A": {
    "ak1": [{"k": "fatura:A1", "tur": "fatura", "kalan": -1000, "vade": "2026-03-31", "tarih": "2026-01-05"}],
    "akc": [{"k": "alacak:AY1", "tur": "alacak_yaz", "kalan": -300, "vade": "2026-03-31", "tarih": "2026-01-05"}],
    "ak2": [{"k": "fatura:A3", "tur": "fatura", "kalan": -800, "vade": "2026-04-30", "tarih": "2026-01-05"}],
    # defter değişmez (kapama sırası defter olayı değil)
    "mz/satirlar/320|T1/bakiye": -1000, "mz/satirlar/320|T2/bakiye": -800, "mz/satirlar/120|C1/bakiye": -300, "mz/satirlar/120|C3/bakiye": -500,
    "mz/satirlar/770/bakiye": 2900, "mz/satirlar/770.90/bakiye": 500, "mz/satirlar/102.B1/bakiye": -600, "mz/satirlar/100/bakiye": -200,
    "mz/satirlar/101.01/bakiye": 0, "redler": [],
}}, aciklama="S68: bizim bağlamadan yaptığımız ödeme (tedarikçiye, iade bedeli, ciro) vadesi en önce gelen alacak kalemini kapatır — S2'nin simetriği.")

# ================================================================================================ kâhin bakımı 9 (S72, S73, S79; README P1–P9)
# Elle değerler model DEĞİŞTİRİLMEDEN ÖNCE yazıldı (ders 40). S74–S78 = C: senaryo yok (BİLİNEN SINIR, kâhin susar).

# ------------------------------------------------------------------------------------------------ S101: S72 (söz günü de otomatik listeye girmez)
S("s101-s72-soz-gunu", ["S72", "S52", "M1f", "G-5", "W12", "W13", "P1", "P4"], [
    o("satis_faturasi", "2026-02-01", id="F1", cari="C1", M=1000, K=0, vade="2026-03-01"),
    o("satis_faturasi", "2026-02-02", id="F2", cari="C2", M=800, K=0, vade="2026-03-01"),
    o("satis_faturasi", "2026-02-03", id="F3", cari="C3", M=500, K=0, vade="2026-03-01"),
    o("odeme_sozu", "2026-03-10", cari="C1", soz_tarihi="2026-03-19"),
    o("odeme_sozu", "2026-03-10", cari="C2", soz_tarihi="2026-03-20"),
    o("odeme_sozu", "2026-03-10", cari="C3", soz_tarihi="2026-03-21"),
    R("h10", "hatirlatma", tarih="2026-03-10"),    # sözlerin girildiği gün: üçü de etkin
    R("h20", "hatirlatma", tarih="2026-03-20"),    # C1 söz dün · C2 söz bugün · C3 söz yarın
    R("g2", "gecikmis", cari="C2", tarih="2026-03-20"),
    R("h21", "hatirlatma", tarih="2026-03-21"),    # C2 söz dün (ertesi gün) · C3 söz bugün
    R("h22", "hatirlatma", tarih="2026-03-22"),    # üç söz de geçti
    R("h24", "hatirlatma", tarih="2026-03-24"),
    o("odeme_sozu", "2026-03-25", cari="C1", soz_tarihi="2026-03-31"),   # söz geçtikten sonra yeni söz; söz günü ay sonu
    R("h25", "hatirlatma", tarih="2026-03-25"),    # yeni söz girildiği gün etkin
    R("h31", "hatirlatma", tarih="2026-03-31"),    # yeni sözün günü (ay sonu)
    R("h01", "hatirlatma", tarih="2026-04-01"),    # ertesi gün, ay dönümü
    MZ("mz", "2026-01-01", "2026-04-30"),
], {"A": {
    # gecikmiş (vade 01.03 < t): C1 1000, C2 800, C3 500 — söz değiştirmez (S52)
    "h10": _hat("2026-03-10", {}, {"C1": 1000, "C2": 800, "C3": 500}),
    # 20.03: C1 söz tarihi 19.03 geçti → girer; C2 söz günü → girmez (S72 A); C3 söz yarın → girmez
    "h20": _hat("2026-03-20", {"C1": 1000}, {"C2": 800, "C3": 500}),
    "g2": {"cari": "C2", "tarih": "2026-03-20", "gecikmis": 800, "supheli": 0, "detay": [{"kalem": "fatura:F2", "vade": "2026-03-01", "kalan": 800}]},
    "h21": _hat("2026-03-21", {"C1": 1000, "C2": 800}, {"C3": 500}),
    "h22": _hat("2026-03-22", {"C1": 1000, "C2": 800, "C3": 500}),
    "h24": _hat("2026-03-24", {"C1": 1000, "C2": 800, "C3": 500}),
    "h25": _hat("2026-03-25", {"C2": 800, "C3": 500}, {"C1": 1000}),
    "h31": _hat("2026-03-31", {"C2": 800, "C3": 500}, {"C1": 1000}),
    "h01": _hat("2026-04-01", {"C1": 1000, "C2": 800, "C3": 500}),
    # söz defter olayı değil (G-5)
    "mz/satirlar/120|C1/bakiye": 1000, "mz/satirlar/120|C2/bakiye": 800, "mz/satirlar/120|C3/bakiye": 500, "mz/satirlar/600/bakiye": -2300,
    "redler": [],
}}, aciklama="S72: Ödeme Sözü'nün günü de cari otomatik hatırlatma listesine girmez ('Ödeme Sözü Var'); söz geçince (ertesi gün) girer — söz dün / bugün / yarın, "
             "girildiği gün, ay sonu sözü ve ay dönümü.")

# ------------------------------------------------------------------------------------------------ S102: S73 (söz carinin bütün borcunu kapsar)
S("s102-s73-soz-butun-borc", ["S73", "S72", "S52", "S2", "M1f", "G-5", "T-01", "P2", "P4"], [
    o("satis_faturasi", "2026-02-01", id="F1", cari="C1", M=1000, K=0, vade="2026-03-01"),   # söz öncesi gecikmiş
    o("satis_faturasi", "2026-02-02", id="F2", cari="C1", M=400, K=0, vade="2026-03-15"),    # söz sırasında gecikir
    o("satis_faturasi", "2026-02-03", id="F5", cari="C1", M=300, K=0, vade="2026-04-05"),    # söz bittikten sonra gecikir
    o("satis_faturasi", "2026-02-04", id="F3", cari="C2", M=600, K=0, vade="2026-03-10"),    # vade = sözün girildiği gün (söz anında gecikmemiş)
    o("satis_faturasi", "2026-02-05", id="F4", cari="C2", M=200, K=0, vade="2026-03-01"),    # söz anında gecikmiş
    o("satis_faturasi", "2026-02-06", id="F6", cari="C3", M=100, K=0, vade="2026-03-01"),    # sözsüz cari
    o("odeme_sozu", "2026-03-10", cari="C1", soz_tarihi="2026-03-31"),
    o("odeme_sozu", "2026-03-10", cari="C2", soz_tarihi="2026-03-20"),
    R("h12", "hatirlatma", tarih="2026-03-12"),
    R("h16", "hatirlatma", tarih="2026-03-16"), R("g16", "gecikmis", cari="C1", tarih="2026-03-16"),
    o("tahsilat", "2026-03-18", cari="C1", yol="havale", banka="B1", tutar=1000),   # bağsız → S2: F1 kapanır; yalnız söz sırasında geciken F2 kalır
    R("h20", "hatirlatma", tarih="2026-03-20"),
    R("h21", "hatirlatma", tarih="2026-03-21"),
    R("h31", "hatirlatma", tarih="2026-03-31"),
    R("h01", "hatirlatma", tarih="2026-04-01"),
    R("h06", "hatirlatma", tarih="2026-04-06"), R("g06", "gecikmis", cari="C1", tarih="2026-04-06"),
    MZ("mz", "2026-01-01", "2026-04-30"),
], {"A": {
    # 12.03: C1 F1 1000 (F2 vadesi 15.03 gelmedi); C2 F4 200 + F3 600 (vade 10.03 < 12.03) = 800 — ikisi de söz kapsamında; C3 sözsüz 100
    "h12": _hat("2026-03-12", {"C3": 100}, {"C1": 1000, "C2": 800}),
    # 16.03: C1'de F2 söz sırasında gecikti → söz bütün borcu kapsar (S73 A), tutar 1000 + 400
    "h16": _hat("2026-03-16", {"C3": 100}, {"C1": 1400, "C2": 800}),
    "g16": {"cari": "C1", "tarih": "2026-03-16", "gecikmis": 1400, "supheli": 0,
            "detay": [{"kalem": "fatura:F1", "vade": "2026-03-01", "kalan": 1000}, {"kalem": "fatura:F2", "vade": "2026-03-15", "kalan": 400}]},
    # 20.03: C1'de yalnız söz sırasında geciken F2 400 kaldı — söz sürer; C2 söz günü (S72)
    "h20": _hat("2026-03-20", {"C3": 100}, {"C1": 400, "C2": 800}),
    "h21": _hat("2026-03-21", {"C2": 800, "C3": 100}, {"C1": 400}),
    "h31": _hat("2026-03-31", {"C2": 800, "C3": 100}, {"C1": 400}),
    # 01.04: C1 söz geçti → bütün gecikmiş borcuyla girer; 06.04: söz bittikten sonra geciken F5 de
    "h01": _hat("2026-04-01", {"C1": 400, "C2": 800, "C3": 100}),
    "h06": _hat("2026-04-06", {"C1": 700, "C2": 800, "C3": 100}),
    "g06": {"cari": "C1", "tarih": "2026-04-06", "gecikmis": 700, "supheli": 0,
            "detay": [{"kalem": "fatura:F2", "vade": "2026-03-15", "kalan": 400}, {"kalem": "fatura:F5", "vade": "2026-04-05", "kalan": 300}]},
    # söz defter olayı değil (G-5): 120|C1 = 1000 + 400 + 300 − 1000
    "mz/satirlar/120|C1/bakiye": 700, "mz/satirlar/120|C2/bakiye": 800, "mz/satirlar/120|C3/bakiye": 100, "mz/satirlar/102.B1/bakiye": 1000,
    "mz/satirlar/600/bakiye": -2600, "redler": [],
}}, aciklama="S73: Ödeme Sözü carinin bütün borcunu kapsar — söz öncesi ve söz sırasında geciken kalem söz bitene kadar cariyi otomatik listeye sokmaz; "
             "söz bitince cari bütün gecikmiş borcuyla (sonra geciken dahil) girer.")

# ------------------------------------------------------------------------------------------------ S103: S79 (olağan bağlı kayıtta aynı düzeltmede bağ + cari)
S("s103-s79-olagan-bag-cari", ["S79", "S57", "S54", "S45", "U2", "G-7", "C-03", "T-01", "T-05", "H-04", "M1e", "karar (1)", "karar (2)", "S2", "P5", "P6"], [
    o("kasa_acilis", "2026-01-01", id="KA", tutar=1000),
    o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-31"),
    o("satis_faturasi", "2026-01-06", id="F3", cari="C3", M=500, K=0, vade="2026-01-20"),
    o("satis_faturasi", "2026-01-06", id="F5", cari="C3", M=600, K=0, vade="2026-02-28"),
    o("taksit_karti", "2026-01-07", id="TK1", cari="C1", kaynak="yeni_borc", toplam=300, taksitler=[{"vade": "2026-02-01", "tutar": 300}]),
    o("taksit_karti", "2026-01-07", id="TK3", cari="C3", kaynak="yeni_borc", toplam=400, taksitler=[{"vade": "2026-02-01", "tutar": 400}]),
    o("alis_faturasi", "2026-01-05", id="A1", cari="T1", fatura_turu="gider", gider_turu="genel", M=1000, K=0, vade="2026-01-31"),
    o("alis_faturasi", "2026-01-05", id="A3", cari="T2", fatura_turu="gider", gider_turu="genel", M=800, K=0, vade="2026-02-28"),
    o("alis_faturasi", "2026-01-06", id="A4", cari="T2", fatura_turu="gider", gider_turu="genel", M=500, K=0, vade="2026-02-15"),
    # olağan (geri yüklenmemiş) bağlı kayıtlar
    o("tahsilat", "2026-01-10", id="PA", cari="C1", yol="havale", banka="B1", tutar=300, fatura="F1"),
    o("tahsilat", "2026-01-11", id="PB", cari="C1", yol="havale", banka="B1", tutar=200, fatura="F1"),
    o("tahsilat", "2026-01-12", id="PC", cari="C1", yol="havale", banka="B1", tutar=100, fatura="F1"),
    o("tahsilat", "2026-01-12", id="PD", cari="C1", yol="havale", banka="B1", tutar=50, fatura="F1"),
    o("tahsilat", "2026-01-13", id="PT", cari="C1", yol="havale", banka="B1", tutar=300, taksit_karti="TK1"),
    o("tahsilat", "2026-01-14", id="PK", cari="C1", yol="nakit", tutar=150, fatura="F1", yedekten=True),   # geri yüklenmiş ama açılıştan SONRA: olağan
    o("odeme", "2026-01-15", id="OA", cari="T1", yol="havale", banka="B1", tutar=400, fatura="A1"),
    R("g1a", "gecikmis", cari="C1", tarih="2026-02-02"), R("g3a", "gecikmis", cari="C3", tarih="2026-02-02"),
    R("akt2a", "acik_kalemler", cari="T2", tarih="2026-01-16"),
    o("duzenle", kaynak="PA", degisiklik={"cari": "C3", "fatura": "F5"}),                          # S79: yeni carinin (vadesi sonra gelen) faturasına
    o("duzenle", kaynak="PB", degisiklik={"cari": "C3", "fatura": None, "taksit_karti": "TK3"}),   # S79: yeni carinin kartına
    o("duzenle", kaynak="PC", degisiklik={"cari": "C2", "fatura": None}),                          # S79: bağ kaldırıldı + cari
    o("duzenle", kaynak="PD", degisiklik={"cari": "C3"}),                       # bağ değişmedi → S57 BAG_KALDIRILMALI
    o("duzenle", kaynak="PD", degisiklik={"cari": "C3", "fatura": "F1"}),       # aynı bağ yeniden yazıldı (değişmedi) → S57 BAG_KALDIRILMALI
    o("duzenle", kaynak="PT", degisiklik={"cari": "C3", "taksit_karti": None, "fatura": "F3"}),   # S79: kart bağından yeni carinin faturasına
    o("duzenle", kaynak="PK", degisiklik={"cari": "C3", "fatura": None, "tutar": 100, "aciklama": "doğru cari"}),   # S79 + tutar / açıklama (X10)
    o("duzenle", kaynak="OA", degisiklik={"cari": "T2", "fatura": "A3"}),       # S79 ödemede: yeni carinin (vadesi sonra gelen) alış faturasına
    MZ("mz", "2026-01-01", "2026-01-31"), R("mu", "mutabakat_uyarilari", tarih="2026-01-31"), R("mod", "moduller", tarih="2026-01-31"),
    R("g1b", "gecikmis", cari="C1", tarih="2026-02-02"), R("g3b", "gecikmis", cari="C3", tarih="2026-02-02"), R("g2b", "gecikmis", cari="C2", tarih="2026-02-02"),
    R("ak3", "acik_kalemler", cari="C3", tarih="2026-02-02"), R("kt3", "kartlar", cari="C3", tarih="2026-02-02"), R("kt1", "kartlar", cari="C1", tarih="2026-02-02"),
    R("akt1", "acik_kalemler", cari="T1", tarih="2026-01-16"), R("akt2", "acik_kalemler", cari="T2", tarih="2026-01-16"),
    R("hat", "hatirlatma", tarih="2026-02-02"),
], {"A": {
    # ÖNCE: F1 1000 − (300 + 200 + 100 + 50 + 150) = 200 açık (vade 31.01); TK1 taksiti PT ile kapalı → 02.02'de 200
    #       C3: F3 500 (vade 20.01) + TK3 400 (vade 01.02) = 900 gecikmiş (F5 vadesi 28.02); T2: A4 500, A3 800 açık
    "g1a/gecikmis": 200, "g3a/gecikmis": 900,
    "akt2a": [{"k": "fatura:A4", "tur": "fatura", "kalan": -500, "vade": "2026-02-15", "tarih": "2026-01-06"},
              {"k": "fatura:A3", "tur": "fatura", "kalan": -800, "vade": "2026-02-28", "tarih": "2026-01-05"}],
    "redler": ["BAG_KALDIRILMALI", "BAG_KALDIRILMALI"],
    # SONRA (kayıtlar kendi günlerinde yeni carileriyle yeniden türetilir, G-7):
    #   PA 300 → C3 F5 (bağ; bağsız olsaydı vadesi önce gelen F3 kapanırdı): F5 300 açık · PB 200 → C3 TK3: taksit 200 açık
    #   PT 300 → C3 F3: F3 200 · PK 100 (tutar düzeltildi) → C3 bağsız 14.01: S2 vadesi önce gelen F3 (20.01) → F3 100
    #   PC 100 → C2 bağsız (borcu yok → avans) · PD 50 C1'de F1'e bağlı kaldı · OA 400 → T2 A3 (bağ): A3 400, A4 500 açık; T1 A1 1000 açık
    #   C1: F1 1000 − 50 = 950 (vade 31.01) + TK1 300 yeniden açık (vade 01.02) → 02.02'de 1250
    # Kasa 100 = 1000 + 100; 102.B1 = 300 + 200 + 100 + 50 + 300 − 400 = 550
    "mz/satirlar/100/bakiye": 1100, "mz/satirlar/102.B1/bakiye": 550,
    "mz/satirlar/120|C1/bakiye": 1250, "mz/satirlar/120|C3/bakiye": 600, "mz/satirlar/120|C2/bakiye": -100,
    "mz/satirlar/320|T1/bakiye": -1000, "mz/satirlar/320|T2/bakiye": -900,
    "mz/satirlar/600/bakiye": -2100, "mz/satirlar/600.90/bakiye": -700, "mz/satirlar/770/bakiye": 2300, "mz/satirlar/519/bakiye": -1000,
    "mu": [], "mod/taksit_odenen|TK3": 200, "mod/taksit_odenen|TK1": 0,
    "g1b": {"cari": "C1", "tarih": "2026-02-02", "gecikmis": 1250, "supheli": 0,
            "detay": [{"kalem": "fatura:F1", "vade": "2026-01-31", "kalan": 950}, {"kalem": "kart:TK1", "vade": "2026-02-01", "kalan": 300}]},
    "g3b/gecikmis": 300, "g2b/gecikmis": 0,
    "ak3": [{"k": "fatura:F3", "tur": "fatura", "kalan": 100, "vade": "2026-01-20", "tarih": "2026-01-06"},
            {"k": "kart:TK3", "tur": "taksit", "kalan": 200, "vade": "2026-02-01", "tarih": "2026-01-07"},
            {"k": "fatura:F5", "tur": "fatura", "kalan": 300, "vade": "2026-02-28", "tarih": "2026-01-06"}],
    "kt3": {"TK3": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 400, "kalan": 200}]}},
    "kt1": {"TK1": {"kapali": False, "taksitler": [{"vade": "2026-02-01", "tutar": 300, "kalan": 300}]}},
    "akt1": [{"k": "fatura:A1", "tur": "fatura", "kalan": -1000, "vade": "2026-01-31", "tarih": "2026-01-05"}],
    "akt2": [{"k": "fatura:A4", "tur": "fatura", "kalan": -500, "vade": "2026-02-15", "tarih": "2026-01-06"},
             {"k": "fatura:A3", "tur": "fatura", "kalan": -400, "vade": "2026-02-28", "tarih": "2026-01-05"}],
    "hat": _hat("2026-02-02", {"C1": 1250, "C3": 300}),
}}, aciklama="S79: olağan bağlı kayıtta aynı düzeltmede bağ + cari S54 gibi kabul — bağ yeni carinin faturasına / kartına ya da kaldırılır (tahsilat ve ödeme); "
             "bağ değişmeden cari değişirse S57 red; geri yüklenmiş ama açılıştan sonra tarihli kayıt olağan.")

# ================================================================================================ kâhin bakımı 10 (S80, S81; README L1–L10)
# Elle değerler model DEĞİŞTİRİLMEDEN ÖNCE yazıldı (ders 40). Alış faturası formundaki peşin ödeme (L4) ve KS 2 / 3 durumları: senaryo yok (kâhin susar ya da karar dışı).

# ------------------------------------------------------------------------------------------------ S104: S80 (formdaki peşinin carisi düzeltilemez)
S("s104-s80-formdaki-pesin-cari", ["S80", "F-12", "F-14", "G-7", "S26", "S40", "S44", "S20", "T12", "B11", "X10", "L1", "L2", "L3"], [
    o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-31"),
    o("tahsilat", "2026-01-05", id="P1", cari="C1", yol="havale", banka="B1", tutar=300, fatura="F1", fatura_odemesi=True),   # formdaki peşin (olağan)
    o("satis_faturasi", "2026-01-06", id="F2", cari="C1", M=800, K=0, vade="2026-01-31"),
    o("kasa_acilis", "2026-01-08", id="KA", tutar=1000),
    o("tahsilat", "2026-01-06", id="P2", cari="C1", yol="nakit", tutar=200, fatura="F2", fatura_odemesi=True, yedekten=True),  # geri yüklenmiş, açılıştan önce
    o("satis_faturasi", "2026-01-07", id="F3", cari="C3", M=500, K=0, vade="2026-01-20"),
    R("g1a", "gecikmis", cari="C1", tarih="2026-02-01"), R("g3a", "gecikmis", cari="C3", tarih="2026-02-01"),
    o("duzenle", kaynak="P1", degisiklik={"cari": "C3"}),                              # S80: FATURA_DUZENLENMELI
    o("duzenle", kaynak="P1", degisiklik={"cari": "C3", "tutar": 250}),                # düzeltmenin TAMAMI red (tutar da yazılmaz)
    o("duzenle", kaynak="P1", degisiklik={"cari": "C3", "fatura": "F3"}),              # S79 formdaki peşine uygulanmaz: red
    o("duzenle", kaynak="P1", degisiklik={"cari": "C3", "fatura": None}),              # bağ kaldırılsa da red
    o("duzenle", kaynak="P1", degisiklik={"cari": "C3", "tarih": "2026-01-09"}),       # tarih de yazılmaz
    o("duzenle", kaynak="P2", degisiklik={"cari": "C3"}),                              # geri yüklenmiş, açılış öncesi (S40 yolu): red
    o("duzenle", kaynak="P2", degisiklik={"cari": "C3", "aciklama": "Yanlış cari"}),   # red (açıklama da yazılmaz)
    o("duzenle", kaynak="P2", degisiklik={"cari": "C3", "tarih": "2026-01-07"}),       # tarih açılıştan önceki başka güne: T12 önce → KASA_ACILIS_ONCE
    o("duzenle", kaynak="P2", degisiklik={"cari": "C3", "tarih": "2026-01-09"}),       # açılıştan sonraya alınsa da cari: red
    MZ("mz1", "2026-01-01", "2026-01-31"),
    o("duzenle", kaynak="P1", degisiklik={"tutar": 350, "aciklama": "Peşin düzeltme"}),   # carisi aynı: bugünkü kural (G-7) → kabul
    o("duzenle", kaynak="P2", degisiklik={"tutar": 250}),                              # S26 → kabul (uyarı sürer)
    o("duzenle", kaynak="P1", degisiklik={"cari": "C1", "aciklama": "Aynı cari"}),     # aynı cari: cari düzeltmesi değil → kabul
    MZ("mz2", "2026-01-01", "2026-01-31"),
    R("g1", "gecikmis", cari="C1", tarih="2026-02-01"), R("g3", "gecikmis", cari="C3", tarih="2026-02-01"),
    R("ak1", "acik_kalemler", cari="C1", tarih="2026-02-01"), R("mu", "mutabakat_uyarilari", tarih="2026-01-31"),
], {"A": {
    # ÖNCE: F1 1000 − P1 300 = 700, F2 800 − P2 200 = 600 (ikisi vade 31.01) → 01.02'de C1 1300; C3 F3 500 (vade 20.01)
    "g1a/gecikmis": 1300, "g3a/gecikmis": 500,
    "redler": ["FATURA_DUZENLENMELI"] * 7 + ["KASA_ACILIS_ONCE", "FATURA_DUZENLENMELI"],
    # redlerden sonra hiçbir şey değişmedi: 120|C1 = 1800 − 500 = 1300; 120|C3 500; Kasa 1000 + 200 = 1200; 102.B1 300
    "mz1/satirlar/120|C1/bakiye": 1300, "mz1/satirlar/120|C3/bakiye": 500, "mz1/satirlar/100/bakiye": 1200, "mz1/satirlar/102.B1/bakiye": 300,
    # kabul: P1 350 (F1 650 açık), P2 250 (F2 550 açık); 120|C1 = 1800 − 600 = 1200; Kasa 1250; 102.B1 350; C3 değişmez
    "mz2/satirlar/120|C1/bakiye": 1200, "mz2/satirlar/120|C3/bakiye": 500, "mz2/satirlar/100/bakiye": 1250, "mz2/satirlar/102.B1/bakiye": 350,
    "mz2/satirlar/600/bakiye": -2300,
    "g1/gecikmis": 1200, "g3/gecikmis": 500,
    "ak1": [{"k": "fatura:F1", "tur": "fatura", "kalan": 650, "vade": "2026-01-31", "tarih": "2026-01-05"},
            {"k": "fatura:F2", "tur": "fatura", "kalan": 550, "vade": "2026-01-31", "tarih": "2026-01-06"}],
    "mu": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "P2", "tarih": "2026-01-06", "acilis": "2026-01-08"}],
}}, aciklama="S80: fatura formunda alınan peşin tahsilatın carisi düzeltmeyle değiştirilemez — FATURA_DUZENLENMELI, düzeltmenin tamamı (olağan ve geri yüklenmiş "
             "açılış öncesi kayıtta; S79 uygulanmaz); carisi aynı peşinin tutarı / açıklaması bugünkü kuralla kabul.")

# ------------------------------------------------------------------------------------------------ S105: S81 (olağan düzeltmede Normal Cari sınırı)
S("s105-s81-olagan-normal-cari-siniri", ["S81", "S56", "S79", "S57", "T-13", "K3", "J-01", "§3.11b/2", "S14", "S25", "G-7", "L5", "L6", "L9"], [
    o("satis_faturasi", "2026-01-02", id="F6", cari="C2", M=19000, K=0, vade="2026-01-31"),
    o("supheliye_al", "2026-01-03", id="SA", cari="C2", tutar=9000),                   # C2: 128 9000, 120 10000
    o("satis_faturasi", "2026-01-04", id="F7", cari="C3", M=5000, K=0, vade="2026-01-31"),
    o("supheliye_al", "2026-01-05", id="SB", cari="C3", tutar=4000),                   # C3: 128 4000, 120 1000 (F7 kısmen aktarıldı)
    o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=40000, K=0, vade="2026-01-31"),
    o("tahsilat", "2026-01-10", id="PA", cari="C1", yol="havale", banka="B1", tutar=10001, fatura="F1"),
    o("tahsilat", "2026-01-10", id="PB", cari="C1", yol="havale", banka="B1", tutar=9999, fatura="F1"),
    o("tahsilat", "2026-01-11", id="PC", cari="C1", yol="havale", banka="B1", tutar=1, fatura="F1"),
    o("tahsilat", "2026-01-11", id="PD", cari="C1", yol="havale", banka="B1", tutar=5000, fatura="F1"),
    o("tahsilat", "2026-01-12", id="PN", cari="C1", yol="havale", banka="B1", tutar=500, normal_cari=True),   # bağsız, Normal Cari seçili (C1'de şüpheli yok)
    o("tahsilat", "2026-01-12", id="PK", cari="C2", yol="havale", banka="B1", tutar=300),    # C2'nin kendi tahsilatı: K3 → 128'den
    MZ("mz0", "2026-01-01", "2026-01-31"),
    o("duzenle", kaynak="PA", degisiklik={"cari": "C2", "fatura": None, "normal_cari": True}),                      # 10001 > 10000: bir kuruş üstü → red
    o("duzenle", kaynak="PA", degisiklik={"cari": "C2", "fatura": None, "normal_cari": True, "aciklama": "x"}),     # düzeltmenin TAMAMI red
    o("duzenle", kaynak="PA", degisiklik={"cari": "C2"}),                              # bağ değişmedi → S57 BAG_KALDIRILMALI önce
    MZ("mz1", "2026-01-01", "2026-01-31"),
    o("duzenle", kaynak="PB", degisiklik={"cari": "C2", "fatura": None, "normal_cari": True}),   # 9999 < 10000: bir kuruş altı → kabul (120|C2 1)
    o("duzenle", kaynak="PC", degisiklik={"cari": "C2", "fatura": None, "normal_cari": True}),   # 1 = 1: eşit → kabul (120|C2 0)
    o("duzenle", kaynak="PD", degisiklik={"cari": "C3", "fatura": "F7"}),             # fatura bağı: 4000 128'den (S25 a), 120'de kapanan 1000 = 1000 → kabul
    o("duzenle", kaynak="PN", degisiklik={"cari": "C2"}),                             # bağsız Normal Cari kaydı şüpheli cariye: 500 > 0 → red
    o("duzenle", kaynak="PK", degisiklik={"normal_cari": True}),                      # aynı cari (U5 boşluğu, L5 iii): 300 > 0 → red
    MZ("mz2", "2026-01-01", "2026-01-31"),
    R("g1", "gecikmis", cari="C1", tarih="2026-02-01"), R("g2", "gecikmis", cari="C2", tarih="2026-02-01"), R("g3", "gecikmis", cari="C3", tarih="2026-02-01"),
    R("ak2", "acik_kalemler", cari="C2", tarih="2026-02-01"),
], {"A": {
    # ÖNCE: 120|C1 = 40000 − (10001 + 9999 + 1 + 5000 + 500) = 14499; C2 120 10000, 128 9000 − 300 (PK) = 8700; C3 120 1000, 128 4000; 102.B1 25801
    "mz0/satirlar/120|C1/bakiye": 14499, "mz0/satirlar/120|C2/bakiye": 10000, "mz0/satirlar/128|C2/bakiye": 8700,
    "mz0/satirlar/120|C3/bakiye": 1000, "mz0/satirlar/128|C3/bakiye": 4000, "mz0/satirlar/102.B1/bakiye": 25801,
    "redler": ["SUPHELI_NORMAL_ASIM", "SUPHELI_NORMAL_ASIM", "BAG_KALDIRILMALI", "SUPHELI_NORMAL_ASIM", "SUPHELI_NORMAL_ASIM"],
    # ilk üç redden sonra hiçbir şey değişmedi
    "mz1/satirlar/120|C1/bakiye": 14499, "mz1/satirlar/120|C2/bakiye": 10000, "mz1/satirlar/128|C2/bakiye": 8700,
    # SONRA: PB 9999 + PC 1 C2'nin 120'sine (F6'nın 120'deki 10000'i kapandı) → 120|C2 0; PD C3'te F7'yi kapattı: 128|C3 0, 120|C3 0;
    #        PN, PK red (değişmedi): 120|C1 = 40000 − PA 10001 − PN 500 = 29499; 128|C2 8700
    "mz2/satirlar/120|C1/bakiye": 29499, "mz2/satirlar/120|C2/bakiye": 0, "mz2/satirlar/128|C2/bakiye": 8700,
    "mz2/satirlar/120|C3/bakiye": 0, "mz2/satirlar/128|C3/bakiye": 0, "mz2/satirlar/102.B1/bakiye": 25801,
    "g1/gecikmis": 29499, "g2/gecikmis": 0, "g2/supheli": 8700, "g3/gecikmis": 0, "g3/supheli": 0,
    "ak2": [],
}}, aciklama="S81: olağan tahsilatın düzeltmesi kaydı şüpheli kaydı açık bir carinin 120'sine (Normal Cari ya da fatura bağı) alıp 120 bakiyesini aşarsa "
             "SUPHELI_NORMAL_ASIM, tamamı; bir kuruş altı ve eşitlik kabul; fatura bağında 128'den düşen kısım sayılmaz; bağsız kaydın carisi ve aynı carinin seçimi de.")

# ------------------------------------------------------------------------------------------------ S106: S83 (alış faturası formundaki peşin ödemenin carisi)
S("s106-s83-alis-formundaki-pesin-odeme-cari", ["S83", "S80", "F-12", "F-14", "G-7", "T-05", "S26", "S40", "S20", "T12", "B11", "X10", "Ö1", "Ö2"], [
    o("kasa_acilis", "2026-01-08", id="KA", tutar=1000),
    o("alis_faturasi", "2026-01-06", id="A2", cari="T1", fatura_turu="gider", gider_turu="genel", M=800, K=0, vade="2026-01-31"),
    o("odeme", "2026-01-06", id="O2", cari="T1", yol="nakit", tutar=200, fatura="A2", fatura_odemesi=True, yedekten=True),   # geri yüklenmiş, açılıştan önce
    o("alis_faturasi", "2026-01-09", id="A1", cari="T1", fatura_turu="gider", gider_turu="genel", M=1000, K=0, vade="2026-01-31"),
    o("odeme", "2026-01-09", id="O1", cari="T1", yol="nakit", tutar=300, fatura="A1", fatura_odemesi=True),   # alış faturası formundaki peşin (olağan)
    o("alis_faturasi", "2026-01-10", id="A3", cari="T2", fatura_turu="gider", gider_turu="genel", M=500, K=0, vade="2026-01-20"),
    MZ("mz0", "2026-01-01", "2026-01-31"), R("ak1a", "acik_kalemler", cari="T1", tarih="2026-02-01"),
    o("duzenle", kaynak="O1", degisiklik={"cari": "T2"}),                              # S83: FATURA_DUZENLENMELI (tek başına)
    o("duzenle", kaynak="O1", degisiklik={"cari": "T2", "tutar": 250}),                # düzeltmenin TAMAMI red (tutar da yazılmaz)
    o("duzenle", kaynak="O1", degisiklik={"cari": "T2", "fatura": "A3"}),              # S79 formdaki peşin ödemeye uygulanmaz: red
    o("duzenle", kaynak="O1", degisiklik={"cari": "T2", "fatura": None}),              # bağ kaldırılsa da red
    o("duzenle", kaynak="O1", degisiklik={"cari": "T2", "tarih": "2026-01-12"}),       # tarih de yazılmaz
    o("duzenle", kaynak="O2", degisiklik={"cari": "T2"}),                              # geri yüklenmiş, açılış öncesi (S40 yolu): red
    o("duzenle", kaynak="O2", degisiklik={"cari": "T2", "aciklama": "Yanlış cari"}),   # red (açıklama da yazılmaz)
    o("duzenle", kaynak="O2", degisiklik={"cari": "T2", "tarih": "2026-01-07"}),       # tarih açılıştan önceki başka güne: T12 önce → KASA_ACILIS_ONCE
    o("duzenle", kaynak="O2", degisiklik={"cari": "T2", "tarih": "2026-01-09"}),       # açılıştan sonraya alınsa da cari: red
    MZ("mz1", "2026-01-01", "2026-01-31"), R("ak2b", "acik_kalemler", cari="T2", tarih="2026-02-01"),
    o("duzenle", kaynak="O1", degisiklik={"tutar": 350, "aciklama": "Peşin düzeltme"}),   # carisi aynı: bugünkü kural (G-7) → kabul
    o("duzenle", kaynak="O2", degisiklik={"tutar": 250}),                              # S26 → kabul (uyarı sürer)
    o("duzenle", kaynak="O1", degisiklik={"cari": "T1", "aciklama": "Aynı cari"}),     # aynı cari: cari düzeltmesi değil → kabul
    MZ("mz2", "2026-01-01", "2026-01-31"),
    R("ak1", "acik_kalemler", cari="T1", tarih="2026-02-01"), R("ak2", "acik_kalemler", cari="T2", tarih="2026-02-01"),
    R("mu", "mutabakat_uyarilari", tarih="2026-01-31"),
], {"A": {
    # ÖNCE: 320|T1 = −(800 + 1000) + 200 + 300 = −1300; 320|T2 −500; Kasa 1000 − 200 − 300 = 500. A2 800 − 200 = 600, A1 1000 − 300 = 700 açık (ikisi vade 31.01)
    "mz0/satirlar/320|T1/bakiye": -1300, "mz0/satirlar/320|T2/bakiye": -500, "mz0/satirlar/100/bakiye": 500,
    "ak1a": [{"k": "fatura:A2", "tur": "fatura", "kalan": -600, "vade": "2026-01-31", "tarih": "2026-01-06"},
             {"k": "fatura:A1", "tur": "fatura", "kalan": -700, "vade": "2026-01-31", "tarih": "2026-01-09"}],
    "redler": ["FATURA_DUZENLENMELI"] * 7 + ["KASA_ACILIS_ONCE", "FATURA_DUZENLENMELI"],
    # redlerden sonra hiçbir şey değişmedi; A3 (T2) açık 500
    "mz1/satirlar/320|T1/bakiye": -1300, "mz1/satirlar/320|T2/bakiye": -500, "mz1/satirlar/100/bakiye": 500,
    "ak2b": [{"k": "fatura:A3", "tur": "fatura", "kalan": -500, "vade": "2026-01-20", "tarih": "2026-01-10"}],
    # kabul: O1 350 (A1 650 açık), O2 250 (A2 550 açık); 320|T1 = −1800 + 600 = −1200; Kasa 1000 − 250 − 350 = 400; T2 değişmez
    "mz2/satirlar/320|T1/bakiye": -1200, "mz2/satirlar/320|T2/bakiye": -500, "mz2/satirlar/100/bakiye": 400,
    "ak1": [{"k": "fatura:A2", "tur": "fatura", "kalan": -550, "vade": "2026-01-31", "tarih": "2026-01-06"},
            {"k": "fatura:A1", "tur": "fatura", "kalan": -650, "vade": "2026-01-31", "tarih": "2026-01-09"}],
    "ak2": [{"k": "fatura:A3", "tur": "fatura", "kalan": -500, "vade": "2026-01-20", "tarih": "2026-01-10"}],
    "mu": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "O2", "tarih": "2026-01-06", "acilis": "2026-01-08"}],
}}, aciklama="S83: alış faturası formunda yapılan peşin ödemenin carisi düzeltmeyle değişmez — S80 ile aynı FATURA_DUZENLENMELI, düzeltmenin tamamı (olağan ve "
             "geri yüklenmiş açılış öncesi kayıtta; S79 uygulanmaz; T12 önce); carisi aynı peşin ödemenin tutarı / açıklaması bugünkü kuralla kabul.")

# ------------------------------------------------------------------------------------------------ S107: S84 (formdaki peşinin bağı, cari aynı)
S("s107-s84-formdaki-pesin-bagi", ["S84", "S80", "S83", "F-12", "F-14", "G-7", "T-01", "T-05", "H-04", "M1e", "S26", "S44", "S20", "T12", "B11", "Ö4", "Ö5"], [
    o("kasa_acilis", "2026-01-08", id="KA", tutar=1000),
    o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-31"),
    o("tahsilat", "2026-01-05", id="P1", cari="C1", yol="havale", banka="B1", tutar=300, fatura="F1", fatura_odemesi=True),   # formdaki peşin (olağan)
    o("satis_faturasi", "2026-01-06", id="F2", cari="C1", M=800, K=0, vade="2026-01-31"),
    o("tahsilat", "2026-01-06", id="P2", cari="C1", yol="nakit", tutar=200, fatura="F2", fatura_odemesi=True, yedekten=True),  # geri yüklenmiş, açılıştan önce
    o("satis_faturasi", "2026-01-07", id="F4", cari="C1", M=400, K=0, vade="2026-01-15"),
    o("taksit_karti", "2026-01-07", id="TK1", cari="C1", kaynak="yeni_borc", toplam=100, taksitler=[{"vade": "2026-02-10", "tutar": 100}]),
    o("alis_faturasi", "2026-01-09", id="A1", cari="T1", fatura_turu="gider", gider_turu="genel", M=1000, K=0, vade="2026-01-31"),
    o("odeme", "2026-01-09", id="O1", cari="T1", yol="nakit", tutar=300, fatura="A1", fatura_odemesi=True),   # alış faturası formundaki peşin (olağan)
    o("alis_faturasi", "2026-01-10", id="A4", cari="T1", fatura_turu="gider", gider_turu="genel", M=600, K=0, vade="2026-01-20"),
    MZ("mz0", "2026-01-01", "2026-01-31"), R("g1a", "gecikmis", cari="C1", tarih="2026-02-01"),
    o("duzenle", kaynak="P1", degisiklik={"fatura": "F4"}),                            # S84: başka faturaya → FATURA_DUZENLENMELI
    o("duzenle", kaynak="P1", degisiklik={"fatura": None}),                            # bağ kaldırılır → red
    o("duzenle", kaynak="P1", degisiklik={"fatura": None, "taksit_karti": "TK1"}),     # taksit kartına çevrilir → red
    o("duzenle", kaynak="P1", degisiklik={"fatura": "F4", "tutar": 250, "aciklama": "x"}),   # düzeltmenin TAMAMI red
    o("duzenle", kaynak="P1", degisiklik={"fatura": "F4", "cari": "C1"}),              # cari aynı yazılmış: yine S84 → red
    o("duzenle", kaynak="P1", degisiklik={"fatura": None, "tarih": "2026-01-09"}),     # tarih de yazılmaz
    o("duzenle", kaynak="P2", degisiklik={"fatura": "F4"}),                            # geri yüklenmiş, açılış öncesi (S44 yolu): red (V3 (e) susması kalktı)
    o("duzenle", kaynak="P2", degisiklik={"fatura": None}),                            # red
    o("duzenle", kaynak="P2", degisiklik={"fatura": "F4", "tarih": "2026-01-07"}),     # tarih açılıştan önceki başka güne: T12 önce → KASA_ACILIS_ONCE
    o("duzenle", kaynak="P2", degisiklik={"fatura": None, "tarih": "2026-01-09"}),     # açılıştan sonraya alınsa da bağ: red
    o("duzenle", kaynak="O1", degisiklik={"fatura": "A4"}),                            # ödeme yönü (alış formundaki peşin, Ö4): red
    o("duzenle", kaynak="O1", degisiklik={"fatura": None}),                            # red
    MZ("mz1", "2026-01-01", "2026-01-31"), R("g1", "gecikmis", cari="C1", tarih="2026-02-01"),
    R("ak1", "acik_kalemler", cari="C1", tarih="2026-02-01"), R("akt1", "acik_kalemler", cari="T1", tarih="2026-02-01"),
    o("duzenle", kaynak="P1", degisiklik={"fatura": "F1", "aciklama": "Aynı fatura"}),   # aynı bağ yeniden yazıldı: değişiklik değil → kabul
    o("duzenle", kaynak="P2", degisiklik={"fatura": "F2", "tutar": 250}),              # aynı bağ + S26 tutarı → kabul (uyarı sürer)
    o("duzenle", kaynak="O1", degisiklik={"fatura": "A1", "tutar": 350}),              # aynı bağ + tutar (G-7) → kabul
    MZ("mz2", "2026-01-01", "2026-01-31"), R("g2", "gecikmis", cari="C1", tarih="2026-02-01"),
    R("ak2", "acik_kalemler", cari="C1", tarih="2026-02-01"), R("akt2", "acik_kalemler", cari="T1", tarih="2026-02-01"),
    R("mu", "mutabakat_uyarilari", tarih="2026-01-31"),
], {"A": {
    # ÖNCE: 120|C1 = 1000 + 800 + 400 + 100 − 300 − 200 = 1800; Kasa 1000 + 200 − 300 = 900; 102.B1 300; 320|T1 = −1600 + 300 = −1300
    "mz0/satirlar/120|C1/bakiye": 1800, "mz0/satirlar/100/bakiye": 900, "mz0/satirlar/102.B1/bakiye": 300, "mz0/satirlar/320|T1/bakiye": -1300,
    # 01.02'de gecikmiş (vade < 01.02): F1 700 + F2 600 + F4 400 = 1700 (TK1 taksidi 10.02)
    "g1a/gecikmis": 1700,
    "redler": ["FATURA_DUZENLENMELI"] * 8 + ["KASA_ACILIS_ONCE"] + ["FATURA_DUZENLENMELI"] * 3,
    # redlerden sonra hiçbir şey değişmedi (bağlar aynı: F4 400, F1 700, F2 600, TK1 100 açık; A4 600, A1 700 açık)
    "mz1/satirlar/120|C1/bakiye": 1800, "mz1/satirlar/100/bakiye": 900, "mz1/satirlar/102.B1/bakiye": 300, "mz1/satirlar/320|T1/bakiye": -1300,
    "g1/gecikmis": 1700,
    "ak1": [{"k": "fatura:F4", "tur": "fatura", "kalan": 400, "vade": "2026-01-15", "tarih": "2026-01-07"},
            {"k": "fatura:F1", "tur": "fatura", "kalan": 700, "vade": "2026-01-31", "tarih": "2026-01-05"},
            {"k": "fatura:F2", "tur": "fatura", "kalan": 600, "vade": "2026-01-31", "tarih": "2026-01-06"},
            {"k": "kart:TK1", "tur": "taksit", "kalan": 100, "vade": "2026-02-10", "tarih": "2026-01-07"}],
    "akt1": [{"k": "fatura:A4", "tur": "fatura", "kalan": -600, "vade": "2026-01-20", "tarih": "2026-01-10"},
             {"k": "fatura:A1", "tur": "fatura", "kalan": -700, "vade": "2026-01-31", "tarih": "2026-01-09"}],
    # kabul: P2 250 (F2 550 açık), O1 350 (A1 650 açık); 120|C1 1750; Kasa 1000 + 250 − 350 = 900; 320|T1 = −1600 + 350 = −1250
    "mz2/satirlar/120|C1/bakiye": 1750, "mz2/satirlar/100/bakiye": 900, "mz2/satirlar/102.B1/bakiye": 300, "mz2/satirlar/320|T1/bakiye": -1250,
    "g2/gecikmis": 1650,
    "ak2": [{"k": "fatura:F4", "tur": "fatura", "kalan": 400, "vade": "2026-01-15", "tarih": "2026-01-07"},
            {"k": "fatura:F1", "tur": "fatura", "kalan": 700, "vade": "2026-01-31", "tarih": "2026-01-05"},
            {"k": "fatura:F2", "tur": "fatura", "kalan": 550, "vade": "2026-01-31", "tarih": "2026-01-06"},
            {"k": "kart:TK1", "tur": "taksit", "kalan": 100, "vade": "2026-02-10", "tarih": "2026-01-07"}],
    "akt2": [{"k": "fatura:A4", "tur": "fatura", "kalan": -600, "vade": "2026-01-20", "tarih": "2026-01-10"},
             {"k": "fatura:A1", "tur": "fatura", "kalan": -650, "vade": "2026-01-31", "tarih": "2026-01-09"}],
    "mu": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "P2", "tarih": "2026-01-06", "acilis": "2026-01-08"}],
}}, aciklama="S84: formdaki peşinin carisi aynı kalıp bağı (başka fatura, kaldırma, taksit kartı) değiştirilmek istenirse FATURA_DUZENLENMELI, düzeltmenin tamamı — "
             "olağan ve geri yüklenmiş açılış öncesi kayıtta, tahsilat ve alış formundaki ödemede; T12 önce; aynı bağın yeniden yazılması değişiklik değil.")

# ------------------------------------------------------------------------------------------------ S108: S85 (Normal Cari kaydın yalnız tutar / tarih düzeltmesi, olağan)
S("s108-s85-normal-cari-tutar-tarih", ["S85", "S56", "S81", "K10-3", "T-13", "K3", "J-01", "H-03", "H-04", "M1e", "§3.11b/2", "G-7", "Ö7", "Ö9"], [
    o("satis_faturasi", "2026-01-02", id="F6", cari="C2", M=1000, K=0, vade="2026-01-31"),
    o("supheliye_al", "2026-01-03", id="SA", cari="C2", tutar=900),                    # C2: 128 900, 120 100
    o("satis_faturasi", "2026-01-04", id="F7", cari="C3", M=1000, K=0, vade="2026-01-31"),
    o("supheliye_al", "2026-01-05", id="SB", cari="C3", tutar=800),                    # C3: 128 800, 120 200
    o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=500, K=0, vade="2026-01-31"),
    o("tahsilat", "2026-01-07", id="PC1", cari="C1", yol="havale", banka="B1", tutar=100, normal_cari=True),   # C1'de şüpheli kaydı yok
    o("tahsilat", "2026-01-10", id="PN", cari="C2", yol="havale", banka="B1", tutar=50, normal_cari=True),     # C2: 120 50
    o("tahsilat", "2026-01-11", id="PK", cari="C2", yol="havale", banka="B1", tutar=300),                      # Normal Cari değil: K3 → 128'den (600)
    o("taksit_karti", "2026-01-12", id="TK3", cari="C3", kaynak="yeni_borc", toplam=300, taksitler=[{"vade": "2026-02-12", "tutar": 300}]),   # C3: 120 500
    o("tahsilat", "2026-01-16", id="PT", cari="C3", yol="havale", banka="B1", tutar=300, normal_cari=True),    # 300 ≤ 500 → C3: 120 200
    o("tahsilat", "2026-01-18", id="PKT", cari="C3", yol="havale", banka="B1", tutar=250, taksit_karti="TK3"), # kart (12.01) SB'den sonra → 120; C3: 120 −50
    MZ("mz0", "2026-01-01", "2026-01-31"),
    o("duzenle", kaynak="PN", degisiklik={"tutar": 101}),                              # 101 > 100 (PN hariç 10.01'de 120|C2): bir kuruş üstü → red
    o("duzenle", kaynak="PN", degisiklik={"tutar": 99, "aciklama": "Düzeltme"}),       # bir kuruş altı (açıklama birlikte) → kabul (120|C2 1)
    o("duzenle", kaynak="PN", degisiklik={"tutar": 100}),                              # eşit → kabul (120|C2 0)
    o("duzenle", kaynak="PK", degisiklik={"tutar": 400}),                              # Normal Cari değil: S85 dışı → kabul (K3: 128 500)
    o("duzenle", kaynak="PC1", degisiklik={"tutar": 500}),                             # şüpheli kaydı olmayan cari → kabul (120|C1 0)
    MZ("mz1", "2026-01-01", "2026-01-31"),
    o("duzenle", kaynak="PT", degisiklik={"tarih": "2026-01-10"}),                     # geri: 10.01'de 120|C3 (PT hariç) 200 < 300 → red
    o("duzenle", kaynak="PT", degisiklik={"tarih": "2026-01-19"}),                     # ileri: 19.01'de 120|C3 (PT hariç) 500 − 250 = 250 < 300 → red
    MZ("mz2", "2026-01-01", "2026-01-31"),
    o("duzenle", kaynak="PT", degisiklik={"tarih": "2026-01-13"}),                     # 13.01'de 500 → kabul
    o("duzenle", kaynak="PT", degisiklik={"tarih": "2026-01-19", "tutar": 250}),       # yeni günde 250 = 250 → kabul (sınır yeni günde, K10-3)
    MZ("mz3", "2026-01-01", "2026-01-31"),
    R("g2", "gecikmis", cari="C2", tarih="2026-02-01"), R("g3", "gecikmis", cari="C3", tarih="2026-02-15"),
    R("ak2", "acik_kalemler", cari="C2", tarih="2026-02-01"), R("ak3", "acik_kalemler", cari="C3", tarih="2026-02-15"),
], {"A": {
    # ÖNCE: 120|C2 = 1000 − 900 − 50 = 50, 128|C2 = 900 − 300 = 600; 120|C3 = 1000 − 800 + 300 − 300 − 250 = −50, 128|C3 800; 120|C1 400; 102.B1 = 100 + 50 + 300 + 300 + 250
    "mz0/satirlar/120|C2/bakiye": 50, "mz0/satirlar/128|C2/bakiye": 600, "mz0/satirlar/120|C3/bakiye": -50, "mz0/satirlar/128|C3/bakiye": 800,
    "mz0/satirlar/120|C1/bakiye": 400, "mz0/satirlar/102.B1/bakiye": 1000,
    "redler": ["SUPHELI_NORMAL_ASIM"] * 3,
    # SONRA (C2 / C1): PN 100 → 120|C2 0; PK 400 → 128|C2 500; PC1 500 → 120|C1 0; 102.B1 = 500 + 100 + 400 + 300 + 250 = 1550
    "mz1/satirlar/120|C2/bakiye": 0, "mz1/satirlar/128|C2/bakiye": 500, "mz1/satirlar/120|C1/bakiye": 0, "mz1/satirlar/102.B1/bakiye": 1550,
    # iki tarih reddinden sonra C3 değişmedi
    "mz2/satirlar/120|C3/bakiye": -50, "mz2/satirlar/128|C3/bakiye": 800, "mz2/satirlar/102.B1/bakiye": 1550,
    # SONRA (C3): PT 250 (19.01): 120|C3 = 1000 − 800 + 300 − 250 − 250 = 0; 102.B1 = 500 + 100 + 400 + 250 + 250 = 1500
    "mz3/satirlar/120|C3/bakiye": 0, "mz3/satirlar/128|C3/bakiye": 800, "mz3/satirlar/120|C2/bakiye": 0, "mz3/satirlar/128|C2/bakiye": 500,
    "mz3/satirlar/102.B1/bakiye": 1500,
    # F6'nın 120'deki 100'ü PN ile kapandı; F7'nin 120'deki 200'ü ve TK3 taksidi (PKT 250 + PT 50) kapandı
    "g2/gecikmis": 0, "g2/supheli": 500, "g3/gecikmis": 0, "g3/supheli": 800,
    "ak2": [], "ak3": [],
}}, aciklama="S85: şüpheli kaydı açık caride Normal Cari Hesaba İşle'li kaydın yalnız tutarı / tarihi düzeltilip 120 bakiyesi aşılırsa SUPHELI_NORMAL_ASIM (S56 ölçüsü; "
             "bir kuruş üstü red, altı ve eşitlik kabul); tarih değişirse sınır yeni günde (geri ve ileri red, aradaki gün kabul); Normal Cari olmayan ve şüphelisiz carinin kaydı kabul.")

# ------------------------------------------------------------------------------------------------ S109: S85 (geri yüklenmiş, açılış öncesi Kasa kaydı — S26 tutarı, S40 yalnız cari)
S("s109-s85-geri-yuklenmis-cari-tutar", ["S85", "S56", "S40", "S26", "S20", "T-13", "K3", "J-01", "§3.11b/2", "G-7", "Ö7", "Ö8", "Ö9"], [
    o("kasa_acilis", "2026-01-20", id="KA", tutar=1000),
    o("satis_faturasi", "2026-01-02", id="F6", cari="C2", M=1000, K=0, vade="2026-01-31"),
    o("supheliye_al", "2026-01-03", id="SA", cari="C2", tutar=900),                    # C2: 128 900, 120 100
    o("satis_faturasi", "2026-01-04", id="F1", cari="C1", M=500, K=0, vade="2026-01-31"),
    o("satis_faturasi", "2026-01-05", id="F7", cari="C3", M=1000, K=0, vade="2026-01-31"),
    o("supheliye_al", "2026-01-06", id="SB", cari="C3", tutar=920),                    # C3: 128 920, 120 80
    o("tahsilat", "2026-01-08", id="PH", cari="C2", yol="nakit", tutar=20, normal_cari=True, yedekten=True),    # geri yüklenmiş, açılıştan önce
    o("tahsilat", "2026-01-10", id="PG1", cari="C1", yol="nakit", tutar=90, normal_cari=True, yedekten=True),
    o("tahsilat", "2026-01-12", id="PG2", cari="C1", yol="nakit", tutar=80, normal_cari=True, yedekten=True),
    MZ("mz0", "2026-01-01", "2026-01-31"),
    o("duzenle", kaynak="PH", degisiklik={"tutar": 101}),                              # S26 tutarı: 101 > 100 (PH hariç 08.01'de 120|C2) → red
    o("duzenle", kaynak="PH", degisiklik={"tutar": 101, "aciklama": "x"}),             # düzeltmenin TAMAMI red
    o("duzenle", kaynak="PG1", degisiklik={"cari": "C3"}),                             # S40 yalnız cari: 90 > 80 (10.01'de 120|C3) → red
    o("duzenle", kaynak="PG1", degisiklik={"cari": "C3", "aciklama": "Yanlış cari"}),  # red (açıklama da yazılmaz)
    MZ("mz1", "2026-01-01", "2026-01-31"),
    o("duzenle", kaynak="PH", degisiklik={"tutar": 99}),                               # bir kuruş altı → kabul (120|C2 1)
    o("duzenle", kaynak="PH", degisiklik={"tutar": 100}),                              # eşit → kabul (120|C2 0)
    o("duzenle", kaynak="PG2", degisiklik={"cari": "C3"}),                             # 80 = 80 → kabul (120|C3 0)
    o("duzenle", kaynak="PG1", degisiklik={"tutar": 95}),                              # C1'de şüpheli kaydı yok → kabul
    MZ("mz2", "2026-01-01", "2026-01-31"),
    R("g1", "gecikmis", cari="C1", tarih="2026-02-01"), R("g2", "gecikmis", cari="C2", tarih="2026-02-01"), R("g3", "gecikmis", cari="C3", tarih="2026-02-01"),
    R("mu", "mutabakat_uyarilari", tarih="2026-01-31"),
], {"A": {
    # ÖNCE: 120|C2 = 1000 − 900 − 20 = 80; 120|C3 = 1000 − 920 = 80; 120|C1 = 500 − 90 − 80 = 330; Kasa 1000 + 20 + 90 + 80 = 1190
    "mz0/satirlar/120|C2/bakiye": 80, "mz0/satirlar/128|C2/bakiye": 900, "mz0/satirlar/120|C3/bakiye": 80, "mz0/satirlar/128|C3/bakiye": 920,
    "mz0/satirlar/120|C1/bakiye": 330, "mz0/satirlar/100/bakiye": 1190,
    "redler": ["SUPHELI_NORMAL_ASIM"] * 4,
    "mz1/satirlar/120|C2/bakiye": 80, "mz1/satirlar/120|C3/bakiye": 80, "mz1/satirlar/120|C1/bakiye": 330, "mz1/satirlar/100/bakiye": 1190,
    # SONRA: PH 100 → 120|C2 0; PG2 C3'e → 120|C3 0; PG1 95 → 120|C1 = 500 − 95 = 405; Kasa 1000 + 100 + 95 + 80 = 1275; 128'ler değişmez
    "mz2/satirlar/120|C2/bakiye": 0, "mz2/satirlar/128|C2/bakiye": 900, "mz2/satirlar/120|C3/bakiye": 0, "mz2/satirlar/128|C3/bakiye": 920,
    "mz2/satirlar/120|C1/bakiye": 405, "mz2/satirlar/100/bakiye": 1275,
    "g1/gecikmis": 405, "g2/gecikmis": 0, "g2/supheli": 900, "g3/gecikmis": 0, "g3/supheli": 920,
    "mu": [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PH", "tarih": "2026-01-08", "acilis": "2026-01-20"},
           {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PG1", "tarih": "2026-01-10", "acilis": "2026-01-20"},
           {"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": "PG2", "tarih": "2026-01-12", "acilis": "2026-01-20"}],
}}, aciklama="S85: geri yüklenmiş, Kasa açılışından önce tarihli Normal Cari kaydında S26 tutarı ya da S40 yalnız cari düzeltmesi şüpheli kaydı açık carinin 120 "
             "bakiyesini aşarsa SUPHELI_NORMAL_ASIM, tamamı; bir kuruş altı ve eşitlik kabul; Mutabakat Testi uyarısı sürer.")
