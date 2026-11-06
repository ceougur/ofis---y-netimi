"""Bakım 10'un yeni mutantlarını (B105*, B106*) ve S56 ile ortak B78 / B97'yi tek tek koşar; her birini öldüren testleri yazar.
Kullanım: python3 -I yeni_mutantlar.py <kâhin klasörü>"""
import sys

sys.path.insert(0, sys.argv[1])
import mutasyon as MU  # noqa: E402

src = open(MU.MODEL, encoding="utf-8").read()
n, kirmizi = MU.kos(src)
print(f"temel: {n} test, {len(kirmizi)} kırmızı")
sag = 0
for ad, dg in MU.MUTANTLAR:
    if not ad.startswith(("B105", "B106", "B78 ", "B97 ")):
        continue
    n, kirmizi = MU.kos(MU.mutant_kaynak(src, dg))
    elle = [k for k in kirmizi if k.startswith("test_s")]
    print(f"{ad}\n   {'ÖLDÜ' if kirmizi else 'SAĞ KALDI'} — {len(kirmizi)}/{n}: {', '.join(kirmizi)}"
          f"\n   elle senaryo ile: {', '.join(elle) if elle else 'YOK (yalnız birim)'}")
    sag += not kirmizi
print(f"sağ kalan: {sag}")
