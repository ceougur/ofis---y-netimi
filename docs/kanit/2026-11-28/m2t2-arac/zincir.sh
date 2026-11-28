#!/bin/bash
# M2T2 sıralı zincir (yük kuralı: ağır koşular aynı anda değil): yeni testler + e2e + mutasyon → kâhin cari + defter → komşular UTC → komşular İstanbul → hız tablosu.
B=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2/betik
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2/kanit
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a2da3cc091eb2c5df
timeout -k 5 5400 bash "$B/yeni-kos.sh"
cd "$W" || exit 1
HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K timeout -k 5 3600 node tools/kanit.mjs kos m2t2-kahin-cari -- npm run test:kahin-cari
HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K timeout -k 5 3600 node tools/kanit.mjs kos m2t2-kahin-defter -- npm run test:kahin-defter
timeout -k 5 7200 bash "$B/komsu.sh" UTC
timeout -k 5 7200 bash "$B/komsu.sh" Europe/Istanbul
timeout -k 5 3600 bash "$B/olc-hepsi.sh"
echo bitti > "$K/zincir-bitti.txt"
