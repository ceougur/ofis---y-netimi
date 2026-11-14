import sys, os
sys.path.insert(0, sys.argv[1])
os.chdir(sys.argv[1])
import mutasyon as Mu
src = open("model.py", encoding="utf-8").read()
adlar = ("B110", "B111", "B112", "B113", "B114", "B115", "B116", "N33 ", "B40c", "B51 ", "B62 ")
for ad, d in Mu.MUTANTLAR:
    if ad.startswith(adlar):
        n, k = Mu.kos(Mu.mutant_kaynak(src, d))
        print(("ÖLDÜ" if k else "SAĞ KALDI"), ad[:90], "|", len(k), "/", n, ",".join(k[:4]), flush=True)
