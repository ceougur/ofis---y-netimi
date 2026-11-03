"""Yeni senaryo kümesinin (yeni elle beklenen) ESKİ kâhin modeliyle karşılaştırması: kâhin güncellemesi 10'un dişi (eski kâhinde kırmızı).
Kullanım: python3 -I eski_kahinle.py <eski kahin klasörü> <yeni kahin klasörü> [ad önekleri,virgüllü]"""
import importlib.util, json, sys
def yukle(yol, ad):
    spec = importlib.util.spec_from_file_location(ad, yol); m = importlib.util.module_from_spec(spec); sys.modules[ad] = m; spec.loader.exec_module(m); return m
eski_dir, yeni_dir = sys.argv[1], sys.argv[2]
onekler = sys.argv[3].split(",") if len(sys.argv) > 3 else None
yeni_kahin = yukle(yeni_dir + "/kahin.py", "kahin")
yeni_sen = yukle(yeni_dir + "/senaryolar.py", "senaryolar")
TUM = yeni_sen.tum_senaryolar()
eski_kahin = yukle(eski_dir + "/kahin.py", "kahin_eski")
kirmizi = yesil = 0
for s in TUM:
    if onekler and not any(s["ad"].startswith(o) for o in onekler):
        continue
    b = eski_kahin.hesapla(yeni_sen.girdi(s))
    sys.modules["kahin"] = eski_kahin            # elle_denetle kahin.yol_al kullanır (aynı)
    f = yeni_sen.elle_denetle(s, b)
    sys.modules["kahin"] = yeni_kahin
    if f:
        kirmizi += 1
        print(f"KIRMIZI (eski kâhin ≠ yeni elle) {s['ad']}: {len(f)} fark")
        for x in f[:4]:
            print("   ", x[:260])
    else:
        yesil += 1
        print(f"AYNI {s['ad']}")
print(f"# eski kâhinle: {kirmizi} kırmızı, {yesil} aynı")
