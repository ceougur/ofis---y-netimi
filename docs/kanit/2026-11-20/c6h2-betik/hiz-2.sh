#!/bin/bash
# Hız düzeltmesinden (fe693f47) sonra Bilanço yeniden: kilitsiz + kilitli, yeni kod, 5 tekrar + kilitli parça ayrıştırması.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana
for kip in kilitsiz kilitli; do
  bash $N/hiz.sh $kip yeni 5 > $N/hiz2-$kip-yeni.log 2>&1
  echo "$kip yeni bitti $(date -u +%H:%M:%S)"
done
bash $N/parca.sh > $N/parca-2.log 2>&1
echo "parça bitti $(date -u +%H:%M:%S)"
