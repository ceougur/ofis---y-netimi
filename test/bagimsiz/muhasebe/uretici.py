#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tohumlu rastgele senaryo üreticisi (kâhin): bir yıllık iş olayları + K sonrası Ocak + devir + Devri Yenile.

  python3 test/bagimsiz/muhasebe/uretici.py <tohum> [--yaz]

Olaylar API'den bağımsız iş olaylarıdır (senaryolar_elle.py ile aynı dil); üretici yalnız geçerli istekler üretmeye çalışır (kasa eksiye
düşmez, evrak durumuna uygun işlem, şüpheliye alınan ≤ borç). Beklenen sayıları model.py üretir; değişmezler test_model.py'de koşar.
Üretilen senaryoya iki denetim ek: (1) aynı olaylar devirsiz koşulunca son bilanço aktifi ve 1–4 sınıfı bakiyeleri devirli koşuyla aynı
olmalı (devir şirketin durumunu değiştirmez); (2) devirden önceki canlı Gelir Tablosu (tahmini SMM) = arşivin Gelir Tablosu (kesin SMM).
"""

import copy
import datetime
import os
import random
import sys
from collections import defaultdict
from fractions import Fraction

BURASI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BURASI)
import model as M  # noqa: E402
from senaryolar_elle import TANIM  # noqa: E402

TOHUMLAR = (1, 2, 3)

# Kâhin bakımı 3 (ana oturum K3; README E1): resmî tatiller (2429 sayılı Kanun) — sabit günler her yıl (28 Ekim yarım gün); dinî bayramlar (arife yarım
# gün dahil) 2026–2027. Bayram tarihleri birincil takvimden DOĞRULANMADI → her pencere arifeden bir gün önce – bayramdan bir gün sonra (geniş). Kitap
# D-01 valörün tatilde ne olduğunu söylemez (KULLANICIYA SORULMALI 5): üretici valörü bu günlere düşürmez — kural uydurmaz, durumdan kaçınır.
RESMI_TATIL_SABIT = ("01-01", "04-23", "05-01", "05-19", "07-15", "08-30", "10-28", "10-29")
DINI_BAYRAM_PENCERESI = (("2026-03-18", "2026-03-23"), ("2026-05-25", "2026-05-31"), ("2027-03-07", "2027-03-12"), ("2027-05-14", "2027-05-20"))


def tatil_mi(g):
    s = g.isoformat()
    return s[5:] in RESMI_TATIL_SABIT or any(a <= s <= b for a, b in DINI_BAYRAM_PENCERESI)


def valor_tatilsiz(t, valor):
    """Valör resmî tatil değil ve hafta sonu kaydırmasının üstünden geçtiği günlerde (valörden önceki ardışık hafta sonu, çekim gününden sonra) tatil yok."""
    if tatil_mi(valor):
        return False
    g, bas = valor - datetime.timedelta(days=1), datetime.date.fromisoformat(t)
    while g > bas and g.weekday() >= 5:
        if tatil_mi(g):
            return False
        g -= datetime.timedelta(days=1)
    return True
MUSTERI = ("C1", "C2", "C3", "C4", "C5")
TEDARIKCI = ("T1", "T2", "T3")


def tanim():
    t = copy.deepcopy(TANIM)
    t["cariler"].update({"C4": {"ad": "Kaya Market", "tur": "musteri"}, "C5": {"ad": "Yıldız Ltd", "tur": "musteri"},
                         "T3": {"ad": "Toptan A.Ş.", "tur": "tedarikci"}, "D2": {"ad": "Personel Avans", "tur": "diger"}})
    return t


class Uretici:
    def __init__(self, tohum, yil=2026, yogunluk=3):
        self.r = random.Random(tohum)
        self.yil, self.yogunluk = yil, yogunluk
        self.olaylar = []
        self.no = 0
        self.kasa = 0
        self.banka = defaultdict(int)
        self.cari = defaultdict(int)
        self.stok = defaultdict(int)
        self.evrak = {}
        self.supheli = {}
        self.acik = defaultdict(list)      # cari → [fatura id, tutar, bağlı ödendi mi]
        self.kartlar = {}
        self.pos = []

    def id(self, on):
        self.no += 1
        return f"{on}{self.no}"

    def ekle(self, tur, tarih=None, **kw):
        o = {"tur": tur}
        if tarih:
            o["tarih"] = tarih
        o.update(kw)
        self.olaylar.append(o)
        return o

    def tutar(self, a, b):
        return self.r.randrange(a, b, 100)

    @staticmethod
    def oranla(tutar, pay, payda=100):
        """KDV / tevkifat / stopaj = tutar × oran, kuruşa YARIM YUKARI (kitap G-1; GİB / UBL-TR satır tutarı yuvarlaması) — ana oturum K1."""
        return M.yuvarla(Fraction(tutar * pay, payda))

    @staticmethod
    def is_gunu(g):
        """POS valörü hafta sonuna düşerse sonraki iş günü (docs/BANKA-MODULU-PLAN.md POS valör örnekleri; resmî tatil yok) — ana oturum K3."""
        while g.weekday() >= 5:
            g += datetime.timedelta(days=1)
        return g

    def pos_valoru(self, t, gun):
        """POS valörü = çekim + gun, hafta sonu → sonraki iş günü (ana oturum K3). Bakım 3 E1: valör resmî tatile ya da tatilin üstünden geçen
        kaydırmaya düşerse öbür seçenekler (1, 2, 30 gün) sırayla denenir (rastgele sayı tüketmez); hiçbiri olmazsa None."""
        for g_ in [gun] + [x for x in (1, 2, 30) if x != gun]:
            aday = self.is_gunu(datetime.date.fromisoformat(t) + datetime.timedelta(days=g_))
            if valor_tatilsiz(t, aday):
                return aday
        return None

    # -- olay türleri
    def acilislar(self, t):
        self.ekle("kasa_acilis", t, tutar=self.tutar(100000, 2000000))
        self.kasa = self.olaylar[-1]["tutar"]
        for b in ("B1", "B2"):
            x = self.tutar(500000, 5000000)
            self.ekle("banka_acilis", t, banka=b, tutar=x)
            self.banka[b] = x
        self.ekle("kart_acilis", t, kart="KK1", tutar=self.tutar(10000, 200000))
        self.ekle("kredi_acilis", t, kredi="KR1", tutar=self.tutar(500000, 3000000))
        for c in ("C1", "C3"):
            x = self.tutar(10000, 300000)
            self.ekle("cari_acilis", t, cari=c, yon="borc", tutar=x)
            self.cari[c] += x
        x = self.tutar(10000, 200000)
        self.ekle("cari_acilis", t, cari="T1", yon="alacak", tutar=x)
        self.cari["T1"] -= x
        kal = []
        for u in ("U1", "U2"):
            q = self.r.randint(5, 40)
            kal.append({"urun": u, "miktar": q, "birim_maliyet": self.r.choice([900, 1000, 2400, "10000/3"])})
            self.stok[u] += q
        self.ekle("stok_acilis", t, kalemler=kal)
        e = self.id("EA")
        self.ekle("evrak_acilis", t, evrak=e, evrak_turu="cek", yon="alinan", durum="portfoy", tutar=self.tutar(10000, 100000), cari="C1")
        self.evrak[e] = {"durum": "portfoy", "yon": "alinan", "tutar": self.olaylar[-1]["tutar"]}

    def satis(self, t):
        c = self.r.choice(MUSTERI + ("T1",))
        M_ = self.tutar(5000, 400000)
        oran = self.r.choice([0, 1, 10, 20, 20, 20])
        K = self.oranla(M_, oran)
        o = {"cari": c, "M": M_, "K": K}
        if K and self.r.random() < 0.1:
            o["T"] = self.oranla(K, 5, 10)                       # 5/10 tevkifat, yarım yukarı
        if self.r.random() < 0.05:
            o.update(ihracat=True, K=0, T=0)
            oran = 0
        if self.r.random() < 0.5:
            o["vade"] = (datetime.date.fromisoformat(t) + datetime.timedelta(days=self.r.choice([15, 30, 60]))).isoformat()
        u = self.r.choice(("U1", "U2", "U3"))
        if self.r.random() < 0.6 and self.stok[u] > 0:
            q = self.r.randint(1, min(self.stok[u], 8))
            o["kalemler"] = [{"urun": u, "miktar": q}]
            self.stok[u] -= q
        fid = self.id("F")
        self.ekle("satis_faturasi", t, id=fid, **o)
        tut = o["M"] + o["K"] - o.get("T", 0)
        self.cari[c] += tut
        self.acik[c].append([fid, tut, False, o["M"], oran, bool(o.get("T"))])

    def alis(self, t):
        c = self.r.choice(TEDARIKCI)
        fid = self.id("A")
        if self.r.random() < 0.6:
            u = self.r.choice(("U1", "U2", "U3"))
            q = self.r.randint(3, 30)
            M_ = q * self.r.randrange(800, 3000, 10)
            K = self.oranla(M_, self.r.choice([0, 20]))
            o = {"cari": c, "fatura_turu": "stok", "M": M_, "K": K, "kalemler": [{"urun": u, "miktar": q}]}
            self.stok[u] += q
        else:
            M_ = self.tutar(5000, 200000)
            K = self.oranla(M_, self.r.choice([0, 10, 20]))
            o = {"cari": c, "fatura_turu": "gider", "gider_turu": self.r.choice(["genel", "genel", "satis", "finansman", "demirbas"]), "M": M_, "K": K}
            if c == "T2":
                o["S"] = self.oranla(M_, 20)
        if o["K"] and self.r.random() < 0.1:
            o["T"] = self.oranla(o["K"], 2, 10)                   # 2/10 tevkifat, yarım yukarı
        if t[5:7] == "12" and t[8:] >= "20" and o["K"] and self.r.random() < 0.5:
            o["indirim_ayi"] = f"{int(t[:4]) + 1}-01"           # KG-7 A: geç gelen Aralık faturası, KDV Ocak'ta
        self.ekle("alis_faturasi", t, id=fid, **o)
        tut = o["M"] + o["K"] - o.get("T", 0) - o.get("S", 0)
        self.cari[c] -= tut
        self.acik[c].append([fid, -tut, False])

    def tahsilat(self, t):
        adaylar = [c for c in MUSTERI if self.cari[c] > 0]
        if not adaylar:
            return
        c = self.r.choice(adaylar)
        tut = min(self.cari[c], self.tutar(1000, 300000))
        o = {"cari": c}
        bag = [x for x in self.acik[c] if not x[2] and x[1] > 0 and x[1] <= self.cari[c]]
        if bag and self.r.random() < 0.5:
            x = self.r.choice(bag)
            x[2] = True
            tut = x[1]
            o["fatura"] = x[0]
        yol = self.r.choice(["nakit", "nakit", "havale", "havale", "pos", "cek", "senet"])
        valor = None
        if yol == "pos":
            valor = self.pos_valoru(t, self.r.choice([1, 1, 2, 30]))
            if valor is None:                                    # bakım 3 E1: hiçbir valör seçeneği tatilsiz değil → POS yerine havale
                yol = "havale"
        o.update(yol=yol, tutar=tut)
        if yol == "havale":
            o["banka"] = self.r.choice(["B1", "B2"])
            self.banka[o["banka"]] += tut
        elif yol == "nakit":
            self.kasa += tut
        elif yol == "pos":
            o.update(pos="POS1", komisyon=self.oranla(tut, 2), valor=valor.isoformat())
        else:
            e = self.id("E")
            o["evrak"] = e
            self.evrak[e] = {"durum": "portfoy", "yon": "alinan", "tutar": tut, "tur": yol, "tarih": t}
        oid = self.id("P")
        self.ekle("tahsilat", t, id=oid, **o)
        if yol == "pos":
            self.pos.append((oid, c, tut, o["valor"]))
        self.cari[c] -= tut

    def odeme(self, t):
        adaylar = [c for c in TEDARIKCI if self.cari[c] < 0]
        if not adaylar:
            return
        c = self.r.choice(adaylar)
        tut = min(-self.cari[c], self.tutar(1000, 300000))
        o = {"cari": c}
        bag = [x for x in self.acik[c] if not x[2] and x[1] < 0 and -x[1] <= -self.cari[c]]
        if bag and self.r.random() < 0.5:
            x = self.r.choice(bag)
            x[2] = True
            tut = -x[1]
            o["fatura"] = x[0]
        portfoy = [e for e, v in self.evrak.items() if v["durum"] == "portfoy" and v["yon"] == "alinan" and v["tutar"] <= -self.cari[c]]
        secenek = ["havale", "havale", "kart", "cek"] + (["nakit"] if self.kasa >= tut else []) + (["ciro"] if portfoy else [])
        yol = self.r.choice(secenek)
        o["yol"] = yol
        if yol == "ciro":
            e = self.r.choice(portfoy)
            self.evrak[e]["durum"] = "ciro"
            tut = self.evrak[e]["tutar"]
            o.pop("fatura", None)
            o["evrak"] = e
        elif yol == "havale":
            o["banka"] = self.r.choice(["B1", "B2"])
            self.banka[o["banka"]] -= tut
        elif yol == "nakit":
            self.kasa -= tut
        elif yol == "kart":
            o["kart"] = "KK1"
        elif yol == "cek":
            e = self.id("V")
            o.update(evrak=e, banka="B1")
            self.evrak[e] = {"durum": "verildi", "yon": "verilen", "tutar": tut}
        o["tutar"] = tut
        self.ekle("odeme", t, **o)
        self.cari[c] += tut

    def kasa_banka(self, t):
        x = self.r.random()
        if x < 0.3:
            tut = self.tutar(1000, 50000)
            self.ekle("kasa_giris", t, tutar=tut)
            self.kasa += tut
        elif x < 0.55 and self.kasa > 2000:
            tut = self.tutar(1000, min(self.kasa, 60000) + 100)
            if tut <= self.kasa:
                self.ekle("kasa_cikis", t, tutar=tut)
                self.kasa -= tut
        elif x < 0.7:
            b = self.r.choice(["B1", "B2"])
            tut = self.tutar(1000, 100000)
            self.ekle("bankadan_kasaya", t, banka=b, tutar=tut)
            self.banka[b] -= tut
            self.kasa += tut
        elif x < 0.8 and self.kasa > 5000:
            b = self.r.choice(["B1", "B2"])
            tut = self.tutar(1000, self.kasa)
            self.ekle("kasadan_bankaya", t, banka=b, tutar=tut)
            self.banka[b] += tut
            self.kasa -= tut
        elif x < 0.9:
            g, a = self.r.sample(["B1", "B2"], 2)
            tut = self.tutar(1000, 200000)
            o = {"gonderen": g, "alici": a, "tutar": tut}
            if self.r.random() < 0.3:
                o["valor"] = (datetime.date.fromisoformat(t) + datetime.timedelta(days=self.r.choice([1, 2, 3]))).isoformat()
            if self.r.random() < 0.5:
                o.update(ucret=500, bsmv=25)
            self.ekle("banka_transfer", t, **o)
        else:
            b = self.r.choice(["B1", "B2"])
            self.ekle(self.r.choice(["banka_masraf", "banka_diger_gider", "banka_diger_gelir"]), t, banka=b, tutar=self.tutar(500, 5000))

    def evrak_islemi(self, t):
        port = [e for e, v in self.evrak.items() if v["yon"] == "alinan" and v["durum"] == "portfoy"]
        tahs = [e for e, v in self.evrak.items() if v["yon"] == "alinan" and v["durum"] == "tahsilde"]
        ver = [e for e, v in self.evrak.items() if v["yon"] == "verilen" and v["durum"] == "verildi"]
        x = self.r.random()
        if port and x < 0.35:
            e = self.r.choice(port)
            self.ekle("evrak_tahsile_ver", t, evrak=e, banka=self.r.choice(["B1", "B2"]))
            self.evrak[e]["durum"] = "tahsilde"
        elif tahs and x < 0.6:
            e = self.r.choice(tahs)
            self.ekle("evrak_tahsil", t, evrak=e)
            self.evrak[e]["durum"] = "tahsil"
        elif port and x < 0.75:
            e = self.r.choice(port)
            self.ekle("evrak_tahsil", t, evrak=e, yol="kasa")
            self.evrak[e]["durum"] = "tahsil"
            self.kasa += self.evrak[e]["tutar"]
        elif ver and x < 0.95:
            e = self.r.choice(ver)
            self.ekle("verilen_evrak_ode", t, evrak=e, banka="B1")
            self.evrak[e]["durum"] = "odendi"
        elif port:
            e = self.r.choice(port)
            self.ekle("evrak_karsiliksiz", t, evrak=e)
            self.evrak[e]["durum"] = "karsiliksiz"

    def stok_modulu(self, t):
        u = self.r.choice(("U1", "U2", "U3"))
        x = self.r.random()
        if x < 0.4:
            q = self.r.randint(2, 20)
            self.ekle("stok_giris", t, urun=u, miktar=q, tutar=q * self.r.randrange(900, 2600, 10), karsi="havale", banka="B1")
            self.stok[u] += q
        elif x < 0.8 and self.stok[u] > 0:
            q = self.r.randint(1, min(5, self.stok[u]))
            tut = q * self.r.randrange(1500, 4000, 10)
            self.ekle("stok_cikis_satis", t, urun=u, miktar=q, tutar=tut, karsi="nakit")
            self.stok[u] -= q
            self.kasa += tut
        elif x < 0.9 and self.stok[u] > 0:
            self.ekle("stok_duzeltme", t, urun=u, miktar=-1)
            self.stok[u] -= 1
        elif self.kasa > 5000:
            self.ekle("stok_musteri_iadesi", t, urun=u, miktar=1, tutar=2000, karsi="nakit")
            self.stok[u] += 1
            self.kasa -= 2000

    def seyrek(self, t):
        x = self.r.random()
        if x < 0.15:
            c = self.r.choice(MUSTERI)
            tut = self.tutar(1000, 30000)
            self.ekle("borc_yaz", t, cari=c, tutar=tut, aciklama="Fark", vade=t if self.r.random() < 0.5 else None)
            self.cari[c] += tut
        elif x < 0.3:
            c = self.r.choice(MUSTERI)
            tut = self.tutar(1000, 20000)
            self.ekle("alacak_yaz", t, cari=c, tutar=tut, aciklama="İndirim")
            self.cari[c] -= tut
        elif x < 0.45:
            c = self.r.choice(MUSTERI)
            fat = [y for y in self.acik[c] if y[1] > 2000 and not y[5]]   # tevkifatsız satış faturası
            if fat:
                f = self.r.choice(fat)
                m = f[3] // 4
                k = self.oranla(m, f[4])                              # F-09: asıl faturanın KDV oranı (ana oturum K2)
                self.ekle("satis_iade_faturasi", t, id=self.id("I"), cari=c, M=m, K=k, asil_fatura=f[0])
                self.cari[c] -= m + k
        elif x < 0.55:
            c = self.r.choice(MUSTERI)
            kid = self.id("TK")
            top = self.tutar(30000, 120000)
            vade = datetime.date.fromisoformat(t)
            tak = [{"vade": (vade + datetime.timedelta(days=30 * (i + 1))).isoformat(), "tutar": top // 3 + (top % 3 if i == 2 else 0)} for i in range(3)]
            self.ekle("taksit_karti", t, id=kid, cari=c, kaynak="yeni_borc", toplam=top, taksitler=tak)
            self.cari[c] += top
            self.kartlar[kid] = c
        elif x < 0.65 and self.kartlar:
            kid = self.r.choice(sorted(self.kartlar))
            c = self.kartlar[kid]
            tut = self.tutar(1000, 20000)
            self.ekle("tahsilat", t, cari=c, yol="nakit", tutar=tut, taksit_karti=kid)
            self.cari[c] -= tut
            self.kasa += tut
        elif x < 0.72:
            self.ekle("kart_harcama", t, kart="KK1", urun="U2", miktar=2, tutar=5000)
            self.stok["U2"] += 2
        elif x < 0.8:
            self.ekle("kart_faiz", t, kart="KK1", tutar=self.tutar(100, 3000))
        elif x < 0.88 and self.pos:
            oid, c, tut, valor = self.pos[-1]
            if t < valor and tut > 2000:
                self.ekle("pos_iade", t, tahsilat=oid, cari=c, tutar=1000)
                self.cari[c] += 1000
        elif x < 0.95:
            self.ekle("faiz_geliri", t, banka="B1", brut=self.tutar(1000, 20000), stopaj=100)
        else:
            mid = self.id("MS")
            self.ekle("banka_masraf", t, id=mid, banka="B2", tutar=1500)
            self.ekle("ters", t, hedef=mid)

    def ay_sonu(self, ay):
        self.ekle("kart_borc_odeme", M.ay_sonu(ay), kart="KK1", banka="B1", tutar=self.tutar(1000, 20000))
        if ay[5:7] in ("03", "06", "09", "12"):
            self.ekle("kredi_odeme", M.ay_sonu(ay), kredi="KR1", banka="B1", anapara=self.tutar(10000, 50000), faiz=self.tutar(1000, 9000))
        self.ekle("kdv_mahsup", ay=ay)

    def supheli_akisi(self, t1, t2, t3):
        c = max(MUSTERI, key=lambda x: self.cari[x])
        if self.cari[c] < 20000:
            return
        tut = self.cari[c] // 2
        kayit = self.id("SK")                                         # EK-2 31: işlemler kayıt başına, olay kaydı taşır
        self.ekle("supheliye_al", t1, id=kayit, cari=c, tutar=tut)
        self.ekle("karsilik_ayir", t1, cari=c, tutar=tut // 2, kayit=kayit)
        self.ekle("tahsilat", t2, cari=c, yol="havale", banka="B1", tutar=tut // 3, supheliden=True)
        self.cari[c] -= tut // 3
        self.supheli[c] = True
        if self.r.random() < 0.5:
            self.ekle("degersiz_yaz", t3, cari=c, kayit=kayit)
        self.cari[c] -= tut - tut // 3

    def s11_karsiliksiz(self, K, t):
        """Kâhin bakımı 3 (S11 A, README T6): K'den önce bir tahsilatla alınmış, portföyde / tahsilde duran evrak K'den sonra karşılıksız döner.
        Devirsiz eş (L = K) S11 ile, devirli yeni yıl M1c ile aynı sonucu vermeli (gec_ocak / gec_son, değişmez m2). Rastgele sayı tüketmez."""
        for e, v in sorted(self.evrak.items()):
            if v["yon"] == "alinan" and v["durum"] in ("portfoy", "tahsilde") and v.get("tarih", "9999") <= K:
                self.ekle("evrak_karsiliksiz", t, evrak=e)
                v["durum"] = "karsiliksiz"
                return e
        return None

    def gunler(self, bas, son):
        g = datetime.date.fromisoformat(bas)
        bit = datetime.date.fromisoformat(son)
        while g <= bit:
            t = g.isoformat()
            for _ in range(self.r.choice(range(self.yogunluk + 2))):
                f = self.r.choices([self.satis, self.alis, self.tahsilat, self.odeme, self.kasa_banka, self.evrak_islemi, self.stok_modulu, self.seyrek],
                                   weights=[22, 14, 18, 12, 12, 7, 7, 8])[0]
                f(t)
            sonraki = g + datetime.timedelta(days=1)
            if sonraki.month != g.month:
                self.ay_sonu(t[:7])
            g = sonraki


def uret(tohum, yil=2026, yogunluk=3):
    u = Uretici(tohum, yil, yogunluk)
    K = f"{yil}-12-31"
    u.acilislar(f"{yil}-01-01")
    u.gunler(f"{yil}-01-02", f"{yil}-06-30")
    u.supheli_akisi(f"{yil}-07-01", f"{yil}-08-15", f"{yil}-11-20")
    u.gunler(f"{yil}-07-01", K)
    u.gunler(f"{yil + 1}-01-01", f"{yil + 1}-01-20")           # K sonrası, devirden önce girilen Ocak kayıtları
    u.s11_karsiliksiz(K, f"{yil + 1}-01-20")                    # kâhin bakımı 3: kilitli dönemin evrakı kilitten sonra karşılıksız (S11)
    rap = [
        {"tur": "rapor", "ad": "gt_canli", "rapor": "gelir_tablosu", "bas": f"{yil}-01-01", "son": K},
        {"tur": "rapor", "ad": "bil_canli_K", "rapor": "bilanco", "tarih": K},
    ]
    u.olaylar += rap
    u.ekle("devir", K=K, secenek="borc_alacak" if tohum % 2 else "sadece_bakiye", ad="devir")
    u.olaylar += [
        {"tur": "rapor", "ad": "gt_arsiv", "rapor": "gelir_tablosu", "bas": f"{yil}-01-01", "son": K, "dosya": "arsiv"},
        {"tur": "rapor", "ad": "bil_arsiv", "rapor": "bilanco", "tarih": K, "dosya": "arsiv"},
        {"tur": "rapor", "ad": "mz_arsiv", "rapor": "mizan", "bas": f"{yil}-01-01", "son": K, "dosya": "arsiv"},
    ]
    u.gunler(f"{yil + 1}-01-21", f"{yil + 1}-02-10")          # devirden sonra girilen kayıtlar
    u.ekle("devri_yenile", ad="yenile", duzeltmeler=[
        {"tur": "alis_faturasi", "tarih": f"{yil}-12-29", "id": "GEC1", "cari": "T3", "fatura_turu": "gider", "M": 40000, "K": 8000, "gider_turu": "genel",
         "indirim_ayi": f"{yil + 1}-01"},
        # K5 (VUK müteselsil sıra-tarih): geç kesilen Aralık satış faturası K (31.12) tarihli — serinin son tarihinden önce olamaz
        {"tur": "satis_faturasi", "tarih": K, "id": "GEC2", "cari": "C5", "M": 25000, "K": 5000},
    ])
    u.ekle("kdv_mahsup_geri_al", ay=f"{yil + 1}-01")
    u.ekle("kdv_mahsup", ay=f"{yil + 1}-01")
    son = f"{yil + 1}-02-28"
    u.olaylar += [
        {"tur": "rapor", "ad": "gt_yeni", "rapor": "gelir_tablosu", "bas": f"{yil + 1}-01-01", "son": son},
        {"tur": "rapor", "ad": "bil_yeni", "rapor": "bilanco", "tarih": son},
        {"tur": "rapor", "ad": "mz_yeni", "rapor": "mizan", "bas": f"{yil + 1}-01-01", "son": son},
        # EK-1 M2: devirli ve devirsiz koşuda her carinin gecikmiş tutarı aynı (iki tarih)
        {"tur": "rapor", "ad": "gec_ocak", "rapor": "gecikmis_tumu", "tarih": f"{yil + 1}-01-25"},
        {"tur": "rapor", "ad": "gec_son", "rapor": "gecikmis_tumu", "tarih": son},
    ]
    t = tanim()
    s = {"dil": M.DIL, "ad": f"rastgele-{tohum}", "aciklama": f"Tohumlu rastgele bir yıl (tohum {tohum}, yoğunluk {yogunluk}) + devir + Devri Yenile",
         "kapsam": ["rastgele"], "defter_turu": "bilanco", "olaylar": u.olaylar, "dallar": [], "elle": {}}
    s.update(t)
    return s


def devirsiz(s):
    """Aynı senaryonun devir / yenile içermeyen hâli (devir şirketin durumunu değiştirmez denetimi için). Devir yapmayan müşteri
    dönem kilidiyle çalışır (DEVIR-PLANI §0); karşılaştırma AYNI kilitle (L = K, EK-2B §5.3 / karar (3)): düzeltmelerden sonra kilit."""
    x = copy.deepcopy(s)
    out = []
    K = next(o["K"] for o in x["olaylar"] if o["tur"] == "devir")
    for o in x["olaylar"]:
        if o["tur"] in ("devir", "devri_yenile"):
            if o["tur"] == "devri_yenile":
                out += o["duzeltmeler"]
                out.append({"tur": "donem_kilitle", "tarih": K})
            continue
        if o["tur"] == "rapor" and o.get("dosya", "canli") != "canli":
            continue
        out.append(o)
    x["olaylar"] = out
    return x


if __name__ == "__main__":
    import json
    tohum = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    s = uret(tohum)
    r = M.kos(s)
    print(json.dumps({"olay": len(s["olaylar"]), "red": [x["kod"] for x in r["redler"]], "degismez_tuttu": M.tumu_tuttu(r["degismezler"]),
                      "devir_degismez": r["devirler"][0]["degismezler"] if r["devirler"] else None}, ensure_ascii=False, indent=1))
