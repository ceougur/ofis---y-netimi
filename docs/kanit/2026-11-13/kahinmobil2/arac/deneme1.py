import importlib.util, sys
sys.dont_write_bytecode = True
W = sys.argv[1]
spec = importlib.util.spec_from_file_location("cm", W + "/test/bagimsiz/cari/model.py"); C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)


def kos(adimlar, bugun="2026-10-20"):
    m = C.Model({"dil": C.DIL, "ad": "x", "bugun": bugun, "adimlar": []}, 0, "2.5.0")
    for a in adimlar:
        m._onbellek = {}
        r = getattr(m, a["islem"])(a)
        if isinstance(r, tuple):
            print("RET", a["id"], r[:2])
    m._onbellek = {}
    m.kontrol({"id": "k"})
    for k, v in sorted(m.out.items()):
        if ":kart:" in k or (":cari:" in k and "bakiye" in k):
            print(k, v["b"])
    for b in m.belirsiz:
        print("BELIRSIZ", b[:220])


def ca(i, ad, acilis, tarih="2026-10-01"):
    return {"id": i, "islem": "cari_ac", "ad": ad, "isim": ad, "tur": "musteri", "tarih": tarih, "acilis": acilis}


def ka(i, ad, c, t, n, ilk="2026-11-01", tarih="2026-10-01"):
    return {"id": i, "islem": "kart_ac", "ad": ad, "cari": c, "tutar": t, "taksit": n, "ilkVade": ilk, "tarih": tarih, "mevcut": True}


def kt(i, k, t, fay=False, tarih="2026-10-20"):
    a = {"id": i, "islem": "kart_tahsilat", "kayit": k, "tutar": t, "tarih": tarih}
    if fay:
        a["fazlasiniAvansYaz"] = True
    return a


print("== E42")
kos([ca("c1", "K", "900"), ka("ka", "KT", "K", "900", 3), ca("c2", "L", "600"), ka("kb", "LT", "L", "600", 2),
     {"id": "t1", "islem": "tahsilat", "cari": "K", "tutar": "500", "tarih": "2026-10-20", "yol": "nakit"},
     {"id": "t2", "islem": "tahsilat", "cari": "L", "tutar": "800", "tarih": "2026-10-20", "yol": "nakit"},
     kt("t3", "KT", "900"), kt("t6", "LT", "600")])
print("== E05 FAY")
kos([ca("c1", "K", "1200"), ka("ka", "KT1", "K", "1200", 3), kt("t1", "KT1", "500"), kt("t3", "KT1", "800", True)])
print("== E05 FAY yok")
kos([ca("c1", "K", "1200"), ka("ka", "KT1", "K", "1200", 3), kt("t1", "KT1", "500"), kt("t3", "KT1", "800")])
print("== E41")
kos([ca("c1", "K", "1000"), ka("ka", "KT", "K", "1000", 2), kt("t1", "KT", "1000"), kt("t3", "KT", "200", True), kt("t4", "KT", "300", True)])
print("== S165 mobil dili")
kos([ca("c1", "K", "900", "2026-07-01"), ka("ka", "KT", "K", "900", 3, "2026-08-01", "2026-07-15"),
     {"id": "f1", "islem": "fatura", "ad": "FZ", "cari": "K", "tutar": "500", "tarih": "2026-10-15", "tur": "satis"},
     {"id": "i1", "islem": "stok_iade", "cari": "K", "tutar": "300", "tarih": "2026-10-16"},
     kt("t1", "KT", "700"), kt("t2", "KT", "600"), kt("t3", "KT", "600", True)])
print("== S165 mobil dili, yalniz 700")
kos([ca("c1", "K", "900", "2026-07-01"), ka("ka", "KT", "K", "900", 3, "2026-08-01", "2026-07-15"),
     {"id": "f1", "islem": "fatura", "ad": "FZ", "cari": "K", "tutar": "500", "tarih": "2026-10-15", "tur": "satis"},
     {"id": "i1", "islem": "stok_iade", "cari": "K", "tutar": "300", "tarih": "2026-10-16"}, kt("t1", "KT", "700")])
print("== S151/S158 k1 (iade, baska borc var)")
kos([ca("c1", "K", "900", "2026-07-01"), ka("ka", "KT", "K", "900", 3, "2026-08-01", "2026-07-15"),
     {"id": "f1", "islem": "fatura", "ad": "FZ", "cari": "K", "tutar": "500", "tarih": "2026-10-15", "tur": "satis"},
     {"id": "i1", "islem": "stok_iade", "cari": "K", "tutar": "300", "tarih": "2026-10-16"}])
print("== S158 (tek borc)")
kos([ca("c1", "L", "900", "2026-07-01"), ka("ka", "LT", "L", "900", 3, "2026-08-01", "2026-07-15"),
     {"id": "i1", "islem": "stok_iade", "cari": "L", "tutar": "300", "tarih": "2026-10-16"}])
