#!/bin/bash
# İzleyen tur 4 — ana oturum yeniden koşusu: yeni (sınama ağacı) / eski (6a1d19d1 + yalnız iki YENİ dosya, ders 51) iki TZ + ekran. Paylaşılan kilit, süre sınırı içeride.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
N=$S/ana-izt4
Y=/dev/shm/izt4-sinama
E=/dev/shm/izt4-eski
L=$S/olcum.lock
T=test/izt4-s255-bagli-odeme-250.test.mjs
X=test/e2e/senaryo-izt4-250.mjs
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)" > $N/ozet.txt
if [ ! -d $E ]; then git -C /home/user/ofis---y-netimi worktree add -q --detach $E 6a1d19d1 || exit 1; ln -s /home/user/ofis---y-netimi/node_modules $E/node_modules; cp $Y/$T $E/$T && cp $Y/$X $E/$X || exit 1; fi
for k in yeni eski; do case $k in yeni) K=$Y;; eski) K=$E;; esac
  for tz in UTC Europe/Istanbul; do t=$(echo $tz | tr / -)
    (cd $K && TZ=$tz flock -s -w 3600 $L timeout -k 5 900 node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $T > $N/$k-$t.txt 2>&1); rc=$?
    echo "$k $tz çıkış $rc · $(grep -aE '^# (tests|pass|fail)' $N/$k-$t.txt | tr '\n' ' ')" >> $N/ozet.txt
  done
  (cd $K && TZ=Europe/Istanbul EKRAN_DIR=$N/ekran-$k flock -s -w 3600 $L timeout -k 5 900 node --disable-warning=ExperimentalWarning $X > $N/e2e-$k.txt 2>&1); rc=$?
  echo "$k e2e çıkış $rc · $(grep -aE '[0-9]+ geçti, [0-9]+ kaldı' $N/e2e-$k.txt | tail -1 | cut -c1-100)" >> $N/ozet.txt
done
echo "bitti $(cat /proc/loadavg) $(date -u +%H:%M:%S)" >> $N/ozet.txt
