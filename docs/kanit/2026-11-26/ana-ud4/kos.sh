#!/bin/bash
# Ana oturum yeniden koşusu — UD turu 4 (sınama ud4-sinama). Ders 55: kol A ~45 dk, kol B ~45 dk (paralel); dış sınır 6000 sn.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; W=$S/ud2-sinama; E=$S/ud4-ana-eski; O=$S/ud4-ana-cikti
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
YENI="test/supheli-degersiz-s269-250.test.mjs test/supheli-degersiz-s264-250.test.mjs"
r(){ n=$1; t=$2; d=$3; shift 3; (cd $d && timeout -k 5 $t "$@" > $O/$n.txt 2>&1; echo "cikis $?" >> $O/$n.txt); }
kolA(){
 for tz in UTC Europe/Istanbul; do z=${tz//\//-}
  TZ=$tz r yeni-$z 600 $W node --test $YENI
  TZ=$tz r eski-$z 600 $E node --test test/supheli-degersiz-s269-250.test.mjs
  TZ=$tz ROOT=$W r probe-$z 600 $W node --test $S/dk-ud3-r8m4/s264-probe.test.mjs
  TZ=$tz r komsu-$z 2400 $W node --test $(cat $S/ud4-komsu.txt)
  TZ=$tz r kc-$z 1800 $W npm run test:kahin-cari
  TZ=$tz r kd-$z 900 $W npm run test:kahin-defter
 done
 r mutasyon 1500 $W node test/supheli-s269-mutasyon-250.mjs --klasor $O/mut-klasor
 r e2e-yeni 900 $W npm run test:senaryo-supheli-kuyruk-250
 r e2e-eski 900 $E npm run test:senaryo-supheli-kuyruk-250
 echo BITTI > $O/bittiA.txt
}
kolB(){
 m(){ r mut-t$1 5400 $W npm run test:mutabakat -- --islem 5000 --tohum $1 --tohumlar 1; }
 m 7 & m 8 & wait
 echo BITTI > $O/bittiB.txt
}
kolA & kolB & wait
