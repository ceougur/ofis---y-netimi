#!/bin/bash
# WhatsApp tur 2 kanıtlarını depoya kopyalar: docs/kanit/2026-11-06/watur2-* (kanıt aracının .json/.log'u; 300 KB üstü .log gzip), dar kontrol / mutasyon / ölçüm / üretim
# çıktıları ve betikler. Kullanım: bash kanit-kopyala.sh <depo kökü>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
K=$S/watur2-kanit
R=$1
H=$R/docs/kanit/2026-11-06
mkdir -p "$H/watur2-cikti" "$H/watur2-betikler" || exit 1
for f in "$K"/2026-11-06/watur2-*; do
  b=$(basename "$f")
  if [ "${b##*.}" = "log" ] && [ "$(stat -c %s "$f")" -gt 300000 ]; then gzip -9 -c "$f" > "$H/$b.gz"; else cp "$f" "$H/$b"; fi
done
for f in "$K"/dk-*.txt "$K"/mutasyon-*.txt "$K"/olcum-*.txt "$K"/uret-*.txt "$K"/komsu-liste.txt; do
  [ -f "$f" ] && grep -v -i "experimentalwarning\|trace-warnings" "$f" > "$H/watur2-cikti/$(basename "$f")"
done
cp "$S"/watur2-betik/*.mjs "$S"/watur2-betik/*.sh "$H/watur2-betikler/"
cp "$S"/watur2-dk/kos.sh "$H/watur2-betikler/dk-kos.sh"
ls "$H" | grep -c '^watur2'
