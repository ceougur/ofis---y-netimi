"""Bakım 2 kırmızı kanıtı (ders 7, 38): YENİ elle beklentiler ESKİ kâhin koduyla (bakım 2'den önceki kahin.py) koşulur.
Kullanım: python3 -I eski-kirmizi.py <yeni kök> <eski kök> [<etiket>]
Eski kökün kahin.py'si kendi ../cari/model.py'sini yükler (iki eski kopya: bakım 18 carisiyle ve bakım 16 carisiyle)."""
import importlib.util
import sys

sys.dont_write_bytecode = True
yeni, eski = sys.argv[1], sys.argv[2]
etiket = sys.argv[3] if len(sys.argv) > 3 else eski


def yukle(ad, yol):
    spec = importlib.util.spec_from_file_location(ad, yol)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


S = yukle("yeni_senaryolar", yeni + "/test/bagimsiz/mobil-yazma/senaryolar.py")
YK = S.kahin
EK = yukle("eski_kahin", eski + "/test/bagimsiz/mobil-yazma/kahin.py")
print("# eski kâhin: %s (cari model %s)" % (etiket, EK._CARI_YOL))
S.kahin = EK   # model_kos eski kâhinle; beklenenler (ELLE, elle_beklenen) YENİ
kirmizi, ayni = 0, 0
for k in S.ELLE:
    for p in (dict(YK.ONERI), S.ESDEGER):
        try:
            f = S.esit(S.model_kos(k["senaryo"], p), S.elle_beklenen(k, p))
        except EK.SenaryoHatasi as e:
            f = ["SenaryoHatasi (eski kâhin): %s" % str(e)[:260]]
        if f:
            kirmizi += 1
            print("KIRMIZI %s [%s]: %d fark" % (k["ad"], YK.birlesim_adi(p), len(f)))
            for x in f[:4]:
                print("    " + x[:300])
        else:
            ayni += 1
print("# toplam %d (senaryo × birleşim): KIRMIZI %d, aynı %d" % (kirmizi + ayni, kirmizi, ayni))
