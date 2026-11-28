#!/bin/bash
# Mutasyonlar (yalnız /dev/shm/dk-m1k5-mut kopyasında): her biri yeni iki test dosyasına karşı.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-m1k5
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
M=/dev/shm/dk-m1k5-mut
F=$M/server/routes/tax.mjs
cd "$M" || exit 1
[ -e node_modules ] || ln -s /home/user/ofis---y-netimi/node_modules node_modules
cp "$F" "$N/tax.orijinal.mjs" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
ORIG='done.push({ month, inMinor: kept && settled.offsetState !== "stale" ? Number(offset.inMinor) : step.input });'
declare -A MUT
MUT[M2-hep-bugunku]='done.push({ month, inMinor: step.input });'
MUT[M4-karma-da-bugunku]='done.push({ month, inMinor: kept \&\& settled.offsetState !== "stale" \&\& settled.offsetState !== "mixed" ? Number(offset.inMinor) : step.input });'
MUT[M5-yalniz-kept-sakli]='done.push({ month, inMinor: kept \&\& settled.offsetState === "kept" ? Number(offset.inMinor) : step.input });'
MUT[M6-stale-carried-siz]='done.push({ month, inMinor: kept \&\& settled.offsetState !== "stale" ? Number(offset.inMinor) : kept ? table.of(month).input : step.input });'
for k in M2-hep-bugunku M4-karma-da-bugunku M5-yalniz-kept-sakli M6-stale-carried-siz; do
  cp "$N/tax.orijinal.mjs" "$F"
  sed -i "s|$ORIG|${MUT[$k]}|" "$F"
  if cmp -s "$F" "$N/tax.orijinal.mjs"; then echo "$k UYGULANAMADI" >> "$N/mutant-durum.txt"; continue; fi
  s=$(date +%s)
  TZ=UTC flock -s -w 3600 "$L" timeout -k 5 1800 node --test test/kdv-ozeti-s4-guncel-degil-251.test.mjs test/kdv-ozeti-rastgele-251.test.mjs > "$N/mut-$k.log" 2>&1
  echo "$k exit=$? sure=$(( $(date +%s) - s )) $(grep -E '^# (pass|fail)' "$N/mut-$k.log" | tr '\n' ' ') $(grep -oE '[0-9]+ tohumda [0-9]+ sapma' "$N/mut-$k.log" | tr '\n' ' ')" >> "$N/mutant-durum.txt"
done
cp "$N/tax.orijinal.mjs" "$F"
cmp "$F" "$N/tax.orijinal.mjs" && echo "geri yüklendi" >> "$N/mutant-durum.txt"
