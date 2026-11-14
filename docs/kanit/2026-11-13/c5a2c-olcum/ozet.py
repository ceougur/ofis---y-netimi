"""Ölçüm özeti: her kip × yol için taban / yeni en iyi ve ortanca (ms), olay döngüsü en çok; ilk tur (açılıştan sonraki ilk çağrı) ayrı. python3 -I ozet.py <olcum klasörü>"""
import re
import statistics
import sys

base = sys.argv[1]
line = re.compile(r"^  (.+?): (\d+) · ([\d.]+) ms · olay döngüsü en çok ([\d.]+) ms")
for kip in ("kilitsiz", "kilitli"):
    data = {}
    for tag in ("taban", "yeni"):
        text = open(f"{base}/olc-{tag}-{kip}.txt", encoding="utf-8").read()
        for head in re.findall(r"(=== TZ .*|açılış .*|donma.*)", text):
            print(f"[{kip} {tag}] {head}")
        tour = 0
        for raw in text.splitlines():
            if raw.startswith("tur "):
                tour = int(raw.split()[1])
            m = line.match(raw)
            if not m:
                continue
            name, status, ms, loop = m.group(1), m.group(2), float(m.group(3)), float(m.group(4))
            item = data.setdefault(name, {}).setdefault(tag, {"all": [], "first": [], "loop": 0, "status": set()})
            item["all"].append(ms)
            item["loop"] = max(item["loop"], loop)
            item["status"].add(status)
            if tour == 1:
                item["first"].append(ms)
    print(f"\n== {kip}: yol | taban en iyi / ortanca / ilk | yeni en iyi / ortanca / ilk | olay döngüsü taban → yeni | durum")
    for name, tags in data.items():
        t, y = tags.get("taban"), tags.get("yeni")
        if not t or not y:
            continue
        fmt = lambda x: f"{min(x['all']):.1f} / {statistics.median(x['all']):.1f} / {max(x['first']):.1f}"
        worse = min(y["all"]) > min(t["all"]) * 1.1 and statistics.median(y["all"]) > statistics.median(t["all"]) * 1.1
        print(f"{name} | {fmt(t)} | {fmt(y)} | {t['loop']:.1f} → {y['loop']:.1f} | {'/'.join(sorted(t['status']))} → {'/'.join(sorted(y['status']))}{' | KÖTÜ (%10+)' if worse else ''}")
