#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""e-Belge (e-Fatura / e-Arşiv) NUMARA ve GÖNDERİM durum makinesi — temiz oda modeli (dil `destekofis-ebelge/1`).

Bu dosya programın kodunu GÖRMEDEN yazıldı. Kural kaynakları: GİB mevzuatı (numara biçimi, seri+yıl boşluksuz, sıra-tarih uyumu,
mükellefe e-Arşiv kesilmez, gönderilmiş belge değişmez), docs/FATURA-ISTEKLER.md "Kararlar", docs/fatura/E-BELGE-EDM.md ve CLAUDE.md
"Açık iş" 2.4.3 kararları. Her kural KARARLAR.md'de kaynağıyla yazılıdır (K-numaraları aşağıda yorumlarda geçer).

Kullanım:
  python3 -I test/bagimsiz/ebelge/model.py <senaryo.json>        # her adımdan sonra beklenen durumu (çatallanmasız ilk dünya) yazar
Kütüphane olarak: Model(senaryo).adim(i) → olası dünyalar; .sec(gozlem) gözleme en yakın dünyayı seçer (fark.py kullanır).

ÇATAL (belirsizlik): plan/mevzuat iki davranışa da izin veriyorsa model iki "dünya" üretir (ör. EDM'nin reddettiği belgenin numarası
korunur mu bırakılır mı). Adım sonunda gözleme en yakın dünya seçilir, seçim günlüğe yazılır. Değişmezler (fark.py) çatal seçiminden
bağımsız olarak HER ZAMAN programın gözlenen durumuna uygulanır; çatal, değişmezi gevşetmez.
"""

import copy
import json
import sys
from datetime import date, timedelta

DIL = "destekofis-ebelge/1"

# K1: belge türü carinin işaretinden gelir (CLAUDE.md 2.4.3 karar 4: "işaretliyse e-Fatura, değilse e-Arşiv kesilir").
# K2: e-Fatura alıcısının posta kutusu (PK) yoksa belge gönderilemez (CLAUDE.md 2.4.3 karar 2; GİB: e-Fatura alıcı etiketine gider).
# K3: gerçekte mükellef olan alıcıya e-Arşiv kesilmez (GİB e-Arşiv kılavuzu; FATURA-KARSILASTIRMA "allowedProfiles").
CARI_TURLERI = {
    "kisi": {"isaret": False, "pk": False, "mukellef": False},           # TCKN, mükellef değil → e-Arşiv
    "mukellef": {"isaret": True, "pk": True, "mukellef": True},          # VKN, işaretli, PK seçili → e-Fatura
    "mukellef_pksiz": {"isaret": True, "pk": False, "mukellef": True},   # işaretli, PK seçilmemiş → e-Fatura, gönderilemez (K2)
    "gizli_mukellef": {"isaret": False, "pk": False, "mukellef": True},  # işaretsiz ama GİB'de mükellef → e-Arşiv, gönderilemez (K3)
}

# K4: test ortamı serileri (EDM test hesabı; ayarda env "test") — e-Fatura TEF, e-Arşiv TEA; kâğıt/Müşteri Fişi FIS.
SERI = {"efatura": "TEF", "earsiv": "TEA", "kagit": "FIS"}


class _Belirsiz:
    def __repr__(self):
        return "?"


B = _Belirsiz()


def numara(seri, yil, sira):
    # K5: GİB numara biçimi: 3 harf seri + 4 hane yıl + 9 hane sıra.
    return f"{seri}{yil:04d}{sira:09d}"


def coz_numara(no):
    if not isinstance(no, str) or len(no) != 16 or not no[:3].isalpha() or not no[3:].isdigit():
        return None
    return no[:3], int(no[3:7]), int(no[7:])


def gun(s):
    return date.fromisoformat(s)


class Dunya:
    """Bir olası program durumu."""

    def __init__(self, bugun, cariler):
        self.bugun = bugun
        self.cariler = cariler
        self.belgeler = {}  # ad → belge sözlüğü
        self.sira = 0
        self.ag = True
        self.ariza = None  # bir sonraki SendInvoice'a uygulanacak tek atımlık arıza
        self.ariza_atla = 0  # eşzamanlı turda arıza kaçıncı gönderime düşer (iki oturumun sırası belirsiz)
        self.yanit = None  # beklenen yanıt sınıfı: "2xx" | "4xx" | None (bakılmaz)
        self.notlar = []  # çatal seçimlerinin açıklaması
        self.edm_kabul_sayisi = 0  # bilgi

    def kopya(self, not_=None):
        d = copy.deepcopy(self)
        if not_:
            d.notlar.append(not_)
        return d

    # ---- yardımcılar -------------------------------------------------------------------------------------------------
    def tur(self, cari):
        return "efatura" if self.cariler[cari]["isaret"] else "earsiv"

    def engel(self, b):
        """Kalıcı engel (kullanıcı cariyi düzeltmeden gönderilemez): K2, K3."""
        if b["tur"] == "kagit":
            return "kagit"
        c = self.cariler[b["cari"]]
        if b["tur"] == "efatura" and not c["pk"]:
            return "pk-yok"
        if b["tur"] == "earsiv" and c["mukellef"]:
            return "alici-efatura"
        return None

    def seri_yil(self, b):
        return SERI[b["tur"]], gun(b["tarih"]).year

    def son(self, seri, yil):
        """(son sıra, son sıranın tarihi) — seri+yıl içinde verilmiş en büyük numara."""
        en = (0, None)
        for x in self.belgeler.values():
            if x["var"] is True and isinstance(x["numara"], str) and x["numara"]:
                p = coz_numara(x["numara"])
                if p and p[0] == seri and p[1] == yil and p[2] > en[0]:
                    en = (p[2], x["tarih"])
        return en

    def son_tarih(self, seri, yil):
        """K6: seride numara verilmiş en geç tarih (numara sırası tarih sırasını bozamaz — VUK; FATURA-ISTEKLER satır 77)."""
        t = None
        for x in self.belgeler.values():
            if x["var"] is True and isinstance(x["numara"], str) and x["numara"]:
                p = coz_numara(x["numara"])
                if p and p[0] == seri and p[1] == yil and (t is None or x["tarih"] > t):
                    t = x["tarih"]
        return t

    def bekleyen(self, b):
        """Gönderilecekler listesinde mi? (K7: gönderilmemiş, iptal edilmemiş, listeden silinmemiş e-Belge)."""
        if b["var"] is not True or b["tur"] == "kagit":
            return False
        if b["iptal"] or b["silindi"]:
            return False
        if b["prog"] is B:
            return B
        return not b["prog"]

    def tarih_engeli(self, b):
        if isinstance(b["numara"], str) and b["numara"]:
            return False
        seri, yil = self.seri_yil(b)
        st = self.son_tarih(seri, yil)
        return st is not None and b["tarih"] < st

    def fis_engeli(self, b):
        """K31 (baş mimar kararı 18.10.2026): Listeden Sil belgeye FIS numarası verirken numara–tarih sırasını korur; belgenin tarihi
        FIS serisinin (o yılın) son fişinden eskiyse Listeden Sil reddedilir."""
        st = self.son_tarih("FIS", gun(b["tarih"]).year)
        return st is not None and b["tarih"] < st

    def gecici_engelli(self, b):
        """K9: kullanıcının belge üzerinde tek adımla düzeltebildiği engel (posta kutusu seçimi) — tarih sırasına sığıyorsa."""
        return self.engel(b) == "pk-yok" and not self.tarih_engeli(b)

    def ozce_gonderilebilir(self, b):
        """Numarasız bekleyen belge kendi başına gönderilebilir mi (engelsiz, tarih sırasına sığıyor)?"""
        return self.engel(b) is None and not self.tarih_engeli(b)

    def tutan(self, b):
        """K8 (CLAUDE.md 2.4.3): daha eski tarihli, gönderilebilir, numarasız bekleyen belge varken yeni belgeye numara verilmez.
        K9 (baş mimar kararı 18.10.2026): KALICI engelli (K3 alıcı mükellef, K6 tarih sırası) ve listeden silinmiş belge seriyi
        BEKLETMEZ; GEÇİCİ engelli (K2 posta kutusu seçilmemiş — kullanıcı belge üzerinde tek adımla düzeltir) belge BEKLETİR."""
        seri, yil = self.seri_yil(b)
        for x in self.belgeler.values():
            if x is b or x["var"] is not True or x["tur"] != b["tur"]:
                continue
            if self.seri_yil(x) != (seri, yil):
                continue
            if x["numara"] != "" or x["iptal"] or x["silindi"] or x["prog"] is not False:
                continue
            if x["tarih"] < b["tarih"] and (self.ozce_gonderilebilir(x) or self.gecici_engelli(x)):
                return x["ad"]
        return None

    def sira_listesi(self, adlar=None):
        """K10: Tümünü Gönder eskiden yeniye (tarih, sonra yazım sırası — ders 31)."""
        xs = [b for b in self.belgeler.values() if self.bekleyen(b) is True or (b["var"] is True and b["edm"] and not b["prog"] and not b["iptal"] and not b["silindi"])]
        if adlar is not None:
            xs = [b for b in xs if b["ad"] in adlar]
        return sorted(xs, key=lambda b: (b["tarih"], b["sira"]))


# ---- tek belge gönderimi ---------------------------------------------------------------------------------------------
def gonder(d, ad):
    """Bir belgeyi göndermeyi dener. Dönüş: [(dunya, sonuc)] — sonuc: gitti | atlandi | durdu | hata."""
    b = d.belgeler[ad]
    if b["iptal"] or b["tur"] == "kagit":
        return [(d, "atlandi")]
    if b["prog"] is True:
        return [(d, "atlandi")]
    # K11: EDM'de zaten olan (kopma sonrası) belge: yeniden gönderim "zaten gönderildi" — hata DEĞİL, programda gönderildi olur.
    if b["edm"] is True and not b["prog"]:
        if not d.ag:
            return [(d, "durdu")]
        b["prog"] = True
        b["hata"] = False
        return [(d, "gitti")]
    if d.engel(b):
        return [(d, "atlandi")]
    numarali = isinstance(b["numara"], str) and b["numara"] != ""
    if not numarali:
        if d.tarih_engeli(b) or d.tutan(b):
            return [(d, "atlandi")]
    # K12: ağ yokken (bağlantı kurulamadı — istek EDM'ye kesin ulaşmadı) numara verilmez, tur durur.
    if not d.ag:
        return [(d, "durdu")]
    if not numarali:
        seri, yil = d.seri_yil(b)
        b["numara"] = numara(seri, yil, d.son(seri, yil)[0] + 1)
    if d.ariza is not None and d.ariza_atla > 0:
        d.ariza_atla -= 1
        ariza = None
    else:
        ariza, d.ariza = d.ariza, None
    if ariza is None:
        b["edm"] = True
        b["prog"] = True
        b["hata"] = False
        return [(d, "gitti")]
    if ariza == "gecici_hata":
        # K13: EDM reddetti (500, geçici). Numara korunur (aynı numarayla yeniden gönderilir) YA DA bırakılır (EDM görmedi) —
        # ikisi de GİB'e uygun; çatal. Program yeniden denerse gidebilir (EDM gerçeği seçer).
        a = d.kopya(f"{ad}: geçici hata, numara korundu, gitmedi")
        a.belgeler[ad].update(prog=False, edm=False, hata=True)
        c = d.kopya(f"{ad}: geçici hata, numara bırakıldı")
        c.belgeler[ad].update(prog=False, edm=False, hata=False, numara="")
        e = d.kopya(f"{ad}: geçici hata, program yeniden denedi, gitti")
        e.belgeler[ad].update(prog=True, edm=True, hata=False)
        return [(a, "hata"), (c, "hata"), (e, "gitti")]
    # kopma_once (EDM işlemedi) / kopma_sonra (EDM işledi, yanıt koptu): program farkı yanıttan bilemez; numara KORUNUR (K14;
    # FATURA-ISTEKLER "bağlantı koparsa durum değişmez — aynı ETTN ikinci kez kabul edilmez; önce Durum Sorgula").
    # EDM durumu gerçekten seçilir, programın "gönderildi" bilgisi çatal.
    sonuc = []
    for edm in (True, False):
        for prog in (True, False):
            if prog and not edm:
                continue  # program, EDM'de olmayanı "gönderildi" diyemez (I10)
            x = d.kopya(f"{ad}: {ariza}, edm={edm}, program={prog}")
            x.belgeler[ad].update(prog=prog, edm=edm, hata=not prog)
            sonuc.append((x, "gitti" if prog else "hata"))
    return sonuc


def tur_gonder(d, adlar=None, sil=None):
    """Tümünü Gönder. adlar: seçili kimlikler (None = hepsi). sil: (ad, kabul) tur sürerken Listeden Sil (K15)."""
    sira = [b["ad"] for b in d.sira_listesi(adlar)]
    dunyalar = [(d, False, False)]  # (dunya, durdu, ilk_gonderim_basladi)
    for ad in sira:
        yeni = []
        for w, durdu, basladi in dunyalar:
            if durdu:
                yeni.append((w, durdu, basladi))
                continue
            if sil and basladi and ad == sil[0] and sil[1]:
                # K15: tur sürerken listeden silinen belge gönderilmez (silme turdaki ilk gönderimden sonra işlenir).
                yeni.append((w, False, basladi))
                continue
            for x, sonuc in gonder(w, ad):
                gitti_mi = sonuc in ("gitti", "hata")
                yeni.append((x, sonuc == "durdu", basladi or gitti_mi))
        dunyalar = yeni
    return [w for w, _, _ in dunyalar]


# ---- model ---------------------------------------------------------------------------------------------------------
class Model:
    def __init__(self, senaryo):
        if senaryo.get("dil") != DIL:
            raise ValueError(f"dil {senaryo.get('dil')} ≠ {DIL}")
        self.senaryo = senaryo
        cariler = {k: dict(CARI_TURLERI[v]) for k, v in senaryo["cariler"].items()}
        self.dunyalar = [Dunya(senaryo["bugun"], cariler)]
        self.secimler = []

    # her adım: olası dünyaları üret
    def adim(self, adim):
        sonuc = []
        for d in self.dunyalar:
            d = d.kopya()
            d.yanit = None
            sonuc.extend(uygula(d, adim))
        self.adaylar = sonuc
        return sonuc

    def sec(self, gozlem=None, uzaklik=None):
        """Gözleme en yakın adayı seç (uzaklik(dunya) → sayı). Gözlem yoksa ilk aday."""
        if gozlem is None or uzaklik is None or len(self.adaylar) == 1:
            secilen = self.adaylar[0]
        else:
            secilen = min(self.adaylar, key=uzaklik)  # eşitlikte ilk (kâhinin tercih ettiği) aday
        self.dunyalar = [secilen]
        return secilen


def yeni_belge(d, adim, tur):
    d.sira += 1
    return {"ad": adim["belge"], "cari": adim["cari"], "tur": tur, "tarih": adim["tarih"], "sira": d.sira, "numara": "",
            "edm": False, "prog": False, "iptal": False, "silindi": False, "hata": False, "var": True}


def uygula(d, adim):
    i = adim["islem"]
    bugun = d.bugun
    if i in ("kaydet", "kagit_kaydet"):
        if adim["belge"] in d.belgeler:
            d.yanit = None
            return [d]
        tur = "kagit" if i == "kagit_kaydet" else d.tur(adim["cari"])
        if adim["tarih"] > bugun:
            # K16: ileri tarihli fatura reddedilir (FATURA-ISTEKLER satır 133).
            d.yanit = "4xx"
            d.belgeler[adim["belge"]] = {"ad": adim["belge"], "var": False}
            return [d]
        b = yeni_belge(d, adim, tur)
        if tur == "kagit":
            seri, yil = SERI["kagit"], gun(b["tarih"]).year
            st = d.son_tarih(seri, yil)
            if st is not None and b["tarih"] < st:
                d.yanit = "4xx"  # K6: kâğıt seride de sıra-tarih uyumu; geriye tarihli belge reddedilir
                d.belgeler[b["ad"]] = {"ad": b["ad"], "var": False}
                return [d]
            b["numara"] = numara(seri, yil, d.son(seri, yil)[0] + 1)
            d.belgeler[b["ad"]] = b
            d.yanit = "2xx"
            return [d]
        d.belgeler[b["ad"]] = b
        engel = d.engel(b)
        if adim.get("gonder") == "sonra":
            if d.tarih_engeli(b):
                # K29: serideki son numaralı belgeden eski tarihli belge hiç gönderilemez (K6); program kaydı reddedebilir ya da
                # kaydedip kalıcı engelli olarak tutabilir (çatal).
                d.yanit = "2xx"
                r = d.kopya(f"{b['ad']}: tarih sırasına uymayan kayıt reddedildi")
                r.belgeler[b["ad"]] = {"ad": b["ad"], "var": False}
                r.yanit = "4xx"
                return [d, r]
            if engel:
                # K17: kalıcı engelli belge kaydı: ekran uyarır; API kaydedebilir ya da reddedebilir (çatal).
                d.yanit = "2xx"
                r = d.kopya(f"{b['ad']}: engelli kayıt reddedildi")
                r.belgeler[b["ad"]] = {"ad": b["ad"], "var": False}
                r.yanit = "4xx"
                return [d, r]
            d.yanit = "2xx"
            return [d]
        # Kaydet ve Gönder
        if engel or d.tarih_engeli(b):
            # K2 (CLAUDE.md 2.4.3): numara harcamadan durur; belge kaydedilip Gönderilecekler'de kalır YA DA kayıt reddedilir.
            r = d.kopya(f"{b['ad']}: Kaydet ve Gönder reddedildi ({engel or 'tarih-sirasi'})")
            r.belgeler[b["ad"]] = {"ad": b["ad"], "var": False}
            r.yanit = "4xx"
            return [d, r]
        return [w for w, _ in gonder(d, b["ad"])]
    if i == "kart_gonder":
        b = d.belgeler.get(adim["belge"])
        if not b or b["var"] is not True:
            return [d]
        if b["silindi"] and not b["iptal"] and not b["prog"]:
            # K18: listeden silinen belge sonra kartından yine gönderilebilir (FATURA-ISTEKLER satır 122–123). Gönderilemezse
            # liste dışında kalır ya da Gönderilecekler'e döner (çatal).
            once = d.kopya()
            once.belgeler[b["ad"]]["silindi"] = False
            if once.belgeler[b["ad"]]["numara"].startswith("FIS"):
                once.belgeler[b["ad"]]["numara"] = ""  # FIS iç numarası e-Belge numarasına dönüşür (FIS serisi boşluğu değişmezde)
            sonuc = []
            for w, s in gonder(once, b["ad"]):
                if s in ("gitti", "hata"):
                    sonuc.append(w)
                else:
                    sonuc.append(w)
                    k = w.kopya(f"{b['ad']}: gönderilemedi, liste dışında kaldı")
                    k.belgeler[b["ad"]]["silindi"] = True
                    k.belgeler[b["ad"]]["numara"] = d.belgeler[b["ad"]]["numara"]
                    sonuc.append(k)
            return sonuc
        return [w for w, _ in gonder(d, b["ad"])]
    if i == "tumunu_gonder":
        adlar = None if adim.get("kapsam", "hepsi") == "hepsi" else set(adim["belgeler"])
        return tur_gonder(d, adlar)
    if i == "esz_tumunu_gonder":
        # K19: iki oturum aynı anda Tümünü Gönder: sonuç tek turla aynı; "zaten gönderildi" hata değildir.
        # K32 (baş mimar kararı 18.10.2026): bağlantı hiç kurulamadıysa program o istekte verdiği numarayı, serinin son numarasıysa geri
        # bırakır; araya başka numara girdiyse (iki oturum) belge numaralı "belirsiz" kalır → ağ yokken eşzamanlı turda, her seride en eski
        # gönderilebilir belgenin numaralı kalması da geçerli (çatal).
        if not d.ag:
            sonuc = [d]
            for seri_tur in ("earsiv", "efatura"):
                xs = [b for b in d.sira_listesi(None) if b["tur"] == seri_tur and b["numara"] == "" and d.ozce_gonderilebilir(b) and not d.tutan(b)]
                if xs:
                    w = d.kopya(f"{xs[0]['ad']}: ağ yokken eşzamanlı turda numaralı belirsiz kaldı (K32)")
                    b = w.belgeler[xs[0]["ad"]]
                    seri, yil = w.seri_yil(b)
                    b.update(numara=numara(seri, yil, w.son(seri, yil)[0] + 1), hata=True)
                    sonuc.append(w)
            return sonuc
        # Bekleyen tek atımlık arıza, iki oturumdan hangisinin hangi belgeyi önce gönderdiğine göre herhangi bir gönderime düşebilir:
        # her olası sıra ayrı dünya (çatal).
        if d.ariza is None:
            return tur_gonder(d, None)
        sonuc = []
        for k in range(max(1, len(d.sira_listesi(None)))):
            w = d.kopya(f"eşzamanlı turda arıza {k + 1}. gönderime düştü" if k else None)
            w.ariza_atla = k
            for x in tur_gonder(w, None):
                x.ariza_atla = 0
                sonuc.append(x)
        return sonuc
    if i == "tur_sirasinda_sil":
        x = adim["belge"]
        b = d.belgeler.get(x)
        if not b or b["var"] is not True:
            return tur_gonder(d, None)
        sira = [y["ad"] for y in d.sira_listesi(None)]
        sonuc = []
        # Silme reddedildi → tur olağan.
        r = d.kopya(f"{x}: tur sırasında silme reddedildi")
        r.yanit = "4xx"
        sonuc.extend(tur_gonder(r, None))
        if True:
            # Silme kabul: belge gönderilmez, numara almaz (ya da FIS iç numarası — çatal). Belge turun ilk gönderilen belgesiyse
            # silme ondan sonra gelir: o dünyada belge gitmiştir ve aday elenir (aşağıdaki koşul).
            for w in tur_gonder(d.kopya(f"{x}: tur sırasında silindi"), None, sil=(x, True)):
                bb = w.belgeler[x]
                if bb["numara"] == "" and w.fis_engeli(bb):
                    continue  # K31: silme reddedilir (yalnız "reddedildi" dünyası kalır)
                if not bb["prog"] and not bb["iptal"] and not bb["edm"]:
                    w.yanit = "2xx"
                    bb["silindi"] = True
                    sonuc.append(w)
                    if bb["numara"] == "":
                        f = w.kopya(f"{x}: silinince FIS numarası aldı")
                        seri, yil = "FIS", gun(bb["tarih"]).year
                        f.belgeler[x]["numara"] = numara(seri, yil, f.son(seri, yil)[0] + 1)
                        sonuc.append(f)
        return sonuc
    if i == "listeden_sil":
        b = d.belgeler.get(adim["belge"])
        if not b or b["var"] is not True:
            return [d]
        if b["tur"] == "kagit" or b["iptal"] or b["prog"] is True or b["edm"] is True:
            d.yanit = "4xx"  # K20: gönderilmiş / iptal / kâğıt belge listeden silinmez
            return [d]
        if b["silindi"]:
            return [d]
        if b["numara"]:
            # K21: numara almış ama gitmemiş belge: silme reddedilir YA DA kabul edilir (numara korunur) — çatal.
            r = d.kopya(f"{b['ad']}: numaralı belgenin silinmesi reddedildi")
            r.yanit = "4xx"
            k = d.kopya(f"{b['ad']}: numaralı belge listeden silindi")
            k.belgeler[b["ad"]]["silindi"] = True
            k.yanit = "2xx"
            return [r, k]
        if d.fis_engeli(b):
            # K31: FIS serisinin son fişinden eski tarihli belge listeden silinmez (409 chronology); Gönderilecekler'de kalır.
            d.yanit = "4xx"
            return [d]
        d.belgeler[b["ad"]]["silindi"] = True
        d.yanit = "2xx"
        f = d.kopya(f"{b['ad']}: silinince FIS numarası aldı")
        seri, yil = "FIS", gun(b["tarih"]).year
        f.belgeler[b["ad"]]["numara"] = numara(seri, yil, f.son(seri, yil)[0] + 1)
        return [d, f]
    if i == "iptal":
        b = d.belgeler.get(adim["belge"])
        if not b or b["var"] is not True:
            return [d]
        if b["iptal"]:
            d.yanit = "4xx"
            return [d]
        if b["prog"] is True or b["edm"] is True:
            yas = (gun(bugun) - gun(b["tarih"])).days
            if b["tur"] == "earsiv" and yas <= 7 and d.ag and b["prog"] is True:
                # K22: gönderilmiş e-Arşiv 8 gün içinde EDM'de iptal edilir, numara korunur (FATURA-ISTEKLER 111, 133).
                b["iptal"] = True
                d.yanit = "2xx"
                return [d]
            # K23: gönderilmiş e-Fatura entegratörden iptal edilmez (alıcı reddi / iade); süresi geçmiş e-Arşiv; ağ yok → çatal.
            r = d.kopya(f"{b['ad']}: gönderilmiş belgenin iptali reddedildi")
            r.yanit = "4xx"
            k = d.kopya(f"{b['ad']}: gönderilmiş belge programda iptal edildi")
            k.belgeler[b["ad"]]["iptal"] = True
            if b["tur"] == "earsiv" and yas <= 8 and not d.ag:
                # K23 ek (19.10.2026): 8 günlük sınırın içindeki gönderilmiş e-Arşiv K22 gereği entegratörde iptal edilir; ağ yoksa
                # entegratöre ulaşılamaz → iptal yapılmaz, belge değişmez, yanıt ağ geçidi hatası 5xx (RFC 9110 §15.6.3). K23 kaynağı
                # HTTP sınıfı vermez; "reddedildi = 4xx" modelin varsayımıydı (Uzun Doğrulama tohum 5 adım 294).
                u = d.kopya(f"{b['ad']}: ağ yok, entegratöre ulaşılamadı; iptal yapılmadı")
                u.yanit = "5xx"
                return [r, k, u]
            return [r, k]
        # K24: gönderilmemiş belge iptal edilir; numara (varsa) korunur, artık gönderilmez.
        b["iptal"] = True
        d.yanit = "2xx"
        return [d]
    if i == "duzenle_tarih":
        b = d.belgeler.get(adim["belge"])
        if not b or b["var"] is not True:
            return [d]
        if adim["tarih"] > bugun:
            d.yanit = "4xx"
            return [d]
        if b["iptal"] or b["prog"] is True or b["edm"] is True:
            d.yanit = "4xx"  # K25: gönderilmiş / iptal belge değiştirilemez
            return [d]
        if b["numara"]:
            # K26: numaralı ama gitmemiş (ya da kâğıt) belgenin tarihi: reddedilir YA DA kabul edilir — çatal (değişmezler denetler).
            r = d.kopya(f"{b['ad']}: numaralı belgenin tarih düzenlemesi reddedildi")
            r.yanit = "4xx"
            k = d.kopya(f"{b['ad']}: numaralı belgenin tarihi değişti")
            k.belgeler[b["ad"]]["tarih"] = adim["tarih"]
            k.yanit = "2xx"
            return [r, k]
        eski = b["tarih"]
        if b["tur"] != "kagit" and b["tur"] != d.tur(b["cari"]):
            # K30: carinin (Mükellef Sorgula ile değişen) işaretiyle çelişen belge türü düzenlemede korunamaz (GİB: mükellefe
            # e-Arşiv kesilmez) → düzenleme reddedilir.
            d.yanit = "4xx"
            return [d]
        b["tarih"] = adim["tarih"]
        d.yanit = "2xx"
        if b["tur"] != "kagit" and not b["silindi"] and d.tarih_engeli(b):
            r = d.kopya(f"{b['ad']}: tarih sırasına uymayan düzenleme reddedildi")
            r.belgeler[b["ad"]]["tarih"] = eski
            r.yanit = "4xx"
            return [d, r]
        return [d]
    if i == "duzenle_tur":
        b = d.belgeler.get(adim["belge"])
        if not b or b["var"] is not True:
            return [d]
        if b["numara"] and b["tur"] != "kagit":
            d.yanit = "4xx"  # K27 (CLAUDE.md 2.4.3 karar 1): numaralı belgede Düzenle belge türünü değiştiremez
        return [d]
    if i == "ariza":
        d.ariza = adim["tur"]
        return [d]
    if i == "ag":
        d.ag = adim["durum"] == "var"
        return [d]
    if i == "durum_sorgula":
        b = d.belgeler.get(adim["belge"])
        if b and b["var"] is True and b["edm"] is True and not b["prog"] and d.ag:
            # K28: Durum Sorgula EDM'deki belgeyi programda "gönderildi" yapar.
            b["prog"] = True
            b["hata"] = False
        return [d]
    if i == "gun_ilerlet":
        d.bugun = (gun(bugun) + timedelta(days=adim["gun"])).isoformat()
        return [d]
    raise ValueError(f"bilinmeyen işlem {i}")


# ---- anlık görüntü ----------------------------------------------------------------------------------------------------
def goruntu(d):
    """Belge başına karşılaştırılan alanlar (fark.py): var, numara, edm (EDM kabul etti), gonderildi (programda), iptal, bekleyen."""
    g = {}
    for ad, b in d.belgeler.items():
        if b["var"] is not True:
            g[ad] = {"var": b["var"] if b["var"] is B else False}
            continue
        g[ad] = {"var": True, "numara": b["numara"], "edm": b["edm"], "gonderildi": b["prog"], "iptal": b["iptal"],
                 "bekleyen": d.bekleyen(b), "tarih": b["tarih"], "tur": b["tur"]}
    return g


def _json(o):
    if o is B:
        return "?"
    raise TypeError


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    with open(sys.argv[1], encoding="utf-8") as f:
        senaryo = json.load(f)
    m = Model(senaryo)
    cikti = []
    for adim in senaryo["adimlar"]:
        m.adim(adim)
        d = m.sec()
        cikti.append({"no": adim["no"], "islem": adim["islem"], "aday": len(m.adaylar), "yanit": d.yanit, "belgeler": goruntu(d)})
    json.dump(cikti, sys.stdout, ensure_ascii=False, indent=1, default=_json)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
