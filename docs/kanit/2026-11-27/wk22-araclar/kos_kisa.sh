#!/bin/bash
# WK 22 kısa kanıt koşuları (her biri ≤ 15 dk sınırlı; ölçüm dışı yük → paylaşımlı kilit). Depo kökünden (worktree) çalışır. Kullanım: bash kos_kisa.sh <depo kökü>
cd "$1" || exit 1
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/wk22-c5c2
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
K=test/bagimsiz/whatsapp-248/kahin
cat /proc/loadavg
for tz in UTC Europe/Istanbul; do
  ek=""; [ "$tz" = "UTC" ] || ek="-tz-istanbul"
  KANIT_DIR=$N/kanit TZ=$tz flock -s -w 3600 $L timeout -k 5 900 node tools/kanit.mjs kos wk22-senaryolar$ek -- python3 -I $K/senaryolar.py | tail -3 || exit 1
  sha256sum $K/senaryolar.json | cut -c1-16
  KANIT_DIR=$N/kanit TZ=$tz flock -s -w 3600 $L timeout -k 5 900 node tools/kanit.mjs kos wk22-yeni-mutantlar$ek -- python3 -I $N/araclar/yeni_mutant.py $K | tail -3 || exit 1
  KANIT_DIR=$N/kanit TZ=$tz flock -s -w 3600 $L timeout -k 5 900 node tools/kanit.mjs kos wk22-g3-eski-414-tam-sonuc-fark$ek -- python3 -I $N/araclar/g3_fark.py $N/taban/senaryolar.json $K/senaryolar.json | tail -3 || exit 1
  KANIT_DIR=$N/kanit TZ=$tz flock -s -w 3600 $L timeout -k 5 900 node tools/kanit.mjs kos wk22-eski-kahinle-yeni-senaryolar$ek -- python3 -I $N/araclar/eski_kahin_yeni.py $N/taban $K $N/eski-kos$ek | tail -3 || exit 1
done
cat /proc/loadavg
