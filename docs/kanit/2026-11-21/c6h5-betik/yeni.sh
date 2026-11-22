#!/bin/bash
# Yeni eşdeğerlik testi + tur 4'ün 15 yeni testi, iki TZ (yeni kod) + kırmızı kanıt: eşdeğerlik testi tur 4 kodunda (f73f4f5a kopyası). Paylaşılan kilit zincir için bir kez.
# Çağrı: timeout -k 5 7000 bash yeni.sh
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a32c17a0bb8351975
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
A=$S/c6h5-ag
E=$A/kod-f73f4f5a
T="test/c6h-tek-okuma.test.mjs test/c6h-alt-hesap-farki.test.mjs test/c6h-kural-farki-fis.test.mjs test/c6h-degerleme-dondurma.test.mjs"
mkdir -p $A/kanit $A/out || exit 1
exec 9>$S/olcum.lock
echo "kilit bekleniyor $(date -u +%H:%M:%S)"
flock -s -w 3600 9 || { echo "kilit alınamadı"; exit 3; }
echo "başla $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg) commit $(git -C $W rev-parse --short=8 HEAD)"
cd $W || exit 1
for tz in UTC Europe/Istanbul; do
  n=$(echo $tz | tr / -)
  TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$A/kanit timeout -k 5 2400 node tools/kanit.mjs kos c6h5-yeni-$n -- node --test $T > $A/out/yeni-$n.out 2>&1
  echo "yeni $tz çıkış $? · $(grep -E '^# (tests|pass|fail|cancelled|skipped)' $A/out/yeni-$n.out | tr '\n' ' ')"
done
cp $W/test/c6h-tek-okuma.test.mjs $E/test/ || exit 1
cd $E || exit 1
for tz in UTC Europe/Istanbul; do
  n=$(echo $tz | tr / -)
  TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$A/kanit timeout -k 5 2400 node $W/tools/kanit.mjs kos c6h5-kirmizi-$n -- node --test test/c6h-tek-okuma.test.mjs > $A/out/kirmizi-$n.out 2>&1
  echo "kırmızı (tur 4 kodu) $tz çıkış $? · $(grep -E '^# (tests|pass|fail|cancelled|skipped)' $A/out/kirmizi-$n.out | tr '\n' ' ')"
done
rm -f $E/test/c6h-tek-okuma.test.mjs
echo "bitti $(date -u +%H:%M:%S) yük $(cut -d' ' -f1-3 /proc/loadavg)"
