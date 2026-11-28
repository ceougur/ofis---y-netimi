#!/bin/bash
# UD turu 3 hız kabulü: olc-ud3.mjs ESKİ (e7934c5e) ve YENİ kodda, her biri taze temiz-100k kopyasında. Kullanım: flock -x -n <olcum.lock> bash kabul-ud3.sh <eski kök> <yeni kök> <çıktı>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; OUT=$3
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $S/ana-kabul/betik || exit 1
echo "HIZ KABUL UD3 ŞÜPHELİ · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for r in "eski $1" "yeni $2" "eski $1" "yeni $2" "yeni $2" "eski $1"; do set -- $r
  rm -rf /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/kopya && cp -a $S/ana-kabul/temiz-100k $S/ana-kabul/kopya || exit 1
  sync; l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== $1 ($2 $(git -C $2 rev-parse --short HEAD 2>/dev/null)) · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  timeout 1200 node --disable-warning=ExperimentalWarning olc-ud3-supheli.mjs "$2" $S/ana-kabul/kopya 3 >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
done
rm -rf /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
