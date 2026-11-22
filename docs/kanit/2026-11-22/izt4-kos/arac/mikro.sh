#!/bin/bash
# Mikro ölçüm: eski / yeni dönüşümlü 3 tur, her koşu taze kopya. ÖZEL kilit çağıranda.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/izt4-ad3
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-ad3ee8a705a609628
OUT=$D/hiz/mikro-sonuc.txt
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul
echo "MİKRO başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)" > $OUT
for tur in 1 2 3; do
  for kod in eski yeni; do
    case $kod in yeni) K=$YENI ;; eski) K=$D/eski ;; esac
    rm -rf $D/hiz/kopya && cp -a $S/ana-kabul/temiz-100k $D/hiz/kopya || exit 1
    echo "=== tur $tur · $kod · başta $(cat /proc/loadavg)" >> $OUT
    timeout -k 5 900 node --disable-warning=ExperimentalWarning $D/hiz/mikro.mjs $K $D/hiz/kopya >> $OUT 2>&1
  done
done
rm -rf $D/hiz/kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
