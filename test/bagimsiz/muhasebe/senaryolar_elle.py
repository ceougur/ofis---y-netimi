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
    GT("gt", "2026-01-01", "2026-12-31"), BIL("bil", "2026-05-31"),
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
    # EK-1 M8-4: dönemi önceki yılda kalan (mahsup edilmemiş) 191 brüt görünür + Kesin Değil "Aralık KDV Mahsubu Yapılmamış"
    "bil_yeni/kesin_degil": ["ARALIK_KDV_MAHSUBU_YAPILMAMIS", "TAMAMLANMAMIS_ACILIS"],
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
    o("supheliye_al", "2026-02-01", cari="C1", tutar=800000),
    o("supheliye_al", "2026-02-01", cari="C2", tutar=150000),
    o("karsilik_ayir", "2026-02-02", cari="C1", tutar=600000),
    o("karsilik_ayir", "2026-02-02", cari="C2", tutar=50000),
    o("karsilik_ayir", "2026-02-03", cari="C1", tutar=300000),
    o("tahsilat", "2026-03-01", cari="C1", yol="havale", banka="B1", tutar=300000, supheliden=True),
    BIL("bil03", "2026-03-01"),
    o("degersiz_yaz", "2026-04-01", cari="C1"),
    o("supheliden_cikar", "2026-05-01", cari="C2"),
    o("supheliye_al", "2026-06-01", cari="C3", tutar=10000),
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
    o("borc_yaz", "2026-01-02", id="BY3", cari="C3", tutar=30000, aciklama="Açılış bakiyesi", onay=True),
    o("borc_yaz", "2026-01-03", id="BY4", cari="C1", tutar=40000, aciklama="açılış farkı"),
    o("alacak_yaz", "2026-01-04", id="AY2", cari="T1", tutar=25000, aciklama="AÇILIŞ", onay=True),
    o("borc_yaz", "2026-01-05", cari="C1", tutar=50000, aciklama="Fark faturası"),
    o("alacak_yaz", "2026-01-06", cari="C1", tutar=10000, aciklama="İndirim"),
    MZ("mz", "2026-01-01", "2026-01-31"), GT("gt", "2026-01-01", "2026-01-31"),
], {"A": {
    # is_opening (açıklaması "Açılış" değil) → 519; onaylı "Açılış Olabilir" → 519; onaysız → 602.90
    "mz/satirlar/519/bakiye": -205000, "mz/satirlar/602.90/bakiye": -90000, "mz/satirlar/770.90/bakiye": 10000,
    "mz/satirlar/120|C1/bakiye": 80000, "mz/satirlar/120|C2/bakiye": 200000, "mz/satirlar/120|C3/bakiye": 30000,
    "mz/satirlar/320|T1/bakiye": -25000, "gt/kalemler/A": 90000, "gt/kalemler/DNK": 80000,
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
    # EK-1 M14: gider türü seçilmemiş G1 → 770.90 (N-03 ile kapanır)
    "mz_arsiv/satirlar/770.90/borc": 70000, "mz_arsiv/satirlar/770/borc": 0,
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
    "devir/yeni_acilis/570": -25000, "devir/yeni_acilis/590": -92500,
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
    o("supheliye_al", "2026-11-01", cari="C1", tutar=150000),
    o("karsilik_ayir", "2026-11-02", cari="C1", tutar=100000),
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
    BIL("bil_arsiv", "2026-12-31", dosya="arsiv"),
], {"A": {
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
    o("borc_yaz", "2026-01-02", id="BY2", cari="C2", tutar=50000, aciklama="Açılış bakiyesi"),
    o("satis_faturasi", "2026-02-01", id="F1", cari="C3", M=100000, K=0),
    o("donem_kilitle", tarih="2026-03-31", kural="2.4.9"),
    R("fark", "kural_farki"),
    o("satis_faturasi", "2026-03-15", id="FX", cari="C3", M=100, K=0),
    o("satis_faturasi", "2026-04-10", id="F2", cari="C3", M=50000, K=0),
    o("kural_farki_duzelt"),
    BIL("bil", "2026-04-30"), GT("gt", "2026-01-01", "2026-04-30"), MZ("mz", "2026-01-01", "2026-04-30"),
    BIL("bil0331", "2026-03-31"),
], {"A": {
    "bil0331/pasif/V.A": 150000,
    # donmuş (2.4.9): açılışlar 500, alınan evrak 602, verilen evrak 770, cari açılışı açıklamadan; güncel: hepsi 519 (BY2 602.90)
    "fark/500": 150000, "fark/519": -150000, "fark/602": 30000, "fark/770": -20000, "fark/602.90": -10000,
    "mz/satirlar/500/bakiye": 0, "mz/satirlar/519/bakiye": -150000, "mz/satirlar/602/bakiye": 0,
    "mz/satirlar/602.90/bakiye": -50000,
    "gt/kalemler/A": 200000, "gt/kalemler/E": 0, "gt/kalemler/DNK": 200000,
    "bil/aktif_toplam": 350000, "bil/pasif/V.G": 150000, "bil/kesin_degil": ["TAMAMLANMAMIS_ACILIS"],
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
    "devir/yeni_acilis/500": -60000, "devir/yeni_acilis/570": -10000, "devir/yeni_acilis/590": -10000,
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
    R("h", "hatirlatma", tarih="2027-01-01"),
], {"A": {
    # S1 A: vadesiz kalemin vadesi belge / işlem günü; M1f: vade günü gecikmiş DEĞİL, ertesi gün gecikmiş
    "g1/gecikmis": 0, "g2/gecikmis": 10000,                      # açılış 01-01
    "g3/gecikmis": 10000, "g4/gecikmis": 30000,                  # vadesiz fatura 31 Ocak (ay sonu) → 1 Şubat
    "g5/gecikmis": 30000, "g6/gecikmis": 35000,                  # vadesiz Borç Yaz 28 Şubat → 1 Mart
    "g7/gecikmis": 0, "g8/gecikmis": 30000,                      # M1c: karşılıksız çek ayrı borç kalemi, vade = karşılıksız günü
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
    o("supheliye_al", "2026-04-01", cari="C1", tutar=120000),
    R("g1", "gecikmis", cari="C1", tarih="2026-04-02"), R("h1", "hatirlatma", tarih="2026-04-02"),
    o("tahsilat", "2026-04-10", cari="C1", yol="havale", banka="B1", tutar=30000, normal_cari=True),   # K3: 120'de kalır
    R("g2", "gecikmis", cari="C1", tarih="2026-04-11"), R("h2", "hatirlatma", tarih="2026-04-11"),
    o("supheliden_cikar", "2026-05-01", cari="C1"),
    R("g3", "gecikmis", cari="C1", tarih="2026-05-01"), R("acik", "acik_faturalar", cari="C1", tarih="2026-05-01"),
], {"A": {
    # M13: J-01 120000 vadesi ilk gelenden çıkar → F1 100000 + F2 20000 şüpheli kuyruğuna; CH'de F2 30000
    # S3 A: şüpheli tutar otomatik hatırlatmaya girmez, "Şüpheli alacağı var" etiketiyle ayrı
    "g1/gecikmis": 30000, "g1/supheli": 120000,
    "h1/otomatik": {"C1": 30000, "C3": 20000}, "h1/supheli_etiketli": ["C1"],
    "g2/gecikmis": 0, "g2/supheli": 120000,
    "h2/otomatik": {"C3": 20000}, "h2/supheli_etiketli": ["C1"],
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
    o("duzenle", kaynak="F1", degisiklik={"K": 12000}),
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
    "devir/acilis/ekstre/C1/satirlar/0/tarih": "2027-01-01", "devir/acilis/ekstre/C1/satirlar/0/borc": 10000,
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
    BIL("bil_arsiv", "2026-12-31", dosya="arsiv"),
], {"A": {
    # 2024: R −3000 (zarar). 2025: SMM = 0 + 50000 − 6 × 5000 = 20000; R = 40000 − 10000 − 20000 = 10000 (kâr).
    # 2026: birim (30000 + 40000) / 16 = 4375; DSS 4 × 4375 = 17500; SMM 52500; R = 20000 − 5000 − 52500 = −37500.
    "bil_once/donem_net_kari": -37500, "bil_once/gecmis_yillar_kapanmamis": 7000, "bil_once/pasif/V.K": 7000,
    "bil_once/gecmis_yillar_kar": 10000, "bil_once/gecmis_yillar_zarar": 3000,
    # M4: önceki yıllar için K tarihli, kapanış sınıflı "Önceki Yıl Sonucu Fişi" (yıl yıl, 570 / 580 brüt); 2025 kilitli → o tarihe fiş YOK
    "devir/kapanis/onceki_yil/2024/R": -3000, "devir/kapanis/onceki_yil/2024/SMM": 0,
    "devir/kapanis/onceki_yil/2025/R": 10000, "devir/kapanis/onceki_yil/2025/SMM": 20000,
    "devir/kapanis/N01/2026": 52500, "devir/kapanis/sonuc": -37500,
    "mz_arsiv/satirlar/570/bakiye": -10000, "mz_arsiv/satirlar/580/bakiye": 3000, "mz_arsiv/satirlar/591/bakiye": 37500,
    "mz_arsiv/satirlar/153/bakiye": 17500, "mz_arsiv/satirlar/600/bakiye": 0, "mz_arsiv/satirlar/770/bakiye": 0,
    "yev25": [],
    "gt25/kalemler/D": 20000, "gt25/kalemler/DNK": 10000, "gt25/tahmini": True,
    "gt26/kalemler/A": 20000, "gt26/kalemler/D": 52500, "gt26/kalemler/E": 5000, "gt26/kalemler/DNK": -37500, "gt26/tahmini": False,
    "devir/yeni_acilis/570": -10000, "devir/yeni_acilis/580": 3000, "devir/yeni_acilis/591": 37500,
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
    o("supheliye_al", "2026-12-01", cari="C1", tutar=70000),
    o("devir", K="2026-12-31", ad="devir"),
    R("g1", "gecikmis", cari="C1", tarih="2027-01-02"),
    o("tahsilat", "2027-01-05", cari="C1", yol="nakit", tutar=20000, supheliden=True),
    o("supheliden_cikar", "2027-02-01", cari="C1"),
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
    o("supheliye_al", "2026-10-05", cari="C1", tutar=4000),
    o("karsilik_ayir", "2026-10-06", cari="C1", tutar=2500),
    o("tahsilat", "2026-10-07", cari="C1", yol="nakit", tutar=3000),
    o("degersiz_yaz", "2026-10-08", cari="C1"),
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
], {"A": {
    # M-01: ikinci açılış red; açılışın düzeltilmesi G-7 (tutar ve tarih yeniden türetilir)
    "redler": ["KASA_ACILIS_TEKRAR"], "yevA/0/kaynak": "KA", "yevA/0/satirlar/0/b": 12000,
    "mz/satirlar/519/bakiye": -12000, "mz/satirlar/649.90/bakiye": -5000,
    # silinen kaydedilmiş fatura geri yüklenince ETKİSİZ ("İptal Edildi"): cari, gelir, KDV, stok ve formdaki peşin yok
    "durum_F1": "iptal", "mz/satirlar/120|C1/bakiye": 0, "mz/satirlar/600/bakiye": 0, "mz/satirlar/391/bakiye": 0,
    "deg/urunler/U1/miktar": "5",
    # fatura dışı kayıt (R-04) geri yüklenince etkin; taslak taslak olarak döner
    "durum_P2": "aktif", "mz/satirlar/120|C3/bakiye": -1000, "durum_TS1": "aktif",
    "mz/satirlar/100/bakiye": 18000,
}}, aciklama="Kasa açılışı bir kez; düzeltmesi G-7. Silinen kaydedilmiş fatura geri yüklenince etkisiz (İptal Edildi).")
