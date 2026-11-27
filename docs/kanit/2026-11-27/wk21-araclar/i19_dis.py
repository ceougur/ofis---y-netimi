#!/usr/bin/env python3
"""I19 değişmezlerinin dişi: seçili mutantlarla aynı rastgele kümede kaç ihlal çıkıyor (0 = değişmez o mutantı görmüyor).
Kullanım: python3 -I i19_dis.py <kahin klasörü> <tohum> <sayı> M73 M309 …"""
import random
import sys


def main(klasor, tohum, sayi, mutler):
    sys.path.insert(0, klasor)
    import kahin  # noqa
    import kahin_test  # noqa
    rnd = random.Random(int(tohum))
    kume = [kahin_test.c5c_rastgele(rnd, no)[0] for no in range(int(sayi))]
    asil = kahin.Benzetim.__init__
    for m in mutler:
        ihlal = hata = 0; ornek = None
        orj_init = kahin_test._IzliBenzetim.__init__

        def init(self, *a, _m=m, **kw):
            kw["mut"] = frozenset([_m])
            orj_init(self, *a, **kw)
        kahin_test._IzliBenzetim.__init__ = init
        for g in kume:
            try:
                hh, _r = kahin_test.c5c_degismez(g)
            except Exception as e:  # noqa
                hata += 1; ornek = ornek or f"istisna {type(e).__name__}: {e}"
                continue
            if hh:
                ihlal += 1; ornek = ornek or hh[0]
        kahin_test._IzliBenzetim.__init__ = orj_init
        print(f"{m}: ihlalli senaryo {ihlal}, istisna {hata} / {len(kume)} — {ornek}")
    _ = asil
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]))
