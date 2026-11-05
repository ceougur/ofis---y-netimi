#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Muhasebe çekirdeği + yıl sonu devri — KÂHİN (temiz oda) modeli, DestekOfis 2.5.0.

Programın kodu GÖRÜLMEDEN, yalnız şu yazılı kurallardan kuruldu (CLAUDE.md KANIT KURALI 2, ders 5, 40, 43):
  docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md (ANA KAYNAK; satır kimlikleri F-01, T-03, N-13 … aşağıda anılır),
  docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md (§6, §7, §13), docs/devir/DEVIR-PLANI.md (§0, §4, §11, G2, G3, G7, G13, G14),
  docs/2.5.0-IS-LISTESI.md (C, D) ve ana oturumun 05.11.2026 17:16 UTC iletisi (ürün sahibi açık maddelerin hepsine "A").
Saf Python, yalnız standart kütüphane. Para kuruş tamsayı; miktar Fraction.

Yapı:
  Dosya   — bir şirket veri dosyası (canlı, arşiv ya da devirden sonraki yeni yıl): kaynak kayıtlar (G-7: açık dönemde maddeler
            her okumada kaynaktan TÜRETİLİR) + saklanan fişler (Ç2: KDV mahsubu, açılış eşleştirme, kapanış, devir açılış, ters fiş).
  Gecis   — kaynak kayıtları tarih sırasıyla işleyip yevmiye maddelerini ve modül (kasa, banka, cari …) hareketlerini üretir.
  Model   — senaryoyu koşar: olaylar, dönem kilidi, devir (N-01…N-13), Devri Yenile (N-14), Devri Geri Al (N-15), raporlar.
Raporlar: mizan, büyük defter, gelir tablosu (MSUGT, 7/A yansıtma), bilanço (ters bakiye brütleştirme, hesaplanmış satırlar,
"Kesin Değil" nedenleri), gecikmiş borç (B1). Değişmezler: degismezler() ve devir_degismezleri().

