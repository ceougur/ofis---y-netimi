#!/bin/bash
R=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2rk
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$R/kanit PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
O=$R/ozet.txt
k() { d=$1; ad=$2; tz=$3; lim=$4; shift 4; ( cd $d && TZ=$tz timeout -k 5 $lim node /home/user/ofis---y-netimi/tools/kanit.mjs kos $ad -- "$@" > $R/kanit/$ad.out 2>&1; echo "$ad cikis=$? $(date -u +%H:%M) yük $(cut -d' ' -f1-3 /proc/loadavg)" >> $O; tail -2 $R/kanit/$ad.out >> $O ); }
echo "başladı $(date -u +%H:%M) $(cat /proc/loadavg)" > $O
T="node --disable-warning=ExperimentalWarning --test --test-concurrency=1 test/supheli-degersiz-siniri-m2-251.test.mjs test/supheli-degersiz-siniri-m2-v249-251.test.mjs"
for tz in UTC Europe/Istanbul; do s=${tz##*/}
  k $R/yeni m2rk-yeni-$s $tz 900 $T
  k $R/eski m2rk-eski-$s $tz 900 $T
done
k $R/yeni m2rk-e2e-yeni UTC 900 node test/e2e/senaryo-degersiz-siniri-m2-251.mjs
k $R/eski m2rk-e2e-eski UTC 900 node test/e2e/senaryo-degersiz-siniri-m2-251.mjs
for tz in UTC Europe/Istanbul; do s=${tz##*/}
  k $S/sinama2 m2rk-sinama-kahin-cari-$s $tz 2400 npm run test:kahin-cari
  k $S/sinama2 m2rk-sinama-kahin-defter-$s $tz 1200 npm run test:kahin-defter
done
cd $R/mut || exit 1
for name in M1-sonradan-bagsiz M2-sonraki-degersiz M3-onceki-gun-payi M4-o-gun-payi-once M5a-yazim-denetimi-yok M5b-mutabakat-degismezi-yok M6-oneri-bakiye-kurali-yok M6b-bakiye-siniri-yok M7-geri-yukleme-siniri-yok M8-form-eski-kalan M8b-form-ipucu-eski; do
  python3 -I $R/mutant.py $R/mut $name uygula >> $O 2>&1 || { echo "MUTANT ÇALIŞMADI $name" >> $O; continue; }
  if [[ "$name" == M8* ]]; then TZ=UTC timeout -k 5 900 node --disable-warning=ExperimentalWarning test/e2e/senaryo-degersiz-siniri-m2-251.mjs > $R/kanit/mut-$name.out 2>&1; c=$?; sm=$(tail -1 $R/kanit/mut-$name.out)
  else TZ=UTC timeout -k 5 900 $T > $R/kanit/mut-$name.out 2>&1; c=$?; sm=$(grep -E "^# (tests|pass|fail)" $R/kanit/mut-$name.out | tr '\n' ' '); fi
  python3 -I $R/mutant.py $R/mut $name geri >> $O 2>&1 || { echo "GERİ ALINAMADI $name" >> $O; exit 1; }
  echo "MUTANT $name çıkış $c · $sm" >> $O
done
git -C $R/mut status -s >> $O
echo "BİTTİ $(date -u +%H:%M) $(cat /proc/loadavg)" >> $O
