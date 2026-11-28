#!/bin/bash
# M2T2 aşama 2 (son kod): yeni testler iki TZ (son hâl) → mutasyon (12) → kâhin cari + defter.
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2/kanit
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a2da3cc091eb2c5df
cd "$W" || exit 1
for tz in UTC Europe/Istanbul; do
  n=$(echo "$tz" | tr '/' '-')
  TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K node tools/kanit.mjs kos "m2t2-son-yeni-testler-$n" -- node --test test/supheli-degersiz-hiz-m2t2-251.test.mjs test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs
done
python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2/betik/mutant.py > "$K/mutant-ozet-son.txt" 2>&1
HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K node tools/kanit.mjs kos m2t2-kahin-cari -- npm run test:kahin-cari
HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K node tools/kanit.mjs kos m2t2-kahin-defter -- npm run test:kahin-defter
echo bitti > "$K/asama2-bitti.txt"
