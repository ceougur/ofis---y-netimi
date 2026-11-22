#!/bin/bash
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/ana-s252s
cd /dev/shm/s252-sinama || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
exec 8>$S/tam-npm-test.lock; flock -n 8 || { echo "tam test kilidi dolu" > $D/ozet.txt; exit 1; }
exec 9>$S/olcum.lock; flock -s -w 3600 9 || { echo "kilit alınamadı" > $D/ozet.txt; exit 1; }
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)" > $D/ozet.txt
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $D/YAPIM-ASAMASI-once.json
TZ=UTC timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz --mutasyonsuz --cikti $D/yapim > $D/yapim.out 2>&1; echo "yapım listesi yazımı çıkış $? · kayıt $(python3 -I -c 'import json,sys; print(len(json.load(open(sys.argv[1]))["kayitlar"]))' test/bagimsiz/cari/YAPIM-ASAMASI.json) · fark: $(git diff --stat -- test/bagimsiz/cari/YAPIM-ASAMASI.json | tail -1)" >> $D/ozet.txt
timeout -k 5 4800 npm test > $D/tam.out 2>&1; echo "tam npm test çıkış $? $(date -u +%H:%M:%S)" >> $D/ozet.txt
for tz in UTC Europe/Istanbul; do t=$(echo $tz | tr '/' '-')
  TZ=$tz timeout -k 5 1500 npm run -s test:kahin-cari > $D/kahin-cari-$t.out 2>&1; echo "kâhin cari $tz çıkış $?" >> $D/ozet.txt
done
TZ=UTC timeout -k 5 1500 npm run -s test:kahin-defter > $D/kahin-defter.out 2>&1; echo "kâhin defter çıkış $?" >> $D/ozet.txt
echo "A bitti $(cat /proc/loadavg) $(date -u +%H:%M:%S)" >> $D/ozet.txt
