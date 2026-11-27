#!/usr/bin/env bash
# G2 komşu koşusu: bash komsu-kos.sh <TZ> <ad> <eşzamanlılık>  — çalışma ağacında, liste wkucuk-komsu-son.txt
set -u
P=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7c02d003909b3c2a
cd "$W" || exit 1
mapfile -t FILES < "$P/wkucuk-komsu-son.txt"
export TZ="$1" HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$P/wkucuk-kanit" T6_KOK="$P/wkucuk-t6kok-$2"
exec node tools/kanit.mjs kos "$2" -- node --disable-warning=ExperimentalWarning --test --test-concurrency="$3" "${FILES[@]}"
