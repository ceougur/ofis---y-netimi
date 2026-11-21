#!/bin/bash
# S231 E hız kabul: ÖZEL kilit tek seferlik (alınamazsa ÖLÇÜLEMEDİ); üç kod (c7b-aday = S223 öncesi, s223-uc, yeni) dönüşümlü 4 tur; her koşu temiz-100k'nın
# TAZE kopyasında (/dev/shm); her koşu başında /proc/loadavg — 1 dk yük > 2 ise koşu GEÇERSİZ. İş yükü 'yeni' (hepsi yeni ad; ana oturumun hükmündeki gibi).
# Kullanım: bash hiz.sh <yeni kod kökü> <çıktı dosyası>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
SRC=$S/ana-kabul/temiz-100k
D=/dev/shm/s231-a5ab
OLC=$(dirname "$(readlink -f "$0")")/olc-s231.mjs
YENI=$1
OUT=$2
: > "$OUT"
exec 9>$S/olcum.lock
if ! flock -x -w 1800 9; then echo "ÖLÇÜLEMEDİ: özel kilit 30 dk içinde alınamadı $(cat /proc/loadavg)" >> "$OUT"; exit 0; fi
echo "kilit alındı $(date -u +%H:%M) yük $(cat /proc/loadavg) · nproc $(nproc)" >> "$OUT"
run() { # <tur> <ad>
  local R
  case "$2" in c7b) R=$D/c7b ;; s223) R=$D/eski ;; yeni) R=$YENI ;; esac
  rm -rf "$D/hv"
  cp -a "$SRC" "$D/hv" || exit 1
  local L
  L=$(cut -d' ' -f1 /proc/loadavg)
  local V=""
  awk -v l="$L" 'BEGIN { exit !(l > 2) }' && V=" GEÇERSİZ (yük > 2)"
  echo "--- tur $1 $2 yük $(cat /proc/loadavg)$V" >> "$OUT"
  HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 900 node "$OLC" "$R" "$D/hv" yeni >> "$OUT" 2>&1
  rm -rf "$D/hv"
}
run 1 c7b; run 1 s223; run 1 yeni
run 2 yeni; run 2 s223; run 2 c7b
run 3 s223; run 3 yeni; run 3 c7b
run 4 c7b; run 4 yeni; run 4 s223
echo "BİTTİ $(date -u +%H:%M) yük $(cat /proc/loadavg)" >> "$OUT"
