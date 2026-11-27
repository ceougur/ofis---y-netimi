#!/bin/bash
# M1 tur 2 (son kod a61f334e): yeni testler (tur 1 ↔ tur 2, iki TZ) → mutantlar (iki TZ) → kâhin-defter (iki ağaç, iki TZ) → komşu UTC → ekran senaryoları (tur 2; yeni senaryo tur 1'de de).
# flock -s altında çağrılır. Başta yük 4'ün üstündeyse TEK SEFERLİK en çok 10 dk bekler.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-af18bb1989d74249b
B=$WT/docs/kanit/2026-11-27/m1t2-betik
K=$S/m1t2-ajan/kanit
for i in $(seq 1 60); do awk '{exit !($1 > 4)}' /proc/loadavg || break; sleep 10; done
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
bash $B/yeni-test.sh
for tz in UTC Europe/Istanbul; do
  tag=$([ $tz = UTC ] && echo utc || echo ist)
  echo "== mutant $tz başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
  timeout -k 5 1800 python3 -I $B/mutant.py /dev/shm/m1t2-kdv/mut $K/2026-11-27/m1t2-mutant-$tag.json $tz; echo "çıkış $?"
done
bash $B/kahin.sh
echo "== komşu utc başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
timeout -k 5 900 bash $B/komsu.sh utc $WT $K 2>&1 | grep -E "^\[kanit\]" | tail -30
bash $B/e2e.sh $WT yeni
(cd /dev/shm/m1t2-kdv/eski && HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194 EKRAN_DIR=$S/m1t2-ajan/ekran-taban timeout -k 5 600 node $WT/tools/kanit.mjs kos m1t2-e2e-taban-senaryo-kdv-zincir-251 -- node test/e2e/senaryo-kdv-zincir-251.mjs 2>&1 | grep -E "✗|geçti, |\[kanit\]")
echo "bitti $(date -u +%H:%M:%S) $(cat /proc/loadavg)"
