# eski ↔ yeni durum dökümü farkı (aynı tohum): KS7 satırı görmemiş caride fark = BEKLENMEYEN
import json, sys
a = [json.loads(l) for l in open(sys.argv[1])]
b = [json.loads(l) for l in open(sys.argv[2])]
ops_ok = all(x["op"] == y["op"] for x, y in zip(a, b))
exp = unexp = 0
first_unexp = []
for x, y in zip(a, b):
    for name, ax in x["accounts"].items():
        bx = y["accounts"][name]
        if ax["bakiye"] != bx["bakiye"]:
            unexp += 1; first_unexp.append((x["step"], name, "BAKİYE", ax["bakiye"], bx["bakiye"])); continue
        d = {k: (ax["faturalar"].get(k), bx["faturalar"].get(k)) for k in set(ax["faturalar"]) | set(bx["faturalar"]) if ax["faturalar"].get(k) != bx["faturalar"].get(k)}
        d.update({k: (ax["satirlar"].get(k), bx["satirlar"].get(k)) for k in set(ax["satirlar"]) | set(bx["satirlar"]) if ax["satirlar"].get(k) != bx["satirlar"].get(k)})
        if not d: continue
        if bx.get("ks7"): exp += 1
        else:
            unexp += 1; first_unexp.append((x["step"], name, d))
print(f"islem dizisi ayni: {ops_ok}; adim {len(a)}; KS7 carisinde fark (beklenen sinif) {exp}; KS7 gormemis caride fark {unexp}")
for f in first_unexp[:10]: print("  BEKLENMEYEN", f)
