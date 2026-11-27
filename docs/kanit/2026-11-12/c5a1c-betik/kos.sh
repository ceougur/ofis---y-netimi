#!/bin/bash
# kos.sh <kod kökü> <etiket> <kip: kilitsiz|kilitli> [tekrar=4] — Ç5-A tur 1c (c5a1b-olcum/kos.sh'ın kopyası): taze kopya, iki TZ; ölçüm kilidi dışarıdan (flock -x -n).
# Fark: veri kopyası /dev/shm'de (disk 5 GB sınırında; üç sütun aynı yerde ölçülür), hücre başına tekrar 4.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
ROOT=$1; TAG=$2; KIP=$3; REP=${4:-4}; OUT=$S/c5a1c-olcum/olc-$TAG-$KIP.txt; K=/dev/shm/c5a1c-olc-kopya
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "Ç5-A tur 1c ölçüm · $TAG · $KIP · kod $ROOT · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for tz in Europe/Istanbul UTC; do
  rm -rf $K && cp -a $S/ana-kabul/temiz-100k $K || exit 1
  if [ "$KIP" = kilitli ]; then python3 -I $S/c5a1c-olcum/kilit.py $K/data/destekofis.sqlite >> $OUT || exit 1; fi
  sync; l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== TZ $tz · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  TZ=$tz timeout 1800 node --disable-warning=ExperimentalWarning $S/c5a1c-olcum/olc.mjs "$ROOT" $K $REP >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
done
rm -rf $K
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
