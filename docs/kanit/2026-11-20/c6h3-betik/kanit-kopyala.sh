#!/bin/bash
# Not defterindeki kanıtları depoya kopyalar (docs/kanit/2026-11-20/c6h3-*) — yalnız kendi dosyalarım; commit ayrıca (git add <yol>).
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab54e5fc492a09964/docs/kanit/2026-11-20
mkdir -p "$K/c6h3-betik" || exit 1
cp $N/betik/*.sh $N/betik/*.mjs $N/betik/*.py "$K/c6h3-betik/" || exit 1
for f in $N/hiz*.log $N/mutasyon*.log $N/kirmizi*.log $N/sinif*.log $N/komsu*.log $N/kahin*.log $N/zorla*.log; do [ -f "$f" ] && cp "$f" "$K/c6h3-$(basename "$f")"; done
for f in $N/kanit/2026-11-20/c6h3-*; do [ -f "$f" ] && case "$f" in *deneme*) ;; *) cp "$f" "$K/";; esac; done
ls "$K" | grep -c c6h3
