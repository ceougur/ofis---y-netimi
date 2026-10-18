#!/bin/bash
# H6 düzen kayması: eski kodda ve H2/H3/H5 sonrası kodda (a4735d0) kırmızı mı? İsteğe bağlı 1. argüman: "yeni" → çalışma ağacı da koşulur.
set -uo pipefail
S=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a477c416a56bc423c
OUT=$S/hiz243-arac/e2e
export HUKUK_LICENSE_URL=http://127.0.0.1:9
exec 9>$S/e2e-243.lock
flock 9
echo "H6 kilit alındı $(date -u +%T)" >> $OUT/ozet.log
cd $W
for depo in hiz243-eski-4d546e9 hiz243-sonra-a4735d0; do
  if [ "${1:-}" = "yeni" ] && [ "$depo" != "hiz243-eski-4d546e9" ]; then continue; fi
  DEPO=$S/$depo timeout 600 node --disable-warning=ExperimentalWarning test/e2e/fatura-243-duzen-kaymasi.mjs > $OUT/duzen-kaymasi-$depo.out 2>&1
  echo "duzen-kaymasi $depo çıkış $? $(date -u +%T): $(tail -1 $OUT/duzen-kaymasi-$depo.out)" >> $OUT/ozet.log
done
if [ "${1:-}" = "yeni" ]; then
  timeout 600 node --disable-warning=ExperimentalWarning test/e2e/fatura-243-duzen-kaymasi.mjs > $OUT/duzen-kaymasi-yeni.out 2>&1
  echo "duzen-kaymasi yeni çıkış $? $(date -u +%T): $(tail -1 $OUT/duzen-kaymasi-yeni.out)" >> $OUT/ozet.log
fi
echo "H6 BİTTİ $(date -u +%T)" >> $OUT/ozet.log
