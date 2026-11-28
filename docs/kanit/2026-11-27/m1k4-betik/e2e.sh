#!/bin/bash
# M1 KÜÇÜK TUR 4 KOPYASI: küçük tur 3ün betiği AYNEN — yalnız yollar bu tura (ağaç agent-a7d99fd88f55969de, taban = t251-m1k3 kopyası /dev/shm/m1k4-kdv/eski, kanıt scratchpad/m1k4/kanit, ad öneki m1k4-).
# M1 küçük tur 3 — KDV Özeti'ne dokunan ekran senaryoları (kabul D). flock -s altında çağrılır.
# $1 = kod kökü, $2 = ekran görüntüsü klasörü, $3 = kanıt klasörü, $4 = senaryo listesi (boşluklu; varsayılan kabul D'nin sekizi), $5 = ad eki (yeni | taban).
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7d99fd88f55969de
CODE=${1:-$WT}
SHOTS=${2:-/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k4/ekran}
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=${3:-/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k4/kanit}
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
LIST=${4:-"senaryo-kdv-mahsup-sonrasi-251 senaryo-kdv-zincir-251 senaryo-kdv-devreden-251 senaryo-kdv-donemi-250 senaryo-defter-243 senaryo-c7b-kabul-250 senaryo-mobil-247 senaryo-banka-210"}
SIDE=${5:-yeni}
mkdir -p $SHOTS
for s in $LIST; do
  mkdir -p $SHOTS/$s
  echo "== $s $(cat /proc/loadavg)"
  (cd $CODE && EKRAN_DIR=$SHOTS/$s timeout -k 5 2400 node $WT/tools/kanit.mjs kos m1k4-e2e-$SIDE-$s -- node test/e2e/$s.mjs) 2>&1 | grep -E "^\[kanit\]|✗|geçti, [0-9]+ kaldı"
done
