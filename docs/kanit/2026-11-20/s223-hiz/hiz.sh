#!/bin/bash
# E hız kabul: ÖZEL kilit tek seferlik (alınamazsa ÖLÇÜLEMEDİ); dönüşümlü taban / yeni, her koşu temiz-100k'nın TAZE kopyasında.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/s223-k1
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a2b475536b68533c3
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
OUT="$N/hiz-sonuc.txt"
: > "$OUT"
exec 9>/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
if ! flock -x -w 1800 9; then echo "ÖLÇÜLEMEDİ: özel kilit 30 dk içinde alınamadı $(cat /proc/loadavg)" >> "$OUT"; exit 0; fi
echo "kilit alındı $(date -u +%H:%M) yük $(cat /proc/loadavg) · nproc $(nproc)" >> "$OUT"
run() { # <tur> <kök adı> <iş yükü>
  local R=$([ "$2" = yeni ] && echo "$W" || echo "$N/taban")
  rm -rf "$N/hiz-veri"
  cp -a "$SRC" "$N/hiz-veri" || exit 1
  echo "--- tur $1 $2 $3 yük $(cat /proc/loadavg)" >> "$OUT"
  HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 900 node "$N/olc-s223.mjs" "$R" "$N/hiz-veri" "$3" >> "$OUT" 2>&1
  rm -rf "$N/hiz-veri"
}
for t in 1 2 3; do
  if [ $((t % 2)) = 1 ]; then run $t taban karma; run $t yeni karma; else run $t yeni karma; run $t taban karma; fi
done
for t in 1 2 3; do
  if [ $((t % 2)) = 1 ]; then run $t taban yeni; run $t yeni yeni; else run $t yeni yeni; run $t taban yeni; fi
done
echo "BİTTİ $(date -u +%H:%M) yük $(cat /proc/loadavg)" >> "$OUT"
