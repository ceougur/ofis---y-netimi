#!/bin/bash
# profil.sh <kod kökü> <etiket> <kip> <yol> — veri kopyası /dev/shm/c5a1c-p-<etiket> (disk sınırı), sonra silinir
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
ROOT=$1; TAG=$2; KIP=$3; YOL=$4; D=/dev/shm/c5a1c-p-$TAG
export HUKUK_LICENSE_URL=http://127.0.0.1:9
rm -rf $D && cp -a $S/ana-kabul/temiz-100k $D || exit 1
if [ "$KIP" = kilitli ]; then python3 -I $S/c5a1c-olcum/kilit.py $D/data/destekofis.sqlite || exit 1; fi
TZ=${TZ:-Europe/Istanbul} timeout 1500 node --disable-warning=ExperimentalWarning $S/c5a1c-olcum/profil.mjs "$ROOT" $D $YOL 2 $S/c5a1c-olcum/prof-$TAG-$KIP.cpuprofile > $S/c5a1c-olcum/prof-$TAG-$KIP-$YOL.txt 2>&1; echo "çıkış $?" >> $S/c5a1c-olcum/prof-$TAG-$KIP-$YOL.txt
rm -rf $D
