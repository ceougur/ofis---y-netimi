#!/bin/bash
# M2 tur 5 komşu koşusu: iki saat dilimi sırayla (ders 15, 52 — paylaşımlı kilit).
D=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t5
R=/dev/shm/m2t5-kom/kom
cd "$R" || exit 1
LIST=$(tr '\n' ' ' < "$D/komsu.txt")
for TZV in UTC Europe/Istanbul; do
  T=$(echo "$TZV" | tr -d '/')
  cat /proc/loadavg
  TZ=$TZV HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$D/kanit" flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock \
    timeout -k 5 2700 node tools/kanit.mjs kos "m2t5-komsular-$T" -- node --test --test-concurrency=2 $LIST 2>&1 | tail -3
done
