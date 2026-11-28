import json, sys
def o(p): return {json.loads(l)["seed"]: json.loads(l) for l in open(p, encoding="utf-8") if l.startswith("{")}
x, y = o(sys.argv[1]), o(sys.argv[2])
ortak = [s for s in y if s in x]
d = [s for s in ortak if (x[s].get("each"), x[s].get("notes"), x[s].get("range")) != (y[s].get("each"), y[s].get("notes"), y[s].get("range"))]
print(sys.argv[1], "↔", sys.argv[2], "ortak", len(ortak), "fark", len(d), d[:10])
