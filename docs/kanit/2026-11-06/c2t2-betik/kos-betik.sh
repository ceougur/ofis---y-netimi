#!/bin/bash
# Ç2 tur 2 — tek betiği (TAP özetli) verilen kod kökünde iki saat diliminde tools/kanit.mjs kos ile koşar.
# Kullanım: bash kos-betik.sh <etiket> <kod kökü> <betik ve argümanları...>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a12ba6b14c23f5029
TAG="$1"
CODE="$2"
shift 2
for tz in UTC Europe/Istanbul; do
  t=$(echo "$tz" | tr '/' '-')
  (cd "$CODE" && HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$S/c2t2-kanit" TZ="$tz" node "$W/tools/kanit.mjs" kos "c2t2-$TAG-$t" -- node --disable-warning=ExperimentalWarning "$@") 2>&1 | grep -E "kanit\]|^not ok"
done
