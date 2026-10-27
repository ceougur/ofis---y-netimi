#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DestekOfis 2.4.7 — EDM'nin KABUL ETTİĞİ e-Belge gönderimlerinin sayacı (B1) ve /v1/check `usage` alanı (B2): temiz oda kâhini.

Kaynak YALNIZ karar metnidir: CLAUDE.md "2.4.7 KAPSAMI — EDM İŞ ORTAKLIĞI", docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md §3.3 (B1, B2)
ve docs/erp/2.4.7-IS-LISTESI.md "Nasıl bozulur?". Programın kodu (server/, client/, test/ altındaki program testleri) GÖRÜLMEDEN
yazıldı (CLAUDE.md ders 5). Yalnız standart kütüphane. Kurallar K1…, varsayımlar V1…, açık sorular S1…: README.md.

Metnin sustuğu yerlerde kâhin KARAR VERMEZ (ders 40/43): her seçenek bir PARAMETREdir ve kabul.json bütün birleşimlerin
beklenen sayılarını taşır. Kullanıcı 27.10.2026'da S1–S5'i seçti (docs/2.4.7-IS-LISTESI.md "KARARLAR — EDM sayacı"): SECILEN birleşim
komut satırının varsayılanıdır ve program onunla karşılaştırılır. Aynı günün F1/F2 ve "sayaç defteri yedekte, geri yüklemede yalnız
birleştirilir" kararları kurallara eklendi (README K10–K12).

Komut satırı:
  python3 -I kahin.py hesapla <olaylar.json> [--referans ISO]… [--param ad=deger]…
  python3 -I kahin.py karsilastir <kabul.json> <program-cikti.json> --birlesim "<ay=…;anahtar=…;e11048=…;pencere=…;geri_yukleme=…>"
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from itertools import product

# Türkiye 7 Eylül 2016'dan beri yaz saati uygulamadan sabit UTC+3'tür (V1). Daha eski tarih girdi hatası sayılır.
TR = timezone(timedelta(hours=3), "TR")

ORTAMLAR = ("live", "test")
TURLER = ("efatura", "earsiv", "esmm")
PROFILLER = ("TEMEL", "TICARI")

BELGE_OLAYLARI = (
    "gonder_kabul", "gonder_red", "gonder_belirsiz", "belirsiz_kesinlesti_kabul", "belirsiz_kesinlesti_red",
    "yeniden_deneme_kabul", "zaten_gonderilmis_11048", "durum_sorgusu", "iptal",
    "durum_bulunamadi",  # F1 (27.10.2026): Durum Sorgula → EDM "bulunamadı"; önceki açık gönderim izlerini kapatır
    "belge_silindi",  # kâhin uzantısı: Listeden Sil / Silinenler (append-only: sayı değişmez)
)
# Kâhin uzantısı bakım olayları (yedek tatbikatı, S4 ve 27.10 sayaç defteri kararı):
#   yedek_alindi            şirket yedeği alındı; içine sayaç DEFTERİNİN kopyası girer (K12, V15)
#   yedekten_geri_yuklendi  yedek_zamani'ndaki yedek geri yüklendi; defter yalnız BİRLEŞTİRİLİR (K12)
#   sirket_sifirlandi       Şirket Verisini Sıfırla (S4: sayacı etkilemez)
#   sayac_defteri_kayboldu  kurulumda sayaç defteri yok (yeni kurulum / taşıma; kurulum düzeyinde, şirketsiz)
BAKIM_OLAYLARI = ("yedek_alindi", "yedekten_geri_yuklendi", "sirket_sifirlandi", "sayac_defteri_kayboldu")

