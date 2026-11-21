# S231 hız tablosu: hiz.sh çıktısındaki SONUC satırlarından (GEÇERSİZ koşular hariç) her kod × yol için en iyi / ortanca ms ve olay döngüsü en çok;
# ölçüt: yeni ve s223 için c7b-aday'ye göre en iyi VE ortanca %10'dan kötü değil. Kullanım: python3 -I tablo.py <hiz-sonuc.txt>
import json
import statistics
import sys

runs = {}
invalid = False
current = None
for line in open(sys.argv[1], encoding="utf-8"):
    if line.startswith("--- tur "):
        parts = line.split()
        current = parts[3]
        invalid = "GEÇERSİZ" in line
    elif line.startswith("SONUC ") and current and not invalid:
        data = json.loads(line[6:])
        for path, value in data["results"].items():
            runs.setdefault(current, {}).setdefault(path, []).append((value["ms"], value["loop"], value["status"]))
paths = list(runs.get("c7b", {}).keys())
print("| Yol | c7b-aday en iyi / ortanca | s223-uc en iyi / ortanca | yeni en iyi / ortanca | yeni ÷ c7b (en iyi / ortanca) | olay döngüsü en çok (c7b / s223 / yeni) | koşu (c7b/s223/yeni) | hüküm |")
print("|---|---|---|---|---|---|---|---|")
fails = 0
for path in paths:
    cells = {}
    for code in ("c7b", "s223", "yeni"):
        values = runs.get(code, {}).get(path, [])
        ms = [v[0] for v in values]
        cells[code] = (min(ms), statistics.median(ms), max(v[1] for v in values), len(values), all(v[2] == 200 for v in values)) if ms else None
    base = cells["c7b"]
    new = cells["yeni"]
    ratio = (new[0] / base[0], new[1] / base[1]) if base and new else (float("nan"), float("nan"))
    ok = ratio[0] <= 1.10 and ratio[1] <= 1.10 and all(c and c[4] for c in cells.values())
    fails += 0 if ok else 1
    fmt = lambda c: f"{c[0]:.1f} / {c[1]:.1f}" if c else "—"
    loops = " / ".join(f"{c[2]:.1f}" if c else "—" for c in (cells["c7b"], cells["s223"], cells["yeni"]))
    counts = "/".join(str(c[3]) if c else "0" for c in (cells["c7b"], cells["s223"], cells["yeni"]))
    print(f"| {path} | {fmt(base)} | {fmt(cells['s223'])} | {fmt(new)} | {ratio[0]:.2f} / {ratio[1]:.2f} | {loops} | {counts} | {'GEÇTİ' if ok else 'KÖTÜ'} |")
print(f"\nÖlçüt (yeni ÷ c7b ≤ 1,10 en iyi VE ortanca; bütün yanıtlar 200): {'GEÇTİ' if not fails else f'{fails} yol KÖTÜ'}")
