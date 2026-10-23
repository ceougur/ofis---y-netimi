#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""e-Belge (e-Fatura / e-Arşiv / e-SMM) NUMARA ve GÖNDERİM durum makinesi — temiz oda modeli (dil `destekofis-ebelge/2`; `/1` senaryoları da koşar).

Bu dosya programın kodunu GÖRMEDEN yazıldı. Kural kaynakları: GİB mevzuatı (numara biçimi, seri+yıl boşluksuz, sıra-tarih uyumu,
mükellefe e-Arşiv kesilmez, gönderilmiş belge değişmez), docs/FATURA-ISTEKLER.md "Kararlar", docs/fatura/E-BELGE-EDM.md ve CLAUDE.md
"Açık iş" 2.4.3 kararları. Her kural KARARLAR.md'de kaynağıyla yazılıdır (K-numaraları aşağıda yorumlarda geçer).
/2 (2.4.4, 22.10.2026; ayrı, kodu görmeyen el): K22 düzeltildi (iletimden 8 gün — GİB Kılavuz V.1.1 §3), K33 Seçilenleri Gönder, K34 e-SMM (TES),
K35 belirsizde Yalnız Programda İptal, K36 alıcı zorunlu alanları, K37 UX15 (R1/R2; Model(ux15=False) ile kapanır).

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

DIL = "destekofis-ebelge/3"
# /2 (2.4.4, madde 31a): e-SMM türü (K34), Seçilenleri Gönder kronolojisi (K33), iletimden 8 gün iptal (K22 düzeltildi), belirsizde Yalnız Programda İptal
# (K35), alıcı zorunlu alanları (K36), UX15 kayıt kuralları (K37). /1 senaryoları değişmeden koşar (yeni alanları kullanmazlar).
# /3 (2.4.4 31a tur 2, 23.10.2026; kodu görmeyen el): K38 verilmiş kâğıt/fiş/makbuz numarası bir daha verilmez (silme, e-Belgeye dönüşme — E6, 22.10 kararı),
# K39 Silinenler (sil / geri_yukle işlemleri — E6), K40 Kâğıt Makbuz Olarak Bırak (SMM serisi, sonra e-SMM gönderilmez — MM4 alt kararı), K41 Yalnız
# Programda İptal yalnız sonucu belirsiz gönderimde (E7; K35 çatalı karara bağlandı), K42 Sonucu Belirsiz belgede Sil / Düzenle / İptal Et 409 (E1).
DILLER = ("destekofis-ebelge/1", "destekofis-ebelge/2", DIL)

# K1: belge türü carinin işaretinden gelir (CLAUDE.md 2.4.3 karar 4: "işaretliyse e-Fatura, değilse e-Arşiv kesilir").
# K2: e-Fatura alıcısının posta kutusu (PK) yoksa belge gönderilemez (CLAUDE.md 2.4.3 karar 2; GİB: e-Fatura alıcı etiketine gider).
# K3: gerçekte mükellef olan alıcıya e-Arşiv kesilmez (GİB e-Arşiv kılavuzu; FATURA-KARSILASTIRMA "allowedProfiles").
CARI_TURLERI = {
    "kisi": {"isaret": False, "pk": False, "mukellef": False},           # TCKN, mükellef değil → e-Arşiv
    "mukellef": {"isaret": True, "pk": True, "mukellef": True},          # VKN, işaretli, PK seçili → e-Fatura
    "mukellef_pksiz": {"isaret": True, "pk": False, "mukellef": True},   # işaretli, PK seçilmemiş → e-Fatura, gönderilemez (K2)
    "gizli_mukellef": {"isaret": False, "pk": False, "mukellef": True},  # işaretsiz ama GİB'de mükellef → e-Arşiv, gönderilemez (K3)
    # /2 — K36 (alıcı zorunlu alanları; [GİB] UBL-TR alıcı adresi/vergi dairesi + [AJAN] madde 11):
    "ilsiz_kisi": {"isaret": False, "pk": False, "mukellef": False, "eksik": "il"},           # TCKN, il yok → hiçbir e-Belge kesilemez
    "vdsiz_mukellef": {"isaret": True, "pk": True, "mukellef": True, "eksik": "vd"},          # VKN, işaretli, PK var, vergi dairesi yok → e-Fatura kesilemez
    "nihai": {"isaret": False, "pk": False, "mukellef": False, "nihai": True},                # Nihai Tüketici (11111111111), il var, adres yok
}
KISI_TURLERI = {"kisi", "ilsiz_kisi", "nihai"}
# K36 [AJAN] madde 11: nihai tüketiciye 30.000 TL üstü e-Arşivde gerçek TCKN + ad + adres. Sınır günü/tutarın KDV dahil olup olmadığı birincil kaynakta
# okunmadı → senaryolar sınırdan uzak tutar kullanır (olağan 600 TL, büyük 48.000 TL; ikisi de KDV dahil) — sınır DENENMEZ (KARARLAR.md).
NIHAI_SINIR = 30000
TUTARLAR = {"olagan": 600, "buyuk": 48000}
# K22 (düzeltildi, 2.4.4): [GİB] e-Arşiv İptal/İtiraz Kılavuzu V.1.1 §3 "8 günlük sürenin tespiti e-belgenin alıcıya iletilme tarihinden itibaren başlar";
# [KULLANICI] CLAUDE.md KARARLAR (5): e-Arşiv VE e-SMM, iletimden 8 gün, başlangıç günü sayılmaz, 8. gün dahil (TBK 92).
IPTAL_SURESI = 8

