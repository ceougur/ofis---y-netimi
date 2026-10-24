import json, sys
a = [json.loads(l) for l in open(sys.argv[1])][-1]; b = [json.loads(l) for l in open(sys.argv[2])][-1]
for k in ("trial", "reconciliation", "cash"):
    print(k, "AYNI" if a.get(k) == b.get(k) else "FARKLI", len(json.dumps(a.get(k))))
