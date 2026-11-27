#!/bin/bash
# SQL dökümü (yük kilidiyle; kabul ölçümü değil). Kullanım: sql-kos.sh <ad> <kod kökü> <borc|zil|zililk|kart> [tekrar]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
AD=$1; ROOT=$2; NE=${3:-borc}; N=${4:-4}
export HUKUK_LICENSE_URL=http://127.0.0.1:9
rm -rf "$S/c5bkd-veri-kopya-$AD"
cp -a $S/c5bkd-veri-prof "$S/c5bkd-veri-kopya-$AD" || exit 1
flock -s -n $S/olcum.lock timeout 600 node --disable-warning=ExperimentalWarning $S/c5bkd-betik/prof-sql.mjs "$ROOT" "$S/c5bkd-veri-kopya-$AD" $NE $N
echo "çıkış $?"
rm -rf "$S/c5bkd-veri-kopya-$AD"
