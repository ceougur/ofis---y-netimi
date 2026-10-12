#!/bin/bash
# G1 önce/sonra: AYNI 15.000 çeklik veri kopyası (her ölçümde taze kopya), düzeltme öncesi (4d8003a, ayrı kopya) ↔ sonrası sırayla iki tur (ders 15).
set -u
S=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/wf_d306f93b-be4-1
OLD=$S/iz4-tur2-eski-4d8003a
K=$W/docs/kanit/2026-10-12/tahsile-ver/duzeltme-tur2
mkdir -p $OLD/docs/kanit/2026-10-12/tahsile-ver/duzeltme-tur2
cp $K/olc-g1.mjs $OLD/docs/kanit/2026-10-12/tahsile-ver/duzeltme-tur2/
uptime > $K/olc-g1.durum
for tur in 1 2; do
  for v in eski-4d8003a yeni; do
    rm -rf $S/iz4-tur2-g1-kopya; cp -a $S/iz4-tur2-g1-veri $S/iz4-tur2-g1-kopya
    if [ $v = yeni ]; then root=$W; else root=$OLD; fi
    (cd $root && SURUM_GIT=$W node --disable-warning=ExperimentalWarning docs/kanit/2026-10-12/tahsile-ver/duzeltme-tur2/olc-g1.mjs $S/iz4-tur2-g1-kopya $K/olc-g1-$v-$tur.json > $K/olc-g1-$v-$tur.log 2>&1)
    echo "$v tur $tur cikis=$? $(uptime)" >> $K/olc-g1.durum
  done
done
rm -rf $S/iz4-tur2-g1-kopya
echo BITTI >> $K/olc-g1.durum
