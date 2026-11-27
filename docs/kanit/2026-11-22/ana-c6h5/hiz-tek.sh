#!/bin/bash
# Ana oturum Ç6 tur 5 hız doğrulaması — TEK tur (eski · tur4 · yeni × kilitli + kilitsiz, 5 tekrar); özel kilit BİR kez dışarıda, süre sınırı kilidin İÇİNDE (ders 50).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
exec 9>$S/olcum.lock
echo "kilit bekleniyor $(date -u +%H:%M:%S)"
flock -x -w 5400 9 || { echo "KİLİT alınamadı"; exit 3; }
echo "kilit alındı $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg)"
timeout -k 10 3000 bash $S/ana-c6h5/hiz-ic.sh 1 5
echo "çıkış $? $(date -u +%H:%M:%S)"
