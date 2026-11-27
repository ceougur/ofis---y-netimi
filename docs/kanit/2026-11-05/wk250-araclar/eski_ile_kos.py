"""Yeni / değişen senaryoları verilen klasördeki kâhinle (eski kopya) koşar: elle beklenen ↔ model. KIRMIZI = elle tutmuyor ya da kâhin senaryoyu tanımıyor."""
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin  # noqa: E402
import senaryolar  # noqa: E402

DEGISEN = {"HESAP-0", "J9-01-n3-iptal-sonrasi-ikinci-is-gec-teslim-iki-ileti", "J9-02-n3-basarisiz-sonrasi-ikinci-is-gec-teslim-iki-ileti"}
kirmizi = ayni = 0
for s in senaryolar.tum_senaryolar():
    if s["baslik"] not in senaryolar.YENI_250 and s["ad"] not in DEGISEN:
        continue
    try:
        b = kahin.hesapla(senaryolar.girdi(s))
        f = senaryolar.elle_denetle(s, b)
    except Exception as e:  # noqa: BLE001
        f = [f"istisna {type(e).__name__}: {e}"]
    if f:
        kirmizi += 1
        print(f"KIRMIZI {s['ad']}: {len(f)} fark — {f[0][:230]}")
    else:
        ayni += 1
        print(f"AYNI    {s['ad']}")
print(f"# eski kâhinle: {kirmizi} KIRMIZI, {ayni} AYNI (toplam {kirmizi + ayni})")
