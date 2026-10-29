# -*- coding: utf-8 -*-
"""DestekOfis 2.4.7 — mobil uzaktan erişim (M2 + M3/M4 erişim denetimi) temiz oda kâhini.

Programın kodu GÖRÜLMEDEN, yalnız karar metninden yazıldı (CLAUDE.md ders 5, KANIT KURALI 2). Kurallar ve
varsayımlar README.md'de (K…, V…); metnin sustuğu her nokta PARAMETRE'dir (P…), karar kullanıcıdadır (ders 40, 43).

Yalnız standart kütüphane. `python3 -I` ile koşar.

Model: her olay bir "dünya kümesi" üzerinde uygulanır. Metnin sustuğu küçük noktalarda (kapıcının lisans önbelleğini
hangi anda tazelediği, eşzamanlı olayların sırası, yeniden başlatmadan sonra oturumun sürüp sürmediği) birden çok dünya
olasıdır; bir olayın beklenen sonucu bütün dünyalardaki sonuçların kümesidir ("kabul|ret:x" = ikisi de kabul edilir).
Programla karşılaştırmada dünyalar programın gözlemiyle süzülür (tutarlı tek yol aranır).
"""
import copy
import itertools
import json
import sys
import urllib.parse
from datetime import datetime, timedelta, timezone

DIL = "destekofis-mobil-erisim/1"
TR = timezone(timedelta(hours=3))

# ---------------------------------------------------------------------------------------------------------------
# Parametreler (AÇIK SORULAR; README "AÇIK SORULAR"). İlk değer değil, "oneri" alanı önerilendir.
# ---------------------------------------------------------------------------------------------------------------
PARAMETRELER = {
    "kod_sure": {"degerler": [2, 5, 10], "oneri": 5},                                 # P1 karekod geçerlilik (dk)
    "yeni_kod_eskiyi": {"degerler": ["iptal_eder", "etmez"], "oneri": "iptal_eder"},  # P2
    "sinir_dolunca": {"degerler": ["reddet", "en_eskiyi_dusur"], "oneri": "reddet"},  # P3
    "uretimde_sinir": {"degerler": ["denetler", "denetlemez"], "oneri": "denetler"},  # P4
    "sinir_dusunce": {"degerler": ["mevcutlar_kalir", "en_yeniler_durur"], "oneri": "mevcutlar_kalir"},  # P5
    "cihaz_kullanici": {"degerler": ["yalniz_eslenen", "ofisin_kullanicilari"], "oneri": "yalniz_eslenen"},  # P6
    "oturum_bosta": {"degerler": [15, 30], "oneri": 15},                              # P7 boşta kalma (dk)
    "oturum_mutlak": {"degerler": [8, 12], "oneri": 12},                              # P8 mutlak ömür (saat)
    "lisans_onbellek": {"degerler": [1, 24], "oneri": 1},                             # P9 kapıcı önbelleği (saat)
    "ozet_yas_siniri": {"degerler": ["yok", 30], "oneri": "yok"},                     # P10 (gün)
    "deneme_siniri": {"degerler": [5, 10], "oneri": 5},                               # P11 ardışık yanlış parola
    "deneme_anahtari": {"degerler": ["kullanici", "cihaz"], "oneri": "kullanici"},    # P12
    "kilit_dk": {"degerler": [15, 30], "oneri": 15},                                  # P13
}
PARAM_SIRASI = list(PARAMETRELER)

OZET_BOLUMLERI = ("anlik_durum", "cari", "kasa", "stok", "taksit")  # PRO-UZAKTAN-GORUNTULEME.md "Mimari" 1
YALNIZ_YONETICI = ("anlik_durum",)                                  # CLAUDE.md 2.4.3: "Anlık Durum yalnız yönetici"

RET_SINIFLARI = (
    "cihaz_yok", "sinir_asimi", "lisans_gecersiz", "lisans_dogrulanamadi", "yol_yasak", "sunucu_kapali",
    "oturum_gecersiz", "yetki_yok", "sirket_yok", "yazma_yasak", "ozet_yok", "ozet_eski", "kod_gecersiz",
    "sinir_dolu", "uzaktan_izni_yok", "parola_yanlis", "deneme_siniri", "cihaz_baska_kullanici",
)
KABUL = "kabul"


def oneri_birlesimi():
    return {k: v["oneri"] for k, v in PARAMETRELER.items()}


def birlesim_metni(atama):
    return ";".join(f"{k}={atama[k]}" for k in PARAM_SIRASI if k in atama)


def birlesim_coz(metin):
    atama = {}
    if not metin:
        return atama
    for parca in metin.split(";"):
        k, _, v = parca.partition("=")
        if k not in PARAMETRELER:
            raise GirdiHatasi(f"bilinmeyen parametre: {k}")
        degerler = PARAMETRELER[k]["degerler"]
        bulundu = [d for d in degerler if str(d) == v]
        if not bulundu:
            raise GirdiHatasi(f"{k} için geçersiz değer: {v}")
        atama[k] = bulundu[0]
    return atama


class GirdiHatasi(Exception):
    """Hatalı senaryo girdisi: sessizce atlanmaz (ders 3, 4)."""


class ParamGerekli(Exception):
    def __init__(self, ad):
        super().__init__(ad)
        self.ad = ad


class Parametreler:
    """Tembel parametre: atanmamış bir parametre okunursa ParamGerekli fırlatır (karar ağacı numaralandırması)."""

    def __init__(self, atama):
        self.atama = dict(atama)
        self.okunan = set()

    def __getitem__(self, ad):
        if ad not in PARAMETRELER:
            raise KeyError(ad)
        if ad not in self.atama:
            raise ParamGerekli(ad)
        self.okunan.add(ad)
        return self.atama[ad]


# ---------------------------------------------------------------------------------------------------------------
# Saat: mutlak an (saniye). Ofsetsiz saat TR yerel (sabit UTC+3) sayılır. "Bugün" hiç okunmaz (ders 13, 22).
# ---------------------------------------------------------------------------------------------------------------
def zaman(metin):
    if not isinstance(metin, str) or len(metin) < 16:
        raise GirdiHatasi(f"geçersiz saat: {metin!r}")
    try:
        d = datetime.fromisoformat(metin.replace("Z", "+00:00"))
    except ValueError as e:
        raise GirdiHatasi(f"geçersiz saat: {metin!r}") from e
    if d.tzinfo is None:
        d = d.replace(tzinfo=TR)
    if d.year < 2020 or d.year > 2100:
        raise GirdiHatasi(f"saat aralık dışı: {metin!r}")
    return int(d.timestamp())


def iso(saniye):
    return datetime.fromtimestamp(saniye, TR).isoformat()


# ---------------------------------------------------------------------------------------------------------------
# Tünel yol beyaz listesi (K18): yalnız /mobil/ ve /api/mobil/. Kod çözülür, "." / ".." bölümü, ters bölü, çift bölü,
# NUL ve ikinci kat kodlama reddedilir; önek bölüm sınırında ve büyük/küçük harf duyarlı.
# ---------------------------------------------------------------------------------------------------------------
IZINLI_ONEKLER = ("/mobil/", "/api/mobil/")
GIRIS_YOLU = "/api/mobil/giris"


def yol_izinli(yol):
    if not isinstance(yol, str) or not yol.startswith("/"):
        return False
    yol = yol.split("#", 1)[0].split("?", 1)[0]
    cozuk = urllib.parse.unquote(yol)
    if "%" in cozuk and urllib.parse.unquote(cozuk) != cozuk:
        return False  # ikinci kat kodlama
    if "\\" in cozuk or "\x00" in cozuk or "//" in cozuk:
        return False
    bolumler = cozuk.split("/")[1:]
    if any(b in (".", "..") for b in bolumler):
        return False
    return any(cozuk.startswith(o) for o in IZINLI_ONEKLER)


