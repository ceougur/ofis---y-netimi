#!/bin/bash
# Ç6-HESAP tur 3 — 1 M: verilen kip × kod çiftleri sırayla (ÖZEL ölçüm kilidinin içinde). Bellek bekçisi: MemAvailable < 1,5 GB olursa YALNIZ kendi ölçüm sürecimi durdurur (başka süreçleri korur).
# Kullanım: bash hiz1m-hepsi.sh "kilitsiz:yeni kilitli:yeni kilitli:eski"
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana
for pair in $1; do
  kip=${pair%%:*}; kod=${pair##*:}
  bash $N/betik/hiz1m.sh $kip $kod 5 > $N/hiz1m-$kip-$kod.log 2>&1 &
  job=$!
  while kill -0 $job 2>/dev/null; do
    a=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
    if [ "$a" -lt 1500 ]; then
      echo "BELLEK AZ ($a MB) — $kip $kod durduruldu" | tee -a $N/hiz1m-$kip-$kod.log
      for p in $(pgrep -f "c6h3-ana/betik/olc.mjs"); do kill $p; done
    fi
    sleep 5
  done
  echo "$kip $kod bitti $(date -u +%H:%M:%S) · en düşük bellek izlenmedi"
done
