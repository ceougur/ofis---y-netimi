#!/bin/bash
# Cari kâhini bakımı 27 — program koşuları zinciri (her adım kos.sh'nin kendi ≤ 40 dk sınırıyla, flock -s altında): program UTC, program İstanbul, program ↔ eski kâhin (UTC), yapım aşaması listesi (UTC + İstanbul)
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-a911ce76a62d46cac/docs/kanit/2026-11-22/kahin-cari27-arac/kos.sh
O=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kc27-a91
for adim in "utc program" "ist program" "utc program-eski" "utc yapim" "ist yapim"; do
  set -- $adim
  "$K" "$1" "$2" > "$O/$2-$1.out" 2>&1
  echo "$adim: $(tail -2 "$O/$2-$1.out" | head -1)"
done
