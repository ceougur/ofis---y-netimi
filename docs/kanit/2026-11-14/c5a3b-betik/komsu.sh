#!/bin/bash
# Ç5-A tur 3b kabul D: komşular (komsu.txt — tarama) iki TZ, yeni kod. Dıştan `flock -s -n olcum.lock`.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
T=$S/c5a3b-z4
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a076afd863444806e
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$T/kanit
echo "komşu başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · $(wc -l < $T/komsu.txt) dosya"
# 3) komşular iki TZ (yeni kod)
cd $W || exit 1
for Z in UTC Europe/Istanbul; do
  TZ=$Z timeout -k 5 3600 node tools/kanit.mjs kos c5a3b-komsu-${Z#*/} -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $(cat $T/komsu.txt) > $T/komsu-${Z#*/}.out 2>&1
  echo "komşu $Z çıkış $? · $(tail -1 $T/komsu-${Z#*/}.out) · $(date -u +%H:%M:%S)"
done
echo "komşu sonda $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
