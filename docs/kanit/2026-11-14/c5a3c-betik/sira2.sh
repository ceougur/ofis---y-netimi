#!/bin/bash
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3c-k7
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a21e56c46518ba374
cd $K || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "basla $(date -u +%H:%M:%S) $(cat /proc/loadavg)" > $K/sira2.log
$K/kahin.sh yeni $K/yeni
echo "yeni-kahin bitti $(date -u +%H:%M:%S) $(cat /proc/loadavg)" >> $K/sira2.log
for R in taban yeni; do
  mkdir -p $K/surucu-$R $K/surucu-veri-$R
  (cd $W && node tools/kanit.mjs kos c5a3c-surucu-$R -- node test/bagimsiz/muhasebe-surucu/kos.mjs --program $K/$R --cikti $K/surucu-$R --veri $K/surucu-veri-$R) > $K/surucu-$R.txt 2>&1
  echo "surucu $R cikis $? $(date -u +%H:%M:%S)" >> $K/sira2.log
done
(cd $W && python3 -I test/bagimsiz/muhasebe-surucu/gerileme.py $K/surucu-taban $K/surucu-yeni) > $K/surucu-gerileme.txt 2>&1
echo "gerileme cikis $?" >> $K/sira2.log
(cd $K/mut && node test/supheli-kuyruk-defter-250-mutasyon.mjs --kopya $K/mut --dokum $K/mut-dokum) > $K/mutasyon.txt 2>&1
echo "mutasyon cikis $? $(date -u +%H:%M:%S)" >> $K/sira2.log
$K/komsu1.sh $W $K/k1-yeni-utc UTC > $K/k1-yeni-utc.ozet 2>&1
echo "komsu utc bitti $(date -u +%H:%M:%S)" >> $K/sira2.log
