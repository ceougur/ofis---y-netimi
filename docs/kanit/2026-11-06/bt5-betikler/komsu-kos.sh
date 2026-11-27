#!/bin/bash
# BT5: G2 komşu dosyaları (bt5-kanit/komsu.txt) + yeni test dosyaları, güncel kodda, kanıt aracıyla. Kullanım: komsu-kos.sh <TZ> <ad>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a731f6dec73e0177c
cd "$W" || exit 1
mapfile -t FILES < "$S/bt5-kanit/komsu.txt"
FILES+=(test/acilis-onarimi-savunma-250.test.mjs test/kapali-kart-ekstre-tarihi-250.test.mjs)
mapfile -t FILES < <(printf '%s\n' "${FILES[@]}" | sort -u)
echo "dosya: ${#FILES[@]}"
KANIT_DIR="$S/bt5-kanit" TZ="$1" HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout 7000 node tools/kanit.mjs kos "$2" -- node --disable-warning=ExperimentalWarning --test --test-concurrency=3 "${FILES[@]}"
echo "kanit çıkış $?"
