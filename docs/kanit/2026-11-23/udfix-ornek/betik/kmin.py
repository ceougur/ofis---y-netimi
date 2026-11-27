# Kâhin senaryosunu küçültür: verilen adımları tutar (ya da --ddmin ile adım atarak) ve kos.mjs'i koşar; fark satırlarını yazar.
# Kullanım: python3 -I kmin.py <senaryo.json> <çıktı klasörü> <kök> [--tut id,id,...] [--ddmin <fark anahtarı alt dizgesi>] [--sabit id,id]
import json, os, subprocess, sys

src, out, root = sys.argv[1], sys.argv[2], sys.argv[3]
args = sys.argv[4:]
opt = lambda n: args[args.index(n) + 1] if n in args else None
os.makedirs(out, exist_ok=True)
base = json.load(open(src))
steps = base["adimlar"]
if opt("--tut"):
    keep = set(opt("--tut").split(","))
    steps = [s for s in steps if s["id"] in keep]
fixed = set((opt("--sabit") or "").split(",")) - {""}
counter = [0]


def run(st, tag):
    counter[0] += 1
    d = dict(base, adimlar=st, ad=f"m{tag}")
    path = os.path.join(out, f"m{tag}.json")
    json.dump(d, open(path, "w"), ensure_ascii=False)
    r = subprocess.run(["node", "--disable-warning=ExperimentalWarning", os.path.join(root, "test/bagimsiz/cari/kos.mjs"), path, "--mutasyonsuz", "--cikti", os.path.join(out, f"o{tag}")], capture_output=True, text=True, timeout=900, cwd=root)
    return r.stdout + r.stderr


def fails(st, key):
    txt = run(st, f"d{counter[0]}")
    return any(key in line and "✗" in line for line in txt.splitlines())


key = opt("--ddmin")
if key:
    cur = steps
    n = 2
    while len(cur) >= 2:
        movable = [s for s in cur if s["id"] not in fixed]
        size = max(1, -(-len(movable) // n))
        reduced = False
        for i in range(n):
            drop = {s["id"] for s in movable[i * size:(i + 1) * size]}
            if not drop:
                continue
            rest = [s for s in cur if s["id"] not in drop]
            if fails(rest, key):
                cur, n, reduced = rest, max(n - 1, 2), True
                break
        if not reduced:
            if n >= len(movable):
                break
            n = min(len(movable), n * 2)
    steps = cur
    print("KÜÇÜK:", ",".join(s["id"] for s in steps))
txt = run(steps, "son")
for s in steps:
    print(json.dumps(s, ensure_ascii=False))
print("\n".join(l[:400] for l in txt.splitlines() if "✗" in l or "tuttu" in l or "Hata" in l or "Error" in l))
