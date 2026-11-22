#!/bin/bash
# Ç6-HESAP tur 5 YÜK zinciri (ölçüm değil): her parça kendi paylaşılan kilidiyle (flock -s), süre sınırı flock'un İÇİNDE. Sıra: komşu yığını UTC → İstanbul → mutasyon → kâhin-defter iki TZ → yanıt eşdeğerliği.
# Çağrı: timeout -k 5 7100 bash yuk.sh [parçalar: komsu mutasyon kahin fark]
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a32c17a0bb8351975
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h5-ag
L=$S/olcum.lock
mkdir -p $A/out $A/kanit || exit 1
PARTS=${*:-komsu mutasyon kahin fark}
for p in $PARTS; do
  case $p in
    komsu)
      for tz in UTC Europe/Istanbul; do
        n=$(echo $tz | tr / -)
        echo "komşu $tz kilit bekleniyor $(date -u +%H:%M:%S)"
        (cd $W && TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$A/kanit flock -s -w 3600 $L timeout -k 5 2400 node tools/kanit.mjs kos c6h5-komsu-$n -- node --test --test-concurrency=3 $(cat $A/komsu5.txt) > $A/out/komsu-$n.out 2>&1)
        echo "komşu $tz çıkış $? · $(grep -E '^# (tests|pass|fail|cancelled|skipped)' $A/out/komsu-$n.out | tr '\n' ' ') · $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
      done;;
    mutasyon)
      flock -s -w 3600 $L timeout -k 5 2400 bash $A/mutasyon-ic.sh > $A/out/mutasyon.out 2>&1
      echo "mutasyon çıkış $? · $(date -u +%H:%M:%S)"; cat $A/out/mutasyon.out;;
    kahin)
      for tz in UTC Europe/Istanbul; do
        n=$(echo $tz | tr / -)
        (cd $W && TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 flock -s -w 3600 $L timeout -k 5 2400 npm run -s test:kahin-defter > $A/out/kahin-defter-$n.out 2>&1)
        echo "kâhin-defter $tz çıkış $? · $(tail -3 $A/out/kahin-defter-$n.out | tr '\n' ' ' | cut -c1-300)"
      done;;
    fark)
      for part in fikstur 100k; do
        flock -s -w 3600 $L timeout -k 5 2400 bash $A/fark-ic.sh $part > $A/out/fark-kos-$part.out 2>&1
        echo "fark $part çıkış $? · $(date -u +%H:%M:%S)"; cat $A/out/fark-kos-$part.out
      done;;
  esac
done
echo "zincir bitti $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
