#!/bin/bash
# M1 küçük tur 2 — yeni / değişen testler: taban (t251-m1k; ayrı kopya /dev/shm/m1k2-kdv/eski — git worktree --detach; içine YALNIZ yeni test dosyası kopyalandı) ve yeni kod;
# iki TZ. flock -s altında çağrılır. $1 = taban | yeni | ikisi (varsayılan ikisi), $2 = yeni kodun kökü, $3 = kanıt klasörü.
WT=${2:-/home/user/ofis---y-netimi/.claude/worktrees/agent-a341390f4f549e487}
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=${3:-/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k2/kanit}
TESTS="test/kdv-ozeti-karma-251.test.mjs test/kdv-ozeti-mahsup-sonrasi-251.test.mjs test/kdv-ozeti-zincir-251.test.mjs test/kdv-ozeti-devreden-251.test.mjs"
SIDES="taban:/dev/shm/m1k2-kdv/eski yeni:$WT"
[ "$1" = taban ] && SIDES="taban:/dev/shm/m1k2-kdv/eski"
[ "$1" = yeni ] && SIDES="yeni:$WT"
for side in $SIDES; do
  name=${side%%:*}; code=${side#*:}
  for tz in UTC Europe/Istanbul; do
    tag=$([ $tz = UTC ] && echo utc || echo ist)
    echo "== $name $tz $(cat /proc/loadavg)"
    (cd $code && TZ=$tz timeout -k 5 1200 node $WT/tools/kanit.mjs kos m1k2-yeni-test-$name-$tag -- node --test --test-reporter=tap $TESTS) 2>&1 | grep -E "^\[kanit\]|^# (tests|pass|fail|cancelled)|^    not ok|^not ok"
  done
done
