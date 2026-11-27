#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 19 (cari; S162 = B'nin ölçütü iadenin YAZILDIĞI an — BAŞ MİMAR KARARI; S170 = B yetkiyle uygulanan karar; S157 = C kart toplamı; madde 4 türetilmiş toplamlar): d45'in karşılaştırma
carisinin düzeltilmesi + B3 … B6, d42 / d30 / d43 / d44'ün karar gereği güncellenmesi. Elle değerler KARAR / KAPSAM metninden ve KARARLAR.md §30 Y19-1 … Y19-8'den elle hesaplandı (kâhin koşulmadan
— ders 40); tutarlar kuruş. Program AÇILMAZ.

  python3 -I senaryolar19.py <test/bagimsiz/cari/senaryolar>      (bir kez koşar — eski hâli assert'le denetler)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

D = sys.argv[1]
GORUNUM = ("takvim", "vadeTakip", "projeksiyon")


def oku(ad):
    p = os.path.join(D, ad + ".json")
    with open(p, encoding="utf-8") as f:
        return p, json.load(f)


def sus(s, anahtarlar):
    """elleBeklenen'den elleYok'a (değer kalkar — susma)."""
    for k_ in anahtarlar:
        s["elleBeklenen"].pop(k_, None)
        if k_ not in s["elleYok"]:
            s["elleYok"].append(k_)


# ── d45: S162 = B'nin ölçütü (madde 1). Bugün 15.06.2026. Ortak yapı: Borç 900 (15.04) → Mevcut Borç kartı 900 = 3 × 300 (vadeler 06.05 / 06.06 / 06.07; kart 20.04) → faturasız stok iadesi
#    300 (10.06). Senaryo adımlarının listedeki sırası = yazım sırası.
p, s45 = oku("d45-c5-s159-s154-s162-s163")
A = s45["adimlar"]
assert A[-1]["islem"] == "kontrol"
idx = {a["id"]: i for i, a in enumerate(A)}
# (b) B2: Borç 500 İADEDEN ÖNCE yazılır ve tarihlenir (01.06, vade 30.06) — eski sıra (iade önce, borç sonra) B3'e taşınır
b2y = A[idx["b2y"]]
b2i = A[idx["b2i"]]
assert idx["b2i"] < idx["b2y"] and b2y["tarih"] == "2026-06-12" and b2y["vade"] == "2026-06-30" and b2i["tarih"] == "2026-06-10"
A.remove(b2y)
yeni_b2y = dict(b2y, tarih="2026-06-01")
A.insert(A.index(b2i), yeni_b2y)
for k_, v_ in (("k1:cari:B2:bakiye", 110000), ("k1:kart:KB2:toplam", 90000), ("k1:kart:KB2:kalan", 60000), ("k1:kart:KB2:odenen", 0), ("k1:kart:KB2:taksit1:odenen", 0),
               ("k1:kart:KB2:taksit2:odenen", 0), ("k1:kart:KB2:taksit3:odenen", 0), ("k1:cari:B2:gecikmis", 30000)):
    assert s45["elleBeklenen"][k_] == v_, k_  # (b) değerleri bakım 17'deki karşılaştırma değerleriyle AYNI (kararın (b)'si)

isim = {"B3": "Banu İade Önce Borç Sonra", "B4": "Bekir Borç Yazımı Önce Tarihi Sonra", "B5": "Burak Eski Vadeli Başka Borç", "B6": "Bülent Borç İadeden Sonra Silindi"}
yeni = []
for c in ("B3", "B4", "B5", "B6"):
    yeni.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": "2026-04-01"})


def ortak(c):
    lc = c.lower()
    return [{"id": lc + "x", "islem": "borc", "cari": c, "tutar": "900", "tarih": "2026-04-15"},
            {"id": "k" + lc, "islem": "kart_ac", "ad": "K" + c, "cari": c, "tutar": "900", "taksit": 3, "ilkVade": "2026-05-06", "tarih": "2026-04-20", "mevcut": True}]


def iade(c):
    return {"id": c.lower() + "i", "islem": "stok_iade", "cari": c, "tutar": "300", "tarih": "2026-06-10"}


# (a) B3 — iade ÖNCE, Borç 500 SONRA (eski B2'nin sırası): iade yazılırken kart carinin bütün açık borcunu taşıyor → S162 = B BİLİNEN SINIR — kart toplamı, taksit 'Ödenen'leri, gecikmiş (+ madde 4:
#     pencere toplamları) SUS; bakiye 1.100, 'Kalan' 600, 'Tahsil Edilen' 0 DEĞER (KAPSAM (a))
yeni += ortak("B3") + [iade("B3"), {"id": "b3y", "islem": "borc", "cari": "B3", "tutar": "500", "tarih": "2026-06-12", "vade": "2026-06-30"}]
B = {"k1:cari:B3:bakiye": 110000, "k1:kart:KB3:kalan": 60000, "k1:kart:KB3:odenen": 0}
Y = ["k1:kart:KB3:toplam", "k1:kart:KB3:taksit1:odenen", "k1:kart:KB3:taksit2:odenen", "k1:kart:KB3:taksit3:odenen", "k1:cari:B3:gecikmis"] + ["k1:%s:cariToplam:B3" % g for g in GORUNUM]
BL = [["kart KB3", "S162 = B"]]
# (c) B4 — Borç 500'ün TARİHİ iadeden sonra (12.06), YAZIMI önce → (b) AYNEN: tek kuyrukta iadenin gününde Borç 500 doğmamış, iade ilk taksiti kapatır; kart 900, Kalan 600, Tahsil Edilen 0,
#     taksit Ödenen 0 / 0 / 0 (S158 A), gecikmiş 300 (2. taksit 06.06), bakiye 1.100
yeni += ortak("B4") + [{"id": "b4y", "islem": "borc", "cari": "B4", "tutar": "500", "tarih": "2026-06-12", "vade": "2026-06-30"}, iade("B4")]
B.update({"k1:cari:B4:bakiye": 110000, "k1:kart:KB4:toplam": 90000, "k1:kart:KB4:kalan": 60000, "k1:kart:KB4:odenen": 0, "k1:kart:KB4:taksit1:odenen": 0, "k1:kart:KB4:taksit2:odenen": 0,
          "k1:kart:KB4:taksit3:odenen": 0, "k1:cari:B4:gecikmis": 30000})
# B5 — Borç 500 (25.04, vade 01.05 — kartın ilk taksitinden ÖNCE) iadeden önce yazıldı: iade S2 sırasıyla (C13.4 (4) ANINDA) önce o borcu kapatır (300 → Kalan 200); kart dokunulmaz — toplam 900,
#     Tahsil Edilen 0, Kalan 900, taksit Ödenen 0 / 0 / 0; gecikmiş 800 (Borç 200 + 1. taksit 300 + 2. taksit 300); bakiye 1.100. S162 alanı DEĞİL (kartta iade payı yok)
yeni += ortak("B5") + [{"id": "b5y", "islem": "borc", "cari": "B5", "tutar": "500", "tarih": "2026-04-25", "vade": "2026-05-01"}, iade("B5")]
B.update({"k1:cari:B5:bakiye": 110000, "k1:kart:KB5:toplam": 90000, "k1:kart:KB5:kalan": 90000, "k1:kart:KB5:odenen": 0, "k1:kart:KB5:taksit1:odenen": 0, "k1:kart:KB5:taksit2:odenen": 0,
          "k1:kart:KB5:taksit3:odenen": 0, "k1:cari:B5:gecikmis": 80000})
# B6 — ölçütün öbür yönü: Borç 500 (01.06, vade 30.06) iadeden ÖNCE yazıldı, iadeden SONRA silindi → iade yazılırken kart borcun tamamını taşımıyordu → DEĞER ((b)'nin değerleri; bakiye 600)
yeni += ortak("B6") + [{"id": "b6y", "islem": "borc", "cari": "B6", "tutar": "500", "tarih": "2026-06-01", "vade": "2026-06-30"}, iade("B6"),
                       {"id": "b6s", "islem": "hareket_sil", "hareket": "b6y"}]
B.update({"k1:cari:B6:bakiye": 60000, "k1:kart:KB6:toplam": 90000, "k1:kart:KB6:kalan": 60000, "k1:kart:KB6:odenen": 0, "k1:kart:KB6:taksit1:odenen": 0, "k1:kart:KB6:taksit2:odenen": 0,
          "k1:kart:KB6:taksit3:odenen": 0, "k1:cari:B6:gecikmis": 30000, "k1:hareket:b6y:var": False})
for k_ in B:
    assert k_ not in s45["elleBeklenen"], k_
s45["adimlar"] = A[:-1] + yeni + [A[-1]]
s45["elleBeklenen"].update(B)
s45["elleYok"] += Y
s45["elleBelirsiz"] += BL
# madde 4 (Y19-5 (1)): S162 carisinin pencere toplamları
s45["elleYok"] += ["k1:%s:cariToplam:B1" % g for g in GORUNUM]
s45["aciklama"] += (" · bakım 19 (§30 Y19-1 — BAŞ MİMAR KARARI: S162 = B'nin ölçütü iadenin YAZILDIĞI an): B2 karşılaştırma örneği doğru sırayla (Borç 500 iadeden ÖNCE — değerle, kart 900, gecikmiş 300);"
                    " B3 iade önce / borç sonra (eski B2 sırası) — SUS; B4 borcun tarihi iadeden sonra, yazımı önce — değerle; B5 başka borcun vadesi ilk taksitten önce — iade o borcu kapatır, kart"
                    " dokunulmaz; B6 borç iadeden sonra silindi — değerle; madde 4: S162 carisinin pencere toplamları SUS")
bicim.yaz(p, s45)

# ── d42: S170 = B (Y19-2) — satış kartı + faturasız iade: kart toplamı ve iadenin kapattığı taksitlerin 'Ödenen'i SUS; S157 = C (Y19-3) — SK-31 carilerinde kart toplamı SUS; madde 4 (Y19-5 (1))
p, s42 = oku("d42-c5-s140-s151-satis-karti-iade")
# T1: iade 800 → 1. taksit 500 + 2. taksit 300 (S140 A sırası) — iki taksit de iadeden pay aldı
# T2: iade 300 → 1. taksit · T3: iade 1.000 → iki taksit
once = dict(s42["elleBeklenen"])
sus(s42, ["k1:kart:KT1:toplam", "k1:kart:KT1:taksit1:odenen", "k1:kart:KT1:taksit2:odenen",
          "k1:kart:KT2:toplam", "k1:kart:KT2:taksit1:odenen",
          "k1:kart:KT3:toplam", "k1:kart:KT3:taksit1:odenen", "k1:kart:KT3:taksit2:odenen",
          "k1:kart:KT4:toplam", "k1:kart:KT5:toplam", "k1:kart:KT8:toplam"])
assert all(k_ in once for k_ in ("k1:kart:KT1:toplam", "k1:kart:KT4:toplam", "k1:kart:KT5:toplam", "k1:kart:KT8:toplam"))
assert s42["elleBeklenen"]["k1:kart:KT2:taksit2:odenen"] == 0 and s42["elleBeklenen"]["k1:kart:KT1:kalan"] == 20000  # dokunulmayan değerler AYNEN
s42["elleYok"] += ["k1:%s:cariToplam:%s" % (g, c) for c in ("T6", "T7") for g in GORUNUM]
s42["elleBelirsiz"] += [["kart KT1 toplamı", "S170 = B"], ["kart KT2 toplamı", "S170 = B"], ["kart KT3 toplamı", "S170 = B"],
                        ["kart KT4 toplamı", "Y19-3", "S157 = C"], ["kart KT5 toplamı", "Y19-3", "S157 = C"], ["kart KT8 toplamı", "Y19-3", "S157 = C"]]
s42["aciklama"] += (" · bakım 19 (§30 Y19-2 — S170 = B, yetkiyle uygulanan karar): T1 / T2 / T3 kart toplamı ve iadenin kapattığı taksitlerin 'Ödenen'i SUS (Kalan, Tahsil Edilen, gecikmiş, bakiye AYNEN);"
                    " Y19-3 (S157 = C): T4 / T5 / T8 kart toplamı SUS; madde 4: T6 / T7 pencere toplamları SUS")
bicim.yaz(p, s42)

# ── d30: Q7 — satış kartı + faturasız iade (iade karttan önce; cari EK-2B 32 tanımsız): S170 alanı (KAPSAM'ın harfi) — kart toplamı SUS
p, s30 = oku("d30-c5-s101-bitti-kart")
assert s30["elleBeklenen"]["k1:kart:KQ7:toplam"] == 60000
sus(s30, ["k1:kart:KQ7:toplam"])
s30["elleBelirsiz"] += [["kart KQ7 toplamı", "S170 = B"]]
s30["aciklama"] += " · bakım 19 (§30 Y19-2 — S170 = B): Q7 satış kartı + faturasız iade — kart toplamı SUS"
bicim.yaz(p, s30)

# ── d43: U4 / U6 — S149 = C (takvim kalemi SUS) → takvim pencere toplamı SUS (madde 4, Y19-5 (3)); Vade Takip / projeksiyon toplamları yazılır (elle tabloda yok — değişmez)
p, s43 = oku("d43-c5-bilinen-sinir-sus15")
s43["elleYok"] += ["k1:takvim:cariToplam:U4", "k1:takvim:cariToplam:U6"]
s43["elleBelirsiz"] += [["cari U4 takvim pencere toplamı", "S149"], ["cari U6 takvim pencere toplamı", "S149"]]
s43["aciklama"] += " · bakım 19 (§30 Y19-5 (3) — madde 4): U4 / U6 takvim pencere toplamı SUS (takvim kalemi S149 = C ile tanımsız)"
bicim.yaz(p, s43)

# ── d44: Y4 — S162 alanı: pencere toplamları SUS (madde 4)
p, s44 = oku("d44-c5-s155-s158")
s44["elleYok"] += ["k1:%s:cariToplam:Y4" % g for g in GORUNUM]
s44["aciklama"] += " · bakım 19 (§30 Y19-5 (1) — madde 4): Y4 (S162 alanı) pencere toplamları SUS"
bicim.yaz(p, s44)
print("d45 B2 düzeltildi + B3 … B6 (%d elle değer, %d elleYok, %d elleBelirsiz eklendi); d42 / d30 / d43 / d44 güncellendi" % (len(B), len(Y), len(BL)))
