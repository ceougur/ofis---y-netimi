#!/bin/bash
# M1 küçük tur — ana kabul zinciri (arka planda, her adım kendi süre sınırıyla, her adım flock -s altında):
#  1) yeni ekran senaryosu TABANDA (kırmızı beklenir)  2) KDV Özeti'ne dokunan bütün ekran senaryoları YENİ kodda  3) komşular UTC + İstanbul
#  4) test:kahin-defter taban ve yeni × iki TZ  5) kabul D: ön izleme / fiş taban = yeni (dar kontrolün senaryoları)  6) karma ay yoklaması
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-af4f8faccec231727
B=$WT/docs/kanit/2026-11-27/m1k-betik
L=$S/olcum.lock
step() { echo "### $1 · $(date -u +%H:%M:%S) · yük $(cut -d' ' -f1-3 /proc/loadavg)"; }
step "1 taban yeni senaryo"; flock -s -w 3600 $L bash $B/e2e.sh /dev/shm/m1k-kdv/eski taban senaryo-kdv-mahsup-sonrasi-251
step "2 yeni bütün ekran senaryoları"; flock -s -w 3600 $L bash $B/e2e.sh $WT yeni
step "3a komşu utc"; flock -s -w 3600 $L bash $B/komsu.sh utc $WT $S/m1k/kanit 2>&1 | grep -E "^\[kanit\]|^# (tests|pass|fail)"
step "3b komşu ist"; flock -s -w 3600 $L bash $B/komsu.sh ist $WT $S/m1k/kanit 2>&1 | grep -E "^\[kanit\]|^# (tests|pass|fail)"
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$S/m1k/kanit
for side in taban:/dev/shm/m1k-kdv/eski yeni:$WT; do
  name=${side%%:*}; code=${side#*:}
  for tz in UTC Europe/Istanbul; do
    tag=$([ $tz = UTC ] && echo utc || echo ist)
    step "4 kahin-defter $name $tz"
    (cd $code && TZ=$tz flock -s -w 3600 $L timeout -k 5 1800 node $WT/tools/kanit.mjs kos m1k-kahin-defter-$name-$tag -- npm run test:kahin-defter) 2>&1 | tail -3
  done
done
step "5 ön izleme / fiş taban = yeni"; flock -s -w 3600 $L bash $B/onizleme-esit.sh $S/m1k/onizleme
step "6 karma yoklama"; for side in taban:/dev/shm/m1k-kdv/eski yeni:$WT; do echo "-- ${side%%:*}"; TZ=UTC flock -s -w 3600 $L timeout -k 5 600 node $B/karma-yoklama.mjs ${side#*:} 2>&1 | grep -v -i experimental; done
step "BİTTİ"
