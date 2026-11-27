#!/bin/bash
# M1 tur 2 kabul A: test:kahin-defter tur 1 kodunda (/dev/shm/m1t2-kdv/eski) ve tur 2 kodunda, iki TZ. flock -s altında çağrılır.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-af18bb1989d74249b
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$S/m1t2-ajan/kanit
for side in tur1:/dev/shm/m1t2-kdv/eski tur2:$WT; do
  name=${side%%:*}; code=${side#*:}
  for tz in UTC Europe/Istanbul; do
    tag=$([ $tz = UTC ] && echo utc || echo ist)
    echo "== $name $tz başta $(cat /proc/loadavg)"
    (cd $code && TZ=$tz timeout -k 5 1800 node $WT/tools/kanit.mjs kos m1t2-kahin-defter-$name-$tag -- npm run test:kahin-defter) 2>&1 | tail -3
  done
done