def yol_statik(yol):
    """Oturumsuz açılan sayfa dosyası (giriş ekranı dahil): /mobil/ altı."""
    return urllib.parse.unquote(yol.split("?", 1)[0]).startswith("/mobil/")


# ---------------------------------------------------------------------------------------------------------------
# Belirlenimci bağlam: lisans servisindeki GERÇEK lisans kaydı ve servisin erişilebilirliği (olaylarla değişir).
# Kapıcının ve programın bu gerçeği ne zaman öğrendiği dünyalara göre değişir (aşağıda adaylar).
# ---------------------------------------------------------------------------------------------------------------
EKSI_SONSUZ = -(10 ** 12)


def lisans_kaydi(ham, eski=None):
    kayit = dict(eski) if eski else {"durum": "gecerli", "bitis": None, "cihaz_siniri": 3, "plan": "standart"}
    for k, v in (ham or {}).items():
        if k == "durum":
            if v not in ("gecerli", "engelli"):
                raise GirdiHatasi(f"lisans durumu: {v!r}")
            kayit["durum"] = v
        elif k == "bitis":
            kayit["bitis"] = None if v is None else zaman(v)
        elif k == "plan":
            if v not in ("standart", "pro", "deneme"):
                raise GirdiHatasi(f"lisans planı: {v!r}")
            kayit["plan"] = v  # K8: mobil herkese, Pro kilidi yok → plan sonucu değiştirmez
        elif k == "cihaz_siniri":
            if not isinstance(v, int) or isinstance(v, bool) or v < 0:
                raise GirdiHatasi(f"cihaz_siniri: {v!r}")
            kayit["cihaz_siniri"] = v
        else:
            raise GirdiHatasi(f"bilinmeyen lisans alanı: {k}")
    return kayit


def lisans_gecerli(kayit, t, mut=None):
    if mut == "M18":
        return kayit["durum"] == "gecerli"
    if mut == "M19":
        return kayit["bitis"] is None or t < kayit["bitis"]
    if mut == "M57" and kayit.get("plan") != "pro":
        return False
    if mut == "M51":
        return kayit["durum"] == "gecerli" and (kayit["bitis"] is None or t <= kayit["bitis"])
    return kayit["durum"] == "gecerli" and (kayit["bitis"] is None or t < kayit["bitis"])


class Baglam:
    def __init__(self, baslangic, mut=None):
        self.mut = mut
        self.lisans = {}       # ofis -> [(t, kayit)]  (kayıt t'den itibaren geçerli)
        self.program_denetim = {}
        for ofis, o in baslangic["ofisler"].items():
            self.lisans[ofis] = [(EKSI_SONSUZ, lisans_kaydi(o.get("lisans")))]
            self.program_denetim[ofis] = EKSI_SONSUZ
        erisim = baslangic.get("lisans_servisi", "var")
        if erisim not in ("var", "yok"):
            raise GirdiHatasi(f"lisans_servisi: {erisim!r}")
        self.erisim = [(EKSI_SONSUZ, erisim == "var")]

    @staticmethod
    def _dilimler(tarihce):
        for i, (a, deger) in enumerate(tarihce):
            b = tarihce[i + 1][0] if i + 1 < len(tarihce) else 10 ** 13
            yield a, b - 1, deger  # tamsayı saniye, iki uç dahil

    def gercek_son(self, ofis):
        return self.lisans[ofis][-1][1]

    def erisilebilir(self, t):
        son = None
        for a, var in self.erisim:
            if a <= t:
                son = var
        return son

    def kapici_adaylari(self, ofis, t, P):
        """Kapıcının t anında kullanabileceği lisans kayıtları (V9): önbellek en çok TTL eski; tazeleme yalnız servis
        erişilebilirken. Servis şu an erişilemezse 'doğrulanamadı' da olasıdır; penceresinde hiç erişim yoksa yalnız o.
        P9 yalnız sonucu değiştiriyorsa okunur (karar ağacı küçük kalır)."""
        secenek = [self._kapici(ofis, t, s) for s in PARAMETRELER["lisans_onbellek"]["degerler"]]
        if all(x == secenek[0] for x in secenek):
            return secenek[0]
        return self._kapici(ofis, t, P["lisans_onbellek"])

    def _kapici(self, ofis, t, ttl_saat):
        ttl = ttl_saat * 3600
        lo, hi = t - ttl + 1, t
        if self.mut == "M17":
            lo = EKSI_SONSUZ  # önbellek sonsuza dek
        adaylar = []
        for a, b, kayit in self._dilimler(self.lisans[ofis]):
            for c, d, var in self._dilimler(self.erisim):
                if var and max(a, c, lo) <= min(b, d, hi):
                    if kayit not in adaylar:
                        adaylar.append(kayit)
        if self.mut == "M20" and adaylar:
            adaylar = [adaylar[0]]  # en eski kayda takılır
        sonuc = [("ok" if lisans_gecerli(k, t, self.mut) else "ret:lisans_gecersiz", k) for k in adaylar]
        if (not self.erisilebilir(t) or not sonuc) and self.mut != "M21":
            sonuc.append(("ret:lisans_dogrulanamadi", None))
        if not sonuc:  # M21: erişim yoksa da kabul ("fail-open")
            sonuc.append(("ok", self.lisans[ofis][-1][1]))
        return sonuc

    def program_adaylari(self, ofis, t):
        """Programın kendi lisans görünümü: son elle denetimden (Lisansı Şimdi Denetle) bu yana herhangi bir kayıt."""
        p = self.program_denetim[ofis]
        adaylar = []
        for a, b, kayit in self._dilimler(self.lisans[ofis]):
            if max(a, p) <= min(b, t) and kayit not in adaylar:
                adaylar.append(kayit)
        return adaylar


# ---------------------------------------------------------------------------------------------------------------
# Dünya: dallanabilen durum (JSON'a çevrilebilir; birleştirme anahtarı).
# ---------------------------------------------------------------------------------------------------------------
YOK_ZAMAN = -1  # özet adaylarında "özet yok"


def kullanici_kaydi(k, eski=None):
    kayit = copy.deepcopy(eski) if eski else {"rol": "kullanici", "uzaktan": False, "sirketler": [], "yetkiler": []}
    for alan, v in k.items():
        if alan == "rol":
            if v not in ("yonetici", "kullanici"):
                raise GirdiHatasi(f"rol: {v!r}")
            kayit["rol"] = v
        elif alan == "uzaktan":
            if not isinstance(v, bool):
                raise GirdiHatasi(f"uzaktan: {v!r}")
            kayit["uzaktan"] = v
        elif alan in ("sirketler", "yetkiler"):
            if not isinstance(v, list) or any(not isinstance(x, str) for x in v):
                raise GirdiHatasi(f"{alan}: {v!r}")
            kayit[alan] = sorted(set(v))
        else:
            raise GirdiHatasi(f"bilinmeyen kullanıcı alanı: {alan}")
    return kayit


def yeni_dunya(baslangic):
    d = {}
    for ofis, o in baslangic["ofisler"].items():
        for alan in o:
            if alan not in ("sirketler", "kullanicilar", "sunucu", "lisans"):
                raise GirdiHatasi(f"{ofis}: bilinmeyen ofis alanı {alan}")
        sirketler = o.get("sirketler", ["001"])
        if not sirketler or any(not isinstance(s, str) for s in sirketler):
            raise GirdiHatasi(f"{ofis}: sirketler")
        kullanicilar = {ad: kullanici_kaydi(k) for ad, k in o.get("kullanicilar", {}).items()}
        sunucu = o.get("sunucu", "acik")
        if sunucu not in ("acik", "kapali"):
            raise GirdiHatasi(f"{ofis}: sunucu {sunucu!r}")
        d[ofis] = {
            "sirketler": sorted(sirketler), "kullanicilar": kullanicilar, "sunucu": sunucu,
            "kodlar": {}, "cihazlar": {}, "oturumlar": {}, "deneme": {}, "ozet": [YOK_ZAMAN],
            "ozet_gorunum": None,
        }
    return d


