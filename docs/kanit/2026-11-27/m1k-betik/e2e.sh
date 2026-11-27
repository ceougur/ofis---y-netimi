#!/bin/bash
# M1 küçük tur ekran senaryoları: KDV Özeti'ne dokunan BÜTÜN senaryolar (ders 37; git grep "kdv-ozeti|KDV Özeti" test/e2e) + bu turun yeni senaryosu.
# $1 = kod kökü, $2 = etiket (yeni | taban), $3 = (isteğe bağlı) virgüllü senaryo listesi. flock -s altında çağrılır.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-af4f8faccec231727
cd "$1" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$S/m1k/kanit PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
LIST="senaryo-kdv-mahsup-sonrasi-251 senaryo-kdv-zincir-251 senaryo-kdv-devreden-251 senaryo-kdv-donemi-250 senaryo-defter-243 senaryo-c7b-kabul-250 senaryo-mobil-247 senaryo-banka-210"
[ -n "$3" ] && LIST=${3//,/ }
for sc in $LIST; do
  [ -f test/e2e/$sc.mjs ] || { echo "== $sc yok"; continue; }
  mkdir -p $S/m1k/ekran-$2/$sc
  echo "== $sc $(cat /proc/loadavg)"
  EKRAN_DIR=$S/m1k/ekran-$2/$sc timeout -k 5 2400 node $WT/tools/kanit.mjs kos m1k-e2e-$2-$sc -- node test/e2e/$sc.mjs 2>&1 | grep -E "✗|geçti, |\[kanit\]"
done
