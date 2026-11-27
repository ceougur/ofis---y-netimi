#!/bin/bash
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
D=$S/ana-izt4s
cd /dev/shm/izt4-sinama || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
exec 9>$S/olcum.lock; flock -s -w 3600 9 || { echo "kilit alınamadı (B)" >> $D/ozet.txt; exit 1; }
echo "B başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)" >> $D/ozet.txt
for s in senaryo-izt4-250 senaryo-s223-250 senaryo-s231-250 senaryo-izt3-250 senaryo-izt2-250 senaryo-izt-250 senaryo-dkfix-250 senaryo-banka-210b senaryo-banka-210-eski-satir senaryo-pos-220 senaryo-entegrator-240 senaryo-fatura-243 senaryo-kdv-donemi-250 senaryo-c7b-kabul-250 senaryo-c7b-tur3-250 gg244-esmm-gonder gg244-numara-tarih-onay uiux-b-243 senaryo-213 senaryo-215 senaryo-216 senaryo-217 senaryo-224 senaryo-iade-246 senaryo-kart-iade-gecmis-250 banka-210-kart-onbellek-yaris; do
  TZ=Europe/Istanbul EKRAN_DIR=$D/ekran/$s timeout -k 5 900 node --disable-warning=ExperimentalWarning test/e2e/$s.mjs > $D/e2e-$s.log 2>&1; rc=$?
  echo "e2e $s çıkış $rc · $(grep -aE '([0-9]+ geçti, [0-9]+ kaldı|[0-9]+ / [0-9]+ kontrol geçti)' $D/e2e-$s.log | tail -1 | cut -c1-80)" >> $D/ozet.txt
done
echo "bitti $(cat /proc/loadavg) $(date -u +%H:%M:%S)" >> $D/ozet.txt