# K4: test ortamı serileri (EDM test hesabı; ayarda env "test") — e-Fatura TEF, e-Arşiv TEA; kâğıt/Müşteri Fişi FIS.
SERI = {"efatura": "TEF", "earsiv": "TEA", "kagit": "FIS", "esmm": "TES"}
# K40 ([KULLANICI] 22.10.2026 "Bırakılan e-SMM 'Kâğıt Makbuz Olarak Bırak' (SMM serisi)"): bırakılan serbest meslek makbuzu SMM serisinden numara alır;
# bırakılan fatura FIS (Müşteri Fişi) serisinden (FATURA-ISTEKLER 122–123; 2.4.3 "Müşteri Fişi Olarak Bırak").
KAGIT_SERI = {"esmm": "SMM"}
KAGIT_SERILER = ("FIS", "SMM", "IAD")
# K34 ([KULLANICI] e-SMM 2.4.4'te açılır, numarayı program verir; [AJAN] 22): e-SMM (ESMM profili) test serisi TES, TEA/TEF'ten bağımsız.
E_TURLERI = ("efatura", "earsiv", "esmm")
E_SERI_ONEK = ("TEF", "TEA", "TES")


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
        self.ux15 = True  # K37 (madde 12 UX15) kuralları; fark.py --ux15 kapali ile kapatılır (UX15 tabanda yokken)
        self.k33 = None  # K33: son Seçilenleri Gönder adımında modelin "önce gönderilmeli" dediği belgeler (adlar) — None: soru yok
        self.incele = []  # bu adımda yalnız [AJAN] ayrıntısıyla ayrılan dünyanın işareti (fark.py İNCELE sınıfı)
        # K38 ([KULLANICI] 22.10.2026 "verilmiş kâğıt/fiş numarası bir daha kullanılmaz"; E6): artık hiçbir belgede durmayan ama verilmiş numara → o
        # numaralı belgenin tarihi. Seri sayacı ve sıra-tarih tabanı bunları da sayar (Müşteri Fişi sonra e-Belge olarak gönderilince FIS numarası emekli).
        self.emekli = {}

    def kopya(self, not_=None):
        d = copy.deepcopy(self)
        if not_:
            d.notlar.append(not_)
        return d

    # ---- yardımcılar -------------------------------------------------------------------------------------------------
    def tur(self, cari):
        return "efatura" if self.cariler[cari]["isaret"] else "earsiv"

    def engel(self, b):
        """Gönderim engeli: K2 (pk-yok, geçici), K3 (alici-efatura, kalıcı), K36 (alici-eksik, kalıcı — cari kartı düzeltilmeden gönderilemez)."""
        if b["tur"] == "kagit":
            return "kagit"
        c = self.cariler[b["cari"]]
        if self.alici_eksik(b):
            return "alici-eksik"
        if b["tur"] == "efatura" and not c["pk"]:
            return "pk-yok"
        if b["tur"] == "earsiv" and c["mukellef"]:
            return "alici-efatura"
        return None

    def alici_eksik(self, b):
        """K36 ([GİB] UBL-TR alıcı adresi — il; e-Fatura VKN'li alıcıda vergi dairesi; [AJAN] madde 11 nihai tüketici 30.000 TL üstü gerçek TCKN + ad +
        adres). e-SMM de e-Belgedir: il zorunlu."""
        c = self.cariler[b["cari"]]
        if c.get("eksik") == "il":
            return True
        if b["tur"] == "efatura" and c.get("eksik") == "vd":
            return True
        if b["tur"] == "earsiv" and c.get("nihai") and b.get("tutar", TUTARLAR["olagan"]) > NIHAI_SINIR:
            return True
        return False

    def belirsiz(self, b):
        """K14/K35: numara verilmiş, EDM'ye istek gitmiş, sonucu programca bilinmiyor (Sonucu Belirsiz)."""
        return bool(b.get("belirsiz")) and b["prog"] is not True and not b["iptal"]

    def gun_farki(self, b, alan):
        """bugün − b[alan] gün (başlangıç günü sayılmaz: TBK 92). Kayıt yoksa kesim günü ([AJAN] 23: 'kayıt yoksa kesim günü')."""
        g = b.get(alan) or b["tarih"]
        return (gun(self.bugun) - gun(g)).days

    def komsular(self, b):
        """K37 R2: aynı seri+yılda b'nin numarasından önceki ve sonraki numaralı belgelerin tarihleri (iptal dahil)."""
        p = coz_numara(b["numara"])
        once = sonra = None
        for x in self.belgeler.values():
            if x is b or x.get("var") is not True or not x.get("numara"):
                continue
            q = coz_numara(x["numara"])
            if not q or q[:2] != p[:2]:
                continue
            if q[2] < p[2] and (once is None or x["tarih"] > once):
                once = x["tarih"]
            if q[2] > p[2] and (sonra is None or x["tarih"] < sonra):
                sonra = x["tarih"]
        return once, sonra

    def seri_yil(self, b):
        return SERI[b["tur"]], gun(b["tarih"]).year

    def k33_eskiler(self, secilen):
        """K33 ([KULLANICI] 19.10.2026 "Seçilenleri Gönder": seçilmemiş DAHA ESKİ tarihli bekleyen belge varsa seçilen yenisi numara alamaz; düğme bunu
        gönderimden ÖNCE söyler, sessiz atlama yok) + K6/K8/K9: aynı seri+yılda, seçilen numarasız bir bekleyenden ESKİ (aynı gün değil), seçilmemiş,
        numarasız, bekleyen ve kalıcı engelsiz (gönderilebilir ya da geçici engelli — K9) belgeler. Döner: (katı, gevşek) — gevşek, seçilen
        NUMARALI bekleyeni de sayar (numaralı belge numara almaz; kaynak bunu ayırmaz → çatal)."""
        secili = [self.belgeler[a] for a in secilen if self.belgeler.get(a, {}).get("var") is True and self.bekleyen(self.belgeler[a]) is True]
        kati, gevsek = [], []
        for x in sorted(self.belgeler.values(), key=lambda b: (b.get("tarih", ""), b.get("sira", 0))):
            if x["ad"] in secilen or x.get("var") is not True or self.bekleyen(x) is not True or x["numara"] or self.belirsiz(x):
                continue
            # Alıcının gerçekte mükellef olduğu (K3) program ancak gönderimde EDM'ye sorunca öğrenir; ön soru EDM'ye gitmez (K33) → henüz
            # denenmemiş böyle bir belge program için "gönderilebilir"dir (kâhin hatası düzeltmesi 22.10.2026, hedefli-244-k33-secilen adım 7).
            bilinmeyen_k3 = self.engel(x) == "alici-efatura" and not x.get("engel_bilinen") and not self.tarih_engeli(x)
            if not (self.ozce_gonderilebilir(x) or self.gecici_engelli(x) or bilinmeyen_k3):
                continue
            eski_mi = [s for s in secili if self.seri_yil(s) == self.seri_yil(x) and x["tarih"] < s["tarih"]]
            if eski_mi:
                gevsek.append(x["ad"])
                if any(not s["numara"] for s in eski_mi):
                    kati.append(x["ad"])
        return kati, gevsek

    def verilmis(self):
        """Verilmiş bütün numaralar → tarih: belgelerdeki (Silinenler'deki dahil — K39/E6) + emekli (K38)."""
        out = dict(self.emekli)
        for x in self.belgeler.values():
            if x["var"] is True and isinstance(x["numara"], str) and x["numara"]:
                out[x["numara"]] = x["tarih"]
        return out

    def son(self, seri, yil):
        """(son sıra, son sıranın tarihi) — seri+yıl içinde verilmiş en büyük numara (K38: silinmiş ve emekli numaralar dahil — E6)."""
        en = (0, None)
        for no_, t in self.verilmis().items():
            p = coz_numara(no_)
            if p and p[0] == seri and p[1] == yil and p[2] > en[0]:
                en = (p[2], t)
        return en

    def son_tarih(self, seri, yil):
        """K6: seride numara verilmiş en geç tarih (numara sırası tarih sırasını bozamaz — VUK; FATURA-ISTEKLER satır 77). K38/E6: silinen ve emekli
        numaralı belgelerin tarihi de taban ("yeni belge, silinen son belgeden eski tarihli olamaz")."""
        t = None
        for no_, tt in self.verilmis().items():
            p = coz_numara(no_)
            if p and p[0] == seri and p[1] == yil and (t is None or tt > t):
                t = tt
        return t

    def emekli_et(self, b):
        """K38: belgeden düşen kâğıt numarası (ör. Müşteri Fişi e-Belge olarak gönderilince) emekli olur, bir daha verilmez."""
        if isinstance(b.get("numara"), str) and b["numara"][:3] in KAGIT_SERILER:
            self.emekli[b["numara"]] = b["tarih"]

    def bekleyen(self, b):
        """Gönderilecekler listesinde mi? (K7: gönderilmemiş, iptal edilmemiş, listeden silinmemiş e-Belge; K39: Silinenler'deki belge değil)."""
        if b["var"] is not True or b["tur"] == "kagit" or b.get("cop"):
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

    def birakma_serisi(self, b):
        """K40: bırakılan belgenin kâğıt serisi — serbest meslek makbuzu SMM, fatura FIS."""
        return KAGIT_SERI.get(b["tur"], "FIS")

    def fis_engeli(self, b):
        """K31 (baş mimar kararı 18.10.2026): Listeden Sil belgeye FIS numarası verirken numara–tarih sırasını korur; belgenin tarihi
        FIS serisinin (o yılın) son fişinden eskiyse Listeden Sil reddedilir. K40: makbuzda SMM serisi (K6 kâğıt seride de — aynı kural)."""
        st = self.son_tarih(self.birakma_serisi(b), gun(b["tarih"]).year)
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
            if x is b or x["var"] is not True or x["tur"] != b["tur"] or x.get("cop"):
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
        xs = [b for b in self.belgeler.values() if self.bekleyen(b) is True or (b["var"] is True and b["edm"] and not b["prog"] and not b["iptal"] and not b["silindi"] and not b.get("cop"))]
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
        b["belirsiz"] = False
        b["deneme"] = d.bugun  # [AJAN] 23: son gönderim girişimi (program önce durum sorarsa girişim yoktur — fark.py gözlemden eşitler)
        return [(d, "gitti")]
    if d.engel(b):
        if d.engel(b) == "alici-efatura" and d.ag:
            b["engel_bilinen"] = True  # program gönderimde alıcıyı sordu, mükellef olduğunu öğrendi
        return [(d, "atlandi")]
    numarali = isinstance(b["numara"], str) and b["numara"] != ""
    if b["tur"] == "esmm" and d.belirsiz(b) and b["edm"] is not True and d.ag:
        # K14 + [AJAN] 22: e-SMM'de EDM'nin 'bulunamadı' kodu doğrulanmadığından program belirsiz makbuzu yeniden GÖNDERMEYEBİLİR (çatal; İNCELE —
        # kullanıcı kuralı K35 'bulunamadı → serbest' ile ayrışır). Diğer dünya: aynı numarayla gönderir (e-Arşiv/e-Fatura gibi).
        k = d.kopya(f"{ad}: e-SMM belirsiz, 'bulunamadı'ya güvenilmedi, yeniden gönderilmedi")
        k.incele = list(d.incele) + ["K14-ESMM-BELIRSIZ-KALIR"]
        return _gonder_numarali(d, ad, b, numarali) + [(k, "atlandi")]
    return _gonder_numarali(d, ad, b, numarali)


