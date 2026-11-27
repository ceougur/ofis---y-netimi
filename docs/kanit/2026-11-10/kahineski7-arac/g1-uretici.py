#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 7 (cari) — G1: rastgele üretici (`uretici.py`) fatura / iade tarihlerini senaryo içinde sıralı üretiyor mu (DEĞİŞTİRMEZ; yalnız ölçer). Program AÇILMAZ.

  python3 -I g1-uretici.py <cari klasörü (uretici.py)> [--tohum 30] [--islem 120,400]

Her (tur ∈ {s1, ux18}, tohum 1..N, işlem sayısı) için üretilen senaryoda g1-tara.py'nin dar okuması (satış faturası + iade) ve `--sert` okuması (alış dahil) ihlal sayar.
Ayrıca senaryodaki BÜTÜN tarihli adımların tarih sırası (üreticinin kendi kuralı: gün geri gitmez) ölçülür. Son satır "N/M denetim geçti"."""
import importlib.util
import json
import os
import subprocess
import sys

K = os.path.abspath(sys.argv[1])
TOHUM = int(sys.argv[sys.argv.index("--tohum") + 1]) if "--tohum" in sys.argv else 30
ISLEMLER = [int(x) for x in (sys.argv[sys.argv.index("--islem") + 1] if "--islem" in sys.argv else "120,400").split(",")]
spec = importlib.util.spec_from_file_location("g1tara", os.path.join(os.path.dirname(os.path.abspath(__file__)), "g1-tara.py"))
G = importlib.util.module_from_spec(spec)
spec.loader.exec_module(G)

gecen = kalan = 0
sayac = {"senaryo": 0, "seri_adim": 0, "alis_adim": 0, "sert_ihlal": 0, "tum_tarih_ihlal": 0}
for tur in ("s1", "ux18"):
    for islem in ISLEMLER:
        for t in range(1, TOHUM + 1):
            sen = json.loads(subprocess.run([sys.executable, "-I", os.path.join(K, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", str(islem)],
                                            capture_output=True, check=True).stdout)
            sayac["senaryo"] += 1
            sayac["seri_adim"] += sum(1 for a in sen["adimlar"] if G.seri_mi(a, False))
            sayac["alis_adim"] += sum(1 for a in sen["adimlar"] if a.get("islem") == "fatura" and a.get("tur") == "alis")
            iy = G.ihlaller(sen)
            sayac["sert_ihlal"] += len(G.ihlaller(sen, True))
            onceki = None
            for a in sen["adimlar"]:
                if a.get("tarih") and a.get("islem") not in ("cari_ac",):
                    if onceki and a["tarih"] < onceki:
                        sayac["tum_tarih_ihlal"] += 1
                    onceki = max(onceki or a["tarih"], a["tarih"])
            if iy:
                kalan += 1
                print("  ✗ %s tohum %d × %d: %d ihlal — %s" % (tur, t, islem, len(iy), iy[:3]))
            else:
                gecen += 1
print("G1 ÜRETİCİ: %d senaryo (s1 + ux18 × tohum 1–%d × işlem %s); seriden numara alan adım %d, alış faturası %d; dar ihlal %d senaryo; --sert ihlal %d adım; bütün tarihli adımlarda geri giden tarih %d"
      % (sayac["senaryo"], TOHUM, "/".join(map(str, ISLEMLER)), sayac["seri_adim"], sayac["alis_adim"], kalan, sayac["sert_ihlal"], sayac["tum_tarih_ihlal"]))
toplam = gecen + kalan
print("# tests %d" % toplam)
print("# pass %d" % gecen)
print("# fail %d" % kalan)
print("%d/%d denetim geçti" % (gecen, toplam))
sys.exit(0 if kalan == 0 else 1)
