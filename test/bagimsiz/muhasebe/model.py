#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Muhasebe çekirdeği + yıl sonu devri — KÂHİN (temiz oda) modeli, DestekOfis 2.5.0.

Programın kodu GÖRÜLMEDEN, yalnız şu yazılı kurallardan kuruldu (CLAUDE.md KANIT KURALI 2, ders 5, 40, 43):
  docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md (ANA KAYNAK; satır kimlikleri F-01, T-03, N-13 … aşağıda anılır),
  docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md (§6, §7, §13), docs/devir/DEVIR-PLANI.md (§0, §4, §11, G2, G3, G7, G13, G14),
  docs/2.5.0-IS-LISTESI.md (A, C, D) ve ana oturumun 05.11.2026 17:16 UTC iletisi (ürün sahibi açık maddelerin hepsine "A").
BAKIM (05.11.2026, ikinci tur): docs/erp/MUHASEBELESTIRME-KURAL-KITABI-EK-1.md (M1–M14 öneri A, §1 Tek Yükümlülük Kuyruğu, §3 E1–E10,
§4 13 değişmez) + ürün sahibinin S1–S5 kararları (hepsi A; iş listesi D) + KG-3'ün ONAYLANAN metni ("kayıt (dosya) tahsilatı gelir
değil → Sınıflandırılmamış Tahsilatlar; carisiz Kasa girişi 649'da kalır").
BAKIM 2 (05.11.2026, üçüncü tur): docs/erp/MUHASEBELESTIRME-KURAL-KITABI-EK-2B.md (23, 24, 28, 32, 33, 35, K-2, K-3) + EK-2'nin geçerli maddeleri
(25–27, 29–31, 34, 36–40, K-1, E11–E25, §4) + ürün sahibinin 05.11 21:08 (S7, S8) ve 21:30 (1)–(7) kararları (hepsi A). Yorumlar README R1–R21.
BAKIM 3 (06.11.2026, dördüncü tur): ürün sahibinin 06.11 03:35 S11 (kilitli dönemde evrakla kapanan fatura kilitten sonraki karşılıksızla
yeniden açılmaz; karşılıksız tutar ayrı borç) ve S12 (Kasa açılışından önce tarihli Kasa hareketi reddedilir) kararları (A). Yorumlar README T1–T13.
BAKIM 4 (06.11.2026, beşinci tur): ürün sahibinin 06.11 04:50 S14 (şüpheli caride faturaya bağlı çek / senet faturanın durduğu hesaptan), S15 (kartlı
faturanın İptal Et'i kabul, kart kapanır, tahsilatlar avans), S18 (kilitli dönemin avans çeki karşılıksızsa tamamı ayrı borç), S19 (S11 / R3 kararı yazılış
anındaki kilide göre bir kez), S20 (geri yükleme veriyi aynen getirir; S12 yalnız yeni kayıtta; Mutabakat uyarısı) ve S21 (POS valörü resmî tatilde sonraki
iş günü) kararları (A). Yorumlar README Y1–Y23.
BAKIM 5 (06.11.2026, altıncı tur): ürün sahibinin 06.11 06:26 S24 (devirden önce K'den geride yazılmış karşılıksız / bağ devirde K kilidiyle; Devir
Raporu listeler), S25 (kısmen aktarılmış faturaya küçük çek önce 128; çekin fazlası bağsız alacak 120; nakit / havale / POS S14 ile aynı), S26 (geri
yüklenmiş açılış öncesi Kasa kaydının yalnız tutar düzeltmesi kabul) ve S27 (yarım gün iş günü; dinî bayram günleri tam gün tatil — tarihler resmî
kaynaktan) kararları (A). Yorumlar README Z1–Z12.
BAKIM 6 (06.11.2026, yedinci tur): ürün sahibinin 06.11 08:06 S39 (şüpheli caride faturaya bağlı Kredi Kartına İade S25 / S14 ile aynı) ve S40 (geri
yüklenmiş, açılış öncesi Kasa kaydının açıklama / cari düzeltmesi tarih değişmeden kabul; uyarı sürer) kararları (A) + BAŞ MİMAR KARARI 06.11 07:59 Z9
(S26 Silinenler'den geri alınan kayda da). Yorumlar README X1–X13.
Saf Python, yalnız standart kütüphane. Para kuruş tamsayı; miktar Fraction.

Yapı:
  Dosya   — bir şirket veri dosyası (canlı, arşiv ya da devirden sonraki yeni yıl): kaynak kayıtlar (G-7: açık dönemde maddeler
            her okumada kaynaktan TÜRETİLİR) + saklanan fişler (Ç2: KDV mahsubu, açılış eşleştirme, kapanış, devir açılış, ters fiş).
  Gecis   — kaynak kayıtları tarih sırasıyla işleyip yevmiye maddelerini ve modül (kasa, banka, cari …) hareketlerini üretir.
  Model   — senaryoyu koşar: olaylar, dönem kilidi, devir (N-01…N-13), Devri Yenile (N-14), Devri Geri Al (N-15), raporlar.
Raporlar: mizan, büyük defter, gelir tablosu (MSUGT, 7/A yansıtma), bilanço (ters bakiye brütleştirme, hesaplanmış satırlar,
"Kesin Değil" nedenleri), gecikmiş borç (B1). Değişmezler: degismezler() ve devir_degismezleri().

İki dallı maddeler (kural kitabı §9 + iş listesi C): Kurallar(...) bayrakları; varsayılan A (ürün sahibi 05.11 17:16 "hepsi A").
B dalları GEÇERSİZ (kullanıcı A seçti); ucuz oldukları için duruyor, kanıt sayılmaz. KG-3: A = kullanıcıya gösterilip onaylanan metin
(kayıt tahsilatı 336.90, Kasa girişi 649.90); KITAP = kitabın §9 A'sı (ikisi 649.90, geçersiz); B = ikisi 336.90 (geçersiz).
"""

import copy
import datetime
import json
import math
from collections import defaultdict
from fractions import Fraction

DIL = "muhasebe-kahin/1"

# ------------------------------------------------------------------------------------------------ kural dalları (§9)
IKI_DALLI = ("B1", "KG2", "KG3", "KG5", "KG6", "KG7", "KG9", "KG11", "KG12", "KG15", "KG16")
DAL_DEGERLERI = {"KG3": ("A", "KITAP", "B")}


class Kurallar:
    """Açık kural maddelerinin dalları. Varsayılan A (ürün sahibi 05.11.2026 17:16 UTC)."""

    def __init__(self, **kw):
        for a in IKI_DALLI:
            setattr(self, a, "A")
        for a, d in kw.items():
            if a not in IKI_DALLI or d not in DAL_DEGERLERI.get(a, ("A", "B")):
                raise ValueError(f"bilinmeyen kural dalı {a}={d}")
            setattr(self, a, d)

    def etiket(self):
        fark = [f"{a}={getattr(self, a)}" for a in IKI_DALLI if getattr(self, a) != "A"]
        return ",".join(fark) or "A"

    @classmethod
    def etiketten(cls, s):
        if s in ("", "A"):
            return cls()
        return cls(**dict(p.split("=") for p in s.split(",")))


# ------------------------------------------------------------------------------------------------ sabit eşlemeler
G = "519"                    # geçici açılış hesabı "Eşleştirilecek Açılış Bakiyeleri" (KG-1 A; çekirdek §13 KABUL)
POS_KOMISYON = "653"         # §2 (653 → 760 geçişi 2.5.1, çekirdek §13); KG-6 yalnız TARİH
BANKA_MASRAF = "770"         # K-06, K-08, K-09 (KG-22 A)
BANKA_DIGER_GELIR = "649"    # K-12 (KG-22 A)
BANKA_DIGER_GIDER = "659"
DEGERSIZ_KALAN = "659"       # J-05 (KG-21 A)
KARSILIK_COZULME = "644"     # J-04 / J-06 öneri
YOLDAKI = "108.90"           # K-07 (KG-19 A)
BELGESIZ_GELIR = "600.90"    # KG-2 A (S-03, H-03, KG-5 B)
BELGESIZ_IADE = "610.90"     # KG-2 A (S-04)
BORC_YAZ = "602.90"          # C-01 (KG-4 A; çekirdek §13 "bugünkü 602 / 770 + .90")
ALACAK_YAZ = "770.90"        # C-02
KASA_GIDER = "770.90"        # K-02
CARISIZ_GELIR = "649.90"     # KG-3 A: carisiz Kasa girişi (K-01) "649'da kalır" (kitap K-01 öneri alt hesabı .90)
CARISIZ_PASIF = "336.90"     # KG-3 A: kayıt (dosya) tahsilatı (T-14) "Sınıflandırılmamış Tahsilatlar" (gelir değil)
IHRACAT_GELIR = "601"        # F-02 (KG-24 A)
CH_HESAP = {"musteri": "120", "tedarikci": "320", "diger": "336"}   # G-2 (KG-25 A)
GIDER_HESAP = {"genel": "770", "satis": "760", "finansman": "780", "demirbas": "255", "ceza": "689"}  # F-06 + EK-1 M14
SINIFLANDIRILMAMIS_GIDER = "770.90"   # EK-1 M14: gider türü seçilmemiş / tanınmayan (kitap G-8)
YANSITMA = {"760": ("631", "761"), "770": ("632", "771"), "780": ("660", "781")}   # §2, N-02, N-03
# 2.4.9 kuralı (KG-15; çekirdek §1 ve §6 P2 bulguları): açılış karşı hesabı 500, açılış evrakı 602 / 770, cari açılışı AÇIKLAMADAN.
ESKI_ACILIS_KARSI = "500"
ESKI_EVRAK_ALINAN = "602"
ESKI_EVRAK_VERILEN = "770"

# Hesap planı (kural kitabı §2): kod → (ad, tür, kalem). Tür: A aktif, A- düzenleyici aktif, P pasif, Ö özkaynak, Ö- eksi özkaynak,
# GE gelir, GI gider/indirim, MAL 7/A, KP kapanış. Kalem: bilanço (I.A …) ya da gelir tablosu (A … K).
HESAPLAR = {
    "100": ("Kasa", "A", "I.A"), "101": ("Alınan Çekler", "A", "I.A"), "102": ("Bankalar", "A", "I.A"),
    "103": ("Verilen Çekler ve Ödeme Emirleri (−)", "A-", "I.A"), "108": ("Diğer Hazır Değerler", "A", "I.A"),
    "120": ("Alıcılar", "A", "I.C"), "121": ("Alacak Senetleri", "A", "I.C"), "127": ("Diğer Ticari Alacaklar", "A", "I.C"),   # 127: EK-2 36 / E14
    "128": ("Şüpheli Ticari Alacaklar", "A", "I.C"),
    "129": ("Şüpheli Ticari Alacaklar Karşılığı (−)", "A-", "I.C"), "136": ("Diğer Çeşitli Alacaklar", "A", "I.D"),
    "153": ("Ticari Mallar", "A", "I.E"), "159": ("Verilen Sipariş Avansları", "A", "I.E"), "190": ("Devreden KDV", "A", "I.H"),
    "191": ("İndirilecek KDV", "A", "I.H"), "193": ("Peşin Ödenen Vergiler ve Fonlar", "A", "I.H"),
    "198": ("Diğer Çeşitli Dönen Varlıklar", "A", "I.H"), "255": ("Demirbaşlar", "A", "II.D"),
    "300": ("Banka Kredileri", "P", "III.A"), "309": ("Diğer Mali Borçlar", "P", "III.A"), "320": ("Satıcılar", "P", "III.B"),
    "321": ("Borç Senetleri", "P", "III.B"), "336": ("Diğer Çeşitli Borçlar", "P", "III.C"),
    "340": ("Alınan Sipariş Avansları", "P", "III.D"), "360": ("Ödenecek Vergi ve Fonlar", "P", "III.F"),
    "370": ("Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları", "P", "III.G"), "391": ("Hesaplanan KDV", "P", "III.I"),
    "500": ("Sermaye", "Ö", "V.A"), "519": ("Eşleştirilecek Açılış Bakiyeleri", "Ö", "V.G"),   # EK-2 39 / E15: "(Geçici)" yalnız Bilanço satırında
    "570": ("Geçmiş Yıllar Kârları", "Ö", "V.D"), "580": ("Geçmiş Yıllar Zararları (−)", "Ö-", "V.E"),
    "590": ("Dönem Net Kârı", "Ö", "V.F"), "591": ("Dönem Net Zararı (−)", "Ö-", "V.F"),
    "600": ("Yurt İçi Satışlar", "GE", "A"), "601": ("Yurt Dışı Satışlar", "GE", "A"), "602": ("Diğer Gelirler", "GE", "A"),
    "610": ("Satıştan İadeler (−)", "GI", "B"), "611": ("Satış İskontoları (−)", "GI", "B"), "612": ("Diğer İndirimler (−)", "GI", "B"),
    "621": ("Satılan Ticari Mallar Maliyeti (−)", "GI", "D"),
    "631": ("Pazarlama Satış ve Dağıtım Giderleri (−)", "GI", "E"), "632": ("Genel Yönetim Giderleri (−)", "GI", "E"),
    "642": ("Faiz Gelirleri", "GE", "F"), "644": ("Konusu Kalmayan Karşılıklar", "GE", "F"),
    "649": ("Diğer Olağan Gelir ve Kârlar", "GE", "F"), "653": ("Komisyon Giderleri (−)", "GI", "G"),
    "654": ("Karşılık Giderleri (−)", "GI", "G"), "659": ("Diğer Olağan Gider ve Zararlar (−)", "GI", "G"),
    "660": ("Kısa Vadeli Borçlanma Giderleri (−)", "GI", "H"), "671": ("Önceki Dönem Gelir ve Kârları", "GE", "I"),
    "681": ("Önceki Dönem Gider ve Zararları (−)", "GI", "J"), "689": ("Diğer Olağandışı Gider ve Zararlar (−)", "GI", "J"),
    "690": ("Dönem Kârı veya Zararı", "KP", None), "691": ("Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları (−)", "KP", "K"),
    "692": ("Dönem Net Kârı veya Zararı", "KP", None),
    "760": ("Pazarlama Satış ve Dağıtım Giderleri", "MAL", "E"), "761": ("Pazarlama Satış ve Dağıtım Giderleri Yansıtma", "MAL", None),
    "770": ("Genel Yönetim Giderleri", "MAL", "E"), "771": ("Genel Yönetim Giderleri Yansıtma", "MAL", None),
    "780": ("Finansman Giderleri", "MAL", "H"), "781": ("Finansman Giderleri Yansıtma", "MAL", None),
}
# Ters bakiye (§7.3; çekirdek §13): "KD" = aynı kalemde eksi + Kesin Değil; kalem kodu = brütleştirme hedefi; "KG14" = 198 + Kesin Değil.
TERS = {"100": "KD", "101": "KD", "102": "III.A", "103": "KD", "108": "KD", "120": "III.D", "121": "KD", "127": "III.D", "128": "KD", "129": "KD",
        "153": "KD", "300": "KD", "309": "I.D", "320": "I.E", "321": "KD", "336": "I.D", "360": "KG14"}
BILANCO_KALEMLERI = {
    "I.A": "Hazır Değerler", "I.C": "Ticari Alacaklar", "I.D": "Diğer Alacaklar", "I.E": "Stoklar", "I.H": "Diğer Dönen Varlıklar",
    "II.D": "Maddi Duran Varlıklar", "III.A": "Mali Borçlar", "III.B": "Ticari Borçlar", "III.C": "Diğer Borçlar",
    "III.D": "Alınan Avanslar", "III.F": "Ödenecek Vergi ve Diğer Yükümlülükler", "III.G": "Borç ve Gider Karşılıkları",
    "III.I": "Diğer Kısa Vadeli Yabancı Kaynaklar", "V.A": "Ödenmiş Sermaye", "V.D": "Geçmiş Yıllar Kârları",
    "V.E": "Geçmiş Yıllar Zararları (−)", "V.F": "Dönem Net Kârı (Zararı)",
    "V.K": "Geçmiş Yıllar Kârları (Zararları) — Kapanmamış", "V.G": "Eşleştirilecek Açılış Bakiyeleri (Geçici)",
}
GT_SIRA = ("A", "B", "C", "D", "BSK", "E", "FK", "F", "G", "H", "OK", "I", "J", "DK", "K", "DNK")

# S14 A (çek / senet) + S25 (c) A (nakit / havale / POS; README Z7) + S39 A (Kredi Kartına İade, T-11; README X1–X4; bakım 5'in Z8 susması kalktı):
# şüpheli caride faturaya bağlı tahsilat faturanın durduğu hesaptan düşer (önce şüpheli kısım, kalanı 120).
S14_YOLLARI = ("cek", "senet", "nakit", "havale", "pos", "kart")
# S26 A (tutar; README Z9) + S40 A (karar metninin saydığı tutar dışı alanlar: açıklama, cari; README X7–X10): geri yüklenmiş, açılıştan önce tarihli Kasa
# kaydının tarih değişmeden düzeltilebilen alanları. Öbürleri (fatura / taksit kartı bağı, Normal Cari Hesaba İşle, banka …) → kâhin susar (README X11).
S26_S40_ALANLARI = ("tarih", "tutar", "aciklama", "cari")

ACILIS_TURLERI = {"kasa_acilis", "cari_acilis", "banka_acilis", "kart_acilis", "kredi_acilis", "stok_acilis", "evrak_acilis",
                  "taksit_excel", "devir_kasa", "devir_cari", "devir_banka", "devir_kart", "devir_kredi",
                  "devir_stok", "devir_evrak", "devir_pos", "devir_yoldaki", "devir_supheli", "devir_taksit"}


# ------------------------------------------------------------------------------------------------ yardımcılar
def gun(s):
    return datetime.date.fromisoformat(s)


def ertesi(s):
    return (gun(s) + datetime.timedelta(days=1)).isoformat()


def onceki(s):
    return (gun(s) - datetime.timedelta(days=1)).isoformat()


def ay_sonu(ay):
    y, m = int(ay[:4]), int(ay[5:7])
    sonraki = datetime.date(y + (m == 12), m % 12 + 1, 1)
    return (sonraki - datetime.timedelta(days=1)).isoformat()


def yil(s):
    return int(s[:4])


# S21 A (kullanıcı 06.11 04:50; README Y19–Y23): POS valörü resmî tatile düşerse bir sonraki iş gününe kayar; hafta sonu da (ana oturum K3).
# S27 A (kullanıcı 06.11 06:26; README Z11, Z12): YARIM GÜN (28 Ekim 13:00'ten, bayram arifesi 13:00'ten) İŞ GÜNÜ — valör kaymaz; dinî bayram günleri tam gün
# tatil, atlanır — tarihleri YALNIZ resmî kaynaktan okunmuşsa (Diyanet / Resmî Gazete). 2429 sayılı Kanun md. 1–2 (kâhinin bilgisi; birincil metin bu bakımda
# da açılamadı — mevzuat.gov.tr zaman aşımı). Bu bakımda resmî kaynak bayram tarihi VERMEDİ → dinî bayram pencereleri (arife dahil; arifeden bir gün önce –
# bayramdan bir gün sonra) "belirsiz" kalır, kâhin orada kural kurmaz. Bayram takvimi yalnız 2026–2027; öbür yıllarda sabit tam gün tatil dışındaki her gün
# belirsiz (bayram bilinmez — 28 Ekim dahil).
RESMI_TATIL_TAM = ("01-01", "04-23", "05-01", "05-19", "07-15", "08-30", "10-29")
RESMI_TATIL_YARIM = ("10-28",)                  # S27 A: iş günü (13:00'e kadar açık)
DINI_BAYRAM_YILLARI = ("2026", "2027")
DINI_BAYRAM_DOGRULANMADI = (("2026-03-18", "2026-03-23"), ("2026-05-25", "2026-05-31"), ("2027-03-07", "2027-03-12"), ("2027-05-14", "2027-05-20"))


def tatil_turu(s):
    """"tam" (2429 tam gün resmî tatil) · "yarim" (S27 A: yarım gün — İŞ GÜNÜ) · "belirsiz" (doğrulanmamış dinî bayram penceresi, arife dahil / bayram
    takvimi bilinmeyen yıl) · None (tatil değil)."""
    if s[5:] in RESMI_TATIL_TAM:
        return "tam"
    if s[:4] not in DINI_BAYRAM_YILLARI or any(a <= s <= b for a, b in DINI_BAYRAM_DOGRULANMADI):
        return "belirsiz"
    if s[5:] in RESMI_TATIL_YARIM:
        return "yarim"
    return None


def pos_etkin_valor(valor, tatil=True):
    """D-01 + S21 + S27: nominal valörden başlayarak ilk iş günü (hafta sonu da tam gün resmî tatil de değil; yarım gün İŞ GÜNÜ). tatil=False: yalnız hafta
    sonu (donmuş 2.4.9 türetmesi, README Y22). Yol belirsiz güne değerse senaryo hatası (kâhin susar)."""
    g = gun(valor)
    while True:
        s = g.isoformat()
        tt = tatil_turu(s) if tatil else None
        if tt == "belirsiz":
            raise AssertionError(f"senaryo hatası: POS valörü {valor} belirsiz güne ({s}: doğrulanmamış dinî bayram / bayram takvimi bilinmeyen yıl) "
                                 "değiyor — kâhin susar (README bakım 4 Y21, bakım 5 Z12)")
        if g.weekday() < 5 and tt in (None, "yarim"):
            return s
        g += datetime.timedelta(days=1)


def yuvarla(x):
    """G-1: kuruşa, yarım yukarı; eksi tutarda mutlak değere uygulanır."""
    x = Fraction(x)
    if x >= 0:
        return int(math.floor(x + Fraction(1, 2)))
    return -int(math.floor(-x + Fraction(1, 2)))


def ana(h):
    return h.split(".")[0]


def gider_hesabi(v):
    """F-06 gider türü → hesap (EK-1 M14 + EK-2 38 / E17): boş ya da varsayılan → 770; eşlemede olmayan değer → 770.90 (G-8)."""
    g = v.get("gider_turu")
    if not g:
        return "770"
    return GIDER_HESAP.get(g, SINIFLANDIRILMAMIS_GIDER)


KDV_HESAPLARI = ("191", "391")


def kdv_etiketle(satirlar, tarih, kg7="A", zorla=None):
    """EK-1 M8: 191 / 391 satırına KDV dönemi etiketi (191: KDV İndirim Dönemi alanı, KG-7; boşsa belge ayı; 391: belge ayı).
    zorla verilirse (S4 A: mahsuptan sonra girilen ters kayıt) etiket o ay olur."""
    for s in satirlar:
        if s["h"] in KDV_HESAPLARI:
            e = dict(s["e"] or {})
            if zorla:
                e["donem"] = zorla
            elif "donem" not in e:
                ia = e.get("indirim_ayi") if (s["h"] == "191" and kg7 == "A") else None
                e["donem"] = ia or tarih[:7]
            s["e"] = e
    return satirlar


# 2.3.0 şüpheli kabul §1 K3: aynı gün sırası al → karşılık → değersiz → alacak satırı → çıkar (girilme sırasından bağımsız)
GUN_SINIFI = {"supheliye_al": 0, "karsilik_ayir": 1, "degersiz_yaz": 2, "supheliden_cikar": 4}
FATURA_TURLERI = {"satis_faturasi", "alis_faturasi", "satis_iade_faturasi", "alis_iade_faturasi", "esmm", "gelen_smm"}


def s2_anahtari(o):
    """S2 A (TBK 102): vadesi ilk gelen → eşitse belge tarihi → eşitse giriş sırası (ders 31)."""
    return (o["vade"], o["tarih"], o["sira"])


def bilanco_hesabi(h):
    return h[0] in "12345"


def sonuc_hesabi(h):
    return h[0] in "67"


def acilis_aciklamasi(s):
    s = (s or "").strip().replace("İ", "i").replace("I", "ı").lower()
    return s.startswith("açılış")


def L(h, tutar, c=None, **e):
    """Yevmiye satırı; tutar işaretli (+ borç, − alacak)."""
    return {"h": h, "c": c, "b": tutar if tutar > 0 else 0, "a": -tutar if tutar < 0 else 0, "e": e or None}


def Bo(h, t, c=None, **e):
    return L(h, t, c, **e)


def Al(h, t, c=None, **e):
    return L(h, -t, c, **e)


def anahtar(h, c):
    return f"{h}|{c}" if c else h


def ayir(k):
    h, _, c = k.partition("|")
    return h, (c or None)


class Red(Exception):
    """Program bu isteği reddetmeli (4xx); kod ve neden."""

    def __init__(self, kod, neden=""):
        super().__init__(f"{kod}: {neden}")
        self.kod, self.neden = kod, neden


class Kaynak:
    # kilit: kaydın YAZILDIĞI andaki dosya kilidi (S19 A, README Y11); geri: Silinenler'den / yedekten geri yüklenmiş kayıt (S20 A, README Y15)
    __slots__ = ("id", "tur", "tarih", "seq", "v", "durum", "devir", "kilit", "geri")

    def __init__(self, id, tur, tarih, seq, v, devir=None):
        self.id, self.tur, self.tarih, self.seq, self.v, self.devir = id, tur, tarih, seq, v, devir
        self.durum = "aktif"
        self.kilit, self.geri = None, False


class Madde:
    __slots__ = ("id", "tarih", "sinif", "seq", "kaynak", "tur", "satirlar", "ek")

    def __init__(self, id, tarih, sinif, seq, kaynak, tur, satirlar, ek=None):
        self.id, self.tarih, self.sinif, self.seq, self.kaynak, self.tur, self.satirlar = id, tarih, sinif, seq, kaynak, tur, satirlar
        self.ek = ek or {}

    def sozluk(self):
        d = {"id": self.id, "tarih": self.tarih, "sinif": self.sinif, "kaynak": self.kaynak, "tur": self.tur,
             "satirlar": [{k: v for k, v in s.items() if v not in (None, 0)} for s in self.satirlar]}
        if self.ek.get("fis_grubu"):
            d["fis_grubu"] = self.ek["fis_grubu"]
        return d


def madde_kur(id, tarih, sinif, seq, kaynak, tur, satirlar, ek=None):
    s = [x for x in satirlar if x["b"] or x["a"]]
    if not s:
        return None
    tb, ta = sum(x["b"] for x in s), sum(x["a"] for x in s)
    if tb != ta or tb <= 0:
        raise AssertionError(f"dengesiz madde {id}: borç {tb} alacak {ta}")
    return Madde(id, tarih, sinif, seq, kaynak, tur, s, ek)


# G-4 (ders 31) + EK-2 25 / E13: sınıf kodu → aynı gün sırası. Kodlar: 0 açılış, 1 olağan, 4 önceki yıl sonucu (Gelir Tablosu DIŞI;
# yalnız devir kapanışında K günü), 2 dönem sonu, 3 kapanış.
SINIF_SIRASI = {0: 0, 1: 1, 4: 2, 2: 3, 3: 4}
GT_DISI = (3, 4)                      # Gelir Tablosu'na girmeyen sınıflar (kitap §4 + E13)


def sira_anahtari(m):
    return (m.tarih, SINIF_SIRASI[m.sinif], m.seq, m.id)


# ------------------------------------------------------------------------------------------------ türetme geçişi
class Gecis:
    """Kaynak kayıtları (tarih, sınıf, yazım sırası) ile işler; maddeleri ve modül hareketlerini üretir."""

    def __init__(self, dosya, kural="2.5.0", s14=None):
        self.d, self.kural, self.k = dosya, kural, dosya.k
        self.maddeler, self.mod, self.stok, self.mahsup = [], [], [], []
        self.evrak, self.pos, self.supheli, self.kart, self.yoldaki = {}, {}, {}, {}, {}
        self.uyarilar, self.acilis_olabilir = [], []
        self.supheli_olay = []               # (tarih, seq, cari, "tahsil" | "degersiz", tutar, kayıt, hedef) — şüpheli kuyruğu (M13, K3; S14 hedef)
        # S14 A (README Y1–Y5): şüpheli caride faturaya bağlı çek / senet → plan {tahsilat: [(kayıt, tutar)]} (Dosya.gecis yakınsatır), adaylar ölçülür
        self.s14 = dict(s14 or {})
        self.s14_aday = []                   # (tarih, seq, cari, tahsilat, "fatura:<id>", tutar)
        self.kart_iptal = {}                 # S15 A (README Y9): iptal edilen faturanın tahsilatlı kartı — kapalı, taksitsiz
        self.devir_kalemleri = {}            # cari → devreden açık kalemler (M2; defterde tek satır, M3)
        self.devir_supheli = {}              # cari → devreden şüpheli kuyruğu kalemleri (M13)
        self._emit = defaultdict(list)       # kaynak id → maddeleri (R-01 için)
        self._modk = defaultdict(list)       # kaynak id → modül hareketleri (R-01 için)

    # -- pencere: arşiv ≤ K (devirde valörü K'den sonraya kalan parçalar yeni yıla açılışla geçer)
    def _icinde(self, tarih):
        return self.d.ust is None or tarih <= self.d.ust

    def madde(self, k, tarih, sinif, satirlar, tur=None, alt=0, ek=None):
        if not self._icinde(tarih):
            return
        if k.devir and sinif == 0:                   # karar (7): devrin bütün açılış maddeleri TEK açılış fişi
            ek = dict(ek or {}, fis_grubu=f"devir_acilis:{k.devir}")
        m = madde_kur(f"{k.id}#{alt}", tarih, sinif, k.seq, k.id, tur or k.tur, satirlar, ek)
        if m:
            kdv_etiketle(m.satirlar, tarih, self.k.KG7)
            self.maddeler.append(m)
            self._emit[k.id].append(m)

    def m(self, k, tarih, anah, delta, sinif=1):
        if delta and self._icinde(tarih):
            self.mod.append((tarih, sinif, k.seq, anah, delta, k.id))
            self._modk[k.id].append((tarih, anah, delta))

    def stok_har(self, k, tarih, urun, miktar, deger, tur):
        if self._icinde(tarih):
            self.stok.append((tarih, 0 if tur == "acilis" else 1, k.seq, urun, Fraction(miktar), deger, tur))

    # -- şüpheli kayıtları (2.3.0 kabul §1 K1–K7, plan §3.11b): cari → kayıtlar (eskiden yeniye) {id, tarih, kalan, karsilik}
    def sup_toplam(self, c):
        rs = self.supheli.get(c, [])
        return sum(r["kalan"] for r in rs), sum(r["karsilik"] for r in rs)

    def _supheliden_dus(self, k, c, t, kart_tarihi=None):
        """K3: carinin alacak satırı kayıt tarihinden sonra geldiyse ÖNCE şüpheli tutardan düşer (A 128; en eski kayıt önce; aşan A 120).
        Taksit tahsilatı yalnız kartın açılış tarihi ≤ kayıt tarihi olan kayıtlardan düşer (kart_tarihi). K6: karşılık > kalan → 644."""
        sat, cozulme, kalan = [], [], t
        for r in self.supheli.get(c, []):
            if kalan <= 0:
                break
            if r["kalan"] <= 0 or r["tarih"] > k.tarih or (kart_tarihi is not None and kart_tarihi > r["tarih"]):
                continue
            kalan -= self._kayittan_dus(k, c, r, min(kalan, r["kalan"]), sat, cozulme)
        return sat, cozulme, kalan

    def _kayittan_dus(self, k, c, r, n, sat, cozulme, hedef=None):
        """Bir şüpheli kaydından n düşer (A 128); hedef verilirse (S14) şüpheli kuyruğunda o kalem önce kapanır. K6: karşılık > kalan → 644."""
        r["kalan"] -= n
        sat.append(Al("128", n, c))
        self.supheli_olay.append((k.tarih, k.seq, c, "tahsil", n, r["id"], hedef))
        if r["karsilik"] > r["kalan"]:           # J-04 / K6
            fazla = r["karsilik"] - r["kalan"]
            r["karsilik"] -= fazla
            cozulme.append(fazla)
        return n

    def _s14_aday_mi(self, k, c, yol):
        """S14 A (README Y1) + S25 (c) A (README Z7) + S39 A (README X1): faturaya bağlı çek / senet / nakit / havale / POS / Kredi Kartına İade, carinin
        tahsilat günü açık şüpheli kaydı var."""
        return bool(k.v.get("fatura")) and yol in S14_YOLLARI and any(
            r["kalan"] > 0 and r["tarih"] <= k.tarih for r in self.supheli.get(c, []))

    def _s14_dus(self, k, c, t):
        """S14 A (README Y2–Y4) + S25 (a), (b) A (README Z5, Z6): bağlı faturanın şüpheli kuyruğundaki kısmı kadar ÖNCE A 128 — o kalemi TAŞIYAN kayıttan
        (plan: Dosya.gecis'in yakınsattığı tahsilat anı ölçümü); kalan A 120: bağ faturanın 120'deki kısmını kapatır, faturanın açık kısmını aşan fazlası
        carinin BAĞSIZ alacağıdır (TYK'da kendi gününde açık borçlara, yoksa avans; SUPHELI_NORMAL_ASIM'e girmez — Model._s14_normal)."""
        hedef = "fatura:" + k.v["fatura"]
        self.s14_aday.append((k.tarih, k.seq, c, k.id, hedef, t))
        sat, cozulme, kalan = [], [], t
        for kayit, n in self.s14.get(k.id, []):
            r = next((r for r in self.supheli.get(c, []) if r["id"] == kayit and r["kalan"] > 0), None)
            if r is None or kalan <= 0:
                continue
            kalan -= self._kayittan_dus(k, c, r, min(n, kalan, r["kalan"]), sat, cozulme, hedef)
        return sat, cozulme, kalan

    def _cozulmeler(self, k, c, cozulme):
        for i, fazla in enumerate(cozulme):
            self.madde(k, k.tarih, 1, [Bo("129", fazla, c), Al(KARSILIK_COZULME, fazla)], tur="karsilik_cozulme", alt=10 + i)

    # -- tanımlar
    def ch(self, c):
        return CH_HESAP[self.d.tanim["cariler"][c]["tur"]]

    def oy(self, k, yol, tutar, giris, tarih=None):
        """G-3 ödeme yolu satırı (nakit / havale); giris True tahsilat (borç), False ödeme (alacak)."""
        t = tarih or k.tarih
        s = tutar if giris else -tutar
        if yol == "nakit":
            self.m(k, t, ("kasa",), s)
            return L("100", s)
        if yol == "havale":
            b = k.v["banka"]
            self.m(k, t, ("banka", b), s)
            return L("102." + b, s)
        raise AssertionError(f"senaryo hatası: bilinmeyen ödeme yolu {yol}")

    def karsi(self, k, tutar, giris, link=None):
        """Stok modülü 'Kasa'ya yansıt' / cari karşılığı: karsi = nakit | havale | cari."""
        v = k.v
        if v.get("karsi", "nakit") == "cari":
            c = v["cari"]
            self.m(k, k.tarih, ("cari", c), tutar if giris else -tutar)
            return L(self.ch(c), tutar if giris else -tutar, c, k=f"stok:{k.id}", tur="stok", link=link)
        return self.oy(k, v.get("karsi", "nakit"), tutar, giris)

    def kos(self):
        ks = [k for k in self.d.kaynaklar.values() if k.durum == "aktif"]
        ks.sort(key=lambda k: (k.tarih, 0 if self.kaynak_acilis_mi(k) else 1, GUN_SINIFI.get(k.tur, 3), k.seq))
        for k in ks:
            getattr(self, "_" + k.tur)(k)
        self._pos_valorleri()
        self.maddeler.sort(key=sira_anahtari)
        self.stok.sort(key=lambda e: e[:3])
        return self

    @staticmethod
    def kaynak_acilis_mi(k):
        return k.tur in ACILIS_TURLERI or (k.tur in ("borc_yaz", "alacak_yaz") and k.v.get("acilis"))

    # ============================================================== 3-M açılışlar
    def _acilis_karsi(self):
        return ESKI_ACILIS_KARSI if self.kural == "2.4.9" else G

    def _kasa_acilis(self, k):                       # M-01
        t = k.v["tutar"]
        self.madde(k, k.tarih, 0, [Bo("100", t), Al(self._acilis_karsi(), t)])
        self.m(k, k.tarih, ("kasa",), t, 0)

    def _banka_acilis(self, k):                      # M-04 (eksi = KMH, yön ters)
        b, t = k.v["banka"], k.v["tutar"]
        self.madde(k, k.tarih, 0, [L("102." + b, t), L(self._acilis_karsi(), -t)])
        self.m(k, k.tarih, ("banka", b), t, 0)

    def _kart_acilis(self, k):                       # M-05
        kk, t = k.v["kart"], k.v["tutar"]
        self.madde(k, k.tarih, 0, [Bo(self._acilis_karsi(), t), Al("309." + kk, t)])
        self.m(k, k.tarih, ("kart", kk), t, 0)

    def _kredi_acilis(self, k):                      # M-06
        kr, t = k.v["kredi"], k.v["tutar"]
        self.madde(k, k.tarih, 0, [Bo(self._acilis_karsi(), t), Al("300." + kr, t)])
        self.m(k, k.tarih, ("kredi", kr), t, 0)

    def _stok_acilis(self, k):                       # M-07: Σ ürün (miktar × açılış birim maliyeti), ürün başına G-1
        top = 0
        for x in k.v["kalemler"]:
            deger = yuvarla(Fraction(x["miktar"]) * Fraction(x["birim_maliyet"]))
            top += deger
            self.stok_har(k, k.tarih, x["urun"], x["miktar"], deger, "acilis")
        self.madde(k, k.tarih, 0, [Bo("153", top), Al(self._acilis_karsi(), top)])

    def _evrak_hesap(self, e):
        tur, yon, durum = e["tur"], e["yon"], e["durum"]
        if yon == "alinan":
            kok = "101" if tur == "cek" else "121"
            return {"portfoy": kok + ".01", "tahsilde": kok + ".02"}.get(durum)
        if durum == "verildi":
            return "103" if tur == "cek" else "321"
        return None

    def _evrak_acilis(self, k):                      # M-08 / M-09 (602 / 770'e YAZILMAZ)
        v = k.v
        e = {"tur": v["evrak_turu"], "yon": v["yon"], "durum": v.get("durum", "portfoy" if v["yon"] == "alinan" else "verildi"),
             "tutar": v["tutar"], "cari": v.get("cari"), "banka": v.get("banka"), "ciro_cari": None, "gecmis": []}
        self.evrak[v["evrak"]] = e
        h, t = self._evrak_hesap(e), v["tutar"]
        if v["yon"] == "alinan":
            karsi = ESKI_EVRAK_ALINAN if self.kural == "2.4.9" else G
            self.madde(k, k.tarih, 0, [Bo(h, t, evrak=v["evrak"]), Al(karsi, t)])
        else:
            karsi = ESKI_EVRAK_VERILEN if self.kural == "2.4.9" else G
            self.madde(k, k.tarih, 0, [Bo(karsi, t), Al(h, t, evrak=v["evrak"])])

    def _cari_acilis(self, k):                       # M-02 / M-03 (is_opening)
        v = dict(k.v, acilis=True)
        if v.get("yon", "borc") == "borc":
            return self._borc_alacak(k, v, borc=True)
        return self._borc_alacak(k, v, borc=False)

    # ============================================================== 3-C cari düzeltme (+ KG-16)
    def _borc_yaz(self, k):
        return self._borc_alacak(k, k.v, borc=True)

    def _alacak_yaz(self, k):
        return self._borc_alacak(k, k.v, borc=False)

    def _borc_alacak(self, k, v, borc):
        c, t = v["cari"], v["tutar"]
        aciklama = v.get("aciklama", "Açılış bakiyesi" if v.get("acilis") else "")
        if self.kural == "2.4.9":
            acilis = acilis_aciklamasi(aciklama)      # 2.4.9: açılış AÇIKLAMADAN tanınır (çekirdek §1)
            karsi = ESKI_ACILIS_KARSI if acilis else (BORC_YAZ if borc else ALACAK_YAZ)
        else:
            acilis = bool(v.get("acilis"))
            if not acilis and acilis_aciklamasi(aciklama):
                # KG-16: açılış açıklamalı ama işaretsiz eski kayıt
                if self.k.KG16 == "A":
                    self.acilis_olabilir.append(k.id)
                    acilis = v.get("onay") is True
            karsi = G if acilis else (BORC_YAZ if borc else ALACAK_YAZ)
        tur = "acilis" if acilis else ("borc_yaz" if borc else "alacak_yaz")
        kk = f"{'acilis' if acilis else ('borc' if borc else 'alacak')}:{k.id}"
        s = t if borc else -t
        sup, cozulme, kalan = ([], [], t) if (borc or acilis) else self._supheliden_dus(k, c, t)   # K3: Alacak Yaz önce şüpheliden
        ch_tutar = s if (borc or acilis) else -kalan
        self.madde(k, k.tarih, 0 if acilis else 1, ([L(self.ch(c), ch_tutar, c, k=kk, tur=tur, vade=v.get("vade"))] if ch_tutar else [])
                   + sup + [L(karsi, -s)], tur="cari_acilis" if acilis else k.tur)
        self.m(k, k.tarih, ("cari", c), s, 0 if acilis else 1)
        self._cozulmeler(k, c, cozulme)

    # ============================================================== 3-F fatura
    def _fatura_stok(self, k, isaret, tur):
        for x in k.v.get("kalemler", []):
            if x.get("urun"):
                deger = None
                if tur in ("alis", "alis_iade"):
                    deger = x.get("M", k.v["M"] if len(k.v["kalemler"]) == 1 else None)
                    if deger is None:
                        raise AssertionError("senaryo hatası: çok kalemli stok alışında kalem M'si gerekir")
                    deger = deger if tur == "alis" else -deger
                self.stok_har(k, k.tarih, x["urun"], isaret * Fraction(x["miktar"]), deger, tur)

    def _satis_faturasi(self, k):                    # F-01, F-02, F-03, F-04 (stoklu satışta maliyet maddesi YOK)
        v = k.v
        c, M, K, T = v["cari"], v["M"], v.get("K", 0), v.get("T", 0)
        gelir = IHRACAT_GELIR if v.get("ihracat") else "600"
        ch = M + K - T
        self.madde(k, k.tarih, 1, [Bo(self.ch(c), ch, c, k="fatura:" + k.id, tur="fatura", vade=v.get("vade") or k.tarih),
                                   Al(gelir, M), Al("391", K - T)])
        self.m(k, k.tarih, ("cari", c), ch)
        self._fatura_stok(k, -1, "satis")

    def _alis_faturasi(self, k):                     # F-05, F-06 (S-01)
        v = k.v
        c, M, K, T, S = v["cari"], v["M"], v.get("K", 0), v.get("T", 0), v.get("S", 0)
        if v.get("fatura_turu", "stok") == "stok":
            h = "153"
            self._fatura_stok(k, +1, "alis")
        else:
            h = gider_hesabi(v)
        ch = M + K - T - S
        self.madde(k, k.tarih, 1, [Bo(h, M), Bo("191", K, indirim_ayi=v.get("indirim_ayi")),
                                   Al(self.ch(c), ch, c, k="fatura:" + k.id, tur="fatura", vade=v.get("vade") or k.tarih),
                                   Al("360", T + S)])
        self.m(k, k.tarih, ("cari", c), -ch)

    def _satis_iade_faturasi(self, k):               # F-07 / F-09 (KG-8 A: 191)
        v = k.v
        c, M, K = v["cari"], v["M"], v.get("K", 0)
        para = v.get("para_iadesi")                  # karar (4): parası geri verilen iade (iade + T-09) kartı DEĞİŞTİRMEZ
        if para:
            link = "iade_para:" + k.id               # iade kendi para iadesi satırına bağlı (cari içinde birbirini kapatır)
        else:
            link = "fatura:" + v["asil_fatura"] if v.get("asil_fatura") else None
        sup, cozulme, kalan = self._supheliden_dus(k, c, M + K)   # K3: satıştan iade önce şüpheliden
        self.madde(k, k.tarih, 1, [Bo("610", M), Bo("191", K)] + sup
                   + ([Al(self.ch(c), kalan, c, k="iade:" + k.id, tur="iade", link=link)] if kalan else []))
        self.m(k, k.tarih, ("cari", c), -(M + K))
        self._cozulmeler(k, c, cozulme)
        self._fatura_stok(k, +1, "satis_iade")
        if para:                                     # T-09 müşteriye para iadesi
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), M + K, c, k="iade_para:" + k.id, tur="odeme"),
                                       self.oy(k, para, M + K, False)], tur="iade_para", alt=1)
            self.m(k, k.tarih, ("cari", c), M + K)

    def _alis_iade_faturasi(self, k):                # F-08
        v = k.v
        c, M, K = v["cari"], v["M"], v.get("K", 0)
        link = "fatura:" + v["asil_fatura"] if v.get("asil_fatura") else None
        h = "153" if v.get("fatura_turu", "stok") == "stok" else gider_hesabi(v)
        self.madde(k, k.tarih, 1, [Bo(self.ch(c), M + K, c, k="iade:" + k.id, tur="iade", link=link), Al(h, M), Al("391", K)])
        self.m(k, k.tarih, ("cari", c), M + K)
        if h == "153":
            self._fatura_stok(k, -1, "alis_iade")

    def _esmm(self, k):                              # F-10
        v = k.v
        c, br, K, T, S = v["cari"], v["brut"], v.get("K", 0), v.get("T", 0), v.get("S", 0)
        ch = br - S + K - T
        self.madde(k, k.tarih, 1, [Bo(self.ch(c), ch, c, k="fatura:" + k.id, tur="fatura", vade=v.get("vade") or k.tarih),
                                   Bo("193", S), Al("600", br), Al("391", K - T)])
        self.m(k, k.tarih, ("cari", c), ch)

    def _gelen_smm(self, k):                         # F-11
        v = k.v
        c, br, K, T, S = v["cari"], v["brut"], v.get("K", 0), v.get("T", 0), v.get("S", 0)
        ch = br + K - S - T
        self.madde(k, k.tarih, 1, [Bo("770", br), Bo("191", K, indirim_ayi=v.get("indirim_ayi")),
                                   Al(self.ch(c), ch, c, k="fatura:" + k.id, tur="fatura", vade=v.get("vade") or k.tarih),
                                   Al("360", S + T)])
        self.m(k, k.tarih, ("cari", c), -ch)

    def _mahsup(self, k):                            # F-16: madde yok; açık kalem eşleşmesi
        v = k.v
        self.mahsup.append((k.tarih, k.seq, "fatura:" + v["fatura1"], "fatura:" + v["fatura2"], v["tutar"], k.id))   # kimlik: S19 yazılış kilidi

    def _taslak(self, k):                            # F-13
        pass

    # ============================================================== 3-T tahsilat / ödeme
    def _fatura_odemesi_gecersiz(self, v):
        if v.get("fatura") and v.get("fatura_odemesi"):
            f = self.d.kaynaklar.get(v["fatura"])
            return f is None or f.durum != "aktif"       # F-15: iptal edilen faturanın ödemeleri yok sayılır
        return False

    def _link(self, v):
        if v.get("fatura"):
            return "fatura:" + v["fatura"]
        if v.get("taksit_karti"):                   # M1e: kart tahsilatı kartın (vadesi ilk gelen) taksitini kapatır
            return "kart:" + v["taksit_karti"]
        return None

    def _tahsilat(self, k):                          # T-01…T-04, T-10, T-11, T-12, T-13, H-04
        v = k.v
        if self._fatura_odemesi_gecersiz(v):
            return
        c, yol, t = v["cari"], v["yol"], v["tutar"]
        link = self._link(v)
        if yol in ("nakit", "havale"):
            oy = self.oy(k, yol, t, True)
        elif yol == "pos":                           # T-03 brüt; komisyon ve valör §3-D (KG-6)
            p, kom = v["pos"], v.get("komisyon", 0)
            # S21 A (README Y20): nominal valör hafta sonu / tam gün resmî tatilse sonraki iş günü; donmuş 2.4.9 türetmesinde yalnız hafta sonu (Y22)
            valor = pos_etkin_valor(v.get("valor") or k.tarih, tatil=self.kural != "2.4.9")
            self.pos[k.id] = {"pos": p, "brut": t, "kom": kom, "valor": valor, "iade": 0, "kom_iade": 0, "cari": c, "satis": k.tarih}
            oy = Bo("108." + p, t)
            self.m(k, k.tarih, ("pos", p), t)
        elif yol in ("cek", "senet"):                # T-04 / Ç-01
            e = v["evrak"]
            self.evrak[e] = {"tur": yol, "yon": "alinan", "durum": "portfoy", "tutar": t, "cari": c, "banka": None,
                             "ciro_cari": None, "gecmis": [], "kaynak": k.id, "kart_tahsilati": bool(v.get("taksit_karti"))}
            oy = Bo(("101" if yol == "cek" else "121") + ".01", t, evrak=e)
        elif yol == "kart":                          # T-11 Kredi Kartına İade
            kk = v["kart"]
            oy = Bo("309." + kk, t)
            self.m(k, k.tarih, ("kart", kk), -t)
        else:
            raise AssertionError(f"senaryo hatası: yol {yol}")
        # T-13 / J-03 / K3: şüpheli kaydı açık müşteride serbest tahsilat önce şüpheliden; "Normal Cari Hesaba İşle", satış faturasının
        # peşini ve Kapatılacak Fatura bağlı tahsilat 120'de kalır; taksit tahsilatı kart tarihi kapısıyla (Mevcut Borç kartı kapısız)
        uygun = not v.get("normal_cari") and not v.get("fatura")
        kart_t = None
        if v.get("taksit_karti"):
            kt = self.kart.get(v["taksit_karti"])
            if kt is not None and kt.get("ilk_kaynak", kt["kaynak"]) != "mevcut_borc":
                kart_t = kt["tarih"]
        sup, cozulme, kalan = self._supheliden_dus(k, c, t, kart_t) if uygun else ([], [], t)
        if not uygun and self._s14_aday_mi(k, c, yol):    # S14 A: bağlı çek / senet bağlı faturanın durduğu hesaptan (README Y1–Y4)
            sup, cozulme, kalan = self._s14_dus(k, c, t)
        self.madde(k, k.tarih, 1, [oy] + sup + ([Al(self.ch(c), kalan, c, k="tahsilat:" + k.id, tur="tahsilat", link=link)] if kalan else []))
        self.m(k, k.tarih, ("cari", c), -t)
        self._cozulmeler(k, c, cozulme)
        if yol == "pos" and self.k.KG6 == "A" and v.get("komisyon"):   # KG-6 A: komisyon satış (çekim) günü gider
            self.madde(k, k.tarih, 1, [Bo(POS_KOMISYON, v["komisyon"]), Al("108." + v["pos"], v["komisyon"])], tur="pos_komisyon", alt=2)
            self.m(k, k.tarih, ("pos", v["pos"]), -v["komisyon"])
        if v.get("taksit_karti"):
            self.m(k, k.tarih, ("taksit_odenen", v["taksit_karti"]), t)

    def _odeme(self, k):                             # T-05…T-09, H-05
        v = k.v
        if self._fatura_odemesi_gecersiz(v):
            return
        c, yol, t = v["cari"], v["yol"], v.get("tutar")
        link = self._link(v)
        if yol in ("nakit", "havale"):
            oy = self.oy(k, yol, t, False)
        elif yol == "kart":                          # T-06
            kk = v["kart"]
            oy = Al("309." + kk, t)
            self.m(k, k.tarih, ("kart", kk), t)
        elif yol in ("cek", "senet"):                # T-07 / Ç-09
            e = v["evrak"]
            self.evrak[e] = {"tur": yol, "yon": "verilen", "durum": "verildi", "tutar": t, "cari": c, "banka": v.get("banka"),
                             "ciro_cari": None, "gecmis": []}
            oy = Al("103" if yol == "cek" else "321", t, evrak=e)
        elif yol == "ciro":                          # T-08 / Ç-06
            e = self.evrak[v["evrak"]]
            h = self._evrak_hesap(e)
            if e["durum"] != "portfoy":
                raise AssertionError("ciro yalnız portföydeki evrak")
            t = e["tutar"]
            oy = Al(h, t, evrak=v["evrak"])
            e["gecmis"].append((k.id, e["durum"]))
            e["durum"], e["ciro_cari"], e["ciro_kaynak"] = "ciro", c, k.id
        else:
            raise AssertionError(f"senaryo hatası: yol {yol}")
        self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="odeme:" + k.id, tur="odeme", link=link), oy])
        self.m(k, k.tarih, ("cari", c), t)
        if v.get("taksit_karti"):
            self.m(k, k.tarih, ("taksit_odenen", v["taksit_karti"]), -t)

    def _carisiz_gelir_hesabi(self, kayit):
        d = self.k.KG3
        if d == "KITAP":                             # geçersiz: kitabın §9 A'sı
            return CARISIZ_GELIR
        if d == "B":                                 # geçersiz: kitabın B'si
            return CARISIZ_PASIF
        return CARISIZ_PASIF if kayit else CARISIZ_GELIR   # A (onaylanan): kayıt tahsilatı 336.90, Kasa girişi 649.90

    def _kayit_tahsilati(self, k):                   # T-14 (KG-3)
        t = k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("100", t), Al(self._carisiz_gelir_hesabi(True), t)])
        self.m(k, k.tarih, ("kasa",), t)

    # ============================================================== 3-K kasa ve banka
    def _kasa_giris(self, k):                        # K-01 (KG-3)
        t = k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("100", t), Al(self._carisiz_gelir_hesabi(False), t)])
        self.m(k, k.tarih, ("kasa",), t)

    def _kasa_cikis(self, k):                        # K-02
        t = k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo(KASA_GIDER, t), Al("100", t)])
        self.m(k, k.tarih, ("kasa",), -t)

    def _bankadan_kasaya(self, k):                   # K-03
        b, t = k.v["banka"], k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("100", t), Al("102." + b, t)])
        self.m(k, k.tarih, ("kasa",), t)
        self.m(k, k.tarih, ("banka", b), -t)

    def _kasadan_bankaya(self, k):                   # K-04
        b, t = k.v["banka"], k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("102." + b, t), Al("100", t)])
        self.m(k, k.tarih, ("kasa",), -t)
        self.m(k, k.tarih, ("banka", b), t)

    def _banka_transfer(self, k):                    # K-05, K-06, K-07
        v = k.v
        g, a, t = v["gonderen"], v["alici"], v["tutar"]
        valor = v.get("valor") or k.tarih
        if valor > k.tarih:
            self.madde(k, k.tarih, 1, [Bo(YOLDAKI, t), Al("102." + g, t)])
            self.madde(k, valor, 1, [Bo("102." + a, t), Al(YOLDAKI, t)], tur="transfer_valor", alt=1)
            self.m(k, k.tarih, ("yoldaki",), t)
            self.m(k, valor, ("yoldaki",), -t)
            self.yoldaki[k.id] = {"alici": a, "tutar": t, "valor": valor, "cikis": k.tarih}
        else:
            self.madde(k, k.tarih, 1, [Bo("102." + a, t), Al("102." + g, t)])
        self.m(k, k.tarih, ("banka", g), -t)
        self.m(k, valor, ("banka", a), t)
        ucret = v.get("ucret", 0) + v.get("bsmv", 0)
        if ucret:
            self.madde(k, k.tarih, 1, [Bo(BANKA_MASRAF, ucret), Al("102." + g, ucret)], tur="transfer_ucreti", alt=2)
            self.m(k, k.tarih, ("banka", g), -ucret)

    def _banka_masraf(self, k):                      # K-08
        b, t = k.v["banka"], k.v["tutar"] + k.v.get("bsmv", 0)
        self.madde(k, k.tarih, 1, [Bo(BANKA_MASRAF, t), Al("102." + b, t)])
        self.m(k, k.tarih, ("banka", b), -t)

    def _banka_masraf_faturali(self, k):             # K-09
        b, M, K = k.v["banka"], k.v["M"], k.v.get("K", 0)
        self.madde(k, k.tarih, 1, [Bo(BANKA_MASRAF, M), Bo("191", K, indirim_ayi=k.v.get("indirim_ayi")), Al("102." + b, M + K)])
        self.m(k, k.tarih, ("banka", b), -(M + K))

    def _faiz_geliri(self, k):                       # K-10
        b, br, st = k.v["banka"], k.v["brut"], k.v.get("stopaj", 0)
        self.madde(k, k.tarih, 1, [Bo("102." + b, br - st), Bo("193", st), Al("642", br)])
        self.m(k, k.tarih, ("banka", b), br - st)

    def _faiz_gideri(self, k):                       # K-11
        b, t = k.v["banka"], k.v["tutar"] + k.v.get("bsmv", 0)
        self.madde(k, k.tarih, 1, [Bo("780", t), Al("102." + b, t)])
        self.m(k, k.tarih, ("banka", b), -t)

    def _banka_diger_gelir(self, k):                 # K-12
        b, t = k.v["banka"], k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("102." + b, t), Al(BANKA_DIGER_GELIR, t)])
        self.m(k, k.tarih, ("banka", b), t)

    def _banka_diger_gider(self, k):                 # K-12
        b, t = k.v["banka"], k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo(BANKA_DIGER_GIDER, t), Al("102." + b, t)])
        self.m(k, k.tarih, ("banka", b), -t)

    def _planli_islem(self, k):                      # K-13
        pass

    def _hesapsiz_hareket(self, k):                  # K-14: banka tarafı yerine G
        c, t = k.v["cari"], k.v["tutar"]
        s = -t if k.v.get("yon", "tahsilat") == "tahsilat" else t
        sup, cozulme, kalan = self._supheliden_dus(k, c, t) if s < 0 else ([], [], t)
        ch_tutar = -kalan if s < 0 else s
        self.madde(k, k.tarih, 1, ([L(self.ch(c), ch_tutar, c, k="hesapsiz:" + k.id, tur="tahsilat" if s < 0 else "odeme")] if ch_tutar else [])
                   + sup + [L(G, -s)])
        self.m(k, k.tarih, ("cari", c), s)
        self._cozulmeler(k, c, cozulme)

    def _kart_borcuna_aktar(self, k):                # K-15
        c, kk, t = k.v["cari"], k.v["kart"], k.v["tutar"]
        if k.v.get("acilistan_once"):
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="odeme:" + k.id, tur="odeme"), Al(G, t)])
        else:
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="odeme:" + k.id, tur="odeme"), Al("309." + kk, t)])
            self.m(k, k.tarih, ("kart", kk), t)
        self.m(k, k.tarih, ("cari", c), t)

    # ============================================================== 3-D POS, kart, kredi
    def _pos_aktar(self, k):                         # D-01 "Şimdi Aktar"
        it = self.pos.get(k.v["tahsilat"])
        if it and k.tarih < it["valor"]:
            it["valor"] = k.tarih

    def _pos_valorleri(self):                        # D-01 (KG-6)
        for kid, it in self.pos.items():
            if it.get("gecersiz"):
                continue
            p = it["pos"]
            b = self.d.tanim["poslar"][p]["banka"]
            kom_kalan = it["kom"] - it["kom_iade"]
            seq = self.d.kaynaklar[kid].seq if kid in self.d.kaynaklar else it.get("seq", 0)
            kk = Kaynak(kid, "pos_valor", it["valor"], seq, {})
            if self.k.KG6 == "A":
                net = it["brut"] - it["iade"] - kom_kalan
                self.madde(kk, it["valor"], 1, [Bo("102." + b, net), Al("108." + p, net)], tur="pos_valor", alt=5)
                self.m(kk, it["valor"], ("pos", p), -net)
                self.m(kk, it["valor"], ("banka", b), net)
            else:
                net = it["brut"] - it["iade"] - kom_kalan
                self.madde(kk, it["valor"], 1, [Bo("102." + b, net), Bo(POS_KOMISYON, kom_kalan), Al("108." + p, it["brut"] - it["iade"])],
                           tur="pos_valor", alt=5)
                self.m(kk, it["valor"], ("pos", p), -(it["brut"] - it["iade"]))
                self.m(kk, it["valor"], ("banka", b), net)

    def _pos_komisyon_faturasi(self, k):             # D-02
        v = k.v
        if v.get("karsi", "komisyon") == "cari":
            c = v["cari"]
            self.madde(k, k.tarih, 1, [Bo("191", v["K"], indirim_ayi=v.get("indirim_ayi")),
                                       Al(self.ch(c), v["K"], c, k="fatura:" + k.id, tur="fatura")])
            self.m(k, k.tarih, ("cari", c), -v["K"])
        else:
            self.madde(k, k.tarih, 1, [Bo("191", v["K"], indirim_ayi=v.get("indirim_ayi")), Al(POS_KOMISYON, v["K"])])

    def _pos_iade(self, k):                          # D-04 (+ KG-20 A komisyon iadesi yalnız banka iade ederse)
        v = k.v
        it = self.pos[v["tahsilat"]]
        c, t, p = v["cari"], v["tutar"], it["pos"]
        if k.tarih < it["valor"]:                    # geçmemiş
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="odeme:" + k.id, tur="odeme"), Al("108." + p, t)])
            self.m(k, k.tarih, ("pos", p), -t)
            it["iade"] += t
            ki = v.get("komisyon_iadesi", 0)
            if ki:
                it["kom_iade"] += ki
                if self.k.KG6 == "A":
                    self.madde(k, k.tarih, 1, [Bo("108." + p, ki), Al(POS_KOMISYON, ki)], tur="pos_komisyon_iadesi", alt=1)
                    self.m(k, k.tarih, ("pos", p), ki)
        else:                                        # geçmiş
            b = self.d.tanim["poslar"][p]["banka"]
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="odeme:" + k.id, tur="odeme"), Al("102." + b, t)])
            self.m(k, k.tarih, ("banka", b), -t)
        self.m(k, k.tarih, ("cari", c), t)

    def _kart_harcama(self, k):                      # D-05
        v = k.v
        kk, t = v["kart"], v["tutar"]
        if v.get("cari"):
            c = v["cari"]
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="odeme:" + k.id, tur="odeme"), Al("309." + kk, t)])
            self.m(k, k.tarih, ("cari", c), t)
        else:
            self.madde(k, k.tarih, 1, [Bo("153", t), Al("309." + kk, t)])
            self.stok_har(k, k.tarih, v["urun"], v["miktar"], t, "alis")
        self.m(k, k.tarih, ("kart", kk), t)

    def _kart_borc_odeme(self, k):                   # D-06
        kk, b, t = k.v["kart"], k.v["banka"], k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("309." + kk, t), Al("102." + b, t)])
        self.m(k, k.tarih, ("kart", kk), -t)
        self.m(k, k.tarih, ("banka", b), -t)

    def _kart_faiz(self, k):                         # D-07
        kk, t = k.v["kart"], k.v["tutar"] + k.v.get("bsmv", 0)
        self.madde(k, k.tarih, 1, [Bo("780", t), Al("309." + kk, t)])
        self.m(k, k.tarih, ("kart", kk), t)

    def _kredi_kullan(self, k):                      # D-08
        kr, b, t = k.v["kredi"], k.v["banka"], k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("102." + b, t), Al("300." + kr, t)])
        self.m(k, k.tarih, ("kredi", kr), t)
        self.m(k, k.tarih, ("banka", b), t)

    def _kredi_odeme(self, k):                       # D-09 + D-10
        kr, b = k.v["kredi"], k.v["banka"]
        ap, fz = k.v.get("anapara", 0), k.v.get("faiz", 0)
        self.madde(k, k.tarih, 1, [Bo("300." + kr, ap), Bo("780", fz), Al("102." + b, ap + fz)])
        self.m(k, k.tarih, ("kredi", kr), -ap)
        self.m(k, k.tarih, ("banka", b), -(ap + fz))

    # ============================================================== 3-Ç çek ve senet
    def _ev(self, k):
        e = self.evrak.get(k.v["evrak"])
        if e is None:
            raise AssertionError(f"evrak yok {k.v['evrak']}")
        e["gecmis"].append((k.id, e["durum"]))
        return e

    def _evrak_tahsile_ver(self, k):                 # Ç-02
        e = self._ev(k)
        h1 = self._evrak_hesap(e)
        e["durum"], e["banka"] = "tahsilde", k.v["banka"]
        self.madde(k, k.tarih, 1, [Bo(self._evrak_hesap(e), e["tutar"], evrak=k.v["evrak"]), Al(h1, e["tutar"], evrak=k.v["evrak"])])

    def _evrak_bankadan_geri_al(self, k):            # Ç-03
        e = self._ev(k)
        h1 = self._evrak_hesap(e)
        e["durum"] = "portfoy"
        self.madde(k, k.tarih, 1, [Bo(self._evrak_hesap(e), e["tutar"], evrak=k.v["evrak"]), Al(h1, e["tutar"], evrak=k.v["evrak"])])

    def _evrak_tahsil(self, k):                      # Ç-04 / Ç-05
        e = self._ev(k)
        h1 = self._evrak_hesap(e)
        t = e["tutar"]
        if e["durum"] == "tahsilde":
            b = e["banka"]
            oy = Bo("102." + b, t)
            self.m(k, k.tarih, ("banka", b), t)
        elif k.v.get("yol", "kasa") == "kasa":
            oy = Bo("100", t)
            self.m(k, k.tarih, ("kasa",), t)
        else:
            b = k.v["banka"]
            oy = Bo("102." + b, t)
            self.m(k, k.tarih, ("banka", b), t)
        e["durum"] = "tahsil"
        self.madde(k, k.tarih, 1, [oy, Al(h1, t, evrak=k.v["evrak"])])

    def _evrak_karsiliksiz(self, k):                 # Ç-07 / Ç-08
        e = self._ev(k)
        c, t = e["cari"], e["tutar"]
        # S8 A / EK-2 K-1: satırlar evrakın tahsilat (ve ciro ödemesi) kaynağını taşır; kuyruk o kalemleri geri alır
        ek = {"evrak_kaynak": e.get("kaynak"), "kart_tahsilati": e.get("kart_tahsilati")}
        if e["durum"] == "ciro":
            tc = e["ciro_cari"]
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="karsiliksiz:" + k.id, tur="karsiliksiz", **ek),
                                       Al(self.ch(tc), t, tc, k="ciro_donus:" + k.id, tur="ciro_donus", ciro_kaynak=e.get("ciro_kaynak"))])
            self.m(k, k.tarih, ("cari", c), t)
            self.m(k, k.tarih, ("cari", tc), -t)
        else:
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="karsiliksiz:" + k.id, tur="karsiliksiz", **ek),
                                       Al(self._evrak_hesap(e), t, evrak=k.v["evrak"])])
            self.m(k, k.tarih, ("cari", c), t)
        e["durum"] = "karsiliksiz"

    def _verilen_evrak_ode(self, k):                 # Ç-10
        e = self._ev(k)
        t = e["tutar"]
        if k.v.get("yol", "havale") == "nakit":
            oy = Al("100", t)
            self.m(k, k.tarih, ("kasa",), -t)
        else:
            b = k.v.get("banka") or e["banka"]
            oy = Al("102." + b, t)
            self.m(k, k.tarih, ("banka", b), -t)
        self.madde(k, k.tarih, 1, [Bo(self._evrak_hesap(e), t, evrak=k.v["evrak"]), oy])
        e["durum"] = "odendi"

    def _verilen_evrak_geri_al(self, k):             # Ç-11
        e = self._ev(k)
        c, t = e["cari"], e["tutar"]
        self.madde(k, k.tarih, 1, [Bo(self._evrak_hesap(e), t, evrak=k.v["evrak"]),
                                   Al(self.ch(c), t, c, k="evrak_iade:" + k.id, tur="evrak_iade")])
        self.m(k, k.tarih, ("cari", c), -t)
        e["durum"] = "iade"

    # ============================================================== 3-H taksit
    def _kart_kaydi(self, k, v, kaynak, sinif, odenen=0):
        return {"cari": v["cari"], "toplam": v["toplam"], "taksitler": v.get("taksitler", []), "kaynak": kaynak,
                "fatura": v.get("fatura"), "kapali": False, "kapama": None, "tarih": k.tarih, "seq": k.seq, "sinif": sinif,
                "odenen": odenen}

    def _taksit_karti(self, k):                      # H-01, H-02, H-03 (TYK: kart alttaki borcu tüketir — EK-1 M1e)
        v = k.v
        if v["kaynak"] == "fatura":                  # EK-2B 35: faturanın KENDİ kartı fatura silinince / iptal edilince faturayla kalkar
            f = self.d.kaynaklar.get(v.get("fatura"))
            if f is None or f.durum != "aktif":
                self._kart_iptal(k, v, f)
                return
        self.kart[k.id] = self._kart_kaydi(k, v, v["kaynak"], 1)
        if v["kaynak"] == "yeni_borc":               # H-03 → KG-2 (stok kartı yok → iki dalda da 600.90); kuyruğa yalnız taksitler
            c, t = v["cari"], v["toplam"]
            ilk = (v.get("taksitler") or [{"vade": k.tarih}])[0]["vade"]
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="taksit:" + k.id, tur="taksit", vade=ilk, kart=k.id), Al(BELGESIZ_GELIR, t)])
            self.m(k, k.tarih, ("cari", c), t)

    def _kart_iptal(self, k, v, f):
        """S15 A (README Y8, Y9): faturası İPTAL edilen kartta tahsilat varsa kart KAPANIR (taksitsiz, görünür); tahsilatların bağı çözülür (hedefi yok →
        bağsız alacak, TYK'da kendi tarihinde). Tahsilatsız kart ya da silinen fatura: kart kalkar (EK-2B 35 (1))."""
        if f is not None and f.durum == "iptal" and any(x.tur == "tahsilat" and x.durum == "aktif" and x.v.get("taksit_karti") == k.id
                                                       for x in self.d.kaynaklar.values()):
            self.kart_iptal[k.id] = {"cari": v["cari"], "tarih": k.tarih, "seq": k.seq}

    def _taksit_excel(self, k):                      # H-06 / M-10 (KG-5)
        v = k.v
        c, T, P = v["cari"], v["toplam"], v.get("odenen", 0)
        self.kart[k.id] = self._kart_kaydi(k, v, "excel", 0, P)
        ilk = (v.get("taksitler") or [{"vade": k.tarih}])[0]["vade"]
        if self.k.KG5 == "A":
            self.madde(k, k.tarih, 0, [Bo(self.ch(c), T - P, c, k="taksit:" + k.id, tur="taksit", vade=ilk, kart=k.id), Al(G, T - P)])
        else:
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), T, c, k="taksit:" + k.id, tur="taksit", vade=ilk, kart=k.id), Al(BELGESIZ_GELIR, T)])
            self.madde(k, k.tarih, 0, [Bo(G, P), Al(self.ch(c), P, c, k="excel_odenen:" + k.id, tur="tahsilat", link="kart:" + k.id)],
                       tur="taksit_excel_odenen", alt=1)
        self.m(k, k.tarih, ("cari", c), T - P, 0)
        self.m(k, k.tarih, ("taksit_odenen", k.id), P, 0)

    def _taksit_kapat(self, k):                      # H-07 (KG-23 A + karar (6): kalan borçta kalır; EK-1 M1d: kapatma tarihli tek kalem)
        kt = self.kart.get(k.v["kart"])
        if kt is not None and not kt["kapali"]:
            kt["kapali"] = True
            kt["kapama"] = (k.tarih, k.seq)
            # karar (6) "önceden kapatılmış kartlar olduğu gibi kalır": 2.5.0'dan önce kapatılmış kart (eski) ve donmuş 2.4.9 türetmesi —
            # kalan 689'a gider, cariden düşer (EK-2B K-3 B tarifi; şüpheli caride K3 ile önce 128)
            if k.v.get("eski") or self.kural == "2.4.9":
                kid, c = k.v["kart"], kt["cari"]
                odenen = sum(d for (_, _, _, anah, d, _) in self.mod if anah == ("taksit_odenen", kid))
                kalan = kt["toplam"] - odenen
                if kalan > 0:
                    kart_t = None if kt.get("ilk_kaynak", kt["kaynak"]) == "mevcut_borc" else kt["tarih"]
                    sup, cozulme, kal = self._supheliden_dus(k, c, kalan, kart_t)
                    self.madde(k, k.tarih, 1, [Bo("689", kalan)] + sup
                               + ([Al(self.ch(c), kal, c, k="vazgec:" + k.id, tur="kart_vazgec", link="kart:" + kid)] if kal else []),
                               tur="kart_vazgec")
                    self.m(k, k.tarih, ("cari", c), -kalan)
                    self._cozulmeler(k, c, cozulme)

    # ============================================================== 3-V vergi
    def _vergi_odeme(self, k):                       # V-02, V-04 (KG-13 A: 360)
        t = k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("360", t), self.oy(k, k.v.get("yol", "havale"), t, False)])

    def _gecikme_zammi(self, k):                     # V-03
        t = k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("689", t), self.oy(k, k.v.get("yol", "havale"), t, False)])

    # ============================================================== 3-Ş şüpheli alacak
    def _supheliye_al(self, k):                      # J-01 (kabul K1): her işlem ayrı şüpheli KAYDI
        c, t = k.v["cari"], k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("128", t, c), Al(self.ch(c), t, c, k="supheli:" + k.id, tur="supheli_transfer", kayit=k.id)])
        self.supheli.setdefault(c, []).append({"id": k.id, "tarih": k.tarih, "kalan": t, "karsilik": 0})

    @staticmethod
    def _kayit_gerek(v):
        if not v.get("kayit"):                       # EK-2 31: işlemler kayıt başınadır; olay dili kaydı AÇIKÇA taşır (varsayılan yok)
            raise AssertionError("senaryo hatası: karşılık / değersiz / çıkar olayı 'kayit' (şüpheli kaydı kimliği) taşımalı")
        return v["kayit"]

    def karsilik_hedefi(self, c, kayit):
        return next((r for r in self.supheli.get(c, []) if r["kalan"] > 0 and r["id"] == kayit), None)

    def _karsilik_ayir(self, k):                     # J-02 (kabul K5: kayıt başına karşılık ≤ kalan)
        c, t = k.v["cari"], k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("654", t), Al("129", t, c)])
        self.karsilik_hedefi(c, self._kayit_gerek(k.v))["karsilik"] += t

    def _acik_kayitlar(self, k):
        kayit = self._kayit_gerek(k.v)
        return [r for r in self.supheli.get(k.v["cari"], []) if r["kalan"] > 0 and r["id"] == kayit]

    def _degersiz_yaz(self, k):                      # J-05 (KG-21 A: 659; kabul K7: karşılık önce)
        c = k.v["cari"]
        for i, r in enumerate(self._acik_kayitlar(k)):
            K, P = r["kalan"], r["karsilik"]
            self.supheli_olay.append((k.tarih, k.seq, c, "degersiz", K, r["id"], None))
            self.madde(k, k.tarih, 1, [Bo("129", P, c), Bo(DEGERSIZ_KALAN, K - P), Al("128", K, c)], alt=i)
            self.m(k, k.tarih, ("cari", c), -K)
            r["kalan"] = r["karsilik"] = 0

    def _supheliden_cikar(self, k):                  # J-06 (kabul K4)
        c = k.v["cari"]
        for i, r in enumerate(self._acik_kayitlar(k)):
            K, P = r["kalan"], r["karsilik"]
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), K, c, k="supheliden_cikar:" + k.id, tur="supheliden_cikar", kayit=r["id"]),
                                       Al("128", K, c)], alt=2 * i)
            if P:
                self.madde(k, k.tarih, 1, [Bo("129", P, c), Al(KARSILIK_COZULME, P)], tur="karsilik_cozulme", alt=2 * i + 1)
            r["kalan"] = r["karsilik"] = 0

    # ============================================================== 3-S stok
    def _kdv_ic(self, k):
        """KG-2 B: stok kartında KDV oranı varsa iç yüzde KDV."""
        oran = self.d.tanim["urunler"].get(k.v["urun"], {}).get("kdv_orani")
        if self.k.KG2 == "B" and oran:
            return yuvarla(Fraction(k.v["tutar"]) * oran / (100 + oran))
        return 0

    def _stok_giris(self, k):                        # S-02 (KDV ayrılmaz)
        v = k.v
        self.madde(k, k.tarih, 1, [Bo("153", v["tutar"]), self.karsi(k, v["tutar"], False)])
        self.stok_har(k, k.tarih, v["urun"], v["miktar"], v["tutar"], "alis")

    def _stok_cikis_satis(self, k):                  # S-03 (KG-2)
        v = k.v
        kdv = self._kdv_ic(k)
        self.madde(k, k.tarih, 1, [self.karsi(k, v["tutar"], True), Al(BELGESIZ_GELIR, v["tutar"] - kdv), Al("391", kdv)])
        self.stok_har(k, k.tarih, v["urun"], -Fraction(v["miktar"]), None, "satis")

    def _stok_musteri_iadesi(self, k):               # S-04 (KG-2 ile aynı KDV kuralı; KG-8 A 191)
        v = k.v
        kdv = self._kdv_ic(k)
        link = "kart_kucult:" + v["taksit_karti"] if v.get("taksit_karti") else None   # EK-2B 32 (a): borçtan düşülen iade kartı küçültür
        self.madde(k, k.tarih, 1, [Bo(BELGESIZ_IADE, v["tutar"] - kdv), Bo("191", kdv), self.karsi(k, v["tutar"], False, link)])
        self.stok_har(k, k.tarih, v["urun"], Fraction(v["miktar"]), None, "satis_iade")

    def _stok_tedarikci_iadesi(self, k):             # S-05
        v = k.v
        self.madde(k, k.tarih, 1, [self.karsi(k, v["tutar"], True), Al("153", v["tutar"])])
        self.stok_har(k, k.tarih, v["urun"], -Fraction(v["miktar"]), -v["tutar"], "alis_iade")

    def _stok_duzeltme(self, k):                     # S-06: madde YOK; fark dönem sonu değerlemesine
        self.stok_har(k, k.tarih, k.v["urun"], Fraction(k.v["miktar"]), None, "duzeltme")

    # ============================================================== 3-R ters kayıt
    def _ters(self, k):                              # R-01 (KG-18 A: ters kaydın girildiği gün)
        hedef = k.v["hedef"]
        for i, m0 in enumerate(list(self._emit.get(hedef, []))):
            # S4 A: 191 / 391'i etkileyen ters kayıt KENDİ tarihinin ayına etiketlenir
            sat = kdv_etiketle([L(s["h"], s["a"] - s["b"], s["c"], **(s["e"] or {})) for s in m0.satirlar], k.tarih, zorla=k.tarih[:7])
            self.madde(k, k.tarih, 1, sat, tur="ters", alt=i)
        for (t0, anah, d) in list(self._modk.get(hedef, [])):
            self.m(k, k.tarih, anah, -d)

    # ============================================================== devir açılış kaynakları (N-09…N-12; açılış sınıfı)
    def _devir_kasa(self, k):
        t = k.v["tutar"]
        self.madde(k, k.tarih, 0, [L("100", t), L(G, -t)])
        self.m(k, k.tarih, ("kasa",), t, 0)

    def _devir_cari(self, k):                        # EK-1 M3 (KG-17 A): defterde cari başına TEK satır = K bakiyesi (açık kalemler dahil);
        c, t = k.v["cari"], k.v["tutar"]             # açık kalemler (M2, N-10: gelir / gider DEĞİL) yalnız cari modülünde (kuyrukta)
        self.madde(k, k.tarih, 0, [L(self.ch(c), t, c, k="devir:" + c, tur="devir_cari"), L(G, -t)])
        self.m(k, k.tarih, ("cari", c), t, 0)
        self.devir_kalemleri[c] = k.v.get("kalemler", [])

    def _devir_banka(self, k):
        b, t = k.v["banka"], k.v["tutar"]
        self.madde(k, k.tarih, 0, [L("102." + b, t), L(G, -t)])
        self.m(k, k.tarih, ("banka", b), t, 0)

    def _devir_kart(self, k):
        kk, t = k.v["kart"], k.v["tutar"]
        self.madde(k, k.tarih, 0, [L(G, t), L("309." + kk, -t)])
        self.m(k, k.tarih, ("kart", kk), t, 0)

    def _devir_kredi(self, k):
        kr, t = k.v["kredi"], k.v["tutar"]
        self.madde(k, k.tarih, 0, [L(G, t), L("300." + kr, -t)])
        self.m(k, k.tarih, ("kredi", kr), t, 0)

    def _devir_stok(self, k):
        top = 0
        for x in k.v["kalemler"]:
            top += x["deger"]
            self.stok_har(k, k.tarih, x["urun"], Fraction(x["miktar"]), x["deger"], "acilis")
        self.madde(k, k.tarih, 0, [L("153", top), L(G, -top)])

    def _devir_evrak(self, k):
        v = k.v
        e = dict(v["durum_kaydi"], gecmis=[])
        self.evrak[v["evrak"]] = e
        h, t = self._evrak_hesap(e), e["tutar"]
        if h is None:
            return                                   # ciro / karşılıksız: defter bakiyesi yok, yalnız durum
        if e["yon"] == "alinan":
            self.madde(k, k.tarih, 0, [Bo(h, t, evrak=v["evrak"]), Al(G, t)])
        else:
            self.madde(k, k.tarih, 0, [Bo(G, t), Al(h, t, evrak=v["evrak"])])

    def _devir_pos(self, k):                         # N-11 (KG-6 A: net)
        v = k.v
        self.pos[v["tahsilat"]] = dict(v["kalem"], seq=k.seq)
        p, t = v["kalem"]["pos"], v["tutar"]
        self.madde(k, k.tarih, 0, [Bo("108." + p, t), Al(G, t)])
        self.m(k, k.tarih, ("pos", p), t, 0)

    def _devir_yoldaki(self, k):                     # valörü K'den sonraya kalan transfer (KG-19 A)
        v = k.v
        a, t, valor = v["alici"], v["tutar"], v["valor"]
        self.madde(k, k.tarih, 0, [Bo(YOLDAKI, t), Al(G, t)])
        self.madde(k, valor, 1, [Bo("102." + a, t), Al(YOLDAKI, t)], tur="transfer_valor", alt=1)
        self.m(k, k.tarih, ("yoldaki",), t, 0)
        self.m(k, valor, ("yoldaki",), -t)
        self.m(k, valor, ("banka", a), t)

    def _devir_supheli(self, k):                     # N-12
        c, K, P = k.v["cari"], k.v["kalan"], k.v["karsilik"]
        self.madde(k, k.tarih, 0, [Bo("128", K, c), Al(G, K)])
        if P:
            self.madde(k, k.tarih, 0, [Bo(G, P), Al("129", P, c)], alt=1)
        self.supheli[c] = [dict(r) for r in k.v.get("kayitlar", [])]   # kayıt tarihleri korunur (K3 tarih kapısı)
        self.devir_supheli[c] = k.v.get("kalemler", [])   # M13: şüpheli kuyruğu ayrı taşınır (CH açık kalemi DEĞİL)
        self.m(k, k.tarih, ("cari", c), K, 0)

    def _devir_taksit(self, k):                      # modül açılışı; defter karşılığı cari açılışının içinde
        v = k.v
        self.kart[v["kart"]] = dict(v["kart_kaydi"])
        self.m(k, k.tarih, ("taksit_odenen", v["kart"]), v["odenen"], 0)


