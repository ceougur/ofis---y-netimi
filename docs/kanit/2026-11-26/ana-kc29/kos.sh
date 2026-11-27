#!/bin/bash
# Ana oturum yeniden koşusu — kâhin cari bakımı 29 (sınama ud3-sinama + kâhin dalı). Kol: $1 = utc|ist. Ders 55: dış sınır 5400 sn (ölçülmüş toplam ~50 dk × 1,5).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad; W=$S/ud2-sinama; N=$S/kc29-ana; E=$N/eski; O=$N/cikti
A=docs/kanit/2026-11-26/kahin-cari29-arac; D=test/bagimsiz/cari/senaryolar/d61-c5-s266-s265-yalin-olmayan.json
case "$1" in utc) export TZ=UTC;; ist) export TZ=Europe/Istanbul;; *) exit 2;; esac
Z=$1; export HUKUK_LICENSE_URL=http://127.0.0.1:9; cd $W || exit 1
k(){ n=$1; t=$2; shift 2; timeout -k 5 $t "$@" > $O/$n-$Z.txt 2>&1; echo "cikis $?" >> $O/$n-$Z.txt; }
k oz 900 python3 -I -B test/bagimsiz/cari/oz-test.py
k g3 600 python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $O/g3-dokum-$Z.json
k elle-yeni 300 python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $D
k kirmizi-eski 300 python3 -I -B $A/elle-karsilastir.py --kirmizi-bekle --model $E/test/bagimsiz/cari $D
k program 1800 npm run test:kahin-cari
k uzun 4200 npm run test:kahin-cari -- --tohum 1-30 --islem 120
echo BITTI > $O/bitti-$Z.txt
