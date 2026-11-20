# Kullanım: python3 -I prof.py <cpuprofile> — öz süreyi (self) işlev + dosya:satır başına toplar, ilk 25.
import json, sys, collections
p = json.load(open(sys.argv[1]))
nodes = {n["id"]: n for n in p["nodes"]}
dt = collections.Counter()
for sid, d in zip(p["samples"], p["timeDeltas"]):
    dt[sid] += d
agg = collections.Counter()
for nid, us in dt.items():
    cf = nodes[nid]["callFrame"]
    key = f'{cf["functionName"] or "(anon)"} {cf["url"].split("/")[-1]}:{cf["lineNumber"] + 1}'
    agg[key] += us
tot = sum(agg.values())
print(f"toplam {tot/1000:.0f} ms")
for k, v in agg.most_common(25):
    print(f"{v/1000:8.0f} ms  {k}")
