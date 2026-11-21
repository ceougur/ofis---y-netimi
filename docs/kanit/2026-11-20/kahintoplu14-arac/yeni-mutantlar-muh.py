import sys, os
sys.path.insert(0, sys.argv[1])
os.chdir(sys.argv[1])
import mutasyon as Mu
src = open("model.py", encoding="utf-8").read()
adlar = ("B117", "B118", "B119", "B120", "B121", "B122", "B123", "B124", "B125", "B126", "B127", "N24 ", "B50 ", "B112 ", "B114c", "B115b")
for ad, d in Mu.MUTANTLAR:
    if ad.startswith(adlar):
        n, k = Mu.kos(Mu.mutant_kaynak(src, d))
        print(("ÖLDÜ" if k else "SAĞ KALDI"), ad[:90], "|", len(k), "/", n, ",".join(k[:4]), flush=True)
