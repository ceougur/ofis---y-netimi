#!/bin/bash
# Ç5-A tur 3c: komşular (komsu.txt — tarama: değişen dosyaları adıyla / /api/workspace/accounts yolunu / 'doubtful' anan testler) iki TZ, çalışma ağacı (git; eski sürüm etiketi isteyen testler için).
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3c-k7
R=/home/user/ofis---y-netimi/.claude/worktrees/agent-a21e56c46518ba374
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K/komsu-kanit
mkdir -p $KANIT_DIR
echo "komşu başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · $(wc -l < $K/komsu.txt) dosya" > $K/komsu.log
cd $R || exit 1
for Z in UTC Europe/Istanbul; do
  TZ=$Z timeout -k 5 3600 node tools/kanit.mjs kos c5a3c-komsu-${Z#*/} -- node --disable-warning=ExperimentalWarning --test --test-concurrency=2 $(cat $K/komsu.txt) > $K/komsu-${Z#*/}.out 2>&1
  echo "komşu $Z çıkış $? · $(tail -1 $K/komsu-${Z#*/}.out) · $(date -u +%H:%M:%S)" >> $K/komsu.log
done
echo "komşu sonda $(cat /proc/loadavg) · $(date -u +%H:%M:%S)" >> $K/komsu.log
