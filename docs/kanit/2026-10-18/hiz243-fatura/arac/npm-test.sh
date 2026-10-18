#!/bin/bash
set -uo pipefail
S=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad
OUT=$S/hiz243-arac/bitis
export HUKUK_LICENSE_URL=http://127.0.0.1:9
exec 9>$S/e2e-243.lock
echo "npm test kilit bekleniyor $(date -u +%T)" >> $OUT/ozet.log
flock 9
echo "npm test kilit alındı $(date -u +%T); df $(df -h / | tail -1 | awk '{print $4}') boş" >> $OUT/ozet.log
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a477c416a56bc423c
timeout 5400 node tools/kanit.mjs kos hiz243-npm-test -- npm test > $OUT/npm-test.out 2>&1
echo "npm test çıkış $? $(date -u +%T): $(grep -E '^# (tests|pass|fail|cancelled|skipped)' $OUT/npm-test.out | tr '\n' ' ') $(tail -1 $OUT/npm-test.out)" >> $OUT/ozet.log
