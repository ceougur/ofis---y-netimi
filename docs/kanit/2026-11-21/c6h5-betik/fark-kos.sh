#!/bin/bash
# Yanıt eşdeğerliği tur 4 kodu (f73f4f5a kopyası) ↔ yeni kod: 26 fikstür kopyası (iki TZ) + temiz 100 bin (kilitli / kilitsiz). PAYLAŞILAN kilit (yük koşusu; süre ölçülmez).
# Çağrı: timeout -k 5 7000 bash fark-kos.sh
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a32c17a0bb8351975
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h5-ag
D=/dev/shm/c6h5-fark
mkdir -p $A/out || exit 1
exec 9>$S/olcum.lock
echo "kilit bekleniyor $(date -u +%H:%M:%S)"
flock -s -w 3600 9 || { echo "kilit alınamadı"; exit 3; }
echo "başla $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg) yeni $(cd $W && git rev-parse --short=8 HEAD)"
for tz in UTC Europe/Istanbul; do
  n=$(echo $tz | tr / -)
  for kod in tur4 yeni; do
    if [ $kod = yeni ]; then R=$W; else R=$A/kod-f73f4f5a; fi
    TZ=$tz ROOT=$R OUT=$A/out/fark-fikstur-$kod-$n.json timeout -k 5 2400 node --disable-warning=ExperimentalWarning $A/fark5.mjs fikstur > $A/out/fark-fikstur-$kod-$n.log 2>&1
    echo "fikstür $kod $tz çıkış $? · $(tail -1 $A/out/fark-fikstur-$kod-$n.log)"
  done
  python3 -I $A/fark5.py $A/out/fark-fikstur-tur4-$n.json $A/out/fark-fikstur-yeni-$n.json > $A/out/fark-fikstur-$n.out; echo "fikstür karşılaştırma $tz çıkış $? · $(tail -1 $A/out/fark-fikstur-$n.out)"
done
for kip in kilitli kilitsiz; do
  for kod in tur4 yeni; do
    if [ $kod = yeni ]; then R=$W; else R=$A/kod-f73f4f5a; fi
    rm -rf $D && mkdir -p $D && cp -a $S/ana-kabul/temiz-100k $D/v || exit 1
    if [ $kip = kilitli ]; then python3 -I $A/betik4/kilit.py $D/v/data/destekofis.sqlite > /dev/null || exit 1; fi
    TZ=UTC ROOT=$R OUT=$A/out/fark-100k-$kip-$kod.json timeout -k 5 2400 node --disable-warning=ExperimentalWarning --max-old-space-size=6144 $A/fark5.mjs 100k $D/v > $A/out/fark-100k-$kip-$kod.log 2>&1
    echo "100k $kip $kod çıkış $? · $(tail -1 $A/out/fark-100k-$kip-$kod.log)"
    rm -rf $D
  done
  python3 -I $A/fark5.py $A/out/fark-100k-$kip-tur4.json $A/out/fark-100k-$kip-yeni.json > $A/out/fark-100k-$kip.out; echo "100k $kip karşılaştırma çıkış $? · $(tail -1 $A/out/fark-100k-$kip.out)"
done
echo "bitti $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
