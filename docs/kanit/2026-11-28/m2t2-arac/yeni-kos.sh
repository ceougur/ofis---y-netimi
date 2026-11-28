#!/bin/bash
# M2T2: yeni testler YENİ kodda iki saat diliminde (kanıt), sonra mutasyon.
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2/kanit
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a2da3cc091eb2c5df
cd "$W" || exit 1
for tz in UTC Europe/Istanbul; do
  n=$(echo "$tz" | tr '/' '-')
  TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K node tools/kanit.mjs kos "m2t2-yeni-testler-$n" -- node --test test/supheli-degersiz-hiz-m2t2-251.test.mjs test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs
done
for tz in UTC Europe/Istanbul; do
  n=$(echo "$tz" | tr '/' '-')
  mkdir -p "$K/ekran-$n"
  TZ=$tz EKRAN_DIR="$K/ekran-$n" PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K node tools/kanit.mjs kos "m2t2-e2e-degersiz-siniri-$n" -- node --disable-warning=ExperimentalWarning test/e2e/senaryo-degersiz-siniri-m2-251.mjs
  mkdir -p "$K/ekran-iptal-$n"
  TZ=$tz EKRAN_DIR="$K/ekran-iptal-$n" PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$K node tools/kanit.mjs kos "m2t2-e2e-degersiz-iptal-$n" -- node --disable-warning=ExperimentalWarning test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs
done
python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2/betik/mutant.py > "$K/mutant-ozet.txt" 2>&1
echo bitti > "$K/yeni-bitti.txt"