İki dallı maddeler (kural kitabı §9 + iş listesi C): Kurallar(...) bayrakları; varsayılan A (ürün sahibi 05.11 17:16 "hepsi A").
KG-3'te kural kitabının A'sı ile kullanıcıya sorulan A'nın tanımı ayrışıyor → üç değer: A (kitap), B (kitap), SORU (soruda tanımlanan);
varsayılan A; README "KARAR GEREKİYOR".
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
DAL_DEGERLERI = {"KG3": ("A", "B", "SORU")}


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
CARISIZ_GELIR = "649.90"     # KG-3 A (K-01, T-14)
CARISIZ_PASIF = "336.90"     # KG-3 B "Sınıflandırılmamış Tahsilatlar"
IHRACAT_GELIR = "601"        # F-02 (KG-24 A)
CH_HESAP = {"musteri": "120", "tedarikci": "320", "diger": "336"}   # G-2 (KG-25 A)
GIDER_HESAP = {"genel": "770", "satis": "760", "finansman": "780", "demirbas": "255"}  # F-06 (Ç1'de DOĞRULANMADI)
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
    "120": ("Alıcılar", "A", "I.C"), "121": ("Alacak Senetleri", "A", "I.C"), "128": ("Şüpheli Ticari Alacaklar", "A", "I.C"),
    "129": ("Şüpheli Ticari Alacaklar Karşılığı (−)", "A-", "I.C"), "136": ("Diğer Çeşitli Alacaklar", "A", "I.D"),
    "153": ("Ticari Mallar", "A", "I.E"), "159": ("Verilen Sipariş Avansları", "A", "I.E"), "190": ("Devreden KDV", "A", "I.H"),
    "191": ("İndirilecek KDV", "A", "I.H"), "193": ("Peşin Ödenen Vergiler ve Fonlar", "A", "I.H"),
    "198": ("Diğer Çeşitli Dönen Varlıklar", "A", "I.H"), "255": ("Demirbaşlar", "A", "II.D"),
    "300": ("Banka Kredileri", "P", "III.A"), "309": ("Diğer Mali Borçlar", "P", "III.A"), "320": ("Satıcılar", "P", "III.B"),
    "321": ("Borç Senetleri", "P", "III.B"), "336": ("Diğer Çeşitli Borçlar", "P", "III.C"),
    "340": ("Alınan Sipariş Avansları", "P", "III.D"), "360": ("Ödenecek Vergi ve Fonlar", "P", "III.F"),
    "370": ("Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları", "P", "III.G"), "391": ("Hesaplanan KDV", "P", "III.I"),
    "500": ("Sermaye", "Ö", "V.A"), "519": ("Eşleştirilecek Açılış Bakiyeleri (Geçici)", "Ö", "V.G"),
    "570": ("Geçmiş Yıllar Kârları", "Ö", "V.D"), "580": ("Geçmiş Yıllar Zararları (−)", "Ö-", "V.E"),
    "590": ("Dönem Net Kârı", "Ö", "V.F"), "591": ("Dönem Net Zararı (−)", "Ö-", "V.F"),
    "600": ("Yurt İçi Satışlar", "GE", "A"), "601": ("Yurt Dışı Satışlar", "GE", "A"), "602": ("Diğer Gelirler", "GE", "A"),
    "610": ("Satıştan İadeler (−)", "GI", "B"), "611": ("Satış İskontoları (−)", "GI", "B"), "612": ("Diğer İndirimler (−)", "GI", "B"),
    "621": ("Satılan Ticari Mallar Maliyeti (−)", "GI", "D"),
    "631": ("Pazarlama Satış ve Dağıtım Giderleri (−)", "GI", "E"), "632": ("Genel Yönetim Giderleri (−)", "GI", "E"),
    "642": ("Faiz Gelirleri", "GE", "F"), "644": ("Konusu Kalmayan Karşılıklar", "GE", "F"),
    "649": ("Diğer Olağan Gelir ve Kârlar", "GE", "F"), "653": ("Komisyon Giderleri (−)", "GI", "G"),
    "654": ("Karşılık Giderleri (−)", "GI", "G"), "659": ("Diğer Olağan Gider ve Zararlar (−)", "GI", "G"),
    "660": ("Kısa Vadeli Borçlanma Giderleri (−)", "GI", "H"), "689": ("Diğer Olağandışı Gider ve Zararlar (−)", "GI", "J"),
    "690": ("Dönem Kârı veya Zararı", "KP", None), "691": ("Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları (−)", "KP", "K"),
    "692": ("Dönem Net Kârı veya Zararı", "KP", None),
    "760": ("Pazarlama Satış ve Dağıtım Giderleri", "MAL", "E"), "761": ("Pazarlama Satış ve Dağıtım Giderleri Yansıtma", "MAL", None),
    "770": ("Genel Yönetim Giderleri", "MAL", "E"), "771": ("Genel Yönetim Giderleri Yansıtma", "MAL", None),
    "780": ("Finansman Giderleri", "MAL", "H"), "781": ("Finansman Giderleri Yansıtma", "MAL", None),
}
# Ters bakiye (§7.3; çekirdek §13): "KD" = aynı kalemde eksi + Kesin Değil; kalem kodu = brütleştirme hedefi; "KG14" = 198 + Kesin Değil.
TERS = {"100": "KD", "101": "KD", "102": "III.A", "103": "KD", "108": "KD", "120": "III.D", "121": "KD", "128": "KD", "129": "KD",
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

ACILIS_TURLERI = {"kasa_acilis", "cari_acilis", "banka_acilis", "kart_acilis", "kredi_acilis", "stok_acilis", "evrak_acilis",
                  "taksit_excel", "devir_kasa", "devir_cari", "devir_acik_kalem", "devir_banka", "devir_kart", "devir_kredi",
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


def yuvarla(x):
    """G-1: kuruşa, yarım yukarı; eksi tutarda mutlak değere uygulanır."""
    x = Fraction(x)
    if x >= 0:
        return int(math.floor(x + Fraction(1, 2)))
    return -int(math.floor(-x + Fraction(1, 2)))


def ana(h):
    return h.split(".")[0]


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
    __slots__ = ("id", "tur", "tarih", "seq", "v", "durum", "devir")

    def __init__(self, id, tur, tarih, seq, v, devir=None):
        self.id, self.tur, self.tarih, self.seq, self.v, self.devir = id, tur, tarih, seq, v, devir
        self.durum = "aktif"


class Madde:
    __slots__ = ("id", "tarih", "sinif", "seq", "kaynak", "tur", "satirlar", "ek")

    def __init__(self, id, tarih, sinif, seq, kaynak, tur, satirlar, ek=None):
        self.id, self.tarih, self.sinif, self.seq, self.kaynak, self.tur, self.satirlar = id, tarih, sinif, seq, kaynak, tur, satirlar
        self.ek = ek or {}

    def sozluk(self):
        return {"id": self.id, "tarih": self.tarih, "sinif": self.sinif, "kaynak": self.kaynak, "tur": self.tur,
                "satirlar": [{k: v for k, v in s.items() if v not in (None, 0)} for s in self.satirlar]}


def madde_kur(id, tarih, sinif, seq, kaynak, tur, satirlar, ek=None):
    s = [x for x in satirlar if x["b"] or x["a"]]
    if not s:
        return None
    tb, ta = sum(x["b"] for x in s), sum(x["a"] for x in s)
    if tb != ta or tb <= 0:
        raise AssertionError(f"dengesiz madde {id}: borç {tb} alacak {ta}")
    return Madde(id, tarih, sinif, seq, kaynak, tur, s, ek)


def sira_anahtari(m):
    # G-4 (ders 31): tarih → sınıf (0 açılış, 1 olağan, 2 dönem sonu, 3 kapanış) → yazım sırası
    return (m.tarih, m.sinif, m.seq, m.id)


# ------------------------------------------------------------------------------------------------ türetme geçişi
class Gecis:
    """Kaynak kayıtları (tarih, sınıf, yazım sırası) ile işler; maddeleri ve modül hareketlerini üretir."""

    def __init__(self, dosya, kural="2.5.0"):
        self.d, self.kural, self.k = dosya, kural, dosya.k
        self.maddeler, self.mod, self.stok, self.mahsup = [], [], [], []
        self.evrak, self.pos, self.supheli, self.kart, self.yoldaki = {}, {}, {}, {}, {}
        self.uyarilar, self.acilis_olabilir = [], []
        self._emit = defaultdict(list)       # kaynak id → maddeleri (R-01 için)
        self._modk = defaultdict(list)       # kaynak id → modül hareketleri (R-01 için)

    # -- pencere: arşiv ≤ K (devirde valörü K'den sonraya kalan parçalar yeni yıla açılışla geçer)
    def _icinde(self, tarih):
        return self.d.ust is None or tarih <= self.d.ust

    def madde(self, k, tarih, sinif, satirlar, tur=None, alt=0, ek=None):
        if not self._icinde(tarih):
            return
        m = madde_kur(f"{k.id}#{alt}", tarih, sinif, k.seq, k.id, tur or k.tur, satirlar, ek)
        if m:
            self.maddeler.append(m)
            self._emit[k.id].append(m)

    def m(self, k, tarih, anah, delta, sinif=1):
        if delta and self._icinde(tarih):
            self.mod.append((tarih, sinif, k.seq, anah, delta, k.id))
            self._modk[k.id].append((tarih, anah, delta))

    def stok_har(self, k, tarih, urun, miktar, deger, tur):
        if self._icinde(tarih):
            self.stok.append((tarih, 0 if tur == "acilis" else 1, k.seq, urun, Fraction(miktar), deger, tur))

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

    def karsi(self, k, tutar, giris):
        """Stok modülü 'Kasa'ya yansıt' / cari karşılığı: karsi = nakit | havale | cari."""
        v = k.v
        if v.get("karsi", "nakit") == "cari":
            c = v["cari"]
            self.m(k, k.tarih, ("cari", c), tutar if giris else -tutar)
            return L(self.ch(c), tutar if giris else -tutar, c, k=f"stok:{k.id}", tur="stok")
        return self.oy(k, v.get("karsi", "nakit"), tutar, giris)

    def kos(self):
        ks = [k for k in self.d.kaynaklar.values() if k.durum == "aktif"]
        ks.sort(key=lambda k: (k.tarih, 0 if self.kaynak_acilis_mi(k) else 1, k.seq))
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
        self.madde(k, k.tarih, 0 if acilis else 1, [L(self.ch(c), s, c, k=kk, tur=tur, vade=v.get("vade")), L(karsi, -s)],
                   tur="cari_acilis" if acilis else k.tur)
        self.m(k, k.tarih, ("cari", c), s, 0 if acilis else 1)

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
            h = GIDER_HESAP[v.get("gider_turu", "genel")]
        ch = M + K - T - S
        self.madde(k, k.tarih, 1, [Bo(h, M), Bo("191", K, indirim_ayi=v.get("indirim_ayi")),
                                   Al(self.ch(c), ch, c, k="fatura:" + k.id, tur="fatura", vade=v.get("vade") or k.tarih),
                                   Al("360", T + S)])
        self.m(k, k.tarih, ("cari", c), -ch)

    def _satis_iade_faturasi(self, k):               # F-07 / F-09 (KG-8 A: 191)
        v = k.v
        c, M, K = v["cari"], v["M"], v.get("K", 0)
        link = "fatura:" + v["asil_fatura"] if v.get("asil_fatura") else None
        self.madde(k, k.tarih, 1, [Bo("610", M), Bo("191", K), Al(self.ch(c), M + K, c, k="iade:" + k.id, tur="iade", link=link)])
        self.m(k, k.tarih, ("cari", c), -(M + K))
        self._fatura_stok(k, +1, "satis_iade")

    def _alis_iade_faturasi(self, k):                # F-08
        v = k.v
        c, M, K = v["cari"], v["M"], v.get("K", 0)
        link = "fatura:" + v["asil_fatura"] if v.get("asil_fatura") else None
        h = "153" if v.get("fatura_turu", "stok") == "stok" else GIDER_HESAP[v.get("gider_turu", "genel")]
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
        self.mahsup.append((k.tarih, "fatura:" + v["fatura1"], "fatura:" + v["fatura2"], v["tutar"]))

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
        if v.get("taksit_karti"):
            kt = self.kart.get(v["taksit_karti"])
            if kt is None:
                return None
            if kt["kaynak"] == "fatura":
                return "fatura:" + kt["fatura"]
            if kt["kaynak"] in ("yeni_borc", "excel"):
                return "taksit:" + v["taksit_karti"]
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
            valor = v.get("valor") or k.tarih
            self.pos[k.id] = {"pos": p, "brut": t, "kom": kom, "valor": valor, "iade": 0, "kom_iade": 0, "cari": c, "satis": k.tarih}
            oy = Bo("108." + p, t)
            self.m(k, k.tarih, ("pos", p), t)
        elif yol in ("cek", "senet"):                # T-04 / Ç-01
            e = v["evrak"]
            self.evrak[e] = {"tur": yol, "yon": "alinan", "durum": "portfoy", "tutar": t, "cari": c, "banka": None,
                             "ciro_cari": None, "gecmis": []}
            oy = Bo(("101" if yol == "cek" else "121") + ".01", t, evrak=e)
        elif yol == "kart":                          # T-11 Kredi Kartına İade
            kk = v["kart"]
            oy = Bo("309." + kk, t)
            self.m(k, k.tarih, ("kart", kk), -t)
        else:
            raise AssertionError(f"senaryo hatası: yol {yol}")
        if v.get("supheliden"):                      # T-13 / J-03
            s = self.supheli.setdefault(c, {"kalan": 0, "karsilik": 0})
            if t > s["kalan"]:
                raise AssertionError("şüpheliden tahsilat kalan şüpheliden büyük (olay anında reddedilmeliydi)")
            self.madde(k, k.tarih, 1, [oy, Al("128", t, c)])
            self.m(k, k.tarih, ("cari", c), -t)
            s["kalan"] -= t
            if s["karsilik"] > s["kalan"]:           # J-04
                fazla = s["karsilik"] - s["kalan"]
                self.madde(k, k.tarih, 1, [Bo("129", fazla, c), Al(KARSILIK_COZULME, fazla)], tur="karsilik_cozulme", alt=1)
                s["karsilik"] -= fazla
        else:
            self.madde(k, k.tarih, 1, [oy, Al(self.ch(c), t, c, k="tahsilat:" + k.id, tur="tahsilat", link=link)])
            self.m(k, k.tarih, ("cari", c), -t)
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
            e["durum"], e["ciro_cari"] = "ciro", c
        else:
            raise AssertionError(f"senaryo hatası: yol {yol}")
        self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="odeme:" + k.id, tur="odeme", link=link), oy])
        self.m(k, k.tarih, ("cari", c), t)
        if v.get("taksit_karti"):
            self.m(k, k.tarih, ("taksit_odenen", v["taksit_karti"]), -t)

    def _carisiz_gelir_hesabi(self, kayit):
        d = self.k.KG3
        if d == "A":
            return CARISIZ_GELIR
        if d == "B":
            return CARISIZ_PASIF
        return CARISIZ_PASIF if kayit else CARISIZ_GELIR   # SORU: kayıt tahsilatı 336.90, Kasa girişi 649.90

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
        self.madde(k, k.tarih, 1, [L(self.ch(c), s, c, k="hesapsiz:" + k.id, tur="tahsilat" if s < 0 else "odeme"), L(G, -s)])
        self.m(k, k.tarih, ("cari", c), s)

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
        if e["durum"] == "ciro":
            tc = e["ciro_cari"]
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="karsiliksiz:" + k.id, tur="karsiliksiz"),
                                       Al(self.ch(tc), t, tc, k="ciro_donus:" + k.id, tur="ciro_donus")])
            self.m(k, k.tarih, ("cari", c), t)
            self.m(k, k.tarih, ("cari", tc), -t)
        else:
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="karsiliksiz:" + k.id, tur="karsiliksiz"),
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
    def _taksit_karti(self, k):                      # H-01, H-02, H-03
        v = k.v
        self.kart[k.id] = {"cari": v["cari"], "toplam": v["toplam"], "taksitler": v.get("taksitler", []), "kaynak": v["kaynak"],
                           "fatura": v.get("fatura"), "kapali": False}
        if v["kaynak"] == "yeni_borc":               # H-03 → KG-2 (stok kartı yok → iki dalda da 600.90)
            c, t = v["cari"], v["toplam"]
            ilk = (v.get("taksitler") or [{"vade": k.tarih}])[0]["vade"]
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), t, c, k="taksit:" + k.id, tur="taksit", vade=ilk), Al(BELGESIZ_GELIR, t)])
            self.m(k, k.tarih, ("cari", c), t)

    def _taksit_excel(self, k):                      # H-06 / M-10 (KG-5)
        v = k.v
        c, T, P = v["cari"], v["toplam"], v.get("odenen", 0)
        self.kart[k.id] = {"cari": c, "toplam": T, "taksitler": v.get("taksitler", []), "kaynak": "excel", "fatura": None, "kapali": False}
        ilk = (v.get("taksitler") or [{"vade": k.tarih}])[0]["vade"]
        if self.k.KG5 == "A":
            self.madde(k, k.tarih, 0, [Bo(self.ch(c), T - P, c, k="taksit:" + k.id, tur="taksit", vade=ilk), Al(G, T - P)])
        else:
            self.madde(k, k.tarih, 1, [Bo(self.ch(c), T, c, k="taksit:" + k.id, tur="taksit", vade=ilk), Al(BELGESIZ_GELIR, T)])
            self.madde(k, k.tarih, 0, [Bo(G, P), Al(self.ch(c), P, c, k="excel_odenen:" + k.id, tur="tahsilat", link="taksit:" + k.id)],
                       tur="taksit_excel_odenen", alt=1)
        self.m(k, k.tarih, ("cari", c), T - P, 0)
        self.m(k, k.tarih, ("taksit_odenen", k.id), P, 0)

    def _taksit_kapat(self, k):                      # H-07 (KG-23 A: alacak CH'de kalır)
        if k.v["kart"] in self.kart:
            self.kart[k.v["kart"]]["kapali"] = True

    # ============================================================== 3-V vergi
    def _vergi_odeme(self, k):                       # V-02, V-04 (KG-13 A: 360)
        t = k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("360", t), self.oy(k, k.v.get("yol", "havale"), t, False)])

    def _gecikme_zammi(self, k):                     # V-03
        t = k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("689", t), self.oy(k, k.v.get("yol", "havale"), t, False)])

    # ============================================================== 3-Ş şüpheli alacak
    def _supheliye_al(self, k):                      # J-01
        c, t = k.v["cari"], k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("128", t, c), Al(self.ch(c), t, c, k="supheli:" + k.id, tur="supheli_transfer")])
        s = self.supheli.setdefault(c, {"kalan": 0, "karsilik": 0})
        s["kalan"] += t

    def _karsilik_ayir(self, k):                     # J-02
        c, t = k.v["cari"], k.v["tutar"]
        self.madde(k, k.tarih, 1, [Bo("654", t), Al("129", t, c)])
        self.supheli[c]["karsilik"] += t

    def _degersiz_yaz(self, k):                      # J-05 (KG-21 A: 659)
        c = k.v["cari"]
        s = self.supheli[c]
        K, P = s["kalan"], s["karsilik"]
        self.madde(k, k.tarih, 1, [Bo("129", P, c), Bo(DEGERSIZ_KALAN, K - P), Al("128", K, c)])
        self.m(k, k.tarih, ("cari", c), -K)
        s["kalan"] = s["karsilik"] = 0

    def _supheliden_cikar(self, k):                  # J-06
        c = k.v["cari"]
        s = self.supheli[c]
        K, P = s["kalan"], s["karsilik"]
        self.madde(k, k.tarih, 1, [Bo(self.ch(c), K, c, k="supheliden_cikar:" + k.id, tur="borc_yaz"), Al("128", K, c)])
        if P:
            self.madde(k, k.tarih, 1, [Bo("129", P, c), Al(KARSILIK_COZULME, P)], tur="karsilik_cozulme", alt=1)
        s["kalan"] = s["karsilik"] = 0

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
        self.madde(k, k.tarih, 1, [Bo(BELGESIZ_IADE, v["tutar"] - kdv), Bo("191", kdv), self.karsi(k, v["tutar"], False)])
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
            self.madde(k, k.tarih, 1, [L(s["h"], s["a"] - s["b"], s["c"], **(s["e"] or {})) for s in m0.satirlar], tur="ters", alt=i)
        for (t0, anah, d) in list(self._modk.get(hedef, [])):
            self.m(k, k.tarih, anah, -d)

    # ============================================================== devir açılış kaynakları (N-09…N-12; açılış sınıfı)
    def _devir_kasa(self, k):
        t = k.v["tutar"]
        self.madde(k, k.tarih, 0, [L("100", t), L(G, -t)])
        self.m(k, k.tarih, ("kasa",), t, 0)

    def _devir_cari(self, k):                        # cari başına NET tek madde (KG-17 A)
        c, t = k.v["cari"], k.v["tutar"]
        self.madde(k, k.tarih, 0, [L(self.ch(c), t, c, k="devir:" + c, tur="acilis", vade=k.v.get("vade")), L(G, -t)])
        self.m(k, k.tarih, ("cari", c), t, 0)

    def _devir_acik_kalem(self, k):                  # N-10 (G14: B cari / A 519; gelir / gider DEĞİL)
        c, t = k.v["cari"], k.v["kalan"]
        self.madde(k, k.tarih, 0, [L(self.ch(c), t, c, k="fatura:" + k.v["fatura"], tur="fatura", vade=k.v.get("vade")), L(G, -t)])
        self.m(k, k.tarih, ("cari", c), t, 0)

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
        self.supheli[c] = {"kalan": K, "karsilik": P}
        self.m(k, k.tarih, ("cari", c), K, 0)

    def _devir_taksit(self, k):                      # modül açılışı; defter karşılığı cari açılışının içinde
        v = k.v
        self.kart[v["kart"]] = dict(v["kart_kaydi"])
        self.m(k, k.tarih, ("taksit_odenen", v["kart"]), v["odenen"], 0)


