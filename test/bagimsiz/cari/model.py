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
    14: "U2: Kalan/Bakiye önceliği yok (borç başlıklı sütun önce)",
    15: "U2: söz tutarı borç sayılır",
    16: "E3: gün/adet sütunu tutar sayılır",
    17: "E2: Kalan boşsa borç 0 (Toplam Borç'a düşmez)",
    18: "U2: aynı dosya no her sekmede ayrı borç (çift sayım)",
    19: "MM6: Nakit Akışı Kasa girişi yalnız cari tahsilatı sayar (evrak tahsili ve kayıt tahsilatı dışarıda)",
    20: "U1: Nihai Tüketici 11111111111'li en eski cariyi (adı belli olsa da) seçer",
    21: "U1: işaretli cari adı/kimliği değişse de kullanılır",
}


def kurus(metin):
    s = str(metin).strip()
    if "," in s:
        tam, ond = s.split(",", 1)
        ond = (ond + "00")[:2]
    else:
        tam, ond = s, "00"
    return int(tam) * 100 + int(ond)


# ───────────────────────── /2 B3: Tablodaki Kişiler borç sütunu (U2/E2/E3) — başlık sınıflaması kuraldan
KIMLIK_BASLIK = {"dosya no", "borçlu", "telefon", "müşteri no", "müşteri", "ad soyad"}
TUTAR_DISI = {"gün", "adet", "sayı", "sayısı", "ay", "yıl", "oran", "oranı", "yüzde", "tarih", "tarihi"}  # E3 [AJAN]; "tarih": tutar değil [YAYGIN]
SOZ_KOK = ("söz", "taahhüt")  # U2 [AJAN]: başlıkta "söz", "sözü", "taahhüt"


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


def sutun_sinifi(baslik):
    """None: tutar değil (gün/adet/sayı/ay/yıl/oran/yüzde/% — E3; tarih); "soz": ödeme sözü (borç dışı — U2); 1 Kalan/Bakiye; 2 borç/alacak başlıklı; 3 sıradan tutar."""
    w = kelimeler(baslik)
    if "%" in str(baslik) or any(x in TUTAR_DISI for x in w):
        return None
    if any(x.startswith(SOZ_KOK) for x in w):
        return "soz"
    if "kalan" in w or "bakiye" in w:
        return 1
    if any(x.startswith(("borç", "alacak")) for x in w):
        return 2
    return 3


