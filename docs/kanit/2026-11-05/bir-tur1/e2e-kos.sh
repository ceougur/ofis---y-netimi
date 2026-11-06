#!/usr/bin/env bash
# BİRLEŞİK TUR 1 — taramanın bulduğu e2e'ler (düzeltme formları + Değişiklik Geçmişi süzgeci), sırayla; her biri tools/kanit.mjs kos ile.
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-aa1f99bc9929b8195 || exit 1
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
export HUKUK_LICENSE_URL=http://127.0.0.1:9
OUT=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bir-tur1-a7f3/e2e-ozet.txt
: > "$OUT"
for name in senaryo-defter-turu-250 senaryo-cari-vade-245 senaryo-banka-210b senaryo-banka-210-eski-satir senaryo-pos-kart-249 senaryo-personel-244 senaryo-210 senaryo-221 e2e; do
  node tools/kanit.mjs kos "bir-tur1-e2e-$name" -- npm run "test:$name" > "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bir-tur1-a7f3/e2e-$name.txt" 2>&1
  code=$?
  echo "$name çıkış=$code $(grep '^\[kanit\] bir-tur1-e2e' "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bir-tur1-a7f3/e2e-$name.txt" | tail -1)" >> "$OUT"
done
echo "# bitti" >> "$OUT"
