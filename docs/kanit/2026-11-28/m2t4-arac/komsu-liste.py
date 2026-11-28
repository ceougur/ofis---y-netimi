# M2T4 komşu listesi (ders 10): tur 3'ün 123 dosyası + cari hareketi düzeltme / silme ucunun testleri (git grep: PUT / DELETE … entries/${…}) + taksit kartı düzenleme / silme ucunun testleri
# (git grep: PUT / DELETE … plans/${…}); yeni / değişen iki test dosyası ayrı koşulur.
import os, sys
W = sys.argv[1]
D = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t4-ajan/"
a = [l.strip() for l in open(os.path.join(W, "docs/kanit/2026-11-28/m2t3-arac/komsu-liste.txt")) if l.strip()]
b = [l.strip() for l in open(D + "komsu-cari.txt") if l.strip()]
c = [l.strip() for l in open(D + "komsu-kart.txt") if l.strip()]
out = sorted(set(a + b + c) - {"test/supheli-degersiz-m2t3-251.test.mjs", "test/supheli-degersiz-m2t4-251.test.mjs"})
missing = [f for f in out if not os.path.exists(os.path.join(W, f))]
open(D + "komsu-liste.txt", "w").write("\n".join(out) + "\n")
print(len(a), "tur 3;", len(set(b)), "cari hareketi;", len(set(c)), "taksit kartı;", len(out), "birleşik; eksik:", missing)
