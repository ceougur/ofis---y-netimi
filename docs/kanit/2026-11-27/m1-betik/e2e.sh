#!/bin/bash
# M1 ekran senaryoları: yeni senaryo + beklentisi değişen üç senaryo (ders 28). $1 = kod kökü, $2 = etiket
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
cd "$1" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$S/m1-ajan/kanit PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a372b20f2d341697a
for sc in senaryo-kdv-devreden-251 senaryo-kdv-donemi-250 senaryo-defter-243 senaryo-c7b-kabul-250; do
  [ -f test/e2e/$sc.mjs ] || { echo "== $sc yok"; continue; }
  mkdir -p $S/m1-ajan/ekran-$2/$sc
  echo "== $sc $(cat /proc/loadavg)"
  EKRAN_DIR=$S/m1-ajan/ekran-$2/$sc timeout -k 5 1200 node $WT/tools/kanit.mjs kos m1-e2e-$2-$sc -- node test/e2e/$sc.mjs 2>&1 | grep -E "✗|geçti, |\[kanit\]"
done
