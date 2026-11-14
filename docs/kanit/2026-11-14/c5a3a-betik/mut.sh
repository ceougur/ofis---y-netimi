#!/bin/bash
# Ç5-A tur 3a kabul B/D: (1) yeni mutasyon taraması (modülün 14 karşı mutantı) git archive kopyasında; (2) tyk-mutasyon-250'nin modüle taşınan 7 API mutantı (yeni yerlerinde).
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3a-t1
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a068d42a7b77ba335
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N/kanit
mkdir -p $N/mut-dokum $N/tyk-mut-klasor || exit 1
cd $YENI || exit 1
echo "başta $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
timeout -k 5 3000 node tools/kanit.mjs kos c5a3a-mutasyon -- node test/obligation-input-250-mutasyon.mjs --kopya $N/mut --dokum $N/mut-dokum > $N/mut.out 2>&1
echo "obligation-input mutasyon çıkış $? · $(grep -E '^SONUÇ' $N/mut.out)"
timeout -k 5 3000 node tools/kanit.mjs kos c5a3a-tyk-mutasyon-tasinan -- node test/tyk-mutasyon-250.mjs --klasor $N/tyk-mut-klasor --yalniz O1-API,O1C-a,O1C-b,O1C-d,D05,D06,KD5-c > $N/tyk-mut.out 2>&1
echo "tyk-mutasyon (taşınan 7) çıkış $? · $(tail -1 $N/tyk-mut.out)"
echo "sonda $(cat /proc/loadavg) $(date -u +%H:%M:%S)"
