#!/usr/bin/env python3
"""d12'nin aynı adımlarından ertesi gün (16.06) senaryosu d13'ü yazar; elle beklenenler BURADA elle verilir (kâhin koşulmaz)."""
import json
import sys

kaynak, hedef = sys.argv[1], sys.argv[2]
with open(kaynak, encoding="utf-8") as f:
    s = json.load(f)
s["ad"] = "d13-c5-s69-soz-ertesi-gun"
s["bugun"] = "2026-06-16"
s["aciklama"] = ("2.5.0 bakım 3 C15.1 (KULLANICI S69 = A): d12'nin AYNI adımları, ERTESİ GÜN (bugün 16.06) — gün sayısı vadeden sürer, söz geçince geri düşmez. "
                 "A kararın örneği vade 05.06 söz 15.06 → 16.06'da −11 (S69 B'de −1); B −11; C −15; D −2; E −11; E2 −15; H −27; T −22; T2 −15; K −32; V vade 15.06 söz 17.06 (yarın) → "
                 "C14.2 'overdue' −1. KESİN K6.3 (C15.2): F söz = vade 15.06 → 'overdue' −1 (iki okuma aynı); F2 söz 10.06 vadeden (15.06) önce → 'overdue' −6 (sözden; vadeden −1 DEĞİL); "
                 "G söz vadeden önce → −11; G2 söz = vade → −11; E3 vadesiz belge 15.06 = söz → −1. Gecikmiş tutarı (C13.5) sözden bağımsız (F, F2, E3, V artık gecikmiş).")
e = s["elleBeklenen"]
gun = {"a1": ("overdue", -11), "b1": ("overdue", -11), "c1": ("overdue", -15), "d1": ("overdue", -2), "e1": ("overdue", -11), "e2": ("overdue", -15),
       "e3": ("overdue", -1), "f1": ("overdue", -1), "f2": ("overdue", -6), "g1": ("overdue", -11), "g2": ("overdue", -11), "h1": ("overdue", -27),
       "t1": ("overdue", -22), "t2": ("overdue", -15), "acilis:K": ("overdue", -32), "v1": ("overdue", -1)}
for h, (st, d) in gun.items():
    k = "k1:takvim:hareket:" + h
    e[k] = dict(e[k], state=st, days=d)
e.update({"k1:cari:E3:gecikmis": 16000, "k1:cari:F:gecikmis": 50000, "k1:cari:F2:gecikmis": 45000, "k1:cari:V:gecikmis": 33000})
with open(hedef, "w", encoding="utf-8") as f:
    json.dump(s, f, ensure_ascii=False, indent=1)
    f.write("\n")
print("ok", len(e))
