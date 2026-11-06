"""Kâhin bakımı 9 — eski modelde (5502508a) yeni / değişen elle senaryoların NEDEN dökümü.

  python3 -I neden.py <kâhin klasörü> <senaryo adı> …

Her senaryo için: model senaryo hatası verirse iletisi; vermezse farklı çıkan elle anahtarlar (eski değer → elle değer).
"""
import copy
import sys

kok = sys.argv[1]
sys.path.insert(0, kok)
import model as M  # noqa: E402
import senaryolar_elle as E  # noqa: E402
import test_model as T  # noqa: E402

adlar = sys.argv[2:]
for s in E.SENARYOLAR:
    if s["ad"] not in adlar:
        continue
    x = dict(s)
    x.update(copy.deepcopy(E.TANIM))
    print(f"== {s['ad']}")
    for et in M.dal_etiketleri(x):
        try:
            r = M.kos(x, M.Kurallar.etiketten(et))
        except AssertionError as h:
            print(f"  [{et}] SENARYO HATASI: {h}")
            continue
        fark = 0
        for yol, bek in s["elle"].get(et, {}).items():
            try:
                g = T.yol_al(r, yol, bek)
            except KeyError as h:
                g = f"<yok: {h}>"
            if g != bek:
                fark += 1
                print(f"  [{et}] {yol}: eski {g!r} → elle {bek!r}")
        print(f"  [{et}] farklı anahtar: {fark}")
