#!/bin/bash
# Bakım 2 kanıt koşuları (temiz ağaç): öz test UTC + Europe/Istanbul, üretici denetimi; tools/kanit.mjs kos ile. Çağrı: flock -s -n <olcum.lock> bash kanit-kos.sh <ağaç> <kanıt klasörü>
W="$1"; K="$2"
cd "$W" || exit 1
mkdir -p "$K" || exit 1
{ date -u +"basla %Y-%m-%dT%H:%M:%SZ"; cat /proc/loadavg; git log --oneline -1; git status -s; } > "$K/kos-gunlugu.txt"
for tz in UTC Europe/Istanbul; do
  ad=$( [ "$tz" = UTC ] && echo utc || echo ist )
  TZ=$tz KANIT_DIR="$K" timeout -k 5 3000 node tools/kanit.mjs kos kahinmobil2-oz-$ad -- python3 -I -B test/bagimsiz/mobil-yazma/kahin_test.py > "$K/kahinmobil2-oz-$ad.txt" 2>&1
  echo "oz-$ad cikis $?" >> "$K/kos-gunlugu.txt"; cat /proc/loadavg >> "$K/kos-gunlugu.txt"
done
TZ=UTC KANIT_DIR="$K" timeout -k 5 1800 node tools/kanit.mjs kos kahinmobil2-uretici-denetle -- python3 -I -B test/bagimsiz/mobil-yazma/senaryolar.py --denetle > "$K/kahinmobil2-uretici-denetle.txt" 2>&1
echo "uretici cikis $?" >> "$K/kos-gunlugu.txt"
date -u +"bitti %Y-%m-%dT%H:%M:%SZ" >> "$K/kos-gunlugu.txt"
git status -s >> "$K/kos-gunlugu.txt"
