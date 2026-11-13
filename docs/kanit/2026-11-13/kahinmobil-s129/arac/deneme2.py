# Keşif: cari kâhini 2.5.0 — kartlı caride bağsız nakit / çek / kart tahsilatının kart ödenenine etkisi (karar örnekleri + evrak)
import importlib.util, sys, os
sys.dont_write_bytecode = True
KOK = sys.argv[1]
sp = importlib.util.spec_from_file_location("cm", os.path.join(KOK, "test/bagimsiz/cari/model.py"))
C = importlib.util.module_from_spec(sp)
sp.loader.exec_module(C)


def kos(adimlar, bugun="2026-10-20"):
    m = C.Model({"dil": C.DIL, "ad": "x", "bugun": bugun, "adimlar": []}, 0, "2.5.0")
    for a in adimlar:
        m._onbellek = {}
        r = getattr(m, a["islem"])(a)
        if isinstance(r, tuple):
            return ("RED", a["id"], r[:3])
    m._onbellek = {}
    o = {}
    for no, kt in m.kartlar.items():
        o[no] = (m.tyk250(kt["cari"])["neden"], m.kart_odenen(no, kt), m.bakiye(kt["cari"]), [x[1] for x in m.sus_kart])
    return o


ca = {"id": "c1", "islem": "cari_ac", "ad": "K", "isim": "K", "tur": "musteri", "tarih": "2026-10-01", "acilis": "900,00"}
ka = {"id": "ka", "islem": "kart_ac", "ad": "KT", "cari": "K", "tutar": "900,00", "taksit": 3, "ilkVade": "2026-11-01", "tarih": "2026-10-01", "mevcut": True}
print("ornek1", kos([ca, ka, {"id": "t1", "islem": "tahsilat", "cari": "K", "tutar": "500,00", "tarih": "2026-10-20", "yol": "nakit"}]))
print("ornek1+kart900", kos([ca, ka, {"id": "t1", "islem": "tahsilat", "cari": "K", "tutar": "500,00", "tarih": "2026-10-20", "yol": "nakit"},
                             {"id": "t3", "islem": "kart_tahsilat", "kayit": "KT", "tutar": "900,00", "tarih": "2026-10-20"}]))
print("cek300", kos([ca, ka, {"id": "e1", "islem": "evrak", "ad": "E_E1", "cari": "K", "tur": "cek", "tutar": "300,00", "tarih": "2026-10-20"}]))
print("avans", kos([ca, ka, {"id": "t1", "islem": "kart_tahsilat", "kayit": "KT", "tutar": "500,00", "tarih": "2026-10-20"},
                    {"id": "t3", "islem": "kart_tahsilat", "kayit": "KT", "tutar": "800,00", "tarih": "2026-10-20"}]))
ca2 = dict(ca, id="c2", ad="L", isim="L", acilis="600,00")
ka2 = dict(ka, id="kb", ad="LT", cari="L", tutar="600,00", taksit=2)
print("ornek2", kos([ca2, ka2, {"id": "t2", "islem": "tahsilat", "cari": "L", "tutar": "800,00", "tarih": "2026-10-20", "yol": "nakit"}]))
