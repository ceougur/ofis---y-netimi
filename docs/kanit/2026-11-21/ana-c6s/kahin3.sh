#!/bin/bash
# ANA OTURUM — kahin.sh'nin kalan adımları (07:22 sınırda kesildi; kâhin-defter UTC 187/187, kâhin-cari UTC 17.648/17.648 GEÇTİ).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/ana-c6s; W=/dev/shm/c6-sinama
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $W || exit 1
kos() { ad=$1; tz=$2; shift 2
  TZ=$tz KANIT_DIR=$A/kanit timeout -k 5 3500 flock -s -w 3000 $S/olcum.lock node tools/kanit.mjs kos ana-c6s-$ad -- "$@" > $A/$ad.log 2>&1
  echo "$ad çıkış $? · $(date -u +%H:%M) · $(grep -E '^\[kanit\]' $A/$ad.log | tail -1 | cut -c1-160)"; }
echo "başta $(cat /proc/loadavg) · $(date -u +%H:%M) · uç $(git rev-parse --short HEAD)"
kos kahin-defter-Europe-Istanbul Europe/Istanbul npm run test:kahin-defter
kos kahin-cari-Europe-Istanbul Europe/Istanbul npm run test:kahin-cari
kos kahin-muhasebe-model Europe/Istanbul python3 -I test/bagimsiz/muhasebe/test_model.py
kos kahin-maliyet Europe/Istanbul npm run test:kahin-maliyet
kos kahin-tutar Europe/Istanbul npm run test:kahin-tutar
echo "bitti $(date -u +%H:%M) · temiz: $(git status -s | grep -v node_modules | wc -l) · $(cat /proc/loadavg)"
