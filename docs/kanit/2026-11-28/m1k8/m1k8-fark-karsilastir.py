# m1k8: fark-yeni-*.jsonl ↔ fark-eski-*.jsonl — ön izleme, fiş (log), defter BİREBİR mi; rapor farkları sınıflanır; yeni kodda değişmezler.
import json, sys, glob, os
N = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k8"
out = []
for tz in ["UTC", "Europe_Istanbul"]:
    for st in ["ay", "yil"]:
        def load(side):
            p = f"{N}/fark-{side}-{st}-{tz}.jsonl"
            return {d["seed"]: d for d in (json.loads(l) for l in open(p, encoding="utf-8") if l.strip())}
        y, e = load("yeni"), load("eski")
        seeds = sorted(set(y) & set(e))
        same_pre = same_fis = same_gl = 0
        rep_diff = 0
        rng_bad_new = rng_bad_old = 0
        quiet_bad_new = quiet_bad_old = 0
        bad = []
        for s in seeds:
            a, b = y[s], e[s]
            if all(a[k]["pre"] == b[k]["pre"] for k in ["s1", "s2"]): same_pre += 1
            else: bad.append(f"tohum {s} ön izleme farklı")
            if a["log"] == b["log"]: same_fis += 1
            else: bad.append(f"tohum {s} fiş farklı")
            if all(a[k]["gl"] == b[k]["gl"] for k in ["s1", "s2"]): same_gl += 1
            else: bad.append(f"tohum {s} defter farklı")
            if any(a[k]["rep"] != b[k]["rep"] for k in ["s1", "s2"]): rep_diff += 1
            # s2: aylar sırayla mahsup + sonra alış iptal → aralık (bugünkü ayın sonuna kadar) 391 − 191; kayıtsız bugünkü ay rapor = ön izleme (önceki ayların hepsi fişli ise)
            for side, d in (("yeni", a), ("eski", b)):
                c, p, n, net = d["s2"]["range"]
                if p - n + c != net:
                    if side == "yeni": rng_bad_new += 1
                    else: rng_bad_old += 1
            cur = sorted(a["s2"]["pre"])[-1]
            for side, d in (("yeni", a), ("eski", b)):
                if d["s2"]["rep"][cur] != d["s2"]["pre"][cur] and d["s2"]["rep"][sorted(d["s2"]["rep"])[-2]] == d["s2"]["pre"][sorted(d["s2"]["pre"])[-2]]:
                    if side == "yeni": quiet_bad_new += 1
                    else: quiet_bad_old += 1
        out.append(f"{tz} {st}: tohum {len(seeds)} · ön izleme aynı {same_pre} · fiş aynı {same_fis} · defter aynı {same_gl} · rapor farklı tohum {rep_diff} · "
                   f"2. evre aralık 391−191 bozuk yeni {rng_bad_new} / eski {rng_bad_old} · bugünkü ay rapor≠ön izleme (önceki ay eşitken) yeni {quiet_bad_new} / eski {quiet_bad_old}")
        out.extend(bad[:10])
print("\n".join(out))
