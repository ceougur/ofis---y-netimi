"""Kâhin bakımı 8 (S110): kâhinin (programın DEĞİL) verilen kopyasının kararın örneğindeki okuması — §20 "Kâhinin BUGÜNKÜ okuması". Program AÇILMAZ.
Kullanım: python3 -I -B eski-okuma.py <cari kâhini klasörü (model.py)>"""
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("m", sys.argv[1] + "/model.py"); M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
K = {"id": "k1", "islem": "kontrol", "gecikmis": True, "gorunumToplam": True, "acikToplam": True}
def sen(adim, bugun="2026-04-15"):
    return {"dil": "destekofis-cari/3", "ad": "x", "bugun": bugun, "adimlar": adim + [K]}
CA = {"id": "ca", "islem": "cari_ac", "ad": "A", "isim": "Ali", "tarih": "2026-02-01"}
KRT = {"id": "ak", "islem": "kart_ac", "ad": "KA", "cari": "A", "tutar": "900", "taksit": 3, "ilkVade": "2026-04-01", "tarih": "2026-03-15", "mevcut": True}
A = [CA, {"id": "af", "islem": "fatura", "ad": "AF", "cari": "A", "tutar": "600", "tarih": "2026-03-01"},
     {"id": "ab", "islem": "borc", "cari": "A", "tutar": "900", "tarih": "2026-03-05", "vade": "2026-03-10"}, KRT]
B = [CA, {"id": "ab", "islem": "borc", "cari": "A", "tutar": "900", "tarih": "2026-03-01"},
     {"id": "af", "islem": "fatura", "ad": "AF", "cari": "A", "tutar": "600", "tarih": "2026-03-05"}, KRT]
C = [CA, {"id": "ab", "islem": "borc", "cari": "A", "tutar": "900", "tarih": "2026-03-01"},
     {"id": "as", "islem": "stok_satis_taksit", "ad": "KA", "cari": "A", "tutar": "600", "tarih": "2026-03-05", "taksit": 2, "ilkVade": "2026-04-01"}]
D = [CA, {"id": "ab", "islem": "borc", "cari": "A", "tutar": "900", "tarih": "2026-03-01"},
     {"id": "af", "islem": "fatura", "ad": "AF", "cari": "A", "tutar": "600", "tarih": "2026-03-05"}, dict(KRT, tutar="500", taksit=2)]
for ad, x in (("F-once", A), ("Borc-once", B), ("satis-kart", C), ("Borc-once-kart500", D)):
    r = M.Model(sen(x), 0, "2.5.0").kos()
    print("==", ad)
    for k, v in sorted(r["denetimler"].items()):
        if ":A:" in k or ":AF:" in k or ":ab:" in k or ":KA:" in k or k.endswith("kasa"):
            print("  ", k, json.dumps(v["b"], ensure_ascii=False))
    for b in r["belirsiz"]:
        print("  B:", b[:240])
