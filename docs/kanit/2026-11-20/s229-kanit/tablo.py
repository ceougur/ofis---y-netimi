import statistics
import sys
from collections import defaultdict

ms = defaultdict(list)
loop = defaultdict(list)
for line in open(sys.argv[1], encoding="utf-8"):
    parts = line.rstrip("\n").split("\t")
    if parts[0] != "ÖLÇÜM" or len(parts) < 5:
        continue
    _, kod, label, t, l = parts[:5]
    ms[(label, kod)].append(float(t))
    loop[(label, kod)].append(float(l))
labels = sorted({k[0] for k in ms})
print("| Yol | taban en iyi | yeni en iyi | taban ortanca | yeni ortanca | olay döngüsü en çok (taban / yeni) | n | hüküm |")
print("|---|---|---|---|---|---|---|---|")
bad = 0
for label in labels:
    a, b = ms.get((label, "eski"), []), ms.get((label, "yeni"), [])
    if not a or not b:
        print(f"| {label} | eksik | | | | | | ÖLÇÜLEMEDİ |")
        continue
    ba, bb, ma, mb = min(a), min(b), statistics.median(a), statistics.median(b)
    worse = bb > ba * 1.10 and mb > ma * 1.10
    small = max(bb, mb) < 5  # 5 ms altı ölçüm gürültüsü notu
    bad += worse
    verdict = ("KÖTÜ (%10+)" + (" — 5 ms altı" if small else "")) if worse else "iyi"
    print(f"| {label} | {ba:.1f} | {bb:.1f} | {ma:.1f} | {mb:.1f} | {max(loop[(label, 'eski')]):.1f} / {max(loop[(label, 'yeni')]):.1f} | {len(a)}/{len(b)} | {verdict} |")
print(f"\nKötüleşen yol: {bad}")
