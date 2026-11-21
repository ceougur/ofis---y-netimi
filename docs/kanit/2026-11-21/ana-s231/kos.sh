#!/bin/bash
# ANA OTURUM — S231 küçük turunun dar yeniden koşusu (ders 16, 38, 51, 54): yeni = git worktree 9aa46eba (S231 dal ucu), eski = git worktree s223-uc + YALNIZ yeni test dosyaları (değişmiş eski test yok);
# ikisi /dev/shm; iki TZ; paylaşılan kilit; sonra ekran senaryosu yeni / eski ve G2 komşu listesi (ajanın komsu-listesi.txt, 57 dosya) yenide iki TZ.
SP=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; A=$SP/ana-s231; Y=/dev/shm/ana-s231/yeni; E=/dev/shm/ana-s231/eski; R=/home/user/ofis---y-netimi
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$SP/pw-1194
[ -d $Y ] || { git -C $R worktree add --detach $Y 9aa46eba >/dev/null 2>&1 && ln -s $R/node_modules $Y/node_modules; } || exit 1
[ -d $E ] || { git -C $R worktree add --detach $E s223-uc >/dev/null 2>&1 && ln -s $R/node_modules $E/node_modules; } || exit 1
mkdir -p $E/test/e2e && for f in test/s231-grup-adi-turkce-250.test.mjs test/s231-cek-pencere-metni-250.test.mjs test/s231-cek-hiz-esdegerlik-250.test.mjs test/s231-eski-surum-sinif-250.test.mjs test/e2e/senaryo-s231-250.mjs; do cp $Y/$f $E/$f || exit 1; done
T="test/s231-grup-adi-turkce-250.test.mjs test/s231-cek-pencere-metni-250.test.mjs test/s231-cek-hiz-esdegerlik-250.test.mjs test/s231-eski-surum-sinif-250.test.mjs test/s223-turkce-ad-eslesme-250.test.mjs test/s223-eski-surum-sinif-250.test.mjs test/c7bt-ayni-adli-excel-karti-250.test.mjs test/names.test.mjs"
kos() { d=$1; ad=$2; tz=$3; shift 3
  (cd $d && TZ=$tz KANIT_DIR=$A/kanit timeout -k 5 3000 flock -s -w 5400 $SP/olcum.lock node tools/kanit.mjs kos ana-s231-$ad -- "$@" > $A/$ad.log 2>&1)
  echo "$ad çıkış $? · $(date -u +%H:%M) · $(grep -E '^# (tests|pass|fail|cancelled|skipped)' $A/$ad.log | tr '\n' ' ')"; }
echo "başta $(cat /proc/loadavg) · $(date -u +%H:%M)"
for tz in UTC Europe/Istanbul; do a=$(echo $tz | tr '/' '-'); kos $Y yeni-$a $tz node --test $T; kos $E eski-$a $tz node --test $T; done
grep -hE "^\s*not ok|✖" $A/eski-UTC.log | sort -u | head -30 | cut -c1-200
kos $Y ekran-yeni Europe/Istanbul node --disable-warning=ExperimentalWarning test/e2e/senaryo-s231-250.mjs
(cd $Y && TZ=Europe/Istanbul DEPO=$E KANIT_DIR=$A/kanit timeout -k 5 3000 flock -s -w 5400 $SP/olcum.lock node tools/kanit.mjs kos ana-s231-ekran-eski -- node --disable-warning=ExperimentalWarning test/e2e/senaryo-s231-250.mjs > $A/ekran-eski.log 2>&1); echo "ekran-eski çıkış $? · $(grep -E '^# (tests|pass|fail)' $A/ekran-eski.log | tr '\n' ' ')"
grep -E "✗" $A/ekran-eski.log | head -12 | cut -c1-200
K=$(tr '\n' ' ' < $Y/docs/kanit/2026-11-20/s231-kanit/kod-6f6aff4a/komsu-listesi.txt)
for tz in UTC Europe/Istanbul; do a=$(echo $tz | tr '/' '-'); kos $Y komsu-$a $tz node --test $K; done
echo "bitti $(date -u +%H:%M) · $(cat /proc/loadavg)"
