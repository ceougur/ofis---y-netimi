#!/bin/bash
# M2 tur 5 eşdeğerlik: tur 5 ve tur 4 rastgele üreticileri 40 tohum, iki TZ (anlık kopya /dev/shm/m2t5-kom/kom = 090aab85).
D=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t5
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
cd /dev/shm/m2t5-kom/kom || exit 1
S=$(seq -s, 1 40)
for TZV in UTC Europe/Istanbul; do
  T=$(echo "$TZV" | tr -d '/')
  cat /proc/loadavg
  TZ=$TZV M2T5_TOHUM=$S M2T4_TOHUM=$S HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$D/kanit" flock -s -w 3600 "$L" timeout -k 5 3000 \
    node tools/kanit.mjs kos "m2t5-esdeger-$T" -- node --test --test-name-pattern "tohum" test/supheli-degersiz-m2t5-251.test.mjs test/supheli-degersiz-m2t4-251.test.mjs 2>&1 | tail -1
done
