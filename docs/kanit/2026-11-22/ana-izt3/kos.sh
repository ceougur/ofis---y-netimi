#!/bin/bash
# Ana oturum yeniden koşusu — izleyen tur 3. yeni = /dev/shm/izt3-sinama (çalışma dalı + izt3); eski = /dev/shm/izt2-sinama (3b420085) + yalnız iki YENİ test dosyası (ders 51); mutantlar eski kopyanın integrity-scope.mjs'ine yazılır, sonra git checkout ile geri.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/ana-izt3; Y=/dev/shm/izt3-sinama; E=/dev/shm/izt2-sinama
T="test/izt3-kapi-rowid-250.test.mjs test/izt3-stok-iade-canli-250.test.mjs"
export HUKUK_LICENSE_URL=http://127.0.0.1:9
exec 9>$S/olcum.lock; flock -s -w 3600 9 || { echo "kilit alınamadı" > $D/ozet.txt; exit 1; }
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S) · yeni $(git -C $Y log --oneline -1 | cut -c1-9) · eski $(git -C $E log --oneline -1 | cut -c1-9)" > $D/ozet.txt
for f in $T; do cp $Y/$f $E/$f || exit 1; done
for tz in UTC Europe/Istanbul; do t=$(echo $tz | tr / -)
  (cd $Y && TZ=$tz timeout -k 5 1200 node --test $T > $D/yeni-$t.txt 2>&1); echo "yeni $tz çıkış $? · $(grep -E '^# (tests|pass|fail|cancelled|skipped) ' $D/yeni-$t.txt | tr '\n' ' ')" >> $D/ozet.txt
  (cd $E && TZ=$tz timeout -k 5 1200 node --test $T > $D/eski-$t.txt 2>&1); echo "eski $tz çıkış $? · $(grep -E '^# (tests|pass|fail|cancelled|skipped) ' $D/eski-$t.txt | tr '\n' ' ')" >> $D/ozet.txt
done
for m in m1 m2; do
  python3 -I $S/izt3-ae8/mutant.py $Y/server/lib/integrity-scope.mjs $m $E/server/lib/integrity-scope.mjs >> $D/ozet.txt || exit 1
  (cd $E && TZ=UTC timeout -k 5 1200 node --test test/izt3-kapi-rowid-250.test.mjs > $D/mutant-$m.txt 2>&1); echo "mutant $m çıkış $? · $(grep -E '^# (tests|pass|fail) ' $D/mutant-$m.txt | tr '\n' ' ')" >> $D/ozet.txt
  git -C $E checkout -- server/lib/integrity-scope.mjs || exit 1
done
for k in prod test; do
  (cd $D && timeout -k 5 1200 node $S/izt3-ae8/probe/kapi.mjs $E $k > $D/kapi-eski-$k.txt 2>&1; echo "kapı eski $k çıkış $?" >> $D/ozet.txt)
  (cd $D && timeout -k 5 1200 node $S/izt3-ae8/probe/kapi.mjs $Y $k > $D/kapi-yeni-$k.txt 2>&1; echo "kapı yeni $k çıkış $?" >> $D/ozet.txt)
  python3 -I $S/izt3-ae8/probe/karsilastir.py $D/kapi-eski-$k.txt $D/kapi-yeni-$k.txt > $D/kapi-karsilastir-$k.txt 2>&1; echo "karşılaştır $k çıkış $?" >> $D/ozet.txt
done
(cd $D && timeout -k 5 600 node $S/izt3-ae8/probe/olay.mjs $Y > $D/olay-yeni.txt 2>&1; echo "olay yeni çıkış $?" >> $D/ozet.txt)
(cd $D && timeout -k 5 600 node $S/izt3-ae8/probe/olay.mjs $E > $D/olay-eski.txt 2>&1; echo "olay eski çıkış $?" >> $D/ozet.txt)
for f in $T; do rm $E/$f; done
git -C $E status -s | grep -v node_modules >> $D/ozet.txt
echo "bitti $(date -u +%H:%M:%S)" >> $D/ozet.txt