def _gonder_numarali(d, ad, b, numarali):
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
        b["belirsiz"] = False
        # K22: iletim günü = EDM'nin belgeyi aldığı (alıcıya ilettiği) gün — [GİB] §3; ilk kabul kalır.
        b["iletim"] = b.get("iletim") or d.bugun
        b["deneme"] = d.bugun
        return [(d, "gitti")]
    if ariza == "gecici_hata":
        # K13: EDM reddetti (500, geçici). Numara korunur (aynı numarayla yeniden gönderilir) YA DA bırakılır (EDM görmedi) —
        # ikisi de GİB'e uygun; çatal. Program yeniden denerse gidebilir (EDM gerçeği seçer).
        a = d.kopya(f"{ad}: geçici hata, numara korundu, gitmedi")
        a.belgeler[ad].update(prog=False, edm=False, hata=True)
        c = d.kopya(f"{ad}: geçici hata, numara bırakıldı")
        c.belgeler[ad].update(prog=False, edm=False, hata=False, numara="")
        e = d.kopya(f"{ad}: geçici hata, program yeniden denedi, gitti")
        e.belgeler[ad].update(prog=True, edm=True, hata=False, belirsiz=False, iletim=b.get("iletim") or d.bugun, deneme=d.bugun)
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
            x.belgeler[ad].update(prog=prog, edm=edm, hata=not prog, belirsiz=not prog, deneme=d.bugun)
            if edm:
                x.belgeler[ad]["iletim"] = b.get("iletim") or d.bugun
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
                if sil and sil[1] and gitti_mi and not basladi and sil[0] != ad and sil[0] in x.belgeler:
                    # K15 + K9: silme turun ilk gönderimi sırasında işlenir; o andan sonra belge listeden silinmiştir ve seriyi BEKLETMEZ (aynı turdaki
                    # daha yeni belgeler numara alır). Kâhin hatası düzeltmesi 22.10.2026 (A7: tohum 2 × 150 adım 61 — model silinen belgeyi tur
                    # bitene kadar bekleyen sayıp daha yeni e-Faturaları bekletiyordu; 2.4.3 kâhininde de vardı).
                    hedef = x.belgeler[sil[0]]
                    if hedef.get("var") is True and not hedef["prog"] and not hedef["iptal"] and not hedef["edm"]:
                        hedef["silindi"] = True
                yeni.append((x, sonuc == "durdu", basladi or gitti_mi))
        dunyalar = yeni
    return [w for w, _, _ in dunyalar]


