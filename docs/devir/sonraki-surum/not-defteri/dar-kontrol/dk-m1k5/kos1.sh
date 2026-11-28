#!/bin/bash
cd "$1" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for tz in UTC Europe/Istanbul; do
  s=$(date +%s)
  TZ=$tz flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock timeout -k 5 1800 node --test test/kdv-ozeti-s4-guncel-degil-251.test.mjs test/kdv-ozeti-rastgele-251.test.mjs > "$2-${tz//\//_}.log" 2>&1
  echo "exit=$? sure=$(($(date +%s)-s))" >> "$2-${tz//\//_}.log"
done