# ------------------------------------------------------------------------------------------------ Tek Yükümlülük Kuyruğu (EK-1 §1)
class Kuyruk:
    """Bir carinin Tek Yükümlülük Kuyruğu (EK-1 §1; S1–S3, M1a–M1f, M9, M13) — kâhin bakımı 2 ile (README R1–R5, R9, R20):

    Olaylar tarih → sınıf → K3 gün sınıfı → taraf sınıfı (aynı gün önce borç, karar (1)) → giriş sırasıyla işlenir:
      - bağsız alacak / borç KENDİ GÜNÜNDE açık (ayrılmamış) karşı kalemlere vadesi ilk gelenden (S2 A) uygulanır; sonra doğan kaleme
        ancak doğduğu gün geçer (karar (1));
      - bağ (Kapatılacak Fatura, iade → asıl fatura, Mahsup Et, kart tahsilatı, fatura kartı açılışı) hedefini her durumda kapatır (karar (2)):
        hedefte bağsız kapanmış kısım bulursa o kısım bağa AYRILIR (rezerv) ve kuyruk baştan oynatılır — serbest kalan ödeme kendi gününde
        başka borca gider. Kilitli (L) dönemde olmuş bağsız kapanışı L'den sonraki bağ geri almaz (karar (3)); not düşülür;
      - taksit kartı alttaki kalemi TÜKETİR (M1e); kart alttaki borçtan büyük kalmaz, en erken taksitten küçülür; borçtan düşülen iade kartı
        en erken açık taksitten küçültür (karar (4)); Kartı Kapat kalanı kapatma tarihli tek kalem (M1d, karar (6));
      - Şüpheliye Al (J-01) açık borçlardan vade sırasıyla şüpheli kuyruğuna taşır, Şüpheliden Çıkar (J-06) kendi vadeleriyle döndürür (M13).
    fatura_gorunumu: fatura durumu (karar (5)) — karşı yönlü iki fatura birbirini bağsız kapatmaz (yalnız Mahsup Et)."""

    def __init__(self, kilit=None, rezerv=None, fatura_gorunumu=False, kilit_of=None):
        self.ogeler = []
        self.kmap = defaultdict(list)
        self.supheli = []
        self.kartlar = {}
        self.kilit = kilit
        self.kilit_of = kilit_of                     # S19 A (README Y11, Y12): kaynak kimliği → yazılış anındaki (etkin) kilit
        self.s14_olcum = {}                          # S14 / S25 (README Y2, Z5): tahsilat → {olc [(kayıt, şüpheli kuyruğundaki kalan)], ch, tutar} tahsilat anında
        self.susulan_ek = []
        self.fg = fatura_gorunumu
        self.rez_idx = defaultdict(dict)             # öğe id → {bağ olayı: ayrılan}
        for (b, i), n in (rezerv or {}).items():
            if n > 0:
                self.rez_idx[i][b] = n
        self.ev, self.simdi, self._j = -1, None, 0
        self.cakisma = defaultdict(int)              # (bağ olayı, öğe id) → bu turda bulunan yeni rezerv ihtiyacı
        self.notlar = []                             # karar (3): kilit nedeniyle geri alınmayan bağ
        self.susulan = []                            # KÂHİN SUSUYOR durumları (README "Kâhin bakımı 3" KULLANICIYA SORULMALI 1)

    def olay(self, ev, tarih):
        self.ev, self.simdi, self._j = ev, tarih, 0

    def ekle(self, k, tur, taraf, tutar, tarih, vade, sira, kart=None, link=None, kaynak=None):
        oid = f"{self.ev}:{self._j}"
        self._j += 1
        rez_by = dict(self.rez_idx.get(oid, {}))
        o = {"id": oid, "k": k, "tur": tur, "taraf": taraf, "tutar": tutar, "kalan": tutar, "tarih": tarih,
             "vade": vade or tarih, "sira": tuple(sira), "kart": kart, "link": link, "kaynak": kaynak, "tahsis": [], "bagla": 0,
             "rez": sum(rez_by.values()), "rez_by": rez_by, "tuketen": [], "kucultme": 0}
        self._kirp(o)
        self.ogeler.append(o)
        if k:
            self.kmap[k].append(o)
        return o

    @staticmethod
    def avail(o):
        return o["kalan"] - o["rez"]

    @staticmethod
    def _kirp(o):
        """Ayrılan (rezerv) hiçbir zaman açık kalanı aşmaz; aşarsa en geç bağın ayrılanı kırpılır."""
        if o["rez"] > o["kalan"]:
            fazla = o["rez"] - o["kalan"]
            for b in sorted(o["rez_by"], reverse=True):
                x = min(fazla, o["rez_by"][b])
                o["rez_by"][b] -= x
                fazla -= x
                if not fazla:
                    break
            o["rez"] = o["kalan"]

    def acik(self, taraf):
        return sorted((o for o in self.ogeler if o["taraf"] == taraf and o["kalan"] > 0), key=s2_anahtari)

    def _tahsis(self, x, y, n, geri_alinabilir):
        b, a = (x, y) if x["taraf"] == "b" else (y, x)
        b["kalan"] -= n
        a["kalan"] -= n
        r = {"b": b, "a": a, "n": n, "rev": geri_alinabilir, "t": self.simdi}
        b["tahsis"].append(r)
        a["tahsis"].append(r)
        self._kirp(b)
        self._kirp(a)

    def _tuket(self, o, n, kart=None):
        o["kalan"] -= n
        if kart:
            o["tuketen"].append([kart, n])
        self._kirp(o)

    def net(self):
        """Bağsız kalemler: açık (ayrılmamış) borçlar ve alacaklar S2 sırasıyla karşılaşır."""
        B = sorted((o for o in self.ogeler if o["taraf"] == "b" and self.avail(o) > 0), key=s2_anahtari)
        A = sorted((o for o in self.ogeler if o["taraf"] == "a" and self.avail(o) > 0), key=s2_anahtari)
        for a in A:
            for b in B:
                if self.avail(a) <= 0:
                    break
                if self.fg and a["tur"] == "fatura" and b["tur"] == "fatura":
                    continue                          # karar (5): fatura durumu karşı yönlü faturayla değişmez (yalnız Mahsup Et)
                n = min(self.avail(a), self.avail(b))
                if n > 0:
                    self._tahsis(a, b, n, True)

    def _rez_al(self, y, n):
        """Bu olayın bağına ayrılmış kısmı hedefte serbest bırakır (bağ hemen kapatacak)."""
        r = min(n, y["rez_by"].get(self.ev, 0))
        if r > 0:
            y["rez_by"][self.ev] -= r
            y["rez"] -= r
        return r

    def _birak(self, y):
        x = y["rez_by"].pop(self.ev, 0)
        if x > 0:
            y["rez"] -= x

    def _eski_serbest(self, x, y, n):
        """YALNIZ mutasyon B02 içindir (eski okuma: hedefin bağsız kapanmış kısmı bağ GÜNÜNDE serbest bırakılır, serbest kalan karşı kalem
        o günün açık kalemlerine dağılır). Kâhinin kuralı bu DEĞİL — karar (2): serbest kalan KENDİ TARİHİNDE dağılır (yeniden oynatma)."""
        for r in reversed(y["tahsis"]):
            if n <= 0:
                break
            if not r["rev"] or not r["n"]:
                continue
            m = min(n, r["n"])
            r["n"] -= m
            r["b"]["kalan"] += m
            r["a"]["kalan"] += m
            n -= m
            self._tahsis(x, y, m, False)

    def _ayir_iste(self, hed, gerek, kaynak=None, x=None):
        """Karar (2) + (3): hedefin bağsız kapanmış kısmı bu bağa ayrılsın (sonraki turda); kilitli dönemdeki kapanış geri alınmaz.
        S19 A (README Y12): kilit = bağın YAZILDIĞI andaki kilit (sonradan ilerleyen kilit kararı değiştirmez)."""
        L = self.kilit_of(kaynak) if (self.kilit_of is not None and kaynak) else self.kilit
        kilitli_bag = L is not None and self.simdi > L
        for y in hed:
            if gerek <= 0:
                break
            ayrilan = sum(self.rez_idx.get(y["id"], {}).values()) + sum(v for (b, i), v in self.cakisma.items() if i == y["id"])
            bos = max(0, y["tutar"] - ayrilan)
            acik_f = kil_f = 0
            for r in y["tahsis"]:
                if r["rev"] and r["n"] > 0:
                    if kilitli_bag and r["t"] <= L:
                        kil_f += r["n"]
                    else:
                        acik_f += r["n"]
            n = min(gerek, acik_f, bos)
            if n > 0:
                self.cakisma[(self.ev, y["id"])] += n
                gerek -= n
            if kil_f and gerek > 0:
                self.notlar.append({"kaynak": kaynak, "hedef": y["k"], "tutar": min(gerek, kil_f), "tarih": self.simdi})
                gerek -= min(gerek, kil_f)

    def hedefler(self, link):
        if link.startswith("kart:"):
            kk = self.kartlar.get(link[5:])
            if kk is None:
                return []
            return kk["kalani"] if kk["kapali"] else kk["taksitler"]
        return self.kmap.get(link, [])

    def bagla(self, x, hedefler):
        hed = [y for y in hedefler if y["taraf"] != x["taraf"]]
        for y in hed:                                # 1. bu bağa ayrılmış kısım
            r = self._rez_al(y, x["kalan"])
            if r:
                self._tahsis(x, y, r, False)
                x["bagla"] += r
        for y in hed:                                # 2. hedefin açık (ayrılmamış) kısmı
            n = min(x["kalan"], self.avail(y))
            if n > 0:
                self._tahsis(x, y, n, False)
                x["bagla"] += n
        if x["tur"] == "iade":                       # karar (4) / EK-2B 32 (a): faturayı taksitlendiren kart küçülür
            for y in hed:
                for t_ in y["tuketen"]:
                    if x["kalan"] <= 0:
                        break
                    n = self.kart_kucult(t_[0], min(x["kalan"], t_[1]), x)
                    t_[1] -= n
        if x["tur"] != "kart_vazgec":                # 3. hedefin bağsız kapanmış kısmı (karar (2); kilitte karar (3))
            self._ayir_iste(hed, x["kalan"], x["kaynak"], x)
        for y in hed:
            self._birak(y)

    def kart_kucult(self, kid, n, x):
        """Karar (4) / 2B-S3 A: kart vadesi en önce gelen AÇIK taksitten küçülür (x: küçülten alacak kalemi)."""
        kk = self.kartlar.get(kid)
        if kk is None:
            return 0
        top = 0
        for o in sorted((o for o in (kk["kalani"] if kk["kapali"] else kk["taksitler"]) if o["kalan"] > 0), key=s2_anahtari):
            if n <= 0:
                break
            m = min(n, o["kalan"])
            self._tahsis(x, o, m, False)
            o["kucultme"] += m
            n -= m
            top += m
        return top

    def mahsup(self, k1, k2, tut, kaynak=None):      # F-16: iki faturanın karşılıklı kapanması (bağ; karar (2))
        for x in self.kmap.get(k1, []):
            for y in self.kmap.get(k2, []):
                if x["taraf"] == y["taraf"] or tut <= 0:
                    continue
                cx, cy = x["rez_by"].get(self.ev, 0) + self.avail(x), y["rez_by"].get(self.ev, 0) + self.avail(y)
                n = min(tut, cx, cy)
                if n > 0:
                    self._rez_al(x, n)
                    self._rez_al(y, n)
                    self._tahsis(x, y, n, False)
                    tut -= n
                if tut > 0:
                    self._ayir_iste([x], tut, kaynak)
                    self._ayir_iste([y], tut, kaynak)
                self._birak(x)
                self._birak(y)

    def kart_ac(self, kid, kt, tarih, sira, onceden=0):
        """M1e: kart tutarı kadar alttaki kalemi TÜKETİR (fatura kartı → o fatura, bağ gibi; Carinin Mevcut Borcu → açık borçlar S2
        sırasıyla); her taksit kendi vadesiyle borç kalemi. Karar (4): kart alttaki borçtan büyük kalmaz — fark en erken taksitlerden düşer."""
        T, kalan = kt["toplam"], kt["toplam"]
        tuketen = kt["kaynak"] in ("fatura", "mevcut_borc")
        if kt["kaynak"] == "fatura":
            hedef = [y for y in self.kmap.get("fatura:" + kt["fatura"], []) if y["taraf"] == "b"]
            for y in hedef:
                r = self._rez_al(y, kalan)
                if r:
                    self._tuket(y, r, kid)
                    kalan -= r
            for y in hedef:
                n = min(kalan, self.avail(y))
                if n > 0:
                    self._tuket(y, n, kid)
                    kalan -= n
            if kalan:
                self._ayir_iste(hedef, kalan, kid)
            for y in hedef:
                self._birak(y)
        elif kt["kaynak"] == "mevcut_borc":
            for ayrilmis in (False, True):           # önce ayrılmamış kısım (README soru 5)
                for y in self.acik("b"):
                    if y["kart"] or kalan <= 0:
                        continue
                    n = min(kalan, y["kalan"] if ayrilmis else self.avail(y))
                    if n > 0:
                        self._tuket(y, n, kid)
                        kalan -= n
        taksitler, kalan_p = [], onceden
        for j, x in sorted(enumerate(kt["taksitler"]), key=lambda jx: (jx[1]["vade"], jx[0])):
            tut = x["tutar"]
            d = min(kalan_p, tut)                     # KG-5 A: Excel kartında önceden ödenen (maddesiz) ilk taksitlerden düşer
            kalan_p -= d
            if tut - d:
                taksitler.append(self.ekle("kart:" + kid, "taksit", "b", tut - d, tarih, x["vade"], (sira[0], sira[1], j), kart=kid))
        eksik = kalan if tuketen else 0
        for o in taksitler:                           # karar (4): kart küçülür (kart_fark kalemi YOK)
            if eksik <= 0:
                break
            m = min(eksik, o["kalan"])
            o["kalan"] -= m
            o["kucultme"] += m
            eksik -= m
        self.kartlar[kid] = {"taksitler": taksitler, "kapali": False, "kalani": [], "kaynak": kt["kaynak"], "tuketilen": T - kalan if tuketen else None}
        self.net()

    def devir_karti(self, kid, kt):
        """Devirle gelen kart: K'deki açık taksitleri (kendi vade ve sırasıyla)."""
        tak = [self.ekle("kart:" + kid, "taksit", "b", x["kalan"], x["tarih"], x["vade"], x["sira"], kart=kid)
               for x in kt.get("acik_taksitler", [])]
        self.kartlar[kid] = {"taksitler": tak, "kapali": bool(kt.get("kapali")), "kalani": [], "kaynak": "devir", "tuketilen": None}
        return sum(x["kalan"] for x in kt.get("acik_taksitler", []))

    def kart_kapat(self, kid, tarih, sira):           # M1d / karar (6)
        kk = self.kartlar.get(kid)
        if kk is None or kk["kapali"]:
            return
        top = 0
        for o in kk["taksitler"]:
            if o["kalan"] > 0:
                top += o["kalan"]
                self._tuket(o, o["kalan"])
        kk["kapali"] = True
        if top:
            kk["kalani"].append(self.ekle("kart_kalani:" + kid, "kart_kalani", "b", top, tarih, tarih, sira))
        self.net()

    def supheliye(self, tutar, tarih, sira, kayit=None):   # J-01 (M13): kapama gibi; vadesi ilk gelenden şüpheli kuyruğuna
        kalan = tutar
        for ayrilmis in (False, True):               # önce ayrılmamış kısım (README soru 5)
            for y in self.acik("b"):
                if kalan <= 0:
                    break
                n = min(kalan, y["kalan"] if ayrilmis else self.avail(y))
                if n <= 0:
                    continue
                self._tuket(y, n)
                self.supheli.append({"k": y["k"], "tur": y["tur"], "tarih": y["tarih"], "vade": y["vade"], "sira": y["sira"], "kalan": n,
                                     "kayit": kayit})
                kalan -= n
        if kalan:
            self.ekle("supheli_fazla", "supheli_fazla", "a", kalan, tarih, tarih, sira)
            self.net()

    def s14_olc(self, tid, hedef, tut):
        """S14 (README Y2) + S25 (a) A (README Z5): tahsilat anında bağlı faturanın şüpheli kuyruğundaki kalemleri (kayıt başına, en eski kayıt önce) ve CH'deki
        kısmı (bağın kapatabildiği: açık + bağsız kapanmış, karar (2)). Fatura iki hesapta duruyor ve tahsilat ikisinin toplamından küçükse ÖNCE şüpheli kısım
        (Dosya._s14_plani) — bakım 4'ün "S14_KISMI" susması kalktı."""
        olc = [(x.get("kayit"), x["kalan"]) for x in sorted(self.supheli, key=s2_anahtari) if x["k"] == hedef and x["kalan"] > 0]
        pch = sum(o["kalan"] + sum(r["n"] for r in o["tahsis"] if r["rev"]) for o in self.kmap.get(hedef, []) if o["taraf"] == "b")
        self.s14_olcum[tid] = {"olc": olc, "ch": pch, "tutar": tut}

    def supheli_kapat(self, tutar=None, kayit=None, hedef=None):  # J-03 / K3 / J-05 (değersiz): o kaydın kalemlerini kapatır (S14: hedef önce)
        for x in sorted((x for x in self.supheli if kayit is None or x.get("kayit") == kayit), key=lambda x: (x["k"] != hedef,) + s2_anahtari(x)):
            if tutar is not None and tutar <= 0:
                break
            n = x["kalan"] if tutar is None else min(tutar, x["kalan"])
            x["kalan"] -= n
            if tutar is not None:
                tutar -= n

    def supheliden_don(self, tutar, tarih, sira, kayit=None):   # J-06 (M13): kalemler KENDİ vadeleriyle CH kuyruğuna döner
        top = 0
        for x in sorted((x for x in self.supheli if kayit is None or x.get("kayit") == kayit), key=s2_anahtari):
            if x["kalan"] > 0:
                self.ekle(x["k"], x["tur"], "b", x["kalan"], x["tarih"], x["vade"], x["sira"])
                top += x["kalan"]
                x["kalan"] = 0
        if tutar != top:
            self.ekle("supheli_fark", "supheli_fark", "b" if tutar > top else "a", abs(tutar - top), tarih, tarih, sira)
        self.net()

    def acik_ogeler(self):
        return sorted((o for o in self.ogeler if o["kalan"] > 0), key=lambda o: (o["taraf"],) + s2_anahtari(o))


