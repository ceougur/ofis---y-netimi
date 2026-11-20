#!/bin/bash
# Ç6-HESAP tur 1 mutasyon koşusu: her mutant için taze kopya (server + test + tools + package.json), mutant uygulanır, üç yeni test dosyası N kez koşar; kopya silinir.
# Kullanım: bash mutasyon.sh [tekrar=2]   — yük kilidi (flock -s -n) çağıranın işi.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h1-ns
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a91ebf10c57360da7
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h1-mutant
TEKRAR=${1:-2}
export HUKUK_LICENSE_URL=http://127.0.0.1:9
echo "başta yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S) · uç $(git -C "$WT" rev-parse --short HEAD)"
for m in $(python3 -I "$N/mutantlar.py" x --liste); do
  rm -rf "$K"
  mkdir -p "$K" || exit 1
  cp -r "$WT/server" "$WT/test" "$WT/tools" "$WT/package.json" "$K/" || exit 1
  ln -s /home/user/ofis---y-netimi/node_modules "$K/node_modules" || exit 1
  python3 -I "$N/mutantlar.py" "$K" "$m" || exit 1
  for i in $(seq 1 "$TEKRAR"); do
    OUT=$(cd "$K" && timeout -k 5 600 node --test test/c6h-degerleme.test.mjs test/c6h-gelir-tablosu.test.mjs test/c6h-uc.test.mjs 2>&1)
    CODE=$?
    PASS=$(echo "$OUT" | grep -m1 '^# pass' | awk '{print $3}')
    FAIL=$(echo "$OUT" | grep -m1 '^# fail' | awk '{print $3}')
    WHO=$(echo "$OUT" | grep '^    not ok' | sed 's/^    not ok [0-9]* - //' | cut -c1-70 | tr '\n' '|')
    echo "$m koşu $i: çıkış $CODE · geçen $PASS · düşen $FAIL · $([ "$CODE" != 0 ] && echo YAKALANDI || echo YAŞADI) · $WHO"
  done
done
rm -rf "$K"
echo "sonda yük $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
