#!/bin/bash
# Ç6-HESAP tur 2 — YÜK parçası B (flock -s içinde): G2 komşu yığını iki TZ + kâhin sonra + dondurma zorlama kipleri (bitir / gozlem) — yeni uç testi.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7236347e0f8b6e8c
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N
cd "$WT" || exit 1
echo "B başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · uç $(git rev-parse --short HEAD)"
FILES=$(tr '\n' ' ' < "$N/komsu.txt")
# Yeni testler son uçta (d3b2da11 kaynak adedi düzeltmesinden sonra) yeniden, iki TZ.
for tz in UTC Europe/Istanbul; do
  ad=$(echo "$tz" | tr '/' '-')
  TZ=$tz timeout -k 10 1200 node tools/kanit.mjs kos "c6h2-yeni-son-$ad" -- node --test test/c6h-bilanco.test.mjs test/c6h-bilanco-uc.test.mjs test/c6h-ba.test.mjs test/c6h-s209.test.mjs test/c6h-degerleme.test.mjs test/c6h-gelir-tablosu.test.mjs test/c6h-uc.test.mjs > $N/yeni-son-$ad.out 2>&1
  echo "yeni (son uç) $tz çıkış $? · $(grep -E '^# (tests|pass|fail|cancelled|skipped)' $N/yeni-son-$ad.out | tr '\n' ' ')"
done
for tz in UTC Europe/Istanbul; do
  ad=$(echo "$tz" | tr '/' '-')
  TZ=$tz timeout -k 10 2400 node tools/kanit.mjs kos "c6h2-komsu-$ad" -- node --test --test-concurrency=3 $FILES > $N/komsu-$ad.out 2>&1
  echo "komşu $tz çıkış $? · $(grep -E '^# (tests|pass|fail|cancelled|skipped)' $N/komsu-$ad.out | tr '\n' ' ')"
done
for kip in bitir gozlem; do
  DONDURMA_YARIS=$kip timeout -k 10 900 node tools/kanit.mjs kos "c6h2-zorla-$kip" -- node test/b7-dondurma-yaris-zorla.mjs test/c6h-bilanco-uc.test.mjs 1 --ad '' > $N/zorla-$kip.out 2>&1
  echo "zorla $kip çıkış $? · $(grep -E 'zorla özet' $N/zorla-$kip.out)"
done
bash $N/kahin.sh sonra
echo "B sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