# Aynı saniyedeki olayların mantıksal sırası (V8; ders 31: kimlikle değil olay sınıfı → yazım sırası).
SINIF = {
    "gonder_kabul": 0, "gonder_red": 0, "gonder_belirsiz": 0, "yeniden_deneme_kabul": 0,
    "zaten_gonderilmis_11048": 1, "durum_sorgusu": 2, "durum_bulunamadi": 2,
    "belirsiz_kesinlesti_kabul": 3, "belirsiz_kesinlesti_red": 3,
    "iptal": 4, "belge_silindi": 5, "yedek_alindi": 5, "yedekten_geri_yuklendi": 5, "sirket_sifirlandi": 5,
    "sayac_defteri_kayboldu": 5,
}

# Metnin sustuğu / çelişkili olduğu noktalar (README "Açık sorular"); kullanıcı 27.10.2026'da SECILEN'i seçti.
PARAMETRELER = {
    "ay": ("kesinlesme", "gonderim"),                    # S1: belirsiz → kabul kesinleşince hangi ay
    "anahtar": ("ettn_ortam", "sirket_ettn_ortam"),       # S2: "aynı ETTN + ortam" şirketler arasında da mı
    "e11048": ("saymaz", "kesinlestirir"),                # S3: belirsizden sonra gelen 11048 kesinleşme mi
    "pencere": ("icinde_dahil", "tamamlanan"),            # S5: "son 3 ay" hangi aylar
    "geri_yukleme": ("etkilemez", "geri_alir"),           # S4: yedekten geri yükleme / şirket sıfırlama sayacı geri alır mı
}
SECILEN = {"ay": "gonderim", "anahtar": "sirket_ettn_ortam", "e11048": "kesinlestirir", "pencere": "icinde_dahil",
           "geri_yukleme": "etkilemez"}  # KARARLAR — EDM sayacı (kullanıcı, 27.10.2026)
VARSAYILAN = dict(SECILEN)

BELGE_ALANLARI = {"sirket", "ortam", "tur", "ettn", "olay", "zaman", "profil", "not"}
BAKIM_ALANLARI = {"sirket", "olay", "zaman", "yedek_zamani", "not"}
BAKIM_GEREKLI = {
    "yedek_alindi": ("sirket", "olay", "zaman"),
    "yedekten_geri_yuklendi": ("sirket", "olay", "zaman", "yedek_zamani"),
    "sirket_sifirlandi": ("sirket", "olay", "zaman"),
    "sayac_defteri_kayboldu": ("olay", "zaman"),
}
BAKIM_IZINLI = {"sayac_defteri_kayboldu": {"olay", "zaman", "not"}}  # kurulum düzeyinde: şirket alanı yok


def birlesimler():
    """Bütün parametre birleşimleri (2^5 = 32), sabit sırayla."""
    adlar = list(PARAMETRELER)
    for degerler in product(*(PARAMETRELER[a] for a in adlar)):
        yield dict(zip(adlar, degerler))


def birlesim_adi(p):
    return ";".join(f"{ad}={p[ad]}" for ad in PARAMETRELER)


def birlesim_coz(metin):
    p = dict(VARSAYILAN)
    for parca in filter(None, (x.strip() for x in metin.split(";"))):
        ad, _, deger = parca.partition("=")
        p[ad.strip()] = deger.strip()
    return parametre_dogrula(p)


def parametre_dogrula(p):
    tam = dict(VARSAYILAN)
    for ad, deger in (p or {}).items():
        if ad not in PARAMETRELER:
            raise ValueError(f"bilinmeyen parametre: {ad}")
        if deger not in PARAMETRELER[ad]:
            raise ValueError(f"{ad} için geçersiz değer: {deger!r} (seçenekler: {', '.join(PARAMETRELER[ad])})")
        tam[ad] = deger
    return tam


