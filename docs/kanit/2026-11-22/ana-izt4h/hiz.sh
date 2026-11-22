#!/bin/bash
# Özel kilit BİR kez dışarıda (-w 3600), süre sınırı kilidin İÇİNDE (ders 50; kalıp ana-izt3h/hiz.sh).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
exec 9>$S/olcum.lock
echo "kilit bekleniyor $(date -u +%H:%M:%S)"
flock -x -w 3600 9 || { echo "KİLİT alınamadı $(date -u +%H:%M:%S)"; exit 3; }
echo "kilit alındı $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg)"
timeout -k 10 4500 bash $S/ana-izt4h/hiz-ic.sh
echo "çıkış $? $(date -u +%H:%M:%S)"