def secilenleri_gonder(d, adim):
    """K33 Seçilenleri Gönder ([KULLANICI] 19.10.2026; K6/K8/K9/K10). Adımın "eski" alanı kullanıcının ön soruya yanıtıdır: "ekle" (önce gönderilmesi
    gerekenleri seçime ekleyip gönder) ya da "vazgec". Soru gönderimden ÖNCE gelir: numara verilmez, EDM'ye gidilmez (sessiz atlama / yarım tur yok)."""
    secilen = [a for a in adim["belgeler"] if d.belgeler.get(a, {}).get("var") is True]
    kati, gevsek = d.k33_eskiler(secilen)
    dunyalar = []
    for eskiler, not_ in ((kati, None), (gevsek, "K33: seçilen numaralı bekleyen de soruyu açtı")):
        if dunyalar and eskiler == kati:
            continue  # gevşek = katı: tek dünya
        w = d.kopya(not_)
        w.k33 = list(eskiler)
        if not eskiler:
            xs = w.sira_listesi(set(secilen))
            sonuc = tur_gonder(w, set(secilen))
            for x in sonuc:
                x.yanit = "2xx" if xs else None  # seçilenlerin hiçbiri Gönderilecekler'de değilse yanıt sınıfı kaynakta yok
            dunyalar.extend(sonuc)
        elif adim["eski"] == "ekle":
            sonuc = tur_gonder(w, set(secilen) | set(eskiler))
            for x in sonuc:
                x.yanit = "2xx"
            dunyalar.extend(sonuc)
        else:
            w.yanit = "4xx"  # ilk istek gönderimsiz 409; kullanıcı vazgeçti — hiçbir şey değişmez
            dunyalar.append(w)
    return dunyalar