def zaman_coz(metin, alan="zaman"):
    """ISO 8601. Ofsetli giriş TR saatine çevrilir; ofsetsiz giriş TR yerel saati sayılır (V1)."""
    if not isinstance(metin, str) or not metin.strip():
        raise ValueError(f"{alan} boş ya da metin değil: {metin!r}")
    try:
        an = datetime.fromisoformat(metin.strip())
    except ValueError as hata:
        raise ValueError(f"{alan} ISO 8601 değil: {metin!r}") from hata
    if an.tzinfo is None:
        an = an.replace(tzinfo=TR)
    if an.astimezone(TR).year < 2017:
        raise ValueError(f"{alan} 2017'den eski: {metin!r} (TR'nin sabit UTC+3 olmadığı dönem)")
    return an


def ettn_normal(metin):
    return metin.strip().lower()  # V7: ETTN bir UUID'dir; büyük/küçük harf ve baş/son boşluk duyarsız


def hazirla(olaylar):
    """Girdiyi doğrular ve iç alanları (_an, _sira, _yedek) ekler. Hatalı girdi SESSİZCE ATLANMAZ (V14; ders 3/4)."""
    if not isinstance(olaylar, list):
        raise ValueError("olay listesi bir JSON dizisi olmalı")
    hazir = []
    turu = {}
    for sira, ham in enumerate(olaylar):
        if not isinstance(ham, dict):
            raise ValueError(f"olay {sira}: nesne değil")
        olay = ham.get("olay")
        if olay in BELGE_OLAYLARI:
            izinli, gerekli = BELGE_ALANLARI, ("sirket", "ortam", "tur", "ettn", "olay", "zaman")
        elif olay in BAKIM_OLAYLARI:
            izinli = BAKIM_IZINLI.get(olay, BAKIM_ALANLARI)
            gerekli = BAKIM_GEREKLI[olay]
        else:
            raise ValueError(f"olay {sira}: bilinmeyen olay türü {olay!r}")
        fazla = set(ham) - izinli
        if fazla:
            raise ValueError(f"olay {sira}: bilinmeyen alan(lar) {sorted(fazla)}")
        for alan in gerekli:
            if not isinstance(ham.get(alan), str) or not ham[alan].strip():
                raise ValueError(f"olay {sira}: {alan} eksik ya da boş")
        o = dict(ham)
        o["_an"] = zaman_coz(ham["zaman"])
        o["_sira"] = sira
        if olay in BELGE_OLAYLARI:
            if o["ortam"] not in ORTAMLAR:
                raise ValueError(f"olay {sira}: geçersiz ortam {o['ortam']!r}")
            if o["tur"] not in TURLER:
                raise ValueError(f"olay {sira}: geçersiz tür {o['tur']!r}")
            if "profil" in o and (o["tur"] != "efatura" or o["profil"] not in PROFILLER):
                raise ValueError(f"olay {sira}: profil yalnız e-Fatura için TEMEL ya da TICARI olabilir")
            belge = (o["ortam"], ettn_normal(o["ettn"]))
            if turu.setdefault(belge, o["tur"]) != o["tur"]:  # V10: belgenin türü değişmez
                raise ValueError(f"olay {sira}: aynı ETTN ({o['ettn']}, {o['ortam']}) iki farklı türle: {turu[belge]} / {o['tur']}")
        else:
            if olay == "yedekten_geri_yuklendi":
                o["_yedek"] = zaman_coz(ham["yedek_zamani"], "yedek_zamani")
                if o["_yedek"] > o["_an"]:
                    raise ValueError(f"olay {sira}: yedek_zamani geri yükleme anından sonra")
        hazir.append(o)
    return hazir


class Durum:
    """Sayacın iç durumu.
    kayitlar  : sayaç DEFTERİ, anahtar → sayılmış belge (append-only; yalnız defter kaybolursa boşalır, K12)
    denemeler : gönderim izleri (şirket verisinde), anahtar → [(an, 'belirsiz' | 'kapanis' | 'red', şirket)]
    yedekler  : (şirket, yedek anı) → o andaki defterin kopyası (K12, V15)"""

    def __init__(self):
        self.kayitlar = {}
        self.denemeler = {}
        self.yedekler = {}


