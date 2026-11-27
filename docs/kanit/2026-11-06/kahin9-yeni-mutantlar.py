"""Kâhin bakımı 9 — yalnız yeni / değişen mutantları koşar ve öldüren testleri listeler (değerle mi, yalnız değişmez / susma ile mi).

  python3 -I yeni_mutantlar.py <kâhin klasörü> <ad öneki> …
"""
import sys

kok = sys.argv[1]
sys.path.insert(0, kok)
import mutasyon as MU  # noqa: E402

onekler = tuple(sys.argv[2:])
with open(MU.MODEL, encoding="utf-8") as f:
    src = f.read()
for _, d in MU.MUTANTLAR:
    MU.mutant_kaynak(src, d)
print("bütün mutant parçaları kaynakta tam bir kez geçiyor")
sag = 0
for ad, d in MU.MUTANTLAR:
    if not ad.startswith(onekler):
        continue
    n, kirmizi = MU.kos(MU.mutant_kaynak(src, d))
    deger = [k for k in kirmizi if k.startswith("test_s") or k.startswith("test_S")]
    print(f"{ad[:90]:<90} {'ÖLDÜ' if kirmizi else 'SAĞ KALDI'} ({len(kirmizi)}/{n}): {', '.join(kirmizi[:6])}")
    sag += not kirmizi
print(f"sağ kalan: {sag}")
