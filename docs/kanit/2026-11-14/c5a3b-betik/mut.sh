#!/bin/bash
# Ç5-A tur 3b — mutasyon (yük koşusu; flock -s ile başlatılır): obligation-input-250 (26), r2-249 M1–M7, tyk-mutasyon-250'nin taşınan desenleri (KD1-c/d/e/f/i).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
T=$S/c5a3b-z4
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a076afd863444806e
K=$T/mut
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$T/kanit
echo "mut başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
cd $W || exit 1
node tools/kanit.mjs kos c5a3b-mut-oi -- node $K/test/obligation-input-250-mutasyon.mjs --kopya $K --dokum $T/mut-dokum > $T/mut-oi.out 2>&1; echo "oi çıkış $? · $(grep SONUÇ $T/mut-oi.out) · $(date -u +%H:%M:%S)"
node tools/kanit.mjs kos c5a3b-mut-r2 -- node $K/test/r2-249/mutasyon.mjs $K > $T/mut-r2.out 2>&1; echo "r2 çıkış $? · $(grep -E '^# (pass|fail)' $T/mut-r2.out | tr '\n' ' ') · $(date -u +%H:%M:%S)"
rm -rf $T/tyk-mut-k && mkdir -p $T/tyk-mut-k
node tools/kanit.mjs kos c5a3b-mut-tyk -- node $K/test/tyk-mutasyon-250.mjs --klasor $T/tyk-mut-k --yalniz KD1-c,KD1-d,KD1-e,KD1-f,KD1-i > $T/mut-tyk.out 2>&1; echo "tyk çıkış $? · $(tail -2 $T/mut-tyk.out | tr '\n' ' ') · $(date -u +%H:%M:%S)"
rm -rf $T/tyk-mut-k
echo "mut sonda $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