class Kahin:
    """Kâhin modeli. Küçük adımlar ayrı yöntemdir; kahin_test.py'deki mutasyonlar bunları ezerek bilerek hata enjekte eder."""

    def __init__(self, parametreler=None):
        self.p = parametre_dogrula(parametreler)

    # ---- zaman ve anahtar --------------------------------------------------------------------------------------------
    def yerel(self, an):
        return an.astimezone(TR)

    def ay(self, an):
        y = self.yerel(an)
        return f"{y.year:04d}-{y.month:02d}"

    def ettn(self, o):
        return ettn_normal(o["ettn"])

    def anahtar(self, o):
        # K3 "Aynı ETTN + ortam BİR kez sayılır"; şirketin anahtara girip girmediği S2.
        if self.p["anahtar"] == "sirket_ettn_ortam":
            return (o["sirket"], o["ortam"], self.ettn(o))
        return (o["ortam"], self.ettn(o))

    def sirala(self, olaylar):
        return sorted(olaylar, key=lambda o: (o["_an"], SINIF[o["olay"]], o["_sira"]))

    def referansta(self, an, referans):
        return referans is None or an <= referans

    # ---- olay sınıfları ----------------------------------------------------------------------------------------------
    def dogrudan_kabul(self, o):
        # K1: EDM'nin kabul ettiği gönderim. V2: red/belirsizden sonra kabul edilen yeniden deneme de bir kabuldür.
        return o["olay"] in ("gonder_kabul", "yeniden_deneme_kabul")

    def belirsiz(self, o):
        return o["olay"] == "gonder_belirsiz"

    def kapanis(self, o):
        # K10 (F1): EDM "bulunamadı" (ve kesin red, V6) önceki açık gönderim izlerini kapatır / geçersiz kılar.
        return o["olay"] in ("durum_bulunamadi", "belirsiz_kesinlesti_red")

    def red(self, o):
        # K11 (F2): yeniden gönderimin KENDİ reddi önceki açık izi kapatmaz; yalnız kayda geçer.
        return o["olay"] == "gonder_red"

    def kesinlesme(self, o):
        # K4 belirsiz gönderimin sonradan kesinleşmesi; S3: 11048 da kesinleştirir mi.
        if o["olay"] == "belirsiz_kesinlesti_kabul":
            return True
        return o["olay"] == "zaten_gonderilmis_11048" and self.p["e11048"] == "kesinlestirir"

    def sayilir(self, o):
        return True  # V9: e-Fatura TEMEL ve TİCARİ ikisi de "efatura"; tür/şirket süzgeci yok (K1, K7)

    def belirsiz_onkosulu(self, denemeler):
        # V5: kesinleşen belirsiz deneme bu sürümün olay akışında olmalı; yoksa istek eski sürümün adıyla gitmiştir (K6).
        return any(tip == "belirsiz" for _, tip, _ in denemeler)

    def gonderim_ani(self, denemeler, an):
        # K10/K11 (F1, F2) + V6: kabul edilen deneme = İLK AÇIK iz, yani son kapanıştan ("bulunamadı" / kesin red) sonraki ilk belirsiz
        # deneme; gonder_red izi kapatmaz. Kapanıştan sonra yeni deneme yoksa ilk belirsiz deneme (V6b).
        son = max((i for i, (_, tip, _) in enumerate(denemeler) if tip == "kapanis"), default=-1)
        adaylar = [x for x, tip, _ in denemeler[son + 1:] if tip == "belirsiz"]
        if not adaylar:
            adaylar = [x for x, tip, _ in denemeler if tip == "belirsiz"]
        return adaylar[0] if adaylar else an

    def cikti_turu(self, kayit):
        return kayit["tur"]

    def cikti_ortami(self, kayit):
        return kayit["ortam"]

    # ---- işleme ------------------------------------------------------------------------------------------------------
    def yeni_durum(self):
        return Durum()

    def kaydet(self, d, k, o, ay):
        d.kayitlar[k] = {"sirket": o["sirket"], "ortam": o["ortam"], "tur": o["tur"], "ay": ay, "an": o["_an"]}

    def geri_al(self, d, sirket, sinir):
        """S4 'geri_alir' seçeneği: şirketin (sinir yoksa hepsi, varsa yedekten sonraki) kayıt ve denemeleri unutulur."""
        def gider(sahibi, an):
            return sahibi == sirket and (sinir is None or an > sinir)
        d.kayitlar = {k: r for k, r in d.kayitlar.items() if not gider(r["sirket"], r["an"])}
        for k in list(d.denemeler):
            d.denemeler[k] = [x for x in d.denemeler[k] if not gider(x[2], x[0])]

    def yedek_al(self, d, o):
        d.yedekler[(o["sirket"], o["_an"])] = dict(d.kayitlar)  # V15: defterin TAMAMININ kopyası

    def defter_kaybet(self, d):
        d.kayitlar = {}  # sayaç dosyası kurulumda yok; gönderim izleri şirket verisiyle taşınır, onlar kalır

    def birlestir(self, d, yedek, sirket):
        # K12: yedekteki defter yalnız BİRLEŞTİRİLİR — eksik satır eklenir, var olan değişmez, hiçbir satır silinmez.
        for k, r in yedek.items():
            if k not in d.kayitlar:
                d.kayitlar[k] = r

    def geri_yukle(self, d, o):
        yedek = d.yedekler.get((o["sirket"], o["_yedek"]))  # 2.4.7 öncesi yedekte defter kopyası yoktur
        if self.p["geri_yukleme"] == "etkilemez":
            if yedek is not None:
                self.birlestir(d, yedek, o["sirket"])
        elif yedek is not None:  # geri_alir (seçilmedi): şirketin defteri yedektekiyle değişir
            d.kayitlar = {k: r for k, r in d.kayitlar.items() if r["sirket"] != o["sirket"]}
            d.kayitlar.update({k: r for k, r in yedek.items() if r["sirket"] == o["sirket"]})
        else:
            self.geri_al(d, o["sirket"], o["_yedek"])

    def islem(self, d, o):
        t = o["olay"]
        if t in BAKIM_OLAYLARI:
            if t == "yedek_alindi":
                self.yedek_al(d, o)
            elif t == "sayac_defteri_kayboldu":
                self.defter_kaybet(d)
            elif t == "yedekten_geri_yuklendi":
                self.geri_yukle(d, o)
            elif self.p["geri_yukleme"] == "geri_alir":  # sirket_sifirlandi
                self.geri_al(d, o["sirket"], None)
            return
        k = self.anahtar(o)
        if self.dogrudan_kabul(o):
            if k not in d.kayitlar and self.sayilir(o):
                self.kaydet(d, k, o, self.ay(o["_an"]))
        elif self.belirsiz(o):
            d.denemeler.setdefault(k, []).append((o["_an"], "belirsiz", o["sirket"]))
        elif self.kapanis(o):
            d.denemeler.setdefault(k, []).append((o["_an"], "kapanis", o["sirket"]))
        elif self.red(o):
            d.denemeler.setdefault(k, []).append((o["_an"], "red", o["sirket"]))
        elif self.kesinlesme(o):
            den = d.denemeler.get(k, [])
            if k not in d.kayitlar and self.belirsiz_onkosulu(den) and self.sayilir(o):
                an = o["_an"] if self.p["ay"] == "kesinlesme" else self.gonderim_ani(den, o["_an"])
                self.kaydet(d, k, o, self.ay(an))
        # durum_sorgusu, iptal, belge_silindi ve ("saymaz" seçeneğinde) 11048: sayı ne artar ne azalır (K2, K3; V3).
        # durum_bulunamadi sayı eklemez; yalnız izleri kapatır (K10).

    def _kayitlar(self, hazir, referans=None):
        d = self.yeni_durum()
        for o in self.sirala([o for o in hazir if self.referansta(o["_an"], referans)]):
            self.islem(d, o)
        return list(d.kayitlar.values())

    def _say(self, kayitlar):
        sayilar = {}
        for r in kayitlar:
            k = f"{r['ay']}|{self.cikti_ortami(r)}|{self.cikti_turu(r)}"
            sayilar[k] = sayilar.get(k, 0) + 1
        return dict(sorted(sayilar.items()))

    # ---- B2 usage ----------------------------------------------------------------------------------------------------
    def pencere_aylari(self, referans):
        y = self.yerel(referans)
        bas = y.year * 12 + (y.month - 1)
        if self.p["pencere"] == "icinde_dahil":
            aylar = [bas - 2, bas - 1, bas]
        else:
            aylar = [bas - 3, bas - 2, bas - 1]
        return [f"{m // 12:04d}-{m % 12 + 1:02d}" for m in aylar]

    def usage_dahil(self, kayit, aylar, referans):
        return kayit["ay"] in aylar

    def _usage(self, hazir, referans):
        aylar = self.pencere_aylari(referans)
        kayitlar = [r for r in self._kayitlar(hazir, referans) if self.usage_dahil(r, aylar, referans)]
        sayilar = self._say(kayitlar)
        aylik = {f"{a}|{o}|{t}": sayilar.get(f"{a}|{o}|{t}", 0) for a in aylar for o in ORTAMLAR for t in TURLER}
        return {"aylar": aylar, "aylik": aylik, "toplam": usage_toplami(aylik)}

    # ---- dış arayüz --------------------------------------------------------------------------------------------------
    def sayilar(self, olaylar, referans=None):
        return self._say(self._kayitlar(hazirla(olaylar), zaman_coz(referans, "referans") if referans else None))

    def usage(self, olaylar, referans):
        return self._usage(hazirla(olaylar), zaman_coz(referans, "referans"))

    def calistir(self, olaylar, referanslar=(), gecmis=None):
        """{"sayilar": bütün olaylarla, "usage": {referans: …}}. `gecmis` (2.4.7 öncesi belgeler) yalnız sürücü içindir:
        geriye dönük doldurma YOK (K6), kâhin onu bilerek yok sayar."""
        del gecmis
        hazir = hazirla(olaylar)
        return {
            "sayilar": self._say(self._kayitlar(hazir)),
            "usage": {r: self._usage(hazir, zaman_coz(r, "referans")) for r in referanslar},
        }


