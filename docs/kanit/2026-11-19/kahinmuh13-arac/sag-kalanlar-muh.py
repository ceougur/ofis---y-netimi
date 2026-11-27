import sys, os
# Bakım 13: ilk tam mutasyon koşusunda (UTC) sağ kalan üç mutantın dişi eklendikten sonra yeniden — her biri ÖLMELİ.
sys.path.insert(0, sys.argv[1])
os.chdir(sys.argv[1])
import mutasyon as Mu
src = open("model.py", encoding="utf-8").read()
adlar = ("B50b ", "B91b ", "B115 ")
olu = 0
for ad, d in Mu.MUTANTLAR:
    if ad.startswith(adlar):
        n, k = Mu.kos(Mu.mutant_kaynak(src, d))
        olu += bool(k)
        print(("ÖLDÜ" if k else "SAĞ KALDI"), ad[:90], "|", len(k), "/", n, ",".join(k[:4]), flush=True)
print(f"# tests 3\n# pass {olu}\n# fail {3 - olu}")
sys.exit(0 if olu == 3 else 1)
