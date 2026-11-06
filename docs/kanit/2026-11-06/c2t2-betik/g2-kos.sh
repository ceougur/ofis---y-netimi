#!/bin/bash
# Ç2 tur 2 — G2 komşu taraması (g2-liste.txt) verilen saat diliminde, çalışma ağacında.
# Kullanım: bash g2-kos.sh <TZ>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a12ba6b14c23f5029
tz="$1"
t=$(echo "$tz" | tr '/' '-')
cd "$W" || exit 1
mapfile -t FILES < "$S/c2t2-betik/g2-liste.txt"
HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$S/c2t2-kanit" TZ="$tz" node tools/kanit.mjs kos "c2t2-g2-komsu-$t" -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 "${FILES[@]}" 2>&1 | grep -E "kanit\]"