def usage_toplami(aylik):
    """Pencere toplamı: ortam × tür ve ortam × toplam (C2'deki "Toplam" sütunu)."""
    toplam = {}
    for k, n in aylik.items():
        _, ortam, tur = k.split("|")
        toplam[f"{ortam}|{tur}"] = toplam.get(f"{ortam}|{tur}", 0) + n
        toplam[f"{ortam}|toplam"] = toplam.get(f"{ortam}|toplam", 0) + n
    return dict(sorted(toplam.items()))


# ---- karşılaştırma (program çıktısı ↔ kabul.json) ----------------------------------------------------------------------
def beklenen_bul(senaryo, birlesim):
    ad = birlesim_adi(birlesim) if isinstance(birlesim, dict) else birlesim
    for grup in senaryo["beklenen"]:
        if grup["birlesimler"] == "hepsi" or ad in grup["birlesimler"]:
            return grup
    raise KeyError(f"{senaryo['ad']}: {ad} birleşimi kabul.json'da yok")


def fark(beklenen, gelen):
    """Fark satırları; boş liste = aynı. Eksik sayı 0'dır; eksik referans/senaryo FARKTIR (ders 4)."""
    if not isinstance(gelen, dict):
        return ["program çıktısı yok ya da nesne değil"]
    satirlar = []
    b_say, g_say = beklenen.get("sayilar", {}), gelen.get("sayilar")
    if not isinstance(g_say, dict):
        satirlar.append("sayilar alanı yok")
        g_say = {}
    for k in sorted(set(b_say) | set(g_say)):
        if b_say.get(k, 0) != g_say.get(k, 0):
            satirlar.append(f"sayilar {k}: beklenen {b_say.get(k, 0)}, gelen {g_say.get(k, 0)}")
    g_usage = gelen.get("usage") or {}
    for r, bu in beklenen.get("usage", {}).items():
        gu = g_usage.get(r)
        if not isinstance(gu, dict):
            satirlar.append(f"usage {r}: yok")
            continue
        if list(gu.get("aylar", [])) != list(bu["aylar"]):
            satirlar.append(f"usage {r} aylar: beklenen {bu['aylar']}, gelen {gu.get('aylar')}")
        ga = gu.get("aylik", {})
        for k in sorted(set(bu["aylik"]) | set(ga)):
            if bu["aylik"].get(k, 0) != ga.get(k, 0):
                satirlar.append(f"usage {r} aylik {k}: beklenen {bu['aylik'].get(k, 0)}, gelen {ga.get(k, 0)}")
        gt = gu["toplam"] if "toplam" in gu else usage_toplami(ga)
        for k in sorted(set(bu["toplam"]) | set(gt)):
            if bu["toplam"].get(k, 0) != gt.get(k, 0):
                satirlar.append(f"usage {r} toplam {k}: beklenen {bu['toplam'].get(k, 0)}, gelen {gt.get(k, 0)}")
    return satirlar


