#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Rastgele senaryo üreteci — dil `destekofis-senaryo/1` (test/bagimsiz/SENARYO-DILI.md).

Kullanım:
  python3 -I test/bagimsiz/uretici.py --tohum 7 [--islem 500] [--kontrol 25] [--cikti <dosya>]

Ne üretir:
  Tohumdan (random.Random(tohum)) belirlenimli, gerçekçi sıralı bir senaryo: kuruluş (ürün, stok, cari, Kasa açılışı, banka
  hesapları), sonra iş günü iş günü satış/alış faturası (peşin, taksit, açık), iade, cari tahsilat/ödeme (bağlı ve bağsız),
  taksit tahsilatı, Kasa elle hareketleri, Kasa↔Banka, bankalar arası transfer, banka fişleri (masraf BSMV/KDV, faiz, diğer,
  kart borcu, kredi), Ters Kaydet, silme, hesap durumu/politikası, Açılışı Düzelt, ayar değişiklikleri, istek kimliği
  yinelemeleri ve kasıtlı RET durumları (yetki 403, ileri tarih, hesap seçimi, kaynak = hedef, 3 ondalık, aynı IBAN/kod,
  geçersiz IBAN, Σ peşin > toplam, iade sınırı, silinmişi silme 404, ters kaydı iki kez 409, Benzer İşlem 409, eksi bakiye
  409 Uyar/Engelle, açılış öncesi tarih, Açılışı Düzelt ilk hareketten sonra, farklı gövdeli istek kimliği 409). İsteğe bağlı
  eşzamanlı grup (ayniAnda). Tarihler artan; dönem kilidi yok.

Temiz oda: bu dosya programın kodunu ve model_a/model_b'yi OKUMAZ. Kurallar yalnız SENARYO-DILI.md'den alınır. Üretecin
içindeki küçük durum izleyicisi BEKLENEN DEĞER ÜRETMEZ; yalnız senaryonun "senaryo kurmaz" kurallarına (§12, §13) uymasını ve
kasıtlı retlerin TEK ihlal taşımasını sağlar (bakiye payı 500 TL; sınırda kalan işlem kurulmaz). Beklenen değerler iki
bağımsız kâhinden (model_a, model_b) gelir; program ile karşılaştırma fark.py'dedir.

