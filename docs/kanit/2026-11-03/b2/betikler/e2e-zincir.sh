#!/bin/bash
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a95435e4eb1b4db61
cd $YENI || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/b2-kod-a954/pw
for A in senaryo-whatsapp senaryo-213 senaryo-whatsapp-gonder-248 senaryo-whatsapp-donem-248 senaryo-is-akisi-248 senaryo-tarih-248; do
  node tools/kanit.mjs kos b2/e2e-$A -- node --disable-warning=ExperimentalWarning test/e2e/$A.mjs > /tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/b2-kod-a954/e2e-$A.out 2>&1
  echo "$A çıkış=$?" >> /tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/b2-kod-a954/e2e-zincir.txt
done
echo bitti >> /tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/b2-kod-a954/e2e-zincir.txt
