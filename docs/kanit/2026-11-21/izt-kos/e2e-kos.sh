#!/bin/bash
# Ekran senaryoları (yeni + Düzenle formuna / kart penceresine dokunanlar) — paylaşılan kilit altında, her biri en çok 15 dk. Kullanım: e2e-kos.sh <kod kökü> <çıktı eki> [senaryo…]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/izt-a68
K=$1; shift
TAG=$1; shift
cd "$K" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194 TZ=Europe/Istanbul
OUT=$D/e2e-$TAG.out
echo "=== $K başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)" > $OUT
for s in "$@"; do
  echo "--- $s $(date -u +%H:%M:%S) yük $(cut -d' ' -f1 /proc/loadavg)" >> $OUT
  EKRAN_DIR=$D/ekran-$TAG/$s flock -s -w 3600 $S/olcum.lock timeout -k 5 900 node --disable-warning=ExperimentalWarning test/e2e/$s.mjs > $D/e2e-$TAG-$s.log 2>&1
  rc=$?
  echo "çıkış $rc · $(grep -E 'geçti, [0-9]+ kaldı' $D/e2e-$TAG-$s.log | tail -1)" >> $OUT
done
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
