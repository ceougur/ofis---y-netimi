#!/bin/bash
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/ana-c6h5
export HUKUK_LICENSE_URL=http://127.0.0.1:9
exec 9>$S/olcum.lock; flock -s -w 3600 9 || { echo "kilit alınamadı" > $D/ozet.txt; exit 1; }
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)" > $D/ozet.txt
for tz in UTC Europe/Istanbul; do t=$(echo $tz | tr '/' '-')
  (cd /dev/shm/ana-c6h5 && TZ=$tz timeout -k 5 2400 node --disable-warning=ExperimentalWarning --test test/c6h-tek-okuma.test.mjs test/c6h-alt-hesap-farki.test.mjs test/c6h-kural-farki-fis.test.mjs test/c6h-degerleme-dondurma.test.mjs > $D/yeni-$t.out 2>&1); echo "yeni $tz çıkış $?" >> $D/ozet.txt
  (cd /dev/shm/ana-c6h4-yeni && TZ=$tz timeout -k 5 2400 node --disable-warning=ExperimentalWarning --test test/c6h-tek-okuma.test.mjs > $D/eski-$t.out 2>&1); echo "eski(tur4) $tz çıkış $?" >> $D/ozet.txt
  (cd /dev/shm/ana-c6h5 && TZ=$tz timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/defter/kos.mjs > $D/kahin-defter-$t.out 2>&1); echo "kâhin defter $tz çıkış $?" >> $D/ozet.txt
done
echo "bitti $(cat /proc/loadavg) $(date -u +%H:%M:%S)" >> $D/ozet.txt