def dunya_anahtari(d):
    return json.dumps(d, sort_keys=True, separators=(",", ":"))


def etkin_sirketler(ofis_d, k, mut=None):
    """Mevcut ürün kuralı (K21): yönetici her şirketi; işaretsiz kullanıcı yalnız 001."""
    if k["rol"] == "yonetici" and mut != "M24":
        return list(ofis_d["sirketler"])
    secili = [s for s in k["sirketler"] if s in ofis_d["sirketler"]]
    if not secili:
        if mut == "M25":
            return list(ofis_d["sirketler"])  # işaretsiz → hepsi
        secili = [s for s in ("001",) if s in ofis_d["sirketler"]]
    return secili


def yetkili(ofis_d, k, yetki, mut=None):
    if yetki is None:
        return True
    if k["rol"] == "yonetici" and mut != "M24":
        return True
    if yetki in YALNIZ_YONETICI and mut != "M26":
        return False
    return yetki in k["yetkiler"]


def gorunum(ofis_d, kullanici, mut=None):
    k = ofis_d["kullanicilar"].get(kullanici)
    if k is None:
        return {}
    return {s: [b for b in OZET_BOLUMLERI if yetkili(ofis_d, k, b, mut)] for s in etkin_sirketler(ofis_d, k, mut)}


def aktif_cihazlar(ofis_d):
    """Eşleme sırasıyla: eşleme anı, eşit anda cihaz kimliği (V5)."""
    c = [(v["t"], cid) for cid, v in ofis_d["cihazlar"].items() if v["aktif"]]
    return [cid for _, cid in sorted(c)]


# ---------------------------------------------------------------------------------------------------------------
# Olay dili (README "Olay dili"). Aynı anda olaylar: sınıf sırası → olay numarası (ders 31); "grup" etiketli olaylar
# gerçekten eşzamanlıdır, bütün sıralamaları denenir.
# ---------------------------------------------------------------------------------------------------------------
OLAY_SINIFI = {
    "lisans_degis": 0, "lisans_servisi": 0, "program_lisans_denetle": 0, "sunucu": 0, "bekle": 0,
    "kullanici_degis": 1, "cihaz_sil": 1, "karekod_uret": 1, "ozet_yukle": 1,
    "esle": 2, "kapici_dogrudan_kayit": 2,
    "giris": 3,
    "istek": 4, "ozet_oku": 4, "ozet_yaz": 4,
}
OLAY_ALANLARI = {
    "lisans_degis": {"ofis", "lisans"},
    "lisans_servisi": {"erisim"},
    "program_lisans_denetle": {"ofis"},
    "sunucu": {"ofis", "durum"},
    "bekle": set(),
    "kullanici_degis": {"ofis", "yapan", "kullanici", "degisiklik"},
    "cihaz_sil": {"ofis", "yapan", "cihaz"},
    "karekod_uret": {"ofis", "yapan", "kullanici", "kod"},
    "ozet_yukle": {"ofis"},
    "esle": {"ofis", "kod", "cihaz", "cihaz_turu"},
    "kapici_dogrudan_kayit": {"ofis", "cihaz", "kullanici"},
    "giris": {"ofis", "cihaz", "kullanici", "parola", "oturum", "gorunen_adres", "basliklar"},
    "istek": {"ofis", "cihaz", "yol", "oturum", "sirket", "yetki", "yazma", "gorunen_adres", "basliklar"},
    "ozet_oku": {"ofis", "cihaz"},
    "ozet_yaz": {"ofis", "cihaz"},
}
ORTAK_ALANLAR = {"no", "t", "olay", "grup", "not"}
ZORUNLU = {
    "lisans_degis": {"ofis", "lisans"}, "lisans_servisi": {"erisim"}, "program_lisans_denetle": {"ofis"},
    "sunucu": {"ofis", "durum"}, "bekle": set(), "kullanici_degis": {"ofis", "yapan", "kullanici", "degisiklik"},
    "cihaz_sil": {"ofis", "yapan", "cihaz"}, "karekod_uret": {"ofis", "yapan", "kullanici", "kod"},
    "ozet_yukle": {"ofis"}, "esle": {"ofis", "kod", "cihaz"}, "kapici_dogrudan_kayit": {"ofis", "cihaz", "kullanici"},
    "giris": {"ofis", "cihaz", "kullanici", "parola", "oturum"}, "istek": {"ofis", "cihaz", "yol"},
    "ozet_oku": {"ofis", "cihaz"}, "ozet_yaz": {"ofis", "cihaz"},
}


def olay_dogrula(e, ofisler):
    if not isinstance(e, dict) or e.get("olay") not in OLAY_ALANLARI:
        raise GirdiHatasi(f"bilinmeyen olay: {e!r}")
    tur = e["olay"]
    fazla = set(e) - OLAY_ALANLARI[tur] - ORTAK_ALANLAR
    if fazla:
        raise GirdiHatasi(f"olay {e.get('no')}: bilinmeyen alan {sorted(fazla)}")
    eksik = ZORUNLU[tur] - set(e)
    if eksik or "no" not in e or "t" not in e:
        raise GirdiHatasi(f"olay {e.get('no')}: eksik alan {sorted(eksik | ({'no', 't'} - set(e)))}")
    if not isinstance(e["no"], int) or isinstance(e["no"], bool):
        raise GirdiHatasi(f"olay no: {e['no']!r}")
    zaman(e["t"])
    if "ofis" in e and e["ofis"] not in ofisler:
        raise GirdiHatasi(f"olay {e['no']}: bilinmeyen ofis {e['ofis']!r}")
    if tur == "giris" and e["parola"] not in ("dogru", "yanlis"):
        raise GirdiHatasi(f"olay {e['no']}: parola {e['parola']!r}")
    if tur == "sunucu" and e["durum"] not in ("acik", "kapali"):
        raise GirdiHatasi(f"olay {e['no']}: sunucu durumu {e['durum']!r}")
    if tur == "lisans_servisi" and e["erisim"] not in ("var", "yok"):
        raise GirdiHatasi(f"olay {e['no']}: erisim {e['erisim']!r}")
    if tur == "istek" and not isinstance(e.get("yazma", False), bool):
        raise GirdiHatasi(f"olay {e['no']}: yazma")


