"""Bakım 2 geliştirme denetimi: seçilen elle senaryolar öneri + ESDEGER (+ isteğe bağlı bütün) birleşimlerinde model = elle mi; sus notları."""
import importlib.util
import sys
import time

sys.dont_write_bytecode = True
W = sys.argv[1]
adlar = sys.argv[2].split(",")
tam = "--tam" in sys.argv
spec = importlib.util.spec_from_file_location("senaryolar", W + "/test/bagimsiz/mobil-yazma/senaryolar.py")
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
kahin = S.kahin
t0 = time.time()
for k in S.ELLE:
    if not any(k["ad"].startswith(a) for a in adlar):
        continue
    bl = None if tam else [dict(kahin.ONERI), S.ESDEGER, dict(kahin.ONERI, taksit="yalniz_cari"), dict(kahin.ONERI, onay="gecemez")]
    try:
        f, _ = S.elle_denetle(k, bl)
    except kahin.SenaryoHatasi as e:
        f = ["SenaryoHatasi: %s" % e]
    print(k["ad"], "FARK %d" % len(f) if f else "AYNI")
    for x in f[:6]:
        print("   ", x[:400])
    m = kahin.Kahin(k["senaryo"], dict(kahin.ONERI))
    m.kos()
    for n in m.sus_notlari:
        print("    SUS:", n[:300])
print("# süre %.1f sn" % (time.time() - t0))
