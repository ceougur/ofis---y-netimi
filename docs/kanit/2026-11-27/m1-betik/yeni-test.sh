#!/bin/bash
# M1 yeni test: taban kopyasında (kırmızı beklenir) ve yeni kodda (yeşil), iki TZ; kanıt kaydı.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a372b20f2d341697a
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$S/m1-ajan/kanit
for side in taban:/dev/shm/m1-kdv/eski yeni:$WT; do
  name=${side%%:*}; code=${side#*:}
  for tz in UTC Europe/Istanbul; do
    tag=$([ $tz = UTC ] && echo utc || echo ist)
    (cd $code && TZ=$tz timeout -k 5 600 node $WT/tools/kanit.mjs kos m1-yeni-test-$name-$tag -- node --test test/kdv-ozeti-devreden-251.test.mjs) 2>&1 | grep -E "^\[kanit\]"
  done
done