# ------------------------------------------------------------------------------------------------ veri dosyası
class Fis:
    """Saklanan fiş (Ç2): değiştirilemez; düzeltmesi ters fişle (R-03)."""

    def __init__(self, id, tarih, sinif, seq, tur, satirlar, ek=None, kaynak=None):
        self.id, self.tarih, self.sinif, self.seq, self.tur, self.satirlar = id, tarih, sinif, seq, tur, satirlar
        self.ek, self.kaynak, self.ters = ek or {}, kaynak, None
        madde_kur(id, tarih, sinif, seq, id, tur, satirlar)   # denge denetimi (G-6)

    def madde(self):
        m = madde_kur(self.id, self.tarih, self.sinif, self.seq, self.kaynak or self.id, self.tur, self.satirlar, dict(self.ek, fis=True))
        kdv_etiketle(m.satirlar, self.tarih)
        return m


class Sayac:
    def __init__(self):
        self.n = 0

    def __call__(self):
        self.n += 1
        return self.n


class Dosya:
    def __init__(self, tanim, kurallar, sayac, ad="canli", defter_turu="bilanco"):
        self.tanim, self.k, self.sayac, self.ad, self.defter_turu = tanim, kurallar, sayac, ad, defter_turu
        self.kaynaklar, self.fisler = {}, []
        self.kilit = None
        self.donmus, self.donmus_sinir, self.donmus_kural = None, None, None
        self.kural_farki_fisi = None
        self.degerlenen = {}                  # yıl → (N-01 tarihi, devir kimliği): dönem sonu değerlemesi yapılmış yıllar
        self.ust = None
        self.arsiv = False
        self.kdv_ihlal = []                   # EK-1 §4 (10): mahsuptan hemen sonra dönemi o ay olan 191 / 391 ≠ 0
        self._g = None
        self._m = None
        self._kq = {}

    def kopya(self):
        onbellek = (self._g, self._m, self._kq)
        self._g = self._m = None
        self._kq = {}
        try:
            d = copy.deepcopy(self)
        finally:
            self._g, self._m, self._kq = onbellek
        d.sayac = self.sayac
        d.tanim = self.tanim
        return d

    def degisti(self):
        self._g = None
        self._m = None
        self._kq = {}

    # -- türetme
    def gecis(self):
        """Türetme. S14 A (README Y2): bağlı çekin 128 / 120 ayrımı tahsilat anındaki şüpheli kuyruğuna bağlıdır; kuyruk türetmeden kurulur → plan
        yakınsayana kadar yeniden türetilir (önceki olaylar sonrakini etkiler, tersi değil)."""
        if self._g is None:
            plan = {}
            for _ in range(40):
                self._g, self._m, self._kq = Gecis(self, s14=plan).kos(), None, {}
                yeni = self._s14_plani()
                if yeni == plan:
                    break
                plan = yeni
            else:
                raise AssertionError("S14 planı yakınsamadı")
        return self._g

    def _s14_plani(self):
        """S14 + S25 (a) A (README Z5): bağlı tahsilat ÖNCE faturanın şüpheli kısmını (128, kayıt başına) düşer; kalan 120 (Gecis._s14_dus)."""
        plan = {}
        for (tarih, _, c, tid, _h, tut) in self._g.s14_aday:
            olcum = self.kuyruk(c, tarih).s14_olcum.get(tid, {})
            kalan, p = tut, []                        # S25 (a) A: önce şüpheli kısım
            for kayit, n in olcum.get("olc", []):
                m = min(n, kalan)
                if m > 0:
                    p.append((kayit, m))
                    kalan -= m
            if p:
                plan[tid] = p
        return plan

    def etkin_kilit(self, kid):
        """S19 A (README Y11): S11 / R3 kararının kilidi = kaydın YAZILDIĞI andaki kilit (bir kez; sonradan ilerleyen kilit değiştirmez). Kilit
        kaldırılırsa kural o dönem için kalkar (EK-2B 28) → güncel kilitle en küçüğü."""
        k = self.kaynaklar.get(kid)
        L = k.kilit if k is not None else self.kilit
        if L is None or self.kilit is None:
            return None
        return min(L, self.kilit)

    def mutabakat_uyarilari(self, t):
        """S20 A (README Y17): Kasa açılışından önce tarihli Kasa hareketi (yalnız geri yüklemeyle gelebilir — yeni kayıtta S12 reddeder) → Mutabakat
        Testi uyarısı; veri aynen."""
        ac = [k for k in self.kaynaklar.values() if k.tur in ("kasa_acilis", "devir_kasa") and k.durum == "aktif" and k.tarih <= t]
        a0 = min((k.tarih for k in ac), default=None)
        out = {}
        if a0 is not None:
            ids = {k.id for k in ac}
            for x in self.gecis().mod:
                if x[3] == ("kasa",) and x[5] not in ids and x[0] < a0:
                    out[x[5]] = min(out.get(x[5], x[0]), x[0])
        return [{"kod": "KASA_ACILIS_ONCESI_HAREKET", "kaynak": kid, "tarih": tt, "acilis": a0}
                for kid, tt in sorted(out.items(), key=lambda z: (z[1], z[0]))]

    def maddeler(self):
        if self._m is None:
            ms = list(self.gecis().maddeler)
            if self.donmus is not None:
                ms = [m for m in ms if m.tarih > self.donmus_sinir] + list(self.donmus)
            ms += [f.madde() for f in self.fisler]
            ms.sort(key=sira_anahtari)
            self._m = ms
        return self._m

    def bakiyeler(self, t=None, kosul=None):
        b = defaultdict(int)
        for m in self.maddeler():
            if t is not None and m.tarih > t:
                break
            if kosul and not kosul(m):
                continue
            for s in m.satirlar:
                b[(s["h"], s["c"])] += s["b"] - s["a"]
        return {k: v for k, v in b.items() if v}

    def ana_bakiye(self, h, t=None):
        return sum(v for (hh, c), v in self.bakiyeler(t).items() if hh == h or hh.startswith(h + "."))

    def cari_hesap(self, c):
        return CH_HESAP[self.tanim["cariler"][c]["tur"]]

    def kaynak_ekle(self, tur, tarih, v, id=None, devir=None, geri=False):
        id = id or f"k{self.sayac.n + 1}"
        if id in self.kaynaklar:
            raise Red("KIMLIK", f"aynı kimlik {id}")
        k = Kaynak(id, tur, tarih, self.sayac(), v, devir)
        k.kilit, k.geri = self.kilit, geri            # S19: yazılış anındaki kilit; S20: yedekten gelen kayıt
        self.kaynaklar[id] = k
        self.degisti()
        return k

    def fis_ekle(self, tarih, sinif, tur, satirlar, ek=None, kaynak=None, id=None):
        f = Fis(id or f"fis{self.sayac.n + 1}", tarih, sinif, self.sayac(), tur, satirlar, ek, kaynak)
        self.fisler.append(f)
        self.degisti()
        return f

    def kilit_denetimi(self, tarih):
        if self.kilit is not None and tarih <= self.kilit:
            raise Red("KILITLI_DONEM", f"{tarih} ≤ kilit {self.kilit} (409)")

    # -- modüller (kaynaktan; defterden bağımsız toplama)
    def moduller(self, t=None, devir=None):
        """Modül bakiyeleri; devir verilirse yalnız o devrin açılış kaynaklarının etkisi."""
        g = self.gecis()
        mod = defaultdict(int)
        for (tarih, sinif, seq, anah, d, kid) in g.mod:
            if t is not None and tarih > t:
                continue
            if devir is not None and (sinif != 0 or getattr(self.kaynaklar.get(kid), "devir", None) != devir):
                continue
            mod[anah] += d
        return {k: v for k, v in mod.items() if v}

    def evrak_hesaplari(self):
        g = self.gecis()
        out = defaultdict(int)
        for e in g.evrak.values():
            h = g._evrak_hesap(e)
            if h:
                out[h] += e["tutar"] if e["yon"] == "alinan" else -e["tutar"]
        return dict(out)

    # -- stok değerlemesi (§5; DEVIR-PLANI §11.4)
    def degerleme(self, t):
        st = [e for e in self.gecis().stok if e[0] <= t]
        sonuc = {"toplam": 0, "urunler": {}, "uyarilar": [], "eksi": []}
        if not st:
            return sonuc
        urunler = sorted({e[3] for e in st})
        dbs = {u: (Fraction(0), 0) for u in urunler}
        for y in range(yil(st[0][0]), yil(t) + 1):
            son = t if y == yil(t) else f"{y}-12-31"
            bas = f"{y}-01-01"
            dq = {u: dbs[u][0] for u in urunler}
            dv = {u: dbs[u][1] for u in urunler}
            aq, av, q = defaultdict(Fraction), defaultdict(int), defaultdict(Fraction)
            for (tarih, _, _, u, miktar, deger, tur) in st:
                if tarih > son:
                    break
                q[u] += miktar
                if tarih >= bas:
                    if tur == "acilis":                # devirle gelen eksi miktar: KG-9 A'da dönem başı miktarı 0
                        dq[u] += max(Fraction(0), miktar) if self.k.KG9 == "A" else miktar
                        dv[u] += deger
                    elif tur in ("alis", "alis_iade"):
                        aq[u] += miktar
                        av[u] += deger
            yeni = {}
            urun_sonuc = {}
            for u in urunler:
                pay, payda = dv[u] + av[u], dq[u] + aq[u]
                if payda > 0:
                    birim = Fraction(pay) / payda
                else:                                # KG-10 A: kartın alış fiyatı; yoksa 0 + uyarı
                    af = self.tanim["urunler"].get(u, {}).get("alis_fiyati")
                    birim = Fraction(af or 0)
                    if not af and q[u] != 0 and y == yil(t):
                        sonuc["uyarilar"].append(f"KG10_ALIS_FIYATI_YOK:{u}")
                miktar = q[u]
                if miktar > 0:
                    deger = yuvarla(miktar * birim)
                elif miktar < 0:
                    deger = 0 if self.k.KG9 == "A" else yuvarla(miktar * birim)   # KG-9
                else:
                    deger = 0
                yeni[u] = (max(Fraction(0), miktar) if self.k.KG9 == "A" else miktar, deger)
                urun_sonuc[u] = {"miktar": str(miktar), "birim": str(birim), "deger": deger}
            dbs = yeni
        sonuc["urunler"] = urun_sonuc
        sonuc["toplam"] = sum(x["deger"] for x in urun_sonuc.values())
        sonuc["eksi"] = [u for u, x in urun_sonuc.items() if Fraction(x["miktar"]) < 0]
        return sonuc

    def deger(self, t):
        return self.degerleme(t)["toplam"]

    # -- kapanış bilgisi
    def kapanis_tarihi(self, t):
        ds = [f.tarih for f in self.fisler if f.tur == "kapanis" and f.ters is None and f.tarih <= t]
        return max(ds) if ds else None

    def n01_var(self, y, t):
        x = self.degerlenen.get(y)
        return x is not None and x[0] <= t

    def _tahmini_smm(self, a, b):
        """KG-11 A: dönem [a, b]'nin tahmini satışların maliyeti (yıl yıl); (tutar, stok_var)."""
        top, var = 0, False
        for y in range(yil(a), yil(b) + 1):
            ya, yb = max(a, f"{y}-01-01"), min(b, f"{y}-12-31")
            if self.n01_var(y, b):
                continue
            hareket = sum(v for (h, c), v in self.bakiyeler(yb, lambda m: m.tarih >= ya).items() if ana(h) == "153")
            v0 = self.deger(onceki(ya))
            v1 = self.deger(yb)
            if hareket or v0 or v1:
                var = True
            top += hareket + v0 - v1
        return top, var

    # -- mali tablolar
    def gelir_tablosu(self, a, b):
        kal = defaultdict(int)
        hes = defaultdict(int)
        for m in self.maddeler():
            if m.tarih > b:
                break
            if m.tarih < a or m.sinif in GT_DISI:
                continue
            for s in m.satirlar:
                h = s["h"]
                if not sonuc_hesabi(h):
                    continue
                meta = HESAPLAR[ana(h)]
                kalem = meta[2]
                if kalem is None:
                    raise AssertionError(f"gelir tablosunda kapanış/yansıtma hesabı kapanış sınıfı dışında: {h}")
                katki = (s["a"] - s["b"]) if meta[1] == "GE" else (s["b"] - s["a"])
                kal[kalem] += katki
                hes[h] += katki
        kesin_degil = []
        tahmini = False
        hesaplanmadi = False
        smm, var = self._tahmini_smm(a, b)
        if var:
            if self.k.KG11 == "A":
                kal["D"] += smm
                hes["621 (Tahmini)"] += smm
                tahmini = True
                kesin_degil.append("SATISLARIN_MALIYETI_TAHMINI")
            else:
                hesaplanmadi = True
                kesin_degil.append("SATISLARIN_MALIYETI_HESAPLANMADI")
        r = {x: kal.get(x, 0) for x in ("A", "B", "D", "E", "F", "G", "H", "I", "J", "K")}
        r["C"] = r["A"] - r["B"]
        r["BSK"] = r["C"] - r["D"]
        r["FK"] = r["BSK"] - r["E"]
        r["OK"] = r["FK"] + r["F"] - r["G"] - r["H"]
        r["DK"] = r["OK"] + r["I"] - r["J"]
        r["DNK"] = r["DK"] - r["K"]
        if self.defter_turu != "bilanco":
            kesin_degil.append("BILGI_AMACLI")
        return {"bas": a, "son": b, "kalemler": {x: r[x] for x in GT_SIRA}, "hesaplar": {k: v for k, v in sorted(hes.items()) if v},
                "tahmini": tahmini, "hesaplanmadi": hesaplanmadi, "kesin_degil": kesin_degil,
                "bilgi_amacli": self.defter_turu != "bilanco"}

    def _kapanmamis_sonuc(self, t):
        """Kapanış görmemiş 6 / 7 sonucunun yıllara dağılımı (§4; KG-11, KG-12)."""
        c = self.kapanis_tarihi(t)
        R = defaultdict(int)
        satir_var = defaultdict(bool)
        for m in self.maddeler():
            if m.tarih > t:
                break
            if (c is not None and m.tarih <= c) or m.sinif in GT_DISI:
                continue
            for s in m.satirlar:
                if sonuc_hesabi(s["h"]):
                    R[yil(m.tarih)] += s["a"] - s["b"]
                    satir_var[yil(m.tarih)] = True
        smm_toplam, tahmini, hesaplanmadi = 0, False, False
        bas_yil = yil(ertesi(c)) if c else None
        st = self.gecis().stok
        yillar = set(R)
        if st:
            ilk = yil(st[0][0])
            yillar |= set(range(max(ilk, bas_yil or ilk), yil(t) + 1))
        for y in sorted(yillar):
            if c is not None and f"{y}-12-31" <= c:
                continue
            a = max(f"{y}-01-01", ertesi(c)) if c else f"{y}-01-01"
            b = min(t, f"{y}-12-31")
            if a > b:
                continue
            smm, var = self._tahmini_smm(a, b)
            if var:
                if self.k.KG11 == "A":
                    R[y] -= smm
                    smm_toplam += smm
                    tahmini = True
                else:
                    hesaplanmadi = True
        return R, smm_toplam, tahmini, hesaplanmadi, c

    def bilanco(self, t):
        bal = self.bakiyeler(t)
        aktif, pasif = defaultdict(int), defaultdict(int)
        kd = []
        detay = defaultdict(dict)
        R, smm, tahmini, hesaplanmadi, c = self._kapanmamis_sonuc(t)

        def ekle(taraf, kalem, key, v):
            (aktif if taraf == "aktif" else pasif)[kalem] += v
            detay[kalem][key] = detay[kalem].get(key, 0) + v

        for (h, cc), v in sorted(bal.items(), key=lambda x: (x[0][0], x[0][1] or "")):
            if not bilanco_hesabi(h) or v == 0:
                continue
            m = ana(h)
            ad, tur, kalem = HESAPLAR[m]
            key = anahtar(h, cc)
            if m == "153" and tahmini:
                continue                             # KG-11 A: 153 tahmini değerlemeyle aşağıda
            tr = TERS.get(m)
            if tur in ("A", "A-"):
                ters = v < 0 if tur == "A" else v > 0
                if ters and tur == "A" and tr not in (None, "KD"):
                    ekle("pasif", tr, key, -v)
                else:
                    ekle("aktif", kalem, key, v)
                    if ters and tr == "KD":
                        kd.append("EKSI_KASA" if m == "100" else f"TERS_BAKIYE:{m}")
            else:
                p = -v
                ters = tur == "P" and p < 0
                if ters and tr == "KG14":
                    ekle("aktif", "I.H", key, v)
                    kd.append("BORCLU_360")
                elif ters and tr not in (None, "KD"):
                    ekle("aktif", tr, key, v)
                else:
                    ekle("pasif", kalem, key, p)
                    if ters and tr == "KD":
                        kd.append(f"TERS_BAKIYE:{m}")
        if tahmini:
            ekle("aktif", "I.E", "153 (Tahmini Değerleme)", self.deger(t))
        y = yil(t)
        onceki_yillar = {yy: r for yy, r in R.items() if yy < y}
        if self.k.KG12 == "A":
            dnk = R.get(y, 0)
            gecmis = sum(onceki_yillar.values())
            gecmis_kar = sum(r for r in onceki_yillar.values() if r > 0)
            gecmis_zarar = -sum(r for r in onceki_yillar.values() if r < 0)
        else:
            dnk = sum(R.values())
            gecmis = gecmis_kar = gecmis_zarar = 0
        if dnk:
            ekle("pasif", "V.F", "Dönem Net Kârı (Hesaplanmış)", dnk)
        if gecmis:
            ekle("pasif", "V.K", "Geçmiş Yıllar — Kapanmamış (Hesaplanmış)", gecmis)
        if any(v for v in onceki_yillar.values()):
            kd.append("KAPANMAMIS_ONCEKI_YIL")
        if bal.get((G, None), 0):
            kd.append("TAMAMLANMAMIS_ACILIS")
        if tahmini:
            kd.append("SATISLARIN_MALIYETI_TAHMINI")
        if hesaplanmadi:
            kd.append("SATISLARIN_MALIYETI_HESAPLANMADI")
        if self.degerleme(t)["eksi"]:
            kd.append("EKSI_STOK")
        if self.kural_farki(t):
            kd.append("KURAL_DEGISIKLIGI_FARKI")
        if bal.get((CARISIZ_PASIF, None), 0):
            kd.append("SINIFLANDIRILMAMIS_TAHSILAT")
        et = kdv_etiketleri(self, t)
        for f in self.fisler:                         # S4 A / M8-6: mahsubu yapılmış ayın kaydı sonradan değiştiyse
            if f.tur == "kdv_mahsup" and f.ters is None and f.tarih <= t:
                ay = f.ek["ay"]
                if et.get(("191", ay), 0) or et.get(("391", ay), 0):
                    kd.append(f"KDV_MAHSUBU_GUNCEL_DEGIL:{ay}")
        mahsuplu = {f.ek["ay"] for f in self.fisler if f.tur == "kdv_mahsup" and f.ters is None and f.tarih <= t}
        bilgi = []
        for (h, dn), v in et.items():
            if v and dn and int(dn[:4]) < yil(t):       # M8-4 + EK-2 34 / E19: önceki yılın mahsupsuz ayları, ay ay
                kd.append(f"ONCEKI_YIL_KDV_MAHSUBU_YAPILMAMIS:{dn}")
            elif v and dn and int(dn[:4]) == yil(t) and ay_sonu(dn) < t and dn not in mahsuplu:
                bilgi.append(f"KDV_MAHSUBU_YAPILMAMIS:{dn}")   # kitap §7.3: t'nin yılında biten mahsupsuz ay yalnız bilgi uyarısı
        if self.defter_turu != "bilanco":
            kd.append("BILGI_AMACLI")
        at, pt = sum(aktif.values()), sum(pasif.values())
        if at != pt:
            kd.append("AKTIF_PASIF_FARKI")
        return {"tarih": t, "aktif": dict(sorted((k, v) for k, v in aktif.items() if v)),
                "pasif": dict(sorted((k, v) for k, v in pasif.items() if v)),
                "aktif_toplam": at, "pasif_toplam": pt, "fark": at - pt, "donem_net_kari": dnk, "gecmis_yillar_kapanmamis": gecmis,
                "gecmis_yillar_kar": gecmis_kar, "gecmis_yillar_zarar": gecmis_zarar,
                "kesin_degil": sorted(set(kd)), "bilgi": sorted(set(bilgi)), "bilgi_amacli": self.defter_turu != "bilanco",
                "detay": {k: dict(sorted(v.items())) for k, v in sorted(detay.items())}}

    def mizan(self, a, b):
        satir = defaultdict(lambda: {"devir": 0, "borc": 0, "alacak": 0})
        for m in self.maddeler():
            if m.tarih > b:
                break
            for s in m.satirlar:
                x = satir[anahtar(s["h"], s["c"])]
                if m.tarih < a:
                    x["devir"] += s["b"] - s["a"]
                else:
                    x["borc"] += s["b"]
                    x["alacak"] += s["a"]
        out, an = {}, defaultdict(lambda: {"devir": 0, "borc": 0, "alacak": 0, "bakiye": 0})
        for k in sorted(satir):
            x = satir[k]
            x["bakiye"] = x["devir"] + x["borc"] - x["alacak"]
            if any(x.values()):
                out[k] = dict(x)
                y = an[ana(ayir(k)[0])]
                for f in ("devir", "borc", "alacak", "bakiye"):
                    y[f] += x[f]
        top = {f: sum(x[f] for x in out.values()) for f in ("devir", "borc", "alacak", "bakiye")}
        return {"bas": a, "son": b, "satirlar": out, "ana": {k: dict(v) for k, v in sorted(an.items())}, "toplam": top}

    def buyuk_defter(self, hesap, a, b, cari=None):
        def uygun(s):
            return (s["h"] == hesap or s["h"].startswith(hesap + ".")) and (cari is None or s["c"] == cari)
        devir, har, bak = 0, [], 0
        for m in self.maddeler():
            if m.tarih > b:
                break
            for s in m.satirlar:
                if not uygun(s):
                    continue
                if m.tarih < a:
                    devir += s["b"] - s["a"]
                    continue
                if not har:
                    bak = devir
                bak += s["b"] - s["a"]
                har.append({"tarih": m.tarih, "madde": m.id, "tur": m.tur, "hesap": s["h"], "cari": s["c"], "borc": s["b"],
                            "alacak": s["a"], "bakiye": bak})
        tb, ta = sum(x["borc"] for x in har), sum(x["alacak"] for x in har)
        return {"hesap": hesap, "cari": cari, "bas": a, "son": b, "devir": devir, "hareketler": har, "satir_sayisi": len(har), "toplam_borc": tb,
                "toplam_alacak": ta, "son_bakiye": devir + tb - ta}

    # -- Tek Yükümlülük Kuyruğu (EK-1 §1): açık kalemler, gecikmiş (B1 + S1–S3), hatırlatma
    def _kuyruk_olaylari(self, c, t):
        """Kuyruk olayları ≤ t, sıralı: (anahtar, tür, yük). Anahtar = (tarih, sınıf, K3 gün sınıfı, taraf sınıfı, giriş sırası, madde, satır);
        taraf sınıfı (karar (1), README R1): 0 borç satırı, 1 kart açılışı, 2 alacak satırı / bağ / Mahsup Et / şüpheli olayı, 3 Kartı Kapat."""
        g = self.gecis()
        ch = ana(self.cari_hesap(c))
        satirlar = []
        for m in self.maddeler():
            if m.tarih > t:
                break
            for i, s in enumerate(m.satirlar):
                if ana(s["h"]) == ch and s["c"] == c:
                    satirlar.append((m, i, s))
        # S8 A + EK-2 K-1 (README R20): karşılıksız / iade evrak, tahsilat kalemini (cirodaysa tedarikçideki ciro ödemesini) geri alır
        cikar, azalt, susulan = set(), {}, []
        for m, i, s in satirlar:
            e = s["e"] or {}
            if e.get("tur") == "karsiliksiz" and e.get("evrak_kaynak") and not e.get("kart_tahsilati"):
                kk, hedef = e["evrak_kaynak"], "tahsilat:" + e["evrak_kaynak"]
            elif e.get("tur") == "ciro_donus" and e.get("ciro_kaynak"):
                kk, hedef = e["ciro_kaynak"], "odeme:" + e["ciro_kaynak"]
            else:
                continue
            es = [(mm, ii, ss) for mm, ii, ss in satirlar if mm.kaynak == kk and (ss["e"] or {}).get("k") == hedef]
            if not es:
                continue                              # evrakın tahsilatı bu dosyada yok (devirle gelen evrak) → M1c ayrı kalem
            L = self.etkin_kilit(m.kaynak)
            if L is not None and es[0][0].tarih <= L < m.tarih:
                # S11 A (kullanıcı 06.11 03:35; README bakım 3 T1–T8) + S18 A (06.11 04:50; README Y10): evrak kilitli (devredilmiş) dönemde alındıysa
                # kapanış değişmez — L'de tamamen dağılmış olsun olmasın (avans) — tahsilat (ciro ödemesi) kalemi kalır, karşılıksız / ciro dönüşü satırı
                # TAM tutar ayrı kalem (vade karşılıksız günü, M1c). S19 A (README Y11): L = karşılıksızın YAZILDIĞI andaki kilit (bir kez)
                continue
            for mm, ii, ss in es:
                cikar.add((mm.id, ii))
            azalt[(m.id, i)] = sum(ss["b"] or ss["a"] for _, _, ss in es)
        olaylar = []
        for m, i, s in satirlar:
            if (m.id, i) in cikar:
                continue
            tutar = (s["b"] or s["a"]) - azalt.get((m.id, i), 0)
            if tutar <= 0:
                continue
            olaylar.append(((m.tarih, m.sinif, GUN_SINIFI.get(m.tur, 3), 0 if s["b"] else 2, m.seq, m.id, i), "satir", (m, i, s, tutar)))
        for kid, kt in g.kart.items():
            if kt["cari"] != c:
                continue
            if kt["kaynak"] in ("fatura", "mevcut_borc") and kt["tarih"] <= t:
                olaylar.append(((kt["tarih"], kt["sinif"], 3, 1, kt["seq"], "", -1), "kart", kid))
            if kt.get("kapama") and kt["kapama"][0] <= t:
                olaylar.append(((kt["kapama"][0], 1, 3, 3, kt["kapama"][1], "", -1), "kapama", kid))
        for kid, ki in g.kart_iptal.items():          # S15 A (README Y9): iptal edilen faturanın tahsilatlı kartı kapalı, taksitsiz
            if ki["cari"] == c and ki["tarih"] <= t:
                olaylar.append(((ki["tarih"], 1, 3, 1, ki["seq"], "", -1), "kart_iptal", kid))
        for (tarih, seq, k1, k2, tut, kid) in g.mahsup:
            if tarih <= t:
                olaylar.append(((tarih, 1, 3, 2, seq, "", -1), "mahsup", (k1, k2, tut, kid)))
        for (tarih, seq, cc, tur, tut, kayit, hedef) in g.supheli_olay:
            if cc == c and tarih <= t:
                olaylar.append(((tarih, 1, GUN_SINIFI["degersiz_yaz"] if tur == "degersiz" else 3, 2, seq, "", -1), "supheli", (tur, tut, kayit, hedef)))
        for (tarih, seq, cc, tid, hedef, tut) in g.s14_aday:   # S14 (README Y2): tahsilat anı ölçümü, o tahsilatın şüpheli kapamasından ÖNCE
            if cc == c and tarih <= t:
                olaylar.append(((tarih, 1, 3, 2, seq, "", -2), "s14", (tid, hedef, tut)))
        olaylar.sort(key=lambda x: (x[0][0], SINIF_SIRASI[x[0][1]]) + x[0][2:])
        return olaylar, susulan

    def l_sonu_acik(self, c, hedef, L):
        """YALNIZ mutasyon B34 içindir (bakım 3'ün eski T1 okuması: evrak L'de tamamen dağılmadıysa S11 değil S8). Kâhinin kuralı bu DEĞİL — S18 A:
        L'de dağılmamış (avans) evrak da S11 (README Y10). Evrakın tahsilat kaleminin L günü sonundaki dağılmamış kalanı."""
        return sum(o["kalan"] for o in self.kuyruk(c, L).ogeler if o["k"] == hedef)

    def _oynat(self, c, olaylar, rezerv, fg):
        g = self.gecis()
        q = Kuyruk(self.kilit, rezerv, fg, self.etkin_kilit)
        q.supheli = [dict(x, sira=tuple(x["sira"])) for x in g.devir_supheli.get(c, [])]
        for ev, (anahtar_, tur, x) in enumerate(olaylar):
            q.olay(ev, anahtar_[0])
            sira = (anahtar_[1], anahtar_[4], max(anahtar_[6], 0))
            if tur == "kart":
                q.kart_ac(x, g.kart[x], g.kart[x]["tarih"], sira)
            elif tur == "kapama":
                q.kart_kapat(x, anahtar_[0], sira)
            elif tur == "mahsup":
                q.mahsup(*x)
                q.net()
            elif tur == "supheli":
                q.supheli_kapat(x[1] if x[0] == "tahsil" else None, x[2], x[3])
            elif tur == "s14":
                q.s14_olc(*x)
            elif tur == "kart_iptal":
                q.kartlar[x] = {"taksitler": [], "kapali": True, "kalani": [], "kaynak": "fatura", "tuketilen": None, "iptal": True}
            else:
                m, i, s, tutar = x
                e = s["e"] or {}
                taraf, st = ("b" if s["b"] else "a"), e.get("tur")
                if st == "devir_cari":                # M2: devreden açık kalemler kendi belge tarihi / vadesi / sırasıyla
                    for kl in g.devir_kalemleri.get(c, []):
                        q.ekle(kl["k"], kl["tur"], kl["taraf"], kl["kalan"], kl["tarih"], kl["vade"], kl["sira"])
                    for kid, kt in sorted(g.kart.items()):
                        if kt["cari"] == c and kt["kaynak"] == "devir":
                            q.devir_karti(kid, kt)
                    q.net()
                elif e.get("kart"):                   # H-03 / Excel kartı: borcun kaynağı kart; kuyruğa yalnız taksitler
                    kt = g.kart[e["kart"]]
                    P = kt.get("odenen", 0) if (kt["kaynak"] == "excel" and self.k.KG5 == "A") else 0
                    q.kart_ac(e["kart"], kt, m.tarih, sira, P)
                elif st == "supheli_transfer":
                    q.supheliye(tutar, m.tarih, sira, e.get("kayit"))
                elif st == "supheliden_cikar":
                    q.supheliden_don(tutar, m.tarih, sira, e.get("kayit"))
                else:
                    o = q.ekle(e.get("k"), st, taraf, tutar, m.tarih, e.get("vade"), sira, link=e.get("link"), kaynak=m.kaynak)
                    if o["link"] and o["link"].startswith("kart_kucult:"):
                        q.kart_kucult(o["link"][12:], o["kalan"], o)   # borçtan düşülen stok iadesi kartı küçültür (karar (4))
                    elif o["link"]:
                        q.bagla(o, q.hedefler(o["link"]))
                    q.net()
        return q

    def kuyruk(self, c, t, fg=False):
        """Karar (2): bağ hedefinde bağsız kapanmış kısım bulunursa o kısım bağa ayrılır ve kuyruk baştan oynatılır (yakınsayana kadar)."""
        anah = (c, t, fg)
        if anah in self._kq:
            return self._kq[anah]
        olaylar, susulan = self._kuyruk_olaylari(c, t)
        rezerv = {}
        for _ in range(60):
            q = self._oynat(c, olaylar, rezerv, fg)
            if not q.cakisma:
                break
            for k_, v in q.cakisma.items():
                rezerv[k_] = rezerv.get(k_, 0) + v
        else:
            raise AssertionError(f"kuyruk yakınsamadı: {c} {t}")
        q.susulan = susulan + q.susulan_ek
        self._kq[anah] = q
        return q

    def acik_kalemler(self, c, t):
        return self.kuyruk(c, t).acik_ogeler()

    def acik_faturalar(self, c, t):
        """Fatura durumu (karar (5)): karşı yönlü faturalar birbirini bağsız kapatmaz — ayrı görünüm."""
        out, sira = {}, []
        for o in sorted((o for o in self.kuyruk(c, t, fg=True).ogeler if o["kalan"] > 0 and o["tur"] == "fatura"), key=s2_anahtari):
            if o["k"] not in out:
                out[o["k"]] = {"fatura": o["k"].split(":", 1)[1], "kalan": 0, "vade": o["vade"], "tarih": o["tarih"]}
                sira.append(o["k"])
            out[o["k"]]["kalan"] += o["kalan"] if o["taraf"] == "b" else -o["kalan"]
        return [out[k] for k in sira]

    def gecikmis(self, c, t):
        """B1 A + S1 A + M1f: vadesi geçmiş (vade < t) açık borç kalemleri; şüpheli kuyruğu ayrı (S3 A)."""
        q = self.kuyruk(c, t)
        top, detay = 0, []
        for o in q.acik("b"):
            if self.k.B1 != "A" and o["tur"] == "fatura":
                continue
            if o["vade"] < t:
                top += o["kalan"]
                detay.append({"kalem": o["k"], "vade": o["vade"], "kalan": o["kalan"]})
        sup = sum(x["kalan"] for x in q.supheli)
        out = {"cari": c, "tarih": t, "gecikmis": top, "supheli": sup, "detay": detay}
        if q.susulan:
            out["kahin_susuyor"] = q.susulan
        return out

    def hatirlatma(self, t):
        """Ödeme Hatırlatma seçimi (S3 A + S7 A, kullanıcı 21:08): şüpheli kaydı AÇIK (128 > 0) cari otomatik listeye girmez; "Şüpheli
        Alacağı Var" etiketiyle görünür, elle seçilirse iletide şüphelisiz gecikmiş tutar (elle)."""
        oto, sup, elle = {}, [], {}
        for c in sorted(self.tanim["cariler"]):
            g = self.gecikmis(c, t)
            if g["supheli"] > 0:
                sup.append(c)
                if g["gecikmis"] > 0:
                    elle[c] = g["gecikmis"]
            elif g["gecikmis"] > 0:
                oto[c] = g["gecikmis"]
        return {"tarih": t, "otomatik": oto, "supheli_etiketli": sup, "elle": elle}

    def kartlar_raporu(self, c, t):
        q = self.kuyruk(c, t)
        out = {}
        for kid, kk in sorted(q.kartlar.items()):
            tak = [o for o in kk["taksitler"] + kk["kalani"] if o["tutar"] - o["kucultme"] > 0]
            out[kid] = {"kapali": kk["kapali"], "taksitler": [{"vade": o["vade"], "tutar": o["tutar"] - o["kucultme"], "kalan": o["kalan"]}
                                                             for o in sorted(tak, key=s2_anahtari)]}
        return out

    # -- dondurma (Ç3) ve kural farkı (KG-15)
    def kural_farki_yillik(self):
        """Donmuş (eski kural) ile güncel türetme farkı; (hesap, cari, mali yıl) boyutunda (EK-1 M7)."""
        if self.donmus is None or self.kural_farki_fisi is not None:
            return {}
        guncel = defaultdict(int)
        for m in self.gecis().maddeler:
            if m.tarih <= self.donmus_sinir:
                for s in m.satirlar:
                    guncel[(s["h"], s["c"], yil(m.tarih))] += s["b"] - s["a"]
        for m in self.donmus:
            for s in m.satirlar:
                guncel[(s["h"], s["c"], yil(m.tarih))] -= s["b"] - s["a"]
        return {k: v for k, v in guncel.items() if v}

    def kural_farki(self, t=None):
        top = defaultdict(int)
        for (h, c, y), v in self.kural_farki_yillik().items():
            top[(h, c)] += v
        return {anahtar(*k): v for k, v in sorted(top.items(), key=lambda x: (x[0][0], x[0][1] or "")) if v}


