# Ders 7 / 38: yeni ve değişen ELLE beklentiler ESKİ kâhin kopyasında (değişiklikten önceki kahin.py) beklenen NEDENLE kırmızı mı.
# Kullanım: python3 -I -B eski-kirmizi.py <yeni kök> <eski kök>
import importlib.util, json, os, sys
sys.dont_write_bytecode = True
YENI, ESKI = sys.argv[1], sys.argv[2]


def yukle(ad, yol):
    sp = importlib.util.spec_from_file_location(ad, yol)
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


S = yukle("yeni_senaryolar", os.path.join(YENI, "test/bagimsiz/mobil-yazma/senaryolar.py"))
EK = yukle("eski_kahin", os.path.join(ESKI, "test/bagimsiz/mobil-yazma/kahin.py"))
HEDEF = ("E42-es-s129-gosterge-mobil", "E42-es-s129-gosterge-masaustu", "E05-es-taksit-mobil", "E05-es-taksit-masaustu",
         "E41-es-odenmis-kart-avans-mobil", "E41-es-odenmis-kart-avans-masaustu")
toplam_kirmizi = 0
for k in S.ELLE:
    if k["ad"] not in HEDEF:
        continue
    for p in (S.ILK, dict(S.kahin.ONERI), S.ESDEGER):
        try:
            m = EK.Kahin(k["senaryo"], p).kos()
            fark = S.esit(m, S.elle_beklenen(k, p))
        except Exception as e:   # eski kâhin yeni senaryoyu çalıştıramıyorsa da kırmızıdır — nedeni yazılır
            fark = ["eski kâhin çöktü: %s" % e]
        durum = "KIRMIZI" if fark else "yeşil"
        toplam_kirmizi += bool(fark)
        print("%s %s [%s] %d fark" % (durum, k["ad"], S.kahin.birlesim_adi(p), len(fark)))
        for f in fark[:8]:
            print("   " + f[:260])
print("# kırmızı birleşim-senaryo: %d" % toplam_kirmizi)
