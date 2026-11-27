#!/bin/bash
# Açılış karşılaştırması (özel kilit altında çağrılır): acilis-kos.sh <çıktı> <tur> <ad=kök> ...   — sıra dönüşümlü, her koşu taze kopya.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
OUT=$1; TUR=$2; shift 2
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "AÇILIŞ · $(date -u +%H:%M:%S) · başta $(cat /proc/loadavg)" > "$OUT"
for tur in $(seq 1 $TUR); do
  list=("$@"); [ $((tur % 2)) -eq 0 ] && list=($(printf '%s\n' "$@" | tac))
  for pair in "${list[@]}"; do
    ad=${pair%%=*}; kok=${pair#*=}
    rm -rf "$S/c5bkd-acilis-kopya"
    cp -a $S/c5bkd-veri-prof "$S/c5bkd-acilis-kopya" || exit 1
    sync
    echo "$ad tur $tur: $(timeout 300 node --disable-warning=ExperimentalWarning ${PROF:+--cpu-prof --cpu-prof-dir=$S/c5bkd-prof/acilis-$ad} $S/c5bkd-betik/acilis.mjs "$kok" "$S/c5bkd-acilis-kopya" 2>&1 | tail -1)" >> "$OUT"
  done
done
rm -rf "$S/c5bkd-acilis-kopya"
echo "bitti $(date -u +%H:%M:%S) · $(cat /proc/loadavg)" >> "$OUT"