# ------------------------------------------------------------------------------------------------ model (senaryo koşucusu)
KAYNAK_TURLERI = {
    "kasa_acilis", "cari_acilis", "banka_acilis", "kart_acilis", "kredi_acilis", "stok_acilis", "evrak_acilis", "taksit_excel",
    "satis_faturasi", "alis_faturasi", "satis_iade_faturasi", "alis_iade_faturasi", "esmm", "gelen_smm", "mahsup", "taslak",
    "tahsilat", "odeme", "kayit_tahsilati", "kasa_giris", "kasa_cikis", "bankadan_kasaya", "kasadan_bankaya", "banka_transfer",
    "banka_masraf", "banka_masraf_faturali", "faiz_geliri", "faiz_gideri", "banka_diger_gelir", "banka_diger_gider", "planli_islem",
    "hesapsiz_hareket", "kart_borcuna_aktar", "pos_aktar", "pos_komisyon_faturasi", "pos_iade", "kart_harcama", "kart_borc_odeme",
    "kart_faiz", "kredi_kullan", "kredi_odeme", "evrak_tahsile_ver", "evrak_bankadan_geri_al", "evrak_tahsil", "evrak_karsiliksiz",
    "verilen_evrak_ode", "verilen_evrak_geri_al", "taksit_karti", "taksit_kapat", "vergi_odeme", "gecikme_zammi", "supheliye_al",
    "karsilik_ayir", "degersiz_yaz", "supheliden_cikar", "stok_giris", "stok_cikis_satis", "stok_musteri_iadesi",
    "stok_tedarikci_iadesi", "stok_duzeltme", "borc_yaz", "alacak_yaz", "ters",
}
EVRAK_ISLEMLERI = {"evrak_tahsile_ver", "evrak_bankadan_geri_al", "evrak_tahsil", "evrak_karsiliksiz", "verilen_evrak_ode",
                   "verilen_evrak_geri_al", "odeme"}


