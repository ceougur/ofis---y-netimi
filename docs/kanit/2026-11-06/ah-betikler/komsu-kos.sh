#!/bin/bash
# AH + BS-6 G2 komşu listesi (test/ taranarak: komsu-hepsi.txt) iki saat diliminde, kanit.mjs kos ile; --test-concurrency=1 (npm test gibi).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab0062d42feec8f21
cd "$W" || exit 1
mapfile -t FILES < $S/ah-kanit/komsu-hepsi.txt
for tz in UTC Europe/Istanbul; do
  ad=$(echo "$tz" | tr '/' '-')
  echo "== $tz $(date -u +%H:%M:%S) (${#FILES[@]} dosya)"
  KANIT_DIR=$S/ah-kanit HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=$tz node tools/kanit.mjs kos ah-komsu-$ad -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 "${FILES[@]}" > $S/ah-kanit/komsu-$ad.out 2>&1
  echo "cikis $? $(date -u +%H:%M:%S)"
  tail -3 $S/ah-kanit/komsu-$ad.out
done
touch $S/ah-kanit/KOMSU.BITTI
