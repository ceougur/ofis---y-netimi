#!/bin/bash
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana
for kip in kilitsiz kilitli; do
  for kod in yeni eski; do
    bash $N/hiz.sh $kip $kod 5 > $N/hiz-$kip-$kod.log 2>&1
    echo "$kip $kod bitti $(date -u +%H:%M:%S)"
  done
done
