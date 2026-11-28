#!/bin/bash
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-m1k5
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
cd "$N" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
run() { # ad root tz set seeds
  s=$(date +%s)
  ROOT=$2 TZ=$3 SET=$4 SEEDS=$5 flock -s -w 3600 "$L" timeout -k 5 3000 node s2-karisik.mjs > "s2-$1.jsonl" 2> "s2-$1.err"
  echo "$1 exit=$? sure=$(( $(date +%s) - s ))" >> s2-durum.txt
}
Y=/home/user/ofis---y-netimi/.claude/worktrees/agent-a77bb907d27f6fded
E=/dev/shm/dk-m1k5-eski
run yeni-ay-utc "$Y" UTC ay 1-400
run eski-ay-utc "$E" UTC ay 1-400
run yeni-yil-utc "$Y" UTC yil 1-200
run eski-yil-utc "$E" UTC yil 1-200
run yeni-ay-ist "$Y" Europe/Istanbul ay 1-200
run yeni-yil-ist "$Y" Europe/Istanbul yil 1-200
