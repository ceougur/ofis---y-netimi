#!/bin/bash
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/ana-c6s; W=/dev/shm/c6-sinama
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $W || exit 1
for tz in UTC Europe/Istanbul; do a=$(echo $tz | tr '/' '-')
  TZ=$tz KANIT_DIR=$A/kanit timeout -k 5 3500 flock -s -w 3000 $S/olcum.lock node tools/kanit.mjs kos ana-c6s-sinif-$a -- node --test test/c6h-v249-sinif.test.mjs > $A/sinif-$a.log 2>&1
  echo "$tz çıkış $? $(grep -E '^# (tests|pass|fail|cancelled)' $A/sinif-$a.log | tr '\n' ' ')"; done