class Model:
    def __init__(self, senaryo, kurallar=None):
        self.s = senaryo
        self.k = kurallar or Kurallar()
        self.sayac = Sayac()
        self.tanim = {x: dict(senaryo.get(x, {})) for x in ("cariler", "bankalar", "poslar", "kartlar", "krediler", "urunler")}
        self.canli = Dosya(self.tanim, self.k, self.sayac, "canli", senaryo.get("defter_turu", "bilanco"))
        self.arsivler, self.devirler = [], []
        self.raporlar, self.redler, self.uyarilar = {}, [], []
        self.no = 0

    # -- olay
    def kos(self):
        for i, o in enumerate(self.s["olaylar"]):
            self.no = i + 1
            try:
                self.uygula(o, self.canli)
            except Red as r:
                self.redler.append({"olay": i + 1, "tur": o["tur"], "kod": r.kod, "neden": r.neden})
        return self.sonuc()

    def dosya(self, ad):
        if ad in (None, "canli"):
            return self.canli
        if ad == "arsiv":
            return self.arsivler[-1]
        if ad.startswith("arsiv:"):
            return self.arsivler[int(ad.split(":")[1])]
        raise KeyError(ad)

    def uygula(self, o, d):
        tur = o["tur"]
        if tur == "rapor":
            return self.rapor(o)
        if tur == "devir":
            return self.devir(o)
        if tur == "devri_yenile":
            return self.devri_yenile(o)
        if tur == "devri_geri_al":
            return self.devri_geri_al(o)
        if tur in KAYNAK_TURLERI:
            return self.kaynak(o, d)
        return getattr(self, "_o_" + tur)(o, d)

    def kaynak(self, o, d):
        tur, tarih = o["tur"], o["tarih"]
        d.kilit_denetimi(tarih)
        # S20 A (README Y15): yedekten gelen eski sürüm verisi ("yedekten": geri yüklenen yedekte / göç verisinde vardı) aynen — S12 ve açılışın R8'i
        # yalnız YENİ kayıtta
        yedek = bool(o.get("yedekten"))
        v = {k: x for k, x in o.items() if k not in ("tur", "tarih", "id", "yedekten")}
        self._denetle(tur, tarih, v, d, yedek)
        if tur not in ("kasa_acilis", "devir_kasa") and not yedek:
            self._kasa_acilis_oncesi(d, tarih, lambda dd: dd.kaynak_ekle(tur, tarih, copy.deepcopy(v), o.get("id")).id)
        return d.kaynak_ekle(tur, tarih, v, o.get("id"), geri=yedek)

    @staticmethod
    def _kasa_acilis_oncesi(d, tarih, dene):
        """S12 A (kullanıcı 06.11 03:35; README bakım 3 T9–T13): Kasa açılışından ÖNCE tarihli Kasa hareketi reddedilir (409; bankadaki
        bank-before-opening'in karşılığı) — yeni kayıt da düzeltme de, kaydın TAMAMI. Kasa hareketi = 100'e yazan her kaynak (("kasa",) modül
        hareketi; R8 ve kasa_acilis_ilk ile aynı tanım). Aynı gün olur (açılış günün başı); açılışsız Kasa'da kural yok. dene(dd): kaydı
        kopyaya uygular, kimliğini döndürür (kopyanın sayacı ayrı — asıl dosyanın sıra numaraları değişmez)."""
        a0 = min((k.tarih for k in d.kaynaklar.values() if k.tur in ("kasa_acilis", "devir_kasa") and k.durum == "aktif"), default=None)
        if a0 is None or tarih >= a0:
            return
        dd = d.kopya()
        dd.sayac = Sayac()
        dd.sayac.n = d.sayac.n
        kid = dene(dd)
        once = [t for (t, anah, _) in dd.gecis()._modk.get(kid, []) if anah == ("kasa",) and t < a0]
        if once:
            raise Red("KASA_ACILIS_ONCE", f"Kasa hareketi {min(once)} < Kasa açılışı {a0}")

    def _denetle(self, tur, tarih, v, d, yedek=False):
        """Olay anında reddedilmesi gereken istekler (program 4xx)."""
        if tur == "kasa_acilis":                     # M-01: bir kez, ilk hareketten önce
            if any(k.tur == "kasa_acilis" and k.durum == "aktif" for k in d.kaynaklar.values()):
                raise Red("KASA_ACILIS_TEKRAR")
            if not yedek and any(x[3] == ("kasa",) and x[0] < tarih for x in d.gecis().mod):
                raise Red("KASA_ACILIS_SONRA", "kasada açılıştan önce hareket var")
        if tur == "supheliye_al":                    # J-01: ≤ carinin borç bakiyesi
            c = v["cari"]
            bak = d.bakiyeler(tarih).get((d.cari_hesap(c), c), 0)
            if v["tutar"] > bak:
                raise Red("SUPHELI_FAZLA", f"{v['tutar']} > carinin borç bakiyesi {bak}")
        if tur == "karsilik_ayir":                   # J-02 / kabul K5: kayıt başına ≤ kalan şüpheli − mevcut karşılık (EK-2 31: kayıt zorunlu)
            r = d.gecis().karsilik_hedefi(v["cari"], Gecis._kayit_gerek(v))
            if r is None or v["tutar"] > r["kalan"] - r["karsilik"]:
                raise Red("KARSILIK_FAZLA")
        if tur in ("degersiz_yaz", "supheliden_cikar"):
            if d.gecis().karsilik_hedefi(v["cari"], Gecis._kayit_gerek(v)) is None:
                raise Red("SUPHELI_YOK")
        if tur == "tahsilat" and (v.get("normal_cari") or v.get("fatura")):   # plan §3.11b/2 (a)–(b) SINIR
            acik = [r for r in d.gecis().supheli.get(v["cari"], []) if r["kalan"] > 0 and r["tarih"] <= tarih]
            # S39 A (README X1–X6): faturaya bağlı Kredi Kartına İade de S14 / S25 kuralıyla (bakım 5'in Z8 susması kalktı)
            bak = d.bakiyeler(tarih).get((d.cari_hesap(v["cari"]), v["cari"]), 0)
            normal = self._s14_normal(d, tarih, v) if acik else v["tutar"]   # S14 / S25 A (README Y4, Z6): 128 kısmı ve fazla normal değil
            if acik and normal > bak:
                raise Red("SUPHELI_NORMAL_ASIM", f"{normal} > 120 bakiyesi {bak}")
        if tur in EVRAK_ISLEMLERI and tur != "odeme":
            e = d.gecis().evrak.get(v["evrak"])
            gerek = {"evrak_tahsile_ver": ("portfoy",), "evrak_bankadan_geri_al": ("tahsilde",), "evrak_tahsil": ("portfoy", "tahsilde"),
                     "evrak_karsiliksiz": ("portfoy", "tahsilde", "ciro"), "verilen_evrak_ode": ("verildi",),
                     "verilen_evrak_geri_al": ("verildi",)}[tur]
            if e is None or e["durum"] not in gerek:
                raise Red("EVRAK_DURUMU", f"{v['evrak']} {e and e['durum']}")
        if tur == "odeme" and v.get("yol") == "ciro":
            e = d.gecis().evrak.get(v["evrak"])
            if e is None or e["durum"] != "portfoy":
                raise Red("EVRAK_DURUMU")

    @staticmethod
    def _s14_normal(d, tarih, v):
        """S14 + S25 A (README Y4, Z6): şüpheli caride faturaya bağlı tahsilatın SUPHELI_NORMAL_ASIM sınırına giren kısmı = bağla faturanın 120'deki kısmını
        kapattığı tutar. 128'den düşen kısım (S14 / S25 (a), (c), S39) ve faturanın açık kısmını aşan FAZLA (S25 (b): carinin bağsız alacağı, avans) sınıra girmez.
        Bağsız ("Normal Cari Hesaba İşle") ya da S14 yolu olmayan tahsilatta tutarın tamamı. Kaydı kopyaya uygulayıp türetilmiş kuyruktan okur (asıl dosya
        değişmez)."""
        if not (v.get("fatura") and v.get("yol") in S14_YOLLARI):
            return v["tutar"]
        dd = d.kopya()
        dd.sayac = Sayac()
        dd.sayac.n = d.sayac.n
        kid = dd.kaynak_ekle("tahsilat", tarih, copy.deepcopy(v)).id
        bag = sum(o["bagla"] for o in dd.kuyruk(v["cari"], tarih).ogeler if o["kaynak"] == kid and o["taraf"] == "a")
        return bag

    # -- düzenle / iptal / sil (G-7)
    def _hedef(self, o, d):
        k = d.kaynaklar.get(o["kaynak"])
        if k is None:
            raise Red("YOK", o["kaynak"])
        d.kilit_denetimi(k.tarih)
        return k

    def _o_duzenle(self, o, d):                      # F-14, C-03
        k = self._hedef(o, d)
        dg = o.get("degisiklik", {})
        if "tarih" in dg:
            d.kilit_denetimi(dg["tarih"])
            if k.tur == "kasa_acilis":               # EK-2B 33: ilk Kasa hareketinden SONRAYA alınamaz (aynı gün olur)
                ilk = [x[0] for x in d.gecis().mod if x[3] == ("kasa",) and x[5] != k.id]
                if ilk and dg["tarih"] > min(ilk):
                    raise Red("KASA_ACILIS_SONRA", f"ilk Kasa hareketi {min(ilk)}")
        if k.tur not in ("kasa_acilis", "devir_kasa"):   # S12 A + EK-2 §4 (8) (README bakım 3 T12): düzeltme de açılıştan önceye Kasa hareketi yazamaz
            yeni_t = dg.get("tarih", k.tarih)
            try:
                self._kasa_acilis_oncesi(d, dg.get("tarih", k.tarih), lambda dd: self._duzelt(dd.kaynaklar[k.id], dg))
            except Red:
                # S26 A (kullanıcı 06.11 06:26; README Z9) + S40 A (kullanıcı 06.11 08:06; README X7–X10): geri yüklenmiş (yedekten / Silinenler'den — Z9 BAŞ
                # MİMAR KARARI 06.11 07:59), açılıştan önce tarihli Kasa kaydının tarihi değişmeden tutarı, açıklaması ya da carisi (tek tek ya da birlikte)
                # düzeltilirse kabul — Mutabakat Testi uyarısı sürer (kayıt geri yüklenmiş kalır). Cari değişince kaydın CH satırı yeni cariye geçer (G-7; X9).
                # Tarih değişiyorsa ya da kayıt geri yüklenmemişse ya da düzeltme öncesi açılıştan önce Kasa hareketi değilse T12 aynen (düzeltmenin tamamı)
                if not (k.geri and self._kasa_once_mi(d, k) and yeni_t == k.tarih):
                    raise
                self._s40_kapsam(k, dg)
        self._duzelt(k, dg)
        d.degisti()

    @staticmethod
    def _s40_kapsam(k, dg):
        """S40 A kapsamı (README X7, X11): karar metni tutar dışı alan olarak açıklama ve cariyi sayar. Kâhinin sustuğu (senaryo hatası; KULLANICIYA SORULMALI
        1–2): (a) parantezde sayılmayan alan (fatura / taksit kartı bağı, Normal Cari Hesaba İşle, banka, evrak …), (b) BAĞLI kaydın carisi (bağ ne olur — karar
        söylemez), (c) carisiz Kasa kaydına cari (kaydın türü değişir; model dilinde yok)."""
        disi = sorted(set(dg) - set(S26_S40_ALANLARI))
        if disi:
            raise AssertionError(f"senaryo hatası: geri yüklenmiş, açılıştan önce tarihli Kasa kaydının karar metninde sayılmayan alanı düzeltildi ({disi}) — S40 "
                                 "yalnız açıklama ve cari; kâhin susar (README bakım 6 X11 (a), KULLANICIYA SORULMALI 1)")
        if "cari" in dg and dg["cari"] != k.v.get("cari"):
            if "cari" not in k.v:
                raise AssertionError("senaryo hatası: carisiz Kasa kaydına cari eklendi — kaydın türü değişir; model dilinde yok (README bakım 6 X11 (c))")
            if k.v.get("fatura") or k.v.get("taksit_karti"):
                raise AssertionError("senaryo hatası: bağlı (Kapatılacak Fatura / taksit kartı) kaydın carisi düzeltildi — bağ ne olur, karar söylemez; kâhin susar "
                                     "(README bakım 6 X11 (b), KULLANICIYA SORULMALI 2)")

    @staticmethod
    def _kasa_once_mi(d, k):
        """Kayıt (düzeltmeden önce) Kasa açılışından önce tarihli Kasa hareketi yazıyor mu (S12 / S20 / S26; Mutabakat uyarısının konusu)."""
        a0 = min((x.tarih for x in d.kaynaklar.values() if x.tur in ("kasa_acilis", "devir_kasa") and x.durum == "aktif"), default=None)
        return a0 is not None and any(anah == ("kasa",) and t < a0 for (t, anah, _) in d.gecis()._modk.get(k.id, []))

    @staticmethod
    def _duzelt(k, dg):
        if "tarih" in dg:
            k.tarih = dg["tarih"]
        k.v.update({a: copy.deepcopy(b) for a, b in dg.items() if a != "tarih"})
        return k.id

    def _o_iptal(self, o, d):                        # F-15, D-03 (POS İptal Et)
        k = self._hedef(o, d)
        k.durum = "iptal"
        d.degisti()

    def _o_sil(self, o, d):                          # R-04
        k = self._hedef(o, d)
        if k.tur in FATURA_TURLERI:                  # EK-2B 35 (2.0.17 m1): kendi kartında tahsilat alınmış fatura silinemez
            kartlar = {x.id for x in d.kaynaklar.values() if x.tur == "taksit_karti" and x.durum == "aktif"
                       and x.v.get("kaynak") == "fatura" and x.v.get("fatura") == k.id}
            if any(y.tur == "tahsilat" and y.durum == "aktif" and y.v.get("taksit_karti") in kartlar for y in d.kaynaklar.values()):
                raise Red("FATURA_SIL_TAHSILATLI_KART", k.id)
        k.durum = "silindi"
        d.degisti()

    def _o_geri_yukle(self, o, d):                   # R-04 + "Fatura listesinde SİLME" kararı (GECMIS-KARARLAR 2.0.17)
        k = self._hedef(o, d)
        if k.tur in FATURA_TURLERI and k.durum == "silindi":
            k.durum = "iptal"                         # kaydedilmiş belge geri yüklenince ETKİSİZ, "İptal Edildi" olarak döner
        else:
            k.durum = "aktif"                         # öbür kayıtlar (ve taslak) olduğu gibi döner
        k.geri = True                                 # S20 A (README Y15–Y17): aynen geri gelir (S12 yalnız yeni kayıtta); Mutabakat uyarısı
        d.degisti()

    def _o_evrak_islem_geri_al(self, o, d):          # Ç-12
        g = d.gecis()
        e = g.evrak.get(o["evrak"])
        if not e or not e["gecmis"]:
            raise Red("GERI_ALINACAK_ISLEM_YOK")
        kid = e["gecmis"][-1][0]
        k = d.kaynaklar[kid]
        d.kilit_denetimi(k.tarih)
        k.durum = "geri_alindi"
        d.degisti()

    def _o_cari_tur_degistir(self, o, d):            # G-2
        c = o["cari"]
        if d.kilit and any(k.v.get("cari") == c and k.tarih <= d.kilit for k in d.kaynaklar.values()):
            raise Red("KILITLI_DONEM", "kilitli dönemde hareketi olan carinin türü değişmez")
        self.tanim["cariler"][c] = dict(self.tanim["cariler"][c], tur=o["yeni_tur"])
        for x in [self.canli] + self.arsivler:
            x.degisti()

    # -- saklanan fişler
    def _o_kdv_mahsup(self, o, d):                   # V-01
        ay = o["ay"]
        t = ay_sonu(ay)
        d.kilit_denetimi(t)
        if any(f.tur == "kdv_mahsup" and f.ek.get("ay") == ay and f.ters is None for f in d.fisler):
            raise Red("KDV_MAHSUP_TEKRAR", ay)
        haric = {f.id for f in d.fisler if f.tur == "kdv_mahsup" or (f.tur == "ters" and f.ek.get("kdv"))}
        # EK-1 M8: satırlar DÖNEM ETİKETİNE göre (açılış sınıfı dahil); S4 A: dönemi M olan 191 / 391 NET hareketi
        et = kdv_etiketleri(d, t, haric)
        H = -et.get(("391", ay), 0)
        I = et.get(("191", ay), 0)
        D = d.bakiyeler(t).get(("190", None), 0)
        net = I + D - H
        satirlar = [Bo("391", H, donem=ay), Al("191", I, donem=ay)]
        if net >= 0:
            satirlar.append(L("190", I - H))
        else:
            satirlar += [Al("190", D), Al("360", H - I - D)]
        if not any(s["b"] or s["a"] for s in satirlar):
            raise Red("KDV_MAHSUP_BOS", ay)
        d.fis_ekle(t, 2, "kdv_mahsup", satirlar, {"ay": ay, "H": H, "I": I, "D": D}, id=o.get("id"))
        sonra = kdv_etiketleri(d, t)                 # EK-1 §4 (10): mahsuptan hemen sonra dönemi M olan 191 ve 391 = 0
        if sonra.get(("191", ay), 0) or sonra.get(("391", ay), 0):
            d.kdv_ihlal.append({"ay": ay, "tarih": t, "191": sonra.get(("191", ay), 0), "391": sonra.get(("391", ay), 0)})

    def _o_fis_ters(self, o, d):                     # R-03
        f = next((x for x in d.fisler if x.id == o["fis"]), None)
        if f is None:
            raise Red("YOK", o["fis"])
        self._ters_fis(f, o.get("tarih") or f.tarih, d)

    def _o_kdv_mahsup_geri_al(self, o, d):           # R-03 (KDV mahsubu Geri Al)
        f = next((x for x in d.fisler if x.tur == "kdv_mahsup" and x.ek.get("ay") == o["ay"] and x.ters is None), None)
        if f is None:
            raise Red("YOK", o["ay"])
        self._ters_fis(f, o.get("tarih") or f.tarih, d)

    def _ters_fis(self, f, tarih, d):
        if f.ters is not None:
            raise Red("ZATEN_TERS", f.id)
        d.kilit_denetimi(tarih)
        y = d.fis_ekle(tarih, f.sinif, "ters", [L(s["h"], s["a"] - s["b"], s["c"], **(s["e"] or {})) for s in f.satirlar],
                       {"ters_of": f.id, "kdv": f.tur == "kdv_mahsup"})
        f.ters = y.id
        d.degisti()

    def _o_acilis_eslestir(self, o, d):              # M-11
        t = o["tarih"]
        d.kilit_denetimi(t)
        satirlar = []
        for x in o["satirlar"]:
            h = x["hesap"]
            if not bilanco_hesabi(h) or ana(h) == G:
                raise Red("ESLESTIRME_HESAP", h)
            if h in ("570", "580"):                  # EK-2 26: yıl girilmezse 570.0000 / 580.0000 "Yılı Belirtilmemiş"
                h += ".0000"
            satirlar.append(L(h, x.get("borc", 0) - x.get("alacak", 0), x.get("cari")))
        top = sum(s["b"] - s["a"] for s in satirlar)
        g0 = d.bakiyeler(t).get((G, None), 0)
        g1 = g0 - top
        if g0 == 0 or (g0 > 0 and not 0 <= g1 < g0) or (g0 < 0 and not g0 < g1 <= 0):
            raise Red("ESLESTIRME_TERS", f"G {g0} → {g1}")
        satirlar.append(L(G, -top))
        d.fis_ekle(t, 0, "acilis_eslestirme", satirlar)

    # -- dönem kilidi (Ç3) ve KG-15
    def _o_donem_kilitle(self, o, d):
        t = o["tarih"]
        kural = o.get("kural")
        if kural == "2.4.9":
            eski = Gecis(d, kural="2.4.9").kos()
            d.donmus = [m for m in eski.maddeler if m.tarih <= t]
            d.donmus_sinir = t
            d.donmus_kural = "2.4.9"
        d.kilit = max(t, d.kilit) if d.kilit else t
        d.degisti()

    def _o_kural_farki_duzelt(self, o, d):           # N-16 (KG-15 A: ilk açık güne düzeltme fişi; B: düzeltilmez)
        if self.k.KG15 != "A":
            raise Red("KG15_B_DUZELTILMEZ")
        fark = d.kural_farki_yillik()
        if not fark:
            raise Red("KURAL_FARKI_YOK")
        fis_yili = yil(ertesi(d.kilit))
        top = defaultdict(int)
        for (h, c, y), v in fark.items():
            if sonuc_hesabi(h) and y < fis_yili:     # EK-1 M7: önceki mali yılın sonuç farkı → 671 (gelir yönlü) / 681 (gider yönlü)
                h = "681" if v > 0 else "671"
            top[(h, c)] += v                         # aynı mali yıl: eski kuralın hesabının tersi (KG-15 A örneği)
        satirlar = [L(h, v, c) for (h, c), v in sorted(top.items(), key=lambda x: (x[0][0], x[0][1] or "")) if v]
        f = d.fis_ekle(ertesi(d.kilit), 1, "kural_farki", satirlar)
        d.kural_farki_fisi = f.id

    # -- raporlar
    def rapor(self, o):
        d = self.dosya(o.get("dosya"))
        r = o["rapor"]
        if r == "mizan":
            x = d.mizan(o["bas"], o["son"])
        elif r == "gelir_tablosu":
            x = d.gelir_tablosu(o["bas"], o["son"])
        elif r == "bilanco":
            x = d.bilanco(o["tarih"])
        elif r == "buyuk_defter":
            x = d.buyuk_defter(o["hesap"], o["bas"], o["son"], o.get("cari"))
        elif r == "gecikmis":
            x = d.gecikmis(o["cari"], o["tarih"])
        elif r == "gecikmis_tumu":
            x = {c: d.gecikmis(c, o["tarih"])["gecikmis"] for c in sorted(self.tanim["cariler"])}
        elif r == "hatirlatma":
            x = d.hatirlatma(o["tarih"])
        elif r == "acik_kalemler":
            x = [{"k": a["k"], "tur": a["tur"], "kalan": a["kalan"] if a["taraf"] == "b" else -a["kalan"], "vade": a["vade"],
                  "tarih": a["tarih"]} for a in d.acik_kalemler(o["cari"], o["tarih"])]
        elif r == "acik_faturalar":
            x = d.acik_faturalar(o["cari"], o["tarih"])
        elif r == "degerleme":
            x = d.degerleme(o["tarih"])
        elif r == "yevmiye":
            x = [m.sozluk() for m in d.maddeler() if o.get("bas", "0000") <= m.tarih <= o.get("son", "9999")]
        elif r == "moduller":
            x = {anahtar(*k) if len(k) == 2 else k[0]: v for k, v in d.moduller(o.get("tarih")).items()}
        elif r == "kural_farki":
            x = d.kural_farki()
        elif r == "kaynak_durumu":
            x = d.kaynaklar[o["kaynak"]].durum
        elif r == "supheli_kayitlari":
            x = [dict(r_) for r_ in d.gecis().supheli.get(o["cari"], [])]
        elif r == "kartlar":
            x = d.kartlar_raporu(o["cari"], o["tarih"])
        elif r == "kilit_bag_notu":
            x = [dict(n) for n in d.kuyruk(o["cari"], o["tarih"]).notlar]
        elif r == "mutabakat_uyarilari":
            x = d.mutabakat_uyarilari(o["tarih"])
        elif r == "acilis_fisleri":
            x = sorted({m.ek.get("fis_grubu") for m in d.maddeler() if m.tarih == o["tarih"] and m.sinif == 0 and m.ek.get("fis_grubu")})
        else:
            raise KeyError(r)
        self.raporlar[o["ad"]] = x

    # -- devir (N-01…N-13), Devri Yenile (N-14), Devri Geri Al (N-15)
    def devir(self, o):
        K = o["K"]
        if K[5:] != "12-31":                         # EK-1 M11: K yalnız geçmiş bir yılın 31 Aralık'ı
            raise Red("DEVIR_K_31_ARALIK", K)
        if o.get("bugun") and K >= o["bugun"]:
            raise Red("DEVIR_K_GELECEK", f"{K} ≥ bugün {o['bugun']}")
        secenek = o.get("secenek", "borc_alacak")
        did = f"devir-{yil(K)}-{len(self.devirler) + 1}"
        canli = self.canli
        yedek = canli.kopya()
        arsiv = Dosya(self.tanim, self.k, self.sayac, f"arsiv-{yil(K)}", canli.defter_turu)
        arsiv.arsiv = True
        arsiv.ust = K
        arsiv.kaynaklar = {i: copy.deepcopy(k) for i, k in canli.kaynaklar.items() if k.tarih <= K}
        arsiv.fisler = [copy.deepcopy(f) for f in canli.fisler if f.tarih <= K]
        if canli.donmus is not None:
            arsiv.donmus, arsiv.donmus_sinir, arsiv.donmus_kural = canli.donmus, canli.donmus_sinir, canli.donmus_kural
            arsiv.kural_farki_fisi = canli.kural_farki_fisi
        arsiv.kdv_ihlal = [x for x in canli.kdv_ihlal if x["tarih"] <= K]
        arsiv.degisti()
        kapanis = self._kapanis(arsiv, K, did)
        arsiv.kilit = K
        yeni = Dosya(self.tanim, self.k, self.sayac, "canli", canli.defter_turu)
        yeni.kaynaklar = {i: copy.deepcopy(k) for i, k in canli.kaynaklar.items() if k.tarih > K}
        yeni.fisler = [copy.deepcopy(f) for f in canli.fisler if f.tarih > K]
        yeni.kdv_ihlal = [x for x in canli.kdv_ihlal if x["tarih"] > K]
        yeni.kilit = K
        s19 = s19_devir_kayitlari(yeni, K)
        kilide_cek(yeni, K)
        acilis = self._acilislar(arsiv, yeni, K, secenek, did)
        kayit = {"id": did, "K": K, "secenek": secenek, "yedek": yedek, "kapanis": kapanis, "acilis": acilis, "s19_devir": s19}
        self.arsivler.append(arsiv)
        self.devirler.append(kayit)
        self.canli = yeni
        kayit["degismezler"] = devir_degismezleri(arsiv, yeni, K, yedek, did, devirsiz=kilitli_kopya(yedek, yeni.kilit), kapanis=kapanis,
                                                  acilis=acilis)
        self.raporlar[o.get("ad", did)] = self._devir_raporu(kayit, arsiv, yeni)

    @staticmethod
    def _s24_harfiyen(arsiv, yeni, s19):
        """YALNIZ mutasyon B55 içindir (S24 B: "S19 harfiyen — yazıldığı andaki sonuç (fatura yeniden açık) kalır, devir açık faturayı taşır"; karşılıksız
        tarafı: yazılış kilidinde S8 olan karşılıksızın yeni yıldaki kalemi faturanın KENDİ vadesini alır). Kâhinin kuralı bu DEĞİL — S24 A (README Z2)."""
        for kid in s19:
            k = yeni.kaynaklar[kid]
            if k.tur != "evrak_karsiliksiz":
                continue
            p = arsiv.kaynaklar.get((arsiv.gecis().evrak.get(k.v["evrak"]) or {}).get("kaynak") or "")
            f = arsiv.kaynaklar.get(p.v.get("fatura") or "") if p is not None else None
            if f is not None and (k.kilit is None or p.tarih > k.kilit):
                k.v["_s24_vade"] = f.v.get("vade") or f.tarih

    def _devir_raporu(self, kayit, arsiv, yeni, onceki=None):
        K = kayit["K"]
        kap = {anahtar(*k): v for k, v in sorted(arsiv.bakiyeler(K).items(), key=lambda x: (x[0][0], x[0][1] or "")) if bilanco_hesabi(k[0])}
        acl = {anahtar(*k): v for k, v in sorted(acilis_bakiyeleri(yeni, K, kayit["id"]).items(), key=lambda x: (x[0][0], x[0][1] or ""))}
        r = {"K": K, "secenek": kayit["secenek"], "arsiv_kapanis": kap, "yeni_acilis": acl, "kapanis": kayit["kapanis"],
             "acilis": {a: b for a, b in kayit["acilis"].items() if a != "kaynaklar"}, "degismezler": kayit["degismezler"],
             "s19_devir": kayit.get("s19_devir", [])}
        if onceki is not None:
            r["fark"] = {k: acl.get(k, 0) - onceki.get(k, 0) for k in sorted(set(acl) | set(onceki)) if acl.get(k, 0) != onceki.get(k, 0)}
        return r

    def _kapanis(self, arsiv, K, did):
        """EK-1 M4 Önceki Yıl Sonucu Fişleri (K tarihli, kapanış sınıfı, eskiden yeniye) → N-01 (K yılının SMM'si) → N-02/N-03 → N-04
        → (N-05 yok, KG-13 A) → N-06 → N-07 (yalnız K yılı)."""
        out = {"N01": {}, "onceki_yil": {}, "R": {}}
        yk = yil(K)
        ilk = min([m.tarih for m in arsiv.maddeler()] + [K])
        if self.k.KG12 == "A":                       # KG-12 A + M4: önceki yıllara HİÇBİR fiş o yılların tarihine yazılmaz
            for y in range(yil(ilk), yk):
                ya, yb = f"{y}-01-01", f"{y}-12-31"
                net = defaultdict(int)
                for m in arsiv.maddeler():
                    if m.tarih > yb:
                        break
                    if m.tarih < ya or m.sinif in GT_DISI:
                        continue
                    for s in m.satirlar:
                        if sonuc_hesabi(s["h"]):
                            net[(s["h"], s["c"])] += s["b"] - s["a"]
                smm = arsiv._tahmini_smm(ya, yb)[0]   # SMM_Y = DBS_Y + alış_Y − alış iadesi_Y − DSS_Y (§5)
                R = -sum(net.values()) - smm
                sat = [L(h, -v, c) for (h, c), v in sorted(net.items(), key=lambda x: (x[0][0], x[0][1] or "")) if v]
                sat.append(L("153", -smm))
                if R:                                # 570 / 580 yıl yıl BRÜT (mahsup yok); EK-2 26: alt hesap 570.YYYY / 580.YYYY
                    sat.append(L(f"570.{y}" if R > 0 else f"580.{y}", -R))
                if any(x["b"] or x["a"] for x in sat):   # EK-2 25 / E13: sınıf 4 "önceki yıl sonucu" (N-01'den önce, Gelir Tablosu dışı)
                    arsiv.fis_ekle(K, 4, "onceki_yil_sonucu", sat, {"adim": "N-08", "yil": y}, kaynak=did)
                out["onceki_yil"][str(y)] = {"SMM": smm, "R": R}
                out["R"][str(y)] = R
        fark = arsiv.ana_bakiye("153", K) - arsiv.deger(K)   # N-01: önceki yıl fişlerinden sonra = SMM_K (§5.2)
        if fark:
            arsiv.fis_ekle(K, 2, "stok_degerleme", [L("621", fark), L("153", -fark)], {"yil": yk}, kaynak=did)
        arsiv.degerlenen[yk] = (K, did)
        out["N01"][str(yk)] = fark
        out["DSS"] = arsiv.deger(K)
        bal = arsiv.bakiyeler(K)
        # N-02 / N-03 7/A yansıtma
        n2, n3 = [], []
        for kok, (yans, yhes) in YANSITMA.items():
            alt = {h: v for (h, c), v in bal.items() if ana(h) == kok}
            top = sum(alt.values())
            if top:
                n2 += [L(yans, top), L(yhes, -top)]
                n3 += [L(yhes, top)] + [L(h, -v) for h, v in sorted(alt.items())]
        if n2:
            arsiv.fis_ekle(K, 3, "kapanis", n2, {"adim": "N-02"}, kaynak=did)
            arsiv.fis_ekle(K, 3, "kapanis", n3, {"adim": "N-03"}, kaynak=did)
        # N-04 6xx → 690
        bal = arsiv.bakiyeler(K)
        n4, top = [], 0
        for (h, c), v in sorted(bal.items(), key=lambda x: (x[0][0], x[0][1] or "")):
            if h[0] == "6" and ana(h) not in ("690", "691", "692") and v:
                n4.append(L(h, -v, c))
                top += v
        if n4:
            n4.append(L("690", top))
            arsiv.fis_ekle(K, 3, "kapanis", n4, {"adim": "N-04"}, kaynak=did)
        sonuc = -top                                  # kâr > 0 (KG-12 A: yalnız K yılı; B: bütün yıllar)
        v691 = bal.get(("691", None), 0)              # EK-2 40 / kitap N-06: 691 varsa B 692 / A 691 (692 = 690 − 691)
        n6 = ([L("690", sonuc), L("692", -sonuc)] if sonuc else []) + ([L("692", v691), L("691", -v691)] if v691 else [])
        if n6:
            arsiv.fis_ekle(K, 3, "kapanis", n6, {"adim": "N-06"}, kaynak=did)
        sonuc -= v691
        if sonuc:
            arsiv.fis_ekle(K, 3, "kapanis", [L("692", sonuc), L("590" if sonuc > 0 else "591", -sonuc)], {"adim": "N-07"}, kaynak=did)
        out["sonuc"] = sonuc
        out["R"][str(yk)] = sonuc
        return out

    def _acilislar(self, arsiv, yeni, K, secenek, did):
        """N-09…N-13 + EK-1 M2 (her açık kalem kendi vadesiyle), M3 (defterde cari başına tek satır), M5, M12 (ekstre), M13 (128 ayrı)."""
        t = ertesi(K)
        ga = arsiv.gecis()
        mod = arsiv.moduller(K)
        bal = arsiv.bakiyeler(K)
        out = {"acik_kalemler": [], "cariler": {}, "ekstre": {}, "ekstre_cariler": [], "kartlar": {}, "supheli": {}, "stok": {},
               "eksi_stok": [], "kaynaklar": []}

        def ekle(tur, v):
            k = yeni.kaynak_ekle(tur, t, v, id=f"{did}:{tur}:{len(out['kaynaklar']) + 1}", devir=did)
            out["kaynaklar"].append(k.id)
            return k

        def isaret(x):
            return x["kalan"] if x["taraf"] == "b" else -x["kalan"]
        if mod.get(("kasa",)):
            ekle("devir_kasa", {"tutar": mod[("kasa",)]})
        kart_acik, supheli_kalem = defaultdict(list), {}
        for c in sorted(self.tanim["cariler"]):
            ch = arsiv.cari_hesap(c)
            ch_bal = bal.get((ch, c), 0)
            q = arsiv.kuyruk(c, K)
            ayri, kart_top, artik_ilk = [], 0, None
            for o in sorted((o for o in q.ogeler if o["kalan"] > 0), key=s2_anahtari):
                if o["kart"] and not q.kartlar.get(o["kart"], {}).get("kapali"):
                    kart_acik[o["kart"]].append({"vade": o["vade"], "kalan": o["kalan"], "tarih": o["tarih"], "sira": list(o["sira"])})
                    kart_top += o["kalan"]
                elif o["taraf"] == "b" or o["tur"] == "fatura":    # M2: her açık borç kalemi + açık fatura (G2) ayrı
                    ayri.append({"k": o["k"], "tur": o["tur"], "taraf": o["taraf"], "kalan": o["kalan"], "tarih": o["tarih"],
                                 "vade": o["vade"], "sira": list(o["sira"])})
                elif artik_ilk is None:
                    artik_ilk = o
            artik = ch_bal - sum(isaret(x) for x in ayri) - kart_top   # yalnız açık alacak (avans) ya da kartların karşıladığı kısım
            kalemler = list(ayri)
            if artik:
                bas = artik_ilk or {"vade": t, "tarih": t, "sira": (0, 0, 0)}
                kalemler.append({"k": f"devir_net:{c}", "tur": "devir_net", "taraf": "b" if artik > 0 else "a", "kalan": abs(artik),
                                 "tarih": bas["tarih"], "vade": bas["vade"], "sira": list(bas["sira"])})
            sup = [{"k": x["k"], "tur": x["tur"], "tarih": x["tarih"], "vade": x["vade"], "sira": list(x["sira"]), "kalan": x["kalan"],
                    "kayit": x.get("kayit")}
                   for x in sorted(q.supheli, key=s2_anahtari) if x["kalan"] > 0]
            if sup:
                supheli_kalem[c] = sup
                out["supheli"][c] = {"tutar": sum(x["kalan"] for x in sup), "kalemler": [{"k": x["k"], "kalan": x["kalan"],
                                                                                           "vade": x["vade"], "tarih": x["tarih"]} for x in sup]}
            for x in ayri:
                out["acik_kalemler"].append({"cari": c, "k": x["k"], "tur": x["tur"], "kalan": isaret(x), "vade": x["vade"],
                                             "belge_tarihi": x["tarih"]})
            if not ch_bal:                            # M12: bakiyesi 0 → satır yok (TYK'da bakiye 0 iken açık kalem kalmaz)
                continue
            ekle("devir_cari", {"cari": c, "tutar": ch_bal, "kalemler": kalemler})   # M3: defterde tek satır
            out["cariler"][c] = {"bakiye": ch_bal, "acilis": artik}
            out["ekstre_cariler"].append(c)
            hb = sum(s["b"] for m in arsiv.maddeler() if m.tarih <= K for s in m.satirlar if s["h"] == ch and s["c"] == c)
            ha = sum(s["a"] for m in arsiv.maddeler() if m.tarih <= K for s in m.satirlar if s["h"] == ch and s["c"] == c)
            satir, bak = [], 0

            def yaz(aciklama, borc, alacak, vade=None):
                nonlocal bak
                bak += borc - alacak
                satir.append({"tarih": t, "aciklama": aciklama, "borc": borc, "alacak": alacak, "vade": vade, "bakiye": bak})
            if secenek == "borc_alacak":              # M12: Borç / Alacak Toplamı açık kalemler düşülmüş
                bt = hb - sum(x["kalan"] for x in ayri if x["taraf"] == "b")
                at = ha - sum(x["kalan"] for x in ayri if x["taraf"] == "a")
                ozet = {"Borç Toplamı": bt, "Alacak Toplamı": at}
                if bt:
                    yaz("Devir — Borç Toplamı", bt, 0)
                if at:
                    yaz("Devir — Alacak Toplamı", 0, at)
            else:
                db = ch_bal - sum(isaret(x) for x in ayri)
                ozet = {"Devir Bakiyesi": db}
                if db:
                    yaz("Devir Bakiyesi", max(db, 0), max(-db, 0))
            for x in ayri:                            # açık kalemler vade sırasıyla (eşitse belge tarihi); asıl belge açıklamada
                no = x["k"].split(":", 1)[1] if x["k"] and ":" in x["k"] else x["k"]
                yaz(f"Devir: {no} ({x['tarih']})", x["kalan"] if x["taraf"] == "b" else 0, x["kalan"] if x["taraf"] == "a" else 0, x["vade"])
            out["ekstre"][c] = dict(ozet, acik_kalemler=len(ayri), satirlar=satir)
        for anah, v in sorted(mod.items(), key=lambda x: str(x[0])):
            if anah[0] == "banka":
                ekle("devir_banka", {"banka": anah[1], "tutar": v})
            elif anah[0] == "kart":
                ekle("devir_kart", {"kart": anah[1], "tutar": v})
            elif anah[0] == "kredi":
                ekle("devir_kredi", {"kredi": anah[1], "tutar": v})
        dg = arsiv.degerleme(K)                       # M5: miktar = K miktarı (eksi dahil), eksi üründe değer 0
        kal = [{"urun": u, "miktar": x["miktar"], "deger": x["deger"]} for u, x in sorted(dg["urunler"].items()) if Fraction(x["miktar"]) or x["deger"]]
        if kal:
            ekle("devir_stok", {"kalemler": kal})
        out["stok"] = {x["urun"]: {"miktar": x["miktar"], "deger": x["deger"]} for x in kal}
        out["eksi_stok"] = sorted(dg["eksi"])
        for eid, e in sorted(ga.evrak.items()):
            if e["durum"] in ("portfoy", "tahsilde", "verildi", "ciro", "karsiliksiz"):
                ekle("devir_evrak", {"evrak": eid, "durum_kaydi": {a: b for a, b in e.items() if a != "gecmis"}})
        for kid, it in sorted(ga.pos.items()):
            if it.get("gecersiz") or it["valor"] <= K:
                continue
            tutar = it["brut"] - it["iade"] - ((it["kom"] - it["kom_iade"]) if self.k.KG6 == "A" else 0)
            ekle("devir_pos", {"tahsilat": kid, "tutar": tutar, "kalem": {a: b for a, b in it.items() if a != "seq"}})
        for kid, y in sorted(ga.yoldaki.items()):
            if y["valor"] > K:
                ekle("devir_yoldaki", {"kaynak": kid, "alici": y["alici"], "tutar": y["tutar"], "valor": y["valor"]})
        for c, rs in sorted(ga.supheli.items()):
            sk, sp = ga.sup_toplam(c)
            if sk or sp:
                ekle("devir_supheli", {"cari": c, "kalan": sk, "karsilik": sp, "kalemler": supheli_kalem.get(c, []),
                                       "kayitlar": [dict(r) for r in rs if r["kalan"] or r["karsilik"]]})
        for kid, kt in sorted(ga.kart.items()):
            kayit = {a: b for a, b in kt.items() if a != "kapama"}
            kayit.update(kaynak="devir", ilk_kaynak=kt["kaynak"], acik_taksitler=kart_acik.get(kid, []))
            ekle("devir_taksit", {"kart": kid, "kart_kaydi": kayit, "odenen": mod.get(("taksit_odenen", kid), 0)})
            out["kartlar"][kid] = {"cari": kt["cari"], "acik_taksitler": [{"vade": x["vade"], "kalan": x["kalan"]} for x in kart_acik.get(kid, [])]}
        # N-13 tamamlayıcı: her bilanço hesabı (G hariç) için arşiv K bakiyesi − N-09…N-12'nin karşıladığı; 191 / 391 DÖNEM etiketiyle (M8-3)
        kars = defaultdict(int)
        for m in yeni.gecis().maddeler:
            if m.tarih == t and m.sinif == 0 and getattr(yeni.kaynaklar.get(m.kaynak), "devir", None) == did:
                for s in m.satirlar:
                    kars[(s["h"], s["c"])] += s["b"] - s["a"]
        tamam = []
        et = kdv_etiketleri(arsiv, K)
        for (h, c), v in sorted(bal.items(), key=lambda x: (x[0][0], x[0][1] or "")):
            if not bilanco_hesabi(h) or ana(h) == G:
                continue
            fark = v - kars.get((h, c), 0)
            if not fark:
                continue
            if h in KDV_HESAPLARI:
                for (hh, dn), x in sorted(et.items(), key=lambda z: (z[0][0], z[0][1] or "")):
                    if hh == h and x:
                        tamam.append(L(h, x, None, donem=dn))
                        fark -= x
            if fark:
                tamam.append(L(h, fark, c))
        for (h, c), v in kars.items():
            if bilanco_hesabi(h) and ana(h) != G and (h, c) not in bal and v:
                tamam.append(L(h, -v, c))
        if tamam:
            top = sum(s["b"] - s["a"] for s in tamam)
            tamam.append(L(G, -top))
            yeni.fis_ekle(t, 0, "devir_acilis", tamam, {"adim": "N-13", "fis_grubu": f"devir_acilis:{did}"}, kaynak=did)
        out["N13"] = {anahtar(s["h"], s["c"]) + (f"@{s['e']['donem']}" if s["e"] and s["e"].get("donem") else ""): s["b"] - s["a"]
                      for s in tamam}
        return out

    def devri_yenile(self, o):                       # N-14 (G7; EK-1 M9)
        if not self.devirler:
            raise Red("DEVIR_YOK")
        kayit = self.devirler[-1]
        did, K = kayit["id"], kayit["K"]
        arsiv, yeni = self.arsivler[-1], self.canli
        yedek_a, yedek_y = arsiv.kopya(), yeni.kopya()
        bugun = o.get("bugun") or ertesi(son_tarih(yeni))
        onceki_acl = {anahtar(*k): v for k, v in acilis_bakiyeleri(yeni, K, did).items()}
        onceki_acik = {x["k"]: x["kalan"] for x in kayit["acilis"]["acik_kalemler"]}
        gec_once = {c: yeni.gecikmis(c, bugun)["gecikmis"] for c in sorted(self.tanim["cariler"])}
        bag_once = bag_tutarlari(yeni, bugun)
        try:
            arsiv.fisler = [f for f in arsiv.fisler if f.kaynak != did]
            arsiv.degerlenen = {y: x for y, x in arsiv.degerlenen.items() if x[1] != did}
            arsiv.kilit = None                           # bakım kipi (yetkili + gerekçe)
            arsiv.ust = K
            arsiv.degisti()
            for x in o.get("duzeltmeler", []):
                if x.get("tarih", K) > K:
                    raise Red("ARSIV_TARIH", "düzeltme K'den sonra")
                self.uygula(x, arsiv)
            kapanis = self._kapanis(arsiv, K, did)
            arsiv.kilit = K
            # M9 A: ÇAKIŞMA yalnız düzeltmeyle TAMAMEN kapanan / yok olan açık kaleme K sonrası BAĞ varsa (kısmi düşüşte bağ korunur)
            bagli = defaultdict(int)
            for k in yeni.kaynaklar.values():
                if k.devir is None and k.v.get("fatura") and "fatura:" + k.v["fatura"] in onceki_acik:
                    bagli["fatura:" + k.v["fatura"]] += k.v.get("tutar", 0)
            yeni_acik = defaultdict(int)
            for c in self.tanim["cariler"]:
                for x in arsiv.acik_kalemler(c, K):
                    yeni_acik[x["k"]] += x["kalan"]
            cakisma = [f for f, b in bagli.items() if b and not yeni_acik.get(f, 0)]
            if cakisma:
                raise Red("DEVIR_YENILE_CAKISMA", ",".join(sorted(cakisma)))
            for kid in [i for i, k in yeni.kaynaklar.items() if k.devir == did]:
                del yeni.kaynaklar[kid]
            yeni.fisler = [f for f in yeni.fisler if f.kaynak != did]
            yeni.degisti()
            acilis = self._acilislar(arsiv, yeni, K, kayit["secenek"], did)
        except Exception:
            self.arsivler[-1], self.canli = yedek_a, yedek_y
            raise
        kayit["kapanis"], kayit["acilis"] = kapanis, acilis
        kayit["degismezler"] = devir_degismezleri(arsiv, yeni, K, None, did, devirsiz=devirsiz_dosya(arsiv, yeni, did), kapanis=kapanis,
                                                  acilis=acilis)
        r = self._devir_raporu(kayit, arsiv, yeni, onceki_acl)
        r["uyarilar"] = eksi_uyarilari(yeni)
        gec_sonra = {c: yeni.gecikmis(c, bugun)["gecikmis"] for c in sorted(self.tanim["cariler"])}
        r["gecikmis_degisen"] = {c: {"once": gec_once[c], "sonra": gec_sonra[c]} for c in gec_once if gec_once[c] != gec_sonra[c]}
        bag_sonra = bag_tutarlari(yeni, bugun)
        r["bag_degisen"] = {k: {"once": bag_once.get(k, 0), "sonra": bag_sonra.get(k, 0)}
                            for k in sorted(set(bag_once) | set(bag_sonra)) if bag_once.get(k, 0) != bag_sonra.get(k, 0)}
        self.raporlar[o.get("ad", did + "-yenile")] = r

    def devri_geri_al(self, o):                      # N-15 (devir öncesi kalıcı yedek)
        if not self.devirler:
            raise Red("DEVIR_YOK")
        kayit = self.devirler.pop()
        self.arsivler.pop()
        sonra = [k.id for k in self.canli.kaynaklar.values() if k.devir is None and k.id not in kayit["yedek"].kaynaklar]
        self.canli = kayit["yedek"]
        self.canli.degisti()
        self.raporlar[o.get("ad", kayit["id"] + "-geri-al")] = {"geri_alindi": kayit["id"], "kaybolan_hareketler": sonra}

    # -- sonuç
    def son_tarih(self, d):
        return son_tarih(d)

    def sonuc(self):
        deg = {"canli": degismezler(self.canli, self.son_tarih(self.canli))}
        for i, a in enumerate(self.arsivler):
            deg[f"arsiv:{i}"] = degismezler(a, a.ust)
        return {"dil": DIL, "kurallar": self.k.etiket(), "raporlar": self.raporlar, "redler": self.redler, "degismezler": deg,
                "devirler": [{"id": d["id"], "K": d["K"], "degismezler": d["degismezler"]} for d in self.devirler],
                "acilis_olabilir": sorted(self.canli.gecis().acilis_olabilir)}


