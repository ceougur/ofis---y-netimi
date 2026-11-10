#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 5 (cari) — kâhinin hâlâ SUSTUĞU yerlerin sayımı (G3 kümesi: eski kopyanın elle senaryoları + rastgele s1 / ux18 tohum 1..N × işlem). Program AÇILMAZ.

  python3 -I susan-say.py --eski <eski test/bagimsiz/cari> --yeni <yeni test/bagimsiz/cari> [--tohum 10] [--islem 120]

Her KONTROL anında her carinin durumu iki modelde (bakım 4 ↔ bakım 5) sınıflanır: net görünüm tanımsız (neden sınıfı: tanım alanı dışı — karşı yönlü kalem + kart / iade / KS8 / KS9 / şüpheli …;
okumalar ayrışıyor — bakım 4 SK-6 / SK-8, bakım 5 SK-9 … SK-12; Y5-7 — yalın olmayan caride S98) ve faturanın belge durumu tanımsız (bakım 5 SK-13 / Y5-7). Sayılar cari-kesim
(cari × kontrol) başına; ayrıca o carilerde yazılmayan etkin elle kayıt / fatura / Ödeme sayısı (kalkık denetimin kaba ölçüsü). Son satır "N/M denetim geçti" (yalnız koşu
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


def yukle(klasor, ad):
    spec = importlib.util.spec_from_file_location(ad, os.path.join(klasor, "model.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ME, MY = yukle(ESKI, "eski_susan"), yukle(YENI, "yeni_susan")
SAY = {"eski": Counter(), "yeni": Counter()}
DURUM = {}


def sinif(neden):
    n = neden or ""
    if "S98 tek taraflı" in n:
        return "Y5-7"
    if "okumalar ayrışıyor" in n or "verilen avans satırı" in n:
        return "okumalar-ayrisiyor"
    return "tanim-alani-disi"


def iz(Taban, etiket):
    class Iz(Taban):
        def kontrol(self, a):
            super().kontrol(a)
            for cad, c in self.cariler.items():
                if c.get("silindi"):
                    continue
                nd = self.net_durum(cad)
                kayit = sum(1 for h in self.hareketler.values() if h["cari"] == cad and h["aktif"] and h["tur"] in ("borc", "alacak", "acilis", "odeme"))
                fat = sum(1 for f in self.faturalar.values() if f["cari"] == cad and f["durum"] == "kesildi")
                if nd[0] == "tanimsiz":
                    s = sinif(nd[1])
                    SAY[etiket]["net-tanimsiz:" + s] += 1
                    if etiket == "yeni" and s == "okumalar-ayrisiyor":
                        # bakım 5: hangi soru (ayrışan okumanın adı) — K1 → SK-9, avans-geri → SK-10, yukumluluk / odeme → SK-11, iade-once → SK-12
                        ayr = nd[1].split("↔", 1)[1] if "↔" in nd[1] else ""
                        for sk, iz_ in (("SK-9", "K1/"), ("SK-10", "avans-geri"), ("SK-11", "/yukumluluk"), ("SK-11", "/odeme"), ("SK-12", "iade-once")):
                            if iz_ in ayr:
                                SAY[etiket]["okuma-ayrisan-soru:" + sk] += 1
                    SAY[etiket]["net-tanimsiz:" + s + ":kayit"] += kayit
                    SAY[etiket]["net-tanimsiz:" + s + ":fatura"] += fat
                bt = self.belge_tanimsiz(cad) if hasattr(self, "belge_tanimsiz") else None
                if bt:
                    s = "Y5-7" if "S98 tek taraflı" in bt else "SK-13"
                    SAY[etiket]["belge-tanimsiz:" + s] += 1
                    SAY[etiket]["belge-tanimsiz:" + s + ":fatura"] += fat
                SAY[etiket]["cari-kesim"] += 1
    return Iz


IE, IY = iz(ME.Model, "eski"), iz(MY.Model, "yeni")
senaryolar = []
d = os.path.join(ESKI, "senaryolar")
for f in sorted(os.listdir(d)):
    if f.endswith(".json"):
        with open(os.path.join(d, f), encoding="utf-8") as g:
            senaryolar.append(json.load(g))
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
for etiket in ("eski", "yeni"):
    print("%s (%s): %s" % ("BAKIM 4 (14e3f4bb)" if etiket == "eski" else "BAKIM 5", etiket, " · ".join("%s %d" % kv for kv in sorted(SAY[etiket].items()))))
print("# tests 1")
print("# pass %d" % (1 if hata == 0 else 0))
print("# fail %d" % (0 if hata == 0 else 1))
print("%d/1 denetim geçti" % (1 if hata == 0 else 0))
sys.exit(0 if hata == 0 else 1)
