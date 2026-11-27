#!/bin/bash
# Profil koşusu (yük kilidiyle; kabul ölçümü değil). Kullanım: prof-kos.sh <ad> <kod kökü> <zil|borc|hepsi> [tekrar]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
AD=$1; ROOT=$2; NE=${3:-hepsi}; N=${4:-8}
export HUKUK_LICENSE_URL=http://127.0.0.1:9
OUT=$S/c5bkd-prof/$AD
rm -rf "$S/c5bkd-prof/$AD" "$S/c5bkd-veri-kopya-$AD"
mkdir -p "$OUT" && cp -a $S/c5bkd-veri-prof "$S/c5bkd-veri-kopya-$AD" || exit 1
flock -s -n $S/olcum.lock timeout 600 node --disable-warning=ExperimentalWarning --cpu-prof --cpu-prof-dir="$OUT" $S/c5bkd-betik/prof-zil.mjs "$ROOT" "$S/c5bkd-veri-kopya-$AD" $NE $N
echo "çıkış $?"
rm -rf "$S/c5bkd-veri-kopya-$AD"
node $S/c5bkd-betik/prof-oku.mjs "$OUT" 22
