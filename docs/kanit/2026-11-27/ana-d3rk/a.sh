#!/bin/bash
. /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/d3rk/ortak.sh
O=$R/ozet-a.txt; echo "başladı $(date -u +%H:%M) $(cat /proc/loadavg)" > $O
cd $R/yeni || exit 1
T="$(ls test/devir-d3-*.test.mjs) test/acilis-519-250.test.mjs test/defter-hiz-esdegerlik-250.test.mjs test/s127-tek-kez-250.test.mjs"
K="test/devir-arsiv-wal-250.test.mjs test/devir-d2-arsiv-250.test.mjs test/devir-d2-arsiv-goc-kesinti-250.test.mjs test/devir-d2-yedek-250.test.mjs test/devir-d2-bakim-250.test.mjs test/yazim-duzeni.test.mjs test/platform-tasinabilirlik.test.mjs test/lisans-servisi-izolasyonu.test.mjs test/kanit-araci.test.mjs"
for tz in UTC Europe/Istanbul; do s=${tz##*/}
  k $R/yeni d3rk-yeni-$s $tz 900 node --test --test-concurrency=1 $T
  for i in 1 2 3 4 5; do k $R/eski$i d3rk-eski$i-$s $tz 900 node --test --test-concurrency=1 $(cat $R/eski$i.testler); done
  k $R/yeni d3rk-komsu-$s $tz 900 node --test --test-concurrency=1 $K
  k $R/yeni d3rk-kahin-defter-$s $tz 600 npm run test:kahin-defter
  k $R/yeni d3rk-kahin-cari-$s $tz 1800 npm run test:kahin-cari
done
mkdir -p $R/mut && ( cd $R/yeni && git archive HEAD server test package.json | tar -x -C $R/mut ) && ln -s /home/user/ofis---y-netimi/node_modules $R/mut/node_modules
k $R/yeni d3rk-mutasyon-UTC UTC 1500 node test/devir-d3-mutasyon.mjs --kopya $R/mut
echo "BİTTİ $(date -u +%H:%M) $(cat /proc/loadavg)" >> $O
