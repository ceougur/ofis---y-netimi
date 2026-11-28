#!/bin/bash
# Eski (t251-m2t4-taban) ↔ yeni eşdeğerlik koşuları: 40 tohum × 5 cari × 20 adım, iki TZ. Çıktılar bu klasörde esd-*.txt.
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a75255d57a32bede8 || exit 1
D=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t4-ajan
SEEDS=$(seq -s, 1 40)
for Z in UTC Europe/Istanbul; do
  T=$(echo "$Z" | tr -d '/' | tr 'A-Z' 'a-z')
  for MODE in "sizinti 1 1" "acik 0 1" "ozgun 0 0"; do
    set -- $MODE
    echo "### $Z $1 başla $(date -u +%H:%M) $(cat /proc/loadavg)" >> "$D/esd-ozet.txt"
    TZ="$Z" SIZINTI=$2 EXT=$3 YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a75255d57a32bede8 ESKI=/dev/shm/m2t4-a752/eski HUKUK_LICENSE_URL=http://127.0.0.1:9 \
      flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock \
      timeout -k 5 1500 node --disable-warning=ExperimentalWarning "$D/a-esdeger4.mjs" "$SEEDS" 5 20 > "$D/esd-$T-$1.txt" 2>&1
    echo "cikis $?" >> "$D/esd-ozet.txt"
    grep -E "^# (TZ|fark)" "$D/esd-$T-$1.txt" >> "$D/esd-ozet.txt"
  done
done
echo "BITTI $(date -u +%H:%M) $(cat /proc/loadavg)" >> "$D/esd-ozet.txt"