class Model:
    def __init__(self, senaryo, P, mut=None):
        self.s = senaryo
        self.P = P
        self.mut = mut
        bas = senaryo["baslangic"]
        if not isinstance(bas, dict) or "ofisler" not in bas:
            raise GirdiHatasi("baslangic.ofisler yok")
        self.ctx = Baglam(bas, mut)
        self.dunyalar = [yeni_dunya(bas)]
        self.olaylar = senaryo["olaylar"]
        nolar = set()
        for e in self.olaylar:
            olay_dogrula(e, bas["ofisler"])
            if e["no"] in nolar:
                raise GirdiHatasi(f"olay no tekrar: {e['no']}")
            nolar.add(e["no"])
        self._etiketleri_denetle()

    # ---------------------------------------------------------------- yardımcılar
    def m(self, ad):
        return self.mut == ad

    def _etiketleri_denetle(self):
        """Karekod etiketleri ofiste, oturum etiketleri ve yeni cihaz kimlikleri senaryoda tekil (girdi kuralı)."""
        gorulen = set()
        for e in self.olaylar:
            if e["olay"] == "karekod_uret":
                anahtar = ("kod", e["ofis"], e["kod"])
            elif e["olay"] == "giris":
                anahtar = ("oturum", e["oturum"])
            elif e["olay"] in ("esle", "kapici_dogrudan_kayit"):
                anahtar = ("cihaz", e["cihaz"])
            else:
                continue
            if anahtar in gorulen:
                raise GirdiHatasi(f"olay {e['no']}: etiket tekrar {anahtar}")
            gorulen.add(anahtar)
        for e in self.olaylar:
            if e.get("grup") is not None:
                es = [x for x in self.olaylar if x.get("grup") == e["grup"]]
                if len({x["t"] for x in es}) != 1 or len(es) < 2:
                    raise GirdiHatasi(f"grup {e['grup']}: üyeler aynı anda ve en az iki olmalı")

    def sayi(self, od, t=None, kullanici=None):
        """Eşli cihaz sayısı: program başına, iki şirket birlikte (K11)."""
        if self.m("M12"):
            return len(od["cihazlar"])
        aktif = aktif_cihazlar(od)
        if self.m("M45") and t is not None:
            aktif = [c for c in aktif if od["cihazlar"][c]["t"] < t]
        if self.m("M07") and kullanici is not None:
            ilk = (etkin_sirketler(od, od["kullanicilar"][kullanici]) or ["-"])[0]
            return sum(1 for c in aktif
                       if (etkin_sirketler(od, od["kullanicilar"][od["cihazlar"][c]["kullanici"]]) or ["-"])[0] == ilk)
        if self.m("M08") and kullanici is not None:
            return sum(1 for c in aktif if od["cihazlar"][c]["kullanici"] == kullanici)
        return len(aktif)

    def sinir_dolunca(self):
        v = self.P["sinir_dolunca"]
        if self.m("M09"):
            v = "en_eskiyi_dusur" if v == "reddet" else "reddet"
        return v

    def cihaz_kaldir(self, od, cid):
        od["cihazlar"][cid]["aktif"] = False
        if not self.m("M11"):
            for o in od["oturumlar"].values():
                if o["cihaz"] == cid:
                    o["durum"] = "bitti"

    def yeniden_uret(self, od, t, kapici):
        """Cihaz/yetki değişince özet yeniden yazılır (Eylül: anahtar yenilenir); veri anı yenilenebilir de (V12)."""
        if any(v == "ok" for v, _ in kapici):
            od["ozet"] = sorted(set(od["ozet"]) | {t})

    def kapici_girisi(self, w, e, t, lisans_atla=False, cihaz_atla=False):
        """Kapıcı: cihaz → lisans → sınır aşımı (K14, K15, P5). Dönen: [(ret, None) | ("gec", kayit)]."""
        od = w[e["ofis"]]
        c = od["cihazlar"].get(e["cihaz"])
        if not cihaz_atla and (c is None or (not c["aktif"] and not self.m("M10"))):
            return [("ret:cihaz_yok", None)]
        if lisans_atla:
            adaylar = [("ok", self.ctx.gercek_son(e["ofis"]))]
        else:
            adaylar = self.ctx.kapici_adaylari(e["ofis"], t, self.P)
        sonuc = []
        for v, kayit in adaylar:
            if v != "ok":
                r = (v, None)
            else:
                r = ("gec", kayit)
                aktif = aktif_cihazlar(od)
                if c is not None and c["aktif"] and len(aktif) > kayit["cihaz_siniri"]:
                    durur = self.P["sinir_dusunce"] == "en_yeniler_durur"
                    if self.m("M42"):
                        durur = not durur
                    if durur and aktif.index(e["cihaz"]) >= kayit["cihaz_siniri"]:
                        r = ("ret:sinir_asimi", None)
            if r not in sonuc:
                sonuc.append(r)
        return sonuc

    # ---------------------------------------------------------------- program (yerel) olayları
    def o_karekod_uret(self, w, e, t):
        od = w[e["ofis"]]
        if od["sunucu"] != "acik":
            return [({"ret:sunucu_kapali"}, {}, w)]
        y = od["kullanicilar"].get(e["yapan"])
        if y is None:
            raise GirdiHatasi(f"olay {e['no']}: bilinmeyen yapan {e['yapan']!r}")
        if y["rol"] != "yonetici" and not self.m("M14"):
            return [({"ret:yetki_yok"}, {}, w)]
        k = od["kullanicilar"].get(e["kullanici"])
        if k is None:
            raise GirdiHatasi(f"olay {e['no']}: bilinmeyen kullanıcı {e['kullanici']!r}")
        if not k["uzaktan"] and not self.m("M15"):
            return [({"ret:uzaktan_izni_yok"}, {}, w)]
        sonuc = []
        # Üretimde sınır (P4; yalnız "reddet"te anlamlı). Programın sınır görünümü (V10).
        sinirlar = sorted({r["cihaz_siniri"] for r in self.ctx.program_adaylari(e["ofis"], t)})
        n = self.sayi(od, kullanici=e["kullanici"])
        dolu_secenek = [False]
        if not self.m("M06") and n >= sinirlar[0] and self.sinir_dolunca() == "reddet":
            denetler = self.P["uretimde_sinir"] == "denetler"
            if self.m("M16"):
                denetler = not denetler
            if denetler:
                dolu_secenek = sorted({n >= s for s in sinirlar})
        # Programın kendi lisans denetimi kâhinde belirsizdir (V11): geçersiz görünümde ret de kabul de olur.
        lisans_ret = any(not lisans_gecerli(r, t) for r in self.ctx.program_adaylari(e["ofis"], t))
        if lisans_ret:
            sonuc.append(({"ret:lisans_gecersiz"}, {}, copy.deepcopy(w)))
        for dolu in dolu_secenek:
            w2 = copy.deepcopy(w) if (len(dolu_secenek) > 1 or lisans_ret) else w
            if dolu:
                sonuc.append(({"ret:sinir_dolu"}, {}, w2))
                continue
            od2 = w2[e["ofis"]]
            eskiler = [kod for kod, v in od2["kodlar"].items()
                       if v["kullanici"] == e["kullanici"] and v["durum"] == "aktif"]
            if eskiler:
                iptal = self.P["yeni_kod_eskiyi"] == "iptal_eder"
                if self.m("M05"):
                    iptal = not iptal
                if iptal:
                    for kod in eskiler:
                        od2["kodlar"][kod]["durum"] = "iptal"
            od2["kodlar"][e["kod"]] = {"kullanici": e["kullanici"], "t": t, "durum": "aktif"}
            sonuc.append(({KABUL}, {}, w2))
        return sonuc

    def o_cihaz_sil(self, w, e, t):
        od = w[e["ofis"]]
        if od["sunucu"] != "acik":
            return [({"ret:sunucu_kapali"}, {}, w)]
        y = od["kullanicilar"].get(e["yapan"])
        if y is None:
            raise GirdiHatasi(f"olay {e['no']}: bilinmeyen yapan {e['yapan']!r}")
        if y["rol"] != "yonetici":
            return [({"ret:yetki_yok"}, {}, w)]
        c = od["cihazlar"].get(e["cihaz"])
        if c is None or not c["aktif"]:
            return [({"ret:cihaz_yok"}, {}, w)]
        self.cihaz_kaldir(od, e["cihaz"])
        if self.m("M12"):
            pass
        self.yeniden_uret(od, t, self.ctx.kapici_adaylari(e["ofis"], t, self.P))
        return [({KABUL}, {}, w)]

    def o_kullanici_degis(self, w, e, t):
        od = w[e["ofis"]]
        if od["sunucu"] != "acik":
            return [({"ret:sunucu_kapali"}, {}, w)]
        y = od["kullanicilar"].get(e["yapan"])
        if y is None or e["kullanici"] not in od["kullanicilar"]:
            raise GirdiHatasi(f"olay {e['no']}: bilinmeyen kullanıcı")
        if y["rol"] != "yonetici":
            return [({"ret:yetki_yok"}, {}, w)]
        k = kullanici_kaydi(e["degisiklik"], od["kullanicilar"][e["kullanici"]])
        od["kullanicilar"][e["kullanici"]] = k
        if not k["uzaktan"] and not self.m("M13"):
            # Eylül planı: izin kaldırılınca yeniden eşleme gerekir → cihazlar ve bekleyen kodlar düşer (K9).
            for cid in aktif_cihazlar(od):
                if od["cihazlar"][cid]["kullanici"] == e["kullanici"]:
                    self.cihaz_kaldir(od, cid)
            for v in od["kodlar"].values():
                if v["kullanici"] == e["kullanici"] and v["durum"] == "aktif":
                    v["durum"] = "iptal"
        self.yeniden_uret(od, t, self.ctx.kapici_adaylari(e["ofis"], t, self.P))
        return [({KABUL}, {}, w)]

    def o_ozet_yukle(self, w, e, t):
        od = w[e["ofis"]]
        if od["sunucu"] != "acik":
            raise GirdiHatasi(f"olay {e['no']}: sunucu kapalıyken program özet yükleyemez")
        adaylar = self.ctx.kapici_adaylari(e["ofis"], t, self.P)
        sonuc = []
        retler = {v for v, _ in adaylar if v != "ok"}
        if retler:
            sonuc.append((retler, {}, copy.deepcopy(w) if len(retler) < len(adaylar) else w))
        if any(v == "ok" for v, _ in adaylar):
            od["ozet"] = [t]
            od["ozet_gorunum"] = {u: gorunum(od, u) for u in sorted(od["kullanicilar"])}
            sonuc.append(({KABUL}, {}, w))
        return sonuc

    # ---------------------------------------------------------------- cihaz (uzak) olayları
    def _sinir_ve_esle(self, w, e, t, kayit, kullanici, program_siniri=True):
        """Sınır denetimi + eşleme (K10–K13). Dönen: [(sonuclar, ek, dunya)]; w yerinde değişebilir."""
        od = w[e["ofis"]]
        if program_siniri:
            sinirlar = sorted({min(p["cihaz_siniri"], kayit["cihaz_siniri"])
                               for p in self.ctx.program_adaylari(e["ofis"], t)})
        else:
            sinirlar = [kayit["cihaz_siniri"]]
        n = self.sayi(od, t, kullanici)
        ek = {}
        if not self.m("M06") and n >= sinirlar[0]:
            if n < sinirlar[-1]:
                raise GirdiHatasi(f"olay {e['no']}: sınır belirsiz (lisans değişiminden sonra program denetimi ve "
                                  f"önbellek süresi beklenmeli)")
            if self.sinir_dolunca() == "reddet":
                return None  # çağıran "sinir_dolu" yazar
            sinir = sinirlar[0]
            aktif = aktif_cihazlar(od)
            dusen = aktif[:max(0, len(aktif) - sinir + 1)]
            for cid in dusen:
                self.cihaz_kaldir(od, cid)
            ek["dusen"] = dusen
        od["cihazlar"][e["cihaz"]] = {"kullanici": kullanici, "t": t, "aktif": True}
        self.yeniden_uret(od, t, [("ok", kayit)])
        return [({KABUL}, ek, w)]

    def _yeni_cihaz(self, w, e):
        for od in w.values():
            if e["cihaz"] in od["cihazlar"]:
                raise GirdiHatasi(f"olay {e['no']}: cihaz kimliği yeniden kullanıldı ({e['cihaz']}); her eşleme yeni kimlik")

    def o_esle(self, w, e, t):
        self._yeni_cihaz(w, e)
        sonuc = []
        adaylar = self.ctx.kapici_adaylari(e["ofis"], t, self.P)
        for v, kayit in adaylar:
            w2 = copy.deepcopy(w) if len(adaylar) > 1 else w
            od = w2[e["ofis"]]
            if v != "ok":
                sonuc.append(({v}, {}, w2))
                continue
            if od["sunucu"] != "acik" and not self.m("M44"):
                sonuc.append(({"ret:sunucu_kapali"}, {}, w2))
                continue
            kod = od["kodlar"].get(e["kod"])
            if kod is None and self.m("M04"):
                for od_b in w2.values():
                    if e["kod"] in od_b["kodlar"]:
                        kod = od_b["kodlar"][e["kod"]]
            gecerli_durum = ("aktif", "kullanildi") if self.m("M02") else ("aktif",)
            if kod is None or kod["durum"] not in gecerli_durum:
                sonuc.append(({"ret:kod_gecersiz"}, {}, w2))
                continue
            if not self.m("M01") and t - kod["t"] >= min(PARAMETRELER["kod_sure"]["degerler"]) * 60:
                bitis = kod["t"] + self.P["kod_sure"] * 60
                gecmis = t > bitis if self.m("M03") else t >= bitis
                if gecmis:
                    sonuc.append(({"ret:kod_gecersiz"}, {}, w2))
                    continue
            if not od["kullanicilar"][kod["kullanici"]]["uzaktan"]:
                sonuc.append(({"ret:uzaktan_izni_yok"}, {}, w2))
                continue
            r = self._sinir_ve_esle(w2, e, t, kayit, kod["kullanici"])
            if r is None:
                # Sınır dolu: kodun harcanıp harcanmadığı belirsiz (V7) → iki dünya.
                w3 = copy.deepcopy(w2)
                w3[e["ofis"]]["kodlar"][e["kod"]]["durum"] = "kullanildi"
                sonuc.append(({"ret:sinir_dolu"}, {}, w2))
                sonuc.append(({"ret:sinir_dolu"}, {}, w3))
                continue
            if not self.m("M02"):
                kod["durum"] = "kullanildi"
            sonuc.extend(r)
        return sonuc

    def o_kapici_dogrudan_kayit(self, w, e, t):
        self._yeni_cihaz(w, e)
        if e["kullanici"] not in w[e["ofis"]]["kullanicilar"]:
            raise GirdiHatasi(f"olay {e['no']}: bilinmeyen kullanıcı")
        sonuc = []
        adaylar = self.ctx.kapici_adaylari(e["ofis"], t, self.P)
        for v, kayit in adaylar:
            w2 = copy.deepcopy(w) if len(adaylar) > 1 else w
            if v != "ok":
                sonuc.append(({v}, {}, w2))
                continue
            if self.m("M46"):
                od = w2[e["ofis"]]
                od["cihazlar"][e["cihaz"]] = {"kullanici": e["kullanici"], "t": t, "aktif": True}
                sonuc.append(({KABUL}, {}, w2))
                continue
            r = self._sinir_ve_esle(w2, e, t, kayit, e["kullanici"], program_siniri=False)
            sonuc.extend(r if r is not None else [({"ret:sinir_dolu"}, {}, w2)])
        return sonuc

    def _deneme_anahtari(self, e):
        v = self.P["deneme_anahtari"]
        if self.m("M31"):
            v = "cihaz" if v == "kullanici" else "kullanici"
        return ("k:" + e["kullanici"]) if v == "kullanici" else ("c:" + e["cihaz"])

    def o_giris(self, w, e, t):
        od0 = w[e["ofis"]]
        if e["kullanici"] not in od0["kullanicilar"]:
            raise GirdiHatasi(f"olay {e['no']}: bilinmeyen kullanıcı {e['kullanici']!r}")
        sonuc = []
        gecis = self.kapici_girisi(w, e, t)
        for r, kayit in gecis:
            w2 = copy.deepcopy(w) if len(gecis) > 1 else w
            od = w2[e["ofis"]]
            if r != "gec":
                sonuc.append(({r}, {}, w2))
                continue
            if od["sunucu"] != "acik":
                sonuc.append(({"ret:sunucu_kapali"}, {}, w2))
                continue
            cihaz = od["cihazlar"][e["cihaz"]]
            if cihaz["kullanici"] != e["kullanici"]:
                v = self.P["cihaz_kullanici"]
                if self.m("M35"):
                    v = "ofisin_kullanicilari" if v == "yalniz_eslenen" else "yalniz_eslenen"
                if v == "yalniz_eslenen":
                    sonuc.append(({"ret:cihaz_baska_kullanici"}, {}, w2))
                    continue
            yerel_taklit = self.m("M27") and (e.get("gorunen_adres") == "127.0.0.1"
                                               or "127.0.0.1" in json.dumps(e.get("basliklar", {})))
            k = od["kullanicilar"][e["kullanici"]]
            # Deneme sayacı (K19, P11–P13): tünel isteği her zaman uzaktır; görünen adres ve başlıklar yok sayılır.
            if not yerel_taklit:
                gerekli = e["parola"] == "yanlis" or any(v["sayi"] or v["kilit"] is not None for v in od["deneme"].values())
                if gerekli:
                    anahtar = self._deneme_anahtari(e)
                    kayit_d = od["deneme"].setdefault(anahtar, {"sayi": 0, "kilit": None})
                    if kayit_d["kilit"] is not None and t >= kayit_d["kilit"] and not self.m("M53"):
                        kayit_d["kilit"] = None
                    if kayit_d["kilit"] is not None and not (self.m("M30") and e["parola"] == "dogru"):
                        sonuc.append(({"ret:deneme_siniri"}, {}, w2))
                        continue
                    if e["parola"] == "yanlis":
                        kayit_d["sayi"] += 1
                        if kayit_d["sayi"] >= self.P["deneme_siniri"]:
                            kilit = self.P["kilit_dk"]
                            if self.m("M48"):
                                kilit = 30 if kilit == 15 else 15
                            kayit_d["kilit"] = t + kilit * 60
                            kayit_d["sayi"] = 0
                        sonuc.append(({"ret:parola_yanlis"}, {}, w2))
                        continue
                    if k["uzaktan"] and not self.m("M29"):
                        kayit_d["sayi"] = 0
                    if kayit_d["sayi"] == 0 and kayit_d["kilit"] is None:
                        del od["deneme"][anahtar]
            elif e["parola"] == "yanlis":
                sonuc.append(({"ret:parola_yanlis"}, {}, w2))
                continue
            if not k["uzaktan"]:
                sonuc.append(({"ret:uzaktan_izni_yok"}, {}, w2))
                continue
            # Aynı cihazda yeni giriş eski oturumu kapatır mı? Belirsiz (V14) → eski oturumlar "belirsiz".
            for s in od["oturumlar"].values():
                if s["cihaz"] == e["cihaz"] and s["durum"] == "acik":
                    s["durum"] = "belirsiz"
            od["oturumlar"][e["oturum"]] = {"cihaz": e["cihaz"], "kullanici": e["kullanici"], "bas": t, "son": t,
                                            "durum": "acik"}
            sonuc.append(({KABUL}, {}, w2))
        return sonuc

    def _oturum_gecerli(self, od, e, t):
        """Dönen: "gecersiz" | "gecerli" | "belirsiz"; süresi dolan oturum kapanır (K16, P7, P8)."""
        s = od["oturumlar"].get(e.get("oturum"))
        if s is None or s["durum"] == "bitti":
            return "gecersiz"
        if s["cihaz"] != e["cihaz"] and not self.m("M34"):
            return "gecersiz"
        bos = t - s["son"] - (1 if self.m("M52") else 0)
        if not self.m("M32") and bos >= 15 * 60 and bos >= self.P["oturum_bosta"] * 60:
            s["durum"] = "bitti"
            return "gecersiz"
        if not self.m("M33") and t - s["bas"] >= 8 * 3600 and t - s["bas"] >= self.P["oturum_mutlak"] * 3600:
            s["durum"] = "bitti"
            return "gecersiz"
        return "belirsiz" if s["durum"] == "belirsiz" else "gecerli"

    def o_istek(self, w, e, t):
        od0 = w[e["ofis"]]
        if self.m("M49") and not yol_izinli(e["yol"]):
            return [({"ret:yol_yasak"}, {}, w)]
        cihaz_atla = False
        if self.m("M11"):
            s = od0["oturumlar"].get(e.get("oturum"))
            cihaz_atla = s is not None and s["durum"] != "bitti" and s["cihaz"] == e["cihaz"]
        sonuc = []
        gecis = self.kapici_girisi(w, e, t, cihaz_atla=cihaz_atla)
        for r, kayit in gecis:
            w2 = copy.deepcopy(w) if len(gecis) > 1 else w
            od = w2[e["ofis"]]
            if r != "gec":
                sonuc.append(({r}, {}, w2))
                continue
            yol = e["yol"]
            if self.m("M22"):
                izinli = yol.startswith("/mobil") or yol.startswith("/api/mobil")
            elif self.m("M23"):
                izinli = not any(b in (".", "..") for b in yol.split("?")[0].split("/")) and \
                    any(yol.startswith(o) for o in IZINLI_ONEKLER)
            elif self.m("M28"):
                izinli = yol_izinli(yol) or yol.startswith("/api/auth/recovery/")
            else:
                izinli = yol_izinli(yol)
            if not izinli:
                sonuc.append(({"ret:yol_yasak"}, {}, w2))
                continue
            if od["sunucu"] != "acik":
                if self.m("M36") and e.get("yazma"):
                    sonuc.append(({KABUL}, {}, w2))
                else:
                    sonuc.append(({"ret:sunucu_kapali"}, {}, w2))
                continue
            if yol_statik(yol) and e.get("yetki") is None and e.get("sirket") is None:
                sonuc.append(({KABUL}, {}, w2))
                continue
            durum = self._oturum_gecerli(od, e, t)
            if durum == "gecersiz":
                sonuc.append(({"ret:oturum_gecersiz"}, {}, w2))
                continue
            if durum == "belirsiz":
                # Yeniden başlatmadan sonra oturum sürmüş de olabilir, düşmüş de (V13) → iki dünya.
                w3 = copy.deepcopy(w2)
                w3[e["ofis"]]["oturumlar"][e["oturum"]]["durum"] = "bitti"
                sonuc.append(({"ret:oturum_gecersiz"}, {}, w3))
                od["oturumlar"][e["oturum"]]["durum"] = "acik"
            s = od["oturumlar"][e["oturum"]]
            s["son"] = t
            k = od["kullanicilar"][s["kullanici"]]
            sirket = e.get("sirket")
            if sirket is not None:
                if sirket not in od["sirketler"] and not self.m("M47"):
                    sonuc.append(({"ret:sirket_yok"}, {}, w2))
                    continue
                if sirket not in etkin_sirketler(od, k, self.mut) and sirket in od["sirketler"]:
                    sonuc.append(({"ret:yetki_yok"}, {}, w2))
                    continue
            if not yetkili(od, k, e.get("yetki"), self.mut):
                sonuc.append(({"ret:yetki_yok"}, {}, w2))
                continue
            sonuc.append(({KABUL}, {}, w2))
        return sonuc

    def o_ozet_oku(self, w, e, t):
        od = w[e["ofis"]]
        sonuc_kume = set()
        zamanlar = set()
        for r, kayit in self.kapici_girisi(w, e, t, lisans_atla=self.m("M39")):
            if r != "gec":
                sonuc_kume.add(r)
                continue
            if self.m("M37") and od["sunucu"] != "acik":
                sonuc_kume.add("ret:sunucu_kapali")
                continue
            for d in od["ozet"]:
                if d == YOK_ZAMAN:
                    sonuc_kume.add("ret:ozet_yok")
                    continue
                if t - d >= 30 * 86400:
                    sinir = self.P["ozet_yas_siniri"]
                    if self.m("M38"):
                        sinir = "yok" if sinir == 30 else 30
                    if sinir == 30:
                        sonuc_kume.add("ret:ozet_eski")
                        continue
                sonuc_kume.add(KABUL)
                zamanlar.add(d)
        ek = {}
        if KABUL in sonuc_kume:
            kullanici = od["cihazlar"][e["cihaz"]]["kullanici"]
            simdi = gorunum(od, "yon" if self.m("M56") and "yon" in od["kullanicilar"] else kullanici, self.mut)
            onceki = (od["ozet_gorunum"] or {}).get(kullanici, {})
            en_az = {s: [b for b in bol if b in onceki.get(s, [])] for s, bol in simdi.items() if s in onceki}
            en_cok = simdi
            if self.m("M41") and od["ozet_gorunum"] is not None:
                en_cok = onceki
            ek = {"ozet_zamani": sorted(iso(z) for z in zamanlar), "gorunur": {"en_az": en_az, "en_cok": en_cok}}
        return [(sonuc_kume, ek, w)]

    def o_ozet_yaz(self, w, e, t):
        sonuc_kume = set()
        for r, kayit in self.kapici_girisi(w, e, t):
            if r != "gec":
                sonuc_kume.add(r)
            else:
                sonuc_kume.add(KABUL if self.m("M40") else "ret:yazma_yasak")
        return [(sonuc_kume, {}, w)]

    # ---------------------------------------------------------------- bakım olayları (bağlamı değiştirir)
    def o_sunucu(self, w, e, t):
        od = w[e["ofis"]]
        if od["sunucu"] == "kapali" and e["durum"] == "acik":
            for s in od["oturumlar"].values():
                if s["durum"] == "acik":
                    s["durum"] = "bitti" if self.m("M54") else "belirsiz"
        od["sunucu"] = e["durum"]
        return [({KABUL}, {}, w)]

    def o_bekle(self, w, e, t):
        return [({KABUL}, {}, w)]

    def o_program_lisans_denetle(self, w, e, t):
        return [({KABUL}, {}, w)]

    def o_lisans_degis(self, w, e, t):
        if self.m("M43"):
            yeni = self.ctx.gercek_son(e["ofis"])
            if not lisans_gecerli(yeni, t):
                od = w[e["ofis"]]
                for cid in aktif_cihazlar(od):
                    self.cihaz_kaldir(od, cid)
        return [({KABUL}, {}, w)]

    def o_lisans_servisi(self, w, e, t):
        return [({KABUL}, {}, w)]

    def baglam_uygula(self, e, t):
        """Bağlam olayları dünyalardan bağımsız ve belirlenimcidir; olaydan ÖNCE bir kez uygulanır."""
        tur = e["olay"]
        if tur == "lisans_degis":
            tarihce = self.ctx.lisans[e["ofis"]]
            tarihce.append((t, lisans_kaydi(e["lisans"], tarihce[-1][1])))
        elif tur == "lisans_servisi":
            self.ctx.erisim.append((t, e["erisim"] == "var"))
        elif tur == "program_lisans_denetle":
            self.ctx.program_denetim[e["ofis"]] = t

    # ---------------------------------------------------------------- koşucu
    AZAMI_DUNYA = 256

    def _isle(self, w, e, t):
        return getattr(self, "o_" + e["olay"])(w, e, t)

    def _sira_kos(self, w, uyeler):
        if not uyeler:
            return [({}, {}, w)]
        e = uyeler[0]
        t = zaman(e["t"])
        yollar = []
        for s, ek, w2 in self._isle(w, e, t):
            for kalan_s, kalan_ek, w3 in self._sira_kos(w2, uyeler[1:]):
                yollar.append(({e["no"]: s, **kalan_s}, {e["no"]: ek, **kalan_ek}, w3))
        return yollar

    @staticmethod
    def _esli(w):
        return {ofis: len(aktif_cihazlar(od)) for ofis, od in sorted(w.items())}

    def _ozetle(self, kayitlar):
        """kayitlar: [(sonuclar, ek, dunya)] → olay çıktısı."""
        sonuc, esli, dusen, zamanlar = set(), [], [], set()
        en_az, en_cok = None, {}
        for s, ek, w in kayitlar:
            sonuc |= s
            e_ = self._esli(w)
            if e_ not in esli:
                esli.append(e_)
            if "dusen" in ek and ek["dusen"] not in dusen:
                dusen.append(ek["dusen"])
            if "gorunur" in ek:
                zamanlar |= set(ek["ozet_zamani"])
                g = ek["gorunur"]
                for sk, bol in g["en_cok"].items():
                    en_cok[sk] = sorted(set(en_cok.get(sk, [])) | set(bol))
                if en_az is None:
                    en_az = {sk: list(b) for sk, b in g["en_az"].items()}
                else:
                    en_az = {sk: [b for b in bol if b in g["en_az"].get(sk, [])]
                             for sk, bol in en_az.items() if sk in g["en_az"]}
        cikti = {"sonuc": sorted(sonuc), "esli": sorted(esli, key=lambda x: json.dumps(x, sort_keys=True))}
        if dusen:
            cikti["dusen"] = sorted(dusen)
        if KABUL in sonuc and en_az is not None:
            cikti["ozet_zamani"] = sorted(zamanlar)
            cikti["gorunur"] = {"en_az": en_az, "en_cok": en_cok}
        return cikti

    def _temizle(self, w, t):
        """Bundan sonra hiçbir sonucu değiştiremeyecek durumu atar (dünyalar birleşebilsin). Yalnız her parametre
        değerinde etkisiz olanlar: süresi her durumda dolmuş kod, her durumda bitmiş oturum, silinmiş cihaz (kimlik
        tekrarı girdi kuralıyla yasak), boş deneme kaydı. İlgili mutasyonlarda atılmaz (mutasyonu gizlemesin)."""
        en_uzun_kod = max(PARAMETRELER["kod_sure"]["degerler"]) * 60
        en_uzun_bos = max(PARAMETRELER["oturum_bosta"]["degerler"]) * 60
        en_uzun_omur = max(PARAMETRELER["oturum_mutlak"]["degerler"]) * 3600
        for od in w.values():
            if self.mut not in ("M01", "M03"):
                for kod in [k for k, v in od["kodlar"].items() if t - v["t"] >= en_uzun_kod]:
                    del od["kodlar"][kod]
            if self.mut not in ("M10", "M12"):
                for cid in [c for c, v in od["cihazlar"].items() if not v["aktif"]]:
                    del od["cihazlar"][cid]
            for ot in list(od["oturumlar"]):
                s = od["oturumlar"][ot]
                bitmis = s["durum"] == "bitti"
                if self.mut != "M32" and t - s["son"] >= en_uzun_bos:
                    bitmis = True
                if self.mut != "M33" and t - s["bas"] >= en_uzun_omur:
                    bitmis = True
                if self.mut not in ("M10", "M11", "M12") and s["cihaz"] not in od["cihazlar"]:
                    bitmis = True
                if bitmis and self.mut not in ("M11", "M34"):
                    del od["oturumlar"][ot]
            for a in [a for a, v in od["deneme"].items() if v["sayi"] == 0 and (v["kilit"] is None or t >= v["kilit"])]:
                del od["deneme"][a]
        return w

    def _birlestir(self, dunyalar):
        if len(dunyalar) <= 1:
            return dunyalar
        gorulen, sonuc = set(), []
        for w in dunyalar:
            k = dunya_anahtari(w)
            if k not in gorulen:
                gorulen.add(k)
                sonuc.append(w)
        if len(sonuc) > self.AZAMI_DUNYA:
            raise GirdiHatasi(f"dünya sayısı {len(sonuc)} > {self.AZAMI_DUNYA}: senaryo çok belirsiz")
        return sonuc

    def kos(self, gozlem=None):
        """Bütün olaylar. gozlem verilirse (programın çıktısı) dünyalar ona göre süzülür, farklar listelenir."""
        sirali = sorted(self.olaylar, key=lambda e: (zaman(e["t"]), OLAY_SINIFI[e["olay"]], e["no"]))
        olaylar, gruplar, farklar = {}, {}, []
        islenen = set()
        for e in sirali:
            g = e.get("grup")
            if g is not None and g in islenen:
                continue
            uyeler = [e] if g is None else [x for x in sirali if x.get("grup") == g]
            if g is not None:
                islenen.add(g)
                if any(OLAY_SINIFI[x["olay"]] == 0 for x in uyeler):
                    raise GirdiHatasi(f"grup {g}: bakım olayı gruba konmaz")
            for x in uyeler:
                self.baglam_uygula(x, zaman(x["t"]))
            yollar = []  # (no -> sonuclar, no -> ek, dunya)
            for w in self.dunyalar:
                sirasi = [list(p) for p in itertools.permutations(uyeler)] if len(uyeler) > 1 else [uyeler]
                for p in sirasi:
                    w0 = copy.deepcopy(w) if len(sirasi) > 1 else w
                    yollar.extend(self._sira_kos(w0, p))
            # Olay başına çıktı (bütün yollar)
            for x in uyeler:
                kay = [(s[x["no"]], ek[x["no"]], w) for s, ek, w in yollar]
                olaylar[x["no"]] = self._ozetle(kay)
            if g is not None:
                secenekler = []
                for s, _, _ in yollar:
                    d = {str(n): sorted(v) for n, v in sorted(s.items())}
                    if d not in secenekler:
                        secenekler.append(d)
                gruplar[g] = sorted(secenekler, key=lambda d: json.dumps(d, sort_keys=True))
            # Gözlemle süzme
            if gozlem is not None:
                uyan = []
                for s, ek, w in yollar:
                    tamam = True
                    for x in uyeler:
                        gz = gozlem.get(str(x["no"]))
                        if gz is None:
                            continue
                        if not gozlem_uyar(gz, s[x["no"]], ek[x["no"]], self._esli(w)):
                            tamam = False
                            break
                    if tamam:
                        uyan.append((s, ek, w))
                for x in uyeler:
                    if OLAY_SINIFI[x["olay"]] >= 1 and str(x["no"]) not in gozlem:
                        farklar.append({"no": x["no"], "neden": "programın çıktısında yok (ders 4)"})
                if not uyan:
                    for x in uyeler:
                        gz = gozlem.get(str(x["no"]))
                        if gz is not None:
                            kume = olaylar[x["no"]]["sonuc"]
                            if gz.get("sonuc") in kume:
                                sinif = "BULGU (eşli / görünür / özet zamanı ya da önceki olaylarla tutarsız yol)"
                            elif gz.get("sonuc") == KABUL or KABUL in kume:
                                sinif = "BULGU (kabul ↔ ret)"
                            else:
                                sinif = "İNCELE (ikisi de ret, ret sınıfı farklı; V16 ret önceliği)"
                            farklar.append({"no": x["no"], "olay": x["olay"], "program": gz,
                                            "kahin": olaylar[x["no"]], "sinif": sinif})
                    uyan = yollar  # karşılaştırma sürer; sonraki farklar bu noktadan etkilenebilir
                yollar = uyan
            t_son = zaman(uyeler[0]["t"])
            self.dunyalar = self._birlestir([self._temizle(w, t_son) for _, _, w in yollar])
        return {"olaylar": {str(k): v for k, v in sorted(olaylar.items())}, "gruplar": gruplar, "farklar": farklar}


