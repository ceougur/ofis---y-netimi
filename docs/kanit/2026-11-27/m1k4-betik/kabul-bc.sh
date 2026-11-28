#!/bin/bash
# M1 KÜÇÜK TUR 4 KOPYASI: küçük tur 3ün betiği AYNEN — yalnız yollar bu tura (ağaç agent-a7d99fd88f55969de, taban = t251-m1k3 kopyası /dev/shm/m1k4-kdv/eski, kanıt scratchpad/m1k4/kanit, ad öneki m1k4-).
# M1 küçük tur 3 — kabul B (ön izleme / fiş eşitliği + kararın örneğinde fiş eşitliği) ve C (komşular + test:kahin-defter, iki TZ). Her adım ayrı flock -s altında.
# $1 = çıktı klasörü, $2 = B | utc | ist (hangi adım; her biri ayrı arka plan işi — ders 55).
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7d99fd88f55969de
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
OUT=$1
K=$S/m1k4/kanit
L=$S/olcum.lock
B=$WT/docs/kanit/2026-11-27/m1k4-betik
mkdir -p $OUT
if [ "$2" = B ]; then
echo "== B ön izleme $(cat /proc/loadavg)"; timeout -k 5 3000 flock -s -w 3600 $L bash $B/onizleme-esit.sh $OUT/onizleme
echo "== B yalnız 391 $(cat /proc/loadavg)"; timeout -k 5 1500 flock -s -w 3600 $L bash $B/fis-esit-391.sh $OUT/y391
fi
for tz in utc ist; do
  [ "$2" = $tz ] || continue
  Z=$([ $tz = utc ] && echo UTC || echo Europe/Istanbul)
  echo "== C kahin-defter $tz $(cat /proc/loadavg)"
  (cd $WT && TZ=$Z HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K timeout -k 5 2400 flock -s -w 3600 $L node tools/kanit.mjs kos m1k4-kahin-defter-$tz -- npm run test:kahin-defter) 2>&1 | grep -E "^\[kanit\]|^# (tests|pass|fail)"
  echo "== C komşu $tz $(cat /proc/loadavg)"
  timeout -k 5 4000 flock -s -w 3600 $L bash $B/komsu.sh $tz $WT $K 2>&1 | grep -E "^\[kanit\]|^# (tests|pass|fail|cancelled|skipped)|^not ok"
done
