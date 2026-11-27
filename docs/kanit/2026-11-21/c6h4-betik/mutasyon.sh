#!/bin/bash
# Ç6-HESAP tur 4 MUTASYON (yük koşusu; paylaşılan kilit bütün zincir için bir kez). Her mutant HEAD'in ayrı kopyasında, iki TZ, bu turun üç test dosyası. Çağrı: timeout -k 5 7100 bash mutasyon.sh
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-adeefec4f86e1240e
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h4-ag
B=$A/mut-taban
cd $W || exit 1
rm -rf $B && mkdir -p $B && git archive HEAD ':!docs/kanit' | tar -x -C $B || exit 1
echo "taban $(git rev-parse --short=8 HEAD)"
exec 9>$S/olcum.lock
flock -s -w 3600 9 || { echo "kilit alınamadı"; exit 3; }
echo "başla $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
for m in $(python3 -I $A/mutantlar.py x liste); do
  K=$A/mut-$m
  rm -rf $K && cp -a $B $K && ln -sfn /home/user/ofis---y-netimi/node_modules $K/node_modules || exit 1
  python3 -I $A/mutantlar.py $K $m || exit 1
  for tz in UTC Europe/Istanbul; do
    (cd $K && TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 900 node --test test/c6h-alt-hesap-farki.test.mjs test/c6h-kural-farki-fis.test.mjs test/c6h-degerleme-dondurma.test.mjs > $A/mut-$m-$(echo $tz | tr / -).out 2>&1)
    c=$?
    echo "$m $tz çıkış $c · $(grep -E '^# (pass|fail)' $A/mut-$m-$(echo $tz | tr / -).out | tr '\n' ' ')"
  done
  rm -rf $K
done
rm -rf $B
echo "bitti $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
