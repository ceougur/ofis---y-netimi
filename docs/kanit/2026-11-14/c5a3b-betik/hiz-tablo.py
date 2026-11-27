# hiz/ altındaki dört ölçümden tablo: her yol için taban (1, 3) ve yeni (2, 4) ortanca / en iyi / olay döngüsü; çift başına yüzde fark ve ölçüt (hem en iyide hem ortancada > %10 kötü = KÖTÜ).
import json, sys, os
d = sys.argv[1]
runs = {i: json.load(open(os.path.join(d, f"{i}-{k}.json"))) for i, k in [(1, "taban"), (2, "yeni"), (3, "taban"), (4, "yeni")]}
labels = list(runs[1]["sonuc"].keys())
print("| Yol | taban ortanca / en iyi / olay döngüsü (ms) — 1. ve 2. ölçüm | yeni ortanca / en iyi / olay döngüsü — 1. ve 2. | fark ortanca / en iyi (1. çift · 2. çift) | hüküm |")
print("|---|---|---|---|---|")
for l in labels:
    t = [runs[1]["sonuc"][l], runs[3]["sonuc"][l]]
    y = [runs[2]["sonuc"][l], runs[4]["sonuc"][l]]
    pct = lambda a, b: (b - a) / a * 100 if a else 0
    pairs = [(pct(t[i]["ortanca"], y[i]["ortanca"]), pct(t[i]["enIyi"], y[i]["enIyi"])) for i in range(2)]
    bad = all(o > 10 and e > 10 for o, e in pairs)
    one = any(o > 10 and e > 10 for o, e in pairs)
    fmt = lambda x: f"{x['ortanca']} / {x['enIyi']} / {x['olayDongusuEnCok']}"
    print(f"| {l} | {fmt(t[0])} · {fmt(t[1])} | {fmt(y[0])} · {fmt(y[1])} | {pairs[0][0]:+.1f}% / {pairs[0][1]:+.1f}% · {pairs[1][0]:+.1f}% / {pairs[1][1]:+.1f}% | {'KÖTÜ' if bad else ('bir çiftte eşik üstü' if one else 'geçti')} |")
print("yük:", {i: (runs[i]["yuk"][0], runs[i]["yuk"][-1]) for i in runs}, "· kalabalık cari satır:", runs[1]["kalabalikCariSatir"])
