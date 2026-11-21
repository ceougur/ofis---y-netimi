# Ç6-HESAP tur 5 hız tablosu: hiz/hiz-<kod>-<kip>.log → istek × kod: geçerli turların en iyi (en küçük) ve ortancaların ortancası; son ÷ eski; olay döngüsü en çok; özet eşitliği.
# Çağrı: python3 -I tablo5.py <hiz klasörü>
import re, statistics, sys
from collections import defaultdict

D = sys.argv[1]
line = re.compile(r"^  (.+?): ilk ([\d.]+) · en iyi ([\d.]+) · ortanca ([\d.]+) · en kötü ([\d.]+) ms · olay döngüsü en çok ([\d.]+) ms \(n=(\d+)\) · özet (\w+) · (.*)$")
data = defaultdict(lambda: defaultdict(list))  # istek → kod → [(tur, en iyi, ortanca, döngü, özet, örnek)]
donma = defaultdict(list)
invalid = []
for kod in ["eski", "tur4", "yeni"]:
    for kip in ["kilitli", "kilitsiz"]:
        try:
            txt = open(f"{D}/hiz-{kod}-{kip}.log", encoding="utf-8").read()
        except FileNotFoundError:
            continue
        for blok in txt.split("=== ")[1:]:
            head = blok.splitlines()[0]
            tur = re.search(r"tur (\d)", head).group(1)
            yuk = re.search(r"başta yük ([\d.]+)", head).group(1)
            ok = "GEÇERSİZ" not in head
            cikis = re.search(r"çıkış (\d+)", blok)
            if not ok or not cikis or cikis.group(1) != "0":
                invalid.append(f"tur {tur} {kod} {kip} (yük {yuk}, çıkış {cikis.group(1) if cikis else '?'})")
                continue
            m = re.search(r"donma \(bekleyen koşu\): ([\d.]+)", blok)
            if m:
                donma[kod].append(float(m.group(1)))
            for l in blok.splitlines():
                g = line.match(l)
                if g:
                    data[g.group(1)][kod].append((tur, float(g.group(3)), float(g.group(4)), float(g.group(6)), g.group(8), g.group(9)))
print("| İstek | eski en iyi / ortanca | tur 4 en iyi / ortanca | yeni en iyi / ortanca | yeni ÷ eski (en iyi / ortanca) | KÖTÜ? | olay döngüsü en çok (e / t4 / y) | yanıt özeti | n tur |")
print("|---|---|---|---|---|---|---|---|---|")
for req, by in data.items():
    cell = {}
    for kod in ["eski", "tur4", "yeni"]:
        rows = by.get(kod, [])
        if rows:
            cell[kod] = (min(r[1] for r in rows), statistics.median(r[2] for r in rows), max(r[3] for r in rows), {r[4] for r in rows}, len(rows))
    if "eski" in cell and "yeni" in cell:
        rb = cell["yeni"][0] / cell["eski"][0]
        rm = cell["yeni"][1] / cell["eski"][1]
        bad = "EVET" if rb > 1.10 and rm > 1.10 else "hayır"
        ratio = f"{rb:.3f} / {rm:.3f}"
    else:
        ratio, bad = "?", "?"
    t4, y, e = cell.get("tur4", (0, 0, 0, None))[3], cell.get("yeni", (0, 0, 0, None))[3], cell.get("eski", (0, 0, 0, None))[3]
    same = ("tur4 = yeni" if t4 == y and t4 and len(t4) == 1 else f"tur4 ≠ yeni {sorted(t4 or [])} {sorted(y or [])}") + (" · eski aynı" if e == y else " · eski farklı")
    fmt = lambda k: f"{cell[k][0]:.0f} / {cell[k][1]:.0f}" if k in cell else "—"
    loops = " / ".join(f"{cell[k][2]:.0f}" if k in cell else "—" for k in ["eski", "tur4", "yeni"])
    print(f"| {req} | {fmt('eski')} | {fmt('tur4')} | {fmt('yeni')} | {ratio} | {bad} | {loops} | {same} | {'/'.join(str(cell[k][4]) for k in cell)} |")
for kod, vals in donma.items():
    print(f"dondurma koşusu {kod}: en iyi {min(vals):.0f} · ortanca {statistics.median(vals):.0f} ms (n={len(vals)})")
print("GEÇERSİZ / başarısız ölçümler: " + (", ".join(invalid) if invalid else "yok"))
