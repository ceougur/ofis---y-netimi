#!/bin/bash
# M1 kabul A: test:kahin-defter taban ve yeni kodda, iki TZ. Tek seferlik bekleme (yük > 4 iken başlatılmadı).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
sleep 120
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export KANIT_DIR=$S/m1-ajan/kanit
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a372b20f2d341697a
for side in taban:/dev/shm/m1-kdv/eski yeni:$WT; do
  name=${side%%:*}; code=${side#*:}
  for tz in UTC Europe/Istanbul; do
    tag=$([ $tz = UTC ] && echo utc || echo ist)
    echo "== $name $tz başta $(cat /proc/loadavg)"
    (cd $code && TZ=$tz timeout -k 5 3000 node $WT/tools/kanit.mjs kos m1-kahin-defter-$name-$tag -- npm run test:kahin-defter) 2>&1 | tail -3
  done
done
