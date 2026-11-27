#!/bin/bash
# ANA OTURUM — c6-sinama (69e31186): birleştirmeden önce CI'nin kâhin ↔ program adımları (AKIŞ), paylaşılan kilit.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/ana-c6s; W=/dev/shm/c6-sinama
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $W || exit 1
kos() { ad=$1; tz=$2; shift 2
  TZ=$tz KANIT_DIR=$A/kanit timeout -k 5 3500 flock -s -w 3000 $S/olcum.lock node tools/kanit.mjs kos ana-c6s-$ad -- "$@" > $A/$ad.log 2>&1
  echo "$ad çıkış $? · $(date -u +%H:%M) · $(grep -E '^\[kanit\]' $A/$ad.log | tail -1 | cut -c1-160)"; }
echo "başta $(cat /proc/loadavg) · uç $(git rev-parse --short HEAD)"
for tz in UTC Europe/Istanbul; do a=$(echo $tz | tr '/' '-'); for k in defter cari; do kos kahin-$k-$a $tz npm run test:kahin-$k; done; done
kos kahin-muhasebe-model Europe/Istanbul python3 -I test/bagimsiz/muhasebe/test_model.py
kos kahin-maliyet Europe/Istanbul npm run test:kahin-maliyet
kos kahin-tutar Europe/Istanbul npm run test:kahin-tutar
echo "bitti $(date -u +%H:%M) · temiz: $(git status -s | grep -v node_modules | wc -l) · $(cat /proc/loadavg)"
