#!/bin/bash
# AH + BS-6 G2 komşu listesi (komsu-hepsi.txt, test/ taranarak) TEK saat diliminde, kanit.mjs kos ile; --test-concurrency=1 (npm test gibi).
#   bash komsu-kos-tz.sh <TZ>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-ab0062d42feec8f21
tz="$1"
ad=$(echo "$tz" | tr '/' '-')
cd "$W" || exit 1
mapfile -t FILES < $S/ah-kanit/komsu-hepsi.txt
echo "== $tz $(date -u +%H:%M:%S) (${#FILES[@]} dosya)"
KANIT_DIR=$S/ah-kanit HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=$tz node tools/kanit.mjs kos ah-komsu-$ad -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 "${FILES[@]}" > $S/ah-kanit/komsu-$ad.out 2>&1
echo "cikis $? $(date -u +%H:%M:%S)"
tail -4 $S/ah-kanit/komsu-$ad.out
touch $S/ah-kanit/KOMSU-$ad.BITTI
