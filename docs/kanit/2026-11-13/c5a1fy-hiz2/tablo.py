# Tur 1f hız tablosu: taban ↔ yeni, kip başına; yol başına en iyi + ortanca (iki TZ × iki tur = 4 değer); GEÇERSİZ / çıkış satırları.
import re, sys, statistics, os
D = os.path.dirname(os.path.abspath(__file__))
PAT = re.compile(r"^\s+(.+?): (\d+) · ([\d.]+) ms")
DIG = re.compile(r"^\s+Kilit izi \(lockDigestOf, [^)]*\): ([\d.]+) ms")
OPEN = re.compile(r"^açılış \(göç dahil\) (\d+) ms")
FRZ = re.compile(r"^donma \(bekleyen.*\) (\d+) ms")
def read(tag, kip):
    vals, notes = {}, []
    for line in open(f"{D}/olc-{tag}-{kip}.txt", encoding="utf-8"):
        if "GEÇERSİZ" in line or line.startswith("çıkış") or line.startswith("=== TZ"): notes.append(line.strip()[:120])
        m = PAT.match(line)
        if m: vals.setdefault(m.group(1), []).append(float(m.group(3)))
        m = DIG.match(line)
        if m: vals.setdefault("Kilit izi (lockDigestOf)", []).append(float(m.group(1)))
        m = OPEN.match(line)
        if m: vals.setdefault("Açılış (göç dahil)", []).append(float(m.group(1)))
        m = FRZ.match(line)
        if m: vals.setdefault("Donma (bekleyen koşu)", []).append(float(m.group(1)))
    return vals, notes
for kip in ["kilitsiz", "kilitli"]:
    a, na = read("taban", kip); b, nb = read("yeni", kip)
    print(f"## {kip}")
    for n in na + nb: print("  ", n)
    print("| Yol | taban en iyi / ortanca (ms) | yeni en iyi / ortanca (ms) | ortanca farkı |")
    print("|---|---|---|---|")
    for k in a:
        if k not in b: continue
        ta, tb = statistics.median(a[k]), statistics.median(b[k])
        print(f"| {k} | {min(a[k]):.0f} / {ta:.0f} | {min(b[k]):.0f} / {tb:.0f} | {((tb - ta) / ta * 100 if ta else 0):+.1f} % |")
