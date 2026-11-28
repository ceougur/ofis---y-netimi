#!/bin/bash
# ANA OTURUM — HIZ KABUL ÖLÇÜMÜ (ders 53 (a)): değişen her yazım / okuma yolu, temiz 100 bin satırlık veri, her ölçüm taze kopyada.
# Kullanım: flock -x -n <scratchpad>/olcum.lock bash kabul.sh <kod kökü> <çıktı dosyası>     (yük > 2 ise satır GEÇERSİZ)
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
ROOT=$1; OUT=$2; [ -d "$ROOT/server" ] && [ -n "$OUT" ] || { echo "kullanım: kabul.sh <kod kökü> <çıktı>"; exit 2; }
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $S/ana-kabul/betik || exit 1
echo "HIZ KABUL · kod $ROOT ($(git -C $ROOT rev-parse --short HEAD 2>/dev/null)) · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for b in olc-yazim.mjs olc-kart.mjs; do
  rm -rf /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/kopya && cp -a $S/ana-kabul/temiz-100k $S/ana-kabul/kopya || exit 1
  sync; l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== $b · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  timeout 1200 node --disable-warning=ExperimentalWarning $b "$ROOT" $S/ana-kabul/kopya 2 >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
done
rm -rf /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