Kararlar (senaryo yazarı olarak; dilde açık bırakılan yerler):
  - Fatura başına KDV dahil/hariç tek seçim (programda belge düzeyi seçim; karışık kalem dilde serbest ama koşucu eşleyemez).
  - Cariler iki biçimde çalışır: "bağlı" (bütün tahsilat/ödemesi Kapatılacak Fatura ile) ve "bağsız" (hiç bağlı satır yok).
    Böylece BELİRSİZ-10 (bağlı tutarın açığı aşması) kurulmaz; bağsız carilerde FIFO karşılaştırılır.
  - Yinelenen (istek kimliği) adımda `ad` verilmez (iki kâhinin K-4 kararları ayrışıyor; dil "ad'ı önceki adımın hareketini
    anar" diyor).
  - Hesaba bağlı tahsilat/ödeme yalnız iş günlerinde; resmî tatiller (2024–2027 bilinen günler ve arifeleri) atlanır.
"""

import argparse
import datetime
import json
import os
import random
import sys

DIL = "destekofis-senaryo/1"
PAY = 50000  # 500 TL güvenlik payı (kuruş): başarılı çıkış sonrası en az bu kadar; kasıtlı ihlalde en az bu kadar eksi
# Kâhinlerle ilgili iki uyum kuralı (fark.py raporunda "kâhin" sınıfı olarak ayrıca yazılır):
#  1. model_b'nin senaryo doğrulayıcısı `kasa_hareket`in `ad`ını tanımlamıyor ("'Hn' daha önce tanımlanmamış") → Kasa elle
#     hareketi silinmez (sil hedefi olmaz). Kasa elle hareketine yine ad verilir (iki kâhin ve koşucu için zararsız).
#  2. model_a, istek kimliği yinelemesini "senaryo kurmaz" denetimlerinden (BELİRSİZ-4/6/10/14) SONRA tanıyor: yineleme ikinci
#     kez uygulansaydı sınır aşılacaksa senaryoyu geçersiz sayıyor. Bu yüzden yineleme yalnız ikinci uygulama da sınır içinde
#     kalacaksa kurulur; BELİRSİZ-4 ailesinde (transfer, banka fişleri) yinelemeye benzerOnay eklenir.
KASA_HAREKET_SILINMEZ = True

# Resmî tatiller ve arifeler (bilinen; üstküme). Hafta sonları ayrıca atlanır.
TATILLER = set()
for _y, _gunler in {
    2024: ["01.01", "09.04", "10.04", "11.04", "12.04", "23.04", "01.05", "19.05", "15.06", "16.06", "17.06", "18.06",
           "19.06", "15.07", "30.08", "28.10", "29.10"],
    2025: ["01.01", "29.03", "30.03", "31.03", "01.04", "23.04", "01.05", "19.05", "05.06", "06.06", "07.06", "08.06",
           "09.06", "15.07", "30.08", "28.10", "29.10"],
    2026: ["01.01", "19.03", "20.03", "21.03", "22.03", "23.04", "01.05", "19.05", "26.05", "27.05", "28.05", "29.05",
           "30.05", "15.07", "30.08", "28.10", "29.10"],
    2027: ["01.01", "08.03", "09.03", "10.03", "11.03", "23.04", "01.05", "15.05", "16.05", "17.05", "18.05", "19.05",
           "15.07", "30.08", "28.10", "29.10"],
    2028: ["01.01", "25.02", "26.02", "27.02", "28.02", "23.04", "01.05", "04.05", "05.05", "06.05", "07.05", "08.05",
           "19.05", "15.07", "30.08", "28.10", "29.10"],
}.items():
    for _g in _gunler:
        TATILLER.add(datetime.date(_y, int(_g[3:5]), int(_g[0:2])))

BANKALAR = [("Ziraat Bankası", "00010"), ("Garanti BBVA", "00062"), ("Türkiye İş Bankası", "00064"),
            ("Akbank", "00046"), ("Yapı Kredi", "00067"), ("Halkbank", "00012"), ("VakıfBank", "00015"),
            ("QNB", "00111"), ("Denizbank", "00134")]
BANKA_KISA = {"Ziraat Bankası": "ZRT", "Garanti BBVA": "GRN", "Türkiye İş Bankası": "ISB", "Akbank": "AKB",
              "Yapı Kredi": "YKB", "Halkbank": "HLK", "VakıfBank": "VKF", "QNB": "QNB", "Denizbank": "DNZ"}
UNVAN_KOK = ["Anadolu", "Ege", "Marmara", "Karadeniz", "Toros", "Kuzey", "Güney", "Akdeniz", "Doğu", "Batı", "Yıldız",
             "Kardelen", "Çınar", "Defne", "Lale", "Sedir", "Pınar", "Umut", "Bereket", "Işık"]
UNVAN_EK = ["Ticaret Ltd.", "Gıda A.Ş.", "Yapı Ltd.", "Tekstil A.Ş.", "Lojistik Ltd.", "Danışmanlık", "Makine Ltd.",
            "Kırtasiye", "Otomotiv A.Ş.", "Bilişim Ltd."]
KISI = ["Ayşe Yılmaz", "Mehmet Demir", "Fatma Kaya", "Ali Çelik", "Zeynep Şahin", "Mustafa Öztürk", "Elif Arslan",
        "Hüseyin Doğan", "Emine Kılıç", "İbrahim Aydın", "Hatice Koç", "Ömer Kurt", "Gül Özdemir", "Hasan Polat"]
URUNLER = ["Kâğıt A4", "Toner", "Klavye", "Fare", "Monitör", "Sandalye", "Masa", "Dolap", "Kablo", "Lamba", "Çanta",
           "Defter", "Kalem Seti", "Yazıcı", "Tarayıcı", "Hoparlör", "Kulaklık", "Adaptör"]
HIZMETLER = ["Danışmanlık", "Kurulum", "Bakım", "Eğitim", "Nakliye", "Montaj", "Yazılım Desteği"]
KASA_GIRIS = ["Ortaktan Nakit", "Hurda Satışı", "Kira Geliri", "Diğer Nakit Giriş"]
KASA_CIKIS = ["Kırtasiye Gideri", "Yemek Gideri", "Kargo Ücreti", "Temizlik Gideri", "Ulaşım Gideri", "Çay Ocağı"]
MASRAF_TURLERI = ["EFT", "FAST", "Havale", "SWIFT", "Hesap İşletim", "Döviz İşlem", "Diğer"]
TUR_102 = ("vadesiz", "ticari", "vadeli", "diger")
HAVALE_TURLERI = ("vadesiz", "ticari", "diger")


# ───────────────────────────────────────────────────────────── yardımcılar

def rh(a, b):
    """§6.1: yarım birim sıfırdan uzağa (a ≥ 0, b > 0)."""
    return (2 * a + b) // (2 * b)


def tarih_metni(d):
    return "%02d.%02d.%04d" % (d.day, d.month, d.year)


def is_gunu(d):
    return d.weekday() < 5 and d not in TATILLER


def sonraki_is_gunu(d, n=1):
    while n > 0:
        d += datetime.timedelta(days=1)
        if is_gunu(d):
            n -= 1
    return d


def onceki_is_gunu(d):
    d -= datetime.timedelta(days=1)
    while not is_gunu(d):
        d -= datetime.timedelta(days=1)
    return d


def tl(kurus, R=None):
    """Kuruş → senaryo tutar metni (§3.3). Biçim çeşitliliği: "1234", "1234,5", "1234,50"."""
    assert kurus > 0, kurus
    tam, kr = divmod(kurus, 100)
    if kr == 0:
        if R is not None and R.random() < 0.15:
            return "%d,00" % tam
        return "%d" % tam
    if kr % 10 == 0 and R is not None and R.random() < 0.5:
        return "%d,%d" % (tam, kr // 10)
    return "%d,%02d" % (tam, kr)


def iban_uret(R, banka_kodu):
    hesap = "".join(R.choice("0123456789") for _ in range(16))
    bban = banka_kodu + "0" + hesap
    kalan = int(bban + "292700") % 97
    return "TR%02d%s" % (98 - kalan, bban)


def iban_bozuk(iban):
    cd = int(iban[2:4])
    return "TR%02d%s" % ((cd + 1) % 100 if cd != 98 else 2, iban[4:])


def kalem_tutari(q, f, r, dahil, p):
    """§6.3. p = iskonto baz puanı (0 = yok). Dönüş (M, K, T)."""
    brut = q * f
    if dahil and not p:
        M = rh(brut * 100, 100 + r)
        return M, brut - M, brut
    if dahil:
        H = rh(brut * 100, 100 + r)
        M = H - rh(H * p, 10000)
    else:
        M = brut - rh(brut * p, 10000)
    K = rh(M * r, 100)
    return M, K, M + K


def oran_bp(metin):
    if "," in metin:
        t, k = metin.split(",")
        return int(t) * 100 + int((k + "0")[:2])
    return int(metin) * 100


# ───────────────────────────────────────────────────────────── üreteç

class Uretec:
    def __init__(self, tohum, islem, kontrol_araligi, eszamanli=None, notr=()):
        self.R = random.Random(tohum)
        # Nötrleştirme (fark.py --notr): bilinen fark kökleri kapatılmış varyant; rastgele akış olabildiğince aynı kalır.
        #   iskonto_dahil   KDV dahil kalemde iskonto yazılmaz (çekiliş yine yapılır)
        #   kasa_acilis     Kasa açılışı yerine aynı tutarda Kasa elle girişi ("Ortaktan Nakit")
        #   kart            kart yolu (kurumsal kartla ödeme) havale olarak yazılır; yanlış hesaplı kart reti kurulmaz
        #   fatura_yineleme fatura istek kimliği yinelemesi kurulmaz
        #   iade            iade yalnız "bağlı" carinin açığı iadeyi karşılayan faturasına, geri ödemesiz (dil §7 kural 5)
        #   kasa_yineleme   Kasa elle hareketinde istek kimliği yinelemesi kurulmaz
        #   vadeli          vadeli hesapta yalnız transfer ve faiz geliri (PLAN §3.5); masraf/diğer/faiz gideri başka hesapta
        #   kredi           kredi anaparası kalan kredi borcunu aşmaz
        self.notr = set(notr)
        self.tohum = tohum
        self.hedef_islem = islem
        self.kontrol_araligi = kontrol_araligi
        R = self.R
        self.eszamanli = (R.random() < 0.4) if eszamanli is None else eszamanli
        self.adimlar = []
        self.sayac = 0          # adım id sayacı
        self.islem_sayisi = 0   # kontrol ve saat dışındaki adımlar
        self.kontrol_sayac = 0
        self.son_kontrol = 0
        self.ad_sayac = {}
        # gün: 2025-01-06 .. 2026-11-30 arası bir iş günü
        gun = datetime.date(2025, 1, 6) + datetime.timedelta(days=R.randint(0, 690))
        while not is_gunu(gun):
            gun += datetime.timedelta(days=1)
        self.bugun = gun
        self.baslangic = gun
        self.kasa_politika = R.choices(["uyar", "engelle", "kontrol_yok"], [5, 3, 2])[0]
        self.benzer_acik = R.random() < 0.85
        # durum
        self.hesaplar = {}      # ad → dict
        self.kodlar = set()
        self.ibanlar = set()
        self.para = {"KASA": [], "102.00": [], "108.00": []}   # anahtar → [(tarih, delta)]
        self.cariler = {}
        self.urunler = {}
        self.faturalar = {}
        self.kartlar = {}
        self.hareketler = {}
        self.benzer_havuz = {}  # anahtar → etkin satır sayısı
        self.benzer_silinmis = set()
        self.b4_havuz = set()   # (tarih, hesap anahtarı, ana tutar)
        self.istekler = {}      # (kullanıcı, işlem, kimlik) → gövde
        self.kimlik_sayac = 0
        self.grup_sayisi = 0
        # tohumun işlem ağırlıkları (her tohumda biraz farklı karışım)
        taban = {
            "satis": 16, "alis": 9, "iade": 3, "tahsilat": 13, "odeme": 9, "taksit_tahsilat": 7, "kasa_hareket": 4,
            "kasa_banka": 3, "transfer": 3, "banka_masraf": 4, "faiz_geliri": 1.5, "faiz_gideri": 1, "diger_gelir": 1,
            "diger_gider": 1, "kart_borcu": 1.5, "kredi_kullanim": 0.8, "kredi_odeme": 1, "ters_kayit": 2, "sil": 3,
            "politika": 0.6, "hesap_durum": 0.6, "acilis_duzelt": 0.7, "ayar": 0.5, "yeni_hesap": 0.5, "yeni_cari": 1,
            "stok_giris": 1, "ret": 5,
        }
        self.agirlik = {k: v * R.uniform(0.4, 1.8) for k, v in taban.items()}
        # ürün düzeni: yarı tohumlarda alınan ve satılan ürün kümeleri ayrık (153 karşılaştırılabilsin; BELİRSİZ-15)
        self.ayrik_urun = R.random() < 0.5

    # ---------- ad ve adım ----------
    def yeni_ad(self, onek):
        n = self.ad_sayac.get(onek, 0) + 1
        self.ad_sayac[onek] = n
        return "%s%d" % (onek, n)

    def ekle(self, adim, islem_say=True):
        self.sayac += 1
        adim = dict([("id", str(self.sayac))] + list(adim.items()))
        self.adimlar.append(adim)
        if islem_say:
            self.islem_sayisi += 1
        return adim

    def kontrol(self):
        self.kontrol_sayac += 1
        self.sayac += 1
        self.adimlar.append({"id": "k%d" % self.kontrol_sayac, "islem": "kontrol"})
        self.son_kontrol = self.islem_sayisi

    # ---------- para ve bakiye ----------
    def bakiye(self, anahtar, tarih=None):
        return sum(d for t, d in self.para[anahtar] if tarih is None or t <= tarih)

    def en_dusuk_sonra(self, anahtar, satirlar, d):
        """d'den başlayarak her günün bakiyesinin en düşüğü (satirlar = önerilen son durum)."""
        gunler = sorted({t for t, _ in satirlar if t >= d} | {d})
        en = None
        for g in gunler:
            b = sum(x for t, x in satirlar if t <= g)
            en = b if en is None else min(en, b)
        return en

    def denetim(self, anahtar):
        """(politika, limit) ya da None (denetlenmez)."""
        if anahtar == "KASA":
            return self.kasa_politika, 0
        if anahtar in ("102.00", "108.00"):
            return None
        h = self.hesaplar[anahtar]
        if h["tur"] == "kredi" or not h["dogrulandi"]:
            return None
        return h["politika"] or "uyar", h["limit"]

    def eksi_sonuc(self, etkiler, d=None):
        """Önerilen etkilerin (anahtar, tarih, delta) eksi bakiye sonucu.
        Dönüş: "ok" | "uyar" | "engelle" | "belirsiz" (pay içinde kalan). Uyar ve Engelle birlikte: "karisik"."""
        net = {}
        for a, t, x in etkiler:
            net[a] = net.get(a, 0) + x
        ihlal = set()
        for a, n in net.items():
            if n >= 0:
                continue
            den = self.denetim(a)
            if den is None:
                continue
            pol, lim = den
            if pol == "kontrol_yok":
                continue
            satirlar = list(self.para[a]) + [(t, x) for b, t, x in etkiler if b == a]
            dd = min(t for b, t, x in etkiler if b == a and x < 0) if d is None else d
            en = self.en_dusuk_sonra(a, satirlar, dd) + lim
            duz = min(sum(x for t, x in satirlar if t <= dd), sum(x for t, x in satirlar)) + lim
            if en >= PAY and duz >= PAY:
                continue
            if en <= -PAY and duz <= -PAY:
                ihlal.add(pol)
                continue
            return "belirsiz"
        if not ihlal:
            return "ok"
        if ihlal == {"uyar"}:
            return "uyar"
        if ihlal == {"engelle"}:
            return "engelle"
        return "karisik"

    def uygula_etkiler(self, etkiler):
        for a, t, x in etkiler:
            self.para[a].append((t, x))

    def geri_al_etkiler(self, etkiler):
        for a, t, x in etkiler:
            self.para[a].remove((t, x))

    # ---------- hesap seçimi ----------
    def uygunlar(self, kategori):
        if kategori == "havale":
            return [a for a, h in self.hesaplar.items() if h["aktif"] and h["tur"] in HAVALE_TURLERI]
        if kategori == "kasa_banka":
            return [a for a, h in self.hesaplar.items() if h["aktif"] and h["tur"] in HAVALE_TURLERI]
        if kategori == "kart":
            return [a for a, h in self.hesaplar.items() if h["aktif"] and h["tur"] == "kurumsal_kart"]
        raise ValueError(kategori)

    def hesap_sec(self, kategori, ver_olasilik=0.4):
        """Başarılı satır için hesap: (verilecek takma ad ya da None, para anahtarı) ya da None (kurulamaz)."""
        u = self.uygunlar(kategori)
        if kategori == "kasa_banka":
            vt = [a for a in u if self.hesaplar[a]["tur"] in ("vadesiz", "ticari")]
            if not u:
                return None, "102.00"
            if not vt:
                return None   # BELİRSİZ-21: yalnız 'diger' uygun → kurulmaz
            a = self.R.choice(vt)
            return a, a
        if not u:
            return None, ("102.00" if kategori == "havale" else "108.00")
        if len(u) == 1:
            a = u[0]
            return (a if self.R.random() < ver_olasilik else None), a
        a = self.R.choice(u)
        return a, a

    def acilis_tamam(self, hesap_anahtari, tarih):
        if hesap_anahtari in ("KASA", "102.00", "108.00"):
            return True
        return tarih >= self.hesaplar[hesap_anahtari]["acilis_tarihi"]

    # ---------- Benzer İşlem ----------
    def benzer_anahtar(self, yon, yol, hesap, cari, tutar, tarih, hedef):
        return (yon, yol, hesap, cari, tutar, tarih, hedef)

    def benzer_gerekli(self, anahtar):
        """Yeni (hesaba bağlı) cari/taksit satırı için: 'yok' | 'etkin' (409) | 'silinmis' (BELİRSİZ-19)."""
        if not self.benzer_acik:
            return "yok"
        if self.benzer_havuz.get(anahtar, 0) > 0:
            return "etkin"
        if anahtar in self.benzer_silinmis:
            return "silinmis"
        return "yok"

    def benzer_ekle(self, anahtar):
        self.benzer_havuz[anahtar] = self.benzer_havuz.get(anahtar, 0) + 1

    def benzer_cikar(self, anahtar):
        self.benzer_havuz[anahtar] -= 1
        self.benzer_silinmis.add(anahtar)

    def b4_gerekli(self, hesaplar, tutar):
        return any((self.bugun, h, tutar) in self.b4_havuz for h in hesaplar)

    def b4_ekle(self, hesaplar, tutar):
        for h in hesaplar:
            self.b4_havuz.add((self.bugun, h, tutar))

    # ---------- istek kimliği ----------
    def kimlik_ver(self, adim, olasilik=0.12):
        if self.R.random() < olasilik:
            self.kimlik_sayac += 1
            adim["istekKimligi"] = "ik-%d" % self.kimlik_sayac
        return adim

    def yineleme_ekle(self, asil, farkli=False, benzer_onay=False):
        """Başarılı bir adımın aynı gün, aynı kullanıcıyla yinelemesi. farkli=True → tutar değişik (409)."""
        y = {k: v for k, v in asil.items() if k not in ("id", "ad")}
        if benzer_onay:
            y["benzerOnay"] = True
        if farkli:
            T = self.metinden(y["tutar"]) + self.R.randint(1, 500) * 100
            y["tutar"] = tl(T)
        self.ekle(y)

    @staticmethod
    def metinden(metin):
        if "," in metin:
            t, k = metin.split(",")
            return int(t) * 100 + int((k + "0")[:2])
        return int(metin) * 100

    # ---------- rastgele tutar ----------
    def tutar(self, alt, ust, kurus_olasilik=0.6):
        """alt..ust TL arası (log dağılımlı), kuruşlu olabilir."""
        R = self.R
        import math
        v = math.exp(R.uniform(math.log(alt), math.log(ust)))
        k = int(v * 100)
        if R.random() >= kurus_olasilik:
            k = (k // 100) * 100
        return max(k, 100)

    def kullanici(self, izinli):
        """izinli ⊆ {Y, MU, PE}: ağırlıklı seçim."""
        agir = {"Y": 6, "MU": 2, "PE": 2}
        secenek = [k for k in izinli]
        return self.R.choices(secenek, [agir[k] for k in secenek])[0]

    def kullanici_ekle(self, adim, kul):
        if kul != "Y":
            adim["kullanici"] = kul
        return adim

    # ─────────────────────────────────────────── kuruluş
    def kurulus(self):
        R = self.R
        for _ in range(R.randint(4, 12)):
            ad = self.yeni_ad("U")
            stok = R.choice([0, R.randint(5, 40), R.randint(20, 200)])
            self.ekle({"islem": "urun_ac", "ad": ad, "urunAdi": "%s %s" % (R.choice(URUNLER), ad), "birim": "Adet"})
            alinabilir = (not self.ayrik_urun) or R.random() < 0.4
            satilabilir = (not self.ayrik_urun) or not alinabilir
            self.urunler[ad] = {"stok": 0, "alinabilir": alinabilir, "satilabilir": satilabilir}
            if stok:
                self.ekle({"islem": "stok_giris", "urun": ad, "miktar": stok})
                self.urunler[ad]["stok"] = stok
        for _ in range(R.randint(6, 25)):
            self.yeni_cari("musteri")
        for _ in range(R.randint(3, 10)):
            self.yeni_cari("tedarikci")
        if R.random() < 0.85:
            T = self.tutar(2000, 60000, 0.3)
            if "kasa_acilis" in self.notr:
                self.ekle({"islem": "kasa_hareket", "yon": "giris", "tutar": tl(T, R), "aciklama": "Ortaktan Nakit"})
            else:
                self.ekle({"islem": "kasa_acilis", "tutar": tl(T, R)})
            self.uygula_etkiler([("KASA", self.bugun, T)])
        # bazı tohumlarda banka hesapları birkaç gün sonra açılır (önce 102.00'a düşen havaleler)
        self.gec_hesap = R.random() < 0.25
        if not self.gec_hesap:
            self.banka_kurulusu()

    def banka_kurulusu(self):
        R = self.R
        n = R.choices([1, 2, 3, 4], [2, 4, 3, 1])[0]
        turler = [R.choices(["vadesiz", "ticari", "diger"], [7, 2, 1])[0] for _ in range(n)]
        for tur in turler:
            self.hesap_ac(tur)
        if R.random() < 0.35:
            self.hesap_ac("vadeli")
        if R.random() < 0.5:
            self.hesap_ac("kurumsal_kart")
        if R.random() < 0.4:
            self.hesap_ac("kredi")

    def yeni_cari(self, tur, kul="Y"):
        R = self.R
        ad = self.yeni_ad("C")
        if tur == "tedarikci" or R.random() < 0.5:
            unvan = "%s %s %s" % (R.choice(UNVAN_KOK), R.choice(UNVAN_EK), ad)
        else:
            unvan = "%s %s" % (R.choice(KISI), ad)
        adim = {"islem": "cari_ac", "ad": ad, "unvan": unvan, "tur": tur}
        if R.random() < 0.25:
            adim["iban"] = iban_uret(R, R.choice(BANKALAR)[1])
        self.ekle(adim)
        self.cariler[ad] = {"tur": tur, "stil": "bagli" if R.random() < 0.3 else "bagsiz", "agirlik": R.uniform(0.2, 3)}
        return ad

    def hesap_ac(self, tur, kul="Y", acilis_gun=None):
        R = self.R
        ad = self.yeni_ad("B")
        banka, kod_b = R.choice(BANKALAR)
        D = acilis_gun if acilis_gun is not None else self.bugun - datetime.timedelta(days=R.randint(0, 25))
        if D > self.bugun:
            D = self.bugun
        adim = {"islem": "hesap_ac", "ad": ad, "banka": banka,
                "hesapAdi": {"vadesiz": "Ana TL Hesabı", "ticari": "Ticari Hesap", "diger": "Diğer Hesap",
                             "vadeli": "Vadeli Mevduat", "kurumsal_kart": "Kurumsal Kart",
                             "kredi": "Ticari Kredi"}[tur] + " " + ad,
                "tur": tur, "paraBirimi": "TRY"}
        if R.random() < 0.6:
            kod = "%s-%s" % (BANKA_KISA[banka], ad)
            adim["kod"] = kod
            self.kodlar.add(kod)
        if tur not in ("kurumsal_kart", "kredi") and R.random() < 0.6:
            iban = iban_uret(R, kod_b)
            adim["iban"] = iban
            self.ibanlar.add(iban)
        dogru = False
        limit = 0
        if tur in TUR_102:
            S = self.tutar(20000, 600000, 0.4) if R.random() < 0.9 else 0
            if tur in HAVALE_TURLERI and R.random() < 0.3:
                limit = self.tutar(10000, 60000, 0)
                adim["kmhLimiti"] = tl(limit)
                if R.random() < 0.15:
                    S = -rh(limit, 2)   # KMH ile eksi açılış (limitin yarısı)
            dogru = R.random() < 0.6
            if dogru and S + limit < PAY:
                dogru = False
        elif tur == "kurumsal_kart":
            limit = self.tutar(20000, 150000, 0)
            adim["kartLimiti"] = tl(limit)
            S = R.choice([0, rh(limit, R.randint(3, 8))])
            dogru = R.random() < 0.5 and (limit - S) >= PAY
        else:  # kredi
            S = R.choice([0, self.tutar(50000, 500000, 0)])
        adim["acilisTarihi"] = tarih_metni(D)
        adim["acilisBakiyesi"] = ("-" + tl(-S)) if S < 0 else ("0" if S == 0 else tl(S, R))
        if dogru:
            adim["bakiyeDogrulandi"] = True
        elif R.random() < 0.5:
            adim["bakiyeDogrulandi"] = False
        kul_ok = kul
        self.ekle(self.kullanici_ekle(adim, kul_ok))
        delta = S if tur in TUR_102 else -S
        self.para[ad] = []
        if delta:
            self.para[ad].append((D, delta))
        self.hesaplar[ad] = {"tur": tur, "aktif": True, "dogrulandi": dogru, "politika": None, "limit": limit,
                             "acilis_tarihi": D, "acilis": delta, "ilk_hareket": None, "banka": banka}
        return ad

    # ─────────────────────────────────────────── yardımcı seçimler
    def cari_sec(self, tur, stil=None):
        c = [a for a, v in self.cariler.items() if v["tur"] == tur and (stil is None or v["stil"] == stil)]
        if not c:
            return None
        return self.R.choices(c, [self.cariler[a]["agirlik"] for a in c])[0]

    def hareket_kaydet(self, ad, **kw):
        kw.setdefault("silindi", False)
        kw.setdefault("ters", False)
        self.hareketler[ad] = kw

    def hesap_dokun(self, anahtarlar):
        pass

    def ilk_hareket(self, H):
        """Hesabın açılış dışındaki etkin satırlarının en erken tarihi (silinenler düşer, ters kayıtlar sayılır)."""
        v = self.hesaplar[H]
        satirlar = list(self.para[H])
        if v["acilis"]:
            satirlar.remove((v["acilis_tarihi"], v["acilis"]))
        return min((t for t, _ in satirlar), default=None)

    # ─────────────────────────────────────────── fatura
    def kalemler_kur(self, tur):
        R = self.R
        dahil = R.random() < 0.55
        oranlar = R.sample([1, 10, 20], R.choices([1, 2, 3], [7, 2, 1])[0])
        if 20 not in oranlar and R.random() < 0.6:
            oranlar[0] = 20
        kalemler, ozet = [], []
        stok_deg = {}
        for r in oranlar:
            k = {}
            if tur == "satis":
                adaylar = [u for u, v in self.urunler.items() if v["satilabilir"] and v["stok"] - stok_deg.get(u, 0) >= 1]
            else:
                adaylar = [u for u, v in self.urunler.items() if v["alinabilir"]]
            if adaylar and R.random() < 0.7:
                u = R.choice(adaylar)
                if tur == "satis":
                    q = R.randint(1, min(10, self.urunler[u]["stok"] - stok_deg.get(u, 0)))
                    stok_deg[u] = stok_deg.get(u, 0) + q
                else:
                    q = R.randint(1, 30)
                    stok_deg[u] = stok_deg.get(u, 0) - q
                k["urun"] = u
            else:
                k["hizmet"] = R.choice(HIZMETLER)
                q = R.randint(1, 5)
                u = None
            f = self.tutar(10, 8000, 0.5)
            p = 0
            if R.random() < 0.15:
                q = 1   # BELİRSİZ-13: iskontolu kalemde miktar 1 (stok değişimi aşağıda özetten yeniden hesaplanır)
                isk = R.choice(["5", "10", "12,5", "15", "20", "2,5"])
                if not (dahil and "iskonto_dahil" in self.notr):
                    k["iskontoOrani"] = isk
                    p = oran_bp(isk)
            k["miktar"] = q
            k["birimFiyat"] = tl(f, R)
            k["kdvOrani"] = r
            k["kdvDahil"] = dahil
            if tur == "alis" and "hizmet" in k:
                k["giderTuru"] = "Banka Masrafları"
            M, K, T = kalem_tutari(q, self.metinden(k["birimFiyat"]), r, dahil, p)
            kalemler.append(k)
            ozet.append({"n": len(kalemler), "urun": u, "q": q, "f": self.metinden(k["birimFiyat"]), "r": r,
                         "dahil": dahil, "p": p, "M": M, "K": K, "T": T})
        # iskonto miktar 1 düzeltmesi sonrası stok değişimini ozet'ten yeniden hesapla
        stok_deg = {}
        for o in ozet:
            if o["urun"] is not None:
                stok_deg[o["urun"]] = stok_deg.get(o["urun"], 0) + (o["q"] if tur == "satis" else -o["q"])
        if tur == "satis":
            for u, q in stok_deg.items():
                if self.urunler[u]["stok"] - q < 0:
                    return None
        return kalemler, ozet, stok_deg

    def odeme_satiri(self, yol, tutar, R):
        """(satır dict, para anahtarı) ya da None."""
        if yol == "nakit":
            return {"yol": "nakit", "tutar": tutar}, "KASA"
        sec = self.hesap_sec("havale" if yol == "havale" else "kart")
        if sec is None:
            return None
        ver, anahtar = sec
        s = {"yol": yol, "tutar": tutar}
        if ver is not None:
            s["hesap"] = ver
        return s, anahtar

    def op_fatura(self, tur, kasitli_fazla=False):
        R = self.R
        if tur == "satis":
            cari = self.cari_sec("musteri") if R.random() < 0.97 else self.cari_sec("tedarikci")
        else:
            cari = self.cari_sec("tedarikci") if R.random() < 0.97 else self.cari_sec("musteri")
        if cari is None:
            return False
        kur = self.kalemler_kur(tur)
        if kur is None:
            return False
        kalemler, ozet, stok_deg = kur
        T = sum(o["T"] for o in ozet)
        if T <= 0:
            return False
        ad = self.yeni_ad("F") if not kasitli_fazla else self.yeni_ad("Z")
        adim = {"islem": "fatura", "ad": ad, "tur": tur, "cari": cari, "kalemler": kalemler}
        pesin, etkiler, benzer = [], [], []
        taksit = None
        if kasitli_fazla:
            fazla = T + self.tutar(10, 2000)
            pesin.append({"yol": "nakit", "tutar": tl(fazla, R)})
            adim["odeme"] = {"pesin": pesin}
            if tur == "alis" and self.kasa_politika != "kontrol_yok":
                # Kasa'yı azaltacak; tek ihlal olsun diye Kasa yeterli olmalı (Σ peşin > T zaten 4xx)
                pass
            self.ekle(adim)
            return True
        secim = R.choices(["acik", "tam", "kismi", "taksit", "pesin_taksit", "coklu"], [30, 22, 14, 12, 8, 6] if tur == "satis"
                          else [40, 30, 20, 0, 0, 10])[0]
        yon = "giris" if tur == "satis" else "cikis"
        isaret = 1 if tur == "satis" else -1
        yollar = ["nakit", "havale"] + (["kart"] if tur == "alis" else [])
        agir = [4, 6] + ([2] if tur == "alis" else [])
        Pt = 0
        def yol_sec():
            y_ = R.choices(yollar, agir)[0]
            return "havale" if (y_ == "kart" and "kart" in self.notr) else y_
        if secim == "tam":
            yol = yol_sec()
            if R.random() < 0.5:
                sat = self.odeme_satiri(yol, "tamami", R)
            else:
                sat = self.odeme_satiri(yol, tl(T, R), R)
            if sat is None:
                return False
            pesin.append(sat[0])
            etkiler.append((sat[1], self.bugun, isaret * T))
            Pt = T
        elif secim in ("kismi", "pesin_taksit", "coklu"):
            n = 1 if secim != "coklu" else R.randint(2, 3)
            kalan = T
            for i in range(n):
                if kalan < 200:
                    break
                P = R.randint(1, max(1, kalan * 7 // 10))
                if P < 100:
                    P = min(100, kalan - 1)
                yol = yol_sec()
                if secim == "coklu" and i == n - 1 and R.random() < 0.5 and secim != "pesin_taksit":
                    sat = self.odeme_satiri(yol, "tamami", R)
                    P = kalan
                else:
                    sat = self.odeme_satiri(yol, tl(P, R), R)
                if sat is None:
                    return False
                pesin.append(sat[0])
                etkiler.append((sat[1], self.bugun, isaret * P))
                kalan -= P
                Pt += P
            if secim == "pesin_taksit":
                taksit = True
        elif secim == "taksit":
            taksit = True
        if taksit and tur == "satis":
            if T - Pt <= 0:
                return False
            kad = self.yeni_ad("K")
            sayi = R.choice([1, 2, 3, 3, 4, 6, 6, 9, 12])
            taksit = {"ad": kad, "sayi": sayi}
            if R.random() < 0.6:
                taksit["ilkVade"] = tarih_metni(self.bugun + datetime.timedelta(days=R.choice([7, 15, 30, 31, 45, 60])))
        else:
            taksit = None
        # Benzer havuzu (peşin satırları da havuza girer; K-5/K20) — kendileri ret almaz
        for (a, t, x), s in zip(etkiler, pesin):
            if a in self.hesaplar:
                benzer.append(self.benzer_anahtar(yon, s["yol"], a, cari, abs(x), self.bugun, ("fatura", ad)))
        # eksi bakiye (alış peşini azaltır)
        if tur == "alis":
            if self.eksi_sonuc(etkiler) != "ok":
                return False
        for s, (a, t, x) in zip(pesin, etkiler):
            if not self.acilis_tamam(a, self.bugun):
                return False
        odeme = {}
        if pesin:
            odeme["pesin"] = pesin
        if taksit:
            odeme["taksit"] = taksit
        if odeme:
            adim["odeme"] = odeme
        self.kimlik_ver(adim, 0.06)
        kul = "Y"
        self.ekle(adim)
        # durum
        self.uygula_etkiler(etkiler)
        self.hesap_dokun([a for a, t, x in etkiler])
        for b in benzer:
            self.benzer_ekle(b)
        for u, d in stok_deg.items():
            self.urunler[u]["stok"] -= d
            if tur == "satis":
                self.urunler[u]["satildi"] = True
            else:
                self.urunler[u]["alindi"] = True
        self.faturalar[ad] = {"tur": tur, "cari": cari, "T": T, "pesin": Pt, "bagli": 0, "iade_acik": 0,
                              "kalemler": ozet, "iade_q": {o["n"]: 0 for o in ozet}, "taksitli": bool(taksit),
                              "tarih": self.bugun, "iade": False}
        if taksit:
            self.kartlar[taksit["ad"]] = {"fatura": ad, "cari": cari, "toplam": T - Pt, "odenen": 0, "sayi": taksit["sayi"]}
        stok_yeter = tur != "satis" or all(self.urunler[u]["stok"] - d >= 0 for u, d in stok_deg.items())
        if "istekKimligi" in adim and R.random() < 0.5 and stok_yeter and "fatura_yineleme" not in self.notr:
            # aynı faturanın yeniden gönderilmesi (çift tıklama) → yinelenen. Fatura için `ad` zorunlu olduğundan yinelemeye
            # hiç anılmayan yeni bir ad (Z…) verilir; taksit kartı adı da öyle. (İki kâhin bu adın çıktıya yazılışında
            # ayrışıyor: K-4 / K4; bilinen ayrışma.)
            y = json.loads(json.dumps({k: v for k, v in adim.items() if k != "id"}))
            y["ad"] = self.yeni_ad("Z")
            if taksit:
                y["odeme"]["taksit"]["ad"] = self.yeni_ad("Z")
            self.ekle(y)
        return True

    # ─────────────────────────────────────────── iade
    def op_iade(self, kasitli_fazla=False):
        R = self.R
        adaylar = [a for a, f in self.faturalar.items() if f["tur"] in (("satis",) if kasitli_fazla else ("satis", "alis"))
                   and not f["taksitli"] and any(o["q"] - f["iade_q"][o["n"]] > 0 for o in f["kalemler"])]
        if not adaylar:
            return False
        if "iade" in self.notr and not kasitli_fazla:
            adaylar = [a for a in adaylar if self.cariler[self.faturalar[a]["cari"]]["stil"] == "bagli"]
            if not adaylar:
                return False
        fa = R.choice(adaylar)
        f = self.faturalar[fa]
        kal = [o for o in f["kalemler"] if o["q"] - f["iade_q"][o["n"]] > 0]
        R.shuffle(kal)
        kal = kal[:R.randint(1, len(kal))]
        satir, toplamM, toplamK, toplamT, stok = [], 0, 0, 0, {}
        for o in kal:
            kalan = o["q"] - f["iade_q"][o["n"]]
            q = R.randint(1, kalan)
            if kasitli_fazla:
                q = kalan + R.randint(1, 3)
            M, K, T = kalem_tutari(q, o["f"], o["r"], o["dahil"], o["p"])
            satir.append({"kalem": o["n"], "miktar": q})
            toplamT += T
            if o["urun"] is not None:
                stok[o["urun"]] = stok.get(o["urun"], 0) + (q if f["tur"] == "satis" else -q)
            if kasitli_fazla:
                break
        if f["tur"] == "alis" and not kasitli_fazla:
            for u, d in stok.items():
                if self.urunler[u]["stok"] + d < 0:
                    return False
        ad = self.yeni_ad("Z" if kasitli_fazla else "R")
        geri_yol = R.choices(["acik", "nakit", "havale"], [4, 3, 3])[0]
        if "iade" in self.notr and not kasitli_fazla:
            geri_yol = "acik"
            if self.kapasite(fa) < toplamT + 100:
                return False
        geri = {"yol": geri_yol}
        etkiler = []
        isaret = -1 if f["tur"] == "satis" else 1
        anahtar = None
        if geri_yol == "nakit":
            anahtar = "KASA"
        elif geri_yol == "havale":
            sec = self.hesap_sec("havale")
            if sec is None:
                return False
            ver, anahtar = sec
            if ver is not None:
                geri["hesap"] = ver
        if anahtar is not None:
            etkiler.append((anahtar, self.bugun, isaret * toplamT))
            if not self.acilis_tamam(anahtar, self.bugun):
                return False
        if not kasitli_fazla and self.eksi_sonuc(etkiler) != "ok":
            return False
        if kasitli_fazla and etkiler and self.eksi_sonuc(etkiler) not in ("ok",):
            geri = {"yol": "acik"}
        adim = {"islem": "iade", "ad": ad, "asilFatura": fa, "kalemler": satir, "geri": geri}
        self.ekle(adim)
        if kasitli_fazla:
            return True
        self.uygula_etkiler(etkiler)
        self.hesap_dokun([a for a, t, x in etkiler])
        if anahtar in self.hesaplar:
            yon = "cikis" if f["tur"] == "satis" else "giris"
            self.benzer_ekle(self.benzer_anahtar(yon, geri_yol, anahtar, f["cari"], toplamT, self.bugun, ("fatura", ad)))
        for o, s in zip(kal, satir):
            f["iade_q"][o["n"]] += s["miktar"]
        for u, d in stok.items():
            self.urunler[u]["stok"] += d
        f["iade"] = True
        if geri_yol == "acik":
            f["iade_acik"] += toplamT
        self.faturalar[ad] = {"tur": f["tur"] + "_iade", "cari": f["cari"], "T": toplamT, "pesin": 0, "bagli": 0,
                              "iade_acik": 0, "kalemler": [], "iade_q": {}, "taksitli": False, "tarih": self.bugun,
                              "iade": True}
        return True

    # ─────────────────────────────────────────── cari tahsilat / ödeme
    def kapasite(self, fa):
        f = self.faturalar[fa]
        return f["T"] - f["pesin"] - f["bagli"] - f["iade_acik"]

    def op_cari(self, yon):
        R = self.R
        tur = "musteri" if yon == "giris" else "tedarikci"
        if R.random() < 0.04:
            tur = "tedarikci" if tur == "musteri" else "musteri"   # karşı yön (BELİRSİZ-11 → belirsiz)
        cari = self.cari_sec(tur)
        if cari is None:
            return False
        stil = self.cariler[cari]["stil"]
        kf = None
        if stil == "bagli":
            belge_tur = ("satis", "alis_iade") if yon == "giris" else ("alis", "satis_iade")
            aday = [a for a, f in self.faturalar.items() if f["cari"] == cari and f["tur"] in belge_tur
                    and f["tur"] in ("satis", "alis") and not f["taksitli"] and self.kapasite(a) >= 100]
            if not aday:
                return False
            kf = R.choice(aday)
            kap = self.kapasite(kf)
            T = kap if R.random() < 0.45 else R.randint(100, kap)
        else:
            T = self.tutar(50, 30000, 0.5)
        if yon == "giris":
            yol = R.choices(["nakit", "havale"], [4, 6])[0]
            kul = self.kullanici(["Y", "MU", "PE"])
        else:
            yol = R.choices(["nakit", "havale", "kart"], [3, 6, 1.5])[0]
            if yol == "kart" and "kart" in self.notr:
                yol = "havale"
            kul = "Y" if yol == "nakit" else self.kullanici(["Y", "MU"])
        ham = None
        if R.random() < 0.03 and kf is None:
            # modül ucu: 3 ondalık → rh ile kuruşa (§6.2)
            binde = T * 10 + R.choice([1, 4, 5, 6, 9])
            ham = "%d,%03d" % divmod(binde, 1000)
            T = rh(binde, 10)
        anahtar = "KASA"
        ver = None
        if yol != "nakit":
            sec = self.hesap_sec("havale" if yol == "havale" else "kart")
            if sec is None:
                return False
            ver, anahtar = sec
        if not self.acilis_tamam(anahtar, self.bugun):
            return False
        etkiler = [(anahtar, self.bugun, T if yon == "giris" else -T)]
        if yon == "cikis":
            sonuc = self.eksi_sonuc(etkiler)
            if sonuc != "ok":
                return False
        islem = "cari_tahsilat" if yon == "giris" else "cari_odeme"
        adim = {"islem": islem}
        hareket_ad = self.yeni_ad("H") if R.random() < 0.75 else None
        if hareket_ad:
            adim["ad"] = hareket_ad
        adim["cari"] = cari
        if ham is not None:
            adim["tutarHam"] = ham
        else:
            adim["tutar"] = tl(T, R)
        adim["yol"] = yol
        if ver is not None:
            adim["hesap"] = ver
        if kf is not None:
            adim["kapatilacakFatura"] = kf
        bagli_hesap = anahtar in self.hesaplar
        bkey = None
        if bagli_hesap:
            bkey = self.benzer_anahtar(yon, yol, anahtar, cari, T, self.bugun, ("fatura", kf) if kf else "hedefsiz")
            durum = self.benzer_gerekli(bkey)
            if durum != "yok":
                adim["benzerOnay"] = True
        self.kimlik_ver(adim)
        self.kullanici_ekle(adim, kul)
        self.ekle(adim)
        self.uygula_etkiler(etkiler)
        self.hesap_dokun([anahtar])
        if bkey is not None:
            self.benzer_ekle(bkey)
        if kf is not None:
            self.faturalar[kf]["bagli"] += T
        if hareket_ad:
            self.hareket_kaydet(hareket_ad, islem=islem, kullanici=kul, etkiler=etkiler, tarih=self.bugun, kf=kf, tutar=T,
                                benzer=bkey, nakit_tipi=not bagli_hesap, hesaplar={anahtar} & set(self.hesaplar))
        # yineleme
        if "istekKimligi" in adim and "tutarHam" not in adim and R.random() < 0.6 and \
                (kf is None or self.kapasite(kf) >= T):
            farkli = kf is None and R.random() < 0.3
            self.yineleme_ekle(adim, farkli=farkli)
        # Benzer İşlem tekrarı (kasıtlı): aynı anahtarla ikinci satır
        if bkey is not None and self.benzer_acik and R.random() < 0.06 and "tutarHam" not in adim:
            kopya = {k: v for k, v in adim.items() if k not in ("id", "ad", "istekKimligi", "benzerOnay")}
            kap_ok = kf is None or self.kapasite(kf) >= T
            eksi_ok = yon == "giris" or self.eksi_sonuc(etkiler) == "ok"
            if kap_ok and eksi_ok:
                if R.random() < 0.5:
                    self.ekle(kopya)                 # 409 bank-similar (tek ihlal)
                else:
                    kopya["benzerOnay"] = True       # "Yine de Kaydet" gibi: ikinci etkin satır
                    self.ekle(kopya)
                    self.uygula_etkiler(etkiler)
                    self.benzer_ekle(bkey)
                    if kf is not None:
                        self.faturalar[kf]["bagli"] += T
        return True

    # ─────────────────────────────────────────── taksit tahsilatı
    def op_taksit(self):
        R = self.R
        aday = [k for k, v in self.kartlar.items() if v["toplam"] - v["odenen"] > 0]
        if not aday:
            return False
        k = R.choice(aday)
        kart = self.kartlar[k]
        kalan = kart["toplam"] - kart["odenen"]
        if R.random() < 0.35 or kalan < 200:
            T = kalan
        else:
            taksit = rh(kart["toplam"], kart["sayi"])
            T = min(kalan, max(100, taksit + R.randint(-taksit // 5, taksit // 5)))
        yol = R.choices(["nakit", "havale"], [4, 6])[0]
        anahtar, ver = "KASA", None
        if yol == "havale":
            sec = self.hesap_sec("havale")
            if sec is None:
                return False
            ver, anahtar = sec
        if not self.acilis_tamam(anahtar, self.bugun):
            return False
        kul = self.kullanici(["Y", "MU", "PE"])
        adim = {"islem": "taksit_tahsilat"}
        had = self.yeni_ad("H") if R.random() < 0.7 else None
        if had:
            adim["ad"] = had
        adim.update({"kart": k, "tutar": tl(T, R), "yol": yol})
        if ver is not None:
            adim["hesap"] = ver
        hedef = ("kart", k)
        if R.random() < 0.3:
            adim["taksitNo"] = R.randint(1, kart["sayi"])
            hedef = ("kart", k, adim["taksitNo"])
        bkey = None
        if anahtar in self.hesaplar:
            bkey = self.benzer_anahtar("giris", yol, anahtar, kart["cari"], T, self.bugun, hedef)
            if self.benzer_gerekli(bkey) != "yok":
                adim["benzerOnay"] = True
        self.kimlik_ver(adim, 0.08)
        self.kullanici_ekle(adim, kul)
        self.ekle(adim)
        etkiler = [(anahtar, self.bugun, T)]
        self.uygula_etkiler(etkiler)
        self.hesap_dokun([anahtar])
        kart["odenen"] += T
        if bkey:
            self.benzer_ekle(bkey)
        if had:
            self.hareket_kaydet(had, islem="taksit_tahsilat", kullanici=kul, etkiler=etkiler, tarih=self.bugun, kart=k,
                                tutar=T, benzer=bkey, nakit_tipi=anahtar not in self.hesaplar,
                                hesaplar={anahtar} & set(self.hesaplar))
        if "istekKimligi" in adim and R.random() < 0.5 and kart["toplam"] - kart["odenen"] >= T:
            self.yineleme_ekle(adim, farkli=False)
        return True

    # ─────────────────────────────────────────── Kasa
    def op_kasa_hareket(self):
        R = self.R
        yon = R.choices(["giris", "cikis"], [4, 6])[0]
        T = self.tutar(20, 8000, 0.5)
        etkiler = [("KASA", self.bugun, T if yon == "giris" else -T)]
        if yon == "cikis" and self.eksi_sonuc(etkiler) != "ok":
            return False
        had = self.yeni_ad("H") if R.random() < 0.6 else None
        adim = {"islem": "kasa_hareket"}
        if had:
            adim["ad"] = had
        adim.update({"yon": yon, "tutar": tl(T, R),
                     "aciklama": R.choice(KASA_GIRIS if yon == "giris" else KASA_CIKIS)})
        self.kimlik_ver(adim, 0.1)
        self.ekle(adim)
        self.uygula_etkiler(etkiler)
        if had:
            self.hareket_kaydet(had, islem="kasa_hareket", kullanici="Y", etkiler=etkiler, tarih=self.bugun, tutar=T,
                                benzer=None, nakit_tipi=True, hesaplar=set())
        if "istekKimligi" in adim and R.random() < 0.6:
            farkli = R.random() < 0.3
            if "kasa_yineleme" not in self.notr:
                self.yineleme_ekle(adim, farkli=farkli)
        return True

    def op_kasa_banka(self):
        R = self.R
        sec = self.hesap_sec("kasa_banka")
        if sec is None:
            return False
        ver, anahtar = sec
        yon = R.choice(["bankadan_kasaya", "kasadan_bankaya"])
        T = self.tutar(500, 40000, 0.3)
        if yon == "bankadan_kasaya":
            etkiler = [(anahtar, self.bugun, -T), ("KASA", self.bugun, T)]
        else:
            etkiler = [("KASA", self.bugun, -T), (anahtar, self.bugun, T)]
        if self.eksi_sonuc(etkiler) != "ok":
            return False
        if not self.acilis_tamam(anahtar, self.bugun):
            return False
        had = self.yeni_ad("H") if R.random() < 0.6 else None
        adim = {"islem": "kasa_banka"}
        if had:
            adim["ad"] = had
        adim["yon"] = yon
        if ver is not None:
            adim["hesap"] = ver
        adim["tutar"] = tl(T, R)
        if self.b4_gerekli([anahtar], T):
            adim["benzerOnay"] = True
        self.ekle(adim)
        self.uygula_etkiler(etkiler)
        self.hesap_dokun([anahtar])
        self.b4_ekle([anahtar], T)
        if had:
            self.hareket_kaydet(had, islem="kasa_banka", kullanici="Y", etkiler=etkiler, tarih=self.bugun, tutar=T,
                                benzer=None, nakit_tipi=anahtar not in self.hesaplar,
                                hesaplar={anahtar} & set(self.hesaplar))
        return True

    # ─────────────────────────────────────────── banka işlemleri
    def aktif(self, turler):
        return [a for a, h in self.hesaplar.items() if h["aktif"] and h["tur"] in turler]

    def fis_ekle(self, adim, etkiler, hesaplar, tutar, islem, ters_olur=True, kul="Y"):
        if self.b4_gerekli(hesaplar, tutar):
            adim["benzerOnay"] = True
        self.kullanici_ekle(adim, kul)
        self.ekle(adim)
        self.uygula_etkiler(etkiler)
        self.hesap_dokun(hesaplar)
        self.b4_ekle(hesaplar, tutar)
        if "ad" in adim:
            self.hareket_kaydet(adim["ad"], islem=islem, kullanici=kul, etkiler=etkiler, tarih=self.bugun, tutar=tutar,
                                benzer=None, nakit_tipi=False, hesaplar=set(hesaplar), ters_olur=ters_olur)

    def op_transfer(self):
        R = self.R
        h = self.aktif(TUR_102)
        if len(h) < 2:
            return False
        k, d = R.sample(h, 2)
        A = self.tutar(500, 80000, 0.4)
        adim = {"islem": "transfer"}
        if R.random() < 0.7:
            adim["ad"] = self.yeni_ad("H")
        adim.update({"kaynak": k, "hedef": d, "tutar": tl(A, R)})
        G = 0
        if R.random() < 0.4:
            U = self.tutar(1, 60, 0.8)
            v = R.choice(["bsmv_haric", "bsmv_dahil", "yok"])
            adim["ucret"] = tl(U, R)
            adim["ucretVergi"] = v
            G = U + rh(U * 5, 100) if v == "bsmv_haric" else U
        etkiler = [(d, self.bugun, A), (k, self.bugun, -(A + G))]
        if self.eksi_sonuc(etkiler) != "ok":
            return False
        if not (self.acilis_tamam(k, self.bugun) and self.acilis_tamam(d, self.bugun)):
            return False
        kul = self.kullanici(["Y", "MU"])
        self.kimlik_ver(adim, 0.08)
        self.fis_ekle(adim, etkiler, [k, d], A, "transfer", kul=kul)
        if "istekKimligi" in adim and R.random() < 0.5:
            farkli = R.random() < 0.3
            self.yineleme_ekle(adim, farkli=farkli, benzer_onay=not farkli)
        return True

    def op_banka_masraf(self):
        R = self.R
        vergi = R.choices(["bsmv_dahil", "bsmv_haric", "yok", "kdv_dahil", "kdv_haric"], [4, 3, 2, 2, 1])[0]
        kdv = vergi.startswith("kdv")
        h = self.aktif(HAVALE_TURLERI if kdv else TUR_102)
        if not h:
            return False
        H = R.choice(h)
        if "vadeli" in self.notr and self.hesaplar[H]["tur"] == "vadeli":
            h2 = [a for a in h if self.hesaplar[a]["tur"] != "vadeli"]
            if not h2:
                return False
            H = h2[0]
        U = self.tutar(2, 900, 0.8)
        adim = {"islem": "banka_masraf"}
        if R.random() < 0.6 and not kdv:
            adim["ad"] = self.yeni_ad("H")
        adim.update({"hesap": H, "tutar": tl(U, R), "masrafTuru": R.choice(MASRAF_TURLERI), "vergi": vergi})
        if vergi == "bsmv_haric":
            top = U + rh(U * 5, 100)
        elif vergi == "kdv_haric":
            r = 20
            if R.random() < 0.3:
                r = R.choice([1, 10, 20])
                adim["kdvOrani"] = r
            top = U + rh(U * r, 100)
        else:
            top = U
            if vergi == "kdv_dahil" and R.random() < 0.3:
                adim["kdvOrani"] = R.choice([1, 10, 20])
        if kdv:
            sag = self.cari_sec("tedarikci")
            if sag is None:
                return False
            adim["saglayici"] = sag
            adim["fatura"] = self.yeni_ad("G")
        etkiler = [(H, self.bugun, -top)]
        if self.eksi_sonuc(etkiler) != "ok" or not self.acilis_tamam(H, self.bugun):
            return False
        kul = "Y" if kdv else self.kullanici(["Y", "MU"])
        self.fis_ekle(adim, etkiler, [H], U, "banka_masraf", ters_olur=not kdv, kul=kul)
        if kdv:
            self.faturalar[adim["fatura"]] = {"tur": "masraf", "cari": adim["saglayici"], "T": top, "pesin": top,
                                              "bagli": 0, "iade_acik": 0, "kalemler": [], "iade_q": {},
                                              "taksitli": False, "tarih": self.bugun, "iade": False}
            self.benzer_ekle(self.benzer_anahtar("cikis", "havale", H, adim["saglayici"], top, self.bugun,
                                                 ("fatura", adim["fatura"])))
        return True

    def op_basit_fis(self, islem):
        R = self.R
        if islem == "faiz_geliri":
            h = self.aktif(TUR_102)
            if not h:
                return False
            vad = [a for a in h if self.hesaplar[a]["tur"] == "vadeli"]
            H = R.choice(vad) if vad and R.random() < 0.7 else R.choice(h)
            F = self.tutar(5, 9000, 0.7)
            st = R.choice(["0", "10", "15", "15", "2,5", "5"])
            S = rh(F * oran_bp(st), 10000)
            net = F - S
            if net <= 0:
                return False
            adim = {"islem": islem}
            if R.random() < 0.6:
                adim["ad"] = self.yeni_ad("H")
            adim.update({"hesap": H, "brut": tl(F, R), "stopajOrani": st})
            etkiler = [(H, self.bugun, net)]
            ana = F
            hes = [H]
        elif islem in ("faiz_gideri", "diger_gelir", "diger_gider"):
            h = self.aktif(TUR_102)
            if not h:
                return False
            H = R.choice(h)
            if "vadeli" in self.notr and self.hesaplar[H]["tur"] == "vadeli":
                h2 = [a for a in h if self.hesaplar[a]["tur"] != "vadeli"]
                if not h2:
                    return False
                H = h2[0]
            T = self.tutar(5, 6000, 0.6)
            adim = {"islem": islem}
            if R.random() < 0.6:
                adim["ad"] = self.yeni_ad("H")
            adim.update({"hesap": H, "tutar": tl(T, R)})
            etkiler = [(H, self.bugun, T if islem == "diger_gelir" else -T)]
            ana = T
            hes = [H]
        elif islem == "kart_borcu_odeme":
            kartlar = self.aktif(("kurumsal_kart",))
            kay = self.aktif(("vadesiz", "ticari"))
            if not kartlar or not kay:
                return False
            K, Kay = R.choice(kartlar), R.choice(kay)
            borc = -self.bakiye(K)
            T = self.tutar(100, 20000, 0.5) if borc < 10000 else R.randint(100, borc)
            adim = {"islem": islem}
            if R.random() < 0.6:
                adim["ad"] = self.yeni_ad("H")
            adim.update({"kaynak": Kay, "kart": K, "tutar": tl(T, R)})
            etkiler = [(Kay, self.bugun, -T), (K, self.bugun, T)]
            ana = T
            hes = [Kay, K]
        elif islem == "kredi_kullanim":
            kr = self.aktif(("kredi",))
            hd = self.aktif(("vadesiz", "ticari"))
            if not kr or not hd:
                return False
            K, Hd = R.choice(kr), R.choice(hd)
            T = self.tutar(5000, 200000, 0.2)
            adim = {"islem": islem}
            if R.random() < 0.6:
                adim["ad"] = self.yeni_ad("H")
            adim.update({"kredi": K, "hedef": Hd, "tutar": tl(T, R)})
            etkiler = [(Hd, self.bugun, T), (K, self.bugun, -T)]
            ana = T
            hes = [K, Hd]
        elif islem == "kredi_odeme":
            kr = self.aktif(("kredi",))
            ky = self.aktif(("vadesiz", "ticari"))
            if not kr or not ky:
                return False
            K, Ky = R.choice(kr), R.choice(ky)
            T = self.tutar(1000, 40000, 0.4)
            if "kredi" in self.notr:
                borc = -self.bakiye(K)
                if borc < 100000:
                    return False
                T = min(T, borc)
            adim = {"islem": islem}
            if R.random() < 0.6:
                adim["ad"] = self.yeni_ad("H")
            adim.update({"kredi": K, "kaynak": Ky, "anapara": tl(T, R)})
            faiz = 0
            if R.random() < 0.7:
                faiz = self.tutar(50, 5000, 0.6)
                adim["faiz"] = tl(faiz, R)
            etkiler = [(Ky, self.bugun, -(T + faiz)), (K, self.bugun, T)]
            ana = T
            hes = [K, Ky]
        else:
            raise ValueError(islem)
        if self.eksi_sonuc(etkiler) != "ok":
            return False
        if not all(self.acilis_tamam(a, self.bugun) for a in hes):
            return False
        kul = self.kullanici(["Y", "MU"])
        self.kimlik_ver(adim, 0.05)
        self.fis_ekle(adim, etkiler, hes, ana, islem, kul=kul)
        if "istekKimligi" in adim and R.random() < 0.5:
            self.yineleme_ekle(adim, farkli=False, benzer_onay=True)
        return True

    # ─────────────────────────────────────────── ters kayıt ve silme
    TERS_ISLEMLER = {"transfer", "banka_masraf", "faiz_geliri", "faiz_gideri", "diger_gelir", "diger_gider",
                     "kart_borcu_odeme", "kredi_kullanim", "kredi_odeme"}
    SIL_ISLEMLER = {"cari_tahsilat", "cari_odeme", "taksit_tahsilat", "kasa_banka"} | (
        set() if KASA_HAREKET_SILINMEZ else {"kasa_hareket"})

    def hesaplar_aktif(self, hesaplar):
        return all(self.hesaplar[a]["aktif"] for a in hesaplar if a in self.hesaplar)

    def op_ters(self, kasitli_iki=False):
        R = self.R
        if kasitli_iki:
            aday = [a for a, m in self.hareketler.items() if m["islem"] in self.TERS_ISLEMLER and m["ters"]
                    and m.get("ters_olur", True) and self.hesaplar_aktif(m["hesaplar"])]
        else:
            aday = [a for a, m in self.hareketler.items() if m["islem"] in self.TERS_ISLEMLER and not m["ters"]
                    and m.get("ters_olur", True) and self.hesaplar_aktif(m["hesaplar"])]
        if not aday:
            return False
        hedef = R.choice(aday)
        m = self.hareketler[hedef]
        ters = [(a, t, -x) for a, t, x in m["etkiler"]]
        if not kasitli_iki and self.eksi_sonuc(ters, d=m["tarih"]) != "ok":
            return False
        kul = self.kullanici(["Y", "MU"])
        adim = {"islem": "ters_kayit"}
        if R.random() < 0.3:
            adim["ad"] = self.yeni_ad("Z")
        adim["hedef"] = hedef
        self.kullanici_ekle(adim, kul)
        self.ekle(adim)
        if kasitli_iki:
            return True
        m["ters"] = True
        self.uygula_etkiler(ters)
        return True

    def op_sil(self, kasitli_iki=False):
        R = self.R
        if kasitli_iki:
            aday = [a for a, m in self.hareketler.items() if m["islem"] in self.SIL_ISLEMLER and m["silindi"]
                    and self.hesaplar_aktif(m["hesaplar"])]
        else:
            aday = [a for a, m in self.hareketler.items() if m["islem"] in self.SIL_ISLEMLER and not m["silindi"]
                    and self.hesaplar_aktif(m["hesaplar"])]
        if not aday:
            return False
        hedef = R.choice(aday)
        m = self.hareketler[hedef]
        ters = [(a, t, -x) for a, t, x in m["etkiler"]]
        if not kasitli_iki and self.eksi_sonuc(ters, d=m["tarih"]) != "ok":
            return False
        # yetki: hesaba bağlı → Y; nakit tipli → Y ya da kendi girdiyse PE
        if m["nakit_tipi"] and m["kullanici"] == "PE" and R.random() < 0.5:
            kul = "PE"
        else:
            kul = "Y"
        adim = {"islem": "sil", "hedef": hedef}
        self.kullanici_ekle(adim, kul)
        self.ekle(adim)
        if kasitli_iki:
            return True
        m["silindi"] = True
        self.geri_al_etkiler(m["etkiler"])
        if m.get("benzer") is not None:
            self.benzer_cikar(m["benzer"])
        if m.get("kf"):
            self.faturalar[m["kf"]]["bagli"] -= m["tutar"]
        if m.get("kart"):
            self.kartlar[m["kart"]]["odenen"] -= m["tutar"]
        return True

    # ─────────────────────────────────────────── hesap yönetimi
    def op_politika(self):
        R = self.R
        h = [a for a, v in self.hesaplar.items() if v["aktif"] and v["dogrulandi"]
             and v["tur"] in TUR_102 + ("kurumsal_kart",)]
        if not h:
            return False
        H = R.choice(h)
        simdi = self.hesaplar[H]["politika"] or "uyar"
        yeni = R.choice([p for p in ("uyar", "engelle", "kontrol_yok") if p != simdi])
        adim = self.kullanici_ekle({"islem": "hesap_eksi_politika", "hesap": H, "politika": yeni},
                                   self.kullanici(["Y", "MU"]))
        self.ekle(adim)
        self.hesaplar[H]["politika"] = yeni
        return True

    def op_hesap_durum(self):
        R = self.R
        pasifler = [a for a, v in self.hesaplar.items() if not v["aktif"]]
        if pasifler and R.random() < 0.7:
            H = R.choice(pasifler)
            self.ekle(self.kullanici_ekle({"islem": "hesap_durum", "hesap": H, "durum": "aktif"},
                                          self.kullanici(["Y", "MU"])))
            self.hesaplar[H]["aktif"] = True
            return True
        aktif = [a for a, v in self.hesaplar.items() if v["aktif"]]
        if len(aktif) < 2:
            return False
        H = R.choice(aktif)
        self.ekle(self.kullanici_ekle({"islem": "hesap_durum", "hesap": H, "durum": "pasif"},
                                      self.kullanici(["Y", "MU"])))
        self.hesaplar[H]["aktif"] = False
        return True

    def op_acilis_duzelt(self, kasitli_sonra=False):
        R = self.R
        h = [a for a, v in self.hesaplar.items() if v["aktif"] and v["tur"] in TUR_102]
        if kasitli_sonra:
            h = [a for a in h if self.ilk_hareket(a) is not None and self.ilk_hareket(a) < self.bugun]
        if not h:
            return False
        H = R.choice(h)
        v = self.hesaplar[H]
        ilk = self.ilk_hareket(H)
        if kasitli_sonra:
            # yeni açılış tarihi ilk hareketten sonra → 409 bank-opening-after-first (tek ihlal; tutar artar)
            D2 = ilk + datetime.timedelta(days=R.randint(1, (self.bugun - ilk).days))
            S2 = max(v["acilis"], 0) + self.tutar(100, 5000, 0)
            adim = {"islem": "acilis_duzelt", "hesap": H, "acilisTarihi": tarih_metni(D2), "acilisBakiyesi": tl(S2)}
            self.kullanici_ekle(adim, self.kullanici(["Y", "MU"]))
            self.ekle(adim)
            return True
        ust = ilk if ilk is not None and ilk < self.bugun else self.bugun
        D2 = ust - datetime.timedelta(days=R.randint(0, 10))
        S2 = v["acilis"] + R.choice([1, 1, 1, -1]) * self.tutar(100, 20000, 0.3)
        if S2 < 0 and (v["tur"] not in HAVALE_TURLERI or -S2 > v["limit"] // 2):
            S2 = abs(S2)
        if S2 == 0:
            S2 = 100000
        satirlar = list(self.para[H])
        if v["acilis"]:
            satirlar.remove((v["acilis_tarihi"], v["acilis"]))
        yeni = satirlar + [(D2, S2)]
        yeni_dogru = (not v["dogrulandi"]) and R.random() < 0.4
        if v["dogrulandi"] or yeni_dogru:
            en = self.en_dusuk_sonra(H, yeni, D2) + v["limit"]
            if en < PAY:
                if v["dogrulandi"]:
                    return False   # K-6: düzeltme sonrası denetim ihlal gösterirdi → kurulmaz
                yeni_dogru = False
        adim = {"islem": "acilis_duzelt", "hesap": H, "acilisTarihi": tarih_metni(D2),
                "acilisBakiyesi": ("-" + tl(-S2)) if S2 < 0 else tl(S2, R)}
        if yeni_dogru:
            adim["bakiyeDogrulandi"] = True
        self.kullanici_ekle(adim, self.kullanici(["Y", "MU"]))
        self.ekle(adim)
        self.para[H] = yeni
        v["acilis"] = S2
        v["acilis_tarihi"] = D2
        if yeni_dogru:
            v["dogrulandi"] = True
        return True

    def op_ayar(self):
        R = self.R
        if R.random() < 0.7:
            yeni = R.choice([p for p in ("uyar", "engelle", "kontrol_yok") if p != self.kasa_politika])
            self.ekle({"islem": "ayar", "kasaEksiBakiye": yeni})
            self.kasa_politika = yeni
        else:
            self.benzer_acik = not self.benzer_acik
            self.ekle({"islem": "ayar", "benzerIslemUyarisi": "acik" if self.benzer_acik else "kapali"})
        return True

    def op_stok_giris(self):
        R = self.R
        u = [a for a in self.urunler]
        if not u:
            return False
        U = R.choice(u)
        q = R.randint(5, 60)
        self.ekle({"islem": "stok_giris", "urun": U, "miktar": q})
        self.urunler[U]["stok"] += q
        return True

    # ─────────────────────────────────────────── kasıtlı retler
    def op_ret(self):
        R = self.R
        cesit = R.choice(["yetki", "ileri_tarih", "hesap_gerekli", "hesap_gecersiz", "kaynak_hedef", "ham3",
                          "pesin_fazla", "iade_fazla", "sil_iki", "ters_iki", "eksi_kasa", "eksi_banka",
                          "iban_bozuk", "iban_ayni", "kod_ayni", "acilis_oncesi", "acilis_sonra", "kredi_odeme_hesap",
                          "kart_yanlis_hesap", "benzer"])
        return getattr(self, "ret_" + cesit)()

    def ret_yetki(self):
        R = self.R
        sec = R.choice(["odeme", "transfer", "kasa_banka", "masraf", "ters", "sil", "hesap_ac"])
        if sec == "odeme":
            ted = self.cari_sec("tedarikci", "bagsiz")
            if ted is None:
                return False
            s = self.hesap_sec("havale", 0.5)
            adim = {"islem": "cari_odeme", "cari": ted, "tutar": tl(self.tutar(10, 500, 0.5)), "yol": "havale"}
            if s and s[0]:
                adim["hesap"] = s[0]
        elif sec == "transfer":
            h = self.aktif(TUR_102)
            if len(h) < 2:
                return False
            k, d = self.R.sample(h, 2)
            adim = {"islem": "transfer", "kaynak": k, "hedef": d, "tutar": tl(self.tutar(10, 300))}
        elif sec == "kasa_banka":
            s = self.hesap_sec("kasa_banka")
            if s is None:
                return False
            adim = {"islem": "kasa_banka", "yon": "kasadan_bankaya", "tutar": tl(self.tutar(10, 100))}
            if s[0]:
                adim["hesap"] = s[0]
        elif sec == "masraf":
            h = self.aktif(TUR_102)
            if not h:
                return False
            adim = {"islem": "banka_masraf", "hesap": R.choice(h), "tutar": tl(self.tutar(2, 50)), "masrafTuru": "EFT",
                    "vergi": "yok"}
        elif sec == "ters":
            aday = [a for a, m in self.hareketler.items() if m["islem"] in self.TERS_ISLEMLER and not m["ters"]
                    and m.get("ters_olur", True) and self.hesaplar_aktif(m["hesaplar"])]
            if not aday:
                return False
            adim = {"islem": "ters_kayit", "hedef": R.choice(aday)}
        elif sec == "sil":
            aday = [a for a, m in self.hareketler.items() if m["islem"] in self.SIL_ISLEMLER and not m["silindi"]
                    and not m["nakit_tipi"] and self.hesaplar_aktif(m["hesaplar"])]
            if not aday:
                return False
            adim = {"islem": "sil", "hedef": R.choice(aday)}
        else:
            banka, kod = R.choice(BANKALAR)
            adim = {"islem": "hesap_ac", "ad": self.yeni_ad("Z"), "banka": banka, "hesapAdi": "Yetkisiz Hesap",
                    "tur": "vadesiz", "paraBirimi": "TRY", "acilisTarihi": tarih_metni(self.bugun),
                    "acilisBakiyesi": "1000"}
        # BELİRSİZ-4: aynı gün/hesap/tutarlı önceki banka işlemi varsa benzerOnay (ret de olsa kâhinler ister)
        if adim["islem"] in ("transfer", "banka_masraf", "kasa_banka"):
            hes = [adim[k] for k in ("kaynak", "hedef", "hesap") if k in adim]
            if adim["islem"] == "kasa_banka" and not hes:
                hes = ["102.00"]
            if self.b4_gerekli(hes, self.metinden(adim["tutar"])):
                adim["benzerOnay"] = True
        adim["kullanici"] = "PE"
        self.ekle(adim)
        return True

    def ret_ileri_tarih(self):
        R = self.R
        c = self.cari_sec("musteri", "bagsiz")
        if c is None:
            return False
        ileri = sonraki_is_gunu(self.bugun, R.randint(1, 5))
        self.ekle({"islem": "cari_tahsilat", "tarih": tarih_metni(ileri), "cari": c,
                   "tutar": tl(self.tutar(10, 900)), "yol": "nakit"})
        return True

    def ret_hesap_gerekli(self):
        if len(self.uygunlar("havale")) < 2:
            return False
        c = self.cari_sec("musteri", "bagsiz")
        if c is None:
            return False
        self.ekle({"islem": "cari_tahsilat", "cari": c, "tutar": tl(self.tutar(10, 900)), "yol": "havale"})
        return True

    def ret_hesap_gecersiz(self):
        R = self.R
        gecersiz = [a for a, h in self.hesaplar.items() if not h["aktif"] or h["tur"] in ("vadeli", "kurumsal_kart")]
        if not gecersiz:
            return False
        c = self.cari_sec("musteri", "bagsiz")
        if c is None:
            return False
        self.ekle({"islem": "cari_tahsilat", "cari": c, "tutar": tl(self.tutar(10, 900)), "yol": "havale",
                   "hesap": R.choice(gecersiz)})
        return True

    def ret_kaynak_hedef(self):
        h = self.aktif(TUR_102)
        if not h:
            return False
        H = self.R.choice(h)
        T = self.tutar(10, 900)
        adim = {"islem": "transfer", "kaynak": H, "hedef": H, "tutar": tl(T)}
        if self.b4_gerekli([H], T):
            adim["benzerOnay"] = True
        self.ekle(adim)
        return True

    def ret_ham3(self):
        """Banka ucunda ham tutar: 3 ondalık, sıfır ya da eksi → 400 (§6.2)."""
        R = self.R
        h = self.aktif(TUR_102)
        if not h:
            return False
        H = R.choice(h)
        cesit = R.choices(["uc", "sifir", "eksi"], [7, 1.5, 1.5])[0]
        if cesit == "uc":
            ham = "%d,%02d%d" % (R.randint(1, 300), R.randint(0, 99), R.randint(1, 9))
        elif cesit == "sifir":
            ham = R.choice(["0", "0,00"])
        else:
            ham = "-%d,%02d" % (R.randint(1, 300), R.randint(0, 99))
        sec = R.choice(["masraf", "gider", "gelir"])
        if sec == "masraf":
            adim = {"islem": "banka_masraf", "hesap": H, "tutarHam": ham, "masrafTuru": "Diğer", "vergi": "yok"}
        elif sec == "gider":
            adim = {"islem": "faiz_gideri", "hesap": H, "tutarHam": ham}
        else:
            adim = {"islem": "diger_gelir", "hesap": H, "tutarHam": ham}
        self.ekle(adim)
        return True

    def ret_pesin_fazla(self):
        return self.op_fatura("satis", kasitli_fazla=True)

    def ret_iade_fazla(self):
        return self.op_iade(kasitli_fazla=True)   # yalnız satış faturasında (alıştan iadede stok eksiye düşerdi)

    def ret_sil_iki(self):
        return self.op_sil(kasitli_iki=True)

    def ret_ters_iki(self):
        return self.op_ters(kasitli_iki=True)

    def ret_eksi_kasa(self):
        R = self.R
        if self.kasa_politika == "kontrol_yok":
            return False
        bak = self.bakiye("KASA")
        T = max(bak, 0) + self.tutar(600, 5000, 0.3)
        etkiler = [("KASA", self.bugun, -T)]
        sonuc = self.eksi_sonuc(etkiler)
        if sonuc not in ("uyar", "engelle"):
            return False
        adim = {"islem": "kasa_hareket", "yon": "cikis", "tutar": tl(T, R), "aciklama": R.choice(KASA_CIKIS)}
        gec = sonuc == "uyar" and R.random() < 0.35
        if gec:
            # "Yine de Kaydet": Uyar geçilir, Kasa eksiye düşer (geçerli işlem)
            adim["yineDeKaydet"] = True
            had = self.yeni_ad("H")
            adim = dict([("islem", "kasa_hareket"), ("ad", had)] + [(k, v) for k, v in adim.items() if k != "islem"])
            self.ekle(adim)
            self.uygula_etkiler(etkiler)
            self.hareket_kaydet(had, islem="kasa_hareket", kullanici="Y", etkiler=etkiler, tarih=self.bugun, tutar=T,
                                benzer=None, nakit_tipi=True, hesaplar=set())
            return True
        self.ekle(adim)
        return True

    def ret_eksi_banka(self):
        R = self.R
        h = [a for a, v in self.hesaplar.items() if v["aktif"] and v["dogrulandi"] and v["tur"] in HAVALE_TURLERI
             and (v["politika"] or "uyar") != "kontrol_yok"]
        if not h:
            return False
        H = R.choice(h)
        u = self.uygunlar("havale")
        ted = self.cari_sec("tedarikci", "bagsiz")
        if ted is None:
            return False
        bak = self.bakiye(H) + self.hesaplar[H]["limit"]
        T = max(bak, 0) + self.tutar(600, 20000, 0.3)
        etkiler = [(H, self.bugun, -T)]
        sonuc = self.eksi_sonuc(etkiler)
        if sonuc not in ("uyar", "engelle"):
            return False
        kul = self.kullanici(["Y", "MU"])
        adim = {"islem": "cari_odeme", "cari": ted, "tutar": tl(T, R), "yol": "havale"}
        if len(u) > 1 or R.random() < 0.5:
            adim["hesap"] = H
        bkey = self.benzer_anahtar("cikis", "havale", H, ted, T, self.bugun, "hedefsiz")
        if self.benzer_gerekli(bkey) != "yok":
            return False
        gec = sonuc == "uyar" and R.random() < 0.35
        if gec:
            had = self.yeni_ad("H")
            adim = dict([("islem", "cari_odeme"), ("ad", had)] + [(k, v) for k, v in adim.items() if k != "islem"])
            adim["yineDeKaydet"] = True
            self.kullanici_ekle(adim, kul)
            self.ekle(adim)
            self.uygula_etkiler(etkiler)
            self.hesap_dokun([H])
            self.benzer_ekle(bkey)
            self.hareket_kaydet(had, islem="cari_odeme", kullanici=kul, etkiler=etkiler, tarih=self.bugun, kf=None,
                                tutar=T, benzer=bkey, nakit_tipi=False, hesaplar={H})
            return True
        self.kullanici_ekle(adim, kul)
        self.ekle(adim)
        return True

    def ret_iban_bozuk(self):
        R = self.R
        banka, kod = R.choice(BANKALAR)
        self.ekle({"islem": "hesap_ac", "ad": self.yeni_ad("Z"), "banka": banka, "hesapAdi": "Hatalı IBAN",
                   "tur": "vadesiz", "paraBirimi": "TRY", "iban": iban_bozuk(iban_uret(R, kod)),
                   "acilisTarihi": tarih_metni(self.bugun), "acilisBakiyesi": "1000"})
        return True

    def ret_iban_ayni(self):
        R = self.R
        if not self.ibanlar:
            return False
        banka, kod = R.choice(BANKALAR)
        self.ekle({"islem": "hesap_ac", "ad": self.yeni_ad("Z"), "banka": banka, "hesapAdi": "Aynı IBAN",
                   "tur": "vadesiz", "paraBirimi": "TRY", "iban": R.choice(sorted(self.ibanlar)),
                   "acilisTarihi": tarih_metni(self.bugun), "acilisBakiyesi": "1000"})
        return True

    def ret_kod_ayni(self):
        R = self.R
        if not self.kodlar:
            return False
        banka, kod = R.choice(BANKALAR)
        self.ekle({"islem": "hesap_ac", "ad": self.yeni_ad("Z"), "banka": banka, "hesapAdi": "Aynı Kod",
                   "tur": "vadesiz", "paraBirimi": "TRY", "kod": R.choice(sorted(self.kodlar)),
                   "acilisTarihi": tarih_metni(self.bugun), "acilisBakiyesi": "1000"})
        return True

    def ret_acilis_oncesi(self):
        """Bugün açılışlı yeni hesap; aynı gün önceki iş gününe tarihli havale tahsilatı → bank-before-opening."""
        R = self.R
        c = self.cari_sec("musteri", "bagsiz")
        if c is None:
            return False
        H = self.hesap_ac(R.choice(["vadesiz", "ticari"]), acilis_gun=self.bugun)
        once = onceki_is_gunu(self.bugun)
        adim = {"islem": "cari_tahsilat", "tarih": tarih_metni(once), "cari": c, "tutar": tl(self.tutar(10, 900)),
                "yol": "havale", "hesap": H}
        self.ekle(adim)
        return True

    def ret_acilis_sonra(self):
        return self.op_acilis_duzelt(kasitli_sonra=True)

    def ret_kredi_odeme_hesap(self):
        kr = [a for a, h in self.hesaplar.items() if h["tur"] == "kredi" and h["aktif"]]
        ted = self.cari_sec("tedarikci", "bagsiz")
        if not kr or ted is None:
            return False
        self.ekle({"islem": "cari_odeme", "cari": ted, "tutar": tl(self.tutar(10, 900)), "yol": "havale",
                   "hesap": self.R.choice(kr)})
        return True

    def ret_kart_yanlis_hesap(self):
        if "kart" in self.notr:
            return False
        h = self.aktif(HAVALE_TURLERI)
        ted = self.cari_sec("tedarikci", "bagsiz")
        if not h or ted is None:
            return False
        self.ekle({"islem": "cari_odeme", "cari": ted, "tutar": tl(self.tutar(10, 900)), "yol": "kart",
                   "hesap": self.R.choice(h)})
        return True

    def ret_benzer(self):
        """Aynı gün, aynı hesap/cari/tutar/hedefli hesaba bağlı tahsilatın ikincisi (benzerOnay yok) → 409."""
        if not self.benzer_acik:
            return False
        aday = [(k, n) for k, n in self.benzer_havuz.items() if n > 0 and k[5] == self.bugun and k[0] == "giris"
                and k[6] == "hedefsiz" and k[1] == "havale"]
        if not aday:
            return False
        (yon, yol, hesap, cari, tutar, tarih, hedef), _ = self.R.choice(sorted(aday, key=repr))
        adim = {"islem": "cari_tahsilat", "cari": cari, "tutar": tl(tutar), "yol": "havale"}
        if len(self.uygunlar("havale")) > 1 or self.R.random() < 0.5:
            adim["hesap"] = hesap
        if hesap not in self.uygunlar("havale"):
            return False
        self.ekle(adim)
        return True

    # ─────────────────────────────────────────── eşzamanlı grup
    def op_eszamanli(self):
        R = self.R
        g = "g%d" % self.sayac
        if R.random() < 0.5:
            # iki tahsilat, iki ayrı cari, iki kullanıcı → ikisi de geçer
            cs = [a for a, v in self.cariler.items() if v["tur"] == "musteri" and v["stil"] == "bagsiz"]
            if len(cs) < 2:
                return False
            c1, c2 = R.sample(cs, 2)
            for c, kul in ((c1, "Y"), (c2, "MU")):
                T = self.tutar(50, 5000, 0.5)
                adim = {"islem": "cari_tahsilat", "cari": c, "tutar": tl(T, R), "yol": "nakit", "ayniAnda": g}
                self.kullanici_ekle(adim, kul)
                self.ekle(adim)
                self.uygula_etkiler([("KASA", self.bugun, T)])
            return True
        # yarış: aynı doğrulanmış hesaptan eşit iki ödeme; yalnız biri sığar (§12.5 adım 37)
        h = [a for a, v in self.hesaplar.items() if v["aktif"] and v["dogrulandi"] and v["tur"] in HAVALE_TURLERI
             and (v["politika"] or "uyar") in ("engelle", "uyar")]
        ts = [a for a, v in self.cariler.items() if v["tur"] == "tedarikci" and v["stil"] == "bagsiz"]
        if not h or len(ts) < 2:
            return False
        H = R.choice(h)
        m = min(self.bakiye(H, self.bugun), self.bakiye(H)) + self.hesaplar[H]["limit"]
        # tek ödeme sonrası ≥ PAY, iki ödeme sonrası ≤ −PAY: X ∈ [ (m+PAY)/2 , m−PAY ]
        alt, ust = (m + PAY) // 2 + 100, m - PAY
        if ust - alt < 1000:
            return False
        X = R.randint(alt, ust)
        t1, t2 = R.sample(ts, 2)
        for c, kul in ((t1, "Y"), (t2, "MU")):
            adim = {"islem": "cari_odeme", "cari": c, "tutar": tl(X), "yol": "havale", "hesap": H, "ayniAnda": g}
            self.kullanici_ekle(adim, kul)
            self.ekle(adim)
        self.uygula_etkiler([(H, self.bugun, -X)])
        self.hesap_dokun([H])
        # hangi carinin ödendiği belirsiz → bu iki cari bundan sonra yalnız bağsız kalır (zaten bağsız)
        self.b_yaris = True
        return True

    # ─────────────────────────────────────────── ana döngü
    def gun_ilerlet(self):
        R = self.R
        n = R.choices([1, 1, 1, 2, 3, 5, 15, 25], [40, 10, 10, 15, 10, 8, 4, 3])[0]
        yeni = sonraki_is_gunu(self.bugun, n)
        self.bugun = yeni
        self.ekle({"islem": "saat", "bugun": tarih_metni(yeni)}, islem_say=False)

    def uret(self):
        R = self.R
        self.kurulus()
        gec_gun = R.randint(2, 8) if self.gec_hesap else None
        gun_no = 0
        islemler = list(self.agirlik)
        while self.islem_sayisi < self.hedef_islem:
            gun_no += 1
            if gec_gun is not None and gun_no >= gec_gun:
                self.banka_kurulusu()
                gec_gun = None
            k = R.choices([1, 2, 3, 4, 5, 6, 8, 10], [8, 12, 15, 15, 12, 10, 6, 3])[0]
            for _ in range(k):
                if self.islem_sayisi >= self.hedef_islem:
                    break
                for _deneme in range(12):
                    op = R.choices(islemler, [self.agirlik[o] for o in islemler])[0]
                    if self.calistir(op):
                        break
                if self.islem_sayisi - self.son_kontrol >= self.kontrol_araligi:
                    self.kontrol()
            if self.eszamanli and self.grup_sayisi < 3 and R.random() < 0.06 and self.islem_sayisi < self.hedef_islem - 2:
                if self.op_eszamanli():
                    self.grup_sayisi += 1
            if self.islem_sayisi < self.hedef_islem:
                self.gun_ilerlet()
        return {
            "dil": DIL,
            "ad": "rastgele-%d-%d" % (self.tohum, self.hedef_islem) + ("-notr" if self.notr else ""),
            "aciklama": ("uretici.py ile tohum %d'den üretildi (%d işlem, kontrol aralığı %d). Gerçekçi sıra, kasıtlı "
                         "retler, istek kimliği yinelemeleri%s.%s" % (
                             self.tohum, self.hedef_islem, self.kontrol_araligi,
                             ", eşzamanlı gruplar" if self.eszamanli else "",
                             (" Nötrleştirilmiş: " + ", ".join(sorted(self.notr)) + ".") if self.notr else "")),
            "dayanak": "SENARYO-DILI §3–§13 (rastgele senaryo)",
            "baslangic": {
                "bugun": tarih_metni(self.baslangic),
                "sirket": "bos",
                "ayarlar": {"kasaEksiBakiye": self.ilk_kasa_politika,
                            "benzerIslemUyarisi": "acik" if self.ilk_benzer else "kapali"},
                "kullanicilar": {"Y": "yonetici", "MU": "muhasebe", "PE": "personel"},
            },
            "adimlar": self.adimlar,
        }

    def calistir(self, op):
        if op == "satis":
            return self.op_fatura("satis")
        if op == "alis":
            return self.op_fatura("alis")
        if op == "iade":
            return self.op_iade()
        if op == "tahsilat":
            return self.op_cari("giris")
        if op == "odeme":
            return self.op_cari("cikis")
        if op == "taksit_tahsilat":
            return self.op_taksit()
        if op == "kasa_hareket":
            return self.op_kasa_hareket()
        if op == "kasa_banka":
            return self.op_kasa_banka()
        if op == "transfer":
            return self.op_transfer()
        if op == "banka_masraf":
            return self.op_banka_masraf()
        if op in ("faiz_geliri", "faiz_gideri", "diger_gelir", "diger_gider", "kredi_kullanim", "kredi_odeme"):
            return self.op_basit_fis(op)
        if op == "kart_borcu":
            return self.op_basit_fis("kart_borcu_odeme")
        if op == "ters_kayit":
            return self.op_ters()
        if op == "sil":
            return self.op_sil()
        if op == "politika":
            return self.op_politika()
        if op == "hesap_durum":
            return self.op_hesap_durum()
        if op == "acilis_duzelt":
            return self.op_acilis_duzelt()
        if op == "ayar":
            return self.op_ayar()
        if op == "yeni_hesap":
            if len(self.hesaplar) >= 9:
                return False
            tur = self.R.choices(["vadesiz", "ticari", "diger", "vadeli", "kurumsal_kart", "kredi"], [5, 2, 1, 1, 1, 1])[0]
            self.hesap_ac(tur, kul=self.kullanici(["Y", "MU"]))
            return True
        if op == "yeni_cari":
            self.yeni_cari(self.R.choice(["musteri", "musteri", "tedarikci"]))
            return True
        if op == "stok_giris":
            return self.op_stok_giris()
        if op == "ret":
            return self.op_ret()
        raise ValueError(op)


def uret(tohum, islem=500, kontrol_araligi=25, eszamanli=None, notr=()):
    u = Uretec(tohum, islem, kontrol_araligi, eszamanli, notr)
    u.ilk_kasa_politika = u.kasa_politika
    u.ilk_benzer = u.benzer_acik
    return u.uret()


def main(argv):
    ap = argparse.ArgumentParser(description="Rastgele senaryo üreteci (destekofis-senaryo/1)")
    ap.add_argument("--tohum", type=int, required=True)
    ap.add_argument("--islem", type=int, default=500)
    ap.add_argument("--kontrol", type=int, default=25, help="kaç işlemde bir kontrol adımı")
    ap.add_argument("--cikti", default=None)
    ap.add_argument("--notr", default="", help="virgülle: iskonto_dahil,kasa_acilis,kart,fatura_yineleme")
    a = ap.parse_args(argv[1:])
    if not 1 <= a.islem <= 100000:
        ap.error("islem 1..100000")
    sen = uret(a.tohum, a.islem, a.kontrol, notr=[x for x in a.notr.split(",") if x])
    yol = a.cikti or os.path.join(os.path.dirname(os.path.abspath(__file__)), "cikti", "senaryolar", sen["ad"] + ".json")
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    with open(yol, "w", encoding="utf-8") as fh:
        json.dump(sen, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    sys.stdout.write("%s\n" % yol)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
