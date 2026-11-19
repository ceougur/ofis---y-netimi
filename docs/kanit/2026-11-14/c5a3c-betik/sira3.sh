#!/bin/bash
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3c-k7
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a21e56c46518ba374
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
echo "basla $(date -u +%H:%M:%S) $(cat /proc/loadavg)" > $K/sira3.log
mkdir -p $K/ekran
cd $W || exit 1
for s in senaryo-supheli-230 senaryo-banka-210 senaryo-supheli-kuyruk-250; do
  for Z in Europe/Istanbul UTC; do
    EKRAN_DIR=$K/ekran TZ=$Z timeout -k 5 1200 node test/e2e/$s.mjs > $K/e2e-$s-${Z#*/}.out 2>&1
    echo "e2e $s $Z cikis $? $(grep -E 'geçti, [0-9]+ kaldı' $K/e2e-$s-${Z#*/}.out | tail -1) $(date -u +%H:%M:%S)" >> $K/sira3.log
  done
done
$K/komsu.sh
cat $K/komsu.log >> $K/sira3.log
# v2.4.9 fikstür vakası tabanda (yeni test dosyası taban kopyasında; kırmızının nedeni)
cp $W/test/supheli-kuyruk-defter-250.test.mjs $K/taban/test/ && mkdir -p $K/taban/test/fixtures && cp -r $W/test/fixtures/supheli-kuyruk-v249 $K/taban/test/fixtures/
(cd $K/taban && TZ=UTC timeout -k 5 900 node --test --test-reporter=spec test/supheli-kuyruk-defter-250.test.mjs) > $K/taban-kirmizi-yeni-test-son.txt 2>&1
echo "taban kirmizi cikis $? $(grep -E '^ℹ (pass|fail)' $K/taban-kirmizi-yeni-test-son.txt | tr '\n' ' ')" >> $K/sira3.log
for a in temiz:/dev/shm/c5a3c-k7/temiz hazir:/dev/shm/c5a3c-k7/hazir; do
  bash $K/esd.sh ${a%%:*} ${a#*:} >> $K/esd.log 2>&1
done
bash $K/esd.sh tykv249 /dev/shm/c5a3c-k7/fx-tyk-fark-v249 2026-10-20T12:00:00+03:00 >> $K/esd.log 2>&1
bash $K/esd.sh skv249 /dev/shm/c5a3c-k7/fx-supheli-kuyruk-v249 2026-10-20T12:00:00+03:00 >> $K/esd.log 2>&1
echo "esd bitti $(date -u +%H:%M:%S)" >> $K/sira3.log
