#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WhatsApp toplu gönderim KÂHİNİ — DestekOfis 2.4.8 K0 (temiz oda; yalnız standart kütüphane).

Kaynak YALNIZ plan: docs/erp/WHATSAPP-API-PLANI-2.4.8.md (§1, §2.2–§2.7, §3, §4, §6 W2–W6, §7a NETLEŞTİRMELER 1–32, §8, §11 S1–S4 = A).
Programın kodu (server/, client/, bulut/) GÖRÜLMEDİ. Meta davranışı (kanca biçimi, "read, delivered'ı içerir", 7 gün yeniden deneme)
Meta belgesinden. İlk sürümde planın sustuğu 15 nokta "serbest seçim"di; plan §7a (30.10.2026; K1–K3 ürün sahibi, öbürleri baş mimar
kararı + ürün sahibi "önerilerin uygun") hepsini kararlaştırdı → SERBEST artık BOŞ, her kural sabit (kaynak satırında "§7a n").
Revizyon R1–R3 (30.10.2026 15:18 UTC, plan §7a sonu): R1 Meta'ya hiç ulaşılamıyorsa "Bağlantı Bekleniyor" (Başarısız değil, deneme sayacı
artmaz, bağlantı dönünce kendiliğinden sürer); R2 şablon kategorisi her 100 iletide ve en geç 10 dakikada bir okunur; R3 aynı cari + şablon + dönem
daha önce gönderilmişse uyarı, varsayılan "Bunları Çıkar", açık "Yine de Gönder" bayrağıyla gider.
§7a metninin yine yoruma açık bıraktığı ayrıntılar README "Kâhin yorumları"nda listelidir.

Planın uygulamaya bıraktığı tek serbestlik işçinin adım süresi ("~1 sn"): İKİ UÇLA koşulur (hızlı 0,5 sn, yavaş 5 sn). Sıra artık plan
kuralı (§7a 5: seçim sırası). İki koşuda aynı çıkan değer KESİN; ayrışan değer {"biri": [...]} olur (program bunlardan birini vermeli).

Komut satırı:
  python3 -I kahin.py hesapla senaryo.json
  python3 -I kahin.py karsilastir beklenen.json program.json
