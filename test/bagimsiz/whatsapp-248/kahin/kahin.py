#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WhatsApp toplu gönderim KÂHİNİ — DestekOfis 2.4.8 K0 (temiz oda; yalnız standart kütüphane).

Kaynak YALNIZ plan: docs/erp/WHATSAPP-API-PLANI-2.4.8.md (§1, §2.2–§2.7, §3, §4, §6 W2–W6, §8, §11 S1–S4 = A) + CLAUDE.md kararları.
Programın kodu (server/, client/, bulut/) GÖRÜLMEDİ. Meta davranışı (kanca biçimi, "read, delivered'ı içerir", 7 gün yeniden deneme,
TTL'de teslim edilmeyen ileti düşer) Meta belgesinden. Planın sustuğu her nokta bir SERBEST SEÇİM'dir (SERBEST): kâhin karar VERMEZ
(ders 40/43), her seçeneğin sonucunu ayrı verir; seçim yapılınca sürücü o birleşimle karşılaştırır.

Planın uygulamaya bıraktığı serbestlikler (toplu iş içindeki gönderim SIRASI, işçinin adım süresi "~1 sn", geçici bekleme dizisi
"30 sn → 15 dk") İKİ UÇLA koşulur: sıra ∈ {seçim, ters}, zaman ∈ {hızlı: 0,5 sn adım + 30 sn bekleme, yavaş: 5 sn adım + 15 dk
bekleme}. Dört koşuda aynı çıkan değer KESİN beklenendir; ayrışan değer {"biri": [...]} olur (program bunlardan birini vermeli).

Komut satırı:
  python3 -I kahin.py hesapla senaryo.json                    # bir senaryo (ya da liste) → beklenen (JSON)
  python3 -I kahin.py karsilastir beklenen.json program.json --secim 'uretim_ani=baslatma,...'
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

# Plan §6 W2: ekran durumları (adlar AYNEN plandan)
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
DURUM_BILINMIYOR = "Durum Bilinmiyor"
LISANS = "Lisans Nedeniyle Durdu"          # plan §4
TASINAN = "Taşınan Veri — Durduruldu"      # plan §6 W2
# Planın adını VERMEDİĞİ durumlar (PLAN SUSUYOR) — kâhinin iç adı; sürücü "gönderim yok + ileri gitmedi" diye denetler:
DURDU_GERI_YUKLEME = "PLAN-SUSUYOR:geri-yukleme-durdu"
ELENDI_KUYRUK = "PLAN-SUSUYOR:kuyrukta-elendi"
BEKLEME_131049 = "PLAN-SUSUYOR:131049-bekleme"
SORULUYOR = "PLAN-SUSUYOR:24-saatten-eski-devam-sorusu"

SIRA = {KABUL: 1, GONDERILDI: 2, TESLIM: 3, OKUNDU: 4}
KESIN = {TESLIM, OKUNDU, BASARISIZ, SURESI_DOLDU}
CALISIR = (BEKLIYOR, SINIR, BEKLEME_131049)                # işçinin alabileceği durumlar
GERI_DONEBILIR = {BEKLIYOR, SINIR, BEKLEME_131049, HAZIRLANIYOR, DURAKLATILDI, LISANS, SORULUYOR, GONDERILIYOR}
DURDURULABILIR = {BEKLIYOR, SINIR, BEKLEME_131049, HAZIRLANIYOR, DURAKLATILDI, SORULUYOR, LISANS}

# Plan §6 W2 hata sınıfları (AYNEN)
DURAKLATAN = {0, 190, 10, 131005, 368, 131031, 131042, 133010, 131045, 132001, 132000, 132012, 132018, 132007, 132015, 132016}
DURAKLATAN_ARALIK = range(200, 300)
ALICI = {131026, 131021, 131009}
GECICI = {131000, 131016, 130429, 80007, 4, 131057}
ICERIK_SABLON = {"ekstre": "destekofis_ekstre", "hatirlatma": "destekofis_odeme_hatirlatma"}
TTL = 72 * SA          # §11 S2 A: utility TTL 3 gün
TTL_PAYI = 1 * SA      # §6 W2: "TTL + 1 saat geçti, teslim yok"
KANCA_OMRU = 7 * GUN   # Meta: 7 güne kadar yeniden deneme; §6 W2 "Durum Bilinmiyor (kanca 7 günde gelmedi)"
UCRET_USD = Decimal("0.0009")  # §2.6 Türkiye utility

# PLAN SUSUYOR → serbest seçimler (README "PLAN SUSUYOR" ile aynı sıra). Seçenek sırası anlam taşımaz.
SERBEST = {
    "uretim_ani": ("baslatma", "isleme"),
    "kuyruk_degisimi": ("gonderilir", "elenir"),
    "belirsiz_cozum": ("opaque_cozer", "bilinmeyen_duser"),
    "sinir_mevcut_alici": ("gecer", "bekler"),
    "sabit_hat": ("gonderilir", "elenir"),
    "yurtdisi": ("gonderilir", "elenir"),
    "belirsiz_sonrasi": ("surer", "durur"),
    "baglanti_kurulamadi": ("belirsiz", "gecici"),
    "medya_tekrar": ("ayni", "yeni"),
    "kancasiz_son": ("suresi_doldu", "durum_bilinmiyor"),
    "gec_teslim": ("yok_sayilir", "teslim_yazilir"),
    "teslim_ay": ("kabul", "teslim"),
    "eski_toplu_sinir": ("sorulur", "surer"),
    "sinir_hatasi_kapsam": ("toplu", "waba"),
}
SIRALAR = ("secim", "ters")
ZAMANLAR = ("hizli", "yavas")
ADIM = {"hizli": 500, "yavas": 5 * SN}
GECICI_BEKLEME = {"hizli": 30 * SN, "yavas": 15 * DK}

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
    "M10": "hesap/şablon hatası toplu işi duraklatmaz (iş başarısız, sürer)",
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
    "M24": "Sonucu Belirsiz 'Meta Kabul Etti' sayacına girer",
    "M25": "çift başlatmada çakışan cariye ikinci ileti",
    "M27": "24 saatten eski toplu iş yeniden açılışta kendiliğinden sürer",
    "M28": "program kapalıyken gelen kanca kaybolur (Meta yeniden denemesi yok sayılır)",
    "M29": "Süresi Doldu'da PDF silinmez",
    "M30": "failed 131026 işi Başarısız yapmaz",
    "M31": "'Meta Kabul Etti' sayacı her POST'u sayar",
    "M32": "alıcı hatası (131009) toplu işi duraklatır",
    "M34": "mesajdaki bakiye dönemden bağımsız (PDF ile ayrışır)",
    "M35": "Meta sınır hatası işi Başarısız yapar",
    "M36": "yeniden denemede silinmiş medya kimliği kullanılır",
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


def ay(ms, tz):
    return datetime.fromtimestamp(ms / 1000, tz).strftime("%Y-%m")


def temizle(s):
    """§2.2: değişken değerleri tek satıra indirilir (satır sonu, sekme, çok boşluk). Kâhin: her boşluk dizisi tek boşluk, uçlar kırpılır."""
    return re.sub(r"\s+", " ", str(s)).strip()


KISALTMA_ESIGI = 60   # D0: Meta değişken uzunluk sınırı yerel belgede yok; bu eşiği aşan değer "kısaltılabilir" (program önekini verebilir)


def deger(s):
    """Değişken değeri: temizlenmiş metin; eşiği aşarsa {"kisaltilabilir": tam} (§2.2 "program değerleri … kısaltır", sınır D0)."""
    t = temizle(s)
    return t if len(t) <= KISALTMA_ESIGI else {"kisaltilabilir": t}


def para(d):
    """§8 örneği '1.250,00 TL'. Eksi (alacaklı) bakiyenin metni PLAN SUSUYOR."""
    d = Decimal(d).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if d < 0:
        return {"plan_susuyor": "eksi bakiye metni", "tutar": str(d)}
    tam, kesir = f"{d:.2f}".split(".")
    return "{:,}".format(int(tam)).replace(",", ".") + f",{kesir} TL"


def numara(ham):
    """Telefon → ('+90…', tür) ya da (None, neden). Plan §2.2: waNumber() '905…' verir, '+' ile gönderilir; §8: hücrede birden çok
    numara varsa İLKİ. Kâhinin yorumu yalnız açık biçimler için: '0' + 10 hane, '90' + 10 hane, '+' ile başlayan. Öbürü 'gecersiz'."""
    if ham is None:
        return None, "telefonsuz"
    ilk = re.split(r"\s*[/,;]\s*", str(ham).strip())[0]
    r = re.sub(r"\D", "", ilk)
    if not r:
        return None, "telefonsuz"
    if ilk.strip().startswith("+"):
        e = r
    elif r.startswith("0") and len(r) == 11:
        e = "90" + r[1:]
    elif r.startswith("90") and len(r) == 12:
        e = r
    else:
        return None, "gecersiz"
    if e.startswith("90"):
        if len(e) != 12:
            return None, "gecersiz"
        return "+" + e, ("mobil" if e[2] == "5" else "sabit")
    return "+" + e, "yurtdisi"


# ---- iş / toplu iş ---------------------------------------------------------------------------------------------------------

class Is:
    def __init__(self, anahtar, toplu, cari):
        self.anahtar = anahtar; self.toplu = toplu; self.cari = cari
        self.durum = BEKLIYOR; self.telefon = None; self.icerik = None; self.next_at = 0
        self.post = 0; self.medyalar = []; self.silinen_n = 0; self.wamidler = []   # silme yalnız kesinleşmede, o ana dek yüklenenlerin HEPSİ → önek
        self.kod = None; self.deneme_49 = 0; self.teslim_t = None; self.kabul_t = None
        self.belirsiz_t = None; self.kanca_geldi = False; self.elendi_neden = None; self.meta_sayi = 0


class Toplu:
    def __init__(self, etiket, sablon, donem, sirket, t, kullanici):
        self.etiket = etiket; self.sablon = sablon; self.donem = donem; self.sirket = sirket; self.t = t; self.kullanici = kullanici
        self.isler = []; self.durum = "aktif"; self.neden = None; self.gecici = 0
        self.bas = 0   # ilk olası çalışabilir işin sırası (büyük senaryoda O(n²) taramayı önler)


class Benzetim:
    def __init__(self, sen, secim, sira="secim", zaman="hizli", mut=frozenset()):
        self.sen = sen; self.s = secim; self.sira = sira; self.zaman = zaman; self.mut = set(mut)
        self.T0 = zaman_ayristir(sen["baslangic"], 0)
        self.tz = datetime.fromisoformat(sen["baslangic"]).tzinfo or timezone.utc
        self.adim = ADIM[zaman]; self.gbekle = GECICI_BEKLEME[zaman]
        self.ayar = {"bagli": True, "onay": True, "gunluk_ust_sinir": None, "lisans_yazilabilir": True, **sen.get("ayar", {})}
        self.kullanicilar = sen.get("kullanicilar", {"yonetici": {"whatsapp.send": True}})
        self.cariler = {c["id"]: {"sirket": "A", "istemiyor": False, "silindi": False, "hareketler": [], **copy.deepcopy(c)} for c in sen["cariler"]}
        self.firmalar = sen.get("firmalar", {"A": "Deneme Ticaret Ltd. Şti."})
        self.wabalar = sen.get("wabalar", {"A": "W1"})
        m = sen.get("meta", {})
        self.meta = {"basamak": m.get("basamak", 250), "kapali": False,
                     "sablonlar": {"destekofis_ekstre": {"durum": "APPROVED", "kategori": "UTILITY"},
                                   "destekofis_odeme_hatirlatma": {"durum": "APPROVED", "kategori": "UTILITY"}, **copy.deepcopy(m.get("sablonlar", {}))}}
        self.davranis = sen.get("meta_davranis", {})
        self.toplular = {}; self.toplu_sira = []; self.isler = {}
        self.pencere = {}            # waba → {alıcı: son kabul t} — program sayacı (makine düzeyi, şirket dosyası dışında, WABA'ya göre)
        self.kabul_kaydi = []        # (t, waba, sirket, alici, anahtar)
        self.teslim_kaydi = []       # (is, t)
        self.post_kaydi = []         # (t, waba, sirket)
        self.program_basamak = {}; self.son_okuma = {}
        self.blok = {}
        self.acik = True; self.tunel = True; self.lisans = self.ayar["lisans_yazilabilir"]
        self.isci_bos = self.T0
        self.post_hedef = {}         # hedef → POST sayısı (sahte Meta'nın (messages, to) deneme sayacıyla aynı anahtar)
        self.medya_toplam = 0        # sahte Meta medya isteğinde alıcı bilmez → medya kuralları GENEL sırayla
        self.meta_mesajlari = {}     # wamid → iş (Meta'da var olan iletiler; program bilsin bilmesin)
        self.wamid_is = {}           # wamid → iş (programın bildiği)
        self.kancalar = []; self.kanca_sira = 0
        self.meta_kuyruk = []
        self.ttl_aktif = {}          # anahtar → iş (Meta Kabul Etti / Gönderildi)
        self.bitis = zaman_ayristir(sen["bitis"], self.T0) if sen.get("bitis") else self.T0 + 10 * GUN   # en geç denetim +8 gün; TTL 73 sa ve 7 gün kuralı içinde
        self.cokme = None; self.cokme_t = None
        self.kontroller = {}; self.baslamadi = {}; self.elenen = {}; self.bos = []
        self.ozet = bool(sen.get("ozet_cikti"))
        self.degismez = {"silinmis_medyayla_gonderim": 0, "kesin_oncesi_medya_silme": 0,
                         "artisiz_numaraya_gonderim": 0, "lisanssiz_gonderim": 0, "duraklatilmis_toplu_gonderim": 0}
        self.olaylar = []
        for i, o in enumerate(sen.get("olaylar", [])):
            if o["tur"] == "cokme":
                self.cokme = dict(o)   # senaryo nesnesi DEĞİŞMEZ (aynı senaryo birçok kez koşar)
                continue
            self.olaylar.append([zaman_ayristir(o["t"], self.T0), i, o])   # None → çökmeye göreli

    # ---- zaman çizelgesi --------------------------------------------------------------------------------------------------
    def calistir(self):
        t = self.T0
        for _ in range(1_000_000):
            adaylar = [o[0] for o in self.olaylar if o[0] is not None]
            if self.kancalar:
                adaylar.append(self.kancalar[0][0])
            if self.acik:
                ttl = self.ttl_zamani()
                if ttl is not None:
                    adaylar.append(max(ttl, t))
                ok = self.okuma_zamani()
                if ok is not None:
                    adaylar.append(max(ok, t))
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
            for k in ("telefon", "istemiyor", "silindi", "ad"):
                if k in o:
                    c[k] = o[k]
            if "hareket_ekle" in o:
                c["hareketler"].append(o["hareket_ekle"])
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
            if not self.lisans:
                for tp in self.toplular.values():
                    for j in tp.isler:
                        if j.durum in (BEKLIYOR, SINIR, HAZIRLANIYOR, BEKLEME_131049):
                            self.durum(j, LISANS, t)
        elif tur in ("duraklat", "devam", "iptal"):
            tp = self.toplular[o["toplu"]]
            if tur == "duraklat":
                tp.durum = "duraklatildi"; tp.neden = "kullanici"
                for j in tp.isler:
                    if j.durum in (BEKLIYOR, SINIR):
                        self.durum(j, DURAKLATILDI, t)
            elif tur == "devam":
                tp.durum = "aktif"; tp.neden = None; tp.gecici = 0; tp.bas = 0
                for j in tp.isler:
                    if j.durum in (DURAKLATILDI, SORULUYOR):
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
                    self.durum(j, BEKLIYOR, t); j.next_at = t; j.kod = None
            if tp.durum != "iptal":
                tp.durum = "aktif"
            tp.bas = 0
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
                        self.durum(j, TASINAN if tur == "tasindi" else DURDU_GERI_YUKLEME, t)
        elif tur == "meta_basamak":
            self.meta["basamak"] = o["basamak"]
        elif tur == "meta_sablon":
            st = self.meta["sablonlar"].setdefault(o["ad"], {"durum": None, "kategori": None})
            for k in ("durum", "kategori"):
                if k in o:
                    st[k] = o[k]
        elif tur == "meta_kapali":
            self.meta["kapali"] = o["kapali"]
        elif tur == "sahte_kanca":
            self.kanca_planla(t, o.get("wamid", "wamid.SAHTE"), o["durum"], o.get("kod"), {"opaque": o.get("opaque"), "sahte": True})
        else:
            raise ValueError(f"bilinmeyen olay: {tur}")

    def ac(self, t):
        self.acik = True
        self.isci_bos = max(self.isci_bos, t)
        self.sifirla_bas()
        for tp in self.toplular.values():
            for j in tp.isler:
                if j.durum == GONDERILIYOR:        # §6 W2: yanıtsız istek (program kapandı) → Sonucu Belirsiz
                    self.belirsiz(j, tp, t)
                elif j.durum == HAZIRLANIYOR:
                    self.durum(j, BEKLIYOR, t)
            bitmemis = any(j.durum in CALISIR for j in tp.isler)
            if bitmemis and tp.durum == "aktif" and t - tp.t > GUN and "M27" not in self.mut:   # §6 W2: 24 sa'ten eski kendiliğinden SÜRMEZ
                sinirda = any(j.durum == SINIR for j in tp.isler)
                if not (sinirda and self.s["eski_toplu_sinir"] == "surer"):
                    tp.durum = "soruluyor"
                    for j in tp.isler:
                        if j.durum in CALISIR:
                            self.durum(j, SORULUYOR, t)

    # ---- başlatma -----------------------------------------------------------------------------------------------------------
    def baslat(self, o, t):
        etiket = o["etiket"]; sirket = o.get("sirket", "A"); sablon = o.get("sablon", "ekstre")
        kullanici = o.get("kullanici", "yonetici")
        neden = None
        st = self.meta["sablonlar"].get(ICERIK_SABLON[sablon]) or {}
        if not self.ayar["bagli"]:
            neden = "bagli_degil"                                         # §1: API ayarı yoksa yalnız wa.me
        elif not self.kullanicilar.get(kullanici, {}).get("whatsapp.send") and "M18y" not in self.mut:
            neden = "yetki_yok"                                           # §4 whatsapp.send
        elif not self.lisans and "M18" not in self.mut:
            neden = "lisans_salt_okunur"                                  # §4
        elif not self.ayar["onay"] and "M17" not in self.mut:
            neden = "onay_yok"                                            # §1 bir kez onay
        elif "M8" not in self.mut and (st.get("durum") != "APPROVED" or st.get("kategori") != "UTILITY"):
            neden = "sablon_uygun_degil"                                  # §2.4 / W5
        if neden:
            self.baslamadi[etiket] = neden
            return
        waba = self.wabalar[sirket]
        self.program_basamak[waba] = self.meta["basamak"]; self.son_okuma[waba] = t   # §6 W2: basamak gönderimden önce okunur
        tp = Toplu(etiket, sablon, o.get("donem"), sirket, t, kullanici)
        self.toplular[etiket] = tp; self.toplu_sira.append(etiket)
        elenen = {}; goruldu = set()
        for cid in o["secim"]:
            if cid in goruldu and "M5" not in self.mut:
                continue                                                  # UNIQUE(batch_id, account_id)
            goruldu.add(cid)
            c = self.cariler[cid]
            if c["silindi"]:
                elenen[cid] = "silindi"; continue
            if c["istemiyor"] and "M2" not in self.mut:
                elenen[cid] = "istemiyor"; continue                       # §1 / W6
            tel, tur_ = numara(c.get("telefon"))
            if tel is None:
                elenen[cid] = tur_; continue
            if tur_ == "sabit" and self.s["sabit_hat"] == "elenir":
                elenen[cid] = "sabit_hat"; continue
            if tur_ == "yurtdisi" and self.s["yurtdisi"] == "elenir":
                elenen[cid] = "yurtdisi"; continue
            if o.get("cift") and "M25" not in self.mut and self.cift_var(cid, sablon, o.get("donem"), sirket):
                elenen[cid] = "cift"; continue                            # §8 ÇİFT (senaryo bu başlatmayı çift diye işaretler)
            anahtar = f"{etiket}/{cid}"
            sayi = 1
            while anahtar in self.isler:                                  # yalnız M5 mutasyonunda
                sayi += 1; anahtar = f"{etiket}/{cid}#{sayi}"
            j = Is(anahtar, etiket, cid)
            j.next_at = t
            if self.s["uretim_ani"] == "baslatma":
                j.telefon = tel[1:] if "M16" in self.mut else tel
                j.icerik = self.icerik(c, tp, t)
            self.isler[anahtar] = j
            tp.isler.append(j)
        if self.sira == "ters":
            tp.isler.reverse()
        self.elenen[etiket] = elenen
        if not tp.isler:
            self.bos.append(etiket)

    def cift_var(self, cid, sablon, donem, sirket):
        for tp in self.toplular.values():
            if tp.sablon == sablon and tp.donem == donem and tp.sirket == sirket:
                for j in tp.isler:
                    if j.cari == cid and j.durum not in (BASARISIZ, IPTAL):
                        return True
        return False

    # ---- içerik (değişkenler + PDF) -----------------------------------------------------------------------------------------
    def icerik(self, c, tp, t):
        ad = deger(c["ad"]); firma = deger(self.firmalar[tp.sirket])
        tam_ad = temizle(c["ad"])
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
                    donem_h = [(tr, d) for tr, d in hareketler if bas <= tr <= son]   # iki uç dahil (PLAN SUSUYOR 22; W3 fark testi bağlar)
                if "M14" in self.mut:
                    devir = Decimal("0")
            sonu = devir + sum((d for _, d in donem_h), Decimal("0"))
            mesaj_bakiye = sum((d for _, d in hareketler), Decimal("0")) if "M34" in self.mut else sonu
            return {
                "degiskenler": [ad, firma, {"donem": [bas, son]}, para(mesaj_bakiye)],
                "pdf": {"cari_ad": ad, "donem_bas": bas, "donem_son": son, "devir": str(devir.quantize(Decimal("0.01"))),
                        "hareket_sayisi": len(donem_h), "donem_sonu_bakiye": str(sonu.quantize(Decimal("0.01")))},
                "dosya_adi": {"on_ek": f"Ekstre {tam_ad} " if isinstance(ad, str) else {"kisaltilabilir": f"Ekstre {tam_ad}"}, "son_ek": ".pdf"},
            }
        bugun = tarih(t, self.tz)
        bakiye = sum((d for tr, d in hareketler if tr <= bugun), Decimal("0"))
        return {"degiskenler": [ad, firma, {"plan_susuyor": "vade"}, {"plan_susuyor": "tutar"}, para(bakiye)], "pdf": None, "dosya_adi": None}

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
        if "M6" in self.mut:   # takvim günü
            gun_bas = int(datetime.fromtimestamp(t / 1000, self.tz).replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
            return {a: x for a, x in p.items() if x >= gun_bas}
        return {a: x for a, x in p.items() if x > t - GUN}

    def sigar(self, kume, alici, L):
        if self.s["sinir_mevcut_alici"] == "gecer":
            return len(kume) + (0 if alici in kume else 1) <= L
        return len(kume) < L

    def oda_zamani(self, waba, alici, t, L, onbellek):
        """Bu alıcıya en erken ne zaman gönderilebilir (program sayacı; gönderilmeyen işler pencereyi değiştirmez → adım içinde önbellek)."""
        if "M1" in self.mut:
            k = onbellek.setdefault(("m1", waba), sorted(x for (x, w, *_r) in self.kabul_kaydi if w == waba and x > t - GUN))
            return t if len(k) < L else k[len(k) - L] + GUN
        p = self.pencere.get(waba, {})
        if len(p) < L and "M6" not in self.mut:
            return t                                   # hızlı yol: bütün zamanların farklı alıcısı bile sınırın altında
        kk = ("kume", waba)
        if kk not in onbellek:
            onbellek[kk] = self.pencere_kumesi(waba, t)
        kume = onbellek[kk]
        if self.sigar(kume, alici, L):
            return t
        anahtar = ("oda", waba, (alici in kume) if self.s["sinir_mevcut_alici"] == "gecer" else None)
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
            kalan = {a: y for a, y in zamanlar[i + 1:] if y > aday - GUN}
            if self.sigar(kalan, alici, L):
                sonuc = aday
                break
        onbellek[anahtar] = sonuc
        return sonuc

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
                if c["silindi"] or c["istemiyor"]:                          # kuyrukta değişim (PLAN SUSUYOR 2)
                    if (c["silindi"] and self.s["uretim_ani"] == "isleme") or self.s["kuyruk_degisimi"] == "elenir":
                        j.elendi_neden = "silindi" if c["silindi"] else "istemiyor"
                        self.durum(j, ELENDI_KUYRUK, t)
                        continue
                if self.s["uretim_ani"] == "isleme" or j.icerik is None:   # PLAN SUSUYOR 1
                    tel, tur_ = numara(c.get("telefon"))
                    if tel is None or (tur_ == "sabit" and self.s["sabit_hat"] == "elenir") or (tur_ == "yurtdisi" and self.s["yurtdisi"] == "elenir"):
                        j.elendi_neden = tur_
                        self.durum(j, ELENDI_KUYRUK, t)
                        continue
                    j.telefon = tel[1:] if "M16" in self.mut else tel
                    j.icerik = self.icerik(c, tp, t)
                blok = max(self.blok.get(("waba", waba), 0), self.blok.get(("toplu", tp.etiket), 0))
                if blok > t:                                              # Meta sınır hatası: kalanlar 24 saat bekler
                    self.durum(j, SINIR, t); j.next_at = blok
                    continue
                oda = self.oda_zamani(waba, j.telefon, t, self.sinir_degeri(waba), onbellek)
                if oda is None or oda > t:                                # §6 W2 kayan 24 sa, FARKLI alıcı
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
            yanit = liste                                  # her denemede aynı
        else:
            yanit = liste[deneme - 1] if deneme - 1 < len(liste) else "kabul"
        if yanit == "kabul":                               # Meta'nın şablon durumu (sahte sunucu: PENDING/REJECTED/yok 132001, PAUSED 132015, DISABLED 132016)
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
        if self.meta["kapali"]:
            return "baglanti_reddi"
        liste = self.davranis.get("medya", [])
        return liste[self.medya_toplam - 1] if self.medya_toplam - 1 < len(liste) else "kabul"

    def gonder(self, j, tp, waba, t):
        ts = t + self.adim
        self.isci_bos = ts
        self.durum(j, HAZIRLANIYOR, t)
        if tp.sablon == "ekstre":                           # §2.3 / W3: PDF programdan Meta'ya yüklenir
            canli = len(j.medyalar) > j.silinen_n or ("M36" in self.mut and j.medyalar)   # M36: silinmiş olsa da son medya kullanılır
            if not canli or (self.s["medya_tekrar"] == "yeni" and j.post > 0):
                while True:
                    if self.meta["kapali"]:
                        return self.baglanti_reddi(j, tp, ts)
                    self.medya_toplam += 1
                    y = self.meta_yanit_medya()
                    if y == "kabul":
                        j.medyalar.append(f"m:{j.anahtar}#{len(j.medyalar) + 1}")
                        break
                    if y == "yanitsiz":                     # §6 W2: medya yükleme yanıtsızsa yeniden yüklenir
                        continue
                    raise ValueError(f"senaryo medya yanıtı modellenmedi: {y}")
        self.durum(j, GONDERILIYOR, ts)                     # §6 W2: istekten ÖNCE yazılır
        c = self.cokme
        if c and not c.get("oldu") and c.get("cari") == j.cari and c.get("toplu", tp.etiket) == tp.etiket:
            c["oldu"] = True
            if c.get("istek_ulasti", True):
                self.post_say(j, tp, ts)
                self.meta_ileti(j, ts, programa=False)
            self.acik = False
            self.cokme_t = ts
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
        if tp.sablon == "ekstre" and len(j.medyalar) <= j.silinen_n:   # kullanılacak (son) medya silinmiş ya da yok
            self.degismez["silinmis_medyayla_gonderim"] += 1
        if self.meta["kapali"]:
            return self.baglanti_reddi(j, tp, ts)
        y = self.meta_yanit_mesaj(j, self.post_hedef.get(j.telefon, 0) + 1)
        self.post_say(j, tp, ts)
        if y == "kabul":
            self.meta_ileti(j, ts, programa=True)
            if "M4" in self.mut:
                self.kesinlesti(j, ts)
            tp.gecici = 0
            return
        if y in ("yanitsiz_kabul", "yanitsiz_red"):
            if y == "yanitsiz_kabul":
                self.meta_ileti(j, ts, programa=False)
            if "M24" in self.mut:
                self.kabul_kaydi.append((ts, waba, tp.sirket, j.telefon, j.anahtar))
            if "M3" in self.mut:
                self.durum(j, BEKLIYOR, ts); j.next_at = ts + self.gbekle
                return
            return self.belirsiz(j, tp, ts)
        if isinstance(y, dict) and y.get("sinir"):          # Meta sınır hatası (kodu D0): kalanlar 24 saat bekler
            if "M35" in self.mut:
                self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
                return
            kapsam = ("waba", waba) if self.s["sinir_hatasi_kapsam"] == "waba" else ("toplu", tp.etiket)
            self.blok[kapsam] = ts + GUN
            self.durum(j, SINIR, ts); j.next_at = ts + GUN
            return
        self.hata_isle(j, tp, y["hata"], ts)

    def baglanti_reddi(self, j, tp, ts):
        """Bağlantı hiç kurulamadı (sahte sunucu kapalı): istek Meta'ya ULAŞMADI. Plan §6 W2 'ağ' → Belirsiz; PLAN SUSUYOR 11."""
        if self.s["baglanti_kurulamadi"] == "gecici":
            return self.hata_isle(j, tp, 131016, ts)
        return self.belirsiz(j, tp, ts)

    def belirsiz(self, j, tp, ts):
        self.durum(j, BELIRSIZ, ts); j.belirsiz_t = ts
        if self.s["belirsiz_sonrasi"] == "durur":
            tp.durum = "duraklatildi"; tp.neden = "belirsiz"
            for x in tp.isler:
                if x.durum in (BEKLIYOR, SINIR):
                    self.durum(x, DURAKLATILDI, ts)

    def hata_isle(self, j, tp, kod, ts):
        j.kod = kod
        self.durum(j, BEKLIYOR, ts)                         # kesin hata yanıtı: ileti gitmedi
        if kod in DURAKLATAN or kod in DURAKLATAN_ARALIK:
            if "M10" in self.mut:
                self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
                return
            return self.toplu_duraklat(tp, kod, ts)        # §6 W2: İLK hatada DURAKLAR
        if kod in ALICI:
            self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
            if "M32" in self.mut:
                self.toplu_duraklat(tp, kod, ts)
            return
        if kod == 131049:
            return self.k131049(j, tp, ts)
        if kod == 131056:
            j.next_at = ts + DK                             # §6 W2: o kişi 1 dk sonra
            return
        if kod in GECICI:
            tp.gecici += 1
            if tp.gecici >= 5 and "M9" not in self.mut:
                return self.toplu_duraklat(tp, kod, ts)    # §6 W2: 5 kez art arda → duraklar
            j.next_at = ts + self.gbekle
            return
        raise ValueError(f"PLAN SUSUYOR 12: {kod} kodunun sınıfı planda yok — senaryo bu kodu kullanamaz")

    def k131049(self, j, tp, t):
        """§6 W2: 131049 → o kişi 24 saat sonra en çok bir kez."""
        if j.deneme_49 >= 1 and "M20" not in self.mut:
            self.durum(j, BASARISIZ, t); self.kesinlesti(j, t)
            return
        j.deneme_49 += 1
        self.durum(j, BEKLEME_131049, t); j.next_at = t + (0 if "M19" in self.mut else GUN)
        tp.bas = 0

    def toplu_duraklat(self, tp, kod, ts):
        tp.durum = "duraklatildi"; tp.neden = kod
        for x in tp.isler:
            if x.durum in (BEKLIYOR, SINIR, HAZIRLANIYOR, BEKLEME_131049):
                self.durum(x, DURAKLATILDI, ts)

    def post_say(self, j, tp, ts):
        j.post += 1
        self.post_hedef[j.telefon] = self.post_hedef.get(j.telefon, 0) + 1
        self.post_kaydi.append((ts, self.wabalar[tp.sirket], tp.sirket))

    def meta_ileti(self, j, ts, programa):
        """Meta'da bir ileti oluştu (wamid). programa=True: yanıt geldi, program wamid'i bildi."""
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
            for _ in range(int(ek.get("tekrar", 1))):
                self.kanca_planla(varis, wamid, k[0], ek.get("kod"), ek)

    def programa_kabul(self, j, wamid, ts):
        tp = self.toplular[j.toplu]
        waba = self.wabalar[tp.sirket]
        j.wamidler.append(wamid); self.wamid_is[wamid] = j
        j.kabul_t = ts; j.kanca_geldi = False
        p = self.pencere.setdefault(waba, {})
        p[j.telefon] = max(p.get(j.telefon, 0), ts)
        self.kabul_kaydi.append((ts, waba, tp.sirket, j.telefon, j.anahtar))
        self.durum(j, KABUL, ts)

    # ---- kanca ----------------------------------------------------------------------------------------------------------------
    def kanca_planla(self, t, wamid, durum, kod, ek):
        self.kanca_sira += 1
        heapq.heappush(self.kancalar, (t, self.kanca_sira, wamid, durum, kod, ek))

    def kanca_varis(self, t, wamid, durum, kod, ek):
        if not (self.acik and self.tunel):
            if "M28" not in self.mut:
                self.meta_kuyruk.append((t, wamid, durum, kod, ek))   # Meta 7 güne kadar yeniden dener (kapıcı 503 döner)
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
        j = self.wamid_is.get(wamid)
        if j is None:
            # §3: "program yalnız kendi kaydındaki wamid'lerin durumunu yazar, bilinmeyen olay düşer" ↔ §6 W2: "kanca biz_opaque_callback_data
            # = iş kimliği ile gelirse çözülür" — ÇELİŞKİ (PLAN SUSUYOR 3). Sahte olay da bu yoldan geçer (güvenlik: SAHTE-OPAQUE senaryosu).
            aday = self.isler.get(ek.get("opaque"))
            if not (aday and aday.durum == BELIRSIZ and self.s["belirsiz_cozum"] == "opaque_cozer"):
                return
            j = aday
            self.programa_kabul(j, wamid, j.belirsiz_t)
        if j.durum == SURESI_DOLDU:                        # PLAN SUSUYOR 17
            if durum in ("delivered", "read") and self.s["gec_teslim"] == "teslim_yazilir":
                self.durum(j, TESLIM if durum == "delivered" else OKUNDU, t)
                self.teslim_yaz(j, t)
            return
        if j.durum not in SIRA:
            return
        j.kanca_geldi = True
        if durum == "sent":
            if SIRA[j.durum] < 2:
                self.durum(j, GONDERILDI, t)
        elif durum == "delivered":
            if SIRA[j.durum] < 3 or ("M11" in self.mut and j.durum == OKUNDU):
                self.durum(j, TESLIM, t); self.teslim_yaz(j, t); self.kesinlesti(j, t)
            elif "M12" in self.mut:
                self.teslim_kaydi.append((j, t))
        elif durum == "read":
            if SIRA[j.durum] < 4:
                self.durum(j, OKUNDU, t); self.teslim_yaz(j, t); self.kesinlesti(j, t)   # Meta: read yalnız delivered'dan sonra
        elif durum == "failed" and SIRA[j.durum] < 3:      # failed delivered'dan SONRA: PLAN SUSUYOR 18 (senaryo kullanmaz)
            j.kod = kod
            if kod == 131049:
                return self.k131049(j, self.toplular[j.toplu], t)
            if "M30" in self.mut and kod == 131026:
                return
            self.durum(j, BASARISIZ, t); self.kesinlesti(j, t)

    def teslim_yaz(self, j, t):
        if j.teslim_t is None:
            j.teslim_t = t
            self.teslim_kaydi.append((j, t))

    def kesinlesti(self, j, t):
        """§11 S3 A: teslim / başarısız / süresi doldu kesinleşince PDF Meta'dan silinir (her medya bir kez)."""
        j.silinen_n = len(j.medyalar)

    # ---- TTL, basamak okuma -------------------------------------------------------------------------------------------------
    def ttl_son(self, j):
        if self.s["kancasiz_son"] == "durum_bilinmiyor" and j.durum == KABUL and not j.kanca_geldi:
            return j.kabul_t + KANCA_OMRU
        return j.kabul_t + (30 * GUN if "M7" in self.mut else TTL) + TTL_PAYI

    def ttl_zamani(self):
        return min((self.ttl_son(j) for j in self.ttl_aktif.values()), default=None)

    def ttl_isle(self, t):
        for j in list(self.ttl_aktif.values()):
            if t >= self.ttl_son(j):
                if self.s["kancasiz_son"] == "durum_bilinmiyor" and j.durum == KABUL and not j.kanca_geldi:
                    self.durum(j, DURUM_BILINMIYOR, t)
                else:
                    self.durum(j, SURESI_DOLDU, t)
                    if "M29" not in self.mut:
                        self.kesinlesti(j, t)

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

    def bekleyen_var(self, waba):
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum == "aktif" and self.wabalar[tp.sirket] == waba:
                self._ilerlet(tp)
                if any(j.durum in CALISIR for j in tp.isler[tp.bas:]):
                    return True
        return False

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
        }
        if not self.ozet:
            k["isler"] = {a: j.durum for a, j in sorted(self.isler.items())}
        self.kontroller[o["ad"]] = k

    def sonuc(self):
        isler = {}
        for k, j in sorted(self.isler.items()):
            isler[k] = {
                "durum": j.durum, "telefon": j.telefon, "sablon": ICERIK_SABLON[self.toplular[j.toplu].sablon],
                "degiskenler": j.icerik["degiskenler"] if j.icerik else None,
                "pdf": j.icerik["pdf"] if j.icerik else None,
                "dosya_adi": j.icerik["dosya_adi"] if j.icerik else None,
                "hata_kodu": j.kod, "post": j.post, "kabul": len(j.wamidler), "meta_ileti": j.meta_sayi,
                "medya_yukleme": len(j.medyalar), "medya_silme": j.silinen_n,
            }
        def topla(alan):
            o = {}
            for j in self.isler.values():
                o[j.cari] = o.get(j.cari, 0) + alan(j)
            return dict(sorted(o.items()))
        # "Bu Ay" göstergesinin kapsamı (şirket mi WABA mı) PLAN SUSUYOR → iki görünüm birlikte verilir; sürücü programın gösterdiğiyle karşılaştırır
        bu_ay = {"sirket": {}, "waba": {}}
        kabuller = [(t, w, s) for (t, w, s, _a, _k) in self.kabul_kaydi] if "M31" not in self.mut else list(self.post_kaydi)
        for gorunum in ("sirket", "waba"):
            for (t, waba, sirket) in kabuller:
                b = bu_ay[gorunum].setdefault(sirket if gorunum == "sirket" else waba, {}).setdefault(ay(t, self.tz), {"kabul": 0, "teslim": 0})
                b["kabul"] += 1
            for (j, t) in self.teslim_kaydi:
                tp = self.toplular[j.toplu]
                k = tp.sirket if gorunum == "sirket" else self.wabalar[tp.sirket]
                b = bu_ay[gorunum].setdefault(k, {}).setdefault(ay(t if self.s["teslim_ay"] == "teslim" else j.kabul_t, self.tz), {"kabul": 0, "teslim": 0})
                b["teslim"] += 1
            for kv in bu_ay[gorunum].values():
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
            "bos_toplu": sorted(self.bos),
            "toplular": {e: {"durum": self.toplular[e].durum, "neden": self.toplular[e].neden, "is_sayisi": len(self.toplular[e].isler)} for e in self.toplu_sira},
            "durum_sayilari": dict(sorted(sayi.items())),
            "meta": {"post": topla(lambda j: j.post), "kabul": topla(lambda j: len(j.wamidler)), "meta_ileti": topla(lambda j: j.meta_sayi),
                     "medya_yukleme": topla(lambda j: len(j.medyalar)), "medya_silme": topla(lambda j: j.silinen_n),
                     "toplam_post": sum(self.post_hedef.values()), "toplam_kabul_program": len(self.kabul_kaydi),
                     "toplam_meta_ileti": len(self.meta_mesajlari), "toplam_medya_yukleme": self.medya_toplam},
            "kontroller": self.kontroller,
            "bu_ay": {g: {k: dict(sorted(v.items())) for k, v in sorted(bu_ay[g].items())} for g in ("sirket", "waba")},
            "degismez": dict(self.degismez),
        }
        if self.ozet:
            sonuc["meta"] = {k: v for k, v in sonuc["meta"].items() if k.startswith("toplam")}
            ornek = sorted(isler)[:3]
            sonuc["isler_ornek"] = {k: isler[k] for k in ornek}
            sonuc["isler_post_dagilimi"] = dict(sorted({str(n): sum(1 for j in self.isler.values() if j.post == n) for n in {j.post for j in self.isler.values()}}.items()))
        else:
            sonuc["isler"] = isler
        return sonuc


