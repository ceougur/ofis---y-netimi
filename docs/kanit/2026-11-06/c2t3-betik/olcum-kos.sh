#!/usr/bin/env bash
# Ç2 tur 3 — ders 47 ölçümü, ölçüm kilidiyle (ders 15).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
cd "$S/c2t3-betik" || exit 1
HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC timeout 1200 flock "$S/olcum.lock" node --disable-warning=ExperimentalWarning olcum-kayit.mjs /home/user/ofis---y-netimi/.claude/worktrees/agent-a7280bb16b4491d5b "$S/c2t3-eski-bc495a1c" 600 5000 > "$S/c2t3-calisma/olcum-kayit.txt" 2>&1
echo "çıkış $?"
cat "$S/c2t3-calisma/olcum-kayit.txt"
