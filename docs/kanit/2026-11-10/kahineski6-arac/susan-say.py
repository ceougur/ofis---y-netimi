#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 6 (cari) — kâhinin hâlâ SUSTUĞU yerlerin sayımı, bakım 5 ↔ bakım 6 (bakım 5'in kahineski5-arac/susan-say.py düzeni; sınıflar bakım 6'ya göre). Program AÇILMAZ.

  python3 -I susan-say.py --eski <eski test/bagimsiz/cari> --yeni <yeni test/bagimsiz/cari> [--senaryolar <klasör>] [--tohum 10] [--islem 120] [--yalniz <dosya öneki,…>]

Küme: <senaryolar> klasörünün elle senaryoları (varsayılan: ESKİ kopyanınki — G3 kümesi) + rastgele s1 / ux18 tohum 1..N × işlem (--tohum 0: rastgele yok). --yalniz verilirse yalnız
adı bu öneklerle başlayan elle senaryolar. Her KONTROL anında her carinin durumu iki modelde sınıflanır:
  net görünüm tanımsız — okumalar ayrışıyor (bakım 5: SK-9 … SK-12 / bakım 6: SK-17) · Y5-7 (yalın olmayan caride S98) · tanım alanı dışı (karşı yönlü kalem + yalın olmama nedeni: kart,
  taksitli fatura (bakım 6: SK-15), fatura iadesi, şüpheli / değersiz, KS8, KS9, iki yönde iade, tablo, kart tahsilatı);
  belge durumu tanımsız — SK-13 (bakım 5) / Y5-7 / SK-17 / SK-15;
  C13.4 (11) tanımsız cari (kuyruk denetimleri hiç yazılmaz) — EK-2B 32, SK-14, birden çok kalem, taksitli fatura iadesi.
