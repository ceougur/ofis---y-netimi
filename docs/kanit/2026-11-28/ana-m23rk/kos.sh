#!/bin/bash
cd /home/user/ofis---y-netimi
R=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m23rk
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$R/kanit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
k() { ad=$1; d=$2; tz=$3; sn=$4; shift 4; (cd $d && TZ=$tz EKRAN_DIR=$R/ekran-$ad timeout -k 5 $sn node /home/user/ofis---y-netimi/tools/kanit.mjs kos m23rk-$ad -- "$@" > $R/$ad.log 2>&1); echo "$ad cikis=$? $(date -u +%H:%M)" >> $R/ozet.txt; tail -1 $R/$ad.log >> $R/ozet.txt; }
T4="test/supheli-degersiz-hiz-m2t2-251.test.mjs test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs test/supheli-degersiz-siniri-m2-251.test.mjs test/supheli-degersiz-m2t3-251.test.mjs"
E=--disable-warning=ExperimentalWarning
for tz in UTC Europe/Istanbul; do s=${tz##*/}
 k yeni-test-$s $R/yeni $tz 1800 node --test $T4
 k yeni-iptal-e2e-$s $R/yeni $tz 1200 node $E test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs
 k eski2-test-$s $R/eski2 $tz 1800 node --test test/supheli-degersiz-hiz-m2t2-251.test.mjs test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs
 k eski3-test-$s $R/eski3 $tz 1800 node --test test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs test/supheli-degersiz-m2t3-251.test.mjs
done
k yeni-siniri-e2e-UTC $R/yeni UTC 1200 node $E test/e2e/senaryo-degersiz-siniri-m2-251.mjs
k eski2-iptal-e2e-UTC $R/eski2 UTC 1200 node $E test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs
k eski3-iptal-e2e-UTC $R/eski3 UTC 1200 node $E test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs
mapfile -t F < $R/komsu-liste.txt
k komsu-UTC $R/yeni UTC 3300 node --test --test-concurrency=2 "${F[@]}"
timeout -k 5 3300 python3 -I $R/mutant.py >> $R/ozet.txt 2>&1; echo "mutant cikis=$?" >> $R/ozet.txt
echo "BITTI $(date -u +%H:%M) $(cat /proc/loadavg)" >> $R/ozet.txt
