#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WK 15: YENİ senaryolar (S23, SW3 başlıkları; yeni senaryolar.py'den) ESKİ kâhinle (argv[1] klasöründeki kahin.py) koşulur; her senaryo için
KIRMIZI (eski model elle beklenene uymuyor — ilk farklar) / HATA (eski kâhin düşüyor — neden) / AYNI yazılır.
Özet satırları (kanit.mjs): tests = yeni senaryo sayısı, pass = eski kâhinde KIRMIZI olan (beklenen: kural eski kâhinde yok), fail = AYNI; çıkış 1 yalnız AYNI varsa.
Kırmızının NEDENİ (ders 38) çıktıdaki ilk farklardan / hata iletisinden okunur — araç nedeni yargılamaz.
Kullanım: python3 -I eski_kahinle.py <eski kahin klasörü> <yeni kahin klasörü>"""
import importlib.util
import sys

sys.dont_write_bytecode = True
eski_dizin, yeni_dizin = sys.argv[1], sys.argv[2]
sys.path.insert(0, yeni_dizin)
import senaryolar  # noqa: E402  (yeni senaryolar + yeni kahin — yalnız senaryo tanımı ve elle_denetle için)

spec = importlib.util.spec_from_file_location("eski_kahin", f"{eski_dizin}/kahin.py")
eski = importlib.util.module_from_spec(spec)
spec.loader.exec_module(eski)

yeni_s = [s for s in senaryolar.SENARYOLAR if s["baslik"] in ("S23", "SW3")]
kirmizi = hata = ayni = 0
for s in yeni_s:
    try:
        b = eski.hesapla(senaryolar.girdi(s))
    except Exception as e:  # noqa: BLE001
        hata += 1
        print(f"KIRMIZI (HATA) {s['ad']}: {type(e).__name__}: {str(e)[:220]}")
        continue
    f = senaryolar.elle_denetle(s, b)
    if f:
        kirmizi += 1
        print(f"KIRMIZI (DEĞER) {s['ad']}: {len(f)} fark")
        for x in f[:6]:
            print(f"    {x[len(s['ad']) + 1:][:330]}")
    else:
        ayni += 1
        print(f"AYNI {s['ad']}")
print(f"yeni {len(yeni_s)} senaryo: {kirmizi + hata} KIRMIZI ({hata} hata, {kirmizi} değer), {ayni} AYNI")
print(f"1..{len(yeni_s)}")
for ad_, n_ in (("tests", len(yeni_s)), ("pass", kirmizi + hata), ("fail", ayni), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad_} {n_}")
sys.exit(1 if ayni else 0)