Sayılar cari-kesim (cari × kontrol) başına; ayrıca o carilerde etkin elle kayıt / Ödeme ve fatura sayısı (kalkık denetimin kaba ölçüsü). Son satır "N/M denetim geçti" (yalnız koşu
tamamlandı denetimi)."""
import importlib.util
import json
import os
import subprocess
import sys
from collections import Counter


def arg(ad, vars_=None):
    return sys.argv[sys.argv.index(ad) + 1] if ad in sys.argv else vars_


ESKI, YENI = os.path.abspath(arg("--eski")), os.path.abspath(arg("--yeni"))
TOHUM, ISLEM = int(arg("--tohum", "10")), int(arg("--islem", "120"))
KLASOR = os.path.abspath(arg("--senaryolar", os.path.join(ESKI, "senaryolar")))
YALNIZ = [x for x in (arg("--yalniz", "") or "").split(",") if x]


def yukle(klasor, ad):
    spec = importlib.util.spec_from_file_location(ad, os.path.join(klasor, "model.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ME, MY = yukle(ESKI, "eski_susan6"), yukle(YENI, "yeni_susan6")
SAY = {"eski": Counter(), "yeni": Counter()}


def nd_sinif(neden, yneden):
    n = neden or ""
    if "S98 tek taraflı" in n:
        return "Y5-7"
    if "okumalar ayrışıyor" in n:
        return "okumalar-ayrisiyor"
    return "tanim-alani-disi"


def yalin_neden_kisa(yneden):
    for anahtar, kisa in (("SK-15", "taksitli+karsi(SK-15)"), ("taksitli fatura", "taksitli"), ("taksit kartı", "kart"), ("fatura iadesi", "fatura-iadesi"),
                          ("şüpheli", "supheli-degersiz"), ("iki yönde", "iki-yonde-iade"), ("KS8", "KS8"), ("KS9", "KS9"), ("tabloya", "tablo"), ("kart tahsilatı", "kart-tahsilati")):
        if anahtar in (yneden or ""):
            return kisa
    return "diger"


def t250_sinif(t):
    if "SK-14" in t:
        return "SK-14"
    if "EK-2B 32" in t:
        return "EK-2B-32"
    if "birden çok kalemi" in t:
        return "birden-cok-kalem"
    if "taksitli faturanın iadesi" in t:
        return "taksitli-iade"
    return "diger"


def iz(Taban, etiket):
    class Iz(Taban):
        def kontrol(self, a):
            super().kontrol(a)
            for cad, c in self.cariler.items():
                if c.get("silindi"):
                    continue
                kayit = sum(1 for h in self.hareketler.values() if h["cari"] == cad and h["aktif"] and h["tur"] in ("borc", "alacak", "acilis", "odeme"))
                fat = sum(1 for f in self.faturalar.values() if f["cari"] == cad and f["durum"] == "kesildi")
                SAY[etiket]["cari-kesim"] += 1
                t = "; ".join(sorted(self.tyk250(cad)["neden"]))
                if t:
                    s = t250_sinif(t)
                    SAY[etiket]["C13.4(11):" + s] += 1
                    SAY[etiket]["C13.4(11):" + s + ":kayit"] += kayit
                    continue
                nd = self.net_durum(cad)
                yneden = self._net_uygun(cad)[1] or ""
                if nd[0] == "tanimsiz":
                    s = nd_sinif(nd[1], yneden)
                    if s == "tanim-alani-disi":
                        s += ":" + yalin_neden_kisa(yneden)
                    if s == "okumalar-ayrisiyor":
                        ayr = nd[1].split("↔", 1)[1] if "↔" in nd[1] else ""
                        for sk, iz_ in (("SK-9", "K1/"), ("SK-10", "avans-geri"), ("SK-11/SK-17", "/yukumluluk"), ("SK-11/SK-17", "/odeme"), ("SK-12", "iade-once")):
                            if iz_ in ayr:
                                SAY[etiket]["okuma-ayrisan-soru:" + sk] += 1
                    SAY[etiket]["net-tanimsiz:" + s] += 1
                    SAY[etiket]["net-tanimsiz:" + s + ":kayit"] += kayit
                    SAY[etiket]["net-tanimsiz:" + s + ":fatura"] += fat
                bt = self.belge_tanimsiz(cad) or ""
                if "SK-15" in yneden:
                    bt = bt or "SK-15"
                if bt:
                    s = "Y5-7" if "S98 tek taraflı" in bt else ("SK-13" if "SK-13" in bt else ("SK-17" if "SK-17" in bt else ("SK-15" if "SK-15" in bt else "diger")))
                    SAY[etiket]["belge-tanimsiz:" + s] += 1
                    SAY[etiket]["belge-tanimsiz:" + s + ":fatura"] += fat
    return Iz


IE, IY = iz(ME.Model, "eski"), iz(MY.Model, "yeni")
senaryolar = []
for f in sorted(os.listdir(KLASOR)):
    if f.endswith(".json") and (not YALNIZ or any(f.startswith(x) for x in YALNIZ)):
        with open(os.path.join(KLASOR, f), encoding="utf-8") as g:
            senaryolar.append(json.load(g))
n_elle = len(senaryolar)
for tur in ("s1", "ux18"):
    for t in range(1, TOHUM + 1):
        senaryolar.append(json.loads(subprocess.run([sys.executable, "-I", os.path.join(YENI, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", str(ISLEM)],
                                                    capture_output=True, check=True).stdout))
hata = 0
for sen in senaryolar:
    for I in (IE, IY):
        try:
            I(json.loads(json.dumps(sen)), 0, "2.5.0").kos()
        except SystemExit:
            pass
        except Exception as e:  # noqa: BLE001
            hata += 1
            print("  ✗ %s %s" % (sen.get("ad"), repr(e)[:200]))
print("KÜME: %d elle senaryo (%s%s) + %d rastgele" % (n_elle, KLASOR, (" — yalnız " + ",".join(YALNIZ)) if YALNIZ else "", len(senaryolar) - n_elle))
for etiket in ("eski", "yeni"):
    print("%s (%s): %s" % ("BAKIM 5 (1ab2d1de)" if etiket == "eski" else "BAKIM 6", etiket, " · ".join("%s %d" % kv for kv in sorted(SAY[etiket].items()))))
print("# tests 1")
print("# pass %d" % (1 if hata == 0 else 0))
print("# fail %d" % (0 if hata == 0 else 1))
print("%d/1 denetim geçti" % (1 if hata == 0 else 0))
sys.exit(0 if hata == 0 else 1)
