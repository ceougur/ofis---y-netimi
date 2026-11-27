#!/bin/bash
# İkinci yük zinciri: mutasyon yeniden (ilk koşu GEÇERSİZ — kopyadaki test dosyası eskiydi) + 100 bin yanıt eşdeğerliği (ilk zincir toplam süre sınırına takıldı). Her parça kendi paylaşılan kilidiyle.
A=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h5-ag
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
flock -s -w 3600 $L timeout -k 5 2400 bash $A/mutasyon-ic.sh > $A/out/mutasyon.out 2>&1
echo "mutasyon çıkış $? · $(date -u +%H:%M:%S)"
flock -s -w 3600 $L timeout -k 5 2400 bash $A/fark-ic.sh 100k > $A/out/fark-kos-100k.out 2>&1
echo "fark 100k çıkış $? · $(date -u +%H:%M:%S)"
