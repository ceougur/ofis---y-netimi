#!/bin/bash
# kos.sh <kod kökü> <etiket> <kip: kilitsiz|kilitli> — taze kopya, iki TZ; ölçüm kilidi dışarıdan (flock -x -n)
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
ROOT=$1; TAG=$2; KIP=$3; OUT=$S/c5a1b-olcum/olc-$TAG-$KIP.txt
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "Ç5-A tur 1b ölçüm · $TAG · $KIP · kod $ROOT · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for tz in Europe/Istanbul UTC; do
  rm -rf $S/c5a1b-olcum/kopya && cp -a $S/ana-kabul/temiz-100k $S/c5a1b-olcum/kopya || exit 1
  if [ "$KIP" = kilitli ]; then python3 -I $S/c5a1b-olcum/kilit.py $S/c5a1b-olcum/kopya/data/destekofis.sqlite >> $OUT || exit 1; fi
  sync; l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== TZ $tz · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  TZ=$tz timeout 1500 node --disable-warning=ExperimentalWarning $S/c5a1b-olcum/olc.mjs "$ROOT" $S/c5a1b-olcum/kopya 2 >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
done
rm -rf $S/c5a1b-olcum/kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
