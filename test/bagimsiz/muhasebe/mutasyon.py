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
    ("M15 gelir tablosu dönem sonu sınıfını (N-01) dışlar (§4)",
     [('if m.tarih < a or m.sinif == 3:\n                continue\n            for s in m.satirlar:\n                h = s["h"]',
       'if m.tarih < a or m.sinif >= 2:\n                continue\n            for s in m.satirlar:\n                h = s["h"]')]),
    ("M16 bilançoda tahmini SMM yok, gelir tablosunda var (YÜKSEK-1)", [("R[y] -= smm", "pass")]),
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
    ("M28 onaylı 'Açılış Olabilir' 602.90'a (KG-16 A)", [('acilis = v.get("onay") is True', "acilis = False")]),
    ("M29 kilitli döneme yazım kabul (Ç3, 409)", [("if self.kilit is not None and tarih <= self.kilit:", "if False:")]),
    ("M30 POS valöründe iade düşülmez (D-04)",
     [('net = it["brut"] - it["iade"] - kom_kalan\n                self.madde(kk, it["valor"], 1, [Bo("102." + b, net), Al("108." + p, net)]',
       'net = it["brut"] - kom_kalan\n                self.madde(kk, it["valor"], 1, [Bo("102." + b, net), Al("108." + p, net)]')]),
    ("M33 devirde bekleyen POS açılmaz (N-11)", [('if it.get("gecersiz") or it["valor"] <= K:', "if True:")]),
    ("M34 açılış eşleştirme G'yi ters bakiyeye geçirebilir (M-11)",
     [("if g0 == 0 or (g0 > 0 and not 0 <= g1 < g0) or (g0 < 0 and not g0 < g1 <= 0):", "if g0 == 0:")]),
    ("M36 KG-3 A (onaylanan): kayıt tahsilatı gelire", [("return CARISIZ_PASIF if kayit else CARISIZ_GELIR", "return CARISIZ_GELIR")]),
    ("M37 borçlu 360 pasifte eksi kalır (KG-14)", [('if ters and tr == "KG14":', "if False:")]),
    ("M40 tahmini SMM'de dönem başı değeri yok (KG-11 A)", [("v0 = self.deger(onceki(ya))", "v0 = 0")]),
    ("M41 devirde açık şüpheli karşılığı açılmaz (N-12)",
     [('if P:\n            self.madde(k, k.tarih, 0, [Bo(G, P), Al("129", P, c)], alt=1)',
       'if False:\n            self.madde(k, k.tarih, 0, [Bo(G, P), Al("129", P, c)], alt=1)')]),
    ("M42 yoldaki transfer devirde açılmaz (K-07, N-13 tek başına)", [('if y["valor"] > K:\n                ekle("devir_yoldaki"', 'if False:\n                ekle("devir_yoldaki"')]),
    ("M43 POS komisyonu 760'a (2.5.1 kararı erken)", [('POS_KOMISYON = "653"', 'POS_KOMISYON = "760"')]),
    ("M44 103 düzenleyici değil, pasif (§7.2)",
     [('"103": ("Verilen Çekler ve Ödeme Emirleri (−)", "A-", "I.A")', '"103": ("Verilen Çekler ve Ödeme Emirleri (−)", "P", "III.A")')]),
    ("M45 Diğer cari 120'ye (KG-25 B)", [('"diger": "336"', '"diger": "120"')]),
    ("M47 Devri Yenile çakışma denetimi yok (G7)", [('if cakisma:\n                raise Red("DEVIR_YENILE_CAKISMA"', 'if False:\n                raise Red("DEVIR_YENILE_CAKISMA"')]),
    ("M48 Devri Geri Al devir öncesi yedeğe dönmez (N-15)", [('self.canli = kayit["yedek"]', "pass")]),
    ("M49 şüpheliye alma borç bakiyesiyle sınırlanmaz (J-01)", [('if v["tutar"] > bak:', "if False:")]),
    ("M51 kural farkı fişi kilit gününe (ilk açık gün değil, KG-15 A)",
     [('f = d.fis_ekle(ertesi(d.kilit), 1, "kural_farki", satirlar)', 'f = d.fis_ekle(d.kilit, 1, "kural_farki", satirlar)')]),
    ("M54 Excel kartında önceden ödenen taksitten düşülmez (KG-5 A, B1; TYK'de kart_ac)",
     [('P = kt.get("odenen", 0) if (kt["kaynak"] == "excel" and self.k.KG5 == "A") else 0', "P = 0")]),
    ("M55 kapanmış dosyada hesaplanmış Dönem Net Kârı satırı da yazılır (çift sayım)",
     [("if (c is not None and m.tarih <= c) or m.sinif == 3:", "if m.sinif == 3:")]),
    ("M02 açık kalemin defter karşılığı gelir / gider (G14, N-10, M3 satırı)",
     [('[L(self.ch(c), t, c, k="devir:" + c, tur="devir_cari"), L(G, -t)])', '[L(self.ch(c), t, c, k="devir:" + c, tur="devir_cari"), L("600" if t > 0 else "770", -t)])')]),
    ("M14 cari kalemleri açık kalemler düşülmeden (G2, M2 net kalan)",
     [("artik = ch_bal - sum(isaret(x) for x in ayri) - kart_top", "artik = ch_bal - kart_top")]),
    ("M17 KG-12 A'da önceki yıllar ayrılmaz (M4 fişi yok)",
     [('if self.k.KG12 == "A":                       # KG-12 A + M4', 'if False:                       # KG-12 A + M4')]),
    ("M26 karşılık çözülmesi yok (J-04 / K6)", [('if r["karsilik"] > r["kalan"]:           # J-04 / K6', "if False:           # J-04 / K6")]),
    ("M27 KG-5 A'da önceden ödenen de maddelenir",
     [('T - P, c, k="taksit:" + k.id, tur="taksit", vade=ilk, kart=k.id), Al(G, T - P)', 'T, c, k="taksit:" + k.id, tur="taksit", vade=ilk, kart=k.id), Al(G, T)')]),
    ("M31 bağ (Kapatılacak Fatura / iade / kart) hedefini kapatmaz (EK-1 §1 adım 3)",
     [('if o["link"]:\n                        q.bagla(o, q.hedefler(o["link"]))', 'if False:\n                        q.bagla(o, q.hedefler(o["link"]))')]),
    ("M32 vadesi bugün olan gecikmiş sayılır (M1f)", [('if o["vade"] < t:', 'if o["vade"] <= t:')]),
    ("M35 KG-7 A'da KDV indirim dönemi alanı yok sayılır",
     [('ia = e.get("indirim_ayi") if (s["h"] == "191" and kg7 == "A") else None', "ia = None")]),
    ("M38 kural farkı düzeltme fişi ters yönde (KG-15 A, N-16)",
     [("satirlar = [L(h, v, c) for (h, c), v in sorted(top.items()", "satirlar = [L(h, -v, c) for (h, c), v in sorted(top.items()")]),
    ("M39 ekstrede açık alış kalemi Alacak Toplamı'ndan düşülmez (M12)",
     [('at = ha - sum(x["kalan"] for x in ayri if x["taraf"] == "a")', "at = ha")]),
    ("M46 devir açılışında 191 dönem etiketi kaybolur (M8-3, M8-4)",
     [("tamam.append(L(h, x, None, donem=dn))", "tamam.append(L(h, x, None))")]),
    ("M50 hesapsız hareket banka hesabına (K-14)", [("+ sup + [L(G, -s)])", '+ sup + [L("102.B1", -s)])')]),
    ("M52 N-07 kâr / zarar hesabı ters (590 ↔ 591)",
     [('L("590" if sonuc > 0 else "591", -sonuc)', 'L("591" if sonuc > 0 else "590", -sonuc)')]),
    ("M53 gecikmişe fatura girmez (B1 A'ya aykırı)", [('if self.k.B1 != "A" and o["tur"] == "fatura":', 'if o["tur"] == "fatura":')]),
    ("M56 devirde 191 / 391 dönemlere bölünmez (M8-3)",
     [("if h in KDV_HESAPLARI:\n                for (hh, dn), x in sorted(et.items()", "if False:\n                for (hh, dn), x in sorted(et.items()")]),
    ("M57 açık kalem dağıtımında mahsup (F-16) yok sayılır",
     [("for (tarih, seq, k1, k2, tut) in g.mahsup:", "for (tarih, seq, k1, k2, tut) in []:")]),
    # ---- EK-1 + S1–S5 + KG-3 (bakım 05.11.2026)
    ("N01 S1: vadesiz kalem hiç gecikmez", [('"vade": vade or tarih, "sira": tuple(sira)', '"vade": vade or "9999-12-31", "sira": tuple(sira)')]),
    ("N02 S2: bağsız ödeme belge tarihi sırasıyla", [('return (o["vade"], o["tarih"], o["sira"])', 'return (o["tarih"], o["sira"])')]),
    ("N03 S2: eşit vadede giriş sırası (belge tarihi yok sayılır)", [('return (o["vade"], o["tarih"], o["sira"])', 'return (o["vade"], o["sira"])')]),
    ("N04 S3: şüpheli tutar gecikmişe girer", [('"gecikmis": top, "supheli": sup,', '"gecikmis": top + sup, "supheli": sup,')]),
    ("N05 S3: şüpheli carisi otomatik hatırlatmadan tümüyle çıkar (tutar değil cari bazında)",
     [('if g["gecikmis"] > 0:\n                oto[c]', 'if g["gecikmis"] > 0 and not g["supheli"]:\n                oto[c]')]),
    ("N06 M13: Şüpheliden Çıkar kalemleri çıkarma günü vadesiyle döner",
     [('self.ekle(x["k"], x["tur"], "b", x["kalan"], x["tarih"], x["vade"], x["sira"])', 'self.ekle(x["k"], x["tur"], "b", x["kalan"], tarih, tarih, sira)')]),
    ("N07 M13: J-01 şüpheli kuyruğuna taşımaz (bağsız alacak gibi)",
     [('q.supheliye(tutar, m.tarih, sira, e.get("kayit"))', 'q.ekle(None, "x", "a", tutar, m.tarih, None, sira)\n                    q.net()')]),
    ("N08 S4: mahsupta 191 brüt (eksi net hareket sayılmaz)", [('I = et.get(("191", ay), 0)', 'I = max(0, et.get(("191", ay), 0))')]),
    ("N09 S4: ters kayıt asıl kaydın ayına etiketlenir", [("k.tarih, zorla=k.tarih[:7])", "k.tarih)")]),
    ("N10 S4: KDV Mahsubu Güncel Değil uyarısı yok",
     [('if et.get(("191", ay), 0) or et.get(("391", ay), 0):\n                    kd.append(f"KDV_MAHSUBU_GUNCEL_DEGIL', 'if False:\n                    kd.append(f"KDV_MAHSUBU_GUNCEL_DEGIL')]),
    ("N11 M8-4: Aralık KDV mahsubu yapılmamış uyarısı yok",
     [('if any(v and dn and int(dn[:4]) < yil(t) for (h, dn), v in et.items()):', "if False:")]),
    ("N12 S5: ayrıca bağlanan tahsilat da faturayla düşer", [('if v.get("fatura") and v.get("fatura_odemesi"):', 'if v.get("fatura"):')]),
    ("N13 M2: devir açık kalemi K+1 vadesiyle",
     [('"tarih": o["tarih"],\n                                 "vade": o["vade"], "sira": list(o["sira"])})', '"tarih": o["tarih"],\n                                 "vade": t, "sira": list(o["sira"])})')]),
    ("N14 M2 B: yalnız faturalar ayrı açık kalem (Borç Yaz / açılış net satırda)",
     [('elif o["taraf"] == "b" or o["tur"] == "fatura":', 'elif o["tur"] == "fatura":')]),
    ("N15 M3 B: defterde her açık kalem ayrı satır",
     [('[L(self.ch(c), t, c, k="devir:" + c, tur="devir_cari"), L(G, -t)])',
       '[L(self.ch(c), x["kalan"] if x["taraf"] == "b" else -x["kalan"], c, k="devir:" + c, tur="devir_cari") for x in k.v.get("kalemler", [])]'
       ' + [L(self.ch(c), t - sum(x["kalan"] if x["taraf"] == "b" else -x["kalan"] for x in k.v.get("kalemler", [])), c, k="devir:" + c, tur="devir_cari"), L(G, -t)])')]),
    ("N16 M4 B: önceki yıl sonucu o yılın 31 Aralık'ına (kilitli döneme)",
     [('arsiv.fis_ekle(K, 3, "onceki_yil_sonucu"', 'arsiv.fis_ekle(yb, 3, "onceki_yil_sonucu"')]),
    ("N17 M4: 570 / 580 netleştirilir (yıl yıl brüt değil)", [('sat.append(L("570" if R > 0 else "580", -R))', 'sat.append(L("570", -R))')]),
    ("N18 M5 B: eksi stok miktarı 0 devreder",
     [('kal = [{"urun": u, "miktar": x["miktar"], "deger": x["deger"]}', 'kal = [{"urun": u, "miktar": str(max(Fraction(x["miktar"]), Fraction(0))), "deger": x["deger"]}')]),
    ("N19 M7 B: önceki mali yılın farkı da 602 / 770'e", [("if sonuc_hesabi(h) and y < fis_yili:", "if False:")]),
    ("N20 M11: K 31 Aralık değilse de devir yapılır", [('if K[5:] != "12-31":', "if False:")]),
    ("N21 M11: ileri tarihli K kabul edilir", [('if o.get("bugun") and K >= o["bugun"]:', "if False:")]),
    ("N22 M12: bakiyesi 0 cariye devir / ekstre satırı", [("if not ch_bal:                            # M12", "if False:                            # M12")]),
    ("N23 M1d: kapatılan kartın kalanı kuyruktan düşer", [('if top:\n            kk["kalani"].append', 'if False:\n            kk["kalani"].append')]),
    ("N24 M1e: Mevcut Borç kartı alttaki borcu tüketmez",
     [('for y in self.acik("b"):\n                if y["kart"]:', 'for y in []:\n                if y["kart"]:')]),
    ("N25 bağ, hedefin bağsız kapanmış kısmını geri almaz (bağlar önce)",
     [("for y in hedefler:                           # 2. geçiş", "for y in []:                           # 2. geçiş")]),
    ("N26 M14: gider türü seçilmemiş alış 770'e", [('return GIDER_HESAP.get(v.get("gider_turu"), SINIFLANDIRILMAMIS_GIDER)', 'return GIDER_HESAP.get(v.get("gider_turu"), "770")')]),
    ("N27 M9: kısmi düşüşte de Devri Yenile çakışması",
     [("cakisma = [f for f, b in bagli.items() if b and not yeni_acik.get(f, 0)]", "cakisma = [f for f, b in bagli.items() if b and yeni_acik.get(f, 0) < b]")]),
    # ---- ana oturum ek maddeleri (K3 şüpheli alacak satırları, R-04 fatura geri yükleme)
    ("N28 K3: alacak satırı şüpheliden düşmez (tahsilat)",
     [("sup, cozulme, kalan = self._supheliden_dus(k, c, t, kart_t) if uygun else ([], [], t)", "sup, cozulme, kalan = ([], [], t)")]),
    ("N29 K3: Normal Cari Hesaba İşle yok sayılır", [('uygun = not v.get("normal_cari") and not v.get("fatura")', 'uygun = not v.get("fatura")')]),
    ("N30 K3: birden çok kayıtta en yeni önce", [('for r in self.supheli.get(c, []):\n            if kalan <= 0:', 'for r in reversed(self.supheli.get(c, [])):\n            if kalan <= 0:')]),
    ("N31 K3 (c): taksit tahsilatında kart tarihi kapısı yok",
     [('or (kart_tarihi is not None and kart_tarihi > r["tarih"]):', ":")]),
    ("N32 K3: Mevcut Borç kartının taksiti de tarih kapısına girer",
     [('if kt is not None and kt.get("ilk_kaynak", kt["kaynak"]) != "mevcut_borc":', "if kt is not None:")]),
    ("N33 K3 SINIR: normal tahsilat 120 bakiyesini aşabilir", [('if acik and v["tutar"] > bak:', "if False:")]),
    ("N34 K3: aynı gün sırası girilme sırasına göre (al → alacak satırı değil)", [('GUN_SINIFI = {"supheliye_al": 0,', 'GUN_SINIFI = {"supheliye_al": 3,')]),
    ("N35 K3: satıştan iade şüpheliden düşmez", [("sup, cozulme, kalan = self._supheliden_dus(k, c, M + K)", "sup, cozulme, kalan = ([], [], M + K)")]),
    ("N36 K3: Alacak Yaz şüpheliden düşmez",
     [("sup, cozulme, kalan = ([], [], t) if (borc or acilis) else self._supheliden_dus(k, c, t)", "sup, cozulme, kalan = ([], [], t)")]),
    ("N37 silinen kaydedilmiş fatura geri yüklenince etkin döner", [('k.durum = "iptal"                         # kaydedilmiş', 'k.durum = "aktif"                         # kaydedilmiş')]),
    ("N38 KG-3 A: carisiz Kasa girişi de 336.90'a (onaylanan metne aykırı)", [("return CARISIZ_PASIF if kayit else CARISIZ_GELIR", "return CARISIZ_PASIF")]),
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
    for sinif in (tm.Yardimci, tm.OlayMaddeleri, tm.ElleSenaryolar, tm.Rastgele, tm.DegismezDenetcileri):  # SenaryoHijyeni, Dosyalar hariç
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
