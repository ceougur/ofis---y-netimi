#!/bin/bash
# Ana oturum HIZ hükmü — izleyen küçük tur: 3 tur × (Ç7b öncesi af655afd · taban 44a1762d · yeni = sınama ağacı), ajanın hiz.mjs'i (not defteri izt-a68), taze temiz-100k kopyası; ÖZEL kilit bütün zincir için bir kez.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/ana-izt/hiz
H=$S/izt-a68/hiz/hiz.mjs
OUT=$D/sonuc.txt
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul
exec 9>$S/olcum.lock; flock -x -w 600 9 || { echo "KİLİT alınamadı" > $OUT; exit 3; }
echo "HIZ · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" > $OUT
for tur in 1 2 3; do
  case $tur in 1) ORDER="oncesi eski yeni";; 2) ORDER="yeni oncesi eski";; *) ORDER="eski yeni oncesi";; esac
  for kod in $ORDER; do
    case $kod in yeni) K=/dev/shm/izt-sinama;; eski) K=/dev/shm/izt-taban;; oncesi) K=/dev/shm/ana-af655;; esac
    rm -rf /dev/shm/ana-izt-kopya && cp -a $S/ana-kabul/temiz-100k /dev/shm/ana-izt-kopya || exit 1
    for i in $(seq 1 60); do awk '{exit !($1 < 1.5)}' /proc/loadavg && break; sleep 10; done
    l0=$(cut -d' ' -f1 /proc/loadavg)
    echo "=== tur $tur · $kod · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>=1.5)?"· GEÇERSİZ (yük >= 1,5)":""}')" >> $OUT
    timeout 1500 node --disable-warning=ExperimentalWarning $H $K /dev/shm/ana-izt-kopya >> $OUT 2>&1
    echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
  done
done
rm -rf /dev/shm/ana-izt-kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
