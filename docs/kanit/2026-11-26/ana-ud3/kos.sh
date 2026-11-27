#!/bin/bash
O=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud3-ana-cikti; E=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud3-ana-eski; W=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud2-sinama
YENI="test/supheli-degersiz-s264-250.test.mjs test/tyk-iade-geri-odeme-ud3-250.test.mjs test/tyk-kilit-olcum-250.test.mjs"
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for tz in UTC Europe/Istanbul; do t=${tz//\//-}
 (cd $W && TZ=$tz node --test $YENI > $O/yeni-$t.txt 2>&1; echo "cikis $?" >> $O/yeni-$t.txt)
 (cd $E && TZ=$tz node --test $YENI > $O/eski-$t.txt 2>&1; echo "cikis $?" >> $O/eski-$t.txt)
 (cd $W && TZ=$tz timeout 1800 npm run test:kahin-cari > $O/kc-$t.txt 2>&1; echo "cikis $?" >> $O/kc-$t.txt)
 (cd $W && TZ=$tz timeout 1800 npm run test:kahin-defter > $O/kd-$t.txt 2>&1; echo "cikis $?" >> $O/kd-$t.txt)
 (cd $W && TZ=$tz timeout 3000 node --test $(cat $O/komsu.txt) > $O/komsu-$t.txt 2>&1; echo "cikis $?" >> $O/komsu-$t.txt)
done
(cd $W && timeout 3000 node test/tyk-mutasyon-250.mjs --klasor $O/mut-klasor > $O/mutasyon.txt 2>&1; echo "cikis $?" >> $O/mutasyon.txt)
cd $W
kos(){ s=$1; timeout 3600 npm run test:mutabakat -- --islem 5000 --tohum $s --tohumlar 1 > $O/mut-t$s.txt 2>&1; echo "cikis $?" >> $O/mut-t$s.txt; }
(kos 2; kos 3; kos 8) & (kos 6; kos 7; kos 10) & wait
echo BITTI > $O/bitti.txt
