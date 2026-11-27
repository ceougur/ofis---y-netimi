#!/bin/bash
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/ana-izt
exec 8>$S/tam-npm-test.lock; flock -n 8 || { echo "tam test kilidi dolu" > $D/tam-ozet.txt; exit 1; }
exec 9>$S/olcum.lock; flock -s -w 3600 9 || { echo "kilit alınamadı" > $D/tam-ozet.txt; exit 1; }
cd /dev/shm/izt-sinama || exit 1
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)" > $D/tam-ozet.txt
HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 6600 npm test > $D/tam.out 2>&1; echo "çıkış $? sonda $(cat /proc/loadavg) $(date -u +%H:%M:%S)" >> $D/tam-ozet.txt
