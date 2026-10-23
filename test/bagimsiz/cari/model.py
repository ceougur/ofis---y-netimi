#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bağımsız CARİ / EVRAK kâhini (2.4.4 madde 31a, B1–B2) — temiz oda.

Programın kodunu GÖRMEDEN, yalnız KARARLAR.md'deki kurallarla (kaynakları: CLAUDE.md "Açık iş" kullanıcı kararları, docs/BANKA-MODULU-PLAN.md,
KURALLAR-244.md'deki ajan kural metinleri) bir senaryonun (dil "destekofis-cari/1") beklenen sonuçlarını hesaplar.

  python3 -I test/bagimsiz/cari/model.py <senaryo.json> [--mutasyon N] > beklenen.json

Çıktı: {"ad", "denetimler": {anahtar: {"b": beklenen, "e": etiket, "k": kural}}, "belirsiz": [..]}. Anahtarlar koşucunun (kos.mjs) programdan
okuduğu anahtarlarla aynıdır (KARARLAR.md §4). Yalnız tamsayı kuruş; ağ, saat ve programın hiçbir dosyası kullanılmaz; aynı girdiye bayt bayt
aynı çıktı.
"""
import json
import sys
from collections import defaultdict

DIL = "destekofis-cari/2"
# /2 (2.4.4 31a tur 2, 23.10.2026; kodu görmeyen el): B3 Tablodaki Kişiler BORÇ (U2/E2/E3 — sütun önceliği, söz borç dışı, gün/adet tutar değil, Kalan boş →
# Toplam Borç, aynı dosya no bir kez), B4 Nakit Akışı Kasa giriş/çıkış = Kasa raporu (MM6), B5 Nihai Tüketici carisi (U1). /1 senaryoları değişmeden koşar.
DILLER = ("destekofis-cari/1", DIL)
BIRINCIL = {"KULLANICI", "PLAN", "GIB", "EDM"}

MUTASYONLAR = {
    1: "5a: sığmayan tahsilat bölünür (kartı doldurana kadar parçası taşınır)",
    2: "5a: sığmayan tahsilat atlanır, sonraki küçükler taşınmaya devam eder",
    3: "5b: carinin borcuna taşınan tahsilatlar geri eklenmez (D = bakiye)",
    4: "5b: borç kalandan azsa kişi aktarılmaz yerine yeni borç yazılır",
    5: "5c: aynı dosya no her sekmede ayrı sayılır (çift sayım)",
    6: "UX18: bağlı evrakın fazlası en eski açık faturaya gitmez (avans kalır)",
    7: "UX18: karşılıksız evrak faturayı yeniden açmaz",
    8: "UX18: fatura iptalinde evrakın bağı düşmez (evrak hiçbir faturayı kapatmaz)",
    9: "Otomatik kapama en YENİ faturadan başlar",
    10: "Geri al: taşınan tahsilatlar cariye dönmez",
    11: "5a: taşıma Kasa'yı azaltır",
    12: "Kart: tahsilat en yeni taksitten başlayarak sayılır",
    13: "Mizan: alınan senet 101'e yazılır (121 yerine)",
    # /2
    14: "K3: Kalan önceliği yok (toplam önce)",
    15: "K3: Ödeme Sözü tutarı borç sayılır",
    16: "K3: gün/adet sütunu tutar sayılır",
    17: "K3: Kalan hücresi boşsa borç 0 (toplama düşmez)",
    18: "K2 (04:09): farklı sekmede aynı dosya no tek kayıt — yalnız ilk borçlu sekme sayılır (03:12 kuralı)",
    19: "MM6: Nakit Akışı Kasa girişi yalnız cari tahsilatı sayar (evrak tahsili ve kayıt tahsilatı dışarıda)",
    20: "U1: Nihai Tüketici 11111111111'li en eski cariyi (adı belli olsa da) seçer",
    21: "U1: işaretli cari adı/kimliği değişse de kullanılır",
    22: "MM6: elle Kasa çıkışı Nakit Akışı'nda sayılmaz",
    23: "K1: aynı sekmede tekrar eden dosya no yalnız ilk satırla sayılır",
    24: "K3: Kalan'sız Tutar + Tahsil Edilen tablosunda ödenen düşülmez",
    25: "K3: toplam − ödenen negatifse 0'a çekilmez",
    26: "K2: 'birden çok sekmede; ayrı sayıldı' notu yok (rapor ve Tahsilat Takvimi)",
    27: "K5: Kasa'yı görme yetkisi olmayan kullanıcı Kasa giriş/çıkışını görür",
    # /2 C3 (23.10.2026 [KULLANICI] kişi gruplaması)
    28: "C3: aynı kimlik farklı adları birleştirir (kişi kimliğe göre)",
    29: "C3: aynı ad farklı kimlik tek kişi (yalnız ada göre)",
    30: "C3: kimliksiz satır aynı adın tek kimliğine katılmaz",
    31: "C3: aynı adı paylaşan kişilerin etiketinde kimlik yok",
    32: "C3 kimliksiz satır: çok kimlikli adın kimliksiz kaydı ilk kimliğe katılır (ayrı kalmaz)",
    33: "C3 kimlik sütunu: sağlama hanesi tutmayan değer de kimlik sayılır",
    34: "Kimlik sütunu: 'Vergi No' / 'Vergi Numarası' / 'Vergi Kimlik' tutar sayılır",
    # /2 VERGİ SÜTUNU BORÇ DEĞİLDİR ([KULLANICI] 23.10.2026 karar A, 5 dk yetkisiyle)
    35: "Vergi sütunu (KDV, Vergi, Vergi Tutarı, Stopaj, Tevkifat, ÖTV) tutar sayılır ve Genel Toplam ayrı sınıf değil (eski K3: borç belirlenemez)",
    36: "Tutar + Genel Toplam tablosunda borç Tutar (KDV hariç)",
    37: "Borç sütunu belirlenemeyen kişiler raporda notsuz kaybolur",
    # /2 KAYIT ANAHTARI SÜREKLİLİĞİ (baş mimar kararı 23.10.2026)
    38: "Yerine koy (aynı dosyayı yeniden yükle) kayda bağlı tahsilatı kayıttan koparır",
    39: "Sağlaması tutmayan Vergi No / TC değeri kayıt kimliğine girer (değer değişince tahsilat kopar)",
    # /2 TABLO BAĞ SÜREKLİLİĞİ (baş mimar kararı 23.10.2026)
    40: "Yerine koy güvenli eşleşmede de bağı koparır (satır içeriği anahtar)",
    41: "Güvenli eşleşme yokken uyarı ve onay yok (sessiz)",
    42: "Aynı kişi değeri birden çok satırdayken aynı konum eşleşmesi yok",
    43: "Devamı olarak ekle aynı kişi + aynı tutar satırını söylemez, onay istemez",
    # /2 NETLEŞTİRME (karar sahibi, 23.10.2026): içeriği tamamen aynı satır mevcut kaydın kendisidir
    44: "İçeriği aynı satır yer değişince (aynı adlı iki satırın yer değiştirmesi) eşleşmez — onay ister",
    45: "Devamı olarak ekle içeriği tamamen aynı satırı ikinci kez ekler ve onay ister",
    46: "Devamı olarak ekle güvenli eşleşen (aynı kişi, başka hücresi farklı) satırı güncellemez, ikinci kez ekler ve onay ister",
}


def kurus(metin):
    s = str(metin).strip()
    if "," in s:
        tam, ond = s.split(",", 1)
        ond = (ond + "00")[:2]
    else:
        tam, ond = s, "00"
    return int(tam) * 100 + int(ond)


# ───────────────────────── /2 B3: Tablodaki Kişiler borcu — [KULLANICI] 23.10.2026 03:12 UTC (5 dk yetkisiyle) K1–K5 metni; ürün kodu okunmadı
# C3 (23.10.2026): kişi kimliği sütunu (TCKN/VKN). Başlık adları ORTAM bilgisidir — kara kutu yoklaması (aday 15, 23.10.2026: "TC Kimlik No", "TCKN", "VKN",
# "TCKN/VKN", "Kimlik No", "TC Kimlik No / VKN" başlıklı sütunda aynı ad farklı kimlik ayrı satır oldu; "Vergi No" başlıklı tabloda hiç satır görünmedi — İNCELE).
# VERGİ SÜTUNU BORÇ DEĞİLDİR ([KULLANICI] 23.10.2026 karar A): "KDV", "Vergi", "Vergi Tutarı", "Stopaj", "Tevkifat", "ÖTV" başlıklı sütunlar tutardır ama borç sayılmaz;
# Kalan/ödenen yoksa ve "Tutar" (KDV hariç) ile "Genel Toplam" (KDV dahil) varsa borç Genel Toplam.
VERGI_KELIME = {"kdv", "stopaj", "tevkifat", "ötv"}
VERGI_TAM_BASLIK = {"vergi", "vergi tutarı"}
KISI_KIMLIK_BASLIK = {"tc kimlik no", "tckn", "vkn", "tckn/vkn", "kimlik no", "tc kimlik no / vkn",
                      # KİMLİK SÜTUNU TUTAR DEĞİLDİR (baş mimar kararı, 23.10.2026): kimlik/numara bildiren başlık — sağlama hanesi tutmasa da tutar sayılmaz, borca girmez.
                      # "Vergi", "Vergi Tutarı", "KDV" başlıklı sütunlar tutardır (bu kümede değil).
                      "vergi no", "vergi numarası", "vergi kimlik"}
VERGI_KIMLIK_BASLIK = {"vergi no", "vergi numarası", "vergi kimlik"}  # mutant 34
KIMLIK_BASLIK = {"dosya no", "borçlu", "telefon", "müşteri no", "müşteri", "ad soyad", "fatura no"} | KISI_KIMLIK_BASLIK
TUTAR_DISI = {"gün", "adet"}  # K3: gün/adet sütunu ("Kalan Gün", "Adet") tutar değildir
TUTAR_DISI_EK = {"sayı", "sayısı", "ay", "yıl", "oran", "oranı", "yüzde"}  # tutar sayılmaz [YAYGIN]; senaryolarda kullanılmaz (DENENMEZ)


def tckn_gecerli(v):
    """TCKN sağlama haneleri (NVİ): 11 hane, ilk hane 0 değil; 10. = ((1+3+5+7+9) × 7 − (2+4+6+8)) mod 10; 11. = ilk 10 hanenin toplamı mod 10."""
    if len(v) != 11 or not v.isdigit() or v[0] == "0":
        return False
    d = [int(c) for c in v]
    return d[9] == ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10 and d[10] == sum(d[:10]) % 10


def vkn_gecerli(v):
    """VKN sağlama hanesi (GİB): 10 hane; i = 0..8 için t = (d_i + 9 − i) mod 10, p = t × 2^(9−i) mod 9 (t ≠ 0 ve p = 0 ise 9); 10. hane = (10 − Σp mod 10) mod 10."""
    if len(v) != 10 or not v.isdigit():
        return False
    s = 0
    for i in range(9):
        t = (int(v[i]) + 9 - i) % 10
        p = (t * 2 ** (9 - i)) % 9
        if t != 0 and p == 0:
            p = 9
        s += p
    return int(v[9]) == (10 - s % 10) % 10


def kimlik_gecerli(v):
    return tckn_gecerli(v) or vkn_gecerli(v)


def tr_kucuk(metin):
    return str(metin).replace("I", "ı").replace("İ", "i").lower()


def kelimeler(baslik):
    out, w = [], ""
    for ch in tr_kucuk(baslik):
        if ch.isalpha():
            w += ch
        else:
            if w:
                out.append(w)
            w = ""
    if w:
        out.append(w)
    return out


def tarih_mi(metin):
    t = str(metin or "").strip()
    return len(t) == 10 and ((t[2] == "." and t[5] == "." and t.replace(".", "").isdigit()) or (t[4] == "-" and t[7] == "-" and t.replace("-", "").isdigit()))


def sutun_sinifi(baslik, hucreler=()):
    """K3 sütun sınıfı: None tutar değil (tarih değerli sütun [YAYGIN]; gün/adet — K3); "soz" Ödeme Sözü tutarı (borç değil — K3); "kalan" Kalan/Kalan Borç/
    Bakiye; "odenen" Tahsil Edilen/Ödenen/Ödenen Tutar; "toplam" Toplam Borç/Tutar/Ödenecek Tutar/Toplam (borç/alacak başlıklı da); "tutar" öbür tutar (Aidat, Ücret …)."""
    dolu = [h for h in hucreler if str(h or "").strip()]
    if dolu and all(tarih_mi(h) for h in dolu):
        return None
    if dolu and not any(_sayi_mi(h) for h in dolu):
        return None  # [YAYGIN] değerleri sayı olmayan metin sütunu ("Açıklama": "Ekim") tutar değildir
    w = kelimeler(baslik)
    if "%" in str(baslik) or any(x in TUTAR_DISI or x in TUTAR_DISI_EK for x in w):
        return None
    if any(x in VERGI_KELIME for x in w) or " ".join(w) in VERGI_TAM_BASLIK:
        return "vergi"  # karar A: tutardır ama borç sayılmaz
    if w[:2] == ["genel", "toplam"]:
        return "genel"  # karar A: KDV dahil toplam
    if any(x.startswith(("söz", "taahhüt")) for x in w):
        return "soz"
    if "kalan" in w or "bakiye" in w:
        return "kalan"
    if ("tahsil" in w and any(x.startswith("edil") for x in w)) or any(x.startswith("ödenen") for x in w):
        return "odenen"
    if any(x.startswith(("toplam", "tutar", "ödenecek", "borç", "alacak")) for x in w):
        return "toplam"
    return "tutar"


def _sayi_mi(metin):
    try:
        return hucre_kurus(metin) is not None
    except (ValueError, TypeError):
        return False


def hucre_kurus(metin):
    """Tablo hücresi ("6.000,00 ₺", "8000", "") → kuruş; boş → None."""
    t = str(metin if metin is not None else "").replace("₺", "").replace("TL", "").replace(" ", "").strip()
    if not t:
        return None
    t = t.replace(".", "")
    return kurus(t)


YOK = "yok"  # satırda borç tutarı sütunu yok (yalnız söz / tarih / gün) — borç kaynağı sayılmaz


class Model:
    def __init__(self, senaryo, mut=0):
        if senaryo.get("dil") not in DILLER:
            raise SystemExit("senaryo dili %s değil" % "/".join(DILLER))
        self.s = senaryo
        self.mut = mut
        self.bugun = senaryo["bugun"]
        self.seq = 0
        self.cariler = {}          # takma ad -> {tur, isim, kayit, acilis}
        self.borclar = defaultdict(int)
        self.tahsilatlar = {}      # adım id -> {cari, tutar, tarih, seq, fatura, kart, aktif}
        self.faturalar = {}        # takma ad -> {cari, tutar, tarih, seq, tur, durum, taksitli, asil}
        self.evraklar = {}         # takma ad -> {cari, tur, tutar, tarih, seq, fatura, durum, ciroCari, kendi}
        self.kayitlar = {}         # kayıt no -> {sekmeler:[..], tur, isim, items:[(tarih, tutar)], kalan}
        self.kartlar = {}          # kayıt no -> {cari, toplam, mevcut, tasinan:[ids], aktar, aktif}
        self.aktarimlar = {}       # takma ad -> {kartlar:[no]}
        self.kayitTahsilat = defaultdict(int)
        self.kasa = 0
        self.kasa_hareket = []     # /2 B4: (tarih, giriş kuruş, çıkış kuruş) — yalnız NAKİT (MM6 "bütün kaynaklar")
        self.sekmeler = []         # /2 B3: yüklenen tablonun sekmeleri (sırasıyla) — satırlar (dosya no, hücreler) yazım sırasıyla (K1)
        self.kullanicilar = {}     # /2 B5b (K5): Kasa görme yetkisi kaldırılmış kullanıcılar
        self.nt_isaretli = None    # /2 B5: programın işaretli Nihai Tüketici carisi (takma ad)
        self.nt_sayac = 0
        self.mizanBilinir = True
        self.etiketCari = defaultdict(set)   # cari -> açık/kart denetiminin etiketini AJAN'a düşüren nedenler
        self.out = {}
        self.belirsiz = []
        self.belirsiz_adlar = set()  # bağ sürekliliği: eşleşmeyen bağlı verinin yeri kuralda yok → bu adlı kişilerin borç/alacak denetimi yapılmaz

    # ───────────────────────── yardımcılar
    def yeni_seq(self):
        self.seq += 1
        return self.seq

    def d(self, anahtar, deger, etiket, kural):
        self.out[anahtar] = {"b": deger, "e": etiket, "k": kural}

    def cari_bul_kayit(self, no):
        for ad, c in self.cariler.items():
            if c.get("kayit") == no and not c.get("silindi"):
                return ad
        return None

    def faturali(self, cari):
        return any(f["cari"] == cari and f["durum"] == "kesildi" for f in self.faturalar.values())

    def bakiye(self, cari):
        c = self.cariler[cari]
        b = c["acilis"] + self.borclar[cari]
        for f in self.faturalar.values():
            if f["cari"] != cari or f["durum"] != "kesildi":
                continue
            if f["tur"] == "satis":
                b += f["tutar"]
            elif f["tur"] in ("iade", "alis"):
                b -= f["tutar"]
        for k in self.kartlar.values():
            if k["aktif"] and k["cari"] == cari and not k["mevcut"]:
                b += k["toplam"]
        for t in self.tahsilatlar.values():
            if t["aktif"] and t["cari"] == cari:
                b -= t["tutar"]
        for e in self.evraklar.values():
            if e["durum"] == "silindi":
                continue
            if e["cari"] == cari:
                b -= e["tutar"]
                if e["durum"] == "karsiliksiz":
                    b += e["tutar"]
            if e["durum"] == "ciro" and e["ciroCari"] == cari:
                b += e["tutar"]
        return b

    def taksit_disi(self, cari):
        return [t for t in sorted(self.tahsilatlar.values(), key=lambda x: (x["tarih"], x["seq"]))
                if t["aktif"] and t["cari"] == cari and t["kart"] is None and t["fatura"] is None]

    # ───────────────────────── fatura açıkları (§7 + UX18)
    def aciklar(self, cari):
        hedef = sorted([(f["tarih"], f["seq"], ad) for ad, f in self.faturalar.items()
                        if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "satis" and not f["taksitli"]])
        acik = {ad: self.faturalar[ad]["tutar"] for _, _, ad in hedef}
        bagli = defaultdict(int)
        havuz = 0
        for t in self.tahsilatlar.values():
            if not t["aktif"] or t["cari"] != cari or t["kart"] is not None:
                continue
            if t["fatura"] and t["fatura"] in acik:
                bagli[t["fatura"]] += t["tutar"]
            else:
                havuz += t["tutar"]
        for ad, e in self.evraklar.items():
            if e["cari"] != cari or e["durum"] in ("silindi",):
                continue
            if e["durum"] == "karsiliksiz" and self.mut != 7:
                continue
            f = e["fatura"]
            if f and f in acik:
                bagli[f] += e["tutar"]
            elif f and f in self.faturalar and self.faturalar[f]["durum"] == "iptal" and self.mut == 8:
                continue
            else:
                havuz += e["tutar"]
        for _, _, ad in hedef:
            kapanan = min(acik[ad], bagli[ad])
            acik[ad] -= kapanan
            if self.mut != 6:
                havuz += bagli[ad] - kapanan
        # satıştan iade (§7 kural 5–6): asıl faturanın açığından düşer, artanı en eski açık satış faturasına
        iadeler = sorted([(f["tarih"], f["seq"], ad) for ad, f in self.faturalar.items()
                          if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "iade"])
        sira = [ad for _, _, ad in hedef]
        if self.mut == 9:
            sira = list(reversed(sira))
        for _, _, iad in iadeler:
            i = self.faturalar[iad]
            artan = i["tutar"]
            if i["asil"] in acik:
                d = min(acik[i["asil"]], artan)
                acik[i["asil"]] -= d
                artan -= d
            for ad in sira:
                d = min(acik[ad], artan)
                acik[ad] -= d
                artan -= d
            acik[iad] = artan
        for ad in sira:
            d = min(acik[ad], havuz)
            acik[ad] -= d
            havuz -= d
        for ad, f in self.faturalar.items():
            if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "satis" and f["taksitli"]:
                acik[ad] = f["tutar"]
        return acik

    def satir_borcu(self, sk, hucre):
        """K3 satırın borcu (kuruş), YOK (borç tutarı sütunu yok) ya da None (kural tanımsız — denetlenmez)."""
        sinif = []
        for h in sk["basliklar"]:
            if tr_kucuk(h) in KIMLIK_BASLIK and not (self.mut == 34 and tr_kucuk(h) in VERGI_KIMLIK_BASLIK):
                continue
            sutun = [c.get(h) for _, c in sk["satirlar"]]
            sinif.append((h, sutun_sinifi(h, sutun) if self.mut != 16 or kelimeler(h)[-1:] not in (["gün"], ["adet"]) else "tutar"))
        if self.mut == 35:  # eski K3: vergi sütunu tutar, Genel Toplam toplam sınıfı
            sinif = [(h, "tutar" if x == "vergi" else "toplam" if x == "genel" else x) for h, x in sinif]
        al = lambda c: [h for h, x in sinif if x == c]  # noqa: E731
        kalan, toplam, odenen, tutar, soz, genel = al("kalan"), al("toplam"), al("odenen"), al("tutar"), al("soz"), al("genel")
        if len(genel) > 1:
            return None
        if self.mut == 15:
            tutar = tutar + soz
        if len(kalan) > 1 or len(toplam) > 1 or len(odenen) > 1:
            return None
        if kalan and self.mut != 14:
            v = hucre_kurus(hucre.get(kalan[0]))
            if v is not None:
                return v
            if self.mut == 17:
                return 0
            if toplam:
                return hucre_kurus(hucre.get(toplam[0]))  # K3: Kalan hücresi boş → toplam
            return None
        if kalan and self.mut == 14 and toplam:
            return hucre_kurus(hucre.get(toplam[0]))
        if odenen and genel:
            toplam = genel  # karar A + K3 "Kalan yoksa toplam − ödenen": toplam KDV dahil Genel Toplam [YAYGIN — hangi toplam metinde yok]
        if odenen and toplam:
            t = hucre_kurus(hucre.get(toplam[0]))
            o = hucre_kurus(hucre.get(odenen[0]))
            if t is None or o is None:
                return None
            if self.mut == 24:
                return t
            return t - o if self.mut == 25 else max(0, t - o)  # K3: Kalan yoksa toplam − ödenen; negatifse 0
        if odenen:
            return None
        if genel:
            if self.mut == 36 and len(toplam) == 1:
                return hucre_kurus(hucre.get(toplam[0]))
            return hucre_kurus(hucre.get(genel[0]))  # karar A: Tutar (KDV hariç) + Genel Toplam (KDV dahil) → borç Genel Toplam
        para = toplam + tutar
        if len(para) == 1:
            return hucre_kurus(hucre.get(para[0]))  # K3: tek tutar sütunu (taksit, kira, aidat, ücret, "Ödenecek" dahil)
        if not para:
            return YOK  # yalnız söz / tarih / gün — borç değil
        return None

    def kisiler(self):
        """C3 ([KULLANICI] 23.10.2026, 31e kontrol turu 3 bulgusu C3 + bağımsız dar kontrol D1): Tablodaki Kişiler'de carisi olmayan tablo kayıtlarının kişi
        gruplaması. Aynı ad + farklı TCKN/VKN = farklı kişi (ayrı satır, etikette kimlik); aynı ad + aynı kimlik = aynı kişi; FARKLI ad + AYNI kimlik = FARKLI kişiler
        (kimlik yalnız aynı adı ayırır, farklı adları birleştirmez). KİMLİKSİZ SATIR (baş mimar kararı, C3 tamamlayıcısı, 23.10.2026): adın tek kimliği varsa ona
        katılır; adın birden çok kimliği varsa AYNI Dosya No'yu taşıyan kimlikli satırın kişisine katılır; o da yoksa adın kimliksiz grubu olarak ayrı kişi kalır.
        KİMLİK SÜTUNU (aynı karar): sağlama hanesi tutmayan değer kimlik sayılmaz (ad kuralı geçer) — tablo_yukle yalnız geçerli TCKN/VKN'yi kimlik yazar.
        [YAYGIN] kimliği hiç olmayan aynı ad tek kişidir. TANIMSIZ (denetlenmez): bir kayıtta (dosya no) birden çok ad ya da birden çok kimlik.
        Dönüş: kayıt no → kişi anahtarı ya da None."""
        adaylar = [no for no, kay in self.kayitlar.items() if self.cari_bul_kayit(no) is None and kay["tur"] != "taksit"]
        ad_kimlik = defaultdict(set)
        bozuk = set()
        for no in adaylar:
            kay = self.kayitlar[no]
            if len(kay["adlar"]) > 1 or len(kay["kimlikler"]) > 1:
                bozuk.add(kay["isim"])
            ad_kimlik[kay["isim"]] |= kay["kimlikler"]
        out = {}
        for no in adaylar:
            kay = self.kayitlar[no]
            ad = kay["isim"]
            kim = next(iter(kay["kimlikler"])) if kay["kimlikler"] else None  # aynı dosya no'nun kimlikli satırı (kimliksiz satırları da bu kişiye)
            tek = next(iter(ad_kimlik[ad])) if len(ad_kimlik[ad]) == 1 else None
            if ad in bozuk:
                out[no] = None
                continue
            if self.mut == 28:
                kk = kim or tek
                out[no] = ("kimlik", kk) if kk else ("ad", ad)  # D1 davranışı: kimlik farklı adları birleştirir
            elif self.mut == 29:
                out[no] = ("ad", ad)
            elif kim:
                out[no] = ("ad", ad, kim)
            elif tek and self.mut != 30:
                out[no] = ("ad", ad, tek)  # adın tek kimliği
            elif len(ad_kimlik[ad]) > 1 and self.mut == 32:
                out[no] = ("ad", ad, sorted(ad_kimlik[ad])[0])
            else:
                out[no] = ("ad", ad, None)  # adın kimliksiz grubu (kimliği hiç olmayan ad ya da çok kimlikli adın kimliksiz kaydı)
        return out

    def ad_cok_kimlikli(self, ad):
        """C3: adı paylaşan birden çok kimlikli kişi var mı (etikette kimlik beklenir)."""
        return len({k for no, kay in self.kayitlar.items() if kay["isim"] == ad and self.cari_bul_kayit(no) is None for k in kay["kimlikler"]}) > 1

    def tablo_borcu(self, no):
        """/2 B3 (K1–K3): dosya no'nun Tablodaki Kişiler borcu (kuruş) ya da None (tanımsız → denetlenmez).
        K1 aynı sekmede aynı dosya no'lu satırlar ayrı borçtur (toplanır). K2 ([KULLANICI] 23.10.2026 04:09 UTC, 5 dk yetkisiyle; 03:12'deki "farklı sekmede tek
        kayıt, bir kez" kuralının YERİNE — dönem sekmelerinin vade kalemleri Takvim'de düşüyordu): FARKLI SEKMEDE aynı dosya no da AYRI borç ve ayrı vade kalemidir
        (2.4.3 gibi) → bütün sekmelerin satır borçları toplanır (yalnız sözü olan sekme borç katmaz). Tahsilat bir kez (5c) değişmez."""
        adaylar = []
        for sk in self.sekmeler:
            satirlar = [c for n, c in sk["satirlar"] if n == no]
            if not satirlar:
                continue
            if sk["basliklar"] is None:
                return None  # taksit sekmesi: kart/taksit sütunlarının borç kuralı bu kâhinde yok
            if self.mut == 23:
                satirlar = satirlar[:1]
            vs = [self.satir_borcu(sk, c) for c in satirlar]
            if any(v is None for v in vs):
                return None
            if all(v == YOK for v in vs):
                continue
            adaylar.append(sum(v for v in vs if v != YOK))
        if not adaylar:
            return 0
        if self.mut == 18:
            return adaylar[0]
        return sum(adaylar)

    def cok_sekme_sayisi(self):
        """K2 notu ("N dosya no birden çok sekmede; ayrı sayıldı"): birden çok sekmede geçen dosya no sayısı — ÇATAL (bütün sekmeler / yalnız borç kaynağı
        sekmeler; yalnız sözü olan sekmenin sayılıp sayılmadığı metinde yok)."""
        hepsi, borclu = 0, 0
        for no in self.kayitlar:
            sek = [sk for sk in self.sekmeler if any(n == no for n, _ in sk["satirlar"])]
            if len(sek) > 1:
                hepsi += 1
            kaynak = [sk for sk in sek if sk["basliklar"] is None or any(self.satir_borcu(sk, c) not in (YOK,) for n, c in sk["satirlar"] if n == no)]
            if len(kaynak) > 1:
                borclu += 1
        return sorted({hepsi, borclu})

    # ───────────────────────── işlemler
    def tablo_yukle(self, a):
        # KAYIT ANAHTARI SÜREKLİLİĞİ (baş mimar kararı 23.10.2026): "Yerine koy" ile yeniden yüklenen tabloda kayda bağlı tahsilat kayıttan kopmaz (kayitTahsilat
        # kayıt no'suyla kalır); sağlaması tutmayan Vergi No / TC değeri kayıt kimliği sayılmaz — değeri değişse ya da silinse de kayıt aynı kayıttır.
        if self.mut == 38:
            self.kayitTahsilat.clear()
        onceki_imza = {no: kay.get("ham_kimlik") for no, kay in getattr(self, "kayitlar", {}).items()}
        eski_satir = self.satir_listesi() if self.sekmeler else None
        eski_sekme, eski_kayit = list(self.sekmeler), dict(self.kayitlar)
        self.kayitlar = {}
        self.sekmeler = []
        for sk in a["sekmeler"]:
            # /2 B3: sekmenin başlıkları ve hücreleri (koşucunun tabloMatrisi ile aynı düzen; kâhin hücre metninden okur)
            if sk["tur"] == "icra":
                bas = ["Dosya No", "Borçlu", "Telefon", "Alacak Tutarı", "Kalan"]
                satirlar = [(r["no"], {"Alacak Tutarı": r["alacak"], "Kalan": r["kalan"]}) for r in sk["kayitlar"]]
            elif sk["tur"] == "soz":
                bas = ["Dosya No", "Borçlu", "Söz Tarihi", "Söz Tutarı"]
                satirlar = [(r["no"], {"Söz Tarihi": r["tarih"], "Söz Tutarı": r["tutar"]}) for r in sk["kayitlar"]]
            elif sk["tur"] == "serbest":
                bas = list(sk.get("ilk") or ["Dosya No", "Borçlu"]) + list(sk["basliklar"])  # `ilk`: Fatura No + Müşteri ya da Dosya No'suz (yalnız Müşteri)
                satirlar = [(r["no"], dict(r.get("hucreler", {}))) for r in sk["kayitlar"]]
            else:
                bas, satirlar = None, [(r["no"], None) for r in sk["kayitlar"]]
            self.sekmeler.append({"ad": sk["ad"], "tur": sk["tur"], "basliklar": bas, "satirlar": satirlar, "adlar": [r["isim"] for r in sk["kayitlar"]],
                                  "dosyalar": [None if (sk.get("ilk") and len(sk["ilk"]) == 1) else r.get("dosya", r["no"]) for r in sk["kayitlar"]],
                                  "telefon": [str((r.get("hucreler") or {}).get("Telefon") or r.get("tel") or "").strip() for r in sk["kayitlar"]]})
            kimlik_sutun = [h for h in (sk.get("basliklar") or []) if tr_kucuk(h) in KISI_KIMLIK_BASLIK] if sk["tur"] == "serbest" else []
            for r in sk["kayitlar"]:
                no = r["no"]
                k = self.kayitlar.setdefault(no, {"sekmeler": [], "tur": sk["tur"], "isim": r["isim"], "items": [], "kalan": 0, "kimlikler": set(), "adlar": set(),
                                                  "kimliksiz_satir": False})
                if sk["ad"] not in k["sekmeler"]:
                    k["sekmeler"].append(sk["ad"])
                k["adlar"].add(r["isim"])
                satir_kimlik = False
                k.setdefault("ham_kimlik", set()).update(str((r.get("hucreler") or {}).get(h) or "").strip() for h in kimlik_sutun)
                for h in kimlik_sutun:  # C3: satırın kimliği (boş hücre kimliksiz)
                    v = str((r.get("hucreler") or {}).get(h) or "").strip()
                    if v and (kimlik_gecerli(v) or self.mut == 33):  # C3 kararı: sağlama hanesi tutmayan değer kimlik sayılmaz
                        k["kimlikler"].add(v)
                        satir_kimlik = True
                if not satir_kimlik:
                    k["kimliksiz_satir"] = True
                if sk["tur"] == "taksit":
                    k["items"] = [(t, kurus(v)) for t, v in r["taksitler"]]
                    k["kalan"] = sum(v for _, v in k["items"])
        if self.mut == 39:  # geçersiz değer anahtara girseydi: ham kimlik değerleri değişen kaydın tahsilatı kopardı
            for no, kay in self.kayitlar.items():
                if onceki_imza.get(no) is not None and onceki_imza[no] != kay.get("ham_kimlik"):
                    self.kayitTahsilat[no] = 0
        if eski_satir is not None:
            self.bag_surekliligi(a, eski_satir, eski_sekme, eski_kayit)

    def satir_listesi(self):
        """BAĞ SÜREKLİLİĞİ: yüklü tablonun satırları — sekme, sıra (konum), ref (kâhinin kayıt no'su), ad, kişi değeri (ad; varsa telefon ya da geçerli TCKN/VKN), borç."""
        out = []
        for sk in self.sekmeler:
            kim_sutun = [h for h in (sk.get("basliklar") or []) if tr_kucuk(h) in KISI_KIMLIK_BASLIK]
            for i, (no, c) in enumerate(sk["satirlar"]):
                ad = sk.get("adlar", [None] * (i + 1))[i]
                tel = (sk.get("telefon") or [""] * (i + 1))[i]
                kim = next((str((c or {}).get(h) or "").strip() for h in kim_sutun if kimlik_gecerli(str((c or {}).get(h) or "").strip())), "")
                b = self.satir_borcu(sk, c) if sk["tur"] == "serbest" and sk["basliklar"] is not None else None
                # NETLEŞTİRME (1): içerik = tabloya yazılan bütün hücreler (Dosya No, ad, öbür hücreler; boş hücre yok sayılır)
                dosya = (sk.get("dosyalar") or [None] * (i + 1))[i]
                icerik = (dosya, ad, tuple(sorted((k, str(v).strip()) for k, v in (c or {}).items() if str(v).strip())))
                out.append({"sekme": sk["ad"], "sira": i, "ref": no, "ad": ad, "kd": (ad, tel or kim or None), "borc": b, "icerik": icerik})
        return out

    def bag_surekliligi(self, a, eski, eski_sekme, eski_kayit):
        """TABLO BAĞ SÜREKLİLİĞİ (baş mimar kararı 23.10.2026): (1) Yerine koy / Devamı olarak ekle / Sheets eşitlemesi kayda bağlı veriyi (kayıt tahsilatı, not, düzeltme,
        "Ödendi say", cari bağı) SESSİZCE koparmaz. (2) Güvenli eşleşme varsa bağ yeni satıra taşınır: eski ve yeni satır aynı kişi değerini taşır ve o kişi değeri eski ve
        yeni tabloda TEK satırdadır — ya da AYNI KONUMDAKİ satır aynı kişi değerini taşır; tutar/vade değişse, kolon eklense, sıra değişse de bağ aynı kişide kalır. (3) Güvenli
        eşleşme yoksa önizlemede eşleşmeyen kayıtları ADIYLA söyleyen uyarı ve ONAY; eşleşmeyen bağlı veri silinmez (yeri kuralda yok → o adın denetimi yapılmaz). (4) Devamı
        olarak ekle mevcut kayıtlarla aynı kişi + aynı tutar görünen satırları önizlemede söyler ve onay ister. Denetimler `adim:<id>:onay`, `adim:<id>:uyariAdlari`."""
        if a.get("mod") == "devam":
            # NETLEŞTİRME 2 (karar sahibi 23.10.2026): Devamı olarak ekle'de (a) içeriği tamamen aynı satır mevcut kaydın KENDİSİdir; (b) GÜVENLİ EŞLEŞEN satır (aynı kişi
            # değeri + iki tabloda tek satır, ya da aynı konum + aynı kişi) mevcut kaydın GÜNCELLEMESİdir — ikinci kez eklenmez, bağları kendisinde, uyarı/onay yok; (c) "aynı
            # görünen satır" uyarısı + onay yalnız güvenli eşleşmeyen VE ikinci kez eklenecek (yeni kayıt açılacak) aynı kişi + aynı tutar satırı için; yeni kayıt açılır.
            yeni = self.satir_listesi()
            esles = {}  # yeni satırın ref'i → mevcut kaydın ref'i (aynı içerik ya da güncelleme)
            for y in yeni:
                if self.mut != 45 and any(e["icerik"] == y["icerik"] for e in eski):
                    esles[y["ref"]] = next(e for e in eski if e["icerik"] == y["icerik"])["ref"]
                    continue
                if self.mut == 46:
                    continue
                ae = [e for e in eski if e["kd"] == y["kd"]]
                ay = [z for z in yeni if z["kd"] == y["kd"]]
                if len(ae) == 1 and len(ay) == 1:
                    esles[y["ref"]] = ae[0]["ref"]
                    continue
                konum = next((e for e in eski if e["sekme"] == y["sekme"] and e["sira"] == y["sira"]), None)
                if konum and konum["kd"] == y["kd"] and konum["ref"] not in esles.values():
                    esles[y["ref"]] = konum["ref"]
            # güncelleme: mevcut kaydın satırı yeni satırın hücrelerini alır (borç yeni satırdan); yeni satır sekmeden çıkar, yeni kayıt açılmaz
            yeni_hucre = {}
            for sk in self.sekmeler:
                for no, c in sk["satirlar"]:
                    if no in esles:
                        yeni_hucre[esles[no]] = c
            for sk in eski_sekme:
                sk["satirlar"] = [(no, yeni_hucre.get(no, c)) for no, c in sk["satirlar"]]
            for sk in self.sekmeler:
                tut = [i for i, (no, _) in enumerate(sk["satirlar"]) if no not in esles]
                for alan in ("satirlar", "adlar", "telefon", "dosyalar"):
                    if alan in sk:
                        sk[alan] = [sk[alan][i] for i in tut]
            for no in esles:
                self.kayitlar.pop(no, None)
            eklenen = [y for y in yeni if y["ref"] not in esles]
            self.sekmeler = eski_sekme + self.sekmeler
            birlesik = dict(eski_kayit)
            for no, kay in self.kayitlar.items():
                if no in birlesik:
                    birlesik[no]["sekmeler"] = list(dict.fromkeys(birlesik[no]["sekmeler"] + kay["sekmeler"]))
                else:
                    birlesik[no] = kay
            self.kayitlar = birlesik
            cift = sorted({y["ad"] for y in eklenen if y["borc"] is not None and any(e["kd"] == y["kd"] and e["borc"] == y["borc"] for e in eski)})
            if self.mut == 43:
                cift = []
            self.d("adim:%s:onay" % a["id"], bool(cift), "KULLANICI", "bağ sürekliliği (4) + NETLEŞTİRME 2: yalnız ikinci kez eklenecek aynı kişi + aynı tutar satırında onay")
            self.d("adim:%s:uyariAdlari" % a["id"], cift, "KULLANICI", "bağ sürekliliği (4) + NETLEŞTİRME 2: önizleme ikinci kez eklenecek aynı görünen satırları adıyla söyler")
            return
        yeni = self.satir_listesi()
        tutanlar = sorted({no for no, v in self.kayitTahsilat.items() if v} | {c["kayit"] for c in self.cariler.values() if c.get("kayit")})
        eslesmeyen = []
        for h in tutanlar:
            er = next((e for e in eski if e["ref"] == h), None)
            if er is None:
                continue  # tablo dışı kayıt (ör. taksit kartı anahtarı) — bu kuralın konusu değil
            hedef = None
            ayni_icerik = [y for y in yeni if y["icerik"] == er["icerik"]] if self.mut not in (40, 44) else []
            if ayni_icerik:
                # NETLEŞTİRME (1): içeriği tamamen aynı satır mevcut kaydın kendisidir (yalnız yeri değişse de) — bağ yerinde, onay yok
                hedef = next((y for y in ayni_icerik if y["sekme"] == er["sekme"] and y["sira"] == er["sira"]), ayni_icerik[0])["ref"]
            elif self.mut != 40:
                ayni_eski = [e for e in eski if e["kd"] == er["kd"]]
                ayni_yeni = [y for y in yeni if y["kd"] == er["kd"]]
                if len(ayni_eski) == 1 and len(ayni_yeni) == 1:
                    hedef = ayni_yeni[0]["ref"]
                elif self.mut != 42:
                    konum = next((y for y in yeni if y["sekme"] == er["sekme"] and y["sira"] == er["sira"]), None)
                    if konum and konum["kd"] == er["kd"]:
                        hedef = konum["ref"]
            if hedef is not None:
                if hedef != h:
                    self.kayitTahsilat[hedef] += self.kayitTahsilat.pop(h, 0)
                for c in self.cariler.values():
                    if c.get("kayit") == h:
                        c["kayit"] = hedef
                continue
            eslesmeyen.append(er["ad"])
            self.kayitTahsilat.pop(h, None)  # eşleşmeyen bağlı veri silinmez ama hiçbir satırda değildir (yeri kuralda yok)
            for c in self.cariler.values():
                if c.get("kayit") == h:
                    c["kayit"] = None
            self.belirsiz_adlar.add(er["ad"])
        if self.mut == 40:
            eslesmeyen = []  # aday 16 davranışı: bağ sessizce kopar
        adlar = sorted(set(eslesmeyen))
        if self.mut == 41:
            adlar = []
        self.d("adim:%s:onay" % a["id"], bool(adlar), "KULLANICI", "bağ sürekliliği (3) güvenli eşleşme yoksa onay; hepsi güvenliyse onaysız")
        self.d("adim:%s:uyariAdlari" % a["id"], adlar, "KULLANICI", "bağ sürekliliği (3) önizleme eşleşmeyen kayıtları adıyla söyler")

    def cari_ac(self, a):
        self.cariler[a["ad"]] = {"tur": a.get("tur", "musteri"), "isim": a["isim"], "kayit": a.get("kayit"),
                                 "acilis": kurus(a["acilis"]) if a.get("acilis") else 0, "tckn": a.get("tckn")}

    # ───────────────────────── /2 B5: Nihai Tüketici carisi (U1)
    NT_AD = "Nihai Tüketici"
    NT_KIMLIK = "11111111111"

    def nt_uygun(self, ad):
        c = self.cariler.get(ad)
        return bool(c) and not c.get("silindi") and c.get("tckn") == self.NT_KIMLIK and c["isim"] == self.NT_AD

    def nihai_tuketici(self, a):
        """U1 ([KULLANICI] 22.10 21:41 UTC (b): "kendi işaretli carisi, adı belli caride 11111111111 uyarısı"; [AJAN] U1 metni): yalnız programın işaretli
        carisi kullanılır — silinmemiş, TCKN 11111111111, adı "Nihai Tüketici". İşaretli yoksa (ya da koşulu yitirdiyse) bu koşulları taşıyan EN ESKİ cari
        benimsenir, o da yoksa yeni açılır. Adı belli 11111111111'li cari ASLA seçilmez."""
        et = "KULLANICI"
        if self.nt_isaretli and (self.nt_uygun(self.nt_isaretli) or self.mut == 21):
            secilen, yeni = self.nt_isaretli, False
        else:
            if self.nt_isaretli:
                et = "AJAN"  # işaretlinin koşulu yitirmesi (ad/kimlik değişti, silindi) — ayrıntı [AJAN]
            if self.mut == 20:
                aday = [ad for ad, c in self.cariler.items() if not c.get("silindi") and c.get("tckn") == self.NT_KIMLIK]
            else:
                aday = [ad for ad in self.cariler if self.nt_uygun(ad)]
            if aday:
                secilen, yeni = aday[0], False
                et = "AJAN"  # en eskiyi benimseme [AJAN]
            else:
                self.nt_sayac += 1
                secilen, yeni = "@nt%d" % self.nt_sayac, True
                self.cariler[secilen] = {"tur": "musteri", "isim": self.NT_AD, "kayit": None, "acilis": 0, "tckn": self.NT_KIMLIK, "nt": True}
        self.nt_isaretli = secilen
        self.d("adim:%s:secilen" % a["id"], secilen, et, "B5 U1 Nihai Tüketici yalnız işaretli/uygun cari")
        self.d("adim:%s:olusturuldu" % a["id"], yeni, et, "B5 U1 uygun cari yoksa yeni açılır")
        return "ok"

    def kullanici_ac(self, a):
        """/2 B5b: Kasa'yı görme yetkisi kaldırılmış kullanıcı (rol + kaldırılan yetkiler)."""
        self.kullanicilar[a["ad"]] = {"rol": a.get("rol", "avukat"), "kaldir": a.get("kaldir", ["cash.view"])}
        return "ok"

    def cari_sil(self, a):
        if a["cari"] not in self.cariler:
            return ("ret", "YAYGIN")  # (yalnız mutasyonlu dünyada: cari hiç açılmadı)
        self.cariler[a["cari"]]["silindi"] = True
        return "ok"

    def cari_adlandir(self, a):
        if a["cari"] not in self.cariler:
            return ("ret", "YAYGIN")
        self.cariler[a["cari"]]["isim"] = a["isim"]
        if "tckn" in a:
            self.cariler[a["cari"]]["tckn"] = a["tckn"]
        return "ok"

    def tahsilat(self, a):
        f = a.get("fatura")
        self.tahsilatlar[a["id"]] = {"cari": a["cari"], "tutar": kurus(a["tutar"]), "tarih": a.get("tarih", self.bugun),
                                     "seq": self.yeni_seq(), "fatura": f, "kart": None, "aktif": True}
        if a.get("yol", "nakit") == "havale":
            self.mizanBilinir = False  # havalenin karşı hesabı (banka alt hesabı) bu kâhinde yok
            return "ok"
        self.kasa += kurus(a["tutar"])
        self.kasa_hareket.append((a.get("tarih", self.bugun), kurus(a["tutar"]), 0))
        return "ok"

    def kasa_cikis(self, a):
        """/2 B4: carisiz elle Kasa çıkışı (Kasa gideri). [YAYGIN TDHP; defter kâhini ile aynı] B 770 / A 100."""
        x = kurus(a["tutar"])
        self.kasa -= x
        if self.mut != 22:
            self.kasa_hareket.append((a.get("tarih", self.bugun), 0, x))
        self.kasa_gider = getattr(self, "kasa_gider", 0) + x
        return "ok"

    def borc(self, a):
        self.borclar[a["cari"]] += kurus(a["tutar"])
        self.mizanBilinir = False  # elle borç dekontunun karşı hesabı planda yok
        return "ok"

    def kart_tahsilat(self, a):
        kt = self.kartlar.get(a["kayit"])
        if not kt or not kt["aktif"]:
            return ("ret", "YAYGIN")  # kartı olmayan kayda kart tahsilatı girilemez
        tid = a["id"]
        self.tahsilatlar[tid] = {"cari": kt["cari"], "tutar": kurus(a["tutar"]), "tarih": a.get("tarih", self.bugun), "seq": self.yeni_seq(),
                                 "fatura": None, "kart": a["kayit"], "aktif": True, "dogrudanKart": True}
        kt["tasinan"].append(self.tahsilatlar[tid])
        self.kasa += kurus(a["tutar"])
        self.kasa_hareket.append((a.get("tarih", self.bugun), kurus(a["tutar"]), 0))
        return "ok"

    def kayit_tahsilat(self, a):
        n = len(self.kayitlar.get(a["kayit"], {}).get("sekmeler", [])) if self.mut == 5 else 1
        self.kayitTahsilat[a["kayit"]] += kurus(a["tutar"]) * max(1, n)
        self.kasa += kurus(a["tutar"])
        if self.mut != 19:
            self.kasa_hareket.append((a.get("tarih", self.bugun), kurus(a["tutar"]), 0))
        self.mizanBilinir = False
        return "ok"

    def aktar(self, a):
        hesap_ici = a.get("hesapIci", True)
        mevcut_borc = a.get("mevcutBorc", True)
        if a.get("araya"):
            # ön izlemeden sonra cariye tahsilat girildi: aktarım reddedilir, hiçbir kart açılmaz [AJAN A9]
            ara = dict(a["araya"], id=a["id"] + "-araya")
            self.tahsilat(ara)
            self.d("adim:%s:durum" % a["id"], "ret", "AJAN", "B1.9")
            return None
        sonuc = {"olusan": 0, "tasinanAdet": 0, "tasinanTutar": 0, "kapsanan": 0, "atlanan": 0}
        ak = {"kartlar": []}
        for no in a["kayitlar"]:
            k = self.kayitlar[no]
            if no in self.kartlar and self.kartlar[no]["aktif"]:
                continue  # zaten kartı var ("exists")
            cari = self.cari_bul_kayit(no)
            if cari is None:  # bağlı cari yoksa aktarım cariyi açar (2.4.3 yolu)
                cari = "@" + no
                self.cariler[cari] = {"tur": "musteri", "isim": k["isim"], "kayit": no, "acilis": 0, "ortuk": a["ad"]}
            K = k["kalan"]
            faturali = self.faturali(cari)
            # 5a: taksit dışı tahsilatlar, tarih sırasıyla, bütün olarak, kartın kalanı kadar; sığmayanda durulur
            tasinan, parca = [], 0
            if hesap_ici and not faturali:
                toplam = 0
                for t in self.taksit_disi(cari):
                    if toplam + t["tutar"] <= K:
                        tasinan.append(t)
                        toplam += t["tutar"]
                        continue
                    if self.mut == 1 and toplam < K:
                        parca = K - toplam
                        toplam = K
                    if self.mut == 2:
                        continue
                    if any(x["tutar"] + toplam <= K for x in self.taksit_disi(cari) if x not in tasinan and x is not t):
                        self.etiketCari[cari].add("5a-sonraki-kucuk")
                    break
            tas_tutar = sum(t["tutar"] for t in tasinan) + parca
            # 5b: carinin borcu (taşınan tahsilatlar geri eklenerek) kalanı karşılıyorsa mevcut borç; azsa aktarılmaz
            mevcut = False
            if mevcut_borc and not faturali:
                D = self.bakiye(cari) + (0 if self.mut == 3 else tas_tutar)
                if (self.bakiye(cari) >= K) != (D >= K) or (0 < self.bakiye(cari) < K) != (0 < D < K):
                    self.etiketCari[cari].add("5b-D-tanimi")
                if D >= K:
                    mevcut = True
                elif D > 0 and self.mut != 4:
                    sonuc["atlanan"] += 1
                    continue
                elif D <= 0:
                    self.etiketCari[cari].add("5b-borc-yok")
            for t in tasinan:
                t["kart"] = no
            if parca:
                self.tahsilatlar["@parca-" + no] = {"cari": cari, "tutar": parca, "tarih": self.bugun, "seq": self.yeni_seq(),
                                                    "fatura": None, "kart": no, "aktif": True, "parcaKaynak": True}
                # parçalanan tahsilatın kendisi parçası kadar küçülür
                for t in self.taksit_disi(cari):
                    t["tutar"] -= parca
                    self.tahsilatlar["@parca-" + no]["tutar"] = parca
                    break
            if self.mut == 11:
                self.kasa -= tas_tutar
            self.kartlar[no] = {"cari": cari, "toplam": K, "mevcut": mevcut, "tasinan": [t for t in tasinan], "aktif": True,
                                "parca": parca}
            ak["kartlar"].append(no)
            sonuc["olusan"] += 1
            sonuc["tasinanAdet"] += len(tasinan) + (1 if parca else 0)
            sonuc["tasinanTutar"] += tas_tutar
            sonuc["kapsanan"] += 1 if mevcut else 0
            self.mizanBilinir = False
        self.aktarimlar[a["ad"]] = ak
        return sonuc

    def geri_al(self, a):
        for ad in [c for c, v in self.cariler.items() if v.get("ortuk") == a["aktar"]]:
            self.cariler[ad]["silindi"] = True  # aktarımın açtığı cari geri almayla kalkar [YAYGIN]
        for no in self.aktarimlar[a["aktar"]]["kartlar"]:
            k = self.kartlar[no]
            k["aktif"] = False
            for t in k["tasinan"]:
                t["kart"] = None
                if self.mut == 10:
                    t["aktif"] = False
            if k.get("parca"):
                self.tahsilatlar["@parca-" + no]["kart"] = None
        return "ok"

    def fatura(self, a):
        tur = a.get("tur", "satis")
        taslak = a.get("taslak", False)
        self.faturalar[a["ad"]] = {"cari": a["cari"], "tutar": kurus(a["tutar"]), "tarih": a.get("tarih", self.bugun),
                                   "seq": self.yeni_seq(), "tur": tur, "durum": "taslak" if taslak else "kesildi",
                                   "taksitli": bool(a.get("taksit")), "asil": a.get("asil")}
        if a.get("evrak"):
            e = a["evrak"]
            self.evraklar[e["ad"]] = {"cari": a["cari"], "tur": e.get("tur", "cek"), "tutar": kurus(e["tutar"]),
                                      "tarih": a.get("tarih", self.bugun), "seq": self.yeni_seq(), "fatura": a["ad"],
                                      "durum": "portfoy", "ciroCari": None, "kendi": True}
        return "ok"

    def iade(self, a):
        asil = self.faturalar[a["fatura"]]
        self.faturalar[a["ad"]] = {"cari": asil["cari"], "tutar": asil["tutar"], "tarih": a.get("tarih", self.bugun),
                                   "seq": self.yeni_seq(), "tur": "iade", "durum": "kesildi", "taksitli": False, "asil": a["fatura"]}
        self.etiketCari[asil["cari"]].add("iade")
        return "ok"

    def evrak_ret(self, a):
        """UX18: bağ kurulamayan durumlar (ret ve kod) ya da None."""
        f = a.get("fatura")
        if not f:
            return None
        if not a.get("cari"):
            return ("ret", 400, "AJAN")           # carisiz evrak faturaya bağlanmaz
        F = self.faturalar[f]
        if F["cari"] != a["cari"]:
            return ("ret", 404, "KULLANICI")      # başka cari
        if F["durum"] == "taslak" or F["durum"] == "iptal":
            return ("ret", 409, "AJAN")
        if F["tur"] != "satis":
            return ("ret", 409, "KULLANICI")      # ters yön / iade belgesi
        if F["taksitli"]:
            return ("ret", 409, "KULLANICI")      # taksitli faturaya bağ yok
        return None

    def evrak(self, a):
        ret = self.evrak_ret(a)
        if ret:
            self.d("adim:%s:http" % a["id"], ret[1], "AJAN", "B2.4")
            return ("ret", ret[2])
        f = a.get("fatura")
        if f and self.faturalar[f]["tutar"] < kurus(a["tutar"]):
            self.etiketCari[a["cari"]].add("ux18-fazla")
        self.evraklar[a["ad"]] = {"cari": a["cari"], "tur": a.get("tur", "cek"), "tutar": kurus(a["tutar"]),
                                  "tarih": a.get("tarih", self.bugun), "seq": self.yeni_seq(), "fatura": f,
                                  "durum": "portfoy", "ciroCari": None, "kendi": False}
        return "ok"

    def karsiliksiz(self, a):
        e = self.evraklar[a["evrak"]]
        if e["durum"] != "portfoy":
            return ("ret", "PLAN")
        e["durum"] = "karsiliksiz"
        if not e["fatura"] or self.faturalar[e["fatura"]]["durum"] != "kesildi":
            # bağsız evrakın en eski kapamayla kapattığı faturaların yeniden açılması kullanıcı kararında açıkça yok (karar: bağlı,
            # kendi evrakı, faturayla ciro); kâhin değişmez Σ açık = cari bakiye [AJAN] ile açar → İNCELE
            self.etiketCari[e["cari"]].add("bagsiz-karsiliksiz")
        return "ok"

    def tahsil(self, a):
        e = self.evraklar[a["evrak"]]
        if e["durum"] != "portfoy":
            return ("ret", "PLAN")
        e["durum"] = "tahsil"
        self.kasa += e["tutar"]
        if self.mut != 19:
            self.kasa_hareket.append((a.get("tarih", self.bugun), e["tutar"], 0))
        return "ok"

    def ciro(self, a):
        e = self.evraklar[a["evrak"]]
        if e["durum"] != "portfoy":
            return ("ret", "PLAN")
        e["durum"] = "ciro"
        e["ciroCari"] = a["cari"]
        return "ok"

    def evrak_sil(self, a):
        e = self.evraklar[a["evrak"]]
        e["silinmedenOnce"] = e["durum"]
        e["durum"] = "silindi"
        return "ok"

    def evrak_geri_yukle(self, a):
        e = self.evraklar[a["evrak"]]
        e["durum"] = e.pop("silinmedenOnce")
        self.etiketCari[e["cari"]].add("geri-yukle")
        return "ok"

    def bag_degistir(self, a):
        e = self.evraklar[a["evrak"]]
        yeni = a.get("fatura") or None
        if e["kendi"]:
            return ("ret", "YAYGIN")  # faturanın kendi (peşin) evrakı faturanın parçasıdır; bağı değiştirilemez
        if yeni:
            ret = self.evrak_ret({"fatura": yeni, "cari": e["cari"]})
            if ret:
                self.d("adim:%s:http" % a["id"], ret[1], "AJAN", "B2.4")
                return ("ret", ret[2])
        e["fatura"] = yeni
        self.etiketCari[e["cari"]].add("bag-degisti")
        return "ok"

    def fatura_iptal(self, a):
        f = self.faturalar[a["fatura"]]
        kendi = [e for e in self.evraklar.values() if e["kendi"] and e["fatura"] == a["fatura"] and e["durum"] != "silindi"]
        if any(e["durum"] != "portfoy" for e in kendi):
            return ("ret", "YAYGIN")  # faturayla alınan evrak işlem görmüşse önce o geri alınır
        for e in kendi:
            e["durum"] = "silindi"  # faturanın kendi evrakı faturayla birlikte kalkar [YAYGIN]
            self.etiketCari[f["cari"]].add("kendi-evrak-iptal")
        f["durum"] = "iptal"
        if any(e["fatura"] == a["fatura"] and e["durum"] != "silindi" for e in self.evraklar.values()):
            self.etiketCari[f["cari"]].add("iptal-bag-duser")
        return "ok"

    # ───────────────────────── kontrol
    def kontrol(self, a):
        k = a["id"]
        for ad, c in self.cariler.items():
            if c.get("ortuk"):
                self.d("%s:cari:%s:var" % (k, ad), not c.get("silindi"), "YAYGIN", "B1.6 aktarımın açtığı cari geri almayla kalkar")
                if c.get("silindi"):
                    continue
            elif c.get("silindi"):
                self.d("%s:cari:%s:var" % (k, ad), False, "PLAN", "silinen cari listede yok")
                continue
            self.d("%s:cari:%s:bakiye" % (k, ad), self.bakiye(ad), "YAYGIN" if "5b-borc-yok" in self.etiketCari[ad] else "PLAN",
                   "B1.1/B2.7 bakiye = borçlar − alacaklar")
            if c.get("kayit") is not None:
                self.d("%s:cari:%s:taksitDisi" % (k, ad), sum(t["tutar"] for t in self.taksit_disi(ad)),
                       "AJAN" if self.etiketCari[ad] & {"5a-sonraki-kucuk"} else "KULLANICI", "B1.2 taksit dışı kalan tahsilatlar")
            acik = self.aciklar(ad)
            ajan = self.etiketCari[ad] & {"ux18-fazla", "iptal-bag-duser", "geri-yukle", "bag-degisti", "iade", "kendi-evrak-iptal", "bagsiz-karsiliksiz"}
            for fad, v in acik.items():
                self.d("%s:fatura:%s:acik" % (k, fad), v, "AJAN" if ajan else "KULLANICI",
                       "B2.1 açık = tutar − bağlı − en eski kapama" + (" (ajan ayrıntısı: %s)" % ",".join(sorted(ajan)) if ajan else ""))
            for fad, f in self.faturalar.items():
                if f["cari"] == ad and f["durum"] == "iptal":
                    self.d("%s:fatura:%s:durum" % (k, fad), "iptal", "PLAN", "B2.5 iptal")
        for no, kt in self.kartlar.items():
            if not kt["aktif"]:
                self.d("%s:kart:%s:var" % (k, no), False, "KULLANICI", "B1.6 geri al kartı kaldırır")
                continue
            bay = self.etiketCari[kt["cari"]]
            et = "AJAN" if "5a-sonraki-kucuk" in bay else "KULLANICI"          # 5a (taşıma) denetimleri
            et_b = "YAYGIN" if "5b-borc-yok" in bay else ("AJAN" if "5b-D-tanimi" in bay else "KULLANICI")  # 5b (kart/borç)
            odenen = sum(t["tutar"] for t in kt["tasinan"]) + kt.get("parca", 0)
            self.d("%s:kart:%s:var" % (k, no), True, et_b, "B1.3 kart açıldı")
            self.d("%s:kart:%s:toplam" % (k, no), kt["toplam"], et_b, "B1.3 kart tutarı = tablodaki kalan")
            self.d("%s:kart:%s:odenen" % (k, no), odenen, et, "B1.2 taşınan tahsilatlar karta")
            self.d("%s:kart:%s:kalan" % (k, no), kt["toplam"] - odenen, et, "B1.2")
            self.d("%s:kart:%s:mevcutBorc" % (k, no), kt["mevcut"], et_b, "B1.4 mevcut borcu taksitlendir")
            items = self.kayitlar[no]["items"]
            kalan = odenen
            sirali = list(range(len(items)))
            if self.mut == 12:
                sirali = list(reversed(sirali))
            pay = [0] * len(items)
            for i in sirali:
                d = min(items[i][1], kalan)
                pay[i] = d
                kalan -= d
            for i, v in enumerate(pay):
                self.d("%s:kart:%s:taksit%d:odenen" % (k, no, i + 1), v, et, "B1.2 en eski açık taksitten başlayarak")
        self.d("%s:kasa" % k, self.kasa, "KULLANICI", "B1.2 Kasa değişmez / tahsilatlar Kasa'da")
        if self.mizanBilinir:
            m = defaultdict(int)
            for c in self.cariler.values():
                if c["acilis"]:
                    m["120" if c["tur"] == "musteri" else "320"] += c["acilis"]
                    m["500"] -= c["acilis"]  # açılış fişi karşı hesabı 500 Sermaye [YAYGIN TDHP; defter kâhini ile aynı]
            for f in self.faturalar.values():
                if f["durum"] != "kesildi":
                    continue
                if f["tur"] == "satis":
                    m["120"] += f["tutar"]
                    m["600"] -= f["tutar"]
                elif f["tur"] == "iade":
                    m["610"] += f["tutar"]
                    m["120"] -= f["tutar"]
                elif f["tur"] == "alis":
                    m["770"] += f["tutar"]
                    m["320"] -= f["tutar"]
            for t in self.tahsilatlar.values():
                if t["aktif"]:
                    m["100"] += t["tutar"]
                    m["120"] -= t["tutar"]
            if getattr(self, "kasa_gider", 0):
                m["770"] += self.kasa_gider
                m["100"] -= self.kasa_gider
            for e in self.evraklar.values():
                if e["durum"] == "silindi":
                    continue
                h = "121" if e["tur"] == "senet" and self.mut != 13 else "101"
                m[h] += e["tutar"]
                m["120"] -= e["tutar"]
                if e["durum"] == "karsiliksiz":
                    m["120"] += e["tutar"]
                    m[h] -= e["tutar"]
                elif e["durum"] == "tahsil":
                    m["100"] += e["tutar"]
                    m[h] -= e["tutar"]
                elif e["durum"] == "ciro":
                    m["320"] += e["tutar"]
                    m[h] -= e["tutar"]
            for kod in sorted(set(m) | {"100", "101", "120", "121", "320", "600"}):
                self.d("%s:mizan:%s" % (k, kod), m.get(kod, 0), "PLAN", "B2.6 §3.11a yevmiye")
        # 5c: Tablodaki Kişiler — bir dosya no'nun tahsilatı bir kez (kayıt tahsilatı + bağlı carinin bütün tahsilatları, kartta olanlar dahil)
        kisiler_a = self.kisiler()
        for no, kay in self.kayitlar.items():
            if kay["isim"] in self.belirsiz_adlar:
                continue  # bağ sürekliliği (3)/(4): eşleşmeyen bağlı verinin yeri kuralda yok
            cari = self.cari_bul_kayit(no)
            alacak = self.kayitTahsilat.get(no, 0)
            if cari is None and no in kisiler_a:
                if kisiler_a[no] is None:
                    continue  # C3 tanımsız kişi — denetlenmez
                alacak = sum(self.kayitTahsilat.get(n, 0) for n, x in kisiler_a.items() if x == kisiler_a[no])  # C3: rapor satırı kişidir
            dogrudan = False
            if cari:
                alacak += sum(t["tutar"] for t in self.tahsilatlar.values() if t["aktif"] and t["cari"] == cari)
                dogrudan = any(t.get("dogrudanKart") for t in self.tahsilatlar.values() if t["aktif"] and t["cari"] == cari)
            if alacak or len(kay["sekmeler"]) > 1:
                ayni_ad = sum(1 for x in self.kayitlar.values() if x["isim"] == kay["isim"]) > 1
                self.d("%s:rapor:%s:alacak" % (k, no), alacak, "YAYGIN" if ayni_ad or dogrudan else "KULLANICI",
                       "B1.8 5c tahsilat bir kez" + (" (aynı adlı iki kişi ayrı satırda: YAYGIN)" if ayni_ad else ""))
        # /2 B3 (K1–K3 [KULLANICI] 23.10 03:12 UTC): Tablodaki Kişiler borcu — yalnız carisi ve kartı olmayan kayıt (bağlı carinin borç satırları bu kâhinde yok)
        k4_toplam, k4_tanimli = 0, True
        kisiler = self.kisiler()
        for no in self.kayitlar:
            if self.cari_bul_kayit(no) is not None or (no in self.kartlar and self.kartlar[no]["aktif"]):
                k4_tanimli = False
                continue
            if self.kayitlar[no]["isim"] in self.belirsiz_adlar:
                k4_tanimli = False
                continue
            b = self.tablo_borcu(no)
            if b is None:
                k4_tanimli = False
                if self.kayitlar[no]["tur"] == "serbest":
                    # karar A: borç sütunu belirlenemiyorsa kişiler raporda notsuz kaybolmaz — satır görünür ya da raporda görünür not (sekme adı / "borç sütunu")
                    self.d("%s:rapor:%s:gorunurVeyaNot" % (k, no), self.mut != 37, "KULLANICI", "karar A: borç sütunu belirlenemeyen kişi notsuz kaybolmaz")
                continue
            # C3: rapor satırı KİŞİdir — dosya no'nun okunan borcu kişisinin (aynı kişiye düşen bütün dosya no'ların) toplamıdır
            kisi = kisiler.get(no)
            if kisi is None:
                k4_toplam += b
                continue
            uyeler = [n for n, x in kisiler.items() if x == kisi]
            bs = [self.tablo_borcu(n) for n in uyeler]
            if all(v is not None for v in bs):
                yaygin = any(sk["basliklar"] and any(sutun_sinifi(h) == "genel" for h in sk["basliklar"]) and any(sutun_sinifi(h) == "odenen" for h in sk["basliklar"])
                             and any(n2 in uyeler for n2, _ in sk["satirlar"]) for sk in self.sekmeler)
                self.d("%s:rapor:%s:borc" % (k, no), sum(bs), "YAYGIN" if yaygin else "KULLANICI",
                       "B3 K1 satır başına (aynı sekme ayrı borç) · K2 (04:09) farklı sekme de ayrı borç · K3 satır borcu · C3 kişi toplamı"
                       + (" · karar A Genel Toplam − ödenen (hangi toplam: YAYGIN)" if yaygin else ""))
                if b > 0:
                    self.d("%s:rapor:%s:grup" % (k, no), sorted(n for n, v in zip(uyeler, bs) if v > 0), "KULLANICI",
                           "C3 kişi gruplaması: farklı ad aynı kimlik ayrı kişi; aynı ad farklı kimlik ayrı; kimliksiz aynı adın tek kimliğine katılır")
                    if self.ad_cok_kimlikli(self.kayitlar[no]["isim"]):
                        kay = self.kayitlar[no]
                        kim = next(iter(kay["kimlikler"])) if kay["kimlikler"] else ""  # kimliksiz grup: etikette kimlik yok
                        self.d("%s:rapor:%s:etiketKimlik" % (k, no), "" if self.mut == 31 else kim, "KULLANICI", "C3 aynı adı paylaşan kişinin etiketinde kimlik")
            k4_toplam += b
        not_n = None
        if self.kayitlar:
            n = self.cok_sekme_sayisi()
            if self.mut == 26:
                n = [0]
            not_n = n[0] if len(n) == 1 else {"catal": n}
            self.d("%s:rapor:cokSekmeNotu" % k, not_n, "KULLANICI", "B3 K2 (04:09) Tablodaki Kişiler 'N dosya no birden çok sekmede; ayrı sayıldı' notu (0 = not yok)")
        # /2 B4b (K4 [KULLANICI]): Tablodaki Kişiler, Tahsilat Takvimi, Vade Takip, Nakit Akışı Beklenen aynı satır borcu, aynı toplam (kontrol adımında "raporlar")
        if a.get("raporlar") and k4_tanimli:
            for anahtar in ("k4:kisiler", "k4:takvim", "k4:vade", "k4:akis"):
                self.d("%s:%s" % (k, anahtar), k4_toplam, "KULLANICI", "B4b K4 dört rapor aynı satır borcunu kullanır (dönem süzgeci içinde)")
            if not_n is not None:
                # K2 (04:09): not Tahsilat Takvimi'nde de çıkar — yalnız bütün satırların vadesi takvim penceresindeyken (K4 koşulu) denetlenir
                self.d("%s:takvim:cokSekmeNotu" % k, not_n, "KULLANICI", "B3 K2 (04:09) Tahsilat Takvimi 'N dosya no birden çok sekmede; ayrı sayıldı' notu (0 = not yok)")
        # /2 B5b (K5 [KULLANICI] Y1): Kasa'yı görme yetkisi olmayan kullanıcı Nakit Akışı'nda Kasa giriş/çıkışını görmez (boş/gizli + not)
        for ad in self.kullanicilar:
            self.d("%s:yetkisiz:%s:kasa" % (k, ad), "gorunur" if self.mut == 27 else "gizli", "KULLANICI", "B5b K5 Kasa giriş/çıkışı gizli")
            self.d("%s:yetkisiz:%s:not" % (k, ad), self.mut != 27, "KULLANICI", "B5b K5 gizlilik notu")
        # /2 B4 (MM6 [KULLANICI] 22.10 21:27 UTC "Nakit Akışı Kasa giriş bütün nakit hareketleri"): yıl başından bugüne Kasa giriş/çıkış
        bas = self.bugun[:4] + "-01-01"
        giris = sum(g for t, g, _ in self.kasa_hareket if bas <= t <= self.bugun)
        cikis = sum(c for t, _, c in self.kasa_hareket if bas <= t <= self.bugun)
        for anahtar, v in (("nakit:kasaGiris", giris), ("nakit:kasaCikis", cikis), ("kasaRapor:giris", giris), ("kasaRapor:cikis", cikis)):
            self.d("%s:%s" % (k, anahtar), v, "KULLANICI", "B4 MM6 Nakit Akışı Kasa = Kasa raporu (yalnız nakit, bütün kaynaklar)")
        if self.kayitlar:
            self.d("%s:rapor:tutarli" % k, True, "KULLANICI", "B1.8 ders 11 toplam = satırlar")
            for no, kay in self.kayitlar.items():
                if ("%s:rapor:%s:alacak" % (k, no)) in self.out and self.out["%s:rapor:%s:alacak" % (k, no)]["b"] and not self.ad_cok_kimlikli(kay["isim"]):
                    self.d("%s:rapor:%s:ad" % (k, no), kay["isim"], "YAYGIN", "B1.8b Tablodaki Kişiler kişiyi adıyla gösterir")

    # ───────────────────────── sürücü
    def kos(self):
        for a in self.s["adimlar"]:
            islem = a["islem"]
            if islem == "kontrol":
                self.kontrol(a)
                continue
            fn = getattr(self, islem)
            sonuc = fn(a)
            if islem == "tablo_yukle" or islem == "cari_ac":
                self.d("adim:%s:durum" % a["id"], "ok", "PLAN", "adım kabul edilir")
                continue
            if islem == "aktar":
                if sonuc is None:
                    continue
                self.d("adim:%s:durum" % a["id"], "ok", "KULLANICI", "B1 aktarım")
                cari_et = "AJAN" if any(self.etiketCari[c] & {"5a-sonraki-kucuk", "5b-D-tanimi"} for c in self.cariler) else "KULLANICI"
                for alan in ("olusan", "tasinanAdet", "tasinanTutar", "kapsanan", "atlanan"):
                    self.d("adim:%s:%s" % (a["id"], alan), sonuc[alan], cari_et, "B1 aktarım özeti")
                continue
            if isinstance(sonuc, tuple):
                self.d("adim:%s:durum" % a["id"], "ret", sonuc[1], "B2.4 bağ kurulamaz → ret, hiçbir satır yazılmaz")
            else:
                self.d("adim:%s:durum" % a["id"], "ok", "PLAN", "adım kabul edilir")
        return {"ad": self.s["ad"], "dil": DIL, "denetimler": dict(sorted(self.out.items())), "belirsiz": self.belirsiz}


def main(argv):
    if len(argv) < 2:
        sys.stderr.write(__doc__)
        return 2
    mut = 0
    if "--mutasyon" in argv:
        mut = int(argv[argv.index("--mutasyon") + 1])
    if "--mutasyonlar" in argv:
        sys.stdout.write(json.dumps(MUTASYONLAR, ensure_ascii=False, indent=2) + "\n")
        return 0
    with open(argv[1], encoding="utf-8") as f:
        senaryo = json.load(f)
    sys.stdout.write(json.dumps(Model(senaryo, mut).kos(), ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