# ---- birleştirme (sıra/zaman serbestliği) ----------------------------------------------------------------------------------

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


def hesapla_tek(sen, kismi, mut=frozenset()):
    secim = tam_secim(kismi)
    return birlestir([Benzetim(sen, secim, sira, zaman, mut).calistir() for sira in SIRALAR for zaman in ZAMANLAR])


def hesapla(sen, mut=frozenset()):
    """Senaryonun beklenen sonucu: [{secimler, sonuc}] — aynı sonucu veren serbest seçim birleşimleri tek grupta."""
    gruplar = []
    for kismi in secim_birlesimleri(sen.get("serbest", [])):
        s = hesapla_tek(sen, kismi, mut)
        metin = _metin(s)
        for g in gruplar:
            if g["_m"] == metin:
                g["secimler"].append(kismi)
                break
        else:
            gruplar.append({"secimler": [kismi], "sonuc": s, "_m": metin})
    for g in gruplar:
        del g["_m"]
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


def karsilastir(beklenen, program, secim):
    """beklenen: hesapla() çıktısı; program: aynı biçimde tek sonuç (sürücü üretir); secim: serbest seçimler → farklar listesi.
    {"biri": [...]} yaprağında program değeri listeden biri olmalı; {"plan_susuyor": …} yaprağı denetlenmez."""
    grup = grup_bul(beklenen, secim)
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
        secim = {}
        if "--secim" in argv:
            for parca in argv[argv.index("--secim") + 1].split(","):
                if parca:
                    k, v = parca.split("=")
                    secim[k] = v
        farklar = karsilastir(beklenen.get("beklenen", beklenen) if isinstance(beklenen, dict) else beklenen, program, tam_secim(secim))
        for f_ in farklar:
            print("FARK", f_)
        print(f"{len(farklar)} fark")
        return 1 if farklar else 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