def iptal(d, b, yerel):
    """İptal Et (yerel=True: "Yalnız Programda İptal", onaylı).
    K24: gönderilmemiş belge iptal edilir (numarası korunur). K23: gönderilmiş e-Fatura — çatal (değişmedi).
    K22 (DÜZELTİLDİ 2.4.4): gönderilmiş e-Arşiv ve e-SMM iletimden itibaren 8 gün içinde EDM'de iptal edilir; başlangıç günü sayılmaz, 8. gün dahil
      ([GİB] Kılavuz V.1.1 §3; [KULLANICI] KARARLAR (5)). Süre dolunca İptal Et de Yalnız Programda İptal de reddedilir (belge değişmez).
      Eski K22 ("kesimden ≤7 gün") yanlış dayanaklıydı: kaynak süreyi iletimden sayar.
    K35 ([KULLANICI] 22.10.2026, madde 23 SORU + "önerin uygun"): sonucu BELİRSİZ belgede Yalnız Programda İptal, 8 gün geçtiyse önce EDM'ye sorar —
      EDM'de yok → iptal serbest; EDM'de var → süre dolmuş, reddedilir; ([AJAN]) EDM'ye ulaşılamaz → 5xx; e-SMM'de 'bulunamadı' doğrulanmadığından → 409
      ([AJAN]; kullanıcı kuralıyla ayrışır → İNCELE)."""
    def kopya(not_, **alan):
        w = d.kopya(not_)
        w.belgeler[b["ad"]].update(alan)
        return w
    if b.get("cop"):
        d.yanit = "4xx"  # K39: Silinenler'deki belge işlem görmez
        return [d]
    if yerel:
        return yerel_iptal(d, b, kopya)
    if d.belirsiz(b):
        # K42 ([KULLANICI] 22.10.2026 E1 "kesintide Sonucu Belirsiz; Sil/Düzenle kapalı, Durum Sorgula önerilir"; [AJAN] E1 "Sil, Düzenle ve İptal Et 409"):
        # sonucu belirsiz belgede olağan İptal Et reddedilir, belge değişmez (önce Durum Sorgula). /2'deki "program sorup iptal eder" çatalı kalktı.
        d.yanit = "4xx"
        return [d]
    if not (b["prog"] is True or b["edm"] is True):
        b["iptal"] = True
        d.yanit = "2xx"
        return [d]
    if b["tur"] == "efatura":
        # K23: gönderilmiş e-Fatura entegratörden iptal edilmez (alıcı reddi / iade) → reddedilir YA DA yalnız programda iptal — çatal.
        r = kopya(f"{b['ad']}: gönderilmiş e-Fatura iptali reddedildi")
        r.yanit = "4xx"
        k = kopya(f"{b['ad']}: gönderilmiş e-Fatura programda iptal edildi", iptal=True)
        return [r, k]
    if b["tur"] not in ("earsiv", "esmm"):
        d.yanit = "4xx"
        return [d]
    if b["prog"] is True:
        g = d.gun_farki(b, "iletim")
        if g > IPTAL_SURESI:
            d.yanit = "4xx"  # K22: süre doldu — İptal Et de Yalnız Programda İptal de reddedilir
            d.notlar.append(f"{b['ad']}: K22 iletimden {g}. gün — iptal süresi doldu")
            return [d]
        if d.ag:
            b["iptal"] = True
            b["edm_iptal"] = True
            d.yanit = "2xx"
            return [d]
        # K23 ek (19.10.2026): süre içindeki gönderilmiş belgede ağ yoksa EDM'ye ulaşılamaz → iptal yapılmaz (5xx; ya da 4xx) — belge değişmez.
        u = kopya(f"{b['ad']}: ağ yok, entegratöre ulaşılamadı; iptal yapılmadı")
        u.yanit = "5xx"
        r = kopya(f"{b['ad']}: ağ yok, iptal reddedildi")
        r.yanit = "4xx"
        return [u, r]
    # Buraya yalnız EDM'de olan ama programın ne gönderildi ne belirsiz dediği (ör. Hata) belge düşer: program kendi bilgisiyle K24'ü uygulayabilir (yerel
    # iptal) ya da reddeder — çatal (E1 bu durumu Sonucu Belirsiz sayar; program Hata dediyse kural yazılı değil).
    r = kopya(f"{b['ad']}: EDM'de olan, programda Hata görünen belgenin iptali reddedildi")
    r.yanit = "4xx"
    k = kopya(f"{b['ad']}: EDM'de olan, programda Hata görünen belge programda iptal edildi", iptal=True)
    k.yanit = "2xx"
    return [r, k]


def yerel_iptal(d, b, kopya):
    """K41 Yalnız Programda İptal ([KULLANICI] 22.10.2026 E7 "sunucu da K4'e göre yalnız belirsiz/portal taslağında izin verir"; [AJAN] E7 metni):
    yalnız sonucu belirsiz gönderimde (ya da portalda taslak belgede — senaryo dilinde YOK) yapılır. Öbür her durumda (EDM'de İşleniyor / Gönderildi /
    Kabul / Hata, e-Fatura, Müşteri Fişi, numarasız bekleyen, kâğıt) 409: belge değişmez, EDM'ye iptal gitmez. Süre dolmuşsa da red (önce süre iletisi —
    ileti DENENMEZ). 8 günü geçmiş belirsiz gönderimde önce EDM durum sorgusu (K35). /2'deki "süre içinde gönderilmiş belgede yerel iptal" ve "belirsizde
    8 gün içinde red" çatalları bu kuralla kalktı."""
    if not d.belirsiz(b):
        d.yanit = "4xx"
        return [d]
    if b["tur"] == "efatura":
        # E7 metni "öbür her durum"a e-Fatura'yı da sayar → red; ama sonucu belirsiz e-Fatura için açık değil (kural belirsiz gönderimi genel söyler) →
        # ÇATAL, kabul dünyası İNCELE işaretli.
        r = kopya(f"{b['ad']}: belirsiz e-Fatura yalnız programda iptal reddedildi")
        r.yanit = "4xx"
        k = kopya(f"{b['ad']}: belirsiz e-Fatura yalnız programda iptal edildi", iptal=True, belirsiz=False)
        k.yanit = "2xx"
        k.incele = list(d.incele) + ["K41-EFATURA-BELIRSIZ-YEREL"]
        return [r, k]
    if b["tur"] not in ("earsiv", "esmm"):
        d.yanit = "4xx"
        return [d]
    # Sonucu belirsiz (program bilmiyor; EDM gerçeği b["edm"]).
    g = d.gun_farki(b, "deneme")  # [AJAN] 23: iletim günü = son gönderim girişimi
    if g > IPTAL_SURESI:
        if not d.ag:
            d.yanit = "5xx"  # [AJAN] 23: EDM'ye ulaşılamaz → 502; belge değişmez
            return [d]
        if b["edm"]:
            # K35: EDM'de var → süre dolmuş, reddedilir. Sorgu belgenin EDM'de olduğunu gösterdi → programda gönderildi (K28 Durum Sorgula ile aynı;
            # kâhin hatası düzeltmesi 22.10.2026, hedefli-244-k35-belirsiz-yerel adım 9).
            b.update(prog=True, belirsiz=False, hata=False)
            d.yanit = "4xx"
            return [d]
        k = kopya(f"{b['ad']}: belirsiz, 8 gün geçti, EDM'de yok → yalnız programda iptal", iptal=True, belirsiz=False)
        k.yanit = "2xx"
        if b["tur"] == "esmm":
            r = kopya(f"{b['ad']}: e-SMM belirsiz, EDM 'bulunamadı' doğrulanmadı → reddedildi")
            r.yanit = "4xx"
            r.incele = ["K35-ESMM-BULUNAMADI"]
            return [k, r]
        return [k]
    # 8 gün içinde: K41 — yalnız programda iptal edilir (2.4.3 çıkış yolu; EDM'ye sorulmaz, EDM'de iptal yok). /2'deki red çatalı kalktı.
    b.update(iptal=True, belirsiz=False)
    d.yanit = "2xx"
    return [d]