def gozlem_uyar(gz, sonuclar, ek, esli):
    if gz.get("sonuc") not in sonuclar:
        return False
    if "esli" in gz and gz["esli"] != {k: esli[k] for k in gz["esli"] if k in esli}:
        return False
    if "dusen" in gz and sorted(gz["dusen"]) != sorted(ek.get("dusen", [])):
        return False
    if gz.get("sonuc") == KABUL and "gorunur" in ek:
        if "ozet_zamani" in gz and gz["ozet_zamani"] is not None:
            if zaman(gz["ozet_zamani"]) not in {zaman(z) for z in ek["ozet_zamani"]}:
                return False
        if "gorunur" in gz:
            en_az, en_cok = ek["gorunur"]["en_az"], ek["gorunur"]["en_cok"]
            for sk, bol in gz["gorunur"].items():
                if sk not in en_cok or not set(bol) <= set(en_cok[sk]):
                    return False  # yetkisiz şirket / bölüm görünüyor
            for sk, bol in en_az.items():
                if bol and (sk not in gz["gorunur"] or not set(bol) <= set(gz["gorunur"][sk])):
                    return False
    return True


# ---------------------------------------------------------------------------------------------------------------
# Karar ağacı numaralandırması: yalnız okunan parametreler dallanır; yaprağın ataması = okunan parametreler.
# ---------------------------------------------------------------------------------------------------------------
def agac(senaryo, mut=None, sabit=None):
    yapraklar = []
    yigin = [dict(sabit or {})]
    while yigin:
        a = yigin.pop()
        try:
            c = Model(senaryo, Parametreler(a), mut).kos()
        except ParamGerekli as pg:
            for v in reversed(PARAMETRELER[pg.ad]["degerler"]):
                yigin.append({**a, pg.ad: v})
            continue
        c.pop("farklar", None)
        yapraklar.append((a, c))
    return yapraklar


