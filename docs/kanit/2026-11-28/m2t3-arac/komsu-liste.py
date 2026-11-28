# M2T3 komşu listesi (ders 10): tur 2'nin 80 dosyası + fatura Düzenle yolu (git grep '/edit' — komsu-duzenle.txt); yeni / değişen iki test dosyası ayrı koşulur.
import os, sys
W = sys.argv[1]
D = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t3-ae39/"
a = [l.strip() for l in open(os.path.join(W, "docs/kanit/2026-11-28/m2t2-arac/komsu-liste.txt")) if l.strip()]
b = [l.strip() for l in open(D + "komsu-duzenle.txt") if l.strip()]
out = sorted(set(a + b) - {"test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs", "test/supheli-degersiz-m2t3-251.test.mjs"})
missing = [f for f in out if not os.path.exists(os.path.join(W, f))]
open(D + "komsu-liste.txt", "w").write("\n".join(out) + "\n")
print(len(a), "tur 2;", len(set(b)), "Düzenle taraması;", len(out), "birleşik; eksik:", missing)
