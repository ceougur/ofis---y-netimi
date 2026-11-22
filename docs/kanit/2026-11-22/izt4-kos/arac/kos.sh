#!/bin/bash
# İzt4 HIZ: 3 tur dönüşümlü (eski = 6a1d19d1 · yeni = ajan ağacı), her ölçüm taze temiz-100k kopyasında; ölçüm başında yük < 1,5 beklenir (en çok 15 dk).
# ÖZEL kilit ÇAĞIRANDA: flock -x -w 3600 scratchpad/olcum.lock timeout -k 5 <sn> bash kos.sh [çıktı]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/izt4-ad3
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-ad3ee8a705a609628
OUT=${1:-$D/hiz/sonuc-1.txt}
export HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul
echo "HIZ · nproc $(nproc) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · yeni $(cd $YENI && git log --oneline -1 | cut -c1-12) · eski $(cd $D/eski && git log --oneline -1 | cut -c1-12)" > $OUT
for tur in 1 2 3; do
  case $tur in 2) ORDER="yeni eski";; *) ORDER="eski yeni";; esac
  for kod in $ORDER; do
    case $kod in yeni) K=$YENI ;; eski) K=$D/eski ;; esac
    rm -rf $D/hiz/kopya && cp -a $S/ana-kabul/temiz-100k $D/hiz/kopya || exit 1
    sync
    for i in $(seq 1 90); do awk '{exit !($1 < 1.5)}' /proc/loadavg && break; sleep 10; done
    l0=$(cut -d' ' -f1 /proc/loadavg)
    echo "=== tur $tur · $kod · başta $(cat /proc/loadavg) $(awk -v l=$l0 'BEGIN{print (l>=1.5)?"· GEÇERSİZ (yük >= 1,5)":""}')" >> $OUT
    timeout 1500 node --disable-warning=ExperimentalWarning $D/hiz/hiz4.mjs $K $D/hiz/kopya >> $OUT 2>&1
    echo "çıkış $? · sonda $(cat /proc/loadavg)" >> $OUT
  done
done
rm -rf $D/hiz/kopya
echo "bitti $(date -u +%H:%M:%S)" >> $OUT
