# -*- coding: utf-8 -*-
"""WK13 ön tarama: mevcut (eski) kâhinle bütün senaryolarda Ödeme Hatırlatma içerik anında gecikmiş toplam ↔ net borç (bakiye ≤ bugün).
Karar (5) / S17 hangi eski senaryoyu değiştirir? Kullanım: python3 -I net_tarama.py <kahin klasörü>"""
import sys
from decimal import Decimal
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin  # noqa: E402
import senaryolar  # noqa: E402

kayit = []
eski_icerik = kahin.Benzetim._icerik
eski_baslat = kahin.Benzetim.baslat


def _icerik(self, c, tp, t, d_bas, d_son):
    if tp.sablon != "ekstre":
        bugun = kahin.tarih(t, self.tz)
        bakiye = sum((Decimal(str(h.get("borc", 0))) - Decimal(str(h.get("alacak", 0))) for h in c["hareketler"] if h["tarih"] <= bugun), Decimal("0"))
        gec = self.gecikmis(c, t)
        toplam = sum((Decimal(str(v["kalan"])) for v in gec), Decimal("0"))
        sup = sum((Decimal(str(v["kalan"])) for v in c.get("vadeler", []) if v.get("supheli") and Decimal(str(v["kalan"])) > 0), Decimal("0"))
        if toplam > bakiye - sup or bakiye <= 0:
            kayit.append((self.sen.get("ad"), "icerik", c["id"], str(toplam), str(bakiye), str(sup)))
    return eski_icerik(self, c, tp, t, d_bas, d_son)


def baslat(self, o, t):
    if o.get("sablon") == "hatirlatma":
        bugun = kahin.tarih(t, self.tz)
        for cid in o["secim"]:
            c = self.cariler[cid]
            bakiye = sum((Decimal(str(h.get("borc", 0))) - Decimal(str(h.get("alacak", 0))) for h in c["hareketler"] if h["tarih"] <= bugun), Decimal("0"))
            gec = self.gecikmis(c, t)
            toplam = sum((Decimal(str(v["kalan"])) for v in gec), Decimal("0"))
            if gec and bakiye <= 0:
                kayit.append((self.sen.get("ad"), "baslat", cid, str(toplam), str(bakiye), "-"))
    return eski_baslat(self, o, t)


kahin.Benzetim._icerik = _icerik
kahin.Benzetim.baslat = baslat
n_hat = 0
for s in senaryolar.tum_senaryolar():
    g = senaryolar.girdi(s)
    if not any(o.get("tur") == "baslat" and o.get("sablon") == "hatirlatma" for o in g["olaylar"]):
        continue
    n_hat += 1
    g = dict(g); g["ad"] = s["ad"]
    for z in kahin.ZAMANLAR:
        b = kahin.Benzetim(g, kahin.tam_secim({}), z)
        b.sen["ad"] = s["ad"]
        b.calistir()
print(f"hatırlatma içeren senaryo: {n_hat}")
for k in sorted(set(kayit)):
    print("ETKİ", *k)
print(f"etkilenen (senaryo, an, cari): {len(set(kayit))}")
