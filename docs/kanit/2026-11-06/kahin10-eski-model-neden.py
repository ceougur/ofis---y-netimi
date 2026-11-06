"""Bakım 10 — eski kâhinin (c076e9c0) yeni senaryolarda NEDEN kırmızı olduğunun dökümü.

Kullanım: python3 -I eski_model_neden.py <eski kopya klasörü (model.py + yeni senaryolar_elle.py / test_model.py)>
1. bölüm: her yeni elle senaryo (s104, s105) eski modelde susma (senaryo hatası) ile mi düşüyor — ilk susan olay ve iletisi.
2. bölüm: susan düzeltmeler ATLANARAK (olay yok sayılır) koşulduğunda elle değerlerin hangileri farklı (değer farkı = kuralın eski modelde olmadığı).
"""
import copy
import sys

sys.path.insert(0, sys.argv[1])
import model as M  # noqa: E402
import senaryolar_elle as E  # noqa: E402
import test_model as T  # noqa: E402

YENI = ("s104-s80-formdaki-pesin-cari", "s105-s81-olagan-normal-cari-siniri")
print("# 1. bölüm: eski modelde ilk susma")
for s in E.SENARYOLAR:
    if s["ad"] not in YENI:
        continue
    x = dict(s, **copy.deepcopy(E.TANIM))
    try:
        M.kos(x)
        print(f"{s['ad']}: susma YOK")
    except AssertionError as e:
        print(f"{s['ad']}: SUSAR — {str(e)[:160]}")

print("\n# 2. bölüm: susan düzeltmeler atlanarak koşulunca farklı elle değerler")
eski_duzenle = M.Model._o_duzenle
atlanan = []


def sarili(self, o, d):
    try:
        return eski_duzenle(self, o, d)
    except AssertionError as e:
        atlanan.append((o["kaynak"], o.get("degisiklik"), str(e)[:70]))
        return None


M.Model._o_duzenle = sarili
for s in E.SENARYOLAR:
    if s["ad"] not in YENI:
        continue
    atlanan.clear()
    x = dict(s, **copy.deepcopy(E.TANIM))
    r = M.kos(x)
    print(f"\n{s['ad']}: atlanan (susan) düzeltme {len(atlanan)}")
    for a in atlanan:
        print("   atlandı:", a)
    fark = 0
    for yol, bek in s["elle"]["A"].items():
        try:
            g = T.yol_al(r, yol, bek)
        except KeyError as e:
            g = f"YOK ({e})"
        if g != bek:
            fark += 1
            print(f"   FARK {yol}: beklenen {bek!r} · eski model {g!r}")
    print(f"   {fark} anahtar farklı / {len(s['elle']['A'])}")
