#!/bin/bash
# db-acilis kanıt koşuları (sırayla; ders 15). Worktree'den çağrılır.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/db-acilis-a4c3
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-aa4c32f640b15a6cf
cd "$W" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
TZ=UTC node tools/kanit.mjs kos db-acilis-yeni-utc -- node --test --test-concurrency=1 test/db-acilis-kilit-250.test.mjs
TZ=Europe/Istanbul node tools/kanit.mjs kos db-acilis-yeni-istanbul -- node --test --test-concurrency=1 test/db-acilis-kilit-250.test.mjs
TZ=UTC node tools/kanit.mjs kos db-acilis-eski-899fdbce-utc -- node --test --test-concurrency=1 "$S/eski/test/db-acilis-kilit-250.test.mjs"
TZ=Europe/Istanbul node tools/kanit.mjs kos db-acilis-eski-899fdbce-istanbul -- node --test --test-concurrency=1 "$S/eski/test/db-acilis-kilit-250.test.mjs"
YIN_KIP=kurtarma YIN_LIB="$S/eski/server/lib/db.mjs" YIN_N=200 node tools/kanit.mjs kos db-acilis-kurtarma-eski-899fdbce-200 -- node --test --test-concurrency=1 "$S/betik/yineleme.test.mjs"
YIN_KIP=kurtarma YIN_LIB="$W/server/lib/db.mjs" YIN_N=200 node tools/kanit.mjs kos db-acilis-kurtarma-yeni-200 -- node --test --test-concurrency=1 "$S/betik/yineleme.test.mjs"
YIN_KIP=n5 YIN_DEPO="$S/eski" YIN_N=30 node tools/kanit.mjs kos db-acilis-n5-eski-899fdbce-30 -- node --test --test-concurrency=1 "$S/betik/yineleme.test.mjs"
YIN_KIP=n5 YIN_DEPO="$W" YIN_N=50 node tools/kanit.mjs kos db-acilis-n5-yeni-50 -- node --test --test-concurrency=1 "$S/betik/yineleme.test.mjs"
echo BITTI
