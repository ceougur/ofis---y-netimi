#!/bin/bash
# Ç6-HESAP tur 3 — 100 bin: kilitsiz / kilitli × yeni / eski (AYNI kaynak kopya). ÖZEL ölçüm kilidinin içinde.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana
for kip in kilitsiz kilitli; do
  for kod in yeni eski; do
    bash $N/betik/hiz.sh $kip $kod 5 > $N/hiz100k-$kip-$kod.log 2>&1
    echo "$kip $kod bitti $(date -u +%H:%M:%S)"
  done
done
