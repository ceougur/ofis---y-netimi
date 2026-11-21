import re, sys
# kullanım: hiz-karsilastir.py <hiz-kip.txt> — taban ↔ yeni; her taraf iki blok: en iyi = blokların en iyisi, ortanca = blok ortancalarının küçüğü.
# KÖTÜLEŞTİ: en iyi VE ortanca tabanın %10'undan kötü (ve fark ≥ 5 ms — gürültü tabanı). GEÇERSİZ blok (yük > 2) varsa hüküm verilmez.
text = open(sys.argv[1], encoding="utf-8").read()
blocks = re.split(r"^=== ", text, flags=re.M)[1:]
data = {"taban": {}, "yeni": {}}
invalid = 0
for b in blocks:
    side = b.split(" ", 1)[0]
    if "GEÇERSİZ" in b.splitlines()[0]:
        invalid += 1
    for m in re.finditer(r"^  (.+?): durum ([\d/]+) · en iyi ([\d.]+) ms · ortanca ([\d.]+) ms · olay döngüsü en çok ([\d.]+) ms", b, flags=re.M):
        label, st, best, med, loop = m.groups()
        row = data[side].setdefault(label, {"best": [], "med": [], "loop": [], "st": set()})
        row["best"].append(float(best)); row["med"].append(float(med)); row["loop"].append(float(loop)); row["st"].add(st)
print(f"bloklar {len(blocks)} · geçersiz {invalid}")
print("| Yol | taban en iyi / ortanca / döngü | yeni en iyi / ortanca / döngü | oran (en iyi, ortanca) | hüküm |")
print("|---|---|---|---|---|")
worse = 0
for label in data["taban"]:
    t = data["taban"][label]; y = data["yeni"].get(label)
    if not y:
        print(f"| {label} | — | yeni yok | | ÖLÇÜLEMEDİ |"); continue
    tb, tm, tl = min(t["best"]), min(t["med"]), max(t["loop"])
    yb, ym, yl = min(y["best"]), min(y["med"]), max(y["loop"])
    rb = yb / tb if tb else 1; rm = ym / tm if tm else 1
    bad = rb > 1.10 and rm > 1.10 and (yb - tb) >= 5 and (ym - tm) >= 5
    worse += bad
    st = "/".join(sorted(t["st"] | y["st"]))
    print(f"| {label} (durum {st}) | {tb:.1f} / {tm:.1f} / {tl:.1f} | {yb:.1f} / {ym:.1f} / {yl:.1f} | {rb:.2f}, {rm:.2f} | {'KÖTÜLEŞTİ' if bad else 'geçti'} |")
print(f"kötüleşen {worse} · {'HÜKÜM YOK (geçersiz blok)' if invalid else ('GEÇTİ' if not worse else 'KALDI')}")
