#!/bin/bash
# m1k7 iş B: dar kontrolün s2-karisik üreteci (dk-m1k5, değiştirilmeden) taban (t251-m1k6) ↔ yeni; iki TZ; sonra mutantlar.
Y=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa8f377d8c9dd1229
E=/dev/shm/m1k7-eski/eski
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k7
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-m1k5
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
export HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p "$N/s2"
D=$N/durum-b.txt
: > "$D"
read l _ < /proc/loadavg; echo "yük $l (başlangıç)" >> "$D"
awk -v l="$l" 'BEGIN{exit !(l>4)}' && { sleep 120; echo "yük $(cut -d' ' -f1 /proc/loadavg) (tek bekleme sonrası)" >> "$D"; }
run() { # ad root tz set seeds
  local s=$(date +%s)
  (cd "$K" && ROOT=$2 TZ=$3 SET=$4 SEEDS=$5 flock -s -w 3600 "$L" node --disable-warning=ExperimentalWarning s2-karisik.mjs > "$N/s2/$1.jsonl" 2> "$N/s2/$1.err")
  echo "$1 çıkış=$? süre=$(( $(date +%s) - s )) yük=$(cut -d' ' -f1 /proc/loadavg)" >> "$D"
}
run yeni-ay-utc "$Y" UTC ay 1-400
run eski-ay-utc "$E" UTC ay 1-400
run yeni-yil-utc "$Y" UTC yil 1-200
run eski-yil-utc "$E" UTC yil 1-200
run yeni-ay-ist "$Y" Europe/Istanbul ay 1-200
run eski-ay-ist "$E" Europe/Istanbul ay 1-200
run yeni-yil-ist "$Y" Europe/Istanbul yil 1-200
run eski-yil-ist "$E" Europe/Istanbul yil 1-200
echo "s2 BITTI" >> "$D"
s=$(date +%s)
flock -s -w 3600 "$L" python3 -I "$N/m1k7-mutant.py" "$N" > "$N/mutant-kos.txt" 2>&1
echo "mutant çıkış=$? süre=$(( $(date +%s) - s ))" >> "$D"
echo BITTI >> "$D"
