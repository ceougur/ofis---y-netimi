#!/bin/bash
# komşu testler (ders 10) yeni kodda iki TZ + defter kâhini
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-m1k5
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
Y=/home/user/ofis---y-netimi/.claude/worktrees/agent-a77bb907d27f6fded
cd "$Y" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
T="test/kdv-ozeti-devreden-251.test.mjs test/kdv-ozeti-karma-251.test.mjs test/kdv-ozeti-mahsup-sonrasi-251.test.mjs test/kdv-ozeti-yalniz391-251.test.mjs test/kdv-ozeti-zincir-251.test.mjs test/c7b-kdv-ozeti-donem-250.test.mjs test/defter-243-vergi.test.mjs test/defter-243-ux24-toplam.test.mjs test/banka-220-pos-kdv.test.mjs test/banka-210-fis.test.mjs"
for tz in UTC Europe/Istanbul; do
  s=$(date +%s)
  TZ=$tz flock -s -w 3600 "$L" timeout -k 5 2400 node --test $T > "$N/komsu-${tz//\//_}.log" 2>&1
  echo "exit=$? sure=$(( $(date +%s) - s ))" >> "$N/komsu-${tz//\//_}.log"
done
s=$(date +%s)
flock -s -w 3600 "$L" timeout -k 5 2400 npm run test:kahin-defter > "$N/kahin-defter.log" 2>&1
echo "exit=$? sure=$(( $(date +%s) - s ))" >> "$N/kahin-defter.log"
