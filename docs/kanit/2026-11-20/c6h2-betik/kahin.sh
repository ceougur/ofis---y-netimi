#!/bin/bash
# kullanım: bash kahin.sh <etiket: once|sonra>
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a7236347e0f8b6e8c || exit 1
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N
E=$1
node tools/kanit.mjs kos c6h2-kahin-defter-$E -- npm run test:kahin-defter > $N/kahin-defter-$E.out 2>&1
echo "defter çıkış $?"
node tools/kanit.mjs kos c6h2-kahin-cari-$E -- npm run test:kahin-cari > $N/kahin-cari-$E.out 2>&1
echo "cari çıkış $?"
echo BITTI
