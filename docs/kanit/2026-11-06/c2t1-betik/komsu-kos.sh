#!/usr/bin/env bash
# Ç2 tur 1 — G2 komşu testleri (203 dosya: değişen dosyaları adıyla / API yoluyla anan testler + kaynak tarayan testler) tek saat diliminde.
# Kullanım: bash komsu-kos.sh <TZ> <etiket>
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a916111504e511b77 || exit 1
LIST=$(cat /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c2t1-betik/komsu-birlesik.txt)
export KANIT_DIR=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c2t1-kanit
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export TZ="$1"
# shellcheck disable=SC2086
node tools/kanit.mjs kos "c2t1-komsu-$2" -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 $LIST