# ------------------------------------------------------------------------------------------------ veri dosyası
class Fis:
    """Saklanan fiş (Ç2): değiştirilemez; düzeltmesi ters fişle (R-03)."""

    def __init__(self, id, tarih, sinif, seq, tur, satirlar, ek=None, kaynak=None):
        self.id, self.tarih, self.sinif, self.seq, self.tur, self.satirlar = id, tarih, sinif, seq, tur, satirlar
        self.ek, self.kaynak, self.ters = ek or {}, kaynak, None
        madde_kur(id, tarih, sinif, seq, id, tur, satirlar)   # denge denetimi (G-6)

    def madde(self):
        return madde_kur(self.id, self.tarih, self.sinif, self.seq, self.kaynak or self.id, self.tur, self.satirlar, dict(self.ek, fis=True))


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
        self._g = None
        self._m = None

    def kopya(self):
        d = copy.deepcopy(self)
        d.sayac = self.sayac
        d.tanim = self.tanim
        return d

    def degisti(self):
        self._g = None
        self._m = None

    # -- türetme
    def gecis(self):
        if self._g is None:
            self._g = Gecis(self).kos()
        return self._g

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

    def kaynak_ekle(self, tur, tarih, v, id=None, devir=None):
        id = id or f"k{self.sayac.n + 1}"
        if id in self.kaynaklar:
            raise Red("KIMLIK", f"aynı kimlik {id}")
        k = Kaynak(id, tur, tarih, self.sayac(), v, devir)
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
            if m.tarih < a or m.sinif == 3:
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
            if (c is not None and m.tarih <= c) or m.sinif == 3:
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
        else:
            dnk = sum(R.values())
            gecmis = 0
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
        if self.defter_turu != "bilanco":
            kd.append("BILGI_AMACLI")
        at, pt = sum(aktif.values()), sum(pasif.values())
        if at != pt:
            kd.append("AKTIF_PASIF_FARKI")
        return {"tarih": t, "aktif": dict(sorted((k, v) for k, v in aktif.items() if v)),
                "pasif": dict(sorted((k, v) for k, v in pasif.items() if v)),
                "aktif_toplam": at, "pasif_toplam": pt, "fark": at - pt, "donem_net_kari": dnk, "gecmis_yillar_kapanmamis": gecmis,
                "kesin_degil": sorted(set(kd)), "bilgi_amacli": self.defter_turu != "bilanco",
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
        return {"hesap": hesap, "cari": cari, "bas": a, "son": b, "devir": devir, "hareketler": har, "toplam_borc": tb,
                "toplam_alacak": ta, "son_bakiye": devir + tb - ta}

    # -- açık kalem dağıtımı (G2; "önce bağlı ödeme, kalan FIFO"; tek yükümlülük kuyruğu)
    def dagit(self, c, t):
        ch = self.cari_hesap(c)
        ogeler = []
        for m in self.maddeler():
            if m.tarih > t:
                break
            for i, s in enumerate(m.satirlar):
                if ana(s["h"]) == ana(ch) and s["c"] == c:
                    e = s["e"] or {}
                    ogeler.append({"id": f"{m.id}/{i}", "tarih": m.tarih, "sira": (m.sinif, m.seq, i), "taraf": "b" if s["b"] else "a",
                                   "tutar": s["b"] or s["a"], "kalan": s["b"] or s["a"], "k": e.get("k"), "link": e.get("link"),
                                   "vade": e.get("vade"), "tur": e.get("tur")})
        kmap = defaultdict(list)
        for o in ogeler:
            if o["k"]:
                kmap[o["k"]].append(o)

        def eslestir(x, hedef_k):
            for y in kmap.get(hedef_k, []):
                if y["taraf"] != x["taraf"] and y["kalan"] > 0 and x["kalan"] > 0:
                    n = min(x["kalan"], y["kalan"])
                    x["kalan"] -= n
                    y["kalan"] -= n
        for (tarih, k1, k2, tut) in self.gecis().mahsup:
            if tarih > t:
                continue
            for x in kmap.get(k1, []):
                for y in kmap.get(k2, []):
                    if x["taraf"] != y["taraf"]:
                        n = min(tut, x["kalan"], y["kalan"])
                        x["kalan"] -= n
                        y["kalan"] -= n
                        tut -= n
        for o in ogeler:
            if o["link"]:
                eslestir(o, o["link"])
        bor = sorted([o for o in ogeler if o["taraf"] == "b" and o["kalan"] > 0], key=lambda o: (o["tarih"], o["sira"]))
        ala = sorted([o for o in ogeler if o["taraf"] == "a" and o["kalan"] > 0], key=lambda o: (o["tarih"], o["sira"]))
        i = j = 0
        while i < len(bor) and j < len(ala):
            n = min(bor[i]["kalan"], ala[j]["kalan"])
            bor[i]["kalan"] -= n
            ala[j]["kalan"] -= n
            if bor[i]["kalan"] == 0:
                i += 1
            if ala[j]["kalan"] == 0:
                j += 1
        return ogeler

    def acik_faturalar(self, c, t):
        out = []
        for o in self.dagit(c, t):
            if o["tur"] == "fatura" and o["kalan"] > 0:
                out.append({"fatura": o["k"].split(":", 1)[1], "kalan": o["kalan"] if o["taraf"] == "b" else -o["kalan"],
                            "vade": o["vade"], "tarih": o["tarih"]})
        return out

    def gecikmis(self, c, t):
        """B1 (A: vadesi geçmiş fatura kalanı da gecikmiş; taksitli faturada yalnız taksit; vade < t)."""
        g = self.gecis()
        kart_k = set()
        kartlar = [(kid, kt) for kid, kt in g.kart.items() if kt["cari"] == c]
        for kid, kt in kartlar:
            kart_k.add("fatura:" + kt["fatura"] if kt.get("kaynak") == "fatura" else "taksit:" + kid)
        top, detay = 0, []
        for o in self.dagit(c, t):
            if o["taraf"] != "b" or o["kalan"] <= 0 or o["k"] in kart_k:
                continue
            if o["tur"] == "fatura":
                if self.k.B1 != "A":
                    continue
                vade = o["vade"] or o["tarih"]
            elif o["tur"] in ("acilis", "borc_yaz", "karsiliksiz"):
                vade = o["vade"]
                if not vade:
                    continue
            else:
                continue
            if vade < t:
                top += o["kalan"]
                detay.append({"kalem": o["k"], "vade": vade, "kalan": o["kalan"]})
        mod = self.moduller(t)
        for kid, kt in kartlar:
            if kt.get("kapali"):
                continue
            odenen = mod.get(("taksit_odenen", kid), 0)
            for tk in sorted(kt["taksitler"], key=lambda x: x["vade"]):
                n = min(odenen, tk["tutar"])
                odenen -= n
                kalan = tk["tutar"] - n
                if kalan and tk["vade"] < t:
                    top += kalan
                    detay.append({"kalem": f"taksit:{kid}", "vade": tk["vade"], "kalan": kalan})
        return {"cari": c, "tarih": t, "gecikmis": top, "detay": detay}

    # -- dondurma (Ç3) ve kural farkı (KG-15)
    def kural_farki(self, t=None):
        if self.donmus is None or self.kural_farki_fisi is not None:
            return {}
        if t is not None and t < self.donmus_sinir:
            pass
        guncel = defaultdict(int)
        for m in self.gecis().maddeler:
            if m.tarih <= self.donmus_sinir:
                for s in m.satirlar:
                    guncel[(s["h"], s["c"])] += s["b"] - s["a"]
        for m in self.donmus:
            for s in m.satirlar:
                guncel[(s["h"], s["c"])] -= s["b"] - s["a"]
        return {anahtar(*k): v for k, v in sorted(guncel.items(), key=lambda x: (x[0][0], x[0][1] or "")) if v}


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
        v = {k: x for k, x in o.items() if k not in ("tur", "tarih", "id")}
        self._denetle(tur, tarih, v, d)
        return d.kaynak_ekle(tur, tarih, v, o.get("id"))

    def _denetle(self, tur, tarih, v, d):
        """Olay anında reddedilmesi gereken istekler (program 4xx)."""
        if tur == "kasa_acilis":                     # M-01: bir kez, ilk hareketten önce
            if any(k.tur == "kasa_acilis" and k.durum == "aktif" for k in d.kaynaklar.values()):
                raise Red("KASA_ACILIS_TEKRAR")
            if any(x[3] == ("kasa",) and x[0] < tarih for x in d.gecis().mod):
                raise Red("KASA_ACILIS_SONRA", "kasada açılıştan önce hareket var")
        if tur == "supheliye_al":                    # J-01: ≤ carinin borç bakiyesi
            c = v["cari"]
            bak = d.bakiyeler(tarih).get((d.cari_hesap(c), c), 0)
            if v["tutar"] > bak:
                raise Red("SUPHELI_FAZLA", f"{v['tutar']} > carinin borç bakiyesi {bak}")
        if tur == "karsilik_ayir":                   # J-02: ≤ kalan şüpheli − mevcut karşılık
            s = d.gecis().supheli.get(v["cari"], {"kalan": 0, "karsilik": 0})
            if v["tutar"] > s["kalan"] - s["karsilik"]:
                raise Red("KARSILIK_FAZLA")
        if tur in ("degersiz_yaz", "supheliden_cikar"):
            s = d.gecis().supheli.get(v["cari"])
            if not s or not s["kalan"]:
                raise Red("SUPHELI_YOK")
        if tur == "tahsilat" and v.get("supheliden"):  # T-13
            s = d.gecis().supheli.get(v["cari"], {"kalan": 0})
            if v["tutar"] > s["kalan"]:
                raise Red("SUPHELI_TAHSILAT_FAZLA")
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

    # -- düzenle / iptal / sil (G-7)
    def _hedef(self, o, d):
        k = d.kaynaklar.get(o["kaynak"])
        if k is None:
            raise Red("YOK", o["kaynak"])
        d.kilit_denetimi(k.tarih)
        return k

    def _o_duzenle(self, o, d):                      # F-14, C-03
        k = self._hedef(o, d)
        if "tarih" in o.get("degisiklik", {}):
            d.kilit_denetimi(o["degisiklik"]["tarih"])
            k.tarih = o["degisiklik"]["tarih"]
        k.v.update({a: b for a, b in o.get("degisiklik", {}).items() if a != "tarih"})
        d.degisti()

    def _o_iptal(self, o, d):                        # F-15, D-03 (POS İptal Et)
        k = self._hedef(o, d)
        k.durum = "iptal"
        d.degisti()

    def _o_sil(self, o, d):                          # R-04
        k = self._hedef(o, d)
        k.durum = "silindi"
        d.degisti()

    def _o_geri_yukle(self, o, d):                   # R-04
        k = self._hedef(o, d)
        k.durum = "aktif"
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
        H = I = 0
        for m in d.maddeler():
            if m.tarih > t:
                break
            if m.id in haric:
                continue
            for s in m.satirlar:
                e = s["e"] or {}
                if s["h"] == "391" and s["a"] and m.tarih[:7] == ay and m.sinif != 0:
                    H += s["a"]
                if s["h"] == "191" and s["b"]:
                    etiketli = self.k.KG7 == "A" and e.get("indirim_ayi")
                    if m.sinif == 0 and not etiketli:
                        continue
                    etkin = e["indirim_ayi"] if etiketli else m.tarih[:7]
                    if etkin == ay:
                        I += s["b"]
        D = d.bakiyeler(t).get(("190", None), 0)
        net = I + D - H
        satirlar = [Bo("391", H), Al("191", I)]
        if net >= 0:
            satirlar.append(L("190", I - H))
        else:
            satirlar += [Al("190", D), Al("360", H - I - D)]
        if not any(s["b"] or s["a"] for s in satirlar):
            raise Red("KDV_MAHSUP_BOS", ay)
        d.fis_ekle(t, 2, "kdv_mahsup", satirlar, {"ay": ay, "H": H, "I": I, "D": D}, id=o.get("id"))

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
        fark = d.kural_farki()
        if not fark:
            raise Red("KURAL_FARKI_YOK")
        satirlar = [L(ayir(k)[0], v, ayir(k)[1]) for k, v in fark.items()]
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
        else:
            raise KeyError(r)
        self.raporlar[o["ad"]] = x

    # -- devir (N-01…N-13), Devri Yenile (N-14), Devri Geri Al (N-15)
    def devir(self, o):
        K = o["K"]
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
        arsiv.degisti()
        kapanis = self._kapanis(arsiv, K, did)
        arsiv.kilit = K
        yeni = Dosya(self.tanim, self.k, self.sayac, "canli", canli.defter_turu)
        yeni.kaynaklar = {i: copy.deepcopy(k) for i, k in canli.kaynaklar.items() if k.tarih > K}
        yeni.fisler = [copy.deepcopy(f) for f in canli.fisler if f.tarih > K]
        yeni.kilit = K
        acilis = self._acilislar(arsiv, yeni, K, secenek, did)
        kayit = {"id": did, "K": K, "secenek": secenek, "yedek": yedek, "kapanis": kapanis, "acilis": acilis}
        self.arsivler.append(arsiv)
        self.devirler.append(kayit)
        self.canli = yeni
        kayit["degismezler"] = devir_degismezleri(arsiv, yeni, K, yedek, did)
        self.raporlar[o.get("ad", did)] = self._devir_raporu(kayit, arsiv, yeni)

    def _devir_raporu(self, kayit, arsiv, yeni, onceki=None):
        K = kayit["K"]
        kap = {anahtar(*k): v for k, v in sorted(arsiv.bakiyeler(K).items(), key=lambda x: (x[0][0], x[0][1] or "")) if bilanco_hesabi(k[0])}
        acl = {anahtar(*k): v for k, v in sorted(acilis_bakiyeleri(yeni, K, kayit["id"]).items(), key=lambda x: (x[0][0], x[0][1] or ""))}
        r = {"K": K, "secenek": kayit["secenek"], "arsiv_kapanis": kap, "yeni_acilis": acl, "kapanis": kayit["kapanis"],
             "acilis": {a: b for a, b in kayit["acilis"].items() if a != "kaynaklar"}, "degismezler": kayit["degismezler"]}
        if onceki is not None:
            r["fark"] = {k: acl.get(k, 0) - onceki.get(k, 0) for k in sorted(set(acl) | set(onceki)) if acl.get(k, 0) != onceki.get(k, 0)}
        return r

    def _kapanis(self, arsiv, K, did):
        """N-01 → N-02/N-03 → N-04 → (N-05 yok, KG-13 A) → N-06 → N-07 (+ N-08, KG-12)."""
        out = {"N01": {}, "R": {}}
        yk = yil(K)
        ilk = min([m.tarih for m in arsiv.maddeler()] + [K])
        if self.k.KG12 == "A":                       # önceki yıl sonları için de §5 değerlemesi (yıl sonu tarihli)
            for y in range(yil(ilk), yk):
                ty = f"{y}-12-31"
                fark = arsiv.ana_bakiye("153", ty) - arsiv.deger(ty)
                if fark:
                    arsiv.fis_ekle(ty, 2, "stok_degerleme", [L("621", fark), L("153", -fark)], {"yil": y}, kaynak=did)
                arsiv.degerlenen[y] = (ty, did)
                out["N01"][str(y)] = fark
        fark = arsiv.ana_bakiye("153", K) - arsiv.deger(K)
        if fark:
            arsiv.fis_ekle(K, 2, "stok_degerleme", [L("621", fark), L("153", -fark)], {"yil": yk}, kaynak=did)
        arsiv.degerlenen[yk] = (K, did)
        out["N01"][str(yk)] = fark
        out["DSS"] = arsiv.deger(K)
        # yıl yıl sonuç (kapanış sınıfı hariç)
        R = defaultdict(int)
        for m in arsiv.maddeler():
            if m.tarih > K:
                break
            if m.sinif == 3:
                continue
            for s in m.satirlar:
                if sonuc_hesabi(s["h"]):
                    R[yil(m.tarih)] += s["a"] - s["b"]
        out["R"] = {str(y): v for y, v in sorted(R.items())}
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
        sonuc = -top                                  # kâr > 0
        if sonuc:
            arsiv.fis_ekle(K, 3, "kapanis", [L("690", sonuc), L("692", -sonuc)], {"adim": "N-06"}, kaynak=did)
            if self.k.KG12 == "A":
                cari_yil = R.get(yk, 0)
                n7 = [L("692", cari_yil), L("590" if cari_yil > 0 else "591", -cari_yil)] if cari_yil else []
                if n7:
                    arsiv.fis_ekle(K, 3, "kapanis", n7, {"adim": "N-07"}, kaynak=did)
                for y in sorted(R):
                    if y < yk and R[y]:
                        arsiv.fis_ekle(K, 3, "kapanis", [L("692", R[y]), L("570" if R[y] > 0 else "580", -R[y])],
                                       {"adim": "N-08", "yil": y}, kaynak=did)
            else:
                arsiv.fis_ekle(K, 3, "kapanis", [L("692", sonuc), L("590" if sonuc > 0 else "591", -sonuc)], {"adim": "N-07"}, kaynak=did)
        out["sonuc"] = sonuc
        return out

    def _acilislar(self, arsiv, yeni, K, secenek, did):
        t = ertesi(K)
        ga = arsiv.gecis()
        mod = arsiv.moduller(K)
        bal = arsiv.bakiyeler(K)
        out = {"acik_kalemler": [], "cariler": {}, "ekstre": {}, "kaynaklar": []}

        def ekle(tur, v):
            k = yeni.kaynak_ekle(tur, t, v, id=f"{did}:{tur}:{len(out['kaynaklar']) + 1}", devir=did)
            out["kaynaklar"].append(k.id)
            return k
        if mod.get(("kasa",)):
            ekle("devir_kasa", {"tutar": mod[("kasa",)]})
        for c in sorted(self.tanim["cariler"]):
            ch = arsiv.cari_hesap(c)
            ch_bal = bal.get((ch, c), 0)
            acik = arsiv.acik_faturalar(c, K)
            for x in acik:
                ekle("devir_acik_kalem", {"cari": c, "fatura": x["fatura"], "kalan": x["kalan"], "vade": x["vade"], "belge_tarihi": x["tarih"]})
                out["acik_kalemler"].append(dict(x, cari=c))
            net = ch_bal - sum(x["kalan"] for x in acik)
            if net:
                ekle("devir_cari", {"cari": c, "tutar": net, "vade": None})   # vade yazılı değil (G2 §4.2'nin yerine) → KARAR GEREKİYOR
            if ch_bal or acik:
                out["cariler"][c] = {"bakiye": ch_bal, "acilis": net}
                hb = sum(s["b"] for m in arsiv.maddeler() if m.tarih <= K for s in m.satirlar if s["h"] == ch and s["c"] == c)
                ha = sum(s["a"] for m in arsiv.maddeler() if m.tarih <= K for s in m.satirlar if s["h"] == ch and s["c"] == c)
                if secenek == "borc_alacak":
                    out["ekstre"][c] = {"Borç Toplamı": hb - sum(x["kalan"] for x in acik if x["kalan"] > 0),
                                        "Alacak Toplamı": ha + sum(x["kalan"] for x in acik if x["kalan"] < 0),
                                        "acik_kalemler": len(acik)}
                else:
                    out["ekstre"][c] = {"Bakiye": net, "acik_kalemler": len(acik)}
        for anah, v in sorted(mod.items(), key=lambda x: str(x[0])):
            if anah[0] == "banka":
                ekle("devir_banka", {"banka": anah[1], "tutar": v})
            elif anah[0] == "kart":
                ekle("devir_kart", {"kart": anah[1], "tutar": v})
            elif anah[0] == "kredi":
                ekle("devir_kredi", {"kredi": anah[1], "tutar": v})
        dg = arsiv.degerleme(K)
        kal = [{"urun": u, "miktar": x["miktar"], "deger": x["deger"]} for u, x in sorted(dg["urunler"].items()) if Fraction(x["miktar"]) or x["deger"]]
        if kal:
            ekle("devir_stok", {"kalemler": kal})
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
        for c, s in sorted(ga.supheli.items()):
            if s["kalan"] or s["karsilik"]:
                ekle("devir_supheli", {"cari": c, "kalan": s["kalan"], "karsilik": s["karsilik"]})
        for kid, kt in sorted(ga.kart.items()):
            ekle("devir_taksit", {"kart": kid, "kart_kaydi": kt, "odenen": mod.get(("taksit_odenen", kid), 0),
                                  "link": ("fatura:" + kt["fatura"]) if kt.get("kaynak") == "fatura" else "taksit:" + kid})
        # N-13 tamamlayıcı: her bilanço hesabı (G hariç) için arşiv K bakiyesi − N-09…N-12'nin karşıladığı
        kars = defaultdict(int)
        for m in yeni.gecis().maddeler:
            if m.tarih == t and m.sinif == 0 and getattr(yeni.kaynaklar.get(m.kaynak), "devir", None) == did:
                for s in m.satirlar:
                    kars[(s["h"], s["c"])] += s["b"] - s["a"]
        tamam, ertelenen = [], defaultdict(int)
        if self.k.KG7 == "A":
            for m in arsiv.maddeler():
                for s in m.satirlar:
                    ia = (s["e"] or {}).get("indirim_ayi")
                    if s["h"] == "191" and s["b"] and ia and ia > K[:7]:
                        ertelenen[ia] += s["b"]
        for (h, c), v in sorted(bal.items(), key=lambda x: (x[0][0], x[0][1] or "")):
            if not bilanco_hesabi(h) or ana(h) == G:
                continue
            fark = v - kars.get((h, c), 0)
            if not fark:
                continue
            if h == "191" and ertelenen:
                for ia, tut in sorted(ertelenen.items()):
                    tamam.append(L("191", tut, None, indirim_ayi=ia))
                    fark -= tut
            if fark:
                tamam.append(L(h, fark, c))
        for (h, c), v in kars.items():
            if bilanco_hesabi(h) and ana(h) != G and (h, c) not in bal and v:
                tamam.append(L(h, -v, c))
        if tamam:
            top = sum(s["b"] - s["a"] for s in tamam)
            tamam.append(L(G, -top))
            yeni.fis_ekle(t, 0, "devir_acilis", tamam, {"adim": "N-13"}, kaynak=did)
        out["N13"] = {anahtar(s["h"], s["c"]) + (f"@{s['e']['indirim_ayi']}" if s["e"] else ""): s["b"] - s["a"] for s in tamam}
        return out

    def devri_yenile(self, o):                       # N-14 (G7)
        if not self.devirler:
            raise Red("DEVIR_YOK")
        kayit = self.devirler[-1]
        did, K = kayit["id"], kayit["K"]
        arsiv, yeni = self.arsivler[-1], self.canli
        yedek_a, yedek_y = arsiv.kopya(), yeni.kopya()
        onceki_acl = {anahtar(*k): v for k, v in acilis_bakiyeleri(yeni, K, did).items()}
        onceki_acik = {x["fatura"]: x["kalan"] for x in kayit["acilis"]["acik_kalemler"]}
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
            # çakışma: K sonrası bağı olan açık kalem düzeltmeyle kapandıysa (G7)
            bagli = defaultdict(int)
            for k in yeni.kaynaklar.values():
                if k.devir is None and k.v.get("fatura") and k.v["fatura"] in onceki_acik:
                    bagli[k.v["fatura"]] += k.v.get("tutar", 0)
            yeni_acik = {}
            for c in self.tanim["cariler"]:
                for x in arsiv.acik_faturalar(c, K):
                    yeni_acik[x["fatura"]] = x["kalan"]
            cakisma = [f for f, b in bagli.items() if b and not yeni_acik.get(f, 0)]   # G7: düzeltmeyle KAPANAN + K sonrası bağı
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
        kayit["degismezler"] = devir_degismezleri(arsiv, yeni, K, None, did)
        r = self._devir_raporu(kayit, arsiv, yeni, onceki_acl)
        r["uyarilar"] = eksi_uyarilari(yeni)
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
        ms = d.maddeler()
        return ms[-1].tarih if ms else "2000-01-01"

    def sonuc(self):
        deg = {"canli": degismezler(self.canli, self.son_tarih(self.canli))}
        for i, a in enumerate(self.arsivler):
            deg[f"arsiv:{i}"] = degismezler(a, a.ust)
        return {"dil": DIL, "kurallar": self.k.etiket(), "raporlar": self.raporlar, "redler": self.redler, "degismezler": deg,
                "devirler": [{"id": d["id"], "K": d["K"], "degismezler": d["degismezler"]} for d in self.devirler],
                "acilis_olabilir": sorted(self.canli.gecis().acilis_olabilir)}


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
    return out


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


def devir_degismezleri(arsiv, yeni, K, yedek, did):
    """§6 devir değişmezleri (kâhinin ana denetimi)."""
    out = {}
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
