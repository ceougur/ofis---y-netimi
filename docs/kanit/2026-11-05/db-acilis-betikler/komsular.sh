#!/bin/bash
# Komşu testler (G2): test/*.test.mjs içinde openDatabase|closeCompany|restore + supervisor|createBackup|BUSY_TIMEOUT|probeWritable|isLockError|lib/db.mjs geçenler
# + platform-tasinabilirlik + lisans-servisi-izolasyonu (liste: komsular.txt, grep ile üretildi). Tek koşu, --test-concurrency=1.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/db-acilis-a4c3
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa4c32f640b15a6cf
cd "$W" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
mapfile -t FILES < "$S/komsular.txt"
TZ=UTC node tools/kanit.mjs kos db-acilis-komsular-138 --sure 120 -- node --test --test-concurrency=1 --test-reporter=spec "${FILES[@]}"
echo BITTI
