#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Muhasebe kâhin modeli — MUTASYON testi (testin dişi, CLAUDE.md KANIT KURALI 3 / ders 7).

  python3 test/bagimsiz/muhasebe/mutasyon.py

Her mutant model.py KAYNAĞINDA tek bir kuralı bozar (metin değişikliği; değişecek parça kaynakta tam bir kez geçmeli), bozuk kaynak
"model" modülü olarak yüklenir ve test_model.py (diskteki dosyaların güncelliğini denetleyen Dosyalar sınıfı hariç) ona karşı koşar.
Her mutantı en az bir test yakalamalı ("ÖLDÜ"); sağ kalan mutant = eksik test. Önce bozulmamış model koşulur (yeşil olmalı).
Çıkış: 0 bütün mutantlar öldü ve temel yeşil · 1 aksi.
"""

import contextlib
import io
import os
import sys
import types
import unittest

BURASI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BURASI)
MODEL = os.path.join(BURASI, "model.py")

# (ad, [(eski, yeni), …]) — eski kaynakta tam bir kez geçer
MUTANTLAR = [
    ("M01 açılış karşı hesabı 500 (30.10 düzeni, M-01…M-09)",
     [('return ESKI_ACILIS_KARSI if self.kural == "2.4.9" else G', 'return ESKI_ACILIS_KARSI')]),
    ("M02 açık kalemin defter karşılığı gelir / gider (G14, N-10)",
     [('tur="fatura", vade=k.v.get("vade")), L(G, -t)])', 'tur="fatura", vade=k.v.get("vade")), L("600" if t > 0 else "770", -t)])')]),
    ("M03 7/A yansıtma 760 → 632 (N-02)", [('"760": ("631", "761")', '"760": ("632", "761")')]),
    ("M04 780 faaliyet giderine (H yerine E, §7.1)", [('"780": ("Finansman Giderleri", "MAL", "H")', '"780": ("Finansman Giderleri", "MAL", "E")')]),
    ("M05 alacaklı müşteri netleşir, 340 yok (§7.3)", [('"120": "III.D"', '"120": "KD"')]),
    ("M06 değerlemede dönem başı stok yok sayılır (§5.1)",
     [("dq = {u: dbs[u][0] for u in urunler}", "dq = {u: Fraction(0) for u in urunler}"),
      ("dv = {u: dbs[u][1] for u in urunler}", "dv = {u: 0 for u in urunler}")]),
    ("M07 alış iadesi ortalamaya girmez (§5.1)", [('elif tur in ("alis", "alis_iade"):', 'elif tur == "alis":')]),
    ("M08 eksi stok eksi değerle (KG-9 A)", [('deger = 0 if self.k.KG9 == "A" else yuvarla(miktar * birim)', 'deger = yuvarla(miktar * birim)')]),
    ("M09 kapanışta stok değerlemesi yok (N-01)",
     [('fark = arsiv.ana_bakiye("153", K) - arsiv.deger(K)', 'fark = 0')]),
    ("M10 tamamlayıcı açılış fişinde 360 unutulur (N-13, 519 eşleşmesi)",
     [('if not bilanco_hesabi(h) or ana(h) == G:\n                continue\n            fark = v - kars',
       'if not bilanco_hesabi(h) or ana(h) in (G, "360"):\n                continue\n            fark = v - kars')]),
    ("M11 tevkifatlı satışta 391 = K (F-03)", [('Al(gelir, M), Al("391", K - T)])', 'Al(gelir, M - T), Al("391", K)])')]),
    ("M12 KG-6 A'da komisyon satış günü yazılmaz", [('if yol == "pos" and self.k.KG6 == "A" and v.get("komisyon"):', 'if False:')]),
    ("M13 KDV mahsubu devreden KDV'yi (D) yok sayar (V-01)", [('D = d.bakiyeler(t).get(("190", None), 0)', 'D = 0')]),
    ("M14 cari açılışı açık kalemler düşülmeden (G2)", [('net = ch_bal - sum(x["kalan"] for x in acik)', 'net = ch_bal')]),
    ("M15 gelir tablosu dönem sonu sınıfını (N-01) dışlar (§4)",
     [('if m.tarih < a or m.sinif == 3:\n                continue\n            for s in m.satirlar:\n                h = s["h"]',
       'if m.tarih < a or m.sinif >= 2:\n                continue\n            for s in m.satirlar:\n                h = s["h"]')]),
    ("M16 bilançoda tahmini SMM yok, gelir tablosunda var (YÜKSEK-1)", [("R[y] -= smm", "pass")]),
    ("M17 KG-12 A'da önceki yıllar 590'a (N-08 yok)", [('if self.k.KG12 == "A":\n                cari_yil', 'if False:\n                cari_yil')]),
    ("M18 G ≠ 0 iken Kesin Değil yok (§7.4)", [('if bal.get((G, None), 0):\n            kd.append', 'if False:\n            kd.append')]),
    ("M19 iç yüzde KDV aşağı yuvarlanır (G-1, KG-2 B)",
     [('return yuvarla(Fraction(k.v["tutar"]) * oran / (100 + oran))', 'return int(Fraction(k.v["tutar"]) * oran / (100 + oran))')]),
    ("M20 yarım yukarı yerine bankacı yuvarlaması (G-1)", [("return int(math.floor(x + Fraction(1, 2)))", "return round(x)")]),
    ("M21 kira stopajı 360'a değil cariye (F-06)",
     [("ch = M + K - T - S\n", "ch = M + K - T\n"), ('Al("360", T + S)])\n        self.m(k, k.tarih, ("cari", c), -ch)',
                                                     'Al("360", T)])\n        self.m(k, k.tarih, ("cari", c), -ch)')]),
    ("M22 bekleyen POS açılışı brüt (N-11, KG-6 A)",
     [('tutar = it["brut"] - it["iade"] - ((it["kom"] - it["kom_iade"]) if self.k.KG6 == "A" else 0)', 'tutar = it["brut"] - it["iade"]')]),
    ("M23 Devri Yenile eski devir satırlarını silmez (N-14)",
     [("for kid in [i for i, k in yeni.kaynaklar.items() if k.devir == did]:", "for kid in []:")]),
    ("M24 aynı gün sırası sınıfsız (G-4, ders 31)", [("return (m.tarih, m.sinif, m.seq, m.id)", "return (m.tarih, m.seq, m.id)")]),
    ("M25 iptal edilen faturanın peşin ödemesi kalır (F-15)", [('return f is None or f.durum != "aktif"', "return False")]),
    ("M26 karşılık çözülmesi yok (J-04)", [('if s["karsilik"] > s["kalan"]:', "if False:")]),
    ("M27 KG-5 A'da önceden ödenen de maddelenir",
     [('T - P, c, k="taksit:" + k.id, tur="taksit", vade=ilk), Al(G, T - P)', 'T, c, k="taksit:" + k.id, tur="taksit", vade=ilk), Al(G, T)')]),
    ("M28 onaylı 'Açılış Olabilir' 602.90'a (KG-16 A)", [('acilis = v.get("onay") is True', "acilis = False")]),
    ("M29 kilitli döneme yazım kabul (Ç3, 409)", [("if self.kilit is not None and tarih <= self.kilit:", "if False:")]),
    ("M30 POS valöründe iade düşülmez (D-04)",
     [('net = it["brut"] - it["iade"] - kom_kalan\n                self.madde(kk, it["valor"], 1, [Bo("102." + b, net), Al("108." + p, net)]',
       'net = it["brut"] - kom_kalan\n                self.madde(kk, it["valor"], 1, [Bo("102." + b, net), Al("108." + p, net)]')]),
    ("M31 bağlı ödeme önce eşleşmez, yalnız FIFO (G2)", [('if o["link"]:\n                eslestir(o, o["link"])', 'if False:\n                eslestir(o, o["link"])')]),
    ("M32 taksitte vadesi bugün olan gecikmiş sayılır (B1)", [('if kalan and tk["vade"] < t:', 'if kalan and tk["vade"] <= t:')]),
    ("M33 devirde bekleyen POS açılmaz (N-11)", [('if it.get("gecersiz") or it["valor"] <= K:', "if True:")]),
    ("M34 açılış eşleştirme G'yi ters bakiyeye geçirebilir (M-11)",
     [("if g0 == 0 or (g0 > 0 and not 0 <= g1 < g0) or (g0 < 0 and not g0 < g1 <= 0):", "if g0 == 0:")]),
    ("M35 KG-7 A'da KDV indirim dönemi alanı yok sayılır", [('etiketli = self.k.KG7 == "A" and e.get("indirim_ayi")', "etiketli = False")]),
    ("M36 KG-3 SORU: kayıt tahsilatı gelire", [("return CARISIZ_PASIF if kayit else CARISIZ_GELIR", "return CARISIZ_GELIR")]),
    ("M37 borçlu 360 pasifte eksi kalır (KG-14)", [('if ters and tr == "KG14":', "if False:")]),
    ("M38 kural farkı düzeltme fişi ters yönde (KG-15 A, N-16)",
     [("satirlar = [L(ayir(k)[0], v, ayir(k)[1]) for k, v in fark.items()]", "satirlar = [L(ayir(k)[0], -v, ayir(k)[1]) for k, v in fark.items()]")]),
    ("M39 ekstrede açık alış kalemi Alacak Toplamı'ndan düşülmez (G14)",
     [('"Alacak Toplamı": ha + sum(x["kalan"] for x in acik if x["kalan"] < 0),', '"Alacak Toplamı": ha,')]),
    ("M40 tahmini SMM'de dönem başı değeri yok (KG-11 A)", [("v0 = self.deger(onceki(ya))", "v0 = 0")]),
    ("M41 devirde açık şüpheli karşılığı açılmaz (N-12)",
     [('if P:\n            self.madde(k, k.tarih, 0, [Bo(G, P), Al("129", P, c)], alt=1)',
       'if False:\n            self.madde(k, k.tarih, 0, [Bo(G, P), Al("129", P, c)], alt=1)')]),
    ("M42 yoldaki transfer devirde açılmaz (K-07, N-13 tek başına)", [('if y["valor"] > K:\n                ekle("devir_yoldaki"', 'if False:\n                ekle("devir_yoldaki"')]),
    ("M43 POS komisyonu 760'a (2.5.1 kararı erken)", [('POS_KOMISYON = "653"', 'POS_KOMISYON = "760"')]),
    ("M44 103 düzenleyici değil, pasif (§7.2)",
     [('"103": ("Verilen Çekler ve Ödeme Emirleri (−)", "A-", "I.A")', '"103": ("Verilen Çekler ve Ödeme Emirleri (−)", "P", "III.A")')]),
    ("M45 Diğer cari 120'ye (KG-25 B)", [('"diger": "336"', '"diger": "120"')]),
    ("M46 Ocak mahsubu devirle gelen etiketsiz 191'i sayar (V-01, G4)",
     [("if m.sinif == 0 and not etiketli:\n                        continue", "if False:\n                        continue")]),
    ("M47 Devri Yenile çakışma denetimi yok (G7)", [('if cakisma:\n                raise Red("DEVIR_YENILE_CAKISMA"', 'if False:\n                raise Red("DEVIR_YENILE_CAKISMA"')]),
    ("M48 Devri Geri Al devir öncesi yedeğe dönmez (N-15)", [('self.canli = kayit["yedek"]', "pass")]),
    ("M49 şüpheliye alma borç bakiyesiyle sınırlanmaz (J-01)", [('if v["tutar"] > bak:', "if False:")]),
    ("M50 hesapsız hareket banka hesabına (K-14)",
     [('tur="tahsilat" if s < 0 else "odeme"), L(G, -s)])', 'tur="tahsilat" if s < 0 else "odeme"), L("102.B1", -s)])')]),
    ("M51 kural farkı fişi kilit gününe (ilk açık gün değil, KG-15 A)",
     [('f = d.fis_ekle(ertesi(d.kilit), 1, "kural_farki", satirlar)', 'f = d.fis_ekle(d.kilit, 1, "kural_farki", satirlar)')]),
    ("M52 N-07 kâr / zarar hesabı ters (590 ↔ 591)",
     [('L("590" if cari_yil > 0 else "591", -cari_yil)', 'L("591" if cari_yil > 0 else "590", -cari_yil)')]),
    ("M53 gecikmişe fatura girmez (B1 A'ya aykırı)", [('if self.k.B1 != "A":\n                    continue', "if True:\n                    continue")]),
    ("M54 Excel kartında önceden ödenen taksitten düşülmez (KG-5 A, B1)",
     [('self.m(k, k.tarih, ("taksit_odenen", k.id), P, 0)', "pass")]),
    ("M55 kapanmış dosyada hesaplanmış Dönem Net Kârı satırı da yazılır (çift sayım)",
     [("if (c is not None and m.tarih <= c) or m.sinif == 3:", "if m.sinif == 3:")]),
    ("M56 devirde 191'in Ocak'a ertelenen kısmı etiketsiz açılır (KG-7 A, N-13)",
     [('if h == "191" and ertelenen:', "if False:")]),
    ("M57 açık kalem dağıtımında mahsup (F-16) yok sayılır",
     [("for (tarih, k1, k2, tut) in self.gecis().mahsup:", "for (tarih, k1, k2, tut) in []:")]),
]


def mutant_kaynak(src, degisiklikler):
    for eski, yeni in degisiklikler:
        n = src.count(eski)
        if n != 1:
            raise SystemExit(f"mutant parçası kaynakta {n} kez geçiyor (1 olmalı): {eski[:80]!r}")
        src = src.replace(eski, yeni)
    return src


def yukle(src):
    m = types.ModuleType("model")
    m.__file__ = MODEL
    exec(compile(src, MODEL, "exec"), m.__dict__)
    sys.modules["model"] = m
    for ad in ("test_model", "uretici", "uret_beklenen", "senaryolar_elle"):
        sys.modules.pop(ad, None)
    import test_model
    return test_model


def kos(src):
    tm = yukle(src)
    yukleyici = unittest.defaultTestLoader
    suite = unittest.TestSuite()
    for sinif in (tm.Yardimci, tm.OlayMaddeleri, tm.ElleSenaryolar, tm.Rastgele, tm.DegismezDenetcileri):
        suite.addTests(yukleyici.loadTestsFromTestCase(sinif))
    with contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
        r = unittest.TextTestRunner(stream=io.StringIO(), verbosity=0).run(suite)
    adlar = [t.id().split(".")[-1] for t, _ in r.failures + r.errors]
    return r.testsRun, adlar


def main():
    with open(MODEL, encoding="utf-8") as f:
        src = f.read()
    n, kirmizi = kos(src)
    print(f"temel (bozulmamış model): {n} test, {len(kirmizi)} kırmızı")
    if kirmizi or n == 0:
        print("  TEMEL KIRMIZI:", kirmizi)
        return 1
    sag = []
    for ad, degisiklikler in MUTANTLAR:
        n, kirmizi = kos(mutant_kaynak(src, degisiklikler))
        durum = "ÖLDÜ" if kirmizi else "SAĞ KALDI"
        print(f"{ad:<78} {durum:<10} ({len(kirmizi)}/{n} test kırmızı: {', '.join(kirmizi[:3])}{' …' if len(kirmizi) > 3 else ''})")
        if not kirmizi:
            sag.append(ad)
    yukle(src)
    print(f"# tests {len(MUTANTLAR)}")
    print(f"# pass {len(MUTANTLAR) - len(sag)}")
    print(f"# fail {len(sag)}")
    if sag:
        print("SAĞ KALAN:", "; ".join(sag))
    return 1 if sag else 0


if __name__ == "__main__":
    sys.exit(main())
