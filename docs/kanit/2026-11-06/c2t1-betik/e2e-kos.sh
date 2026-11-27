#!/usr/bin/env bash
# Ç2 tur 1 — G2 e2e (dönem kilidi / fiş / şema kapısı yollarına dokunan senaryolar) sırayla; her biri kanit.mjs kos ile ayrı kayıt.
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a916111504e511b77 || exit 1
export KANIT_DIR=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c2t1-kanit
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
for name in sema-kapisi-bs7 senaryo-defter-243 gg243-banka-kart-aciklama gg244-numara-tarih-onay senaryo-224 senaryo-226 senaryo-213 senaryo-banka-210; do
  node tools/kanit.mjs kos "c2t1-e2e-$name" -- npm run "test:$name" > /dev/null 2>&1
  tail -1 "$KANIT_DIR/$(date -u +%F)/c2t1-e2e-$name.log" 2>/dev/null
  node -e "const d=require('$KANIT_DIR/$(date -u +%F)/c2t1-e2e-$name.json'); console.log('$name', d.hukum, d.cikis_kodu, JSON.stringify(d.ozet))"
done