# ---- model ---------------------------------------------------------------------------------------------------------
class Model:
    def __init__(self, senaryo, ux15=True):
        if senaryo.get("dil") not in DILLER:
            raise ValueError(f"dil {senaryo.get('dil')} ∉ {DILLER}")
        self.senaryo = senaryo
        cariler = {k: dict(CARI_TURLERI[v]) for k, v in senaryo["cariler"].items()}
        self.dunyalar = [Dunya(senaryo["bugun"], cariler)]
        self.dunyalar[0].ux15 = ux15
        self.secimler = []

    # her adım: olası dünyaları üret
    def adim(self, adim):
        sonuc = []
        for d in self.dunyalar:
            d = d.kopya()
            d.yanit = None
            d.k33 = None
            d.incele = []
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
            "edm": False, "prog": False, "iptal": False, "silindi": False, "hata": False, "var": True,
            "tutar": TUTARLAR[adim.get("tutar", "olagan")], "belirsiz": False, "iletim": None, "deneme": None, "edm_iptal": False}


def uygula(d, adim):
    i = adim["islem"]
    bugun = d.bugun
    if i in ("kaydet", "kagit_kaydet"):
        if adim["belge"] in d.belgeler:
            d.yanit = None
            return [d]
        # K34: e-SMM makbuzu ESMM profiliyle (seri TES); diğerleri K1 (carinin işareti).
        tur = "kagit" if i == "kagit_kaydet" else "esmm" if adim.get("belge_turu") == "esmm" else d.tur(adim["cari"])
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
        if engel == "alici-eksik":
            # K36 ([GİB] UBL-TR alıcı bilgileri; [AJAN] 11): eksik alıcı bilgili e-Belge EDM'ye gitmez, numara harcanmaz. Kayıt reddedilir YA DA
            # kaydedilip kalıcı engelli kalır (bekletmez — K9: cari kartı düzeltilmeli, belge üzerinde tek adım değil) — çatal.
            r = d.kopya(f"{b['ad']}: alıcı bilgisi eksik, kayıt reddedildi")
            r.belgeler[b["ad"]] = {"ad": b["ad"], "var": False}
            r.yanit = "4xx"
            d.yanit = "2xx"
            return [r, d]
        if d.ux15 and d.tarih_engeli(b):
            # K37 R1 ([AJAN] 12 UX15; [KULLANICI] VUK sıra-tarih K6): aynı seri+yılda son numaralının (iptal dahil) tarihi yeni tarihten büyükse kayıt
            # reddedilir — Kes, Sonra Gönder de; aynı gün serbest. (UX15'siz modelde K29/K2 çatalıdır.)
            d.belgeler[b["ad"]] = {"ad": b["ad"], "var": False}
            d.yanit = "4xx"
            d.notlar.append(f"{b['ad']}: K37 R1 tarih sırası — kayıt reddedildi")
            return [d]
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
        if b.get("cop"):
            d.yanit = "4xx"  # K39: Silinenler'deki belge gönderilmez
            return [d]
        if b["silindi"] and b["tur"] == "esmm" and not b["iptal"] and not b["prog"]:
            # K40 ([KULLANICI] 22.10.2026 MM4 alt kararı, 5 dk yetkisiyle 21:34 UTC): Kâğıt Makbuz Olarak Bırak'ılan makbuz sonradan e-SMM olarak
            # GÖNDERİLEMEZ (kalıcı engel, nedeni görünür) — belge değişmez, EDM'ye gidilmez.
            d.yanit = "4xx"
            return [d]
        if b["silindi"] and not b["iptal"] and not b["prog"]:
            # K18: listeden silinen belge sonra kartından yine gönderilebilir (FATURA-ISTEKLER satır 122–123). Gönderilemezse
            # liste dışında kalır ya da Gönderilecekler'e döner (çatal).
            once = d.kopya()
            once.belgeler[b["ad"]]["silindi"] = False
            if once.belgeler[b["ad"]]["numara"][:3] in KAGIT_SERILER:
                # FIS iç numarası e-Belge numarasına dönüşür; K38 ([KULLANICI] 22.10 "verilmiş fiş numarası bir daha kullanılmaz"): FIS numarası emekli olur.
                once.emekli_et(once.belgeler[b["ad"]])
                once.belgeler[b["ad"]]["numara"] = ""
            sonuc = []
            for w, s in gonder(once, b["ad"]):
                if s in ("gitti", "hata"):
                    sonuc.append(w)
                else:
                    sonuc.append(w)
                    k = w.kopya(f"{b['ad']}: gönderilemedi, liste dışında kaldı")
                    k.belgeler[b["ad"]]["silindi"] = True
                    k.belgeler[b["ad"]]["numara"] = d.belgeler[b["ad"]]["numara"]
                    k.emekli.pop(d.belgeler[b["ad"]]["numara"], None)
                    sonuc.append(k)
            return sonuc
        return [w for w, _ in gonder(d, b["ad"])]
    if i == "tumunu_gonder" and adim.get("kapsam") == "secili" and "eski" in adim:
        return secilenleri_gonder(d, adim)
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
            for seri_tur in ("earsiv", "efatura", "esmm"):
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
        sonuc = []
        # Silme reddedildi → tur olağan.
        r = d.kopya(f"{x}: tur sırasında silme reddedildi")
        r.yanit = "4xx"
        sonuc.extend(tur_gonder(r, None))
        if not d.belirsiz(b) and not b.get("cop"):  # K42 (E1): sonucu belirsiz belge bırakılamaz; K39: Silinenler'deki belge de
            # Silme kabul: belge gönderilmez, numara almaz (ya da FIS iç numarası — çatal). Belge turun ilk gönderilen belgesiyse
            # silme ondan sonra gelir: o dünyada belge gitmiştir ve aday elenir (aşağıdaki koşul).
            for w in tur_gonder(d.kopya(f"{x}: tur sırasında silindi"), None, sil=(x, True)):
                bb = w.belgeler[x]
                if bb["numara"] == "" and w.fis_engeli(bb):
                    continue  # K31: silme reddedilir (yalnız "reddedildi" dünyası kalır)
                if not bb["prog"] and not bb["iptal"] and not bb["edm"]:
                    w.yanit = "2xx"
                    bb["silindi"] = True
                    if bb["numara"] == "":
                        # K40: bırakılan belge kâğıt serisinden numara alır (fatura FIS, makbuz SMM) — /2'deki "numarasız kalır" çatalı kalktı.
                        seri, yil = w.birakma_serisi(bb), gun(bb["tarih"]).year
                        bb["numara"] = numara(seri, yil, w.son(seri, yil)[0] + 1)
                    sonuc.append(w)
        return sonuc
    if i == "listeden_sil":
        b = d.belgeler.get(adim["belge"])
        if not b or b["var"] is not True:
            return [d]
        if b["tur"] == "kagit" or b["iptal"] or b["prog"] is True or b["edm"] is True or b.get("cop"):
            d.yanit = "4xx"  # K20: gönderilmiş / iptal / kâğıt belge listeden silinmez (K39: Silinenler'deki de)
            return [d]
        if b["silindi"]:
            return [d]
        if d.belirsiz(b):
            d.yanit = "4xx"  # K42 (E1): Sonucu Belirsiz belge bırakılamaz / silinemez (önce Durum Sorgula)
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
        # K40 ([KULLANICI] 2.4.3 "Müşteri Fişi Olarak Bırak" + 22.10 "Kâğıt Makbuz Olarak Bırak (SMM serisi)"; MM4 alt kararı metni "FIS numarası alır"):
        # bırakılan fatura FIS, makbuz SMM serisinden numara ALIR (/2'deki "numarasız kalır" çatalı kalktı — tohum 2 × 120 adım 45).
        seri, yil = d.birakma_serisi(b), gun(b["tarih"]).year
        b["numara"] = numara(seri, yil, d.son(seri, yil)[0] + 1)
        return [d]
    if i == "iptal":
        b = d.belgeler.get(adim["belge"])
        if not b or b["var"] is not True:
            return [d]
        if b["iptal"]:
            d.yanit = "4xx"
            return [d]
        return iptal(d, b, bool(adim.get("yerel")))
    if i == "duzenle_tarih":
        b = d.belgeler.get(adim["belge"])
        if not b or b["var"] is not True:
            return [d]
        if adim["tarih"] > bugun:
            d.yanit = "4xx"
            return [d]
        if b["iptal"] or b["prog"] is True or b["edm"] is True or b.get("cop"):
            d.yanit = "4xx"  # K25: gönderilmiş / iptal belge değiştirilemez (K39: Silinenler'deki de)
            return [d]
        if d.belirsiz(b):
            d.yanit = "4xx"  # K42 (E1): Sonucu Belirsiz belge düzenlenmez
            return [d]
        if b["numara"]:
            r = d.kopya(f"{b['ad']}: numaralı belgenin tarih düzenlemesi reddedildi")
            r.yanit = "4xx"
            k = d.kopya(f"{b['ad']}: numaralı belgenin tarihi değişti")
            k.belgeler[b["ad"]]["tarih"] = adim["tarih"]
            k.yanit = "2xx"
            if d.ux15 and not b["silindi"]:
                # K37 R2 ([AJAN] 12 UX15; K6 VUK sıra-tarih): numaralı belgenin yeni tarihi seride önceki ile sonraki numaralının tarihleri arasında
                # (eşit dahil) ve aynı yılda olmalı; değilse reddedilir. Belirsiz belgede program önce Durum Sorgula isteyebilir (çatal: red).
                once, sonra = d.komsular(b)
                uygun = gun(adim["tarih"]).year == gun(b["tarih"]).year and (once is None or adim["tarih"] >= once) and (sonra is None or adim["tarih"] <= sonra)
                if not uygun:
                    return [r]
                # Kâğıt belge (e-dönüşüm açıkken "kâğıt değil e-Arşiv" — profile-not-allowed) reddedilebilir.
                return [k, r] if b["tur"] == "kagit" else [k]
            # K26: numaralı ama gitmemiş (ya da kâğıt) belgenin tarihi: reddedilir YA DA kabul edilir — çatal (değişmezler denetler).
            return [r, k]
        eski = b["tarih"]
        if b["tur"] in ("efatura", "earsiv") and b["tur"] != d.tur(b["cari"]):
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
            if d.ux15:
                # K37 R2: numarasız bekleyen serinin son numaralısından eski tarihe alınamaz → reddedilir.
                return [r]
            return [d, r]
        return [d]
    if i == "duzenle_tur":
        b = d.belgeler.get(adim["belge"])
        if not b or b["var"] is not True:
            return [d]
        if (b["numara"] and b["tur"] != "kagit") or b.get("cop") or d.belirsiz(b):
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
        if b and b["var"] is True and b["edm"] is True and not b["prog"] and d.ag and not b.get("cop"):
            # K28: Durum Sorgula EDM'deki belgeyi programda "gönderildi" yapar.
            b["prog"] = True
            b["hata"] = False
            b["belirsiz"] = False
        return [d]
    if i == "gun_ilerlet":
        d.bugun = (gun(bugun) + timedelta(days=adim["gun"])).isoformat()
        return [d]
    if i == "sil":
        return sil(d, adim)
    if i == "geri_yukle":
        return geri_yukle(d, adim)
    raise ValueError(f"bilinmeyen işlem {i}")


