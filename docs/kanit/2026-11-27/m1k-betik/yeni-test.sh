#!/bin/bash
# M1 küçük tur — yeni / değişen testler: taban (t251-m1k-taban; ayrı kopya /dev/shm/m1k-kdv/eski — git archive; yalnız yeni / değişen TEST dosyaları kopyalandı) ve yeni kod; iki TZ.
# flock -s altında çağrılır. $1 = taban | yeni | ikisi (varsayılan ikisi)
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-af4f8faccec231727
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$S/m1k/kanit
TESTS="test/kdv-ozeti-mahsup-sonrasi-251.test.mjs test/kdv-ozeti-zincir-251.test.mjs test/kdv-ozeti-devreden-251.test.mjs"
SIDES="taban:/dev/shm/m1k-kdv/eski yeni:$WT"
[ "$1" = taban ] && SIDES="taban:/dev/shm/m1k-kdv/eski"
[ "$1" = yeni ] && SIDES="yeni:$WT"
for side in $SIDES; do
  name=${side%%:*}; code=${side#*:}
  for tz in UTC Europe/Istanbul; do
    tag=$([ $tz = UTC ] && echo utc || echo ist)
    echo "== $name $tz $(cat /proc/loadavg)"
    (cd $code && TZ=$tz timeout -k 5 1200 node $WT/tools/kanit.mjs kos m1k-yeni-test-$name-$tag -- node --test $TESTS) 2>&1 | grep -E "^\[kanit\]|^# (tests|pass|fail)"
  done
done
