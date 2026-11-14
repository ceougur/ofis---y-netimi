#!/usr/bin/env python3
# Dar kontrol c5a2e'nin betiklerini (OKUNUR: dk-c5a2e-q/p) tur 2f'nin kendi klasörüne kopyalar ve yollarını uyarlar (başka ajanın klasörüne yazılmaz).
import pathlib
SRC = pathlib.Path("/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2e-q/p")
DST = pathlib.Path("/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2f-k1/p")
DST.mkdir(exist_ok=True)
SUBS = [
    ("/home/user/ofis---y-netimi/.claude/worktrees/agent-a1cf141bb1205cad0", "/home/user/ofis---y-netimi/.claude/worktrees/agent-a46c87e85c8b28c2f"),
    ("/dev/shm/dkc5a2e-q/veri", "/dev/shm/c5a2f-k1/veri"),
    ("dkc5a2e-${process.pid}", "c5a2f-${process.pid}"),
]
for name in ["ortak.mjs", "sablon.mjs", "hedefli.mjs", "sira.mjs", "p3-saf.mjs"]:
    s = (SRC / name).read_text(encoding="utf-8")
    for a, b in SUBS:
        s = s.replace(a, b)
    (DST / name).write_text(s, encoding="utf-8")
    print(name, "dkc5a2e" in s, "a1cf141" in s)
