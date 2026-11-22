#!/bin/bash
# Kâhinler önce (5ee4d99e kopyası) / sonra (worktree) — yük koşusu, paylaşılan kilit bütün zincir için bir kez. Çağrı: timeout -k 5 7100 bash kahin.sh
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-adeefec4f86e1240e
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h4-ag
exec 9>$S/olcum.lock
flock -s -w 3600 9 || { echo "kilit alınamadı"; exit 3; }
echo "başla $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
for side in once sonra; do
  if [ $side = once ]; then R=$A/eski; else R=$W; fi
  for tz in UTC Europe/Istanbul; do
    n=$(echo $tz | tr / -)
    for k in kahin-defter kahin-cari; do
      (cd $R && TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 1500 npm run -s test:$k > $A/k-$side-$k-$n.out 2>&1); echo "$side $k $tz çıkış $? · $(tail -2 $A/k-$side-$k-$n.out | tr '\n' ' ' | cut -c1-200)"
    done
  done
  for k in kahin-maliyet kahin-tutar; do
    (cd $R && HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 1500 npm run -s test:$k > $A/k-$side-$k.out 2>&1); echo "$side $k çıkış $? · $(tail -2 $A/k-$side-$k.out | tr '\n' ' ' | cut -c1-200)"
  done
done
(cd $W && timeout -k 5 600 python3 -I test/bagimsiz/muhasebe/test_model.py > $A/k-muhasebe-model.out 2>&1); echo "muhasebe test_model çıkış $? · $(tail -2 $A/k-muhasebe-model.out | tr '\n' ' ')"
echo "bitti $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
