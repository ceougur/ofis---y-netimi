#!/bin/bash
# M1 tur 2 hız: tur 1 (t251-m1-tur1) ↔ tur 2, her biri taze /dev/shm kopyasında (temiz 100 bin); yük > 2 ise GEÇERSİZ. flock -x altında çağrılır. $1 = çıktı dosyası.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
B=/home/user/ofis---y-netimi/.claude/worktrees/agent-af18bb1989d74249b/docs/kanit/2026-11-27/m1t2-betik
OUT=$1
echo "M1 TUR 2 HIZ · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for side in tur1:/dev/shm/m1t2-kdv/eski tur2:/dev/shm/m1t2-kdv/mut; do
  name=${side%%:*}; code=${side#*:}
  rm -rf /dev/shm/m1t2-kdv/veri && cp -a $S/ana-kabul/temiz-100k /dev/shm/m1t2-kdv/veri || exit 1
  sync; l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== $name ($code, $(cd $code && git rev-parse --short HEAD)) · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  timeout 900 node --disable-warning=ExperimentalWarning $B/olc-kdv.mjs "$code" /dev/shm/m1t2-kdv/veri 5 >> $OUT 2>&1; echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
done
rm -rf /dev/shm/m1t2-kdv/veri
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