def gruplu(yapraklar):
    gruplar = {}
    for a, c in yapraklar:
        k = json.dumps(c, sort_keys=True, ensure_ascii=False)
        gruplar.setdefault(k, {"birlesimler": [], "cikti": c})["birlesimler"].append(birlesim_metni(a))
    return sorted(gruplar.values(), key=lambda g: g["birlesimler"][0])


def tam_birlesim(atama):
    a = oneri_birlesimi()
    a.update(atama)
    return a


def hesapla(senaryo, atama=None, mut=None):
    return Model(senaryo, Parametreler(tam_birlesim(atama or {})), mut).kos()


# ---------------------------------------------------------------------------------------------------------------
# Komut satırı
# ---------------------------------------------------------------------------------------------------------------
def _oku(yol):
    with open(yol, encoding="utf-8") as f:
        return json.load(f)


def ana(argv):
    if len(argv) < 2 or argv[1] not in ("hesapla", "karsilastir", "parametreler"):
        print("kullanım: kahin.py hesapla <senaryo.json> [--birlesim k=v;…]\n"
              "          kahin.py karsilastir <kabul.json> <program.json> [--birlesim k=v;…]\n"
              "          kahin.py parametreler", file=sys.stderr)
        return 2
    birlesim = {}
    if "--birlesim" in argv:
        birlesim = birlesim_coz(argv[argv.index("--birlesim") + 1])
    if argv[1] == "parametreler":
        print(json.dumps(PARAMETRELER, ensure_ascii=False, indent=1))
        return 0
    if argv[1] == "hesapla":
        s = _oku(argv[2])
        print(json.dumps(hesapla(s, birlesim), ensure_ascii=False, indent=1, sort_keys=True))
        return 0
    kabul = _oku(argv[2])
    program = _oku(argv[3])
    atama = tam_birlesim(birlesim or birlesim_coz(kabul.get("secilen_birlesim") or ""))
    print("TAP version 13")
    gecen = kalan = 0
    for i, sen in enumerate(kabul["senaryolar"], 1):
        ad = sen["ad"]
        if sen.get("programda_uretilemez"):
            print(f"ok {i} - {ad} # SKIP programda üretilemez (DENENMEYEN'e yazılır)")
            continue
        gz = program.get(ad)
        if gz is None:
            print(f"not ok {i} - {ad}: programın çıktısında yok")
            kalan += 1
            continue
        r = Model(sen, Parametreler(atama)).kos(gozlem=gz)
        if r["farklar"]:
            print(f"not ok {i} - {ad}")
            for f in r["farklar"][:10]:
                print("  # FARK " + json.dumps(f, ensure_ascii=False, sort_keys=True))
            kalan += 1
        else:
            print(f"ok {i} - {ad}")
            gecen += 1
    print(f"# birlesim {birlesim_metni(atama)}")
    print(f"# tests {gecen + kalan}\n# pass {gecen}\n# fail {kalan}")
    return 0 if kalan == 0 else 1


if __name__ == "__main__":
    sys.exit(ana(sys.argv))
