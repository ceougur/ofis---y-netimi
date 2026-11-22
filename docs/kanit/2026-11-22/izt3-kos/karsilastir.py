# Eski ↔ yeni prob çıktısı: kapı yolu ([full(...)] / [scoped] / []) süzülünce satırlar birebir aynı mı; yol sayımı ayrıca.
import re
import sys
from collections import Counter

PATH = re.compile(r" ?\[(full\([^)]*\)|scoped|)\]")


def load(p):
    return [line.rstrip("\n") for line in open(p, encoding="utf-8") if " :: " in line]


old, new = load(sys.argv[1]), load(sys.argv[2])
same = 0
for a, b in zip(old, new):
    if PATH.sub("", a) == PATH.sub("", b):
        same += 1
    else:
        print("FARK\n  eski: " + a + "\n  yeni: " + b)
print(f"senaryo {len(old)} / {len(new)} · sonuç aynı {same}")
for name, lines in (("eski", old), ("yeni", new)):
    c = Counter(m.group(1) for line in lines for m in PATH.finditer(line))
    print(name, dict(c))
