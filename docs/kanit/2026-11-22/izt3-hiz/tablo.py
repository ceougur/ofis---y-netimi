import sys, re, collections
# sonuc.txt → yol × kod: üç turun ortancalarının ortancası, en iyilerin en iyisi, olay döngüsü en çok (en büyük)
cur = None
data = collections.defaultdict(lambda: collections.defaultdict(list))
invalid = []
for line in open(sys.argv[1], encoding="utf-8"):
    m = re.match(r"=== tur (\d) · (\w+) · başta ([\d.]+)", line)
    if m:
        cur = m.group(2)
        if float(m.group(3)) >= 1.5:
            invalid.append(line.strip())
        continue
    if line.startswith("SONUÇ") and cur:
        p = [x.strip() for x in line.split("|")]
        label = p[1]
        best = float(p[3].split()[-1]); med = float(p[4].split()[-1]); loop = float(p[5].split()[-1]); n = int(p[2].split()[-1]); bad = int(p[6].split()[-1])
        data[label][cur].append((best, med, loop, n, bad))
names = {"oncesi": "-", "eski": "taban 3b420085", "yeni": "yeni (izt3)"}
print("GEÇERSİZ:", invalid or "yok")
print("| Yol | Kod | n (tur başına) | en iyi (ms) | ortanca (ms; tur ortancalarının ortancası) | olay döngüsü en çok (ms) | 200 dışı | son ÷ taban − 1 (ortanca; en iyi) |")
print("|---|---|---|---|---|---|---|---|")
for label, by in data.items():
    base = None
    for kod in ["oncesi", "eski", "yeni"]:
        rows = by.get(kod)
        if not rows:
            continue
        best = min(r[0] for r in rows)
        meds = sorted(r[1] for r in rows); med = meds[len(meds) // 2]
        loop = max(r[2] for r in rows)
        n = "/".join(str(r[3]) for r in rows)
        bad = sum(r[4] for r in rows)
        if kod == "eski":
            base = (med, best)
        ratio = ""
        if kod == "yeni" and base:
            dm, db = (med / base[0] - 1) * 100, (best / base[1] - 1) * 100
            ratio = f"{dm:+.1f}% (en iyi {db:+.1f}%){' KÖTÜ' if dm > 10 and db > 10 else ''}"
        print(f"| {label} | {names[kod]} | {n} | {best:.1f} | {med:.1f} | {loop:.1f} | {bad} | {ratio} |")
