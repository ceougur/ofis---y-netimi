#!/bin/bash
# Dar kontrol Ç5-B ölçümü (ders 47, 52): önce (fd310c0a^1) / sonra (fd310c0a+) aynı veri kopyasıyla, sırayla, kilit altında.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/dk-c5b-q7
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a1e07003baad4593f
OUT=$D/kanit/olcum.txt
: > $OUT
echo "nproc $(nproc) · başta /proc/loadavg $(cat /proc/loadavg)" >> $OUT
cd $D/betik || exit 1
for pair in "eski:$D/eski:$D/olc-eski" "yeni:$W:$D/olc-yeni"; do
  IFS=: read -r name root data <<< "$pair"
  echo "=== $name ($root) · /proc/loadavg $(cat /proc/loadavg)" >> $OUT
  HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout 2400 node olc.mjs "$root" "$data" 3 >> $OUT 2>&1
  echo "çıkış $? · /proc/loadavg $(cat /proc/loadavg)" >> $OUT
done
echo "sonda /proc/loadavg $(cat /proc/loadavg)" >> $OUT
