#!/bin/bash
# Ç6-HESAP tur 3 — kâhin önce / sonra (YÜK). Kullanım: bash kahin.sh <once|sonra>  (once = c6h2-uc kopyası /dev/shm/c6h3-eski; sonra = bu ağaç)
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana
E=$1
if [ "$E" = once ]; then R=/dev/shm/c6h3-eski; else R=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab54e5fc492a09964; fi
cd "$R" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N/kanit
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab54e5fc492a09964
echo "başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · $E ($R)"
timeout -k 10 2400 node $W/tools/kanit.mjs kos c6h3-kahin-defter-$E -- npm run test:kahin-defter > $N/kahin-defter-$E.out 2>&1
echo "defter çıkış $?"
timeout -k 10 2400 node $W/tools/kanit.mjs kos c6h3-kahin-cari-$E -- npm run test:kahin-cari > $N/kahin-cari-$E.out 2>&1
echo "cari çıkış $?"
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