def karsilastir(kabul, program, birlesim):
    """TAP çıktısı; çıkış kodu 0 yalnız bütün senaryolar aynıysa."""
    p = birlesim_coz(birlesim) if isinstance(birlesim, str) else parametre_dogrula(birlesim)
    gecen = kalan = 0
    for i, s in enumerate(kabul["senaryolar"], 1):
        satirlar = fark(beklenen_bul(s, p), program.get(s["ad"]))
        if satirlar:
            kalan += 1
            print(f"not ok {i} - {s['ad']}")
            for satir in satirlar[:20]:
                print(f"  # {satir}")
        else:
            gecen += 1
            print(f"ok {i} - {s['ad']}")
    print(f"1..{gecen + kalan}")
    for ad, n in (("tests", gecen + kalan), ("pass", gecen), ("fail", kalan), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
        print(f"# {ad} {n}")
    return 0 if kalan == 0 and gecen > 0 else 1


def _oku(yol):
    with open(yol, encoding="utf-8") as f:
        return json.load(f)


def main(argv):
    if len(argv) >= 2 and argv[0] == "hesapla":
        veri = _oku(argv[1])
        olaylar = veri["olaylar"] if isinstance(veri, dict) else veri
        referanslar = list(veri.get("referanslar", [])) if isinstance(veri, dict) else []
        p = {}
        i = 2
        while i < len(argv):
            if argv[i] == "--referans" and i + 1 < len(argv):
                referanslar.append(argv[i + 1])
            elif argv[i] == "--param" and i + 1 < len(argv):
                ad, _, deger = argv[i + 1].partition("=")
                p[ad] = deger
            else:
                raise SystemExit(f"bilinmeyen argüman: {argv[i]}")
            i += 2
        k = Kahin(p)
        cikti = {"parametreler": birlesim_adi(k.p), **k.calistir(olaylar, referanslar)}
        print(json.dumps(cikti, ensure_ascii=False, indent=1))
        return 0
    if len(argv) >= 3 and argv[0] == "karsilastir":
        birlesim = birlesim_adi(VARSAYILAN)
        if "--birlesim" in argv:
            birlesim = argv[argv.index("--birlesim") + 1]
        return karsilastir(_oku(argv[1]), _oku(argv[2]), birlesim)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
