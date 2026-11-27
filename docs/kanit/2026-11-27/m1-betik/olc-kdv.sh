#!/bin/bash
# M1 hız: taban ↔ yeni, her biri taze /dev/shm kopyasında; yük > 2 ise GEÇERSİZ. flock -x altında çağrılır.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
OUT=$1
echo "M1 HIZ · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for side in taban:/dev/shm/m1-kdv/eski yeni:/dev/shm/m1-kdv/mut; do
  name=${side%%:*}; code=${side#*:}
  rm -rf /dev/shm/m1-kdv/veri && cp -a $S/ana-kabul/temiz-100k /dev/shm/m1-kdv/veri || exit 1
  sync; l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== $name ($code, $(cd $code && git rev-parse --short HEAD)) · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  timeout 900 node --disable-warning=ExperimentalWarning $S/m1-ajan/olc-kdv.mjs "$code" /dev/shm/m1-kdv/veri 5 >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
done
rm -rf /dev/shm/m1-kdv/veri
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
