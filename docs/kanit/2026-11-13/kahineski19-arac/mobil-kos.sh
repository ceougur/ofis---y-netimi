#!/bin/bash
# Cari kâhini bakımı 19 — mobil yazma kâhini öz testi iki saat diliminde + üretici denetimi (temiz ağaç; program AÇILMAZ). bakım 2'nin kahinmobil2/arac/kanit-kos.sh düzeni.
# Kullanım: mobil-kos.sh
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a2ad151373ec5a9ff
K=$S/kahineski19-k4/mobil-kanit
L=$S/olcum.lock
mkdir -p "$K" || exit 1
cd "$W" || exit 1
{ date -u +"basla %Y-%m-%dT%H:%M:%SZ"; cat /proc/loadavg; git log --oneline -1; git status -s; } > "$K/kos-gunlugu.txt"
for tz in UTC Europe/Istanbul; do
  ad=$( [ "$tz" = UTC ] && echo utc || echo ist )
  TZ=$tz KANIT_DIR="$K" timeout -k 5 3000 flock -s -w 1800 $L node tools/kanit.mjs kos kahineski19-mobil-oz-$ad -- python3 -I -B test/bagimsiz/mobil-yazma/kahin_test.py > "$K/kahineski19-mobil-oz-$ad.txt" 2>&1
  echo "oz-$ad cikis $?" >> "$K/kos-gunlugu.txt"; cat /proc/loadavg >> "$K/kos-gunlugu.txt"
done
TZ=UTC KANIT_DIR="$K" timeout -k 5 1800 flock -s -w 1800 $L node tools/kanit.mjs kos kahineski19-mobil-uretici-denetle -- python3 -I -B test/bagimsiz/mobil-yazma/senaryolar.py --denetle > "$K/kahineski19-mobil-uretici-denetle.txt" 2>&1
echo "uretici cikis $?" >> "$K/kos-gunlugu.txt"
date -u +"bitti %Y-%m-%dT%H:%M:%SZ" >> "$K/kos-gunlugu.txt"
git status -s >> "$K/kos-gunlugu.txt"
