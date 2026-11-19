#!/bin/bash
# Ç6-HESAP tur 1 — komşu yığını (iki TZ) + kâhin önce / sonra. YÜK koşusu: paylaşımlı ölçüm kilidiyle çağrılır (flock -s -n).
# Kullanım: bash komsu-kos.sh
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h1-ns
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a91ebf10c57360da7
TABAN=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h1-taban
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export KANIT_DIR=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h1-kanit
echo "başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · uç $(git -C "$WT" rev-parse --short HEAD)"
cd "$WT" || exit 1
FILES=$(tr '\n' ' ' < "$N/komsu.txt")
for tz in UTC Europe/Istanbul; do
  ad=$(echo "$tz" | tr '/' '-')
  TZ=$tz timeout -k 10 3000 node tools/kanit.mjs kos "c6h1-komsu-$ad" -- node --test --test-concurrency=3 test/c6h-degerleme.test.mjs test/c6h-gelir-tablosu.test.mjs test/c6h-uc.test.mjs $FILES 2>&1 | tail -4
done
echo "kâhin sonra (uç) $(date -u +%H:%M:%S)"
timeout -k 10 1200 node tools/kanit.mjs kos c6h1-kahin-defter-sonra -- npm run test:kahin-defter 2>&1 | tail -3
timeout -k 10 1200 node tools/kanit.mjs kos c6h1-kahin-cari-sonra -- npm run test:kahin-cari 2>&1 | tail -3
echo "kâhin önce (taban) $(date -u +%H:%M:%S)"
cd "$TABAN" || exit 1
timeout -k 10 1200 node "$WT/tools/kanit.mjs" kos c6h1-kahin-defter-once -- npm run test:kahin-defter 2>&1 | tail -3
timeout -k 10 1200 node "$WT/tools/kanit.mjs" kos c6h1-kahin-cari-once -- npm run test:kahin-cari 2>&1 | tail -3
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
