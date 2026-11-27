#!/bin/bash
# HIZ dönüşümlü koşu: 3 tur × (Ç7b öncesi af655afd · dkfix-taban · son), her ölçüm taze temiz-100k kopyasında. ÖZEL kilit altında çağrılır.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/dkfix-ab23
OUT=$D/hiz/sonuc.txt
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul
echo "HIZ · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for tur in 1 2 3; do
  for kod in oncesi eski mut; do
    rm -rf $D/hiz/kopya && cp -a $S/ana-kabul/temiz-100k $D/hiz/kopya || exit 1
    sync
    l0=$(cut -d' ' -f1 /proc/loadavg)
    echo "=== tur $tur · $kod · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
    timeout 1500 node --disable-warning=ExperimentalWarning $D/hiz/hiz.mjs $D/$kod $D/hiz/kopya >> $OUT 2>&1
    echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
  done
done
rm -rf $D/hiz/kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