def son_tarih(d):
    ms = d.maddeler()
    return ms[-1].tarih if ms else "2000-01-01"


def kdv_etiketleri(d, t, haric=frozenset()):
    """191 / 391 bakiyeleri KDV dönemi etiketine göre (EK-1 M8): {(hesap, dönem): borç − alacak}."""
    out = defaultdict(int)
    for m in d.maddeler():
        if m.tarih > t:
            break
        if m.id in haric:
            continue
        for s in m.satirlar:
            if s["h"] in KDV_HESAPLARI:
                out[(s["h"], (s["e"] or {}).get("donem"))] += s["b"] - s["a"]
    return out


def bag_tutarlari(d, t):
    """Devri Yenile raporu "Bağı Değişen Ödemeler" (EK-1 M9): kaynak kaydı → bağla kapattığı tutar."""
    out = defaultdict(int)
    for c in d.tanim["cariler"]:
        for o in d.kuyruk(c, t).ogeler:
            if o["link"] and o["kaynak"] and o["bagla"]:
                out[o["kaynak"]] += o["bagla"]
    return dict(out)


def devirsiz_dosya(arsiv, yeni, did):
    """Arşiv (≤ K) + yeni yılın kendi kayıtları (> K), devir satırları olmadan — "devir şirketin durumunu değiştirmez" denetimi."""
    d = Dosya(arsiv.tanim, arsiv.k, arsiv.sayac, "devirsiz", arsiv.defter_turu)
    d.kaynaklar = {i: copy.deepcopy(k) for i, k in arsiv.kaynaklar.items()}
    d.kaynaklar.update({i: copy.deepcopy(k) for i, k in yeni.kaynaklar.items() if k.devir != did})
    d.fisler = [copy.deepcopy(f) for f in arsiv.fisler if f.kaynak != did] + [copy.deepcopy(f) for f in yeni.fisler if f.kaynak != did]
    d.donmus, d.donmus_sinir, d.donmus_kural = arsiv.donmus, arsiv.donmus_sinir, arsiv.donmus_kural
    d.kural_farki_fisi = arsiv.kural_farki_fisi
    d.kilit = yeni.kilit                              # EK-2B §5.3 / karar (3): devirsiz eş AYNI kilitle (L = K)
    d.degisti()
    return d


