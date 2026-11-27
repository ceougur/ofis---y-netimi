#!/bin/bash
# Ç7b taksit küçük turu — hız: taban ↔ yeni, kilitsiz + kilitli, her biri 3 koşu, her koşu taze kopyada (temiz-100k OKUNUR, kopya bizim).
# Kullanım: flock -x -w 1800 <scratchpad>/olcum.lock bash hiz.sh <çıktı>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c7bt-ana
OUT=$1; [ -n "$OUT" ] || exit 2
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "HIZ c7bt (EŞİT İŞ) · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for tur in 1 2 3; do
  for kod in taban yeni; do
    if [ $kod = taban ]; then ROOT=$S/c7bt-taban; else ROOT=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab1c286758106cc24; fi
    for mode in kilitsiz kilitli; do
      rm -rf $A/kopya && cp -a $S/ana-kabul/temiz-100k $A/kopya || exit 1
      sync; l0=$(cut -d' ' -f1 /proc/loadavg)
      echo "=== tur $tur · $kod · $mode · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
      timeout 900 node --disable-warning=ExperimentalWarning $A/olc-excel.mjs $ROOT $A/kopya $mode esit >> $OUT 2>&1; echo "çıkış $?" >> $OUT
    done
  done
done
rm -rf /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7bt-ana/kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