def hucre_kurus(metin):
    """Tablo hücresi ("6.000,00 ₺", "8000", "") → kuruş; boş → None."""
    t = str(metin if metin is not None else "").replace("₺", "").replace("TL", "").replace(" ", "").strip()
    if not t:
        return None
    t = t.replace(".", "")
    return kurus(t)


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
        self.sekmeler = []         # /2 B3: yüklenen tablonun sekmeleri (sırasıyla), borç sütunu önceliği için
        self.nt_isaretli = None    # /2 B5: programın işaretli Nihai Tüketici carisi (takma ad)
        self.nt_sayac = 0
        self.mizanBilinir = True
        self.etiketCari = defaultdict(set)   # cari -> açık/kart denetiminin etiketini AJAN'a düşüren nedenler
        self.out = {}
        self.belirsiz = []

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

    def tablo_borcu(self, no):
        """/2 B3 (U2 daraltılmış + E2 + E3): dosya no'nun Tablodaki Kişiler borcu. Döner (kuruş, etiket) ya da None (kural tanımsız → denetlenmez).
        Sütun önceliği Kalan/Bakiye → borç/alacak başlıklı → sekmenin TEK tutar sütunu; tek tutar sütunu ödeme sözüyse borç dışı; gün/adet/… tutar değil;
        Kalan 0 → 0; Kalan boş → Toplam Borç (borç başlıklı); aynı dosya no birden çok sekmede bir kez: en yüksek öncelik, eşitse ilk sekme."""
        adaylar, ajan = [], False
        for si, sk in enumerate(self.sekmeler):
            if no not in sk["satir"]:
                continue
            if sk["basliklar"] is None:
                return None  # taksit sekmesi: kart/taksit sütunlarının borç kuralı bu kâhinde yok
            hucre = sk["satir"][no]
            sinif = [(h, sutun_sinifi(h)) for h in sk["basliklar"] if tr_kucuk(h) not in KIMLIK_BASLIK]
            tutar = [(h, c) for h, c in sinif if c is not None]
            if any(c is None and not ({"tarih", "tarihi"} & set(kelimeler(h))) for h, c in sinif):
                ajan = True  # E3 (gün/adet/… sütunu tutar değil) bu sekmede rol oynuyor — ayrıntı [AJAN]
            secilen = None
            p1 = [h for h, c in tutar if c == 1]
            p2 = [h for h, c in tutar if c == 2]
            if self.mut == 14:
                p1, p2 = p2, p1
            if len(p1) > 1 or len(p2) > 1:
                return None  # birden çok Kalan ya da borç sütunu: kural hangisi olduğunu söylemiyor
            if p1:
                v = hucre_kurus(hucre.get(p1[0]))
                if v is not None:
                    secilen = (1, v)
                elif self.mut == 17:
                    secilen = (1, 0)
                else:
                    ajan = True  # E2: Kalan boş → Toplam Borç
            if secilen is None and p2:
                v = hucre_kurus(hucre.get(p2[0]))
                if v is not None:
                    secilen = (2, v)
            if secilen is None and not p1 and not p2:
                tek = tutar if self.mut != 16 else [(h, 3 if c is None else c) for h, c in sinif]
                if len(tek) == 1:
                    if tek[0][1] == "soz" and self.mut != 15:
                        secilen = None  # U2: tek tutar sütunu ödeme sözü → borç dışı
                    else:
                        v = hucre_kurus(hucre.get(tek[0][0]))
                        if v is not None:
                            secilen = (3, v)
                            ajan = True  # tek tutar sütunu borçtur (U2 daraltıldı, [AJAN])
                elif len(tek) > 1 and not all(c == "soz" for _, c in tek):
                    return None  # öncelikli sütun yok, birden çok tutar sütunu: kural tanımsız
            if secilen is not None:
                adaylar.append((secilen[0], si, secilen[1]))
        if not adaylar:
            return (0, "KULLANICI")
        if len(adaylar) > 1:
            ajan = ajan or len({p for p, _, _ in adaylar}) == 1  # "aynı öncelikte ilk sekme" [AJAN]
        if self.mut == 18:
            return (sum(v for _, _, v in adaylar), "KULLANICI")
        p, _, v = min(adaylar)
        return (v, "AJAN" if ajan or p != 1 else "KULLANICI")

    # ───────────────────────── işlemler
    def tablo_yukle(self, a):
        self.kayitlar = {}
        self.sekmeler = []
        for sk in a["sekmeler"]:
            # /2 B3: sekmenin başlıkları ve hücreleri (koşucunun tabloMatrisi ile aynı düzen; kâhin hücre metninden okur)
            if sk["tur"] == "icra":
                bas = ["Dosya No", "Borçlu", "Telefon", "Alacak Tutarı", "Kalan"]
                satir = {r["no"]: {"Alacak Tutarı": r["alacak"], "Kalan": r["kalan"]} for r in sk["kayitlar"]}
            elif sk["tur"] == "soz":
                bas = ["Dosya No", "Borçlu", "Söz Tarihi", "Söz Tutarı"]
                satir = {r["no"]: {"Söz Tutarı": r["tutar"]} for r in sk["kayitlar"]}
            elif sk["tur"] == "serbest":
                bas = ["Dosya No", "Borçlu"] + list(sk["basliklar"])
                satir = {r["no"]: dict(r.get("hucreler", {})) for r in sk["kayitlar"]}
            else:
                bas, satir = None, {r["no"]: None for r in sk["kayitlar"]}
            self.sekmeler.append({"ad": sk["ad"], "tur": sk["tur"], "basliklar": bas, "satir": satir})
            for r in sk["kayitlar"]:
                no = r["no"]
                k = self.kayitlar.setdefault(no, {"sekmeler": [], "tur": sk["tur"], "isim": r["isim"], "items": [], "kalan": 0})
                k["sekmeler"].append(sk["ad"])
                if sk["tur"] == "taksit":
                    k["items"] = [(t, kurus(v)) for t, v in r["taksitler"]]
                    k["kalan"] = sum(v for _, v in k["items"])

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
        for no, kay in self.kayitlar.items():
            cari = self.cari_bul_kayit(no)
            alacak = self.kayitTahsilat.get(no, 0)
            dogrudan = False
            if cari:
                alacak += sum(t["tutar"] for t in self.tahsilatlar.values() if t["aktif"] and t["cari"] == cari)
                dogrudan = any(t.get("dogrudanKart") for t in self.tahsilatlar.values() if t["aktif"] and t["cari"] == cari)
            if alacak or len(kay["sekmeler"]) > 1:
                ayni_ad = sum(1 for x in self.kayitlar.values() if x["isim"] == kay["isim"]) > 1
                self.d("%s:rapor:%s:alacak" % (k, no), alacak, "YAYGIN" if ayni_ad or dogrudan else "KULLANICI",
                       "B1.8 5c tahsilat bir kez" + (" (aynı adlı iki kişi ayrı satırda: YAYGIN)" if ayni_ad else ""))
        # /2 B3: Tablodaki Kişiler borcu — yalnız carisi ve kartı olmayan kayıt (bağlı carinin borç satırları bu kâhinin kuralında yok)
        for no in self.kayitlar:
            if self.cari_bul_kayit(no) is not None or (no in self.kartlar and self.kartlar[no]["aktif"]):
                continue
            b = self.tablo_borcu(no)
            if b is not None:
                self.d("%s:rapor:%s:borc" % (k, no), b[0], b[1], "B3 U2/E2/E3 dosya no başına tek kaynak (Kalan → borç başlıklı → tek tutar; söz borç dışı)")
        # /2 B4 (MM6 [KULLANICI] 22.10 21:27 UTC "Nakit Akışı Kasa giriş bütün nakit hareketleri"): yıl başından bugüne Kasa giriş/çıkış
        bas = self.bugun[:4] + "-01-01"
        giris = sum(g for t, g, _ in self.kasa_hareket if bas <= t <= self.bugun)
        cikis = sum(c for t, _, c in self.kasa_hareket if bas <= t <= self.bugun)
        for anahtar, v in (("nakit:kasaGiris", giris), ("nakit:kasaCikis", cikis), ("kasaRapor:giris", giris), ("kasaRapor:cikis", cikis)):
            self.d("%s:%s" % (k, anahtar), v, "KULLANICI", "B4 MM6 Nakit Akışı Kasa = Kasa raporu (yalnız nakit, bütün kaynaklar)")
        if self.kayitlar:
            self.d("%s:rapor:tutarli" % k, True, "KULLANICI", "B1.8 ders 11 toplam = satırlar")
            for no, kay in self.kayitlar.items():
                if ("%s:rapor:%s:alacak" % (k, no)) in self.out and self.out["%s:rapor:%s:alacak" % (k, no)]["b"]:
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
