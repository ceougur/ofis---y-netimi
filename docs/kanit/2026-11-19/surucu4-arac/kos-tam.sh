#!/bin/bash
# Sürücü bakımı 4: tam koşu (bütün senaryolar, iki saat dilimi, sürücünün kendi --paralel değeri) — kos-tam.sh <ad> [program kökü] [senaryo süzgeci]
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-afb4030486d151db9
SP=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
AD=$1
PR=${2:+--program $2}
SZ=${3:+--senaryo $3}
cd "$W" || exit 1
cat /proc/loadavg
rm -rf "/dev/shm/surucu4-afb4/$AD" "/dev/shm/surucu4-afb4/v-$AD"
KANIT_DIR=$SP/surucu4-afb4/kanit timeout -k 5 3500 flock -s -w 3600 $SP/olcum.lock node tools/kanit.mjs kos "surucu4-$AD" -- node --disable-warning=ExperimentalWarning test/bagimsiz/muhasebe-surucu/kos.mjs --cikti "/dev/shm/surucu4-afb4/$AD" --veri "/dev/shm/surucu4-afb4/v-$AD" $PR $SZ > "$SP/surucu4-afb4/$AD.out" 2>&1
echo "cikis $AD $?"
rm -rf "/dev/shm/surucu4-afb4/v-$AD"
