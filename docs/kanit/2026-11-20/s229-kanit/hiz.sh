#!/bin/bash
# Hız kabulü: ÖZEL kilit TEK seferlik (alamazsa ÖLÇÜLEMEDİ); eski ↔ yeni dönüşümlü, her koşu taze veri kopyasıyla (/dev/shm), 3 tur × 3 tekrar.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/s229-a343
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a343eda2c3de7a0a1
V=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
OUT=$S/hiz.txt
exec 9>/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
if ! flock -x -w 1800 9; then echo "ÖLÇÜLEMEDİ: özel kilit 30 dk içinde alınamadı $(date -u +%H:%M)" > $OUT; exit 1; fi
echo "HIZ S229 · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for tur in 1 2 3; do
  for kod in eski yeni; do
    K=$W; [ $kod = eski ] && K=$S/eski
    rm -rf /dev/shm/s229-a343-hiz && cp -a $V /dev/shm/s229-a343-hiz || exit 1
    sync; l0=$(cut -d' ' -f1 /proc/loadavg)
    echo "=== tur $tur $kod · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
    (cd $S && TZ=UTC timeout 1500 node --disable-warning=ExperimentalWarning olc-s229.mjs "$K" /dev/shm/s229-a343-hiz 3 | sed "s/^ÖLÇÜM/ÖLÇÜM\t$kod/") >> $OUT 2>&1
    echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
  done
done
rm -rf /dev/shm/s229-a343-hiz
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
