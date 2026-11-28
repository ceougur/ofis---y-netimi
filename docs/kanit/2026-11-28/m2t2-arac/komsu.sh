#!/bin/bash
# M2T2 komşular (ders 10) — komsu-liste.txt (80 dosya), YENİ kod, verilen saat diliminde; aynı anda en çok 2 dosya.
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2/kanit
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a2da3cc091eb2c5df
tz=${1:-UTC}
n=$(echo "$tz" | tr '/' '-')
cd "$W" || exit 1
mapfile -t FILES < /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2/komsu-liste.txt
TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K node tools/kanit.mjs kos "m2t2-komsular-$n" -- node --test --test-concurrency=2 "${FILES[@]}"
echo bitti > "$K/komsu-$n-bitti.txt"
