#!/bin/bash
# BT5: yeni / değişen test dosyaları güncel kodda (commit), iki saat diliminde, kanıt aracıyla.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a731f6dec73e0177c
cd "$W" || exit 1
FILES=(test/db-tx-kayip-250.test.mjs test/whatsapp-we-webhook-bilgisi-250.test.mjs test/sema-kapisi-bs7.test.mjs test/kapali-kart-ekstre-tarihi-250.test.mjs test/birlesik-tur4-degisiklik-yok-250.test.mjs test/acilis-onarimi-savunma-250.test.mjs)
for ZONE in UTC Europe/Istanbul; do
  SHORT=$([ "$ZONE" = UTC ] && echo utc || echo ist)
  KANIT_DIR="$S/bt5-kanit" TZ="$ZONE" HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout 3000 node tools/kanit.mjs kos "bt5-yeni-$SHORT" -- node --disable-warning=ExperimentalWarning --test --test-concurrency=2 "${FILES[@]}" 2>&1 | tail -1
done
