#!/bin/bash
# 2.4.3 hız: yeni e2e'lerin eski kodda kırmızı / yeni kodda yeşil kanıtı (ortak e2e kilidi altında).
set -uo pipefail
S=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a477c416a56bc423c
OUT=$S/hiz243-arac/e2e
mkdir -p $OUT
export HUKUK_LICENSE_URL=http://127.0.0.1:9
exec 9>$S/e2e-243.lock
echo "kilit bekleniyor $(date -u +%T)" >> $OUT/ozet.log
flock 9
echo "kilit alındı $(date -u +%T); df $(df -h / | tail -1 | awk '{print $4}') boş" >> $OUT/ozet.log
cd $W
for t in hiz-243-arka-plan fatura-243-daha-fazla-yaris; do
  DEPO=$S/hiz243-eski-4d546e9 timeout 900 node --disable-warning=ExperimentalWarning test/e2e/$t.mjs > $OUT/$t-eski.out 2>&1
  echo "$t eski çıkış $? $(date -u +%T): $(tail -1 $OUT/$t-eski.out)" >> $OUT/ozet.log
  timeout 900 node --disable-warning=ExperimentalWarning test/e2e/$t.mjs > $OUT/$t-yeni.out 2>&1
  echo "$t yeni çıkış $? $(date -u +%T): $(tail -1 $OUT/$t-yeni.out)" >> $OUT/ozet.log
done
echo "BİTTİ $(date -u +%T)" >> $OUT/ozet.log