def kilitli_kopya(d, kilit):
    """M2 karşılaştırması için devirsiz dosyanın aynı kilitli kopyası (karar (3)); K sonrası kayıtlar K kilidi altında yazılmış sayılır (README Y14)."""
    x = d.kopya()
    x.kilit = max(kilit, x.kilit) if x.kilit else kilit
    kilide_cek(x, kilit)
    x.degisti()
    return x


S19_BAG_TURLERI = ("tahsilat", "odeme", "satis_iade_faturasi", "alis_iade_faturasi")


def s19_devir_kayitlari(d, K):
    """S24 A (kullanıcı 06.11 06:26; README Z1, Z3; bakım 4 Y14): devirden ÖNCE (kilit < K iken ya da kilit yokken) yazılmış K sonrası karşılıksız / bağ
    kayıtları — Devir Raporu bunları listeler (devir hepsini K kilidiyle değerlendirir: kilide_cek). Kilit = K iken yazılmış kayıt listede yok."""
    out = []
    for k in d.kaynaklar.values():
        if k.tarih <= K or (k.kilit is not None and k.kilit >= K) or k.durum != "aktif":
            continue
        v = k.v
        if (k.tur == "evrak_karsiliksiz" or k.tur == "mahsup" or (k.tur == "taksit_karti" and v.get("kaynak") == "fatura")
                or (k.tur in S19_BAG_TURLERI and (v.get("fatura") or v.get("taksit_karti") or v.get("asil_fatura")))):
            out.append(k.id)
    return sorted(out)


