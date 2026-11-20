#!/bin/bash
# Ç6-HESAP tur 3 — G2 komşu koşusu (YÜK; flock -s içinde). Kullanım: bash komsu-kos.sh <TZ> <parça: 1|2>  (liste ikiye bölünür — ≤ 40 dk parçalar)
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-ab54e5fc492a09964 || exit 1
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana
TZN=$1
PART=$2
TOTAL=$(wc -l < $N/komsu.txt)
HALF=$(( (TOTAL + 1) / 2 ))
if [ "$PART" = 1 ]; then FILES=$(head -n $HALF $N/komsu.txt | tr '\n' ' '); else FILES=$(tail -n +$((HALF + 1)) $N/komsu.txt | tr '\n' ' '); fi
AD=c6h3-komsu-$(echo $TZN | tr / - | tr A-Z a-z)-$PART
echo "başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · $AD"
TZ=$TZN HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N/kanit timeout -k 10 2700 node tools/kanit.mjs kos $AD -- node --test --test-concurrency=3 $FILES 2>&1 | tail -4
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
