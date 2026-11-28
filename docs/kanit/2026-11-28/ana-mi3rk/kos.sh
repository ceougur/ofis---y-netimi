#!/bin/bash
cd /home/user/ofis---y-netimi
R=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/mi3rk
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$R/kanit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
k() { ad=$1; d=$2; tz=$3; shift 3; (cd $d && TZ=$tz EKRAN_DIR=$R/ekran-$ad timeout -k 5 1200 node /home/user/ofis---y-netimi/tools/kanit.mjs kos mi3rk-$ad -- "$@" > $R/$ad.log 2>&1); echo "$ad cikis=$? $(date -u +%H:%M)" >> $R/ozet.txt; tail -1 $R/$ad.log >> $R/ozet.txt; }
for tz in UTC Europe/Istanbul; do s=${tz##*/}
 k yeni-senaryo-$s $R/yeni $tz node --disable-warning=ExperimentalWarning test/e2e/senaryo-mi2-251.mjs
 k yeni-grup-$s $R/yeni $tz node --test test/mi2-grup-ozeti-251.test.mjs
 k eski-senaryo-$s $R/eski $tz node --disable-warning=ExperimentalWarning test/e2e/senaryo-mi2-251.mjs
done
k yeni-mi1-UTC $R/yeni UTC node --disable-warning=ExperimentalWarning test/e2e/senaryo-mi1-251.mjs
python3 -I $R/mutant.py >> $R/ozet.txt 2>&1
echo "BITTI $(date -u +%H:%M) $(cat /proc/loadavg)" >> $R/ozet.txt