def kilide_cek(d, K):
    """S24 A (kullanıcı 06.11 06:26; README Z2; bakım 4'te Y14 olarak susarak sürdürülen davranış artık KURAL): devir, K sonrası kayıtları K kilidiyle
    değerlendirir — S11 / R3 kararı yeni yılda K kilidiyle (fatura kapalı, karşılıksız ayrı borç; ≤ K bağsız kapanış geri alınmaz)."""
    for k in d.kaynaklar.values():
        if k.tarih > K and (k.kilit is None or k.kilit < K):
            k.kilit = K


def acik_borclar(d, c, t):
    return sorted((o["vade"], o["kalan"]) for o in d.kuyruk(c, t).acik("b"))


def acilis_bakiyeleri(yeni, K, did):
    """Yeni yılın K+1 devir açılışlarından (N-09…N-13) sonraki bilanço bakiyeleri."""
    t = ertesi(K)

    def devirden(m):
        k = yeni.kaynaklar.get(m.kaynak)
        return m.tarih == t and m.sinif == 0 and ((k is not None and k.devir == did) or m.kaynak == did)
    return yeni.bakiyeler(t, devirden)


def eksi_uyarilari(d):
    """G7: Devri Yenile sonrası Kasa / banka eksiye düşerse uyarı."""
    out, bak = [], defaultdict(int)
    for m in d.maddeler():
        for s in m.satirlar:
            if s["h"] == "100" or ana(s["h"]) == "102":
                bak[s["h"]] += s["b"] - s["a"]
                if bak[s["h"]] < 0:
                    out.append({"hesap": s["h"], "tarih": m.tarih, "bakiye": bak[s["h"]]})
    return out


# ------------------------------------------------------------------------------------------------ değişmezler
def degismezler(d, t):
    """Genel değişmezler (§8). Sözlük: ad → [] (boş = tuttu) ya da hata listesi."""
    out = {}
    hata = []
    for m in d.maddeler():
        if m.satirlar:
            tb, ta = sum(s["b"] for s in m.satirlar), sum(s["a"] for s in m.satirlar)
            if tb != ta or tb <= 0:
                hata.append(m.id)
    out["madde_dengesi"] = hata
    mz = d.mizan("0000-01-01", t)
    out["mizan_dengesi"] = [] if mz["toplam"]["borc"] == mz["toplam"]["alacak"] and mz["toplam"]["bakiye"] == 0 else [mz["toplam"]]
    b = d.bilanco(t)
    out["aktif_pasif"] = [] if b["fark"] == 0 else [b["fark"]]
    if d.kapanis_tarihi(t) is None:
        gt = d.gelir_tablosu(f"{yil(t)}-01-01", t)
        onceki_var = b["gecmis_yillar_kapanmamis"] != 0 or "KAPANMAMIS_ONCEKI_YIL" in b["kesin_degil"]
        if d.k.KG12 == "A" or not onceki_var:
            out["gt_bilanco_kar"] = [] if gt["kalemler"]["DNK"] == b["donem_net_kari"] else [gt["kalemler"]["DNK"], b["donem_net_kari"]]
    elif d.k.KG12 == "A":
        c = d.kapanis_tarihi(t)
        gt = d.gelir_tablosu(f"{yil(c)}-01-01", c)
        n7 = sum(s["a"] - s["b"] for f in d.fisler if f.tur == "kapanis" and f.ek.get("adim") == "N-07" and f.tarih == c
                 for s in f.satirlar if ana(s["h"]) in ("590", "591"))
        out["gt_bilanco_kar"] = [] if gt["kalemler"]["DNK"] == n7 else [gt["kalemler"]["DNK"], n7]
    out["modul_defter"] = modul_defter_farki(d, t)
    bdm = []
    for a, x in mz["ana"].items():
        bd = d.buyuk_defter(a, "0000-01-01", t)
        if bd["son_bakiye"] != x["bakiye"] or bd["toplam_borc"] != x["borc"] or bd["toplam_alacak"] != x["alacak"]:
            bdm.append(a)
    out["buyuk_defter_mizan"] = bdm
    out["tyk"] = tyk_degismezleri(d, t)
    # EK-2 §4 (8) / EK-2B 33: Kasa açılış tarihi ≤ ilk (açılış dışı) nakit hareketi
    # S20 A (README Y17): geri yüklenen (Silinenler'den / yedekten) kayıt — ya da en erken açılışın kendisi geri yüklendiyse — açılıştan önce kalabilir
    # (Mutabakat uyarısı, hata değil); geri yüklenmemiş kayıtta değişmez aynen
    ac = [k for k in d.kaynaklar.values() if k.tur in ("kasa_acilis", "devir_kasa") and k.durum == "aktif" and k.tarih <= t]
    a0 = min((k.tarih for k in ac), default=None)
    acilis_geri = any(k.geri for k in ac if k.tarih == a0)
    ilk = [x[0] for x in d.gecis().mod if x[3] == ("kasa",) and x[5] not in {k.id for k in ac} and x[0] <= t
           and not (acilis_geri or getattr(d.kaynaklar.get(x[5]), "geri", False))]
    out["kasa_acilis_ilk"] = [] if a0 is None or not ilk or min(ilk) >= a0 else [{"acilis": a0, "ilk_hareket": min(ilk)}]
    out["kdv_mahsup"] = [dict(x) for x in d.kdv_ihlal if x["tarih"] <= t]
    if d.k.KG11 == "A" and d.kapanis_tarihi(t) is None:      # EK-1 §4 (8): aylık tahmini SMM toplamı = yıllık
        y = yil(t)
        yillik = d.gelir_tablosu(f"{y}-01-01", t)["kalemler"]["D"]
        aylik, ay = 0, 1
        while ay <= 12 and f"{y}-{ay:02d}-01" <= t:
            aylik += d.gelir_tablosu(f"{y}-{ay:02d}-01", min(t, ay_sonu(f"{y}-{ay:02d}")))["kalemler"]["D"]
            ay += 1
        out["tahmini_aylik_toplam"] = [] if aylik == yillik else [aylik, yillik]
    if d.kural_farki_fisi is not None:                       # EK-1 §4 (9): 1–5 sınıfı (59x hariç) = yeni kuralla baştan türetilmiş defter
        taze = defaultdict(int)
        for m in Gecis(d, s14=d.gecis().s14).kos().maddeler + [f.madde() for f in d.fisler if f.id != d.kural_farki_fisi]:
            if m.tarih <= t:
                for s in m.satirlar:
                    taze[(s["h"], s["c"])] += s["b"] - s["a"]
        bal = d.bakiyeler(t)
        out["kural_farki_yeni_kural"] = sorted(anahtar(*k) for k in set(taze) | set(bal)
                                               if k[0][0] in "12345" and not k[0].startswith("59") and taze.get(k, 0) != bal.get(k, 0))
    return out


def tyk_degismezleri(d, t):
    """EK-1 §4 (1)–(3): her cari, her denetim günü: 0 ≤ gecikmiş ≤ max(0, CH); Σ açık borç − Σ açık alacak = CH; şüpheli kuyruğu = 128;
    hatırlatma seçimi = gecikmiş (S3 A: şüpheli ayrı)."""
    hata = []
    y = yil(t)
    tarihler = sorted({t} | {f"{y}-{a:02d}-15" for a in range(1, 13) if f"{y}-{a:02d}-15" <= t})
    for tt in tarihler:
        bal = d.bakiyeler(tt)
        hat = d.hatirlatma(tt)
        for c in sorted(d.tanim["cariler"]):
            b = bal.get((d.cari_hesap(c), c), 0)
            q = d.kuyruk(c, tt)
            g = d.gecikmis(c, tt)
            ab = sum(o["kalan"] for o in q.ogeler if o["taraf"] == "b" and o["kalan"] > 0)
            aa = sum(o["kalan"] for o in q.ogeler if o["taraf"] == "a" and o["kalan"] > 0)
            if not 0 <= g["gecikmis"] <= max(0, b):
                hata.append(f"{c}@{tt}: gecikmiş {g['gecikmis']} bakiye {b}")
            if ab - aa != b:
                hata.append(f"{c}@{tt}: açık borç {ab} − açık alacak {aa} ≠ CH {b}")
            if ab and aa:
                hata.append(f"{c}@{tt}: iki taraf birden açık")
            if any(o["kalan"] < 0 for o in q.ogeler) or any(x["kalan"] < 0 for x in q.supheli):
                hata.append(f"{c}@{tt}: eksi kalan")
            if g["supheli"] != bal.get(("128", c), 0):
                hata.append(f"{c}@{tt}: şüpheli kuyruğu {g['supheli']} ≠ 128 {bal.get(('128', c), 0)}")
            beklenen = 0 if g["supheli"] else g["gecikmis"]          # S7 A: şüpheli kaydı açık cari otomatik listeye girmez
            if hat["otomatik"].get(c, 0) != beklenen:
                hata.append(f"{c}@{tt}: hatırlatma {hat['otomatik'].get(c, 0)} ≠ {beklenen}")
            if g["supheli"] and (c not in hat["supheli_etiketli"] or hat["elle"].get(c, 0) != g["gecikmis"]):
                hata.append(f"{c}@{tt}: şüpheli etiketi / elle tutarı yanlış")
            for kid, kk in q.kartlar.items():                         # EK-2 §4 (7) / EK-2B §5.4: kart alttaki borcun üstünde kalmaz
                if kk.get("tuketilen") is not None and sum(o["tutar"] - o["kucultme"] for o in kk["taksitler"]) > kk["tuketilen"]:
                    hata.append(f"{c}@{tt}: kart {kid} alttaki borçtan büyük")
            gk = d.gecis().kart
            if any(o["kart"] and o["kart"] not in gk for o in q.ogeler):   # EK-2 §4 (9): kaldırılan kartın taksiti kuyrukta yok
                hata.append(f"{c}@{tt}: kaldırılan kartın taksiti")
    return hata


def modul_defter_farki(d, t):
    """Modül bakiyeleri (kaynaktan) = defter hesapları (§6.4, §8 cari muavin = CH + 128)."""
    mod = d.moduller(t)
    bal = d.bakiyeler(t)
    fark = []

    def es(ad, a, b):
        if a != b:
            fark.append({"modul": ad, "modul_bakiye": a, "defter": b})
    es("kasa", mod.get(("kasa",), 0), bal.get(("100", None), 0))
    for b in d.tanim["bankalar"]:
        es(f"banka:{b}", mod.get(("banka", b), 0), bal.get(("102." + b, None), 0))
    for k in d.tanim["kartlar"]:
        es(f"kart:{k}", mod.get(("kart", k), 0), -bal.get(("309." + k, None), 0))
    for k in d.tanim["krediler"]:
        es(f"kredi:{k}", mod.get(("kredi", k), 0), -bal.get(("300." + k, None), 0))
    for p in d.tanim["poslar"]:
        es(f"pos:{p}", mod.get(("pos", p), 0), bal.get(("108." + p, None), 0))
    es("yoldaki", mod.get(("yoldaki",), 0), bal.get((YOLDAKI, None), 0))
    for c in d.tanim["cariler"]:
        ch = d.cari_hesap(c)
        es(f"cari:{c}", mod.get(("cari", c), 0), bal.get((ch, c), 0) + bal.get(("128", c), 0))
    ev = d.evrak_hesaplari()
    for h in ("101.01", "101.02", "121.01", "121.02", "103", "321"):
        es(f"evrak:{h}", ev.get(h, 0), bal.get((h, None), 0))
    return fark


def devir_degismezleri(arsiv, yeni, K, yedek, did, devirsiz=None, kapanis=None, acilis=None):
    """§6 devir değişmezleri (kâhinin ana denetimi) + EK-1 §4 (4)–(7), (11)–(13) + kâhin bakımı 2 (tek açılış fişi, m27, M4 sırası)."""
    out = {}
    # karar (7): yalnız devrin ürettiği fişler yeniden yazılır; yevmiyede TEK açılış fişi
    tek = []
    if acilis is not None and {i for i, k in yeni.kaynaklar.items() if k.devir == did} != set(acilis["kaynaklar"]):
        tek.append("önceki devir üretiminden kalan kaynak var")
    n13 = [f for f in yeni.fisler if f.kaynak == did and f.tur == "devir_acilis"]
    if len(n13) > 1:
        tek.append(f"N-13 fişi {len(n13)} kez")
    gruplar = {m.ek.get("fis_grubu") for m in yeni.maddeler() if m.tarih == ertesi(K) and m.sinif == 0
               and (getattr(yeni.kaynaklar.get(m.kaynak), "devir", None) == did or m.kaynak == did)}
    if gruplar != {f"devir_acilis:{did}"} and gruplar:
        tek.append(f"açılış fiş grupları {sorted(map(str, gruplar))}")
    out["tek_acilis_fisi"] = tek
    bal_a = arsiv.bakiyeler(K)
    out["arsiv_6_7_sifir"] = sorted(anahtar(*k) for k, v in bal_a.items() if sonuc_hesabi(k[0]) and v)
    out["arsiv_153_dss"] = [] if arsiv.ana_bakiye("153", K) == arsiv.deger(K) else [arsiv.ana_bakiye("153", K), arsiv.deger(K)]
    acl = acilis_bakiyeleri(yeni, K, did)
    anahtarlar = {k for k in bal_a if bilanco_hesabi(k[0])} | set(acl)
    out["kapanis_acilis"] = sorted(f"{anahtar(*k)}: {bal_a.get(k, 0)} ≠ {acl.get(k, 0)}" for k in anahtarlar if bal_a.get(k, 0) != acl.get(k, 0))
    out["g_eslesme"] = [] if acl.get((G, None), 0) == bal_a.get((G, None), 0) else [bal_a.get((G, None), 0), acl.get((G, None), 0)]
    sonuc_satiri = []
    for m in yeni.maddeler():
        k = yeni.kaynaklar.get(m.kaynak)
        devir_maddesi = (k is not None and k.devir == did) or m.kaynak == did
        if devir_maddesi and any(sonuc_hesabi(s["h"]) for s in m.satirlar):
            sonuc_satiri.append(m.id)
    out["yeni_gt_sifir"] = sonuc_satiri
    ma, my = arsiv.moduller(K), yeni.moduller(ertesi(K), devir=did)
    fark = []
    for a in sorted(set(ma) | set(my), key=str):
        if a[0] == "taksit_odenen":
            continue
        if ma.get(a, 0) != my.get(a, 0):
            fark.append(f"{a}: {ma.get(a, 0)} ≠ {my.get(a, 0)}")
    for kid in arsiv.gecis().kart:
        if ma.get(("taksit_odenen", kid), 0) != my.get(("taksit_odenen", kid), 0):
            fark.append(f"taksit {kid}")
    if arsiv.deger(K) != acl.get(("153", None), 0):
        fark.append(f"stok değeri {arsiv.deger(K)} ≠ {acl.get(('153', None), 0)}")
    yg = yeni.gecis()
    for eid, e in arsiv.gecis().evrak.items():
        if e["durum"] in ("portfoy", "tahsilde", "verildi", "ciro", "karsiliksiz"):
            if eid not in yg.evrak:
                fark.append(f"evrak {eid} yok")
    out["modul_esitligi"] = fark
    out["modul_defter_arsiv"] = modul_defter_farki(arsiv, K)
    if yedek is not None:
        once = sum(1 for k in yedek.kaynaklar.values() if k.devir is None)
        a = sum(1 for k in arsiv.kaynaklar.values() if k.devir is None and k.tarih <= K)
        y = sum(1 for k in yeni.kaynaklar.values() if k.devir is None and k.tarih > K)
        out["hareket_sayisi"] = [] if a + y == once else [a, y, once]
    t = ertesi(K)
    cariler = sorted(arsiv.tanim["cariler"])
    # (5) M3: yeni yıl açılışında cari başına EN ÇOK BİR CH satırı = arşiv K CH muavin bakiyesi
    satir = defaultdict(list)
    for m in yeni.maddeler():
        k = yeni.kaynaklar.get(m.kaynak)
        if (k is not None and k.devir == did) or m.kaynak == did:
            for s in m.satirlar:
                if s["c"] and s["h"] == yeni.cari_hesap(s["c"]):
                    satir[s["c"]].append(s["b"] - s["a"])
    out["m3_tek_satir"] = sorted(c for c in cariler if len(satir.get(c, [])) > 1
                                 or sum(satir.get(c, [])) != bal_a.get((arsiv.cari_hesap(c), c), 0))
    # (12) M12: ≤ K tarihli satır yok; bakiyesi 0 cariye devir satırı yok
    out["m12_k_oncesi_satir"] = [m.id for m in yeni.maddeler() if m.tarih <= K]
    # (13) M13: CH kalemleri (+ kart taksitleri) = CH K bakiyesi; şüpheli kuyruğu = 128 K bakiyesi (aynı tutar iki kez taşınmaz)
    yg, m13 = yeni.gecis(), []
    for c in cariler:
        ch = sum(x["kalan"] if x["taraf"] == "b" else -x["kalan"] for x in yg.devir_kalemleri.get(c, []))
        ch += sum(x["kalan"] for kid, kt in yg.kart.items() if kt["cari"] == c and kt.get("kaynak") == "devir" for x in kt.get("acik_taksitler", []))
        if ch != bal_a.get((arsiv.cari_hesap(c), c), 0):
            m13.append(f"{c}: CH kalemleri {ch} ≠ {bal_a.get((arsiv.cari_hesap(c), c), 0)}")
        sp = sum(x["kalan"] for x in yg.devir_supheli.get(c, []))
        if sp != bal_a.get(("128", c), 0):
            m13.append(f"{c}: şüpheli kalemleri {sp} ≠ 128 {bal_a.get(('128', c), 0)}")
    out["m13_ayri"] = m13
    # (7) M5: açılış miktarı = K miktarı (eksi dahil); eksi üründe değer 0
    dk, m5 = arsiv.degerleme(K), []
    seqs = {k.seq for k in yeni.kaynaklar.values() if k.tur == "devir_stok" and k.devir == did}
    acl = defaultdict(lambda: [Fraction(0), 0])
    for (tarih, _, seq, u, miktar, deger, tur) in yeni.gecis().stok:
        if seq in seqs:
            acl[u][0] += miktar
            acl[u][1] += deger
    for u, x in dk["urunler"].items():
        ym, yd = acl.get(u, (Fraction(0), 0))
        eksi_degerli = Fraction(x["miktar"]) < 0 and arsiv.k.KG9 == "A" and (x["deger"] or yd)
        if Fraction(x["miktar"]) != ym or x["deger"] != yd or eksi_degerli:
            m5.append(f"{u}: {x['miktar']}/{x['deger']} ≠ {ym}/{yd}")
    out["m5_miktar"] = m5
    if devirsiz is not None:
        # (4) M2: her t ≥ K+1 için gecikmiş ve açık borç (vade, kalan) listesi devirli = devirsiz
        son = ertesi(max(son_tarih(yeni), son_tarih(devirsiz)))
        m2 = []
        for c in cariler:
            tarihler = {t, son}
            for (v, _) in acik_borclar(yeni, c, t):
                if v > K:
                    tarihler |= {v, ertesi(v)}
            for tt in sorted(tarihler)[:10]:
                if yeni.gecikmis(c, tt)["gecikmis"] != devirsiz.gecikmis(c, tt)["gecikmis"] or acik_borclar(yeni, c, tt) != acik_borclar(devirsiz, c, tt):
                    m2.append(f"{c}@{tt}: devirli {acik_borclar(yeni, c, tt)} ≠ devirsiz {acik_borclar(devirsiz, c, tt)}")
        out["m2_gecikmis_ayni"] = m2
        # (6) M4 / (8) M6: kapanış öncesi hesaplanmış satırlar = kapanış fişleri (bağımsız iki yol)
        if kapanis is not None:
            b = devirsiz.bilanco(K)
            m4 = []
            n7 = sum(s["a"] - s["b"] for f in arsiv.fisler if f.kaynak == did and f.ek.get("adim") == "N-07" for s in f.satirlar
                     if ana(s["h"]) in ("590", "591"))
            if n7 != b["donem_net_kari"]:
                m4.append(f"590/591 {n7} ≠ hesaplanmış Dönem Net Kârı {b['donem_net_kari']}")
            if arsiv.k.KG12 == "A":
                oy = [f for f in arsiv.fisler if f.kaynak == did and f.tur == "onceki_yil_sonucu"]
                kar = sum(s["a"] - s["b"] for f in oy for s in f.satirlar if ana(s["h"]) == "570")
                zarar = sum(s["b"] - s["a"] for f in oy for s in f.satirlar if ana(s["h"]) == "580")
                if (kar, zarar) != (b["gecmis_yillar_kar"], b["gecmis_yillar_zarar"]):
                    m4.append(f"570/580 ({kar}, {zarar}) ≠ hesaplanmış ({b['gecmis_yillar_kar']}, {b['gecmis_yillar_zarar']})")
                for ys, x in kapanis["onceki_yil"].items():          # EK-2 §4 (13): her 570.Y = R_Y, 580.Y = −R_Y
                    v570 = sum(s["a"] - s["b"] for f in oy for s in f.satirlar if s["h"] == f"570.{ys}")
                    v580 = sum(s["b"] - s["a"] for f in oy for s in f.satirlar if s["h"] == f"580.{ys}")
                    if (v570, v580) != ((x["R"], 0) if x["R"] > 0 else (0, -x["R"])):
                        m4.append(f"{ys}: 570.Y {v570} / 580.Y {v580} ≠ R {x['R']}")
                # EK-2 §4 (5) / E13: K günü sıra Önceki Yıl Sonucu → N-01 → kapanış; önceki yıl fişlerinden sonra 153 = DSS_(K−1) + K yılı hareketleri
                sira = {"onceki_yil_sonucu": 0, "stok_degerleme": 1, "kapanis": 2}
                kgun = [sira[m.tur] for m in arsiv.maddeler() if m.tarih == K and m.kaynak == did]
                if kgun != sorted(kgun):
                    m4.append(f"K günü sıra {kgun}")
                if arsiv.donmus is None:
                    yk = yil(K)
                    ara = sum(s["b"] - s["a"] for m in arsiv.maddeler() if m.tarih <= K and not (m.kaynak == did and m.tur in ("stok_degerleme", "kapanis"))
                              for s in m.satirlar if ana(s["h"]) == "153")
                    bek = arsiv.deger(f"{yk - 1}-12-31") + sum(s["b"] - s["a"] for m in arsiv.maddeler() if yil(m.tarih) == yk and m.tarih <= K
                                                               and m.kaynak != did for s in m.satirlar if ana(s["h"]) == "153")
                    if ara != bek:
                        m4.append(f"önceki yıl fişlerinden sonra 153 {ara} ≠ DSS_(K−1) + K yılı {bek}")
                if arsiv.k.KG11 == "A":
                    tah = devirsiz.gelir_tablosu(f"{yil(K)}-01-01", K)["kalemler"]["D"]
                    if tah != kapanis["N01"].get(str(yil(K)), 0):
                        m4.append(f"tahmini SMM {tah} ≠ N-01 {kapanis['N01'].get(str(yil(K)), 0)}")
            out["m4_m6_kapanis"] = m4
    # EK-2 27 / §4 (4): devir net satırının tarih / vade / sıra seçimi açık borç kalemlerini ve gecikmişi değiştirmez
    m27 = []
    netli = sorted(k.v["cari"] for k in yeni.kaynaklar.values() if k.tur == "devir_cari" and k.devir == did
                   and any(x["tur"] == "devir_net" for x in k.v.get("kalemler", [])))
    if netli:
        y2 = yeni.kopya()
        for k in y2.kaynaklar.values():
            if k.tur == "devir_cari" and k.devir == did:
                for x in k.v.get("kalemler", []):
                    if x["tur"] == "devir_net":
                        x.update(tarih=t, vade=t, sira=[0, 0, 0])
        y2.degisti()
        son = ertesi(son_tarih(yeni))
        for c in netli:
            for tt in sorted({t, ertesi(t), son} | {v for (v, _) in acik_borclar(yeni, c, son) if v > K})[:12]:
                if yeni.gecikmis(c, tt)["gecikmis"] != y2.gecikmis(c, tt)["gecikmis"] or acik_borclar(yeni, c, tt) != acik_borclar(y2, c, tt):
                    m27.append(f"{c}@{tt}: net satır seçimi sonucu değiştiriyor")
    out["m27_net_satir"] = m27
    return out


def tumu_tuttu(deg):
    """Değişmez sözlüğünde (iç içe) bir hata var mı."""
    if isinstance(deg, dict):
        return all(tumu_tuttu(v) for v in deg.values())
    if isinstance(deg, list):
        return len(deg) == 0
    return True


# ------------------------------------------------------------------------------------------------ dışa açık
def kos(senaryo, kurallar=None):
    return Model(senaryo, kurallar).kos()


def dal_etiketleri(senaryo):
    return ["A"] + [x for x in senaryo.get("dallar", []) if x != "A"]


def json_yaz(nesne, yol):
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(nesne, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
