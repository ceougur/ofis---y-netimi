#!/bin/bash
# Ana oturum yeniden koşusu — izleyen küçük tur (45da6ea8; sınama = çalışma dalı + tur, /dev/shm/izt-sinama; eski = 44a1762d /dev/shm/izt-taban + yalnız YENİ test dosyaları, ders 51).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/ana-izt
Y=/dev/shm/izt-sinama
E=/dev/shm/izt-taban
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
exec 9>$S/olcum.lock; flock -s -w 3600 9 || { echo "kilit alınamadı" > $D/ozet.txt; exit 1; }
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)" > $D/ozet.txt
for tz in UTC Europe/Istanbul; do t=$(echo $tz | tr '/' '-')
  (cd $Y && TZ=$tz timeout -k 5 1200 node --disable-warning=ExperimentalWarning --test test/izt-izleyen-tur-250.test.mjs > $D/yeni-$t.out 2>&1); echo "yeni $tz çıkış $?" >> $D/ozet.txt
  (cd $E && TZ=$tz timeout -k 5 1200 node --disable-warning=ExperimentalWarning --test test/izt-izleyen-tur-250.test.mjs > $D/eski-$t.out 2>&1); echo "eski $tz çıkış $?" >> $D/ozet.txt
done
for tz in UTC Europe/Istanbul; do t=$(echo $tz | tr '/' '-')
  (cd $Y && TZ=$tz timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs > $D/kahin-cari-$t.out 2>&1); echo "kâhin cari $tz çıkış $?" >> $D/ozet.txt
  (cd $Y && TZ=$tz timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/defter/kos.mjs > $D/kahin-defter-$t.out 2>&1); echo "kâhin defter $tz çıkış $?" >> $D/ozet.txt
done
cp $Y/test/bagimsiz/cari/YAPIM-ASAMASI.json $D/yapim.json
(cd $Y && TZ=UTC KAHIN_YAPIM_ASAMASI=$D/yapim.json timeout -k 5 2400 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz > $D/kahin-yapim.out 2>&1); echo "yapım çıkış $?" >> $D/ozet.txt
e2e() { K=$1; TAG=$2; shift 2; for s in "$@"; do
  (cd $K && TZ=Europe/Istanbul EKRAN_DIR=$D/ekran-$TAG/$s timeout -k 5 900 node --disable-warning=ExperimentalWarning test/e2e/$s.mjs > $D/e2e-$TAG-$s.log 2>&1); rc=$?
  echo "e2e $TAG $s çıkış $rc · $(grep -E 'geçti, [0-9]+ kaldı' $D/e2e-$TAG-$s.log | tail -1)" >> $D/ozet.txt; done; }
e2e $Y yeni senaryo-izt-250 senaryo-dkfix-250 senaryo-banka-210b senaryo-banka-210-eski-satir senaryo-pos-220 senaryo-entegrator-240 senaryo-fatura-243 senaryo-kdv-donemi-250 senaryo-c7b-kabul-250 senaryo-c7b-tur3-250 gg244-esmm-gonder gg244-numara-tarih-onay uiux-b-243 senaryo-217 senaryo-216 banka-210-kart-onbellek-yaris
e2e $E eski senaryo-izt-250
echo "bitti $(cat /proc/loadavg) $(date -u +%H:%M:%S)" >> $D/ozet.txt