def sil(d, adim):
    """K39 Sil → Silinenler (E6 [AJAN] metni; ana oturum doğruladı; [KULLANICI] 22.10 "verilmiş kâğıt/fiş numarası bir daha kullanılmaz").
    - Gönderilmiş / EDM'de olan belge silinmez ([GİB] gönderilmiş belge değiştirilemez; FATURA-ISTEKLER 119 "kesilen belge düzeltilmez").
    - Sonucu Belirsiz belge silinmez (K42, E1).
    - Kâğıt (FIS), bırakılmış (FIS/SMM) ve numarasız bekleyen belge silinir; numaralı belgenin numarası serbest KALMAZ (K38: sıradaki numara silinmişler
      dahil en büyükten sonra; yeni belge silinen son belgeden eski tarihli olamaz); numarasız belgeyi silmek tabanı değiştirmez.
    - İptal edilmiş belge, numara almış ama gitmemiş e-Belge (Hata): kaynakta yazılı değil ("e-Belge serisinin eski kuralı aynı") → ÇATAL (silinir / red)."""
    b = d.belgeler.get(adim["belge"])
    if not b or b["var"] is not True or b.get("cop"):
        return [d]
    if b["prog"] is True or b["edm"] is True or d.belirsiz(b):
        d.yanit = "4xx"
        return [d]
    if b["iptal"] or b["numara"][:3] in E_SERI_ONEK:
        k = d.kopya(f"{b['ad']}: {'iptal' if b['iptal'] else 'numaralı gitmemiş'} belge silindi")
        k.belgeler[b["ad"]]["cop"] = True
        k.yanit = "2xx"
        r = d.kopya(f"{b['ad']}: silme reddedildi")
        r.yanit = "4xx"
        return [k, r]
    b["cop"] = True
    d.yanit = "2xx"
    return [d]


