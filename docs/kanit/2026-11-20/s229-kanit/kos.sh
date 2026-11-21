#!/bin/bash
# kos.sh <ad> <kök> <TZ> <test dosyaları...>
AD=$1; KOK=$2; TZV=$3; shift 3
cd "$KOK" || exit 1
TMPDIR=/dev/shm/s229-a343-tmp TZ=$TZV HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/s229-a343/kanit timeout -k 5 2400 flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock node /home/user/ofis---y-netimi/.claude/worktrees/agent-a343eda2c3de7a0a1/tools/kanit.mjs kos s229-$AD -- node --test "$@"
