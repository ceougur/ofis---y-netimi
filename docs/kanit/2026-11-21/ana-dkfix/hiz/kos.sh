#!/bin/bash
# ANA OTURUM — birleşik küçük turun HIZ HÜKMÜ (ders 47, 52, 53 (a)): ajanın hiz.mjs'i AYNEN; taban = dkfix-taban (/dev/shm/ana-dkfix/eski), yeni = de403915; 3 tur dönüşümlü, her ölçüm TAZE temiz-100k kopyası;
# her ölçüm başında yük < 1,5 beklemesi (en çok 10 dk; geçmezse ölçüm GEÇERSİZ işaretlenir). ÖZEL kilitle çağrılır: flock -x -w 3600 <olcum.lock> bash kos.sh
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$S/ana-dkfix; OUT=$A/hiz/sonuc.txt
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul
echo "HIZ · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for tur in 1 2 3; do for kod in eski yeni; do
  rm -rf $A/hiz/kopya && cp -a $S/ana-kabul/temiz-100k $A/hiz/kopya || exit 1; sync
  for i in $(seq 60); do awk '{exit !($1<1.5)}' /proc/loadavg && break; sleep 10; done
  l0=$(cut -d' ' -f1 /proc/loadavg)
  echo "=== tur $tur · $kod · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>2)?"· GEÇERSİZ (yük > 2)":""}')" >> $OUT
  timeout 1500 node --disable-warning=ExperimentalWarning $A/hiz/hiz.mjs /dev/shm/ana-dkfix/$kod $A/hiz/kopya >> $OUT 2>&1
  echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
done; done
rm -rf $A/hiz/kopya; echo "bitti $(date -u +%H:%M:%S)" >> $OUT
