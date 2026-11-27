#!/bin/bash
# M1 tur 2 yeni / değişen testler: taban (t251-m1-tur1; ayrı kopya /dev/shm/m1t2-kdv/eski — yalnız iki test dosyası kopyalandı) kırmızı beklenir, yeni kodda yeşil; iki TZ.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-af18bb1989d74249b
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$S/m1t2-ajan/kanit
for side in taban:/dev/shm/m1t2-kdv/eski yeni:$WT; do
  name=${side%%:*}; code=${side#*:}
  for tz in UTC Europe/Istanbul; do
    tag=$([ $tz = UTC ] && echo utc || echo ist)
    echo "== $name $tz $(cat /proc/loadavg)"
    (cd $code && TZ=$tz timeout -k 5 900 node $WT/tools/kanit.mjs kos m1t2-yeni-test-$name-$tag -- node --test test/kdv-ozeti-zincir-251.test.mjs test/kdv-ozeti-devreden-251.test.mjs) 2>&1 | grep -E "^\[kanit\]|^# (tests|pass|fail)"
  done
done
