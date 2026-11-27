#!/bin/bash
# M2 hız kabulü: taban (eski) ve yeni kod, her biri temiz 100 bin verinin TAZE kopyasında; yük > 2 ise satır GEÇERSİZ.
# Kullanım: flock -x -w 1800 <olcum.lock> bash kabul-m2.sh <eski kök> <yeni kök> <çıktı>
H=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2-kod/hiz
OLD=$1; NEW=$2; OUT=$3
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "M2 HIZ KABUL · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for side in eski yeni eski yeni; do
  ROOT=$OLD; [ $side = yeni ] && ROOT=$NEW
  rm -rf $H/kopya && cp -a $H/temiz $H/kopya || exit 1
  sync; l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== $side ($ROOT) · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  timeout 1200 node --disable-warning=ExperimentalWarning $H/olc-m2.mjs "$ROOT" $H/kopya 5 >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
done
rm -rf $H/kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
