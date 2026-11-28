#!/bin/bash
# M5 son metinle yeniden (mutant kopyasına f9e0982f'nin iki dosyası)
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a00060fd6c1db3744
SP=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
cp "$W/client/assets/hof-accounts.js" /dev/shm/mi3-dk/mut/client/assets/hof-accounts.js || exit 1
cp "$W/test/e2e/senaryo-mi2-251.mjs" /dev/shm/mi3-dk/mut/test/e2e/senaryo-mi2-251.mjs || exit 1
mv "$SP/mi3-kanit/mutant/ozet.json" "$SP/mi3-kanit/mutant/ozet-8824da16.json" || exit 1
cd /dev/shm/mi3-dk/mut || exit 1
PLAYWRIGHT_BROWSERS_PATH=$SP/pw-1194 python3 -I "$SP/mi3-betik/mutant.py" M5-bekleyen-yazi-yok
