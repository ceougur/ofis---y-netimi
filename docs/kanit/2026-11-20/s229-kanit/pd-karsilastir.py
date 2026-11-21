import json
import sys

a = json.load(open(sys.argv[1], encoding="utf-8"))
b = json.load(open(sys.argv[2], encoding="utf-8"))


def walk(x, y, path, out):
    if type(x) is not type(y):
        out.append((path, x, y))
    elif isinstance(x, dict):
        for k in sorted(set(x) | set(y)):
            walk(x.get(k, "<YOK>"), y.get(k, "<YOK>"), f"{path}.{k}", out)
    elif isinstance(x, list):
        if len(x) != len(y):
            out.append((path + "[len]", len(x), len(y)))
        for i, (p, q) in enumerate(zip(x, y)):
            walk(p, q, f"{path}[{i}]", out)
    elif x != y:
        out.append((path, x, y))


out = []
walk(a, b, "", out)
rows = {k: len(v) for k, v in a["tables"].items() if isinstance(v, list)}
print(sys.argv[3], "FARK SAYISI:", len(out), "(BİREBİR)" if not out else "", "| adım", len(a["steps"]), "| red", sum(1 for s in a["steps"] if s[1] != 200), "| satır", rows, "| mutabakat", a.get("integrity"), b.get("integrity"))
for path, x, y in out[:40]:
    print("  fark:", path, json.dumps(x, ensure_ascii=False)[:160], "<>", json.dumps(y, ensure_ascii=False)[:160])
