#!/bin/bash
# WK 17: kod commit'inden (temiz ağaç) bütün kanıt koşuları — iki saat dilimi. Depo kökünden: bash <bu dosya>
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-af5d3ff11385d060f
KD=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/wk17-calisma/kanit
cd "$W" || exit 1
echo "HEAD $(git rev-parse HEAD); ağaç: $(git status -s | wc -l) değişmiş"
KANIT_DIR=$KD TZ=UTC node tools/kanit.mjs kos wk17-senaryolar -- python3 -I test/bagimsiz/whatsapp-248/kahin/senaryolar.py | tail -1
sha256sum test/bagimsiz/whatsapp-248/kahin/senaryolar.json
KANIT_DIR=$KD TZ=Europe/Istanbul node tools/kanit.mjs kos wk17-senaryolar-tz-istanbul -- python3 -I test/bagimsiz/whatsapp-248/kahin/senaryolar.py | tail -1
sha256sum test/bagimsiz/whatsapp-248/kahin/senaryolar.json
git status -s
KANIT_DIR=$KD TZ=UTC node tools/kanit.mjs kos wk17-kahin -- python3 -I test/bagimsiz/whatsapp-248/kahin/kahin_test.py | tail -1
KANIT_DIR=$KD TZ=Europe/Istanbul node tools/kanit.mjs kos wk17-kahin-tz-istanbul -- python3 -I test/bagimsiz/whatsapp-248/kahin/kahin_test.py | tail -1
bash /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/wk17-calisma/araclar/kanit-uret.sh