def geri_yukle(d, adim):
    """K39 Silinenler'den geri yükle (E6): belge KENDİ numarasıyla döner; numara başka canlı belgedeyse 409, belge Silinenler'de kalır. Döndüğü durum
    (etkisiz "İptal Edildi" mi, önceki durumu mu) kaynakta yazılı değil → ÇATAL. Numaranın başka belgede olması bu senaryo dilinde ancak programın numarayı
    yeniden vermesiyle olur (K38 ihlali) — o hâlde de 409 beklenir."""
    b = d.belgeler.get(adim["belge"])
    if not b or b["var"] is not True or not b.get("cop"):
        return [d]
    if b["numara"] and any(x is not b and x.get("var") is True and not x.get("cop") and x.get("numara") == b["numara"] for x in d.belgeler.values()):
        d.yanit = "4xx"
        return [d]
    a = d.kopya(f"{b['ad']}: Silinenler'den etkisiz (iptal) döndü")
    a.belgeler[b["ad"]].update(cop=False, iptal=True)
    a.yanit = "2xx"
    o = d.kopya(f"{b['ad']}: Silinenler'den önceki durumuyla döndü")
    o.belgeler[b["ad"]]["cop"] = False
    o.yanit = "2xx"
    return [a, o]


# ---- anlık görüntü ----------------------------------------------------------------------------------------------------
def goruntu(d):
    """Belge başına karşılaştırılan alanlar (fark.py): var, numara, edm (EDM kabul etti), gonderildi (programda), iptal, bekleyen, edm_iptal (/2: EDM'de
    iptal edildi — K22/K35 yerel iptal ile EDM iptalini ayırır)."""
    g = {}
    for ad, b in d.belgeler.items():
        if b["var"] is not True:
            g[ad] = {"var": b["var"] if b["var"] is B else False}
            continue
        g[ad] = {"var": True, "numara": b["numara"], "edm": b["edm"], "gonderildi": b["prog"], "iptal": b["iptal"],
                 "bekleyen": d.bekleyen(b), "tarih": b["tarih"], "tur": b["tur"], "edm_iptal": b.get("edm_iptal", False), "cop": bool(b.get("cop"))}
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
