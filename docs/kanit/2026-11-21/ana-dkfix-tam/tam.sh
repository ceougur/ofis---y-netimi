#!/bin/bash
# ANA OTURUM — birleşik küçük tur SINAMA AĞACI (/dev/shm/dkfix-sinama, dal dkfix-sinama = çalışma dalı + de403915 + CI listesi): BİR tam npm test (ders 35, 41).
# Çağrı: timeout -k 5 7000 flock -s -w 3600 <olcum.lock> bash tam.sh
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/ana-dkfix-sinama; W=/dev/shm/dkfix-sinama
export KANIT_DIR=$A/kanit HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
cd $W || exit 1
[ "$(git rev-parse HEAD)" = "$(git rev-parse dkfix-sinama)" ] || { echo "uçta değil"; exit 1; }
[ -z "$(git status -s | grep -v node_modules)" ] || { echo "ağaç temiz değil"; exit 1; }
echo "tam test başladı $(date -u +%T) yük $(cut -d' ' -f1-3 /proc/loadavg) · uç $(git rev-parse --short HEAD)"
flock -n $S/tam-npm-test.lock timeout 5400 node tools/kanit.mjs kos ana-dkfix-tam -- npm test > $A/tam.out 2>&1; echo "TAM npm test çıkış $? $(grep -E '^\[kanit\]' $A/tam.out | tail -1 | cut -c1-170)"
grep -E "^# (tests|pass|fail|cancelled|skipped|todo)" $A/tam.out | tr '\n' ' '; echo
grep -E "^not ok|✖" $A/tam.out | sort -u | head -12 | cut -c1-220
echo "bitti $(date -u +%T) yük $(cut -d' ' -f1-3 /proc/loadavg) · temiz mi: $(git status -s | grep -v node_modules | wc -l)"
