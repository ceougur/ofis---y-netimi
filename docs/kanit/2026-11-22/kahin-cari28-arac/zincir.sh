#!/bin/bash
# Cari kâhini bakımı 28 — zincir (her adım kos.sh içinde flock -s + timeout 2400): kullanım zincir.sh "<tz adım>" …
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-a5cd991d0d986ba51/docs/kanit/2026-11-22/kahin-cari28-arac/kos.sh
O=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kc28-a5c
for adim in "$@"; do
  set -- $adim
  "$K" "$1" "$2" > "$O/$2-$1.out" 2>&1
  echo "$adim: $(grep -E "denetim geçti|== " "$O/$2-$1.out" | tr "\n" " " | tail -c 400)"
done
