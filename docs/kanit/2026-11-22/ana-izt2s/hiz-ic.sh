#!/bin/bash
# Ana oturum HIZ hükmü — izleyen tur 2 + kâhin 25 ortak sınaması: 3 tur × (eski = /dev/shm/c6h-sinama [kodu 2ce988f4] · yeni = /dev/shm/izt2-sinama [3b420085]), ajanın hiz2.mjs'i (izt2-a00), taze temiz-100k kopyası. Kilit ÇAĞIRANDA (hiz.sh) — ders 50.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/ana-izt2s/hiz
H=$S/izt2-a00/hiz/hiz2.mjs
OUT=$D/sonuc.txt
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul
echo "HIZ · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · eski $(git -C /dev/shm/c6h-sinama log --oneline -1 | cut -c1-9) · yeni $(git -C /dev/shm/izt2-sinama log --oneline -1 | cut -c1-9)" > $OUT
for tur in 1 2 3; do
  case $tur in 2) ORDER="yeni eski";; *) ORDER="eski yeni";; esac
  for kod in $ORDER; do
    case $kod in yeni) K=/dev/shm/izt2-sinama;; eski) K=/dev/shm/c6h-sinama;; esac
    rm -rf /dev/shm/ana-izt2s-kopya && cp -a $S/ana-kabul/temiz-100k /dev/shm/ana-izt2s-kopya || exit 1
    for i in $(seq 1 60); do awk '{exit !($1 < 1.5)}' /proc/loadavg && break; sleep 10; done
    l0=$(cut -d' ' -f1 /proc/loadavg)
    echo "=== tur $tur · $kod · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>=1.5)?"· GEÇERSİZ (yük >= 1,5)":""}')" >> $OUT
    timeout 1500 node --disable-warning=ExperimentalWarning $H $K /dev/shm/ana-izt2s-kopya >> $OUT 2>&1
    echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
  done
done
rm -rf /dev/shm/ana-izt2s-kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
