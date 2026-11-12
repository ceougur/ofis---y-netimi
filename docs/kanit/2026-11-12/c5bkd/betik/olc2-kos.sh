#!/bin/bash
# Dar kontrol Ç5-B ölçümü 2 (kilit altında, sırayla): (1) yeni kodla olc.mjs yeniden (ilk koşuda açılış sırasında başka iş vardı) · (2) olc2.mjs eski / yeni.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/dk-c5b-q7
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a1e07003baad4593f
OUT=$D/kanit/olcum2.txt
: > $OUT
cd $D/betik || exit 1
echo "nproc $(nproc) · başta /proc/loadavg $(cat /proc/loadavg)" >> $OUT
echo "=== olc.mjs yeni (yeniden) · /proc/loadavg $(cat /proc/loadavg)" >> $OUT
HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout 2400 node olc.mjs "$W" "$D/olc-yeni2" 3 >> $OUT 2>&1
echo "çıkış $? · /proc/loadavg $(cat /proc/loadavg)" >> $OUT
for pair in "eski:$D/eski:$D/olc2-eski" "yeni:$W:$D/olc2-yeni"; do
  IFS=: read -r name root data <<< "$pair"
  echo "=== olc2.mjs $name · /proc/loadavg $(cat /proc/loadavg)" >> $OUT
  HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout 2400 node olc2.mjs "$root" "$data" 3 >> $OUT 2>&1
  echo "çıkış $? · /proc/loadavg $(cat /proc/loadavg)" >> $OUT
done
echo "sonda /proc/loadavg $(cat /proc/loadavg)" >> $OUT
