#!/bin/bash
# M1 tur 2: mutantlar (iki TZ, ayrı kopya /dev/shm/m1t2-kdv/mut) → komşular (iki TZ, çalışma ağacı). flock -s altında çağrılır; her adımın kendi sınırı.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-af18bb1989d74249b
B=$WT/docs/kanit/2026-11-27/m1t2-betik
K=$S/m1t2-ajan/kanit
for tz in UTC Europe/Istanbul; do
  tag=$([ $tz = UTC ] && echo utc || echo ist)
  echo "== mutant $tz başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
  timeout -k 5 2400 python3 -I $B/mutant.py /dev/shm/m1t2-kdv/mut $K/2026-11-27/m1t2-mutant-$tag.json $tz; echo "çıkış $?"
done
for tag in utc ist; do
  echo "== komşu $tag başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
  timeout -k 5 900 bash $B/komsu.sh $tag $WT $K 2>&1 | grep -E "^\[kanit\]" | tail -30
done
echo "bitti $(date -u +%H:%M:%S) $(cat /proc/loadavg)"
