#!/usr/bin/env python3
# Hedefli çıktıları: yeni ↔ taban (aynı TZ) ve TZ ↔ TZ (aynı kod) karşılaştırması; vaka (A/B/C/D) başına aynı / farklı satır sayısı. İpucu metni ayrıca.
import pathlib, re, sys
K = pathlib.Path("/home/user/ofis---y-netimi/.claude/worktrees/agent-a46c87e85c8b28c2f/docs/kanit/2026-11-14")
def rows(name):
    out = {}
    for line in (K / name).read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\[([ABCD])", line)
        if m:
            out.setdefault(m.group(1), []).append(line)
    return out
strip = lambda s: re.sub(r' ipucu="[^"]*"', "", s)
for z in ["Europe_Istanbul", "UTC"]:
    y, t = rows(f"c5a2f-hedefli-yeni-{z}.log"), rows(f"c5a2f-hedefli-taban-{z}.log")
    for case in "ABCD":
        a, b = y.get(case, []), t.get(case, [])
        same = sum(1 for p, q in zip(a, b) if p == q)
        same_nohint = sum(1 for p, q in zip(a, b) if strip(p) == strip(q))
        print(f"{z} vaka {case}: yeni {len(a)} satır, taban {len(b)} satır · birebir {same} · ipucu dışında aynı {same_nohint}")
for side in ["yeni", "taban"]:
    i, u = (K / f"c5a2f-hedefli-{side}-Europe_Istanbul.log").read_text(encoding="utf-8").splitlines(), (K / f"c5a2f-hedefli-{side}-UTC.log").read_text(encoding="utf-8").splitlines()
    diff = [(p, q) for p, q in zip(i[1:], u[1:]) if p != q]
    print(f"{side}: İstanbul ↔ UTC farklı satır {len(diff)} (ilk satır KOD/TZ hariç; satır {len(i)} / {len(u)})")
