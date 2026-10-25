# Σ açık (satış faturası + elle borç Kalan − alış faturası − elle alacak Kalan) = bakiye mi? (kartsız cariler; adım başına)
import json, sys
def dev(path):
    out = {}
    for line in open(path):
        d = json.loads(line)
        for name, a in d["accounts"].items():
            if a.get("kart"): continue
            net = 0.0
            for v in a["faturalar"].values():
                kind, op, st = v.split("/")
                op = float(op)
                net += op if kind in ("sale", "smm") else -op if kind == "purchase" else 0
            for v in a["satirlar"].values():
                kind, rem = v.split("/")
                rem = float(rem) if rem not in ("None", "undefined", "") else 0.0
                net += rem if kind == "debt" else -rem
            key = ("geri-odeme" if a.get("geriOdeme") else "odemesiz") + ("/ks7" if a.get("ks7") else "/ks7siz")
            ok = abs(net - a["bakiye"]) < 0.005
            o = out.setdefault(key, [0, 0])
            o[0 if ok else 1] += 1
    return out
for p in sys.argv[1:]:
    print(p.split("/")[-1], {k: f"esit {v[0]} / farkli {v[1]}" for k, v in sorted(dev(p).items())})
