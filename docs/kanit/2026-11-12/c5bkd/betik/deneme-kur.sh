#!/bin/bash
# Deneme kopyası: benim motorum + dar kontrolün tembel yamaları (hiz-yama.py). Kullanım: deneme-kur.sh <ad> <yama...>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a511c161b54069067
AD=$1; shift
D=$S/c5bkd-deneme-$AD
rm -rf "$S/c5bkd-deneme-$AD"
mkdir -p "$D/server/lib" && cp -a "$W/server/lib/." "$D/server/lib/" || exit 1
python3 -I $S/dk-c5bkap-x7/betik/hiz-yama.py "$D" "$@"
