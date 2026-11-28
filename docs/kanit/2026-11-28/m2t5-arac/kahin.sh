#!/bin/bash
# M2 tur 5 kâhin ↔ program (kodunu okumadan): cari ve defter, iki TZ, anlık kopya yerine ajan ağacı (kod son: daffae69).
D=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t5
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a9a57b6814460a732 || exit 1
for K in cari defter; do
  for TZV in UTC Europe/Istanbul; do
    T=$(echo "$TZV" | tr -d '/')
    cat /proc/loadavg
    TZ=$TZV HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$D/kanit" flock -s -w 3600 "$L" timeout -k 5 1800 node tools/kanit.mjs kos "m2t5-kahin-$K-$T" -- npm run "test:kahin-$K" 2>&1 | tail -1
  done
done
