#!/usr/bin/env python3
"""WK 17: yeni / değişen senaryoların ELLE beklenenini ESKİ kâhinle (taban 7d6c6369, değişiklikten önce alınmış kopya) karşılaştırır.
Kullanım: python3 -I eski_kahinle.py <yeni kahin klasörü> <eski kahin.py> [--notr <nötr kopya yolu>]
--notr: eski kâhinin YALNIZ üç "KULLANICIYA SORULMALI … kodlanmadı" hata satırı `None and ValueError(…)` ile etkisiz kılınmış kopyası yazılır ve onunla koşulur (kural eklenmez)."""
import hashlib
import importlib.util
import sys

sys.dont_write_bytecode = True
yeni_klasor, eski_yol = sys.argv[1], sys.argv[2]
notr = sys.argv[sys.argv.index("--notr") + 1] if "--notr" in sys.argv else None
sys.path.insert(0, yeni_klasor)
import senaryolar  # noqa: E402  (yeni senaryolar; elle_denetle yalnız yol_al kullanır — iki kâhinde aynı)

kaynak = open(eski_yol, encoding="utf-8").read()
print(f"eski kahin.py sha256 {hashlib.sha256(kaynak.encode('utf-8')).hexdigest()}")
if notr:
    satirlar = ('raise ValueError("KULLANICIYA SORULMALI (README §18.4, S16 elemenin anı)',
                'raise ValueError("KULLANICIYA SORULMALI S30-a (README §21.7)',
                'raise ValueError("KULLANICIYA SORULMALI S31-a (README §21.7)')
    for s_ in satirlar:
        assert kaynak.count(s_) == 1, s_
        kaynak = kaynak.replace(s_, "None and " + s_[len("raise "):])
    open(notr, "w", encoding="utf-8").write(kaynak)
    eski_yol = notr
    print(f"nötr kopya {notr} (3 hata satırı etkisiz; sha256 {hashlib.sha256(kaynak.encode('utf-8')).hexdigest()})")
spec = importlib.util.spec_from_file_location("kahin_eski", eski_yol)
eski = importlib.util.module_from_spec(spec)
spec.loader.exec_module(eski)

YENI = ("S34", "S35", "S36", "S37", "S38", "S33", "S41")
DEGISEN = ("S16-02", "S30-01", "S30-02", "S30-03")
kirmizi = ayni = 0
for s in senaryolar.SENARYOLAR:
    if not (s["baslik"] in YENI or any(s["ad"].startswith(d) for d in DEGISEN)):
        continue
    tur = "değişen" if s["baslik"] not in YENI else "yeni"
    try:
        b = eski.hesapla(senaryolar.girdi(s))
    except Exception as e:  # noqa: BLE001
        kirmizi += 1
        print(f"KIRMIZI ({tur}) {s['ad']}: {type(e).__name__}: {str(e)[:230]}")
        continue
    f = senaryolar.elle_denetle(s, b)
    if f:
        kirmizi += 1
        print(f"KIRMIZI ({tur}) {s['ad']}: {len(f)} fark")
        for x in f[:4]:
            print(f"    {x[:330]}")
    else:
        ayni += 1
        print(f"AYNI ({tur}) {s['ad']}")
print(f"özet: {kirmizi} KIRMIZI, {ayni} AYNI")
