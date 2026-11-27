#!/bin/bash
# Ç6-HESAP tur 2 — YÜK parçası A (flock -s içinde): yeni testler iki TZ (kanit.mjs), kırmızı kanıt (eski kod), mutasyon (iki TZ).
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7236347e0f8b6e8c
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N
cd "$WT" || exit 1
echo "A başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · uç $(git rev-parse --short HEAD)"
for tz in UTC Europe/Istanbul; do
  ad=$(echo "$tz" | tr '/' '-')
  TZ=$tz timeout -k 10 1200 node tools/kanit.mjs kos "c6h2-yeni-$ad" -- node --test test/c6h-bilanco.test.mjs test/c6h-bilanco-uc.test.mjs test/c6h-ba.test.mjs test/c6h-s209.test.mjs test/c6h-degerleme.test.mjs test/c6h-gelir-tablosu.test.mjs test/c6h-uc.test.mjs > $N/yeni-$ad.out 2>&1
  echo "yeni $tz çıkış $? · $(grep -E '^# (tests|pass|fail|cancelled|skipped)' $N/yeni-$ad.out | tr '\n' ' ')"
done
bash $N/kirmizi.sh
bash $N/mutasyon.sh > $N/mutasyon.log 2>&1
echo "mutasyon: $(grep -c YAKALANDI $N/mutasyon.log) yakalandı, $(grep -c YAŞADI $N/mutasyon.log) yaşadı, $(grep -c UYGULANAMADI $N/mutasyon.log) uygulanamadı"
echo "A sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
