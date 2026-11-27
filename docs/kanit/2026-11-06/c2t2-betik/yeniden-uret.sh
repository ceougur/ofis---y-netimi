#!/bin/bash
# Ç2 tur 2 — dar kontrolün K5 betiklerini verilen kodda (yeni kök = onarım kökü) iki saat diliminde koşar.
# Kullanım: bash yeniden-uret.sh <etiket> <kod kökü>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a12ba6b14c23f5029
TAG="$1"
CODE="$2"
cd "$W" || exit 1
for tz in UTC Europe/Istanbul; do
  t=$(echo "$tz" | tr '/' '-')
  HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$S/c2t2-kanit" TZ="$tz" node tools/kanit.mjs kos "c2t2-k5-saat-ters-$TAG-$t" -- node "$S/c2t2-betik/k5-saat-ters.mjs" "$CODE" "$S/c2t2-v249" 2>&1 | grep -E "^[123]\)|kanit\]"
  for m in geri ileri; do
    HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$S/c2t2-kanit" TZ="$tz" node tools/kanit.mjs kos "c2t2-k5-002-$m-$TAG-$t" -- node "$S/c2t2-betik/k5-002-v249.mjs" "$CODE" "$S/c2t2-v249" "$m" 2>&1 | grep -E "^3\)|SONUC|kanit\]"
  done
done