"""
import copy
import heapq
import itertools
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

SN = 1000
DK = 60 * SN
SA = 60 * DK
GUN = 24 * SA
TR = timezone(timedelta(hours=3))   # §7a 19 "Türkiye saati" (UTC+3, yaz saati yok)

# Plan §6 W2 + §7a ekran durumları (adlar AYNEN plandan)
BEKLIYOR = "Bekliyor"
HAZIRLANIYOR = "Hazırlanıyor"
GONDERILIYOR = "Gönderiliyor"
KABUL = "Meta Kabul Etti"
GONDERILDI = "Gönderildi"
TESLIM = "Teslim Edildi"
OKUNDU = "Okundu"
BASARISIZ = "Başarısız"
BELIRSIZ = "Sonucu Belirsiz"
SINIR = "Sınır Nedeniyle Bekliyor"
DURAKLATILDI = "Duraklatıldı"
IPTAL = "İptal"
SURESI_DOLDU = "Süresi Doldu"
LISANS = "Lisans Nedeniyle Durdu"                     # §4, §7a 25
TASINAN = "Taşınan Veri — Durduruldu"                 # §6 W2
DURDU_GERI_YUKLEME = "Durduruldu (Geri Yükleme)"      # §7a 26
ATLANDI = "Atlandı"                                   # §7a 2
BEKLEME_131049 = "Meta Bekletti (24 Saat Sonra Yeniden)"   # §7a 14
SORULUYOR = "PLAN-SUSUYOR:24-saatten-eski-devam-sorusu"    # §7a 24 "açılışta sorulur" — iş durumu adı verilmedi
SABLON_PAZARLAMA = "Şablon Pazarlama'ya Alındı"       # §7a 27 (toplu işin durma nedeni)
BAGLANTI = "BAGLANTI"                                 # bağlantı kurulamadı (§7a 11) — Meta kodu yok; kâhinin iç etiketi (yalnız M61'de iş koduna yazılır)
BAGLANTI_BEKLENIYOR = "Bağlantı Bekleniyor"           # §7a R1: Meta'ya hiç ulaşılamıyorsa toplu işin durma nedeni
DAHA_ONCE = "daha_once_gonderildi"                    # §7a R3: elenme nedeni ("Daha Önce Gönderildi")

SIRA = {KABUL: 1, GONDERILDI: 2, TESLIM: 3, OKUNDU: 4}
GONDERILMIS = {KABUL, GONDERILDI, TESLIM, OKUNDU}     # §7a R3 "Meta Kabul Etti ve sonrası" (kâhin yorumu: Süresi Doldu / Başarısız sayılmaz)
SABLON_OKUMA_ARALIK = 10 * 60 * 1000                  # §7a R2: en geç 10 dakikada bir
SABLON_OKUMA_ILETI = 100                              # §7a R2: her 100 iletide
KESIN = {TESLIM, OKUNDU, BASARISIZ, SURESI_DOLDU}
CALISIR = (BEKLIYOR, SINIR, BEKLEME_131049)
GERI_DONEBILIR = {BEKLIYOR, SINIR, BEKLEME_131049, HAZIRLANIYOR, DURAKLATILDI, LISANS, SORULUYOR, GONDERILIYOR}
DURDURULABILIR = {BEKLIYOR, SINIR, BEKLEME_131049, HAZIRLANIYOR, DURAKLATILDI, SORULUYOR, LISANS}
KUYRUKTA = {BEKLIYOR, HAZIRLANIYOR, GONDERILIYOR, SINIR, DURAKLATILDI, BEKLEME_131049, LISANS, BELIRSIZ, SORULUYOR}  # §7a 9 + 10

# Plan §6 W2 + §7a 12 hata sınıfları
DURAKLATAN = {0, 190, 10, 131005, 368, 131031, 131042, 133010, 131045, 132001, 132000, 132012, 132018, 132007, 132015, 132016}
DURAKLATAN_ARALIK = range(200, 300)
ALICI = {131026, 131021, 131009}
GECICI = {131000, 131016, 130429, 80007, 4, 131057, 1, 2, 133004}   # §7a 12, 15 + R1: Meta'nın YANIT verdiği geçici hatalar (bağlantı yok → R1 beklemesi)
SINIR_KODLARI = {131048}                                                       # §7a 12 → madde 30
GECICI_DIZI = (30 * SN, 2 * DK, 15 * DK)                                        # §7a 15: 30 sn → 2 dk → 15 dk, sonra Başarısız
ICERIK_SABLON = {"ekstre": "destekofis_ekstre", "hatirlatma": "destekofis_odeme_hatirlatma"}
TTL = 72 * SA          # §11 S2 A
TTL_PAYI = 1 * SA      # §6 W2
KANCA_OMRU = 7 * GUN   # Meta: 7 güne kadar yeniden deneme; §7a 16 "son 7 günde en az bir kanca"
UCRET_USD = Decimal("0.0009")

# §7a 23 + W5: programın açması beklenen şablonlar (dil tr, kategori UTILITY)
SABLONLAR = {
    "destekofis_ekstre": {"baslik": "DOCUMENT",
                          "govde": "Sayın {{1}}, {{2}} firmasındaki cari hesabınızın {{3}} dönemine ait ekstresi ektedir. Dönem sonu bakiyesi: {{4}}. İyi günler dileriz.",
                          "alt_satir": "KVKK aydınlatma metni için firmamıza başvurabilirsiniz.", "dil": "tr", "kategori": "UTILITY"},
    "destekofis_odeme_hatirlatma": {"baslik": None,
                                    "govde": "Sayın {{1}}, {{2}} firmasındaki hesabınızda {{3}} vadeli {{4}} tutarında ödemeniz bulunmaktadır. Güncel bakiye: {{5}}. Ödeme yaptıysanız bu mesajı dikkate almayınız.",
                                    "alt_satir": None, "dil": "tr", "kategori": "UTILITY"},
}

SERBEST = {}   # §7a bütün PLAN SUSUYOR noktalarını kararlaştırdı (30.10.2026). Yeni belirsizlik çıkarsa buraya seçenek olarak eklenir.
ZAMANLAR = ("hizli", "yavas")
ADIM = {"hizli": 500, "yavas": 5 * SN}

MUTASYONLAR = {
    "M1": "gönderim sınırı FARKLI alıcı yerine kabul sayısıyla",
    "M2": "'WhatsApp Mesajı İstemiyor' yok sayılır",
    "M3": "yanıtsız istek kendiliğinden yeniden gönderilir",
    "M4": "PDF (medya) kesinleşmeden, kabulde silinir",
    "M5": "aynı cari iki kez seçilince iki iş",
    "M6": "sınır kayan 24 saat yerine takvim günü",
    "M7": "TTL 3 gün yerine 30 gün",
    "M8": "şablon durumu/kategorisi başlatmada denetlenmez",
    "M9": "5 ardışık geçici hatada duraklamaz",
    "M10": "hesap/şablon hatası toplu işi duraklatmaz",
    "M11": "read'den sonra gelen delivered durumu geri alır",
    "M12": "yinelenen delivered teslim sayacını artırır",
    "M13": "yedekten geri yükleme bitmemiş işleri durdurmaz",
    "M14": "ekstrede devir (dönem öncesi bakiye) atlanır",
    "M15": "ekstre seçilen döneme uymaz (bütün hareketler)",
    "M16": "numara '+' olmadan gönderilir",
    "M17": "bir kez onay işaretsizken de başlar",
    "M18": "salt okunur lisansta başlar",
    "M18b": "lisans gönderim sırasında salt okunura geçince işçi durmaz",
    "M18y": "whatsapp.send yetkisi denetlenmez",
    "M19": "131049'da 24 saat beklemeden yeniden gönderir",
    "M20": "131049'da sınırsız yeniden gönderir",
    "M21": "Meta basamağı 6 saatte bir yeniden okunmaz",
    "M22": "'Başarısızları Yeniden Dene' Sonucu Belirsiz işi de gönderir",
    "M22b": "'Başarısızları Yeniden Dene' kabul edilmiş/teslim edilmiş işi de gönderir",
    "M23": "elle günlük üst sınır (dailyCap) yok sayılır",
    "M24": "imzasız (sahte) kanca Sonucu Belirsiz'i çözer",
    "M27": "24 saatten eski toplu iş (kapalı kalan) açılışta sorulmadan sürer",
    "M28": "program kapalıyken gelen kanca kaybolur (Meta yeniden denemesi yok sayılır)",
    "M29": "Süresi Doldu'da PDF silinmez",
    "M30": "failed 131026 işi Başarısız yapmaz",
    "M31": "'Bu Ay' sayacı teslim yerine kabulü sayar",
    "M32": "alıcı hatası (131009) toplu işi duraklatır",
    "M34": "mesajdaki bakiye dönemden bağımsız (PDF ile ayrışır)",
    "M35": "Meta sınır hatası işi Başarısız yapar",
    "M36": "yeniden denemede silinmiş medya kimliği kullanılır",
    "M37": "'Zaten Kuyrukta' denetimi yok (bekleyen cariye ikinci iş)",
    "M38": "aynı istek kimliği yeni toplu iş açar",
    "M39": "geçici hata sınırsız yeniden denenir (3 yeniden denemeden sonra Başarısız olmaz)",
    "M40": "toplu işi durduran hatayı alan iş Başarısız değil Duraklatıldı",
    "M41": "kanca yolu hiç çalışmamışken de TTL sonunda Süresi Doldu",
    "M42": "Süresi Doldu'dan sonra gelen teslim yok sayılır",
    "M43": "'Bu Ay' ayı teslim yerine kabul zamanından",
    "M44": "hatırlatmada gecikmiş borcu olmayan cari elenmez",
    "M45": "eksi bakiye '(Alacaklı)' eki olmadan",
    "M46": "lisans yeniden yazılabilir olunca işler kendiliğinden sürer",
    "M47": "sınıfsız hata kodu toplu işi duraklatır",
    "M48": "şablon kategorisi gönderim sürerken denetlenmez",
    "M49": "bütün seçilenler elenince boş toplu iş kaydı oluşur",
    "M50": "başarılı işin hata kodu temizlenmez",
    "M51": "131048 işi Başarısız yapar (beklemez)",
    "M52": "Meta sınır hatasında yalnız o toplu iş bekler (WABA'nın hepsi değil)",
    "M53": "sabit hat elenir",
    "M54": "aynı telefonlu ikinci cari elenir",
    "M55": "dönem metni ISO biçiminde",
    "M56": "24 saatten eski toplu işte sınır bekleyen iş de sorulur",
    "M57": "kuyrukta 'İstemiyor' işaretlenen cariye yine gönderilir",
    "M58": "iş verisi gönderimde değil başlatmada okunur",
    "M59": "bağlantı kurulamadığında Sonucu Belirsiz (bekleme değil)",
    "M60": "131049'da PDF silinir ve yeniden yüklenir",
    "M61": "bağlantı yokken iş geçici hata sayılır (30 sn → 2 dk → 15 dk → Başarısız; R1 öncesi)",
    "M62": "bağlantı dönünce 'Bağlantı Bekleniyor' toplu iş kendiliğinden sürmez",
    "M63": "şablon kategorisi saatte bir okunur (R2 öncesi)",
    "M64": "şablon kategorisi 100 iletide okunmaz (yalnız 10 dk)",
    "M65": "daha önce gönderilmiş cari bayraksız da gönderilir (R3 yok)",
    "M66": "'Yine de Gönder' bayrağı yok sayılır (daha önce gönderilen hep elenir)",
    "M67": "daha önce Başarısız olan iş de 'Daha Önce Gönderildi' sayılır",
}

# ---- yardımcılar -----------------------------------------------------------------------------------------------------------

def zaman_ayristir(metin, t0, cokme=None):
    """'+90s' / '+15m' / '+2h' / '+3d' / '+1d2h' (t0'a göre), 'cokme+10m' (çökmeye göre; çökme olmadıysa None), ISO."""
    if isinstance(metin, (int, float)):
        return t0 + int(metin)
    m = re.fullmatch(r"(cokme)?\+((?:\d+(?:\.\d+)?(?:ms|[dhms]))+)", metin)
    if m:
        taban = t0
        if m.group(1):
            if cokme is None:
                return None
            taban = cokme
        toplam = 0
        for sayi, birim in re.findall(r"(\d+(?:\.\d+)?)(ms|[dhms])", m.group(2)):
            toplam += float(sayi) * {"d": GUN, "h": SA, "m": DK, "s": SN, "ms": 1}[birim]
        return taban + int(toplam)
    return int(datetime.fromisoformat(metin).timestamp() * 1000)


def iso(ms, tz):
    return datetime.fromtimestamp(ms / 1000, tz).isoformat(timespec="seconds")


def tarih(ms, tz):
    return datetime.fromtimestamp(ms / 1000, tz).date().isoformat()


def ay(ms):
    return datetime.fromtimestamp(ms / 1000, TR).strftime("%Y-%m")


def tr_tarih(iso_tarih):
    y, a, g = iso_tarih.split("-")
    return f"{g}.{a}.{y}"


def temizle(s):
    """§2.2: değişken değerleri tek satıra indirilir (satır sonu, sekme, çok boşluk). Kâhin: her boşluk dizisi tek boşluk, uçlar kırpılır."""
    return re.sub(r"\s+", " ", str(s)).strip()


KISALTMA_ESIGI = 60   # D0: Meta değişken uzunluk sınırı yerel belgede yok; eşiği aşan değer "kısaltılabilir"


def deger(s):
    t = temizle(s)
    return t if len(t) <= KISALTMA_ESIGI else {"kisaltilabilir": t}


def kurus(d):
    """§7a 22: 2 ondalık; yuvarlama yarım yukarı (kâhin yorumu) — metin ve PDF AYNI yuvarlamayla."""
    return Decimal(d).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def para(d, mut=()):
    """§8 '1.250,00 TL'; §7a 22 eksi bakiye '1.234,56 TL (Alacaklı)'."""
    d = kurus(d)
    tam, kesir = f"{abs(d):.2f}".split(".")
    metin = "{:,}".format(int(tam)).replace(",", ".") + f",{kesir} TL"
    if d < 0:
        return ("-" + metin) if "M45" in mut else metin + " (Alacaklı)"
    return metin


def donem_metni(bas, son, mut=()):
    """§7a 21: '01.10.2026 – 31.10.2026'."""
    if bas is None:
        return {"plan_susuyor": "Tüm Hareketler dönem metni"}
    if "M55" in mut:
        return f"{bas}/{son}"
    return f"{tr_tarih(bas)} – {tr_tarih(son)}"


def numara(ham):
    """Telefon → ('+…', tür) ya da (None, neden). §2.2 '+' + ülke kodu; §7a 6 geçersiz = E.164'e çevrilemeyen (uzunluk/ülke kodu);
    §7a 7 hücrede birden çok numara: '/', ',', ';', satır sonu → ilki. Kâhin yorumu: '0'+10, '90'+10, 10 hane (TR), '00' ve '+' önekleri."""
    if ham is None:
        return None, "telefonsuz"
    ilk = re.split(r"\s*(?:[/,;]|\r?\n)\s*", str(ham).strip())[0]
    r = re.sub(r"\D", "", ilk)
    if not r:
        return None, "telefonsuz"
    if ilk.strip().startswith("+"):
        e = r
    elif r.startswith("00"):
        e = r[2:]
    elif r.startswith("0") and len(r) == 11:
        e = "90" + r[1:]
    elif r.startswith("90") and len(r) == 12:
        e = r
    elif len(r) == 10 and r[0] != "0":
        e = "90" + r
    else:
        return None, "gecersiz"
    if e.startswith("90"):
        if len(e) != 12:
            return None, "gecersiz"
        return "+" + e, ("mobil" if e[2] == "5" else "sabit")
    if not 8 <= len(e) <= 15:
        return None, "gecersiz"
    return "+" + e, "yurtdisi"


# ---- iş / toplu iş ---------------------------------------------------------------------------------------------------------

class Is:
    def __init__(self, anahtar, toplu, cari):
        self.anahtar = anahtar; self.toplu = toplu; self.cari = cari
        self.durum = BEKLIYOR; self.telefon = None; self.icerik = None; self.next_at = 0
        self.post = 0; self.medyalar = []; self.silinen_n = 0; self.wamidler = []   # silme yalnız kesinleşmede → önek
        self.kod = None; self.deneme_49 = 0; self.teslim_t = None; self.kabul_t = None
        self.belirsiz_t = None; self.elendi_neden = None; self.meta_sayi = 0; self.gecici_deneme = 0


class Toplu:
    def __init__(self, etiket, sablon, donem, sirket, t, kullanici):
        self.etiket = etiket; self.sablon = sablon; self.donem = donem; self.sirket = sirket; self.t = t; self.kullanici = kullanici
        self.isler = []; self.durum = "aktif"; self.neden = None; self.gecici = 0
        self.bas = 0; self.sablon_okuma = t; self.okuma_sayac = 0


class Benzetim:
    def __init__(self, sen, secim=None, zaman="hizli", mut=frozenset()):
        self.sen = sen; self.zaman = zaman; self.mut = set(mut)
        self.T0 = zaman_ayristir(sen["baslangic"], 0)
        self.tz = datetime.fromisoformat(sen["baslangic"]).tzinfo or timezone.utc
        self.adim = ADIM[zaman]
        self.ayar = {"bagli": True, "onay": True, "gunluk_ust_sinir": None, "lisans_yazilabilir": True, **sen.get("ayar", {})}
        self.kullanicilar = sen.get("kullanicilar", {"yonetici": {"whatsapp.send": True}})
        self.cariler = {c["id"]: {"sirket": "A", "istemiyor": False, "silindi": False, "pasif": False, "hareketler": [], "vadeler": [], **copy.deepcopy(c)} for c in sen["cariler"]}
        self.firmalar = sen.get("firmalar", {"A": "Deneme Ticaret Ltd. Şti."})
        self.wabalar = sen.get("wabalar", {"A": "W1"})
        m = sen.get("meta", {})
        self.meta = {"basamak": m.get("basamak", 250), "kapali": False,
                     "sablonlar": {"destekofis_ekstre": {"durum": "APPROVED", "kategori": "UTILITY"},
                                   "destekofis_odeme_hatirlatma": {"durum": "APPROVED", "kategori": "UTILITY"}, **copy.deepcopy(m.get("sablonlar", {}))}}
        self.davranis = sen.get("meta_davranis", {})
        self.toplular = {}; self.toplu_sira = []; self.isler = {}
        self.pencere = {}            # waba → {alıcı: son kabul t} — program sayacı (makine düzeyi, WABA'ya göre)
        self.kabul_kaydi = []        # (t, waba, sirket, alici, anahtar)
        self.teslim_kaydi = []       # (is, olay_t)
        self.program_basamak = {}; self.son_okuma = {}
        self.blok = {}
        self.acik = True; self.tunel = True; self.lisans = self.ayar["lisans_yazilabilir"]
        self.isci_bos = self.T0
        self.post_hedef = {}; self.medya_toplam = 0
        self.meta_mesajlari = {}; self.wamid_is = {}
        self.kancalar = []; self.kanca_sira = 0; self.meta_kuyruk = []
        self.ttl_aktif = {}
        self.son_kanca = {}          # waba → son İMZALI kancanın işlendiği an (§7a 16 "kanca yolu çalışıyor")
        self.istekler = {}           # istek kimliği → toplu etiketi (§7a 9)
        self.onceki_uyari = {}       # §7a R3: etiket → {sayi, son} ("N kişiye bu dönem daha önce gönderildi (son tarih)")
        self.ayni_istek = {}; self.olusmadi = []
        self.bitis = zaman_ayristir(sen["bitis"], self.T0) if sen.get("bitis") else self.T0 + 10 * GUN
        self.cokme = None
        self.kontroller = {}; self.baslamadi = {}; self.elenen = {}
        self.ozet = bool(sen.get("ozet_cikti"))
        self.degismez = {"silinmis_medyayla_gonderim": 0, "kesin_oncesi_medya_silme": 0,
                         "artisiz_numaraya_gonderim": 0, "lisanssiz_gonderim": 0, "duraklatilmis_toplu_gonderim": 0}
        self.olaylar = []
        for i, o in enumerate(sen.get("olaylar", [])):
            if o["tur"] == "cokme":
                self.cokme = dict(o)
                continue
            self.olaylar.append([zaman_ayristir(o["t"], self.T0), i, o])

    # ---- zaman çizelgesi --------------------------------------------------------------------------------------------------
    def calistir(self):
        t = self.T0
        for _ in range(1_000_000):
            adaylar = [o[0] for o in self.olaylar if o[0] is not None]
            if self.kancalar:
                adaylar.append(self.kancalar[0][0])
            if self.acik:
                for z in (self.ttl_zamani(t), self.okuma_zamani(), self.sablon_okuma_zamani()):
                    if z is not None:
                        adaylar.append(max(z, t))
                if self.lisans:
                    hazir = self.isci_zamani()
                    if hazir is not None:
                        adaylar.append(max(hazir, self.isci_bos, t))
            if not adaylar or min(adaylar) > self.bitis:
                return self.sonuc()
            t = max(t, min(adaylar))
            self.adim_isle(t)
        raise RuntimeError("benzetim bitmedi (sonsuz döngü?)")

    def adim_isle(self, t):
        simdi = sorted((o for o in self.olaylar if o[0] is not None and o[0] <= t), key=lambda o: (o[0], o[1]))
        for o in simdi:
            if o[2]["tur"] != "kontrol":
                self.olaylar.remove(o)
                self.olay(o[2], t)
        while self.kancalar and self.kancalar[0][0] <= t:
            _, _, wamid, durum, kod, ek = heapq.heappop(self.kancalar)
            self.kanca_varis(t, wamid, durum, kod, ek)
        if self.acik:
            self.ttl_isle(t)
            self.okuma_isle(t)
            self.sablon_okuma_isle(t)
            if self.lisans and self.isci_bos <= t:
                self.isci(t)
        for o in simdi:
            if o[2]["tur"] == "kontrol":
                self.olaylar.remove(o)
                self.kontrol(o[2], t)

    def sifirla_bas(self):
        for tp in self.toplular.values():
            tp.bas = 0

    # ---- senaryo olayları ---------------------------------------------------------------------------------------------------
    def olay(self, o, t):
        tur = o["tur"]
        if tur == "baslat":
            self.baslat(o, t)
        elif tur == "cari":
            c = self.cariler[o["id"]]
            for k in ("telefon", "istemiyor", "silindi", "pasif", "ad"):
                if k in o:
                    c[k] = o[k]
            if "hareket_ekle" in o:
                c["hareketler"].append(o["hareket_ekle"])
            if "vadeler" in o:
                c["vadeler"] = o["vadeler"]
        elif tur == "kapat":
            self.acik = False
        elif tur == "ac":
            self.ac(t)
        elif tur == "tunel":
            self.tunel = o["acik"]
        elif tur == "kanca_kuyrugu":
            self.kuyruk_isle(t)
        elif tur == "lisans":
            if "M18b" in self.mut:
                return
            self.lisans = o["yazilabilir"]
            for tp in self.toplular.values():
                for j in tp.isler:
                    if not self.lisans and j.durum in (BEKLIYOR, SINIR, HAZIRLANIYOR, BEKLEME_131049):
                        self.durum(j, LISANS, t)
                    elif self.lisans and j.durum == LISANS and "M46" in self.mut:
                        self.durum(j, BEKLIYOR, t); j.next_at = t; tp.bas = 0
            # §7a 25: yeniden yazılabilir olunca LISANS işleri kendiliğinden SÜRMEZ ("Devam Et")
        elif tur in ("duraklat", "devam", "iptal"):
            tp = self.toplular[o["toplu"]]
            if tur == "duraklat":
                tp.durum = "duraklatildi"; tp.neden = "kullanici"
                for j in tp.isler:
                    if j.durum in (BEKLIYOR, SINIR, BEKLEME_131049):
                        self.durum(j, DURAKLATILDI, t)
            elif tur == "devam":
                tp.durum = "aktif"; tp.neden = None; tp.gecici = 0; tp.bas = 0
                for j in tp.isler:
                    if j.durum in (DURAKLATILDI, SORULUYOR, LISANS):
                        self.durum(j, BEKLIYOR, t); j.next_at = t
            else:
                tp.durum = "iptal"
                for j in tp.isler:
                    if j.durum in DURDURULABILIR:
                        self.durum(j, IPTAL, t)
        elif tur == "basarisizlari_yeniden_dene":
            tp = self.toplular[o["toplu"]]
            hedef = {BASARISIZ}
            if "M22" in self.mut:
                hedef.add(BELIRSIZ)
            if "M22b" in self.mut:
                hedef |= {TESLIM, OKUNDU, KABUL, GONDERILDI}
            for j in tp.isler:
                if j.durum in hedef:
                    self.durum(j, BEKLIYOR, t); j.next_at = t; j.gecici_deneme = 0
            if tp.durum != "iptal":
                tp.durum = "aktif"
            tp.bas = 0; tp.gecici = 0
        elif tur == "yine_de_gonder":
            j = self.isler[f'{o["toplu"]}/{o["cari"]}']
            if j.durum == BELIRSIZ:
                self.durum(j, BEKLIYOR, t); j.next_at = t
                tp = self.toplular[o["toplu"]]
                tp.durum = "aktif"; tp.bas = 0
        elif tur in ("geri_yukle", "sifirla", "tasindi"):
            if "M13" in self.mut:
                return
            for tp in self.toplular.values():
                for j in tp.isler:
                    if j.durum in DURDURULABILIR:
                        self.durum(j, TASINAN if tur == "tasindi" else DURDU_GERI_YUKLEME, t)   # §7a 26
        elif tur == "meta_basamak":
            self.meta["basamak"] = o["basamak"]
        elif tur == "meta_sablon":
            st = self.meta["sablonlar"].setdefault(o["ad"], {"durum": None, "kategori": None})
            for k in ("durum", "kategori"):
                if k in o:
                    st[k] = o[k]
        elif tur == "meta_kapali":
            self.meta["kapali"] = o["kapali"]
            if not o["kapali"] and "M62" not in self.mut:         # §7a R1: bağlantı dönünce kendiliğinden sürer
                for tp in self.toplular.values():
                    if tp.durum == "baglanti_bekleniyor":
                        tp.durum = "aktif"; tp.neden = None; tp.bas = 0
        elif tur == "sahte_kanca":
            wamid = o.get("wamid", "wamid.SAHTE")
            if "is" in o:                                    # sahte olay gerçek bir işin wamid'ini taşır (saldırgan wamid'i biliyor)
                wamid = self.isler[o["is"]].wamidler[-1]
            self.kanca_planla(t, wamid, o["durum"], o.get("kod"),
                              {"opaque": o.get("opaque"), "sahte": True, "imzali": bool(o.get("imzali")), "olay_t": t})
        else:
            raise ValueError(f"bilinmeyen olay: {tur}")

    def ac(self, t):
        self.acik = True
        self.isci_bos = max(self.isci_bos, t)
        self.sifirla_bas()
        for tp in self.toplular.values():
            for j in tp.isler:
                if j.durum == GONDERILIYOR:        # §6 W2: yanıtsız istek (program kapandı) → Sonucu Belirsiz; §7a 10 toplu iş sürer
                    self.durum(j, BELIRSIZ, t); j.belirsiz_t = t
                elif j.durum == HAZIRLANIYOR:
                    self.durum(j, BEKLIYOR, t)
            if tp.durum == "aktif" and t - tp.t > GUN and "M27" not in self.mut:
                # §7a 24: SINIR (ve Meta Bekletti) nedeniyle bekleyen kendiliğinden sürer; program kapalı kaldığı için duran açılışta sorulur
                for j in tp.isler:
                    if j.durum == BEKLIYOR or (j.durum == SINIR and "M56" in self.mut):
                        self.durum(j, SORULUYOR, t)

    # ---- başlatma -----------------------------------------------------------------------------------------------------------
    def kuyrukta(self, cid, sablon, donem, sirket):
        """§7a 9: aynı cari + şablon + dönem için bekleyen / gönderilmekte iş (süre penceresi yok)."""
        for tp in self.toplular.values():
            if tp.sablon == sablon and tp.donem == donem and tp.sirket == sirket:
                if any(j.cari == cid and j.durum in KUYRUKTA for j in tp.isler):
                    return True
        return False

    def onceden_gonderildi(self, cid, sablon, donem, sirket):
        """§7a R3: aynı cari + şablon + dönem DAHA ÖNCE gönderilmiş (Meta Kabul Etti ve sonrası) → son kabul anı, yoksa None.
        Kâhin yorumu: yalnız dönemli ekstrede (uyarı metni "bu dönem"); hatırlatmada (dönemsiz) uygulanmaz — planda yok."""
        if "M65" in self.mut or sablon != "ekstre" or donem in (None, "tum"):
            return None
        sayilan = GONDERILMIS | ({BASARISIZ} if "M67" in self.mut else set())
        en = None
        for tp in self.toplular.values():
            if tp.sablon == sablon and tp.donem == donem and tp.sirket == sirket:
                for j in tp.isler:
                    if j.cari == cid and j.durum in sayilan and j.kabul_t is not None:
                        en = j.kabul_t if en is None else max(en, j.kabul_t)
        return en

    def gecikmis(self, c, t):
        """§7a 20: vadesi geçmiş açık kalemler (girdi: cari 'vadeler' [{vade, kalan}]; gecikmiş = vade < bugün — kâhin yorumu)."""
        bugun = tarih(t, self.tz)
        return sorted((v for v in c.get("vadeler", []) if v["vade"] < bugun and Decimal(str(v["kalan"])) > 0), key=lambda v: v["vade"])

    def baslat(self, o, t):
        etiket = o["etiket"]; sirket = o.get("sirket", "A"); sablon = o.get("sablon", "ekstre")
        kullanici = o.get("kullanici", "yonetici")
        istek = o.get("istek")
        if istek is not None and istek in self.istekler and "M38" not in self.mut:   # §7a 9: aynı istek kimliği tek toplu iş
            self.ayni_istek[etiket] = self.istekler[istek]
            return
        neden = None
        st = self.meta["sablonlar"].get(ICERIK_SABLON[sablon]) or {}
        if not self.ayar["bagli"]:                                          # §7a 29 sırası
            neden = "bagli_degil"
        elif not self.kullanicilar.get(kullanici, {}).get("whatsapp.send") and "M18y" not in self.mut:
            neden = "yetki_yok"
        elif not self.lisans and "M18" not in self.mut:
            neden = "lisans_salt_okunur"
        elif not self.ayar["onay"] and "M17" not in self.mut:
            neden = "onay_yok"
        elif "M8" not in self.mut and (st.get("durum") != "APPROVED" or st.get("kategori") != "UTILITY"):
            neden = "sablon_uygun_degil"
        if neden:
            self.baslamadi[etiket] = neden
            return
        if istek is not None:
            self.istekler[istek] = etiket
        waba = self.wabalar[sirket]
        tp = Toplu(etiket, sablon, o.get("donem"), sirket, t, kullanici)
        elenen = {}; goruldu = set(); telefonlar = set(); onceki = []
        for cid in o["secim"]:
            if cid in goruldu and "M5" not in self.mut:
                continue                                                  # UNIQUE(batch_id, account_id)
            goruldu.add(cid)
            c = self.cariler[cid]
            if c["silindi"] or c["pasif"]:
                elenen[cid] = "silindi" if c["silindi"] else "pasif"; continue
            if c["istemiyor"] and "M2" not in self.mut:
                elenen[cid] = "istemiyor"; continue
            tel, tur_ = numara(c.get("telefon"))
            if tel is None:
                elenen[cid] = tur_; continue                              # §7a 6: E.164'e çevrilemeyen elenir
            if tur_ == "sabit" and "M53" in self.mut:
                elenen[cid] = "sabit_hat"; continue                       # §7a 6 (K1): sabit hat / yurt dışı ELENMEZ
            if tel in telefonlar and "M54" in self.mut:
                elenen[cid] = "ayni_telefon"; continue                    # §7a 8 (K2): aynı telefon iki cari → iki ileti
            if sablon == "hatirlatma" and not self.gecikmis(c, t) and "M44" not in self.mut:
                elenen[cid] = "gecikmis_borc_yok"; continue               # §7a 20
            if "M37" not in self.mut and self.kuyrukta(cid, sablon, o.get("donem"), sirket):
                elenen[cid] = "zaten_kuyrukta"; continue                  # §7a 9
            onceki_t = self.onceden_gonderildi(cid, sablon, o.get("donem"), sirket)
            if onceki_t is not None:                                      # §7a R3: uyarı + "Yine de Gönder" / "Bunları Çıkar" (varsayılan)
                onceki.append(onceki_t)
                if o.get("onceki", "cikar") != "gonder" or "M66" in self.mut:
                    elenen[cid] = DAHA_ONCE; continue
            telefonlar.add(tel)
            anahtar = f"{etiket}/{cid}"
            n = 1
            while anahtar in self.isler:
                n += 1; anahtar = f"{etiket}/{cid}#{n}"
            j = Is(anahtar, etiket, cid)
            j.next_at = t
            if "M58" in self.mut:
                j.telefon = tel; j.icerik = self.icerik(c, tp, t)
            tp.isler.append(j)
            self.isler[anahtar] = j
        self.elenen[etiket] = elenen
        if onceki:
            self.onceki_uyari[etiket] = {"sayi": len(onceki), "son": tarih(max(onceki), self.tz)}
        if not tp.isler and "M49" not in self.mut:
            self.olusmadi.append(etiket)                                  # §7a 31: kayıt OLUŞMAZ, nedenler listelenir
            return
        self.toplular[etiket] = tp; self.toplu_sira.append(etiket)
        self.program_basamak[waba] = self.meta["basamak"]; self.son_okuma[waba] = t   # §6 W2: basamak gönderimden önce okunur

    # ---- içerik (değişkenler + PDF) -----------------------------------------------------------------------------------------
    def icerik(self, c, tp, t):
        ad = deger(c["ad"]); firma = deger(self.firmalar[tp.sirket]); tam_ad = temizle(c["ad"])
        hareketler = [(h["tarih"], Decimal(str(h.get("borc", 0))) - Decimal(str(h.get("alacak", 0)))) for h in c["hareketler"]]
        if tp.sablon == "ekstre":
            if tp.donem in (None, "tum"):
                bas = son = None; devir = Decimal("0"); donem_h = hareketler
            else:
                bas, son = tp.donem["bas"], tp.donem["son"]
                if "M15" in self.mut:
                    devir = Decimal("0"); donem_h = hareketler
                else:
                    devir = sum((d for tr, d in hareketler if tr < bas), Decimal("0"))
                    donem_h = [(tr, d) for tr, d in hareketler if bas <= tr <= son]   # §7a 22: uçlar dahil; dönem sonundan sonrası girmez
                if "M14" in self.mut:
                    devir = Decimal("0")
            sonu = devir + sum((d for _, d in donem_h), Decimal("0"))
            mesaj_bakiye = sum((d for _, d in hareketler), Decimal("0")) if "M34" in self.mut else sonu
            return {
                "degiskenler": [ad, firma, donem_metni(bas, son, self.mut), para(mesaj_bakiye, self.mut)],   # §7a 23: {{4}} dönem sonu bakiyesi
                "pdf": {"cari_ad": ad, "donem_bas": bas, "donem_son": son, "devir": str(kurus(devir)),
                        "hareket_sayisi": len(donem_h), "donem_sonu_bakiye": str(kurus(sonu))},
                "dosya_adi": {"on_ek": f"Ekstre {tam_ad} " if isinstance(ad, str) else {"kisaltilabilir": f"Ekstre {tam_ad}"}, "son_ek": ".pdf"},
            }
        bugun = tarih(t, self.tz)
        bakiye = sum((d for tr, d in hareketler if tr <= bugun), Decimal("0"))
        gec = self.gecikmis(c, t)
        if gec:
            vade, tutar = tr_tarih(gec[0]["vade"]), para(sum((Decimal(str(v["kalan"])) for v in gec), Decimal("0")), self.mut)
        else:
            vade, tutar = {"plan_susuyor": "gecikmiş borç yok (yalnız M44'te)"}, {"plan_susuyor": "gecikmiş borç yok"}
        return {"degiskenler": [ad, firma, vade, tutar, para(bakiye, self.mut)], "pdf": None, "dosya_adi": None}   # §7a 20

    # ---- işçi ---------------------------------------------------------------------------------------------------------------
    def _ilerlet(self, tp):
        while tp.bas < len(tp.isler) and tp.isler[tp.bas].durum not in GERI_DONEBILIR:
            tp.bas += 1

    def isci_zamani(self):
        en = None
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum != "aktif":
                continue
            self._ilerlet(tp)
            for j in tp.isler[tp.bas:]:
                if j.durum in CALISIR and (en is None or j.next_at < en):
                    en = j.next_at
        return en

    def sinir_degeri(self, waba):
        L = self.program_basamak.get(waba, self.meta["basamak"])
        cap = self.ayar.get("gunluk_ust_sinir")
        if cap is not None and "M23" not in self.mut:
            L = min(L, cap)
        return L

    def pencere_kumesi(self, waba, t):
        p = self.pencere.get(waba, {})
        if "M6" in self.mut:
            gun_bas = int(datetime.fromtimestamp(t / 1000, self.tz).replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
            return {a: x for a, x in p.items() if x >= gun_bas}
        return {a: x for a, x in p.items() if x > t - GUN}

    def sigar(self, kume, alici, L):
        return len(kume) + (0 if alici in kume else 1) <= L      # §7a 4: penceresinde sayılmış alıcı GEÇER

    def oda_zamani(self, waba, alici, t, L, onbellek):
        if "M1" in self.mut:
            k = onbellek.setdefault(("m1", waba), sorted(x for (x, w, *_r) in self.kabul_kaydi if w == waba and x > t - GUN))
            return t if len(k) < L else k[len(k) - L] + GUN
        p = self.pencere.get(waba, {})
        if len(p) < L and "M6" not in self.mut:
            return t
        kk = ("kume", waba)
        if kk not in onbellek:
            onbellek[kk] = self.pencere_kumesi(waba, t)
        kume = onbellek[kk]
        if self.sigar(kume, alici, L):
            return t
        anahtar = ("oda", waba, alici in kume)
        if anahtar in onbellek:
            return onbellek[anahtar]
        if "M6" in self.mut:
            ertesi = datetime.fromtimestamp(t / 1000, self.tz).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            onbellek[anahtar] = int(ertesi.timestamp() * 1000)
            return onbellek[anahtar]
        sonuc = None
        zamanlar = sorted(kume.items(), key=lambda kv: kv[1])
        for i, (_a, x) in enumerate(zamanlar):
            aday = x + GUN
            if aday <= t:
                continue
            if self.sigar({a: y for a, y in zamanlar[i + 1:] if y > aday - GUN}, alici, L):
                sonuc = aday
                break
        onbellek[anahtar] = sonuc
        return sonuc

    def atla(self, j, neden, t):
        j.elendi_neden = neden
        self.durum(j, ATLANDI, t)

    def isci(self, t):
        onbellek = {}
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum != "aktif":
                continue
            self._ilerlet(tp)
            for j in tp.isler[tp.bas:]:
                if j.durum not in CALISIR or j.next_at > t:
                    continue
                c = self.cariler[j.cari]
                waba = self.wabalar[tp.sirket]
                if (c["silindi"] or c["pasif"] or c["istemiyor"]) and "M57" not in self.mut:   # §7a 2: kuyrukta işaretlenen / silinen / pasif → Atlandı
                    self.atla(j, "silindi" if c["silindi"] else ("pasif" if c["pasif"] else "istemiyor"), t)
                    continue
                if "M58" not in self.mut or j.icerik is None:                     # §7a 1: veri GÖNDERİM ANINDA okunur
                    tel, tur_ = numara(c.get("telefon"))
                    if tel is None:
                        self.atla(j, tur_, t)
                        continue
                    if tp.sablon == "hatirlatma" and not self.gecikmis(c, t) and "M44" not in self.mut:
                        self.atla(j, "gecikmis_borc_yok", t)
                        continue
                    j.telefon = tel[1:] if "M16" in self.mut else tel
                    j.icerik = self.icerik(c, tp, t)
                blok = self.blok.get(("toplu", tp.etiket), 0) if "M52" in self.mut else self.blok.get(("waba", waba), 0)
                if blok > t:                                                  # §7a 30: Meta sınır hatası → WABA'nın bütün işleri 24 sa
                    self.durum(j, SINIR, t); j.next_at = blok
                    continue
                oda = self.oda_zamani(waba, j.telefon, t, self.sinir_degeri(waba), onbellek)
                if oda is None or oda > t:
                    self.durum(j, SINIR, t); j.next_at = oda if oda is not None else t + GUN
                    continue
                self.gonder(j, tp, waba, t)
                return

    def meta_yanit_mesaj(self, j, deneme):
        if self.meta["kapali"]:
            return "baglanti_reddi"
        kurallar = self.davranis.get("mesaj", {})
        liste = kurallar.get(j.cari, kurallar.get("*"))
        if liste is None:
            yanit = "kabul"
        elif isinstance(liste, (str, dict)):
            yanit = liste
        else:
            yanit = liste[deneme - 1] if deneme - 1 < len(liste) else "kabul"
        if yanit == "kabul":
            st = self.meta["sablonlar"].get(ICERIK_SABLON[self.toplular[j.toplu].sablon]) or {}
            durum = st.get("durum")
            if durum == "PAUSED":
                return {"hata": 132015}
            if durum == "DISABLED":
                return {"hata": 132016}
            if durum != "APPROVED":
                return {"hata": 132001}
        return yanit

    def meta_yanit_medya(self):
        liste = self.davranis.get("medya", [])
        return liste[self.medya_toplam - 1] if self.medya_toplam - 1 < len(liste) else "kabul"

    def gonder(self, j, tp, waba, t):
        ts = t + self.adim
        self.isci_bos = ts
        self.durum(j, HAZIRLANIYOR, t)
        if tp.sablon == "ekstre":                           # §2.3 / W3; §7a 15: geçerli medya yeniden kullanılır
            canli = len(j.medyalar) > j.silinen_n or ("M36" in self.mut and j.medyalar)
            if not canli:
                while True:
                    if self.meta["kapali"]:
                        return self.baglanti_yok(j, tp, ts)
                    self.medya_toplam += 1
                    y = self.meta_yanit_medya()
                    if y == "kabul":
                        j.medyalar.append(f"m:{j.anahtar}#{len(j.medyalar) + 1}")
                        break
                    if y == "yanitsiz":                     # §6 W2: yeniden yüklenir; §7a 15: medya yükleme hataları "5 art arda"ya sayılır
                        tp.gecici += 1
                        if tp.gecici >= 5 and "M9" not in self.mut:
                            return self.duraklatan(j, tp, "medya", ts)
                        continue
                    if isinstance(y, dict) and "hata" in y:
                        return self.hata_isle(j, tp, y["hata"], ts, post_yok=True)
                    raise ValueError(f"senaryo medya yanıtı modellenmedi: {y}")
        self.durum(j, GONDERILIYOR, ts)                     # §6 W2: istekten ÖNCE yazılır
        c = self.cokme
        if c and not c.get("oldu") and c.get("cari") == j.cari and c.get("toplu", tp.etiket) == tp.etiket:
            c["oldu"] = True
            if c.get("istek_ulasti", True):
                self.post_say(j, tp, ts)
                self.meta_ileti(j, ts, programa=False)
            self.acik = False
            for o in self.olaylar:
                if o[0] is None:
                    o[0] = zaman_ayristir(o[2]["t"], self.T0, cokme=ts)
            return
        if j.telefon and not j.telefon.startswith("+"):
            self.degismez["artisiz_numaraya_gonderim"] += 1
        if not self.lisans:
            self.degismez["lisanssiz_gonderim"] += 1
        if tp.durum != "aktif":
            self.degismez["duraklatilmis_toplu_gonderim"] += 1
        if tp.sablon == "ekstre" and len(j.medyalar) <= j.silinen_n and "M36" not in self.mut:
            self.degismez["silinmis_medyayla_gonderim"] += 1
        if "M36" in self.mut and tp.sablon == "ekstre" and len(j.medyalar) <= j.silinen_n:
            self.degismez["silinmis_medyayla_gonderim"] += 1
        if self.meta["kapali"]:                             # §7a 11: bağlantı hiç kurulamadı → geçici
            return self.baglanti_yok(j, tp, ts)
        y = self.meta_yanit_mesaj(j, self.post_hedef.get(j.telefon, 0) + 1)
        self.post_say(j, tp, ts)
        if y == "kabul":
            self.meta_ileti(j, ts, programa=True)
            if "M4" in self.mut:
                self.kesinlesti(j, ts)
            tp.gecici = 0; j.gecici_deneme = 0               # §7a 15: sayaç başarılı gönderimle sıfırlanır
            return
        if y in ("yanitsiz_kabul", "yanitsiz_red"):
            if y == "yanitsiz_kabul":
                self.meta_ileti(j, ts, programa=False)
            if "M3" in self.mut:
                self.durum(j, BEKLIYOR, ts); j.next_at = ts + GECICI_DIZI[0]
                return
            return self.belirsiz(j, ts)
        kod = y.get("hata") if isinstance(y, dict) else None
        if (isinstance(y, dict) and y.get("sinir")) or kod in SINIR_KODLARI:   # §7a 12 + 30
            if "M35" in self.mut or ("M51" in self.mut and kod in SINIR_KODLARI):
                j.kod = kod; self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
                return
            kapsam = ("toplu", tp.etiket) if "M52" in self.mut else ("waba", waba)
            self.blok[kapsam] = ts + GUN
            self.durum(j, SINIR, ts); j.next_at = ts + GUN
            return
        self.hata_isle(j, tp, kod, ts)

    def baglanti_yok(self, j, tp, ts):
        """§7a 11 + R1: Meta'ya HİÇ ulaşılamadı (istek gitmediği kesin) → iş Başarısız SAYILMAZ, deneme sayacı artmaz; toplu iş
        'Bağlantı Bekleniyor' diye durur, bağlantı dönünce kendiliğinden sürer."""
        if "M59" in self.mut:
            return self.belirsiz(j, ts)
        if "M61" in self.mut:
            return self.hata_isle(j, tp, BAGLANTI, ts, post_yok=True)
        self.durum(j, BEKLIYOR, ts); j.next_at = ts
        tp.durum = "baglanti_bekleniyor"; tp.neden = BAGLANTI_BEKLENIYOR

    def belirsiz(self, j, ts):
        self.durum(j, BELIRSIZ, ts); j.belirsiz_t = ts       # §7a 10: toplu iş SÜRER

    def duraklatan(self, j, tp, kod, ts):
        """§6 W2 İLK hatada DURAKLAR; §7a 13: hatayı alan iş Başarısız (kodlu), bekleyenler Duraklatıldı."""
        j.kod = kod
        if "M40" in self.mut:
            self.durum(j, BEKLIYOR, ts)
        else:
            self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
        tp.durum = "duraklatildi"; tp.neden = kod
        for x in tp.isler:
            if x.durum in (BEKLIYOR, SINIR, HAZIRLANIYOR, BEKLEME_131049):
                self.durum(x, DURAKLATILDI, ts)

    def hata_isle(self, j, tp, kod, ts, post_yok=False):
        j.kod = kod
        self.durum(j, BEKLIYOR, ts)
        if kod in DURAKLATAN or (isinstance(kod, int) and kod in DURAKLATAN_ARALIK):
            if "M10" in self.mut:
                self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
                return
            return self.duraklatan(j, tp, kod, ts)
        if kod in ALICI:
            self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
            if "M32" in self.mut:
                self.duraklatan(j, tp, kod, ts)
            return
        if kod == 131049:
            return self.k131049(j, tp, ts)
        if kod == 131056:
            j.next_at = ts + DK
            return
        if kod in GECICI or kod == BAGLANTI:                # §7a 15: 30 sn → 2 dk → 15 dk, sonra Başarısız; 5 art arda → toplu iş durur (BAGLANTI yalnız M61)
            tp.gecici += 1; j.gecici_deneme += 1
            if tp.gecici >= 5 and "M9" not in self.mut:
                return self.duraklatan(j, tp, kod, ts)
            if j.gecici_deneme > len(GECICI_DIZI) and "M39" not in self.mut:
                self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
                return
            j.next_at = ts + GECICI_DIZI[min(j.gecici_deneme, len(GECICI_DIZI)) - 1]
            return
        # §7a 12: sınıfsız ve tanınmayan kod → o İŞ Başarısız (kodlu), toplu iş sürer
        if "M47" in self.mut:
            return self.duraklatan(j, tp, kod, ts)
        self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)

    def k131049(self, j, tp, t):
        """§6 W2: 131049 → 24 saat sonra en çok bir kez; §7a 14: 'Meta Bekletti', PDF silinmez, aynı medya."""
        if j.deneme_49 >= 1 and "M20" not in self.mut:
            j.kod = 131049; self.durum(j, BASARISIZ, t); self.kesinlesti(j, t)
            return
        j.deneme_49 += 1; j.kod = 131049
        if "M60" in self.mut:
            self.kesinlesti(j, t)
        self.durum(j, BEKLEME_131049, t); j.next_at = t + (0 if "M19" in self.mut else GUN)
        tp.bas = 0

    def post_say(self, j, tp, ts):
        j.post += 1
        self.post_hedef[j.telefon] = self.post_hedef.get(j.telefon, 0) + 1

    def meta_ileti(self, j, ts, programa):
        j.meta_sayi += 1
        wamid = f"wamid.{j.anahtar}#{j.meta_sayi}"
        self.meta_mesajlari[wamid] = j
        if programa:
            self.programa_kabul(j, wamid, ts)
        plan = self.davranis.get("kanca", {})
        liste = plan.get(j.cari, plan.get("*", []))
        if isinstance(liste, dict):
            liste = liste.get(str(j.meta_sayi), liste.get("*", []))
        for k in liste:
            ek = dict(k[2]) if len(k) > 2 else {}
            olay_t = zaman_ayristir(k[1], ts)
            varis = zaman_ayristir(ek["varis"], ts) if "varis" in ek else olay_t
            ek.setdefault("opaque", j.anahtar)
            ek["olay_t"] = olay_t; ek["imzali"] = True        # Meta'nın kancası: imza kapıcıda doğrulanır (§7a 3)
            for _ in range(int(ek.get("tekrar", 1))):
                self.kanca_planla(varis, wamid, k[0], ek.get("kod"), ek)

    def programa_kabul(self, j, wamid, ts):
        tp = self.toplular[j.toplu]
        waba = self.wabalar[tp.sirket]
        j.wamidler.append(wamid); self.wamid_is[wamid] = j
        j.kabul_t = ts
        if "M50" not in self.mut:
            j.kod = None                                     # §7a 32
        p = self.pencere.setdefault(waba, {})
        p[j.telefon] = max(p.get(j.telefon, 0), ts)
        tp.okuma_sayac += 1                                  # §7a R2: son kategori okumasından beri ileti
        self.kabul_kaydi.append((ts, waba, tp.sirket, j.telefon, j.anahtar))
        self.durum(j, KABUL, ts)

    # ---- kanca ----------------------------------------------------------------------------------------------------------------
    def kanca_planla(self, t, wamid, durum, kod, ek):
        self.kanca_sira += 1
        heapq.heappush(self.kancalar, (t, self.kanca_sira, wamid, durum, kod, ek))

    def kanca_varis(self, t, wamid, durum, kod, ek):
        if not (self.acik and self.tunel):
            if "M28" not in self.mut:
                self.meta_kuyruk.append((t, wamid, durum, kod, ek))
            return
        self.kanca_isle(t, wamid, durum, kod, ek)

    def kuyruk_isle(self, t):
        if not (self.acik and self.tunel):
            return
        kuyruk, self.meta_kuyruk = self.meta_kuyruk, []
        for (ilk, wamid, durum, kod, ek) in kuyruk:
            if t - ilk <= KANCA_OMRU:
                self.kanca_isle(t, wamid, durum, kod, ek)

    def kanca_isle(self, t, wamid, durum, kod, ek):
        if not ek.get("imzali") and "M24" not in self.mut:
            return                                           # §7a 3: imzasız olay düşer (GUV-06)
        sahibi = self.meta_mesajlari.get(wamid) or self.wamid_is.get(wamid)
        if sahibi is not None and ek.get("imzali"):
            self.son_kanca[self.wabalar[self.toplular[sahibi.toplu].sirket]] = t   # §7a 16: kanca yolu çalışıyor
        olay_t = ek.get("olay_t", t)
        j = self.wamid_is.get(wamid)
        if j is None:
            aday = self.isler.get(ek.get("opaque"))            # §7a 3: iş kimliği eşleşirse çözülür; sayaçlara ve pencereye girer
            if not (aday and aday.durum == BELIRSIZ):
                return
            j = aday
            self.programa_kabul(j, wamid, j.belirsiz_t)
        if j.durum == SURESI_DOLDU:                          # §7a 17: gerçek bilgi yazılır
            if durum in ("delivered", "read") and "M42" not in self.mut:
                self.durum(j, TESLIM if durum == "delivered" else OKUNDU, t)
                self.teslim_yaz(j, olay_t)
            return
        if j.durum not in SIRA:
            return
        if durum == "sent":
            if SIRA[j.durum] < 2:
                self.durum(j, GONDERILDI, t)
        elif durum == "delivered":
            if SIRA[j.durum] < 3 or ("M11" in self.mut and j.durum == OKUNDU):
                self.durum(j, TESLIM, t); self.teslim_yaz(j, olay_t); self.kesinlesti(j, t)
            elif "M12" in self.mut:
                self.teslim_kaydi.append((j, olay_t))
        elif durum == "read":
            if SIRA[j.durum] < 4:
                self.durum(j, OKUNDU, t); self.teslim_yaz(j, olay_t); self.kesinlesti(j, t)
        elif durum == "failed" and SIRA[j.durum] < 3:      # §7a 18: delivered/read'den sonra gelen failed yok sayılır
            if kod == 131049:
                return self.k131049(j, self.toplular[j.toplu], t)
            j.kod = kod
            if "M30" in self.mut and kod == 131026:
                return
            self.durum(j, BASARISIZ, t); self.kesinlesti(j, t)

    def teslim_yaz(self, j, olay_t):
        if j.teslim_t is None:
            j.teslim_t = olay_t                              # §7a 17: durum zamanı kanca timestamp'i
            self.teslim_kaydi.append((j, olay_t))

    def kesinlesti(self, j, t):
        """§11 S3 A: kesinleşince PDF Meta'dan silinir (her medya bir kez)."""
        j.silinen_n = len(j.medyalar)

    # ---- TTL, basamak ve şablon okuma ---------------------------------------------------------------------------------------
    def ttl_son(self, j):
        return j.kabul_t + (30 * GUN if "M7" in self.mut else TTL) + TTL_PAYI

    def yol_calisiyor(self, j, t):
        """§7a 16: bağlantıda son 7 günde en az bir (imzalı) kanca geldiyse kanca yolu çalışıyor."""
        if "M41" in self.mut:
            return True
        s = self.son_kanca.get(self.wabalar[self.toplular[j.toplu].sirket])
        return s is not None and s >= t - KANCA_OMRU

    def ttl_zamani(self, t):
        en = None
        for j in self.ttl_aktif.values():
            d = max(self.ttl_son(j), t)
            if self.yol_calisiyor(j, d) and (en is None or d < en):
                en = d
        return en

    def ttl_isle(self, t):
        for j in list(self.ttl_aktif.values()):
            if t >= self.ttl_son(j) and self.yol_calisiyor(j, t):   # kanca yolu yoksa "Meta Kabul Etti"de kalır ("Durum Bilinmiyor" yok)
                self.durum(j, SURESI_DOLDU, t)
                if "M29" not in self.mut:
                    self.kesinlesti(j, t)

    def bekleyen_var(self, waba):
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum == "aktif" and self.wabalar[tp.sirket] == waba:
                self._ilerlet(tp)
                if any(j.durum in CALISIR for j in tp.isler[tp.bas:]):
                    return True
        return False

    def okuma_zamani(self):
        if "M21" in self.mut:
            return None
        en = None
        for waba, son in self.son_okuma.items():
            if self.bekleyen_var(waba):
                aday = son + 6 * SA
                if en is None or aday < en:
                    en = aday
        return en

    def okuma_isle(self, t):
        if "M21" in self.mut:
            return
        for waba, son in list(self.son_okuma.items()):
            if t >= son + 6 * SA and self.bekleyen_var(waba):   # §6 W2: basamak 6 saatte bir
                eski = self.program_basamak.get(waba)
                self.program_basamak[waba] = self.meta["basamak"]; self.son_okuma[waba] = t
                if eski is not None and self.meta["basamak"] > eski:
                    for j in self.isler.values():
                        if j.durum == SINIR and self.wabalar[self.toplular[j.toplu].sirket] == waba:
                            j.next_at = min(j.next_at, t)

    def toplu_bekleyen(self, tp):
        self._ilerlet(tp)
        return any(j.durum in CALISIR for j in tp.isler[tp.bas:])

    def sablon_okuma_zamani(self):
        if "M48" in self.mut:
            return None
        en = None
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum == "aktif" and self.toplu_bekleyen(tp):
                aday = tp.sablon_okuma + (SA if "M63" in self.mut else SABLON_OKUMA_ARALIK)
                if en is None or aday < en:
                    en = aday
        return en

    def sablon_okuma_isle(self, t):
        """§7a 27 + R2: şablon kategorisi toplu iş sürerken HER 100 İLETİDE ve EN GEÇ 10 DAKİKADA bir okunur (hangisi önce);
        MARKETING görülünce iş durur. Okuma işçinin sıradaki gönderiminden önce yapılır (adim_isle sırası)."""
        if "M48" in self.mut:
            return
        aralik = SA if "M63" in self.mut else SABLON_OKUMA_ARALIK
        sayiyla = "M63" not in self.mut and "M64" not in self.mut
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum == "aktif" and (t >= tp.sablon_okuma + aralik or (sayiyla and tp.okuma_sayac >= SABLON_OKUMA_ILETI)) and self.toplu_bekleyen(tp):
                tp.sablon_okuma = t; tp.okuma_sayac = 0
                st = self.meta["sablonlar"].get(ICERIK_SABLON[tp.sablon]) or {}
                if st.get("kategori") != "UTILITY":
                    tp.durum = "duraklatildi"; tp.neden = SABLON_PAZARLAMA
                    for x in tp.isler:
                        if x.durum in (BEKLIYOR, SINIR, BEKLEME_131049):
                            self.durum(x, DURAKLATILDI, t)

    # ---- durum, kontrol, sonuç ------------------------------------------------------------------------------------------------
    def durum(self, j, yeni, t):
        j.durum = yeni
        if yeni in (KABUL, GONDERILDI):
            self.ttl_aktif[j.anahtar] = j
        else:
            self.ttl_aktif.pop(j.anahtar, None)

    def kontrol(self, o, t):
        sayi = {}
        for j in self.isler.values():
            sayi[j.durum] = sayi.get(j.durum, 0) + 1
        k = {
            "t": iso(t, self.tz),
            "durum_sayilari": dict(sorted(sayi.items())),
            "toplam_post": sum(self.post_hedef.values()),
            "toplam_kabul": len(self.kabul_kaydi),
            "pencere_farkli_alici": {w: len(self.pencere_kumesi(w, t)) for w in sorted(set(self.wabalar.values()))},
            "medya_silme": sum(j.silinen_n for j in self.isler.values()),
            "toplular": {e: self.toplular[e].durum for e in self.toplu_sira},
        }
        if not self.ozet:
            k["isler"] = {a: j.durum for a, j in sorted(self.isler.items())}
        self.kontroller[o["ad"]] = k

    def sonuc(self):
        isler = {}
        for k, j in sorted(self.isler.items()):
            isler[k] = {
                "durum": j.durum, "telefon": j.telefon, "sablon": ICERIK_SABLON[self.toplular[j.toplu].sablon] if j.toplu in self.toplular else None,
                "degiskenler": j.icerik["degiskenler"] if j.icerik else None,
                "pdf": j.icerik["pdf"] if j.icerik else None,
                "dosya_adi": j.icerik["dosya_adi"] if j.icerik else None,
                "hata_kodu": j.kod, "post": j.post, "kabul": len(j.wamidler), "meta_ileti": j.meta_sayi,
                "medya_yukleme": len(j.medyalar), "medya_silme": j.silinen_n, "atlanma_nedeni": j.elendi_neden,
            }

        def topla(alan):
            o = {}
            for j in self.isler.values():
                o[j.cari] = o.get(j.cari, 0) + alan(j)
            return dict(sorted(o.items()))
        # §7a 19: "Bu Ay Gönderilen İleti Sayısı" = TESLİM edilen (Teslim + Okundu), ay = teslim zamanı (Türkiye saati), kapsam WABA
        bu_ay = {}
        kayitlar = ([(self.wabalar[self.toplular[j.toplu].sirket], j.kabul_t if "M43" in self.mut else t_) for (j, t_) in self.teslim_kaydi]
                    if "M31" not in self.mut else [(w, t_) for (t_, w, *_r) in self.kabul_kaydi])
        for waba, t_ in kayitlar:
            b = bu_ay.setdefault(waba, {}).setdefault(ay(t_), {"teslim": 0})
            b["teslim"] += 1
        for kv in bu_ay.values():
            for b in kv.values():
                b["yaklasik_usd"] = str((UCRET_USD * b["teslim"]).quantize(Decimal("0.0001")))
        for j in self.isler.values():
            if j.silinen_n and j.durum in (KABUL, GONDERILDI, BELIRSIZ):
                self.degismez["kesin_oncesi_medya_silme"] += 1
        sayi = {}
        for j in self.isler.values():
            sayi[j.durum] = sayi.get(j.durum, 0) + 1
        sonuc = {
            "baslamadi": dict(sorted(self.baslamadi.items())),
            "elenen": {k: dict(sorted(v.items())) for k, v in sorted(self.elenen.items()) if v},
            "olusmadi": sorted(self.olusmadi),
            "ayni_istek": dict(sorted(self.ayni_istek.items())),
            "onceki_uyari": dict(sorted(self.onceki_uyari.items())),
            "toplular": {e: {"durum": self.toplular[e].durum, "neden": self.toplular[e].neden, "is_sayisi": len(self.toplular[e].isler)} for e in self.toplu_sira},
            "durum_sayilari": dict(sorted(sayi.items())),
            "meta": {"post": topla(lambda j: j.post), "kabul": topla(lambda j: len(j.wamidler)), "meta_ileti": topla(lambda j: j.meta_sayi),
                     "medya_yukleme": topla(lambda j: len(j.medyalar)), "medya_silme": topla(lambda j: j.silinen_n),
                     "toplam_post": sum(self.post_hedef.values()), "toplam_kabul_program": len(self.kabul_kaydi),
                     "toplam_meta_ileti": len(self.meta_mesajlari), "toplam_medya_yukleme": self.medya_toplam},
            "kontroller": self.kontroller,
            "bu_ay": {k: dict(sorted(v.items())) for k, v in sorted(bu_ay.items())},
            "degismez": dict(self.degismez),
        }
        if self.ozet:
            sonuc["meta"] = {k: v for k, v in sonuc["meta"].items() if k.startswith("toplam")}
            sonuc["isler_ornek"] = {k: isler[k] for k in sorted(isler)[:3]}
            sonuc["isler_post_dagilimi"] = dict(sorted({str(n): sum(1 for j in self.isler.values() if j.post == n) for n in {j.post for j in self.isler.values()}}.items()))
        else:
            sonuc["isler"] = isler
        return sonuc


# ---- birleştirme (zaman serbestliği) ----------------------------------------------------------------------------------------

def _metin(d):
    return json.dumps(d, sort_keys=True, ensure_ascii=False)


def birlestir(degerler):
    """Aynı yapıdaki sonuçları birleştirir: hepsinde aynı → değer; ayrışan yaprak → {"biri": sıralı benzersiz}."""
    if all(isinstance(d, dict) and set(d) != {"biri"} and set(d) != {"kisaltilabilir"} and "plan_susuyor" not in d for d in degerler):
        anahtarlar = []
        for d in degerler:
            for k in d:
                if k not in anahtarlar:
                    anahtarlar.append(k)
        return {k: birlestir([d.get(k, "<YOK>") for d in degerler]) for k in anahtarlar}
    if all(_metin(d) == _metin(degerler[0]) for d in degerler):
        return degerler[0]
    benzersiz = {}
    for d in degerler:
        for a in (d["biri"] if isinstance(d, dict) and set(d) == {"biri"} else [d]):
            benzersiz[_metin(a)] = a
    return {"biri": [benzersiz[k] for k in sorted(benzersiz)]}


def secim_birlesimleri(serbest):
    adlar = list(serbest)
    for degerler in itertools.product(*[SERBEST[a] for a in adlar]):
        yield dict(zip(adlar, degerler))


def tam_secim(kismi):
    s = {k: v[0] for k, v in SERBEST.items()}
    s.update(kismi)
    return s


def hesapla_tek(sen, kismi=None, mut=frozenset()):
    return birlestir([Benzetim(sen, tam_secim(kismi or {}), zaman, mut).calistir() for zaman in ZAMANLAR])


def hesapla(sen, mut=frozenset()):
    """Senaryonun beklenen sonucu: [{secimler, sonuc}] (SERBEST boş olduğundan tek grup)."""
    if sen.get("serbest"):
        raise ValueError("senaryo serbest seçim bildiriyor ama §7a hepsini kararlaştırdı")
    gruplar = []
    for kismi in secim_birlesimleri([]):
        gruplar.append({"secimler": [kismi], "sonuc": hesapla_tek(sen, kismi, mut)})
    return gruplar


def yol_al(o, yol):
    for p in yol.split("."):
        if isinstance(o, dict) and p in o:
            o = o[p]
        else:
            return "<YOK>"
    return o


def grup_bul(beklenen, secim):
    for g in beklenen:
        for s in g["secimler"]:
            if all(secim.get(k) == v for k, v in s.items()):
                return g
    return None


def karsilastir(beklenen, program, secim=None):
    """beklenen: hesapla() çıktısı; program: aynı biçimde tek sonuç (sürücü üretir) → farklar listesi.
    {"biri": [...]} yaprağında program değeri listeden biri olmalı; {"plan_susuyor": …} denetlenmez; {"kisaltilabilir": tam} önek kabul eder."""
    grup = grup_bul(beklenen, tam_secim(secim or {}))
    if grup is None:
        return ["seçim hiçbir gruba uymuyor"]
    farklar = []

    def gez(b, p, yol):
        if isinstance(b, dict) and set(b) == {"biri"}:
            if p not in b["biri"]:
                farklar.append(f"{yol}: beklenen şunlardan biri {b['biri']}, program {p!r}")
            return
        if isinstance(b, dict) and "plan_susuyor" in b:
            return
        if isinstance(b, dict) and set(b) == {"kisaltilabilir"}:
            on = str(p).rstrip("…").rstrip() if isinstance(p, str) else ""
            if not on or not b["kisaltilabilir"].startswith(on):
                farklar.append(f"{yol}: beklenen {b['kisaltilabilir'][:40]!r}… ya da öneki, program {p!r}")
            return
        if isinstance(b, dict):
            if not isinstance(p, dict):
                farklar.append(f"{yol}: beklenen nesne, program {p!r}")
                return
            for k, v in b.items():
                gez(v, p.get(k, "<YOK>"), f"{yol}.{k}" if yol else k)
            return
        if b != p:
            farklar.append(f"{yol}: beklenen {b!r}, program {p!r}")
    gez(grup["sonuc"], program, "")
    return farklar


def main(argv):
    if len(argv) >= 2 and argv[0] == "hesapla":
        with open(argv[1], encoding="utf-8") as f:
            veri = json.load(f)
        liste = veri if isinstance(veri, list) else [veri]
        cikti = [{"ad": s.get("ad"), "beklenen": hesapla(s)} for s in liste]
        json.dump(cikti if isinstance(veri, list) else cikti[0], sys.stdout, ensure_ascii=False, indent=1)
        print()
        return 0
    if len(argv) >= 3 and argv[0] == "karsilastir":
        with open(argv[1], encoding="utf-8") as f:
            beklenen = json.load(f)
        with open(argv[2], encoding="utf-8") as f:
            program = json.load(f)
        farklar = karsilastir(beklenen.get("beklenen", beklenen) if isinstance(beklenen, dict) else beklenen, program)
        for f_ in farklar:
            print("FARK", f_)
        print(f"{len(farklar)} fark")
        return 1 if farklar else 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
