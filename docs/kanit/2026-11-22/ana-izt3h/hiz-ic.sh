#!/bin/bash
# Ana oturum HIZ hükmü — izleyen tur 3: 3 tur × (eski = /dev/shm/izt2-sinama [3b420085 = çalışma dalının kodu] · yeni = /dev/shm/izt3-sinama [89a10ca6]), ajanın hiz3.mjs (izt3-ae8), taze temiz-100k. Kilit ÇAĞIRANDA (hiz.sh) — ders 50.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/ana-izt3h/hiz
H=$S/izt3-ae8/hiz/hiz3.mjs
OUT=$D/sonuc.txt
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul
echo "HIZ · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · eski $(git -C /dev/shm/izt2-sinama log --oneline -1 | cut -c1-9) · yeni $(git -C /dev/shm/izt3-sinama log --oneline -1 | cut -c1-9)" > $OUT
for tur in 1 2 3; do
  case $tur in 2) ORDER="yeni eski";; *) ORDER="eski yeni";; esac
  for kod in $ORDER; do
    case $kod in yeni) K=/dev/shm/izt3-sinama;; eski) K=/dev/shm/izt2-sinama;; esac
    rm -rf /dev/shm/ana-izt3h-kopya && cp -a $S/ana-kabul/temiz-100k /dev/shm/ana-izt3h-kopya || exit 1
    for i in $(seq 1 60); do awk '{exit !($1 < 1.5)}' /proc/loadavg && break; sleep 10; done
    l0=$(cut -d' ' -f1 /proc/loadavg)
    echo "=== tur $tur · $kod · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>=1.5)?"· GEÇERSİZ (yük >= 1,5)":""}')" >> $OUT
    timeout 1500 node --disable-warning=ExperimentalWarning $H $K /dev/shm/ana-izt3h-kopya >> $OUT 2>&1
    echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
  done
done
rm -rf /dev/shm/ana-izt3h-kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
