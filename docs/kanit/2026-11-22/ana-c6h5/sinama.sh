#!/bin/bash
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/ana-c6h5
cd /dev/shm/c6h-sinama || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
exec 8>$S/tam-npm-test.lock; flock -n 8 || { echo "tam test kilidi dolu" > $D/sinama-ozet.txt; exit 1; }
exec 9>$S/olcum.lock; flock -s -w 3600 9 || { echo "kilit alınamadı" > $D/sinama-ozet.txt; exit 1; }
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)" > $D/sinama-ozet.txt
timeout -k 5 4800 npm test > $D/tam.out 2>&1; echo "tam npm test çıkış $? $(date -u +%H:%M:%S)" >> $D/sinama-ozet.txt
TZ=UTC timeout -k 5 1500 npm run -s test:kahin-cari > $D/sinama-kahin-cari.out 2>&1; echo "kâhin cari çıkış $?" >> $D/sinama-ozet.txt
TZ=UTC timeout -k 5 1500 npm run -s test:kahin-defter > $D/sinama-kahin-defter.out 2>&1; echo "kâhin defter çıkış $?" >> $D/sinama-ozet.txt
echo "bitti $(cat /proc/loadavg) $(date -u +%H:%M:%S)" >> $D/sinama-ozet.txt
