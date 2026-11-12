"""EX1 kuralının mutantları (14, 21) taşınan olayla değerle mi yakalanıyor — yalnız 4 koşu. python3 -I -B mut-ex1.py <defter klasörü>"""
import importlib.util, json, os, sys
D = sys.argv[1]
s = importlib.util.spec_from_file_location("k", os.path.join(D, "kahin.py")); K = importlib.util.module_from_spec(s); s.loader.exec_module(K)
def duz(o, y=""):
    if isinstance(o, dict):
        r = {}
        for k, v in o.items(): r.update(duz(v, y + "/" + str(k)))
        return r
    return {y: o}
for f, ad in (("senaryo.json", "Excel Kart Müşterisi Ltd."), ("senaryolar/g4-yeni-kayitlar.json", "Elle Excel Müşterisi Ltd.")):
    sen = json.load(open(os.path.join(D, f), encoding="utf-8"))
    t = K.hesapla(sen, None, 0); t.pop("mutasyon")
    print("%s: yeni cari '%s' cari %s · yaşlandırma %s" % (f, ad, t["cari"].get(ad), t["yaslandirma"]["cariler"].get(ad)))
    for m in (14, 21):
        try:
            o = K.hesapla(sen, None, m); o.pop("mutasyon")
        except SystemExit as e:
            print("  m%d ÇÖKTÜ: %s" % (m, e)); continue
        a, b = duz(t), duz(o)
        d = sorted(k for k in set(a) | set(b) if a.get(k) != b.get(k))
        print("  m%d değerle, %d fark:" % (m, len(d)))
        for k in d:
            print("    %s: taban %s → mutant %s" % (k, a.get(k), b.get(k)))
